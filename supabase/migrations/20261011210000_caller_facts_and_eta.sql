-- Durable caller context + callback ETA / confirmation SMS bookkeeping.
-- profiles.facts: what a saved caller told us about themselves (occupation, household, ...), merged call after call.
-- queue_items.eta_*: the callback estimate promised on the call; sms_*: whether the confirmation text went out.

alter table public.profiles
  add column if not exists facts            jsonb not null default '{}'::jsonb,
  add column if not exists facts_updated_at timestamptz;

alter table public.queue_items
  add column if not exists eta_minutes int,
  add column if not exists eta_at      timestamptz,
  add column if not exists sms_status  text check (sms_status in ('sent', 'failed', 'skipped')),
  add column if not exists sms_sent_at timestamptz,
  add column if not exists sms_error   text;
