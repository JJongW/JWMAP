import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { VisitedPicker } from '@/components/intake/VisitedPicker';
import { PICK_OTHER, getIntakePickList, getIntakeRegions } from '@/lib/queries/intake';
import { cn } from '@/lib/utils';

const PER_PAGE = 50;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** 서울은 구 이름만, 나머지는 시·도까지 */
function regionLabel(region: string) {
  return region.replace(/^서울 /, '');
}

export default async function IntakePickPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createServerSupabase();
  const regions = await getIntakeRegions(supabase);
  const tabNames = regions.tabs.map((t) => t.region);
  const asked = typeof params.region === 'string' ? params.region : '';
  const region = asked === PICK_OTHER || tabNames.includes(asked) ? asked : (tabNames[0] ?? PICK_OTHER);
  const page = Math.max(1, Number(params.page) || 1);
  const list = await getIntakePickList(supabase, { region, tabRegions: tabNames, page, per_page: PER_PAGE });
  const pages = Math.max(1, Math.ceil(list.count / PER_PAGE));
  const href = (next: { region?: string; page?: number }) => {
    const q = new URLSearchParams({ region: next.region ?? region });
    if (next.page && next.page > 1) q.set('page', String(next.page));
    return `/intake/pick?${q.toString()}`;
  };
  const chip = (active: boolean) =>
    cn('rounded-full px-2.5 py-1 text-xs transition-colors', active ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-muted-foreground hover:border-orange-300');

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">가본 곳 고르기</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              이름만 보고 가본 곳에 체크해요. 저장하면 검토함의 &lsquo;가봤음&rsquo;과 똑같이 방문 기록과 추천 문장 초안이 생기고, 사이트에는 아직 안 올라가요.
            </p>
          </div>
          <Link href="/intake" className="shrink-0 text-xs text-muted-foreground hover:text-orange-600">
            검토함으로 →
          </Link>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {regions.tabs.map((tab) => (
            <Link key={tab.region} href={href({ region: tab.region })} className={chip(tab.region === region)}>
              {regionLabel(tab.region)} {tab.count}
            </Link>
          ))}
          {regions.other.count > 0 && (
            <Link href={href({ region: PICK_OTHER })} className={chip(region === PICK_OTHER)}>
              {PICK_OTHER} {regions.other.count}
            </Link>
          )}
        </div>

        <VisitedPicker key={`${region}-${page}`} items={list.data} />

        {pages > 1 && (
          <div className="flex items-center justify-center gap-1.5 text-xs">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={href({ page: n })} className={cn(chip(n === page), 'min-w-7 text-center')}>
                {n}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
