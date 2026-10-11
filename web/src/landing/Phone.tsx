import type { CSSProperties, ReactNode } from 'react';

/** Reveal-able piece of the call. `delay` only applies on the way in. */
function Step({ on, delay = 0, className = '', children }: { on: boolean; delay?: number; className?: string; children: ReactNode }) {
  return (
    <div className={`landing-step ${className}`} data-on={on} style={{ '--sd': `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

/** The customer's side: a live Rung call, drawn in HTML/CSS. Plays through `step` 0..3. */
export default function Phone({ step, mark }: { step: number; mark: ReactNode }) {
  return (
    <div
      className="landing-phone"
      role="img"
      aria-label="A customer's call with Rung: Maria is greeted by name, verifies with a texted code, and gets a callback in about 6 minutes."
    >
      <div className="landing-phone-screen" aria-hidden="true">
        <div className="landing-phone-status tnum">
          <span>9:41</span>
          <span className="landing-phone-island" />
          <span className="landing-phone-signal"><i /><i /><i /><i /></span>
        </div>

        <div className="landing-call-head">
          <span className="landing-call-live">
            <span className="landing-live-dot" /> Incoming · <span className="tnum">+1 ••• 0101</span>
          </span>
          <span className="landing-call-state">{step === 0 ? 'Ringing' : 'Answered'}</span>
        </div>

        <div className="landing-ring" data-on={step === 0}>
          <span className="landing-app-icon">{mark}</span>
          <span className="landing-ring-label">Rung is answering</span>
          <span className="landing-ring-sub">Your support line, no hold music</span>
        </div>

        <Step on={step >= 1} className="landing-call-hello">
          <span className="landing-avatar landing-avatar-lg">MR</span>
          <p className="landing-call-title">Welcome back, Maria</p>
          <p className="landing-call-meta">Last call: Tuesday · card ending 4417</p>
        </Step>

        <div className="landing-bubbles">
          <Step on={step >= 1} delay={550} className="landing-bubble landing-bubble-agent">
            Is this about the $4,200 charge from Tuesday?
          </Step>
          <Step on={step >= 2} className="landing-bubble landing-bubble-caller">
            Yes. I didn't make it.
          </Step>
        </div>

        <Step on={step >= 2} delay={450} className="landing-sms">
          <span className="landing-sms-from">Text · Rung</span>
          <span className="landing-sms-label">Your verification code</span>
          <span className="landing-code tnum"><b>4</b><b>8</b><b>2</b><b>9</b><b>1</b><b>3</b></span>
        </Step>

        <Step on={step >= 3} delay={350} className="landing-callback">
          <div className="landing-callback-top">
            <span className="landing-callback-label">Callback in ~6 min</span>
            <span className="landing-callback-rank tnum">#1</span>
          </div>
          <div className="landing-callback-track"><span /></div>
          <span className="landing-callback-note">You can hang up. We'll call you.</span>
        </Step>

        <div className="landing-phone-home" />
      </div>
    </div>
  );
}
