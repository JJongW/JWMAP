import type { CategoryMain, CategorySub, Province } from './location';

export interface FilterState {
  selectedProvince: Province | '전체';
  selectedDistrict: string | '전체';
  selectedCategoryMain: CategoryMain | '전체';
  selectedCategorySub: CategorySub | '전체';
  selectedEventTag: string | null;
}

export const DEFAULT_FILTER_STATE: FilterState = {
  selectedProvince: '전체',
  selectedDistrict: '전체',
  selectedCategoryMain: '전체',
  selectedCategorySub: '전체',
  selectedEventTag: null,
};
