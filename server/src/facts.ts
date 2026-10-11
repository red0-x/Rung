import { z } from 'zod';
import type { FactKey, Facts } from './types.js';
import { FACT_KEYS } from './types.js';

const MAX_VALUE = 200;
const MAX_NOTES = 20;

const text = (what: string) => z.string().trim().max(MAX_VALUE).optional().describe(what);

/** What the agent may save about a caller who agreed to be remembered. All optional; only send what they actually said. */
export const factsInput = z
  .object({
    occupation: text('Their job or profession, e.g. "nurse".'),
    employer: text('Where they work, if they said.'),
    household: text('Family and household in the caller\'s words, e.g. "married, two kids (4 and 7)".'),
    location: text('City or area they live in.'),
    language: text('Preferred language, if not English.'),
    preferences: text('How they like to be contacted or helped, e.g. "prefers calls after 5pm".'),
    note: text('One other durable detail worth remembering next call. Not account numbers, passwords, or anything sensitive.'),
  })
  .strict();

export type FactsInput = z.infer<typeof factsInput>;

/** Overwrite named fields the caller restated, append a new note (deduped, newest 20 kept). Never erases. */
export function mergeFacts(base: Facts | undefined, patch: FactsInput | undefined, at: number): Facts {
  const out: Facts = { ...(base ?? {}) };
  if (!patch) return out;
  for (const k of FACT_KEYS) {
    const v = patch[k]?.replace(/\s+/g, ' ').trim();
    if (v) out[k] = v;
  }
  const note = patch.note?.replace(/\s+/g, ' ').trim();
  if (note && !(out.notes ?? []).some((n) => n.text.toLowerCase() === note.toLowerCase())) {
    out.notes = [...(out.notes ?? []), { text: note, at }].slice(-MAX_NOTES);
  }
  return out;
}

/** Keys worth asking about once, in order. */
const ASK_ABOUT: FactKey[] = ['occupation', 'household'];

export function missingFacts(f: Facts | undefined): FactKey[] {
  return ASK_ABOUT.filter((k) => !f?.[k]);
}

/** "occupation: nurse; household: two kids" for the agent's guidance. */
export function describeFacts(f: Facts | undefined): string {
  if (!f) return '';
  const parts: string[] = FACT_KEYS.filter((k) => f[k]).map((k) => `${k}: ${f[k]}`);
  for (const n of f.notes ?? []) parts.push(`note: ${n.text}`);
  return parts.join('; ');
}

export const hasFacts = (f: Facts | undefined): boolean => !!f && (FACT_KEYS.some((k) => f[k]) || !!f.notes?.length);
