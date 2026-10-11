import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * When the ranking changes, slide each row from where it was to where it is, and
 * ease new arrivals in. This is the one place the page moves on its own: it
 * answers a real change (a caller jumped the queue), so it shows what changed.
 * Rows must be direct children carrying data-id.
 */
export function useFlip(listRef: RefObject<HTMLElement | null>, orderKey: string) {
  const tops = useRef(new Map<string, number>());
  const lastKey = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const orderChanged = lastKey.current !== null && lastKey.current !== orderKey;
    const next = new Map<string, number>();

    for (const child of Array.from(el.children) as HTMLElement[]) {
      const id = child.dataset.id;
      if (!id) continue;
      const top = child.offsetTop;
      next.set(id, top);
      if (!orderChanged || reduce) continue;
      const before = tops.current.get(id);
      if (before === undefined) {
        child.animate(
          [
            { opacity: 0, transform: 'translateY(-18px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' },
        );
      } else if (before !== top) {
        child.animate(
          [{ transform: `translateY(${before - top}px)` }, { transform: 'translateY(0)' }],
          { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' },
        );
      }
    }
    tops.current = next;
    lastKey.current = orderKey;
  });
}
