import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import '../brand.css';
import './landing.css';
import Phone from './Phone';
import MiniQueue from './MiniQueue';
import { Arrows, PillPattern, Sparkles, Swash, VerifiedSeal } from './Doodles';
import { useCallLoop, useCountUp, useReveal } from './motion';
import { Logo } from '../brand/Logo';

/** Inline style helper: --d (drift-in delay) and --r (resting rotation). */
function drift(delayMs: number, rotateDeg = 0): CSSProperties {
  return { '--d': `${delayMs}ms`, '--r': `${rotateDeg}deg` } as CSSProperties;
}

function signupHref(email: string): string {
  const trimmed = email.trim();
  return trimmed ? `/login?signup&email=${encodeURIComponent(trimmed)}` : '/login?signup';
}

const HEADLINE = ['Your', 'time,'];

export default function Landing() {
  const [email, setEmail] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const statRef = useRef<HTMLDivElement>(null);
  const step = useCallLoop(stageRef);
  const minutes = useCountUp(statRef, 1231);
  useReveal(rootRef);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    window.location.assign(signupHref(email));
  }

  return (
    <div className="landing-root" ref={rootRef}>
      <header className="landing-nav">
        <a className="landing-logo" href="/" aria-label="Rung home"><Logo size={28} title="Rung" /></a>
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
            <span className="landing-live-dot" aria-hidden="true" /> For customer support teams
          </p>
          <h1 className="landing-headline" aria-label="Your time, returned.">
            {HEADLINE.map((w, i) => (
              <span key={w} className="landing-word" aria-hidden="true">
                <span style={{ '--i': i } as CSSProperties}>{w}</span>
              </span>
            ))}{' '}
            <span className="landing-swash-word" aria-hidden="true">
              <span className="landing-word">
                <span style={{ '--i': 2 } as CSSProperties}>returned.</span>
              </span>
              <Swash />
            </span>
          </h1>
          <p className="landing-sub landing-drift" style={drift(260)}>
            Rung answers your support line, verifies every caller, and hands your team a ranked callback
            queue with a brief on each call. Your customers hang up instead of holding, and get called back.
          </p>
          <form className="landing-form landing-drift" style={drift(340)} onSubmit={onSubmit}>
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
            <button type="submit" className="landing-pill landing-pill-ink">Set up your Rung</button>
          </form>
          <p className="landing-helper landing-drift" style={drift(400)}>
            Free for your first line. <span aria-hidden="true">·</span> Remembered callers. Callbacks instead of hold music.
          </p>

          <div className="landing-stage" ref={stageRef}>
            <PillPattern />
            <Arrows />

            <div className="landing-phone-slot landing-drift" style={drift(420)}>
              <span className="landing-caption">Your customer's call</span>
              <Phone step={step} mark={<Logo variant="mark" size={50} title="Rung" />} />
            </div>

            <div className="landing-frag landing-frag-queue landing-drift" style={drift(560, -2)}>
              <MiniQueue step={step} />
            </div>

            <div className="landing-frag landing-frag-seal" aria-hidden={step < 3}>
              <VerifiedSeal on={step >= 3} />
            </div>

            <div
              ref={statRef}
              className="landing-tile landing-tile-cobalt landing-frag landing-frag-stat landing-drift"
              style={drift(700, 2)}
            >
              <span className="landing-tile-num tnum">{minutes.toLocaleString('en-US')}</span>
              <span className="landing-tile-label">Minutes on hold returned this week</span>
              <Sparkles />
            </div>

            <div className="landing-card landing-frag landing-frag-brief landing-drift" style={drift(640, -1)}>
              <div className="landing-card-head">
                <span>Brief, before the callback</span>
              </div>
              <div className="landing-brief-top">
                <span className="landing-avatar" aria-hidden="true">MR</span>
                <div>
                  <strong>Maria Reyes</strong>
                  <span className="landing-muted tnum">+1 ••• ••• 0101 · 3rd call · verified</span>
                </div>
              </div>
              <p className="landing-brief-text">
                Reports a $4,200 card charge she didn't make, Tuesday 2:14 PM. Card frozen; wants a replacement.
              </p>
              <div className="landing-brief-foot">
                <span className="landing-swap">
                  <span className="landing-ready" data-on={step >= 3}>
                    Ready for callback <span className="landing-dot landing-dot-ready" aria-hidden="true" />
                  </span>
                  <span className="landing-drafting landing-muted" data-on={step < 3}>Ranking call…</span>
                </span>
                <span className="landing-muted tnum">score 94</span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-how" id="how" aria-labelledby="landing-how-title">
          <div className="landing-section-head" data-reveal>
            <p className="landing-kicker">How it works</p>
            <h2 id="landing-how-title">From ringing phone to ranked callback.</h2>
          </div>
          <ol className="landing-flow">
            <li data-reveal style={{ '--rd': '0ms' } as CSSProperties}>
              <span className="landing-flow-num tnum">1</span>
              <h3>A call comes in</h3>
              <p>Your customer calls your Rung number and explains once. Returning callers are greeted by name.</p>
            </li>
            <li data-reveal style={{ '--rd': '80ms' } as CSSProperties}>
              <span className="landing-flow-num tnum">2</span>
              <h3>Rung filters, verifies &amp; ranks</h3>
              <p>A texted 6-digit code verifies the caller. Every call is scored by urgency, value and time waited.</p>
            </li>
            <li data-reveal style={{ '--rd': '160ms' } as CSSProperties}>
              <span className="landing-flow-num tnum">3</span>
              <h3>Your rep calls back with context</h3>
              <p>The top of the queue comes with a written brief. No cold starts, no repeated questions.</p>
            </li>
          </ol>
        </section>

        <section className="landing-sides" id="teams" aria-labelledby="landing-sides-title">
          <div className="landing-section-head" data-reveal>
            <p className="landing-kicker">For teams, and the people they serve</p>
            <h2 id="landing-sides-title">Both ends of the line get their time back.</h2>
          </div>
          <div className="landing-sides-grid">
            <div className="landing-side landing-side-team" data-reveal>
              <p className="landing-side-tag">Your team</p>
              <div className="landing-side-row"><span className="landing-side-num tnum">3</span><span>signals rank every call: urgency, value and time waited</span></div>
              <div className="landing-side-row"><span className="landing-side-num tnum">1</span><span>written brief waiting before every callback</span></div>
              <div className="landing-side-row"><span className="landing-side-num tnum">0</span><span>cold starts, or callers asked to repeat themselves</span></div>
            </div>
            <div className="landing-side landing-side-customer" data-reveal style={{ '--rd': '90ms' } as CSSProperties}>
              <p className="landing-side-tag">Your customers</p>
              <div className="landing-side-row"><span className="landing-side-num tnum">0<small>min</small></span><span>on hold <span className="landing-was">instead of 23</span></span></div>
              <div className="landing-side-row"><span className="landing-side-num tnum">1<small>×</small></span><span>explaining the problem <span className="landing-was">instead of 3</span></span></div>
              <div className="landing-side-row"><span className="landing-side-num tnum">~6<small>min</small></span><span>until a person calls back, verified by a texted code</span></div>
            </div>
          </div>
          <div className="landing-cta-row" data-reveal>
            <a className="landing-pill landing-pill-ink" href="/login?signup">Set up your Rung</a>
            <span className="landing-muted">Free for your first line.</span>
          </div>
        </section>
      </main>

      <footer className="landing-footer" id="pricing">
        <div className="landing-footer-row">
          <a className="landing-logo" href="/" aria-label="Rung home"><Logo size={24} title="Rung" /></a>
          <p className="landing-footer-tag">Remembered callers. Callbacks instead of hold music.</p>
        </div>
        <div className="landing-footer-row landing-footer-meta">
          <p><strong>Pricing:</strong> your first line is free.</p>
          <p className="landing-muted">Built at SpeedHacks 2026</p>
        </div>
      </footer>
    </div>
  );
}
