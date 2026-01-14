import { useState, useRef, useCallback, useEffect } from 'react';
import type { BottomSheetState, BottomSheetConfig } from '../types/ui';
import { DEFAULT_SHEET_CONFIG } from '../types/ui';

interface UseBottomSheetReturn {
  sheetRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  state: BottomSheetState;
  setState: (state: BottomSheetState) => void;
  isDragging: boolean;
  currentTranslateY: number;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  getHeightPercent: () => number;
}

export function useBottomSheet(
  initialState: BottomSheetState = 'half',
  config: BottomSheetConfig = DEFAULT_SHEET_CONFIG
): UseBottomSheetReturn {
  const [state, setState] = useState<BottomSheetState>(initialState);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentTranslateY, setCurrentTranslateY] = useState(0);

  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const startStateRef = useRef<BottomSheetState>(state);

  // Get height percentage for current state
  const getHeightPercent = useCallback((): number => {
    switch (state) {
      case 'collapsed':
        return (config.snapPoints.collapsed / window.innerHeight) * 100;
      case 'half':
        return config.snapPoints.half;
      case 'full':
        return config.snapPoints.full;
    }
  }, [state, config.snapPoints]);

  // Get translateY value for state (from top)
  const getTranslateY = useCallback((s: BottomSheetState): number => {
    const vh = window.innerHeight;
    switch (s) {
      case 'collapsed':
        return vh - config.snapPoints.collapsed;
      case 'half':
        return vh * (1 - config.snapPoints.half / 100);
      case 'full':
        return vh * (1 - config.snapPoints.full / 100);
    }
  }, [config.snapPoints]);

  // Handle touch start
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    const isHandle = target.closest('[data-sheet-handle]');
    const contentScrollTop = contentRef.current?.scrollTop ?? 0;

    // Allow drag if:
    // 1. Touching the handle, or
    // 2. Sheet is not full AND content is at scroll top
    const canDrag = isHandle || (state !== 'full' && contentScrollTop === 0) ||
                    (state === 'full' && contentScrollTop === 0 && !isHandle);

    if (canDrag) {
      setIsDragging(true);
      setStartY(e.touches[0].clientY);
      startStateRef.current = state;
    }
  }, [state]);

  // Handle touch move
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;

    // Prevent default to stop scroll during drag
    e.preventDefault();

    setCurrentTranslateY(diff);
  }, [isDragging, startY]);

  // Handle touch end
  const onTouchEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);
    const threshold = config.dragThreshold;

    // Determine new state based on drag direction and distance
    if (currentTranslateY > threshold) {
      // Dragged down - go to lower state
      if (startStateRef.current === 'full') {
        setState('half');
      } else if (startStateRef.current === 'half') {
        setState('collapsed');
      }
    } else if (currentTranslateY < -threshold) {
      // Dragged up - go to higher state
      if (startStateRef.current === 'collapsed') {
        setState('half');
      } else if (startStateRef.current === 'half') {
        setState('full');
      }
    }
    // If drag distance is less than threshold, return to original state (no change)

    setCurrentTranslateY(0);
  }, [isDragging, currentTranslateY, config.dragThreshold]);

  // Reset translate when state changes externally
  useEffect(() => {
    setCurrentTranslateY(0);
  }, [state]);

  return {
    sheetRef,
    contentRef,
    state,
    setState,
    isDragging,
    currentTranslateY,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    getHeightPercent,
  };
}
