// UI Mode Types for Responsive Layout
//
// decision:       의사결정 진입 화면 (기본 시작 모드)
// result:         추천 결과 화면
// browse-confirm: Browse 진입 전 인터스티셜 가드
// browse:         직접 둘러보기 모드 (의도적으로 마찰이 높은 탐색 UX)
export type UiMode = 'decision' | 'result' | 'browse-confirm' | 'browse';

// Decision Flow 관련 타입
export type Companion = 'solo' | 'pair' | 'group';
export type TimeSlot = 'lunch' | 'dinner' | 'late';
export type PriorityFeature = 'quiet' | 'wait_short' | 'fast_serve' | 'date_ok' | 'solo_ok';

export interface DecisionInput {
  companion: Companion | null;
  timeSlot: TimeSlot | null;
  priorityFeature: PriorityFeature | null;
}

// Bottom Sheet States (mobile explore mode)
export type BottomSheetState = 'collapsed' | 'half' | 'full';

// Sheet Content Mode
export type SheetMode = 'list' | 'preview';

// Bottom Sheet Configuration
export interface BottomSheetConfig {
  snapPoints: {
    collapsed: number;  // px from bottom
    half: number;       // % of viewport height
    full: number;       // % of viewport height
  };
  dragThreshold: number; // px to trigger snap change
}

// Default bottom sheet config
export const DEFAULT_SHEET_CONFIG: BottomSheetConfig = {
  snapPoints: {
    collapsed: 80,   // 80px visible at bottom
    half: 50,        // 50% of viewport
    full: 90,        // 90% of viewport
  },
  dragThreshold: 50, // 50px drag to switch states
};

// Breakpoint values
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;
