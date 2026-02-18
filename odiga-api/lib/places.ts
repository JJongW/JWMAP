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
const FOOD_CATEGORY_MAINS = new Set([
  '밥', '면', '국물', '고기요리', '해산물', '간편식', '양식·퓨전', '디저트', '술안주',
]);
const FOOD_HINTS = ['맛집', '식당', '밥', '요리', '국밥', '라멘', '파스타', '고기', '해산물'];
const CAFE_HINTS = ['카페', '커피', '라떼', '카공', '브런치카페'];

function isSpecificCategory(activityType: string): boolean {
  if (GENERIC_ACTIVITY_TYPES.includes(activityType)) return false;
  return VALID_CATEGORIES.some((cat) => cat.includes(activityType) || activityType.includes(cat));
}

export type PlaceActivityBucket = '맛집' | '카페' | '볼거리';

export function getPlaceActivityBucket(place: Place): PlaceActivityBucket {
  const categoryMain = (place.category_main || '').trim();
  const categorySub = (place.category_sub || '').toLowerCase();
  const tags = (place.tags || []).join(' ').toLowerCase();
  const memo = (place.memo || '').toLowerCase();
  const shortDesc = (place.short_desc || '').toLowerCase();
  const searchText = `${categorySub} ${tags} ${memo} ${shortDesc}`;

  if (categoryMain === '카페' || CAFE_HINTS.some((keyword) => searchText.includes(keyword))) {
    return '카페';
  }
  if (FOOD_CATEGORY_MAINS.has(categoryMain) || FOOD_HINTS.some((keyword) => searchText.includes(keyword))) {
    return '맛집';
  }
  return '볼거리';
}

function matchesActivityBucket(place: Place, activityType: string | null): boolean {
  if (!activityType) return true;
  return getPlaceActivityBucket(place) === activityType;
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

  const rows = (data || []) as Place[];
  return rows.filter((place) => matchesActivityBucket(place, intent.activity_type));
}

export { getSupabase };
