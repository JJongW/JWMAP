import type { SupabaseClient } from '@supabase/supabase-js';
import type { LocationImage } from '@/types';

export async function getLocationImages(
  supabase: SupabaseClient,
  locationId: string
): Promise<LocationImage[]> {
  const { data, error } = await supabase
    .from('location_images')
    .select('*')
    .eq('location_id', locationId)
    .order('sort_order')
    .order('created_at');

  if (error) throw error;
  return (data ?? []) as LocationImage[];
}

export async function addLocationImage(
  supabase: SupabaseClient,
  image: Omit<LocationImage, 'id' | 'created_at'>
): Promise<LocationImage> {
  const { data, error } = await supabase
    .from('location_images')
    .insert(image)
    .select()
    .single();

  if (error) throw error;
  return data as LocationImage;
}

export async function deleteLocationImage(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from('location_images').delete().eq('id', id);
  if (error) throw error;
}

export async function setPrimaryImage(
  supabase: SupabaseClient,
  locationId: string,
  imageId: string
): Promise<void> {
  // Unset all primary
  const { error: e1 } = await supabase
    .from('location_images')
    .update({ is_primary: false })
    .eq('location_id', locationId);
  if (e1) throw e1;

  // Set new primary
  const { error: e2 } = await supabase
    .from('location_images')
    .update({ is_primary: true })
    .eq('id', imageId);
  if (e2) throw e2;
}

export async function updateImageOrder(
  supabase: SupabaseClient,
  updates: { id: string; sort_order: number }[]
): Promise<void> {
  for (const { id, sort_order } of updates) {
    const { error } = await supabase
      .from('location_images')
      .update({ sort_order })
      .eq('id', id);
    if (error) throw error;
  }
}
