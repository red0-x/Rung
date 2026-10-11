import type { Profile, QueueItem, QueueStatus, Verification } from '../types.js';

/**
 * Persistence boundary. Two implementations: in-memory (zero setup, used by
 * tests and local dev) and Supabase (survives restarts). Everything the tools
 * touch mid-call goes through here, so it must stay fast.
 */
export interface Store {
  readonly kind: 'memory' | 'supabase';

  getProfile(phone: string): Promise<Profile | undefined>;
  upsertProfile(profile: Profile): Promise<Profile>;
  listProfiles(): Promise<Profile[]>;

  getVerification(phone: string): Promise<Verification | undefined>;
  putVerification(v: Verification): Promise<void>;

  addQueueItem(item: QueueItem): Promise<QueueItem>;
  updateQueueItem(id: string, patch: Partial<Omit<QueueItem, 'id'>>): Promise<QueueItem | undefined>;
  getQueueItem(id: string): Promise<QueueItem | undefined>;
  findQueueItemByCallId(callId: string): Promise<QueueItem | undefined>;
  /** Newest item for this number, optionally limited to some statuses. */
  latestQueueItemForPhone(phone: string, statuses?: QueueStatus[]): Promise<QueueItem | undefined>;
  /** Newest first. */
  listQueueItems(opts?: { statuses?: QueueStatus[]; limit?: number }): Promise<QueueItem[]>;

  /** Webhook dedupe. Returns true the first time an event id is seen. */
  markEventSeen(eventId: string): Promise<boolean>;

  /** Dev/test only: wipe everything. */
  reset(): Promise<void>;
}
