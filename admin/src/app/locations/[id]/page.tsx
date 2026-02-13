import { createServerSupabase } from '@/lib/supabase/server';
import { getLocationById } from '@/lib/queries/locations';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { LocationForm } from '@/components/locations/LocationForm';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LocationDetailPage({ params }: Props) {
  const { id } = await params;

  // New location
  if (id === 'new') {
    return (
      <AdminLayout>
        <LocationForm isNew />
      </AdminLayout>
    );
  }

  const supabase = await createServerSupabase();
  const location = await getLocationById(supabase, id);

  if (!location) {
    notFound();
  }

  return (
    <AdminLayout>
      <LocationForm location={location} />
    </AdminLayout>
  );
}
