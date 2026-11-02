/**
 * 사용자에게 보이는 글자에 가운데점(U+00B7)이 다시 들어오지 않게 막는다.
 * - 화면 컴포넌트 소스의 문자열·JSX 글자 (주석과 분류 키는 제외)
 * - 추천 근거·라벨·꼬리표처럼 코드가 만들어 내는 문구
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Location } from '../types/location';
import { getConditionMatches } from './decisionEngine';
import { categoryLabel, regionLabel } from './displayText';
import { EMPTY_CONDITIONS, getConditionLabels, KIND_LABEL } from './intentChips';
import { getUnvisitedBasisLabel, RECOMMEND_BADGES, VISIT_STATUS_LABEL } from './curation';
import { TAXONOMY } from './taxonomy';

const DOT = '·';
const SRC = join(__dirname, '..');

/** 데이터 키로만 쓰이는 값 (화면에는 categoryLabel로 바꿔 보여준다) */
const DATA_KEYS = [`'양식${DOT}퓨전'`];

/** 가운데점을 '읽는' 코드라 화면에 나가지 않는 줄 */
const READS_DOT = [
  'utils/displayText.ts', // 저장된 지역 값의 구분자를 알아보고 화면 이름으로 바꾼다
  'utils/intentChips.ts', // 사용자가 입력한 문장을 낱말로 나눌 때 구분자로 본다
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx|ts)$/.test(name) && !/\.test\.ts$|\.d\.ts$/.test(name) ? [path] : [];
  });
}

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

describe('가운데점(U+00B7) 없음', () => {
  it('화면 코드의 문자열과 JSX 글자에 없다 (주석·분류 키 제외)', () => {
    const offenders: string[] = [];
    for (const file of [...sourceFiles(join(SRC, 'components')), ...sourceFiles(join(SRC, 'utils')), join(SRC, 'App.tsx')]) {
      if (READS_DOT.some((allowed) => file.endsWith(allowed))) continue;
      let code = stripComments(readFileSync(file, 'utf8'));
      for (const key of DATA_KEYS) code = code.split(key).join("'KEY'");
      code.split('\n').forEach((line, i) => {
        if (line.includes(DOT)) offenders.push(`${file.replace(SRC, 'src')}:${i + 1} ${line.trim().slice(0, 80)}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('분류·지역 화면 이름', () => {
    expect(categoryLabel(`양식${DOT}퓨전`)).toBe('양식과 퓨전');
    expect(regionLabel(`관악구 ${DOT} 봉천`)).toBe('관악구 봉천');
    expect(regionLabel(`의정부 ${DOT} 의정부`)).toBe('의정부');
    expect(regionLabel('용산/이태원/한남')).toBe('용산/이태원/한남');
  });

  it('라벨·배지·꼬리표', () => {
    const labels = [
      ...TAXONOMY.map((term) => term.label),
      ...Object.values(KIND_LABEL),
      ...(['food', 'space'] as const).flatMap((mode) => Object.values(getConditionLabels(mode)).flatMap((group) => Object.values(group))),
      ...RECOMMEND_BADGES.map((badge) => badge.label + badge.description),
      ...Object.values(VISIT_STATUS_LABEL),
      ...(['friend', 'research', 'wishlist'] as const).map((basis) => getUnvisitedBasisLabel({ recommend_basis: basis })),
    ];
    expect(labels.filter((label) => label.includes(DOT))).toEqual([]);
  });

  it('추천 근거 문구 (지역 값에 가운데점이 있어도 화면 문구에는 없다)', () => {
    const loc = {
      id: 'p1', name: '장소', region: `관악구 ${DOT} 봉천`, category: '', categoryMain: `양식${DOT}퓨전`, lon: 0, lat: 1,
      address: '', memo: '', rating: 3, imageUrl: '', tags: ['데이트', '조용한 분위기'], hours_text: '목(10/29) 11:00 ~ 22:00',
    } as Location;
    const conditions = { ...EMPTY_CONDITIONS, region: `관악구 ${DOT} 봉천`, companion: 'pair' as const, timeSlot: 'lunch' as const, priority: 'quiet' as const, reasons: ['view'] };
    const texts = getConditionMatches(loc, conditions).flatMap((match) => [match.title, match.text]);
    expect(texts.filter((text) => text.includes(DOT))).toEqual([]);
  });
});
