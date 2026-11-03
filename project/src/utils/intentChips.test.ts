import { describe, expect, it, vi } from 'vitest';
import { applyTextEdit, buildPlaceAliases, conditionsToText, getConditionLabels, mapSearchSlots, matchRegion, parseIntentText, resolveIntent, unreadWords, EMPTY_CONDITIONS } from './intentChips';

// 장소 수가 많은 순
const REGIONS = ['종로/중구', '강남', '홍대/합정/마포/연남', '건대/성수/왕십리', '용산/이태원/한남', '마포/홍대'];

describe('parseIntentText', () => {
  it('종로에서 둘이 저녁, 조용한 곳 → 4개 조건', () => {
    expect(parseIntentText('종로에서 둘이 저녁, 조용한 곳', REGIONS)).toEqual({
      ...EMPTY_CONDITIONS,
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

describe('문장에서 못 읽은 조건', () => {
  it('데이터 지역에 없는 시/도는 지우지 않고 그대로 조건으로 둔다', () => {
    expect(parseIntentText('제주 혼자 심야 주차 되는 이자카야', REGIONS)).toMatchObject({ region: '제주', companion: 'solo', timeSlot: 'late' });
  });

  it('조건으로 못 읽은 낱말만 돌려준다', () => {
    expect(unreadWords('제주 혼자 심야 주차 되는 이자카야', REGIONS)).toEqual(['주차', '이자카야']);
    expect(unreadWords('종로에서 둘이 저녁, 조용한 곳', REGIONS)).toEqual([]);
    expect(unreadWords('혼자 노트북 하기 좋은 카페', REGIONS)).not.toContain('카페');
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
    ).toEqual({ ...EMPTY_CONDITIONS, region: '종로/중구', companion: 'pair', timeSlot: 'dinner', priority: 'quiet', kind: 'cafe' });
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
      conditions: { ...EMPTY_CONDITIONS, region: '강남', companion: 'group', timeSlot: 'dinner' },
    });
  });

  it('API가 실패하면 빈 조건으로 돌아온다', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
    const result = await resolveIntent('아무거나', REGIONS, fetcher as unknown as typeof fetch);
    expect(result).toEqual({ source: 'none', conditions: EMPTY_CONDITIONS });
  });
});

describe('getConditionLabels', () => {
  it('볼거리는 질문 화면과 같은 라벨을 결과 칩에서도 쓴다', () => {
    const labels = getConditionLabels('space');
    expect(labels.companion.pair).toBe('둘이');
    expect(labels.timeSlot.lunch).toBe('가볍게');
    expect(labels.priority.wait_short).toBe('실내 위주');
  });

  it('맛집 라벨은 그대로', () => {
    const labels = getConditionLabels('food');
    expect(labels.timeSlot.lunch).toBe('점심');
    expect(labels.priority.wait_short).toBe('줄 안 서는 곳');
  });
});

describe('문장과 조건 칩 맞추기', () => {
  const yongsan = parseIntentText('용산 혼자 점심 조용한 곳', REGIONS);

  it('칩으로 만든 문장을 다시 읽으면 같은 조건이다', () => {
    const cases = [
      { ...EMPTY_CONDITIONS, region: '용산/이태원/한남', companion: 'solo' as const, timeSlot: 'lunch' as const },
      { ...EMPTY_CONDITIONS, region: '종로/중구', companion: 'pair' as const, timeSlot: 'dinner' as const, priority: 'quiet' as const, kind: 'meal' as const },
      { ...EMPTY_CONDITIONS, companion: 'group' as const, timeSlot: 'late' as const, priority: 'wait_short' as const },
      { ...EMPTY_CONDITIONS, timeSlot: 'lunch' as const, priority: 'fast_serve' as const, kind: 'cafe' as const },
    ];
    for (const conditions of cases) {
      expect(parseIntentText(conditionsToText(conditions, REGIONS), REGIONS)).toEqual(conditions);
    }
    const space = { ...EMPTY_CONDITIONS, placeType: 'gallery', situations: ['rainy_day'], priority: 'wait_short' as const, timeSlot: 'lunch' as const };
    expect(parseIntentText(conditionsToText(space, REGIONS, 'space'), REGIONS, 'space')).toEqual(space);
  });

  it("'조용한 곳' 칩을 지우면 문장에서도 빠지고, 그 문장을 그대로 다시 추천해도 되살아나지 않는다", () => {
    const removed = { ...yongsan, priority: null };
    const text = conditionsToText(removed, REGIONS);
    expect(text).toBe('용산 혼자 점심');
    const unchanged = applyTextEdit(removed, parseIntentText(text, REGIONS), parseIntentText(text, REGIONS));
    expect(unchanged).toEqual(removed);
  });

  it('문장에서 고친 항목만 바뀌고, 건드리지 않은 조건은 그대로', () => {
    const current = { ...yongsan, kind: 'meal' as const };
    const before = parseIntentText('용산 혼자 점심 조용한 곳', REGIONS);
    // 점심 → 저녁만 고침. 칩으로 더한 '밥집'은 문장에 없어도 유지
    const next = applyTextEdit(current, before, parseIntentText('용산 혼자 저녁 조용한 곳', REGIONS));
    expect(next).toEqual({ ...current, timeSlot: 'dinner' });
    // 문장에서 지운 조건은 빠진다
    expect(applyTextEdit(current, before, parseIntentText('용산 혼자 점심', REGIONS)).priority).toBeNull();
  });

  it('여러 낱말에 걸친 말과 볼거리 조건은 못 읽었다고 하지 않는다', () => {
    expect(unreadWords('비 오는 날 실내 전시', REGIONS, 'space')).toEqual([]);
    expect(parseIntentText('비 오는 날 실내 전시', REGIONS, 'space')).toMatchObject({ placeType: 'gallery', situations: ['rainy_day'], priority: 'wait_short' });
    // 맛집에서 장소 종류 없이 쓰면 '실내'는 맛집 조건이 아니라서 알린다
    expect(unreadWords('종로 실내', REGIONS)).toEqual(['실내']);
  });
});

describe('동네·길 이름으로 지역 찾기', () => {
  const places = [
    { region: '종로/중구', address: '서울 중구 을지로 157' },
    { region: '종로/중구', address: '서울 중구 을지로3가 12-1' },
    { region: '종로/중구', address: '서울 종로구 익선동 166' },
    { region: '종로/중구', address: '서울 종로구 익선동 34' },
    { region: '서울 중구', address: '서울 중구 을지로 100' },
    // 두 지역에 반씩 걸친 이름은 쓰지 않는다
    { region: '강남', address: '서울 강남구 테헤란로 1' },
    { region: '서초', address: '서울 서초구 테헤란로 2' },
  ];
  const aliases = buildPlaceAliases(places);

  it('주소에 자주 나오는 길·동 이름을 그 지역으로 읽는다', () => {
    expect(parseIntentText('을지로에서 혼자 점심', REGIONS, 'food', aliases).region).toBe('종로/중구');
    expect(parseIntentText('을지로3가역 저녁', REGIONS, 'food', aliases).region).toBe('종로/중구');
    expect(parseIntentText('익선동 카페', REGIONS, 'food', aliases).region).toBe('종로/중구');
    expect(unreadWords('을지로 혼자 점심', REGIONS, 'food', aliases)).toEqual([]);
  });

  it('여러 지역에 걸친 이름이나 지역 이름이 이미 있으면 쓰지 않는다', () => {
    expect(aliases.has('테헤란로')).toBe(false);
    expect(parseIntentText('강남 을지로', REGIONS, 'food', aliases).region).toBe('강남');
  });
});
