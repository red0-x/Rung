import { beforeEach, describe, expect, it } from 'vitest';
import { RateLimitError, createOtpService, type OtpService } from '../src/otp.js';
import { createMemoryStore } from '../src/store/memory.js';

const PHONE = '+14155550123';
let t = 1_700_000_000_000;
let otp: OtpService;

beforeEach(() => {
  t = 1_700_000_000_000;
  otp = createOtpService(createMemoryStore(), { now: () => t });
});

describe('otp', () => {
  it('issues a 6-digit code and verifies it once', async () => {
    const { code } = await otp.issue(PHONE);
    expect(code).toMatch(/^\d{6}$/);
    expect(await otp.isVerified(PHONE)).toBe(false);
    expect(await otp.verify(PHONE, code)).toEqual({ ok: true });
    expect(await otp.isVerified(PHONE)).toBe(true);
    // Replay: the code was consumed.
    expect((await otp.verify(PHONE, code)).ok).toBe(false);
  });

  it('accepts digits as a voice agent hears them', async () => {
    const { code } = await otp.issue(PHONE);
    const spoken = `${code.slice(0, 3)} - ${code.slice(3)}`;
    expect((await otp.verify(PHONE, spoken)).ok).toBe(true);
  });

  it('counts wrong attempts and locks after five, even for the right code', async () => {
    const { code } = await otp.issue(PHONE);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 1; i <= 5; i++) {
      const r = await otp.verify(PHONE, wrong);
      expect(r).toMatchObject({ ok: false, reason: 'wrong_code', attemptsLeft: 5 - i });
    }
    expect(await otp.verify(PHONE, code)).toMatchObject({ ok: false, reason: 'locked' });
    expect(await otp.isVerified(PHONE)).toBe(false);
  });

  it('expires after 5 minutes', async () => {
    const { code } = await otp.issue(PHONE);
    t += 5 * 60_000 + 1;
    expect(await otp.verify(PHONE, code)).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('keeps a number verified for 10 minutes, then asks again', async () => {
    const { code } = await otp.issue(PHONE);
    await otp.verify(PHONE, code);
    t += 9 * 60_000;
    expect(await otp.isVerified(PHONE)).toBe(true);
    t += 2 * 60_000;
    expect(await otp.isVerified(PHONE)).toBe(false);
  });

  it('rate-limits sends to 3 per 10 minutes, then resets', async () => {
    await otp.issue(PHONE);
    await otp.issue(PHONE);
    await otp.issue(PHONE);
    await expect(otp.issue(PHONE)).rejects.toBeInstanceOf(RateLimitError);
    t += 10 * 60_000 + 1;
    await expect(otp.issue(PHONE)).resolves.toBeDefined();
  });

  it('a new code invalidates the previous one', async () => {
    const first = await otp.issue(PHONE);
    const second = await otp.issue(PHONE);
    if (first.code !== second.code) expect((await otp.verify(PHONE, first.code)).ok).toBe(false);
    expect((await otp.verify(PHONE, second.code)).ok).toBe(true);
  });

  it('does not let one number verify as another', async () => {
    const { code } = await otp.issue(PHONE);
    expect((await otp.verify('+14155559999', code)).ok).toBe(false);
  });
});
