import { AdminLayout } from '@/components/layout/AdminLayout';
import { CourseBuilder } from '@/components/courses/CourseBuilder';
import { createServerSupabase } from '@/lib/supabase/server';

export interface SavedCourseRow {
  id: string;
  course_hash: string;
  source_query: string | null;
  region: string | null;
  activity_type: string | null;
  usage_count: number | null;
  validation_status: string | null;
  created_at: string;
  place_ids: string[] | null;
  // course_data can be any JSON shape depending on whether it was saved by
  // the admin builder or the odiga CLI — keep as unknown for flexible parsing
  course_data: unknown;
}

async function getInitialCourses(): Promise<{ courses: SavedCourseRow[]; error: string | null }> {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('odiga_saved_courses')
      .select('id, course_hash, source_query, region, activity_type, usage_count, validation_status, created_at, place_ids, course_data')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return { courses: [], error: error.message };
    return { courses: (data ?? []) as SavedCourseRow[], error: null };
  } catch (e) {
    return { courses: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function CoursesPage() {
  const { courses, error } = await getInitialCourses();

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">코스 관리</h1>
          <p className="text-xs text-muted-foreground mt-1">
            장소명 + 한 줄 느낌만 입력하면 AI가 태그/카테고리/큐레이션 레벨을 보강하고, 장소 중복을 검사해 자동 저장합니다.
          </p>
        </div>
        <CourseBuilder initialCourses={courses} fetchError={error} />
      </div>
    </AdminLayout>
  );
}
