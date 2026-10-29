import { useMemo, useState } from 'react';
import type { Location } from '../types/location';
import type { BrowseViewProps } from '../components/browse/types';
import { recordActivity } from '../utils/activity';
import { searchLocations } from '../utils/placeSearch';

interface UseBrowseViewControllerParams extends BrowseViewProps {
  isMobile: boolean;
}

export function useBrowseViewController(params: UseBrowseViewControllerParams) {
  const {
    displayedLocations,
    searchableLocations,
    savedOnly = false,
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
    isMobile,
  } = params;

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

  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [detailLocation, setDetailLocation] = useState<Location | null>(null);

  // 검색은 '먼저 볼 곳' 몇 곳이 아니라 현재 필터의 전체 장소에서 한다.
  // 저장한 곳 탭에서는 그 목록 안에서만 찾는다.
  const isSearching = searchQuery.trim().length > 0;
  const searchSource = isSearching && !savedOnly
    ? searchableLocations ?? displayedLocations
    : displayedLocations;
  const searchFilteredLocations = useMemo(
    () => searchLocations(searchSource, searchQuery),
    [searchQuery, searchSource]
  );
  const hasActiveFilter =
    resolvedSelectedProvince !== '전체' ||
    resolvedSelectedDistrict !== '전체' ||
    resolvedSelectedCategoryMain !== '전체' ||
    resolvedSelectedCategorySub !== '전체';

  const handleLocationSelect = (location: Location) => {
    recordActivity('list_click', location);
    setSelectedLocation(location);
    if (isMobile) setDetailLocation(location);
  };

  const handleMarkerClick = (location: Location) => {
    recordActivity('marker_click', location);
    setSelectedLocation(location);
    if (isMobile) setDetailLocation(location);
  };

  return {
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
    isSearching,
    searchSourceCount: searchSource.length,
    hasActiveFilter,
    isFilterExpanded,
    setIsFilterExpanded,
    selectedLocation,
    setSelectedLocation,
    detailLocation,
    setDetailLocation,
    searchFilteredLocations,
    handleLocationSelect,
    handleMarkerClick,
  };
}
