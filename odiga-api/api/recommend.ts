import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../lib/rateLimit';
import {
  setCORS,
  handlePreflight,
  validateMethod,
  sanitizeQuery,
  toPositiveInt,
  validateMode,
  validateResponseType,
  safeError,
} from '../lib/security';
import { parseIntent, applyServerDefaults } from '../lib/intent';
import { getPlaceActivityBucket, queryPlaces } from '../lib/places';
import { scorePlaces } from '../lib/scoring';
import { buildCourses, type Course } from '../lib/courseBuilder';
import { planMode } from '../lib/modePlanner';
import { getReusableCourses, touchReusedCourses } from '../lib/savedCourses';

const SINGLE_RESULT_COUNT = 5;
const COURSE_RESULT_COUNT = 4;
const MAX_EXCLUDE_PLACE_IDS = 50;
const FEEDBACK_STOPWORDS = new Set([
  '추천', '다시', '별로', '마음', '안', '그냥', '좀', '너무', '같아요', '같아', '입니다',
  '장소', '코스', '원해요', '원함', '좋아요', '싫어요', '싶어요', '찾고', '찾기',
]);

function mergeCourses(savedCourses: Course[], generatedCourses: Course[], limit: number): Course[] {
  const seen = new Set<string>();
  const merged: Course[] = [];

  const keyOf = (course: Course) => course.steps.map((s) => s.place.id).join('|');

  for (const course of [...savedCourses, ...generatedCourses]) {
    const key = keyOf(course);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(course);
    if (merged.length >= limit) break;
  }

  return merged.map((course, index) => ({
    ...course,
    id: index + 1,
  }));
}

function sanitizeFeedback(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().slice(0, 500);
  return cleaned.length > 0 ? cleaned : null;
}

function sanitizeExcludePlaceIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, MAX_EXCLUDE_PLACE_IDS);
}

function extractFeedbackKeywords(feedback: string): string[] {
  return feedback
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !FEEDBACK_STOPWORDS.has(token));
}

function feedbackAdjustedScore(
  place: { score: number; name: string; memo?: string; short_desc?: string; tags?: string[] },
  keywords: string[],
): number {
  if (keywords.length === 0) return place.score;
  const searchText = `${place.name} ${place.memo || ''} ${place.short_desc || ''} ${(place.tags || []).join(' ')}`.toLowerCase();
  const hits = keywords.reduce((count, keyword) => (searchText.includes(keyword) ? count + 1 : count), 0);
  const penalty = Math.min(0.45, hits * 0.12);
  return place.score - penalty;
}

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function hasAttractionStep(course: Course): boolean {
  return course.steps.some((step) => getPlaceActivityBucket(step.place) === '볼거리');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORS(res);
  if (handlePreflight(req, res)) return;
  if (!validateMethod(req, res, 'POST')) return;

  const allowed = await checkRateLimit(req, res, 'recommend');
  if (!allowed) return;

  const {
    query: rawQuery,
    region,
    people_count,
    mode,
    response_type,
    feedback: rawFeedback,
    exclude_place_ids: rawExcludePlaceIds,
  } = req.body || {};

  const query = sanitizeQuery(rawQuery);
  if (!query) {
    return safeError(res, 400, 'Missing or invalid "query" field (1-500 chars)');
  }
  const feedback = sanitizeFeedback(rawFeedback);
  const excludePlaceIds = sanitizeExcludePlaceIds(rawExcludePlaceIds);
  const excludedSet = new Set(excludePlaceIds);

  const startTime = Date.now();

  try {
    const llmStart = Date.now();
    const { intent: rawIntent, parseErrors } = await parseIntent(query);
    const llmMs = Date.now() - llmStart;

    const intent = applyServerDefaults(rawIntent, {
      region: typeof region === 'string' ? region : null,
      people_count: toPositiveInt(people_count),
      mode: validateMode(mode),
      response_type: validateResponseType(response_type),
    });

    const dbStart = Date.now();
    const places = await queryPlaces(intent);
    const dbMs = Date.now() - dbStart;

    if (places.length === 0) {
      return res.status(200).json({
        type: intent.response_type,
        places: [],
        courses: [],
        intent,
        parseErrors,
        timing: { llmMs, dbMs, totalMs: Date.now() - startTime },
      });
    }

    const scored = scorePlaces(places, intent).filter((place) => !excludedSet.has(place.id));
    const feedbackKeywords = feedback ? extractFeedbackKeywords(feedback) : [];
    const rescored = [...scored]
      .map((place) => ({
        ...place,
        score: feedbackAdjustedScore(place, feedbackKeywords),
      }))
      .sort((a, b) => b.score - a.score);

    if (feedback && rescored.length > 1) {
      const rotateBy = hashText(feedback) % Math.min(3, rescored.length);
      if (rotateBy > 0) {
        rescored.push(...rescored.splice(0, rotateBy));
      }
    }

    const responsePlaces = rescored.slice(0, SINGLE_RESULT_COUNT);
    let courses: Course[] = [];

    if (intent.response_type === 'course') {
      const modeConfig = planMode(intent.people_count!, intent.mode);
      const generatedCourses = buildCourses(
        rescored,
        modeConfig,
        intent.vibe,
        intent.activity_type,
        COURSE_RESULT_COUNT,
      );

      const reusable = await getReusableCourses(intent, COURSE_RESULT_COUNT);
      let reusedCourses = reusable.map((item) => item.course);
      let finalGenerated = generatedCourses;

      const hasAttractionCandidate = rescored.some((place) => getPlaceActivityBucket(place) === '볼거리');
      if (hasAttractionCandidate) {
        const reusableWithAttraction = reusedCourses.filter(hasAttractionStep);
        const generatedWithAttraction = generatedCourses.filter(hasAttractionStep);
        if (reusableWithAttraction.length > 0 || generatedWithAttraction.length > 0) {
          reusedCourses = reusableWithAttraction;
          finalGenerated = generatedWithAttraction;
        }
      }

      courses = mergeCourses(reusedCourses, finalGenerated, COURSE_RESULT_COUNT);
      void touchReusedCourses(reusable).catch(() => {
        // Usage tracking failure should not affect recommendations.
      });
    }

    const totalMs = Date.now() - startTime;

    return res.status(200).json({
      type: intent.response_type,
      places: responsePlaces,
      courses,
      intent,
      parseErrors,
      timing: { llmMs, dbMs, totalMs },
    });
  } catch (error) {
    console.error('[odiga/recommend] Error:', error instanceof Error ? error.message : error);
    return safeError(res, 500, 'Internal server error');
  }
}
