export type SearchIntent =
  | 'DISCOVER_RECOMMEND'
  | 'SEARCH_BY_FOOD'
  | 'SEARCH_BY_CATEGORY'
  | 'SEARCH_BY_REGION'
  | 'SEARCH_BY_CONSTRAINTS'
  | 'SEARCH_BY_CONTEXT'
  | 'COMPARE_OPTIONS'
  | 'RANDOM_PICK'
  | 'FIND_NEAR_ME'
  | 'FIND_OPEN_NOW'
  | 'FIND_LATE_NIGHT'
  | 'FIND_BEST_FOR'
  | 'ASK_DETAILS'
  | 'ASK_SIMILAR_TO'
  | 'ASK_EXCLUDE'
  | 'CLARIFY_QUERY';

export type TimeOfDay = '아침' | '점심' | '저녁' | '야식' | '심야' | '브런치';

export type VisitContext =
  | '혼밥' | '혼술' | '데이트' | '접대' | '가족모임' | '친구모임'
  | '회식' | '소개팅' | '생일' | '기념일' | '카공' | '반려동물_동반';

export type SearchConstraint =
  | '웨이팅_없음' | '예약_가능' | '주차_가능' | '좌석_넉넉' | '오래_앉기'
  | '조용한' | '빠른_회전' | '가성비' | '비싼_곳_제외' | '체인점_제외'
  | '관광지_제외' | '비건' | '채식' | '매운맛' | '담백';

export interface EnhancedLLMQuery {
  intent: SearchIntent;
  slots: {
    location_keywords: string[];
    region: string | null;
    sub_region: string | null;
    place_name: string | null;
    category_main: string | null;
    category_sub: string | null;
    exclude_category_main: string[] | null;
    time_of_day: TimeOfDay | null;
    visit_context: VisitContext | null;
    constraints: SearchConstraint[];
    keywords: string[];
    count: number | null;
    open_now: boolean | null;
  };
}

export interface SearchActions {
  mode: 'browse' | 'explore';
  should_show_map: boolean;
  result_limit: number;
  fallback_applied: boolean;
  fallback_notes: string[];
  fallback_level: number;
}

export interface UIHints {
  message_type: 'success' | 'no_results_soft' | 'need_clarification';
  message: string;
  suggestions?: string[];
}

export interface LLMQuery {
  locationKeywords?: string[];
  region?: string[];
  subRegion?: string[];
  category?: string[];
  categoryMain?: string[];
  categorySub?: string[];
  excludeCategory?: string[];
  excludeCategoryMain?: string[];
  keywords?: string[];
  constraints?: {
    solo_ok?: boolean;
    quiet?: boolean;
    no_wait?: boolean;
    price_level?: number;
  };
  sort?: 'relevance' | 'rating';
}

export interface TimingMetrics {
  llmMs: number;
  dbMs: number;
  totalMs: number;
}

export interface Location {
  id: string;
  name: string;
  region: string;
  subRegion?: string;
  category: string;
  categoryMain?: string;
  categorySub?: string;
  tags?: string[];
  lon: number;
  lat: number;
  address: string;
  memo: string;
  shortDesc?: string;
  rating: number;
  curationLevel?: number;
  priceLevel?: number;
  naverPlaceId?: string;
  kakaoPlaceId?: string;
  imageUrl: string;
  eventTags?: string[];
  visitDate?: string;
  contentType?: 'food' | 'space';
}

export interface FallbackResult {
  places: Location[];
  fallback_applied: boolean;
  fallback_notes: string[];
  fallback_level: number;
}
