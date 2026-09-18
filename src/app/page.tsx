import Link from 'next/link';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { Footer } from '@/components/landing/Footer';
import { Hero } from '@/components/landing/Hero';
import { LogoWordmark } from '@/components/ui/Logo';
import { getLandingStats } from '@/lib/landing/stats';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const stats = await getLandingStats();

  return (
    <div className="cohora-shell min-h-screen">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-black/[0.70] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="shrink-0">
            <LogoWordmark size={28} />
          </Link>

          <div className="hidden items-center gap-6 text-sm text-white/[0.58] md:flex">
            <Link href="#product" className="transition-colors hover:text-white">
              Product
            </Link>
            <Link href="#experience" className="transition-colors hover:text-white">
              Experience
            </Link>
            <Link href="#workflow" className="transition-colors hover:text-white">
              Workflow
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <Hero stats={stats} />
        <FeatureGrid />
      </main>

      <Footer />
    </div>
  );
}
