import type { QueueItemView, Tier, Trust } from './types';

export function usd(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  const whole = Number.isInteger(n);
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
}

/** 3:07, or 1:03:07 past an hour. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

export const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** "Suspected fraud, $4,200 at stake" */
export function issueSentence(item: QueueItemView): string {
  const base = capitalize(item.intentLabel);
  return item.amountUsd ? `${base}, ${usd(item.amountUsd)} at stake` : base;
}

export const TRUST_LABEL: Record<Trust, string> = {
  verified: 'Verified',
  recognized: 'Recognized',
  new: 'New caller',
};

export const TIER_LABEL: Record<Tier, string> = { critical: 'Critical', high: 'High', normal: 'Normal', low: 'Low' };
export const TIERS: Tier[] = ['critical', 'high', 'normal', 'low'];

export function minutes(n: number): string {
  return `${n.toLocaleString('en-US')} min`;
}

export function ago(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} h ago`;
}
