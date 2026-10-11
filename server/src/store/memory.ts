import type { LiveCall, Org, OrgInvite, OrgMember, Profile, QueueItem, QueueStatus, Verification } from '../types.js';
import type { Store } from './types.js';

const key = (orgId: string, phone: string) => `${orgId}:${phone}`;
const clone = <T>(v: T): T => structuredClone(v);

export function createMemoryStore(): Store {
  const orgs = new Map<string, Org>();
  const members: OrgMember[] = [];
  const invites: OrgInvite[] = [];
  const profiles = new Map<string, Profile>();
  const verifications = new Map<string, Verification>();
  const items = new Map<string, QueueItem>();
  const seen = new Set<string>();
  const live = new Map<string, LiveCall>();

  const newestFirst = (a: QueueItem, b: QueueItem) => b.createdAt - a.createdAt;
  const matches = (i: QueueItem, statuses?: QueueStatus[]) => !statuses || statuses.includes(i.status);
  const findOrg = (pred: (o: Org) => boolean) => {
    for (const o of orgs.values()) if (pred(o)) return clone(o);
    return undefined;
  };

  return {
    kind: 'memory',

    async getOrg(id) {
      const o = orgs.get(id);
      return o ? clone(o) : undefined;
    },
    async getOrgBySlug(slug) {
      return findOrg((o) => o.slug === slug);
    },
    async getOrgByMcpToken(token) {
      return findOrg((o) => o.mcpToken === token);
    },
    async getOrgByDialNumber(number) {
      return findOrg((o) => o.dialNumber === number);
    },
    async listOrgs() {
      return [...orgs.values()].map(clone).sort((a, b) => a.createdAt - b.createdAt);
    },
    async createOrg(org) {
      for (const o of orgs.values()) {
        if (o.slug === org.slug || o.mcpToken === org.mcpToken) throw new Error('org already exists');
      }
      orgs.set(org.id, clone(org));
      return clone(org);
    },
    async updateOrg(id, patch) {
      const cur = orgs.get(id);
      if (!cur) return undefined;
      if (patch.dialNumber) {
        for (const o of orgs.values()) {
          if (o.id !== id && o.dialNumber === patch.dialNumber) throw new Error('dial number already claimed');
        }
      }
      const next = { ...cur, ...clone(patch) };
      orgs.set(id, next);
      return clone(next);
    },

    async listMemberships(userId) {
      return members.filter((x) => x.userId === userId).map((m) => ({ ...m }));
    },
    async addMember(member) {
      if (!members.some((m) => m.orgId === member.orgId && m.userId === member.userId)) members.push({ ...member });
    },
    async addInvite(inv) {
      const email = inv.email.toLowerCase();
      if (!invites.some((i) => i.orgId === inv.orgId && i.email === email)) invites.push({ ...inv, email });
    },
    async listInvitesForEmail(email) {
      return invites.filter((i) => i.email === email.toLowerCase()).map((i) => ({ ...i }));
    },
    async listMembers(orgId) {
      return members.filter((m) => m.orgId === orgId).map((m) => ({ ...m }));
    },
    async touchMember(orgId, userId, at, name) {
      const m = members.find((x) => x.orgId === orgId && x.userId === userId);
      if (m) Object.assign(m, { lastSeenAt: at, name });
    },

    async getProfile(orgId, phone) {
      const p = profiles.get(key(orgId, phone));
      return p ? clone(p) : undefined;
    },
    async upsertProfile(p) {
      const prev = profiles.get(key(p.orgId, p.phone));
      // Re-saving a profile (new name, new consent) must never wipe the facts collected so far.
      const next = { ...p, createdAt: prev?.createdAt ?? p.createdAt, facts: p.facts ?? prev?.facts, factsUpdatedAt: p.factsUpdatedAt ?? prev?.factsUpdatedAt };
      profiles.set(key(p.orgId, p.phone), next);
      return clone(next);
    },
    async listProfiles(orgId) {
      return [...profiles.values()]
        .filter((p) => p.orgId === orgId)
        .map(clone)
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    async getVerification(orgId, phone) {
      const v = verifications.get(key(orgId, phone));
      return v ? clone(v) : undefined;
    },
    async putVerification(v) {
      verifications.set(key(v.orgId, v.phone), clone(v));
    },

    async addQueueItem(item) {
      items.set(item.id, clone(item));
      return clone(item);
    },
    async updateQueueItem(id, patch) {
      const cur = items.get(id);
      if (!cur) return undefined;
      const next = { ...cur, ...clone(patch) };
      items.set(id, next);
      return clone(next);
    },
    async updateQueueItemIf(id, status, patch) {
      const cur = items.get(id);
      if (!cur || cur.status !== status) return undefined;
      const next = { ...cur, ...clone(patch) };
      items.set(id, next);
      return clone(next);
    },
    async getQueueItem(id) {
      const i = items.get(id);
      return i ? clone(i) : undefined;
    },
    async findQueueItemByCallId(callId) {
      for (const i of items.values()) if (i.callId === callId) return clone(i);
      return undefined;
    },
    async latestQueueItemForPhone(orgId, phone, statuses) {
      const found = [...items.values()]
        .filter((i) => i.orgId === orgId && i.phone === phone && matches(i, statuses))
        .sort(newestFirst)[0];
      return found ? clone(found) : undefined;
    },
    async phoneHistory(orgId, phone, limit) {
      const all = [...items.values()].filter((i) => i.orgId === orgId && i.phone === phone).sort(newestFirst);
      return { items: all.slice(0, limit).map(clone), total: all.length };
    },
    async listQueueItems(orgId, opts) {
      const list = [...items.values()]
        .filter((i) => i.orgId === orgId && matches(i, opts?.statuses) && (opts?.since === undefined || i.createdAt >= opts.since))
        .sort(opts?.orderBy === 'doneAt' ? (a, b) => (b.doneAt ?? -Infinity) - (a.doneAt ?? -Infinity) || newestFirst(a, b) : newestFirst)
        .map(clone);
      return opts?.limit ? list.slice(0, opts.limit) : list;
    },

    async startLiveCall(call) {
      live.set(key(call.orgId, call.phone), clone(call));
    },
    async updateLiveCall(orgId, phone, patch) {
      const cur = live.get(key(orgId, phone));
      if (cur && cur.queuedAt === undefined) live.set(key(orgId, phone), { ...cur, ...clone(patch) });
    },
    async endLiveCall(orgId, phone) {
      live.delete(key(orgId, phone));
    },
    async listLiveCalls(orgId, activeSince, queuedSince) {
      return [...live.values()]
        .filter((c) => c.orgId === orgId && (c.queuedAt === undefined ? c.updatedAt >= activeSince : c.queuedAt >= queuedSince))
        .sort((a, b) => a.startedAt - b.startedAt)
        .map(clone);
    },

    async markEventSeen(eventId) {
      if (seen.has(eventId)) return false;
      seen.add(eventId);
      return true;
    },

    async forgetCaller(orgId, phone) {
      const profile = profiles.delete(key(orgId, phone));
      verifications.delete(key(orgId, phone));
      live.delete(key(orgId, phone));
      let n = 0;
      for (const [k, i] of items) if (i.orgId === orgId && i.phone === phone && items.delete(k)) n++;
      return { profile, items: n };
    },

    async resetOrgData(orgId) {
      for (const [k, p] of profiles) if (p.orgId === orgId) profiles.delete(k);
      for (const [k, v] of verifications) if (v.orgId === orgId) verifications.delete(k);
      for (const [k, i] of items) if (i.orgId === orgId) items.delete(k);
      for (const [k, c] of live) if (c.orgId === orgId) live.delete(k);
    },
  };
}
