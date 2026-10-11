-- Link schema, contracts v2 (vault/project/contracts.md).
-- Only the backend touches these tables, with the service-role key. RLS is on with
-- no policies, so the anon key can read or write nothing.

create table public.profiles (
  phone       text primary key,
  name        text,
  notes       text,
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);

create table public.calls (
  id           bigint generated always as identity primary key,
  phone        text not null,
  dial_call_id text,
  intent       text,
  category     text check (category in ('fraud', 'lockout', 'new_account', 'dispute', 'other')),
  amount_usd   numeric,
  urgency      smallint check (urgency between 1 and 3),
  summary      text,
  brief        text,
  reason       text,
  status       text not null default 'queued' check (status in ('queued', 'called_back', 'done')),
  created_at   timestamptz not null default now()
);

create index calls_status_idx on public.calls (status);
create index calls_dial_call_id_idx on public.calls (dial_call_id);

create table public.otps (
  phone      text primary key,
  code       text not null,
  expires_at timestamptz not null
);

alter table public.profiles enable row level security;
alter table public.calls    enable row level security;
alter table public.otps     enable row level security;
