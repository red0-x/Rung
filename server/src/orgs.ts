import { randomBytes, randomUUID } from 'node:crypto';
import type { Config } from './config.js';
import { defaultSettings } from './scoring.js';
import type { Store } from './store/types.js';
import type { Org, OrgSettings } from './types.js';

export interface OrgView {
  id: string;
  name: string;
  slug: string;
  dialNumber: string | null;
  dialNumberId: string | null;
  dialNumberMock: boolean;
  mcpUrl: string;
  settings: OrgSettings;
  publishedAt: number | null;
}

export const newMcpToken = () => `rung_${randomBytes(18).toString('base64url')}`;

export function mcpUrl(cfg: Config, org: Org): string {
  return `${cfg.publicUrl}/mcp/${org.mcpToken}`;
}

export function toOrgView(cfg: Config, org: Org): OrgView {
  const pooled = org.dialNumberId ? cfg.numberPool.find((n) => n.id === org.dialNumberId) : undefined;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    dialNumber: org.dialNumber,
    dialNumberId: org.dialNumberId,
    dialNumberMock: pooled?.mock ?? false,
    mcpUrl: mcpUrl(cfg, org),
    settings: org.settings,
    publishedAt: org.publishedAt,
  };
}

export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return s || 'org';
}

/** Creates an org with default settings and a fresh MCP token. Slug collisions get a numeric suffix. */
export async function createOrg(
  store: Store,
  input: { name: string; slug?: string; settings?: OrgSettings; now: number },
): Promise<Org> {
  const base = input.slug ?? slugify(input.name);
  let slug = base;
  for (let i = 2; await store.getOrgBySlug(slug); i++) slug = `${base}-${i}`;
  return store.createOrg({
    id: randomUUID(),
    name: input.name,
    slug,
    mcpToken: newMcpToken(),
    dialNumber: null,
    dialNumberId: null,
    settings: input.settings ?? defaultSettings(input.name),
    publishedAt: null,
    createdAt: input.now,
  });
}
