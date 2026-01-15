import { Search, X, List } from 'lucide-react';
import type { Province, CategoryMain } from '../types/location';
import { PROVINCES } from '../types/location';

interface MobileOverlayProps {
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
  isSearchMode: boolean;
  onSearchReset: () => void;

  // Filters
  selectedProvince: Province | '전체';
  onProvinceChange: (province: Province | '전체') => void;
  selectedCategoryMain: CategoryMain | '전체';
  onCategoryMainChange: (main: CategoryMain | '전체') => void;
  availableCategoryMains: CategoryMain[];
  getProvinceCount: (province: Province | '전체') => number;

  // Mode switch
  onViewList: () => void;
}

export function MobileOverlay({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  isSearchMode,
  onSearchReset,
  selectedProvince,
  onProvinceChange,
  selectedCategoryMain,
  onCategoryMainChange,
  availableCategoryMains,
  getProvinceCount,
  onViewList,
}: MobileOverlayProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-30 pointer-events-none">
      {/* Safe area padding */}
      <div
        className="pointer-events-auto"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Search Bar */}
        <div className="px-4 pt-3 pb-2">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSearchSubmit();
              }}
              className="flex items-center gap-2 px-4 py-3"
            >
              <Search size={18} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="어떤 맛집을 찾으세요?"
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
              />
              {isSearchMode && (
                <button
                  type="button"
                  onClick={onSearchReset}
                  className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X size={16} className="text-gray-400" />
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {/* List View Button */}
            <button
              onClick={onViewList}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow border border-gray-100 text-sm font-medium text-gray-700 whitespace-nowrap flex-shrink-0"
            >
              <List size={14} />
              리스트
            </button>

            {/* Province chips */}
            <button
              onClick={() => onProvinceChange('전체')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shadow transition-colors flex-shrink-0 ${
                selectedProvince === '전체'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/95 backdrop-blur-sm text-gray-600 border border-gray-100'
              }`}
            >
              전국
            </button>
            {PROVINCES.filter((p) => getProvinceCount(p) > 0)
              .slice(0, 5)
              .map((province) => (
                <button
                  key={province}
                  onClick={() => onProvinceChange(province)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shadow transition-colors flex-shrink-0 ${
                    selectedProvince === province
                      ? 'bg-orange-500 text-white'
                      : 'bg-white/95 backdrop-blur-sm text-gray-600 border border-gray-100'
                  }`}
                >
                  {province}
                </button>
              ))}

            {/* Divider */}
            <div className="w-px bg-gray-200 flex-shrink-0 my-1" />

            {/* Category Main chips */}
            {availableCategoryMains.slice(0, 4).map((main) => (
              <button
                key={main}
                onClick={() => onCategoryMainChange(main)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shadow transition-colors flex-shrink-0 ${
                  selectedCategoryMain === main
                    ? 'bg-orange-500 text-white'
                    : 'bg-white/95 backdrop-blur-sm text-gray-600 border border-gray-100'
                }`}
              >
                {main}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
