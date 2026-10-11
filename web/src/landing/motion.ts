import { useEffect, useState, type RefObject } from 'react';

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(REDUCE_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(REDUCE_QUERY);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** True while the element is on screen (or once, if `once`). */
export function useInView(ref: RefObject<Element | null>, once = false, rootMargin = '0px'): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && once) io.disconnect();
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, once, rootMargin]);
  return inView;
}

/**
 * The hero's call sequence. 0 ringing, 1 recognized + greeted, 2 issue captured / caller queued, 3 triaged + ranked.
 * Holds on the final step, then quietly restarts. Paused off-screen; pinned to the final step under reduced motion.
 */
export const FINAL_STEP = 3;
const STEP_MS = [1300, 2300, 2500, 5600];

export function useCallLoop(ref: RefObject<Element | null>): number {
  const reduced = usePrefersReducedMotion();
  const visible = useInView(ref);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduced || !visible) return;
    const t = window.setTimeout(() => setStep((s) => (s + 1) % (FINAL_STEP + 1)), STEP_MS[step]);
    return () => window.clearTimeout(t);
  }, [step, visible, reduced]);

  return reduced ? FINAL_STEP : step;
}

/** Counts 0 -> target once, the first time the element scrolls into view. */
export function useCountUp(ref: RefObject<Element | null>, target: number, durationMs = 1400): number {
  const reduced = usePrefersReducedMotion();
  const seen = useInView(ref, true);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (reduced || !seen) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, reduced, target, durationMs]);

  return reduced ? target : value;
}

/** Adds data-in to every [data-reveal] under root as it scrolls into view (once). */
export function useReveal(ref: RefObject<Element | null>): void {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>('[data-reveal]');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.in = '';
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ref]);
}
