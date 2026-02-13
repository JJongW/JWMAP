import { createServerSupabase } from '@/lib/supabase/server';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { IncompleteList } from '@/components/locations/IncompleteList';

type Filter = 'no_tags' | 'no_image' | 'both';

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

async function getIncompleteLocations(filter: Filter) {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const all = (data ?? []) as Record<string, unknown>[];

  return all.filter((loc) => {
    const tags = loc.tags;
    const hasTags = tags && Array.isArray(tags) && tags.length > 0;
    const img = ((loc.imageUrl ?? loc.image_url ?? '') as string);
    const hasImage = img !== '';

    switch (filter) {
      case 'no_tags': return !hasTags;
      case 'no_image': return !hasImage;
      case 'both': return !hasTags || !hasImage;
      default: return !hasTags || !hasImage;
    }
  }).map((loc) => {
    const tags = loc.tags;
    const hasTags = !!(tags && Array.isArray(tags) && (tags as string[]).length > 0);
    const img = ((loc.imageUrl ?? loc.image_url ?? '') as string);
    const hasImage = img !== '';

    return {
      id: loc.id as string,
      name: (loc.name ?? '') as string,
      region: (loc.region ?? '') as string,
      category_main: (loc.category_main ?? null) as string | null,
      category_sub: (loc.category_sub ?? null) as string | null,
      hasTags,
      hasImage,
      tagCount: hasTags ? (tags as string[]).length : 0,
      imageUrl: img,
      created_at: (loc.created_at ?? '') as string,
    };
  });
}

export default async function IncompletePage({ searchParams }: Props) {
  const params = await searchParams;
  const filter = (['no_tags', 'no_image', 'both'].includes(params.filter ?? '')
    ? params.filter
    : 'both') as Filter;

  const locations = await getIncompleteLocations(filter);

  return (
    <AdminLayout>
      <IncompleteList locations={locations} currentFilter={filter} />
    </AdminLayout>
  );
}
