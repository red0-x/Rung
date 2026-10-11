import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Store } from './store/types.js';
import type { Intent } from './types.js';

export interface SeedFile {
  profiles: Array<{
    phone: string;
    name: string;
    history?: Array<{ intent: Intent; amountUsd?: number; summary: string; daysAgo?: number }>;
  }>;
}

const DAY = 86_400_000;

/**
 * Pre-enrolls returning callers (with a past issue the agent can mention) so the
 * "welcome back" moment works on stage without enrolling anyone live.
 */
export async function seedStore(store: Store, seed: SeedFile, now: number): Promise<number> {
  let n = 0;
  for (const p of seed.profiles) {
    await store.upsertProfile({
      phone: p.phone,
      name: p.name,
      consentAt: now - 14 * DAY,
      verifiedAt: now - 14 * DAY,
      createdAt: now - 14 * DAY,
    });
    for (const h of p.history ?? []) {
      const createdAt = now - (h.daysAgo ?? 3) * DAY;
      await store.addQueueItem({
        id: randomUUID(),
        phone: p.phone,
        name: p.name,
        intent: h.intent,
        amountUsd: h.amountUsd,
        summary: h.summary,
        trust: 'verified',
        status: 'done',
        createdAt,
        doneAt: createdAt + 20 * 60_000,
      });
    }
    n++;
  }
  return n;
}

/** Looks for the explicit path, then server/seed.json (gitignored, real numbers), then the example. */
export function loadSeed(explicitPath?: string): { seed: SeedFile; source: string } | undefined {
  const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
  const candidates = [explicitPath, here('../seed.json'), here('../seed.example.json')].filter(
    (p): p is string => !!p,
  );
  for (const path of candidates) {
    if (existsSync(path)) return { seed: JSON.parse(readFileSync(path, 'utf8')) as SeedFile, source: path };
  }
  return undefined;
}
