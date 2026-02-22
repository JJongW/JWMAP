'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { SavedCourseRow } from '@/app/courses/page';

interface DraftPlace {
  id: string;
  name: string;
  note: string;
}

/**
 * course_data 에서 장소명 배열을 추출한다.
 * odiga CLI 저장 포맷과 admin 빌더 포맷 모두 처리한다.
 *
 * 지원하는 구조:
 *   A) { steps: [{ place: { name } }] }              ← admin builder / odiga API
 *   B) { course: { steps: [{ place: { name } }] } }  ← 일부 CLI 변형
 *   C) { places: [{ name }] }                        ← 단순 places 배열
 *   D) [{ place: { name } }]                         ← steps 배열 자체가 루트
 */
function extractPlaceNames(courseData: unknown): string[] {
  if (!courseData || typeof courseData !== 'object') return [];
  const d = courseData as Record<string, unknown>;

  // A: { steps: [...] }
  if (Array.isArray(d.steps)) {
    const names = d.steps
      .map((s) => (s as Record<string, unknown>)?.place)
      .map((p) => (p as Record<string, unknown>)?.name)
      .filter((n): n is string => typeof n === 'string' && n.length > 0);
    if (names.length) return names;
  }

  // B: { course: { steps: [...] } }
  const inner = d.course as Record<string, unknown> | undefined;
  if (inner && Array.isArray(inner.steps)) {
    const names = inner.steps
      .map((s) => (s as Record<string, unknown>)?.place)
      .map((p) => (p as Record<string, unknown>)?.name)
      .filter((n): n is string => typeof n === 'string' && n.length > 0);
    if (names.length) return names;
  }

  // C: { places: [{ name }] }
  if (Array.isArray(d.places)) {
    const names = d.places
      .map((p) => (p as Record<string, unknown>)?.name)
      .filter((n): n is string => typeof n === 'string' && n.length > 0);
    if (names.length) return names;
  }

  // D: root is steps array
  if (Array.isArray(courseData)) {
    const names = (courseData as unknown[])
      .map((s) => (s as Record<string, unknown>)?.place)
      .map((p) => (p as Record<string, unknown>)?.name)
      .filter((n): n is string => typeof n === 'string' && n.length > 0);
    if (names.length) return names;
  }

  return [];
}

/** source_query 첫 번째 줄을 제목으로 사용 */
function titleFromQuery(sourceQuery: string | null): string {
  if (!sourceQuery) return '';
  return sourceQuery.split('\n')[0].trim();
}

interface CourseBuilderProps {
  initialCourses: SavedCourseRow[];
  fetchError: string | null;
}

export function CourseBuilder({ initialCourses, fetchError }: CourseBuilderProps) {
  const [courseTitle, setCourseTitle] = useState('');
  const [regionHint, setRegionHint] = useState('');
  const [places, setPlaces] = useState<DraftPlace[]>([
    { id: crypto.randomUUID(), name: '', note: '' },
    { id: crypto.randomUUID(), name: '', note: '' },
    { id: crypto.randomUUID(), name: '', note: '' },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCourses, setSavedCourses] = useState<SavedCourseRow[]>(initialCourses);

  function updatePlace(index: number, key: keyof DraftPlace, value: string) {
    setPlaces((prev) => prev.map((p, i) => (i === index ? { ...p, [key]: value } : p)));
  }

  function addPlace() {
    setPlaces((prev) => [...prev, { id: crypto.randomUUID(), name: '', note: '' }]);
  }

  function removePlace(index: number) {
    setPlaces((prev) => prev.filter((_, i) => i !== index));
  }

  async function refreshCourses() {
    const res = await fetch('/api/courses/build', { method: 'GET' });
    if (!res.ok) return;
    const json = await res.json() as { items?: SavedCourseRow[] };
    setSavedCourses(json.items ?? []);
  }

  async function handleSave() {
    const normalized = places
      .map((p) => ({ name: p.name.trim(), note: p.note.trim() }))
      .filter((p) => p.name.length > 0 && p.note.length > 0);

    if (normalized.length < 2) {
      toast.error('최소 2개 장소(이름 + 한줄 느낌)를 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/courses/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_title: courseTitle,
          region_hint: regionHint,
          places: normalized,
        }),
      });

      const json = await res.json() as {
        error?: string;
        course_hash?: string;
        created_locations?: number;
        reused_locations?: number;
      };

      if (!res.ok) {
        toast.error(json.error || '코스 저장에 실패했습니다.');
        return;
      }

      toast.success(
        `코스 저장 완료 (${json.course_hash}) · 신규 장소 ${json.created_locations ?? 0} / 기존 재사용 ${json.reused_locations ?? 0}`,
      );
      await refreshCourses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '코스 저장 실패');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 서비스 키 오류 등 fetch 실패 시 배너 */}
      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-semibold">코스 목록 로드 실패:</span> {fetchError}
          <br />
          <span className="text-xs text-red-500">
            SUPABASE_SERVICE_KEY 환경변수를 확인하거나, Supabase에서 odiga_saved_courses 테이블 RLS를 확인하세요.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>코스 수동 등록 (AI 보강 + 자동 장소 저장)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="코스 제목 (예: 벚꽃 데이트 코스)"
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
            />
            <Input
              placeholder="지역 힌트 (선택, 예: 마포구)"
              value={regionHint}
              onChange={(e) => setRegionHint(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {places.map((place, index) => (
              <div key={place.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={`장소명 ${index + 1}`}
                    value={place.name}
                    onChange={(e) => updatePlace(index, 'name', e.target.value)}
                  />
                  {places.length > 2 && (
                    <Button type="button" variant="outline" onClick={() => removePlace(index)}>
                      삭제
                    </Button>
                  )}
                </div>
                <Textarea
                  placeholder="한 줄 느낌/리뷰 (예: 라떼가 고소하고 공간이 넓어 카공하기 좋음. 주말 웨이팅 있음)"
                  value={place.note}
                  onChange={(e) => updatePlace(index, 'note', e.target.value)}
                  rows={3}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={addPlace}>
              장소 추가
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? '저장 중...' : '코스 저장'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>저장된 코스 ({savedCourses.length}개)</CardTitle>
            <Button variant="outline" size="sm" onClick={refreshCourses}>
              새로고침
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {savedCourses.length === 0 && !fetchError && (
              <p className="text-sm text-muted-foreground">저장된 코스가 없습니다.</p>
            )}
            {savedCourses.map((course) => {
              const placeNames = extractPlaceNames(course.course_data);
              const displayTitle =
                placeNames.length > 0
                  ? placeNames.join(' → ')
                  : titleFromQuery(course.source_query) || '(이름 없음)';
              const placeCount = placeNames.length || course.place_ids?.length || 0;

              return (
                <div key={course.id} className="rounded-md border p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{displayTitle}</p>
                    {placeCount > 0 && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {placeCount}곳
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>hash: {course.course_hash}</span>
                    {course.region && <span>지역: {course.region}</span>}
                    {course.activity_type && <span>활동: {course.activity_type}</span>}
                    <span>상태: {course.validation_status || 'unknown'}</span>
                    <span>사용: {course.usage_count ?? 0}회</span>
                    <span>{new Date(course.created_at).toLocaleString('ko-KR')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
