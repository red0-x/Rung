/**
 * Puts Bank of Antarctica's three demo calls (Maria fraud $4,200, James $200K opening, Sam $12 dispute)
 * back in the queue with short, different waits (Maria 4 min, James 7, Sam 12): order stays fraud > $200K > $12. Run right before the pitch: `npm run demo:reset`.
 * Talks to Supabase directly (service role from .env), so it works on prod where /api/dev/reset is off.
 * Only touches the three demo numbers' items from the last 24 h; real callers and seed history are left alone.
 */
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('demo-reset: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env)');
  process.exit(1);
}
const H = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
const rest = `${url}/rest/v1/`;
/** Phone → minutes already waiting. Scores then: Maria 124, James 66, Sam 44 (gaps stay fixed as they age). */
const WAIT_MIN = { '+15555550101': 4, '+15555550102': 7, '+15555550188': 12 };
const DEMO = Object.keys(WAIT_MIN);

async function req(path, init = {}) {
  const res = await fetch(rest + path, { ...init, headers: { ...H, ...init.headers } });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const [org] = await req('orgs?slug=eq.demo-bank&select=id,name');
if (!org) throw new Error('demo-bank org not found');

const since = new Date(Date.now() - 86_400_000).toISOString();
const items = await req(
  `queue_items?org_id=eq.${org.id}&phone=in.(${DEMO.map(encodeURIComponent).join(',')})&created_at=gte.${since}&select=id,name,intent,status,phone`,
);
if (!items.length) {
  console.log('No demo calls from the last 24 h. Replay them first: npm run demo:sim -w server (dev) or the simulate script against prod.');
  process.exit(0);
}

for (const it of items) {
  await req(`queue_items?id=eq.${it.id}`, {
    method: 'PATCH',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'queued', created_at: new Date(Date.now() - WAIT_MIN[it.phone] * 60_000).toISOString(), claimed_at: null, claimed_by: null, claimed_by_name: null, done_at: null }),
  });
  console.log(`  queued, ${WAIT_MIN[it.phone]} min waiting: ${it.name} · ${it.intent} (was ${it.status})`);
}
console.log(`${org.name}: ${items.length} demo calls reset.`);
