import { AuthGuard } from '@/components/auth/AuthGuard';
import { ChainGuard } from '@/components/auth/ChainGuard';
import { CreatorGuard } from '@/components/app/CreatorGuard';
import { AppSidebar } from '@/components/app/AppSidebar';
import { SidebarFooter } from '@/components/app/SidebarFooter';
import { BookMarked, Clapperboard, Compass, LayoutDashboard, Settings, Store, Users2 } from 'lucide-react';
import Link from 'next/link';

const navItems = [
  { href: '/app', icon: LayoutDashboard, label: 'Home' },
  { href: '/app/explore', icon: Compass, label: 'Explore' },
  { href: '/app/dashboard/subscriptions', icon: BookMarked, label: 'Subscriptions' },
  { href: '/app/dashboard/purchases', icon: Store, label: 'Purchases' },
  { href: '/app/communities', icon: Users2, label: 'Communities' },
  { href: '/app/studio', icon: Clapperboard, label: 'Creator Studio' },
  { href: '/app/settings', icon: Settings, label: 'Settings' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ChainGuard>
        <CreatorGuard>
          <div className="cohora-shell min-h-screen">
            <div className="mx-auto flex min-h-screen max-w-[1500px]">

              {/* Collapsible hover sidebar — handles its own spacer */}
              <AppSidebar />

              {/* Main content column */}
              <div className="flex min-h-screen flex-1 flex-col">
                <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-black/[0.72] backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-8">
                    <div>
                      <p className="text-[0.65rem] uppercase tracking-[0.22em] text-white/[0.36]">Cohora</p>
                      <p className="mt-1 text-sm text-white/[0.62]">Subscriptions, access, and creator management on Arc.</p>
                    </div>
                  </div>
                  {/* Mobile nav pills */}
                  <div className="flex gap-2 overflow-x-auto px-4 pb-4 md:hidden">
                    {navItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.04] px-4 py-2 text-xs text-white/[0.64] transition-colors hover:bg-white/[0.08] hover:text-white"
                      >
                        <item.icon className="h-3.5 w-3.5" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </header>

                <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
                  <div className="mx-auto max-w-6xl">
                    <div className="mb-6 md:hidden">
                      <SidebarFooter compact />
                    </div>
                    {children}
                  </div>
                </main>
              </div>

            </div>
          </div>
        </CreatorGuard>
      </ChainGuard>
    </AuthGuard>
  );
}
