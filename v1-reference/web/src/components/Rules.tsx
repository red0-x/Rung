import { usd } from '../format';
import type { ConfigResponse, Tier } from '../types';

const TIERS: Array<{ tier: Tier; label: string }> = [
  { tier: 'critical', label: 'Urgent' },
  { tier: 'high', label: 'High' },
  { tier: 'normal', label: 'Standard' },
  { tier: 'low', label: 'Low' },
];

/** Rendered from the server's own scoring table, so it can never drift from how calls are really ranked. */
export function Rules({ cfg }: { cfg: ConfigResponse }) {
  const { intents, valueTiers } = cfg.scoring;
  const maxValue = Math.max(...valueTiers.map((v) => v.points));
  const lowest = Math.min(...intents.map((i) => i.points));
  const highest = Math.max(...intents.map((i) => i.points)) + maxValue;
  const outranksNew = lowest + cfg.agingCap > highest;
  const minutesToOutrank = Math.ceil((highest - lowest + 1) / cfg.agingPerMin);

  return (
    <section aria-labelledby="rules-h" className="rules">
      <h2 id="rules-h">How the order is decided</h2>
      <p>Each caller's score adds urgency, value, and time spent waiting. The highest score is called first.</p>

      <h3>Urgency</h3>
      <dl>
        {TIERS.map(({ tier, label }) => {
          const group = intents.filter((i) => i.tier === tier);
          if (!group.length) return null;
          const pts = [...new Set(group.map((g) => g.points))].sort((a, b) => b - a);
          return (
            <div key={tier} className={`rule-line tier-${tier}`}>
              <dt>
                {label} <span className="pts">{pts.length > 1 ? `${pts[pts.length - 1]} to ${pts[0]}` : pts[0]}</span>
              </dt>
              <dd>{group.map((g) => g.label).join(', ')}</dd>
            </div>
          );
        })}
      </dl>

      <h3>Value</h3>
      <p>
        Up to {maxValue} points for the money involved:{' '}
        {valueTiers
          .filter((v) => v.points > 0)
          .map((v) => `${usd(v.minUsd)}+ is ${v.points}`)
          .join(', ')}
        .
      </p>

      <h3>Waiting</h3>
      <p>
        {cfg.agingPerMin} points for every minute waited, up to {cfg.agingCap}.
        {outranksNew
          ? ` After ${minutesToOutrank} minutes, even a general question outranks a brand-new emergency, so no one is left on hold forever.`
          : ''}
      </p>
    </section>
  );
}
