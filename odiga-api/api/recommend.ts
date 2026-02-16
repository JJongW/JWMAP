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
import { queryPlaces } from '../lib/places';
import { scorePlaces } from '../lib/scoring';
import { buildCourses, type Course } from '../lib/courseBuilder';
import { planMode } from '../lib/modePlanner';
import { getReusableCourses, touchReusedCourses } from '../lib/savedCourses';

const SINGLE_RESULT_COUNT = 5;
const COURSE_RESULT_COUNT = 4;

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORS(res);
  if (handlePreflight(req, res)) return;
  if (!validateMethod(req, res, 'POST')) return;

  const allowed = await checkRateLimit(req, res, 'recommend');
  if (!allowed) return;

  const { query: rawQuery, region, people_count, mode, response_type } = req.body || {};

  const query = sanitizeQuery(rawQuery);
  if (!query) {
    return safeError(res, 400, 'Missing or invalid "query" field (1-500 chars)');
  }

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

    const scored = scorePlaces(places, intent);

    const responsePlaces = scored.slice(0, SINGLE_RESULT_COUNT);
    let courses: Course[] = [];

    if (intent.response_type === 'course') {
      const modeConfig = planMode(intent.people_count!, intent.mode);
      const generatedCourses = buildCourses(scored, modeConfig, intent.vibe, COURSE_RESULT_COUNT);

      const reusable = await getReusableCourses(intent, COURSE_RESULT_COUNT);
      const reusedCourses = reusable.map((item) => item.course);

      courses = mergeCourses(reusedCourses, generatedCourses, COURSE_RESULT_COUNT);
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
