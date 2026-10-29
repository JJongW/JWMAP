import { createServerSupabase } from '@/lib/supabase/server';
import { getLocations } from '@/lib/queries/locations';
import { getTags, getLocationTagsForLocations } from '@/lib/queries/tags';
import type { LocationTag } from '@/types';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { LocationTable } from '@/components/locations/LocationTable';
import { LocationFilters } from '@/components/locations/LocationFilters';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AttractionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createServerSupabase();

  const page = Number(params.page) || 1;
  const perPage = 20;

  const filters = {
    search: (params.search as string) || undefined,
    region: (params.region as string) || undefined,
    category_main: (params.category_main as string) || undefined,
    price_level: params.price_level ? Number(params.price_level) : undefined,
    page,
    per_page: perPage,
  };

  const { data: locations, count } = await getLocations(supabase, filters, 'attractions');
  const locationIds = (locations ?? []).map((l) => l.id);

  let allTags: Awaited<ReturnType<typeof getTags>> = [];
  let locationTagsMap: Map<string, LocationTag[]> = new Map();
  try {
    const [tagsResult, tagsMapResult] = await Promise.all([
      getTags(supabase, 'space'),
      getLocationTagsForLocations(supabase, locationIds, 'attractions'),
    ]);
    allTags = tagsResult;
    locationTagsMap = tagsMapResult;
  } catch {
    // tags 또는 location_tags 테이블/컬럼 미존재 시 무시
  }

  const { data: allRegions } = await supabase
    .from('attractions')
    .select('region')
    .not('region', 'is', null)
    .order('region');

  const regions = [...new Set((allRegions ?? []).map((r) => r.region as string).filter(Boolean))];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">볼거리</h1>
            <p className="mt-1 text-xs text-muted-foreground">이름을 누르면 방문 기록·추천하는 이유·분류·사진을 한 화면에서 고쳐요.</p>
          </div>
          <Link href="/intake">
            <Button className="bg-orange-500 text-white hover:bg-orange-600">
              <Plus className="mr-2 h-4 w-4" />
              새 장소는 검토함에서
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <LocationFilters regions={regions} />
          <LocationTable
            locations={locations ?? []}
            totalCount={count}
            page={page}
            perPage={perPage}
            allTags={allTags}
            locationTagsByLocId={Object.fromEntries(locationTagsMap)}
            basePath="/attractions"
            tagDomain="space"
          />
        </div>
      </div>
    </AdminLayout>
  );
}
