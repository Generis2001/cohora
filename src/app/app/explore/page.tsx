import { ExploreCreators } from '@/components/creator/ExploreCreators';
import { prisma } from '@/lib/db/client';
import type { ContentItem, CreatorProfile } from '@/types/creator';

export const dynamic = 'force-dynamic';

const DEFAULT_TIER_PRICE = 50_000n;
const DEFAULT_TIER_INTERVAL = 30;

async function ensureDefaultTier(creatorId: string): Promise<string> {
  const existing = await prisma.subscriptionTier.findFirst({
    where: { creatorId, isActive: true },
    orderBy: { priceUsdc: 'asc' },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.subscriptionTier.create({
    data: {
      creatorId,
      name: 'Supporter',
      description: 'Support this creator',
      priceUsdc: DEFAULT_TIER_PRICE,
      intervalDays: DEFAULT_TIER_INTERVAL,
      isActive: true,
    },
    select: { id: true },
  });
  return created.id;
}

async function getCreators(): Promise<CreatorProfile[]> {
  const creators = await prisma.creator.findMany({
    where: { isActive: true },
    include: {
      user: { select: { avatarUrl: true } },
      subscriptionTiers: { where: { isActive: true }, orderBy: { priceUsdc: 'asc' } },
      content: {
        where: { isPublished: true, moderationStatus: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { _count: { select: { purchases: true } } },
      },
    },
    orderBy: { totalEarned: 'desc' },
    take: 50,
  });

  return Promise.all(
    creators.map(async (c) => {
      const defaultTierId = await ensureDefaultTier(c.id);

      const tiers =
        c.subscriptionTiers.length > 0
          ? c.subscriptionTiers
          : [
              {
                id: defaultTierId,
                name: 'Supporter',
                description: 'Support this creator',
                priceUsdc: DEFAULT_TIER_PRICE,
                intervalDays: DEFAULT_TIER_INTERVAL,
                isActive: true,
                maxSubscribers: null,
                perks: [] as string[],
              },
            ];

      return {
        id: c.id,
        handle: c.handle,
        displayName: c.displayName,
        bio: c.bio,
        bannerUrl: c.bannerUrl,
        avatarUrl: c.user.avatarUrl,
        isVerified: c.isVerified,
        totalEarned: c.totalEarned.toString(),
        defaultTierId,
        subscriptionTiers: tiers.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          priceUsdc: t.priceUsdc.toString(),
          intervalDays: t.intervalDays,
          perks: t.perks,
          maxSubscribers: t.maxSubscribers ?? null,
          isActive: t.isActive,
        })),
        content: c.content.map(
          (item): ContentItem => ({
            id: item.id,
            title: item.title,
            description: item.description,
            type: item.type,
            mediaUrl: item.mediaUrl ?? null,
            priceUsdc: item.priceUsdc?.toString() ?? null,
            accessType: item.accessType,
            isFree: item.isFree,
            views: item.views,
            salesCount: item._count.purchases,
            createdAt: item.createdAt,
          }),
        ),
      };
    }),
  );
}

export default async function ExplorePage() {
  const creators = await getCreators();

  return (
    <div className="space-y-6">
      <div className="py-2">
        <div className="relative z-10 space-y-2">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-white/[0.40]">Explore</p>
          <h1 className="text-3xl font-semibold tracking-[-0.05em] text-white">Find creators, subscriptions, and paid content.</h1>
          <p className="text-sm text-white/[0.56]">Browse Cohora creator profiles and see what each creator offers.</p>
        </div>
      </div>

      {creators.length === 0 ? (
        <div className="py-16 text-center text-white/[0.54]">
          No creators yet. Be the first to publish content.
        </div>
      ) : (
        <ExploreCreators creators={creators} />
      )}
    </div>
  );
}
