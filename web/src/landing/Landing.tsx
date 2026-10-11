import { useState, type CSSProperties, type FormEvent } from 'react';
import '../brand.css';
import './landing.css';
import Phone from './Phone';
import { Arrows, Sparkles, Swash, VerifiedSeal } from './Doodles';

/** Inline style helper: --d (drift-in delay) and --r (resting rotation). */
function drift(delayMs: number, rotateDeg = 0): CSSProperties {
  return { '--d': `${delayMs}ms`, '--r': `${rotateDeg}deg` } as CSSProperties;
}

function signupHref(email: string): string {
  const trimmed = email.trim();
  return trimmed ? `/login?signup&email=${encodeURIComponent(trimmed)}` : '/login?signup';
}

const QUEUE = [
  { rank: 1, name: 'Maria R.', intent: 'Suspected fraud', amount: '$4,200', tier: 'critical', u: 62, v: 14, a: 8 },
  { rank: 2, name: 'Dev P.', intent: 'Open account', amount: '$10M', tier: 'normal', u: 22, v: 44, a: 6 },
  { rank: 3, name: 'Sam K.', intent: 'Card dispute', amount: '$12', tier: 'low', u: 18, v: 4, a: 30 },
] as const;

export default function Landing() {
  const [email, setEmail] = useState('');

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    window.location.assign(signupHref(email));
  }

  return (
    <div className="landing-root">
      <header className="landing-nav">
        <a className="landing-logo" href="/" aria-label="Rung home">Rung</a>
        <nav className="landing-nav-links" aria-label="Sections">
          <a href="#how">How it works</a>
          <span aria-hidden="true">·</span>
          <a href="#teams">For teams</a>
          <span aria-hidden="true">·</span>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="landing-nav-actions">
          <a className="landing-login" href="/login">Log in</a>
          <a className="landing-pill landing-pill-ink landing-pill-sm" href="/login?signup">
            Get started — it's free
          </a>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <p className="landing-eyebrow landing-drift" style={drift(0)}>
            <span className="landing-live-dot" aria-hidden="true" /> Phone support with memory
          </p>
          <h1 className="landing-headline landing-drift" style={drift(60)}>
            Your time,{' '}
            <span className="landing-swash-word">
              returned.
              <Swash />
            </span>
          </h1>
          <p className="landing-sub landing-drift" style={drift(140)}>
            Remembered callers. Callbacks instead of hold music.
          </p>
          <form className="landing-form landing-drift" style={drift(200)} onSubmit={onSubmit}>
            <label className="landing-input-wrap">
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                <rect x="2.5" y="4.5" width="15" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 5.5l7 5 7-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <span className="landing-sr">Work email</span>
              <input
                type="email"
                name="email"
                placeholder="Work email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button type="submit" className="landing-pill landing-pill-ink">Get started</button>
          </form>

          <div className="landing-stage">
            <div className="landing-blob" aria-hidden="true" />
            <div className="landing-blob landing-blob-2" aria-hidden="true" />
            <Arrows />

            <div className="landing-phone-slot landing-drift" style={drift(260)}>
              <Phone />
            </div>

            {/* Fragment: mini ranked queue */}
            <div className="landing-card landing-frag landing-frag-queue landing-drift" style={drift(380, -2)}>
              <div className="landing-card-head">
                <span>Priority queue</span>
                <span className="landing-muted tnum">3 waiting</span>
              </div>
              <ol className="landing-mini-queue">
                {QUEUE.map((q) => (
                  <li key={q.rank}>
                    <span className="landing-rank tnum">{q.rank}</span>
                    <div className="landing-mq-body">
                      <div className="landing-mq-top">
                        <span className={`landing-dot landing-dot-${q.tier}`} aria-hidden="true" />
                        <strong>{q.intent}</strong>
                        <span className="landing-mq-amt tnum">{q.amount}</span>
                      </div>
                      <div className="landing-bar" aria-hidden="true">
                        <span className={`landing-bar-u landing-bg-${q.tier}`} style={{ width: `${q.u}%` }} />
                        <span className="landing-bar-v" style={{ width: `${q.v}%` }} />
                        <span className="landing-bar-a" style={{ width: `${q.a}%` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Fragment: intent chips */}
            <div className="landing-frag landing-frag-chips landing-drift" style={drift(460, 1)}>
              <span className="landing-chip landing-chip-cobalt">Suspected fraud <b aria-hidden="true">×</b></span>
              <span className="landing-chip">Locked out <b aria-hidden="true">+</b></span>
              <span className="landing-chip landing-chip-outline">Open account <b aria-hidden="true">+</b></span>
            </div>

            {/* Fragment: cobalt stat tile */}
            <div className="landing-tile landing-tile-cobalt landing-frag landing-frag-stat-a landing-drift" style={drift(540, 2)}>
              <span className="landing-tile-num tnum">1,231</span>
              <span className="landing-tile-label">Minutes returned</span>
            </div>

            {/* Fragment: verified seal */}
            <div className="landing-frag landing-frag-seal landing-drift" style={drift(500, -6)}>
              <VerifiedSeal />
            </div>

            {/* Fragment: ivory stat tile */}
            <div className="landing-tile landing-frag landing-frag-stat-b landing-drift" style={drift(420, 1.5)}>
              <span className="landing-tile-num tnum">0<small>min</small></span>
              <span className="landing-tile-label">On hold</span>
              <Sparkles />
            </div>

            {/* Fragment: caller brief */}
            <div className="landing-card landing-frag landing-frag-brief landing-drift" style={drift(600, -1)}>
              <div className="landing-brief-top">
                <span className="landing-avatar" aria-hidden="true">MR</span>
                <div>
                  <strong>Maria Reyes</strong>
                  <span className="landing-muted tnum">+1 ••• ••• 0101 · 3rd call</span>
                </div>
              </div>
              <p className="landing-brief-text">
                Reports a $4,200 card charge she didn't make, Tuesday 2:14 PM. Card frozen; wants a replacement.
              </p>
              <div className="landing-brief-foot">
                <span className="landing-ready">
                  Ready for callback <span className="landing-dot landing-dot-ready" aria-hidden="true" />
                </span>
                <span className="landing-muted tnum">score 94</span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-ba" aria-labelledby="landing-ba-title">
          <div className="landing-section-head">
            <p className="landing-kicker">Before / after</p>
            <h2 id="landing-ba-title">The same call, without the wait.</h2>
          </div>
          <div className="landing-ba-grid">
            <div className="landing-ba-col landing-ba-before">
              <p className="landing-ba-tag">Before</p>
              <div className="landing-ba-row"><span className="landing-ba-num tnum">23<small>min</small></span><span>on hold</span></div>
              <div className="landing-ba-row"><span className="landing-ba-num tnum">3<small>×</small></span><span>explained the problem</span></div>
              <div className="landing-ba-row"><span className="landing-ba-num tnum">?</span><span>when someone calls back</span></div>
            </div>
            <div className="landing-ba-arrow" aria-hidden="true">
              <svg viewBox="0 0 80 40" width="80" height="40">
                <path d="M4 24 C 20 8, 44 34, 70 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M60 12 L71 17.5 L63 27" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="landing-ba-col landing-ba-after">
              <p className="landing-ba-tag">With Rung</p>
              <div className="landing-ba-row"><span className="landing-ba-num tnum">0<small>min</small></span><span>on hold</span></div>
              <div className="landing-ba-row"><span className="landing-ba-num tnum">1<small>×</small></span><span>explained, once</span></div>
              <div className="landing-ba-row"><span className="landing-ba-num tnum">6<small>min</small></span><span>until the callback</span></div>
            </div>
          </div>
        </section>

        <section className="landing-steps" id="how" aria-labelledby="landing-how-title">
          <div className="landing-section-head">
            <p className="landing-kicker">How it works</p>
            <h2 id="landing-how-title">Three steps. One explanation.</h2>
          </div>
          <ol className="landing-steps-list">
            <li>
              <span className="landing-step-num tnum">1</span>
              <h3>Call</h3>
              <p>Tell Rung's voice agent what's wrong, once. Returning callers are greeted by name and picked up where they left off.</p>
            </li>
            <li>
              <span className="landing-step-num tnum">2</span>
              <h3>Verify</h3>
              <p>A 6-digit code is texted to the number on file. Read it back and you're verified. No security questions.</p>
            </li>
            <li>
              <span className="landing-step-num tnum">3</span>
              <h3>Get called back</h3>
              <p>Hang up and get on with your day. A person calls you back with your brief already open.</p>
            </li>
          </ol>
        </section>

        <section className="landing-teams" id="teams" aria-labelledby="landing-teams-title">
          <div className="landing-teams-inner">
            <h2 id="landing-teams-title">For teams: a queue that ranks itself.</h2>
            <ul>
              <li><strong>Urgency + value + wait.</strong> Fraud jumps the line; nobody starves, because waiting time keeps adding points.</li>
              <li><strong>A brief on every caller.</strong> Reps never start cold, or ask the same question twice.</li>
              <li><strong>Your own Rung.</strong> Your number, your rules, your callers.</li>
            </ul>
            <a className="landing-pill landing-pill-ivory" href="/login?signup">Set up your Rung</a>
          </div>
        </section>
      </main>

      <footer className="landing-footer" id="pricing">
        <div className="landing-footer-row">
          <a className="landing-logo" href="/">Rung</a>
          <p className="landing-footer-tag">Remembered callers. Callbacks instead of hold music.</p>
        </div>
        <div className="landing-footer-row landing-footer-meta">
          <p><strong>Pricing:</strong> free while in beta.</p>
          <p className="landing-muted">Built at SpeedHacks 2026</p>
        </div>
      </footer>
    </div>
  );
}
