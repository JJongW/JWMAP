import { getDashboardData } from '@/lib/queries/dashboard';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Tags, ImageOff, Clock, Activity, MousePointerClick, Search, Bookmark } from 'lucide-react';
import Link from 'next/link';

function getMaxValue(values: number[]): number {
  const max = Math.max(...values);
  return max > 0 ? max : 1;
}

export default async function DashboardPage() {
  const stats = await getDashboardData();
  const graphMax = getMaxValue(
    stats.activitySeries.flatMap((d) => [d.webSearches, d.clicks, d.odigaSearches]),
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">대시보드</h1>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">총 장소</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Link href="/locations/incomplete?filter=no_tags">
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">태그 없음</CardTitle>
                <Tags className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.noTagsCount}</div>
                <p className="text-xs text-muted-foreground">태그 미입력 장소 →</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/locations/incomplete?filter=no_image">
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">이미지 없음</CardTitle>
                <ImageOff className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.noImageCount}</div>
                <p className="text-xs text-muted-foreground">이미지 미등록 장소 →</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">웹 검색 (14일)</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activityTotals.webSearches}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">클릭 로그 (14일)</CardTitle>
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activityTotals.clicks}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">odiga 검색 (14일)</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activityTotals.odigaSearches}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">저장된 코스</CardTitle>
              <Bookmark className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activityTotals.savedCourses}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Activity (최근 14일)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-sky-500" />웹 검색</div>
                <div className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-500" />클릭</div>
                <div className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-violet-500" />odiga 검색</div>
              </div>
              <div className="flex items-end gap-1 overflow-x-auto pb-2">
                {stats.activitySeries.map((d) => (
                  <div key={d.date} className="flex min-w-8 flex-col items-center gap-2">
                    <div className="flex h-32 items-end gap-0.5">
                      <div
                        className="w-1.5 rounded-t bg-sky-500"
                        style={{ height: `${(d.webSearches / graphMax) * 100}%` }}
                        title={`웹 검색 ${d.webSearches}`}
                      />
                      <div
                        className="w-1.5 rounded-t bg-emerald-500"
                        style={{ height: `${(d.clicks / graphMax) * 100}%` }}
                        title={`클릭 ${d.clicks}`}
                      />
                      <div
                        className="w-1.5 rounded-t bg-violet-500"
                        style={{ height: `${(d.odigaSearches / graphMax) * 100}%` }}
                        title={`odiga 검색 ${d.odigaSearches}`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{d.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">odiga 응답 타입 분포</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.odigaResponseTypes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">데이터 없음</p>
                ) : (
                  stats.odigaResponseTypes.map((item) => (
                    <div key={item.type} className="flex items-center justify-between text-sm">
                      <span>{item.type}</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">지역별 분포 (Top 10)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.byRegion.map((r) => (
                  <div key={r.region} className="flex items-center justify-between text-sm">
                    <span className="truncate">{r.region}</span>
                    <span className="font-medium">{r.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">카테고리별 분포</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.byCategory.map((c) => (
                  <div key={c.category} className="flex items-center justify-between text-sm">
                    <span>{c.category}</span>
                    <span className="font-medium">{c.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">odiga 활동 타입 (Top 5)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.topOdigaActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">데이터 없음</p>
                ) : (
                  stats.topOdigaActivities.map((a) => (
                    <div key={a.activity} className="flex items-center justify-between text-sm">
                      <span>{a.activity}</span>
                      <span className="font-medium">{a.count}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">최근 업데이트</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.recentUpdates.map((loc) => (
                  <Link
                    key={loc.id as string}
                    href={`/locations/${loc.id}`}
                    className="flex items-center justify-between text-sm hover:underline"
                  >
                    <span className="truncate">{loc.name as string}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {loc.region as string}
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
