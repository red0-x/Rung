-- Calls on the line with the voice agent right now, so the dashboard can show them before they reach the queue.
-- One row per number per org: lookup_caller starts it, later tools move `stage`, triage_call sets queued_at,
-- call.ended deletes it. Rows that stop updating for 15 minutes are ignored (hung up without a webhook).

create table if not exists public.live_calls (
  org_id     uuid not null references public.orgs(id) on delete cascade,
  phone      text not null,
  known      boolean not null default false,
  name       text,
  stage      text not null default 'listening' check (stage in ('listening', 'verifying', 'verified', 'saving', 'queued')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  queued_at  timestamptz,
  primary key (org_id, phone)
);

alter table public.live_calls enable row level security;
