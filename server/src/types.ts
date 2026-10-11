export const INTENTS = [
  'fraud_in_progress',
  'medical_emergency',
  'locked_out',
  'payment_issue',
  'money_movement',
  'account_change',
  'dispute',
  'account_opening',
  'general_question',
  'other',
] as const;

export type Intent = (typeof INTENTS)[number];
export type QueueStatus = 'queued' | 'in_progress' | 'done';
export type Tier = 'critical' | 'high' | 'normal' | 'low';
export const TIERS: readonly Tier[] = ['critical', 'high', 'normal', 'low'];

/** How much we trust that the caller is who the number says they are. */
export type Trust = 'verified' | 'recognized' | 'new';

export interface IntentRule {
  label: string;
  points: number;
  tier: Tier;
  /** Moving money / changing an account: caller must prove identity by SMS code first. */
  sensitive: boolean;
}

export interface ValueTier {
  minUsd: number;
  points: number;
}

/** Per-org knobs (jsonb `orgs.settings`). The intent enum is platform-wide; orgs tune its numbers. */
export interface OrgSettings {
  greeting: string;
  tone: string;
  /** IANA zone used for clock times in texts, e.g. "America/Los_Angeles". */
  timezone: string;
  intents: Record<Intent, IntentRule>;
  valueTiers: ValueTier[];
  agingPerMin: number;
  agingCap: number;
  avgHandleMin: number;
  repsOnShift: number;
  baselineHoldMin: number;
  reexplainMin: number;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  mcpToken: string;
  dialNumber: string | null;
  dialNumberId: string | null;
  settings: OrgSettings;
  publishedAt: number | null;
  createdAt: number;
}

export type Role = 'admin';

export interface OrgMember {
  orgId: string;
  userId: string;
  role: Role;
}

export interface TranscriptTurn {
  speaker: string;
  text: string;
  startMs?: number;
  endMs?: number;
}

export const FACT_KEYS = ['occupation', 'employer', 'household', 'location', 'language', 'preferences'] as const;
export type FactKey = (typeof FACT_KEYS)[number];

/** What a saved caller has told us over time. Merged across calls, never replaced wholesale. */
export type Facts = Partial<Record<FactKey, string>> & { notes?: Array<{ text: string; at: number }> };

export interface Profile {
  orgId: string;
  phone: string;
  name: string;
  consentAt: number;
  /** When the caller last proved the number by texted code; unset if saved with consent only. */
  verifiedAt?: number;
  /** Durable context: occupation, household, preferences, notes. Absent on older rows. */
  facts?: Facts;
  factsUpdatedAt?: number;
  createdAt: number;
}

export interface Verification {
  orgId: string;
  phone: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  /** Start of the current send-rate window, and how many codes were sent in it. */
  windowStart: number;
  issueCount: number;
  /** Set when the caller proves they can read the texted code. */
  verifiedUntil?: number;
}

export interface QueueItem {
  id: string;
  orgId: string;
  phone: string;
  agentNumber?: string;
  name?: string;
  intent: Intent;
  amountUsd?: number;
  summary: string;
  trust: Trust;
  /** The caller had a saved profile at this org when they called (feeds time saved). */
  returning: boolean;
  status: QueueStatus;
  createdAt: number;
  claimedAt?: number;
  doneAt?: number;
  callId?: string;
  transcript?: string;
  transcriptTurns?: TranscriptTurn[];
  durationSeconds?: number;
  /** The callback estimate promised on the call (minutes) and the clock time it maps to. */
  etaMinutes?: number;
  etaAt?: number;
  /** Confirmation text: sent, failed (Dial refused it, e.g. no 10DLC), or skipped. */
  smsStatus?: 'sent' | 'failed' | 'skipped';
  smsSentAt?: number;
  smsError?: string;
}
