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
  full: 100,      // 100vh (풀스크린)
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
    const content = contentRef.current;
    const contentScrollTop = content?.scrollTop ?? 0;
    const isAtTop = contentScrollTop === 0;

    // Only start drag from handle or when content is at top
    // 드래그 핸들을 누르지 않았고 스크롤 상단에 있지 않으면 드래그 시작 안 함
    if (!isHandle && !isAtTop) {
      return;
    }

    // full 상태에서 드래그 핸들이 없을 때는 드래그 시작 안 함
    // 아래로 당기는 동작 (pull-to-refresh)은 방지
    if (state === 'full' && !isHandle) {
      return;
    }

    setIsDragging(true);
    startYRef.current = e.touches[0].clientY;
    startHeightRef.current = SNAP_HEIGHTS[state];
  }, [state]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;

    const content = contentRef.current;
    const currentY = e.touches[0].clientY;
    const deltaY = startYRef.current - currentY; // Positive = drag up, Negative = drag down

    // 스크롤 중일 때는 드래그를 중단
    if (content) {
      const isScrollable = content.scrollHeight > content.clientHeight;
      const isAtTop = content.scrollTop === 0;
      const isAtBottom = content.scrollTop + content.clientHeight >= content.scrollHeight - 1;
      
      // 스크롤이 가능하고, 상단이나 하단에 있지 않으면 드래그 중단
      if (isScrollable && !isAtTop && !isAtBottom) {
        setIsDragging(false);
        setDragOffset(0);
        return;
      }

      // full 상태에서 아래로 당기는 동작 (pull-to-refresh)은 방지
      if (state === 'full' && deltaY < 0 && isAtTop) {
        setIsDragging(false);
        setDragOffset(0);
        e.preventDefault();
        return;
      }
    }

    const deltaVh = (deltaY / window.innerHeight) * 100;

    // 드래그 중일 때만 preventDefault (스크롤 방지)
    if (Math.abs(deltaVh) > 1) {
      e.preventDefault();
    }

    // 아래로 드래그할 때만 허용 (위로 드래그는 sheet를 닫는 동작)
    setDragOffset(deltaVh);
  }, [isDragging, state]);

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
    ? Math.max(10, Math.min(100, startHeightRef.current + dragOffset))
    : getHeight();

  // full 상태일 때는 rounded 제거 및 top-0
  const isFull = state === 'full' || (isDragging && startHeightRef.current + dragOffset > 95);
  
  return (
    <>
      {/* Backdrop - full 상태일 때만 표시 */}
      {isFull && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => onStateChange('closed')}
        />
      )}
      <div
        className={`fixed left-0 right-0 bottom-0 bg-white z-50 flex flex-col ${isFull ? 'rounded-none' : 'rounded-t-2xl'} ${className}`}
        style={{
          height: `${displayHeight}vh`,
          top: isFull ? 0 : 'auto',
          transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isFull ? 'none' : '0 -4px 20px rgba(0, 0, 0, 0.15)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle - full 상태가 아닐 때만 표시 */}
        {!isFull && (
          <div
            data-sheet-handle
            className="flex-shrink-0 py-3 cursor-grab active:cursor-grabbing touch-none"
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto" />
          </div>
        )}

      {/* Content */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto overscroll-none"
        style={{
          touchAction: isDragging ? 'none' : 'pan-y',
          overscrollBehavior: 'none',
          // @ts-expect-error - WebkitOverflowScrolling is not in React.CSSProperties
          WebkitOverflowScrolling: 'touch',
        }}
        onTouchStart={(e) => {
          // 스크롤 컨테이너에서 pull-to-refresh 방지
          const content = contentRef.current;
          if (content && content.scrollTop === 0) {
            const touch = e.touches[0];
            const startY = touch.clientY;
            let moved = false;
            
            // 아래로 당기는 동작 감지 및 방지
            const handleMove = (moveEvent: TouchEvent) => {
              if (moveEvent.touches.length === 0) return;
              const currentY = moveEvent.touches[0].clientY;
              const deltaY = currentY - startY;
              
              // 아래로 당기는 동작 감지 (10px 이상)
              if (deltaY > 10) {
                moved = true;
                moveEvent.preventDefault();
                moveEvent.stopPropagation();
              }
            };
            
            const handleEnd = () => {
              document.removeEventListener('touchmove', handleMove, { capture: true });
              document.removeEventListener('touchend', handleEnd, { capture: true });
            };
            
            document.addEventListener('touchmove', handleMove, { passive: false, capture: true });
            document.addEventListener('touchend', handleEnd, { capture: true });
          }
        }}
      >
        {children}
      </div>
    </div>
    </>
  );
}
