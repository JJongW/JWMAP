import { createServerSupabase } from '@/lib/supabase/server';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Tags, ImageOff, Clock } from 'lucide-react';
import Link from 'next/link';

async function getDashboardData() {
  const supabase = await createServerSupabase();

  const [
    { count: total },
    { data: locations },
    { data: recentUpdates },
  ] = await Promise.all([
    supabase.from('locations').select('*', { count: 'exact', head: true }),
    supabase.from('locations').select('*'),
    supabase.from('locations').select('*')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const allLocations = (locations ?? []) as Record<string, unknown>[];
  const noTagsCount = allLocations.filter((l) => {
    const tags = l.tags;
    return !tags || (Array.isArray(tags) && tags.length === 0);
  }).length;
  const noImageCount = allLocations.filter((l) => {
    const img = (l.imageUrl ?? l.image_url ?? '') as string;
    return !img || img === '';
  }).length;

  // Region distribution
  const regionMap = new Map<string, number>();
  allLocations.forEach((l) => {
    const r = (l.region as string) || '미지정';
    regionMap.set(r, (regionMap.get(r) ?? 0) + 1);
  });
  const byRegion = Array.from(regionMap.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Category distribution
  const catMap = new Map<string, number>();
  allLocations.forEach((l) => {
    const c = (l.category_main as string) || '미지정';
    catMap.set(c, (catMap.get(c) ?? 0) + 1);
  });
  const byCategory = Array.from(catMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total: total ?? 0,
    noTagsCount,
    noImageCount,
    byRegion,
    byCategory,
    recentUpdates: (recentUpdates ?? []) as Record<string, unknown>[],
  };
}

export default async function DashboardPage() {
  const stats = await getDashboardData();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">대시보드</h1>

        {/* Stat cards */}
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
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
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

        {/* Region + Category + Recent */}
        <div className="grid gap-4 md:grid-cols-3">
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
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
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
