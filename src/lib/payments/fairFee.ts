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
  tractionLevel: 'starter' | 'growing' | 'established';
  breakdown: { label: string; amountUsdc: string }[];
}

export const MIN_SUBSCRIPTION_PRICE_USDC = 0.05;
export const MAX_SUBSCRIPTION_PRICE_USDC = 5.00;
export const MIN_SUBSCRIPTION_PRICE_UNITS = 50_000n;
export const MAX_SUBSCRIPTION_PRICE_UNITS = 5_000_000n;

export function calculateFairFee(metrics: TractionMetrics): FairFeeEstimate {
  const BASELINE = 0.05; // 5 cents minimum
  const MAX_LIMIT = 5.00; // $5.00 USDC maximum
  let bonus = 0;
  const breakdown: { label: string; amountUsdc: string }[] = [];

  breakdown.push({ label: 'Baseline minimum', amountUsdc: '0.05' });

  // 1. Subscribers bonus (+ $0.05 per 10 active subs)
  if (metrics.activeSubscribers > 0) {
    const subBonus = Math.floor(metrics.activeSubscribers / 10) * 0.05;
    if (subBonus > 0) {
      bonus += subBonus;
      breakdown.push({
        label: `${metrics.activeSubscribers} Active Subscribers`,
        amountUsdc: subBonus.toFixed(2),
      });
    }
  }

  // 2. Community members bonus (+ $0.02 per 10 members)
  if (metrics.communityMembers > 0) {
    const commBonus = Math.floor(metrics.communityMembers / 10) * 0.02;
    if (commBonus > 0) {
      bonus += commBonus;
      breakdown.push({
        label: `${metrics.communityMembers} Community Members`,
        amountUsdc: commBonus.toFixed(2),
      });
    }
  }

  // 3. Content count bonus (+ $0.02 per 5 published items)
  if (metrics.publishedContent > 0) {
    const contentBonus = Math.floor(metrics.publishedContent / 5) * 0.02;
    if (contentBonus > 0) {
      bonus += contentBonus;
      breakdown.push({
        label: `${metrics.publishedContent} Published Contents`,
        amountUsdc: contentBonus.toFixed(2),
      });
    }
  }

  // 4. Listed products bonus (+ $0.03 per product)
  if (metrics.listedProducts > 0) {
    const prodBonus = metrics.listedProducts * 0.03;
    if (prodBonus > 0) {
      bonus += prodBonus;
      breakdown.push({
        label: `${metrics.listedProducts} Store Products`,
        amountUsdc: prodBonus.toFixed(2),
      });
    }
  }

  // 5. Total earned bonus (+ $0.10 per $50 earned)
  if (metrics.totalEarnedUsdc > 0) {
    const earnBonus = Math.floor(metrics.totalEarnedUsdc / 50) * 0.10;
    if (earnBonus > 0) {
      bonus += earnBonus;
      breakdown.push({
        label: `$${metrics.totalEarnedUsdc.toFixed(2)} Total Earned`,
        amountUsdc: earnBonus.toFixed(2),
      });
    }
  }

  const rawTotal = BASELINE + bonus;
  // Round to nearest 0.05, bounded between $0.05 and $5.00
  const roundedVal = Math.round(rawTotal * 20) / 20;
  const suggestedVal = Math.min(MAX_LIMIT, Math.max(BASELINE, roundedVal));
  const suggestedPriceUsdc = suggestedVal.toFixed(2);
  const suggestedPriceUnits = (Math.round(suggestedVal * 1_000_000)).toString();

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
    tractionLevel,
    breakdown,
  };
}
