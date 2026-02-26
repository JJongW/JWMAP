'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart2,
  MapPin,
  Sparkles,
  Route,
  MessageSquare,
  MoreHorizontal,
  AlertTriangle,
  Bot,
  CheckSquare,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const primaryItems = [
  { href: '/dashboard', label: 'Analytics', icon: BarChart2 },
  { href: '/locations', label: '맛집', icon: MapPin },
  { href: '/attractions', label: '볼거리', icon: Sparkles },
  { href: '/courses', label: '코스', icon: Route },
  { href: '/reviews', label: '리뷰', icon: MessageSquare },
];

const secondaryItems = [
  { href: '/locations/incomplete', label: '데이터 품질', icon: AlertTriangle },
  { href: '/content-engine', label: '콘텐츠 엔진', icon: Bot },
  { href: '/todo', label: 'Daily Tasks', icon: CheckSquare },
];

function isActive(href: string, pathname: string): boolean {
  if (href === '/locations') {
    return pathname === '/locations' ||
      (pathname.startsWith('/locations/') && !pathname.startsWith('/locations/incomplete'));
  }
  if (href === '/attractions') {
    return pathname === '/attractions' || pathname.startsWith('/attractions/');
  }
  return pathname.startsWith(href);
}

export function MobileNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* 바텀 드로어 오버레이 */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* 바텀 드로어 */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card rounded-t-2xl shadow-2xl',
          'transition-transform duration-300 ease-in-out',
          drawerOpen ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <span className="text-sm font-semibold text-muted-foreground">더보기</span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="rounded-full p-1 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="space-y-1 p-3 pb-8">
          {secondaryItems.map((item) => {
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 플로팅 pill 바 */}
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 md:hidden">
        <div className="flex items-center gap-1 rounded-full border bg-card px-3 py-2 shadow-lg">
          {primaryItems.map((item) => {
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
              </Link>
            );
          })}

          {/* 구분선 */}
          <div className="mx-1 h-6 w-px bg-border" />

          {/* 더보기 버튼 */}
          <button
            aria-label="더보기"
            onClick={() => setDrawerOpen((prev) => !prev)}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
              drawerOpen
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>
    </>
  );
}
