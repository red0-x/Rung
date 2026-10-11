export type Tier = 'critical' | 'high' | 'normal' | 'low';
export type Trust = 'verified' | 'recognized' | 'new';

export interface QueueItemView {
  id: string;
  rank: number | null;
  name: string | null;
  phoneMasked: string;
  intent: string;
  intentLabel: string;
  tier: Tier;
  tierLabel: string;
  amountUsd: number | null;
  summary: string;
  trust: Trust;
  status: 'queued' | 'in_progress' | 'done';
  createdAt: number;
  claimedAt: number | null;
  doneAt: number | null;
  waitedMin: number;
  score: { urgency: number; value: number; aging: number; total: number };
  reason: string;
  hasTranscript: boolean;
  durationSeconds: number | null;
}

export interface QueueResponse {
  /** Server clock when this was computed; used to keep timers honest if the laptop clock is off. */
  now: number;
  queued: QueueItemView[];
  inProgress: QueueItemView[];
  done: QueueItemView[];
  stats: { waiting: number; inProgress: number; longestWaitMin: number; avgWaitMin: number };
}

export interface ConfigResponse {
  orgName: string;
  agingPerMin: number;
  agingCap: number;
  avgHandleMin: number;
  repsOnShift: number;
  demoShowCodes: boolean;
  enableDev: boolean;
  scoring: {
    intents: Array<{ intent: string; label: string; points: number; tier: Tier; sensitive: boolean }>;
    valueTiers: Array<{ minUsd: number; points: number }>;
  };
}

export interface ProfilesResponse {
  profiles: Array<{ name: string; phoneMasked: string; createdAt: number }>;
}

export interface CodesResponse {
  codes: Array<{ phone: string; phoneMasked: string; code: string; expiresAt: number }>;
}

export interface TranscriptResponse {
  transcript: string | null;
  turns: Array<{ speaker: string; text: string }> | null;
}
