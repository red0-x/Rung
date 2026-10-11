import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { syntheticUserId } from '../src/auth.js';
import { repName } from '../src/reps.js';
import { openSimCall } from '../src/sim/client.js';
import { BANK_EMAIL, JAMES, MARIA, NEW_CALLER, boot, type Harness } from './helpers.js';

const SAM = 'ops+sam@test.rung';
const ALEX = 'ops+alex@test.rung';

let h: Harness;
beforeEach(async () => {
  h = await boot({ REQUIRE_VERIFICATION: 'false' });
  for (const email of [SAM, ALEX]) await h.store.addMember({ orgId: h.bank.id, userId: syntheticUserId(email), role: 'rep' });
});
afterEach(() => h.close());

const triage = async (phone: string, args: Record<string, unknown>) => {
  const c = await openSimCall({ baseUrl: h.base, phone, orgToken: h.bank.mcpToken });
  const r = await c.call('triage_call', args);
  await c.close();
  return r;
};
const queue = async (as?: string) => (await h.api('/queue', { as })).body;
const post = (path: string, as?: string) => h.api(path, { method: 'POST', as });
const three = async () => {
  await triage(MARIA, { intent: 'fraud_in_progress', amount_usd: 4200, summary: 'Charges happening now.' });
  await triage(JAMES, { intent: 'account_opening', amount_usd: 10_000_000, summary: 'Opening a $10M account.' });
  await triage(NEW_CALLER, { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 charge.' });
};

describe('repName', () => {
  it('prefers the plus-address tag', () => {
    expect(repName('ai.jadonli09+sam@gmail.com')).toBe('Sam');
    expect(repName('maria@x.com')).toBe('Maria');
  });
});

describe('claiming with several reps', () => {
  it('second rep to claim the same caller gets 409 already_claimed with the first rep', async () => {
    await three();
    const top = (await queue(SAM)).queued[0];
    expect(await post(`/queue/${top.id}/callback`, SAM)).toEqual({ status: 200, body: { phone: MARIA, tel: `tel:${MARIA}` } });
    expect(await post(`/queue/${top.id}/callback`, ALEX)).toEqual({
      status: 409,
      body: { error: 'already_claimed', claimedBy: { id: syntheticUserId(SAM), name: 'Sam' } },
    });
    // Re-clicking your own claim just returns the number again.
    expect((await post(`/queue/${top.id}/callback`, SAM)).status).toBe(200);
    expect((await queue(ALEX)).inProgress[0].claimedBy).toEqual({ id: syntheticUserId(SAM), name: 'Sam' });
  });

  it('simultaneous claims: exactly one wins', async () => {
    await three();
    const top = (await queue()).queued[0];
    const results = await Promise.all([SAM, ALEX, BANK_EMAIL].map((as) => post(`/queue/${top.id}/callback`, as)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
  });

  it('only the claimer or an admin can finish or cancel', async () => {
    await three();
    const top = (await queue()).queued[0];
    await post(`/queue/${top.id}/callback`, SAM);
    expect(await post(`/queue/${top.id}/done`, ALEX)).toEqual({
      status: 403,
      body: { error: 'not_claimer', claimedBy: { id: syntheticUserId(SAM), name: 'Sam' } },
    });
    expect((await post(`/queue/${top.id}/release`, ALEX)).status).toBe(403);
    expect((await post(`/queue/${top.id}/release`, BANK_EMAIL)).status).toBe(200); // admin override
    const back = (await queue()).queued.find((i: any) => i.id === top.id);
    expect(back).toMatchObject({ claimedBy: null, claimedAt: null });
  });
});

describe('POST /api/queue/next', () => {
  it('hands each rep a different caller in score order, one open callback each', async () => {
    await three();
    const a = await post('/queue/next', SAM);
    const b = await post('/queue/next', ALEX);
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ phone: MARIA, item: { intent: 'fraud_in_progress', claimedBy: { name: 'Sam' } } });
    expect(b.body).toMatchObject({ phone: JAMES, item: { claimedBy: { name: 'Alex' } } });
    expect(await post('/queue/next', SAM)).toEqual({ status: 409, body: { error: 'at_capacity', id: a.body.item.id } });

    await post(`/queue/${a.body.item.id}/done`, SAM);
    expect((await post('/queue/next', SAM)).body.phone).toBe(NEW_CALLER);
    expect((await post('/queue/next', BANK_EMAIL)).status).toBe(204); // nobody left
  });

  it('parallel Take next never double-assigns', async () => {
    await three();
    const r = await Promise.all([SAM, ALEX, BANK_EMAIL].map((as) => post('/queue/next', as)));
    expect(new Set(r.map((x) => x.body.phone)).size).toBe(3);
  });
});

describe('presence', () => {
  it('reps who polled in the last minute are online; a claim makes them busy', async () => {
    await three();
    await queue(SAM);
    await queue(ALEX);
    let q = await queue(BANK_EMAIL);
    expect(q.me).toBe(syntheticUserId(BANK_EMAIL));
    expect(q.reps.filter((r: any) => r.online).map((r: any) => r.name).sort()).toEqual(['Alex', 'Bank', 'Sam']);
    expect(q.availableReps).toBe(3);

    await post('/queue/next', SAM);
    q = await queue(BANK_EMAIL);
    expect(q.reps.find((r: any) => r.name === 'Sam')).toMatchObject({ online: true, busy: true, role: 'rep' });
    expect(q.availableReps).toBe(2);

    h.advanceMin(2); // Sam and Alex closed their tabs
    q = await queue(BANK_EMAIL);
    expect(q.reps.filter((r: any) => r.online).map((r: any) => r.name)).toEqual(['Bank']);
  });

  it('callback estimate divides by reps online', async () => {
    await triage(MARIA, { intent: 'fraud_in_progress', amount_usd: 4200, summary: 'Charges now.' });
    await triage(JAMES, { intent: 'account_opening', amount_usd: 10_000_000, summary: 'Opening.' });
    const alone = (await triage(NEW_CALLER, { intent: 'dispute', amount_usd: 12, summary: 'Dup charge.' })) as any;
    for (const as of [SAM, ALEX, BANK_EMAIL]) await queue(as);
    const c = await openSimCall({ baseUrl: h.base, phone: NEW_CALLER, orgToken: h.bank.mcpToken });
    const crew = (await c.call('lookup_caller', {})) as any;
    await c.close();
    const etaAlone = JSON.stringify(alone).match(/"estimated_callback_minutes":(\d+)/)![1];
    const etaCrew = JSON.stringify(crew).match(/estimated_callback_minutes\\?":(\d+)/)![1];
    expect(Number(etaCrew)).toBeLessThan(Number(etaAlone));
  });
});
