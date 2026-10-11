import type { OrgMember, OrgSettings, QueueItem } from './types.js';

/** A rep counts as online if their dashboard polled within this window. */
export const ONLINE_MS = 60_000;
/** Don't write a heartbeat on every 1.5 s poll. */
export const HEARTBEAT_MS = 15_000;

/** "ai.jadonli09+sam@gmail.com" → "Sam" (plus-address tag wins), "maria.lopez@x.com" → "Maria.lopez". */
export function repName(email: string): string {
  const local = email.split('@')[0] ?? '';
  const tag = local.includes('+') ? local.slice(local.indexOf('+') + 1) : local;
  const name = tag || local || 'Rep';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export const isOnline = (m: OrgMember, now: number) => m.lastSeenAt !== undefined && now - m.lastSeenAt < ONLINE_MS;

/** Reps used for callback estimates: who is online now, else the configured shift size (nobody has the dashboard open). */
export function repsForEta(members: OrgMember[], now: number, s: OrgSettings): number {
  const online = members.filter((m) => isOnline(m, now)).length;
  return online > 0 ? online : s.repsOnShift;
}

export interface RepView {
  id: string;
  name: string;
  role: OrgMember['role'];
  online: boolean;
  /** Holding an open callback. */
  busy: boolean;
}

export function repViews(members: OrgMember[], inProgress: QueueItem[], now: number): RepView[] {
  const busy = new Set(inProgress.map((i) => i.claimedBy).filter(Boolean));
  return members
    .map((m) => ({ id: m.userId, name: m.name ?? 'Rep', role: m.role, online: isOnline(m, now), busy: busy.has(m.userId) }))
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
}
