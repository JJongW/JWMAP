import type { Course } from './courseBuilder';
import type { ParsedIntent } from './intent';
import { getSupabase } from './places';

interface SavedCourseRow {
  id: string;
  course_hash: string;
  course_data: unknown;
  source_query: string | null;
  region: string | null;
  activity_type: string | null;
  vibe: string[] | null;
  season: string | null;
  people_count: number | null;
  mode: string | null;
  response_type: string | null;
  place_ids: string[] | null;
  validation_status: string | null;
  validation_reason: string | null;
  usage_count: number | null;
  created_at: string;
}

export interface SavedCourseMeta {
  raw_query?: string | null;
  region?: string | null;
  activity_type?: string | null;
  vibe?: string[];
  season?: string | null;
  people_count?: number | null;
  mode?: string | null;
  response_type?: string | null;
}

export interface CourseValidationResult {
  isValid: boolean;
  reason: string | null;
  placeIds: string[];
}

export interface ReusableCourse {
  rowId: string;
  hash: string;
  usageCount: number;
  course: Course;
}

function toUniqueStringArray(values: unknown[]): string[] {
  return [...new Set(values.filter((v): v is string => typeof v === 'string' && v.length > 0))];
}

function normalizeCourse(data: unknown): Course | null {
  if (!data || typeof data !== 'object') return null;

  const course = data as Partial<Course>;
  if (!Array.isArray(course.steps) || course.steps.length < 2) return null;

  const hasInvalidStep = course.steps.some(
    (s) => !s || typeof s !== 'object' || !s.place || typeof s.place.id !== 'string',
  );

  if (hasInvalidStep) return null;

  return course as Course;
}

export function extractCoursePlaceIds(course: { steps: Array<{ place: { id: string } }> }): string[] {
  return toUniqueStringArray(course.steps.map((step) => step.place.id));
}

export function validateCourseData(course: unknown): CourseValidationResult {
  const normalized = normalizeCourse(course);
  if (!normalized) {
    return { isValid: false, reason: 'invalid_course_structure', placeIds: [] };
  }

  const placeIds = extractCoursePlaceIds(normalized as { steps: Array<{ place: { id: string } }> });

  if (placeIds.length < 2) {
    return { isValid: false, reason: 'at_least_two_unique_places_required', placeIds };
  }

  return { isValid: true, reason: null, placeIds };
}

export async function verifyCoursePlacesExist(placeIds: string[]): Promise<CourseValidationResult> {
  if (placeIds.length === 0) {
    return { isValid: false, reason: 'no_place_ids', placeIds: [] };
  }

  const { data, error } = await getSupabase()
    .from('locations')
    .select('id')
    .in('id', placeIds);

  if (error) {
    return { isValid: false, reason: `location_lookup_failed:${error.message}`, placeIds };
  }

  const foundIds = new Set((data ?? []).map((row) => row.id as string));
  const missing = placeIds.filter((id) => !foundIds.has(id));

  if (missing.length > 0) {
    return { isValid: false, reason: `missing_place_ids:${missing.join(',')}`, placeIds };
  }

  return { isValid: true, reason: null, placeIds };
}

function calcReuseScore(row: SavedCourseRow, intent: ParsedIntent): number {
  let score = 0;

  if (row.region && intent.region && row.region === intent.region) score += 4;
  if (row.activity_type && intent.activity_type && row.activity_type === intent.activity_type) score += 3;
  if (row.season && intent.season && row.season === intent.season) score += 2;
  if (row.mode && intent.mode && row.mode === intent.mode) score += 1;

  if (
    typeof row.people_count === 'number' &&
    typeof intent.people_count === 'number' &&
    Math.abs(row.people_count - intent.people_count) <= 1
  ) {
    score += 1;
  }

  const vibeOverlap = (row.vibe ?? []).filter((v) => intent.vibe.includes(v)).length;
  score += vibeOverlap * 1.5;

  const usageCount = row.usage_count ?? 0;
  score += Math.min(2, usageCount * 0.1);

  return score;
}

function courseKey(course: Course): string {
  return course.steps.map((s) => s.place.id).join('|');
}

export async function getReusableCourses(intent: ParsedIntent, limit: number = 3): Promise<ReusableCourse[]> {
  const { data, error } = await getSupabase()
    .from('odiga_saved_courses')
    .select(
      'id, course_hash, course_data, source_query, region, activity_type, vibe, season, people_count, mode, response_type, place_ids, validation_status, validation_reason, usage_count, created_at',
    )
    .order('usage_count', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.warn('[odiga/savedCourses] fetch failed:', error.message);
    return [];
  }

  const rows = (data ?? []) as SavedCourseRow[];
  const scored = rows
    .filter((row) => (row.response_type ?? 'course') === 'course')
    .filter((row) => row.validation_status !== 'invalid')
    .map((row) => {
      const course = normalizeCourse(row.course_data);
      if (!course) return null;

      const score = calcReuseScore(row, intent);
      return {
        rowId: row.id,
        hash: row.course_hash,
        usageCount: row.usage_count ?? 0,
        course,
        score,
      };
    })
    .filter((item): item is { rowId: string; hash: string; usageCount: number; course: Course; score: number } => Boolean(item))
    .filter((item) => item.score >= 1)
    .sort((a, b) => b.score - a.score || b.usageCount - a.usageCount)
    .slice(0, Math.max(limit * 2, 6));

  const dedup = new Set<string>();
  const reused: ReusableCourse[] = [];

  for (const item of scored) {
    const key = courseKey(item.course);
    if (dedup.has(key)) continue;
    dedup.add(key);

    reused.push({
      rowId: item.rowId,
      hash: item.hash,
      usageCount: item.usageCount,
      course: item.course,
    });

    if (reused.length >= limit) break;
  }

  return reused;
}

export async function touchReusedCourses(courses: ReusableCourse[]): Promise<void> {
  if (courses.length === 0) return;

  const now = new Date().toISOString();
  await Promise.all(
    courses.map(async (course) => {
      const { error } = await getSupabase()
        .from('odiga_saved_courses')
        .update({
          usage_count: course.usageCount + 1,
          last_used_at: now,
          updated_at: now,
        })
        .eq('id', course.rowId);

      if (error) {
        console.warn('[odiga/savedCourses] usage update failed:', error.message);
      }
    }),
  );
}
