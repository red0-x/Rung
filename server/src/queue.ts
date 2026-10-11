import { maskPhone } from './identity.js';
import { TIER_LABEL, scoreItem, type Rules, type ScoreBreakdown } from './scoring.js';
import type { Intent, OrgSettings, QueueItem, QueueStatus, Tier, Trust } from './types.js';

export interface QueueItemView {
  id: string;
  /** 1-based position for waiting items, null once claimed or done. */
  rank: number | null;
  name: string | null;
  phoneMasked: string;
  intent: Intent;
  intentLabel: string;
  tier: Tier;
  tierLabel: string;
  amountUsd: number | null;
  summary: string;
  trust: Trust;
  returning: boolean;
  status: QueueStatus;
  createdAt: number;
  claimedAt: number | null;
  /** The rep holding the callback, null while queued. */
  claimedBy: { id: string; name: string } | null;
  doneAt: number | null;
  waitedMin: number;
  score: { urgency: number; value: number; aging: number; total: number };
  reason: string;
  /** Minutes this caller did not spend on hold or re-explaining. */
  savedMin: number;
  hasTranscript: boolean;
  durationSeconds: number | null;
}

export interface Scored {
  item: QueueItem;
  score: ScoreBreakdown;
}

/** Highest score first; ties go to whoever has waited longer. Aging is computed now, so order shifts live. */
export function rankQueued(items: QueueItem[], now: number, rules: Rules): Scored[] {
  return items
    .filter((i) => i.status === 'queued')
    .map((item) => ({ item, score: scoreItem(item, now, rules) }))
    .sort((a, b) => b.score.total - a.score.total || a.item.createdAt - b.item.createdAt);
}

export function savedMinutes(item: Pick<QueueItem, 'returning'>, s: OrgSettings): number {
  return s.baselineHoldMin + (item.returning ? s.reexplainMin : 0);
}

export function toView(s: Scored, rank: number | null, settings: OrgSettings): QueueItemView {
  const { item, score } = s;
  const meta = settings.intents[item.intent];
  return {
    id: item.id,
    rank,
    name: item.name ?? null,
    phoneMasked: maskPhone(item.phone),
    intent: item.intent,
    intentLabel: meta.label,
    tier: meta.tier,
    tierLabel: TIER_LABEL[meta.tier],
    amountUsd: item.amountUsd ?? null,
    summary: item.summary,
    trust: item.trust,
    returning: item.returning,
    status: item.status,
    createdAt: item.createdAt,
    claimedAt: item.claimedAt ?? null,
    claimedBy: item.claimedBy ? { id: item.claimedBy, name: item.claimedByName ?? 'Rep' } : null,
    doneAt: item.doneAt ?? null,
    waitedMin: score.waitedMin,
    score: { urgency: score.urgency, value: score.value, aging: score.aging, total: score.total },
    reason: score.reason,
    savedMin: savedMinutes(item, settings),
    hasTranscript: !!item.transcript,
    durationSeconds: item.durationSeconds ?? null,
  };
}
