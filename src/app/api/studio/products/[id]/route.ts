import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/privy/server';
import { prisma } from '@/lib/db/client';
import { toApiError, NotFoundError, ForbiddenError } from '@/lib/utils/errors';
import { z } from 'zod';
import { usdcToUnits } from '@/lib/payments/usdc';

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  priceUsdc: z.string().optional(),
  fileUrl: z.string().url().optional().or(z.literal('')),
  demoUrl: z.string().url().optional().or(z.literal('')),
  demoType: z.enum(['VIDEO', 'AUDIO']).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    const data = patchSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { privyId: claims.userId },
      include: { creator: true },
    });
    if (!user?.creator) throw new NotFoundError('Creator profile');

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product');
    if (product.creatorId !== user.creator.id) throw new ForbiddenError();

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.priceUsdc !== undefined && {
          priceUsdc: usdcToUnits(parseFloat(data.priceUsdc)),
        }),
        ...(data.fileUrl !== undefined && { deliveryUrl: data.fileUrl || undefined }),
        ...(data.demoUrl !== undefined && { demoUrl: data.demoUrl || undefined }),
        ...(data.demoType !== undefined && { demoType: data.demoType || undefined }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    return Response.json({ ...updated, priceUsdc: updated.priceUsdc.toString() });
  } catch (err) {
    return toApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireAuth(req);
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { privyId: claims.userId },
      include: { creator: true },
    });
    if (!user?.creator) throw new NotFoundError('Creator profile');

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product');
    if (product.creatorId !== user.creator.id) throw new ForbiddenError();

    await prisma.product.delete({ where: { id } });

    return new Response(null, { status: 204 });
  } catch (err) {
    return toApiError(err);
  }
}
