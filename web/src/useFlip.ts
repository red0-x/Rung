import { useLayoutEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion } from './hooks';

// Strong ease-out for entrances; iOS drawer curve for on-screen moves (reads like a damped spring).
export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
export const EASE_MOVE = 'cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * When the ranking changes, slide each row from where it is on screen to its new slot,
 * and ease new arrivals in. Interruptible: a reorder mid-slide continues from the row's
 * current visual position. Rows are direct children with data-id; rows marked
 * data-leaving are animating out and are ignored. The first render staggers rows in.
 */
export function useFlip(listRef: RefObject<HTMLElement | null>, orderKey: string) {
  const tops = useRef(new Map<string, number>());
  const lastKey = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const reduce = prefersReducedMotion();
    const first = lastKey.current === null;
    const changed = !first && lastKey.current !== orderKey;
    const next = new Map<string, number>();
    let i = 0;

    for (const child of Array.from(el.children) as HTMLElement[]) {
      const id = child.dataset.id;
      if (!id || child.dataset.leaving) continue;
      const top = child.offsetTop;
      next.set(id, top);
      const index = i++;
      if (reduce) continue;

      if (first) {
        child.animate(
          [
            { opacity: 0, transform: 'translateY(10px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 360, delay: index * 60, easing: EASE_OUT, fill: 'backwards' },
        );
        continue;
      }
      if (!changed) continue;

      const before = tops.current.get(id);
      if (before === undefined) {
        child.animate(
          [
            { opacity: 0, transform: 'translateY(-14px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 320, easing: EASE_OUT },
        );
        continue;
      }
      // Carry any in-flight offset so a second reorder doesn't snap.
      let inFlight = 0;
      const running = child.getAnimations().filter((a) => a.id === 'flip');
      if (running.length) {
        inFlight = new DOMMatrixReadOnly(getComputedStyle(child).transform).m42;
        running.forEach((a) => a.cancel());
      }
      const dy = before + inFlight - top;
      if (Math.abs(dy) < 0.5) continue;
      const anim = child.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], {
        duration: 420,
        easing: EASE_MOVE,
      });
      anim.id = 'flip';
    }
    tops.current = next;
    lastKey.current = orderKey;
  });
}

/** Collapses an element out (height + fade) when `leaving` turns true. */
export function useCollapseOut(ref: RefObject<HTMLElement | null>, leaving: boolean, ms: number) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !leaving) return;
    const h = el.offsetHeight;
    el.style.overflow = 'hidden';
    el.animate(
      [
        { height: `${h}px`, opacity: 1 },
        { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px', borderBottomWidth: '0px' },
      ],
      { duration: prefersReducedMotion() ? 0 : ms, easing: EASE_OUT, fill: 'forwards' },
    );
  }, [leaving, ms, ref]);
}
