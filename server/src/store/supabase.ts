import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalizeSettings } from '../settings.js';
import type { LiveCall, Org, OrgMember, Profile, QueueItem, QueueStatus, Verification } from '../types.js';
import type { Store } from './types.js';

/**
 * Supabase-backed store using the service-role key (server only; never ship it
 * to the browser). Tables come from supabase/migrations with RLS on and no
 * policies, so the anon key can read nothing.
 */

type Row = Record<string, any>;

const iso = (ms?: number | null) => (ms === undefined || ms === null ? null : new Date(ms).toISOString());
const ms = (s?: string | null) => (s ? Date.parse(s) : undefined);
const opt = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);

function rowToOrg(r: Row): Org {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    mcpToken: r.mcp_token,
    dialNumber: r.dial_number ?? null,
    dialNumberId: r.dial_number_id ?? null,
    settings: normalizeSettings(r.settings, r.name),
    publishedAt: ms(r.published_at) ?? null,
    createdAt: ms(r.created_at)!,
  };
}

function orgToRow(p: Partial<Org>): Row {
  const row: Row = {};
  if (p.id !== undefined) row.id = p.id;
  if (p.name !== undefined) row.name = p.name;
  if (p.slug !== undefined) row.slug = p.slug;
  if (p.mcpToken !== undefined) row.mcp_token = p.mcpToken;
  if ('dialNumber' in p) row.dial_number = p.dialNumber ?? null;
  if ('dialNumberId' in p) row.dial_number_id = p.dialNumberId ?? null;
  if (p.settings !== undefined) row.settings = p.settings;
  if ('publishedAt' in p) row.published_at = iso(p.publishedAt);
  if (p.createdAt !== undefined) row.created_at = iso(p.createdAt);
  return row;
}

function rowToProfile(r: Row): Profile {
  return {
    orgId: r.org_id,
    phone: r.phone,
    name: r.name,
    consentAt: ms(r.consent_at)!,
    verifiedAt: ms(r.verified_at),
    facts: r.facts && typeof r.facts === 'object' && Object.keys(r.facts).length ? r.facts : undefined,
    factsUpdatedAt: ms(r.facts_updated_at),
    createdAt: ms(r.created_at)!,
  };
}

function rowToLiveCall(r: Row): LiveCall {
  return {
    orgId: r.org_id,
    phone: r.phone,
    known: !!r.known,
    name: opt(r.name),
    stage: r.stage,
    startedAt: ms(r.started_at)!,
    updatedAt: ms(r.updated_at)!,
    queuedAt: ms(r.queued_at),
  };
}

function rowToVerification(r: Row): Verification {
  return {
    orgId: r.org_id,
    phone: r.phone,
    codeHash: r.code_hash,
    expiresAt: ms(r.expires_at)!,
    attempts: r.attempts,
    windowStart: ms(r.window_start)!,
    issueCount: r.issue_count,
    verifiedUntil: ms(r.verified_until),
  };
}

function rowToMember(r: Row): OrgMember {
  return { orgId: r.org_id, userId: r.user_id, role: r.role, name: opt(r.name), lastSeenAt: ms(r.last_seen_at) };
}

function rowToItem(r: Row): QueueItem {
  return {
    id: r.id,
    orgId: r.org_id,
    phone: r.phone,
    agentNumber: opt(r.agent_number),
    name: opt(r.name),
    intent: r.intent,
    amountUsd: r.amount_usd === null || r.amount_usd === undefined ? undefined : Number(r.amount_usd),
    summary: r.summary,
    trust: r.trust,
    returning: !!r.is_returning,
    status: r.status,
    createdAt: ms(r.created_at)!,
    claimedAt: ms(r.claimed_at),
    claimedBy: opt(r.claimed_by),
    claimedByName: opt(r.claimed_by_name),
    doneAt: ms(r.done_at),
    callId: opt(r.call_id),
    transcript: opt(r.transcript),
    transcriptTurns: opt(r.transcript_turns),
    durationSeconds: opt(r.duration_seconds),
    etaMinutes: opt(r.eta_minutes),
    etaAt: ms(r.eta_at),
    smsStatus: opt(r.sms_status),
    smsSentAt: ms(r.sms_sent_at),
    smsError: opt(r.sms_error),
  };
}

function itemToRow(p: Partial<QueueItem>): Row {
  const row: Row = {};
  if (p.id !== undefined) row.id = p.id;
  if (p.orgId !== undefined) row.org_id = p.orgId;
  if (p.phone !== undefined) row.phone = p.phone;
  if ('agentNumber' in p) row.agent_number = p.agentNumber ?? null;
  if ('name' in p) row.name = p.name ?? null;
  if (p.intent !== undefined) row.intent = p.intent;
  if ('amountUsd' in p) row.amount_usd = p.amountUsd ?? null;
  if (p.summary !== undefined) row.summary = p.summary;
  if (p.trust !== undefined) row.trust = p.trust;
  if (p.returning !== undefined) row.is_returning = p.returning;
  if (p.status !== undefined) row.status = p.status;
  if (p.createdAt !== undefined) row.created_at = iso(p.createdAt);
  if ('claimedAt' in p) row.claimed_at = iso(p.claimedAt);
  if ('claimedBy' in p) row.claimed_by = p.claimedBy ?? null;
  if ('claimedByName' in p) row.claimed_by_name = p.claimedByName ?? null;
  if ('doneAt' in p) row.done_at = iso(p.doneAt);
  if ('callId' in p) row.call_id = p.callId ?? null;
  if ('transcript' in p) row.transcript = p.transcript ?? null;
  if ('transcriptTurns' in p) row.transcript_turns = p.transcriptTurns ?? null;
  if ('durationSeconds' in p) row.duration_seconds = p.durationSeconds ?? null;
  if ('etaMinutes' in p) row.eta_minutes = p.etaMinutes ?? null;
  if ('etaAt' in p) row.eta_at = iso(p.etaAt);
  if ('smsStatus' in p) row.sms_status = p.smsStatus ?? null;
  if ('smsSentAt' in p) row.sms_sent_at = iso(p.smsSentAt);
  if ('smsError' in p) row.sms_error = p.smsError ?? null;
  return row;
}

function must<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}

export function createSupabaseClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function createSupabaseStore(sb: SupabaseClient): Store {
  const oneOrg = async (col: string, value: string) => {
    const r = must(await sb.from('orgs').select('*').eq(col, value).maybeSingle());
    return r ? rowToOrg(r) : undefined;
  };

  return {
    kind: 'supabase',

    getOrg: (id) => oneOrg('id', id),
    getOrgBySlug: (slug) => oneOrg('slug', slug),
    getOrgByMcpToken: (token) => oneOrg('mcp_token', token),
    getOrgByDialNumber: (number) => oneOrg('dial_number', number),
    async listOrgs() {
      const rows = must(await sb.from('orgs').select('*').order('created_at', { ascending: true }));
      return (rows ?? []).map(rowToOrg);
    },
    async createOrg(org) {
      return rowToOrg(must(await sb.from('orgs').insert(orgToRow(org)).select().single())!);
    },
    async updateOrg(id, patch) {
      const r = must(await sb.from('orgs').update(orgToRow(patch)).eq('id', id).select().maybeSingle());
      return r ? rowToOrg(r) : undefined;
    },

    async listMemberships(userId) {
      const rows = must(await sb.from('org_members').select('*').eq('user_id', userId).order('created_at', { ascending: true }));
      return (rows ?? []).map(rowToMember);
    },
    async addInvite(inv) {
      must(
        await sb
          .from('org_invites')
          .upsert(
            { org_id: inv.orgId, email: inv.email.toLowerCase(), role: inv.role, created_at: iso(inv.createdAt) },
            { onConflict: 'org_id,email', ignoreDuplicates: true },
          ),
      );
    },
    async listInvitesForEmail(email) {
      const rows = must(await sb.from('org_invites').select('*').eq('email', email.toLowerCase()));
      return (rows ?? []).map((r: Row) => ({ orgId: r.org_id, email: r.email, role: r.role, createdAt: ms(r.created_at)! }));
    },
    async listMembers(orgId) {
      return (must(await sb.from('org_members').select('*').eq('org_id', orgId)) ?? []).map(rowToMember);
    },
    async touchMember(orgId, userId, at, name) {
      must(await sb.from('org_members').update({ last_seen_at: iso(at), name }).eq('org_id', orgId).eq('user_id', userId));
    },
    async addMember(m) {
      must(
        await sb
          .from('org_members')
          .upsert({ org_id: m.orgId, user_id: m.userId, role: m.role }, { onConflict: 'org_id,user_id', ignoreDuplicates: true }),
      );
    },

    async getProfile(orgId, phone) {
      const r = must(await sb.from('profiles').select('*').eq('org_id', orgId).eq('phone', phone).maybeSingle());
      return r ? rowToProfile(r) : undefined;
    },
    async upsertProfile(p) {
      const existing = must(
        await sb.from('profiles').select('created_at').eq('org_id', p.orgId).eq('phone', p.phone).maybeSingle(),
      );
      // Columns left out of the payload keep their stored value, so re-saving never wipes facts.
      const row: Row = {
        org_id: p.orgId,
        phone: p.phone,
        name: p.name,
        consent_at: iso(p.consentAt),
        verified_at: iso(p.verifiedAt),
        created_at: existing?.created_at ?? iso(p.createdAt),
      };
      if (p.facts) {
        row.facts = p.facts;
        row.facts_updated_at = iso(p.factsUpdatedAt ?? Date.now());
      }
      const r = must(
        await sb
          .from('profiles')
          .upsert(row, { onConflict: 'org_id,phone' })
          .select()
          .single(),
      );
      return rowToProfile(r);
    },
    async listProfiles(orgId) {
      const rows = must(await sb.from('profiles').select('*').eq('org_id', orgId).order('created_at', { ascending: false }));
      return (rows ?? []).map(rowToProfile);
    },

    async getVerification(orgId, phone) {
      const r = must(await sb.from('verifications').select('*').eq('org_id', orgId).eq('phone', phone).maybeSingle());
      return r ? rowToVerification(r) : undefined;
    },
    async putVerification(v) {
      must(
        await sb.from('verifications').upsert(
          {
            org_id: v.orgId,
            phone: v.phone,
            code_hash: v.codeHash,
            expires_at: iso(v.expiresAt),
            attempts: v.attempts,
            window_start: iso(v.windowStart),
            issue_count: v.issueCount,
            verified_until: iso(v.verifiedUntil),
          },
          { onConflict: 'org_id,phone' },
        ),
      );
    },

    async addQueueItem(item) {
      const r = must(await sb.from('queue_items').upsert(itemToRow(item), { onConflict: 'id' }).select().single());
      return rowToItem(r);
    },
    async updateQueueItem(id, patch) {
      const r = must(await sb.from('queue_items').update(itemToRow(patch)).eq('id', id).select().maybeSingle());
      return r ? rowToItem(r) : undefined;
    },
    async updateQueueItemIf(id, status, patch) {
      // One conditional UPDATE: Postgres row locking makes this the tie-breaker when two reps click at once.
      const r = must(
        await sb.from('queue_items').update(itemToRow(patch)).eq('id', id).eq('status', status).select().maybeSingle(),
      );
      return r ? rowToItem(r) : undefined;
    },
    async getQueueItem(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined; // not a uuid: Postgres would error
      const r = must(await sb.from('queue_items').select('*').eq('id', id).maybeSingle());
      return r ? rowToItem(r) : undefined;
    },
    async findQueueItemByCallId(callId) {
      const rows = must(await sb.from('queue_items').select('*').eq('call_id', callId).limit(1));
      return rows && rows[0] ? rowToItem(rows[0]) : undefined;
    },
    async latestQueueItemForPhone(orgId, phone, statuses?: QueueStatus[]) {
      let q = sb.from('queue_items').select('*').eq('org_id', orgId).eq('phone', phone);
      if (statuses) q = q.in('status', statuses);
      const rows = must(await q.order('created_at', { ascending: false }).limit(1));
      return rows && rows[0] ? rowToItem(rows[0]) : undefined;
    },
    async phoneHistory(orgId, phone, limit) {
      const res = await sb
        .from('queue_items')
        .select('*', { count: 'exact' })
        .eq('org_id', orgId)
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (res.error) throw new Error(`Supabase: ${res.error.message}`);
      return { items: (res.data ?? []).map(rowToItem), total: res.count ?? res.data?.length ?? 0 };
    },
    async listQueueItems(orgId, opts) {
      let q = sb.from('queue_items').select('*').eq('org_id', orgId);
      if (opts?.statuses) q = q.in('status', opts.statuses);
      if (opts?.since !== undefined) q = q.gte('created_at', iso(opts.since));
      if (opts?.orderBy === 'doneAt') q = q.order('done_at', { ascending: false, nullsFirst: false });
      q = q.order('created_at', { ascending: false });
      if (opts?.limit) q = q.limit(opts.limit);
      return (must(await q) ?? []).map(rowToItem);
    },

    async startLiveCall(c) {
      must(
        await sb.from('live_calls').upsert(
          {
            org_id: c.orgId,
            phone: c.phone,
            known: c.known,
            name: c.name ?? null,
            stage: c.stage,
            started_at: iso(c.startedAt),
            updated_at: iso(c.updatedAt),
            queued_at: iso(c.queuedAt),
          },
          { onConflict: 'org_id,phone' },
        ),
      );
    },
    async updateLiveCall(orgId, phone, p) {
      const row: Row = {};
      if (p.stage !== undefined) row.stage = p.stage;
      if (p.name !== undefined) row.name = p.name;
      if (p.updatedAt !== undefined) row.updated_at = iso(p.updatedAt);
      if (p.queuedAt !== undefined) row.queued_at = iso(p.queuedAt);
      must(await sb.from('live_calls').update(row).eq('org_id', orgId).eq('phone', phone).is('queued_at', null));
    },
    async endLiveCall(orgId, phone) {
      must(await sb.from('live_calls').delete().eq('org_id', orgId).eq('phone', phone));
    },
    async listLiveCalls(orgId, activeSince, queuedSince) {
      const rows = must(
        await sb
          .from('live_calls')
          .select('*')
          .eq('org_id', orgId)
          .or(`and(queued_at.is.null,updated_at.gte.${iso(activeSince)}),queued_at.gte.${iso(queuedSince)}`)
          .order('started_at', { ascending: true }),
      );
      return (rows ?? []).map(rowToLiveCall);
    },

    async markEventSeen(eventId) {
      const { error } = await sb.from('seen_events').insert({ event_id: eventId });
      if (!error) return true;
      if (error.code === '23505') return false; // unique violation: already processed
      throw new Error(`Supabase: ${error.message}`);
    },

    async forgetCaller(orgId, phone) {
      const [p, v, l, q] = await Promise.all([
        sb.from('profiles').delete().eq('org_id', orgId).eq('phone', phone).select('phone'),
        sb.from('verifications').delete().eq('org_id', orgId).eq('phone', phone),
        sb.from('live_calls').delete().eq('org_id', orgId).eq('phone', phone),
        sb.from('queue_items').delete().eq('org_id', orgId).eq('phone', phone).select('id'),
      ]);
      must(v);
      must(l);
      return { profile: (must(p) ?? []).length > 0, items: (must(q) ?? []).length };
    },

    async resetOrgData(orgId) {
      must(await sb.from('queue_items').delete().eq('org_id', orgId));
      must(await sb.from('verifications').delete().eq('org_id', orgId));
      must(await sb.from('profiles').delete().eq('org_id', orgId));
      must(await sb.from('live_calls').delete().eq('org_id', orgId));
    },
  };
}
