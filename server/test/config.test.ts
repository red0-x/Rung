import { describe, expect, it } from 'vitest';
import { checkConfig, loadConfig } from '../src/config.js';
import { renderPrompt, loadPromptTemplate } from '../src/prompt.js';
import { defaultSettings } from '../src/scoring.js';
import { mergeSettings, normalizeSettings } from '../src/settings.js';

describe('config', () => {
  it('mock Dial without a key: mock pool, codes shown, memory store without Supabase', () => {
    const c = loadConfig({});
    expect(c.dialMock).toBe(true);
    expect(c.demoShowCodes).toBe(true);
    expect(c.store).toBe('memory');
    expect(c.numberPool).toEqual([
      { id: 'mock_num_1', number: '+15550000001', mock: true },
      { id: 'mock_num_2', number: '+15550000002', mock: true },
    ]);
    expect(loadConfig({ DEMO_SHOW_CODES: 'false' }).demoShowCodes).toBe(true); // forced in mock mode
  });

  it('live Dial: demo codes default on (SMS to real phones may not deliver), can be turned off', () => {
    expect(loadConfig({ DIAL_API_KEY: 'k' }).demoShowCodes).toBe(true);
    expect(loadConfig({ DIAL_API_KEY: 'k', DEMO_SHOW_CODES: 'false' }).demoShowCodes).toBe(false);
    expect(loadConfig({ DIAL_API_KEY: 'k', DIAL_MOCK: 'true' }).dialMock).toBe(true);
  });

  it('picks the Supabase store when its credentials exist, unless STORE says otherwise', () => {
    expect(loadConfig({ SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' }).store).toBe('supabase');
    expect(loadConfig({ SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k', STORE: 'memory' }).store).toBe('memory');
  });

  it('parses DIAL_NUMBER_POOL', () => {
    const c = loadConfig({ DIAL_NUMBER_POOL: '[{"id":"num_1","number":"+14155550000"}]' });
    expect(c.numberPool).toEqual([{ id: 'num_1', number: '+14155550000', mock: false }]);
    expect(() => loadConfig({ DIAL_NUMBER_POOL: 'nope' })).toThrow();
  });

  it('production refuses to boot without the webhook secret, and never enables dev auth', () => {
    const prod = loadConfig({ NODE_ENV: 'production', ENABLE_DEV: 'true', SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' });
    expect(prod.enableDev).toBe(false);
    expect(checkConfig(prod).fatal.join()).toContain('DIAL_WEBHOOK_SECRET');
    expect(checkConfig(prod).fatal.join()).toContain('MCP_SHARED_SECRET');
    const ok = loadConfig({ NODE_ENV: 'production', DIAL_WEBHOOK_SECRET: 'w', MCP_SHARED_SECRET: 'm', SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' });
    expect(checkConfig(ok).fatal).toEqual([]);
    expect(checkConfig(loadConfig({ NODE_ENV: 'development' })).fatal).toEqual([]);
  });
});

describe('sms text', () => {
  it('is plain ASCII', async () => {
    const { smsText } = await import('../src/mcp.js');
    expect(smsText('Caf\u00e9 \u2014 \u201Cok\u201D')).toBe('Cafe - "ok"');
  });
});

describe('settings', () => {
  it('merges partial intents per key and per field', () => {
    const s = mergeSettings(defaultSettings('X'), { intents: { dispute: { points: 50 } }, agingPerMin: 10 });
    expect(s.intents.dispute).toEqual({ label: 'card dispute', points: 50, tier: 'normal', sensitive: false });
    expect(s.intents.fraud_in_progress.points).toBe(100);
    expect(s.agingPerMin).toBe(10);
  });
  it('normalizes stored jsonb: defaults fill gaps, junk is dropped', () => {
    const s = normalizeSettings({ greeting: 'Hi.', agingPerMin: 'fast', intents: { dispute: { points: 30 } } }, 'X');
    expect(s.greeting).toBe('Hi.');
    expect(s.agingPerMin).toBe(2);
    expect(s.intents.dispute.points).toBe(30);
    expect(s.baselineHoldMin).toBe(23);
  });
});

describe('prompt template', () => {
  it('renders every placeholder from org settings', () => {
    const s = mergeSettings(defaultSettings('Demo Bank'), { greeting: 'Thanks for calling Demo Bank.', tone: 'crisp' });
    const p = renderPrompt(loadPromptTemplate(), 'Demo Bank', s);
    expect(p).not.toMatch(/\{\{|<!--/);
    expect(p).toContain("Demo Bank's priority line");
    expect(p).toContain('Thanks for calling Demo Bank.');
    expect(p).toContain('Tone: crisp.');
    expect(p).toContain('moving money (money_movement), account change (account_change)');
    expect(p).toContain('- fraud_in_progress: suspected fraud');
  });
});
