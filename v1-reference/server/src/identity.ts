import { createHash, timingSafeEqual } from 'node:crypto';

/** E.164: "+" then 7 to 15 digits, no leading zero. Rejects unsubstituted "{{template}}" values. */
export const E164 = /^\+[1-9]\d{6,14}$/;

export interface CallerCtx {
  /** The caller's number from X-Dial-User-Number, or null if missing/invalid. */
  phone: string | null;
  direction: 'inbound' | 'outbound' | null;
  /** The Dial number that was dialed (identifies which company line this is). */
  agentNumber: string | null;
}

/**
 * Dial adds these headers to every MCP request during a call. During initial
 * tool discovery they can be absent or unsubstituted templates, so validate the
 * value, not just its presence.
 */
export function callerFromHeaders(get: (name: string) => string | undefined): CallerCtx {
  const phone = (get('x-dial-user-number') ?? '').trim();
  const dir = (get('x-dial-direction') ?? '').trim().toLowerCase();
  const agent = (get('x-dial-agent-number') ?? '').trim();
  return {
    phone: E164.test(phone) ? phone : null,
    direction: dir === 'inbound' || dir === 'outbound' ? dir : null,
    agentNumber: E164.test(agent) ? agent : null,
  };
}

export function maskPhone(phone: string, fill = '•'): string {
  if (phone.length <= 6) return phone;
  return phone.slice(0, 2) + fill.repeat(phone.length - 6) + phone.slice(-4);
}

/** Constant-time string comparison that does not leak length. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
