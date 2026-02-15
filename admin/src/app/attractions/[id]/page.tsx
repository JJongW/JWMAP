import { createServerSupabase } from '@/lib/supabase/server';
import { getLocationById } from '@/lib/queries/locations';
import { getTags, getLocationTags } from '@/lib/queries/tags';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { LocationForm } from '@/components/locations/LocationForm';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AttractionDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  let allTags: Awaited<ReturnType<typeof getTags>> = [];
  try {
    allTags = await getTags(supabase, 'space');
  } catch {
    // tags 테이블 미존재 시 빈 배열
  }

  if (id === 'new') {
    return (
      <AdminLayout>
        <LocationForm
          isNew
          allTags={allTags}
          domain="attractions"
          domainLabel="볼거리 장소"
          listPath="/attractions"
          tagDomain="space"
        />
      </AdminLayout>
    );
  }

  const [location, locationTags] = await Promise.all([
    getLocationById(supabase, id, 'attractions'),
    getLocationTags(supabase, id, 'attractions').catch(() => [] as Awaited<ReturnType<typeof getLocationTags>>),
  ]);

  if (!location) {
    notFound();
  }

  return (
    <AdminLayout>
      <LocationForm
        location={location}
        allTags={allTags}
        locationTags={locationTags}
        domain="attractions"
        domainLabel="볼거리 장소"
        listPath="/attractions"
        tagDomain="space"
      />
    </AdminLayout>
  );
}
