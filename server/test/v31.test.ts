import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSimCall } from '../src/sim/client.js';
import { CLINIC_EMAIL, JAMES, MARIA, NEW_CALLER, boot, type Harness } from './helpers.js';

let h: Harness;
beforeEach(async () => {
  h = await boot({ REQUIRE_VERIFICATION: 'false' });
});
afterEach(() => h.close());

const triage = async (phone: string, args: Record<string, unknown>, orgToken = h.bank.mcpToken) => {
  const c = await openSimCall({ baseUrl: h.base, phone, orgToken });
  const r = await c.call('triage_call', args);
  await c.close();
  return r;
};
const queue = async (as?: string) => (await h.api('/queue', { as })).body;
const post = (path: string, as?: string) => h.api(path, { method: 'POST', as });

describe('POST /api/queue/:id/release', () => {
  it('puts a claimed item back in line with its original createdAt (rank and aging resume)', async () => {
    await triage(NEW_CALLER, { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 charge.', caller_name: 'Sam Okafor' });
    h.advanceMin(1);
    await triage(JAMES, { intent: 'account_opening', amount_usd: 10_000_000, summary: 'Opening a $10M account.' });
    const dispute = (await queue()).queued.find((i: any) => i.intent === 'dispute');
    expect((await post(`/queue/${dispute.id}/callback`)).status).toBe(200);
    h.advanceMin(45);
    expect(await post(`/queue/${dispute.id}/release`)).toEqual({ status: 200, body: { ok: true } });

    const q = await queue();
    expect(q.inProgress).toEqual([]);
    const back = q.queued.find((i: any) => i.id === dispute.id);
    expect(back).toMatchObject({ status: 'queued', claimedAt: null, createdAt: dispute.createdAt, waitedMin: 46, name: 'Sam Okafor' });
    expect(back.score).toEqual({ urgency: 20, value: 0, aging: 92, total: 112 }); // aged through the claim
    expect(q.queued.map((i: any) => i.rank)).toEqual([1, 2]);
    expect(JSON.stringify(q)).not.toContain(NEW_CALLER); // full number only ever comes from /callback
  });

  it('409 not_in_progress unless claimed; 404 for another org', async () => {
    await triage(MARIA, { intent: 'dispute', summary: 'Duplicate charge.' });
    const id = (await queue()).queued[0].id;
    expect(await post(`/queue/${id}/release`)).toEqual({ status: 409, body: { error: 'not_in_progress' } });
    await post(`/queue/${id}/callback`);
    expect(await post(`/queue/${id}/release`, CLINIC_EMAIL)).toEqual({ status: 404, body: { error: 'not_found' } });
    expect((await queue()).inProgress[0].id).toBe(id);
    await post(`/queue/${id}/done`);
    expect((await post(`/queue/${id}/release`)).body).toEqual({ error: 'not_in_progress' });
  });
});

describe('POST /api/queue/:id/reopen', () => {
  it('undoes Done: back to queued, doneAt cleared, createdAt kept', async () => {
    await triage(MARIA, { intent: 'fraud_in_progress', amount_usd: 4200, summary: 'Charges now.' });
    const item = (await queue()).queued[0];
    await post(`/queue/${item.id}/callback`);
    await post(`/queue/${item.id}/done`);
    h.advanceMin(3);
    expect(await post(`/queue/${item.id}/reopen`)).toEqual({ status: 200, body: { ok: true } });
    const q = await queue();
    expect(q.done.find((i: any) => i.id === item.id)).toBeUndefined();
    expect(q.queued[0]).toMatchObject({ id: item.id, status: 'queued', doneAt: null, createdAt: item.createdAt, waitedMin: 3 });
  });

  it('409 not_done unless done; 404 for another org', async () => {
    await triage(MARIA, { intent: 'dispute', summary: 'Duplicate charge.' });
    const id = (await queue()).queued[0].id;
    expect(await post(`/queue/${id}/reopen`)).toEqual({ status: 409, body: { error: 'not_done' } });
    await post(`/queue/${id}/done`);
    expect(await post(`/queue/${id}/reopen`, CLINIC_EMAIL)).toEqual({ status: 404, body: { error: 'not_found' } });
    expect((await post('/queue/nope/reopen')).status).toBe(404);
  });
});

describe('GET /api/callers', () => {
  it('lists profiles and unsaved callers, newest activity first, without phones', async () => {
    h.advanceMin(1);
    await triage(NEW_CALLER, { intent: 'fraud_in_progress', amount_usd: 4200, summary: 'NVIDIA charges right now.', caller_name: 'Kim Nguyen' });
    h.advanceMin(1);
    await triage(MARIA, { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 charge.' });
    const id = (await queue()).queued.find((i: any) => i.name === 'Maria Alvarez' || i.phoneMasked.endsWith('0101')).id;
    await post(`/queue/${id}/callback`);

    const res = await h.api('/callers');
    expect(res.status).toBe(200);
    const callers = res.body.callers;
    expect(JSON.stringify(callers)).not.toMatch(/\+1555555\d{4}|\+14155550111/);
    expect(callers.map((c: any) => c.phoneMasked)).toEqual(['+1••••••0101', '+1••••••0111', '+1••••••0102']);

    const [maria, kim, james] = callers;
    expect(maria).toMatchObject({
      saved: true, trust: 'verified', callCount: 2, // seeded profiles were code-verified lastIntentLabel: 'card dispute', lastTier: 'normal',
      lastSummary: 'Duplicate $12 charge.', lastAmountUsd: 12, openStatus: 'in_progress', lastCallAt: h.clock.t,
    });
    expect(maria.name).toBe((await h.store.getProfile(h.bank.id, MARIA))!.name);
    expect(kim).toMatchObject({ name: 'Kim Nguyen', saved: false, trust: 'new', callCount: 1, lastTier: 'critical', openStatus: 'queued' });
    expect(james).toMatchObject({ saved: true, callCount: 1, openStatus: null });
    expect(maria.key).toMatch(/^[0-9a-f]{16}$/);
    expect(new Set(callers.map((c: any) => c.key)).size).toBe(3);
    // Stable across requests.
    expect((await h.api('/callers')).body.callers[0].key).toBe(maria.key);
  });

  it('is org-scoped: the same phone has a different key and record at the other org', async () => {
    await triage(MARIA, { intent: 'dispute', summary: 'Bank issue.' });
    const bank = (await h.api('/callers')).body.callers;
    const clinic = (await h.api('/callers', { as: CLINIC_EMAIL })).body.callers;
    const b = bank.find((c: any) => c.phoneMasked === '+1••••••0101');
    const c = clinic.find((x: any) => x.phoneMasked === '+1••••••0101');
    expect(b.key).not.toBe(c.key);
    expect(c.lastSummary).not.toBe('Bank issue.');
    expect(clinic.every((x: any) => x.lastSummary !== 'Bank issue.')).toBe(true);
    expect((await h.api('/callers', { as: null })).status).toBe(401);
  });
});

describe('GET /api/history', () => {
  it('returns done items newest doneAt first (any age), as QueueItemViews, with a limit', async () => {
    const ids: string[] = [];
    for (const [phone, summary] of [[NEW_CALLER, 'First.'], [JAMES, 'Second.'], [MARIA, 'Third.']] as const) {
      await triage(phone, { intent: 'dispute', summary, caller_name: 'X Y' });
      ids.push((await queue()).queued.find((i: any) => i.summary === summary).id);
    }
    // Finish in a different order than created: Second, Third, First.
    for (const id of [ids[1], ids[2], ids[0]]) {
      h.advanceMin(1);
      await post(`/queue/${id}/done`);
    }
    h.advanceMin(60 * 24 * 3); // older than the queue's 12h "done" window: history still has them
    const all = (await h.api('/history')).body.items;
    expect(all.slice(0, 3).map((i: any) => i.summary)).toEqual(['First.', 'Third.', 'Second.']);
    expect(all.every((i: any) => i.status === 'done' && i.rank === null)).toBe(true);
    expect(all[0]).toHaveProperty('savedMin');
    expect(all[0]).toHaveProperty('phoneMasked');
    expect(all.length).toBe(5); // + 2 seeded past issues for the bank
    expect((await h.api('/history?limit=2')).body.items.map((i: any) => i.summary)).toEqual(['First.', 'Third.']);
    expect((await h.api('/history?limit=999')).body.items).toHaveLength(5);
    expect((await h.api('/history', { as: CLINIC_EMAIL })).body.items.every((i: any) => !['First.', 'Second.', 'Third.'].includes(i.summary))).toBe(true);
  });
});
