import { useEffect, type RefObject } from 'react';

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Scroll-scrubbed scenes with zero React re-renders. Every [data-scene] under root gets CSS vars:
 *   --p  raw progress 0..1
 *   --e  eased progress (accelerating, for "flying at you" motion)
 * data-scene="pin"  : tall section holding a sticky child. p = how far through the pinned scroll.
 * data-scene="pass" : p = 0 when the section enters the viewport bottom, 1 when it leaves the top.
 * data-steps="n"    : also marks the nth child of [data-step-list] with aria-current (discrete steps).
 * Root gets --page (whole page progress) and --mx/--my (pointer, -1..1) for parallax.
 * Reduced motion: every scene snaps to data-rest (default 1) and the pointer is ignored.
 */
export function useScenes(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const scenes = Array.from(el.querySelectorAll<HTMLElement>('[data-scene]'));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;

    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const s of scenes) {
        const r = s.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue; // far off-screen, skip
        const pin = s.dataset.scene === 'pin';
        const p = reduced
          ? Number(s.dataset.rest ?? 1)
          : pin
            ? clamp(-r.top / Math.max(1, r.height - vh))
            : clamp((vh - r.top) / (vh + r.height));
        s.style.setProperty('--p', p.toFixed(4));
        s.style.setProperty('--e', Math.pow(p, 1.8).toFixed(4));
        const n = Number(s.dataset.steps);
        if (n) {
          const idx = Math.min(n - 1, Math.floor(p * n));
          s.style.setProperty('--s', String(idx));
          s.querySelectorAll<HTMLElement>('[data-step-list] > *').forEach((li, i) => {
            if (i === idx) li.setAttribute('aria-current', 'step');
            else li.removeAttribute('aria-current');
          });
        }
      }
      const max = document.documentElement.scrollHeight - vh;
      el.style.setProperty('--page', (max > 0 ? clamp(window.scrollY / max) : 0).toFixed(4));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onPointer = (e: PointerEvent) => {
      el.style.setProperty('--mx', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
      el.style.setProperty('--my', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('pointermove', onPointer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [root]);
}
