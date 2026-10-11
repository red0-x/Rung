import type { CSSProperties, ReactNode } from 'react';
import { Logo } from '../brand/Logo';

/*
 * The /wireframe call story, scrubbed by scroll. Three pinned scenes:
 *   1. First call: Maria dials her bank, Rung answers, facts become a confirmed brief, she gets a text with the ETA.
 *   2. A week later: same number, Rung recognizes her, she adds one new detail instead of re-explaining.
 *   3. The rep: ranked queue, brief + history, then the callback rings on Maria's phone.
 * useScenes() writes --beat on each scene. Anything with class "cs-on" shows while b <= beat <= u (see story.css).
 * Product truth (vault/project/caller-context.md): a number recognizes, a texted code verifies; texts carry no account details.
 */

const on = (b: number, u = 99, extra?: CSSProperties) => ({ '--b': b, '--u': u, ...extra }) as CSSProperties;

/* ---------- iPhone ---------- */

function IPhone({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`cs-phone ${className}`} style={style} aria-hidden="true">
      <div className="cs-screen">
        {children}
        <div className="cs-sbar"><b>9:41</b><span><i className="cs-sig" /><i className="cs-bat" /></span></div>
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
const Icon = ({ n }: { n: string }) => (
  <svg viewBox="0 0 24 24" className={`cs-ic cs-ic-${n}`}>{ICONS[n]}</svg>
);

/** iOS in-call screen. Status goes calling… then a live timer then Call ended, by beat. */
function CallScreen(p: { name: string; connectAt: number; endAt: number; clock: string; vis?: CSSProperties }) {
  return (
    <div className="cs-call cs-on" style={p.vis}>
      <div className="cs-call-head">
        <b>{p.name}</b>
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

/** Lock-screen style banner for the confirmation text (server/src/sms.ts wording, no account details). */
function SmsBanner({ b, body }: { b: number; body: string }) {
  return (
    <div className="cs-banner cs-on" style={on(b)}>
      <span className="cs-banner-app" />
      <div>
        <p className="cs-banner-top"><b>Bank of Antarctica</b><small>now</small></p>
        <p className="cs-banner-body">{body}</p>
      </div>
    </div>
  );
}

/* ---------- transcript under the phone ---------- */

type Line = [who: 'r' | 'c', beat: number, text: ReactNode];

function Transcript({ lines, caller, live }: { lines: Line[]; caller: string; live: [number, number] }) {
  return (
    <div className="cs-tx" aria-label="Call transcript">
      <p className="cs-tx-head">
        <span>Transcript</span>
        <span className="cs-live cs-on" style={on(live[0], live[1])}><i /> Live</span>
      </p>
      <div className="cs-tx-lines">
        {lines.map(([who, b, text], i) => (
          <p key={i} className={`cs-ln cs-ln-${who} cs-on`} style={on(b)}>
            <small>{who === 'r' ? 'Rung' : caller}</small>
            <span>{text}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

/** A fact in the brief: placeholder until captured (b), check fills in when the caller confirms (c). */
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

function Steps({ items }: { items: [string, string][] }) {
  return (
    <ol data-step-list className="cs-steps">
      {items.map(([t, d], i) => (
        <li key={t}>
          <span className="cs-step-n">0{i + 1}</span>
          <div><b>{t}</b><p>{d}</p></div>
        </li>
      ))}
    </ol>
  );
}

const DEMO = 'Demo data. Names, amounts and timings are illustrative.';

/* =========================================================
   Scene 1: first call
   ========================================================= */

const S1_BEATS = [0, 0.07, 0.14, 0.22, 0.29, 0.36, 0.44, 0.52, 0.59, 0.66, 0.73, 0.82];
const S1_LINES: Line[] = [
  ['r', 2, "Bank of Antarctica, this is Rung. What's going on today?"],
  ['c', 3, <>There's a charge for <mark>$4,200</mark> on my card from <mark>Tuesday</mark>. <mark>I didn't make it.</mark></>],
  ['r', 4, "I'm sorry. Let's get you to a specialist fast. Who am I speaking with?"],
  ['c', 5, <>It's <mark>Maria Reyes</mark>.</>],
  ['r', 6, 'Thanks, Maria. I just texted you a six digit code. Read it back when it arrives.'],
  ['c', 7, <><mark>4 8 2 9 1 7</mark>.</>],
  ['r', 8, "That's you, verified. So: a $4,200 charge from Tuesday that you didn't make. Did I get that right?"],
  ['c', 9, <><mark>Yes</mark>, exactly.</>],
  ['r', 10, "You're first in line. A specialist will call you back on this number in about 6 minutes. Want me to remember you next time?"],
  ['c', 11, <><mark>Yes please.</mark></>],
];

function FirstCall() {
  return (
    <section className="cs-scene cs-s1" id="story" data-scene="pin" data-rest="1" data-beats={S1_BEATS.join(',')} data-steps="0,0.07,0.36,0.52">
      <div className="cs-stick">
        <div className="cs-copy">
          <p className="wf-kicker">01 · First call</p>
          <h2 className="wf-display cs-h2">She explains once.</h2>
          <Steps items={[
            ['Dial', 'Maria calls her bank. Rung answers on the first ring with the bank’s own greeting. No hold music.'],
            ['Explain', 'She says what happened in her own words. Rung pulls out the facts as she talks.'],
            ['Verify', 'A texted code proves it’s her. Her phone number alone never does.'],
            ['Confirm and queue', 'Rung reads the facts back, she says yes, and the call lands in the queue with a brief.'],
          ]} />
          <p className="cs-demo">{DEMO}</p>
        </div>

        <div className="cs-phonewrap">
          <IPhone>
            <CallScreen name="Bank of Antarctica" connectAt={2} endAt={12} clock={`${S1_BEATS[1]},${S1_BEATS[11]},168`} />
            <SmsBanner b={12} body="Bank of Antarctica: Hi Maria, we have your request. A specialist will call you back on this number about 6 minutes from now, around 3:42 PM PDT. You are #1 in line." />
          </IPhone>
        </div>

        <Transcript lines={S1_LINES} caller="Maria" live={[2, 11]} />

        <aside className="cs-side">
          <div className="cs-card cs-brief">
            <header className="cs-card-head">
              <span><Logo variant="mark" size={16} title="" /> Brief</span>
              <em className="cs-on cs-state" style={on(1, 8)}>listening…</em>
              <em className="cs-on cs-state cs-state-ok" style={on(9)}>confirmed by caller</em>
            </header>
            <Fact label="Caller" b={5} c={5}>Maria Reyes <span className="cs-tag">New caller</span></Fact>
            <Fact label="Issue" b={3} c={9}>Card charge she didn’t make</Fact>
            <Fact label="Amount" b={3} c={9}>$4,200</Fact>
            <Fact label="When" b={3} c={9}>Tuesday</Fact>
            <Fact label="Identity" b={7} c={7}>Verified by texted code</Fact>
            <div className="cs-brief-foot">
              <span className="cs-on cs-prio" style={on(9)}><em>CRITICAL</em> 94</span>
              <span className="cs-on" style={on(10)}>Queue <b>#1</b> · callback in ~6 min</span>
              <span className="cs-on" style={on(11)}>Profile saved with her consent</span>
              <span className="cs-on cs-sent" style={on(12)}>Text sent: ETA only, no account details</span>
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
  ['r', 5, "Got it. I've added that to your case, so the specialist has everything. You're first in line, about 4 minutes."],
  ['c', 6, 'Perfect, thanks.'],
];

function Returning() {
  return (
    <section className="cs-scene cs-s2" data-scene="pin" data-rest="1" data-beats={S2_BEATS.join(',')} data-steps="0,0.22,0.5,0.76">
      <div className="cs-stick">
        <div className="cs-copy">
          <p className="wf-kicker">02 · A week later</p>
          <h2 className="wf-display cs-h2">She doesn’t explain twice.</h2>
          <Steps items={[
            ['Recognized', 'Same number, same bank. Rung finds her saved profile before it says a word.'],
            ['Picks up the thread', 'It greets her by name with her details already up. No name, no code, no backstory.'],
            ['Adds, not repeats', 'Only the new detail goes on her case. Name, story and code are skipped.'],
            ['Time back', 'The call is over in under a minute.'],
          ]} />
          <p className="cs-demo">{DEMO}</p>
        </div>

        <div className="cs-phonewrap">
          <IPhone>
            <CallScreen name="Bank of Antarctica" connectAt={2} endAt={7} clock={`${S2_BEATS[1]},${S2_BEATS[6]},52`} />
            <SmsBanner b={7} body="Bank of Antarctica: Hi Maria, we have your request. A specialist will call you back on this number about 4 minutes from now, around 3:31 PM PDT. You are #1 in line." />
          </IPhone>
        </div>

        <Transcript lines={S2_LINES} caller="Maria" live={[2, 6]} />

        <aside className="cs-side">
          <div className="cs-card cs-memory">
            <header className="cs-card-head">
              <span><Logo variant="mark" size={16} title="" /> Caller lookup</span>
              <em className="cs-on cs-state" style={on(1, 1)}>ringing…</em>
              <em className="cs-on cs-state cs-state-ok" style={on(2)}>match in 0.3s</em>
            </header>
            <Fact label="Caller" b={2} c={2}>Maria Reyes <span className="cs-tag">Returning</span></Fact>
            <Fact label="Last issue" b={2} c={2}>Charge she didn’t make · last week</Fact>
            <Fact label="Trust" b={2} c={2}>Recognized by number</Fact>
            <Fact label="New today" b={4} c={6}>Replacement card hasn’t arrived</Fact>
            <p className="cs-note cs-on" style={on(2)}>Recognized is not verified. Changing her address or moving money would still need a fresh texted code.</p>
          </div>

          <div className="cs-card cs-saved cs-on" style={on(7)}>
            <small>Time on the phone</small>
            <div className="cs-bar"><span>First call</span><i style={{ '--w': 1 } as CSSProperties} /><b>2:48</b></div>
            <div className="cs-bar cs-bar-now"><span>Today</span><i style={{ '--w': 52 / 168 } as CSSProperties} /><b>0:52</b></div>
            <p><b>~2 minutes</b> she didn’t spend repeating herself.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

/* =========================================================
   Scene 3: the rep
   ========================================================= */

const S3_BEATS = [0, 0.12, 0.26, 0.42, 0.56, 0.7, 0.84];
const QUEUE: [string, string, string, number, string][] = [
  ['Omar Haddad', 'Wire transfer stuck 3 days', 'HIGH', 78, 'high'],
  ['Priya Nair', 'Update mailing address', 'NORMAL', 41, 'norm'],
  ['Luis Ortega', 'Question about a statement', 'LOW', 18, 'low'],
];

function RepView() {
  return (
    <section className="cs-scene cs-s3" id="brief-rep" data-scene="pin" data-rest="1" data-beats={S3_BEATS.join(',')} data-steps="0,0.26,0.56">
      <div className="cs-stick cs-stick-rep">
        <div className="cs-copy">
          <p className="wf-kicker">03 · Your team</p>
          <h2 className="wf-display cs-h2">Sam never starts cold.</h2>
          <Steps items={[
            ['Ranked', 'Maria’s call slots in by urgency, not by who waited longest. Sam gets a heads-up in the dashboard.'],
            ['Briefed', 'One click opens the brief, her trust level, both calls and the transcript.'],
            ['Called back', 'Sam taps Call back. Maria’s phone rings, and he opens with the answer.'],
          ]} />
          <p className="cs-demo">{DEMO}</p>
        </div>

        <div className="cs-win" aria-hidden="true">
          <div className="cs-win-bar"><i /><i /><i /><span>rung / queue · Bank of Antarctica</span></div>

          <div className="cs-toast cs-on" style={on(2, 3)}>
            <span className="cs-toast-dot" />
            <div><b>New callback ranked #1</b><small>Maria Reyes · High · returning caller</small></div>
          </div>

          <div className="cs-win-body">
            <div className="cs-queue">
              <p className="cs-q-head"><b>Queue</b><small>4 waiting</small></p>
              <div className="cs-qrow cs-qrow-maria cs-on" style={on(2)}>
                <span className="cs-qn">1</span>
                <div><b>Maria Reyes</b><p>Replacement card not arrived</p></div>
                <em className="cs-tone-high">HIGH</em><strong>82</strong>
                <span className="cs-qstate">
                  <span className="cs-on" style={on(2, 4)}>Waiting · 0:40</span>
                  <span className="cs-on" style={on(5)}>Calling · Sam</span>
                </span>
              </div>
              {QUEUE.map(([n, why, tag, score, tone], i) => (
                <div className="cs-qrow" key={n}>
                  <span className="cs-qn"><span className="cs-on" style={on(1, 1)}>{i + 1}</span><span className="cs-on" style={on(2)}>{i + 2}</span></span>
                  <div><b>{n}</b><p>{why}</p></div>
                  <em className={`cs-tone-${tone}`}>{tag}</em><strong>{score}</strong>
                </div>
              ))}
            </div>

            <div className="cs-detail">
              <div className="cs-detail-empty cs-on" style={on(1, 2)}>Select a call to see its brief</div>
              <div className="cs-detail-in cs-on" style={on(3)}>
                <div className="cs-d-top">
                  <div><b>Maria Reyes</b><small>2nd call · recognized by number · verified last week</small></div>
                  <span className="cs-btn-call">
                    <span className="cs-on" style={on(3, 4)}>Call back</span>
                    <span className="cs-on" style={on(5)}>Calling…</span>
                  </span>
                </div>
                <div className="cs-d-brief">
                  <small>Brief</small>
                  <p><b>Replacement card from last week’s fraud report hasn’t arrived.</b></p>
                  <p className="cs-d-lines">When: card reissued after last week’s call<br />Wants: delivery update</p>
                </div>
                <div className="cs-d-open cs-on" style={on(4)}>
                  <small>Open with</small>
                  <p>“Hi Maria, it’s Sam at Bank of Antarctica, calling about your replacement card.”</p>
                </div>
                <div className="cs-d-hist">
                  <small>History</small>
                  <p><i className="cs-dot-now" /><b>Today</b> Replacement card not arrived · 0:52 call</p>
                  <p><i /><b>Last week</b> Charge she didn’t make, $4,200 · verified · 2:48 call</p>
                </div>
                <p className="cs-d-meta">Text sent to Maria at 3:27 PM: callback ETA, no account details · Transcript</p>
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
            <CallScreen name="Bank of Antarctica" connectAt={6} endAt={99} clock={`${S3_BEATS[5]},1,38`} vis={on(6)} />
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
