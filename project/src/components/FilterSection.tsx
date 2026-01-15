import { CategoryButton } from './CategoryButton';
import type { Province, CategoryMain, CategorySub } from '../types/location';
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

  // Category filter (대분류)
  selectedCategoryMain: CategoryMain | '전체';
  onCategoryMainChange: (main: CategoryMain | '전체') => void;
  availableCategoryMains: CategoryMain[];
  getCategoryMainCount: (main: CategoryMain | '전체') => number;

  // Category filter (소분류)
  selectedCategorySub: CategorySub | '전체';
  onCategorySubChange: (sub: CategorySub | '전체') => void;
  availableCategorySubs: CategorySub[];
  getCategorySubCount: (sub: CategorySub) => number;

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
  selectedCategoryMain,
  onCategoryMainChange,
  availableCategoryMains,
  getCategoryMainCount,
  selectedCategorySub,
  onCategorySubChange,
  availableCategorySubs,
  getCategorySubCount,
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

        {/* Category Main chips */}
        <div className="flex gap-1.5 flex-shrink-0">
          {availableCategoryMains.slice(0, 6).map(main => (
            <button
              key={main}
              onClick={() => onCategoryMainChange(main)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategoryMain === main
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {main}
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

      {/* Category Main Section */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          종류 (대분류)
        </h2>
        <div className="flex flex-wrap gap-2">
          {availableCategoryMains.map(main => (
            <CategoryButton
              key={main}
              category={main}
              isActive={selectedCategoryMain === main}
              onClick={() => {
                onCategoryMainChange(main);
                onCategorySubChange('전체'); // 대분류 변경 시 소분류 초기화
              }}
              count={getCategoryMainCount(main)}
            />
          ))}
        </div>
      </div>

      {/* Category Sub Section - 대분류 선택 시에만 표시 */}
      {selectedCategoryMain !== '전체' && availableCategorySubs.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {selectedCategoryMain} 세부 종류
          </h2>
          <div className="flex flex-wrap gap-2">
            <CategoryButton
              category={`${selectedCategoryMain} 전체`}
              isActive={selectedCategorySub === '전체'}
              onClick={() => onCategorySubChange('전체')}
              count={getCategoryMainCount(selectedCategoryMain)}
            />
            {availableCategorySubs.map(sub => (
              <CategoryButton
                key={sub}
                category={sub}
                isActive={selectedCategorySub === sub}
                onClick={() => onCategorySubChange(sub)}
                count={getCategorySubCount(sub)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
