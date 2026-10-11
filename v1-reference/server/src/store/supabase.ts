import { createClient } from '@supabase/supabase-js';
import type { Profile, QueueItem, QueueStatus, Verification } from '../types.js';
import type { Store } from './types.js';

/**
 * Supabase-backed store using the service-role key (server only; never ship it
 * to the browser). Tables are in supabase/schema.sql with RLS on and no
 * policies, so the anon key can read nothing.
 *
 * NOTE: type-checked but not run against a live project. Test it in the first
 * hour (npm run simulate against STORE=supabase) before relying on it.
 */

type Row = Record<string, any>;

const iso = (ms?: number | null) => (ms === undefined || ms === null ? null : new Date(ms).toISOString());
const ms = (s?: string | null) => (s ? Date.parse(s) : undefined);
const opt = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);

function rowToProfile(r: Row): Profile {
  return {
    phone: r.phone,
    name: r.name,
    consentAt: ms(r.consent_at)!,
    verifiedAt: ms(r.verified_at)!,
    createdAt: ms(r.created_at)!,
  };
}

function rowToVerification(r: Row): Verification {
  return {
    phone: r.phone,
    codeHash: r.code_hash,
    expiresAt: ms(r.expires_at)!,
    attempts: r.attempts,
    windowStart: ms(r.window_start)!,
    issueCount: r.issue_count,
    verifiedUntil: ms(r.verified_until),
  };
}

function rowToItem(r: Row): QueueItem {
  return {
    id: r.id,
    phone: r.phone,
    agentNumber: opt(r.agent_number),
    name: opt(r.name),
    intent: r.intent,
    amountUsd: r.amount_usd === null || r.amount_usd === undefined ? undefined : Number(r.amount_usd),
    summary: r.summary,
    trust: r.trust,
    status: r.status,
    createdAt: ms(r.created_at)!,
    claimedAt: ms(r.claimed_at),
    doneAt: ms(r.done_at),
    callId: opt(r.call_id),
    transcript: opt(r.transcript),
    transcriptTurns: opt(r.transcript_turns),
    durationSeconds: opt(r.duration_seconds),
  };
}

function itemToRow(p: Partial<QueueItem>): Row {
  const row: Row = {};
  if (p.id !== undefined) row.id = p.id;
  if (p.phone !== undefined) row.phone = p.phone;
  if ('agentNumber' in p) row.agent_number = p.agentNumber ?? null;
  if ('name' in p) row.name = p.name ?? null;
  if (p.intent !== undefined) row.intent = p.intent;
  if ('amountUsd' in p) row.amount_usd = p.amountUsd ?? null;
  if (p.summary !== undefined) row.summary = p.summary;
  if (p.trust !== undefined) row.trust = p.trust;
  if (p.status !== undefined) row.status = p.status;
  if (p.createdAt !== undefined) row.created_at = iso(p.createdAt);
  if ('claimedAt' in p) row.claimed_at = iso(p.claimedAt);
  if ('doneAt' in p) row.done_at = iso(p.doneAt);
  if ('callId' in p) row.call_id = p.callId ?? null;
  if ('transcript' in p) row.transcript = p.transcript ?? null;
  if ('transcriptTurns' in p) row.transcript_turns = p.transcriptTurns ?? null;
  if ('durationSeconds' in p) row.duration_seconds = p.durationSeconds ?? null;
  return row;
}

function must<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}

export function createSupabaseStore(url: string, serviceKey: string): Store {
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  return {
    kind: 'supabase',

    async getProfile(phone) {
      const r = must(await sb.from('profiles').select('*').eq('phone', phone).maybeSingle());
      return r ? rowToProfile(r) : undefined;
    },
    async upsertProfile(p) {
      const r = must(
        await sb
          .from('profiles')
          .upsert(
            {
              phone: p.phone,
              name: p.name,
              consent_at: iso(p.consentAt),
              verified_at: iso(p.verifiedAt),
              created_at: iso(p.createdAt),
            },
            { onConflict: 'phone' },
          )
          .select()
          .single(),
      );
      return rowToProfile(r);
    },
    async listProfiles() {
      const rows = must(await sb.from('profiles').select('*').order('created_at', { ascending: false }));
      return (rows ?? []).map(rowToProfile);
    },

    async getVerification(phone) {
      const r = must(await sb.from('verifications').select('*').eq('phone', phone).maybeSingle());
      return r ? rowToVerification(r) : undefined;
    },
    async putVerification(v) {
      must(
        await sb.from('verifications').upsert(
          {
            phone: v.phone,
            code_hash: v.codeHash,
            expires_at: iso(v.expiresAt),
            attempts: v.attempts,
            window_start: iso(v.windowStart),
            issue_count: v.issueCount,
            verified_until: iso(v.verifiedUntil),
          },
          { onConflict: 'phone' },
        ),
      );
    },

    async addQueueItem(item) {
      const r = must(await sb.from('queue_items').insert(itemToRow(item)).select().single());
      return rowToItem(r);
    },
    async updateQueueItem(id, patch) {
      const r = must(
        await sb.from('queue_items').update(itemToRow(patch)).eq('id', id).select().maybeSingle(),
      );
      return r ? rowToItem(r) : undefined;
    },
    async getQueueItem(id) {
      const r = must(await sb.from('queue_items').select('*').eq('id', id).maybeSingle());
      return r ? rowToItem(r) : undefined;
    },
    async findQueueItemByCallId(callId) {
      const rows = must(await sb.from('queue_items').select('*').eq('call_id', callId).limit(1));
      return rows && rows[0] ? rowToItem(rows[0]) : undefined;
    },
    async latestQueueItemForPhone(phone: string, statuses?: QueueStatus[]) {
      let q = sb.from('queue_items').select('*').eq('phone', phone);
      if (statuses) q = q.in('status', statuses);
      const rows = must(await q.order('created_at', { ascending: false }).limit(1));
      return rows && rows[0] ? rowToItem(rows[0]) : undefined;
    },
    async listQueueItems(opts) {
      let q = sb.from('queue_items').select('*');
      if (opts?.statuses) q = q.in('status', opts.statuses);
      q = q.order('created_at', { ascending: false });
      if (opts?.limit) q = q.limit(opts.limit);
      return (must(await q) ?? []).map(rowToItem);
    },

    async markEventSeen(eventId) {
      const { error } = await sb.from('seen_events').insert({ event_id: eventId });
      if (!error) return true;
      if (error.code === '23505') return false; // unique violation: already processed
      throw new Error(`Supabase: ${error.message}`);
    },

    async reset() {
      must(await sb.from('queue_items').delete().not('id', 'is', null));
      must(await sb.from('profiles').delete().not('phone', 'is', null));
      must(await sb.from('verifications').delete().not('phone', 'is', null));
      must(await sb.from('seen_events').delete().not('event_id', 'is', null));
    },
  };
}
