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
      { label: '둘이', status: 'unknown', text: '둘이 가기 좋은지는 아직 확인되지 않았어요.', evidence: null },
      { label: '저녁', status: 'match', text: '저녁 식사에 어울리는 양식·퓨전', evidence: null },
      { label: '조용한 곳', status: 'match', text: '조용한 곳', evidence: '#조용한 분위기' },
    ]);
  });
});

describe('볼거리 조건 (둘이 · 가볍게 · 실내 위주)', () => {
  const indoor = place({ name: '실내 전시', categoryMain: '전시/문화' as Location['categoryMain'], tags: ['실내', '데이트'] });
  const outdoor = place({ name: '야외 공원', categoryMain: '자연/공원' as Location['categoryMain'], tags: ['실외', '산책'] });
  const conditions = { ...EMPTY_CONDITIONS, companion: 'pair' as const, timeSlot: 'lunch' as const, priority: 'wait_short' as const };

  it('볼거리 키워드(실내)로 고르고 결과가 나온다', () => {
    const result = decideLocations([indoor, outdoor], conditions, 'space')!;
    expect(result.primary.name).toBe('실내 전시');
    expect(result.secondary.map((l) => l.name)).not.toContain('야외 공원');
  });

  it('근거 라벨이 고른 볼거리 라벨과 같다', () => {
    expect(getConditionMatches(indoor, conditions, 'space').map(({ label, status, evidence }) => ({ label, status, evidence }))).toEqual([
      { label: '둘이', status: 'match', evidence: '#데이트' },
      { label: '가볍게', status: 'unknown', evidence: null },
      { label: '실내 위주', status: 'match', evidence: '#실내' },
    ]);
  });

  it('맞는 곳이 없으면 조건을 바꾸지 않고 null', () => {
    expect(decideLocations([outdoor], conditions, 'space')).toBeNull();
  });
});

describe('조건 일치·불일치·미확인 (용산 · 혼자 · 점심)', () => {
  const region = '용산/이태원/한남';
  // 실제 재현: 혼자 근거가 없는 직접 방문 밥집 (데이트 태그만 있음)
  const ojeje = place({ name: '오제제 신용산점', region, categoryMain: '밥', tags: ['데이트', '웨이팅'], curator_visited: true, rating: 5 });
  const soloRamen = place({ name: '혼밥 라멘', region, categoryMain: '면', tags: ['혼밥'], rating: 3 });
  const bar = place({ name: '점심엔 안 여는 술집', region, categoryMain: '술안주', tags: ['혼밥'] });
  const soloLunch = { ...EMPTY_CONDITIONS, region, companion: 'solo' as const, timeSlot: 'lunch' as const };

  it('조용한 곳만 빼도 혼자·점심은 그대로이고, 혼자가 확인된 곳이 미확인 곳보다 먼저 나온다', () => {
    const result = decideLocations([ojeje, soloRamen], soloLunch)!;
    expect(result.primary.name).toBe('혼밥 라멘');
    expect(result.confirmedCount).toBe(1);
    expect(result.secondary.map((l) => l.name)).toEqual(['오제제 신용산점']);
  });

  it('확인된 곳이 없으면 confirmedCount 0 — 화면이 완전 일치처럼 보여주지 않는다', () => {
    const result = decideLocations([ojeje], soloLunch)!;
    expect(result.confirmedCount).toBe(0);
    expect(result.unconfirmedCount).toBe(1);
    expect(getConditionMatches(ojeje, soloLunch)[0]).toEqual({
      label: '혼자',
      status: 'unknown',
      text: '혼자 방문이 편한지는 아직 확인되지 않았어요.',
      evidence: null,
    });
  });

  it('데이터가 반대를 말하는 곳(점심의 술집, 둘이인데 혼밥 가게)은 후보에서 뺀다', () => {
    expect(decideLocations([bar], soloLunch)).toBeNull();
    expect(decideLocations([soloRamen], { ...soloLunch, companion: 'pair' })).toBeNull();
  });

  it('미확인 조건은 점수로 일치 취급하지 않는다: 평점이 높아도 확인된 곳 뒤', () => {
    const result = decideLocations([ojeje, soloRamen], soloLunch)!;
    expect(result.primary.rating).toBeLessThan(ojeje.rating);
  });
});

describe('추천 신뢰도', () => {
  it('운영자 한 줄이 없으면 이유 문장을 지어내지 않는다', () => {
    const loc = place({ tags: ['조용', '데이트'] });
    const result = decideLocations([loc], { ...EMPTY_CONDITIONS, companion: 'pair', timeSlot: 'dinner' })!;
    expect(result.reasons.get(loc.id)).toBe('');
  });

  it('운영자 한 줄이 있으면 그대로 쓴다', () => {
    const loc = place({ short_desc: '돈카츠가 두꺼운데 부드러워요' });
    expect(decideLocations([loc], EMPTY_CONDITIONS)!.reasons.get(loc.id)).toBe('돈카츠가 두꺼운데 부드러워요');
  });

  it('직접 방문한 곳을 미방문 후보보다 먼저 추천한다', () => {
    const candidate = place({ name: '안 가본 곳', rating: 5, curation_level: 3, curator_visited: false });
    const visited = place({ name: '가본 곳', rating: 3, curator_visited: true });
    expect(decideLocations([candidate, visited], EMPTY_CONDITIONS)!.primary.name).toBe('가본 곳');
  });

  it('식후 카페가 우선 조건을 못 지키면 조건을 빼고 고르지 않는다', () => {
    const quietMeal = place({ tags: ['조용'] });
    const loudCafe = place({ categoryMain: '카페', tags: ['활기'] });
    const result = decideLocations([quietMeal, loudCafe], { ...EMPTY_CONDITIONS, priority: 'quiet' })!;
    expect(result.afterCafe).toBeUndefined();
  });
});
