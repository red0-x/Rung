import { describe, expect, it } from 'vitest';
import { signDialPayload, verifyDialSignature } from '../src/webhook.js';

const SECRET = 'whsec_abc123';
const NOW = 1_700_000_000_000;
const body = JSON.stringify({ id: 'evt_1', type: 'call.ended', data: { callId: 'call_1' } });

describe('verifyDialSignature', () => {
  it('accepts a correctly signed body', () => {
    const header = signDialPayload(body, SECRET, NOW);
    expect(verifyDialSignature(Buffer.from(body), header, SECRET, NOW)).toEqual({ ok: true });
  });

  it('rejects a tampered body, a wrong secret, and a missing header', () => {
    const header = signDialPayload(body, SECRET, NOW);
    expect(verifyDialSignature(Buffer.from(body + ' '), header, SECRET, NOW)).toMatchObject({ ok: false, reason: 'bad_signature' });
    expect(verifyDialSignature(Buffer.from(body), header, 'whsec_other', NOW)).toMatchObject({ ok: false, reason: 'bad_signature' });
    expect(verifyDialSignature(Buffer.from(body), undefined, SECRET, NOW)).toMatchObject({ ok: false, reason: 'missing_signature' });
  });

  it('rejects replays older than 5 minutes (and from the future)', () => {
    const header = signDialPayload(body, SECRET, NOW);
    expect(verifyDialSignature(Buffer.from(body), header, SECRET, NOW + 4 * 60_000)).toEqual({ ok: true });
    expect(verifyDialSignature(Buffer.from(body), header, SECRET, NOW + 6 * 60_000)).toMatchObject({ reason: 'stale_timestamp' });
    expect(verifyDialSignature(Buffer.from(body), header, SECRET, NOW - 6 * 60_000)).toMatchObject({ reason: 'stale_timestamp' });
  });

  it('rejects malformed headers without throwing', () => {
    for (const h of ['garbage', 't=abc,v1=00', 't=1700000000', 'v1=00', 't=1700000000,v1=zz']) {
      expect(verifyDialSignature(Buffer.from(body), h, SECRET, NOW)).toMatchObject({ ok: false });
    }
  });

  it('accepts any matching v1 when several are present (secret rotation)', () => {
    const good = signDialPayload(body, SECRET, NOW);
    const withOld = `${good},v1=${'0'.repeat(64)}`;
    expect(verifyDialSignature(Buffer.from(body), withOld, SECRET, NOW)).toEqual({ ok: true });
  });
});
