import type { Location } from '../types/location';

type SearchableFields = Pick<Location, 'name' | 'region' | 'categoryMain' | 'categorySub' | 'address' | 'tags'>;

/** 공백·대소문자 차이를 없애 '히메 카츠'와 '히메카츠'를 같은 검색어로 본다 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

/** 장소명·지역·카테고리·주소·태그에서 검색어를 찾는다. 빈 검색어면 그대로 돌려준다. */
export function searchLocations<T extends SearchableFields>(locations: T[], query: string): T[] {
  const q = normalize(query);
  if (!q) return locations;

  return locations.filter((loc) =>
    [loc.name, loc.region, loc.categoryMain, loc.categorySub, loc.address, ...(loc.tags ?? [])]
      .some((field) => field && normalize(field).includes(q))
  );
}
