import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/privy/server';
import { prisma } from '@/lib/db/client';
import { toApiError } from '@/lib/utils/errors';
import {
  computeMaxAllowedPrice,
  MIN_SUBSCRIPTION_PRICE_UNITS,
  MIN_SUBSCRIPTION_PRICE_USDC,
} from '@/lib/payments/fairFee';
import { usdcToUnits } from '@/lib/payments/usdc';
import { SubscriptionStatus } from '@prisma/client';
import { z } from 'zod';

const updateTierSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(250).optional(),
  priceUsdc: z.string().optional(),
  perks: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireAuth(req);
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { privyId: claims.userId },
      select: { creator: { select: { id: true } } },
    });

    if (!user?.creator) {
      return Response.json({ error: 'Creator profile not found' }, { status: 404 });
    }

    const creatorId = user.creator.id;

    const tier = await prisma.subscriptionTier.findUnique({ where: { id } });
    if (!tier || tier.creatorId !== creatorId) {
      return Response.json({ error: 'Subscription tier not found' }, { status: 404 });
    }

    const body = await req.json();
    const data = updateTierSchema.parse(body);

    let priceUnits = tier.priceUsdc;

    if (data.priceUsdc !== undefined) {
      // Fetch live traction metrics to compute the allowed price ceiling for this creator
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

      const priceNum = parseFloat(data.priceUsdc);
      if (
        isNaN(priceNum) ||
        priceNum < MIN_SUBSCRIPTION_PRICE_USDC ||
        priceNum > maxAllowed
      ) {
        return Response.json(
          {
            error: `Subscription fee must be between $${MIN_SUBSCRIPTION_PRICE_USDC.toFixed(2)} USDC and $${maxAllowed.toFixed(2)} USDC (your current traction maximum). Grow your subscriber base and community to unlock higher price limits.`,
          },
          { status: 400 },
        );
      }

      priceUnits = usdcToUnits(priceNum);
      if (priceUnits < MIN_SUBSCRIPTION_PRICE_UNITS) {
        return Response.json(
          { error: 'Subscription fee must be at least $0.05 USDC.' },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.subscriptionTier.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description.trim() || null }),
        priceUsdc: priceUnits,
        ...(data.perks !== undefined && { perks: data.perks }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    return Response.json({ ...updated, priceUsdc: updated.priceUsdc.toString() });
  } catch (err) {
    return toApiError(err);
  }
}
