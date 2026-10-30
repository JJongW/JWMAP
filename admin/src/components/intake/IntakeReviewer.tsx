'use client';

/**
 * 검토함: 한 곳씩 보고 숫자로 고른 뒤 Enter로 저장한다.
 *   1 가봤음 · 2 안 가봤지만 추천 · 3 나중에 · 4 제외 → Enter 저장 · Esc 취소 · ←/→ 이동
 * 가봤음·추천을 고르면 리뷰로 만든 추천 문장 초안(raw.draft)과 올라간 사진이 미리 채워진다.
 * 문장은 '초안'으로 저장되고, 공개는 장소 화면에서 확인한 뒤 한다.
 * 이름이 같은 곳이 여러 개면 연결할 장소를 먼저 고른다 (새로 만들면 중복이 생긴다).
 */
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Camera, ChevronLeft, ChevronRight, ExternalLink, Link2, MessageSquareQuote, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  INTAKE_SOURCE_LABEL,
  PHOTO_SOURCE_LABEL,
  type IntakeDecision,
  type IntakeItem,
} from '@/lib/queries/intake';
import { decideIntake, searchPlaces, setPhotoStatus } from '@/app/intake/actions';

const DECISIONS: { key: string; status: IntakeDecision; label: string; hint: string; tone: string }[] = [
  { key: '1', status: 'visited', label: '가봤음', hint: '방문 기록을 만들고 사이트에 "운영자 방문"으로 보여요', tone: 'bg-orange-500 hover:bg-orange-600 text-white' },
  { key: '2', status: 'recommend_unvisited', label: '안 가봤지만 추천', hint: '"아직 안 가봤어요"로 따로 보여요. 근거를 남겨요', tone: 'bg-white border border-orange-300 text-orange-700 hover:bg-orange-50' },
  { key: '3', status: 'later', label: '나중에 갈 곳', hint: '사이트에 안 나가요', tone: 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300' },
  { key: '4', status: 'excluded', label: '제외', hint: '장소를 만들지 않아요', tone: 'bg-white border border-gray-200 text-gray-500 hover:text-red-500 hover:bg-red-50' },
];

const BASIS_PRESETS = ['리뷰 참고', '지인 추천', '직접 찾아봄', '가보고 싶음'];
const SPACE_HINT = /전시|미술관|박물관|갤러리|공원|산책|서점|도서관|공연|체험|전망|궁|사찰|시장|테마/;

type PlaceOption = Awaited<ReturnType<typeof searchPlaces>>[number];

interface Props {
  items: IntakeItem[];
  total: number;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function IntakeReviewer({ items: initialItems, total }: Props) {
  const [items, setItems] = useState(initialItems);
  const [index, setIndex] = useState(0);
  const [basis, setBasis] = useState('');
  const [choice, setChoice] = useState<IntakeDecision | null>(null);
  const [text, setText] = useState('');
  const [fitsFor, setFitsFor] = useState('');
  const [textEdited, setTextEdited] = useState(false);
  const [applyPhotos, setApplyPhotos] = useState(true);
  const [linked, setLinked] = useState<PlaceOption | null>(null);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<PlaceOption[]>([]);
  const [mode, setMode] = useState<'locations' | 'attractions'>('locations');
  const [isPending, startTransition] = useTransition();

  const item = items[index] ?? null;
  const ambiguous = Boolean(item?.match_note?.startsWith('ambiguous'));
  const target = linked ?? (item?.matched_place ? { ...item.matched_place, address: null } : null);
  const uploaded = useMemo(() => item?.photos.filter((p) => p.url) ?? [], [item]);
  const notUploaded = (item?.photos.length ?? 0) - uploaded.length;

  // 다른 장소로 넘어가면 그 장소 기준으로 입력을 새로 시작한다
  const [shownId, setShownId] = useState<string | null>(null);
  if ((item?.id ?? null) !== shownId) {
    setShownId(item?.id ?? null);
    setBasis('');
    setChoice(null);
    setText(item?.raw.draft?.body ?? '');
    setFitsFor(item?.raw.draft?.fits_for ?? '');
    setTextEdited(false);
    setApplyPhotos(true);
    setLinked(null);
    setQuery(item?.name ?? '');
    setOptions([]);
    setMode(item?.category_hint && SPACE_HINT.test(item.category_hint) ? 'attractions' : 'locations');
  }

  const recommends = choice === 'visited' || choice === 'recommend_unvisited';

  const choose = useCallback((status: IntakeDecision) => {
    setChoice(status);
    if (status === 'recommend_unvisited') setBasis((b) => b || (item?.raw.draft?.body ? '리뷰 참고' : ''));
  }, [item]);

  const commit = useCallback(() => {
    const status = choice;
    if (!item || !status || isPending) return;
    if ((status === 'visited' || status === 'recommend_unvisited') && ambiguous && !linked) {
      toast.error('같은 이름이 여러 곳이에요. 아래에서 연결할 장소를 먼저 골라주세요.');
      return;
    }
    const withText = status === 'visited' || status === 'recommend_unvisited';
    startTransition(async () => {
      const result = await decideIntake({
        intakeId: item.id,
        status,
        placeId: linked?.id ?? null,
        mode,
        basis: status === 'recommend_unvisited' ? basis : null,
        recommendation: withText && text.trim() ? { body: text, fitsFor: fitsFor || null, edited: textEdited } : null,
        applyPhotos: withText && applyPhotos,
      });
      if (result.error) {
        toast.error(`저장 실패: ${result.error}`);
        return;
      }
      if (result.warning) toast.warning(`${item.name}: ${result.warning}`);
      else toast.success(`${item.name}: ${DECISIONS.find((d) => d.status === status)?.label}`);
      (document.activeElement as HTMLElement | null)?.blur();
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      setIndex((i) => Math.min(i, items.length - 2));
    });
  }, [item, choice, isPending, ambiguous, linked, mode, basis, text, fitsFor, textEdited, applyPhotos, items.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const decision = DECISIONS.find((d) => d.key === event.key);
      if (decision) choose(decision.status);
      if (event.key === 'Enter' && el.tagName !== 'BUTTON' && el.tagName !== 'A') {
        event.preventDefault();
        commit();
      }
      if (event.key === 'Escape') setChoice(null);
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, items.length - 1));
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, commit, items.length]);

  const runSearch = () =>
    startTransition(async () => {
      setOptions(await searchPlaces(query));
    });

  const choosePhoto = (photoId: string, cover: boolean) =>
    startTransition(async () => {
      const placeId = target?.id ?? null;
      const result = await setPhotoStatus({ photoId, status: 'selected', cover: cover && Boolean(placeId), placeId });
      if (result.error) {
        toast.error(`사진 저장 실패: ${result.error}`);
        return;
      }
      setItems((prev) =>
        prev.map((it) =>
          it.id !== item?.id
            ? it
            : {
                ...it,
                photos: it.photos.map((p) =>
                  p.id === photoId
                    ? { ...p, status: 'selected', is_cover: cover && Boolean(placeId) }
                    : cover && placeId ? { ...p, is_cover: false } : p,
                ),
              },
        ),
      );
    });

  if (!item) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-medium">검토할 장소가 없어요</p>
        <p className="mt-1 text-xs text-muted-foreground">수집기를 돌리면 여기에 쌓여요.</p>
      </div>
    );
  }

  const kakaoSearch = `https://map.kakao.com/?q=${encodeURIComponent(`${item.name} ${item.region_hint ?? ''}`.trim())}`;

  return (
    <div className="space-y-4">
      {/* 위치 */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {index + 1} / {items.length}
          {total > items.length && ` (전체 ${total}곳 중)`}
        </span>
        <span className="hidden md:inline">키보드: 1 가봤음 · 2 안 가봤지만 추천 · 3 나중에 · 4 제외 → Enter 저장 · Esc 취소 · ←/→ 이동</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => setIndex((i) => Math.max(i - 1, 0))} className="rounded-md border border-gray-200 p-1 hover:border-orange-300" aria-label="이전">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setIndex((i) => Math.min(i + 1, items.length - 1))} className="rounded-md border border-gray-200 p-1 hover:border-orange-300" aria-label="다음">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* 장소 */}
        <div className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">{item.name}</h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-muted-foreground">
                {INTAKE_SOURCE_LABEL[item.source] ?? item.source}
              </span>
              {item.suggested_status === 'visited' && (
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">
                  직접 찍은 사진 있음 → 가봤음 추정
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {[item.province, item.region_hint, item.category_hint].filter(Boolean).join(' · ')}
              {item.raw.first_taken_at && ` · 첫 사진 ${formatDate(item.raw.first_taken_at)}`}
            </p>
            {item.raw.memo && <p className="mt-2 rounded-lg bg-gray-50 p-2 text-sm">“{item.raw.memo}”</p>}
          </div>

          {/* 사진 */}
          <div>
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Camera className="h-3 w-3" /> 사진 {item.photos.length}장
            </p>
            {uploaded.length > 0 ? (
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {uploaded.map((photo) => (
                  <figure key={photo.id} className={cn('group relative overflow-hidden rounded-lg border', photo.is_cover ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-100')}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url!} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                    <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/50 px-1.5 py-1 text-[10px] text-white">
                      <span>{PHOTO_SOURCE_LABEL[photo.source] ?? photo.source}</span>
                      <button
                        type="button"
                        onClick={() => choosePhoto(photo.id, true)}
                        disabled={!target}
                        title={target ? '대표 사진으로' : '장소를 연결한 뒤 고를 수 있어요'}
                        className="flex items-center gap-0.5 disabled:opacity-40"
                      >
                        <Star className={cn('h-3 w-3', photo.is_cover && 'fill-current text-orange-300')} /> 대표
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
            {notUploaded > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                아직 올리지 않은 사진 {notUploaded}장 · 사진 올리기 스크립트를 돌리면 여기서 고를 수 있어요
              </p>
            )}
          </div>

          {/* 수집한 리뷰 */}
          <div>
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <MessageSquareQuote className="h-3 w-3" /> 다른 곳의 리뷰 {item.reviews.length}개
            </p>
            {item.reviews.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">아직 수집하지 않았어요.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {item.reviews.slice(0, 6).map((review) => (
                  <li key={review.id} className="rounded-lg border border-gray-100 p-2 text-sm">
                    <span className="mr-1 text-[10px] font-semibold text-muted-foreground">{review.source}</span>
                    {review.excerpt}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 결정 */}
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">어느 장소인가요</p>
            {target ? (
              <div className="rounded-lg border border-gray-100 p-3 text-sm">
                <p className="font-medium">{target.name}</p>
                <p className="text-xs text-muted-foreground">
                  {target.region ?? '지역 미정'} · {target.visit_status === 'visited' ? '가봤음으로 등록됨' : '후보로 등록됨'}
                </p>
                <div className="mt-1 flex gap-3 text-xs">
                  <Link href={`/places/${target.id}`} className="text-orange-600 hover:underline">장소 보기</Link>
                  {linked && (
                    <button type="button" onClick={() => setLinked(null)} className="text-muted-foreground hover:text-foreground">
                      연결 취소
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {ambiguous ? `같은 이름이 여러 곳이에요 (${item.match_note?.replace('ambiguous: ', '')})` : '등록되지 않은 새 장소예요. 정하면 새로 만들어요.'}
              </p>
            )}
            <div className="flex gap-1.5">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && runSearch()}
                placeholder="등록된 장소에서 찾기"
                className="h-8 flex-1 rounded-md border border-gray-200 px-2 text-sm"
              />
              <button type="button" onClick={runSearch} className="h-8 rounded-md border border-gray-200 px-2 text-xs hover:border-orange-300 hover:text-orange-600">
                찾기
              </button>
            </div>
            {options.length > 0 && (
              <ul className="space-y-1">
                {options.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => { setLinked(option); setOptions([]); }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-gray-50"
                    >
                      <Link2 className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{option.name}</span>
                      <span className="truncate text-muted-foreground">{option.region ?? option.address}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!target && (
              <div className="flex items-center gap-1 rounded-lg border bg-gray-50 p-0.5 text-xs">
                {(['locations', 'attractions'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={cn('h-7 flex-1 rounded-md font-medium', mode === value ? 'bg-orange-500 text-white shadow-sm' : 'text-muted-foreground')}
                  >
                    {value === 'locations' ? '맛집·카페' : '볼거리'}
                  </button>
                ))}
              </div>
            )}
            <a href={kakaoSearch} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-orange-600">
              <ExternalLink className="h-3 w-3" /> 카카오맵에서 확인
            </a>
          </div>

          <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">정하기</p>
            {DECISIONS.map((decision) => {
              const selected = choice === decision.status;
              return (
                <div key={decision.status}>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={(event) => {
                      choose(decision.status);
                      // 버튼에 포커스가 남으면 Enter가 버튼을 다시 누르므로 풀어 둔다
                      event.currentTarget.blur();
                    }}
                    aria-pressed={selected}
                    className={cn(
                      'flex h-10 w-full items-center justify-between rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-50',
                      decision.tone,
                      selected && 'ring-2 ring-orange-400 ring-offset-1',
                      choice && !selected && 'opacity-50',
                    )}
                  >
                    <span>{decision.label}</span>
                    <kbd className="rounded border border-current/20 px-1.5 text-[10px] opacity-70">{decision.key}</kbd>
                  </button>
                  {!choice && <p className="mt-0.5 px-1 text-[11px] text-muted-foreground">{decision.hint}</p>}
                  {selected && decision.status === 'recommend_unvisited' && (
                    <div className="mt-2 space-y-1.5 rounded-lg bg-orange-50/60 p-2">
                      <p className="text-[11px] text-orange-700">추천 근거</p>
                      <div className="flex flex-wrap gap-1">
                        {BASIS_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setBasis(preset)}
                            className={cn('rounded-full px-2 py-0.5 text-xs', basis === preset ? 'bg-orange-500 text-white' : 'bg-white text-orange-700')}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                      <input
                        value={basis}
                        onChange={(event) => setBasis(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') { event.preventDefault(); commit(); }
                        }}
                        placeholder="왜 추천하나요? (예: 친구가 크루아상이 맛있대요)"
                        className="h-8 w-full rounded-md border border-orange-200 bg-white px-2 text-sm"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {choice && (
            <div className="space-y-3 rounded-xl border border-orange-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {DECISIONS.find((d) => d.status === choice)?.label}로 저장
              </p>
              {recommends && (
                <>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">
                      추천하는 이유 {item.raw.draft?.body && !textEdited ? '· 수집한 리뷰로 만든 초안이에요' : ''}
                    </p>
                    <textarea
                      value={text}
                      onChange={(event) => { setText(event.target.value); setTextEdited(true); }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); commit(); }
                      }}
                      rows={4}
                      placeholder="비워 두면 문장 없이 저장해요"
                      className="w-full rounded-md border border-gray-200 p-2 text-sm leading-relaxed"
                    />
                    <input
                      value={fitsFor}
                      onChange={(event) => { setFitsFor(event.target.value); setTextEdited(true); }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); commit(); }
                      }}
                      placeholder="이럴 때 좋아요 (선택)"
                      className="h-8 w-full rounded-md border border-gray-200 px-2 text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      초안으로 저장돼요. 사이트에는 장소 화면에서 확인하고 공개해야 나가요. 줄바꿈은 Shift+Enter.
                    </p>
                  </div>
                  {uploaded.length > 0 && (
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={applyPhotos} onChange={(event) => setApplyPhotos(event.target.checked)} />
                      사진 {uploaded.length}장 사용 · 대표 사진이 없으면 첫 장을 대표로
                    </label>
                  )}
                </>
              )}
              <button
                type="button"
                disabled={isPending}
                onClick={commit}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-orange-500 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                저장 <kbd className="rounded border border-white/40 px-1.5 text-[10px]">Enter</kbd>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
