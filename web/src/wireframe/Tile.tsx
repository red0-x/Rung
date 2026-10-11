import type { CSSProperties, ReactNode } from 'react';

/** Floating detail. x/y = resting spot, fx/fy = vw/vh drift, fz = px flown toward camera (negative = away), r = tilt, k = pointer parallax depth.
 *  Needs a [data-scene] ancestor (useScenes writes --p/--e) and a `perspective` parent. Styles live in wireframe.css (.wf-tile). */
export function Tile(p: {
  cls: string;
  x: string;
  y: string;
  fx: number;
  fy: number;
  fz: number;
  r: number;
  fr?: number;
  k: number;
  w?: string;
  children: ReactNode;
}) {
  const style = {
    '--x': p.x, '--y': p.y, '--fx': p.fx, '--fy': p.fy, '--fz': p.fz,
    '--r': p.r, '--fr': p.fr ?? 0, '--k': p.k, width: p.w,
  } as CSSProperties;
  return (
    <div className={`wf-tile ${p.cls}`} style={style} aria-hidden="true">
      <div className="wf-tile-in">{p.children}</div>
    </div>
  );
}

export const Cube = ({ cls, x, y, fx, fy, fz, r, s }: { cls: string; x: string; y: string; fx: number; fy: number; fz: number; r: number; s: number }) => (
  <Tile cls={`wf-cube ${cls}`} x={x} y={y} fx={fx} fy={fy} fz={fz} r={r} fr={40} k={s} w={`${40 + s * 14}px`}>
    <span />
  </Tile>
);
