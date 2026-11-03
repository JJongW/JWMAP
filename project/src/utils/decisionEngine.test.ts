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

  it('지역을 지키고, 우선 조건(조용한 곳) 근거가 없는 곳은 미확인 후보로 뒤에 둔다', () => {
    const result = decideLocations(all, { ...EMPTY_CONDITIONS, region: '종로/중구', priority: 'quiet' })!;
    const names = [result.primary, ...result.secondary].map((l) => l.name);
    expect(result.primary.name).toBe('조용한 밥집');
    expect(result.statuses.get(loudMeal.id)).toBe('unconfirmed');
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
  it('조건마다 일치·미확인과 근거. 시간은 메뉴 분류로 추정하지 않고 영업시간으로만 본다', () => {
    const loc = place({ categoryMain: '양식·퓨전', tags: ['조용한 분위기'], hours_text: '목(10/29) 17:00 ~ 22:00' });
    expect(
      getConditionMatches(loc, { ...EMPTY_CONDITIONS, region: '종로/중구', companion: 'pair', timeSlot: 'dinner', priority: 'quiet' }),
    ).toEqual([
      { title: '지역', label: '종로/중구', status: 'match', text: '종로/중구', evidence: null },
      { title: '동행', label: '둘이', status: 'unknown', text: '둘이 가기 좋은지는 확인되지 않았어요.', evidence: null },
      { title: '영업', label: '저녁', status: 'match', text: '저녁에 열어요', evidence: '카카오맵 영업시간' },
      { title: '우선 조건', label: '조용한 곳', status: 'match', text: '조용한 곳', evidence: '#조용한 분위기' },
    ]);
  });

  it('영업시간이 없으면 밥집이어도 점심은 미확인', () => {
    const loc = place({ categoryMain: '밥' });
    expect(getConditionMatches(loc, { ...EMPTY_CONDITIONS, timeSlot: 'lunch' })[0]).toEqual({
      title: '시간',
      label: '점심',
      status: 'unknown',
      text: '점심 이용 여부는 확인되지 않았어요.',
      evidence: null,
    });
  });
});

describe('볼거리 조건 (둘이 · 가볍게 · 실내 위주)', () => {
  const indoor = place({ name: '실내 전시', categoryMain: '전시/문화' as Location['categoryMain'], tags: ['실내', '데이트'] });
  const outdoor = place({ name: '야외 공원', categoryMain: '자연/공원' as Location['categoryMain'], tags: ['실외', '산책'] });
  const conditions = { ...EMPTY_CONDITIONS, companion: 'pair' as const, timeSlot: 'lunch' as const, priority: 'wait_short' as const };

  it('볼거리 키워드(실내)가 확인된 곳이 먼저, 근거 없는 곳은 미확인 후보', () => {
    const result = decideLocations([indoor, outdoor], conditions, 'space')!;
    expect(result.primary.name).toBe('실내 전시');
    expect(result.statuses.get(outdoor.id)).toBe('unconfirmed');
  });

  it('근거 라벨이 고른 볼거리 라벨과 같다', () => {
    expect(getConditionMatches(indoor, conditions, 'space').map(({ label, status, evidence }) => ({ label, status, evidence }))).toEqual([
      { label: '둘이', status: 'match', evidence: '#데이트' },
      { label: '가볍게', status: 'unknown', evidence: null },
      { label: '실내 위주', status: 'match', evidence: '#실내' },
    ]);
  });

  it('확인된 곳이 없으면 조건을 바꾸지 않고 대표 추천도 없다', () => {
    const result = decideLocations([outdoor], conditions, 'space')!;
    expect(result.confirmedCount).toBe(0);
    expect(result.statuses.get(outdoor.id)).toBe('unconfirmed');
  });
});

describe('조건 일치·불일치·미확인 (용산 · 혼자 · 점심)', () => {
  const region = '용산/이태원/한남';
  const lunchOpen = '목(10/29) 11:30 ~ 21:00 / 금(10/30) 11:30 ~ 21:00';
  // 실제 재현: 혼자 근거가 없는 직접 방문 밥집 (데이트 태그만 있음)
  const ojeje = place({ name: '오제제 신용산점', region, categoryMain: '밥', tags: ['데이트', '웨이팅'], curator_visited: true, rating: 5, hours_text: lunchOpen });
  const soloRamen = place({ name: '혼밥 라멘', region, categoryMain: '면', tags: ['혼밥'], rating: 3, hours_text: lunchOpen });
  const eveningBar = place({ name: '저녁에만 여는 술집', region, categoryMain: '술안주', tags: ['혼밥'], hours_text: '목(10/29) 18:00 ~ 01:00' });
  const soloLunch = { ...EMPTY_CONDITIONS, region, companion: 'solo' as const, timeSlot: 'lunch' as const };

  it('조용한 곳만 빼도 혼자·점심은 그대로이고, 혼자가 확인된 곳이 미확인 곳보다 먼저 나온다', () => {
    const result = decideLocations([ojeje, soloRamen], soloLunch)!;
    expect(result.primary.name).toBe('혼밥 라멘');
    // 혼밥 라멘은 조건이 모두 확인됐지만 운영자 이유가 없어 일반 후보 (대표 추천 아님)
    expect(result.confirmedCount).toBe(0);
    expect(result.generalCount).toBe(1);
    expect(result.secondary.map((l) => l.name)).toEqual(['오제제 신용산점']);
  });

  it('확인된 곳이 없으면 confirmedCount 0 — 화면이 완전 일치처럼 보여주지 않는다', () => {
    const result = decideLocations([ojeje], soloLunch)!;
    expect(result.confirmedCount).toBe(0);
    expect(result.unconfirmedCount).toBe(1);
    expect(getConditionMatches(ojeje, soloLunch).find((m) => m.label === '혼자')).toEqual({
      title: '동행',
      label: '혼자',
      status: 'unknown',
      text: '혼자 방문이 편한지는 확인되지 않았어요.',
      evidence: null,
    });
  });

  it('데이터가 반대를 말하는 곳(점심에 안 여는 곳, 둘이인데 혼밥 가게)은 후보에서 뺀다', () => {
    expect(decideLocations([eveningBar], soloLunch)).toBeNull();
    expect(decideLocations([soloRamen], { ...soloLunch, companion: 'pair' })).toBeNull();
  });

  it('미확인 조건은 점수로 일치 취급하지 않는다: 평점이 높아도 확인된 곳 뒤', () => {
    const result = decideLocations([ojeje, soloRamen], soloLunch)!;
    expect(result.primary.rating).toBeLessThan(ojeje.rating);
  });

  it('영업시간이 없는 곳은 점심이 미확인이라 확인된 곳 뒤에 온다', () => {
    const noHours = place({ name: '시간 모름', region, categoryMain: '밥', tags: ['혼밥'], rating: 5, curator_visited: true });
    const result = decideLocations([noHours, soloRamen], soloLunch)!;
    expect(result.primary.name).toBe('혼밥 라멘');
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

describe('대표 추천의 근거 (운영자 이유 + 조건 확인)', () => {
  const hours = '목(10/29) 11:00 ~ 22:00 / 금(10/30) 11:00 ~ 22:00';
  const noReason = place({ name: '까델루뽀', categoryMain: '양식·퓨전', tags: ['데이트'], curator_visited: true, rating: 5, hours_text: hours });
  const withReason = place({ name: '이유 있는 곳', tags: ['데이트'], curator_visited: true, short_desc: '파스타가 정말 맛있어요', rating: 3, hours_text: hours });
  const pairDinner = { ...EMPTY_CONDITIONS, region: '종로/중구', companion: 'pair' as const, timeSlot: 'dinner' as const };

  it('운영자 이유가 없는 곳은 평점이 높아도 대표 추천이 되지 않는다', () => {
    const result = decideLocations([noReason, withReason], pairDinner)!;
    expect(result.primary.name).toBe('이유 있는 곳');
    expect(result.statuses.get(noReason.id)).toBe('general');
  });

  it('운영자 이유가 있는 곳이 없으면 대표 추천 수가 0이다 (화면이 일반 후보를 확정 추천처럼 보여주지 않는다)', () => {
    const result = decideLocations([noReason], pairDinner)!;
    expect(result.confirmedCount).toBe(0);
    expect(result.generalCount).toBe(1);
  });

  it('직접 가 보지 않은 곳은 이유가 있어도 일반 후보다', () => {
    const unvisited = place({ tags: ['데이트'], curator_visited: false, short_desc: '가보고 싶어요', hours_text: hours });
    expect(decideLocations([unvisited], pairDinner)!.statuses.get(unvisited.id)).toBe('general');
  });
});

describe('우선 조건 근거는 의미가 직접 맞아야 일치', () => {
  const visited = { curator_visited: true, short_desc: '고기국수가 맛있어요' };

  it("'웨이팅 적음'은 '빨리 나오는 곳'의 근거가 아니다", () => {
    const loc = place({ ...visited, tags: ['웨이팅 적음', '혼밥'] });
    const fast = getConditionMatches(loc, { ...EMPTY_CONDITIONS, priority: 'fast_serve' }).find((m) => m.label === '빨리 나오는 곳');
    expect(fast?.status).toBe('unknown');
    expect(fast?.evidence).toBeNull();
    // 줄이 짧다는 조건에는 맞다
    expect(getConditionMatches(loc, { ...EMPTY_CONDITIONS, priority: 'wait_short' })[0].status).toBe('match');
  });

  it("'회전초밥'의 '회전'은 빠른 회전 근거가 아니다", () => {
    const loc = place({ ...visited, tags: ['회전초밥'] });
    expect(getConditionMatches(loc, { ...EMPTY_CONDITIONS, priority: 'fast_serve' })[0].status).toBe('unknown');
  });

  it("'조용한 분위기'는 '분위기 좋은 곳'의 근거가 아니다", () => {
    const quiet = place({ ...visited, tags: ['조용한 분위기', '빈티지분위기'] });
    expect(getConditionMatches(quiet, { ...EMPTY_CONDITIONS, priority: 'date_ok' })[0].status).toBe('unknown');
    const good = place({ ...visited, tags: ['분위기좋은'] });
    expect(getConditionMatches(good, { ...EMPTY_CONDITIONS, priority: 'date_ok' })[0].status).toBe('match');
  });

  it("'분위기 좋은' 태그만으로 둘이 가기 좋다고 하지 않는다", () => {
    const loc = place({ ...visited, tags: ['분위기좋은'] });
    expect(getConditionMatches(loc, { ...EMPTY_CONDITIONS, companion: 'pair' })[0].status).toBe('unknown');
  });

  it('근거 이름이 조건 이름과 다르면 왜 맞는지 덧붙인다', () => {
    const loc = place({ ...visited, categoryMain: '전시/문화' as Location['categoryMain'], tags: ['실내'] });
    const rainy = getConditionMatches(loc, { ...EMPTY_CONDITIONS, situations: ['rainy_day'] }, 'space')[0];
    expect(rainy.status).toBe('match');
    expect(rainy.evidence).toBe('#실내');
    expect(rainy.note).toBe('실내라 비를 피할 수 있어요');
  });
});
