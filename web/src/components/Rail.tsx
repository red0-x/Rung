import { capitalize, clock } from '../format';
import type { CodesResponse, QueueItemView } from '../types';
import { Digits } from './Digits';

interface Ev {
  key: string;
  id: string;
  at: number;
  kind: 'in' | 'call' | 'done';
  title: string;
  sub: string;
  tier: QueueItemView['tier'];
}

const hhmm = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function Timeline({
  items,
  requireVerification = false,
  onReopen,
}: {
  items: QueueItemView[];
  requireVerification?: boolean;
  onReopen?: (id: string) => void;
}) {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const evs: Ev[] = [];
  for (const i of items) {
    const name = i.name ?? 'Unknown caller';
    const first = i.name ? i.name.split(' ')[0]! : 'Unknown caller';
    evs.push({
      key: i.id + ':in',
      id: i.id,
      at: i.createdAt,
      kind: 'in',
      title: `${name} called`,
      sub: `${capitalize(i.intentLabel)} · ${i.trust === 'new' ? 'new caller' : i.trust === 'verified' && requireVerification ? 'verified' : 'known caller'}`,
      tier: i.tier,
    });
    if (i.claimedAt) evs.push({ id: i.id, key: i.id + ':call', at: i.claimedAt, kind: 'call', title: `Called back ${first}`, sub: `after ${clock(i.claimedAt - i.createdAt)}`, tier: i.tier });
    if (i.doneAt && i.status === 'done') evs.push({ id: i.id, key: i.id + ':done', at: i.doneAt, kind: 'done', title: `${first} handled`, sub: `+${i.savedMin} min returned`, tier: i.tier });
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
              {e.kind === 'done' && onReopen && (
                <button type="button" className="tl-action" onClick={() => onReopen(e.id)}>
                  Reopen
                </button>
              )}
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
