import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSimCall } from '../src/sim/client.js';
import { JAMES, MARIA, NEW_CALLER, boot, type Harness } from './helpers.js';

// Default mode (REQUIRE_VERIFICATION unset/false): no texted codes anywhere.
let h: Harness;
beforeEach(async () => {
  h = await boot({ REQUIRE_VERIFICATION: 'false' });
});
afterEach(() => h.close());

const as = (phone: string) => openSimCall({ baseUrl: h.base, phone, orgToken: h.bank.mcpToken });

describe('verification off', () => {
  it('does not list send_code or check_code', async () => {
    const call = await as(NEW_CALLER);
    expect((await call.tools()).sort()).toEqual(['lookup_caller', 'save_profile', 'triage_call', 'update_profile']);
    const r = await call.call('send_code').catch((e: Error) => ({ isError: true, data: e.message }));
    expect(r.isError).toBe(true);
    await call.close();
    expect(h.dial.sent).toHaveLength(0);
  });

  it('saves a profile with consent only, which is recognized but never verified', async () => {
    const call = await as(NEW_CALLER);
    expect((await call.call('save_profile', { name: 'Sam Okafor', consent: false })).data.error).toBe('consent_required');
    expect((await call.call('save_profile', { name: 'Sam Okafor', consent: true })).data).toMatchObject({ saved: true, name: 'Sam Okafor' });
    expect((await call.call('lookup_caller')).data).toMatchObject({ known: true, first_name: 'Sam' });
    await call.call('triage_call', { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 charge.' });
    await call.close();
    const profiles = (await h.api('/profiles')).body.profiles;
    expect(profiles.find((p: any) => p.name === 'Sam Okafor')).toMatchObject({ verified: false });
    expect((await h.api('/queue')).body.queued[0]).toMatchObject({ name: 'Sam Okafor', trust: 'recognized' });
  });

  it('queues sensitive intents without a code; trust is recognized or new', async () => {
    const known = await as(JAMES);
    const r = await known.call('triage_call', { intent: 'money_movement', amount_usd: 9000, summary: 'Wants to wire $9,000 to a contractor.' });
    expect(r.isError).toBe(false);
    expect(r.data.queued).toBe(true);
    await known.close();
    const stranger = await as(NEW_CALLER);
    expect((await stranger.call('triage_call', { intent: 'account_change', summary: 'Wants to change the mailing address.' })).data.queued).toBe(true);
    await stranger.close();
    const q = (await h.api('/queue')).body.queued;
    expect(q.map((i: any) => [i.intent, i.trust]).sort()).toEqual([
      ['account_change', 'new'],
      ['money_movement', 'recognized'],
    ]);
  });

  it('still ranks the demo calls fraud 116 > $10M 60 > $12 20', async () => {
    for (const [phone, args] of [
      [NEW_CALLER, { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 charge.', caller_name: 'Sam' }],
      [JAMES, { intent: 'account_opening', amount_usd: 10_000_000, summary: 'Opening a $10M account.' }],
      [MARIA, { intent: 'fraud_in_progress', amount_usd: 4200, summary: 'Charges happening now.' }],
    ] as const) {
      const c = await as(phone);
      await c.call('triage_call', { ...args });
      await c.close();
    }
    const q = (await h.api('/queue')).body.queued;
    expect(q.map((i: any) => i.score.total)).toEqual([116, 60, 20]);
    expect(q[0]).toMatchObject({ name: 'Maria Alvarez', trust: 'recognized' });
  });

  it('hides codes: /api/dev/codes 404s and /api/me reports requireVerification=false', async () => {
    expect((await h.api('/dev/codes')).status).toBe(404);
    expect((await h.api('/me')).body.platform).toEqual({ dial: 'mock', demoShowCodes: false, enableDev: true, requireVerification: false });
  });

  it('publishes a prompt with no code steps', async () => {
    await h.api('/org/number', { body: { numberId: 'mock_num_1' } });
    const pub = await h.api('/org/publish', { method: 'POST' });
    expect(pub.body.request.body.inboundInstruction).not.toMatch(/send_code|check_code|six-digit/);
    expect((await h.api('/prompt-preview')).body.prompt).not.toMatch(/send_code/);
  });
});
