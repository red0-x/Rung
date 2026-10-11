import { describe, expect, it } from 'vitest';
import { KeewanoClient, encodeData, installIdFor, parseSqlResult, queriesFor, type Keewano } from '../src/keewano.js';
import { openSimCall } from '../src/sim/client.js';
import { MARIA, NEW_CALLER, boot } from './helpers.js';

function fake(): { k: KeewanoClient; calls: any[]; sqls: string[] } {
  const calls: any[] = [];
  const sqls: string[] = [];
  const k = new KeewanoClient({
    sdkKey: 'sdk',
    accessToken: 'tok',
    apiUrl: 'https://k.test',
    hashSecret: 's',
    dailyLimit: 25,
    ttlMs: 60_000,
    fetchImpl: (async (_u: string, init: any) => {
      calls.push(JSON.parse(init.body));
      return new Response('{}', { status: 202 });
    }) as any,
    runSql: async (_p, sql) => {
      sqls.push(sql);
      return 'SQL result for project x: 2 row(s), 2 column(s).\nkind,n\nrung_call_queued_critical_demo_bank,3\nrung_call_queued_low_demo_bank,1\n';
    },
  });
  return { k, calls, sqls };
}

describe('keewano encoding', () => {
  it('builds single-token, org-scoped data', () => {
    expect(encodeData('call_queued', 'demo-bank', 'critical')).toBe('rung_call_queued_critical_demo_bank');
    expect(encodeData('code_sent', 'Demo Bank')).toBe('rung_code_sent_demo_bank');
  });
  it('pseudonymizes the caller', () => {
    const id = installIdFor('s', 'demo-bank', MARIA);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(id).not.toContain('5555');
    expect(installIdFor('s', 'demo-bank', MARIA)).toBe(id);
    expect(installIdFor('s', 'clinic', MARIA)).not.toBe(id);
  });
  it('parses SQL text results', () => {
    expect(parseSqlResult('SQL result for project x: 1 row(s), 2 column(s).\nkind,n\na,2\n').rows).toEqual([['a', '2']]);
    expect(parseSqlResult('0 row(s), 0 column(s).\n').rows).toEqual([]);
  });
  it('scopes SQL to the org', () => {
    const q = queriesFor('demo-bank')[0]!;
    expect(q.sql).toContain('rung_call_queued_critical_demo_bank');
    expect(q.sql).not.toContain('clinic');
  });
});

describe('KeewanoClient', () => {
  it('sends batched events with no phone number', async () => {
    const { k, calls } = fake();
    k.track('call_started', 'demo-bank', MARIA, 'known');
    k.track('call_queued', 'demo-bank', MARIA, 'critical');
    await k.flush();
    expect(calls).toHaveLength(1);
    expect(calls[0].events.map((e: any) => e.data)).toEqual(['rung_call_started_known_demo_bank', 'rung_call_queued_critical_demo_bank']);
    expect(JSON.stringify(calls[0])).not.toContain(MARIA);
    expect(k.stats().sent).toBe(2);
  });
  it('never throws when delivery fails', async () => {
    const k = new KeewanoClient({
      sdkKey: 'sdk', apiUrl: 'https://k.test', hashSecret: 's', dailyLimit: 25, ttlMs: 1,
      fetchImpl: (async () => { throw new Error('down'); }) as any,
    });
    k.track('call_done', 'demo-bank', MARIA, 'low');
    await k.flush();
    expect(k.stats().failed).toBe(1);
  });
  it('formats insights and caches them', async () => {
    const { k, sqls } = fake();
    const a = await k.insights('demo-bank');
    expect(a.items[0]!.answer).toBe('critical 3 · low 1');
    const n = sqls.length;
    await k.insights('demo-bank');
    expect(sqls.length).toBe(n);
  });
  it('stops at the daily limit', async () => {
    const { k } = fake();
    (k as any).o.dailyLimit = 2;
    const v = await k.insights('demo-bank');
    expect(v.note).toMatch(/limit/i);
  });
});

describe('rung server emits keewano events', () => {
  it('tracks lookup, queue, callback and done, scoped to the org', async () => {
    const events: string[] = [];
    const stub: Keewano = {
      enabled: true,
      track: (e, org, _p, q) => void events.push(`${e}:${org}:${q ?? ''}`),
      flush: async () => {},
      insights: async () => ({ enabled: true, asOf: null, stale: false, items: [] }),
      stats: () => ({ enabled: true, insights: true, queued: 0, sent: 0, failed: 0 }),
    };
    const h = await boot({}, stub);
    try {
      const call = await openSimCall({ baseUrl: h.base, phone: NEW_CALLER, orgToken: h.bank.mcpToken });
      await call.call('lookup_caller', {});
      await call.call('triage_call', { intent: 'fraud_in_progress', summary: 'Unknown charges draining the account.' });
      await call.close();
      const q = (await h.api('/queue')).body;
      const id = q.queued[0].id;
      await h.api(`/queue/${id}/callback`, { method: 'POST', body: {} });
      await h.api(`/queue/${id}/done`, { method: 'POST', body: {} });
      expect(events).toEqual([
        'call_started:demo-bank:new',
        'call_queued:demo-bank:critical',
        'eta_text:demo-bank:skipped',
        'callback_made:demo-bank:critical',
        'call_done:demo-bank:critical',
      ]);
      const r = await h.api('/insights');
      expect(r.body.enabled).toBe(true);
      expect((await h.api('/health', { as: null })).body.keewano.enabled).toBe(true);
    } finally {
      await h.close();
    }
  });

  it('tracks saved caller context and the callback-time text, with no caller content', async () => {
    const seen: Array<{ e: string; org: string; q: string; phone: string }> = [];
    const stub: Keewano = {
      enabled: true,
      track: (e, org, phone, q) => void seen.push({ e, org, q: q ?? '', phone }),
      flush: async () => {},
      insights: async () => ({ enabled: true, asOf: null, stale: false, items: [] }),
      stats: () => ({ enabled: true, insights: true, queued: 0, sent: 0, failed: 0 }),
    };
    const h = await boot({ REQUIRE_VERIFICATION: 'false' }, stub);
    try {
      await h.api('/org/number', { body: { numberId: 'mock_num_1' } });
      const call = await openSimCall({ baseUrl: h.base, phone: NEW_CALLER, orgToken: (await h.store.getOrg(h.bank.id))!.mcpToken });
      await call.call('triage_call', { intent: 'dispute', summary: 'Duplicate charge on my card.', caller_name: 'Sam Okafor' });
      h.dial.failNextSms = true; // second caller's text is refused
      await call.call('save_profile', { name: 'Sam Okafor', consent: true, facts: { occupation: 'nurse' } });
      await call.call('update_profile', { household: 'two kids', note: 'night shifts' });
      await call.close();
      const tags = seen.map((x) => `${x.e}:${x.q}`);
      expect(tags).toContain('eta_text:sent');
      expect(tags).toContain('context_saved:1'); // save_profile with one fact
      expect(tags).toContain('context_saved:2'); // update_profile with two fields
      expect(seen.every((x) => x.org === 'demo-bank')).toBe(true);
      // The raw phone only goes to track(), which pseudonymizes it. Nothing the caller said is ever passed.
      expect(JSON.stringify(seen.map(({ e, org, q }) => ({ e, org, q })))).not.toMatch(/nurse|kids|shifts|Okafor|charge/i);
    } finally {
      await h.close();
    }
  });

  it('insights include remembered-details and text-delivery questions, scoped to the org', () => {
    const ids = queriesFor('demo-bank').map((q) => q.id);
    expect(ids).toEqual(expect.arrayContaining(['context_saved', 'eta_text']));
    for (const q of queriesFor('demo-bank')) expect(q.sql).not.toContain('clinic');
    expect(queriesFor('demo-bank').find((q) => q.id === 'eta_text')!.sql).toContain('rung_eta_text_failed_demo_bank');
  });
});
