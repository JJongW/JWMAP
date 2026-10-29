'use client';

/**
 * 장소 수정 화면 (새 큐레이션 테이블 기준)
 * 위에서 아래로: 방문 기록 → 추천하는 이유 → 분류 → 사진 → 기본 정보 → 참고 정보 → 원문 메모
 * 저장하면 DB 트리거가 사이트가 읽는 예전 테이블(locations/attractions)에도 반영한다.
 */
import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Check, ExternalLink, Star, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ATTRACTION_CATEGORY_HIERARCHY, CATEGORY_HIERARCHY, PRICE_OPTIONS } from '@/lib/constants';
import { CURATION_LEVELS, CurationLevelSelector } from '@/components/locations/CurationLevelSelector';
import { ImageUpload } from '@/components/locations/ImageUpload';
import {
  FACT_FIELD_LABEL,
  RECOMMENDATION_BASIS_LABEL,
  RECOMMENDATION_STATUS_LABEL,
  SOURCE_NOTE_LABEL,
  TERM_KIND_LABEL,
  VISIT_STATUS_LABEL,
  type PlaceDetail,
  type VisitStatus,
} from '@/lib/queries/places';
import { PHOTO_SOURCE_LABEL } from '@/lib/queries/intake';
import {
  addPhoto,
  addVisit,
  deleteVisit,
  saveRecommendation,
  setFactStatus,
  setPhoto,
  setPlaceTerm,
  setRecommendationStatus,
  updatePlace,
} from '@/app/places/[id]/actions';

interface Props {
  place: PlaceDetail;
  terms: { id: string; kind: string; slug: string; label: string; mode: string }[];
}

function Section({ title, sub, children, action }: { title: string; sub?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground/70">{sub}</p>}
        </div>
        {action}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

const inputClass = 'h-9 w-full rounded-md border border-gray-200 px-2.5 text-sm focus:border-orange-300 focus:outline-none';
const primaryButton = 'h-9 rounded-md bg-orange-500 px-3 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50';
const secondaryButton = 'h-9 rounded-md border border-gray-200 px-3 text-sm hover:border-orange-300 hover:text-orange-600 disabled:opacity-50';

/** 사이트에 보이는 배지 (project/src/utils/curation.ts getRecommendBadge와 같은 기준) */
function siteBadge(status: VisitStatus, level: number | null): string {
  if (status === 'hidden') return '사이트에 안 보임';
  if (status !== 'visited') return '"아직 안 가봤어요" 후보로 보임';
  if ((level ?? 0) >= 4) return "'대표픽' 배지";
  if (level === 3) return "'운영자 추천' 배지";
  return '배지 없이 "운영자 방문"';
}

export function PlaceEditor({ place, terms }: Props) {
  const [isPending, startTransition] = useTransition();
  const save = (op: () => Promise<{ error: string | null }>, done = '저장했어요') =>
    startTransition(async () => {
      const { error } = await op();
      if (error) toast.error(`저장 실패: ${error}`);
      else toast.success(done);
    });

  // ── 기본 정보 ──
  const [info, setInfo] = useState({
    name: place.name,
    address: place.address ?? '',
    region: place.region ?? '',
    sub_region: place.sub_region ?? '',
    category_main: place.category_main ?? '',
    category_sub: place.category_sub ?? '',
    curation_level: place.curation_level,
    price_level: place.price_level,
  });
  const hierarchy = place.legacy_table === 'attractions' ? ATTRACTION_CATEGORY_HIERARCHY : CATEGORY_HIERARCHY;

  // ── 방문 ──
  const [visitForm, setVisitForm] = useState({ visited_on: '', time_slot: '', companions: '', experience_note: '' });

  // ── 추천 ──
  const published = place.recommendations.find((r) => r.status === 'published');
  const editable = published ?? place.recommendations.find((r) => r.status === 'draft') ?? null;
  const [rec, setRec] = useState({
    id: editable?.id,
    body: editable?.body ?? '',
    fits_for: editable?.fits_for ?? '',
    caveats: editable?.caveats ?? '',
    basis: editable?.basis ?? (place.visit_status === 'visited' ? 'visited' : 'wishlist'),
  });

  const termIds = new Set(place.place_terms.map((t) => t.term_id));
  const [newTerm, setNewTerm] = useState('');
  const [newPhoto, setNewPhoto] = useState<{ url: string; source: 'own' | 'official' | 'web'; source_url: string }>({ url: '', source: 'own', source_url: '' });
  const uploadedPhotos = place.place_photos.filter((p) => p.url);
  const localOnly = place.place_photos.length - uploadedPhotos.length;
  const operatorNotes = place.source_notes;

  return (
    <div className="space-y-4">
      {/* 머리 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{place.name}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {[place.region, place.category_main, place.category_sub].filter(Boolean).join(' · ')} · 사이트에서: {siteBadge(place.visit_status, place.curation_level)}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {place.kakao_place_id && (
            <a href={`https://place.map.kakao.com/${place.kakao_place_id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-muted-foreground hover:text-orange-600">
              <ExternalLink className="h-3 w-3" /> 카카오맵
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {/* 방문 기록 */}
          <Section
            title="방문 기록"
            sub="가봤는지가 사이트 배지의 기준이에요. 방문을 추가하면 자동으로 '가봤음'이 돼요."
            action={
              <div className="flex items-center gap-0.5 rounded-lg border bg-gray-50 p-0.5">
                {(Object.keys(VISIT_STATUS_LABEL) as VisitStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={isPending}
                    onClick={() => save(() => updatePlace(place.id, { visit_status: status }))}
                    className={cn(
                      'h-7 rounded-md px-3 text-xs font-medium transition-all',
                      place.visit_status === status ? 'bg-orange-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {VISIT_STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
            }
          >
            {place.visits.length === 0 ? (
              <p className="text-sm text-muted-foreground">방문 기록이 없어요.</p>
            ) : (
              <ul className="space-y-2">
                {place.visits.map((visit) => (
                  <li key={visit.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 p-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {visit.visited_on ?? '날짜 모름'}
                        {[visit.time_slot, visit.companions].filter(Boolean).length > 0 && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">{[visit.time_slot, visit.companions].filter(Boolean).join(' · ')}</span>
                        )}
                      </p>
                      {visit.experience_note && <p className="mt-1 text-muted-foreground">{visit.experience_note}</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {visit.source === 'odiga_vault' ? '내 사진 폴더에서' : visit.source === 'legacy_flag' ? '예전 "직접 가본 곳" 표시에서' : '직접 기록'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => save(() => deleteVisit(place.id, visit.id), '방문 기록을 지웠어요')}
                      className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                      aria-label="방문 기록 지우기"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr_1fr]">
              <input type="date" value={visitForm.visited_on} onChange={(e) => setVisitForm({ ...visitForm, visited_on: e.target.value })} className={inputClass} aria-label="가본 날" />
              <input value={visitForm.time_slot} onChange={(e) => setVisitForm({ ...visitForm, time_slot: e.target.value })} placeholder="언제 (예: 평일 오후)" className={inputClass} />
              <input value={visitForm.companions} onChange={(e) => setVisitForm({ ...visitForm, companions: e.target.value })} placeholder="누구와 (예: 혼자)" className={inputClass} />
              <input value={visitForm.experience_note} onChange={(e) => setVisitForm({ ...visitForm, experience_note: e.target.value })} placeholder="무엇을 먹고 봤나요 (예: 버터치킨커리, 20분 대기)" className={cn(inputClass, 'sm:col-span-2')} />
              <button
                type="button"
                disabled={isPending}
                onClick={() => save(async () => {
                  const result = await addVisit(place.id, visitForm);
                  if (!result.error) setVisitForm({ visited_on: '', time_slot: '', companions: '', experience_note: '' });
                  return result;
                }, '방문을 기록했어요')}
                className={primaryButton}
              >
                방문 추가
              </button>
            </div>
          </Section>

          {/* 추천하는 이유 */}
          <Section
            title="추천하는 이유"
            sub="공개하면 사이트의 '추천하는 이유'로 나가요. 초안은 사이트에 안 나가요."
          >
            <div className="space-y-2">
              <textarea
                value={rec.body}
                onChange={(e) => setRec({ ...rec, body: e.target.value })}
                rows={3}
                placeholder="예: 커피가 진하고 창가 자리가 넓어서 평일 오후에 노트북 하기 편해요"
                className="w-full rounded-md border border-gray-200 p-2.5 text-sm focus:border-orange-300 focus:outline-none"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={rec.fits_for} onChange={(e) => setRec({ ...rec, fits_for: e.target.value })} placeholder="누구에게 잘 맞나요 (선택)" className={inputClass} />
                <input value={rec.caveats} onChange={(e) => setRec({ ...rec, caveats: e.target.value })} placeholder="주의할 점 (선택, 예: 주말 웨이팅 김)" className={inputClass} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={rec.basis} onChange={(e) => setRec({ ...rec, basis: e.target.value })} className="h-9 rounded-md border border-gray-200 px-2 text-sm" aria-label="추천 근거">
                  {Object.entries(RECOMMENDATION_BASIS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <button type="button" disabled={isPending} onClick={() => save(() => saveRecommendation(place.id, { ...rec, publish: false }), '초안을 저장했어요')} className={secondaryButton}>
                  초안 저장
                </button>
                <button type="button" disabled={isPending} onClick={() => save(() => saveRecommendation(place.id, { ...rec, publish: true }), '공개했어요')} className={primaryButton}>
                  공개
                </button>
                {rec.basis !== 'visited' && (
                  <span className="text-xs text-orange-600">안 가본 곳은 사이트에 ‘아직 안 가봤어요’로 따로 보여요</span>
                )}
              </div>
            </div>
            {place.recommendations.length > 0 && (
              <ul className="mt-4 space-y-2">
                {place.recommendations.map((r) => (
                  <li key={r.id} className={cn('rounded-lg border p-3 text-sm', r.id === rec.id ? 'border-orange-200' : 'border-gray-100')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', r.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-muted-foreground')}>
                        {RECOMMENDATION_STATUS_LABEL[r.status] ?? r.status} · {RECOMMENDATION_BASIS_LABEL[r.basis] ?? r.basis}
                        {r.source === 'legacy_short_desc' && ' · 예전 한줄 설명'}
                        {r.source === 'ai_draft' && ' · AI 초안'}
                      </span>
                      <div className="flex gap-1 text-xs">
                        <button type="button" onClick={() => setRec({ id: r.id, body: r.body, fits_for: r.fits_for ?? '', caveats: r.caveats ?? '', basis: r.basis })} className="rounded px-2 py-1 hover:bg-gray-50">
                          고치기
                        </button>
                        {r.status === 'published' ? (
                          <button type="button" onClick={() => save(() => setRecommendationStatus(place.id, r.id, 'hidden'), '내렸어요')} className="rounded px-2 py-1 hover:bg-red-50 hover:text-red-500">
                            내리기
                          </button>
                        ) : (
                          <button type="button" onClick={() => save(() => setRecommendationStatus(place.id, r.id, 'published'), '공개했어요')} className="rounded px-2 py-1 text-orange-600 hover:bg-orange-50">
                            공개
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-2">{r.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* 분류 */}
          <Section title="분류" sub="제안된 분류는 근거를 보고 확인해야 사이트 검색에 쓰여요.">
            <div className="space-y-3">
              {Object.entries(TERM_KIND_LABEL).map(([kind, label]) => {
                const rows = place.place_terms.filter((t) => t.term?.kind === kind && t.status !== 'rejected');
                return (
                  <div key={kind}>
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {rows.length === 0 && <span className="text-xs text-muted-foreground/70">없음</span>}
                      {rows.map((t) => (
                        <span
                          key={t.term_id}
                          title={t.evidence ?? undefined}
                          className={cn(
                            'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                            t.status === 'confirmed' ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-dashed border-gray-300 text-gray-600',
                          )}
                        >
                          {t.term?.label}
                          {t.status === 'suggested' && (
                            <>
                              <span className="text-[10px] text-muted-foreground">제안{t.evidence ? ` · ${t.evidence.slice(0, 20)}` : ''}</span>
                              <button type="button" onClick={() => save(() => setPlaceTerm(place.id, t.term_id, 'confirmed'))} aria-label="확인" className="text-emerald-600">
                                <Check className="h-3 w-3" />
                              </button>
                            </>
                          )}
                          <button type="button" onClick={() => save(() => setPlaceTerm(place.id, t.term_id, 'rejected'), '뺐어요')} aria-label="빼기" className="text-muted-foreground hover:text-red-500">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-2">
                <select value={newTerm} onChange={(e) => setNewTerm(e.target.value)} className="h-9 flex-1 rounded-md border border-gray-200 px-2 text-sm" aria-label="분류 더하기">
                  <option value="">분류 더하기…</option>
                  {Object.entries(TERM_KIND_LABEL).map(([kind, label]) => (
                    <optgroup key={kind} label={label}>
                      {terms.filter((t) => t.kind === kind && !termIds.has(t.id)).map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button type="button" disabled={!newTerm || isPending} onClick={() => save(async () => { const r = await setPlaceTerm(place.id, newTerm, 'confirmed'); setNewTerm(''); return r; })} className={secondaryButton}>
                  더하기
                </button>
              </div>
            </div>
          </Section>

          {/* 사진 */}
          <Section title="사진" sub="대표 사진이 사이트 카드에 나가요. 출처가 함께 저장돼요.">
            {uploadedPhotos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {place.image_url ? '예전에 올린 대표 사진만 있어요.' : '사진이 없어요.'}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {uploadedPhotos.map((photo) => (
                  <figure key={photo.id} className={cn('relative overflow-hidden rounded-lg border', photo.is_cover ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-100', photo.status === 'rejected' && 'opacity-40')}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url!} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                    <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/50 px-1.5 py-1 text-[10px] text-white">
                      <span>{PHOTO_SOURCE_LABEL[photo.source] ?? photo.source}</span>
                      <span className="flex gap-1.5">
                        <button type="button" onClick={() => save(() => setPhoto(place.id, photo.id, { is_cover: true }), '대표 사진으로 정했어요')} aria-label="대표 사진">
                          <Star className={cn('h-3 w-3', photo.is_cover && 'fill-current text-orange-300')} />
                        </button>
                        <button type="button" onClick={() => save(() => setPhoto(place.id, photo.id, { status: photo.status === 'rejected' ? 'suggested' : 'rejected', is_cover: false }))} aria-label="안 쓰기">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            {localOnly > 0 && <p className="mt-2 text-xs text-muted-foreground">아직 올리지 않은 내 사진 {localOnly}장</p>}
            <div className="mt-4 space-y-2 rounded-lg border border-dashed border-gray-200 p-3">
              <p className="text-xs font-medium text-muted-foreground">사진 더하기</p>
              <ImageUpload value={newPhoto.url} onChange={(url) => setNewPhoto({ ...newPhoto, url })} />
              <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
                <select value={newPhoto.source} onChange={(e) => setNewPhoto({ ...newPhoto, source: e.target.value as 'own' | 'official' | 'web' })} className={inputClass} aria-label="사진 출처">
                  {Object.entries(PHOTO_SOURCE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input value={newPhoto.source_url} onChange={(e) => setNewPhoto({ ...newPhoto, source_url: e.target.value })} placeholder={newPhoto.source === 'own' ? '원본 주소 (선택)' : '가져온 곳 주소 (예: 가게 인스타 게시물)'} className={inputClass} />
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={!newPhoto.url || isPending} onClick={() => save(async () => { const r = await addPhoto(place.id, { ...newPhoto, cover: true }); if (!r.error) setNewPhoto({ url: '', source: newPhoto.source, source_url: '' }); return r; }, '대표 사진으로 더했어요')} className={primaryButton}>
                  대표 사진으로 더하기
                </button>
                <button type="button" disabled={!newPhoto.url || isPending} onClick={() => save(async () => { const r = await addPhoto(place.id, { ...newPhoto, cover: false }); if (!r.error) setNewPhoto({ url: '', source: newPhoto.source, source_url: '' }); return r; }, '사진을 더했어요')} className={secondaryButton}>
                  더하기만
                </button>
              </div>
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          {/* 기본 정보 */}
          <Section title="기본 정보">
            <div className="space-y-2">
              <input value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} placeholder="장소 이름" className={inputClass} />
              <input value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} placeholder="주소" className={inputClass} />
              <div className="grid grid-cols-2 gap-2">
                <input value={info.region} onChange={(e) => setInfo({ ...info, region: e.target.value })} placeholder="지역 (예: 건대/성수/왕십리)" className={inputClass} />
                <input value={info.sub_region} onChange={(e) => setInfo({ ...info, sub_region: e.target.value })} placeholder="동네 (예: 성수동)" className={inputClass} />
                <select value={info.category_main} onChange={(e) => setInfo({ ...info, category_main: e.target.value, category_sub: '' })} className={inputClass} aria-label="장소 종류">
                  <option value="">장소 종류</option>
                  {Object.keys(hierarchy).map((main) => <option key={main} value={main}>{main}</option>)}
                </select>
                <select value={info.category_sub} onChange={(e) => setInfo({ ...info, category_sub: e.target.value })} className={inputClass} aria-label="세부 종류">
                  <option value="">세부 종류</option>
                  {(hierarchy[info.category_main] ?? []).map((sub) => <option key={sub} value={sub}>{sub}</option>)}
                  {info.category_sub && !(hierarchy[info.category_main] ?? []).includes(info.category_sub) && <option value={info.category_sub}>{info.category_sub}</option>}
                </select>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">추천 강도 (가본 곳만 배지가 붙어요)</p>
                <CurationLevelSelector value={info.curation_level} onChange={(value) => setInfo({ ...info, curation_level: value })} />
                {info.curation_level && (
                  <p className="mt-1 text-[11px] text-muted-foreground">{CURATION_LEVELS.find((l) => l.value === info.curation_level)?.desc}</p>
                )}
              </div>
              {place.legacy_table !== 'attractions' && (
                <select value={info.price_level ?? ''} onChange={(e) => setInfo({ ...info, price_level: e.target.value ? Number(e.target.value) : null })} className={inputClass} aria-label="가격대">
                  <option value="">가격대 모름</option>
                  {PRICE_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              )}
              <button
                type="button"
                disabled={isPending}
                onClick={() => save(() => updatePlace(place.id, {
                  name: info.name.trim(),
                  address: info.address.trim() || null,
                  region: info.region.trim() || null,
                  sub_region: info.sub_region.trim() || null,
                  category_main: info.category_main || null,
                  category_sub: info.category_sub || null,
                  curation_level: info.curation_level,
                  price_level: info.price_level,
                }))}
                className={cn(primaryButton, 'w-full')}
              >
                기본 정보 저장
              </button>
            </div>
          </Section>

          {/* 다른 곳의 리뷰 */}
          {place.external_reviews.length > 0 && (
            <Section title="다른 곳의 리뷰" sub="추천 문장을 쓸 때 참고만 해요. 사이트에 안 나가요.">
              <ul className="space-y-1.5">
                {place.external_reviews.slice(0, 8).map((review) => (
                  <li key={review.id} className="rounded-lg border border-gray-100 p-2 text-sm">
                    <span className="mr-1 text-[10px] font-semibold text-muted-foreground">{review.source}</span>
                    {review.excerpt}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* 참고 정보 */}
          <Section title="참고 정보" sub="영업시간·주차 같은 사실. 확인하면 확인한 날짜가 남아요.">
            {place.place_facts.length === 0 ? (
              <p className="text-sm text-muted-foreground">없어요.</p>
            ) : (
              <ul className="space-y-1.5">
                {place.place_facts.map((fact) => (
                  <li key={fact.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 p-2 text-sm">
                    <div>
                      <p>
                        <span className="font-medium">{FACT_FIELD_LABEL[fact.field] ?? fact.field}</span>{' '}
                        {String(fact.value.text ?? (fact.value.available === true ? '가능' : fact.value.available === false ? '불가' : ''))}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {fact.source}
                        {fact.checked_at ? ` · ${new Date(fact.checked_at).toLocaleDateString('ko-KR')} 확인` : ' · 확인 전'}
                        {fact.status === 'outdated' && ' · 지난 정보'}
                      </p>
                    </div>
                    <div className="flex gap-1 text-xs">
                      <button type="button" onClick={() => save(() => setFactStatus(place.id, fact.id, 'verified'), '확인했어요')} className={cn('rounded px-2 py-1', fact.status === 'verified' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-50')}>
                        맞아요
                      </button>
                      <button type="button" onClick={() => save(() => setFactStatus(place.id, fact.id, 'outdated'))} className="rounded px-2 py-1 hover:bg-red-50 hover:text-red-500">
                        지난 정보
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* 원문 메모 */}
          <Section title="원문 메모" sub="예전에 적어 둔 그대로예요. 고치지 않아요.">
            {operatorNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">없어요.</p>
            ) : (
              <ul className="space-y-1.5">
                {operatorNotes.map((note) => (
                  <li key={note.id} className="rounded-lg bg-gray-50 p-2 text-sm">
                    <p className="mb-0.5 text-[10px] font-semibold text-muted-foreground">{SOURCE_NOTE_LABEL[note.classified_as] ?? note.classified_as}</p>
                    <p className="whitespace-pre-wrap">{note.raw_text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
