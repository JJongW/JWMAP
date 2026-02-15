import type { CategoryMain, CategorySub, Location, Province } from '../../types/location';
import type { FilterState } from '../../types/filter';

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
  displayedLocations: Location[];
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
}
