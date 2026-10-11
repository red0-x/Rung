import type { CSSProperties } from 'react';

/** Hand-drawn accents: arrows, swash, sparkles, and the scalloped "Known caller" seal. All inline SVG. */

type Pt = [number, number];

/** Cubic curve from a to b with controls c1, c2, plus an open arrowhead aimed along c2 -> b. */
function arrowPaths(a: Pt, c1: Pt, c2: Pt, b: Pt, head = 11): { body: string; tip: string } {
  const ang = Math.atan2(b[1] - c2[1], b[0] - c2[0]);
  const wing = (off: number): Pt => [
    b[0] - head * Math.cos(ang + off),
    b[1] - head * Math.sin(ang + off),
  ];
  const [l, r] = [wing(0.5), wing(-0.5)];
  const f = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  return {
    body: `M${f(a)} C${f(c1)}, ${f(c2)}, ${f(b)}`,
    tip: `M${f(l)} L${f(b)} L${f(r)}`,
  };
}

// Coordinates live in a fixed 1200 x 700 frame centred on the phone (phone spans x 450..750).
const ARROWS = [
  // the call drops into the team's queue
  arrowPaths([442, 430], [380, 452], [306, 420], [292, 330]),
  // ...and arrives with a brief
  arrowPaths([766, 640], [820, 686], [920, 690], [944, 640]),
];

export function Arrows() {
  return (
    <svg className="landing-arrows" viewBox="0 0 1200 700" width="1200" height="700" aria-hidden="true">
      {ARROWS.map((a, i) => (
        <g key={i} className="landing-arrow" style={{ '--d': `${750 + i * 140}ms` } as CSSProperties}>
          <path className="landing-arrow-body" d={a.body} pathLength={1} />
          <path className="landing-arrow-tip" d={a.tip} />
        </g>
      ))}
    </svg>
  );
}

export function Swash() {
  return (
    <svg className="landing-swash" viewBox="0 0 300 28" preserveAspectRatio="none" aria-hidden="true">
      <path d="M6 18 C 60 8, 150 6, 294 12" pathLength={1} />
      <path d="M40 23 C 110 15, 190 14, 250 18" pathLength={1} />
    </svg>
  );
}

export function Sparkles() {
  return (
    <svg className="landing-sparkles" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
      <path d="M8 22 L2 26" />
      <path d="M14 12 L10 4" />
      <path d="M24 10 L27 2" />
    </svg>
  );
}

/** Scalloped seal path: n bumps around a circle. */
function sealPath(n: number, r: number, bump: number, cx = 50, cy = 50): string {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    if (i === 0) {
      d += `M${x.toFixed(2)} ${y.toFixed(2)}`;
    } else {
      const m = ((i - 0.5) / n) * Math.PI * 2;
      const qx = cx + (r + bump) * Math.cos(m);
      const qy = cy + (r + bump) * Math.sin(m);
      d += ` Q${qx.toFixed(2)} ${qy.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
  }
  return d + 'Z';
}

const SEAL = sealPath(14, 40, 10);

/** Recognized by caller ID: pops in when Rung greets the caller by name. */
export function CallerSeal({ on }: { on: boolean }) {
  return (
    <div className="landing-seal" data-on={on}>
      <svg viewBox="0 0 100 100" width="104" height="104" role="img" aria-label="Known caller">
        <path d={SEAL} fill="var(--cobalt)" />
        <path d="M33 51 L45 63 L68 38" fill="none" stroke="var(--ivory)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="landing-seal-label">Known caller ✓</span>
    </div>
  );
}

/**
 * The brand sheet's supporting pattern behind the phone: fat cobalt rounded bars,
 * one stepping down to the next through a diagonal connector (pitch-deck cover).
 */
export function PillPattern() {
  return (
    <svg className="landing-pills" viewBox="0 0 1200 700" width="1200" height="700" aria-hidden="true">
      <path d="M600 214 H 790 L 900 340 H 1110" className="landing-pill-shape" />
    </svg>
  );
}
