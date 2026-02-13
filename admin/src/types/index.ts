// ---- Region ----
export interface Region {
  id: string;
  name: string;
  level: 1 | 2 | 3; // 1=시도, 2=구군, 3=동읍면
  parent_id: string | null;
  path: string;
  sort_order: number;
  created_at: string;
}

// ---- Category ----
export interface Category {
  id: string;
  name: string;
  level: 1 | 2; // 1=대분류, 2=소분류
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}

// ---- Tag ----
export type TagType = 'mood' | 'feature' | 'situation' | 'season';

export interface Tag {
  id: string;
  name: string;
  type: TagType;
  sort_order: number;
  created_at: string;
}

// ---- Location Image ----
export interface LocationImage {
  id: string;
  location_id: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
  caption: string | null;
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
  location_images?: LocationImage[];
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

// ---- Dashboard Stats ----
export interface DashboardStats {
  total_locations: number;
  no_tags_count: number;
  no_image_count: number;
  by_region: { region: string; count: number }[];
  by_category: { category: string; count: number }[];
  recent_updates: Location[];
}
