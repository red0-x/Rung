import { beforeEach, describe, expect, it } from 'vitest';
import { RateLimitError, createOtpService, type OtpService } from '../src/otp.js';
import { createMemoryStore } from '../src/store/memory.js';

const PHONE = '+14155550123';
const A = 'org-a';
const B = 'org-b';
let t = 1_700_000_000_000;
let otp: OtpService;

beforeEach(() => {
  t = 1_700_000_000_000;
  otp = createOtpService(createMemoryStore(), { now: () => t, trackDemoCodes: true });
});

describe('otp', () => {
  it('issues a 6-digit code and verifies it once', async () => {
    const { code } = await otp.issue(A, PHONE);
    expect(code).toMatch(/^\d{6}$/);
    expect(await otp.isVerified(A, PHONE)).toBe(false);
    expect(await otp.verify(A, PHONE, code)).toEqual({ ok: true });
    expect(await otp.isVerified(A, PHONE)).toBe(true);
    expect((await otp.verify(A, PHONE, code)).ok).toBe(false); // consumed
  });

  it('accepts digits as a voice agent hears them', async () => {
    const { code } = await otp.issue(A, PHONE);
    expect((await otp.verify(A, PHONE, `${code.slice(0, 3)} - ${code.slice(3)}`)).ok).toBe(true);
  });

  it('counts wrong attempts and locks after five, even for the right code', async () => {
    const { code } = await otp.issue(A, PHONE);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 1; i <= 5; i++) {
      expect(await otp.verify(A, PHONE, wrong)).toMatchObject({ ok: false, reason: 'wrong_code', attemptsLeft: 5 - i });
    }
    expect(await otp.verify(A, PHONE, code)).toMatchObject({ ok: false, reason: 'locked' });
    expect(await otp.isVerified(A, PHONE)).toBe(false);
  });

  it('expires after 5 minutes', async () => {
    const { code } = await otp.issue(A, PHONE);
    t += 5 * 60_000 + 1;
    expect(await otp.verify(A, PHONE, code)).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('keeps a number verified for 10 minutes, then asks again', async () => {
    const { code } = await otp.issue(A, PHONE);
    await otp.verify(A, PHONE, code);
    t += 9 * 60_000;
    expect(await otp.isVerified(A, PHONE)).toBe(true);
    t += 2 * 60_000;
    expect(await otp.isVerified(A, PHONE)).toBe(false);
  });

  it('rate-limits sends to 3 per 10 minutes, then resets', async () => {
    await otp.issue(A, PHONE);
    await otp.issue(A, PHONE);
    await otp.issue(A, PHONE);
    await expect(otp.issue(A, PHONE)).rejects.toBeInstanceOf(RateLimitError);
    t += 10 * 60_000 + 1;
    await expect(otp.issue(A, PHONE)).resolves.toBeDefined();
  });

  it('a new code invalidates the previous one', async () => {
    const first = await otp.issue(A, PHONE);
    const second = await otp.issue(A, PHONE);
    if (first.code !== second.code) expect((await otp.verify(A, PHONE, first.code)).ok).toBe(false);
    expect((await otp.verify(A, PHONE, second.code)).ok).toBe(true);
  });

  it('does not let one number verify as another', async () => {
    const { code } = await otp.issue(A, PHONE);
    expect((await otp.verify(A, '+14155559999', code)).ok).toBe(false);
  });

  it('is per org: a code or verification at one org means nothing at another', async () => {
    const { code } = await otp.issue(A, PHONE);
    expect((await otp.verify(B, PHONE, code)).ok).toBe(false);
    expect(await otp.verify(A, PHONE, code)).toEqual({ ok: true });
    expect(await otp.isVerified(B, PHONE)).toBe(false);
    // Send limits are per org too.
    for (let i = 0; i < 2; i++) await otp.issue(A, PHONE);
    await expect(otp.issue(A, PHONE)).rejects.toBeInstanceOf(RateLimitError);
    await expect(otp.issue(B, PHONE)).resolves.toBeDefined();
    expect(otp.demoCodes(B)).toHaveLength(1);
    expect(otp.demoCodes(A).every((c) => c.phone === PHONE)).toBe(true);
  });
});
