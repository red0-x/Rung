import { maskPhone } from './identity.js';
import {
  INTENT_META,
  TIER_LABEL,
  scoreItem,
  type AgingConfig,
  type ScoreBreakdown,
  type Tier,
} from './scoring.js';
import type { Intent, QueueItem, QueueStatus, Trust } from './types.js';

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
  status: QueueStatus;
  createdAt: number;
  claimedAt: number | null;
  doneAt: number | null;
  waitedMin: number;
  score: { urgency: number; value: number; aging: number; total: number };
  reason: string;
  hasTranscript: boolean;
  durationSeconds: number | null;
}

export interface Scored {
  item: QueueItem;
  score: ScoreBreakdown;
}

/** Highest score first; ties go to whoever has waited longer. Aging is computed now, so order shifts live. */
export function rankQueued(items: QueueItem[], now: number, cfg: AgingConfig): Scored[] {
  return items
    .filter((i) => i.status === 'queued')
    .map((item) => ({ item, score: scoreItem(item, now, cfg) }))
    .sort((a, b) => b.score.total - a.score.total || a.item.createdAt - b.item.createdAt);
}

export function toView(s: Scored, rank: number | null): QueueItemView {
  const { item, score } = s;
  const meta = INTENT_META[item.intent];
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
    status: item.status,
    createdAt: item.createdAt,
    claimedAt: item.claimedAt ?? null,
    doneAt: item.doneAt ?? null,
    waitedMin: score.waitedMin,
    score: { urgency: score.urgency, value: score.value, aging: score.aging, total: score.total },
    reason: score.reason,
    hasTranscript: !!item.transcript,
    durationSeconds: item.durationSeconds ?? null,
  };
}
