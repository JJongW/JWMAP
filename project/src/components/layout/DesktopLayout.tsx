import { Plus } from 'lucide-react';
import { Map } from '../Map';
import { TopSearchBar } from '../TopSearchBar';
import { FilterSection } from '../FilterSection';
import { LocationList } from '../LocationList';
import { SidebarDetail } from '../SidebarDetail';
import { EventTagFilter } from '../EventTagFilter';
import { MyLocationButton } from '../MyLocationButton';
import { Sidebar } from './Sidebar';
import { clickLogApi } from '../../utils/supabase';
import type { Location, Province, CategoryMain, CategorySub } from '../../types/location';

interface DesktopLayoutProps {
  // Data
  locations: Location[];
  displayedLocations: Location[];

  // Selection
  selectedLocation: Location | null;
  onSelectLocation: (location: Location | null) => void;
  previewLocation: Location | null;
  onPreviewLocation: (location: Location | null) => void;
  hoveredLocationId: string | null;
  onHoverLocation: (locationId: string | null) => void;
  onOpenDetail: (location: Location) => void;

  // Search
  isSearchMode: boolean;
  onSearchResults: (places: Location[]) => void;
  onSearchSelect: (placeId: string) => void;
  onSearchReset: () => void;
  currentSearchId?: string | null;
  onSearchIdChange?: (searchId: string | null) => void;

  // Filters
  selectedProvince: Province | '전체';
  onProvinceChange: (province: Province | '전체') => void;
  selectedDistrict: string | '전체';
  onDistrictChange: (district: string | '전체') => void;
  selectedCategoryMain: CategoryMain | '전체';
  onCategoryMainChange: (main: CategoryMain | '전체') => void;
  availableCategoryMains: CategoryMain[];
  getCategoryMainCount: (main: CategoryMain | '전체') => number;
  selectedCategorySub: CategorySub | '전체';
  onCategorySubChange: (sub: CategorySub | '전체') => void;
  availableCategorySubs: CategorySub[];
  getCategorySubCount: (sub: CategorySub) => number;
  availableDistricts: string[];
  getProvinceCount: (province: Province | '전체') => number;
  getDistrictCount: (district: string) => number;

  // Pagination
  visibleLocations: number;
  onShowMore: () => void;

  // Header actions
  onOpenAddModal: () => void;

  // Location actions
  onUpdate?: (updatedLocation: Location) => void;
  onDelete?: (id: string) => void;

  // Event Tag Filter
  availableEventTags: string[];
  selectedEventTag: string | null;
  onEventTagToggle: (tag: string | null) => void;

  // User Location
  userLocation?: { lat: number; lon: number } | null;
  isLoadingLocation?: boolean;
  onGetUserLocation?: () => void;
  onMapReady?: (map: kakao.maps.Map) => void;
}

export function DesktopLayout({
  locations,
  displayedLocations,
  selectedLocation,
  onSelectLocation,
  previewLocation,
  onPreviewLocation,
  hoveredLocationId,
  onHoverLocation,
  onOpenDetail,
  isSearchMode,
  onSearchResults,
  onSearchSelect,
  onSearchReset,
  currentSearchId,
  onSearchIdChange,
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
  onOpenAddModal,
  onUpdate,
  onDelete,
  availableEventTags,
  selectedEventTag,
  onEventTagToggle,
  userLocation,
  isLoadingLocation = false,
  onGetUserLocation,
  onMapReady,
}: DesktopLayoutProps) {
  // Handle location select from list
  const handleLocationSelect = (location: Location) => {
    onSelectLocation(location);
    onPreviewLocation(location);
    // 클릭 로그 기록
    clickLogApi.log({
      location_id: location.id,
      action_type: 'list_click',
      search_id: currentSearchId,
    });
  };

  // Handle marker click
  const handleMarkerClick = (location: Location) => {
    onSelectLocation(location);
    onPreviewLocation(location);
    // 클릭 로그 기록
    clickLogApi.log({
      location_id: location.id,
      action_type: 'marker_click',
      search_id: currentSearchId,
    });
  };

  // Handle back from preview
  const handleBackFromPreview = () => {
    onPreviewLocation(null);
  };

  return (
    <div className="fixed inset-0">
      {/* Left Sidebar - 먼저 렌더링 */}
      <Sidebar width="w-[420px]">
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-base bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-point rounded-xl flex items-center justify-center overflow-hidden">
                <img
                  src="/logo.svg"
                  alt="오늘 오디가?"
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="text-xl font-bold text-accent">오늘 오디가?</h1>
            </div>
            <button
              onClick={onOpenAddModal}
              className="px-4 py-2.5 bg-point text-white text-sm font-medium rounded-xl hover:bg-point-hover transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              추가
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {previewLocation ? (
            /* Detail Mode - Full content in sidebar */
            <SidebarDetail
              location={previewLocation}
              onBack={handleBackFromPreview}
              searchId={currentSearchId}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ) : (
            /* List Mode */
            <div className="p-4 space-y-4">
              {/* Search */}
              <TopSearchBar
                onResults={onSearchResults}
                onSelect={onSearchSelect}
                onReset={onSearchReset}
                isSearchMode={isSearchMode}
                onSearchIdChange={onSearchIdChange}
              />

              {/* Event Tag Filter */}
              {!isSearchMode && (
                <EventTagFilter
                  availableEventTags={availableEventTags}
                  selectedEventTag={selectedEventTag}
                  onEventTagToggle={onEventTagToggle}
                />
              )}

              {/* Filters */}
              <FilterSection
                selectedProvince={selectedProvince}
                onProvinceChange={onProvinceChange}
                getProvinceCount={getProvinceCount}
                selectedDistrict={selectedDistrict}
                onDistrictChange={onDistrictChange}
                availableDistricts={availableDistricts}
                getDistrictCount={getDistrictCount}
                selectedCategoryMain={selectedCategoryMain}
                onCategoryMainChange={onCategoryMainChange}
                availableCategoryMains={availableCategoryMains}
                getCategoryMainCount={getCategoryMainCount}
                selectedCategorySub={selectedCategorySub}
                onCategorySubChange={onCategorySubChange}
                availableCategorySubs={availableCategorySubs}
                getCategorySubCount={getCategorySubCount}
              />

              {/* Location List */}
              <LocationList
                locations={displayedLocations}
                visibleCount={visibleLocations}
                onShowMore={onShowMore}
                onSelect={handleLocationSelect}
                onHover={onHoverLocation}
                selectedId={selectedLocation?.id}
                hoveredId={hoveredLocationId || undefined}
                variant="compact"
                isSearchMode={isSearchMode}
              />
            </div>
          )}
        </div>
      </Sidebar>

      {/* Full Screen Map Background - 사이드바 옆에 위치 */}
      <div className="absolute top-0 right-0 bottom-0" style={{ zIndex: 0, left: '420px' }}>
        <Map
          locations={displayedLocations}
          selectedLocation={selectedLocation}
          highlightedLocationId={hoveredLocationId}
          onMarkerClick={handleMarkerClick}
          className="w-full h-full"
          userLocation={userLocation}
          onMapReady={onMapReady}
        />
        {/* 내 위치 버튼 - 지도 오버레이 (우측 하단) */}
        {onGetUserLocation && (
          <MyLocationButton
            isLoading={isLoadingLocation}
            hasLocation={!!userLocation}
            onClick={onGetUserLocation}
            className="bottom-6 right-6"
          />
        )}
      </div>
    </div>
  );
}
