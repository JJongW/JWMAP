import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { IntakeReviewer } from '@/components/intake/IntakeReviewer';
import {
  INTAKE_SOURCE_LABEL,
  INTAKE_STATUS_LABEL,
  getIntakeCounts,
  getIntakeGroups,
  getIntakeQueue,
  type IntakeStatus,
} from '@/lib/queries/intake';
import { cn } from '@/lib/utils';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function IntakePage({ searchParams }: Props) {
  const params = await searchParams;
  const status = (Object.keys(INTAKE_STATUS_LABEL).includes(String(params.status)) ? params.status : 'pending') as IntakeStatus;
  const supabase = await createServerSupabase();
  const source = typeof params.source === 'string' ? params.source : undefined;
  const folder = typeof params.folder === 'string' ? params.folder : undefined;
  const [queue, counts, groups] = await Promise.all([
    getIntakeQueue(supabase, { status, source, folder, per_page: 50 }),
    getIntakeCounts(supabase),
    getIntakeGroups(supabase, status),
  ]);
  const href = (next: { source?: string; folder?: string }) => {
    const q = new URLSearchParams();
    if (status !== 'pending') q.set('status', status);
    if (next.source) q.set('source', next.source);
    if (next.folder) q.set('folder', next.folder);
    const qs = q.toString();
    return qs ? `/intake?${qs}` : '/intake';
  };
  const chip = (active: boolean) =>
    cn('rounded-full px-2.5 py-1 text-xs transition-colors', active ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-muted-foreground hover:border-orange-300');

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">검토함</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            수집한 장소를 하나씩 보고 가봤는지만 정해요. 주소·사진·리뷰는 수집기가 채워요.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-0.5 rounded-lg border bg-gray-50 p-0.5">
          {(Object.keys(INTAKE_STATUS_LABEL) as IntakeStatus[]).map((key) => (
            <Link
              key={key}
              href={key === 'pending' ? '/intake' : `/intake?status=${key}`}
              className={cn(
                'h-7 rounded-md px-3 text-xs font-medium leading-7 transition-all',
                key === status ? 'bg-orange-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {INTAKE_STATUS_LABEL[key]} {counts[key]}
            </Link>
          ))}
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <Link href={href({})} className={chip(!source && !folder)}>전체</Link>
            {Object.entries(groups.sources).map(([key, n]) => (
              <Link key={key} href={href({ source: key })} className={chip(source === key && !folder)}>
                {INTAKE_SOURCE_LABEL[key] ?? key} {n}
              </Link>
            ))}
          </div>
          {Object.keys(groups.folders).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">카카오 폴더</span>
              {Object.entries(groups.folders)
                .sort((a, b) => b[1] - a[1])
                .map(([name, n]) => (
                  <Link key={name} href={href({ folder: name })} className={chip(folder === name)}>
                    {name} {n}
                  </Link>
                ))}
            </div>
          )}
        </div>

        <IntakeReviewer key={`${status}-${source}-${folder}`} items={queue.data} total={queue.count} />
      </div>
    </AdminLayout>
  );
}
