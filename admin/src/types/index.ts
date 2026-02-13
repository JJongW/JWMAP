// ---- Tag ----
export type TagType = 'mood' | 'feature' | 'situation' | 'season';

export interface Tag {
  id: string;
  name: string;
  type: TagType;
  sort_order: number;
  created_at: string;
}

// ---- Location Tag (join) ----
export interface LocationTag {
  id: string;
  location_id: string;
  tag_id: string;
  created_at: string;
  tag?: Tag; // joined
}

// ---- Features ----
export interface Features {
  solo_ok?: boolean;
  quiet?: boolean;
  wait_short?: boolean;
  date_ok?: boolean;
  group_ok?: boolean;
  parking?: boolean;
  pet_friendly?: boolean;
  reservation?: boolean;
  late_night?: boolean;
}

// ---- Location ----
export interface Location {
  id: string;
  name: string;
  region: string;
  sub_region: string | null;
  category_main: string | null;
  category_sub: string | null;
  lon: number;
  lat: number;
  address: string;
  memo: string;
  short_desc: string | null;
  rating: number;
  curation_level: number | null;
  price_level: number | null;
  features: Features;
  tags: string[];
  imageUrl: string;
  event_tags: string[];
  naver_place_id: string | null;
  kakao_place_id: string | null;
  visit_date: string | null;
  curator_visited: boolean | null;
  created_at: string;
  // normalized FKs (optional)
  region_id: string | null;
  category_id: string | null;
  // joined data
  location_tags?: LocationTag[];
}

// ---- Filters ----
export interface LocationFilters {
  search?: string;
  region?: string;
  category_main?: string;
  category_sub?: string;
  tag_ids?: string[];
  price_level?: number;
  has_image?: boolean;
  has_tags?: boolean;
  page: number;
  per_page: number;
}
