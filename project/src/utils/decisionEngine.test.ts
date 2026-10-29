import { describe, expect, it } from 'vitest';
import type { Location } from '../types/location';
import { decideLocations } from './decisionEngine';
import { EMPTY_CONDITIONS } from './intentChips';

let seq = 0;
function place(overrides: Partial<Location>): Location {
  seq += 1;
  return {
    id: `p${seq}`,
    name: `장소${seq}`,
    region: '종로/중구',
    category: '',
    categoryMain: '밥',
    lon: 0,
    lat: 0,
    address: '',
    memo: '',
    rating: 3,
    imageUrl: '',
    tags: [],
    ...overrides,
  } as Location;
}

describe('decideLocations', () => {
  const meal = place({ name: '조용한 밥집', tags: ['조용한 분위기', '데이트'] });
  const loudMeal = place({ name: '시끌 고깃집', categoryMain: '고기요리', tags: ['회식'] });
  const cafe = place({ name: '조용한 카페', categoryMain: '카페', tags: ['조용'] });
  const gangnam = place({ name: '강남 밥집', region: '강남', tags: ['조용'] });
  const all = [meal, loudMeal, cafe, gangnam];

  it('빈 조건이어도 추천을 낸다', () => {
    expect(decideLocations(all, EMPTY_CONDITIONS)?.primary).toBeDefined();
  });

  it('지역과 우선 조건(조용한 곳)을 지킨다', () => {
    const result = decideLocations(all, { ...EMPTY_CONDITIONS, region: '종로/중구', priority: 'quiet' });
    const names = [result!.primary, ...result!.secondary].map((l) => l.name);
    expect(names).not.toContain('시끌 고깃집');
    expect(names).not.toContain('강남 밥집');
  });

  it('종류: 밥집이면 카페를 빼고, 카페면 카페만', () => {
    const meals = decideLocations(all, { ...EMPTY_CONDITIONS, kind: 'meal' })!;
    expect([meals.primary, ...meals.secondary].some((l) => l.categoryMain === '카페')).toBe(false);
    const cafes = decideLocations(all, { ...EMPTY_CONDITIONS, kind: 'cafe' })!;
    expect([cafes.primary, ...cafes.secondary].map((l) => l.name)).toEqual(['조용한 카페']);
  });

  it('맞는 곳이 없으면 조건을 무시한 대체 결과 대신 null', () => {
    expect(decideLocations(all, { ...EMPTY_CONDITIONS, region: '강남', kind: 'cafe' })).toBeNull();
  });
});
