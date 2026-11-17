import { useEffect, useState } from 'react';

interface CountUpOptions {
  /** Length of the count in ms. */
  duration?: number;
  /** Wait before counting, in ms, measured from when `start` becomes true. */
  delay?: number;
  /**
   * Count in whole steps at even intervals (linear, rounding down) instead of easing out, e.g. to keep
   * "3 of 4" in time with bars that fill one after another.
   */
  stepped?: boolean;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Counts whole numbers from 0 up to `target` once `start` is true, and returns the current value. Before
 * `start` it returns 0. People who ask for reduced motion see `target` straight away. Show the result
 * aria-hidden next to the final value in visually hidden text, so screen readers don't hear the ticking.
 */
export function useCountUp(target: number, start: boolean, { duration = 900, delay = 0, stepped = false }: CountUpOptions = {}) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (!start) return;
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const begin = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(Math.max((now - begin) / duration, 0), 1);
      setValue(stepped ? Math.floor(target * t) : Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, target, duration, delay, stepped]);

  return value;
}
