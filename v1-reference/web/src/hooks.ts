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

/** Polls with setTimeout (never overlapping requests) and keeps the last good data through errors. */
export function usePoll<T>(fn: () => Promise<T>, intervalMs: number, enabled = true): Polled<T> {
  const [state, setState] = useState<{ data?: T; error?: Error; fetchedAt: number }>({ fetchedAt: 0 });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const data = await fnRef.current();
        if (alive) setState({ data, error: undefined, fetchedAt: Date.now() });
      } catch (err) {
        if (alive) setState((s) => ({ ...s, error: err as Error }));
      }
      if (alive) timer = setTimeout(tick, intervalMs);
    };
    kick.current = () => {
      if (timer) clearTimeout(timer);
      void tick();
    };
    void tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs, enabled]);

  const refresh = useCallback(() => kick.current(), []);
  return { data: state.data, error: state.error, fetchedAt: state.fetchedAt, refresh };
}
