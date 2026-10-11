import { describe, expect, it } from 'vitest';
import { defaultRules, estimateCallbackMinutes, formatUsd, scoreItem, valuePoints } from '../src/scoring.js';
import { rankQueued } from '../src/queue.js';
import type { QueueItem } from '../src/types.js';

const rules = defaultRules();
const T0 = 1_700_000_000_000;
const min = (n: number) => n * 60_000;

describe('valuePoints', () => {
  it('steps by order of magnitude', () => {
    expect(valuePoints(undefined)).toBe(0);
    expect(valuePoints(12)).toBe(0);
    expect(valuePoints(99.99)).toBe(0);
    expect(valuePoints(100)).toBe(8);
    expect(valuePoints(4200)).toBe(16);
    expect(valuePoints(10_000)).toBe(24);
    expect(valuePoints(250_000)).toBe(32);
    expect(valuePoints(10_000_000)).toBe(40);
  });
});

describe('scoreItem: the demo ordering', () => {
  const fraud = { intent: 'fraud_in_progress', amountUsd: 4200, createdAt: T0 } as const;
  const vip = { intent: 'account_opening', amountUsd: 10_000_000, createdAt: T0 } as const;
  const dispute = { intent: 'dispute', amountUsd: 12, createdAt: T0 } as const;

  it('fraud $4,200 = 116, $10M opening = 60, $12 dispute = 20', () => {
    const [f, v, d] = [fraud, vip, dispute].map((i) => scoreItem(i, T0, rules).total);
    expect(f).toBe(116);
    expect(v).toBe(60);
    expect(d).toBe(20);
    expect(f).toBeGreaterThan(v!);
    expect(v).toBeGreaterThan(d!);
  });

  it('writes a reason a rep can read at a glance', () => {
    expect(scoreItem(fraud, T0 + min(6), rules).reason).toBe('Urgent: suspected fraud · $4,200 · waited 6 min · +12 aging');
    expect(scoreItem(dispute, T0, rules).reason).toBe('Standard: card dispute · $12 · waited 0 min');
  });
});

describe('aging', () => {
  it('after 45 minutes the $12 dispute beats a fresh $10M opening', () => {
    const dispute = scoreItem({ intent: 'dispute', amountUsd: 12, createdAt: T0 }, T0 + min(45), rules);
    const freshVip = scoreItem({ intent: 'account_opening', amountUsd: 10_000_000, createdAt: T0 + min(45) }, T0 + min(45), rules);
    expect(dispute.aging).toBe(90);
    expect(dispute.total).toBe(110);
    expect(dispute.total).toBeGreaterThan(freshVip.total);
  });

  it('is capped, and the cap is high enough that nobody starves', () => {
    const old = scoreItem({ intent: 'general_question', createdAt: T0 }, T0 + min(24 * 60), rules);
    expect(old.aging).toBe(150);
    const freshWorst = scoreItem({ intent: 'fraud_in_progress', amountUsd: 5e7, createdAt: T0 }, T0, rules);
    expect(old.total).toBeGreaterThan(freshWorst.total);
  });

  it('never goes negative if the clock is behind', () => {
    expect(scoreItem({ intent: 'other', createdAt: T0 }, T0 - min(5), rules).aging).toBe(0);
  });
});

describe('per-org rules', () => {
  const item = (id: string, intent: QueueItem['intent'], amountUsd?: number): QueueItem => ({
    id, orgId: 'o', phone: '+15555550100', intent, amountUsd, summary: 's', trust: 'new', returning: false, status: 'queued', createdAt: T0,
  });
  it('ranks fraud > $10M > $12 with defaults, and an org can reorder by changing points', () => {
    const items = [item('d', 'dispute', 12), item('v', 'account_opening', 10_000_000), item('f', 'fraud_in_progress', 4200)];
    expect(rankQueued(items, T0, rules).map((s) => s.item.id)).toEqual(['f', 'v', 'd']);
    const custom = defaultRules();
    custom.intents.dispute = { ...custom.intents.dispute, points: 200 };
    expect(rankQueued(items, T0, custom).map((s) => s.item.id)).toEqual(['d', 'f', 'v']);
  });
  it('uses the org label and its value tiers', () => {
    const custom = defaultRules();
    custom.intents.account_opening = { ...custom.intents.account_opening, label: 'new patient' };
    custom.valueTiers = [{ minUsd: 0, points: 0 }, { minUsd: 10, points: 5 }];
    const s = scoreItem({ intent: 'account_opening', amountUsd: 12, createdAt: T0 }, T0, custom);
    expect(s.value).toBe(5);
    expect(s.reason).toBe('Standard: new patient · $12 · waited 0 min');
  });
});

describe('formatUsd', () => {
  it('formats money for speech and screens', () => {
    expect(formatUsd(12)).toBe('$12');
    expect(formatUsd(4200)).toBe('$4,200');
    expect(formatUsd(12.5)).toBe('$12.50');
    expect(formatUsd(10_000_000)).toBe('$10M');
    expect(formatUsd(2_500_000)).toBe('$2.5M');
  });
});

describe('estimateCallbackMinutes', () => {
  it('scales with position and reps, never below 2', () => {
    expect(estimateCallbackMinutes(1, 4, 1)).toBe(4);
    expect(estimateCallbackMinutes(3, 4, 1)).toBe(12);
    expect(estimateCallbackMinutes(3, 4, 2)).toBe(6);
    expect(estimateCallbackMinutes(1, 1, 5)).toBe(2);
  });
});
