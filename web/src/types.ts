// Mirrors docs/API.md (contract v3). Change only together with the server.

export type Intent =
  | 'fraud_in_progress'
  | 'medical_emergency'
  | 'locked_out'
  | 'payment_issue'
  | 'money_movement'
  | 'account_change'
  | 'dispute'
  | 'account_opening'
  | 'general_question'
  | 'other';
export type Tier = 'critical' | 'high' | 'normal' | 'low';
export type Trust = 'verified' | 'recognized' | 'new';
export type QueueStatus = 'queued' | 'in_progress' | 'done';

export interface IntentRule {
  label: string;
  points: number;
  tier: Tier;
  sensitive: boolean;
}
export interface ValueTier {
  minUsd: number;
  points: number;
}

export interface OrgSettings {
  greeting: string;
  tone: string;
  intents: Record<Intent, IntentRule>;
  valueTiers: ValueTier[];
  agingPerMin: number;
  agingCap: number;
  avgHandleMin: number;
  repsOnShift: number;
  baselineHoldMin: number;
  reexplainMin: number;
}

export interface OrgView {
  id: string;
  name: string;
  slug: string;
  dialNumber: string | null;
  dialNumberId: string | null;
  dialNumberMock: boolean;
  mcpUrl: string;
  settings: OrgSettings;
  publishedAt: number | null;
}

export interface QueueItemView {
  id: string;
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
  doneAt: number | null;
  waitedMin: number;
  score: { urgency: number; value: number; aging: number; total: number };
  reason: string;
  savedMin: number;
  hasTranscript: boolean;
  durationSeconds: number | null;
}

export interface QueueResponse {
  now: number;
  queued: QueueItemView[];
  inProgress: QueueItemView[];
  done: QueueItemView[];
  stats: { waiting: number; inProgress: number; longestWaitMin: number; avgWaitMin: number };
  timeSaved: {
    totalMin: number;
    callers: number;
    baselineHoldMin: number;
    reexplainMin: number;
    returningCallers: number;
    formula: string;
  };
}

export type DialMode = 'mock' | 'live';

export interface HealthResponse {
  ok: boolean;
  store: 'memory' | 'supabase';
  dial: DialMode;
  time: number;
}

export interface MeResponse {
  user: { id: string; email: string };
  org: OrgView | null;
  role: 'admin' | null;
  platform: { dial: DialMode; demoShowCodes: boolean; enableDev: boolean };
}

export interface OrgResponse {
  org: OrgView;
}

export interface OrgPatch {
  name?: string;
  settings?: Partial<Omit<OrgSettings, 'intents'>> & { intents?: Partial<Record<Intent, Partial<IntentRule>>> };
}

export interface DialNumber {
  id: string;
  number: string;
  mock: boolean;
  available: boolean;
  mine: boolean;
}
export interface NumbersResponse {
  numbers: DialNumber[];
}

export interface PromptResponse {
  prompt: string;
}

export interface PublishResponse {
  ok: true;
  mock: boolean;
  numberId: string;
  number: string;
  request: { method: 'PATCH'; path: string; body: { inboundInstruction: string } };
}

export interface TranscriptResponse {
  transcript: string | null;
  turns: Array<{ speaker: string; text: string }> | null;
}

export interface CallbackResponse {
  phone: string;
  tel: string;
}

export interface ProfilesResponse {
  profiles: Array<{ name: string; phoneMasked: string; createdAt: number; verified: boolean }>;
}

export interface CodesResponse {
  codes: Array<{ phoneMasked: string; code: string; expiresAt: number }>;
}

export interface DialLogResponse {
  mock: boolean;
  sms: Array<{ toMasked: string; from: string | null; body: string; at: number }>;
  patches: Array<{ numberId: string; at: number; inboundInstruction: string }>;
  callFetches: Array<{ callId: string; at: number }>;
}

export interface ApiErrorBody {
  error: string;
  message?: string;
}
