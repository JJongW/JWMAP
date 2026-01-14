import { useState, useEffect } from 'react';
import { BREAKPOINTS, type Breakpoint } from '../types/ui';

interface UseBreakpointReturn {
  isMobile: boolean;      // < lg (1024px)
  isTablet: boolean;      // >= md && < lg
  isDesktop: boolean;     // >= lg
  breakpoint: Breakpoint | 'xs';
  width: number;
}

export function useBreakpoint(): UseBreakpointReturn {
  const [width, setWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determine current breakpoint
  const getBreakpoint = (): Breakpoint | 'xs' => {
    if (width >= BREAKPOINTS['2xl']) return '2xl';
    if (width >= BREAKPOINTS.xl) return 'xl';
    if (width >= BREAKPOINTS.lg) return 'lg';
    if (width >= BREAKPOINTS.md) return 'md';
    if (width >= BREAKPOINTS.sm) return 'sm';
    return 'xs';
  };

  const breakpoint = getBreakpoint();
  const isMobile = width < BREAKPOINTS.lg;
  const isTablet = width >= BREAKPOINTS.md && width < BREAKPOINTS.lg;
  const isDesktop = width >= BREAKPOINTS.lg;

  return {
    isMobile,
    isTablet,
    isDesktop,
    breakpoint,
    width,
  };
}
