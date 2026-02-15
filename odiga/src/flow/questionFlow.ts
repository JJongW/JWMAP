import Enquirer from 'enquirer';
import type { ParsedIntent } from './intent.js';

// TODO: Integrate weather API for real-time season detection
// TODO: Integrate holiday API for special date context

export async function applyDefaults(intent: ParsedIntent, parseErrors: string[]): Promise<ParsedIntent> {
  const result = { ...intent };

  if (!result.region || parseErrors.includes('region')) {
    result.region = await askRegion();
  }

  // 코스 모드일 때만 인원수 물어봄
  if (result.response_type === 'course') {
    if (!result.people_count || parseErrors.includes('people_count')) {
      result.people_count = await askPeopleCount();
    }
    if (!result.mode) {
      result.mode = inferMode(result.people_count!, result.special_context);
    }
  } else {
    // single 모드에서는 인원수 기본값만 적용
    if (!result.people_count) result.people_count = 1;
    if (!result.mode) result.mode = 'solo';
  }

  if (!result.season) {
    result.season = detectCurrentSeason();
  }

  return result;
}

async function askRegion(): Promise<string> {
  const { region } = await (Enquirer as any).prompt({
    type: 'input',
    name: 'region',
    message: '어디로 갈까요? (지역)',
    initial: process.env.DEFAULT_REGION || '서울',
  });
  return region || process.env.DEFAULT_REGION || '서울';
}

async function askPeopleCount(): Promise<number> {
  const { choice } = await (Enquirer as any).prompt({
    type: 'select',
    name: 'choice',
    message: '몇 명이서 가나요?',
    choices: [
      { name: '1', message: '🚶 혼자' },
      { name: '2', message: '💑 2명 (데이트)' },
      { name: '3', message: '👥 3~5명 (소모임)' },
      { name: '6', message: '🎉 6명 이상 (단체)' },
    ],
  });
  return parseInt(choice, 10);
}

function detectCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return '봄';
  if (month >= 6 && month <= 8) return '여름';
  if (month >= 9 && month <= 11) return '가을';
  return '겨울';
}

function inferMode(peopleCount: number, context: string | null): string {
  if (context) {
    const dateContexts = ['데이트', '소개팅', '기념일', '생일'];
    if (dateContexts.some((c) => context.includes(c))) return 'date';
  }

  if (peopleCount <= 1) return 'solo';
  if (peopleCount === 2) return 'date';
  if (peopleCount <= 5) return 'group';
  return 'party';
}
