import { useRef, type CSSProperties } from 'react';
import { Tile, Cube } from './Tile';
import { Logo } from '../brand/Logo';
import { useScenes } from './useScenes';
import './wireframe.css';
import './story.css';

const STATEMENT = 'Your customers never wait on hold. Your team never starts a callback cold. Every call arrives ranked, briefed and ready.'.split(' ');

const STEPS = [
  ['Ring', 'The line rings. Rung picks up on the first ring.'],
  ['Recognize', 'SMS code. Verified. The agent already knows who is calling.'],
  ['Capture', 'Callers explain once. The issue lands in plain words.'],
  ['Rank', 'Scored, queued, briefed. It appears in your dashboard.'],
];

const CARDS = [
  ['01', 'Verified caller', 'No more "can you spell your name". One SMS code and they are known.', 'wf-c1'],
  ['02', 'Full history', 'Every past call, every promise made, one scroll away.', 'wf-c2'],
  ['03', 'Ranked brief', 'Critical first. A score and a reason for every spot in the queue.', 'wf-c3'],
  ['04', 'Callback script', 'Open with the answer, not the question. Drafted before you dial.', 'wf-c4'],
  ['05', 'Team notes', 'Shared context for the next person. Nothing lives in one head.', 'wf-c5'],
];

/** Story progress at which each transcript line appears (call connects at 0.06, ends ~0.56, dashboard ~0.62). */
const AT = [0.08, 0.14, 0.2, 0.27, 0.34, 0.42, 0.5];
const BARS = Array.from({ length: 26 }, (_, i) => i);
const TRANSCRIPT: [string, string][] = [
  ['a', 'Thanks for calling Demo Bank. Who am I speaking with?'],
  ['c', "Hi, it's Maya Chen."],
  ['a', "Hi Maya. I just texted you a code so I know it's you."],
  ['c', 'Got it. Four, eight, two, nine, one, seven.'],
  ['a', "Verified. How can I help?"],
  ['c', 'My card was declined at checkout. Twice.'],
  ['a', "Got it. A specialist will call you back first. Talk soon, Maya."],
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
          <a href="/login?signup" className="wf-btn wf-btn-ink wf-btn-sm">Start for free</a>
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
        <section className="wf-story" id="story" data-scene="pin" data-steps="0,0.14,0.34,0.56" data-at={AT.join(',')}>
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
              <div className="wf-device">
                <div className="wf-phone">
                  <div className="wf-island" />
                  <div className="wf-status"><b>9:41</b><span>●●●● 5G ▮</span></div>

                  <div className="wf-call">
                    <div className="wf-callhead">
                      <div className="wf-avatar"><Logo variant="mark" size={26} title="" /></div>
                      <b>Demo Bank Support</b>
                      <span>Rung line · connected</span>
                    </div>
                    <div className="wf-tx" aria-label="Live transcript">
                      {TRANSCRIPT.map(([who, text], i) => (
                        <p key={i} className={`wf-ln wf-ln-${who}`} style={{ '--at': AT[i] } as CSSProperties}>
                          <small>{who === 'a' ? 'Rung' : 'Maya'}</small>{text}
                        </p>
                      ))}
                    </div>
                    <div className="wf-vizs" aria-hidden="true">
                      <div className="wf-viz wf-viz-caller"><small>Caller</small><div>{BARS.map((i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</div></div>
                      <div className="wf-viz wf-viz-agent"><small>Rung</small><div>{BARS.map((i) => <i key={i} style={{ '--i': i + 5 } as CSSProperties} />)}</div></div>
                    </div>
                    <div className="wf-ctrls" aria-hidden="true">
                      {['mute', 'keypad', 'speaker'].map((c) => <span key={c}><i />{c}</span>)}
                    </div>
                    <span className="wf-end-call" aria-hidden="true">✕</span>
                  </div>

                  <div className="wf-incoming" aria-hidden="true">
                    <span className="wf-in-sub">mobile</span>
                    <b>Demo Bank Support</b>
                    <div className="wf-in-btns"><span className="no">✕<small>Decline</small></span><span className="yes">✆<small>Accept</small></span></div>
                  </div>
                  <i className="wf-home" />
                </div>

                <div className="wf-dashwin">
                  <div className="wf-dw-bar"><i /><i /><i /><span>rung / queue</span></div>
                  <div className="wf-dw-body">
                    <p className="wf-dw-new">+ New callback from the call you just heard</p>
                    <div className="wf-qrow2 wf-qr-new">
                      <span className="n">1</span>
                      <div><b>Maya Chen</b><p>Card declined at checkout</p></div>
                      <em>CRITICAL</em><strong>94</strong>
                    </div>
                    <div className="wf-qrow2"><span className="n">2</span><div><b>Omar Haddad</b><p>Wire transfer stuck 3 days</p></div><em className="h">HIGH</em><strong>78</strong></div>
                    <div className="wf-qrow2"><span className="n">3</span><div><b>Priya Nair</b><p>Update mailing address</p></div><em className="n2">NORMAL</em><strong>41</strong></div>
                    <div className="wf-brief">
                      <small>BRIEF</small>
                      <p><b>Verified by SMS.</b> Two declines today on the card ending 4417. Likely a fraud hold. Offer to lift it and confirm the last charge.</p>
                      <div className="wf-brief-tags"><span>Verified</span><span>2nd call this week</span><span>Callback script ready</span></div>
                    </div>
                  </div>
                </div>
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
            <a className="wf-btn wf-btn-ivory wf-btn-xl" href="/login?signup">Start for free</a>
          </div>
        </section>
      </main>
    </div>
  );
}
