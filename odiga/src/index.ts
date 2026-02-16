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
import { selectPlace, selectCourse, confirmSave, askFeedback } from './ui/prompts.js';
import { sanitizeQuery } from './utils/validators.js';
import { c } from './ui/colors.js';

const SINGLE_RESULT_COUNT = 5;

/** Detect region from query using station/landmark → region mapping */
function detectRegion(query: string): string | undefined {
  // Station/landmark → valid DB region mapping (most specific first)
  const stationToRegion: [string, string][] = [
    // 구로/관악/동작
    ['서울대입구', '구로/관악/동작'], ['신림', '구로/관악/동작'], ['봉천', '구로/관악/동작'],
    ['낙성대', '구로/관악/동작'], ['사당', '구로/관악/동작'], ['이수', '구로/관악/동작'],
    ['노량진', '구로/관악/동작'], ['관악', '구로/관악/동작'], ['동작', '구로/관악/동작'],
    // 강남
    ['압구정', '강남'], ['선릉', '강남'], ['역삼', '강남'], ['삼성', '강남'],
    ['논현', '강남'], ['학동', '강남'], ['청담', '강남'], ['도산', '강남'],
    ['가로수길', '강남'], ['코엑스', '강남'], ['봉은사', '강남'], ['강남', '강남'],
    // 서초
    ['교대', '서초'], ['방배', '서초'], ['서래마을', '서초'], ['양재', '서초'],
    ['반포', '서초'], ['고속터미널', '서초'], ['내방', '서초'], ['서초', '서초'],
    // 종로/중구
    ['을지로', '종로/중구'], ['명동', '종로/중구'], ['광화문', '종로/중구'],
    ['경복궁', '종로/중구'], ['북촌', '종로/중구'], ['서촌', '종로/중구'],
    ['익선동', '종로/중구'], ['동대문', '종로/중구'], ['안국', '종로/중구'],
    ['인사동', '종로/중구'], ['충무로', '종로/중구'], ['시청', '종로/중구'],
    ['종로', '종로/중구'],
    // 건대/성수/왕십리
    ['뚝섬', '건대/성수/왕십리'], ['왕십리', '건대/성수/왕십리'], ['성수', '건대/성수/왕십리'],
    ['건대', '건대/성수/왕십리'], ['서울숲', '건대/성수/왕십리'],
    // 영등포/여의도/강서
    ['여의나루', '영등포/여의도/강서'], ['여의도', '영등포/여의도/강서'],
    ['영등포', '영등포/여의도/강서'], ['당산', '영등포/여의도/강서'],
    // 홍대/합정/마포/연남
    ['홍대', '홍대/합정/마포/연남'], ['합정', '홍대/합정/마포/연남'],
    ['상수', '홍대/합정/마포/연남'], ['망원', '홍대/합정/마포/연남'],
    ['연남', '홍대/합정/마포/연남'], ['마포', '홍대/합정/마포/연남'],
    ['공덕', '홍대/합정/마포/연남'],
    // 용산/이태원/한남
    ['이태원', '용산/이태원/한남'], ['한남', '용산/이태원/한남'],
    ['해방촌', '용산/이태원/한남'], ['경리단길', '용산/이태원/한남'],
    ['녹사평', '용산/이태원/한남'], ['용산', '용산/이태원/한남'],
    // 잠실/송파/강동
    ['잠실', '잠실/송파/강동'], ['송파', '잠실/송파/강동'],
    ['천호', '잠실/송파/강동'], ['올림픽공원', '잠실/송파/강동'],
    ['석촌', '잠실/송파/강동'], ['문정', '잠실/송파/강동'],
    // 신촌/연희
    ['신촌', '신촌/연희'], ['이대', '신촌/연희'], ['연희', '신촌/연희'],
    // 성북/노원/중랑
    ['혜화', '성북/노원/중랑'], ['대학로', '성북/노원/중랑'],
    ['성북', '성북/노원/중랑'], ['노원', '성북/노원/중랑'],
    // 금천/가산
    ['가산디지털단지', '금천/가산'], ['구로디지털단지', '금천/가산'],
    ['가산', '금천/가산'], ['금천', '금천/가산'], ['구로', '구로/관악/동작'],
    // 회기/청량리
    ['회기', '회기/청량리'], ['청량리', '회기/청량리'],
    // 기타 서울
    ['창동', '창동/도봉산'], ['도봉산', '창동/도봉산'],
    ['연신내', '연신내/구파발'], ['불광', '연신내/구파발'],
    ['미아', '미아/수유/북한산'], ['수유', '미아/수유/북한산'],
    ['목동', '목동/양천'],
    ['마곡', '마곡/김포'], ['발산', '마곡/김포'], ['김포공항', '마곡/김포'],
    ['강동', '강동/고덕'], ['고덕', '강동/고덕'],
    // Province-level (broad)
    ['서울', '서울'], ['경기', '경기'], ['인천', '인천'], ['부산', '부산'],
  ];

  for (const [keyword, region] of stationToRegion) {
    if (query.includes(keyword)) return region;
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
  const feedbacks: string[] = [];

  if (scored.length === 0) { renderNoResults(); return; }

  while (true) {
    renderPlaceList(scored);

    const choice = await selectPlace(scored.length);

    if (choice === 'r') {
      regenerateCount++;
      const fb = await askFeedback();
      if (fb) feedbacks.push(fb);
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
      userFeedbacks: feedbacks,
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
  const feedbacks: string[] = [];

  while (true) {
    renderCourseList(courses);

    const choice = await selectCourse(courses.length);

    if (choice === 'r') {
      regenerateCount++;
      const fb = await askFeedback();
      if (fb) feedbacks.push(fb);
      // Re-fetch with same query for fresh results
      try {
        const newResponse = await api.recommend({
          query: rawQuery,
          region: response.intent.region || undefined,
          people_count: response.intent.people_count || undefined,
          response_type: 'course',
          feedback: fb || undefined,
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
      const { course_hash } = await api.saveCourse({
        course: selectedCourse!,
        meta: {
          raw_query: rawQuery,
          region: response.intent.region,
          vibe: response.intent.vibe,
          activity_type: response.intent.activity_type,
          season: response.intent.season,
          people_count: response.intent.people_count,
          mode: response.intent.mode,
          response_type: 'course',
        },
      });
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
    userFeedbacks: feedbacks,
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
  userFeedbacks?: string[];
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
    user_feedbacks: params.userFeedbacks?.length ? params.userFeedbacks : undefined,
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
