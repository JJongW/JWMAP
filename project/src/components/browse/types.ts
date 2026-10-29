import type { CategoryMain, CategorySub, ContentMode, Location, Province } from '../../types/location';
import type { FilterState } from '../../types/filter';
import type { IntentConditions } from '../../utils/intentChips';

export type SavedView = 'saved' | 'visited' | 'revisit';

export interface BrowseFilterControls {
  onProvinceChange: (province: Province | '전체') => void;
  onDistrictChange: (district: string | '전체') => void;
  onCategoryMainChange: (main: CategoryMain | '전체') => void;
  onCategorySubChange: (sub: CategorySub | '전체') => void;
}

export interface BrowseFilterOptions {
  availableCategoryMains: CategoryMain[];
  getCategoryMainCount: (main: CategoryMain | '전체') => number;
  availableCategorySubs: CategorySub[];
  getCategorySubCount: (sub: CategorySub) => number;
  availableDistricts: string[];
  getProvinceCount: (province: Province | '전체') => number;
  getDistrictCount: (district: string) => number;
}

export interface BrowseViewProps {
  contentMode?: ContentMode;
  onContentModeChange?: (mode: ContentMode) => void;
  displayedLocations: Location[];
  /** 검색 대상: 현재 지역·카테고리 필터만 적용한 전체 장소. 없으면 displayedLocations에서 찾는다 */
  searchableLocations?: Location[];
  isCuratedStart?: boolean;
  totalLocationCount?: number;
  savedOnly?: boolean;
  savedView?: SavedView;
  savedCount?: number;
  visitedCount?: number;
  revisitCount?: number;
  myPlaceCount?: number;
  onSavedOnlyChange?: (enabled: boolean) => void;
  onSavedViewChange?: (view: SavedView) => void;
  onSavedStateChange?: () => void;
  onClearPlaceState?: () => boolean | Promise<boolean>;
  hotRegions?: string[];
  onSelectHotRegion?: (region: string) => void;
  onShowAllPlaces?: () => void;
  onResetFilters?: () => void;
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
  visibleLocations: number;
  onShowMore: () => void;
  onBackToDecision: () => void;
  onMapReady?: (map: kakao.maps.Map) => void;
  /** "오늘 어디 갈까요?" 입력·빠른 시작 */
  regionOptions?: string[];
  onRecommendText?: (text: string) => Promise<void> | void;
  onQuickStart?: (partial: Partial<IntentConditions>) => void;
}
