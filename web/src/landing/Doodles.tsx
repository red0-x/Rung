import type { CSSProperties } from 'react';

/** Hand-drawn accents: arrows, swash, sparkles, and the scalloped "Verified" seal. All inline SVG. */

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
  // queue card -> phone, through the gap above the chips
  arrowPaths([300, 286], [340, 318], [400, 250], [438, 262]),
  // ivory stat tile -> phone, between stat and brief
  arrowPaths([918, 258], [880, 222], [820, 290], [766, 236]),
  // brief card -> phone, lower right swoop
  arrowPaths([968, 520], [960, 600], [850, 610], [768, 560]),
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

export function VerifiedSeal() {
  return (
    <div className="landing-seal">
      <svg viewBox="0 0 100 100" width="104" height="104" role="img" aria-label="Verified">
        <path d={SEAL} fill="var(--cobalt)" />
        <path d="M33 51 L45 63 L68 38" fill="none" stroke="var(--ivory)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="landing-seal-label">Verified ✓</span>
    </div>
  );
}
