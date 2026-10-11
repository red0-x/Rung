export interface PoolNumber {
  id: string;
  number: string;
  mock: boolean;
}

export interface Config {
  env: 'development' | 'production' | 'test';
  port: number;
  /** Base URL Dial reaches us on; used to build each org's MCP URL. */
  publicUrl: string;
  store: 'memory' | 'supabase';
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  dialApiKey?: string;
  dialApiBase: string;
  /** True when DIAL_API_KEY is blank (or DIAL_MOCK=true): SMS, number patches and call fetches are recorded, not sent. */
  dialMock: boolean;
  dialWebhookSecret?: string;
  /** Pre-provisioned Dial numbers the setup wizard can claim. */
  numberPool: PoolNumber[];
  /** Optional shared secret for the plain `/mcp` (agent-number fallback) route. Per-org URL tokens don't need it. */
  mcpSharedSecret?: string;
  /** Only allow tool calls when Dial says the call is inbound. */
  requireInbound: boolean;
  /** Demo-day fallback: expose pending SMS codes on the dashboard. Default on; forced on in Dial mock mode. */
  demoShowCodes: boolean;
  /** Dev conveniences (`Bearer dev:<email>`, /api/dev/reset). Never on in production. */
  enableDev: boolean;
  seedOnBoot: boolean;
  demoBankEmail: string;
  demoClinicEmail: string;
  corsOrigin: string;
  promptTemplatePath?: string;
}

type Env = Record<string, string | undefined>;

const num = (v: string | undefined, d: number): number => {
  if (v === undefined || v.trim() === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const bool = (v: string | undefined, d: boolean): boolean =>
  v === undefined || v.trim() === '' ? d : /^(1|true|yes|on)$/i.test(v.trim());

const str = (v: string | undefined): string | undefined => (v && v.trim() !== '' ? v.trim() : undefined);

export const MOCK_POOL: PoolNumber[] = [
  { id: 'mock_num_1', number: '+15550000001', mock: true },
  { id: 'mock_num_2', number: '+15550000002', mock: true },
];

export function parseNumberPool(raw: string | undefined): PoolNumber[] {
  const s = str(raw);
  if (!s) return MOCK_POOL.map((n) => ({ ...n }));
  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch {
    throw new Error('DIAL_NUMBER_POOL must be a JSON array of {id, number}');
  }
  if (!Array.isArray(parsed)) throw new Error('DIAL_NUMBER_POOL must be a JSON array of {id, number}');
  return parsed.map((p: any) => {
    if (!p || typeof p.id !== 'string' || typeof p.number !== 'string') {
      throw new Error('DIAL_NUMBER_POOL entries need string id and number');
    }
    return { id: p.id, number: p.number, mock: p.mock === true };
  });
}

export function loadConfig(env: Env = process.env): Config {
  const nodeEnv = env.NODE_ENV === 'production' ? 'production' : env.NODE_ENV === 'test' ? 'test' : 'development';
  const prod = nodeEnv === 'production';
  const dialApiKey = str(env.DIAL_API_KEY);
  // DIAL_MOCK=true forces the mock even with a key (local testing without real SMS/patches).
  const dialMock = bool(env.DIAL_MOCK, false) || !dialApiKey;
  const supabaseUrl = str(env.SUPABASE_URL);
  const supabaseServiceKey = str(env.SUPABASE_SERVICE_ROLE_KEY);
  const port = num(env.PORT, 8787);
  const store =
    env.STORE === 'supabase' || env.STORE === 'memory'
      ? env.STORE
      : supabaseUrl && supabaseServiceKey
        ? 'supabase'
        : 'memory';
  return {
    env: nodeEnv,
    port,
    publicUrl: (str(env.PUBLIC_URL) ?? `http://localhost:${port}`).replace(/\/+$/, ''),
    store,
    supabaseUrl,
    supabaseServiceKey,
    dialApiKey,
    dialApiBase: (str(env.DIAL_API_BASE) ?? 'https://api.getdial.ai/api/v1').replace(/\/+$/, ''),
    dialMock,
    dialWebhookSecret: str(env.DIAL_WEBHOOK_SECRET),
    numberPool: parseNumberPool(env.DIAL_NUMBER_POOL),
    mcpSharedSecret: str(env.MCP_SHARED_SECRET),
    requireInbound: bool(env.REQUIRE_INBOUND, true),
    // Dial SMS only reaches other Dial numbers until 10DLC registration, so the dashboard
    // code fallback defaults on everywhere. Live mode may set DEMO_SHOW_CODES=false explicitly.
    demoShowCodes: dialMock ? true : bool(env.DEMO_SHOW_CODES, true),
    enableDev: prod ? false : bool(env.ENABLE_DEV, true),
    seedOnBoot: bool(env.SEED_ON_BOOT, true),
    demoBankEmail: (str(env.DEMO_BANK_EMAIL) ?? 'bank@rung.demo').toLowerCase(),
    demoClinicEmail: (str(env.DEMO_CLINIC_EMAIL) ?? 'clinic@rung.demo').toLowerCase(),
    corsOrigin: str(env.CORS_ORIGIN) ?? '*',
    promptTemplatePath: str(env.PROMPT_TEMPLATE_PATH),
  };
}

/** Returns human-readable problems. `fatal` ones stop boot. */
export function checkConfig(cfg: Config): { fatal: string[]; warnings: string[] } {
  const fatal: string[] = [];
  const warnings: string[] = [];
  const prod = cfg.env === 'production';

  if (!cfg.dialWebhookSecret) {
    (prod ? fatal : warnings).push('DIAL_WEBHOOK_SECRET is not set: webhook signatures are not being verified.');
  }
  // Per-org /mcp/<mcp_token> URLs are the MCP secret. The plain /mcp fallback (org by X-Dial-Agent-Number)
  // needs MCP_SHARED_SECRET in production, otherwise it is disabled there.
  if (!cfg.mcpSharedSecret) {
    warnings.push(
      prod
        ? 'MCP_SHARED_SECRET is not set: plain /mcp (agent-number fallback) is disabled; use per-org /mcp/<token> URLs.'
        : 'MCP_SHARED_SECRET is not set: plain /mcp resolves the org from X-Dial-Agent-Number without a secret (dev only).',
    );
  }
  if (cfg.store === 'supabase' && (!cfg.supabaseUrl || !cfg.supabaseServiceKey)) {
    fatal.push('STORE=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  if (prod && (!cfg.supabaseUrl || !cfg.supabaseServiceKey)) {
    fatal.push('Production needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to verify dashboard sign-ins.');
  }
  if (prod && cfg.store === 'memory') warnings.push('Production is using the in-memory store: data is lost on restart.');
  if (!cfg.dialMock && cfg.numberPool.every((n) => n.mock)) {
    warnings.push('DIAL_API_KEY is set but DIAL_NUMBER_POOL is empty: only mock numbers can be claimed.');
  }
  if (cfg.dialMock) warnings.push('Dial is in MOCK mode: SMS, number patches and call fetches are recorded, not sent.');
  if (cfg.demoShowCodes) warnings.push('Texted codes are visible on the dashboard (/api/dev/codes).');
  return { fatal, warnings };
}
