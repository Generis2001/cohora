import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/client';
import { toApiError } from '@/lib/utils/errors';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const { handle } = await params;

    const creator = await prisma.creator.findUnique({
      where: { handle },
      select: { id: true, isActive: true },
    });

    if (!creator || !creator.isActive) {
      return Response.json({ error: 'Creator not found' }, { status: 404 });
    }

    const [products, communityMemberCount] = await Promise.all([
      prisma.product.findMany({
        where: { creatorId: creator.id, isActive: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.communityMember.count({
        where: { community: { creatorId: creator.id, isActive: true } },
      }),
    ]);

    return Response.json({
      communityMemberCount,
      meetsCommunityRequirement: communityMemberCount >= 5,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceUsdc: p.priceUsdc.toString(),
        imageUrl: p.imageUrl,
        demoUrl: p.demoUrl,
        demoType: p.demoType,
        productType: p.productType,
        totalSold: p.totalSold,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    return toApiError(err);
  }
}
