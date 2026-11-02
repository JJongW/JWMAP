/**
 * hours.ts
 *
 * 카카오맵 영업시간 원문("목(10/29) 12:00 ~ 22:00 / 금(10/30) 휴무일")으로
 * 점심·저녁·늦은 밤에 여는지 판정한다. 메뉴 분류로 시간대를 추정하지 않기 위한 근거.
 * 원문에는 브레이크타임이 없어서, 식사할 시간이 열려 있는지만 본다 (점심 12:30~13:30, 저녁 18:30~19:30에 열려 있으면 일치).
 */

import type { TimeSlot } from '../types/ui';

export type OpenFit = 'match' | 'mismatch' | 'unknown';

interface DayHours {
  open: number;
  /** 분 단위. 자정을 넘기면 24시간을 더한다 (예: 02:00 → 1560) */
  close: number;
}

const RANGE = /(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/;

/** 여는 날의 시간만 꺼낸다. 휴무일·알아볼 수 없는 칸은 건너뛴다 */
export function parseHours(text: string | undefined): DayHours[] {
  if (!text) return [];
  const days: DayHours[] = [];
  for (const part of text.split('/')) {
    const m = part.match(RANGE);
    if (!m) continue;
    const open = Number(m[1]) * 60 + Number(m[2]);
    let close = Number(m[3]) * 60 + Number(m[4]);
    if (close <= open) close += 24 * 60;
    days.push({ open, close });
  }
  return days;
}

const FITS: Record<TimeSlot, (day: DayHours) => boolean> = {
  lunch: (day) => day.open <= 12 * 60 + 30 && day.close >= 13 * 60 + 30,
  dinner: (day) => day.open <= 18 * 60 + 30 && day.close >= 19 * 60 + 30,
  late: (day) => day.close >= 23 * 60,
};

/** 여는 날 중 하루라도 그 시간에 열면 match, 여는 날이 있는데 한 번도 안 맞으면 mismatch, 정보가 없으면 unknown */
export function judgeOpenAt(text: string | undefined, timeSlot: TimeSlot): OpenFit {
  const days = parseHours(text);
  if (days.length === 0) return 'unknown';
  return days.some(FITS[timeSlot]) ? 'match' : 'mismatch';
}
