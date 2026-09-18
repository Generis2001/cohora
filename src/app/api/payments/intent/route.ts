import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/privy/server';
import { prisma } from '@/lib/db/client';
import { toApiError, NotFoundError, PaymentError } from '@/lib/utils/errors';
import { computeFee, usdcToUnits } from '@/lib/payments/usdc';
import { keccak256, encodePacked } from 'viem';
import { randomBytes } from 'crypto';
import { z } from 'zod';

const intentSchema = z.object({
  creatorId: z.string(),
  tierId: z.string().optional(),
  contentId: z.string().optional(),
  productId: z.string().optional(),
  communityId: z.string().optional(),
  type: z.enum(['SUBSCRIPTION_INITIAL', 'SUBSCRIPTION_RENEWAL', 'CONTENT_PURCHASE', 'PRODUCT_PURCHASE', 'COMMUNITY_JOIN']),
});

export async function POST(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    const body = await req.json();
    const input = intentSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { privyId: claims.userId } });
    if (!user) throw new NotFoundError('User');

    if (input.type === 'COMMUNITY_JOIN' && !input.communityId) {
      throw new PaymentError('communityId required for community join');
    }

    const creator = await prisma.creator.findUnique({
      where: { id: input.creatorId },
      include: { user: { select: { walletAddress: true } } },
    });
    if (!creator || !creator.isActive) throw new NotFoundError('Creator');
    if (!creator.user?.walletAddress) throw new PaymentError('Creator wallet not found');

    let grossAmountUsdc = 0n;

    if (input.type === 'SUBSCRIPTION_INITIAL' || input.type === 'SUBSCRIPTION_RENEWAL') {
      if (!input.tierId) throw new PaymentError('tierId required for subscription');
      const tier = await prisma.subscriptionTier.findUnique({ where: { id: input.tierId } });
      if (!tier || !tier.isActive) throw new NotFoundError('Subscription tier');
      if (tier.creatorId !== creator.id) throw new PaymentError('Tier does not belong to creator');
      grossAmountUsdc = tier.priceUsdc;
    } else if (input.type === 'CONTENT_PURCHASE') {
      if (!input.contentId) throw new PaymentError('contentId required');
      const content = await prisma.content.findUnique({ where: { id: input.contentId } });
      if (
        !content ||
        !content.priceUsdc ||
        !content.isPublished ||
        content.moderationStatus !== 'APPROVED'
      ) {
        throw new NotFoundError('Content');
      }
      if (content.creatorId !== creator.id) throw new PaymentError('Content does not belong to creator');
      const existing = await prisma.purchase.findFirst({
        where: { userId: user.id, contentId: content.id },
        select: { id: true },
      });
      if (existing) throw new PaymentError('Content already purchased');
      grossAmountUsdc = content.priceUsdc;
    } else if (input.type === 'PRODUCT_PURCHASE') {
      if (!input.productId) throw new PaymentError('productId required');
      const product = await prisma.product.findUnique({ where: { id: input.productId } });
      if (!product || !product.isActive) throw new NotFoundError('Product');
      if (product.creatorId !== creator.id) throw new PaymentError('Product does not belong to creator');

      const communityMemberCount = await prisma.communityMember.count({
        where: { community: { creatorId: creator.id, isActive: true } },
      });
      if (communityMemberCount < 5) {
        throw new PaymentError(
          'This product cannot be purchased because the creator does not currently meet the active community requirement (minimum 5 members).'
        );
      }

      const existing = await prisma.purchase.findFirst({
        where: { userId: user.id, productId: product.id },
        select: { id: true },
      });
      if (existing) throw new PaymentError('Product already purchased');
      grossAmountUsdc = product.priceUsdc;
    } else if (input.type === 'COMMUNITY_JOIN') {
      const community = await prisma.community.findUnique({ where: { id: input.communityId! } });
      if (!community || !community.isActive) throw new NotFoundError('Community');
      if (community.creatorId !== creator.id) throw new PaymentError('Community does not belong to creator');
      const existing = await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: community.id, userId: user.id } },
      });
      if (existing) throw new PaymentError('Already a member of this community');
      grossAmountUsdc = community.entryFeeUsdc;
    }

    const feeBps = creator.platformFeeBps;
    const platformFeeUsdc = computeFee(grossAmountUsdc, feeBps);
    const netAmountUsdc = grossAmountUsdc - platformFeeUsdc;

    // Generate deterministic payment ID
    const nonce = `0x${randomBytes(16).toString('hex')}` as `0x${string}`;
    const paymentId = keccak256(
      encodePacked(['address', 'address', 'uint256', 'bytes16'], [
        user.walletAddress as `0x${string}`,
        creator.user.walletAddress as `0x${string}`,
        grossAmountUsdc,
        nonce,
      ]),
    );

    // Store intent in DB
    const payment = await prisma.payment.create({
      data: {
        fromUserId: user.id,
        toCreatorId: creator.id,
        type: input.type,
        status: 'PENDING',
        grossAmountUsdc,
        platformFeeUsdc,
        netAmountUsdc,
        subscriptionId: undefined,
      },
    });

    return Response.json({
      paymentId,
      dbPaymentId: payment.id,
      creatorWallet: creator.user.walletAddress,
      grossAmountUsdc: grossAmountUsdc.toString(),
      netAmountUsdc: netAmountUsdc.toString(),
      platformFeeUsdc: platformFeeUsdc.toString(),
      feeBps,
      type: input.type,
      communityId: input.communityId,
      expiresAt: Math.floor(Date.now() / 1000) + 600, // 10 min
    });
  } catch (err) {
    return toApiError(err);
  }
}
