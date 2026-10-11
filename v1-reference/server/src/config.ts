export interface Config {
  env: 'development' | 'production' | 'test';
  port: number;
  store: 'memory' | 'supabase';
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  dialApiKey?: string;
  dialApiBase: string;
  /** The Dial number callers dial; SMS codes are sent from it. */
  dialNumber?: string;
  /** When true, SMS is logged instead of sent and call records are faked. */
  dialMock: boolean;
  dialWebhookSecret?: string;
  mcpSharedSecret?: string;
  /** Only allow tool calls when Dial says the call is inbound. */
  requireInbound: boolean;
  orgName: string;
  agingPerMin: number;
  agingCap: number;
  avgHandleMin: number;
  repsOnShift: number;
  /** Demo-day fallback: expose pending SMS codes on the dashboard. */
  demoShowCodes: boolean;
  enableDev: boolean;
  seedFile?: string;
  seedOnBoot: boolean;
  corsOrigin: string;
  webDist?: string;
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

export function loadConfig(env: Env = process.env): Config {
  const nodeEnv = env.NODE_ENV === 'production' ? 'production' : env.NODE_ENV === 'test' ? 'test' : 'development';
  const dialApiKey = str(env.DIAL_API_KEY);
  return {
    env: nodeEnv,
    port: num(env.PORT, 8787),
    store: env.STORE === 'supabase' ? 'supabase' : 'memory',
    supabaseUrl: str(env.SUPABASE_URL),
    supabaseServiceKey: str(env.SUPABASE_SERVICE_ROLE_KEY),
    dialApiKey,
    dialApiBase: (str(env.DIAL_API_BASE) ?? 'https://api.getdial.ai/api/v1').replace(/\/+$/, ''),
    dialNumber: str(env.DIAL_NUMBER),
    dialMock: bool(env.DIAL_MOCK, !dialApiKey),
    dialWebhookSecret: str(env.DIAL_WEBHOOK_SECRET),
    mcpSharedSecret: str(env.MCP_SHARED_SECRET),
    requireInbound: bool(env.REQUIRE_INBOUND, true),
    orgName: str(env.ORG_NAME) ?? 'Demo Bank',
    agingPerMin: num(env.AGING_PER_MIN, 2),
    agingCap: num(env.AGING_CAP, 150),
    avgHandleMin: num(env.AVG_HANDLE_MIN, 4),
    repsOnShift: Math.max(1, num(env.REPS_ON_SHIFT, 1)),
    demoShowCodes: bool(env.DEMO_SHOW_CODES, false),
    enableDev: bool(env.ENABLE_DEV, nodeEnv !== 'production'),
    seedFile: str(env.SEED_FILE),
    seedOnBoot: bool(env.SEED_ON_BOOT, true),
    corsOrigin: str(env.CORS_ORIGIN) ?? '*',
    webDist: str(env.WEB_DIST),
  };
}

/** Returns human-readable problems. `fatal` ones should stop boot. */
export function checkConfig(cfg: Config): { fatal: string[]; warnings: string[] } {
  const fatal: string[] = [];
  const warnings: string[] = [];
  const prod = cfg.env === 'production';

  if (!cfg.mcpSharedSecret) {
    (prod ? fatal : warnings).push('MCP_SHARED_SECRET is not set: anyone who finds /mcp can call your tools.');
  }
  if (!cfg.dialWebhookSecret && !cfg.dialMock) {
    (prod ? fatal : warnings).push('DIAL_WEBHOOK_SECRET is not set: webhook signatures are not being verified.');
  }
  if (!cfg.dialMock && !cfg.dialNumber) {
    fatal.push('DIAL_NUMBER is required when DIAL_API_KEY is set (SMS codes are sent from it).');
  }
  if (cfg.store === 'supabase' && (!cfg.supabaseUrl || !cfg.supabaseServiceKey)) {
    fatal.push('STORE=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  if (cfg.dialMock) warnings.push('Dial is in MOCK mode: SMS codes are logged, not sent.');
  if (cfg.demoShowCodes) warnings.push('DEMO_SHOW_CODES is on: pending SMS codes are visible on the dashboard API.');
  return { fatal, warnings };
}
