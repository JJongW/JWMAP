import { describe, it, expect } from 'vitest';
import { parseMapClipboard } from './mapClipboardParser';

describe('parseMapClipboard', () => {
  it('빈 문자열이면 빈 결과를 반환한다', () => {
    const result = parseMapClipboard('');
    expect(result.sourceUrls).toEqual([]);
    expect(result.hashtags).toEqual([]);
    expect(result.reviewSnippets).toEqual([]);
    expect(result.name).toBeUndefined();
  });

  it('장소명을 추출한다', () => {
    const result = parseMapClipboard('장소명: 카페연희\n주소: 서울특별시 서대문구 연희동 123');
    expect(result.name).toBe('카페연희');
    expect(result.address).toBe('서울특별시 서대문구 연희동 123');
  });

  it('좌표를 추출한다', () => {
    const result = parseMapClipboard('위도: 37.5665\n경도: 126.9780');
    expect(result.lat).toBeCloseTo(37.5665);
    expect(result.lon).toBeCloseTo(126.978);
  });

  it('좌표 쌍을 추출한다', () => {
    const result = parseMapClipboard('some text\n37.5665, 126.9780\nmore text');
    expect(result.lat).toBeCloseTo(37.5665);
    expect(result.lon).toBeCloseTo(126.978);
  });

  it('카카오 place ID를 추출한다', () => {
    const result = parseMapClipboard('https://place.map.kakao.com/12345678');
    expect(result.kakao_place_id).toBe('12345678');
  });

  it('네이버 place ID를 추출한다', () => {
    const result = parseMapClipboard('https://m.place.naver.com/place/98765432');
    expect(result.naver_place_id).toBe('98765432');
  });

  it('해시태그를 추출한다', () => {
    const result = parseMapClipboard('카페 방문 #감성카페 #연남동맛집 #카공');
    expect(result.hashtags).toContain('#감성카페');
    expect(result.hashtags).toContain('#연남동맛집');
    expect(result.hashtags).toContain('#카공');
  });

  it('URL을 추출한다', () => {
    const result = parseMapClipboard('링크: https://example.com/cafe\nhttps://kko.to/abc');
    expect(result.sourceUrls).toContain('https://example.com/cafe');
    expect(result.sourceUrls).toContain('https://kko.to/abc');
  });

  it('카테고리 힌트를 추출한다', () => {
    const result = parseMapClipboard('카테고리: 카페,디저트');
    expect(result.categoryHint).toBe('카페,디저트');
  });

  it('평점을 추출한다', () => {
    const result = parseMapClipboard('평점: 4.5');
    expect(result.rating).toBe(4.5);
  });

  it('리뷰 개수를 추출한다', () => {
    const result = parseMapClipboard('후기: 123');
    expect(result.reviewCount).toBe(123);
  });

  it('URL에서 좌표를 추출한다', () => {
    const result = parseMapClipboard('https://example.com?lat=37.5665&lng=126.9780');
    expect(result.lat).toBeCloseTo(37.5665);
    expect(result.lon).toBeCloseTo(126.978);
  });

  it('웹사이트 URL을 카카오/네이버 링크와 분리한다', () => {
    const result = parseMapClipboard('URL: https://mycafe.com\nhttps://kko.to/abc');
    expect(result.websiteUrl).toBe('https://mycafe.com');
  });

  it('콤마가 있는 첫 줄에서 이름과 카테고리를 추출한다', () => {
    const result = parseMapClipboard('카페연희, 카페\n서울특별시 서대문구');
    expect(result.name).toBe('카페연희');
  });
});
