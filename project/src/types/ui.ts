// UI Mode Types for Responsive Layout
//
// decision:       추천/결정 보조 화면
// result:         추천 결과 화면
// browse:         기본 지도 탐색 화면
export type UiMode = 'decision' | 'result' | 'browse';

// Decision Flow 관련 타입
export type Companion = 'solo' | 'pair' | 'group';
export type TimeSlot = 'lunch' | 'dinner' | 'late';
export type PriorityFeature = 'quiet' | 'wait_short' | 'fast_serve' | 'date_ok' | 'solo_ok';

export interface DecisionInput {
  companion: Companion | null;
  timeSlot: TimeSlot | null;
  priorityFeature: PriorityFeature | null;
}

// Breakpoint values
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;
