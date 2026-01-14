import { CategoryButton } from './CategoryButton';
import type { Province, Category } from '../types/location';
import { PROVINCES } from '../types/location';

interface FilterSectionProps {
  // Province filter
  selectedProvince: Province | '전체';
  onProvinceChange: (province: Province | '전체') => void;
  getProvinceCount: (province: Province | '전체') => number;

  // District filter
  selectedDistrict: string | '전체';
  onDistrictChange: (district: string | '전체') => void;
  availableDistricts: string[];
  getDistrictCount: (district: string) => number;

  // Category filter
  selectedCategory: Category | '전체';
  onCategoryChange: (category: Category | '전체') => void;
  categories: (Category | '전체')[];
  getCategoryCount: (category: Category | '전체') => number;

  // Optional: compact mode for mobile overlay
  compact?: boolean;
}

export function FilterSection({
  selectedProvince,
  onProvinceChange,
  getProvinceCount,
  selectedDistrict,
  onDistrictChange,
  availableDistricts,
  getDistrictCount,
  selectedCategory,
  onCategoryChange,
  categories,
  getCategoryCount,
  compact = false,
}: FilterSectionProps) {
  if (compact) {
    // Compact mode: horizontal scrollable chips
    return (
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {/* Province chips */}
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={() => onProvinceChange('전체')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              selectedProvince === '전체'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            전국
          </button>
          {PROVINCES.filter(p => getProvinceCount(p) > 0).map(province => (
            <button
              key={province}
              onClick={() => onProvinceChange(province)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedProvince === province
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {province}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px bg-gray-200 flex-shrink-0" />

        {/* Category chips */}
        <div className="flex gap-1.5 flex-shrink-0">
          {categories.slice(0, 6).map(category => (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Full mode: card sections
  return (
    <div className="space-y-4">
      {/* Province Section */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          지역 (시/도)
        </h2>
        <div className="flex flex-wrap gap-2">
          <CategoryButton
            category="전국"
            isActive={selectedProvince === '전체'}
            onClick={() => onProvinceChange('전체')}
            count={getProvinceCount('전체')}
          />
          {PROVINCES.map(province => {
            const count = getProvinceCount(province);
            if (count === 0) return null;
            return (
              <CategoryButton
                key={province}
                category={province}
                isActive={selectedProvince === province}
                onClick={() => onProvinceChange(province)}
                count={count}
              />
            );
          })}
        </div>
      </div>

      {/* District Section - Province 선택 시에만 표시 */}
      {selectedProvince !== '전체' && availableDistricts.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {selectedProvince} 세부 지역
          </h2>
          <div className="flex flex-wrap gap-2">
            <CategoryButton
              category={`${selectedProvince} 전체`}
              isActive={selectedDistrict === '전체'}
              onClick={() => onDistrictChange('전체')}
              count={getProvinceCount(selectedProvince)}
            />
            {availableDistricts.map(district => (
              <CategoryButton
                key={district}
                category={district}
                isActive={selectedDistrict === district}
                onClick={() => onDistrictChange(district)}
                count={getDistrictCount(district)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Category Section */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          종류
        </h2>
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <CategoryButton
              key={category}
              category={category}
              isActive={selectedCategory === category}
              onClick={() => onCategoryChange(category)}
              count={getCategoryCount(category)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
