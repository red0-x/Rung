import type { Org, OrgInvite, OrgMember, Profile, QueueItem, QueueStatus, Verification } from '../types.js';

/**
 * Persistence boundary. Two implementations: in-memory (tests, zero-setup dev)
 * and Supabase (Postgres via the service-role key). Every caller-facing record
 * is keyed by org: the same phone at two orgs is two unrelated records.
 */
export interface Store {
  readonly kind: 'memory' | 'supabase';

  // Orgs
  getOrg(id: string): Promise<Org | undefined>;
  getOrgBySlug(slug: string): Promise<Org | undefined>;
  getOrgByMcpToken(token: string): Promise<Org | undefined>;
  getOrgByDialNumber(number: string): Promise<Org | undefined>;
  listOrgs(): Promise<Org[]>;
  createOrg(org: Org): Promise<Org>;
  updateOrg(id: string, patch: Partial<Omit<Org, 'id'>>): Promise<Org | undefined>;

  // Members
  /** Every org this user belongs to, oldest membership first. */
  listMemberships(userId: string): Promise<OrgMember[]>;
  addMember(member: OrgMember): Promise<void>;
  listMembers(orgId: string): Promise<OrgMember[]>;
  /** Idempotent per (org, email). Emails are stored lowercase. */
  addInvite(invite: OrgInvite): Promise<void>;
  listInvitesForEmail(email: string): Promise<OrgInvite[]>;
  /** Heartbeat: mark a member as seen now (presence) and refresh their display name. */
  touchMember(orgId: string, userId: string, at: number, name: string): Promise<void>;

  // Profiles
  getProfile(orgId: string, phone: string): Promise<Profile | undefined>;
  upsertProfile(profile: Profile): Promise<Profile>;
  listProfiles(orgId: string): Promise<Profile[]>;

  // Verifications
  getVerification(orgId: string, phone: string): Promise<Verification | undefined>;
  putVerification(v: Verification): Promise<void>;

  // Queue
  /** Insert, or replace an item with the same id (seeding is idempotent). */
  addQueueItem(item: QueueItem): Promise<QueueItem>;
  updateQueueItem(id: string, patch: Partial<Omit<QueueItem, 'id' | 'orgId'>>): Promise<QueueItem | undefined>;
  /** Compare-and-set: apply the patch only if the item is still in `status`. Undefined if it moved (someone else won). */
  updateQueueItemIf(
    id: string,
    status: QueueStatus,
    patch: Partial<Omit<QueueItem, 'id' | 'orgId'>>,
  ): Promise<QueueItem | undefined>;
  getQueueItem(id: string): Promise<QueueItem | undefined>;
  /** Global: a Dial call id is unique across orgs. */
  findQueueItemByCallId(callId: string): Promise<QueueItem | undefined>;
  /** Newest item for this number at this org, optionally limited to some statuses. */
  latestQueueItemForPhone(orgId: string, phone: string, statuses?: QueueStatus[]): Promise<QueueItem | undefined>;
  /** This number's newest `limit` items at this org (any status) and how many it has in total. One query. */
  phoneHistory(orgId: string, phone: string, limit: number): Promise<{ items: QueueItem[]; total: number }>;
  /** Newest first (by createdAt, or by doneAt with orderBy 'doneAt'; items without doneAt last). */
  listQueueItems(
    orgId: string,
    opts?: { statuses?: QueueStatus[]; limit?: number; since?: number; orderBy?: 'createdAt' | 'doneAt' },
  ): Promise<QueueItem[]>;

  /** Webhook dedupe (global). Returns true the first time an event id is seen. */
  markEventSeen(eventId: string): Promise<boolean>;

  /** Forget one number at one org: profile, verification and every queue item (with transcripts). Returns what was removed. */
  forgetCaller(orgId: string, phone: string): Promise<{ profile: boolean; items: number }>;

  /** Dev/test: wipe one org's callers, verifications and queue (org row, members and settings stay). */
  resetOrgData(orgId: string): Promise<void>;
}
