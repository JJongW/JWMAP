#!/usr/bin/env node
import { api, ApiError } from './api/client.js';
import type { ScoredPlace, Course, RecommendResponse } from './api/types.js';
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

/** Detect region from query using simple regex */
function detectRegion(query: string): string | undefined {
  const regions = [
    '강남', '홍대', '합정', '이태원', '한남', '을지로', '종로', '성수', '건대',
    '잠실', '여의도', '신촌', '연남', '망원', '마포', '용산', '명동',
    '서울', '경기', '인천', '부산',
  ];
  for (const region of regions) {
    if (query.includes(region)) return region;
  }
  return undefined;
}

/** Detect people count from query using simple regex */
function detectPeopleCount(query: string): number | undefined {
  const match = query.match(/(\d+)\s*명/);
  if (match) return parseInt(match[1], 10);
  if (query.includes('혼자') || query.includes('혼밥') || query.includes('혼술')) return 1;
  if (query.includes('데이트') || query.includes('둘이')) return 2;
  return undefined;
}

async function runSingleMode(
  rawQuery: string,
  response: RecommendResponse,
): Promise<void> {
  let scored = response.places.slice(0, SINGLE_RESULT_COUNT);
  let regenerateCount = 0;

  if (scored.length === 0) { renderNoResults(); return; }

  while (true) {
    renderPlaceList(scored);

    const choice = await selectPlace(scored.length);

    if (choice === 'r') {
      regenerateCount++;
      scored = [...response.places].sort(() => Math.random() - 0.5).slice(0, SINGLE_RESULT_COUNT);
      continue;
    }

    const selected = scored[choice - 1];
    if (!selected) {
      console.log(c.warn('  잘못된 선택입니다.'));
      continue;
    }

    renderPlaceDetail(selected);

    logSilent({
      rawQuery,
      intent: response.intent,
      mode: 'single',
      parseErrors: response.parseErrors,
      selectedPlaceId: selected.id,
      selectedPlaceName: selected.name,
      regenerateCount,
    });
    break;
  }
}

async function runCourseMode(
  rawQuery: string,
  response: RecommendResponse,
): Promise<void> {
  let courses = response.courses;
  if (courses.length === 0) { renderNoResults(); return; }

  let selectedCourse: Course | null = null;
  let regenerateCount = 0;

  while (true) {
    renderCourseList(courses);

    const choice = await selectCourse(courses.length);

    if (choice === 'r') {
      regenerateCount++;
      // Re-fetch with same query for fresh results
      try {
        const newResponse = await api.recommend({
          query: rawQuery,
          region: response.intent.region || undefined,
          people_count: response.intent.people_count || undefined,
          response_type: 'course',
        });
        courses = newResponse.courses;
        if (courses.length === 0) { renderNoResults(); return; }
      } catch {
        // On error, shuffle existing courses
        courses = [...courses].sort(() => Math.random() - 0.5);
      }
      continue;
    }

    selectedCourse = courses.find((co) => co.id === choice) || null;
    if (!selectedCourse) {
      console.log(c.warn('  잘못된 선택입니다.'));
      continue;
    }
    break;
  }

  renderCourseDetail(selectedCourse!);

  const wantSave = await confirmSave();
  if (wantSave) {
    try {
      const { course_hash } = await api.saveCourse({ course: selectedCourse! });
      renderSaved(course_hash);
    } catch (err) {
      console.log(c.error(`  저장 실패: ${err instanceof Error ? err.message : err}`));
    }
  }

  logSilent({
    rawQuery,
    intent: response.intent,
    mode: selectedCourse!.mode,
    parseErrors: response.parseErrors,
    selectedCourse,
    regenerateCount,
  });
}

function logSilent(params: {
  rawQuery: string;
  intent: RecommendResponse['intent'];
  mode: string;
  parseErrors: string[];
  selectedCourse?: Course | null;
  selectedPlaceId?: string;
  selectedPlaceName?: string;
  regenerateCount?: number;
}): void {
  api.log({
    raw_query: params.rawQuery,
    region: params.intent.region,
    vibe: params.intent.vibe,
    people_count: params.intent.people_count,
    mode: params.mode,
    season: params.intent.season,
    activity_type: params.intent.activity_type,
    response_type: params.intent.response_type,
    selected_course: params.selectedCourse || null,
    selected_place_id: params.selectedPlaceId || null,
    selected_place_name: params.selectedPlaceName || null,
    regenerate_count: params.regenerateCount || 0,
    parse_error_fields: params.parseErrors,
  }).catch(() => { /* silent */ });
}

async function runSearch(rawQuery: string): Promise<void> {
  const query = sanitizeQuery(rawQuery);
  console.log(c.dim(`  ${c.emoji.search}  "${query}" 분석 중...`));
  console.log();

  const region = detectRegion(query);
  const people_count = detectPeopleCount(query);

  const response = await api.recommend({
    query,
    region,
    people_count,
  });

  const typeLabel = response.type === 'course' ? '코스' : '장소';
  console.log(c.dim(`  ${typeLabel} 추천 | 지역: ${response.intent.region} | 시즌: ${response.intent.season}`));
  console.log();

  if (response.type === 'course') {
    await runCourseMode(query, response);
  } else {
    await runSingleMode(query, response);
  }
}

async function runStats(): Promise<void> {
  try {
    const stats = await api.stats();
    renderStats(stats);
  } catch (err) {
    console.log(c.error(`  통계 조회 실패: ${err instanceof Error ? err.message : err}`));
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

main().catch((err) => {
  if (err instanceof ApiError) {
    console.error(c.error(`\n  ${err.message}\n`));
  } else {
    console.error(c.error(`\n  오류가 발생했어요: ${err.message}\n`));
  }
  process.exit(1);
});
