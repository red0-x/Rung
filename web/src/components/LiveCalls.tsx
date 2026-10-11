import { initials } from './Shell';
import type { LiveCallView } from '../types';

const STAGE: Record<LiveCallView['stage'], { label: string; step: number }> = {
  listening: { label: 'Listening', step: 1 },
  verifying: { label: 'Checking code', step: 2 },
  verified: { label: 'Verified', step: 2 },
  saving: { label: 'Saving details', step: 2 },
  queued: { label: 'Added to queue', step: 3 },
};

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Calls the voice agent is handling right now. Each one leaves a few seconds after it lands in the queue. */
export function LiveCalls({ calls, nowEst }: { calls: LiveCallView[]; nowEst: number }) {
  if (!calls.length) return null;
  const talking = calls.filter((c) => !c.queuedAt).length;
  return (
    <section className="live" aria-labelledby="live-h">
      <h2 id="live-h" className="live-head">
        <i className="call-dot" aria-hidden="true" />
        On the line now
        <span className="live-count tnum">{talking}</span>
      </h2>
      <ul className="live-list">
        {calls.map((c) => {
          const st = STAGE[c.stage];
          return (
            <li key={c.key} className={`live-card${c.queuedAt ? ' is-queued' : ''}`}>
              <span className="avatar avatar-md">{c.name ? initials(c.name) : '?'}</span>
              <span className="live-who">
                <b>{c.name ?? c.phoneMasked}</b>
                <span className="muted">{c.known ? 'Returning' : 'New caller'}</span>
              </span>
              <span className="live-time tnum">{mmss((c.queuedAt ?? nowEst) - c.startedAt)}</span>
              <span className="live-stage" aria-label={`Step ${st.step} of 3: ${st.label}`}>
                <span className="live-steps" aria-hidden="true">
                  {[1, 2, 3].map((n) => (
                    <i key={n} className={n <= st.step ? 'on' : undefined} />
                  ))}
                </span>
                {st.label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
