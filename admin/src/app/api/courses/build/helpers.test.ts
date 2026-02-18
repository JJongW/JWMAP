import { describe, it, expect } from 'vitest';
import {
  cleanText,
  clampInt,
  uniqueTags,
  inferTagType,
  isLikelyChain,
  enforceCurationRules,
  pickDomain,
  haversineMeters,
  walkingDistanceMeters,
  buildCourseHash,
  inferCategoryFromText,
  parseJsonChunk,
} from './helpers';

describe('cleanText', () => {
  it('문자열을 trim한다', () => {
    expect(cleanText('  hello  ')).toBe('hello');
  });
  it('문자열이 아니면 빈 문자열을 반환한다', () => {
    expect(cleanText(null)).toBe('');
    expect(cleanText(undefined)).toBe('');
    expect(cleanText(123)).toBe('');
  });
});

describe('clampInt', () => {
  it('범위 내 값을 반올림한다', () => {
    expect(clampInt(3.7, 1, 5)).toBe(4);
  });
  it('최솟값 이하면 최솟값을 반환한다', () => {
    expect(clampInt(-1, 1, 5)).toBe(1);
  });
  it('최댓값 이상이면 최댓값을 반환한다', () => {
    expect(clampInt(10, 1, 5)).toBe(5);
  });
  it('숫자가 아니면 null을 반환한다', () => {
    expect(clampInt('abc', 1, 5)).toBeNull();
    expect(clampInt(NaN, 1, 5)).toBeNull();
  });
});

describe('uniqueTags', () => {
  it('중복을 제거한다', () => {
    expect(uniqueTags(['카페', '카페', '맛집'])).toEqual(['카페', '맛집']);
  });
  it('#을 제거한다', () => {
    expect(uniqueTags(['#카페', '#맛집'])).toEqual(['카페', '맛집']);
  });
  it('1자 이하 태그를 필터링한다', () => {
    expect(uniqueTags(['a', '카페'])).toEqual(['카페']);
  });
  it('20자 초과 태그를 필터링한다', () => {
    expect(uniqueTags(['가'.repeat(21), '카페'])).toEqual(['카페']);
  });
  it('최대 20개까지만 반환한다', () => {
    const tags = Array.from({ length: 25 }, (_, i) => `태그${i}`);
    expect(uniqueTags(tags)).toHaveLength(20);
  });
});

describe('inferTagType', () => {
  it('상황 태그를 인식한다', () => {
    expect(inferTagType('데이트')).toBe('situation');
    expect(inferTagType('카공')).toBe('situation');
  });
  it('계절 태그를 인식한다', () => {
    expect(inferTagType('벚꽃')).toBe('season');
    expect(inferTagType('겨울')).toBe('season');
  });
  it('분위기 태그를 인식한다', () => {
    expect(inferTagType('감성카페')).toBe('mood');
    expect(inferTagType('조용한')).toBe('mood');
  });
  it('기타는 feature를 반환한다', () => {
    expect(inferTagType('주차가능')).toBe('feature');
  });
});

describe('isLikelyChain', () => {
  it('체인 브랜드를 감지한다', () => {
    expect(isLikelyChain('스타벅스 강남점', '')).toBe(true);
    expect(isLikelyChain('맘스터치', '버거')).toBe(true);
  });
  it('체인 키워드를 감지한다', () => {
    expect(isLikelyChain('로컬카페', '체인 아님')).toBe(true);
  });
  it('독립 매장은 false', () => {
    expect(isLikelyChain('연희동 카페', '감성 분위기')).toBe(false);
  });
});

describe('enforceCurationRules', () => {
  it('체인이면 3 이하로 제한', () => {
    const result = enforceCurationRules(
      { curation_level: 5, is_chain: true, waiting_hotspot: false },
      'test', '',
    );
    expect(result).toBeLessThanOrEqual(3);
  });
  it('웨이팅 + 로컬인기면 4 이상', () => {
    const result = enforceCurationRules(
      { curation_level: 2, is_chain: false, waiting_hotspot: true },
      'test', '로컬 핫플',
    );
    expect(result).toBeGreaterThanOrEqual(4);
  });
  it('범위 1~5를 벗어나지 않는다', () => {
    expect(enforceCurationRules(
      { curation_level: 0, is_chain: false, waiting_hotspot: false },
      '', '',
    )).toBeGreaterThanOrEqual(1);
  });
});

describe('pickDomain', () => {
  it('일반 카테고리는 locations', () => {
    expect(pickDomain('카페')).toBe('locations');
    expect(pickDomain(null)).toBe('locations');
  });
  it('어트랙션 카테고리는 attractions', () => {
    expect(pickDomain('전시/문화')).toBe('attractions');
    expect(pickDomain('팝업/이벤트')).toBe('attractions');
  });
});

describe('haversineMeters', () => {
  it('같은 좌표면 0을 반환한다', () => {
    expect(haversineMeters(37.5, 127.0, 37.5, 127.0)).toBe(0);
  });
  it('서울 시청 ↔ 강남역 약 8~10km', () => {
    const dist = haversineMeters(37.5666, 126.9784, 37.4979, 127.0276);
    expect(dist).toBeGreaterThan(7000);
    expect(dist).toBeLessThan(11000);
  });
});

describe('walkingDistanceMeters', () => {
  it('직선거리의 1.35배를 반환한다', () => {
    const a = { lat: 37.5, lon: 127.0 };
    const b = { lat: 37.501, lon: 127.001 };
    const raw = haversineMeters(a.lat, a.lon, b.lat, b.lon);
    expect(walkingDistanceMeters(a, b)).toBe(Math.round(raw * 1.35));
  });
});

describe('buildCourseHash', () => {
  it('동일 입력에 동일 해시를 반환한다', () => {
    const h1 = buildCourseHash(['a', 'b', 'c']);
    const h2 = buildCourseHash(['a', 'b', 'c']);
    expect(h1).toBe(h2);
  });
  it('다른 입력에 다른 해시를 반환한다', () => {
    const h1 = buildCourseHash(['a', 'b']);
    const h2 = buildCourseHash(['b', 'a']);
    expect(h1).not.toBe(h2);
  });
  it('16자 hex를 반환한다', () => {
    expect(buildCourseHash(['x'])).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe('inferCategoryFromText', () => {
  it('카페를 인식한다', () => {
    expect(inferCategoryFromText('귀여운 카페')).toEqual({ category_main: '카페', category_sub: '커피' });
  });
  it('카공을 인식한다', () => {
    expect(inferCategoryFromText('카공하기 좋은 곳')).toEqual({ category_main: '카페', category_sub: '카공카페' });
  });
  it('디저트를 인식한다', () => {
    expect(inferCategoryFromText('디저트 맛집')).toEqual({ category_main: '디저트', category_sub: '베이커리' });
  });
  it('전시를 인식한다', () => {
    expect(inferCategoryFromText('갤러리 전시')).toEqual({ category_main: '전시/문화', category_sub: '전시관' });
  });
  it('도서관을 인식한다', () => {
    expect(inferCategoryFromText('도서관 카페')).toEqual({ category_main: '전시/문화', category_sub: '도서관' });
  });
  it('문구를 인식한다', () => {
    expect(inferCategoryFromText('문구점 소품')).toEqual({ category_main: '쇼핑/소품', category_sub: '문구점' });
  });
  it('매칭 안되면 null', () => {
    expect(inferCategoryFromText('일반 텍스트')).toEqual({ category_main: null, category_sub: null });
  });
});

describe('parseJsonChunk', () => {
  it('JSON 객체를 추출한다', () => {
    expect(parseJsonChunk('result: {"a":1}')).toEqual({ a: 1 });
  });
  it('JSON이 없으면 null', () => {
    expect(parseJsonChunk('no json here')).toBeNull();
  });
  it('잘못된 JSON이면 null', () => {
    expect(parseJsonChunk('{broken}')).toBeNull();
  });
});
