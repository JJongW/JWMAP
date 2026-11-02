import { describe, expect, it } from 'vitest';
import { judgeOpenAt, parseHours } from './hours';

describe('카카오맵 영업시간으로 시간대 판정', () => {
  const allDay = '목(10/29) 11:30 ~ 21:00 / 금(10/30) 11:30 ~ 21:00';
  const evening = '목(10/29) 17:00 ~ 02:00 / 금(10/30) 17:00 ~ 02:00 / 토(10/31) 휴무일';

  it('휴무일은 빼고 여는 날만 읽는다. 자정을 넘기면 다음 날로 본다', () => {
    expect(parseHours(evening)).toEqual([
      { open: 17 * 60, close: 26 * 60 },
      { open: 17 * 60, close: 26 * 60 },
    ]);
  });

  it('점심·저녁·늦은 밤', () => {
    expect(judgeOpenAt(allDay, 'lunch')).toBe('match');
    expect(judgeOpenAt(allDay, 'dinner')).toBe('match');
    expect(judgeOpenAt(allDay, 'late')).toBe('mismatch');
    expect(judgeOpenAt(evening, 'lunch')).toBe('mismatch');
    expect(judgeOpenAt(evening, 'late')).toBe('match');
  });

  it('저녁 7시 반까지 여는 곳은 저녁 식사가 된다 (공기식당 사례)', () => {
    expect(judgeOpenAt('목(10/29) 11:40 ~ 19:30 / 토(10/31) 12:00 ~ 19:00', 'dinner')).toBe('match');
    expect(judgeOpenAt('목(10/29) 11:00 ~ 15:00', 'dinner')).toBe('mismatch');
  });

  it('정보가 없거나 휴무일뿐이면 판정하지 않는다', () => {
    expect(judgeOpenAt(undefined, 'lunch')).toBe('unknown');
    expect(judgeOpenAt('목(10/29) 휴무일', 'lunch')).toBe('unknown');
  });
});
