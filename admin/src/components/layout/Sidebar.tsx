'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, AlertTriangle, Sparkles, Route, Bot, BarChart2, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Odiga Analytics', icon: BarChart2 },
  { href: '/locations', label: '맛집/카페 관리', icon: MapPin },
  { href: '/attractions', label: '볼거리 관리', icon: Sparkles },
  { href: '/courses', label: '코스 관리', icon: Route },
  { href: '/locations/incomplete', label: '데이터 품질', icon: AlertTriangle },
  { href: '/content-engine', label: '콘텐츠 엔진', icon: Bot },
  { href: '/todo', label: 'Daily Tasks', icon: CheckSquare },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-5">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">
          오늘오디가?
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const active = item.href === '/locations'
            ? pathname === '/locations' || (pathname.startsWith('/locations/') && !pathname.startsWith('/locations/incomplete'))
            : item.href === '/attractions'
              ? pathname === '/attractions' || pathname.startsWith('/attractions/')
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
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
    </aside>
  );
}
