import { parseArgs } from 'node:util';
import { openSimCall } from '../src/sim/client.js';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:8787' },
    secret: { type: 'string' },
    phone: { type: 'string' },
    name: { type: 'string' },
    intent: { type: 'string', default: 'general_question' },
    amount: { type: 'string' },
    summary: { type: 'string' },
    enroll: { type: 'boolean', default: false },
    code: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});

if (values.help || !values.phone) {
  console.log(`Simulate a Dial call against your backend (no phone needed).

  npm run simulate -- --phone +15555550111 --intent dispute --amount 12 \\
      --summary "Duplicate $12 charge at a coffee shop, wants it reversed."

Options
  --phone    caller number, E.164 (required)
  --intent   fraud_in_progress | medical_emergency | locked_out | payment_issue | money_movement |
             account_change | dispute | account_opening | general_question | other
  --amount   dollars at stake
  --summary  the brief the voice agent would write for the specialist
  --name     caller name (new callers)
  --enroll   run the save-my-details flow: send_code -> check_code -> save_profile
  --code     the code you received by SMS (or omit when the server runs with DEMO_SHOW_CODES=true)
  --url      backend base URL (default http://localhost:8787)
  --secret   MCP shared secret (default: $MCP_SHARED_SECRET)`);
  process.exit(values.help ? 0 : 1);
}

const baseUrl = values.url!.replace(/\/+$/, '');
const secret = values.secret ?? process.env.MCP_SHARED_SECRET;
const show = (label: string, r: { isError: boolean; data: unknown }) =>
  console.log(`\n${r.isError ? '✗' : '✓'} ${label}\n${JSON.stringify(r.data, null, 2)}`);

const call = await openSimCall({ baseUrl, phone: values.phone!, secret });
try {
  const who = await call.call('lookup_caller');
  show('lookup_caller', who);

  let name = values.name;
  if (values.enroll) {
    show('send_code', await call.call('send_code'));
    let code = values.code;
    if (!code) {
      const res = await fetch(`${baseUrl}/api/dev/codes`);
      if (!res.ok) throw new Error('No --code given and /api/dev/codes is off. Start the server with DEMO_SHOW_CODES=true.');
      const { codes } = (await res.json()) as { codes: Array<{ phone: string; code: string }> };
      code = codes.find((c) => c.phone === values.phone)?.code;
      if (!code) throw new Error('No pending code found for that number.');
    }
    show('check_code', await call.call('check_code', { code }));
    name ??= who.data?.name ?? 'Test Caller';
    show('save_profile', await call.call('save_profile', { name, consent: true }));
  }

  if (values.summary) {
    const args: Record<string, unknown> = { intent: values.intent, summary: values.summary };
    if (values.amount) args.amount_usd = Number(values.amount);
    if (name && !who.data?.known) args.caller_name = name;
    show('triage_call', await call.call('triage_call', args));
  }
} finally {
  await call.close();
}
