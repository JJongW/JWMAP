import { useState, useEffect } from 'react';
import { MapIcon, Plus } from 'lucide-react';
import { Map } from '../Map';
import { TopSearchBar } from '../TopSearchBar';
import { FilterSection } from '../FilterSection';
import { LocationList } from '../LocationList';
import { PlacePreview } from '../PlacePreview';
import { PlaceDetail } from '../PlaceDetail';
import { MobileOverlay } from '../MobileOverlay';
import { BottomSheet } from './BottomSheet';
import { EventTagFilter } from '../EventTagFilter';
import { MyLocationButton } from '../MyLocationButton';
import { clickLogApi, searchLogApi } from '../../utils/supabase';
import type { Location, Province, CategoryMain, CategorySub } from '../../types/location';
import type { UiMode, BottomSheetState, SheetMode } from '../../types/ui';

interface MobileLayoutProps {
  // UI Mode
  uiMode: UiMode;
  onModeChange: (mode: UiMode) => void;

  // Bottom Sheet
  bottomSheetState: BottomSheetState;
  onBottomSheetStateChange: (state: BottomSheetState) => void;

  // Sheet Content
  sheetMode: SheetMode;
  onSheetModeChange: (mode: SheetMode) => void;

  // Data
  locations: Location[];
  displayedLocations: Location[];

  // Selection
  selectedLocation: Location | null;
  onSelectLocation: (location: Location | null) => void;
  previewLocation: Location | null;
  onPreviewLocation: (location: Location | null) => void;
  detailLocation: Location | null;
  onDetailLocationChange: (location: Location | null) => void;
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

export function MobileLayout({
  uiMode,
  onModeChange,
  bottomSheetState,
  onBottomSheetStateChange,
  sheetMode,
  onSheetModeChange,
  locations,
  displayedLocations,
  selectedLocation,
  onSelectLocation,
  previewLocation,
  onPreviewLocation,
  detailLocation,
  onDetailLocationChange,
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
  availableEventTags,
  selectedEventTag,
  onEventTagToggle,
  userLocation,
  isLoadingLocation = false,
  onGetUserLocation,
  onMapReady,
}: MobileLayoutProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [mapReady, setMapReady] = useState(false);

  // Delay map render slightly to prevent initial flicker
  useEffect(() => {
    const timer = setTimeout(() => setMapReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const isBrowse = uiMode === 'browse';
  const isExplore = uiMode === 'explore';

  // Handle search submit
  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      onModeChange('explore');
      onBottomSheetStateChange('half');
    }
  };

  // Handle location select in list
  const handleLocationSelect = (location: Location) => {
    onSelectLocation(location);
    searchLogApi.touchLocationActivity(location.id);
    clickLogApi.log({
      location_id: location.id,
      action_type: 'list_click',
      search_id: currentSearchId,
    });
    if (currentSearchId) {
      const rank = displayedLocations.findIndex((l) => l.id === location.id) + 1;
      if (rank > 0) searchLogApi.updateClick(currentSearchId, location.id, rank);
    }
    if (isExplore) {
      // explore 모드: preview sheet 표시
      onPreviewLocation(location);
      onSheetModeChange('preview');
      onBottomSheetStateChange('half');
    } else {
      // browse 모드: 페이지 형식으로 디테일 뷰 표시
      onOpenDetail(location);
    }
  };

  // Handle marker click
  const handleMarkerClick = (location: Location) => {
    onSelectLocation(location);
    onPreviewLocation(location);
    onSheetModeChange('preview');
    onBottomSheetStateChange('half');
    searchLogApi.touchLocationActivity(location.id);
    clickLogApi.log({
      location_id: location.id,
      action_type: 'marker_click',
      search_id: currentSearchId,
    });
    if (currentSearchId) {
      const rank = displayedLocations.findIndex((l) => l.id === location.id) + 1;
      if (rank > 0) searchLogApi.updateClick(currentSearchId, location.id, rank);
    }
  };

  // Handle back from preview
  const handleBackFromPreview = () => {
    if (isExplore) {
      onSheetModeChange('list');
      onBottomSheetStateChange('half');
    }
    // browse 모드에서는 detailLocation을 사용하므로 별도 처리 불필요
    onPreviewLocation(null);
  };

  // Handle view map button
  const handleViewMap = () => {
    onModeChange('explore');
    onBottomSheetStateChange('half');
    onSheetModeChange('list');
  };

  // Handle view list button
  const handleViewList = () => {
    onModeChange('browse');
    onSheetModeChange('list');
    onPreviewLocation(null);
  };

  // detailLocation이 열려있을 때 또는 explore 모드에서 sheet가 열려있을 때 body scroll 막기
  useEffect(() => {
    // detailLocation이 열려있으면 페이지 형식이므로 body 스크롤 막기
    if (detailLocation) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    
    // explore 모드에서 sheet가 열려있을 때 스크롤 막기
    const isSheetOpen = isExplore && (bottomSheetState === 'half' || bottomSheetState === 'full');
    
    if (isSheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isExplore, bottomSheetState, detailLocation]);

  return (
    <div className="relative min-h-screen">
      {/* ===== BROWSE MODE ===== */}
      <div
        className={`min-h-screen bg-white transition-opacity duration-200 ${
          isBrowse ? 'opacity-100' : 'opacity-0 pointer-events-none fixed inset-0 z-10'
        } ${
          detailLocation ? 'pointer-events-none overflow-hidden' : ''
        }`}
        style={{
          overflow: detailLocation ? 'hidden' : 'auto'
        }}
      >
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-base">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-point rounded-xl flex items-center justify-center overflow-hidden">
                  <img
                    src="/logo.svg"
                    alt="오늘 오디가?"
                    className="w-full h-full object-contain"
                  />
                </div>
                <h1 className="text-lg font-bold text-accent">오늘 오디가?</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleViewMap}
                  className="px-3 py-2 bg-base text-accent text-sm font-medium rounded-xl hover:bg-opacity-80 transition-colors flex items-center gap-1.5"
                >
                  <MapIcon size={16} />
                  지도
                </button>
                <button
                  onClick={onOpenAddModal}
                  className="p-2 bg-point text-white rounded-xl hover:bg-point-hover transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main 
          className="px-4 py-4 space-y-4 pb-20"
          style={{
            position: 'relative',
          }}
        >
          {/* Search Bar */}
          <TopSearchBar
            onResults={(places) => {
              onSearchResults(places);
              onModeChange('explore');
              onBottomSheetStateChange('half');
            }}
            onSelect={onSearchSelect}
            onReset={onSearchReset}
            isSearchMode={isSearchMode}
            onSearchIdChange={onSearchIdChange}
            uiRegion={selectedDistrict !== '전체' ? selectedDistrict : undefined}
            deviceType="mobile"
            uiMode={uiMode}
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
            selectedId={selectedLocation?.id}
            variant="card"
            isSearchMode={isSearchMode}
          />
        </main>
      </div>

      {/* ===== EXPLORE MODE ===== */}
      <div
        className={`fixed inset-0 bg-white transition-opacity duration-200 ${
          isExplore ? 'opacity-100 z-20' : 'opacity-0 pointer-events-none z-0'
        }`}
      >
        {/* Full Screen Map - Only render when ready */}
        {/* 검색 모드일 때도 지도 표시 */}
        {(mapReady && (isExplore || isSearchMode)) && (
          <div className="relative w-full h-full">
            <Map
              locations={displayedLocations}
              selectedLocation={selectedLocation}
              onMarkerClick={handleMarkerClick}
              className="w-full h-full"
              userLocation={userLocation}
              onMapReady={onMapReady}
            />
            {/* 내 위치 버튼 - 지도 오버레이 */}
            {isExplore && onGetUserLocation && (
              <MyLocationButton
                isLoading={isLoadingLocation}
                hasLocation={!!userLocation}
                onClick={onGetUserLocation}
                className="bottom-20 right-4"
              />
            )}
          </div>
        )}

        {/* Top Overlay */}
        {isExplore && (
          <MobileOverlay
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearchSubmit={handleSearchSubmit}
            isSearchMode={isSearchMode}
            onSearchReset={onSearchReset}
            selectedProvince={selectedProvince}
            onProvinceChange={onProvinceChange}
            selectedCategoryMain={selectedCategoryMain}
            onCategoryMainChange={onCategoryMainChange}
            availableCategoryMains={availableCategoryMains}
            getProvinceCount={getProvinceCount}
            onViewList={handleViewList}
          />
        )}

        {/* Bottom Sheet - Explore Mode */}
        {isExplore && (
          <BottomSheet
            state={bottomSheetState}
            onStateChange={onBottomSheetStateChange}
          >
            {sheetMode === 'list' ? (
              <LocationList
                locations={displayedLocations}
                visibleCount={visibleLocations}
                onShowMore={onShowMore}
                onSelect={handleLocationSelect}
                selectedId={selectedLocation?.id}
                variant="compact"
                showHeader={false}
              />
            ) : previewLocation ? (
              <PlacePreview
                location={previewLocation}
                onBack={handleBackFromPreview}
                onOpenDetail={() => onOpenDetail(previewLocation)}
                searchId={currentSearchId}
              />
            ) : null}
          </BottomSheet>
        )}
      </div>

      {/* Mobile Detail View - 페이지 형식 */}
      {detailLocation && (
        <PlaceDetail
          location={detailLocation}
          onClose={() => onDetailLocationChange(null)}
          isMobile={true}
          searchId={currentSearchId}
        />
      )}
    </div>
  );
}
