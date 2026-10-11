/** The hero centerpiece: a live Rung call, drawn in HTML/CSS. */
export default function Phone() {
  return (
    <div className="landing-phone" role="img" aria-label="A Rung call in progress: Maria is greeted by name, verifies with a texted code, and gets a callback in about 6 minutes.">
      <div className="landing-phone-screen" aria-hidden="true">
        <div className="landing-phone-status tnum">
          <span>9:41</span>
          <span className="landing-phone-island" />
          <span className="landing-phone-signal">
            <i /><i /><i /><i />
          </span>
        </div>

        <div className="landing-call-head">
          <span className="landing-call-live">
            <span className="landing-live-dot" /> Incoming · <span className="tnum">+1 ••• 0101</span>
          </span>
          <span className="landing-call-timer tnum">00:42</span>
        </div>

        <div className="landing-call-hello">
          <span className="landing-avatar landing-avatar-lg">MR</span>
          <p className="landing-call-title">Welcome back, Maria</p>
          <p className="landing-call-meta">Last call: Tuesday · card ending 4417</p>
        </div>

        <div className="landing-bubbles">
          <p className="landing-bubble landing-bubble-agent">Is this about the $4,200 charge from Tuesday?</p>
          <p className="landing-bubble landing-bubble-caller">Yes. I didn't make it.</p>
        </div>

        <div className="landing-sms">
          <span className="landing-sms-from">Text · Rung</span>
          <span className="landing-sms-label">Your verification code</span>
          <span className="landing-code tnum">
            <b>4</b><b>8</b><b>2</b><b>9</b><b>1</b><b>3</b>
          </span>
        </div>

        <div className="landing-callback">
          <div className="landing-callback-top">
            <span className="landing-callback-label">Callback in ~6 min</span>
            <span className="landing-callback-rank tnum">#1</span>
          </div>
          <div className="landing-callback-track"><span /></div>
          <span className="landing-callback-note">You can hang up. We'll call you.</span>
        </div>

        <div className="landing-phone-home" />
      </div>
    </div>
  );
}
