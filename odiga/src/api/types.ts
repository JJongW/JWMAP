export type ResponseType = 'single' | 'course';
export type Difficulty = '★☆☆' | '★★☆' | '★★★';
export type NarrativeConfidence = 'high' | 'medium' | 'low';
export type NoisePreference = 'quiet' | 'balanced' | 'lively' | 'unknown';
export type BudgetSensitivity = 'tight' | 'moderate' | 'flexible' | 'unknown';
export type WalkingPreference = 'short' | 'moderate' | 'relaxed' | 'unknown';

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

export interface BrandedPlace {
  rank: number;
  place: Place;
  recommendation_reason: string;
  confidence: NarrativeConfidence;
}

export interface CourseStepNarrative {
  name: string;
  place_id: string;
  region: string;
  vibe_hint: string;
}

export interface BrandedCourse {
  id: number;
  route_summary: string;
  totalDistance: number;
  difficulty: Difficulty;
  mode: string;
  vibes: string[];
  totalScore: number;
  places: CourseStepNarrative[];
  recommendation_reason: string;
  confidence: NarrativeConfidence;
  course_story: string;
  mood_flow: string[];
  ideal_time: string;
}

export type Course = BrandedCourse;

export interface ParsedIntent {
  response_type: ResponseType;
  region: string | null;
  vibe: string[];
  activity_type: string | null;
  people_count: number | null;
  season: string | null;
  mode: string | null;
  special_context: string | null;
  noise_preference: NoisePreference;
  budget_sensitivity: BudgetSensitivity;
  walking_preference: WalkingPreference;
}

export interface RecommendRequest {
  query: string;
  region?: string;
  people_count?: number;
  mode?: string;
  response_type?: ResponseType;
  feedback?: string;
  exclude_place_ids?: string[];
}

export interface BrandedRecommendResponse {
  type: ResponseType;
  curated_summary: string;
  confidence: NarrativeConfidence;
  places: BrandedPlace[];
  courses: BrandedCourse[];
  intent: ParsedIntent;
  parseErrors: string[];
  timing: { llmMs: number; dbMs: number; totalMs: number };
}

export interface LogRequest {
  raw_query: string;
  region?: string | null;
  vibe?: string[];
  people_count?: number | null;
  mode?: string | null;
  season?: string | null;
  activity_type?: string | null;
  response_type?: string;
  selected_course?: object | null;
  selected_place_id?: string | null;
  selected_place_name?: string | null;
  regenerate_count?: number;
  parse_error_fields?: string[];
  user_feedbacks?: string[];
}

export interface StatsResult {
  totalSearches: number;
  topRegions: { region: string; count: number }[];
  modeDistribution: { mode: string; count: number }[];
  responseTypeDistribution: { type: string; count: number }[];
  topActivityTypes: { activity: string; count: number }[];
  topVibes: { vibe: string; count: number }[];
  topSelectedPlaces: { name: string; count: number }[];
  seasonDistribution: { season: string; count: number }[];
  hourDistribution: { hour: number; count: number }[];
  weekdayVsWeekend: { weekday: number; weekend: number };
  parseErrorRate: number;
  avgRegenerateCount: number;
  avgWalkingDistance: number;
  feedbackRate: number;
  topFeedbackKeywords: { keyword: string; count: number }[];
}

export interface SaveCourseRequest {
  course: Course;
  meta?: {
    raw_query?: string;
    region?: string | null;
    vibe?: string[];
    activity_type?: string | null;
    season?: string | null;
    people_count?: number | null;
    mode?: string | null;
    response_type?: string;
  };
}

export interface SaveCourseResponse {
  ok: boolean;
  course_hash: string;
}
