import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { REVIEW_TABS, getReviewNeeded, type ReviewKey } from '@/lib/queries/review-needed';
import { cn } from '@/lib/utils';
import { HideActions } from '@/components/places/HideActions';

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

export default async function ReviewNeededPage({ searchParams }: Props) {
  const params = await searchParams;
  const key = (REVIEW_TABS.some((t) => t.key === params.filter) ? params.filter : REVIEW_TABS[0].key) as ReviewKey;
  const supabase = await createServerSupabase();
  const { counts, rows } = await getReviewNeeded(supabase, key);
  const tab = REVIEW_TABS.find((t) => t.key === key)!;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">확인 필요</h1>
          <p className="mt-1 text-xs text-muted-foreground">사이트에 덜 보이거나 잘못 보일 수 있는 장소예요. 이름을 누르면 바로 고쳐요.</p>
        </div>

        <div className="flex flex-wrap gap-0.5 rounded-lg border bg-gray-50 p-0.5">
          {REVIEW_TABS.map((t) => (
            <Link
              key={t.key}
              href={`/locations/incomplete?filter=${t.key}`}
              className={cn(
                'h-7 rounded-md px-3 text-xs font-medium leading-7 transition-all',
                t.key === key ? 'bg-orange-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label} {counts[t.key]}
            </Link>
          ))}
        </div>

        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="px-5 pb-3 pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tab.label}</p>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground/70">{tab.desc} · {rows.length}곳</p>
              {key === 'closed' && rows.length > 1 && <HideActions ids={rows.map((r) => r.id)} label={`${rows.length}곳 모두 숨기기`} />}
            </div>
          </div>
          <div className="space-y-1.5 px-5 pb-5">
            {rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">확인할 장소가 없어요.</p>}
            {rows.slice(0, 200).map((row) => (
              <div key={`${row.id}-${row.note}`} className="rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50/50">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {row.action === 'hide' && (
                    <span className="order-last ml-auto">
                      <HideActions ids={[row.id]} />
                    </span>
                  )}
                  {row.ids ? (
                    row.ids.map((id, i) => (
                      <Link key={id} href={`/places/${id}`} className="font-medium hover:text-orange-600 hover:underline">
                        {row.name.split(' / ')[i] ?? id.slice(0, 8)}
                      </Link>
                    ))
                  ) : (
                    <Link href={`/places/${row.id}`} className="font-medium hover:text-orange-600 hover:underline">
                      {row.name}
                    </Link>
                  )}
                </div>
                {row.note && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{row.note}</p>}
              </div>
            ))}
            {rows.length > 200 && <p className="pt-2 text-center text-xs text-muted-foreground">앞의 200곳만 보여요.</p>}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
