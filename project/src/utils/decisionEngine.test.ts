import { describe, expect, it } from 'vitest';
import type { Location } from '../types/location';
import { decideLocations, getConditionMatches } from './decisionEngine';
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

describe('식사 후보와 식후 카페 분리 (P2)', () => {
  const quietMeal = place({ name: '조용한 양식', categoryMain: '양식·퓨전', tags: ['조용한 분위기', '데이트'] });
  const soloMeal = place({ name: '혼밥 라멘', categoryMain: '면', tags: ['조용', '혼밥'] });
  const quietCafe = place({ name: '조용한 카페', categoryMain: '카페', tags: ['조용'] });
  const dessert = place({ name: '디저트 가게', categoryMain: '디저트', tags: ['조용'] });
  const all = [quietMeal, soloMeal, quietCafe, dessert];
  const pairDinnerQuiet = { ...EMPTY_CONDITIONS, companion: 'pair' as const, timeSlot: 'dinner' as const, priority: 'quiet' as const };

  it('종류를 안 고르면 카페·디저트는 식사 후보에서 빠지고 식후 카페로 따로 나온다', () => {
    const result = decideLocations(all, pairDinnerQuiet)!;
    const mealNames = [result.primary, ...result.secondary].map((l) => l.name);
    expect(mealNames).not.toContain('조용한 카페');
    expect(mealNames).not.toContain('디저트 가게');
    expect(['조용한 카페', '디저트 가게']).toContain(result.afterCafe?.name);
  });

  it('둘이면 혼밥 태그 가게가 1순위로 오지 않는다', () => {
    expect(decideLocations(all, pairDinnerQuiet)!.primary.name).toBe('조용한 양식');
  });

  it('카페를 고르면 식후 카페 칸이 없다', () => {
    expect(decideLocations(all, { ...pairDinnerQuiet, kind: 'cafe' })!.afterCafe).toBeUndefined();
  });
});

describe('getConditionMatches', () => {
  it('조건마다 근거를 붙이고, 근거가 없으면 null로 둔다', () => {
    const loc = place({ categoryMain: '양식·퓨전', tags: ['조용한 분위기'] });
    expect(
      getConditionMatches(loc, { ...EMPTY_CONDITIONS, companion: 'pair', timeSlot: 'dinner', priority: 'quiet' }),
    ).toEqual([
      { label: '둘이', evidence: null },
      { label: '저녁', evidence: '저녁에 잘 맞는 양식·퓨전' },
      { label: '조용한 곳', evidence: '#조용한 분위기' },
    ]);
  });
});
