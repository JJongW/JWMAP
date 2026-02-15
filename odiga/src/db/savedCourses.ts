import { createHash } from 'crypto';
import { getSupabase } from './supabase.js';
import type { Course } from '../engine/courseBuilder.js';

function hashCourse(course: Course): string {
  const key = course.steps.map((s) => s.place.id).join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export async function saveCourse(course: Course): Promise<string> {
  const courseHash = hashCourse(course);

  const { error } = await getSupabase().from('odiga_saved_courses').upsert({
    course_hash: courseHash,
    course_data: course,
    created_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to save course: ${error.message}`);
  }

  return courseHash;
}

export async function getSavedCourses(): Promise<Course[]> {
  const { data, error } = await getSupabase()
    .from('odiga_saved_courses')
    .select('course_data')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Failed to get saved courses: ${error.message}`);
  }

  return (data || []).map((row) => row.course_data as Course);
}
