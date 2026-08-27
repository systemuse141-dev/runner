import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to track page visibility state to pause intervals/polling
 * when the user is in a different browser tab, saving CPU and network traffic.
 */
export function useVisibility() {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof document === 'undefined') return true;
    return document.visibilityState === 'visible';
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}

/**
 * Custom hook to detect user preference for reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return prefersReduced;
}

/**
 * Custom hook to run interval only when visible and component mounted
 */
export function useControlledInterval(callback: () => void, delay: number | null, isEnabled = true) {
  const isVisible = useVisibility();

  useEffect(() => {
    if (delay === null || !isEnabled || !isVisible) return;

    const timer = setInterval(() => {
      callback();
    }, delay);

    return () => clearInterval(timer);
  }, [callback, delay, isEnabled, isVisible]);
}
