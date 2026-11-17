import { useEffect, useState, type RefObject } from 'react';

/**
 * Becomes true the first time the element is at least `threshold` visible, then stays true. Used to start
 * one-off animations when they can actually be seen (on phones, the hero art can start below the fold).
 * True straight away for people who ask for reduced motion, and in browsers without IntersectionObserver.
 */
export function useInViewOnce(ref: RefObject<Element | null>, threshold = 0.5) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || inView) return;
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, threshold, inView]);

  return inView;
}
