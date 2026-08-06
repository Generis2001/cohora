'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookMarked,
  Clapperboard,
  Compass,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Store,
  Users2,
} from 'lucide-react';
import { LogoMark, LogoWordmark } from '@/components/ui/Logo';
import { SidebarFooter } from '@/components/app/SidebarFooter';
import { cn } from '@/lib/utils/cn';

const navItems = [
  { href: '/app', icon: LayoutDashboard, label: 'Home' },
  { href: '/app/explore', icon: Compass, label: 'Explore' },
  { href: '/app/dashboard/subscriptions', icon: BookMarked, label: 'Subscriptions' },
  { href: '/app/dashboard/purchases', icon: Store, label: 'Purchases' },
  { href: '/app/communities', icon: Users2, label: 'Communities' },
  { href: '/app/studio', icon: Clapperboard, label: 'Creator Studio' },
  { href: '/app/settings', icon: Settings, label: 'Settings' },
];

export function AppSidebar() {
  // pinned = user clicked the toggle to keep it open permanently
  const [pinned, setPinned] = useState(false);
  // hovered = mouse is inside the sidebar zone
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const isOpen = pinned || hovered;

  const handleMouseEnter = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Small delay so the sidebar doesn't snap shut if cursor briefly leaves
    leaveTimer.current = setTimeout(() => setHovered(false), 120);
  }, []);

  return (
    <>
      {/* ── Hover trigger strip — always visible on the left edge ── */}
      {!isOpen && (
        <div
          className="fixed left-0 top-0 z-40 h-full w-3 cursor-pointer"
          onMouseEnter={handleMouseEnter}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar panel ── */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          // Layout & layering
          'fixed left-0 top-0 z-40 hidden h-screen md:flex md:flex-col',
          // Sizing transition
          'transition-[width] duration-300 ease-in-out',
          isOpen ? 'w-[296px]' : 'w-[64px]',
          // Visual
          'border-r border-white/[0.08] bg-black/[0.82] backdrop-blur-2xl',
          // Padding
          'px-3 py-6',
          // Overflow — hide text when collapsed
          'overflow-hidden',
        )}
        aria-label="App navigation"
      >
        {/* ── Top: logo + pin button ── */}
        <div className="flex items-center justify-between gap-2 px-1">
          <Link
            href="/app"
            className={cn(
              'block shrink-0 transition-opacity duration-200',
              isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
            )}
            tabIndex={isOpen ? 0 : -1}
          >
            <LogoWordmark size={28} />
          </Link>

          {/* Collapsed state: keep Cohora, not network infrastructure, as the app identity. */}
          {!isOpen && (
            <Link href="/app" className="mx-auto block">
              <LogoMark size={28} />
            </Link>
          )}

          {/* Pin / unpin toggle — only visible when open */}
          {isOpen && (
            <button
              type="button"
              onClick={() => setPinned((p) => !p)}
              className="shrink-0 rounded-lg p-1.5 text-white/[0.38] transition-colors hover:bg-white/[0.07] hover:text-white"
              title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
              aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            >
              {pinned ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* ── App description (only when expanded) ── */}
        <p
          className={cn(
            'mt-5 px-1 text-sm leading-6 text-white/[0.54]',
            'transition-all duration-200',
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 mt-0 overflow-hidden',
          )}
        >
          Manage creator profiles, subscriptions, communities, and digital products on Arc Testnet.
        </p>

        {/* ── Nav items ── */}
        <nav className={cn('flex-1 space-y-1.5', isOpen ? 'mt-6' : 'mt-4')}>
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
            return (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                expanded={isOpen}
                active={active}
              />
            );
          })}
        </nav>

        {/* ── Footer: Built on + balance/wallet ── */}
        <div className="space-y-4">
          <p
            className={cn(
              'px-1 text-xs text-white/[0.46]',
              !isOpen && 'sr-only',
            )}
          >
            Built on Arc
          </p>

          {/* Only render SidebarFooter when expanded to avoid layout thrash */}
          <div
            className={cn(
              'transition-all duration-200',
              isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 overflow-hidden',
            )}
          >
            <SidebarFooter />
          </div>
        </div>
      </aside>

      {/* ── Spacer so main content doesn't sit under the sidebar ── */}
      <div
        className={cn(
          'hidden md:block shrink-0 transition-[width] duration-300 ease-in-out',
          isOpen ? 'w-[296px]' : 'w-[64px]',
        )}
        aria-hidden="true"
      />
    </>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  expanded,
  active,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  expanded: boolean;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      title={!expanded ? label : undefined}
      className={cn(
        'flex items-center gap-3 rounded-[1rem] border px-3 py-3 text-sm transition-colors',
        expanded ? '' : 'justify-center px-0',
        active
          ? 'border-white/[0.12] bg-white/[0.07] text-white'
          : 'border-transparent text-white/[0.56] hover:border-white/[0.10] hover:bg-white/[0.05] hover:text-white',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {expanded && (
        <span className="truncate transition-opacity duration-150">{label}</span>
      )}
    </Link>
  );
}
