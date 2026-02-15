/**
 * BrowseView.tsx
 *
 * "직접 둘러보기" 탐색 모드. 의도적으로 Decision 경로보다
 * 마찰이 높고, 감성이 차갑고, 정보가 제한적으로 설계되었다.
 *
 * 설계 원칙:
 * - 절대 "추천", "베스트", "인기", "Top" 등의 단어를 사용하지 않는다.
 * - 이미지, short_desc, features, tags는 리스트에서 표시하지 않는다.
 * - 지도는 기본 접힘 상태. 확인용이지 발견용이 아니다.
 * - 필터는 접혀 있고, 여러 단계를 거쳐야 작동한다 (높은 인지 부하).
 * - 화면 하단에 항상 "그냥 정해줄까?" Escape Hatch가 노출된다.
 *
 * 이 파일의 UX가 의도적으로 열등한 것은 버그가 아니다. 제품 전략이다.
 * "결정은 우리가 더 잘한다"를 체감하게 하는 대비(contrast)가 핵심이다.
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, MapPin, Search, X } from 'lucide-react';
import { Map } from './Map';
import { FilterSection } from './FilterSection';
import { PlaceDetail } from './PlaceDetail';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { getDetailImageUrl, getThumbnailUrl } from '../utils/image';
import { getCurationLabel, getCurationBadgeClass, ratingToCurationLevel } from '../utils/curation';
import { PriceLevelBadge } from './PriceLevelBadge';
import type { Location, Province, CategoryMain, CategorySub } from '../types/location';
import type { FilterState } from '../types/filter';

interface BrowseFilterControls {
  onProvinceChange: (province: Province | '전체') => void;
  onDistrictChange: (district: string | '전체') => void;
  onCategoryMainChange: (main: CategoryMain | '전체') => void;
  onCategorySubChange: (sub: CategorySub | '전체') => void;
}

interface BrowseFilterOptions {
  availableCategoryMains: CategoryMain[];
  getCategoryMainCount: (main: CategoryMain | '전체') => number;
  availableCategorySubs: CategorySub[];
  getCategorySubCount: (sub: CategorySub) => number;
  availableDistricts: string[];
  getProvinceCount: (province: Province | '전체') => number;
  getDistrictCount: (district: string) => number;
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface BrowseViewProps {
  // Data
  displayedLocations: Location[];

  // Filters
  filterState?: FilterState;
  filterControls?: BrowseFilterControls;
  filterOptions?: BrowseFilterOptions;
  selectedProvince?: Province | '전체';
  onProvinceChange?: (province: Province | '전체') => void;
  selectedDistrict?: string | '전체';
  onDistrictChange?: (district: string | '전체') => void;
  selectedCategoryMain?: CategoryMain | '전체';
  onCategoryMainChange?: (main: CategoryMain | '전체') => void;
  availableCategoryMains?: CategoryMain[];
  getCategoryMainCount?: (main: CategoryMain | '전체') => number;
  selectedCategorySub?: CategorySub | '전체';
  onCategorySubChange?: (sub: CategorySub | '전체') => void;
  availableCategorySubs?: CategorySub[];
  getCategorySubCount?: (sub: CategorySub) => number;
  availableDistricts?: string[];
  getProvinceCount?: (province: Province | '전체') => number;
  getDistrictCount?: (district: string) => number;

  // Pagination
  visibleLocations: number;
  onShowMore: () => void;

  // Navigation
  onBackToDecision: () => void;

  // Map
  onMapReady?: (map: kakao.maps.Map) => void;
}

export function BrowseView({
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
}: BrowseViewProps) {
  const { isMobile } = useBreakpoint();
  const resolvedSelectedProvince = filterState?.selectedProvince ?? selectedProvince ?? '전체';
  const resolvedSelectedDistrict = filterState?.selectedDistrict ?? selectedDistrict ?? '전체';
  const resolvedSelectedCategoryMain = filterState?.selectedCategoryMain ?? selectedCategoryMain ?? '전체';
  const resolvedSelectedCategorySub = filterState?.selectedCategorySub ?? selectedCategorySub ?? '전체';
  const resolvedOnProvinceChange = filterControls?.onProvinceChange ?? onProvinceChange ?? (() => undefined);
  const resolvedOnDistrictChange = filterControls?.onDistrictChange ?? onDistrictChange ?? (() => undefined);
  const resolvedOnCategoryMainChange = filterControls?.onCategoryMainChange ?? onCategoryMainChange ?? (() => undefined);
  const resolvedOnCategorySubChange = filterControls?.onCategorySubChange ?? onCategorySubChange ?? (() => undefined);
  const resolvedAvailableCategoryMains = filterOptions?.availableCategoryMains ?? availableCategoryMains ?? ['전체'];
  const resolvedGetCategoryMainCount = filterOptions?.getCategoryMainCount ?? getCategoryMainCount ?? (() => 0);
  const resolvedAvailableCategorySubs = filterOptions?.availableCategorySubs ?? availableCategorySubs ?? [];
  const resolvedGetCategorySubCount = filterOptions?.getCategorySubCount ?? getCategorySubCount ?? (() => 0);
  const resolvedAvailableDistricts = filterOptions?.availableDistricts ?? availableDistricts ?? [];
  const resolvedGetProvinceCount = filterOptions?.getProvinceCount ?? getProvinceCount ?? (() => 0);
  const resolvedGetDistrictCount = filterOptions?.getDistrictCount ?? getDistrictCount ?? (() => 0);

  // 검색어 — LLM 없이 이름/지역/카테고리 단순 매칭
  const [searchQuery, setSearchQuery] = useState('');

  // 지도 접힘/펼침 상태 — 기본은 접힘 (발견 도구가 아니라 확인 도구)
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  // 필터 접힘/펼침 — 기본은 접힘 (높은 마찰)
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  // 선택된 장소 (지도 마커 클릭 또는 리스트 클릭)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  // 상세 보기 (모바일)
  const [detailLocation, setDetailLocation] = useState<Location | null>(null);

  /**
   * 검색어 기반 로컬 필터링 (LLM 미사용).
   * 이름, 지역, 카테고리(대분류/소분류)를 부분 일치(includes)로 필터링한다.
   * 검색어가 비어있으면 displayedLocations를 그대로 사용.
   */
  const searchFilteredLocations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return displayedLocations;

    return displayedLocations.filter((loc) => {
      const name = loc.name.toLowerCase();
      const region = loc.region.toLowerCase();
      const catMain = (loc.categoryMain || '').toLowerCase();
      const catSub = (loc.categorySub || '').toLowerCase();
      const address = (loc.address || '').toLowerCase();
      return (
        name.includes(q) ||
        region.includes(q) ||
        catMain.includes(q) ||
        catSub.includes(q) ||
        address.includes(q)
      );
    });
  }, [searchQuery, displayedLocations]);

  /** 리스트/마커 클릭 → 상세 보기 */
  const handleLocationSelect = (location: Location) => {
    setSelectedLocation(location);
    if (isMobile) {
      setDetailLocation(location);
    }
  };

  /** 지도 마커 클릭 */
  const handleMarkerClick = (location: Location) => {
    setSelectedLocation(location);
    if (isMobile) {
      setDetailLocation(location);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      {/* ── 스크롤 가능 메인 영역 ── */}
      <div className="flex-1 overflow-y-auto pb-24">

        {/* ── Header: 차갑고 중립적 ── */}
        <header className="border-b border-gray-100 px-6 pb-4 pt-12 md:pt-16">
          <h1 className="text-lg font-semibold text-gray-600">
            직접 둘러보기
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            조건에 맞는 장소를 보여드릴게요
          </p>
        </header>

        <div className="mx-auto w-full max-w-2xl px-4 py-4 md:px-6">

          {/* ── 검색 (단순 텍스트 매칭, LLM 미사용) ── */}
          <div className="mb-4">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="이름, 지역, 카테고리로 검색"
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pl-9 pr-9 text-sm text-gray-700 placeholder-gray-300 outline-none transition-colors focus:border-gray-300 focus:bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* ── 필터 (접힘 상태 기본, 높은 마찰) ── */}
          <div className="mb-4">
            <button
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-600"
            >
              <span>조건 변경</span>
              {isFilterExpanded
                ? <ChevronUp size={14} />
                : <ChevronDown size={14} />
              }
            </button>

            {isFilterExpanded && (
              <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
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
          </div>

          {/* ── 지도 (접힌 상태 기본) ── */}
          <BrowseMapSection
            isExpanded={isMapExpanded}
            onToggle={() => setIsMapExpanded(!isMapExpanded)}
            locations={searchFilteredLocations}
            selectedLocation={selectedLocation}
            onMarkerClick={handleMarkerClick}
            onMapReady={onMapReady}
          />

          {/* ── 장소 리스트 (최소 정보만) ── */}
          <div className="mt-4">
            <p className="mb-3 text-xs text-gray-400">
              {searchQuery
                ? `검색 결과 ${searchFilteredLocations.length}곳`
                : `등록된 장소 ${searchFilteredLocations.length}곳`
              }
            </p>
            <BrowseList
              locations={searchFilteredLocations}
              visibleCount={visibleLocations}
              onShowMore={onShowMore}
              onSelect={handleLocationSelect}
              selectedId={selectedLocation?.id}
            />
          </div>
        </div>
      </div>

      {/* ── Persistent Escape Hatch (고정 하단 바) ── */}
      {/* 항상 노출. Decision 복귀를 유도하는 "안전 밸브" */}
      <EscapeHatch onBackToDecision={onBackToDecision} />

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
 * - features, tags, event tags 없음
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
}

function BrowseList({
  locations,
  visibleCount,
  onShowMore,
  onSelect,
  selectedId,
}: BrowseListProps) {
  if (locations.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        조건에 맞는 장소가 없습니다.
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
// BrowseMapSection: 접힘 가능한 지도
// ─────────────────────────────────────────────

/**
 * 기본 접힘 상태. "지도 펼치기" 버튼으로 토글.
 * 지도는 확인 도구이지 발견 도구가 아니다.
 * → 강조/selected 스타일 최소화, 마커만 표시.
 */

interface BrowseMapSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  locations: Location[];
  selectedLocation: Location | null;
  onMarkerClick: (location: Location) => void;
  onMapReady?: (map: kakao.maps.Map) => void;
}

function BrowseMapSection({
  isExpanded,
  onToggle,
  locations,
  selectedLocation,
  onMarkerClick,
  onMapReady,
}: BrowseMapSectionProps) {
  return (
    <div className="rounded-xl border border-gray-100">
      {/* 토글 버튼 */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-xs text-gray-500 transition-colors hover:bg-gray-50"
      >
        <div className="flex items-center gap-1.5">
          <MapPin size={14} />
          <span>지도 {isExpanded ? '접기' : '펼치기'}</span>
        </div>
        {isExpanded
          ? <ChevronUp size={14} />
          : <ChevronDown size={14} />
        }
      </button>

      {/* 지도 본체 — 펼쳤을 때만 렌더링 */}
      {isExpanded && (
        <div className="h-64 w-full border-t border-gray-100 md:h-80">
          <Map
            locations={locations}
            selectedLocation={selectedLocation}
            onMarkerClick={onMarkerClick}
            className="h-full w-full"
            onMapReady={onMapReady}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// EscapeHatch: 항상 보이는 Decision 복귀 유도
// ─────────────────────────────────────────────

/**
 * 화면 하단에 고정된 CTA 바.
 * 이것은 광고가 아니라 "안도의 밸브(relief valve)"다.
 * Browse에서 인지 부하를 느낀 사용자가 자연스럽게 Decision으로 돌아가게 한다.
 */

interface EscapeHatchProps {
  onBackToDecision: () => void;
}

function EscapeHatch({ onBackToDecision }: EscapeHatchProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 pb-8 pt-4 md:pb-5">
        <p className="text-sm text-gray-400">
          아직 고민 중이면
        </p>
        <button
          onClick={onBackToDecision}
          className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 active:scale-[0.98]"
        >
          그냥 정해줄까?
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
  // 네이버 지도 열기 (PC: 새 탭)
  const handleOpenNaver = () => {
    const query = encodeURIComponent(location.name);
    window.open(`https://map.naver.com/v5/search/${query}`, '_blank');
  };

  // 카카오맵 열기 (PC: 새 탭)
  const handleOpenKakao = () => {
    const query = encodeURIComponent(location.name);
    window.open(`https://map.kakao.com/link/search/${query}`, '_blank');
  };

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

        <p className="mt-4 text-sm text-gray-500">
          {location.address}
        </p>

        {location.memo && (
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            {location.memo.length > 200
              ? `${location.memo.slice(0, 200)}...`
              : location.memo}
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
