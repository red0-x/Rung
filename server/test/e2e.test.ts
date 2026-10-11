import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSimCall } from '../src/sim/client.js';
import { signDialPayload } from '../src/webhook.js';
import {
  BANK_EMAIL,
  CLINIC_EMAIL,
  JAMES,
  MARIA,
  NEW_CALLER,
  WEBHOOK_SECRET,
  boot,
  lastCode,
  waitFor,
  type Harness,
} from './helpers.js';

let h: Harness;
beforeEach(async () => {
  h = await boot();
});
afterEach(() => h.close());

/** A simulated call into the bank (via its MCP token) unless another token is given. */
const as = (phone: string | null, extra: Parameters<typeof openSimCall>[0] extends infer O ? Partial<O> : never = {}) =>
  openSimCall({ baseUrl: h.base, phone, orgToken: h.bank.mcpToken, ...extra });

const queue = async (email = BANK_EMAIL) => (await h.api('/queue', { as: email })).body;

const enqueue = async (phone: string, args: Record<string, unknown>, orgToken = h.bank.mcpToken) => {
  const call = await openSimCall({ baseUrl: h.base, phone, orgToken });
  const r = await call.call('triage_call', args);
  await call.close();
  return r;
};

const initBody = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } },
};
const rawPost = (base: string, path: string, headers: Record<string, string> = {}, body: unknown = initBody) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify(body),
  });

describe('MCP routing and security', () => {
  it('accepts an org token in the URL and rejects unknown tokens', async () => {
    expect((await rawPost(h.base, `/mcp/${h.bank.mcpToken}`)).status).toBe(200);
    expect((await rawPost(h.base, '/mcp/nope')).status).toBe(401);
  });

  it('falls back to X-Dial-Agent-Number on plain /mcp, and 401s an unknown dialed number', async () => {
    await h.api('/org/number', { body: { numberId: 'mock_num_1' } });
    const call = await openSimCall({ baseUrl: h.base, phone: MARIA, agentNumber: '+15550000001' });
    expect((await call.call('lookup_caller')).data).toMatchObject({ known: true, first_name: 'Maria', org_name: 'Demo Bank' });
    await call.close();
    expect((await rawPost(h.base, '/mcp', { 'x-dial-agent-number': '+15550009999' })).status).toBe(401);
  });

  it('requires MCP_SHARED_SECRET on plain /mcp when set; tool discovery works with no org', async () => {
    const s = await boot({ MCP_SHARED_SECRET: 'shh' });
    try {
      expect((await rawPost(s.base, '/mcp')).status).toBe(401);
      expect((await rawPost(s.base, '/mcp', { 'x-mcp-secret': 'wrong' })).status).toBe(401);
      expect((await rawPost(s.base, '/mcp', { 'x-mcp-secret': 'shh' })).status).toBe(200);
      expect((await rawPost(s.base, '/mcp', { authorization: 'Bearer shh' })).status).toBe(200);
      expect((await rawPost(s.base, `/mcp/${s.bank.mcpToken}`)).status).toBe(200); // per-org URL still works

      // Discovery: no / templated agent number -> tools listed, tool calls fail politely.
      const d = await openSimCall({ baseUrl: s.base, phone: '{{user_number}}', agentNumber: '{{agent_number}}', secret: 'shh' });
      expect((await d.tools()).sort()).toEqual(['check_code', 'lookup_caller', 'save_profile', 'send_code', 'triage_call']);
      const r = await d.call('lookup_caller');
      expect(r).toMatchObject({ isError: true, data: { error: 'org_unknown' } });
      await d.close();

      // With the secret, an unclaimed (valid) number lists tools too; tool calls answer org_unknown.
      const u = await openSimCall({ baseUrl: s.base, phone: MARIA, agentNumber: '+15550009999', secret: 'shh' });
      expect(await u.tools()).toHaveLength(5);
      expect((await u.call('lookup_caller')).data.error).toBe('org_unknown');
      await u.close();

      // With the secret, the dialed number picks the org.
      await s.api('/org/number', { body: { numberId: 'mock_num_2' }, as: CLINIC_EMAIL });
      const c = await openSimCall({ baseUrl: s.base, phone: MARIA, agentNumber: '+15550000002', secret: 'shh' });
      expect((await c.call('lookup_caller')).data).toMatchObject({ name: 'Dana Brooks', org_name: 'Northside Clinic' });
      await c.close();
    } finally {
      await s.close();
    }
  });

  it('exposes exactly the five tools, none of which take a phone number', async () => {
    const call = await as(NEW_CALLER);
    expect((await call.tools()).sort()).toEqual(['check_code', 'lookup_caller', 'save_profile', 'send_code', 'triage_call']);
    await call.close();
  });

  it('refuses tool calls with no valid caller number (e.g. Dial tool discovery, template values)', async () => {
    for (const phone of [null, '{{user_number}}', '4155550111']) {
      const call = await as(phone);
      const r = await call.call('lookup_caller');
      expect(r.isError).toBe(true);
      expect(r.data.error).toBe('caller_unknown');
      await call.close();
    }
  });

  it('refuses outbound calls', async () => {
    const call = await as(NEW_CALLER, { direction: 'outbound' });
    expect((await call.call('lookup_caller')).data.error).toBe('not_allowed');
    await call.close();
  });
});

describe('hello call', () => {
  it('greets a seeded returning caller by name with their last issue', async () => {
    const call = await as(MARIA);
    const r = await call.call('lookup_caller');
    expect(r.data).toMatchObject({ known: true, name: 'Maria Alvarez', first_name: 'Maria', last_issue: { when: '5 days ago' }, has_open_request: false });
    expect(r.data.last_issue.summary).toContain('$38');
    await call.close();
  });
});

describe('first call: enrollment', () => {
  it('walks a new caller from unknown to saved profile; SMS goes from the org number with the org name', async () => {
    await h.api('/org/number', { body: { numberId: 'mock_num_1' } });
    h.bank = (await h.store.getOrg(h.bank.id))!;
    const call = await as(NEW_CALLER);
    expect((await call.call('lookup_caller')).data).toMatchObject({ known: false, name: null, last_issue: null });
    expect((await call.call('save_profile', { name: 'Sam Okafor', consent: true })).data.error).toBe('verification_required');

    expect((await call.call('send_code')).data.sent).toBe(true);
    expect(h.dial.sent).toHaveLength(1);
    expect(h.dial.sent[0]).toMatchObject({ to: NEW_CALLER, from: '+15550000001' });
    expect(h.dial.sent[0]!.body).toMatch(/^Demo Bank: your verification code is \d{6}\./);
    expect(h.dial.sent[0]!.body).toMatch(/^[\x20-\x7E]+$/);
    const code = lastCode(h.dial);

    const wrong = await call.call('check_code', { code: code === '000000' ? '111111' : '000000' });
    expect(wrong.data).toMatchObject({ verified: false, attempts_left: 4 });
    expect((await call.call('check_code', { code })).data.verified).toBe(true);

    expect((await call.call('save_profile', { name: 'Sam Okafor', consent: false })).data.error).toBe('consent_required');
    expect((await call.call('save_profile', { name: 'Sam Okafor', consent: true })).data.saved).toBe(true);
    expect((await call.call('lookup_caller')).data).toMatchObject({ known: true, name: 'Sam Okafor', first_name: 'Sam' });
    await call.close();

    const profiles = (await h.api('/profiles')).body.profiles;
    expect(profiles.find((p: any) => p.name === 'Sam Okafor')).toMatchObject({ phoneMasked: '+1••••••0111', verified: true });
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

  it('reports SMS failure to the agent when codes are hidden; continues with the dashboard fallback when shown', async () => {
    // Live config with codes hidden (the harness still injects the mock client, so nothing leaves the machine).
    const strict = await boot({ DIAL_API_KEY: 'k', DEMO_SHOW_CODES: 'false' });
    try {
      strict.dial.failNextSms = true;
      const c1 = await openSimCall({ baseUrl: strict.base, phone: NEW_CALLER, orgToken: strict.bank.mcpToken });
      expect((await c1.call('send_code')).data.error).toBe('sms_failed');
      await c1.close();
      expect((await strict.api('/dev/codes')).status).toBe(404);
    } finally {
      await strict.close();
    }

    h.dial.failNextSms = true;
    const c2 = await as(NEW_CALLER);
    expect((await c2.call('send_code')).data.sent).toBe(true);
    const codes = (await h.api('/dev/codes')).body;
    expect(codes.codes).toHaveLength(1);
    expect(codes.codes[0]).toMatchObject({ phoneMasked: '+1••••••0111' });
    expect(codes.codes[0].code).toMatch(/^\d{6}$/);
    expect(JSON.stringify(codes)).not.toContain(NEW_CALLER);
    await c2.close();
  });
});

describe('verification gate on sensitive requests', () => {
  it('requires a fresh code to queue a money movement, then allows it', async () => {
    const call = await as(JAMES);
    const args = { intent: 'money_movement', amount_usd: 9000, summary: 'Wants to wire $9,000 to a contractor.' };
    const blocked = await call.call('triage_call', args);
    expect(blocked.data.error).toBe('verification_required');
    expect((await queue()).queued).toHaveLength(0);

    await call.call('send_code');
    await call.call('check_code', { code: lastCode(h.dial) });
    expect((await call.call('triage_call', args)).data.queued).toBe(true);
    expect((await queue()).queued[0]).toMatchObject({ trust: 'verified', returning: true });
    await call.close();
  });

  it('does not gate urgent-but-not-sensitive requests like fraud in progress', async () => {
    const r = await enqueue(NEW_CALLER, { intent: 'fraud_in_progress', amount_usd: 4200, summary: 'Cards charged abroad right now.', caller_name: 'Pat' });
    expect(r.data.queued).toBe(true);
    expect((await queue()).queued[0]).toMatchObject({ name: 'Pat', trust: 'new', returning: false });
  });
});

describe('priority queue', () => {
  it('ranks the three demo calls: fraud (116), then the $10M account (60), then the $12 dispute (20)', async () => {
    await enqueue(NEW_CALLER, { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 charge.', caller_name: 'Sam' });
    await enqueue(JAMES, { intent: 'account_opening', amount_usd: 10_000_000, summary: 'Opening a $10M corporate account.' });
    const fraud = await enqueue(MARIA, { intent: 'fraud_in_progress', amount_usd: 4200, summary: 'Unknown charges happening now.' });

    expect(fraud.data.position).toBe(1);
    expect(fraud.data.say_to_caller).toContain('Demo Bank');
    const q = await queue();
    expect(q.queued.map((i: any) => i.intent)).toEqual(['fraud_in_progress', 'account_opening', 'dispute']);
    expect(q.queued.map((i: any) => i.score.total)).toEqual([116, 60, 20]);
    expect(q.queued.map((i: any) => i.rank)).toEqual([1, 2, 3]);
    expect(q.queued[0]).toMatchObject({
      reason: 'Urgent: suspected fraud · $4,200 · waited 0 min',
      tier: 'critical',
      tierLabel: 'Critical',
      intentLabel: 'suspected fraud',
      name: 'Maria Alvarez',
      returning: true,
      savedMin: 26,
    });
    expect(q.queued[2]).toMatchObject({ returning: false, savedMin: 23 });
    expect(q.stats.waiting).toBe(3);
    expect(q.timeSaved).toEqual({
      totalMin: 26 + 26 + 23,
      callers: 3,
      baselineHoldMin: 23,
      reexplainMin: 3,
      returningCallers: 2,
      formula: '23 min hold avoided per caller + 3 min re-explaining avoided per returning caller',
    });
  });

  it('lets a long wait overtake a fresh $10M account (so small issues are not starved)', async () => {
    await enqueue(NEW_CALLER, { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 charge.' });
    h.advanceMin(45);
    await enqueue(JAMES, { intent: 'account_opening', amount_usd: 10_000_000, summary: 'Opening a $10M account.' });
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
    await enqueue(MARIA, { intent: 'dispute', summary: 'Another duplicate charge.' });
    const q = await queue();
    const item = q.queued[0];
    expect(JSON.stringify(q)).not.toContain(MARIA);
    expect(item.phoneMasked).toBe('+1••••••0101');

    const cb = await h.api(`/queue/${item.id}/callback`, { method: 'POST' });
    expect(cb.body).toEqual({ phone: MARIA, tel: `tel:${MARIA}` });
    const after = await queue();
    expect(after.queued).toHaveLength(0);
    expect(after.inProgress[0]).toMatchObject({ id: item.id, status: 'in_progress' });

    expect((await h.api(`/queue/${item.id}/done`, { method: 'POST' })).body).toEqual({ ok: true });
    expect((await queue()).done[0]).toMatchObject({ id: item.id, status: 'done' });
  });

  it("editing one org's rules changes that org's ranking only", async () => {
    await enqueue(NEW_CALLER, { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 charge.' });
    await enqueue(JAMES, { intent: 'account_opening', amount_usd: 10_000_000, summary: 'Opening a $10M account.' });
    await enqueue(NEW_CALLER, { intent: 'dispute', amount_usd: 12, summary: 'Duplicate $12 charge.' }, h.clinic.mcpToken);
    const patched = await h.api('/org', { method: 'PATCH', body: { settings: { intents: { dispute: { points: 90 } } } } });
    expect(patched.status).toBe(200);
    expect(patched.body.org.settings.intents.dispute).toMatchObject({ points: 90, label: 'card dispute' });
    expect((await queue()).queued.map((i: any) => i.intent)).toEqual(['dispute', 'account_opening']);
    expect((await queue(CLINIC_EMAIL)).queued[0].score.urgency).toBe(20);
    expect((await h.api('/org', { method: 'PATCH', body: { settings: { agingPerMin: 'fast' } } })).body.error).toBe('invalid');
  });
});

describe('tenancy isolation', () => {
  it('the same phone at two orgs has separate profiles, verification and queue items', async () => {
    const bankCall = await as(MARIA);
    const clinicCall = await as(MARIA, { orgToken: h.clinic.mcpToken });
    expect((await bankCall.call('lookup_caller')).data).toMatchObject({ name: 'Maria Alvarez', org_name: 'Demo Bank' });
    expect((await clinicCall.call('lookup_caller')).data).toMatchObject({ name: 'Dana Brooks', org_name: 'Northside Clinic' });

    // Verify at the bank only.
    await bankCall.call('send_code');
    const bankCode = lastCode(h.dial);
    expect(h.dial.sent.at(-1)!.body).toContain('Demo Bank');
    expect((await clinicCall.call('check_code', { code: bankCode })).data.verified).toBe(false);
    expect((await bankCall.call('check_code', { code: bankCode })).data.verified).toBe(true);
    // The bank verification does not authorize a sensitive request at the clinic.
    expect((await clinicCall.call('triage_call', { intent: 'account_change', summary: 'Wants to change her address.' })).data.error).toBe(
      'verification_required',
    );
    expect((await bankCall.call('triage_call', { intent: 'account_change', summary: 'Wants to change her address.' })).data.queued).toBe(true);
    await clinicCall.call('triage_call', { intent: 'general_question', summary: 'Asks about flu shot hours.' });
    await bankCall.close();
    await clinicCall.close();

    const bq = await queue(BANK_EMAIL);
    const cq = await queue(CLINIC_EMAIL);
    expect(bq.queued).toHaveLength(1);
    expect(cq.queued).toHaveLength(1);
    expect(bq.queued[0]).toMatchObject({ name: 'Maria Alvarez', intent: 'account_change', trust: 'verified' });
    expect(cq.queued[0]).toMatchObject({ name: 'Dana Brooks', intent: 'general_question', trust: 'recognized', intentLabel: 'appointment question' });

    // Dashboard data never crosses orgs.
    expect((await h.api('/dev/codes', { as: CLINIC_EMAIL })).body.codes).toEqual([]);
    const clinicProfiles = (await h.api('/profiles', { as: CLINIC_EMAIL })).body.profiles.map((p: any) => p.name).sort();
    expect(clinicProfiles).toEqual(['Dana Brooks', 'Theo Park']);
    expect((await h.api('/dev/dial-log', { as: CLINIC_EMAIL })).body.sms).toEqual([]);
    expect((await h.api('/dev/dial-log')).body.sms).toHaveLength(1);
  });
});

describe('dashboard auth', () => {
  it('401 without a token or with a bad one; health stays public', async () => {
    expect((await h.api('/queue', { as: null })).status).toBe(401);
    expect((await h.api('/me', { as: null })).body).toEqual({ error: 'unauthorized' });
    const bad = await fetch(`${h.base}/api/queue`, { headers: { authorization: 'Bearer not-a-jwt' } });
    expect(bad.status).toBe(401);
    expect((await h.api('/health', { as: null })).body).toMatchObject({ ok: true, store: 'memory', dial: 'mock' });
  });

  it('dev tokens are refused when dev mode is off', async () => {
    const s = await boot({ ENABLE_DEV: 'false' });
    try {
      expect((await s.api('/me')).status).toBe(401);
    } finally {
      await s.close();
    }
  });

  it("404s another org's item, for every item route", async () => {
    await enqueue(MARIA, { intent: 'dispute', summary: 'Duplicate charge.' });
    const id = (await queue()).queued[0].id;
    for (const [path, method] of [
      [`/queue/${id}/callback`, 'POST'],
      [`/queue/${id}/done`, 'POST'],
      [`/queue/${id}/transcript`, 'GET'],
    ] as const) {
      expect(await h.api(path, { method, as: CLINIC_EMAIL })).toEqual({ status: 404, body: { error: 'not_found' } });
    }
    expect((await queue()).queued[0].status).toBe('queued');
    expect((await h.api('/queue/nope/callback', { method: 'POST' })).status).toBe(404);
  });

  it('a signed-in user with no org gets 403 no_org, except /api/me and POST /api/org', async () => {
    const who = 'newco@test.rung';
    const me = await h.api('/me', { as: who });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ user: { email: who }, org: null, role: null, platform: { dial: 'mock', demoShowCodes: true, enableDev: true, requireVerification: true } });
    for (const p of ['/queue', '/org', '/numbers', '/prompt-preview', '/profiles', '/dev/codes']) {
      expect(await h.api(p, { as: who })).toEqual({ status: 403, body: { error: 'no_org' } });
    }
    const created = await h.api('/org', { body: { name: 'Acme Plumbing' }, as: who });
    expect(created.status).toBe(201);
    expect(created.body.org).toMatchObject({ name: 'Acme Plumbing', slug: 'acme-plumbing', dialNumber: null, publishedAt: null });
    expect(created.body.org.mcpUrl).toMatch(/\/mcp\/rung_[A-Za-z0-9_-]+$/);
    expect(created.body.org.settings.baselineHoldMin).toBe(23);
    expect((await h.api('/me', { as: who })).body).toMatchObject({ org: { name: 'Acme Plumbing' }, role: 'admin' });
    expect((await h.api('/queue', { as: who })).body.queued).toEqual([]);
    expect(await h.api('/org', { body: { name: 'Again' }, as: who })).toEqual({ status: 409, body: { error: 'already_member' } });
  });

  it('/api/me returns the org view with its MCP URL', async () => {
    const me = (await h.api('/me')).body;
    expect(me.org).toMatchObject({ name: 'Demo Bank', slug: 'demo-bank', dialNumberMock: false, mcpUrl: `http://localhost:8787/mcp/${h.bank.mcpToken}` });
    expect(me.role).toBe('admin');
  });
});

describe('numbers, prompt preview and publish', () => {
  it('claims a pool number, refuses a taken one, and releases the old one on switch', async () => {
    const list = (await h.api('/numbers')).body.numbers;
    expect(list).toEqual([
      { id: 'mock_num_1', number: '+15550000001', mock: true, available: true, mine: false },
      { id: 'mock_num_2', number: '+15550000002', mock: true, available: true, mine: false },
    ]);
    const claimed = await h.api('/org/number', { body: { numberId: 'mock_num_1' } });
    expect(claimed.body.org).toMatchObject({ dialNumber: '+15550000001', dialNumberId: 'mock_num_1', dialNumberMock: true });
    expect(await h.api('/org/number', { body: { numberId: 'mock_num_1' }, as: CLINIC_EMAIL })).toEqual({ status: 409, body: { error: 'number_taken' } });
    expect((await h.api('/org/number', { body: { numberId: 'nope' } })).status).toBe(404);

    await h.api('/org/number', { body: { numberId: 'mock_num_2' } });
    const after = (await h.api('/numbers', { as: CLINIC_EMAIL })).body.numbers;
    expect(after[0]).toMatchObject({ id: 'mock_num_1', available: true, mine: false });
    expect(after[1]).toMatchObject({ id: 'mock_num_2', available: false, mine: false });
    expect((await h.api('/org/number', { body: { numberId: 'mock_num_1' }, as: CLINIC_EMAIL })).status).toBe(200);
  });

  it('previews the rendered prompt from saved settings and from an unsaved draft', async () => {
    const saved = (await h.api('/prompt-preview')).body.prompt;
    expect(saved).toContain("Demo Bank's priority line");
    expect(saved).not.toContain('{{');
    const draft = (await h.api('/prompt-preview', { body: { name: 'Draft Bank', settings: { greeting: 'Hello from Draft Bank.' } } })).body.prompt;
    expect(draft).toContain("Draft Bank's priority line");
    expect(draft).toContain('Hello from Draft Bank.');
    expect((await h.api('/org')).body.org.name).toBe('Demo Bank'); // draft not saved
  });

  it('publish needs a number, then PATCHes /numbers/{id} with the rendered prompt (recorded by the mock)', async () => {
    expect((await h.api('/org/publish', { method: 'POST' })).body.error).toBe('no_number');
    await h.api('/org/number', { body: { numberId: 'mock_num_1' } });
    await h.api('/org', { method: 'PATCH', body: { settings: { greeting: 'Welcome to Demo Bank, fraud line.' } } });
    const pub = await h.api('/org/publish', { method: 'POST' });
    expect(pub.status).toBe(200);
    expect(pub.body).toMatchObject({ ok: true, mock: true, numberId: 'mock_num_1', number: '+15550000001', request: { method: 'PATCH', path: '/numbers/mock_num_1' } });
    expect(pub.body.request.body.inboundInstruction).toContain('Welcome to Demo Bank, fraud line.');
    expect(h.dial.patches).toEqual([{ numberId: 'mock_num_1', inboundInstruction: pub.body.request.body.inboundInstruction }]);
    const log = (await h.api('/dev/dial-log')).body;
    expect(log.mock).toBe(true);
    expect(log.patches).toHaveLength(1);
    expect(log.patches[0]).toMatchObject({ numberId: 'mock_num_1', inboundInstruction: pub.body.request.body.inboundInstruction });
    expect((await h.api('/dev/dial-log', { as: CLINIC_EMAIL })).body.patches).toEqual([]);
    expect((await h.api('/org')).body.org.publishedAt).toBe(h.clock.t);
  });
});

describe('dev reset', () => {
  it("reseeds only the caller's org", async () => {
    await enqueue(NEW_CALLER, { intent: 'dispute', summary: 'Duplicate charge.' });
    await enqueue(NEW_CALLER, { intent: 'dispute', summary: 'Duplicate charge.' }, h.clinic.mcpToken);
    const tokenBefore = (await h.api('/me')).body.org.mcpUrl;
    expect((await h.api('/dev/reset', { method: 'POST' })).body).toEqual({ ok: true });
    expect((await queue()).queued).toEqual([]);
    expect((await queue(CLINIC_EMAIL)).queued).toHaveLength(1);
    expect((await h.api('/profiles')).body.profiles.map((p: any) => p.name).sort()).toEqual(['James Whitfield', 'Maria Alvarez']);
    expect((await h.api('/me')).body.org.mcpUrl).toBe(tokenBefore);
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

  const ended = (callId: string, from: string, to = '+15550000001') => ({
    id: `evt_end_${callId}`,
    object: 'event',
    type: 'call.ended',
    version: 1,
    createdAt: new Date(h.clock.t + 45_000).toISOString(),
    relatedObject: { id: callId, type: 'call', url: `/api/v1/calls/${callId}` },
    data: { callId, from, to, direction: 'inbound', durationSeconds: 45, status: 'completed', canceled: false, failureReason: null, transcriptAvailable: true },
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

  beforeEach(async () => {
    await h.api('/org/number', { body: { numberId: 'mock_num_1' } });
    await h.api('/org/number', { body: { numberId: 'mock_num_2' }, as: CLINIC_EMAIL });
  });

  it('rejects unsigned, wrongly signed, and stale deliveries', async () => {
    const evt = ended('call_x', MARIA);
    expect((await fetch(`${h.base}/webhooks/dial`, { method: 'POST', body: JSON.stringify(evt) })).status).toBe(401);
    expect((await send(evt, { secret: 'whsec_wrong' })).status).toBe(401);
    expect((await send(evt, { at: h.clock.t - 10 * 60_000 })).status).toBe(401);
    expect((await send(evt)).status).toBe(200);
  });

  it('call.ended resolves the org from data.to; call.transcribed fetches the call and stores the transcript', async () => {
    await enqueue(MARIA, { intent: 'dispute', summary: 'Duplicate charge.' });
    await enqueue(MARIA, { intent: 'general_question', summary: 'Flu shot hours.' }, h.clinic.mcpToken);
    const bankItem = (await queue()).queued[0];
    const clinicItem = (await queue(CLINIC_EMAIL)).queued[0];

    h.dial.calls.set('call_1', {
      id: 'call_1',
      from: MARIA,
      to: '+15550000001',
      transcript: 'agent: Hi Maria.\nuser: I was charged twice.',
      transcriptTurns: [
        { speaker: 'agent', text: 'Hi Maria.', startMs: 0, endMs: 900 },
        { speaker: 'user', text: 'I was charged twice.', startMs: 1200, endMs: 3000 },
      ],
      duration: 47,
    });

    expect((await send(ended('call_1', MARIA, '+15550000001'))).status).toBe(200);
    const linked = await waitFor(async () => {
      const i = await h.store.getQueueItem(bankItem.id);
      return i?.callId === 'call_1' ? i : undefined;
    });
    expect(linked.durationSeconds).toBe(45);
    expect((await h.store.getQueueItem(clinicItem.id))?.callId).toBeUndefined(); // same phone, other org: untouched

    expect((await send(transcribed('call_1'))).status).toBe(200);
    await waitFor(async () => (await h.store.getQueueItem(bankItem.id))?.transcript);

    const t = (await h.api(`/queue/${bankItem.id}/transcript`)).body;
    expect(t.transcript).toContain('charged twice');
    expect(t.turns).toHaveLength(2);
    expect((await queue()).queued[0]).toMatchObject({ hasTranscript: true, durationSeconds: 47 });
    expect((await h.api('/dev/dial-log')).body.callFetches).toEqual([{ callId: 'call_1', at: h.clock.t }]);
  });

  it('ignores a retried delivery of the same event', async () => {
    const evt = ended('call_2', MARIA);
    expect(await (await send(evt, { id: evt.id })).json()).toEqual({ received: true });
    expect(await (await send(evt, { id: evt.id })).json()).toEqual({ duplicate: true });
  });

  it("does not attach a call to someone else's queue item", async () => {
    await enqueue(JAMES, { intent: 'dispute', summary: 'Wrong charge.' });
    const item = (await queue()).queued[0];
    await send(ended('call_3', MARIA)); // different caller
    await new Promise((r) => setTimeout(r, 80));
    expect((await h.store.getQueueItem(item.id))?.callId).toBeUndefined();
  });
});
