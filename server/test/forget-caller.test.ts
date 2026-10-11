import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { syntheticUserId } from '../src/auth.js';
import { openSimCall } from '../src/sim/client.js';
import { CLINIC_EMAIL, JAMES, MARIA, boot, type Harness } from './helpers.js';

let h: Harness;
beforeEach(async () => {
  h = await boot({ REQUIRE_VERIFICATION: 'false' });
});
afterEach(() => h.close());

const lookup = async (phone: string, orgToken = h.bank.mcpToken) => {
  const c = await openSimCall({ baseUrl: h.base, phone, orgToken });
  const r = (await c.call('lookup_caller', {})) as any;
  await c.close();
  return r.data;
};
const triage = async (phone: string, args: Record<string, unknown>) => {
  const c = await openSimCall({ baseUrl: h.base, phone, orgToken: h.bank.mcpToken });
  await c.call('triage_call', args);
  await c.close();
};
const keyOf = async (name: string) => (await h.api('/callers')).body.callers.find((c: any) => c.name === name).key;

describe('DELETE /api/callers/:key (forget a caller)', () => {
  it("wipes one number at one org; their next call is a first call; others untouched", async () => {
    await triage(MARIA, { intent: 'dispute', summary: 'Duplicate charge.' });
    expect((await lookup(MARIA)).known).toBe(true);
    const clinicBefore = await lookup(MARIA, h.clinic.mcpToken);

    const r = await h.api(`/callers/${await keyOf('Maria Alvarez')}`, { method: 'DELETE' });
    expect(r.status).toBe(200);
    expect(r.body.removed.profile).toBe(true);
    expect(r.body.removed.items).toBeGreaterThanOrEqual(1);

    const after = await lookup(MARIA);
    expect(after).toMatchObject({ known: false, name: null, call_count: 0, has_open_request: false });
    expect((await h.api('/queue')).body.queued).toEqual([]);
    expect((await h.api('/callers')).body.callers.some((c: any) => c.name === 'Maria Alvarez')).toBe(false);
    // Same number at the other org, and other callers here, keep their memory.
    expect((await lookup(MARIA, h.clinic.mcpToken)).name).toBe(clinicBefore.name);
    expect((await lookup(JAMES)).known).toBe(true);
  });

  it('admin only; unknown or other-org keys 404', async () => {
    const key = await keyOf('Maria Alvarez');
    await h.store.addMember({ orgId: h.bank.id, userId: syntheticUserId('rep@test.rung'), role: 'rep' });
    expect((await h.api(`/callers/${key}`, { method: 'DELETE', as: 'rep@test.rung' })).status).toBe(403);
    expect((await h.api(`/callers/${key}`, { method: 'DELETE', as: CLINIC_EMAIL })).status).toBe(404);
    expect((await h.api('/callers/deadbeefdeadbeef', { method: 'DELETE' })).status).toBe(404);
  });
});
