import type { SupabaseClient } from '@supabase/supabase-js';
import type { Config } from './config.js';
import { stableUuid } from './identity.js';

export interface AuthUser {
  id: string;
  email: string;
}

export interface Auth {
  /** Resolve a bearer token to a user, or null. */
  verify(token: string): Promise<AuthUser | null>;
  /** User id for an email (seeding + dev tokens). Synthetic in memory mode, real auth.users id in Supabase mode. */
  userIdForEmail(email: string): Promise<string | undefined>;
}

/** Deterministic fake user id for memory mode, so dev tokens and seeded members agree across restarts. */
export const syntheticUserId = (email: string) => stableUuid(`rung-dev-user:${email.toLowerCase()}`);

export function createAuth(cfg: Config, sb: SupabaseClient | null): Auth {
  const useRealUsers = cfg.store === 'supabase' && !!sb;
  const idCache = new Map<string, string>();

  async function lookupRealUserId(email: string): Promise<string | undefined> {
    const e = email.toLowerCase();
    const cached = idCache.get(e);
    if (cached) return cached;
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await sb!.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(`Supabase admin listUsers: ${error.message}`);
      const hit = data.users.find((u) => u.email?.toLowerCase() === e);
      if (hit) {
        idCache.set(e, hit.id);
        return hit.id;
      }
      if (data.users.length < 200) break;
    }
    return undefined;
  }

  const userIdForEmail = (email: string) =>
    useRealUsers ? lookupRealUserId(email) : Promise.resolve(syntheticUserId(email));

  return {
    userIdForEmail,
    async verify(token) {
      if (!token) return null;
      if (token.startsWith('dev:')) {
        if (!cfg.enableDev) return null;
        const email = token.slice(4).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+$/.test(email)) return null;
        const id = await userIdForEmail(email);
        return id ? { id, email } : null;
      }
      if (!sb) return null;
      const { data, error } = await sb.auth.getUser(token);
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email ?? '' };
    },
  };
}
