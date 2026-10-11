import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { syntheticUserId } from '../src/auth.js';
import { BANK_EMAIL, CLINIC_EMAIL, boot, type Harness } from './helpers.js';

const CONRAD = 'cspaudie@gmail.com';

let h: Harness;
beforeEach(async () => {
  h = await boot({ REQUIRE_VERIFICATION: 'false' });
});
afterEach(() => h.close());

describe('invites + several orgs per login', () => {
  it('an invited email joins on /me and can switch orgs with X-Org-Id', async () => {
    expect((await h.api('/me', { as: CONRAD })).body).toMatchObject({ org: null, orgs: [] });
    expect(await h.api('/org/invites', { method: 'POST', body: { email: 'CSpaudie@gmail.com', role: 'admin' } })).toEqual({
      status: 201,
      body: { ok: true },
    });
    await h.api('/org/invites', { method: 'POST', as: CLINIC_EMAIL, body: { email: CONRAD, role: 'admin' } });

    // Only /me accepts invites, so the first queue call before /me still has no org.
    expect((await h.api('/queue', { as: CONRAD })).status).toBe(403);
    const me = (await h.api('/me', { as: CONRAD })).body;
    expect(me.orgs.map((o: any) => [o.name, o.role])).toEqual([
      ['Bank of Antarctica', 'admin'],
      ['Mango Clinic', 'admin'],
    ]);
    expect(me.org.id).toBe(h.bank.id); // default: oldest membership

    const clinic = (await h.api('/me', { as: CONRAD, orgId: h.clinic.id })).body;
    expect(clinic.org.id).toBe(h.clinic.id);
    expect((await h.api('/me', { as: CONRAD, orgId: 'not-mine' })).body.org.id).toBe(h.bank.id);
    // Header naming an org you don't belong to falls back; it never grants access.
    expect((await h.api('/me', { as: BANK_EMAIL, orgId: h.clinic.id })).body.org.id).toBe(h.bank.id);

    // Presence is per org: Conrad shows up online at the clinic.
    await h.api('/queue', { as: CONRAD, orgId: h.clinic.id });
    const reps = (await h.api('/queue', { as: CLINIC_EMAIL })).body.reps;
    expect(reps.find((r: any) => r.id === syntheticUserId(CONRAD))).toMatchObject({ online: true, role: 'admin' });
  });

  it('only admins invite; bad emails are rejected', async () => {
    await h.store.addMember({ orgId: h.bank.id, userId: syntheticUserId('rep@test.rung'), role: 'rep' });
    expect((await h.api('/org/invites', { method: 'POST', as: 'rep@test.rung', body: { email: CONRAD } })).status).toBe(403);
    expect((await h.api('/org/invites', { method: 'POST', body: { email: 'nope' } })).status).toBe(400);
  });
});
