import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedStore } from '../src/seed.js';
import { openSimCall } from '../src/sim/client.js';
import { signDialPayload } from '../src/webhook.js';
import { SECRET, START, WEBHOOK_SECRET, boot, lastCode, waitFor, type Harness } from './helpers.js';

const NEW_CALLER = '+14155550111';
const REID = '+15555550101'; // pre-enrolled returning caller
const MAYA = '+15555550102';

let h: Harness;
beforeEach(async () => {
  h = await boot();
  await seedStore(
    h.store,
    {
      profiles: [
        { phone: REID, name: 'Reid Calloway', history: [{ intent: 'dispute', amountUsd: 38, summary: 'Disputed a duplicate $38 charge.', daysAgo: 5 }] },
        { phone: MAYA, name: 'Maya Chen' },
      ],
    },
    START,
  );
});
afterEach(() => h.close());

const as = (phone: string | null, extra: Record<string, string> = {}) =>
  openSimCall({ baseUrl: h.base, phone, secret: SECRET, ...extra });

const queue = async () => (await fetch(`${h.base}/api/queue`).then((r) => r.json())) as any;

describe('MCP endpoint security', () => {
  const init = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } },
  };
  const post = (path: string, headers: Record<string, string> = {}) =>
    fetch(`${h.base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
      body: JSON.stringify(init),
    });

  it('rejects calls without the shared secret', async () => {
    expect((await post('/mcp')).status).toBe(401);
    expect((await post('/mcp', { 'x-mcp-secret': 'wrong' })).status).toBe(401);
  });

  it('accepts the secret as a header, a bearer token, or a URL token', async () => {
    expect((await post('/mcp', { 'x-mcp-secret': SECRET })).status).toBe(200);
    expect((await post('/mcp', { authorization: `Bearer ${SECRET}` })).status).toBe(200);
    expect((await post(`/mcp/${SECRET}`)).status).toBe(200);
    expect((await post('/mcp/nope')).status).toBe(401);
  });

  it('exposes exactly the five tools, none of which take a phone number', async () => {
    const call = await as(NEW_CALLER);
    expect((await call.tools()).sort()).toEqual(['check_code', 'lookup_caller', 'save_profile', 'send_code', 'triage_call']);
    await call.close();
  });

  it('refuses tool calls with no valid caller number (e.g. Dial tool discovery, template values)', async () => {
    for (const phone of [null, '{{user_number}}', '4155550111']) {
      const call = await openSimCall({ baseUrl: h.base, phone, secret: SECRET });
      const r = await call.call('lookup_caller');
      expect(r.isError).toBe(true);
      expect(r.data.error).toBe('caller_unknown');
      await call.close();
    }
  });

  it('refuses outbound calls unless REQUIRE_INBOUND is off', async () => {
    const call = await as(NEW_CALLER, { direction: 'outbound' });
    expect((await call.call('lookup_caller')).data.error).toBe('not_allowed');
    await call.close();
  });
});

describe('first call: enrollment', () => {
  it('walks a new caller from unknown to saved profile', async () => {
    const call = await as(NEW_CALLER);

    const first = await call.call('lookup_caller');
    expect(first.data).toMatchObject({ known: false, name: null, last_issue: null });

    // Cannot save before proving the number.
    expect((await call.call('save_profile', { name: 'Sam Okafor', consent: true })).data.error).toBe('verification_required');

    expect((await call.call('send_code')).data.sent).toBe(true);
    expect(h.dial.sent).toHaveLength(1);
    expect(h.dial.sent[0]!.to).toBe(NEW_CALLER);
    const code = lastCode(h.dial);

    const wrong = await call.call('check_code', { code: code === '000000' ? '111111' : '000000' });
    expect(wrong.data).toMatchObject({ verified: false, attempts_left: 4 });
    expect((await call.call('check_code', { code })).data.verified).toBe(true);

    // Consent is separate from verification.
    expect((await call.call('save_profile', { name: 'Sam Okafor', consent: false })).data.error).toBe('consent_required');
    expect((await call.call('save_profile', { name: 'Sam Okafor', consent: true })).data.saved).toBe(true);

    const again = await call.call('lookup_caller');
    expect(again.data).toMatchObject({ known: true, name: 'Sam Okafor', first_name: 'Sam' });
    await call.close();
  });

  it('never returns the code to the agent', async () => {
    const call = await as(NEW_CALLER);
    const r = await call.call('send_code');
    expect(JSON.stringify(r.data)).not.toContain(lastCode(h.dial));
    await call.close();
  });

  it('is rate-limited', async () => {
    const call = await as(NEW_CALLER);
    for (let i = 0; i < 3; i++) await call.call('send_code');
    expect((await call.call('send_code')).data.error).toBe('rate_limited');
    await call.close();
  });

  it('reports SMS failure to the agent, or continues if demo fallback is on', async () => {
    const strict = await boot({ DEMO_SHOW_CODES: 'false' });
    strict.dial.failNextSms = true;
    const c1 = await openSimCall({ baseUrl: strict.base, phone: NEW_CALLER, secret: SECRET });
    expect((await c1.call('send_code')).data.error).toBe('sms_failed');
    await c1.close();
    await strict.close();

    h.dial.failNextSms = true;
    const c2 = await as(NEW_CALLER);
    expect((await c2.call('send_code')).data.sent).toBe(true);
    const codes = (await fetch(`${h.base}/api/dev/codes`).then((r) => r.json())) as any;
    expect(codes.codes[0]).toMatchObject({ phone: NEW_CALLER });
    expect(codes.codes[0].code).toMatch(/^\d{6}$/);
    await c2.close();
  });
});

describe('returning caller', () => {
  it('is recognized instantly, with their last issue, and no code needed for a low-risk request', async () => {
    const call = await as(REID);
    const r = await call.call('lookup_caller');
    expect(r.data).toMatchObject({ known: true, first_name: 'Reid', last_issue: { when: '5 days ago' } });
    expect(r.data.last_issue.summary).toContain('$38');

    const t = await call.call('triage_call', { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 charge at a cafe.' });
    expect(t.isError).toBe(false);
    expect((await queue()).queued[0]).toMatchObject({ name: 'Reid Calloway', trust: 'recognized' });
    expect(h.dial.sent).toHaveLength(0);
    await call.close();
  });
});

describe('verification gate on sensitive requests', () => {
  it('requires a fresh code to queue a money movement, then allows it', async () => {
    const call = await as(MAYA);
    const args = { intent: 'money_movement', amount_usd: 9000, summary: 'Wants to wire $9,000 to a contractor.' };

    const blocked = await call.call('triage_call', args);
    expect(blocked.data.error).toBe('verification_required');
    expect((await queue()).queued).toHaveLength(0);

    await call.call('send_code');
    await call.call('check_code', { code: lastCode(h.dial) });
    const allowed = await call.call('triage_call', args);
    expect(allowed.data.queued).toBe(true);
    expect((await queue()).queued[0]).toMatchObject({ trust: 'verified' });
    await call.close();
  });

  it('does not gate urgent-but-not-sensitive requests like fraud in progress', async () => {
    const call = await as(NEW_CALLER);
    const r = await call.call('triage_call', { intent: 'fraud_in_progress', amount_usd: 4200, summary: 'Cards charged in another country right now.', caller_name: 'Pat' });
    expect(r.data.queued).toBe(true);
    expect((await queue()).queued[0]).toMatchObject({ name: 'Pat', trust: 'new' });
    await call.close();
  });
});

describe('priority queue', () => {
  const enqueue = async (phone: string, args: Record<string, unknown>) => {
    const call = await as(phone);
    const r = await call.call('triage_call', args);
    await call.close();
    return r;
  };

  it('ranks the three demo calls: fraud, then the $10M account, then the $12 dispute', async () => {
    await enqueue(NEW_CALLER, { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 charge.', caller_name: 'Sam' });
    await enqueue(MAYA, { intent: 'account_opening', amount_usd: 10_000_000, summary: 'Opening a $10M corporate account.' });
    const fraud = await enqueue(REID, { intent: 'fraud_in_progress', amount_usd: 4200, summary: 'Unknown charges happening now.' });

    expect(fraud.data.position).toBe(1);
    const q = await queue();
    expect(q.queued.map((i: any) => i.intent)).toEqual(['fraud_in_progress', 'account_opening', 'dispute']);
    expect(q.queued.map((i: any) => i.rank)).toEqual([1, 2, 3]);
    expect(q.queued[0].reason).toBe('Urgent: suspected fraud · $4,200 · waited 0 min');
    expect(q.queued[0].score).toEqual({ urgency: 100, value: 16, aging: 0, total: 116 });
    expect(q.stats.waiting).toBe(3);
  });

  it('tells the agent where the caller landed and when to expect a call', async () => {
    const r = await enqueue(NEW_CALLER, { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 charge.' });
    expect(r.data).toMatchObject({ queued: true, position: 1, estimated_callback_minutes: 4 });
    expect(r.data.say_to_caller).toContain('about 4 minutes');
  });

  it('lets a long wait overtake a fresh $10M account (so small issues are not starved)', async () => {
    await enqueue(NEW_CALLER, { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 charge.' });
    h.advanceMin(45);
    await enqueue(MAYA, { intent: 'account_opening', amount_usd: 10_000_000, summary: 'Opening a $10M account.' });
    const q = await queue();
    expect(q.queued.map((i: any) => i.intent)).toEqual(['dispute', 'account_opening']);
    expect(q.queued[0]).toMatchObject({ waitedMin: 45, score: { aging: 90, total: 110 } });
  });

  it('does not double-queue when the agent calls triage_call twice, and keeps the original wait', async () => {
    await enqueue(NEW_CALLER, { intent: 'general_question', summary: 'Asked about card limits.' });
    h.advanceMin(1);
    await enqueue(NEW_CALLER, { intent: 'locked_out', summary: 'Actually locked out of the app.' });
    const q = await queue();
    expect(q.queued).toHaveLength(1);
    expect(q.queued[0]).toMatchObject({ intent: 'locked_out', waitedMin: 1 });
  });

  it('masks numbers in the list and releases the full number only on callback', async () => {
    await enqueue(REID, { intent: 'dispute', summary: 'Another duplicate charge.' });
    const q = await queue();
    const item = q.queued[0];
    expect(JSON.stringify(q)).not.toContain(REID);
    expect(item.phoneMasked).toBe('+1••••••0101');

    const cb = (await fetch(`${h.base}/api/queue/${item.id}/callback`, { method: 'POST' }).then((r) => r.json())) as any;
    expect(cb).toEqual({ phone: REID, tel: `tel:${REID}` });
    const after = await queue();
    expect(after.queued).toHaveLength(0);
    expect(after.inProgress[0]).toMatchObject({ id: item.id, status: 'in_progress' });

    await fetch(`${h.base}/api/queue/${item.id}/done`, { method: 'POST' });
    expect((await queue()).done[0]).toMatchObject({ id: item.id, status: 'done' });
  });
});

describe('Dial webhooks', () => {
  const send = (evt: object, opts: { secret?: string; at?: number; id?: string } = {}) => {
    const raw = JSON.stringify(evt);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-dial-signature': signDialPayload(raw, opts.secret ?? WEBHOOK_SECRET, opts.at ?? h.clock.t),
    };
    if (opts.id) headers['x-dial-event-id'] = opts.id;
    return fetch(`${h.base}/webhooks/dial`, { method: 'POST', headers, body: raw });
  };

  const ended = (callId: string, from: string) => ({
    id: `evt_end_${callId}`,
    object: 'event',
    type: 'call.ended',
    version: 1,
    createdAt: new Date(h.clock.t + 45_000).toISOString(),
    relatedObject: { id: callId, type: 'call', url: `/api/v1/calls/${callId}` },
    data: { callId, from, to: '+15555550000', direction: 'inbound', durationSeconds: 45, status: 'completed', canceled: false, failureReason: null, transcriptAvailable: true },
  });
  const transcribed = (callId: string) => ({
    id: `evt_tr_${callId}`,
    object: 'event',
    type: 'call.transcribed',
    version: 1,
    createdAt: new Date(h.clock.t + 50_000).toISOString(),
    relatedObject: { id: callId, type: 'call', url: `/api/v1/calls/${callId}` },
    data: { callId },
  });

  it('rejects unsigned, wrongly signed, and stale deliveries', async () => {
    const evt = ended('call_x', REID);
    expect((await fetch(`${h.base}/webhooks/dial`, { method: 'POST', body: JSON.stringify(evt) })).status).toBe(401);
    expect((await send(evt, { secret: 'whsec_wrong' })).status).toBe(401);
    expect((await send(evt, { at: h.clock.t - 10 * 60_000 })).status).toBe(401);
    expect((await send(evt)).status).toBe(200);
  });

  it('links the call to the queue item and attaches the transcript', async () => {
    const call = await as(REID);
    await call.call('triage_call', { intent: 'dispute', summary: 'Duplicate charge.' });
    await call.close();
    const item = (await queue()).queued[0];

    h.dial.calls.set('call_1', {
      id: 'call_1',
      from: REID,
      transcript: 'agent: Hi Reid.\nuser: I was charged twice.',
      transcriptTurns: [
        { speaker: 'agent', text: 'Hi Reid.', startMs: 0, endMs: 900 },
        { speaker: 'user', text: 'I was charged twice.', startMs: 1200, endMs: 3000 },
      ],
      duration: 47,
    });

    expect((await send(ended('call_1', REID))).status).toBe(200);
    const linked = await waitFor(async () => {
      const i = await h.store.getQueueItem(item.id);
      return i?.callId === 'call_1' ? i : undefined;
    });
    expect(linked.durationSeconds).toBe(45);

    expect((await send(transcribed('call_1'))).status).toBe(200);
    await waitFor(async () => (await h.store.getQueueItem(item.id))?.transcript);

    const t = (await fetch(`${h.base}/api/queue/${item.id}/transcript`).then((r) => r.json())) as any;
    expect(t.transcript).toContain('charged twice');
    expect(t.turns).toHaveLength(2);
    expect((await queue()).queued[0].hasTranscript).toBe(true);
  });

  it('ignores a retried delivery of the same event', async () => {
    const evt = ended('call_2', REID);
    expect(await (await send(evt, { id: evt.id })).json()).toEqual({ received: true });
    expect(await (await send(evt, { id: evt.id })).json()).toEqual({ duplicate: true });
  });

  it('does not attach a call to someone else\'s queue item', async () => {
    const call = await as(MAYA);
    await call.call('triage_call', { intent: 'dispute', summary: 'Wrong charge.' });
    await call.close();
    const item = (await queue()).queued[0];

    await send(ended('call_3', REID)); // different caller
    await new Promise((r) => setTimeout(r, 80));
    expect((await h.store.getQueueItem(item.id))?.callId).toBeUndefined();
  });
});

describe('dashboard config', () => {
  it('serves the scoring rules the dashboard legend renders', async () => {
    const cfg = (await fetch(`${h.base}/api/config`).then((r) => r.json())) as any;
    expect(cfg.agingPerMin).toBe(2);
    expect(cfg.scoring.intents.find((i: any) => i.intent === 'fraud_in_progress')).toMatchObject({ points: 100, tier: 'critical' });
    expect(cfg.scoring.valueTiers.at(-1)).toEqual({ minUsd: 1_000_000, points: 40 });
    const health = (await fetch(`${h.base}/api/health`).then((r) => r.json())) as any;
    expect(health).toMatchObject({ ok: true, store: 'memory', dial: 'mock', mcpAuth: true, webhookVerify: true });
  });
});
