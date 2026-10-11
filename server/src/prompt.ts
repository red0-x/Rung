import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { INTENTS, type OrgSettings } from './types.js';

const DEFAULT_TEMPLATE = fileURLToPath(new URL('../../docs/inbound-prompt.md', import.meta.url));

/** Inlined by scripts/vercel-build.mjs (esbuild define) so the serverless bundle needs no file. */
declare const __RUNG_PROMPT_TEMPLATE__: string | undefined;

/** Read on every render so edits to docs/inbound-prompt.md show up without a restart. */
export function loadPromptTemplate(path?: string): string {
  if (!path && typeof __RUNG_PROMPT_TEMPLATE__ === 'string') return __RUNG_PROMPT_TEMPLATE__;
  return readFileSync(path ?? DEFAULT_TEMPLATE, 'utf8');
}

export function promptVars(orgName: string, s: OrgSettings): Record<string, string> {
  const byUrgency = [...INTENTS].sort((a, b) => s.intents[b].points - s.intents[a].points);
  const labels = (pred: (i: (typeof INTENTS)[number]) => boolean) =>
    byUrgency.filter(pred).map((i) => `${s.intents[i].label} (${i})`);
  const urgent = labels((i) => s.intents[i].tier === 'critical');
  const sensitive = labels((i) => s.intents[i].sensitive);
  return {
    org_name: orgName,
    greeting: s.greeting,
    tone: s.tone,
    intent_list: byUrgency.map((i) => `  - ${i}: ${s.intents[i].label}`).join('\n'),
    urgent_intents: urgent.length ? urgent.join(', ') : 'none',
    sensitive_intents: sensitive.length ? sensitive.join(', ') : 'none',
  };
}

export interface PromptFlags {
  /** Include the texted-code steps (REQUIRE_VERIFICATION). */
  require_verification: boolean;
}

/**
 * Strip HTML comments, resolve `{{#if flag}}...{{else}}...{{/if}}` blocks (not nested),
 * then fill `{{var}}` placeholders. Unknown placeholders are left as-is.
 */
export function renderPrompt(template: string, orgName: string, settings: OrgSettings, flags: PromptFlags): string {
  const vars = promptVars(orgName, settings);
  return template
    .replace(/<!--[\s\S]*?-->\s*/g, '')
    .replace(/\{\{#if ([a-z_]+)\}\}\n?([\s\S]*?)(?:\{\{else\}\}\n?([\s\S]*?))?\{\{\/if\}\}\n?/g, (_m, k: string, yes: string, no?: string) =>
      flags[k as keyof PromptFlags] ? yes : (no ?? ''),
    )
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k]! : m))
    .trim();
}
