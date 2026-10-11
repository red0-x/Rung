import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { Store } from './store/types.js';

export const CODE_TTL_MS = 5 * 60_000;
export const VERIFIED_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 5;
const SEND_WINDOW_MS = 10 * 60_000;
const MAX_SENDS_PER_WINDOW = 3;

export class RateLimitError extends Error {
  constructor() {
    super('Too many verification codes requested for this number. Try again in a few minutes.');
  }
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'no_code' | 'expired' | 'locked' | 'wrong_code'; attemptsLeft: number };

export interface OtpService {
  /** Creates a 6-digit code for this number. The caller of this function is responsible for texting it. */
  issue(phone: string): Promise<{ code: string; expiresAt: number }>;
  verify(phone: string, input: string): Promise<VerifyResult>;
  /** True if this number passed a code check in the last 10 minutes. */
  isVerified(phone: string): Promise<boolean>;
  /** Demo-day fallback only: unexpired codes, newest first. Empty unless tracking is on. */
  demoCodes(): Array<{ phone: string; code: string; expiresAt: number }>;
}

export function createOtpService(
  store: Store,
  opts: { now?: () => number; trackDemoCodes?: boolean } = {},
): OtpService {
  const now = opts.now ?? Date.now;
  // Codes do not need to survive a restart, so the pepper is per-process.
  const pepper = randomBytes(16).toString('hex');
  const hash = (phone: string, code: string) =>
    createHash('sha256').update(`${pepper}:${phone}:${code}`).digest('hex');
  const demo = new Map<string, { code: string; expiresAt: number }>();

  return {
    async issue(phone) {
      const t = now();
      const prev = await store.getVerification(phone);
      const inWindow = !!prev && t - prev.windowStart < SEND_WINDOW_MS;
      if (prev && inWindow && prev.issueCount >= MAX_SENDS_PER_WINDOW) throw new RateLimitError();

      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const expiresAt = t + CODE_TTL_MS;
      await store.putVerification({
        phone,
        codeHash: hash(phone, code),
        expiresAt,
        attempts: 0,
        windowStart: inWindow && prev ? prev.windowStart : t,
        issueCount: inWindow && prev ? prev.issueCount + 1 : 1,
        verifiedUntil: prev?.verifiedUntil,
      });
      if (opts.trackDemoCodes) demo.set(phone, { code, expiresAt });
      return { code, expiresAt };
    },

    async verify(phone, input) {
      const t = now();
      const v = await store.getVerification(phone);
      if (!v || !v.codeHash) return { ok: false, reason: 'no_code', attemptsLeft: 0 };
      if (v.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'locked', attemptsLeft: 0 };
      if (t > v.expiresAt) return { ok: false, reason: 'expired', attemptsLeft: 0 };

      // Voice agents hear "4 8 2, 9 1 3": keep digits only.
      const digits = input.replace(/\D/g, '');
      const expected = Buffer.from(v.codeHash, 'utf8');
      const actual = Buffer.from(hash(phone, digits), 'utf8');
      const match = expected.length === actual.length && timingSafeEqual(expected, actual);

      if (match) {
        // Consume the code so it cannot be replayed.
        await store.putVerification({ ...v, codeHash: '', attempts: 0, verifiedUntil: t + VERIFIED_TTL_MS });
        demo.delete(phone);
        return { ok: true };
      }
      const attempts = v.attempts + 1;
      await store.putVerification({ ...v, attempts });
      return { ok: false, reason: 'wrong_code', attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts) };
    },

    async isVerified(phone) {
      const v = await store.getVerification(phone);
      return !!v?.verifiedUntil && v.verifiedUntil > now();
    },

    demoCodes() {
      const t = now();
      return [...demo.entries()]
        .filter(([, v]) => v.expiresAt > t)
        .map(([phone, v]) => ({ phone, ...v }))
        .sort((a, b) => b.expiresAt - a.expiresAt);
    },
  };
}
