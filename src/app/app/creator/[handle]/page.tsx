import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { SubscriptionTiers } from '@/components/creator/SubscriptionTiers';
import { PremiumContentSection } from '@/components/creator/PremiumContentSection';
import { SubscriptionGate } from '@/components/creator/SubscriptionGate';
import { CreatorContentSection, CreatorProductSection } from '@/components/creator/CreatorItemSections';
import { BadgeCheck, TrendingUp } from 'lucide-react';
import { formatUsdc } from '@/lib/payments/usdc';
import type { CreatorProfile, ContentItem, ProductItem } from '@/types/creator';

interface PageProps {
  params: Promise<{ handle: string }>;
}

function computeNetValue(totalEarned: bigint, totalViews: number): bigint {
  const score = 1 + Math.log1p(totalViews) / 10;
  return BigInt(Math.floor(Number(totalEarned) * score));
}

async function getCreator(handle: string): Promise<(CreatorProfile & { content: ContentItem[]; products: ProductItem[] }) | null> {
  const creator = await prisma.creator.findUnique({
    where: { handle },
    include: {
      user: { select: { avatarUrl: true } },
      subscriptionTiers: {
        where: { isActive: true },
        orderBy: { priceUsdc: 'asc' },
      },
      content: {
        where: { isPublished: true, moderationStatus: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { _count: { select: { purchases: true } } },
      },
      products: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!creator || !creator.isActive) return null;

  const contentItems: ContentItem[] = creator.content.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    type: c.type,
    mediaUrl: c.mediaUrl,
    priceUsdc: c.priceUsdc?.toString() ?? null,
    accessType: c.accessType,
    isFree: c.isFree,
    views: c.views,
    salesCount: c._count.purchases,
    createdAt: c.createdAt,
  }));

  const productItems: ProductItem[] = creator.products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    priceUsdc: p.priceUsdc.toString(),
    imageUrl: p.imageUrl,
    productType: p.productType,
    totalSold: p.totalSold,
    createdAt: p.createdAt,
  }));

  return {
    id: creator.id,
    handle: creator.handle,
    displayName: creator.displayName,
    bio: creator.bio,
    bannerUrl: creator.bannerUrl,
    avatarUrl: creator.user.avatarUrl,
    isVerified: creator.isVerified,
    totalEarned: creator.totalEarned.toString(),
    subscriptionTiers: creator.subscriptionTiers.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      priceUsdc: t.priceUsdc.toString(),
      intervalDays: t.intervalDays,
      perks: t.perks,
      maxSubscribers: t.maxSubscribers,
      isActive: t.isActive,
    })),
    content: contentItems,
    products: productItems,
  };
}

export default async function CreatorProfilePage({ params }: PageProps) {
  const { handle } = await params;
  const creator = await getCreator(handle);

  if (!creator) notFound();

  const totalViews = creator.content.reduce((sum, c) => sum + c.views, 0);
  const netValue = computeNetValue(BigInt(creator.totalEarned), totalViews);

  const premiumContent = creator.content.filter((c) => !c.isFree && c.accessType === 'SUBSCRIPTION');
  const purchasableContent = creator.content.filter(
    (c) => !c.isFree && c.accessType !== 'SUBSCRIPTION' && c.priceUsdc,
  );
  const freeContent = creator.content.filter((c) => c.isFree);

  return (
    <div className="space-y-8">
      {/* Banner */}
      {creator.bannerUrl ? (
        <div
          className="h-48 w-full rounded-xl bg-cover bg-center"
          style={{ backgroundImage: `url(${creator.bannerUrl})` }}
        />
      ) : (
        <div className="h-48 w-full rounded-xl bg-gradient-to-br from-cohora-800 to-cohora-950" />
      )}

      {/* Profile header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{creator.displayName}</h1>
            {creator.isVerified && <BadgeCheck className="h-5 w-5 text-cohora-400" />}
          </div>
          <p className="text-sm text-muted-foreground">@{creator.handle}</p>
          {creator.bio && <p className="text-muted-foreground max-w-2xl">{creator.bio}</p>}
        </div>
        {netValue > 0n && (
          <div className="flex items-center gap-1.5 rounded-lg border border-cohora-600/30 bg-cohora-600/5 px-3 py-2 text-sm shrink-0">
            <TrendingUp className="h-4 w-4 text-cohora-400" />
            <span className="text-muted-foreground">Creator Value</span>
            <span className="font-semibold text-foreground">{formatUsdc(netValue)}</span>
          </div>
        )}
      </div>

      {/* Subscription tiers — always visible so visitors can subscribe */}
      <SubscriptionTiers creator={creator} />

      {/* Content sections (purchasable + free) — requires an active subscription.
          The SubscriptionGate shows a paywall with a subscribe CTA for non-subscribers.
          The creator/owner always sees their content via the gate's ACTIVE-status check. */}
      <SubscriptionGate creatorId={creator.id} tiers={creator.subscriptionTiers}>
        <CreatorContentSection
          creatorId={creator.id}
          creatorHandle={creator.handle}
          purchasableContent={purchasableContent}
          freeContent={freeContent}
        />
      </SubscriptionGate>

      {premiumContent.length > 0 && (
        <PremiumContentSection
          creatorId={creator.id}
          creatorHandle={creator.handle}
          content={premiumContent}
          tiers={creator.subscriptionTiers}
        />
      )}

      {/* Products — owner sees ⋮ edit/delete menu */}
      <CreatorProductSection
        creatorId={creator.id}
        creatorHandle={creator.handle}
        products={creator.products}
      />

    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { handle } = await params;
  const creator = await getCreator(handle);
  return {
    title: creator ? `${creator.displayName} — Cohora` : 'Creator not found',
  };
}
