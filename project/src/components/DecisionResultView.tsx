/**
 * DecisionResultView.tsx
 * 
 * 의사결정 결과 화면.
 * "검색 결과"가 아니라 "확신 있는 추천"처럼 보여야 한다.
 * 
 * 구조:
 * 1. Primary Recommendation Card - "오늘은 여기." + 장소명 + 이유
 * 2. Secondary Options (최대 2개) - 차별화 포인트 한 줄씩
 * 3. Action Buttons - 네이버/카카오 지도 열기
 * 4. "다시 고르기" / "지도로 보기" 전환 버튼
 * 
 * 카드 탭과 "자세히 보기"는 모두 같은 장소 상세(PlaceDetail)를 연다.
 */

import { useState } from 'react';
import { MapPin, ChevronRight, Navigation } from 'lucide-react';
import type { ContentMode, Location } from '../types/location';
import type { DecisionResult } from '../utils/decisionEngine';
import { getConditionMatches, getDifferentiator, type ConditionMatch } from '../utils/decisionEngine';
import type { IntentConditions } from '../utils/intentChips';
import { ConditionChips } from './ConditionChips';
import { getCardImageUrl } from '../utils/image';
import {
  getCurationLabel,
  getCurationBadgeClass,
  getCuratorReason,
  getVisitStatusLabel,
  isCuratorVisited,
  isPracticalInfoTag,
  ratingToCurationLevel,
} from '../utils/curation';
import { PriceLevelBadge } from './PriceLevelBadge';

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

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-lg px-6 pb-44 pt-12 md:pb-40 md:pt-20">

          {/* ── 헤드라인 ── */}
          <p className="mb-2 text-sm font-medium tracking-widest text-gray-300">
            {copy.eyebrow}
          </p>
          <h1 className="mb-4 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
            {result ? copy.title : '조건에 맞는 곳이 아직 없어요.'}
          </h1>

          {/* ── 추천 조건 칩: 고치면 바로 다시 추천 ── */}
          <div className="mb-8">
            <ConditionChips
              conditions={conditions}
              onChange={onConditionsChange}
              regionOptions={regionOptions}
              showKind={contentMode === 'food'}
            />
            {notice && (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800" role="status">
                {notice}
              </p>
            )}
          </div>

          {result ? (
            <ResultCards result={result} conditions={conditions} copy={copy} onOpenDetail={onOpenDetail} />
          ) : (
            <p className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-8 text-center text-sm leading-relaxed text-gray-500">
              칩의 ×를 눌러 조건을 하나 빼거나, 다른 값으로 바꿔보세요.
            </p>
          )}

        </div>
      </div>

      {/* ── 하단 액션 바 ── */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-6 pb-8 pt-4 md:pb-6">
          <button
            onClick={onRetry}
            className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400"
          >
            {copy.retryLabel}
          </button>
          <button
            onClick={onBrowse}
            className="text-sm text-gray-400 transition-colors hover:text-gray-600"
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
  copy: ReturnType<typeof getResultCopy>;
  onOpenDetail: (location: Location) => void;
}

function ResultCards({ result, conditions, copy, onOpenDetail }: ResultCardsProps) {
  const { primary, secondary, reasons, afterCafe } = result;
  // 둘이·여럿이일 때 #혼밥 같은 태그는 오해를 부르므로 숨긴다. 주차·포장은 방문 정보에서 본다.
  const hideTag = (tag: string) =>
    isPracticalInfoTag(tag) || (conditions.companion !== 'solo' && /혼밥|혼자/.test(tag));

  return (
    <>
      {/* ── 1순위 추천 카드 ── */}
      <PrimaryCard
        location={primary}
        reason={reasons.get(primary.id) || ''}
        matches={getConditionMatches(primary, conditions)}
        hideTag={hideTag}
        onOpenDetail={onOpenDetail}
      />

      {/* ── 보조 추천 (2~3순위) ── */}
      {secondary.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-xs font-medium tracking-widest text-gray-300">
            {copy.secondaryLabel}
          </p>
          <div className="flex flex-col gap-3">
            {secondary.map((loc) => (
              <SecondaryCard
                key={loc.id}
                location={loc}
                differentiator={getDifferentiator(loc, primary)}
                matches={getConditionMatches(loc, conditions)}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── 식후 카페: 식사 후보와 섞지 않고 따로 ── */}
      {afterCafe && (
        <div className="mt-6">
          <p className="mb-3 text-xs font-medium tracking-widest text-gray-300">
            식후 카페
          </p>
          <SecondaryCard
            location={afterCafe}
            differentiator={getCuratorReason(afterCafe) || `${afterCafe.region}에서 식사 후 들르기 좋은 카페예요`}
            matches={getConditionMatches(afterCafe, { ...conditions, timeSlot: null })}
            onOpenDetail={onOpenDetail}
          />
        </div>
      )}

      {/* ── 지도 열기 버튼 (1순위 기준) ── */}
      <div className="mt-8 flex gap-3">
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

      {/* ── 자세히 보기: 카드 탭과 같은 장소 상세를 연다 ── */}
      <div className="mt-10 border-t border-gray-100 pt-6">
        <button
          type="button"
          onClick={() => onOpenDetail(primary)}
          className="flex w-full items-center justify-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <span>{primary.name} 자세히 보기</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
}

function getResultCopy(contentMode: ContentMode) {
  if (contentMode === 'space') {
    return {
      eyebrow: 'PLACE PICK',
      title: '오늘은 이곳.',
      secondaryLabel: '함께 볼 후보',
      retryLabel: '다시 고르기',
      browseLabel: '지도로 보기',
    };
  }

  return {
    eyebrow: 'FOOD PICK',
    title: '오늘은 여기.',
    secondaryLabel: '함께 먹을 후보',
    retryLabel: '다시 고르기',
    browseLabel: '지도로 보기',
  };
}

// ─────────────────────────────────────────────
// PrimaryCard: 1순위 추천 카드
// ─────────────────────────────────────────────

interface PrimaryCardProps {
  location: Location;
  reason: string;
  matches: ConditionMatch[];
  hideTag: (tag: string) => boolean;
  onOpenDetail: (location: Location) => void;
}

function PrimaryCard({ location, reason, matches, hideTag, onOpenDetail }: PrimaryCardProps) {
  const [imageError, setImageError] = useState(false);

  const activeTags = [...new Set([...(location.tags || []), ...(location.eventTags || [])])]
    .filter((tag) => !hideTag(tag))
    .slice(0, 4);

  return (
    <button
      type="button"
      aria-label={`${location.name} 상세 보기`}
      className="w-full cursor-pointer overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md text-left"
      onClick={() => onOpenDetail(location)}
    >
      {/* 이미지 */}
      {location.imageUrl && !imageError && (
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-50">
          <img
            src={getCardImageUrl(location.imageUrl)}
            alt={location.name}
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      )}

      {/* 콘텐츠 */}
      <div className="p-5">
        {/* 장소명 + 큐레이션 뱃지 + 가격대 */}
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-gray-900">
            {location.name}
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {(() => {
              const level = location.curation_level ?? ratingToCurationLevel(location.rating ?? 0);
              return (
                <span className={`px-2.5 py-1 text-sm font-medium rounded-lg ${getCurationBadgeClass(level)}`}>
                  {getCurationLabel(level)}
                </span>
              );
            })()}
            <PriceLevelBadge priceLevel={location.price_level} size="sm" />
          </div>
        </div>

        {/* 지역 · 방문 상태 */}
        <div className="mb-3 flex flex-wrap items-center gap-1 text-sm text-gray-400">
          <MapPin size={13} />
          <span>{location.region}</span>
          {location.categoryMain && location.categoryMain !== '전체' && (
            <>
              <span className="text-gray-200">·</span>
              <span>{location.categoryMain}</span>
            </>
          )}
          <span className="text-gray-200">·</span>
          <span className={isCuratorVisited(location) ? 'font-semibold text-emerald-600' : ''}>
            {getVisitStatusLabel(location)}
          </span>
        </div>

        {/* 이유 텍스트 */}
        <p className="mb-4 text-sm leading-relaxed text-gray-600">
          {reason}
        </p>

        {/* 고른 조건과 맞는 점 */}
        {matches.length > 0 && (
          <div className="mb-4 rounded-xl bg-gray-50 px-3 py-2.5">
            <p className="mb-1 text-[11px] font-semibold text-gray-400">고른 조건과 맞는 점</p>
            <ConditionMatchList matches={matches} />
          </div>
        )}

        {/* 기본 태그 */}
        {activeTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeTags.map((label) => (
              <span
                key={label}
                className="rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-500"
              >
                #{label}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
// SecondaryCard: 보조 추천 카드
// ─────────────────────────────────────────────

interface SecondaryCardProps {
  location: Location;
  differentiator: string;
  matches: ConditionMatch[];
  onOpenDetail: (location: Location) => void;
}

function SecondaryCard({ location, differentiator, matches, onOpenDetail }: SecondaryCardProps) {
  const matchedLabels = matches.filter((match) => match.evidence).map((match) => match.label);

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
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-800">
            {location.name}
          </span>
          {(() => {
            const level = location.curation_level ?? ratingToCurationLevel(location.rating ?? 0);
            return (
              <span className={`shrink-0 px-1.5 py-0.5 text-xs font-medium rounded ${getCurationBadgeClass(level)}`}>
                {getCurationLabel(level)}
              </span>
            );
          })()}
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          {differentiator}
        </p>
        <p className={`mt-0.5 text-[11px] ${isCuratorVisited(location) ? 'font-semibold text-emerald-600' : 'text-gray-400'}`}>
          {getVisitStatusLabel(location)}
          {matchedLabels.length > 0 && (
            <span className="font-medium text-gray-500"> · {matchedLabels.join(' · ')} 맞음</span>
          )}
        </p>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
// ConditionMatchList: 조건별 근거. 근거가 없으면 지어내지 않고 '확인된 정보 없음'
// ─────────────────────────────────────────────

function ConditionMatchList({ matches }: { matches: ConditionMatch[] }) {
  return (
    <ul className="space-y-0.5 text-xs">
      {matches.map((match) => (
        <li key={match.label} className={match.evidence ? 'text-gray-700' : 'text-gray-400'}>
          <span className="font-semibold">{match.evidence ? '✓' : '·'} {match.label}</span>
          <span> — {match.evidence ?? '확인된 정보 없음'}</span>
        </li>
      ))}
    </ul>
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
