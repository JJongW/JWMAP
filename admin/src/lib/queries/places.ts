import type { SupabaseClient } from '@supabase/supabase-js';

export type VisitStatus = 'visited' | 'candidate' | 'hidden';

export const VISIT_STATUS_LABEL: Record<VisitStatus, string> = {
  visited: '가봤음',
  candidate: '아직 안 가봄',
  hidden: '숨김',
};

export const RECOMMENDATION_STATUS_LABEL: Record<string, string> = {
  draft: '초안 (사이트에 안 나감)',
  published: '공개 중',
  hidden: '내림',
};

export const RECOMMENDATION_BASIS_LABEL: Record<string, string> = {
  visited: '직접 가봄',
  friend: '지인 추천',
  research: '직접 찾아봄',
  wishlist: '가보고 싶음',
};

export const TERM_KIND_LABEL: Record<string, string> = {
  place_type: '장소 종류',
  reason: '추천하는 이유',
  situation: '이런 때 잘 맞아요',
};

export const FACT_FIELD_LABEL: Record<string, string> = {
  wifi: '와이파이',
  power_outlet: '콘센트',
  parking: '주차',
  reservation: '예약',
  takeout: '포장',
  delivery: '배달',
  pet_friendly: '반려동물',
  accessibility: '휠체어 접근',
  no_kids_zone: '노키즈존',
  hours: '영업시간',
  admission_fee: '입장료',
  phone: '전화',
  other: '기타',
};

export const SOURCE_NOTE_LABEL: Record<string, string> = {
  operator_note: '운영자 메모',
  auto_generated: '자동으로 붙은 정보',
  address: '주소',
  unknown: '분류 전',
};

export interface PlaceDetail {
  id: string;
  legacy_table: 'locations' | 'attractions' | null;
  name: string;
  address: string | null;
  region: string | null;
  sub_region: string | null;
  province: string | null;
  kakao_place_id: string | null;
  naver_place_id: string | null;
  image_url: string | null;
  price_level: number | null;
  category_main: string | null;
  category_sub: string | null;
  curation_level: number | null;
  visit_status: VisitStatus;
  updated_at: string;
  visits: {
    id: string;
    visited_on: string | null;
    visited_on_precision: string;
    time_slot: string | null;
    companions: string | null;
    experience_note: string | null;
    source: string;
  }[];
  recommendations: {
    id: string;
    body: string;
    fits_for: string | null;
    caveats: string | null;
    status: string;
    source: string;
    basis: string;
    updated_at: string;
  }[];
  place_terms: {
    term_id: string;
    status: string;
    source: string;
    evidence: string | null;
    term: { kind: string; slug: string; label: string } | null;
  }[];
  place_facts: {
    id: string;
    field: string;
    value: Record<string, unknown>;
    status: string;
    source: string;
    source_url: string | null;
    checked_at: string | null;
  }[];
  source_notes: { id: string; origin: string; raw_text: string; classified_as: string; created_at: string }[];
  place_photos: {
    id: string;
    source: string;
    source_url: string | null;
    url: string | null;
    local_path: string | null;
    taken_at: string | null;
    status: string;
    is_cover: boolean;
  }[];
  external_reviews: { id: string; source: string; source_url: string | null; excerpt: string }[];
}

export async function getPlaceDetail(supabase: SupabaseClient, id: string): Promise<PlaceDetail | null> {
  const { data, error } = await supabase
    .from('places')
    .select(
      `id, legacy_table, name, address, region, sub_region, province, kakao_place_id, naver_place_id, image_url,
       price_level, category_main, category_sub, curation_level, visit_status, updated_at,
       visits(id, visited_on, visited_on_precision, time_slot, companions, experience_note, source),
       recommendations(id, body, fits_for, caveats, status, source, basis, updated_at),
       place_terms(term_id, status, source, evidence, term:taxonomy_terms(kind, slug, label)),
       place_facts(id, field, value, status, source, source_url, checked_at),
       source_notes(id, origin, raw_text, classified_as, created_at),
       place_photos(id, source, source_url, url, local_path, taken_at, status, is_cover),
       external_reviews(id, source, source_url, excerpt)`,
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.warn('[getPlaceDetail] 쿼리 오류:', error);
    return null;
  }
  return data as unknown as PlaceDetail | null;
}

export async function getTaxonomyTerms(
  supabase: SupabaseClient,
): Promise<{ id: string; kind: string; slug: string; label: string; mode: string }[]> {
  const { data } = await supabase
    .from('taxonomy_terms')
    .select('id, kind, slug, label, mode')
    .eq('status', 'active')
    .order('kind')
    .order('label');
  return data ?? [];
}
