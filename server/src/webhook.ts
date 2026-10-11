import { createHmac, timingSafeEqual } from 'node:crypto';

export type SignatureResult = { ok: true } | { ok: false; reason: string };

/**
 * Dial signs webhooks as `X-Dial-Signature: t=<unix-seconds>,v1=<hex hmac-sha256>`
 * over `${t}.${rawBody}` with the subscription's `whsec_...` secret. Verify
 * against the exact bytes received, never a re-serialized object.
 */
export function verifyDialSignature(
  rawBody: Buffer,
  header: string | undefined,
  secret: string,
  nowMs: number,
  toleranceSec = 300,
): SignatureResult {
  if (!header) return { ok: false, reason: 'missing_signature' };

  let t: string | undefined;
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === 't') t = v;
    else if (k === 'v1') v1.push(v);
  }
  if (!t || v1.length === 0) return { ok: false, reason: 'malformed_signature' };

  const ts = Number(t);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'malformed_signature' };
  if (Math.abs(nowMs / 1000 - ts) > toleranceSec) return { ok: false, reason: 'stale_timestamp' };

  const expected = createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest();
  for (const candidate of v1) {
    if (!/^[0-9a-f]+$/i.test(candidate) || candidate.length !== expected.length * 2) continue;
    if (timingSafeEqual(expected, Buffer.from(candidate, 'hex'))) return { ok: true };
  }
  return { ok: false, reason: 'bad_signature' };
}

/** Test/dev helper: produce a header Dial would send. */
export function signDialPayload(rawBody: string | Buffer, secret: string, nowMs: number): string {
  const t = Math.floor(nowMs / 1000);
  const mac = createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest('hex');
  return `t=${t},v1=${mac}`;
}
