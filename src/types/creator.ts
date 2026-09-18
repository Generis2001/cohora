export interface SubscriptionTierPublic {
  id: string;
  name: string;
  description: string | null;
  priceUsdc: string; // serialized BigInt as string
  intervalDays: number;
  perks: string[];
  maxSubscribers: number | null;
  isActive: boolean;
}

export interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  mediaUrl: string | null;
  priceUsdc: string | null;
  accessType: string;
  isFree: boolean;
  views: number;
  salesCount: number;
  createdAt: string | Date;
}

export interface ProductItem {
  id: string;
  name: string;
  description: string | null;
  priceUsdc: string;
  imageUrl?: string | null;
  fileUrl?: string | null;
  demoUrl?: string | null;
  demoType?: 'VIDEO' | 'AUDIO' | string | null;
  productType: string;
  totalSold: number;
  createdAt: string | Date;
}

export interface CreatorProfile {
  id: string;
  handle: string;
  displayName: string;
  bio: string | null;
  bannerUrl: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  totalEarned: string;
  subscriptionTiers: SubscriptionTierPublic[];
  defaultTierId?: string;
  content?: ContentItem[];
  products?: ProductItem[];
}
