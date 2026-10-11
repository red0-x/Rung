import type { Intent } from './types.js';

/**
 * Rule-based, explainable priority. score = urgency + value + aging.
 *   urgency: what is at stake for the caller right now (by intent)
 *   value:   how much money is involved (stepped tiers, one input among three)
 *   aging:   points per minute waited, so nobody starves behind bigger fish
 * Every number here is shown on the dashboard so a judge can audit a ranking.
 */

export type Tier = 'critical' | 'high' | 'normal' | 'low';

export interface IntentMeta {
  label: string;
  points: number;
  tier: Tier;
  /** Moving money / changing an account: caller must prove identity by SMS code first. */
  sensitive: boolean;
}

export const INTENT_META: Record<Intent, IntentMeta> = {
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
};

export const TIER_LABEL: Record<Tier, string> = {
  critical: 'Urgent',
  high: 'High',
  normal: 'Standard',
  low: 'Low',
};

/** Highest matching `minUsd` wins. */
export const VALUE_TIERS: ReadonlyArray<{ minUsd: number; points: number }> = [
  { minUsd: 0, points: 0 },
  { minUsd: 100, points: 8 },
  { minUsd: 1_000, points: 16 },
  { minUsd: 10_000, points: 24 },
  { minUsd: 100_000, points: 32 },
  { minUsd: 1_000_000, points: 40 },
];

export interface AgingConfig {
  agingPerMin: number;
  agingCap: number;
}

export interface ScoreBreakdown {
  urgency: number;
  value: number;
  aging: number;
  total: number;
  waitedMin: number;
  tier: Tier;
  reason: string;
}

export function valuePoints(amountUsd?: number): number {
  if (!amountUsd || amountUsd < 0) return 0;
  let pts = 0;
  for (const t of VALUE_TIERS) if (amountUsd >= t.minUsd) pts = t.points;
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
  cfg: AgingConfig,
): ScoreBreakdown {
  const meta = INTENT_META[item.intent];
  const waitedMs = Math.max(0, now - item.createdAt);
  const waitedMin = Math.floor(waitedMs / 60_000);
  const urgency = meta.points;
  const value = valuePoints(item.amountUsd);
  const aging = Math.min(cfg.agingCap, Math.floor((waitedMs / 60_000) * cfg.agingPerMin));
  const parts = [`${TIER_LABEL[meta.tier]}: ${meta.label}`];
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
