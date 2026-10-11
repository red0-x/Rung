import type { Auth } from './auth.js';
import { stableUuid } from './identity.js';
import { createOrg } from './orgs.js';
import { defaultSettings } from './scoring.js';
import { mergeSettings, type SettingsPatch } from './settings.js';
import type { Store } from './store/types.js';
import type { Intent, Org } from './types.js';

export interface SeedOrg {
  name: string;
  slug: string;
  /** Env var holding the demo user's email (linked as admin). */
  memberEmailEnv: 'DEMO_BANK_EMAIL' | 'DEMO_CLINIC_EMAIL';
  /** Comma-separated emails added as reps (a demo team; each needs its own login). */
  repEmailsEnv: 'DEMO_BANK_REPS' | 'DEMO_CLINIC_REPS';
  /** Used when the env var is unset (the confirmed demo users in the Rung Supabase project). */
  defaultEmail: string;
  settings?: SettingsPatch;
  callers: Array<{
    phone: string;
    name: string;
    history?: Array<{ intent: Intent; amountUsd?: number; summary: string; daysAgo: number }>;
  }>;
}

/**
 * Fictional 555 numbers. +15555550101 exists at BOTH orgs under different names:
 * a caller's memory at one company never leaks to another.
 */
export const SEED_ORGS: SeedOrg[] = [
  {
    name: 'Bank of Antarctica',
    slug: 'demo-bank',
    memberEmailEnv: 'DEMO_BANK_EMAIL',
    repEmailsEnv: 'DEMO_BANK_REPS',
    defaultEmail: 'bank@rung.demo',
    settings: { greeting: "Thanks for calling Bank of Antarctica's priority line." },
    callers: [
      {
        phone: '+15555550101',
        name: 'Maria Alvarez',
        history: [{ intent: 'dispute', amountUsd: 38, summary: 'Maria disputed a duplicate $38 grocery charge. Refunded.', daysAgo: 5 }],
      },
      {
        phone: '+15555550102',
        name: 'James Whitfield',
        history: [{ intent: 'general_question', summary: 'James asked about wire limits for his holding company.', daysAgo: 12 }],
      },
    ],
  },
  {
    name: 'Mango Clinic',
    slug: 'northside-clinic',
    memberEmailEnv: 'DEMO_CLINIC_EMAIL',
    repEmailsEnv: 'DEMO_CLINIC_REPS',
    defaultEmail: 'clinic@rung.demo',
    settings: {
      greeting: 'Thanks for calling Mango Clinic.',
      tone: 'calm, kind, unhurried',
      intents: {
        medical_emergency: { label: 'urgent symptoms' },
        payment_issue: { label: 'insurance or billing problem' },
        dispute: { label: 'billing dispute' },
        account_opening: { label: 'new patient' },
        account_change: { label: 'update patient details' },
        general_question: { label: 'appointment question' },
      },
    },
    callers: [
      {
        phone: '+15555550101',
        name: 'Dana Brooks',
        history: [{ intent: 'general_question', summary: 'Dana rescheduled her annual physical to next Tuesday.', daysAgo: 3 }],
      },
      {
        phone: '+15555550103',
        name: 'Theo Park',
        history: [{ intent: 'payment_issue', amountUsd: 240, summary: 'Theo asked why insurance denied a $240 lab bill.', daysAgo: 8 }],
      },
    ],
  },
];

const DAY = 86_400_000;

export interface SeedDeps {
  store: Store;
  auth: Auth;
  env: Record<string, string | undefined>;
  now: number;
  log: (msg: string) => void;
}

/** Create the org if missing (token and settings of an existing org are never touched) and link its demo user. */
async function ensureOrg(spec: SeedOrg, deps: SeedDeps): Promise<Org> {
  const { store, auth, env, now, log } = deps;
  let org = await store.getOrgBySlug(spec.slug);
  if (!org) {
    org = await createOrg(store, {
      name: spec.name,
      slug: spec.slug,
      settings: mergeSettings(defaultSettings(spec.name), spec.settings ?? {}),
      now,
    });
    log(`seed: created org ${spec.slug}`);
  }
  const email = env[spec.memberEmailEnv]?.trim() || spec.defaultEmail;
  if (email) {
    const userId = await auth.userIdForEmail(email);
    if (userId) await store.addMember({ orgId: org.id, userId, role: 'admin' });
    else log(`seed: no auth user for ${spec.memberEmailEnv}; ${spec.slug} has no member`);
  }
  for (const rep of (env[spec.repEmailsEnv] ?? '').split(',').map((e) => e.trim()).filter(Boolean)) {
    const userId = await auth.userIdForEmail(rep);
    if (userId) await store.addMember({ orgId: org.id, userId, role: 'rep' });
    else log(`seed: no auth user for rep ${rep} (sign them up first); skipped`);
  }
  return org;
}

/** Returning callers with a past (done) issue so "welcome back" works on stage. Idempotent: fixed row ids. */
async function seedCallers(org: Org, spec: SeedOrg, deps: SeedDeps): Promise<void> {
  const { store, now } = deps;
  for (const c of spec.callers) {
    await store.upsertProfile({
      orgId: org.id,
      phone: c.phone,
      name: c.name,
      consentAt: now - 14 * DAY,
      verifiedAt: now - 14 * DAY,
      createdAt: now - 14 * DAY,
    });
    for (const [i, h] of (c.history ?? []).entries()) {
      const createdAt = now - h.daysAgo * DAY;
      await store.addQueueItem({
        id: stableUuid(`seed:${spec.slug}:${c.phone}:${i}`),
        orgId: org.id,
        phone: c.phone,
        name: c.name,
        intent: h.intent,
        amountUsd: h.amountUsd,
        summary: h.summary,
        trust: 'verified',
        returning: true,
        status: 'done',
        createdAt,
        doneAt: createdAt + 20 * 60_000,
      });
    }
  }
}

export async function seedAll(deps: SeedDeps): Promise<Org[]> {
  const out: Org[] = [];
  for (const spec of SEED_ORGS) {
    const org = await ensureOrg(spec, deps);
    await seedCallers(org, spec, deps);
    out.push(org);
  }
  return out;
}

/** Wipe one org's callers/queue and, if it's a seed org, put its returning callers back. */
export async function reseedOrg(org: Org, deps: SeedDeps): Promise<void> {
  await deps.store.resetOrgData(org.id);
  const spec = SEED_ORGS.find((s) => s.slug === org.slug);
  if (spec) await seedCallers(org, spec, deps);
}
