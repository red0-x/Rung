import type { CSSProperties, ReactNode } from 'react';
import { Logo } from '../brand/Logo';

/*
 * /wireframe call story, scrubbed by scroll. Three pinned scenes: first call, returning call, the rep's callback.
 * Pattern: sticky visual + one short line that swaps per stage (no step lists, no labels).
 * useScenes() writes --beat on each scene. Anything with class "cs-on" shows while b <= beat <= u (story.css).
 */

const on = (b: number, u = 99, extra?: CSSProperties) => ({ '--b': b, '--u': u, ...extra }) as CSSProperties;

/** The one line of copy per stage. Lines stack in one grid cell and crossfade. */
function Lines({ items }: { items: [b: number, u: number, text: string][] }) {
  return (
    <div className="cs-copy">
      <h2 className="cs-lines">
        {items.map(([b, u, t]) => (
          <span key={t} className="cs-on" style={on(b, u)}>{t}</span>
        ))}
      </h2>
    </div>
  );
}

/* ---------- iPhone ---------- */

function StatusBar() {
  return (
    <div className="cs-sbar">
      <b>9:41</b>
      <span>
        <svg viewBox="0 0 18 12" className="cs-sig"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        <svg viewBox="0 0 16 12" className="cs-wifi"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0zM3.4 6.8a6.6 6.6 0 0 1 9.2 0l-1.4 1.4a4.6 4.6 0 0 0-6.4 0zM1.2 4.6a9.7 9.7 0 0 1 13.6 0l-1.4 1.4a7.7 7.7 0 0 0-10.8 0z" /></svg>
        <svg viewBox="0 0 27 13" className="cs-bat"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="17" height="9" rx="2" /><path d="M25 4.5v4a2 2 0 0 0 0-4z" opacity="0.4" /></svg>
      </span>
    </div>
  );
}

function IPhone({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`cs-phone ${className}`} style={style} aria-hidden="true">
      <div className="cs-screen">
        {children}
        <StatusBar />
        <i className="cs-island" />
        <i className="cs-homebar" />
      </div>
    </div>
  );
}

const ICONS: Record<string, ReactNode> = {
  speaker: <path d="M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />,
  video: <path d="M3 7h12v10H3zM15 11l6-4v10l-6-4" />,
  mute: <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4M4 4l16 16" />,
  add: <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M19 8v6M16 11h6" />,
  keypad: <path d="M6 5h.01M12 5h.01M18 5h.01M6 11h.01M12 11h.01M18 11h.01M6 17h.01M12 17h.01M18 17h.01" />,
  end: <path d="M3 13.5c5-4.5 13-4.5 18 0l-2.4 2.6-3.6-1.6v-2.3a10 10 0 0 0-6 0v2.3l-3.6 1.6z" />,
  accept: <path d="M6.6 3.5 9.5 7 8 9.3a12 12 0 0 0 6.7 6.7L17 14.5l3.5 2.9-1.7 3.1C11 20.5 3.5 13 3.5 5.2z" />,
};
const Icon = ({ n }: { n: string }) => <svg viewBox="0 0 24 24" className={`cs-ic cs-ic-${n}`}>{ICONS[n]}</svg>;

/** iOS in-call screen: calling…, then a live timer, then Call ended. */
function CallScreen(p: { connectAt: number; endAt: number; clock: string; vis?: CSSProperties }) {
  return (
    <div className="cs-call cs-on" style={p.vis}>
      <div className="cs-call-head">
        <b>Bank of Antarctica</b>
        <span className="cs-status">
          <span className="cs-on" style={on(1, p.connectAt - 1)}>calling…</span>
          <span className="cs-on" style={on(p.connectAt, p.endAt - 1)} data-clock={p.clock}><span data-t>0:00</span></span>
          <span className="cs-on" style={on(p.endAt)}>Call ended</span>
        </span>
      </div>
      <div className="cs-keys">
        {[['speaker', 'speaker'], ['video', 'FaceTime'], ['mute', 'mute'], ['add', 'add'], ['end', 'end'], ['keypad', 'keypad']].map(([k, l]) => (
          <span key={k} className={`cs-key cs-key-${k}`}><i><Icon n={k} /></i><small>{l}</small></span>
        ))}
      </div>
    </div>
  );
}

/** Confirmation text on the lock screen (server/src/sms.ts wording: ETA only, no account details). */
function SmsBanner({ b, mins, at }: { b: number; mins: number; at: string }) {
  return (
    <div className="cs-banner cs-on" style={on(b)}>
      <img className="cs-banner-app" src="/brand/imessage.png" alt="" />
      <div>
        <p className="cs-banner-top"><b>Bank of Antarctica</b><small>now</small></p>
        <p className="cs-banner-body">Hi Maria, we have your request. A specialist will call you back in about {mins} minutes, around {at}. You are #1 in line.</p>
      </div>
    </div>
  );
}

/* ---------- transcript under the phone ---------- */

type Line = [who: 'r' | 'c', beat: number, text: ReactNode];

function Transcript({ lines, live }: { lines: Line[]; live: [number, number] }) {
  return (
    <div className="cs-tx" aria-label="Call transcript">
      <p className="cs-tx-head">
        <span>Transcript</span>
        <span className="cs-live cs-on" style={on(live[0], live[1])}><i /> Live</span>
      </p>
      <div className="cs-tx-lines">
        {lines.map(([who, b, text], i) => (
          <p key={i} className={`cs-ln cs-ln-${who} cs-on`} style={on(b)}>
            <small>{who === 'r' ? 'Rung' : 'Maria'}</small>
            <span>{text}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

/** A fact in the brief: skeleton until captured (b), check when confirmed (c). */
function Fact({ label, b, c, children }: { label: string; b: number; c: number; children: ReactNode }) {
  return (
    <div className="cs-fact" style={on(b, 99, { '--c': c } as CSSProperties)}>
      <small>{label}</small>
      <span className="cs-fact-v">
        <span className="cs-skel" />
        <span className="cs-fact-txt">{children}</span>
      </span>
      <i className="cs-check" aria-hidden="true">✓</i>
    </div>
  );
}

/* =========================================================
   Scene 1: first call
   ========================================================= */

const S1_BEATS = [0, 0.07, 0.14, 0.22, 0.29, 0.36, 0.44, 0.52, 0.59, 0.66, 0.73, 0.82];
const S1_LINES: Line[] = [
  ['r', 2, "Bank of Antarctica, this is Rung. What's going on today?"],
  ['c', 3, <>There's a charge for <mark>$4,200</mark> on my card from <mark>Tuesday</mark>. <mark>I didn't make it.</mark></>],
  ['r', 4, "I'm sorry. Let's get you to a specialist fast. Who am I speaking with?"],
  ['c', 5, <>It's <mark>Maria Reyes</mark>.</>],
  ['r', 6, 'Thanks, Maria. I just texted you a code. Read it back when it arrives.'],
  ['c', 7, <><mark>4 8 2 9 1 7</mark>.</>],
  ['r', 8, "Verified. So: a $4,200 charge from Tuesday that you didn't make. Right?"],
  ['c', 9, <><mark>Yes</mark>, exactly.</>],
  ['r', 10, "You're first in line. A specialist will call you back in about 6 minutes."],
  ['c', 11, 'Thank you.'],
];

function FirstCall() {
  return (
    <section className="cs-scene cs-s1" id="story" data-scene="pin" data-rest="1" data-beats={S1_BEATS.join(',')}>
      <div className="cs-stick">
        <Lines items={[
          [1, 1, 'Answered on the first ring.'],
          [2, 6, 'She explains once.'],
          [7, 8, 'A texted code proves it’s her.'],
          [9, 99, 'Confirmed, ranked, queued.'],
        ]} />

        <div className="cs-phonewrap">
          <IPhone>
            <CallScreen connectAt={2} endAt={12} clock={`${S1_BEATS[1]},${S1_BEATS[11]},168`} />
            <SmsBanner b={12} mins={6} at="3:42 PM" />
          </IPhone>
        </div>

        <Transcript lines={S1_LINES} live={[2, 11]} />

        <aside className="cs-side">
          <div className="cs-card cs-brief">
            <header className="cs-card-head">
              <span><Logo variant="mark" size={15} title="" /> Brief</span>
            </header>
            <Fact label="Caller" b={5} c={5}>Maria Reyes</Fact>
            <Fact label="Issue" b={3} c={9}>Charge she didn’t make</Fact>
            <Fact label="Amount" b={3} c={9}>$4,200</Fact>
            <Fact label="When" b={3} c={9}>Tuesday</Fact>
            <Fact label="Identity" b={7} c={7}>Verified</Fact>
            <div className="cs-brief-foot cs-on" style={on(9)}>
              <span className="cs-prio"><em>CRITICAL</em> 94</span>
              <span className="cs-qpos">#1 in queue</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

/* =========================================================
   Scene 2: returning caller
   ========================================================= */

const S2_BEATS = [0, 0.1, 0.22, 0.36, 0.5, 0.62, 0.76];
const S2_LINES: Line[] = [
  ['r', 3, "Hi Maria, I've got your details up. What can I help you with today?"],
  ['c', 4, <>It's about last week's charge. <mark>The replacement card never came.</mark></>],
  ['r', 5, "Got it, that's on your case now. A specialist will call you in about 4 minutes."],
  ['c', 6, 'Perfect, thanks.'],
];

function Returning() {
  return (
    <section className="cs-scene cs-s2" data-scene="pin" data-rest="1" data-beats={S2_BEATS.join(',')}>
      <div className="cs-stick">
        <Lines items={[
          [1, 2, 'A week later, Rung knows her.'],
          [3, 6, 'She adds one detail. That’s it.'],
          [7, 99, 'Under a minute, not three.'],
        ]} />

        <div className="cs-phonewrap">
          <IPhone>
            <CallScreen connectAt={2} endAt={7} clock={`${S2_BEATS[1]},${S2_BEATS[6]},52`} />
            <SmsBanner b={7} mins={4} at="3:31 PM" />
          </IPhone>
        </div>

        <Transcript lines={S2_LINES} live={[2, 6]} />

        <aside className="cs-side">
          <div className="cs-card">
            <header className="cs-card-head">
              <span><Logo variant="mark" size={15} title="" /> Returning caller</span>
            </header>
            <Fact label="Caller" b={2} c={2}>Maria Reyes</Fact>
            <Fact label="Last call" b={2} c={2}>Charge she didn’t make</Fact>
            <Fact label="New" b={4} c={6}>Replacement card missing</Fact>
          </div>

          <div className="cs-card cs-saved cs-on" style={on(7)}>
            <div className="cs-bar"><span>First call</span><i style={{ '--w': 1 } as CSSProperties} /><b>2:48</b></div>
            <div className="cs-bar cs-bar-now"><span>Today</span><i style={{ '--w': 52 / 168 } as CSSProperties} /><b>0:52</b></div>
          </div>
        </aside>
      </div>
    </section>
  );
}

/* =========================================================
   Scene 3: the rep
   ========================================================= */

const S3_BEATS = [0, 0.12, 0.26, 0.42, 0.58, 0.72];
const QUEUE: [who: string, why: string, score: number, tone: string][] = [
  ['Omar H.', 'Wire transfer stuck', 78, 'high'],
  ['Priya N.', 'Update address', 41, 'norm'],
  ['Luis O.', 'Statement question', 18, 'low'],
];

function QRow({ who, why, score, tone, rank, className = '', style }: {
  who: string; why: string; score: number; tone: string; rank: ReactNode; className?: string; style?: CSSProperties;
}) {
  return (
    <div className={`cs-qrow ${className}`} style={style}>
      <span className="cs-qn">{rank}</span>
      <div className="cs-qmain">
        <p className="cs-qtop"><i className={`cs-qdot cs-tone-${tone}`} /><b>{why}</b><span>{who}</span><strong>{score}</strong></p>
        <span className="cs-qbar"><i className={`cs-tone-${tone}`} style={{ '--s': score / 100 } as CSSProperties} /></span>
      </div>
    </div>
  );
}

function RepView() {
  return (
    <section className="cs-scene cs-s3" data-scene="pin" data-rest="1" data-beats={S3_BEATS.join(',')}>
      <div className="cs-stick cs-stick-rep">
        <Lines items={[
          [1, 2, 'Ranked by urgency.'],
          [3, 3, 'Briefed before the call.'],
          [4, 99, 'One tap to call back.'],
        ]} />

        <div className="cs-stage">
          <div className="cs-win" aria-hidden="true">
            <div className="cs-queue">
              <div className="cs-q-head">
                <b>Callback queue</b>
                <span className="cs-q-count"><span className="cs-on" style={on(0, 1)}>3 waiting</span><span className="cs-on" style={on(2)}>4 waiting</span></span>
              </div>
              <QRow className="cs-qrow-maria cs-on" style={on(2)} who="Maria R." why="Replacement card" score={82} tone="high"
                rank={<span className="cs-qr1">1</span>} />
              {QUEUE.map(([who, why, score, tone], i) => (
                <QRow key={who} who={who} why={why} score={score} tone={tone}
                  rank={<><span className={`cs-on cs-qr${i + 1}`} style={on(0, 1)}>{i + 1}</span><span className={`cs-on cs-qr${i + 2}`} style={on(2)}>{i + 2}</span></>} />
              ))}
            </div>

            <div className="cs-detail cs-on" style={on(3)}>
              <div className="cs-d-top">
                <span className="cs-d-av">MR</span>
                <div><b>Maria Reyes</b><small>Returning · 2nd call</small></div>
              </div>
              <p className="cs-d-head">Replacement card from last week’s fraud report hasn’t arrived.</p>
              <p className="cs-d-lines">Wants: delivery update</p>
              <div className="cs-d-foot">
                <span className="cs-d-score">Score 82</span>
                <span className="cs-btn-call">
                  <span className="cs-on" style={on(3, 4)}>Call back</span>
                  <span className="cs-on" style={on(5)}>Calling…</span>
                </span>
              </div>
            </div>
          </div>

          <IPhone className="cs-phone-rep cs-on" style={on(5)}>
            <div className="cs-incoming cs-on" style={on(5, 5)}>
              <div className="cs-call-head"><b>Bank of Antarctica</b><span className="cs-status">mobile</span></div>
              <div className="cs-in-btns">
                <span className="cs-key cs-key-end"><i><Icon n="end" /></i><small>Decline</small></span>
                <span className="cs-key cs-key-accept"><i><Icon n="accept" /></i><small>Accept</small></span>
              </div>
            </div>
            <CallScreen connectAt={6} endAt={99} clock={`${S3_BEATS[5]},1,38`} vis={on(6)} />
          </IPhone>
        </div>
      </div>
    </section>
  );
}

export default function CallStory() {
  return (
    <>
      <FirstCall />
      <Returning />
      <RepView />
    </>
  );
}
