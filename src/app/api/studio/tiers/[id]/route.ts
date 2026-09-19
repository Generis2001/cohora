import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/privy/server';
import { prisma } from '@/lib/db/client';
import { toApiError } from '@/lib/utils/errors';
import { MIN_SUBSCRIPTION_PRICE_UNITS } from '@/lib/payments/fairFee';
import { usdcToUnits } from '@/lib/payments/usdc';
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

    const tier = await prisma.subscriptionTier.findUnique({ where: { id } });
    if (!tier || tier.creatorId !== user.creator.id) {
      return Response.json({ error: 'Subscription tier not found' }, { status: 404 });
    }

    const body = await req.json();
    const data = updateTierSchema.parse(body);

    let priceUnits = tier.priceUsdc;
    if (data.priceUsdc !== undefined) {
      const priceNum = parseFloat(data.priceUsdc);
      if (isNaN(priceNum) || priceNum < 0.05) {
        return Response.json({ error: 'Subscription fee cannot be below $0.05 USDC baseline' }, { status: 400 });
      }
      priceUnits = usdcToUnits(priceNum);
      if (priceUnits < MIN_SUBSCRIPTION_PRICE_UNITS) {
        return Response.json({ error: 'Subscription fee cannot be below $0.05 USDC baseline' }, { status: 400 });
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
