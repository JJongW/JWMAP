#!/usr/bin/env node
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

import { parseIntent } from './flow/intent.js';
import { applyDefaults } from './flow/questionFlow.js';
import { queryPlaces } from './db/places.js';
import { logSearch, getStats } from './db/logs.js';
import { saveCourse } from './db/savedCourses.js';
import { scorePlaces } from './engine/scoring.js';
import { buildCourses } from './engine/courseBuilder.js';
import { planMode } from './engine/modePlanner.js';
import {
  renderHeader,
  renderPlaceList,
  renderPlaceDetail,
  renderCourseList,
  renderCourseDetail,
  renderStats,
  renderNoResults,
  renderSaved,
} from './ui/renderer.js';
import { selectPlace, selectCourse, confirmSave } from './ui/prompts.js';
import { sanitizeQuery } from './utils/validators.js';
import { c } from './ui/colors.js';

const SINGLE_RESULT_COUNT = 5;

async function runSingleMode(rawQuery: string, intent: Awaited<ReturnType<typeof applyDefaults>>, parseErrors: string[]): Promise<void> {
  const places = await queryPlaces(intent);
  if (places.length === 0) { renderNoResults(); return; }

  let scored = scorePlaces(places, intent).slice(0, SINGLE_RESULT_COUNT);
  let regenerateCount = 0;

  while (true) {
    renderPlaceList(scored);

    const choice = await selectPlace(scored.length);

    if (choice === 'r') {
      regenerateCount++;
      const allScored = scorePlaces(places, intent);
      scored = [...allScored].sort(() => Math.random() - 0.5).slice(0, SINGLE_RESULT_COUNT);
      continue;
    }

    const selected = scored[choice - 1];
    if (!selected) {
      console.log(c.warn('  잘못된 선택입니다.'));
      continue;
    }

    renderPlaceDetail(selected);

    try {
      await logSearch({
        rawQuery, intent, mode: 'single', parseErrors,
        selectedPlaceId: selected.id,
        selectedPlaceName: selected.name,
        regenerateCount,
      });
    } catch { /* silent */ }
    break;
  }
}

async function runCourseMode(rawQuery: string, intent: Awaited<ReturnType<typeof applyDefaults>>, parseErrors: string[]): Promise<void> {
  const modeConfig = planMode(intent.people_count!, intent.mode);

  const places = await queryPlaces(intent);
  if (places.length === 0) { renderNoResults(); return; }

  const scored = scorePlaces(places, intent);
  let courses = buildCourses(scored, modeConfig, intent.vibe);
  if (courses.length === 0) { renderNoResults(); return; }

  let selectedCourse = null;
  let regenerateCount = 0;

  while (true) {
    renderCourseList(courses);

    const choice = await selectCourse(courses.length);

    if (choice === 'r') {
      regenerateCount++;
      const shuffled = [...scored].sort(() => Math.random() - 0.5);
      courses = buildCourses(shuffled, modeConfig, intent.vibe);
      if (courses.length === 0) { renderNoResults(); return; }
      continue;
    }

    selectedCourse = courses.find((co) => co.id === choice);
    if (!selectedCourse) {
      console.log(c.warn('  잘못된 선택입니다.'));
      continue;
    }
    break;
  }

  renderCourseDetail(selectedCourse);

  const wantSave = await confirmSave();
  if (wantSave) {
    try {
      const hash = await saveCourse(selectedCourse);
      renderSaved(hash);
    } catch (err) {
      console.log(c.error(`  저장 실패: ${err instanceof Error ? err.message : err}`));
    }
  }

  try {
    await logSearch({
      rawQuery, intent, mode: modeConfig.mode, parseErrors,
      selectedCourse,
      regenerateCount,
    });
  } catch { /* silent */ }
}

async function runSearch(rawQuery: string): Promise<void> {
  const query = sanitizeQuery(rawQuery);
  console.log(c.dim(`  ${c.emoji.search}  "${query}" 분석 중...`));
  console.log();

  const { intent: rawIntent, parseErrors } = await parseIntent(query);
  const intent = await applyDefaults(rawIntent, parseErrors);

  const typeLabel = intent.response_type === 'course' ? '코스' : '장소';
  console.log(c.dim(`  ${typeLabel} 추천 | 지역: ${intent.region} | 시즌: ${intent.season}`));
  console.log();

  if (intent.response_type === 'course') {
    await runCourseMode(query, intent, parseErrors);
  } else {
    await runSingleMode(query, intent, parseErrors);
  }
}

async function main(): Promise<void> {
  renderHeader();

  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(c.subtitle('  사용법:'));
    console.log(c.dim('    odiga "오늘 점심 뭐 먹을까?"'));
    console.log(c.dim('    odiga "홍대 감성 카페"'));
    console.log(c.dim('    odiga "강남 데이트 코스 짜줘"'));
    console.log(c.dim('    odiga stats'));
    console.log();
    process.exit(0);
  }

  if (args[0] === 'stats') {
    await runStats();
    process.exit(0);
  }

  const query = args.join(' ');
  await runSearch(query);
}

async function runStats(): Promise<void> {
  try {
    const stats = await getStats();
    renderStats(stats);
  } catch (err) {
    console.log(c.error(`  통계 조회 실패: ${err instanceof Error ? err.message : err}`));
  }
}

main().catch((err) => {
  console.error(c.error(`\n  오류가 발생했어요: ${err.message}\n`));
  process.exit(1);
});
