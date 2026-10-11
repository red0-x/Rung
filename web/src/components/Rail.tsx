import { capitalize, clock } from '../format';
import type { CodesResponse, QueueItemView } from '../types';
import { Digits } from './Digits';

interface Ev {
  key: string;
  at: number;
  kind: 'in' | 'call' | 'done';
  title: string;
  sub: string;
  tier: QueueItemView['tier'];
}

const hhmm = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function Timeline({ items, requireVerification = false }: { items: QueueItemView[]; requireVerification?: boolean }) {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const evs: Ev[] = [];
  for (const i of items) {
    const name = i.name ?? 'Unknown caller';
    evs.push({
      key: i.id + ':in',
      at: i.createdAt,
      kind: 'in',
      title: `${name} called`,
      sub: `${capitalize(i.intentLabel)} · ${i.trust === 'new' ? 'new caller' : i.trust === 'verified' && requireVerification ? 'verified' : 'known caller'}`,
      tier: i.tier,
    });
    if (i.claimedAt) evs.push({ key: i.id + ':call', at: i.claimedAt, kind: 'call', title: `Called back ${name.split(' ')[0]}`, sub: `after ${clock(i.claimedAt - i.createdAt)}`, tier: i.tier });
    if (i.doneAt) evs.push({ key: i.id + ':done', at: i.doneAt, kind: 'done', title: `${name.split(' ')[0]} handled`, sub: `+${i.savedMin} min returned`, tier: i.tier });
  }
  const list = evs.filter((e) => e.at >= midnight.getTime()).sort((a, b) => b.at - a.at).slice(0, 12);

  return (
    <section className="card timeline" aria-labelledby="tl-h">
      <h2 id="tl-h" className="card-title">
        Today
      </h2>
      {list.length === 0 ? (
        <p className="muted small">No calls yet today.</p>
      ) : (
        <ol className="tl">
          {list.map((e) => (
            <li key={e.key} className={`tl-item tl-${e.kind} tier-${e.tier}`}>
              <span className="tl-time tnum">{hhmm(e.at)}</span>
              <i className="tl-dot" aria-hidden="true" />
              <span className="tl-text">
                <b>{e.title}</b>
                <span>{e.sub}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function CodesCard({ codes, nowEst }: { codes: CodesResponse['codes']; nowEst: number }) {
  return (
    <section className={`card codes${codes.length ? ' has-codes' : ''}`} aria-labelledby="codes-h" data-tip="Shown in case a text doesn't arrive during the demo">
      <h2 id="codes-h" className="card-title">
        Texted codes
      </h2>
      {codes.length === 0 ? (
        <p className="muted small">None active</p>
      ) : (
        <ul>
          {codes.map((c) => (
            <li key={c.phoneMasked + c.code}>
              <span className="code">
                <Digits text={c.code} />
              </span>
              <span className="muted small tnum">
                {c.phoneMasked} · {c.expiresAt > nowEst ? clock(c.expiresAt - nowEst) : 'expired'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
