import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from './lib/rateLimit';
import {
  setCORS,
  handlePreflight,
  validateMethod,
  sanitizeQuery,
  toPositiveInt,
  validateMode,
  validateResponseType,
  safeError,
} from './lib/security';
import { parseIntent, applyServerDefaults } from './lib/intent';
import { queryPlaces } from './lib/places';
import { scorePlaces } from './lib/scoring';
import { buildCourses } from './lib/courseBuilder';
import { planMode } from './lib/modePlanner';

const SINGLE_RESULT_COUNT = 5;

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
    // 1. Parse intent with LLM
    const llmStart = Date.now();
    const { intent: rawIntent, parseErrors } = await parseIntent(query);
    const llmMs = Date.now() - llmStart;

    // 2. Apply server defaults + client overrides
    const intent = applyServerDefaults(rawIntent, {
      region: typeof region === 'string' ? region : null,
      people_count: toPositiveInt(people_count),
      mode: validateMode(mode),
      response_type: validateResponseType(response_type),
    });

    // 3. Query places from Supabase
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

    // 4. Score places
    const scored = scorePlaces(places, intent);

    // 5. Build response based on type
    let responsePlaces = scored.slice(0, SINGLE_RESULT_COUNT);
    let courses: ReturnType<typeof buildCourses> = [];

    if (intent.response_type === 'course') {
      const modeConfig = planMode(intent.people_count!, intent.mode);
      courses = buildCourses(scored, modeConfig, intent.vibe);
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
