import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSimCall } from '../src/sim/client.js';
import { JAMES, MARIA, NEW_CALLER, boot, type Harness } from './helpers.js';

let h: Harness;
beforeEach(async () => {
  h = await boot({ REQUIRE_VERIFICATION: 'false' });
});
afterEach(() => h.close());

const call = async (phone: string, fn: (c: Awaited<ReturnType<typeof openSimCall>>) => Promise<any>, orgToken = h.bank.mcpToken) => {
  const c = await openSimCall({ baseUrl: h.base, phone, orgToken });
  try {
    return await fn(c);
  } finally {
    await c.close();
  }
};
const lookup = (phone: string, orgToken?: string) => call(phone, async (c) => (await c.call('lookup_caller')).data, orgToken);
const triage = (phone: string, args: Record<string, unknown>) => call(phone, (c) => c.call('triage_call', args));

describe('lookup_caller: recent issues and call count (gap 1)', () => {
  it('returns the last 3 issues newest first, with intent label, when and status, and the total count', async () => {
    await triage(MARIA, { intent: 'locked_out', summary: 'Locked out of the app after a phone change.' });
    await h.api(`/queue/${(await h.api('/queue')).body.queued[0].id}/done`, { method: 'POST' });
    h.advanceMin(5);
    await triage(MARIA, { intent: 'payment_issue', amount_usd: 80, summary: 'Rent payment of $80 bounced.' });
    await h.api(`/queue/${(await h.api('/queue')).body.queued[0].id}/done`, { method: 'POST' });
    h.advanceMin(5);
    await triage(MARIA, { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 coffee charge.' });

    const r = await lookup(MARIA);
    expect(r.call_count).toBe(4); // 3 today + 1 seeded 5 days ago
    expect(r.recent_issues).toEqual([
      { summary: 'Duplicate $12 coffee charge.', intent: 'dispute', intent_label: 'card dispute', when: 'earlier today', status: 'queued' },
      { summary: 'Rent payment of $80 bounced.', intent: 'payment_issue', intent_label: 'payment problem', when: 'earlier today', status: 'done' },
      { summary: 'Locked out of the app after a phone change.', intent: 'locked_out', intent_label: 'locked out of account', when: 'earlier today', status: 'done' },
    ]);
    expect(r.last_issue).toEqual({ summary: 'Duplicate $12 coffee charge.', when: 'earlier today' });
    expect(r.previous_calls).toBeNull(); // has a profile
  });

  it('a brand-new caller gets empty history', async () => {
    const r = await lookup(NEW_CALLER);
    expect(r).toMatchObject({ known: false, name: null, name_source: null, recent_issues: [], call_count: 0, previous_calls: 0, open_request: null, last_issue: null });
    expect(r.guidance).toContain('New caller');
  });
});

describe('lookup_caller: unsaved callers with history (gaps 2 and 3)', () => {
  it('counts previous calls and says "Welcome back" without a name when none was given', async () => {
    await triage(NEW_CALLER, { intent: 'general_question', summary: 'Asked about card limits.' });
    await h.api(`/queue/${(await h.api('/queue')).body.queued[0].id}/done`, { method: 'POST' });
    const r = await lookup(NEW_CALLER);
    expect(r).toMatchObject({ known: false, name: null, first_name: null, name_source: null, previous_calls: 1, call_count: 1 });
    expect(r.guidance).toContain("You've spoken before (1 call) but they haven't saved their name.");
    expect(r.guidance).toContain('Say "Welcome back" without a name.');
    expect(r.guidance).toContain('"Asked about card limits." (earlier today)');
    expect(r.guidance).toContain('ask for their first and last name');
    expect(r.guidance).toContain('offer to remember them');
  });

  it('falls back to the name given on a previous call, still offering to save', async () => {
    await triage(NEW_CALLER, { intent: 'general_question', summary: 'Asked about card limits.', caller_name: 'Sam Okafor' });
    await h.api(`/queue/${(await h.api('/queue')).body.queued[0].id}/done`, { method: 'POST' });
    h.advanceMin(1);
    await triage(NEW_CALLER, { intent: 'other', summary: 'Asked about branch hours.' }); // no name this time
    const r = await lookup(NEW_CALLER);
    expect(r).toMatchObject({ known: false, name: 'Sam Okafor', first_name: 'Sam', name_source: 'previous_call', previous_calls: 2 });
    expect(r.guidance).toContain('"Is this still Sam Okafor?"');
    expect(r.guidance).toContain('offer to remember them');
  });

  it('a saved profile wins over a previous-call name', async () => {
    await triage(JAMES, { intent: 'other', summary: 'Asked about hours.', caller_name: 'Jim' });
    const r = await lookup(JAMES);
    expect(r).toMatchObject({ known: true, name: 'James Whitfield', first_name: 'James', name_source: 'profile' });
    expect(r.guidance).toContain('Say "Hi James, I\'ve got your details up. What can I help you with today?"');
  });

  it('a recognized caller with only closed history is not quizzed about it', async () => {
    const r = await lookup(MARIA);
    expect(r.guidance).toContain('Say "Hi Maria, I\'ve got your details up. What can I help you with today?"');
    expect(r.guidance).toContain('Do not bring up their past issues unless they do');
    expect(r.guidance).not.toContain('Ask whether this is about');
  });
});

describe('lookup_caller: open request detail (gap 4)', () => {
  it('gives the queue position and callback estimate of the pending request', async () => {
    await triage(NEW_CALLER, { intent: 'fraud_in_progress', amount_usd: 4200, summary: 'Charges happening now.' });
    await triage(MARIA, { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 charge.' });
    const r = await lookup(MARIA);
    expect(r.has_open_request).toBe(true);
    expect(r.open_request).toEqual({ summary: 'Duplicate $12 charge.', status: 'queued', position: 2, estimated_callback_minutes: 8 });
    expect(r.guidance).toContain('it is #2 in line, about 8 minutes away');
  });

  it('says a specialist is on it once the request is claimed', async () => {
    await triage(MARIA, { intent: 'dispute', summary: 'Duplicate charge.' });
    await h.api(`/queue/${(await h.api('/queue')).body.queued[0].id}/callback`, { method: 'POST' });
    const r = await lookup(MARIA);
    expect(r.open_request).toEqual({ summary: 'Duplicate charge.', status: 'in_progress', position: null, estimated_callback_minutes: null });
    expect(r.guidance).toContain('already working on their open request');
  });

  it("never mixes in another org's history for the same number", async () => {
    await triage(MARIA, { intent: 'dispute', summary: 'Bank-only issue.' });
    const clinic = await lookup(MARIA, h.clinic.mcpToken);
    expect(clinic).toMatchObject({ name: 'Dana Brooks', call_count: 1, open_request: null, has_open_request: false });
    expect(JSON.stringify(clinic)).not.toContain('Bank-only');
  });
});

describe('always collect a name', () => {
  it('a caller with an earlier nameless request is asked for their name on the next call', async () => {
    await triage(NEW_CALLER, { intent: 'fraud_in_progress', amount_usd: 4200, summary: 'NVIDIA charges of $4,200 right now.' });
    const r = await lookup(NEW_CALLER);
    expect(r).toMatchObject({ known: false, name: null, previous_calls: 1 });
    expect(r.guidance).toContain('ask for their first and last name');
  });

  it('triage_call without any name still queues, but flags name_missing with guidance', async () => {
    const r = await triage(NEW_CALLER, { intent: 'fraud_in_progress', amount_usd: 4200, summary: 'NVIDIA charges of $4,200 right now.' });
    expect(r.isError).toBe(false);
    expect(r.data).toMatchObject({ queued: true, name_missing: true });
    expect(r.data.guidance).toContain('call triage_call again with caller_name: it updates this same request');
    expect((await h.api('/queue')).body.queued).toHaveLength(1);
  });

  it('the repeat call sets the name on the same item without resetting the wait or duplicating', async () => {
    await triage(NEW_CALLER, { intent: 'fraud_in_progress', amount_usd: 4200, summary: 'NVIDIA charges of $4,200 right now.' });
    const before = (await h.api('/queue')).body.queued[0];
    h.advanceMin(1);
    const r = await triage(NEW_CALLER, { intent: 'fraud_in_progress', amount_usd: 4200, summary: 'NVIDIA charges of $4,200 right now.', caller_name: '  kim   nguyen ' });
    expect(r.data.name_missing).toBe(false);
    const q = (await h.api('/queue')).body.queued;
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ id: before.id, name: 'Kim Nguyen', createdAt: before.createdAt, waitedMin: 1 });
  });

  it('a later update without caller_name keeps the name already given', async () => {
    await triage(NEW_CALLER, { intent: 'dispute', summary: 'Duplicate charge.', caller_name: 'Ana de la Cruz' });
    const r = await triage(NEW_CALLER, { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 charge.' });
    expect(r.data.name_missing).toBe(false);
    expect((await h.api('/queue')).body.queued[0].name).toBe('Ana de la Cruz'); // mixed case kept as given
  });

  it('save_profile backfills the name on the open request', async () => {
    await call(NEW_CALLER, async (c) => {
      await c.call('triage_call', { intent: 'dispute', summary: 'Duplicate charge.' });
      expect((await h.api('/queue')).body.queued[0].name).toBeNull();
      expect((await c.call('save_profile', { name: 'sam okafor', consent: true })).data).toMatchObject({ saved: true, name: 'Sam Okafor' });
    });
    expect((await h.api('/queue')).body.queued[0].name).toBe('Sam Okafor');
  });

  it('save_profile does not overwrite a name the request already has', async () => {
    await call(NEW_CALLER, async (c) => {
      await c.call('triage_call', { intent: 'dispute', summary: 'Duplicate charge.', caller_name: 'Sam Okafor' });
      await c.call('save_profile', { name: 'Samuel Okafor', consent: true });
    });
    expect((await h.api('/queue')).body.queued[0].name).toBe('Sam Okafor');
  });
});
