-- Add people to an org by email. On their next /api/me (after they sign up) each invite becomes an org_members row.
-- One login can belong to several orgs; the dashboard picks one per request (X-Org-Id header).

create table if not exists public.org_invites (
  org_id     uuid not null references public.orgs(id) on delete cascade,
  email      text not null check (email = lower(email)),
  role       text not null default 'admin' check (role in ('admin', 'rep')),
  created_at timestamptz not null default now(),
  primary key (org_id, email)
);
create index if not exists org_invites_email_idx on public.org_invites (email);

alter table public.org_invites enable row level security;
