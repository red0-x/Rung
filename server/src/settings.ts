import { z } from 'zod';
import { defaultSettings } from './scoring.js';
import { INTENTS, TIERS, type Intent, type IntentRule, type OrgSettings } from './types.js';

const intentRule = z.object({
  label: z.string().trim().min(1).max(60),
  points: z.number().int().min(0).max(1000),
  tier: z.enum(TIERS as unknown as [string, ...string[]]),
  sensitive: z.boolean(),
});

const intentKey = z.enum(INTENTS);

/** PATCH body: everything optional, intents may be partial per key and per field. */
export const settingsPatchSchema = z
  .object({
    greeting: z.string().trim().min(1).max(300),
    tone: z.string().trim().min(1).max(200),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, 'unknown IANA time zone'),
    intents: z.partialRecord(intentKey, intentRule.partial()),
    valueTiers: z
      .array(z.object({ minUsd: z.number().min(0), points: z.number().int().min(0).max(1000) }))
      .min(1)
      .max(20),
    agingPerMin: z.number().min(0).max(100),
    agingCap: z.number().min(0).max(10_000),
    avgHandleMin: z.number().min(0.5).max(240),
    repsOnShift: z.number().int().min(1).max(1000),
    baselineHoldMin: z.number().min(0).max(600),
    reexplainMin: z.number().min(0).max(120),
  })
  .partial()
  .strict();

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

/** Apply a validated partial on top of full settings. */
export function mergeSettings(base: OrgSettings, patch: SettingsPatch): OrgSettings {
  const intents = { ...base.intents };
  for (const [k, v] of Object.entries(patch.intents ?? {})) {
    intents[k as Intent] = { ...intents[k as Intent], ...(v as Partial<IntentRule>) };
  }
  const next: OrgSettings = { ...base, ...patch, intents } as OrgSettings;
  next.valueTiers = [...next.valueTiers].sort((a, b) => a.minUsd - b.minUsd);
  return next;
}

/** Whatever is in the jsonb column, return complete settings (defaults fill gaps, junk is dropped). */
export function normalizeSettings(raw: unknown, orgName: string): OrgSettings {
  const base = defaultSettings(orgName);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of Object.keys(settingsPatchSchema.shape)) if (k in r) patch[k] = r[k];
  const parsed = settingsPatchSchema.safeParse(patch);
  if (parsed.success) return mergeSettings(base, parsed.data);
  // Keep the valid keys one by one.
  let out = base;
  for (const [k, v] of Object.entries(patch)) {
    const one = settingsPatchSchema.safeParse({ [k]: v });
    if (one.success) out = mergeSettings(out, one.data);
  }
  return out;
}
