import type { CategoryMain, CategorySub, ContentMode, Location, Province } from '../types/location';
import { getCategoryHierarchyByMode, inferProvinceFromRegion } from '../types/location';

/**
 * categorySub만 있는 레거시 데이터를 포함해 대분류를 안정적으로 계산한다.
 */
export function getMainFromSub(sub: CategorySub, mode: ContentMode = 'food'): CategoryMain | null {
  const hierarchy = getCategoryHierarchyByMode(mode);
  for (const [main, subs] of Object.entries(hierarchy) as [CategoryMain, CategorySub[]][]) {
    if (subs.includes(sub)) return main;
  }
  return null;
}

/**
 * Location에서 province를 우선 사용하고, 없으면 region으로 역추론한다.
 */
export function getLocationProvince(location: Pick<Location, 'province' | 'region'>): Province | null {
  if (location.province) return location.province;
  return inferProvinceFromRegion(location.region);
}

/**
 * 필터링/카운팅에서 일관된 categoryMain 계산을 위해 사용한다.
 */
export function resolveCategoryMain(
  location: Pick<Location, 'categoryMain' | 'categorySub'>,
  mode: ContentMode = 'food'
): CategoryMain | null {
  if (location.categoryMain) return location.categoryMain;
  if (location.categorySub) return getMainFromSub(location.categorySub, mode);
  return null;
}
