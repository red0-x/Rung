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

/** How much we trust that the caller is who the number says they are. */
export type Trust = 'verified' | 'recognized' | 'new';

export interface TranscriptTurn {
  speaker: string;
  text: string;
  startMs?: number;
  endMs?: number;
}

export interface Profile {
  phone: string;
  name: string;
  consentAt: number;
  verifiedAt: number;
  createdAt: number;
}

export interface Verification {
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
  phone: string;
  agentNumber?: string;
  name?: string;
  intent: Intent;
  amountUsd?: number;
  summary: string;
  trust: Trust;
  status: QueueStatus;
  createdAt: number;
  claimedAt?: number;
  doneAt?: number;
  callId?: string;
  transcript?: string;
  transcriptTurns?: TranscriptTurn[];
  durationSeconds?: number;
}
