import { useState, useEffect } from 'react';
import { MapIcon, Plus } from 'lucide-react';
import { Map } from '../Map';
import { TopSearchBar } from '../TopSearchBar';
import { FilterSection } from '../FilterSection';
import { LocationList } from '../LocationList';
import { PlacePreview } from '../PlacePreview';
import { MobileOverlay } from '../MobileOverlay';
import { BottomSheet } from './BottomSheet';
import type { Location, Province, Category } from '../../types/location';
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
  onOpenDetail: (location: Location) => void;

  // Search
  isSearchMode: boolean;
  onSearchResults: (places: Location[]) => void;
  onSearchSelect: (placeId: string) => void;
  onSearchReset: () => void;

  // Filters
  selectedProvince: Province | '전체';
  onProvinceChange: (province: Province | '전체') => void;
  selectedDistrict: string | '전체';
  onDistrictChange: (district: string | '전체') => void;
  selectedCategory: Category | '전체';
  onCategoryChange: (category: Category | '전체') => void;
  availableDistricts: string[];
  categories: (Category | '전체')[];
  getProvinceCount: (province: Province | '전체') => number;
  getDistrictCount: (district: string) => number;
  getCategoryCount: (category: Category | '전체') => number;

  // Pagination
  visibleLocations: number;
  onShowMore: () => void;

  // Header actions
  onOpenAddModal: () => void;
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
  onOpenDetail,
  isSearchMode,
  onSearchResults,
  onSearchSelect,
  onSearchReset,
  selectedProvince,
  onProvinceChange,
  selectedDistrict,
  onDistrictChange,
  selectedCategory,
  onCategoryChange,
  availableDistricts,
  categories,
  getProvinceCount,
  getDistrictCount,
  getCategoryCount,
  visibleLocations,
  onShowMore,
  onOpenAddModal,
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
    if (isExplore) {
      onPreviewLocation(location);
      onSheetModeChange('preview');
    } else {
      onOpenDetail(location);
    }
  };

  // Handle back from preview
  const handleBackFromPreview = () => {
    onSheetModeChange('list');
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

  return (
    <div className="relative min-h-screen">
      {/* ===== BROWSE MODE ===== */}
      <div
        className={`min-h-screen bg-gray-50 transition-opacity duration-200 ${
          isBrowse ? 'opacity-100' : 'opacity-0 pointer-events-none fixed inset-0 z-10'
        }`}
      >
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center overflow-hidden">
                  <img
                    src="/logo.svg"
                    alt="오늘 오디가?"
                    className="w-full h-full object-contain"
                  />
                </div>
                <h1 className="text-lg font-bold text-gray-900">오늘 오디가?</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleViewMap}
                  className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-1.5"
                >
                  <MapIcon size={16} />
                  지도
                </button>
                <button
                  onClick={onOpenAddModal}
                  className="p-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-4 py-4 space-y-4 pb-20">
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
          />

          {/* Filters */}
          <FilterSection
            selectedProvince={selectedProvince}
            onProvinceChange={onProvinceChange}
            getProvinceCount={getProvinceCount}
            selectedDistrict={selectedDistrict}
            onDistrictChange={onDistrictChange}
            availableDistricts={availableDistricts}
            getDistrictCount={getDistrictCount}
            selectedCategory={selectedCategory}
            onCategoryChange={onCategoryChange}
            categories={categories}
            getCategoryCount={getCategoryCount}
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
        className={`fixed inset-0 bg-gray-100 transition-opacity duration-200 ${
          isExplore ? 'opacity-100 z-20' : 'opacity-0 pointer-events-none z-0'
        }`}
      >
        {/* Full Screen Map - Only render when ready */}
        {mapReady && (
          <Map
            locations={displayedLocations}
            selectedLocation={selectedLocation}
            onMarkerClick={(location) => {
              onSelectLocation(location);
              onPreviewLocation(location);
              onSheetModeChange('preview');
              onBottomSheetStateChange('half');
            }}
            className="w-full h-full"
          />
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
            selectedCategory={selectedCategory}
            onCategoryChange={onCategoryChange}
            categories={categories}
            getProvinceCount={getProvinceCount}
            onViewList={handleViewList}
          />
        )}

        {/* Bottom Sheet */}
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
              />
            ) : null}
          </BottomSheet>
        )}
      </div>
    </div>
  );
}
