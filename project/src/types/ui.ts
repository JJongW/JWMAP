// UI Mode Types for Responsive Layout

// Mobile UI Modes
export type UiMode = 'browse' | 'explore';

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
