import { describe, expect, it } from 'vitest';
import { estimateCallbackMinutes, formatUsd, scoreItem, valuePoints } from '../src/scoring.js';

const cfg = { agingPerMin: 2, agingCap: 150 };
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

  it('ranks active fraud above a $10M account opening above a $12 dispute', () => {
    const [f, v, d] = [fraud, vip, dispute].map((i) => scoreItem(i, T0, cfg).total);
    expect(f).toBe(116);
    expect(v).toBe(60);
    expect(d).toBe(20);
    expect(f).toBeGreaterThan(v!);
    expect(v).toBeGreaterThan(d!);
  });

  it('writes a reason a rep can read at a glance', () => {
    expect(scoreItem(fraud, T0 + min(6), cfg).reason).toBe('Urgent: suspected fraud · $4,200 · waited 6 min · +12 aging');
    expect(scoreItem(dispute, T0, cfg).reason).toBe('Standard: card dispute · $12 · waited 0 min');
  });
});

describe('aging', () => {
  it('lets a long-waiting small issue overtake a fresh large one', () => {
    const dispute = scoreItem({ intent: 'dispute', amountUsd: 12, createdAt: T0 }, T0 + min(45), cfg);
    const freshVip = scoreItem({ intent: 'account_opening', amountUsd: 10_000_000, createdAt: T0 + min(45) }, T0 + min(45), cfg);
    expect(dispute.aging).toBe(90);
    expect(dispute.total).toBeGreaterThan(freshVip.total);
  });

  it('is capped, and the cap is high enough that nobody starves', () => {
    const old = scoreItem({ intent: 'general_question', createdAt: T0 }, T0 + min(24 * 60), cfg);
    expect(old.aging).toBe(150);
    const freshWorst = scoreItem({ intent: 'fraud_in_progress', amountUsd: 5e7, createdAt: T0 }, T0, cfg);
    expect(old.total).toBeGreaterThan(freshWorst.total);
  });

  it('never goes negative if the clock is behind', () => {
    expect(scoreItem({ intent: 'other', createdAt: T0 }, T0 - min(5), cfg).aging).toBe(0);
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
