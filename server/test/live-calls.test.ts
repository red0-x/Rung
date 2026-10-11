import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSimCall } from '../src/sim/client.js';
import { signDialPayload } from '../src/webhook.js';
import { MARIA, NEW_CALLER, WEBHOOK_SECRET, boot, waitFor, type Harness } from './helpers.js';

let h: Harness;
beforeEach(async () => {
  h = await boot({ REQUIRE_VERIFICATION: 'true' });
});
afterEach(() => h.close());

const live = async () => (await h.api('/queue')).body.live as any[];

describe('GET /api/queue live calls (on the line now)', () => {
  it('shows a call from lookup_caller through verification, then hands it to the queue', async () => {
    const c = await openSimCall({ baseUrl: h.base, phone: NEW_CALLER, orgToken: h.bank.mcpToken });
    await c.call('lookup_caller', {});
    expect(await live()).toMatchObject([{ known: false, name: null, stage: 'listening', queuedAt: null }]);
    expect((await live())[0].phoneMasked).not.toContain('555011');

    await c.call('send_code', {});
    expect((await live())[0].stage).toBe('verifying');

    await c.call('triage_call', { intent: 'dispute', summary: 'Charged twice.', caller_name: 'Ana Ruiz' });
    expect(await live()).toMatchObject([{ stage: 'queued', name: 'Ana Ruiz' }]);
    expect((await h.api('/queue')).body.queued).toHaveLength(1);

    // Tools after triage don't pull it back out of the queue.
    await c.call('update_profile', { occupation: 'nurse' }).catch(() => {});
    expect((await live())[0].stage).toBe('queued');
    await c.close();
    h.advanceMin(1);
    expect(await live()).toEqual([]);
  });

  it('a returning caller shows their name; other orgs never see it', async () => {
    const c = await openSimCall({ baseUrl: h.base, phone: MARIA, orgToken: h.bank.mcpToken });
    await c.call('lookup_caller', {});
    await c.close();
    expect(await live()).toMatchObject([{ known: true, name: 'Maria Alvarez' }]);
    expect((await h.api('/queue', { as: 'clinic@test.rung' })).body.live).toEqual([]);
  });

  it('call.ended clears a call that hung up before triage; silent calls expire', async () => {
    await h.store.updateOrg(h.bank.id, { dialNumber: '+15550000001' });
    const c = await openSimCall({ baseUrl: h.base, phone: NEW_CALLER, orgToken: h.bank.mcpToken });
    await c.call('lookup_caller', {});
    await c.close();
    const raw = JSON.stringify({
      id: 'evt_end_live',
      type: 'call.ended',
      createdAt: new Date(h.clock.t).toISOString(),
      data: { callId: 'call_live', from: NEW_CALLER, to: '+15550000001', direction: 'inbound', durationSeconds: 20 },
    });
    await fetch(`${h.base}/webhooks/dial`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dial-signature': signDialPayload(raw, WEBHOOK_SECRET, h.clock.t) },
      body: raw,
    });
    await waitFor(async () => (await live()).length === 0);

    const c2 = await openSimCall({ baseUrl: h.base, phone: MARIA, orgToken: h.bank.mcpToken });
    await c2.call('lookup_caller', {});
    await c2.close();
    h.advanceMin(16);
    expect(await live()).toEqual([]);
  });
});
