import { useRef, type CSSProperties, type ReactNode } from 'react';
import { Logo } from '../brand/Logo';
import { useScenes } from './useScenes';
import './wireframe.css';

/** Floating side detail. x/y = resting spot (%), fx/fy = vw/vh drift, fz = px flown toward camera, r = tilt, k = pointer parallax depth. */
function Tile(p: {
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

const Cube = ({ cls, x, y, fx, fy, fz, r, s }: { cls: string; x: string; y: string; fx: number; fy: number; fz: number; r: number; s: number }) => (
  <Tile cls={`wf-cube ${cls}`} x={x} y={y} fx={fx} fy={fy} fz={fz} r={r} fr={40} k={s} w={`${40 + s * 14}px`}>
    <span />
  </Tile>
);

const STATEMENT = 'Your customers never wait on hold. Your team never starts a callback cold. Every call arrives ranked, briefed and ready.'.split(' ');

const STEPS = [
  ['Ring', 'The line rings. Rung picks up on the first ring.'],
  ['Recognize', 'SMS code. Verified. The agent already knows who is calling.'],
  ['Capture', 'Callers explain once. The issue lands in plain words.'],
  ['Rank', 'Scored, queued, briefed. Your team calls back in order.'],
];

const CARDS = [
  ['01', 'Verified caller', 'No more "can you spell your name". One SMS code and they are known.', 'wf-c1'],
  ['02', 'Full history', 'Every past call, every promise made, one scroll away.', 'wf-c2'],
  ['03', 'Ranked brief', 'Critical first. A score and a reason for every spot in the queue.', 'wf-c3'],
  ['04', 'Callback script', 'Open with the answer, not the question. Drafted before you dial.', 'wf-c4'],
  ['05', 'Team notes', 'Shared context for the next person. Nothing lives in one head.', 'wf-c5'],
];

const QUEUE = [
  ['Maya Chen', 'Card declined at checkout', 'CRITICAL', 94, 'crit'],
  ['Omar Haddad', 'Wire transfer stuck 3 days', 'HIGH', 78, 'high'],
  ['Priya Nair', 'Update mailing address', 'NORMAL', 41, 'norm'],
  ['Luis Ortega', 'Question about statement', 'LOW', 18, 'low'],
];

export default function Wireframe() {
  const root = useRef<HTMLDivElement>(null);
  useScenes(root);

  return (
    <div className="wf-root" ref={root}>
      <div className="wf-progress" aria-hidden="true" />

      <header className="wf-nav">
        <a href="/" className="wf-brand" aria-label="Rung home"><Logo size={26} title="Rung" /></a>
        <nav aria-label="Sections">
          <a href="#story">How it works</a>
          <a href="#brief">The brief</a>
          <a href="#teams">For teams</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <span className="wf-nav-actions">
          <a href="/login" className="wf-login">Login</a>
          <a href="/login?signup" className="wf-btn wf-btn-cyan wf-btn-sm">Start for free</a>
        </span>
      </header>

      <main>
        {/* ---------- 1. HERO: side details fly at you ---------- */}
        <section className="wf-hero" data-scene="pin" data-rest="0">
          <div className="wf-hero-stick">
            <div className="wf-hero-copy">
              <h1 className="wf-display">
                <span className="wf-line"><span style={{ '--i': 0 } as CSSProperties}>Calls,</span></span>
                <span className="wf-line"><span style={{ '--i': 1 } as CSSProperties}>fully answered</span></span>
              </h1>
              <p className="wf-sub">
                Rung picks up your support line, verifies callers, and hands your team a ranked callback queue with a
                brief for every call. Nobody waits on hold.
              </p>
              <div className="wf-cta-row">
                <a className="wf-btn wf-btn-cyan wf-btn-xl" href="/login?signup">
                  <span className="wf-btn-mark"><Logo variant="mark" size={22} title="" /></span> Explore the platform
                </a>
                <a className="wf-btn wf-btn-grey wf-btn-xl" href="#story">See a call happen</a>
              </div>
            </div>

            <div className="wf-stage">
              {/* centerpiece dashboard */}
              <div className="wf-dash">
                <div className="wf-dash-top">
                  <div className="wf-panel">
                    <b>Queue today</b>
                    <div className="wf-bars">
                      {[62, 88, 45, 70, 30, 54, 92, 38].map((h, i) => (
                        <i key={i} style={{ height: `${h}%`, '--i': i } as CSSProperties} />
                      ))}
                    </div>
                  </div>
                  <div className="wf-panel wf-donut-panel">
                    <b>Priority</b>
                    <div className="wf-donut"><span>104</span><small>calls</small></div>
                  </div>
                  <div className="wf-panel">
                    <b>Callers</b>
                    {['Verified', 'Returning', 'New'].map((l, i) => (
                      <p className="wf-mini-row" key={l}><i /> {l} <em>{[84, 16, 4][i]}</em></p>
                    ))}
                  </div>
                </div>
                <div className="wf-dash-cards">
                  {['Tiny Calls,', 'Zero Hold,', 'Big Relief', 'Ranked Fast'].map((t, i) => (
                    <div key={t} className={`wf-card-mini wf-m${i}`}>
                      <small>RUNG</small>
                      <strong>{t}</strong>
                      <span />
                    </div>
                  ))}
                </div>
              </div>

              {/* flying details */}
              <Tile cls="wf-t-pink" x="4%" y="22%" w="min(21vw,300px)" fx={-22} fy={-9} fz={620} r={-8} fr={-14} k={1.2}>
                <svg viewBox="0 0 200 130" className="wf-curve">
                  <path d="M20 112 C 40 6, 160 6, 180 112" />
                  <circle cx="20" cy="112" r="5" /><circle cx="180" cy="112" r="5" />
                </svg>
              </Tile>
              <Tile cls="wf-t-purple" x="19%" y="44%" w="min(16vw,230px)" fx={-14} fy={-14} fz={520} r={-6} k={1.8}>
                <h6>Verification</h6><p>✓ SMS code matched</p>
              </Tile>
              <Tile cls="wf-t-green" x="11%" y="67%" w="min(12vw,170px)" fx={-18} fy={8} fz={700} r={8} fr={10} k={2.4}>
                <div className="wf-step"><i>‹</i><b>3</b><i>›</i></div><small>Rings before pickup</small>
              </Tile>
              <Tile cls="wf-t-orange" x="3%" y="80%" w="min(19vw,270px)" fx={-16} fy={14} fz={450} r={-9} k={1.4}>
                <div className="wf-pill-sel"><i>‹</i><span>Critical</span><i>›</i></div>
              </Tile>
              <Tile cls="wf-t-yellow" x="14%" y="92%" w="min(21vw,300px)" fx={-8} fy={22} fz={360} r={3} k={0.9}>
                <h6>Hold time</h6>
                <div className="wf-slider"><s /><s /></div>
                <div className="wf-slider-l"><span>0:00</span><span>0:30</span><span>Never</span></div>
              </Tile>
              <Tile cls="wf-t-lime" x="63%" y="20%" w="min(16vw,230px)" fx={14} fy={-18} fz={560} r={7} fr={9} k={1.6}>
                <h6>Language</h6>
                <div className="wf-chips"><span>EN</span><span className="on">ES</span><span>FR</span><span>PT</span></div>
              </Tile>
              <Tile cls="wf-t-code" x="80%" y="26%" w="min(19vw,270px)" fx={22} fy={-6} fz={640} r={5} fr={8} k={1.1}>
                <pre>{`{
  "caller": "verified",
  "intent": "refund",
  "priority": "critical",
  "score": 94
}`}</pre>
              </Tile>
              <Tile cls="wf-t-toggle" x="72%" y="48%" w="min(8vw,120px)" fx={16} fy={-8} fz={720} r={-10} k={2.6}>
                <div className="wf-toggle"><b /></div>
              </Tile>
              <Tile cls="wf-t-orange2" x="78%" y="62%" w="min(17vw,240px)" fx={20} fy={10} fz={480} r={9} fr={-8} k={1.5}>
                <h6>Priority</h6>
                <div className="wf-radios"><span className="on">Critical</span><span>High</span><span>Low</span></div>
              </Tile>
              <Tile cls="wf-t-pink2" x="68%" y="80%" w="min(14vw,200px)" fx={12} fy={18} fz={600} r={-7} fr={12} k={2}>
                <h6>Hold saved</h6><strong>1,231</strong><small>minutes</small>
                <div className="wf-vslide"><s /></div>
              </Tile>
              <Cube cls="wf-cb-purple" x="86%" y="8%" fx={14} fy={-16} fz={760} r={14} s={2.8} />
              <Cube cls="wf-cb-cyan" x="2%" y="58%" fx={-12} fy={4} fz={800} r={-12} s={3} />
              <Cube cls="wf-cb-yellow" x="91%" y="74%" fx={16} fy={10} fz={780} r={10} s={2.4} />
            </div>
          </div>
        </section>

        {/* ---------- 2. STORY: a call, scrubbed by scroll ---------- */}
        <section className="wf-story" id="story" data-scene="pin" data-steps="4">
          <div className="wf-story-stick">
            <div className="wf-story-left">
              <p className="wf-kicker">Watch</p>
              <h2 className="wf-display wf-h2">The real thing,<br />in action</h2>
              <ol data-step-list className="wf-steps">
                {STEPS.map(([t, d], i) => (
                  <li key={t}>
                    <span className="wf-step-n">0{i + 1}</span>
                    <div><b>{t}</b><p>{d}</p></div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="wf-story-right">
              <div className="wf-phone">
                <div className="wf-phone-head"><i /><span>Rung line · live</span></div>
                <div className="wf-layer wf-l1">
                  <div className="wf-ring" aria-hidden="true"><i /><i /><i /></div>
                  <b>Incoming call</b><span>+1 (415) 555-0142</span>
                </div>
                <div className="wf-layer wf-l2"><small>RECOGNIZED</small><b>Maya Chen</b><span>Demo Bank · verified by SMS ✓</span></div>
                <div className="wf-layer wf-l3"><small>ISSUE</small><b>Card declined at checkout</b><span>Second attempt this week</span></div>
                <div className="wf-layer wf-l4"><small>RANKED</small><b><em>CRITICAL</em> 94</b><span>Callback #1 · brief ready</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 3. BRIEF: horizontal scroll ---------- */}
        <section className="wf-h" id="brief" data-scene="pin" data-rest="0">
          <div className="wf-h-stick">
            <h2 className="wf-display wf-h2 wf-h-title">Everything your agent<br />already knows</h2>
            <div className="wf-track">
              {CARDS.map(([n, t, d, c]) => (
                <article key={n} className={`wf-hcard ${c}`}>
                  <small>{n}</small>
                  <h3>{t}</h3>
                  <p>{d}</p>
                  <div className="wf-hcard-art" aria-hidden="true"><i /><i /><i /></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- 4. STATEMENT: words light up ---------- */}
        <section className="wf-say" id="teams" data-scene="pin" data-rest="1">
          <div className="wf-say-stick">
            <p className="wf-big" style={{ '--n': STATEMENT.length } as CSSProperties}>
              {STATEMENT.map((w, i) => (
                <span key={i} style={{ '--i': i } as CSSProperties}>{w} </span>
              ))}
            </p>
          </div>
        </section>

        {/* ---------- 5. QUEUE: rows drop in, parallax columns ---------- */}
        <section className="wf-queue" id="pricing" data-scene="pass" data-rest="0.5">
          <div className="wf-queue-inner">
            <h2 className="wf-display wf-h2">Ranked.<br />Not racing.</h2>
            <div className="wf-qlist">
              {QUEUE.map(([name, why, tag, score, tone], i) => (
                <div key={name} className={`wf-qrow wf-q-${tone}`} style={{ '--i': i } as CSSProperties}>
                  <span className="wf-qrank">{i + 1}</span>
                  <div><b>{name}</b><p>{why}</p></div>
                  <em>{tag}</em>
                  <span className="wf-qscore"><i style={{ width: `${score}%` }} /></span>
                  <strong>{score}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- 6. CTA: details fly back in ---------- */}
        <section className="wf-end" data-scene="pass" data-rest="0.5">
          <Tile cls="wf-t-pink" x="6%" y="14%" w="min(18vw,260px)" fx={-30} fy={-20} fz={-500} r={-8} k={1.2}>
            <svg viewBox="0 0 200 130" className="wf-curve"><path d="M20 112 C 40 6, 160 6, 180 112" /><circle cx="20" cy="112" r="5" /><circle cx="180" cy="112" r="5" /></svg>
          </Tile>
          <Tile cls="wf-t-lime" x="76%" y="12%" w="min(16vw,230px)" fx={30} fy={-20} fz={-500} r={7} k={1.6}>
            <h6>Language</h6><div className="wf-chips"><span>EN</span><span className="on">ES</span><span>FR</span></div>
          </Tile>
          <Tile cls="wf-t-yellow" x="8%" y="68%" w="min(20vw,280px)" fx={-30} fy={20} fz={-600} r={3} k={0.9}>
            <h6>Hold time</h6><div className="wf-slider"><s /><s /></div>
          </Tile>
          <Tile cls="wf-t-purple" x="74%" y="66%" w="min(16vw,230px)" fx={30} fy={20} fz={-600} r={-6} k={1.8}>
            <h6>Verification</h6><p>✓ SMS code matched</p>
          </Tile>
          <div className="wf-end-copy">
            <h2 className="wf-display wf-h1">Your time,<br />returned.</h2>
            <a className="wf-btn wf-btn-cyan wf-btn-xl" href="/login?signup">Start for free</a>
          </div>
        </section>
      </main>
    </div>
  );
}
