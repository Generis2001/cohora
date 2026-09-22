'use client';

export interface TractionMetrics {
  activeSubscribers: number;
  communityMembers: number;
  publishedContent: number;
  listedProducts: number;
  totalEarnedUsdc: number;
}

export interface FairFeeEstimate {
  suggestedPriceUsdc: string;
  suggestedPriceUnits: string;
  baselineUsdc: string;
  maxUsdc: string;
  /** Traction-based maximum the creator is currently allowed to charge */
  maxAllowedUsdc: string;
  maxAllowedUnits: string;
  tractionLevel: 'starter' | 'growing' | 'established';
  breakdown: { label: string; amountUsdc: string }[];
}

export const MIN_SUBSCRIPTION_PRICE_USDC = 0.05;
export const MAX_SUBSCRIPTION_PRICE_USDC = 5.00;
export const MIN_SUBSCRIPTION_PRICE_UNITS = 50_000n;
export const MAX_SUBSCRIPTION_PRICE_UNITS = 5_000_000n;

/**
 * Computes the traction-based maximum subscription price a creator may charge.
 *
 * Unlocking logic (all bonuses cap at \.00):
 *   - Base (profile created):       \.25
 *   - +\.25 per 10 active subscribers
 *   - +\.10 per 10 community members
 *
 * Examples:
 *   0 subs, 0 community  → max \.25
 *   10 subs              → max \.50
 *   20 subs              → max \.75
 *   190 subs             → max \.00 (platform ceiling)
 */
export function computeMaxAllowedPrice(metrics: TractionMetrics): number {
  const BASE_MAX = 0.25; // unlocked for any creator with a profile
  const PLATFORM_CEILING = 5.00;

  const subscriberBonus = Math.floor(metrics.activeSubscribers / 10) * 0.25;
  const communityBonus  = Math.floor(metrics.communityMembers  / 10) * 0.10;

  const raw = BASE_MAX + subscriberBonus + communityBonus;
  // Round to nearest cent, then clamp
  const rounded = Math.round(raw * 100) / 100;
  return Math.min(PLATFORM_CEILING, Math.max(BASE_MAX, rounded));
}

export function calculateFairFee(metrics: TractionMetrics): FairFeeEstimate {
  const BASELINE = 0.05; // 5 cents minimum
  const MAX_LIMIT = 5.00; // \.00 USDC platform ceiling
  let bonus = 0;
  const breakdown: { label: string; amountUsdc: string }[] = [];

  breakdown.push({ label: 'Baseline minimum', amountUsdc: '0.05' });

  // 1. Subscribers bonus (+ \.05 per 10 active subs)
  if (metrics.activeSubscribers > 0) {
    const subBonus = Math.floor(metrics.activeSubscribers / 10) * 0.05;
    if (subBonus > 0) {
      bonus += subBonus;
      breakdown.push({
        label: \ Active Subscribers\,
        amountUsdc: subBonus.toFixed(2),
      });
    }
  }

  // 2. Community members bonus (+ \.02 per 10 members)
  if (metrics.communityMembers > 0) {
    const commBonus = Math.floor(metrics.communityMembers / 10) * 0.02;
    if (commBonus > 0) {
      bonus += commBonus;
      breakdown.push({
        label: \ Community Members\,
        amountUsdc: commBonus.toFixed(2),
      });
    }
  }

  // 3. Content count bonus (+ \.02 per 5 published items)
  if (metrics.publishedContent > 0) {
    const contentBonus = Math.floor(metrics.publishedContent / 5) * 0.02;
    if (contentBonus > 0) {
      bonus += contentBonus;
      breakdown.push({
        label: \ Published Contents\,
        amountUsdc: contentBonus.toFixed(2),
      });
    }
  }

  // 4. Listed products bonus (+ \.03 per product)
  if (metrics.listedProducts > 0) {
    const prodBonus = metrics.listedProducts * 0.03;
    if (prodBonus > 0) {
      bonus += prodBonus;
      breakdown.push({
        label: \ Store Products\,
        amountUsdc: prodBonus.toFixed(2),
      });
    }
  }

  // 5. Total earned bonus (+ \.10 per \ earned)
  if (metrics.totalEarnedUsdc > 0) {
    const earnBonus = Math.floor(metrics.totalEarnedUsdc / 50) * 0.10;
    if (earnBonus > 0) {
      bonus += earnBonus;
      breakdown.push({
        label: \$\ Total Earned\,
        amountUsdc: earnBonus.toFixed(2),
      });
    }
  }

  const rawTotal = BASELINE + bonus;
  // Round to nearest 0.05, bounded between \.05 and \.00
  const roundedVal = Math.round(rawTotal * 20) / 20;
  const suggestedVal = Math.min(MAX_LIMIT, Math.max(BASELINE, roundedVal));
  const suggestedPriceUsdc = suggestedVal.toFixed(2);
  const suggestedPriceUnits = (Math.round(suggestedVal * 1_000_000)).toString();

  // Traction-based maximum this creator may actually charge
  const maxAllowed = computeMaxAllowedPrice(metrics);
  const maxAllowedUsdc = maxAllowed.toFixed(2);
  const maxAllowedUnits = (Math.round(maxAllowed * 1_000_000)).toString();

  let tractionLevel: 'starter' | 'growing' | 'established' = 'starter';
  if (suggestedVal >= 0.75) {
    tractionLevel = 'established';
  } else if (suggestedVal >= 0.20) {
    tractionLevel = 'growing';
  }

  return {
    suggestedPriceUsdc,
    suggestedPriceUnits,
    baselineUsdc: '0.05',
    maxUsdc: '5.00',
    maxAllowedUsdc,
    maxAllowedUnits,
    tractionLevel,
    breakdown,
  };
}
