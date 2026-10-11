-- Rung: multi-tenant schema (RUNG_CONTEXT section 7.2, API contract v3).
-- Supersedes 20261011190000_init_link_schema.sql (single-tenant, never used: tables were empty).
-- Only the server touches these tables, with the service-role key. RLS is on with no
-- policies, so the anon key (and the browser) can read or write nothing.

drop table if exists public.calls;
drop table if exists public.otps;
drop table if exists public.profiles;

-- One row per company running a Rung.
create table if not exists public.orgs (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text not null unique,
  mcp_token      text not null unique,          -- Context MCP URL is <PUBLIC_URL>/mcp/<mcp_token>
  dial_number    text unique,                   -- E.164, claimed from DIAL_NUMBER_POOL
  dial_number_id text unique,
  settings       jsonb not null default '{}'::jsonb,
  published_at   timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id     uuid not null references public.orgs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'admin',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists org_members_user_idx on public.org_members (user_id);

-- A caller's memory exists per company: the same phone at two orgs is two unrelated rows.
create table if not exists public.profiles (
  org_id      uuid not null references public.orgs(id) on delete cascade,
  phone       text not null,
  name        text not null,
  consent_at  timestamptz,
  verified_at timestamptz,
  created_at  timestamptz not null default now(),
  primary key (org_id, phone)
);

create table if not exists public.verifications (
  org_id         uuid not null references public.orgs(id) on delete cascade,
  phone          text not null,
  code_hash      text not null default '',
  expires_at     timestamptz not null,
  attempts       int not null default 0,
  window_start   timestamptz not null,
  issue_count    int not null default 0,
  verified_until timestamptz,
  primary key (org_id, phone)
);

create table if not exists public.queue_items (
  id               uuid primary key,
  org_id           uuid not null references public.orgs(id) on delete cascade,
  phone            text not null,
  agent_number     text,
  name             text,
  intent           text not null,
  amount_usd       numeric,
  summary          text not null,
  trust            text not null check (trust in ('verified', 'recognized', 'new')),
  is_returning     boolean not null default false,
  status           text not null default 'queued' check (status in ('queued', 'in_progress', 'done')),
  created_at       timestamptz not null default now(),
  claimed_at       timestamptz,
  done_at          timestamptz,
  call_id          text,
  transcript       text,
  transcript_turns jsonb,
  duration_seconds int
);
create index if not exists queue_items_org_status_created_idx on public.queue_items (org_id, status, created_at desc);
create index if not exists queue_items_org_phone_idx on public.queue_items (org_id, phone, created_at desc);
create index if not exists queue_items_call_id_idx on public.queue_items (call_id);

-- Webhook dedupe (global: Dial event ids are unique across the account).
create table if not exists public.seen_events (
  event_id text primary key,
  seen_at  timestamptz not null default now()
);

alter table public.orgs          enable row level security;
alter table public.org_members   enable row level security;
alter table public.profiles      enable row level security;
alter table public.verifications enable row level security;
alter table public.queue_items   enable row level security;
alter table public.seen_events   enable row level security;
