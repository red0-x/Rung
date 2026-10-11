-- Run once in the Supabase SQL editor. Only used when STORE=supabase.
-- RLS is enabled with no policies: the browser (anon key) can read nothing.
-- The server uses the service-role key, which bypasses RLS.

create table if not exists profiles (
  phone       text primary key,                 -- E.164, the identity key
  name        text not null,
  consent_at  timestamptz not null,
  verified_at timestamptz not null,
  created_at  timestamptz not null default now()
);

create table if not exists verifications (
  phone          text primary key,
  code_hash      text not null,                 -- '' once the code is consumed
  expires_at     timestamptz not null,
  attempts       int not null default 0,
  window_start   timestamptz not null,
  issue_count    int not null default 1,
  verified_until timestamptz
);

create table if not exists queue_items (
  id               uuid primary key,
  phone            text not null,
  agent_number     text,
  name             text,
  intent           text not null,
  amount_usd       numeric,
  summary          text not null,
  trust            text not null check (trust in ('verified', 'recognized', 'new')),
  status           text not null default 'queued' check (status in ('queued', 'in_progress', 'done')),
  created_at       timestamptz not null default now(),
  claimed_at       timestamptz,
  done_at          timestamptz,
  call_id          text,
  transcript       text,
  transcript_turns jsonb,
  duration_seconds int
);

create index if not exists queue_items_phone_idx  on queue_items (phone, created_at desc);
create index if not exists queue_items_status_idx on queue_items (status, created_at desc);
create index if not exists queue_items_call_idx   on queue_items (call_id) where call_id is not null;

create table if not exists seen_events (          -- webhook dedupe (Dial retries up to 6 times)
  event_id text primary key,
  seen_at  timestamptz not null default now()
);

alter table profiles      enable row level security;
alter table verifications enable row level security;
alter table queue_items   enable row level security;
alter table seen_events   enable row level security;
