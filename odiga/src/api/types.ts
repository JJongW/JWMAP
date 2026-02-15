export type ResponseType = 'single' | 'course';
export type Difficulty = '★☆☆' | '★★☆' | '★★★';

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

export interface ScoredPlace extends Place {
  score: number;
  scoreBreakdown: {
    vibeMatch: number;
    distance: number;
    jjeopLevel: number;
    popularity: number;
    season: number;
    activityMatch: number;
  };
}

export interface CourseStep {
  label: string;
  place: ScoredPlace;
  distanceFromPrev: number | null;
}

export interface Course {
  id: number;
  steps: CourseStep[];
  totalDistance: number;
  difficulty: Difficulty;
  mode: string;
  vibes: string[];
  totalScore: number;
}

export interface ParsedIntent {
  response_type: ResponseType;
  region: string | null;
  vibe: string[];
  activity_type: string | null;
  people_count: number | null;
  season: string | null;
  mode: string | null;
  special_context: string | null;
}

export interface RecommendRequest {
  query: string;
  region?: string;
  people_count?: number;
  mode?: string;
  response_type?: ResponseType;
}

export interface RecommendResponse {
  type: ResponseType;
  places: ScoredPlace[];
  courses: Course[];
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
}

export interface SaveCourseRequest {
  course: Course;
}

export interface SaveCourseResponse {
  ok: boolean;
  course_hash: string;
}
