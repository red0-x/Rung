import type { Intent, IntentRule, OrgSettings, Tier, ValueTier } from './types.js';

/**
 * Rule-based, explainable priority. score = urgency + value + aging.
 *   urgency: what is at stake for the caller right now (by intent)
 *   value:   how much money is involved (stepped tiers, one input among three)
 *   aging:   points per minute waited, so nobody starves behind bigger fish
 * Every number comes from the org's rules and is shown on the dashboard.
 */

export interface Rules {
  intents: Record<Intent, IntentRule>;
  valueTiers: ValueTier[];
  agingPerMin: number;
  agingCap: number;
}

export function defaultRules(): Rules {
  return {
    intents: {
      fraud_in_progress: { label: 'suspected fraud', points: 100, tier: 'critical', sensitive: false },
      medical_emergency: { label: 'medical emergency', points: 100, tier: 'critical', sensitive: false },
      locked_out: { label: 'locked out of account', points: 60, tier: 'high', sensitive: false },
      payment_issue: { label: 'payment problem', points: 40, tier: 'high', sensitive: false },
      money_movement: { label: 'moving money', points: 35, tier: 'normal', sensitive: true },
      account_change: { label: 'account change', points: 25, tier: 'normal', sensitive: true },
      dispute: { label: 'card dispute', points: 20, tier: 'normal', sensitive: false },
      account_opening: { label: 'new account', points: 20, tier: 'normal', sensitive: false },
      general_question: { label: 'general question', points: 10, tier: 'low', sensitive: false },
      other: { label: 'other', points: 10, tier: 'low', sensitive: false },
    },
    valueTiers: [
      { minUsd: 0, points: 0 },
      { minUsd: 100, points: 8 },
      { minUsd: 1_000, points: 16 },
      { minUsd: 10_000, points: 24 },
      { minUsd: 100_000, points: 32 },
      { minUsd: 1_000_000, points: 40 },
    ],
    agingPerMin: 2,
    agingCap: 150,
  };
}

export function defaultSettings(orgName = 'us'): OrgSettings {
  return {
    greeting: `Thanks for calling ${orgName}.`,
    tone: 'warm, brief, plain English',
    ...defaultRules(),
    avgHandleMin: 4,
    repsOnShift: 1,
    baselineHoldMin: 23,
    reexplainMin: 3,
  };
}

/** Contract labels for the dashboard. */
export const TIER_LABEL: Record<Tier, string> = {
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};

/** Prefix used in the reason string ("Urgent: suspected fraud · ..."). */
export const REASON_PREFIX: Record<Tier, string> = {
  critical: 'Urgent',
  high: 'High',
  normal: 'Standard',
  low: 'Low',
};

export interface ScoreBreakdown {
  urgency: number;
  value: number;
  aging: number;
  total: number;
  waitedMin: number;
  tier: Tier;
  reason: string;
}

/** Highest matching `minUsd` wins. */
export function valuePoints(amountUsd: number | undefined, rules: Pick<Rules, 'valueTiers'> = defaultRules()): number {
  if (!amountUsd || amountUsd < 0) return 0;
  let pts = 0;
  for (const t of [...rules.valueTiers].sort((a, b) => a.minUsd - b.minUsd)) if (amountUsd >= t.minUsd) pts = t.points;
  return pts;
}

export function formatUsd(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  const whole = Number.isInteger(n);
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;
}

export function scoreItem(
  item: { intent: Intent; amountUsd?: number; createdAt: number },
  now: number,
  rules: Rules = defaultRules(),
): ScoreBreakdown {
  const meta = rules.intents[item.intent] ?? defaultRules().intents[item.intent];
  const waitedMs = Math.max(0, now - item.createdAt);
  const waitedMin = Math.floor(waitedMs / 60_000);
  const urgency = meta.points;
  const value = valuePoints(item.amountUsd, rules);
  const aging = Math.min(rules.agingCap, Math.floor((waitedMs / 60_000) * rules.agingPerMin));
  const parts = [`${REASON_PREFIX[meta.tier]}: ${meta.label}`];
  if (item.amountUsd) parts.push(formatUsd(item.amountUsd));
  parts.push(`waited ${waitedMin} min`);
  if (aging > 0) parts.push(`+${aging} aging`);
  return {
    urgency,
    value,
    aging,
    total: urgency + value + aging,
    waitedMin,
    tier: meta.tier,
    reason: parts.join(' · '),
  };
}

/** Rough callback ETA from queue position (1 = next up). */
export function estimateCallbackMinutes(position: number, avgHandleMin: number, reps: number): number {
  return Math.max(2, Math.ceil((position * avgHandleMin) / Math.max(1, reps)));
}
