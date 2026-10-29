import { describe, expect, it } from 'vitest';
import type { Location } from '../types/location';
import { describePlace, findTermEvidence, findTermsInText, TAXONOMY } from './taxonomy';
import { EMPTY_CONDITIONS, inferConditionMode, parseIntentText } from './intentChips';
import { decideLocations, getConditionMatches } from './decisionEngine';
import { classifyNote, isFirstHandMemo } from './curation';

const REGIONS = ['종로/중구', '건대/성수/왕십리'];

function place(overrides: Partial<Location>): Location {
  return {
    id: Math.random().toString(36).slice(2),
    name: '장소',
    region: '종로/중구',
    category: '',
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

describe('자연어 → 장소 종류·추천하는 이유·상황', () => {
  it("'혼자 노트북 하기 좋은 카페'", () => {
    const parsed = parseIntentText('혼자 노트북 하기 좋은 카페', REGIONS);
    expect(parsed).toMatchObject({ companion: 'solo', kind: 'cafe', reasons: ['work'], situations: [] });
    expect(inferConditionMode(parsed)).toBe('food');
  });

  it("'비 오는 날 가기 좋은 전시'는 볼거리에서 찾는다", () => {
    const parsed = parseIntentText('비 오는 날 가기 좋은 전시', REGIONS);
    expect(parsed).toMatchObject({ placeType: 'gallery', situations: ['rainy_day'] });
    expect(inferConditionMode(parsed)).toBe('space');
  });

  it("'전망 보며 산책할 곳'은 이유 두 개", () => {
    const parsed = parseIntentText('전망 보며 산책할 곳', REGIONS);
    expect(parsed.reasons).toEqual(['view', 'walk']);
    expect(inferConditionMode(parsed)).toBe('space');
  });

  it('비슷한 말에 억지로 분류를 붙이지 않는다', () => {
    expect(findTermsInText('볼거리 추천해줘', 'place_type')).toEqual([]);
    expect(findTermsInText('리뷰 좋은 곳', 'reason')).toEqual([]);
    expect(findTermsInText('아이스크림 맛집', 'situation')).toEqual([]);
    expect(findTermsInText('서울숲 카페', 'reason')).toEqual([]);
    expect(parseIntentText('종로에서 둘이 저녁', REGIONS)).toMatchObject({ placeType: null, reasons: [], situations: [] });
  });

  it('slug는 겹치지 않는다', () => {
    const slugs = TAXONOMY.map((term) => term.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('근거 찾기', () => {
  it('운영자 문장 → 등록 분류 → 태그 순으로 출처를 밝힌다', () => {
    const cafe = place({ categoryMain: '카페', categorySub: '카공카페', tags: ['작업하기 좋음'] });
    expect(findTermEvidence(cafe, 'work', '창가 자리가 넓어 노트북 하기 좋아요')).toBe("추천하는 이유에 '노트북'");
    expect(findTermEvidence(cafe, 'work')).toBe('등록 분류: 카공카페');
    expect(findTermEvidence(place({ tags: ['작업하기 좋음'] }), 'work')).toBe('#작업하기 좋음');
    expect(findTermEvidence(place({}), 'work')).toBeNull();
  });

  it('상세 화면에는 근거가 있는 분류만', () => {
    const terms = describePlace(place({ categoryMain: '카페', categorySub: '커피', tags: ['커피 맛집', '반려견동반'] }));
    expect(terms.place_type.map((t) => t.slug)).toEqual(['cafe']);
    expect(terms.reason.map((t) => t.slug)).toEqual(['coffee']);
    expect(terms.situation.map((t) => t.slug)).toEqual(['with_pet']);
  });
});

describe('이유·상황으로 추천', () => {
  const workCafe = place({ name: '작업 카페', categoryMain: '카페', categorySub: '카공카페', curator_visited: true });
  const coffeeCafe = place({ name: '커피 카페', categoryMain: '카페', categorySub: '커피', tags: ['커피 맛집'] });

  it('추천하는 이유가 근거로 확인되는 곳만 고른다', () => {
    const conditions = { ...EMPTY_CONDITIONS, kind: 'cafe' as const, reasons: ['work'] };
    const result = decideLocations([workCafe, coffeeCafe], conditions)!;
    expect([result.primary, ...result.secondary].map((l) => l.name)).toEqual(['작업 카페']);
    expect(getConditionMatches(workCafe, conditions)).toContainEqual({ label: '작업·공부', evidence: '등록 분류: 카공카페' });
  });

  it('이유가 여러 개면 모두 맞아야 하고, 없으면 바꾸지 않고 null', () => {
    expect(decideLocations([workCafe, coffeeCafe], { ...EMPTY_CONDITIONS, reasons: ['work', 'coffee'] })).toBeNull();
  });
});

describe('classifyNote', () => {
  it('원문은 그대로 두고 출처만 나눈다', () => {
    expect(classifyNote('가게 뒤편 주차장 있음\n분위기: 차분한 · 방문 많음')).toBe('auto_generated');
    expect(classifyNote('서울 성동구 아차산로 120')).toBe('address');
    expect(classifyNote('오차즈케가 진짜 맛있음!')).toBe('operator_note');
    expect(classifyNote('  ')).toBe('empty');
    expect(classifyNote('[배치 수집] https://place.map.kakao.com/1')).toBe('auto_generated');
    expect(classifyNote('⏰ 운영시간: 10시~19시')).toBe('auto_generated');
    expect(classifyNote('https://place.map.kakao.com/2064925301')).toBe('auto_generated');
    expect(classifyNote('버터치킨커리를 먹었어요\n- 리뷰: 웨이팅이 길어요')).toBe('auto_generated');
  });

  it("'직접 가본 메모'는 직접 방문한 곳의 운영자 글에만", () => {
    expect(isFirstHandMemo({ curator_visited: true, memo: '튀김이 얇고 바삭했어요' })).toBe(true);
    expect(isFirstHandMemo({ curator_visited: false, memo: '튀김이 얇고 바삭했어요' })).toBe(false);
    expect(isFirstHandMemo({ curator_visited: true, memo: '분위기: 차분한 · 방문 많음' })).toBe(false);
  });
});
