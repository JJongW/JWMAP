import { describe, expect, it } from 'vitest';
import { searchLocations } from './placeSearch';

const place = (name: string, extra: Partial<Parameters<typeof searchLocations>[0][number]> = {}) => ({
  name,
  region: '종로/중구',
  categoryMain: '밥',
  categorySub: '돈까스',
  address: '서울 중구 을지로 1',
  tags: [] as string[],
  ...extra,
});

describe('searchLocations', () => {
  const curated = [place('공기식당')];
  const all = [...curated, place('히메카츠'), place('톤쇼우', { region: '부산' })];

  it('같은 검색어는 대상 목록이 같으면 같은 결과를 낸다', () => {
    expect(searchLocations(all, '히메카츠').map((p) => p.name)).toEqual(['히메카츠']);
    // 큐레이션 목록만 찾으면 빠지는 장소가 생긴다 → 화면은 항상 전체 목록을 넘겨야 한다
    expect(searchLocations(curated, '히메카츠')).toEqual([]);
  });

  it('공백과 대소문자를 무시한다', () => {
    expect(searchLocations(all, '히메 카츠').map((p) => p.name)).toEqual(['히메카츠']);
    expect(searchLocations([place('Cafe ABC')], 'cafe abc')).toHaveLength(1);
  });

  it('지역·카테고리·주소·태그로도 찾는다', () => {
    expect(searchLocations(all, '부산').map((p) => p.name)).toEqual(['톤쇼우']);
    expect(searchLocations([place('A', { tags: ['혼밥'] })], '혼밥')).toHaveLength(1);
  });

  it('빈 검색어면 목록을 그대로 돌려준다', () => {
    expect(searchLocations(all, '  ')).toBe(all);
  });
});
