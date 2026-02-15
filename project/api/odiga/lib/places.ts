import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ParsedIntent } from './intent';

export interface Place {
  id: string;
  name: string;
  region: string;
  sub_region?: string;
  province?: string;
  category_main?: string;
  category_sub?: string;
  lon: number;
  lat: number;
  address: string;
  memo?: string;
  short_desc?: string;
  features?: Record<string, boolean>;
  tags?: string[];
  rating: number;
  price_level?: number;
  imageUrl?: string;
  naver_place_id?: string;
  kakao_place_id?: string;
}

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  }
  _supabase = createClient(url, key);
  return _supabase;
}

const GENERIC_ACTIVITY_TYPES = ['맛집', '추천', '밥', '식사', '먹을곳', '음식점', '산책', '놀곳'];
const VALID_CATEGORIES = ['밥', '면', '국물', '고기요리', '해산물', '간편식', '양식·퓨전', '디저트', '카페', '술안주'];

function isSpecificCategory(activityType: string): boolean {
  if (GENERIC_ACTIVITY_TYPES.includes(activityType)) return false;
  return VALID_CATEGORIES.some((cat) => cat.includes(activityType) || activityType.includes(cat));
}

export async function queryPlaces(intent: ParsedIntent): Promise<Place[]> {
  let query = getSupabase().from('locations').select('*');

  if (intent.region) {
    query = query.or(`region.ilike.%${intent.region}%,province.ilike.%${intent.region}%,sub_region.ilike.%${intent.region}%`);
  }

  if (intent.activity_type && isSpecificCategory(intent.activity_type)) {
    query = query.or(`category_main.ilike.%${intent.activity_type}%,category_sub.ilike.%${intent.activity_type}%`);
  }

  const mealContexts = ['점심', '저녁', '식사', '밥'];
  const isMealContext = mealContexts.some((ctx) =>
    intent.special_context?.includes(ctx) || intent.vibe.some((v) => v.includes(ctx))
  );
  if (isMealContext && !intent.activity_type?.includes('카페')) {
    query = query.not('category_main', 'eq', '카페');
  }

  const { data, error } = await query
    .order('rating', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  return (data || []) as Place[];
}

export { getSupabase };
