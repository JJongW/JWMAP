import { useMemo, useState } from 'react';
import type { Location } from '../types/location';
import type { BrowseViewProps } from '../components/browse/types';

interface UseBrowseViewControllerParams extends BrowseViewProps {
  isMobile: boolean;
}

export function useBrowseViewController(params: UseBrowseViewControllerParams) {
  const {
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
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [detailLocation, setDetailLocation] = useState<Location | null>(null);

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

  const handleLocationSelect = (location: Location) => {
    setSelectedLocation(location);
    if (isMobile) setDetailLocation(location);
  };

  const handleMarkerClick = (location: Location) => {
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
    isMapExpanded,
    setIsMapExpanded,
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
