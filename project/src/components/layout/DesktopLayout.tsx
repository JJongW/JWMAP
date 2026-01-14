import { Plus } from 'lucide-react';
import { Map } from '../Map';
import { TopSearchBar } from '../TopSearchBar';
import { FilterSection } from '../FilterSection';
import { LocationList } from '../LocationList';
import { PlacePreview } from '../PlacePreview';
import { Sidebar } from './Sidebar';
import type { Location, Province, Category } from '../../types/location';

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
}: DesktopLayoutProps) {
  // Handle location select
  const handleLocationSelect = (location: Location) => {
    onSelectLocation(location);
    onPreviewLocation(location);
  };

  // Handle back from preview
  const handleBackFromPreview = () => {
    onPreviewLocation(null);
  };

  return (
    <div className="fixed inset-0">
      {/* Full Screen Map Background */}
      <Map
        locations={displayedLocations}
        selectedLocation={selectedLocation}
        highlightedLocationId={hoveredLocationId}
        onMarkerClick={(location) => {
          onSelectLocation(location);
          onPreviewLocation(location);
        }}
        className="w-full h-full"
      />

      {/* Left Sidebar */}
      <Sidebar width="w-[420px]">
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center overflow-hidden">
                <img
                  src="/logo.svg"
                  alt="오늘 오디가?"
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="text-xl font-bold text-gray-900">오늘 오디가?</h1>
            </div>
            <button
              onClick={onOpenAddModal}
              className="px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              추가
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {previewLocation ? (
            /* Preview Mode */
            <PlacePreview
              location={previewLocation}
              onBack={handleBackFromPreview}
              onOpenDetail={() => onOpenDetail(previewLocation)}
              className="h-full"
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
    </div>
  );
}
