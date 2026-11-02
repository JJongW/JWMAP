/**
 * DecisionResultView.tsx
 * 
 * 의사결정 결과 화면.
 * "검색 결과"가 아니라 "확신 있는 추천"처럼 보여야 한다.
 * 
 * 구조:
 * 1. Primary Recommendation Card - "오늘은 여기." + 장소명 + 이유 + 방문 여부
 * 2. Action Buttons - 네이버/카카오 지도 열기 (대안보다 먼저, 카드 바로 아래)
 * 3. Secondary Options (최대 2개) - 접힌 보조 영역. 펼치면 비교할 수 있다
 * 4. "다시 고르기" / "지도로 보기" 전환 버튼
 * 
 * 카드 탭과 "자세히 보기"는 모두 같은 장소 상세(PlaceDetail)를 연다.
 * 운영자가 이유를 적지 않은 곳은 추천 강도 배지를 달지 않고, 조건과 맞는 정보만 보여준다.
 * 고른 조건이 모두 확인된 곳이 없으면 미확인 후보를 바로 띄우지 않고, 무엇이 확인 안 됐는지 먼저 말한다.
 */

import { useState } from 'react';
import { MapPin, ChevronDown, ChevronRight, Navigation } from 'lucide-react';
import type { ContentMode, Location } from '../types/location';
import type { DecisionResult } from '../utils/decisionEngine';
import { getConditionMatches, HOURS_SOURCE, type ConditionMatch } from '../utils/decisionEngine';
import { getConditionLabels, KIND_LABEL, type IntentConditions } from '../utils/intentChips';
import { ConditionChips } from './ConditionChips';
import { termLabel } from '../utils/taxonomy';
import { getCardImageUrl } from '../utils/image';
import {
  getCuratorReason,
  getUnvisitedBasisLabel,
  getVisitStatusLabel,
  isCuratorVisited,
  isPracticalInfoTag,
} from '../utils/curation';
import { PriceLevelBadge } from './PriceLevelBadge';
import { RecommendBadge } from './RecommendBadge';

interface DecisionResultViewProps {
  /** null이면 조건에 맞는 곳이 없다는 안내와 칩만 보여준다 */
  result: DecisionResult | null;
  /** 지금 추천에 쓴 조건. 칩을 고치면 바로 다시 추천한다 */
  conditions: IntentConditions;
  onConditionsChange: (next: IntentConditions) => void;
  regionOptions: string[];
  /** 문장에서 조건을 못 읽었을 때 등 결과 위 안내 */
  notice?: string | null;
  contentMode?: ContentMode;
  /** "다시 고르기" 클릭 시 → decision 모드로 돌아감 */
  onRetry: () => void;
  /** 지도 탐색으로 돌아가기 */
  onBrowse: () => void;
  /** 장소 상세 보기 (기존 PlaceDetail 연동) */
  onOpenDetail: (location: Location) => void;
}

export function DecisionResultView({
  result,
  conditions,
  onConditionsChange,
  regionOptions,
  notice,
  contentMode = 'food',
  onRetry,
  onBrowse,
  onOpenDetail,
}: DecisionResultViewProps) {
  const copy = getResultCopy(contentMode);
  // 미확인 후보 보기는 조건이 바뀌면 다시 접는다 (새 조건에서 확인된 곳이 생길 수 있다)
  const conditionKey = JSON.stringify(conditions);
  const [unconfirmedOpenFor, setUnconfirmedOpenFor] = useState<string | null>(null);
  const showUnconfirmed = unconfirmedOpenFor === conditionKey;
  const onlyUnconfirmed = result !== null && result.confirmedCount === 0;
  const title = !result
    ? '고른 조건에 맞는 곳이 없어요.'
    : !onlyUnconfirmed
      ? copy.title
      : showUnconfirmed
        ? '일부 조건을 확인하지 못한 후보예요.'
        : '조건이 모두 확인된 곳은 아직 없어요.';

  return (
    <div className="ko-text fixed inset-0 z-40 flex flex-col bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-lg px-4 pb-8 pt-4 md:px-6 md:pt-6">

          {/* ── 헤드라인 ── */}
          <p className="mb-1 text-xs font-medium tracking-widest text-gray-400">
            {copy.eyebrow}
          </p>
          {/* 모바일에서는 오른쪽 위 맛집/볼거리 전환과 겹치지 않게 비워 둔다 */}
          <h1 className="mb-2.5 pr-36 text-2xl font-bold tracking-tight text-gray-900 md:pr-0">
            {title}
          </h1>

          {/* ── 추천 조건 칩: 고치면 바로 다시 추천 ── */}
          <div className="mb-4">
            <ConditionChips
              conditions={conditions}
              onChange={onConditionsChange}
              regionOptions={regionOptions}
              contentMode={contentMode}
            />
            {notice && (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800" role="status">
                {notice}
              </p>
            )}
          </div>

          {result && onlyUnconfirmed && !showUnconfirmed ? (
            <UnconfirmedGate
              result={result}
              conditions={conditions}
              contentMode={contentMode}
              onShow={() => setUnconfirmedOpenFor(conditionKey)}
              onConditionsChange={onConditionsChange}
            />
          ) : result ? (
            <ResultCards
              result={result}
              conditions={conditions}
              contentMode={contentMode}
              copy={copy}
              onOpenDetail={onOpenDetail}
            />
          ) : (
            <NoResult conditions={conditions} contentMode={contentMode} onConditionsChange={onConditionsChange} />
          )}

        </div>
      </div>

      {/* ── 하단 액션 바: 카드를 덮지 않도록 fixed가 아니라 레이아웃 흐름 안에 둔다 ── */}
      <div className="shrink-0 border-t border-gray-100 bg-white">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <button
            onClick={onRetry}
            className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400"
          >
            {copy.retryLabel}
          </button>
          <button
            onClick={onBrowse}
            className="text-sm text-gray-500 transition-colors hover:text-gray-700"
          >
            {copy.browseLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ResultCards: 1순위 + 보조 추천 + 지도 열기
// ─────────────────────────────────────────────

interface ResultCardsProps {
  result: DecisionResult;
  conditions: IntentConditions;
  contentMode: ContentMode;
  copy: ReturnType<typeof getResultCopy>;
  onOpenDetail: (location: Location) => void;
}

function ResultCards({ result, conditions, contentMode, copy, onOpenDetail }: ResultCardsProps) {
  const { primary, secondary, reasons, afterCafe } = result;
  const [showAlternatives, setShowAlternatives] = useState(false);

  return (
    <>
      {/* ── 1순위 추천 카드 ── */}
      <PrimaryCard
        location={primary}
        reason={reasons.get(primary.id) || ''}
        matches={getConditionMatches(primary, conditions, contentMode)}
        onOpenDetail={onOpenDetail}
      />

      {/* ── 지도 열기 버튼 (1순위 기준): 대안보다 먼저, 카드 바로 아래 ── */}
      <div className="mt-3 flex gap-2">
        <MapButton
          label="네이버 지도"
          onClick={() => openNaver(primary)}
          variant="primary"
        />
        <MapButton
          label="카카오맵"
          onClick={() => openKakao(primary)}
          variant="secondary"
        />
      </div>
      <button
        type="button"
        onClick={() => onOpenDetail(primary)}
        className="mt-2 flex w-full items-center justify-center gap-0.5 py-1 text-xs text-gray-500 transition-colors hover:text-gray-700"
      >
        <span>{primary.name} 자세히 보기</span>
        <ChevronRight size={14} />
      </button>

      {/* ── 보조 추천 (2~3순위): 접어 두고, 펼치면 비교 ── */}
      {secondary.length > 0 && (
        <div className="mt-5 rounded-2xl border border-gray-100">
          <button
            type="button"
            onClick={() => setShowAlternatives(!showAlternatives)}
            aria-expanded={showAlternatives}
            aria-controls="decision-alternatives"
            className="flex w-full items-center gap-2 px-4 py-3 text-left"
          >
            <span className="shrink-0 text-xs font-semibold text-gray-500">
              {copy.secondaryLabel} {secondary.length}곳
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-gray-500">
              {secondary.map((loc) => loc.name).join(' · ')}
            </span>
            <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${showAlternatives ? 'rotate-180' : ''}`} />
          </button>
          {showAlternatives && (
            <div
              id="decision-alternatives"
              ref={(el) => el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}
              className="flex flex-col gap-2 px-3 pb-3"
            >
              {secondary.map((loc) => (
                <SecondaryCard
                  key={loc.id}
                  location={loc}
                  reason={reasons.get(loc.id) || ''}
                  matches={getConditionMatches(loc, conditions, contentMode)}
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 식후 카페: 식사 후보와 섞지 않고 따로 ── */}
      {afterCafe && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium tracking-widest text-gray-500">
            식후 카페
          </p>
          <SecondaryCard
            location={afterCafe}
            reason={getCuratorReason(afterCafe)}
            matches={getConditionMatches(afterCafe, { ...conditions, timeSlot: null }, contentMode)}
            onOpenDetail={onOpenDetail}
          />
        </div>
      )}
    </>
  );
}

function getResultCopy(contentMode: ContentMode) {
  if (contentMode === 'space') {
    return {
      eyebrow: 'PLACE PICK',
      title: '오늘은 이곳.',
      secondaryLabel: '대안',
      retryLabel: '다시 고르기',
      browseLabel: '지도로 보기',
    };
  }

  return {
    eyebrow: 'FOOD PICK',
    title: '오늘은 여기.',
    secondaryLabel: '대안',
    retryLabel: '다시 고르기',
    browseLabel: '지도로 보기',
  };
}

// ─────────────────────────────────────────────
// PrimaryCard: 1순위 추천 카드
// ─────────────────────────────────────────────

interface PrimaryCardProps {
  location: Location;
  /** 운영자 한 줄. 없으면 빈 문자열 */
  reason: string;
  matches: ConditionMatch[];
  onOpenDetail: (location: Location) => void;
}

function PrimaryCard({ location, reason, matches, onOpenDetail }: PrimaryCardProps) {
  const [imageError, setImageError] = useState(false);
  const practicalTags = (location.tags || []).filter(isPracticalInfoTag).slice(0, 3);

  return (
    <button
      type="button"
      aria-label={`${location.name} 상세 보기`}
      // 미확인 후보는 완전 일치 추천과 테두리부터 다르게
      className={`w-full cursor-pointer overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-shadow hover:shadow-md ${
        hasUnknown(matches) ? 'border-amber-300 border-dashed' : 'border-gray-100'
      }`}
      onClick={() => onOpenDetail(location)}
    >
      {/* 이미지: 낮은 화면(700px 이하)에서는 이유·조건 확인·지도 버튼이 먼저 보이도록 숨긴다 */}
      {location.imageUrl && !imageError && (
        <div className="relative h-[min(15vh,13rem)] w-full overflow-hidden bg-gray-50 [@media(max-height:700px)]:hidden">
          <img
            src={getCardImageUrl(location.imageUrl)}
            alt={location.name}
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      )}

      {/* 콘텐츠 */}
      <div className="p-4">
        {/* 장소명 + 가격대 */}
        <div className="mb-1.5 flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-gray-900">
            {location.name}
          </h2>
          <PriceLevelBadge priceLevel={location.price_level} size="sm" />
        </div>

        {/* 방문 상태·추천 강도·조건 확인은 각각 배지로 (지역·종류 문구와 한 줄에 몰아 자르지 않는다) */}
        <div className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-gray-500">
          <VisitStatus location={location} />
          {/* 추천 강도는 운영자가 이유를 적은 곳에만. 이유 없이 배지만 있으면 개인 추천처럼 읽힌다 */}
          {reason && <RecommendBadge location={location} size="xs" />}
          {hasUnknown(matches) && <UnconfirmedBadge />}
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <MapPin size={13} />
            {location.region}
            {location.categoryMain && location.categoryMain !== '전체' && ` · ${location.categoryMain}`}
          </span>
        </div>

        {/* 추천하는 이유: 운영자가 쓴 문장만. 없으면 지어내지 않고 중립 안내만 */}
        {reason ? (
          <div className="mb-3">
            <p className="text-xs font-semibold text-orange-700">
              운영자가 적은 추천 이유
              {getUnvisitedBasisLabel(location) && <span className="ml-1 font-normal text-gray-500">· {getUnvisitedBasisLabel(location)}</span>}
            </p>
            {/* 카드에서는 두 줄까지, 전체 문장은 상세에서 본다 */}
            <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-gray-800" title={reason}>{reason}</p>
          </div>
        ) : (
          <p className="mb-3 text-xs text-gray-500">{NO_REASON_TEXT}</p>
        )}

        {/* 고른 조건 확인 결과: 맞는 점은 한 줄로 이어 쓰고, 확인 안 된 점은 문장으로 따로 */}
        {matches.length > 0 && (
          <div className="mb-2 rounded-xl bg-gray-50 px-3 py-2">
            <ConditionMatchList matches={matches} />
          </div>
        )}

        {/* 방문 정보: 추천 이유가 아니라 찾아갈 때 필요한 정보 */}
        <p className="truncate text-xs text-gray-500">
          <span className="font-semibold">방문 정보</span> · {location.address}
          {practicalTags.length > 0 && ` · ${practicalTags.join(' · ')}`}
        </p>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
// SecondaryCard: 보조 추천 카드
// ─────────────────────────────────────────────

interface SecondaryCardProps {
  location: Location;
  /** 운영자 한 줄. 없으면 빈 문자열 */
  reason: string;
  matches: ConditionMatch[];
  onOpenDetail: (location: Location) => void;
}

function SecondaryCard({ location, reason, matches, onOpenDetail }: SecondaryCardProps) {
  const matched = matches.filter((match) => match.status === 'match').map((match) => match.text);
  const unknown = matches.filter((match) => match.status === 'unknown').map((match) => match.label);

  return (
    <button
      onClick={() => onOpenDetail(location)}
      className="flex w-full items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 text-left transition-shadow hover:shadow-sm"
    >
      {/* 썸네일 */}
      {location.imageUrl && (
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-50">
          <img
            src={getCardImageUrl(location.imageUrl)}
            alt={location.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* 텍스트 */}
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-gray-800">{location.name}</span>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <VisitStatus location={location} />
          {reason && <RecommendBadge location={location} size="xs" />}
          {unknown.length > 0 && <UnconfirmedBadge />}
        </div>
        {/* 운영자 이유가 없으면 아무 문장도 채우지 않는다 (같은 안내를 반복하면 근거처럼 보인다) */}
        {reason && <p className="mt-1 line-clamp-2 text-xs text-gray-700">{reason}</p>}
        {matched.length > 0 && <p className="mt-1 text-xs text-gray-700">일치: {matched.join(' · ')}</p>}
        {unknown.length > 0 && (
          <p className="mt-0.5 text-xs text-amber-800">미확인: {unknown.join(' · ')}</p>
        )}
      </div>
    </button>
  );
}

/** 운영자 이유가 없을 때: 추천처럼 꾸미지 않고 중립으로 알린다 (1순위 카드에만, 반복하지 않는다) */
const NO_REASON_TEXT = '아직 운영자가 추천 이유를 적지 않았어요.';

function hasUnknown(matches: ConditionMatch[]) {
  return matches.some((match) => match.status === 'unknown');
}

function UnconfirmedBadge() {
  return (
    <span className="whitespace-nowrap rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
      일부 조건 미확인
    </span>
  );
}

// ─────────────────────────────────────────────
// VisitStatus: 직접 방문 / 아직 안 가본 후보
// ─────────────────────────────────────────────

/** 방문 상태는 잘리지 않게 줄바꿈 없는 배지로 */
function VisitStatus({ location }: { location: Location }) {
  return isCuratorVisited(location) ? (
    <span className="whitespace-nowrap rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
      {getVisitStatusLabel(location)}
    </span>
  ) : (
    <span className="whitespace-nowrap rounded border border-dashed border-gray-300 px-1.5 py-0.5 text-xs font-medium text-gray-600">
      {getVisitStatusLabel(location)}
    </span>
  );
}

// ─────────────────────────────────────────────
// UnconfirmedGate: 확인된 곳이 없을 때. 미확인 후보를 완전 일치처럼 띄우지 않는다
// ─────────────────────────────────────────────

interface UnconfirmedGateProps {
  result: DecisionResult;
  conditions: IntentConditions;
  contentMode: ContentMode;
  onShow: () => void;
  onConditionsChange: (next: IntentConditions) => void;
}

function UnconfirmedGate({ result, conditions, contentMode, onShow, onConditionsChange }: UnconfirmedGateProps) {
  const shown = [result.primary, ...result.secondary];
  // 보여줄 후보 모두에서 확인되지 않은 조건만 문장으로 (예: '혼자 방문이 편한지는 아직 확인되지 않았어요.')
  const perPlace = shown.map((loc) => getConditionMatches(loc, conditions, contentMode));
  const unknownEverywhere = perPlace[0].filter(
    (match) => match.status === 'unknown' && perPlace.every((list) => list.some((m) => m.label === match.label && m.status === 'unknown')),
  );
  const unknownLabels = new Set(unknownEverywhere.map((match) => match.label));
  const removable = getRemovableConditions(conditions, contentMode).filter((item) => unknownLabels.has(item.label));

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-5">
      <p className="text-sm font-medium leading-relaxed text-gray-800">
        고른 조건은 그대로 두었어요. 아래 내용은 아직 확인되지 않았어요.
      </p>
      {unknownEverywhere.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-gray-700">
          {unknownEverywhere.map((match) => (
            <li key={match.label}>· {match.text}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onShow}
        className="mt-4 w-full rounded-xl border border-amber-300 bg-white py-3 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-50"
      >
        일부 조건 미확인 후보 {shown.length}곳 보기
      </button>
      {removable.length > 0 && (
        <>
          <p className="mt-4 text-center text-xs text-gray-600">확인되지 않은 조건을 빼고 다시 찾을 수도 있어요.</p>
          <RemoveConditionButtons items={removable} onConditionsChange={onConditionsChange} />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// NoResult: 조건을 몰래 바꾸지 않고, 적용한 조건을 보여주며 직접 넓히게 한다
// ─────────────────────────────────────────────

interface NoResultProps {
  conditions: IntentConditions;
  contentMode: ContentMode;
  onConditionsChange: (next: IntentConditions) => void;
}

/** 지금 적용 중인 조건과, 그 조건 하나만 뺀 조건. 사용자가 직접 눌러야만 뺀다 */
function getRemovableConditions(conditions: IntentConditions, contentMode: ContentMode) {
  const labels = getConditionLabels(contentMode);
  const applied: { id: string; label: string; without: IntentConditions }[] = [];
  // (지역 → 누구와 → 시간 → 우선 조건 → 종류 → 이유·상황 순)
  const single = (key: 'region' | 'companion' | 'timeSlot' | 'priority' | 'kind' | 'placeType', label: string) =>
    applied.push({ id: key, label, without: { ...conditions, [key]: null } });
  if (conditions.region) single('region', conditions.region);
  if (conditions.companion) single('companion', labels.companion[conditions.companion]);
  if (conditions.timeSlot) single('timeSlot', labels.timeSlot[conditions.timeSlot]);
  if (conditions.priority) single('priority', labels.priority[conditions.priority]);
  if (conditions.kind && contentMode === 'food') single('kind', KIND_LABEL[conditions.kind]);
  if (conditions.placeType) single('placeType', termLabel(conditions.placeType));
  for (const key of ['reasons', 'situations'] as const) {
    for (const slug of conditions[key]) {
      applied.push({
        id: `${key}-${slug}`,
        label: termLabel(slug),
        without: { ...conditions, [key]: conditions[key].filter((item) => item !== slug) },
      });
    }
  }
  return applied;
}

function RemoveConditionButtons({
  items,
  onConditionsChange,
}: {
  items: ReturnType<typeof getRemovableConditions>;
  onConditionsChange: (next: IntentConditions) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onConditionsChange(item.without)}
          className="whitespace-nowrap rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-orange-300 hover:text-orange-700"
        >
          '{item.label}' 빼고 보기
        </button>
      ))}
    </div>
  );
}

function NoResult({ conditions, contentMode, onConditionsChange }: NoResultProps) {
  const applied = getRemovableConditions(conditions, contentMode);

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-6 text-center">
      <p className="text-sm leading-relaxed text-gray-600">
        {applied.length > 0
          ? `${applied.map((item) => `'${item.label}'`).join(' · ')} 조건을 모두 지키는 곳을 찾지 못했어요.`
          : '추천할 장소를 찾지 못했어요.'}
      </p>
      {applied.length > 0 && (
        <>
          <p className="mt-1 text-xs text-gray-500">조건을 하나 빼면 범위가 넓어져요.</p>
          <RemoveConditionButtons items={applied} onConditionsChange={onConditionsChange} />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ConditionMatchList: 선택 조건별 일치·미확인. 근거가 없으면 지어내지 않고 '확인되지 않았어요'
// ─────────────────────────────────────────────

const STATUS_STYLE: Record<ConditionMatch['status'], { label: string; className: string }> = {
  match: { label: '일치', className: 'bg-emerald-50 text-emerald-700' },
  unknown: { label: '미확인', className: 'bg-amber-50 text-amber-800' },
  mismatch: { label: '불일치', className: 'bg-red-50 text-red-700' },
};

/** 조건마다 상태를 한곳에: 일치는 한 줄로 이어 쓰고, 미확인·불일치는 문장으로 따로 */
function ConditionMatchList({ matches }: { matches: ConditionMatch[] }) {
  const groups = (['match', 'unknown', 'mismatch'] as const)
    .map((status) => ({ status, items: matches.filter((match) => match.status === status) }))
    .filter((group) => group.items.length > 0);
  const usesHours = matches.some((match) => match.evidence === HOURS_SOURCE);

  return (
    <div className="text-xs" aria-label="선택 조건 확인">
      <p className="mb-1 font-semibold text-gray-600">선택 조건 확인</p>
      <ul className="space-y-1">
        {groups.map(({ status, items }) => (
          <li key={status} className="flex items-start gap-2">
            <span className={`mt-px shrink-0 whitespace-nowrap rounded px-1.5 py-px font-semibold ${STATUS_STYLE[status].className}`}>
              {STATUS_STYLE[status].label}
            </span>
            <span className={status === 'match' ? 'text-gray-800' : 'text-amber-900'}>
              {status === 'match'
                ? items.map((match, i) => (
                    <span key={match.label}>
                      {i > 0 && <span className="text-gray-400"> · </span>}
                      {match.text}
                      {match.evidence?.startsWith('#') && <span className="text-gray-500"> {match.evidence}</span>}
                    </span>
                  ))
                : items.map((match) => match.text).join(' ')}
            </span>
          </li>
        ))}
      </ul>
      {usesHours && <p className="mt-1 text-gray-500">영업시간은 카카오맵 정보 기준이에요.</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// MapButton: 지도 열기 버튼
// ─────────────────────────────────────────────

interface MapButtonProps {
  label: string;
  onClick: () => void;
  variant: 'primary' | 'secondary';
}

function MapButton({ label, onClick, variant }: MapButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium transition-colors
        ${variant === 'primary'
          ? 'bg-green-500 text-white hover:bg-green-600'
          : 'bg-amber-400 text-gray-900 hover:bg-amber-500'
        }
      `}
    >
      <Navigation size={15} />
      <span>{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────
// 딥링크 유틸 (기존 PlaceDetail 패턴 재사용)
// ─────────────────────────────────────────────

/**
 * 네이버 지도 열기
 * 모바일: 앱 딥링크 시도 → 700ms 후 웹 fallback
 * PC: 웹 지도 직접 열기
 */
function openNaver(location: Location) {
  const isMobile = window.innerWidth < 768;
  const query = encodeURIComponent(location.name);

  if (isMobile) {
    const appName = encodeURIComponent(window.location.origin);
    const appLink = `nmap://search?query=${query}&appname=${appName}`;
    const webLink = `https://map.naver.com/v5/search/${query}`;

    window.location.href = appLink;
    setTimeout(() => {
      window.location.href = webLink;
    }, 700);
  } else {
    window.open(`https://map.naver.com/v5/search/${query}`, '_blank');
  }
}

/**
 * 카카오맵 열기
 * 모바일: 앱 딥링크 시도 → 700ms 후 웹 fallback
 * PC: 웹 지도 직접 열기
 */
function openKakao(location: Location) {
  const isMobile = window.innerWidth < 768;
  const query = encodeURIComponent(location.name);

  if (isMobile) {
    const appLink = `kakaomap://search?q=${query}`;
    const webLink = `https://map.kakao.com/link/search/${query}`;

    window.location.href = appLink;
    setTimeout(() => {
      window.location.href = webLink;
    }, 700);
  } else {
    window.open(`https://map.kakao.com/link/search/${query}`, '_blank');
  }
}
