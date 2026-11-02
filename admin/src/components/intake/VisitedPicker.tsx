'use client';

/**
 * 가본 곳 고르기: 한 지역의 검토 전 장소를 이름만 쭉 보고 가본 곳에 체크한 뒤 한 번에 '가봤음'으로 저장한다.
 *   ↑/↓ 이동 · Space 체크 · A 이 페이지 전체 체크/해제
 * 같은 이름이 여러 곳인 장소는 연결할 장소를 골라야 해서 체크할 수 없다 (검토함에서 정한다).
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntakePickItem } from '@/lib/queries/intake';
import { markVisitedBulk } from '@/app/intake/actions';

interface Props {
  items: IntakePickItem[];
}

/** "음식점 > 일식 > 돈까스" → "일식 · 돈까스" */
function shortCategory(value: string | null) {
  if (!value) return null;
  return value.split('>').map((s) => s.trim()).filter(Boolean).slice(-2).join(' · ');
}

/** 주소에서 시·구를 빼고 동·길만 */
function shortAddress(item: IntakePickItem) {
  if (!item.address) return null;
  const rest = item.region_hint && item.address.startsWith(item.region_hint) ? item.address.slice(item.region_hint.length) : item.address;
  return rest.trim().split(/\s+/).slice(0, 2).join(' ');
}

export function VisitedPicker({ items }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [isPending, startTransition] = useTransition();
  const allRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<(HTMLLabelElement | null)[]>([]);

  const selectable = items.filter((it) => !it.match_note?.startsWith('ambiguous'));
  const pageChecked = selectable.filter((it) => checked.has(it.id)).length;
  const allChecked = selectable.length > 0 && pageChecked === selectable.length;

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = pageChecked > 0 && !allChecked;
  }, [pageChecked, allChecked]);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(selectable.map((it) => it.id)));

  const save = () => {
    const ids = [...checked];
    if (!ids.length || isPending) return;
    startTransition(async () => {
      const result = await markVisitedBulk(ids);
      if (result.saved.length) toast.success(`${result.saved.length}곳을 가봤음으로 저장했어요`);
      if (result.skipped.length) toast.message(`${result.skipped.length}곳은 이미 정했거나 연결할 장소를 골라야 해서 건너뛰었어요`);
      if (result.failed.length) toast.error(`${result.failed.length}곳 저장 실패: ${result.failed[0].error}`);
      for (const warning of result.warnings.slice(0, 3)) toast.warning(warning);
      setChecked(new Set(result.failed.map((f) => f.id)));
      setCursor(0);
      router.refresh();
    });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement;
      if (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'checkbox') return;
      if (el.tagName === 'TEXTAREA' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((c) => {
          const next = Math.max(0, Math.min(items.length - 1, c + (event.key === 'ArrowDown' ? 1 : -1)));
          rowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (event.key === ' ') {
        event.preventDefault();
        const item = items[cursor];
        if (item && !item.match_note?.startsWith('ambiguous')) toggle(item.id);
      } else if (event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        toggleAll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!items.length) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-sm text-muted-foreground shadow-sm">
        이 지역은 검토 전 장소가 없어요.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <label className="flex cursor-pointer items-center gap-3 border-b border-gray-100 bg-gray-50/60 px-4 py-2.5">
        <input ref={allRef} type="checkbox" checked={allChecked} onChange={toggleAll} className="size-4 accent-orange-500" />
        <span className="text-xs font-medium">이 페이지 전체 ({selectable.length}곳)</span>
        <span className="ml-auto text-[11px] text-muted-foreground">↑/↓ 이동 · Space 체크 · A 전체</span>
      </label>

      <div>
        {items.map((item, i) => {
          const ambiguous = Boolean(item.match_note?.startsWith('ambiguous'));
          return (
            <label
              key={item.id}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              onMouseEnter={() => setCursor(i)}
              className={cn(
                'flex items-center gap-3 border-b border-gray-50 px-4 py-2 text-sm transition-colors last:border-b-0',
                ambiguous ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                checked.has(item.id) ? 'bg-orange-50/70' : i === cursor ? 'bg-gray-50' : '',
              )}
            >
              <input
                type="checkbox"
                disabled={ambiguous}
                checked={checked.has(item.id)}
                onChange={() => toggle(item.id)}
                className="size-4 accent-orange-500"
              />
              <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
              <span className="hidden w-40 truncate text-xs text-muted-foreground sm:block">{shortCategory(item.category_hint)}</span>
              <span className="hidden w-36 truncate text-xs text-muted-foreground md:block">{shortAddress(item)}</span>
              <span className="w-16 text-right text-[11px] text-muted-foreground">
                {ambiguous ? '검토함에서' : item.draft_body ? '' : '문장 없음'}
              </span>
              {item.kakao_place_id ? (
                <a
                  href={`https://place.map.kakao.com/${item.kakao_place_id}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="text-muted-foreground hover:text-orange-600"
                  title="카카오맵에서 보기"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              ) : (
                <span className="size-3.5" />
              )}
            </label>
          );
        })}
      </div>

      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-gray-100 bg-white/95 px-4 py-3 backdrop-blur">
        <span className="text-xs text-muted-foreground">{checked.size}곳 선택</span>
        <button
          type="button"
          onClick={save}
          disabled={!checked.size || isPending}
          className="h-8 rounded-lg bg-orange-500 px-4 text-xs font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-40"
        >
          {isPending ? '저장하는 중…' : '가봤음으로 저장'}
        </button>
      </div>
    </div>
  );
}
