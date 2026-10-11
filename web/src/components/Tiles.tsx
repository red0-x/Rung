import { clock } from '../format';
import { useCountUp } from '../hooks';
import type { OrgSettings, QueueItemView, QueueResponse, Tier } from '../types';
import { TIERS, TIER_LABEL } from '../format';

export function TimeTile({ t }: { t: QueueResponse['timeSaved'] }) {
  const total = useCountUp(t.totalMin, 900, 0);
  const tip = `${t.callers} × ${t.baselineHoldMin} min hold avoided${
    t.returningCallers ? ` + ${t.returningCallers} × ${t.reexplainMin} min re-explaining avoided` : ''
  } = ${t.totalMin} min`;
  return (
    <section className="tile tile-cobalt" aria-label="Time returned today" data-tip={tip}>
      <p className="tile-label">Time returned</p>
      <p className="tile-num tnum">
        {total.toLocaleString('en-US')}
        <span className="tile-unit">min</span>
      </p>
      <p className="tile-cap tnum">
        to {t.callers} {t.callers === 1 ? 'caller' : 'callers'} today
      </p>
      <span className="tile-deco" aria-hidden="true">
        <i />
        <i />
      </span>
    </section>
  );
}

export function WaitingTile({ queued, nowEst }: { queued: QueueItemView[]; nowEst: number }) {
  const waits = queued.map((i) => ({ id: i.id, tier: i.tier, ms: Math.max(0, nowEst - i.createdAt), name: i.name }));
  const max = Math.max(60_000, ...waits.map((w) => w.ms));
  const count = useCountUp(queued.length, 400);
  const longest = waits.length ? Math.max(...waits.map((w) => w.ms)) : 0;
  return (
    <section className="tile" aria-label="Waiting now">
      <p className="tile-label">Waiting now</p>
      <div className="tile-row">
        <p className="tile-num tnum">{count}</p>
        <div className="mini-bars" aria-hidden="true">
          {waits.slice(0, 10).map((w) => (
            <i key={w.id} className={`tier-${w.tier}`} style={{ height: `${Math.max(10, (w.ms / max) * 100)}%` }} title={`${w.name ?? "Caller"} · ${clock(w.ms)}`} />
          ))}
        </div>
      </div>
      <p className="tile-cap tnum">{waits.length ? `longest ${clock(longest)}` : 'queue is clear'}</p>
    </section>
  );
}

export function UrgencyTile({ queued }: { queued: QueueItemView[] }) {
  const counts = Object.fromEntries(TIERS.map((t) => [t, queued.filter((i) => i.tier === t).length])) as Record<Tier, number>;
  const n = queued.length || 1;
  return (
    <section className="tile" aria-label="Waiting by urgency">
      <p className="tile-label">By urgency</p>
      <dl className="tier-stats">
        {TIERS.map((t) => (
          <div key={t} className={`tier-${t}${counts[t] ? '' : ' is-zero'}`}>
            <dt>
              <i className="tier-dot" aria-hidden="true" />
              {TIER_LABEL[t]}
            </dt>
            <dd className="tnum">{counts[t]}</dd>
          </div>
        ))}
      </dl>
      <div className="seg-bar" aria-hidden="true">
        {TIERS.map((t) => (counts[t] ? <i key={t} className={`tier-${t}`} style={{ width: `${(counts[t] / n) * 100}%` }} /> : null))}
      </div>
    </section>
  );
}

export function NextTile({ next, nowEst, settings, baselineHoldMin }: { next?: QueueItemView; nowEst: number; settings?: OrgSettings; baselineHoldMin: number }) {
  if (!next) {
    return (
      <section className="tile tile-tint" aria-label="Next callback">
        <p className="tile-label">Next callback</p>
        <p className="tile-name">No one</p>
        <p className="tile-cap">nothing to return</p>
      </section>
    );
  }
  const waitedMin = Math.max(0, (nowEst - next.createdAt) / 60_000);
  const eta = Math.max(1, Math.ceil((settings?.avgHandleMin ?? 4) / Math.max(1, settings?.repsOnShift ?? 1)));
  const frac = Math.min(1, waitedMin / Math.max(1, baselineHoldMin));
  const R = 22;
  const C = 2 * Math.PI * R;
  return (
    <section className="tile tile-tint" aria-label="Next callback" data-tip={`Waited ${Math.floor(waitedMin)} of the ${baselineHoldMin} min a typical hold would take`}>
      <p className="tile-label">Next callback</p>
      <div className="tile-row">
        <div>
          <p className="tile-name">{next.name?.split(' ')[0] ?? 'Caller'}</p>
          <p className="tile-cap tnum">in ~{eta} min</p>
        </div>
        <svg className="ring" viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r={R} className="ring-track" />
          <circle cx="26" cy="26" r={R} className="ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
        </svg>
      </div>
    </section>
  );
}
