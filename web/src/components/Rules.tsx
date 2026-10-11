import { TIERS, TIER_LABEL, usd } from '../format';
import type { OrgSettings } from '../types';

/** Rendered from the org's own scoring settings, so it never drifts from how calls are ranked. */
export function Rules({ settings }: { settings: OrgSettings }) {
  const intents = Object.values(settings.intents);
  const valueTiers = [...settings.valueTiers].sort((a, b) => a.minUsd - b.minUsd);
  const maxValue = Math.max(0, ...valueTiers.map((v) => v.points));
  const lowest = Math.min(...intents.map((i) => i.points));
  const highest = Math.max(...intents.map((i) => i.points)) + maxValue;
  const outranksNew = settings.agingPerMin > 0 && lowest + settings.agingCap > highest;
  const minutesToOutrank = settings.agingPerMin > 0 ? Math.ceil((highest - lowest + 1) / settings.agingPerMin) : 0;

  return (
    <div className="rules">
      <p className="muted">Score = urgency + value + waiting. Highest score is called back first.</p>

      <h3>Urgency</h3>
      <dl>
        {TIERS.map((tier) => {
          const group = intents.filter((i) => i.tier === tier);
          if (!group.length) return null;
          const pts = [...new Set(group.map((g) => g.points))].sort((a, b) => b - a);
          return (
            <div key={tier} className={`rule-line tier-${tier}`}>
              <dt>
                <i className="tier-dot" aria-hidden="true" />
                {TIER_LABEL[tier]}{' '}
                <span className="pts tnum">{pts.length > 1 ? `${pts[pts.length - 1]}–${pts[0]}` : pts[0]}</span>
              </dt>
              <dd>{group.map((g) => g.label).join(', ')}</dd>
            </div>
          );
        })}
      </dl>

      <h3>Value</h3>
      <p>
        Up to <span className="tnum">{maxValue}</span> points for the money involved
        {valueTiers.some((v) => v.points > 0) ? ': ' : '.'}
        {valueTiers
          .filter((v) => v.points > 0)
          .map((v) => `${usd(v.minUsd)}+ is ${v.points}`)
          .join(', ')}
        {valueTiers.some((v) => v.points > 0) ? '.' : ''}
      </p>

      <h3>Waiting</h3>
      <p>
        <span className="tnum">{settings.agingPerMin}</span> points per minute waited, up to{' '}
        <span className="tnum">{settings.agingCap}</span>.
        {outranksNew
          ? ` After ${minutesToOutrank} minutes even a general question outranks a brand-new emergency, so no one waits forever.`
          : ''}
      </p>

      <h3>Callback estimate</h3>
      <p>
        <span className="tnum">{settings.repsOnShift}</span> {settings.repsOnShift === 1 ? 'rep' : 'reps'} on shift at about{' '}
        <span className="tnum">{settings.avgHandleMin}</span> min a call, so rank #n is called back in roughly n ×{' '}
        {settings.avgHandleMin} ÷ {settings.repsOnShift} min.
      </p>
    </div>
  );
}
