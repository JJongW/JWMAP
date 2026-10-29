import { describe, expect, it, vi } from 'vitest';
import { mapSearchSlots, matchRegion, parseIntentText, resolveIntent, EMPTY_CONDITIONS } from './intentChips';

// 장소 수가 많은 순
const REGIONS = ['종로/중구', '강남', '홍대/합정/마포/연남', '건대/성수/왕십리', '용산/이태원/한남', '마포/홍대'];

describe('parseIntentText', () => {
  it('종로에서 둘이 저녁, 조용한 곳 → 4개 조건', () => {
    expect(parseIntentText('종로에서 둘이 저녁, 조용한 곳', REGIONS)).toEqual({
      region: '종로/중구',
      companion: 'pair',
      timeSlot: 'dinner',
      priority: 'quiet',
      kind: null,
    });
  });

  it('혼밥·늦은 시간·카페를 잡는다', () => {
    expect(parseIntentText('성수 혼밥 야식', REGIONS)).toMatchObject({ region: '건대/성수/왕십리', companion: 'solo', timeSlot: 'late' });
    expect(parseIntentText('이태원 카페 웨이팅 없는 곳', REGIONS)).toMatchObject({ region: '용산/이태원/한남', kind: 'cafe', priority: 'wait_short' });
  });

  it('여럿·점심', () => {
    expect(parseIntentText('친구들이랑 점심', REGIONS)).toMatchObject({ companion: 'group', timeSlot: 'lunch', region: null });
  });

  it('못 잡으면 빈 조건', () => {
    expect(parseIntentText('아무거나', REGIONS)).toEqual(EMPTY_CONDITIONS);
    expect(parseIntentText('   ', REGIONS)).toEqual(EMPTY_CONDITIONS);
  });
});

describe('matchRegion', () => {
  it('겹치는 별칭은 먼저 온(장소가 많은) 지역으로, 더 긴 별칭을 우선', () => {
    expect(matchRegion('마포 밥집', REGIONS)).toBe('홍대/합정/마포/연남');
    expect(matchRegion('강남역', REGIONS)).toBe('강남');
  });
});

describe('mapSearchSlots', () => {
  it('API slots를 같은 조건으로 바꾼다', () => {
    expect(
      mapSearchSlots(
        { region: '종로/중구', time_of_day: '저녁', visit_context: '데이트', constraints: ['조용한'], category_main: '카페' },
        REGIONS,
      ),
    ).toEqual({ region: '종로/중구', companion: 'pair', timeSlot: 'dinner', priority: 'quiet', kind: 'cafe' });
  });
});

describe('resolveIntent', () => {
  it('규칙으로 잡히면 API를 부르지 않는다', async () => {
    const fetcher = vi.fn();
    const result = await resolveIntent('종로 둘이', REGIONS, fetcher as unknown as typeof fetch);
    expect(result.source).toBe('rules');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('규칙으로 못 잡으면 API slots를 쓴다', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ slots: { region: '강남', visit_context: '회식', time_of_day: '저녁', constraints: [] } }),
    });
    const result = await resolveIntent('팀 사람들이랑 고기', REGIONS, fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toEqual({
      source: 'api',
      conditions: { region: '강남', companion: 'group', timeSlot: 'dinner', priority: null, kind: null },
    });
  });

  it('API가 실패하면 빈 조건으로 돌아온다', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
    const result = await resolveIntent('아무거나', REGIONS, fetcher as unknown as typeof fetch);
    expect(result).toEqual({ source: 'none', conditions: EMPTY_CONDITIONS });
  });
});
