import { getSupabase } from './supabase.js';
import type { ParsedIntent } from '../flow/intent.js';

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

// "맛집", "추천" 등 카테고리가 아닌 일반 키워드
const GENERIC_ACTIVITY_TYPES = ['맛집', '추천', '밥', '식사', '먹을곳', '음식점', '산책', '놀곳'];

// DB category_main에 실제로 존재하는 값들
const VALID_CATEGORIES = ['밥', '면', '국물', '고기요리', '해산물', '간편식', '양식·퓨전', '디저트', '카페', '술안주'];

function isSpecificCategory(activityType: string): boolean {
  if (GENERIC_ACTIVITY_TYPES.includes(activityType)) return false;
  // 정확한 카테고리이거나, 카테고리에 포함되는 키워드인지 확인
  return VALID_CATEGORIES.some((cat) => cat.includes(activityType) || activityType.includes(cat));
}

export async function queryPlaces(intent: ParsedIntent): Promise<Place[]> {
  let query = getSupabase().from('locations').select('*');

  if (intent.region) {
    query = query.or(`region.ilike.%${intent.region}%,province.ilike.%${intent.region}%,sub_region.ilike.%${intent.region}%`);
  }

  // 구체적인 카테고리일 때만 필터링 (맛집, 추천 등 일반 키워드는 무시)
  if (intent.activity_type && isSpecificCategory(intent.activity_type)) {
    query = query.or(`category_main.ilike.%${intent.activity_type}%,category_sub.ilike.%${intent.activity_type}%`);
  }

  // 카페 제외: 점심/저녁 식사 맥락에서 카페 제외
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
