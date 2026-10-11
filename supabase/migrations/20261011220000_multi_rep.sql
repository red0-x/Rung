-- Several reps per org: who claimed each callback, and who is online (dashboard heartbeat).
-- A claim is a conditional UPDATE (... where status = 'queued'), so two reps can never get the same caller.

alter table public.queue_items
  add column if not exists claimed_by      uuid references auth.users(id) on delete set null,
  add column if not exists claimed_by_name text;

alter table public.org_members
  add column if not exists name         text,
  add column if not exists last_seen_at timestamptz;

create index if not exists queue_items_claimed_by_idx on public.queue_items (org_id, claimed_by) where status = 'in_progress';
