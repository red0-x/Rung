import { describe, expect, it } from 'vitest';
import { checkConfig, loadConfig } from '../src/config.js';
import { renderPrompt, loadPromptTemplate } from '../src/prompt.js';
import { defaultSettings } from '../src/scoring.js';
import { mergeSettings, normalizeSettings } from '../src/settings.js';

describe('config', () => {
  it('verification is off unless REQUIRE_VERIFICATION=true', () => {
    expect(loadConfig({}).requireVerification).toBe(false);
    expect(loadConfig({ REQUIRE_VERIFICATION: 'true' }).requireVerification).toBe(true);
  });

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

  it('production refuses to boot without the MCP secret (not the webhook secret), and never enables dev auth', () => {
    const prod = loadConfig({ NODE_ENV: 'production', ENABLE_DEV: 'true', SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' });
    expect(prod.enableDev).toBe(false);
    expect(checkConfig(prod).fatal.join()).not.toContain('DIAL_WEBHOOK_SECRET');
    expect(checkConfig(prod).warnings.join()).toContain('webhook_secret_missing');
    expect(checkConfig(prod).fatal.join()).toContain('MCP_SHARED_SECRET');
    const ok = loadConfig({ NODE_ENV: 'production', MCP_SHARED_SECRET: 'm', SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' });
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
    const s = mergeSettings(defaultSettings('Bank of Antarctica'), { greeting: 'Thanks for calling Bank of Antarctica.', tone: 'crisp' });
    const p = renderPrompt(loadPromptTemplate(), 'Bank of Antarctica', s, { require_verification: true });
    expect(p).not.toMatch(/\{\{|<!--/);
    expect(p).toContain("Bank of Antarctica's priority line");
    expect(p).toContain('Thanks for calling Bank of Antarctica.');
    expect(p).toContain('Tone: crisp.');
    expect(p).toContain('moving money (money_movement), account change (account_change)');
    expect(p).toContain('- fraud_in_progress: suspected fraud');
    expect(p).toContain('Call send_code. Never say the code yourself.');
  });

  it('omits every texted-code step when verification is off, and stays coherent', () => {
    const p = renderPrompt(loadPromptTemplate(), 'Bank of Antarctica', defaultSettings('Bank of Antarctica'), { require_verification: false });
    expect(p).not.toMatch(/\{\{|<!--|send_code|check_code|verification code|texted|six-digit/i);
    expect(p).toContain('call lookup_caller');
    expect(p).toContain('call save_profile with the confirmed full name and consent set to true');
    expect(p).toContain('A specialist will confirm it\'s you and handle that on the callback.');
    expect(p).toContain('Call triage_call');
    expect(p).not.toMatch(/\n{3,}/);
  });

  it('asks every unsaved caller for a name, with spelling confirmation, in both modes', () => {
    for (const require_verification of [false, true]) {
      const p = renderPrompt(loadPromptTemplate(), 'Bank of Antarctica', defaultSettings('Bank of Antarctica'), { require_verification });
      expect(p).toContain('"Can I get your first and last name?"');
      expect(p).toContain('ask them to spell it, then read it back letter by letter. "That\'s N-G-U-Y-E-N, Nguyen?" Wait for a yes.');
      expect(p).toContain('"Got it, Sam Lee."');
      expect(p).toContain('If triage_call returns name_missing');
      expect(p).toContain('Never ask a saved caller for their name.');
      expect(p).toContain('"Is this still Sam Lee?"');
      expect(p.indexOf('Can I get your first and last name')).toBeLessThan(p.indexOf('Call triage_call with'));
    }
  });
});
