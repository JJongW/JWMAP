import { describe, expect, it } from 'vitest';
import type { Place } from './places';
import { getPlaceActivityBucket } from './places';

function makePlace(overrides: Partial<Place>): Place {
  return {
    id: 'p1',
    name: '테스트 장소',
    region: '강남',
    lon: 127.0,
    lat: 37.5,
    address: '서울',
    rating: 4.5,
    ...overrides,
  };
}

describe('getPlaceActivityBucket', () => {
  it('카페 계열을 카페로 분류한다', () => {
    const place = makePlace({ category_main: '카페', category_sub: '커피' });
    expect(getPlaceActivityBucket(place)).toBe('카페');
  });

  it('음식 계열을 맛집으로 분류한다', () => {
    const place = makePlace({ category_main: '면', category_sub: '라멘' });
    expect(getPlaceActivityBucket(place)).toBe('맛집');
  });

  it('맛집/카페가 아니면 볼거리로 분류한다', () => {
    const place = makePlace({ category_main: '전시/문화', category_sub: '전시' });
    expect(getPlaceActivityBucket(place)).toBe('볼거리');
  });
});
