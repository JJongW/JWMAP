/**
 * BrowseView.tsx
 *
 * JWMAP의 기본 지도 탐색 화면.
 * 지도와 장소 리스트를 먼저 보여주고, 추천/결정 플로우는 고르기 어려울 때
 * 쓰는 보조 기능으로 제공한다.
 */

import { ChevronDown, ChevronUp, Flame, MapPin, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Map } from './Map';
import { FilterSection } from './FilterSection';
import { PlaceDetail } from './PlaceDetail';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useBrowseViewController } from '../hooks/useBrowseViewController';
import { getDetailImageUrl, getThumbnailUrl } from '../utils/image';
import { getCurationLabel, getCurationBadgeClass, ratingToCurationLevel } from '../utils/curation';
import { PriceLevelBadge } from './PriceLevelBadge';
import { getSavedIds, getVisitedIds, recordActivity, toggleSaved, toggleVisited } from '../utils/activity';
import type { Location } from '../types/location';
import type { BrowseViewProps } from './browse/types';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export function BrowseView({
  contentMode = 'food',
  displayedLocations,
  isCuratedStart = false,
  totalLocationCount,
  hotRegions = [],
  onSelectHotRegion,
  onShowAllPlaces,
  filterState,
  filterControls,
  filterOptions,
  selectedProvince,
  onProvinceChange,
  selectedDistrict,
  onDistrictChange,
  selectedCategoryMain,
  onCategoryMainChange,
  availableCategoryMains,
  getCategoryMainCount,
  selectedCategorySub,
  onCategorySubChange,
  availableCategorySubs,
  getCategorySubCount,
  availableDistricts,
  getProvinceCount,
  getDistrictCount,
  visibleLocations,
  onShowMore,
  onBackToDecision,
  onMapReady,
}: BrowseViewProps) {
  const { isMobile } = useBreakpoint();
  const {
    resolvedSelectedProvince,
    resolvedSelectedDistrict,
    resolvedSelectedCategoryMain,
    resolvedSelectedCategorySub,
    resolvedOnProvinceChange,
    resolvedOnDistrictChange,
    resolvedOnCategoryMainChange,
    resolvedOnCategorySubChange,
    resolvedAvailableCategoryMains,
    resolvedGetCategoryMainCount,
    resolvedAvailableCategorySubs,
    resolvedGetCategorySubCount,
    resolvedAvailableDistricts,
    resolvedGetProvinceCount,
    resolvedGetDistrictCount,
    searchQuery,
    setSearchQuery,
    isFilterExpanded,
    setIsFilterExpanded,
    selectedLocation,
    setSelectedLocation,
    detailLocation,
    setDetailLocation,
    searchFilteredLocations,
    handleLocationSelect,
    handleMarkerClick,
  } = useBrowseViewController({
    displayedLocations,
    filterState,
    filterControls,
    filterOptions,
    selectedProvince,
    onProvinceChange,
    selectedDistrict,
    onDistrictChange,
    selectedCategoryMain,
    onCategoryMainChange,
    availableCategoryMains,
    getCategoryMainCount,
    selectedCategorySub,
    onCategorySubChange,
    availableCategorySubs,
    getCategorySubCount,
    availableDistricts,
    getProvinceCount,
    getDistrictCount,
    visibleLocations,
    onShowMore,
    onBackToDecision,
    onMapReady,
    isMobile,
  });

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(360px,440px)_1fr]">
        <section className="flex min-h-0 flex-col border-r border-gray-100 bg-white">
          <header className="border-b border-gray-100 px-5 pb-4 pt-12 md:px-6 md:pt-16">
            <p className={`text-xs font-semibold ${contentMode === 'space' ? 'text-violet-600' : 'text-orange-500'}`}>
              JWMAP
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
              어디 갈까?
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {contentMode === 'space'
                ? '직접 모아둔 볼거리 후보를 지도에서 가볍게 둘러봐요.'
                : '직접 모아둔 검증 장소를 지도에서 가볍게 둘러봐요.'}
            </p>
          </header>

          <div className="shrink-0 space-y-3 border-b border-gray-100 px-4 py-4 md:px-5">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="장소, 지역, 카테고리 검색"
                className="w-full rounded-xl border border-gray-200 bg-gray-50/70 py-3 pl-9 pr-9 text-sm text-gray-700 placeholder-gray-300 outline-none transition-colors focus:border-gray-300 focus:bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="검색 초기화"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-gray-500"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
              aria-expanded={isFilterExpanded}
              aria-controls="browse-filter-section"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              <span>필터</span>
              {isFilterExpanded
                ? <ChevronUp size={14} />
                : <ChevronDown size={14} />
              }
            </button>

            {isFilterExpanded && (
              <div id="browse-filter-section" className="max-h-[42vh] overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                <FilterSection
                  selectedProvince={resolvedSelectedProvince}
                  onProvinceChange={resolvedOnProvinceChange}
                  getProvinceCount={resolvedGetProvinceCount}
                  selectedDistrict={resolvedSelectedDistrict}
                  onDistrictChange={resolvedOnDistrictChange}
                  availableDistricts={resolvedAvailableDistricts}
                  getDistrictCount={resolvedGetDistrictCount}
                  selectedCategoryMain={resolvedSelectedCategoryMain}
                  onCategoryMainChange={resolvedOnCategoryMainChange}
                  availableCategoryMains={resolvedAvailableCategoryMains}
                  getCategoryMainCount={resolvedGetCategoryMainCount}
                  selectedCategorySub={resolvedSelectedCategorySub}
                  onCategorySubChange={resolvedOnCategorySubChange}
                  availableCategorySubs={resolvedAvailableCategorySubs}
                  getCategorySubCount={resolvedGetCategorySubCount}
                />
              </div>
            )}

            {isCuratedStart && (
              <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-orange-700">
                      <Flame size={14} />
                      요즘 먼저 볼 만한 곳
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-orange-700/70">
                      전체 {totalLocationCount ?? displayedLocations.length}곳 중 반응과 큐레이션이 좋은 후보만 먼저 보여줘요.
                    </p>
                  </div>
                  {onShowAllPlaces && (
                    <button
                      type="button"
                      onClick={onShowAllPlaces}
                      className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-orange-700 shadow-sm"
                    >
                      전체 보기
                    </button>
                  )}
                </div>
                {hotRegions.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {hotRegions.map((region) => (
                      <button
                        key={region}
                        type="button"
                        onClick={() => onSelectHotRegion?.(region)}
                        className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm"
                      >
                        {region}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-32 pt-4 md:px-5 lg:pb-28">
            <p className="mb-3 text-xs font-medium text-gray-400">
              {searchQuery
                ? `검색 결과 ${searchFilteredLocations.length}곳`
                : isCuratedStart
                  ? `핫플레이스 후보 ${searchFilteredLocations.length}곳`
                : `장소 ${searchFilteredLocations.length}곳`
              }
            </p>
            <BrowseList
              locations={searchFilteredLocations}
              visibleCount={visibleLocations}
              onShowMore={onShowMore}
              onSelect={handleLocationSelect}
              selectedId={selectedLocation?.id}
              emptyMessage={
                searchQuery
                  ? `'${searchQuery}'에 맞는 장소가 없어요. 검색어를 바꿔보세요.`
                  : '조건에 맞는 장소가 없어요.'
              }
            />
          </div>
        </section>

        <BrowseMapSection
          locations={searchFilteredLocations}
          selectedLocation={selectedLocation}
          onMarkerClick={handleMarkerClick}
          onMapReady={onMapReady}
        />
      </div>

      <RecommendationBar onBackToDecision={onBackToDecision} />

      {/* ── 모바일 상세 보기 (PlaceDetail 재사용) ── */}
      {detailLocation && isMobile && (
        <PlaceDetail
          location={detailLocation}
          onClose={() => setDetailLocation(null)}
          isMobile={true}
        />
      )}

      {/* ── 데스크톱 상세 보기 (사이드 패널) ── */}
      {selectedLocation && !isMobile && (
        <DesktopDetailPanel
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// BrowseList: 의도적으로 축소된 장소 리스트
// ─────────────────────────────────────────────

/**
 * 기존 LocationList의 "card" variant와 달리:
 * - 이미지 없음
 * - short_desc 없음
 * - tags, event tags 없음
 * - 큐레이터 톤 없음
 *
 * 이유: Browse 경로는 "나열"이지 "추천"이 아니다.
 * 이 제한은 의도적이며, 사용자에게 Decision 경로의 가치를 체감시킨다.
 */

interface BrowseListProps {
  locations: Location[];
  visibleCount: number;
  onShowMore: () => void;
  onSelect: (location: Location) => void;
  selectedId?: string;
  emptyMessage?: string;
}

function BrowseList({
  locations,
  visibleCount,
  onShowMore,
  onSelect,
  selectedId,
  emptyMessage = '조건에 맞는 장소가 없어요.',
}: BrowseListProps) {
  if (locations.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {locations.slice(0, visibleCount).map((location) => (
        <button
          key={location.id}
          onClick={() => onSelect(location)}
          className={`flex w-full items-center gap-3 px-1 py-3 text-left transition-colors ${
            selectedId === location.id
              ? 'bg-gray-50'
              : 'hover:bg-gray-50'
          }`}
        >
          {/* 좌측: 작은 정사각형 썸네일 */}
          <div className="w-10 h-10 shrink-0 rounded-lg bg-gray-100 overflow-hidden">
            {location.imageUrl ? (
              <img
                src={getThumbnailUrl(location.imageUrl)}
                alt={location.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <MapPin size={16} className="text-gray-300" />
              </div>
            )}
          </div>
          {/* 중앙: 이름, 지역, 카테고리 */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-700">
              {location.name}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {location.region}
              {(location.categorySub || location.categoryMain) && (
                <span>
                  {' · '}
                  {location.categorySub || location.categoryMain}
                </span>
              )}
            </p>
          </div>

          {/* 우측: 큐레이션 뱃지 + 가격대 */}
          <div className="ml-3 flex shrink-0 items-center gap-1.5">
            {(() => {
              const level = location.curation_level ?? ratingToCurationLevel(location.rating ?? 0);
              return (
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getCurationBadgeClass(level)}`}>
                  {getCurationLabel(level)}
                </span>
              );
            })()}
            <PriceLevelBadge priceLevel={location.price_level} size="xs" />
          </div>
        </button>
      ))}

      {/* 더 보기 */}
      {visibleCount < locations.length && (
        <div className="py-4 text-center">
          <button
            onClick={onShowMore}
            className="px-4 py-2 text-xs text-gray-400 transition-colors hover:text-gray-600"
          >
            더 보기 ({locations.length - visibleCount}곳)
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// BrowseMapSection: 기본 지도 영역
// ─────────────────────────────────────────────

interface BrowseMapSectionProps {
  locations: Location[];
  selectedLocation: Location | null;
  onMarkerClick: (location: Location) => void;
  onMapReady?: (map: kakao.maps.Map) => void;
}

function BrowseMapSection({
  locations,
  selectedLocation,
  onMarkerClick,
  onMapReady,
}: BrowseMapSectionProps) {
  return (
    <section className="order-first h-[42vh] min-h-[320px] border-b border-gray-100 bg-gray-50 lg:order-last lg:h-full lg:min-h-0 lg:border-b-0">
      <div className="flex h-10 items-center justify-between border-b border-gray-100 bg-white/95 px-4 text-xs font-medium text-gray-500 backdrop-blur">
        <div className="flex items-center gap-1.5">
          <MapPin size={14} />
          <span>지도</span>
        </div>
        <span>{locations.length}곳 표시</span>
      </div>
      <Map
        locations={locations}
        selectedLocation={selectedLocation}
        onMarkerClick={onMarkerClick}
        className="h-[calc(100%-2.5rem)] w-full"
        onMapReady={onMapReady}
      />
    </section>
  );
}

// ─────────────────────────────────────────────
// RecommendationBar: 추천 보조 기능 진입
// ─────────────────────────────────────────────

/**
 * 화면 하단에 고정된 CTA 바.
 * 이것은 광고가 아니라 "안도의 밸브(relief valve)"다.
 * Browse에서 인지 부하를 느낀 사용자가 자연스럽게 Decision으로 돌아가게 한다.
 */

interface RecommendationBarProps {
  onBackToDecision: () => void;
}

function RecommendationBar({ onBackToDecision }: RecommendationBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 pb-6 pt-3 md:pb-4">
        <p className="text-sm text-gray-400">
          고르기 어렵다면
        </p>
        <button
          onClick={onBackToDecision}
          className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 active:scale-[0.98]"
        >
          추천 받아보기
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DesktopDetailPanel: 데스크톱 상세 보기 패널
// ─────────────────────────────────────────────

/**
 * 데스크톱에서는 PlaceDetail의 모바일 전체화면 대신,
 * 간단한 사이드 패널로 기본 정보만 표시한다.
 * Browse 모드에서는 "추천" 톤 없이 중립적으로 표시.
 */

interface DesktopDetailPanelProps {
  location: Location;
  onClose: () => void;
}

function DesktopDetailPanel({ location, onClose }: DesktopDetailPanelProps) {
  const [isSaved, setIsSaved] = useState(() => getSavedIds().includes(location.id));
  const [isVisited, setIsVisited] = useState(() => getVisitedIds().includes(location.id));

  // 네이버 지도 열기 (PC: 새 탭)
  const handleOpenNaver = () => {
    recordActivity('open_naver', location);
    const query = encodeURIComponent(location.name);
    window.open(`https://map.naver.com/v5/search/${query}`, '_blank');
  };

  // 카카오맵 열기 (PC: 새 탭)
  const handleOpenKakao = () => {
    recordActivity('open_kakao', location);
    const query = encodeURIComponent(location.name);
    window.open(`https://map.kakao.com/link/search/${query}`, '_blank');
  };
  const previewText = location.short_desc || location.memo;

  return (
    <div className="fixed right-0 top-0 z-50 h-full w-96 border-l border-gray-100 bg-white shadow-lg">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-700">장소 정보</h2>
        <button
          onClick={onClose}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          닫기
        </button>
      </div>

      {/* 콘텐츠 — 중립적 톤, "추천" 언어 없음 */}
      <div className="overflow-y-auto">
        {/* 장소 이미지 — 상세 보기에서는 사진이 있어야 판단할 수 있다 */}
        {location.imageUrl && (
          <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
            <img
              src={getDetailImageUrl(location.imageUrl)}
              alt={location.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        <div className="p-5">
        <h3 className="text-lg font-bold text-gray-800">{location.name}</h3>

        <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
          <span>{location.region}</span>
          {(location.categorySub || location.categoryMain) && (
            <>
              <span className="text-gray-200">·</span>
              <span>{location.categorySub || location.categoryMain}</span>
            </>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1.5">
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

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setIsSaved(toggleSaved(location))}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              isSaved
                ? 'border-orange-200 bg-orange-50 text-orange-700'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {isSaved ? '가보고 싶음 저장됨' : '가보고 싶음'}
          </button>
          <button
            onClick={() => setIsVisited(toggleVisited(location))}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              isVisited
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {isVisited ? '다녀옴 기록됨' : '다녀왔어요'}
          </button>
        </div>

        <p className="mt-4 text-sm text-gray-500">
          {location.address}
        </p>

        {previewText && (
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            {previewText.length > 140
              ? `${previewText.slice(0, 140)}...`
              : previewText}
          </p>
        )}

        {/* 지도 열기 버튼 — 중립적 스타일 */}
        <div className="mt-6 flex gap-2">
          <button
            onClick={handleOpenNaver}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            네이버 지도
          </button>
          <button
            onClick={handleOpenKakao}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            카카오맵
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
