/**
 * Stands in for a real phone: plays Dial against the Rung MCP endpoint with the
 * headers Dial adds mid-call. Run via `npm run simulate -- ...` or `npm run demo:sim`.
 */
import { parseArgs } from 'node:util';
import { openSimCall, type SimResult } from '../server/src/sim/client.js';

const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:8787' },
    'org-token': { type: 'string' },
    'agent-number': { type: 'string' },
    secret: { type: 'string' },
    from: { type: 'string' },
    name: { type: 'string' },
    intent: { type: 'string', default: 'general_question' },
    amount: { type: 'string' },
    summary: { type: 'string' },
    enroll: { type: 'boolean', default: false },
    code: { type: 'string' },
    as: { type: 'string' },
    demo: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

const HELP = `Simulate a Dial call against the Rung server (no phone needed).

  npm run simulate -- --org-token <token> --from +15555550188 --intent dispute --amount 12 \\
      --summary "Duplicate $12 charge at a coffee shop, wants it reversed." --name "Sam Okafor" --enroll

  npm run demo:sim          replay the three demo calls into Bank of Antarctica (finds its token itself)

Options
  --base          server URL (default http://localhost:8787)
  --org-token     org MCP token: connects to /mcp/<token>
  --agent-number  X-Dial-Agent-Number (the company number dialed); used by plain /mcp to pick the org
  --secret        MCP_SHARED_SECRET for plain /mcp (default: $MCP_SHARED_SECRET)
  --from          caller number, E.164 (required unless --demo)
  --intent        fraud_in_progress | medical_emergency | locked_out | payment_issue | money_movement |
                  account_change | dispute | account_opening | general_question | other
  --amount        dollars at stake
  --summary       the brief the voice agent would write (omit to only look the caller up)
  --name          caller name (new callers)
  --enroll        send_code -> check_code -> save_profile before triage
  --code          the texted code; omitted = read it from /api/dev/codes as --as
  --as            dashboard user for /api/dev/codes and token discovery (default: $DEMO_BANK_EMAIL or bank@rung.demo)
  --demo          run the three-call demo`;

if (values.help || (!values.demo && !values.from)) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

const base = values.base!.replace(/\/+$/, '');
const devEmail = values.as ?? process.env.DEMO_BANK_EMAIL ?? 'bank@rung.demo';
const secret = values.secret ?? process.env.MCP_SHARED_SECRET;
const auth = { authorization: `Bearer dev:${devEmail}` };

const show = (label: string, r: SimResult) =>
  console.log(`  ${r.isError ? 'x' : '>'} ${label}  ${JSON.stringify(r.data)}`);

function must(r: SimResult, label: string): SimResult {
  show(label, r);
  if (r.isError) throw new Error(`${label} failed: ${JSON.stringify(r.data)}`);
  return r;
}

const masked = (phone: string) => phone.slice(0, 2) + '•'.repeat(phone.length - 6) + phone.slice(-4);

/** The demo-fallback panel's view of a pending code (the dashboard shows the same). */
async function codeFromDashboard(phone: string): Promise<string> {
  const res = await fetch(`${base}/api/dev/codes`, { headers: auth });
  if (!res.ok) throw new Error(`GET /api/dev/codes as ${devEmail} -> ${res.status}. Pass --code, or enable DEMO_SHOW_CODES.`);
  const { codes } = (await res.json()) as { codes: Array<{ phoneMasked: string; code: string }> };
  const hit = codes.find((c) => c.phoneMasked === masked(phone));
  if (!hit) throw new Error(`no pending code for ${masked(phone)}`);
  return hit.code;
}

interface Script {
  from: string;
  orgToken?: string;
  agentNumber?: string;
  name?: string;
  enroll?: boolean;
  /** Verify before triage even for a known caller (e.g. fraud in progress on a recognized number). */
  verify?: boolean;
  code?: string;
  triage?: { intent: string; amount_usd?: number; summary: string };
}

async function runCall(s: Script): Promise<void> {
  const call = await openSimCall({ baseUrl: base, phone: s.from, orgToken: s.orgToken, agentNumber: s.agentNumber, secret });
  try {
    // With REQUIRE_VERIFICATION off the server doesn't list send_code/check_code: skip the code steps.
    const hasCodes = (await call.tools()).includes('send_code');
    const who = must(await call.call('lookup_caller'), 'lookup_caller');
    if (who.data.known) console.log(`    agent: "Welcome back, ${who.data.first_name}."`);
    if ((s.enroll || s.verify) && !hasCodes) {
      console.log('    (verification off on this server: no texted code)');
      if (s.enroll && !who.data.known) {
        must(await call.call('save_profile', { name: s.name ?? 'Test Caller', consent: true }), 'save_profile');
      }
    } else if (s.enroll || s.verify) {
      must(await call.call('send_code'), 'send_code');
      const code = s.code ?? (await codeFromDashboard(s.from));
      const checked = must(await call.call('check_code', { code }), 'check_code');
      if (!checked.data.verified) throw new Error('code did not verify');
      if (s.enroll && !who.data.known) {
        must(await call.call('save_profile', { name: s.name ?? 'Test Caller', consent: true }), 'save_profile');
      }
    }
    if (s.triage) {
      const args: Record<string, unknown> = { ...s.triage };
      if (s.name && !who.data.known) args.caller_name = s.name;
      const t = must(await call.call('triage_call', args), 'triage_call');
      console.log(`    agent: "${t.data.say_to_caller}"`);
    }
  } finally {
    await call.close();
  }
}

async function bankToken(): Promise<string> {
  const res = await fetch(`${base}/api/me`, { headers: auth });
  if (!res.ok) throw new Error(`GET /api/me as ${devEmail} -> ${res.status} (is the server running with ENABLE_DEV?)`);
  const me = (await res.json()) as { org: { name: string; mcpUrl: string } | null };
  if (!me.org) throw new Error(`${devEmail} has no org`);
  return decodeURIComponent(me.org.mcpUrl.split('/mcp/')[1]!);
}

async function demo(): Promise<void> {
  const orgToken = await bankToken();
  console.log(`Bank of Antarctica via /mcp/<token> on ${base}\n`);

  console.log('Call 1: new caller, $12 card dispute (saves their details)');
  await runCall({
    from: '+15555550188',
    orgToken,
    name: 'Sam Okafor',
    enroll: true,
    triage: { intent: 'dispute', amount_usd: 12, summary: 'Sam was charged twice for a $12 coffee order yesterday and wants one charge reversed.' },
  });

  console.log('\nCall 2: returning caller Maria, fraud in progress ($4,200) (verifies by code if the server requires it)');
  await runCall({
    from: '+15555550101',
    orgToken,
    verify: true,
    triage: {
      intent: 'fraud_in_progress',
      amount_usd: 4200,
      summary: 'Maria sees $4,200 in card charges from another state happening right now. She still has her card and wants it frozen.',
    },
  });

  console.log('\nCall 3: returning caller James, wants to open a $200K account');
  await runCall({
    from: '+15555550102',
    orgToken,
    triage: {
      intent: 'account_opening',
      amount_usd: 200_000,
      summary: 'James wants to open a $200K operating account for his holding company this week.',
    },
  });

  const q = (await (await fetch(`${base}/api/queue`, { headers: auth })).json()) as {
    queued: Array<{ rank: number; name: string; intentLabel: string; amountUsd: number | null; score: { total: number }; reason: string }>;
  };
  console.log('\nBank of Antarctica queue:');
  for (const i of q.queued) console.log(`  #${i.rank}  ${String(i.score.total).padStart(3)}  ${i.name ?? '(no name)'} · ${i.reason}`);
}

async function main(): Promise<void> {
  if (values.demo) {
    await demo();
  } else {
    await runCall({
      from: values.from!,
      orgToken: values['org-token'],
      agentNumber: values['agent-number'],
      name: values.name,
      enroll: values.enroll,
      code: values.code,
      triage: values.summary
        ? { intent: values.intent!, summary: values.summary, ...(values.amount ? { amount_usd: Number(values.amount) } : {}) }
        : undefined,
    });
  }
}

// No top-level await: the repo root package is CommonJS.
main().catch((err) => {
  console.error(`\nsimulate-call: ${(err as Error).message}`);
  process.exit(1);
});
