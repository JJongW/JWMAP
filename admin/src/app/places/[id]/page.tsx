import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PlaceEditor } from '@/components/places/PlaceEditor';
import { getPlaceDetail, getTaxonomyTerms } from '@/lib/queries/places';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlacePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const [place, terms] = await Promise.all([getPlaceDetail(supabase, id), getTaxonomyTerms(supabase)]);
  if (!place) notFound();

  return (
    <AdminLayout>
      <PlaceEditor key={place.updated_at} place={place} terms={terms} />
    </AdminLayout>
  );
}
