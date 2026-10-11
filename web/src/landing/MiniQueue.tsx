/** The business's view: a ranked callback queue that re-sorts as the hero call is verified. */

type Row = {
  id: string;
  intent: string;
  name: string;
  amount: string;
  tier: 'critical' | 'normal' | 'low';
  u: number;
  v: number;
  a: number;
};

const ROWS: Record<string, Row> = {
  maria: { id: 'maria', intent: 'Suspected fraud', name: 'Maria R.', amount: '$4,200', tier: 'critical', u: 62, v: 14, a: 6 },
  dev: { id: 'dev', intent: 'Open account', name: 'Dev P.', amount: '$10M', tier: 'normal', u: 22, v: 44, a: 8 },
  sam: { id: 'sam', intent: 'Card dispute', name: 'Sam K.', amount: '$12', tier: 'low', u: 18, v: 4, a: 30 },
};

export const QUEUE_ROW_H = 54;

export default function MiniQueue({ step }: { step: number }) {
  const ranked = step >= 3;
  const queued = step >= 2;
  const order = ranked ? ['maria', 'dev', 'sam'] : ['dev', 'sam', 'maria'];

  return (
    <div className="landing-card landing-queue">
      <div className="landing-card-head">
        <span>Your callback queue</span>
        <span className="landing-muted tnum">{queued ? 3 : 2} waiting</span>
      </div>
      <div className="landing-queue-body" style={{ height: QUEUE_ROW_H * 3 }}>
        <ol className="landing-queue-ranks" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <li key={n} className="tnum" data-empty={n === 3 && !queued}>{n}</li>
          ))}
        </ol>
        <ul className="landing-queue-rows">
          {order.map((id, idx) => {
            const r = ROWS[id];
            const hidden = id === 'maria' && !queued;
            return (
              <li
                key={id}
                className="landing-queue-row"
                data-hidden={hidden}
                data-top={idx === 0 && ranked && id === 'maria'}
                style={{ transform: `translateY(${idx * QUEUE_ROW_H + (hidden ? 8 : 0)}px)` }}
              >
                <div className="landing-mq-top">
                  <span className={`landing-dot landing-dot-${r.tier}`} aria-hidden="true" />
                  <strong>{r.intent}</strong>
                  <span className="landing-muted">{r.name}</span>
                  <span className="landing-mq-amt tnum">{r.amount}</span>
                </div>
                <div className="landing-bar" aria-hidden="true">
                  <span className={`landing-bg-${r.tier}`} style={{ width: `${r.u}%` }} />
                  <span className="landing-bar-v" style={{ width: `${r.v}%` }} />
                  <span className="landing-bar-a" style={{ width: `${r.a}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
