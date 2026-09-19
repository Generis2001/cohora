import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/privy/server';
import { prisma } from '@/lib/db/client';
import { toApiError } from '@/lib/utils/errors';
import { calculateFairFee, MIN_SUBSCRIPTION_PRICE_UNITS } from '@/lib/payments/fairFee';
import { usdcToUnits } from '@/lib/payments/usdc';
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
      select: {
        creator: {
          select: {
            id: true,
            totalEarned: true,
            subscriptionTiers: { orderBy: { priceUsdc: 'asc' } },
            subscriptions: { where: { status: 'ACTIVE' } },
            communities: { select: { _count: { select: { members: true } } } },
            content: { where: { isPublished: true, moderationStatus: 'APPROVED' } },
            products: true,
          },
        },
      },
    });

    if (!user?.creator) {
      return Response.json({ error: 'Creator profile not found' }, { status: 404 });
    }

    const creator = user.creator;

    const activeSubscribers = creator.subscriptions.length;
    const communityMembers = creator.communities.reduce((acc, c) => acc + c._count.members, 0);
    const publishedContent = creator.content.length;
    const listedProducts = creator.products.length;
    const totalEarnedUsdc = Number(creator.totalEarned) / 1_000_000;

    const fairFeeEstimate = calculateFairFee({
      activeSubscribers,
      communityMembers,
      publishedContent,
      listedProducts,
      totalEarnedUsdc,
    });

    const tiers = creator.subscriptionTiers.map((t) => ({
      ...t,
      priceUsdc: t.priceUsdc.toString(),
    }));

    return Response.json({
      tiers,
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

    const body = await req.json();
    const data = createTierSchema.parse(body);

    const priceNum = parseFloat(data.priceUsdc);
    if (isNaN(priceNum) || priceNum < 0.05) {
      return Response.json({ error: 'Subscription fee cannot be below $0.05 USDC baseline' }, { status: 400 });
    }

    const priceUnits = usdcToUnits(priceNum);
    if (priceUnits < MIN_SUBSCRIPTION_PRICE_UNITS) {
      return Response.json({ error: 'Subscription fee cannot be below $0.05 USDC baseline' }, { status: 400 });
    }

    const tier = await prisma.subscriptionTier.create({
      data: {
        creatorId: user.creator.id,
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
