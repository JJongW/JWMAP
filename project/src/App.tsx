import { useState, useEffect, useRef } from 'react';
import { MobileLayout } from './components/layout/MobileLayout';
import { DesktopLayout } from './components/layout/DesktopLayout';
import { AddLocationModal } from './components/AddLocationModal';
import { PlaceDetail } from './components/PlaceDetail';
import { Footer } from './components/Footer';
import type { Category, Location, Features, Province } from './types/location';
import { REGION_HIERARCHY, inferProvinceFromRegion } from './types/location';
import type { UiMode, BottomSheetState, SheetMode } from './types/ui';
import { useBreakpoint } from './hooks/useBreakpoint';
import { locationApi } from './utils/supabase';
import { SpeedInsights } from "@vercel/speed-insights/react";

export default function App() {
  const { isMobile, isDesktop } = useBreakpoint();

  // Data state
  const [locations, setLocations] = useState<Location[]>([]);

  // Filter state
  const [selectedProvince, setSelectedProvince] = useState<Province | '전체'>('전체');
  const [selectedDistrict, setSelectedDistrict] = useState<string | '전체'>('전체');
  const [selectedCategory, setSelectedCategory] = useState<Category | '전체'>('전체');
  const [selectedEventTag, setSelectedEventTag] = useState<string | null>(null);

  // Selection state
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [previewLocation, setPreviewLocation] = useState<Location | null>(null);
  const [detailLocation, setDetailLocation] = useState<Location | null>(null);
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);

  // UI Mode state (mobile)
  const [uiMode, setUiMode] = useState<UiMode>('browse');
  const [bottomSheetState, setBottomSheetState] = useState<BottomSheetState>('half');
  const [sheetMode, setSheetMode] = useState<SheetMode>('list');

  // Search state
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  const preFilteredListRef = useRef<Location[]>([]);

  // Pagination
  const [visibleLocations, setVisibleLocations] = useState<number>(10);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Helper: Get location province
  const getLocationProvince = (location: Location): Province | null => {
    if (location.province) return location.province;
    return inferProvinceFromRegion(location.region);
  };

  // Available districts for selected province
  const availableDistricts: string[] = selectedProvince === '전체'
    ? []
    : (() => {
        const hierarchyDistricts = REGION_HIERARCHY[selectedProvince] || [];
        const dataDistricts = new Set(
          locations
            .filter(l => getLocationProvince(l) === selectedProvince)
            .map(l => l.region)
        );
        return [...new Set([...hierarchyDistricts.filter(d => dataDistricts.has(d)), ...dataDistricts])];
      })();

  // Base locations for category list/count (province + district + event, but NOT category)
  const locationsForCategoryFilter = locations.filter(location => {
    const province = getLocationProvince(location);
    const matchesProvince = selectedProvince === '전체' || province === selectedProvince;
    const matchesDistrict = selectedDistrict === '전체' || location.region === selectedDistrict;
    const matchesEvent = !selectedEventTag ||
      (location.eventTags && location.eventTags.includes(selectedEventTag));
    return matchesProvince && matchesDistrict && matchesEvent;
  });

  // Categories from current filter (only show categories that have locations)
  const categories: (Category | '전체')[] = [
    '전체',
    ...Array.from(new Set(locationsForCategoryFilter.map(l => l.category))),
  ];

  // Filtered locations
  const filteredLocations = locations.filter(location => {
    const province = getLocationProvince(location);
    const matchesProvince = selectedProvince === '전체' || province === selectedProvince;
    const matchesDistrict = selectedDistrict === '전체' || location.region === selectedDistrict;
    const matchesCategory = selectedCategory === '전체' || location.category === selectedCategory;
    const matchesEvent = !selectedEventTag ||
      (location.eventTags && location.eventTags.includes(selectedEventTag));
    return matchesProvince && matchesDistrict && matchesCategory && matchesEvent;
  });

  // Displayed locations (search or filter)
  const displayedLocations = isSearchMode ? searchResults : filteredLocations;

  // Count functions
  const getProvinceCount = (province: Province | '전체'): number => {
    if (province === '전체') return locations.length;
    return locations.filter(l => getLocationProvince(l) === province).length;
  };

  const getDistrictCount = (district: string): number => {
    return locations.filter(l =>
      getLocationProvince(l) === selectedProvince && l.region === district
    ).length;
  };

  const getCategoryCount = (category: Category | '전체'): number => {
    if (category === '전체') return locationsForCategoryFilter.length;
    return locationsForCategoryFilter.filter(l => l.category === category).length;
  };

  // Data fetching
  const fetchLocations = async () => {
    try {
      const data = await locationApi.getAll();
      setLocations(data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  // Add location
  const handleAddLocation = async (newLocation: {
    name: string;
    province?: Province;
    region: string;
    category: string;
    address: string;
    imageUrl: string;
    rating: number;
    lon: number;
    lat: number;
    memo?: string;
    short_desc?: string;
    kakao_place_id?: string;
    features?: Features;
    tags?: string[];
  }) => {
    try {
      const data = await locationApi.create(newLocation as Omit<Location, 'id'>);
      setLocations(prev => [...prev, data]);
      alert('새로운 장소가 추가되었습니다.');
    } catch (error) {
      console.error('Error adding location:', error);
      alert('새로운 장소 추가 중 문제가 발생했습니다.');
    }
  };

  // Search handlers
  const handleSearchResults = (places: Location[]) => {
    if (!isSearchMode) {
      preFilteredListRef.current = filteredLocations;
    }
    setSearchResults(places);
    setIsSearchMode(true);
    setVisibleLocations(10);

    // Auto-switch to explore mode on mobile
    if (isMobile) {
      setUiMode('explore');
      setBottomSheetState('half');
    }
  };

  const handleSearchSelect = (placeId: string) => {
    const place = searchResults.find(p => p.id === placeId);
    if (place) {
      setSelectedLocation(place);
      setPreviewLocation(place);
    }
  };

  const handleSearchReset = () => {
    setIsSearchMode(false);
    setSearchResults([]);
    setCurrentSearchId(null);
    setVisibleLocations(10);
    setSelectedLocation(null);
    setPreviewLocation(null);
  };

  // Filter handlers with reset
  const handleProvinceChange = (province: Province | '전체') => {
    setSelectedProvince(province);
    setSelectedDistrict('전체');
    setSelectedCategory('전체');
    setSelectedEventTag(null);
    setVisibleLocations(10);
  };

  const handleDistrictChange = (district: string | '전체') => {
    setSelectedDistrict(district);
    setSelectedCategory('전체');
    setVisibleLocations(10);
  };

  const handleCategoryChange = (category: Category | '전체') => {
    setSelectedCategory(category);
    setVisibleLocations(10);
  };

  // Pagination
  const handleShowMore = () => {
    setVisibleLocations(prev => prev + 10);
  };

  // Open detail modal
  const handleOpenDetail = (location: Location) => {
    setDetailLocation(location);
  };

  // Load data on mount
  useEffect(() => {
    fetchLocations();
  }, []);

  // Common layout props
  const layoutProps = {
    locations,
    displayedLocations,
    selectedLocation,
    onSelectLocation: setSelectedLocation,
    previewLocation,
    onPreviewLocation: setPreviewLocation,
    onOpenDetail: handleOpenDetail,
    isSearchMode,
    onSearchResults: handleSearchResults,
    onSearchSelect: handleSearchSelect,
    onSearchReset: handleSearchReset,
    currentSearchId,
    onSearchIdChange: setCurrentSearchId,
    selectedProvince,
    onProvinceChange: handleProvinceChange,
    selectedDistrict,
    onDistrictChange: handleDistrictChange,
    selectedCategory,
    onCategoryChange: handleCategoryChange,
    availableDistricts,
    categories,
    getProvinceCount,
    getDistrictCount,
    getCategoryCount,
    visibleLocations,
    onShowMore: handleShowMore,
    onOpenAddModal: () => setIsModalOpen(true),
  };

  return (
    <>
      {/* Main Layout */}
      {isMobile ? (
        <MobileLayout
          {...layoutProps}
          uiMode={uiMode}
          onModeChange={setUiMode}
          bottomSheetState={bottomSheetState}
          onBottomSheetStateChange={setBottomSheetState}
          sheetMode={sheetMode}
          onSheetModeChange={setSheetMode}
        />
      ) : (
        <DesktopLayout
          {...layoutProps}
          hoveredLocationId={hoveredLocationId}
          onHoverLocation={setHoveredLocationId}
        />
      )}

      {/* Footer - Only show in browse mode on mobile, always on desktop */}
      {(!isMobile || (isMobile && uiMode === 'browse')) && (
        <Footer />
      )}

      {/* Add Location Modal */}
      {isModalOpen && (
        <AddLocationModal
          onClose={() => setIsModalOpen(false)}
          onSave={handleAddLocation}
          existingLocations={locations.map(loc => ({
            id: loc.id,
            name: loc.name,
            address: loc.address,
            kakao_place_id: loc.kakao_place_id,
          }))}
        />
      )}

      {/* Place Detail Modal */}
      {detailLocation && (
        <PlaceDetail
          location={detailLocation}
          onClose={() => setDetailLocation(null)}
          isMobile={isMobile}
        />
      )}

      <SpeedInsights />
    </>
  );
}
