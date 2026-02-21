#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { api, ApiError } from './api/client.js';
import type {
  BrandedPlace,
  Course,
  BrandedRecommendResponse,
} from './api/types.js';
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
import {
  selectPlace,
  selectCourse,
  confirmSave,
  askFeedback,
  askNewSearchQuery,
  askRegion,
} from './ui/prompts.js';
import { sanitizeQuery } from './utils/validators.js';
import { c } from './ui/colors.js';
import pkg from '../package.json' with { type: 'json' };

const PACKAGE_NAME = pkg.name;
const CURRENT_VERSION = pkg.version;
const UPDATE_CHECK_TIMEOUT_MS = 2000;
type FlowAction =
  | { type: 'done' }
  | { type: 'new-search'; query: string }
  | { type: 'exit' };

function compareVersions(a: string, b: string): number {
  const splitParts = (value: string): number[] => value
    .split('-')[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);

  const aParts = splitParts(a);
  const bParts = splitParts(b);
  const maxLen = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < maxLen; i += 1) {
    const aValue = aParts[i] ?? 0;
    const bValue = bParts[i] ?? 0;
    if (aValue > bValue) return 1;
    if (aValue < bValue) return -1;
  }
  return 0;
}

function isVersionGreater(nextVersion: string, currentVersion: string): boolean {
  return compareVersions(nextVersion, currentVersion) > 0;
}

async function checkForCliUpdate(): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT_MS);
    const response = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return;

    const payload = (await response.json()) as { ['dist-tags']?: { latest?: string } };
    const latestVersion = payload['dist-tags']?.latest;
    if (!latestVersion || !isVersionGreater(latestVersion, CURRENT_VERSION)) return;

    console.log();
    console.log(c.warn('  새로운 업데이트가 있습니다.'));
    console.log(c.dim(`  현재: ${CURRENT_VERSION} / 최신: ${latestVersion}`));
    console.log(c.dim(`  업데이트: npm install -g ${PACKAGE_NAME}@latest`));
    console.log();
  } catch {
    // Update check should never block normal flow.
  }
}

function printUsage(): void {
  console.log(c.subtitle('  사용법:'));
  console.log(c.dim('    odiga "오늘 점심 뭐 먹을까?"'));
  console.log(c.dim('    odiga "홍대 감성 카페"'));
  console.log(c.dim('    odiga "강남 데이트 코스 짜줘"'));
  console.log(c.dim('    odiga stats'));
  console.log(c.dim('    odiga update'));
  console.log(c.dim('    odiga --help'));
  console.log();
}

async function runUpdateCommand(): Promise<void> {
  console.log(c.dim(`  ${PACKAGE_NAME} 최신 버전으로 업데이트 중...`));
  await new Promise<void>((resolve, reject) => {
    const child = spawn('npm', ['install', '-g', `${PACKAGE_NAME}@latest`], {
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(signal
        ? `프로세스가 ${signal} 시그널로 종료되었습니다.`
        : `종료 코드: ${code}`
      ));
    });
  });
  console.log(c.success('  업데이트 완료.'));
}

/** Detect region from query using station/landmark → region mapping */
function detectRegion(query: string): string | undefined {
  const stationToRegion: [string, string][] = [
    ['서울대입구', '구로/관악/동작'], ['신림', '구로/관악/동작'], ['봉천', '구로/관악/동작'],
    ['낙성대', '구로/관악/동작'], ['사당', '구로/관악/동작'], ['이수', '구로/관악/동작'],
    ['노량진', '구로/관악/동작'], ['관악', '구로/관악/동작'], ['동작', '구로/관악/동작'],
    ['압구정', '강남'], ['선릉', '강남'], ['역삼', '강남'], ['삼성', '강남'],
    ['논현', '강남'], ['학동', '강남'], ['청담', '강남'], ['도산', '강남'],
    ['가로수길', '강남'], ['코엑스', '강남'], ['봉은사', '강남'], ['강남', '강남'],
    ['교대', '서초'], ['방배', '서초'], ['서래마을', '서초'], ['양재', '서초'],
    ['반포', '서초'], ['고속터미널', '서초'], ['내방', '서초'], ['서초', '서초'],
    ['을지로', '종로/중구'], ['명동', '종로/중구'], ['광화문', '종로/중구'],
    ['경복궁', '종로/중구'], ['북촌', '종로/중구'], ['서촌', '종로/중구'],
    ['익선동', '종로/중구'], ['동대문', '종로/중구'], ['안국', '종로/중구'],
    ['인사동', '종로/중구'], ['충무로', '종로/중구'], ['시청', '종로/중구'],
    ['종로', '종로/중구'],
    ['뚝섬', '건대/성수/왕십리'], ['왕십리', '건대/성수/왕십리'], ['성수', '건대/성수/왕십리'],
    ['건대', '건대/성수/왕십리'], ['서울숲', '건대/성수/왕십리'],
    ['여의나루', '영등포/여의도/강서'], ['여의도', '영등포/여의도/강서'],
    ['영등포', '영등포/여의도/강서'], ['당산', '영등포/여의도/강서'],
    ['홍대', '홍대/합정/마포/연남'], ['합정', '홍대/합정/마포/연남'],
    ['상수', '홍대/합정/마포/연남'], ['망원', '홍대/합정/마포/연남'],
    ['연남', '홍대/합정/마포/연남'], ['마포', '홍대/합정/마포/연남'],
    ['공덕', '홍대/합정/마포/연남'],
    ['이태원', '용산/이태원/한남'], ['한남', '용산/이태원/한남'],
    ['해방촌', '용산/이태원/한남'], ['경리단길', '용산/이태원/한남'],
    ['녹사평', '용산/이태원/한남'], ['용산', '용산/이태원/한남'],
    ['잠실', '잠실/송파/강동'], ['송파', '잠실/송파/강동'],
    ['천호', '잠실/송파/강동'], ['올림픽공원', '잠실/송파/강동'],
    ['석촌', '잠실/송파/강동'], ['문정', '잠실/송파/강동'],
    ['신촌', '신촌/연희'], ['이대', '신촌/연희'], ['연희', '신촌/연희'],
    ['혜화', '성북/노원/중랑'], ['대학로', '성북/노원/중랑'],
    ['성북', '성북/노원/중랑'], ['노원', '성북/노원/중랑'],
    ['가산디지털단지', '금천/가산'], ['구로디지털단지', '금천/가산'],
    ['가산', '금천/가산'], ['금천', '금천/가산'], ['구로', '구로/관악/동작'],
    ['회기', '회기/청량리'], ['청량리', '회기/청량리'],
    ['창동', '창동/도봉산'], ['도봉산', '창동/도봉산'],
    ['연신내', '연신내/구파발'], ['불광', '연신내/구파발'],
    ['미아', '미아/수유/북한산'], ['수유', '미아/수유/북한산'],
    ['목동', '목동/양천'],
    ['마곡', '마곡/김포'], ['발산', '마곡/김포'], ['김포공항', '마곡/김포'],
    ['강동', '강동/고덕'], ['고덕', '강동/고덕'],
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

function rankFromId(index: number): 1 | 2 | 3 | 4 | 5 {
  return Math.min(5, Math.max(1, index + 1)) as 1 | 2 | 3 | 4 | 5;
}

async function runSingleMode(
  rawQuery: string,
  response: BrandedRecommendResponse,
): Promise<FlowAction> {
  let places: BrandedPlace[] = response.places.map((entry, index) => ({
    ...entry,
    rank: rankFromId(index),
  }));
  let regenerateCount = 0;
  const feedbacks: string[] = [];
  const excludedPlaceIds = new Set<string>();

  if (places.length === 0) { renderNoResults(); return { type: 'done' }; }

  while (true) {
    renderPlaceList(places);

    const choice = await selectPlace(places.length);

    if (choice === 'r') {
      regenerateCount++;
      const fb = await askFeedback();
      if (fb) feedbacks.push(fb);

      places.forEach((place) => excludedPlaceIds.add(place.place.id));

      try {
        const regenerated = await api.recommend({
          query: rawQuery,
          region: response.intent.region || undefined,
          people_count: response.intent.people_count || undefined,
          response_type: 'single',
          feedback: fb || undefined,
          exclude_place_ids: [...excludedPlaceIds],
        });
        places = regenerated.places.map((entry, index) => ({
          ...entry,
          rank: rankFromId(index),
        }));
        if (places.length === 0) {
          renderNoResults();
          return { type: 'done' };
        }
      } catch {
        places = [...places].sort(() => Math.random() - 0.5);
      }
      continue;
    }

    if (choice === 'n') {
      const nextQuery = sanitizeQuery(await askNewSearchQuery());
      if (!nextQuery) {
        console.log(c.warn('  검색어가 비어 있어요.'));
        continue;
      }
      return { type: 'new-search', query: nextQuery };
    }

    if (choice === 'q') {
      console.log(c.dim('  추천을 종료합니다.'));
      return { type: 'exit' };
    }

    const selected = places[choice - 1];
    if (!selected) {
      console.log(c.warn('  잘못된 선택입니다.'));
      continue;
    }

    renderPlaceDetail(selected);
    return { type: 'done' };
  }
}

async function runCourseMode(
  rawQuery: string,
  response: BrandedRecommendResponse,
): Promise<FlowAction> {
  let courses: Course[] = response.courses;
  if (courses.length === 0) { renderNoResults(); return { type: 'done' }; }

  let selectedCourse: Course | null = null;
  let regenerateCount = 0;
  const feedbacks: string[] = [];
  const excludedPlaceIds = new Set<string>();

  while (true) {
    renderCourseList(courses);

    const choice = await selectCourse(courses.length);

    if (choice === 'r') {
      regenerateCount++;
      const fb = await askFeedback();
      if (fb) feedbacks.push(fb);

      courses.forEach((course) => {
        course.places.forEach((step) => excludedPlaceIds.add(step.place_id));
      });

      try {
        const newResponse = await api.recommend({
          query: rawQuery,
          region: response.intent.region || undefined,
          people_count: response.intent.people_count || undefined,
          response_type: 'course',
          feedback: fb || undefined,
          exclude_place_ids: [...excludedPlaceIds],
        });
        courses = newResponse.courses;
        if (courses.length === 0) { renderNoResults(); return { type: 'done' }; }
      } catch {
        courses = [...courses].sort(() => Math.random() - 0.5);
      }
      continue;
    }

    if (choice === 'n') {
      const nextQuery = sanitizeQuery(await askNewSearchQuery());
      if (!nextQuery) {
        console.log(c.warn('  검색어가 비어 있어요.'));
        continue;
      }
      return { type: 'new-search', query: nextQuery };
    }

    if (choice === 'q') {
      console.log(c.dim('  추천을 종료합니다.'));
      return { type: 'exit' };
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

  return { type: 'done' };
}

function logSilent(params: {
  rawQuery: string;
  intent: BrandedRecommendResponse['intent'];
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

async function requestRecommendation(query: string, region?: string, peopleCount?: number): Promise<BrandedRecommendResponse> {
  return api.recommend({
    query,
    region,
    people_count: peopleCount,
  });
}

async function resolveRegionFromResponse(query: string, response: BrandedRecommendResponse): Promise<string | null> {
  if (response.intent.region) {
    return response.intent.region;
  }

  const responseDidNotPickRegion = response.parseErrors.includes('region');
  if (!responseDidNotPickRegion) {
    return null;
  }

  const regionInput = sanitizeQuery(await askRegion());
  if (!regionInput) {
    return null;
  }

  return regionInput;
}

async function runSearch(rawQuery: string): Promise<FlowAction> {
  const query = sanitizeQuery(rawQuery);
  if (!query) {
    console.log(c.warn('  유효한 검색어를 입력해주세요.'));
    return { type: 'done' };
  }
  console.log(c.dim(`  ${c.emoji.search}  "${query}" 분석 중...`));
  console.log();

  let response = await requestRecommendation(
    query,
    detectRegion(query),
    detectPeopleCount(query),
  );

  if (!response.intent.region) {
    const regionInput = await resolveRegionFromResponse(query, response);
    if (regionInput) {
      response = await requestRecommendation(
        query,
        regionInput,
        response.intent.people_count || undefined,
      );
    }
  }

  if (!response.intent.region) {
    console.log(c.warn('  지역 정보를 확인할 수 없어요. 지역을 더 구체적으로 입력해주세요.'));
    return { type: 'done' };
  }

  logSilent({
    rawQuery: query,
    intent: response.intent,
    mode: response.intent.mode || (response.type === 'course' ? 'course' : 'single'),
    parseErrors: response.parseErrors,
  });

  console.log(c.dim(`  ${response.type === 'course' ? '코스' : '장소'} 추천 | 지역: ${response.intent.region} | 시즌: ${response.intent.season}`));
  console.log(c.dim(`  오늘오디가의 요약: ${response.curated_summary}`));
  console.log(c.dim(`  신뢰도: ${response.confidence}`));
  console.log();

  if (response.type === 'course') {
    return runCourseMode(query, response);
  }
  return runSingleMode(query, response);
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
  const shouldShowHelp = args.includes('--help') || args.includes('-h');
  const isUpdateCommand = args[0] === 'update';
  const isStatsCommand = args[0] === 'stats';

  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  if (shouldShowHelp || args[0] === 'help') {
    printUsage();
    process.exit(0);
  }

  if (isUpdateCommand) {
    await runUpdateCommand();
    return;
  }

  await checkForCliUpdate();

  if (isStatsCommand) {
    await runStats();
    process.exit(0);
  }

  const query = args.join(' ');
  let nextQuery: string | null = query;
  while (nextQuery) {
    const action = await runSearch(nextQuery);
    if (action.type === 'new-search') {
      nextQuery = action.query;
      continue;
    }
    break;
  }
}

main().catch((err) => {
  if (err instanceof ApiError) {
    console.error(c.error(`\n  ${err.message}\n`));
  } else {
    console.error(c.error(`\n  오류가 발생했어요: ${err.message}\n`));
  }
  process.exit(1);
});
