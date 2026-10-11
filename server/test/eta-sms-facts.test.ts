import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clockTime, confirmationSms, etaPhrase } from '../src/sms.js';
import { mergeFacts } from '../src/facts.js';
import { openSimCall } from '../src/sim/client.js';
import { MARIA, NEW_CALLER, boot, type Harness } from './helpers.js';

let h: Harness;
beforeEach(async () => {
  h = await boot({ REQUIRE_VERIFICATION: 'false' });
});
afterEach(() => h.close());

const call = async (phone: string, fn: (c: Awaited<ReturnType<typeof openSimCall>>) => Promise<any>) => {
  const c = await openSimCall({ baseUrl: h.base, phone, orgToken: h.bank.mcpToken });
  try {
    return await fn(c);
  } finally {
    await c.close();
  }
};
const lookup = (phone: string) => call(phone, async (c) => (await c.call('lookup_caller')).data);
const triage = (phone: string, args: Record<string, unknown>) => call(phone, (c) => c.call('triage_call', args));

describe('sms formatting', () => {
  it('states minutes, a clock time in the org zone, position, and opt-out; plain ASCII', () => {
    const at = Date.parse('2026-10-11T22:30:00Z'); // 3:30 PM PDT
    const body = confirmationSms({ orgName: 'Bank of Antarctica', firstName: 'Maria', etaMinutes: 8, etaAt: at, position: 2, timeZone: 'America/Los_Angeles' });
    expect(body).toBe(
      'Bank of Antarctica: Hi Maria, we have your request. A specialist will call you back on this number about 8 minutes from now, around 3:30 PM PDT. You are #2 in line. The time can shift if more urgent calls come in. Reply STOP to opt out.',
    );
    expect(body).toMatch(/^[\x20-\x7E]+$/);
    expect(clockTime(at, 'Not/AZone')).toMatch(/10:30 PM UTC/);
    expect(etaPhrase(1)).toBe('about 1 minute');
    expect(etaPhrase(120)).toBe('about 2 hours');
  });
});

describe('confirmation text after triage', () => {
  it('sends one text from the org number with the exact ETA, and stores what was promised', async () => {
    await h.api('/org/number', { body: { numberId: 'mock_num_1' } });
    h.bank = (await h.store.getOrg(h.bank.id))!;
    const r = await call(MARIA, (c) => c.call('triage_call', { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 charge.' }));
    expect(r.data).toMatchObject({ queued: true, confirmation_text_sent: true, estimated_callback_minutes: 4 });
    expect(h.dial.sent).toHaveLength(1);
    expect(h.dial.sent[0]).toMatchObject({ to: MARIA, from: '+15550000001' });
    expect(h.dial.sent[0]!.body).toContain('Hi Maria,');
    expect(h.dial.sent[0]!.body).toContain('about 4 minutes from now');
    expect(h.dial.sent[0]!.body).toContain(r.data.estimated_callback_at);
    expect(r.data.say_to_caller).toContain('about 4 minutes');
    expect(r.data.say_to_caller).toContain('I just texted you');
    expect(h.dial.sent[0]!.body).not.toMatch(/\$12|charge/i); // nothing sensitive on a lock screen

    const item = (await h.store.listQueueItems(h.bank.id, { statuses: ['queued'] }))[0]!;
    expect(item).toMatchObject({ etaMinutes: 4, smsStatus: 'sent' });
    expect(item.etaAt).toBe(item.createdAt + 4 * 60_000);
  });

  it('a repeat triage_call (name backfill) does not text twice or move the promised time', async () => {
    await h.api('/org/number', { body: { numberId: 'mock_num_1' } });
    h.bank = (await h.store.getOrg(h.bank.id))!;
    const first = await triage(NEW_CALLER, { intent: 'dispute', summary: 'Duplicate charge on my card.' });
    h.advanceMin(1);
    const second = await triage(NEW_CALLER, { intent: 'dispute', summary: 'Duplicate charge on my card.', caller_name: 'Sam Okafor' });
    expect(h.dial.sent).toHaveLength(1);
    expect(second.data.estimated_callback_minutes).toBe(first.data.estimated_callback_minutes);
    expect(second.data.estimated_callback_at).toBe(first.data.estimated_callback_at);
  });

  it('a refused text (no 10DLC) never fails the call: queued, status failed, agent told not to mention a text', async () => {
    await h.api('/org/number', { body: { numberId: 'mock_num_1' } });
    h.bank = (await h.store.getOrg(h.bank.id))!;
    h.dial.failNextSms = true;
    const r = await triage(MARIA, { intent: 'dispute', summary: 'Duplicate charge on my card.' });
    expect(r.isError).toBe(false);
    expect(r.data).toMatchObject({ queued: true, confirmation_text_sent: false });
    expect(r.data.say_to_caller).not.toContain('texted');
    const item = (await h.store.listQueueItems(h.bank.id, { statuses: ['queued'] }))[0]!;
    expect(item.smsStatus).toBe('failed');
    expect(item.smsError).toContain('mock failure');
    expect(item.etaMinutes).toBeGreaterThan(0);
  });

  it('skips cleanly when the org has no Dial number', async () => {
    const org = (await h.store.getOrg(h.bank.id))!;
    await h.store.updateOrg(org.id, { dialNumber: null, dialNumberId: null });
    const r = await triage(MARIA, { intent: 'dispute', summary: 'Duplicate charge on my card.' });
    expect(r.data.queued).toBe(true);
    expect(h.dial.sent).toHaveLength(0);
    expect((await h.store.listQueueItems(h.bank.id, { statuses: ['queued'] }))[0]!.smsStatus).toBe('skipped');
  });
});

describe('durable caller facts', () => {
  it('mergeFacts overwrites restated fields, appends notes once, never erases', () => {
    const a = mergeFacts(undefined, { occupation: 'nurse', note: 'Prefers evening calls' }, 1);
    const b = mergeFacts(a, { household: 'two kids', note: 'prefers evening calls', occupation: '  ' }, 2);
    expect(b).toEqual({ occupation: 'nurse', household: 'two kids', notes: [{ text: 'Prefers evening calls', at: 1 }] });
    const c = mergeFacts(b, { occupation: 'charge nurse' }, 3);
    expect(c.occupation).toBe('charge nurse');
    expect(c.household).toBe('two kids');
  });

  it('update_profile needs a saved profile, then facts persist and come back on the next call with guidance', async () => {
    const first = await call(NEW_CALLER, async (c) => {
      expect((await c.call('update_profile', { occupation: 'nurse' })).data.error).toBe('no_profile');
      await c.call('save_profile', { name: 'Sam Okafor', consent: true, facts: { occupation: 'nurse' } });
      return (await c.call('lookup_caller')).data;
    });
    expect(first).toMatchObject({ known: true, facts: { occupation: 'nurse' }, missing_facts: ['household'] });

    h.advanceMin(20 * 24 * 60); // 20 days later
    await call(NEW_CALLER, async (c) => {
      const r = await c.call('update_profile', { household: 'married, two kids (4 and 7)', note: 'Works night shifts' });
      expect(r.data.saved).toBe(true);
      expect((await c.call('update_profile', {})).data.error).toBe('nothing_to_save');
    });

    const later = await lookup(NEW_CALLER);
    expect(later.facts).toMatchObject({ occupation: 'nurse', household: 'married, two kids (4 and 7)' });
    expect(later.facts.notes[0].text).toBe('Works night shifts');
    expect(later.missing_facts).toEqual([]);
    expect(later.guidance).toContain('occupation: nurse');
    expect(later.guidance).toContain('two kids');
    expect(later.guidance).not.toContain('You do not yet know');
  });

  it('re-saving a profile keeps the facts; a new request is appended on top of the old history', async () => {
    await call(MARIA, async (c) => {
      await c.call('update_profile', { occupation: 'dentist' });
      await c.call('save_profile', { name: 'Maria Alvarez', consent: true });
    });
    await triage(MARIA, { intent: 'dispute', summary: 'Duplicate $12 charge.' });
    h.advanceMin(20 * 24 * 60);
    await triage(MARIA, { intent: 'locked_out', summary: 'Locked out after a phone change.' });
    const r = await lookup(MARIA);
    expect(r.facts.occupation).toBe('dentist');
    expect(r.call_count).toBe(3); // 1 seeded + 2 new
    expect(r.recent_issues[0].summary).toBe('Locked out after a phone change.');
    expect(r.recent_issues.map((i: any) => i.summary)).toContain('Duplicate $12 charge.');
  });

  it('facts are per org: the same number at the clinic knows nothing about the bank conversation', async () => {
    await call(MARIA, (c) => c.call('update_profile', { occupation: 'dentist' }));
    const c = await openSimCall({ baseUrl: h.base, phone: MARIA, orgToken: h.clinic.mcpToken });
    const r = (await c.call('lookup_caller')).data;
    await c.close();
    expect(r.facts).toBeNull();
    expect(JSON.stringify(r)).not.toContain('dentist');
  });
});
