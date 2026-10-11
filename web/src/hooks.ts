import { useCallback, useEffect, useRef, useState } from 'react';

/** Ticks once a second so wait clocks and aging bars move between polls. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface Polled<T> {
  data: T | undefined;
  error: Error | undefined;
  /** Local time the last successful response arrived. */
  fetchedAt: number;
  refresh: () => void;
}

/**
 * Polls with setTimeout (never overlapping requests) and keeps the last good data through errors.
 * `stopOn(err)` returning true stops polling (e.g. a 404 meaning the feature is off).
 */
export function usePoll<T>(
  fn: () => Promise<T>,
  intervalMs: number,
  enabled = true,
  stopOn?: (err: unknown) => boolean,
): Polled<T> {
  const [state, setState] = useState<{ data?: T; error?: Error; fetchedAt: number }>({ fetchedAt: 0 });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const stopRef = useRef(stopOn);
  stopRef.current = stopOn;
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      try {
        const data = await fnRef.current();
        if (alive) setState({ data, error: undefined, fetchedAt: Date.now() });
      } catch (err) {
        if (alive) setState((s) => ({ ...s, error: err as Error }));
        if (stopRef.current?.(err)) return;
      }
      if (alive) timer = setTimeout(tick, intervalMs);
    };
    kick.current = () => void tick();
    void tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs, enabled]);

  const refresh = useCallback(() => kick.current(), []);
  return { data: state.data, error: state.error, fetchedAt: state.fetchedAt, refresh };
}

/** Debounces a value. */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Rolls a displayed number toward `target` (ease-out cubic). Interruptible: a new
 * target continues from the value currently on screen. `startFrom` makes the first
 * render count up (used once, for the time-returned total).
 */
export function useCountUp(target: number, duration = 600, startFrom?: number): number {
  const [v, setV] = useState(startFrom ?? target);
  const shown = useRef(startFrom ?? target);
  useEffect(() => {
    if (prefersReducedMotion() || duration <= 0) {
      shown.current = target;
      setV(target);
      return;
    }
    const from = shown.current;
    if (from === target) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      shown.current = from + (target - from) * e;
      setV(shown.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return Math.round(v);
}

/**
 * Keeps items that just left `items` rendered for `exitMs` (flagged `leaving`) so they
 * can animate out in place. Leaving items keep their last position.
 */
export function usePresence<T>(items: T[], keyOf: (t: T) => string, exitMs: number): Array<{ item: T; key: string; leaving: boolean }> {
  const leaving = useRef(new Map<string, { item: T; index: number; until: number }>());
  const prev = useRef<T[]>([]);
  const [, force] = useState(0);

  const keys = new Set(items.map(keyOf));
  prev.current.forEach((it, index) => {
    const k = keyOf(it);
    if (!keys.has(k) && !leaving.current.has(k)) leaving.current.set(k, { item: it, index, until: Date.now() + exitMs });
  });
  for (const k of keys) leaving.current.delete(k);
  prev.current = items;

  useEffect(() => {
    if (!leaving.current.size) return;
    const soonest = Math.min(...[...leaving.current.values()].map((l) => l.until));
    const id = setTimeout(() => {
      const now = Date.now();
      for (const [k, l] of leaving.current) if (l.until <= now) leaving.current.delete(k);
      force((n) => n + 1);
    }, Math.max(0, soonest - Date.now()) + 16);
    return () => clearTimeout(id);
  });

  const out: Array<{ item: T; key: string; leaving: boolean }> = items.map((item) => ({ item, key: keyOf(item), leaving: false }));
  [...leaving.current.entries()]
    .sort((a, b) => a[1].index - b[1].index)
    .forEach(([key, l]) => out.splice(Math.min(l.index, out.length), 0, { item: l.item, key, leaving: true }));
  return out;
}
