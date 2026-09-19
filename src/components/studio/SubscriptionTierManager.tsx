'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, DollarSign, TrendingUp, CheckCircle2, ShieldCheck, Edit3, AlertCircle, RefreshCw, Sliders } from 'lucide-react';
import type { FairFeeEstimate } from '@/lib/payments/fairFee';

interface TierData {
  id: string;
  name: string;
  description: string | null;
  priceUsdc: string;
  intervalDays: number;
  perks: string[];
  isActive: boolean;
}

interface ApiResponse {
  tiers: TierData[];
  fairFeeEstimate: FairFeeEstimate;
  metrics: {
    activeSubscribers: number;
    communityMembers: number;
    publishedContent: number;
    listedProducts: number;
    totalEarnedUsdc: string;
  };
}

const PRESET_PRICES = ['0.05', '0.25', '1.00', '2.50', '5.00'];

export function SubscriptionTierManager() {
  const { getAccessToken, ready, authenticated } = usePrivy();
  const queryClient = useQueryClient();
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<ApiResponse>({
    queryKey: ['studio-tiers'],
    enabled: Boolean(ready && authenticated),
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch('/api/studio/tiers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error ?? 'Failed to load subscription tiers');
      }
      return res.json();
    },
  });

  if (!ready || isLoading) {
    return (
      <Card className="border-white/[0.10] bg-black/[0.72]">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-cohora-400" />
          <p className="text-xs text-muted-foreground">Loading subscription tier controls...</p>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-center justify-between p-4 text-sm text-destructive">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>Could not load subscription pricing details.</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { tiers, fairFeeEstimate } = data;
  if (tiers.length === 0) {
    return null;
  }

  const primaryTier = tiers[0] ?? null;

  function startEditing(tier: TierData) {
    setEditingTierId(tier.id);
    const displayPrice = (Number(BigInt(tier.priceUsdc)) / 1_000_000).toFixed(2);
    setPriceInput(displayPrice);
    setNameInput(tier.name);
    setDescInput(tier.description ?? '');
    setError(null);
    setSuccess(null);
  }

  function applySuggestedPrice() {
    setPriceInput(fairFeeEstimate.suggestedPriceUsdc);
  }

  async function handleSave(tierId: string) {
    const priceNum = parseFloat(priceInput);
    if (isNaN(priceNum) || priceNum < 0.05 || priceNum > 5.00) {
      setError('Subscription fee must be between $0.05 USDC (5 cents) and $5.00 USDC.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/studio/tiers/${tierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: nameInput,
          description: descInput,
          priceUsdc: priceInput,
        }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg ?? 'Failed to update subscription tier');
      }

      setSuccess('Subscription pricing updated successfully!');
      setEditingTierId(null);
      queryClient.invalidateQueries({ queryKey: ['studio-tiers'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update tier');
    } finally {
      setSaving(false);
    }
  }

  const levelLabels = {
    starter: { label: 'Starter Traction', color: 'text-cohora-400 bg-cohora-600/10 border-cohora-600/30' },
    growing: { label: 'Growing Traction', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    established: { label: 'Established Creator', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  };

  const currentPriceNum = parseFloat(priceInput) || 0.05;

  return (
    <div className="space-y-6">
      {/* ── Fair Fee Estimator Widget ── */}
      <Card className="border-cohora-600/30 bg-gradient-to-br from-cohora-950/20 via-black to-cohora-900/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cohora-400" />
              Fair Fee Estimator
            </CardTitle>
            <span className={`rounded-full border px-3 py-0.5 text-xs font-medium ${levelLabels[fairFeeEstimate.tractionLevel].color}`}>
              {levelLabels[fairFeeEstimate.tractionLevel].label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Algorithmically suggested subscription fee based on your current audience, published content, store inventory, and revenue.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 items-center rounded-xl border border-white/[0.08] bg-black/[0.40] p-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Recommended Monthly Fee</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-foreground">
                  ${fairFeeEstimate.suggestedPriceUsdc}
                </span>
                <span className="text-sm text-muted-foreground">USDC / 30 days</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Range allowed: 5¢ ($0.05 USDC) to $5.00 USDC.
              </p>
            </div>

            <div className="flex flex-col gap-2 justify-end sm:items-end">
              <Button
                variant="cohora"
                size="sm"
                className="gap-2"
                onClick={() => {
                  if (primaryTier) {
                    startEditing(primaryTier);
                    setPriceInput(fairFeeEstimate.suggestedPriceUsdc);
                  }
                }}
              >
                <DollarSign className="h-4 w-4" />
                Apply Suggested Fee (${fairFeeEstimate.suggestedPriceUsdc})
              </Button>
            </div>
          </div>

          {/* Breakdown pill grid */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-cohora-400" />
              Traction Signals Breakdown:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {fairFeeEstimate.breakdown.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
                  <p className="text-muted-foreground truncate">{item.label}</p>
                  <p className="font-semibold text-foreground mt-0.5">+${item.amountUsdc} USDC</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tier Management Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cohora-400" />
            Subscription Pricing & Tier Controls
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Creators have complete freedom to adjust their monthly subscription fee anywhere between <strong>$0.05 USDC (5 cents)</strong> and <strong>$5.00 USDC</strong>.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {tiers.map((tier) => {
            const isEditing = editingTierId === tier.id;
            const currentDisplayPrice = (Number(BigInt(tier.priceUsdc)) / 1_000_000).toFixed(2);

            return (
              <div key={tier.id} className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{tier.name}</h3>
                    <p className="text-xs text-muted-foreground">{tier.description || 'Access to exclusive creator content and perks'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-foreground">${currentDisplayPrice}</span>
                    <span className="text-xs text-muted-foreground"> USDC / 30d</span>
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-5 pt-3 border-t border-border">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Tier Name</label>
                        <Input
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          placeholder="e.g. Supporter"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium flex justify-between">
                          <span>Monthly Price (USDC)</span>
                          <span className="text-muted-foreground font-mono">$0.05 - $5.00</span>
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.05"
                          max="5.00"
                          value={priceInput}
                          onChange={(e) => setPriceInput(e.target.value)}
                          placeholder="e.g. 0.25"
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>

                    {/* Interactive Slider control */}
                    <div className="space-y-2 rounded-xl border border-white/[0.08] bg-black/[0.30] p-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                          <Sliders className="h-3.5 w-3.5 text-cohora-400" />
                          Adjust Price Slider
                        </span>
                        <span className="font-mono text-cohora-400 font-bold text-sm">
                          ${currentPriceNum.toFixed(2)} USDC
                        </span>
                      </div>

                      <input
                        type="range"
                        min="0.05"
                        max="5.00"
                        step="0.01"
                        value={currentPriceNum}
                        onChange={(e) => setPriceInput(parseFloat(e.target.value).toFixed(2))}
                        className="w-full accent-cohora-500 h-2 rounded-lg cursor-pointer bg-white/[0.10]"
                      />

                      <div className="flex justify-between text-[10px] text-muted-foreground font-mono pt-1">
                        <span>$0.05 (Min)</span>
                        <span>$1.00</span>
                        <span>$2.50</span>
                        <span>$5.00 (Max)</span>
                      </div>

                      {/* Quick presets */}
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <span className="text-[10px] text-muted-foreground">Presets:</span>
                        {PRESET_PRICES.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setPriceInput(preset)}
                            className={`rounded-md border px-2 py-1 text-[11px] font-mono transition-colors ${
                              priceInput === preset
                                ? 'border-cohora-500 bg-cohora-600/20 text-cohora-300 font-semibold'
                                : 'border-white/[0.10] bg-white/[0.04] text-muted-foreground hover:border-cohora-500/40 hover:text-foreground'
                            }`}
                          >
                            ${preset}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={applySuggestedPrice}
                          className="rounded-md border border-cohora-600/40 bg-cohora-950/40 px-2 py-1 text-[11px] font-mono text-cohora-300 hover:bg-cohora-600/20"
                        >
                          Suggest ${fairFeeEstimate.suggestedPriceUsdc}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Description</label>
                      <Input
                        value={descInput}
                        onChange={(e) => setDescInput(e.target.value)}
                        placeholder="Brief tier description..."
                      />
                    </div>

                    {error && <p className="text-xs text-destructive rounded bg-destructive/10 px-3 py-2">{error}</p>}
                    {success && <p className="text-xs text-green-400 rounded bg-green-500/10 px-3 py-2">{success}</p>}

                    <div className="flex gap-2">
                      <Button
                        variant="cohora"
                        size="sm"
                        onClick={() => handleSave(tier.id)}
                        disabled={saving}
                      >
                        {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        Save Price & Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingTierId(null)}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center pt-2 border-t border-border/50">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      Active Tier
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => startEditing(tier)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Adjust Price ($0.05 - $5.00)
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
