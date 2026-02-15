import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';
import { checkRateLimit } from '../lib/rateLimit';
import { setCORS, handlePreflight, validateMethod, safeError } from '../lib/security';
import { getSupabase } from '../lib/places';

function hashCourse(course: { steps: { place: { id: string } }[] }): string {
  const key = course.steps.map((s) => s.place.id).join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORS(res);
  if (handlePreflight(req, res)) return;
  if (!validateMethod(req, res, 'POST')) return;

  const allowed = await checkRateLimit(req, res, 'save-course');
  if (!allowed) return;

  const { course } = req.body || {};

  if (!course || !Array.isArray(course.steps) || course.steps.length === 0) {
    return safeError(res, 400, 'Missing or invalid "course" with steps');
  }

  // Validate steps have place.id
  const validSteps = course.steps.every(
    (s: unknown) => s && typeof s === 'object' && 'place' in (s as Record<string, unknown>) &&
      typeof (s as { place: { id: unknown } }).place?.id === 'string'
  );
  if (!validSteps) {
    return safeError(res, 400, 'Each step must have a place with an id');
  }

  try {
    const courseHash = hashCourse(course);

    const { error } = await getSupabase().from('odiga_saved_courses').upsert({
      course_hash: courseHash,
      course_data: course,
      created_at: new Date().toISOString(),
    });

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
