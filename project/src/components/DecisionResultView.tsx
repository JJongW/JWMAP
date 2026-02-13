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
 * 4. "다시 고르기" / "직접 둘러보기" 전환 버튼
 * 
 * 지도/리뷰는 스크롤 아래 "자세히 보기" 이후에만 노출.
 */

import { useState } from 'react';
import { MapPin, ChevronDown, Navigation } from 'lucide-react';
import type { Location, Features } from '../types/location';
import type { DecisionResult } from '../utils/decisionEngine';
import { getDifferentiator } from '../utils/decisionEngine';
import { getCardImageUrl } from '../utils/image';
import { getCurationLabel, getCurationBadgeClass, ratingToCurationLevel, getPriceLevelLabel } from '../utils/curation';

interface DecisionResultViewProps {
  result: DecisionResult;
  /** "다시 고르기" 클릭 시 → decision 모드로 돌아감 */
  onRetry: () => void;
  /** "직접 둘러보기" 클릭 시 → browse 모드 */
  onBrowse: () => void;
  /** 장소 상세 보기 (기존 PlaceDetail 연동) */
  onOpenDetail: (location: Location) => void;
}

// Features 라벨 (기존 PlaceDetail과 동일)
const featureLabels: Record<keyof Features, string> = {
  solo_ok: '혼밥 가능',
  quiet: '조용한',
  wait_short: '웨이팅 짧음',
  date_ok: '데이트 추천',
  group_ok: '단체석',
  parking: '주차 가능',
  pet_friendly: '반려동물',
  reservation: '예약 가능',
  late_night: '심야 영업',
};

export function DecisionResultView({
  result,
  onRetry,
  onBrowse,
  onOpenDetail,
}: DecisionResultViewProps) {
  const { primary, secondary, reasons } = result;
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-lg px-6 pb-32 pt-12 md:pt-20">

          {/* ── 헤드라인 ── */}
          <p className="mb-2 text-sm font-medium tracking-widest text-gray-300">
            PICK
          </p>
          <h1 className="mb-10 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
            오늘은 여기.
          </h1>

          {/* ── 1순위 추천 카드 ── */}
          <PrimaryCard
            location={primary}
            reason={reasons.get(primary.id) || ''}
            onOpenDetail={onOpenDetail}
          />

          {/* ── 보조 추천 (2~3순위) ── */}
          {secondary.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-xs font-medium tracking-widest text-gray-300">
                OTHER OPTIONS
              </p>
              <div className="flex flex-col gap-3">
                {secondary.map((loc) => (
                  <SecondaryCard
                    key={loc.id}
                    location={loc}
                    differentiator={getDifferentiator(loc, primary)}
                    onOpenDetail={onOpenDetail}
                  />
                ))}
              </div>
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

          {/* ── 자세히 보기 접기/펼치기 ── */}
          <div className="mt-10 border-t border-gray-100 pt-6">
            <button
              onClick={() => setShowMore(!showMore)}
              className="flex w-full items-center justify-center gap-1 text-sm text-gray-400 transition-colors hover:text-gray-600"
            >
              <span>{showMore ? '접기' : '자세히 보기'}</span>
              <ChevronDown
                size={16}
                className={`transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`}
              />
            </button>

            {showMore && (
              <div className="mt-6">
                <DetailPreview location={primary} onOpenDetail={onOpenDetail} />
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── 하단 액션 바 ── */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-6 pb-8 pt-4 md:pb-6">
          <button
            onClick={onRetry}
            className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400"
          >
            다시 고르기
          </button>
          <button
            onClick={onBrowse}
            className="text-sm text-gray-400 transition-colors hover:text-gray-600"
          >
            직접 둘러보기
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PrimaryCard: 1순위 추천 카드
// ─────────────────────────────────────────────

interface PrimaryCardProps {
  location: Location;
  reason: string;
  onOpenDetail: (location: Location) => void;
}

function PrimaryCard({ location, reason, onOpenDetail }: PrimaryCardProps) {
  const [imageError, setImageError] = useState(false);

  // 활성 features 추출 (최대 3개)
  const activeFeatures = location.features
    ? Object.entries(location.features)
        .filter(([, value]) => value)
        .map(([key]) => featureLabels[key as keyof Features])
        .filter(Boolean)
        .slice(0, 3)
    : [];

  return (
    <div
      className="cursor-pointer overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
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
            {getPriceLevelLabel(location.price_level) && (
              <span className="px-2.5 py-1 text-sm font-medium rounded-lg bg-emerald-50 text-emerald-700">
                {getPriceLevelLabel(location.price_level)}
              </span>
            )}
          </div>
        </div>

        {/* 지역 */}
        <div className="mb-3 flex items-center gap-1 text-sm text-gray-400">
          <MapPin size={13} />
          <span>{location.region}</span>
          {location.categoryMain && location.categoryMain !== '전체' && (
            <>
              <span className="text-gray-200">·</span>
              <span>{location.categoryMain}</span>
            </>
          )}
        </div>

        {/* 이유 텍스트 */}
        <p className="mb-4 text-sm leading-relaxed text-gray-600">
          {reason}
        </p>

        {/* Feature 태그 */}
        {activeFeatures.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeFeatures.map((label) => (
              <span
                key={label}
                className="rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-500"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SecondaryCard: 보조 추천 카드
// ─────────────────────────────────────────────

interface SecondaryCardProps {
  location: Location;
  differentiator: string;
  onOpenDetail: (location: Location) => void;
}

function SecondaryCard({ location, differentiator, onOpenDetail }: SecondaryCardProps) {
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
      </div>
    </button>
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
// DetailPreview: 자세히 보기 (접힌 영역)
// ─────────────────────────────────────────────

interface DetailPreviewProps {
  location: Location;
  onOpenDetail: (location: Location) => void;
}

function DetailPreview({ location, onOpenDetail }: DetailPreviewProps) {
  return (
    <div className="space-y-4">
      {/* 주소 */}
      <div className="flex items-start gap-2 text-sm text-gray-500">
        <MapPin size={14} className="mt-0.5 shrink-0" />
        <span>{location.address}</span>
      </div>

      {/* 메모 (짧게) */}
      {location.memo && (
        <p className="text-sm leading-relaxed text-gray-600">
          {location.memo.length > 150
            ? `${location.memo.slice(0, 150)}...`
            : location.memo}
        </p>
      )}

      {/* 전체 상세 보기 버튼 */}
      <button
        onClick={() => onOpenDetail(location)}
        className="w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400"
      >
        전체 정보 보기
      </button>
    </div>
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
