import type { Profile, QueueItem, QueueStatus, Verification } from '../types.js';
import type { Store } from './types.js';

export function createMemoryStore(): Store {
  let profiles = new Map<string, Profile>();
  let verifications = new Map<string, Verification>();
  let items = new Map<string, QueueItem>();
  let seen = new Set<string>();

  const newestFirst = (a: QueueItem, b: QueueItem) => b.createdAt - a.createdAt;
  const matches = (i: QueueItem, statuses?: QueueStatus[]) => !statuses || statuses.includes(i.status);

  return {
    kind: 'memory',

    async getProfile(phone) {
      return profiles.get(phone);
    },
    async upsertProfile(p) {
      const prev = profiles.get(p.phone);
      const next = { ...p, createdAt: prev?.createdAt ?? p.createdAt };
      profiles.set(p.phone, next);
      return next;
    },
    async listProfiles() {
      return [...profiles.values()].sort((a, b) => b.createdAt - a.createdAt);
    },

    async getVerification(phone) {
      return verifications.get(phone);
    },
    async putVerification(v) {
      verifications.set(v.phone, v);
    },

    async addQueueItem(item) {
      items.set(item.id, item);
      return item;
    },
    async updateQueueItem(id, patch) {
      const cur = items.get(id);
      if (!cur) return undefined;
      const next = { ...cur, ...patch };
      items.set(id, next);
      return next;
    },
    async getQueueItem(id) {
      return items.get(id);
    },
    async findQueueItemByCallId(callId) {
      for (const i of items.values()) if (i.callId === callId) return i;
      return undefined;
    },
    async latestQueueItemForPhone(phone, statuses) {
      return [...items.values()]
        .filter((i) => i.phone === phone && matches(i, statuses))
        .sort(newestFirst)[0];
    },
    async listQueueItems(opts) {
      const list = [...items.values()].filter((i) => matches(i, opts?.statuses)).sort(newestFirst);
      return opts?.limit ? list.slice(0, opts.limit) : list;
    },

    async markEventSeen(eventId) {
      if (seen.has(eventId)) return false;
      seen.add(eventId);
      return true;
    },

    async reset() {
      profiles = new Map();
      verifications = new Map();
      items = new Map();
      seen = new Set();
    },
  };
}
