import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ConnectButton } from '@/components/auth/ConnectButton';
import { OrbitGraphic } from '@/components/ui/OrbitGraphic';
import type { LandingStats } from '@/lib/landing/stats';

export function Hero({ stats }: { stats: LandingStats }) {
  return (
    <section className="relative overflow-hidden px-6 pt-28 text-left">
      <div className="mx-auto grid max-w-6xl gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(320px,460px)] lg:grid-rows-[auto_auto] lg:items-start">
        <div className="relative z-10 max-w-3xl space-y-8">
          <p className="text-sm uppercase tracking-[0.26em] text-white/[0.54]">
            Creator platform on Arc
          </p>

          <div className="space-y-6">
            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.08em] text-white md:text-7xl">
              Subscriptions, communities, and digital products for creators on Arc.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-white/[0.68] md:text-xl">
              Cohora lets creators create public profiles, publish paid content, run subscriber
              communities, and sell digital products. Fans connect a wallet, pay in USDC, and get
              access instantly.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <ConnectButton />
            <Link
              href="#product"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-6 py-3 text-sm text-white/[0.72] transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              See what Cohora does
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="relative z-10 w-full max-w-[460px] self-start justify-self-center lg:justify-self-end">
          <OrbitGraphic />
        </div>

        {/* Stats — bare text, no card boxes */}
        <div className="relative z-10 grid gap-8 sm:grid-cols-3 lg:col-span-2 border-t border-white/[0.07] pt-8">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-white/[0.38]">Creator heartbeat</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">{stats.creatorHeartbeat}</p>
            <p className="mt-2 text-sm leading-6 text-white/[0.54]">Confirmed creator earnings recorded by Cohora settlements.</p>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-white/[0.38]">Active creators</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">{stats.creatorCount ?? 'Unavailable'}</p>
            <p className="mt-2 text-sm leading-6 text-white/[0.54]">Creator profiles currently live on the platform.</p>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-white/[0.38]">Router fee</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">{stats.routerFeeLabel}</p>
            <p className="mt-2 text-sm leading-6 text-white/[0.54]">Read directly from the deployed payment router contract.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
