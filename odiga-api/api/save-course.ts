import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';
import { checkRateLimit } from '../lib/rateLimit';
import { setCORS, handlePreflight, validateMethod, safeError, sanitizeQuery } from '../lib/security';
import { getSupabase } from '../lib/places';
import {
  extractCoursePlaceIds,
  validateCourseData,
  verifyCoursePlacesExist,
  type SavedCourseMeta,
} from '../lib/savedCourses';

function hashCourse(course: { steps: { place: { id: string } }[] }): string {
  const key = course.steps.map((s) => s.place.id).join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

function normalizeCoursePayload(course: unknown): { steps: { place: { id: string; name?: string; region?: string } }[] } | null {
  if (!course || typeof course !== 'object') return null;

  const asRecord = course as {
    steps?: unknown;
    places?: Array<{ place_id?: unknown; name?: unknown; region?: unknown }>;
  };

  if (Array.isArray(asRecord.steps)) {
    return asRecord.steps as { steps: { place: { id: string; name?: string; region?: string } }[] };
  }

  if (!Array.isArray(asRecord.places)) return null;

  const steps = asRecord.places
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as { place_id?: unknown; name?: unknown; region?: unknown };
      if (typeof item.place_id !== 'string') return null;

      return {
        place: {
          id: item.place_id,
          name: typeof item.name === 'string' ? item.name : undefined,
          region: typeof item.region === 'string' ? item.region : undefined,
        },
      };
    })
    .filter((step): step is { place: { id: string; name?: string; region?: string } } => Boolean(step));

  if (steps.length < 2) return null;
  return { steps };
}

function normalizeMeta(rawMeta: unknown): SavedCourseMeta {
  if (!rawMeta || typeof rawMeta !== 'object') return {};

  const meta = rawMeta as Record<string, unknown>;
  return {
    raw_query: sanitizeQuery(meta.raw_query),
    region: typeof meta.region === 'string' ? meta.region : null,
    activity_type: typeof meta.activity_type === 'string' ? meta.activity_type : null,
    vibe: Array.isArray(meta.vibe) ? meta.vibe.filter((v): v is string => typeof v === 'string') : [],
    season: typeof meta.season === 'string' ? meta.season : null,
    people_count: typeof meta.people_count === 'number' ? meta.people_count : null,
    mode: typeof meta.mode === 'string' ? meta.mode : null,
    response_type: typeof meta.response_type === 'string' ? meta.response_type : 'course',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORS(res);
  if (handlePreflight(req, res)) return;
  if (!validateMethod(req, res, 'POST')) return;

  const allowed = await checkRateLimit(req, res, 'save-course');
  if (!allowed) return;

  const { course, meta } = req.body || {};
  const normalizedCourse = normalizeCoursePayload(course);
  if (!normalizedCourse) {
    return safeError(res, 400, 'Invalid course payload');
  }

  const basicValidation = validateCourseData(normalizedCourse);
  if (!basicValidation.isValid) {
    return safeError(res, 400, `Invalid course: ${basicValidation.reason}`);
  }

  try {
    const existenceValidation = await verifyCoursePlacesExist(basicValidation.placeIds);
    if (!existenceValidation.isValid) {
      return safeError(res, 400, `Course verification failed: ${existenceValidation.reason}`);
    }

    const validatedCourse = normalizedCourse;
    const courseHash = hashCourse(validatedCourse);
    const placeIds = extractCoursePlaceIds(validatedCourse);
    const normalizedMeta = normalizeMeta(meta);
    const now = new Date().toISOString();

    const { error } = await getSupabase().from('odiga_saved_courses').upsert(
      {
        course_hash: courseHash,
        course_data: normalizedCourse,
        source_query: normalizedMeta.raw_query ?? null,
        region: normalizedMeta.region ?? null,
        activity_type: normalizedMeta.activity_type ?? null,
        vibe: normalizedMeta.vibe ?? [],
        season: normalizedMeta.season ?? null,
        people_count: normalizedMeta.people_count ?? null,
        mode: normalizedMeta.mode ?? null,
        response_type: 'course',
        place_ids: placeIds,
        validation_status: 'verified',
        validation_reason: null,
        updated_at: now,
      },
      { onConflict: 'course_hash' },
    );

    if (error) {
      console.error('[odiga/save-course] Supabase error:', error.message);
      return safeError(res, 500, 'Failed to save course');
    }

    return res.status(200).json({ ok: true, course_hash: courseHash });
  } catch (error) {
    console.error('[odiga/save-course] Error:', error instanceof Error ? error.message : error);
    return safeError(res, 500, 'Internal server error');
  }
}
