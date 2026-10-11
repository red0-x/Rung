import { useEffect, type RefObject } from 'react';

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const nums = (s?: string) => s?.split(',').map(Number);
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/**
 * Scroll-scrubbed scenes with zero React re-renders. Every [data-scene] under root gets CSS vars:
 *   --p  raw progress 0..1
 *   --e  eased progress (accelerating, for "flying at you" motion)
 * data-scene="pin"  : tall section holding a sticky child. p = how far through the pinned scroll.
 * data-scene="pass" : p = 0 when the section enters the viewport bottom, 1 when it leaves the top.
 * data-scene="leave": p = 0 while the section top is at/below the viewport top, 1 once it has fully scrolled away (hero).
 * data-steps="a,b"  : progress where each step starts. Marks the nth child of [data-step-list] aria-current.
 * data-beats="a,b"  : progress where each beat starts. Sets --beat and data-beat (1-based count of started beats). CSS turns
 *                     that into discrete show/hide with calc(), and transitions play on the change.
 * [data-clock="s,e,n"] (any element inside a scene): a timer that runs 0..n seconds while the scene is between progress
 *                     s and e. Sets --clk (0..1) on itself and writes m:ss into its [data-t] child.
 * Root gets --page (whole page progress) and --mx/--my (pointer, -1..1) for parallax.
 * Reduced motion: every scene snaps to data-rest (default 1) and the pointer is ignored.
 */
export function useScenes(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const scenes = Array.from(el.querySelectorAll<HTMLElement>('[data-scene]'));
    const clocks = new Map(scenes.map((s) => [s, Array.from(s.querySelectorAll<HTMLElement>('[data-clock]'))]));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;

    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const s of scenes) {
        const r = s.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue; // far off-screen, skip
        const d = s.dataset;
        const p = reduced
          ? Number(d.rest ?? 1)
          : d.scene === 'pin'
            ? clamp(-r.top / Math.max(1, r.height - vh))
            : d.scene === 'leave'
              ? clamp(-r.top / r.height)
              : clamp((vh - r.top) / (vh + r.height));
        s.style.setProperty('--p', p.toFixed(4));
        s.style.setProperty('--e', Math.pow(p, 1.8).toFixed(4));

        const beats = nums(d.beats);
        if (beats) {
          const beat = String(beats.filter((t) => t <= p).length);
          if (d.beat !== beat) {
            s.style.setProperty('--beat', beat);
            d.beat = beat;
          }
        }

        for (const c of clocks.get(s) ?? []) {
          const [a, b, n] = nums(c.dataset.clock) as [number, number, number];
          const k = clamp((p - a) / (b - a));
          c.style.setProperty('--clk', k.toFixed(4));
          const t = c.querySelector('[data-t]');
          if (t) t.textContent = mmss(Math.round(k * n));
        }

        const starts = nums(d.steps);
        if (starts) {
          const idx = starts.filter((t) => t <= p).length - 1;
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
