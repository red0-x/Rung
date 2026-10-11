import { useRef, type CSSProperties } from 'react';
import { Tile, Cube } from './Tile';
import { Logo } from '../brand/Logo';
import { useScenes } from './useScenes';
import CallStory from './CallStory';
import './wireframe.css';
import './story.css';

const STATEMENT = 'Your customers never wait on hold. Your team never starts a callback cold. Every call arrives ranked, briefed and ready.'.split(' ');

const CARDS = [
  ['01', 'Verified caller', 'No more "can you spell your name". One SMS code and they are known.', 'wf-c1'],
  ['02', 'Full history', 'Every past call, every promise made, one scroll away.', 'wf-c2'],
  ['03', 'Ranked brief', 'Critical first. A score and a reason for every spot in the queue.', 'wf-c3'],
  ['04', 'Callback script', 'Open with the answer, not the question. Drafted before you dial.', 'wf-c4'],
  ['05', 'Team notes', 'Shared context for the next person. Nothing lives in one head.', 'wf-c5'],
];

const STACK = ['Dial', 'Supabase', 'Vercel', 'Keewano', 'Claude', 'React', 'TypeScript', 'MCP'];

const QUEUE = [
  ['Maria Reyes', 'Card charge she didn’t make, $4,200', 'CRITICAL', 94, 'crit'],
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
        <a href="/" className="wf-brand" aria-label="Rung home"><Logo size={24} title="Rung" /></a>
        <nav aria-label="Sections">
          <a href="#story">How it works</a>
          <a href="#teams">For teams</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <span className="wf-nav-actions">
          <a href="/login" className="wf-login">Log in</a>
          <a href="/login?signup" className="wf-btn wf-btn-ink wf-btn-sm">Get started</a>
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
                <a className="wf-btn wf-btn-ink wf-btn-xl" href="/login?signup">
                  <span className="wf-btn-mark"><Logo variant="mark" size={22} title="" /></span> Explore the platform
                </a>
                <a className="wf-btn wf-btn-ghost wf-btn-xl" href="#story">See a call happen</a>
              </div>
            </div>

            <div className="wf-stage">
              {/* centerpiece: the real Rung dashboard layout, text removed */}
              <div className="wf-dash wf-app" aria-hidden="true">
                <aside className="wf-app-side">
                  <span className="wf-app-logo"><Logo variant="mark" size={16} title="" /></span>
                  <i className="on" /><i /><i /><i />
                  <span className="wf-app-org" />
                </aside>
                <div className="wf-app-main">
                  <div className="wf-app-head"><span className="sk sk-title" /><span className="wf-app-pill"><b /><span className="sk" /></span></div>
                  <div className="wf-app-tiles">
                    <div className="t t-cobalt"><span className="sk" /><b /></div>
                    <div className="t"><span className="sk" /><div className="wf-app-bars">{[70, 45, 90, 30, 60, 20].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div></div>
                    <div className="t"><span className="sk" /><div className="wf-app-tiers">{['crit', 'high', 'norm', 'low'].map((t) => <i key={t} className={`tier-${t}`} />)}</div></div>
                    <div className="t"><span className="sk" /><span className="sk sk-w" /></div>
                  </div>
                  <div className="wf-app-md">
                    <div className="wf-app-list">
                      {['crit', 'high', 'high', 'norm', 'low'].map((t, i) => (
                        <div key={i} className={`r${i === 0 ? ' sel' : ''}`}><i className={`tier-${t}`} /><span><span className="sk" /><span className="sk sk-s" /></span><b /></div>
                      ))}
                    </div>
                    <div className="wf-app-detail">
                      <div className="wf-app-who"><i className="tier-crit" /><span><span className="sk" /><span className="sk sk-s" /></span></div>
                      <div className="wf-app-chips"><span /><span /><span /></div>
                      <span className="sk sk-l" /><span className="sk sk-l" /><span className="sk sk-m" />
                      <div className="wf-app-btns"><span className="ink" /><span /></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* flying details */}
              <Tile cls="wf-t-pink" x="2%" y="24%" w="min(16vw,230px)" fx={-22} fy={-9} fz={620} r={-8} fr={-14} k={1.2}>
                <svg viewBox="0 0 200 130" className="wf-curve">
                  <path d="M20 112 C 40 6, 160 6, 180 112" />
                  <circle cx="20" cy="112" r="5" /><circle cx="180" cy="112" r="5" />
                </svg>
              </Tile>
              <Tile cls="wf-t-purple" x="3%" y="47%" w="min(16vw,230px)" fx={-14} fy={-14} fz={520} r={-6} k={1.8}>
                <h6>Verification</h6><p>✓ SMS code matched</p>
              </Tile>
              <Tile cls="wf-t-green" x="11%" y="67%" w="min(12vw,170px)" fx={-18} fy={8} fz={700} r={8} fr={10} k={2.4}>
                <div className="wf-step"><i>‹</i><b>1</b><i>›</i></div><small>Rings before pickup</small>
              </Tile>
              <Tile cls="wf-t-orange" x="3%" y="80%" w="min(19vw,270px)" fx={-16} fy={14} fz={450} r={-9} k={1.4}>
                <div className="wf-pill-sel"><i>‹</i><span>Critical</span><i>›</i></div>
              </Tile>
              <Tile cls="wf-t-yellow" x="14%" y="92%" w="min(21vw,300px)" fx={-8} fy={22} fz={360} r={3} k={0.9}>
                <h6>Hold time</h6>
                <div className="wf-slider"><s /><s /></div>
                <div className="wf-slider-l"><span>0:00</span><span>0:30</span><span>Never</span></div>
              </Tile>
              <Tile cls="wf-t-lime" x="84%" y="44%" w="min(16vw,230px)" fx={14} fy={-18} fz={560} r={7} fr={9} k={1.6}>
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
              <Cube cls="wf-cb-cyan" x="17%" y="60%" fx={-12} fy={4} fz={800} r={-12} s={3} />
              <Cube cls="wf-cb-yellow" x="91%" y="74%" fx={16} fy={10} fz={780} r={10} s={2.4} />
            </div>
          </div>
        </section>

        {/* ---------- 2. STORY: first call, returning call, the rep (CallStory.tsx) ---------- */}
        <CallStory />

        {/* ---------- 3. BRIEF: horizontal scroll ---------- */}
        <section className="wf-h" id="brief" data-scene="pin" data-rest="0">
          <div className="wf-h-stick">
            <h2 className="wf-display wf-h2 wf-h-title">Everything your agent<br />already knows</h2>
            <div className="wf-track">
              {CARDS.map(([n, t, d, c]) => (
                <article key={n} className={`wf-hcard ${c}`}>
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
            <a className="wf-btn wf-btn-ivory wf-btn-xl" href="/login?signup">Start for free</a>
          </div>
        </section>
      </main>

      <section className="wf-made" aria-label="Made with">
        <p>Made with</p>
        <div className="wf-marquee">
          <div className="wf-mq-track">
            {[...STACK, ...STACK].map((name, i) => (
              <span key={i} aria-hidden={i >= STACK.length || undefined}>{name}</span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
