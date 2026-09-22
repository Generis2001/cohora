import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/privy/server';
import { prisma } from '@/lib/db/client';
import { toApiError } from '@/lib/utils/errors';
import {
  calculateFairFee,
  computeMaxAllowedPrice,
  MIN_SUBSCRIPTION_PRICE_UNITS,
  MIN_SUBSCRIPTION_PRICE_USDC,
} from '@/lib/payments/fairFee';
import { usdcToUnits } from '@/lib/payments/usdc';
import { SubscriptionStatus, ModerationStatus } from '@prisma/client';
import { z } from 'zod';

const createTierSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(250).optional(),
  priceUsdc: z.string(),
  intervalDays: z.number().int().min(1).default(30),
  perks: z.array(z.string()).default([]),
});

export async function GET(req: NextRequest) {
  try {
    const claims = await requireAuth(req);

    const user = await prisma.user.findUnique({
      where: { privyId: claims.userId },
      select: { creator: { select: { id: true, totalEarned: true } } },
    });

    if (!user?.creator) {
      const fairFeeEstimate = calculateFairFee({
        activeSubscribers: 0,
        communityMembers: 0,
        publishedContent: 0,
        listedProducts: 0,
        totalEarnedUsdc: 0,
      });
      return Response.json({
        tiers: [],
        fairFeeEstimate,
        metrics: {
          activeSubscribers: 0,
          communityMembers: 0,
          publishedContent: 0,
          listedProducts: 0,
          totalEarnedUsdc: '0.00',
        },
      });
    }

    const creatorId = user.creator.id;
    const totalEarnedBigInt = user.creator.totalEarned ?? 0n;

    const [existingTiers, activeSubscribers, communityMembers, publishedContent, listedProducts] =
      await Promise.all([
        prisma.subscriptionTier.findMany({
          where: { creatorId },
          orderBy: { priceUsdc: 'asc' },
        }).catch(() => []),
        prisma.subscription.count({
          where: { creatorId, status: SubscriptionStatus.ACTIVE },
        }).catch(() => 0),
        prisma.communityMember.count({
          where: { community: { creatorId, isActive: true } },
        }).catch(() => 0),
        prisma.content.count({
          where: { creatorId, isPublished: true, moderationStatus: ModerationStatus.APPROVED },
        }).catch(() => 0),
        prisma.product.count({
          where: { creatorId, isActive: true },
        }).catch(() => 0),
      ]);

    let tiers = existingTiers;

    if (tiers.length === 0) {
      try {
        const createdTier = await prisma.subscriptionTier.create({
          data: {
            creatorId,
            name: 'Supporter',
            description: 'Support this creator',
            priceUsdc: 250_000n, // \.25 USDC default
            intervalDays: 30,
            isActive: true,
          },
        });
        tiers = [createdTier];
      } catch (e) {
        console.error('Failed to persist default tier:', e);
        tiers = [
          {
            id: 'default-tier-' + creatorId,
            creatorId,
            name: 'Supporter',
            description: 'Support this creator',
            priceUsdc: 250_000n,
            intervalDays: 30,
            isActive: true,
            perks: [],
            maxSubscribers: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      }
    }

    const totalEarnedUsdc = Number(totalEarnedBigInt) / 1_000_000;

    const fairFeeEstimate = calculateFairFee({
      activeSubscribers,
      communityMembers,
      publishedContent,
      listedProducts,
      totalEarnedUsdc,
    });

    const serializedTiers = tiers.map((t) => ({
      id: t.id,
      creatorId: t.creatorId,
      name: t.name,
      description: t.description,
      priceUsdc: t.priceUsdc.toString(),
      intervalDays: t.intervalDays,
      isActive: t.isActive,
      perks: t.perks ?? [],
      maxSubscribers: t.maxSubscribers ?? null,
    }));

    return Response.json({
      tiers: serializedTiers,
      fairFeeEstimate,
      metrics: {
        activeSubscribers,
        communityMembers,
        publishedContent,
        listedProducts,
        totalEarnedUsdc: totalEarnedUsdc.toFixed(2),
      },
    });
  } catch (err) {
    return toApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const claims = await requireAuth(req);

    const user = await prisma.user.findUnique({
      where: { privyId: claims.userId },
      select: { creator: { select: { id: true } } },
    });

    if (!user?.creator) {
      return Response.json({ error: 'Creator profile not found' }, { status: 404 });
    }

    const creatorId = user.creator.id;

    // Fetch live traction metrics to compute the allowed price ceiling
    const [activeSubscribers, communityMembers] = await Promise.all([
      prisma.subscription.count({
        where: { creatorId, status: SubscriptionStatus.ACTIVE },
      }).catch(() => 0),
      prisma.communityMember.count({
        where: { community: { creatorId, isActive: true } },
      }).catch(() => 0),
    ]);

    const maxAllowed = computeMaxAllowedPrice({
      activeSubscribers,
      communityMembers,
      publishedContent: 0,
      listedProducts: 0,
      totalEarnedUsdc: 0,
    });

    const body = await req.json();
    const data = createTierSchema.parse(body);

    const priceNum = parseFloat(data.priceUsdc);
    if (
      isNaN(priceNum) ||
      priceNum < MIN_SUBSCRIPTION_PRICE_USDC ||
      priceNum > maxAllowed
    ) {
      return Response.json(
        {
          error: Subscription fee must be between {MIN_SUBSCRIPTION_PRICE_USDC.toFixed(2)} USDC and {maxAllowed.toFixed(2)} USDC (your current traction maximum).,
        },
        { status: 400 },
      );
    }

    const priceUnits = usdcToUnits(priceNum);
    if (priceUnits < MIN_SUBSCRIPTION_PRICE_UNITS) {
      return Response.json(
        { error: 'Subscription fee must be at least .05 USDC.' },
        { status: 400 },
      );
    }

    const tier = await prisma.subscriptionTier.create({
      data: {
        creatorId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        priceUsdc: priceUnits,
        intervalDays: data.intervalDays,
        perks: data.perks,
        isActive: true,
      },
    });

    return Response.json({ ...tier, priceUsdc: tier.priceUsdc.toString() }, { status: 201 });
  } catch (err) {
    return toApiError(err);
  }
}
