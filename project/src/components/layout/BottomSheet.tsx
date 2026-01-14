import { useState, useRef, useCallback } from 'react';
import type { BottomSheetState } from '../../types/ui';

interface BottomSheetProps {
  state: BottomSheetState;
  onStateChange: (state: BottomSheetState) => void;
  children: React.ReactNode;
  className?: string;
}

// Snap point heights (vh percentages)
const SNAP_HEIGHTS: Record<BottomSheetState, number> = {
  collapsed: 12,  // 12vh (약 80-100px)
  half: 50,       // 50vh
  full: 88,       // 88vh
};

export function BottomSheet({
  state,
  onStateChange,
  children,
  className = '',
}: BottomSheetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Get current height based on state
  const getHeight = () => SNAP_HEIGHTS[state];

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    const isHandle = target.closest('[data-sheet-handle]');
    const contentScrollTop = contentRef.current?.scrollTop ?? 0;

    // Only start drag from handle or when content is at top
    if (isHandle || contentScrollTop === 0) {
      setIsDragging(true);
      startYRef.current = e.touches[0].clientY;
      startHeightRef.current = SNAP_HEIGHTS[state];
    }
  }, [state]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const deltaY = startYRef.current - currentY; // Positive = drag up
    const deltaVh = (deltaY / window.innerHeight) * 100;

    setDragOffset(deltaVh);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);
    const newHeight = startHeightRef.current + dragOffset;
    setDragOffset(0);

    // Determine which snap point to go to
    const threshold = 15; // vh threshold for snap

    if (dragOffset > threshold) {
      // Dragged up
      if (state === 'collapsed') onStateChange('half');
      else if (state === 'half') onStateChange('full');
    } else if (dragOffset < -threshold) {
      // Dragged down
      if (state === 'full') onStateChange('half');
      else if (state === 'half') onStateChange('collapsed');
    }
    // Otherwise stay at current state
  }, [isDragging, dragOffset, state, onStateChange]);

  // Calculate display height
  const displayHeight = isDragging
    ? Math.max(10, Math.min(92, startHeightRef.current + dragOffset))
    : getHeight();

  return (
    <div
      className={`fixed left-0 right-0 bottom-0 bg-white rounded-t-2xl z-40 flex flex-col ${className}`}
      style={{
        height: `${displayHeight}vh`,
        transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Drag Handle */}
      <div
        data-sheet-handle
        className="flex-shrink-0 py-3 cursor-grab active:cursor-grabbing touch-none"
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto" />
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          touchAction: isDragging ? 'none' : 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}
