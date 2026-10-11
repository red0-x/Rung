import { describe, expect, it } from 'vitest';
import { restoreUrl } from '../src/vercel.js';
import { signDialPayload } from '../src/webhook.js';
import { MARIA, WEBHOOK_SECRET, boot } from './helpers.js';

describe('vercel url restore', () => {
  it('puts the original path back and keeps the other query params', () => {
    expect(restoreUrl('/api?__rung_path=/api/queue/abc/callback')).toBe('/api/queue/abc/callback');
    expect(restoreUrl('/api?__rung_path=%2Fmcp%2Frung_x-Y_z&foo=1')).toBe('/mcp/rung_x-Y_z?foo=1');
    expect(restoreUrl('/api?foo=1&__rung_path=/webhooks/dial')).toBe('/webhooks/dial?foo=1');
    expect(restoreUrl('/api/health')).toBe('/api/health'); // no rewrite marker: untouched
  });
});

describe('webhooks in production without a secret', () => {
  it('answers 503 webhook_secret_missing while the rest of the server works', async () => {
    const h = await boot({ NODE_ENV: 'production', DIAL_WEBHOOK_SECRET: '', MCP_SHARED_SECRET: 'm' });
    try {
      const r = await fetch(`${h.base}/webhooks/dial`, { method: 'POST', body: '{}' });
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ error: 'webhook_secret_missing' });
      expect((await h.api('/health', { as: null })).body).toMatchObject({ ok: true, webhookVerify: false, mcpAuth: true });
    } finally {
      await h.close();
    }
  });
});

describe('inline webhook processing (serverless)', () => {
  it('finishes the event before answering 200', async () => {
    const h = await boot({ INLINE_WEBHOOKS: 'true' });
    try {
      await h.api('/org/number', { body: { numberId: 'mock_num_1' } });
      const call = await (await import('../src/sim/client.js')).openSimCall({ baseUrl: h.base, phone: MARIA, orgToken: h.bank.mcpToken });
      await call.call('triage_call', { intent: 'dispute', summary: 'Duplicate charge.' });
      await call.close();
      const item = (await h.api('/queue')).body.queued[0];
      const evt = {
        id: 'evt_inline',
        type: 'call.ended',
        createdAt: new Date(h.clock.t + 30_000).toISOString(),
        data: { callId: 'call_inline', from: MARIA, to: '+15550000001', direction: 'inbound', durationSeconds: 30 },
      };
      const raw = JSON.stringify(evt);
      const r = await fetch(`${h.base}/webhooks/dial`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-dial-signature': signDialPayload(raw, WEBHOOK_SECRET, h.clock.t) },
        body: raw,
      });
      expect(r.status).toBe(200);
      // No waiting: the link must already be there when the 200 arrives.
      expect((await h.store.getQueueItem(item.id))?.callId).toBe('call_inline');
    } finally {
      await h.close();
    }
  });
});
