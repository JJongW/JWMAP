'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface DraftPlace {
  id: string;
  name: string;
  note: string;
}

interface SavedCourseRow {
  id: string;
  course_hash: string;
  source_query: string | null;
  region: string | null;
  activity_type: string | null;
  usage_count: number | null;
  validation_status: string | null;
  created_at: string;
  course_data: {
    steps?: Array<{ place?: { name?: string } }>;
  } | null;
}

export function CourseBuilder({ initialCourses }: { initialCourses: SavedCourseRow[] }) {
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
          <CardTitle>최근 저장 코스</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {savedCourses.length === 0 && (
              <p className="text-sm text-muted-foreground">저장된 코스가 없습니다.</p>
            )}
            {savedCourses.map((course) => {
              const names = course.course_data?.steps?.map((s) => s.place?.name).filter(Boolean) ?? [];
              return (
                <div key={course.id} className="rounded-md border p-3">
                  <div className="text-sm font-medium">{names.join(' → ') || '(코스 이름 없음)'}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    hash: {course.course_hash} · 지역: {course.region || '-'} · 활동: {course.activity_type || '-'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    상태: {course.validation_status || 'unknown'} · 사용: {course.usage_count ?? 0}회 · 생성:{' '}
                    {new Date(course.created_at).toLocaleString('ko-KR')}
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
