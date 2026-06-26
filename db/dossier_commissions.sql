-- ─────────────────────────────────────────────────────────────────────────
-- Calibre — dossier commissioning pipeline
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL → New query → Run).
-- It is safe to re-run: every statement is guarded with IF NOT EXISTS / OR REPLACE.
--
-- This backs the €499 commissioned dossier: a club submits a request (insert),
-- you quote/collect via ContiPay, then deliver a token-gated, watermarked brief.
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

create table if not exists public.dossier_commissions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- subject of the dossier
  player_name   text not null,
  player_api_id bigint,
  buying_club   text,
  position      text,

  -- who commissioned it
  requester_name  text,
  requester_email text not null,
  requester_org   text,
  requester_role  text,
  brief           text,                 -- free text: the specific questions / focus

  -- commercial
  price_eur  integer not null default 499,
  currency   text    not null default 'EUR',
  status     text    not null default 'requested'
             check (status in ('requested','quoted','paid','in_progress','delivered','cancelled')),

  -- payment (ContiPay)
  payment_provider text default 'contipay',
  payment_ref      text,
  paid_at          timestamptz,

  -- secured delivery
  access_token uuid not null default gen_random_uuid(),  -- token-gated dossier URL
  watermark_id text,                                      -- per-recipient watermark tag
  dossier_url  text,
  delivered_at timestamptz
);

create index        if not exists dossier_commissions_status_idx on public.dossier_commissions (status);
create index        if not exists dossier_commissions_email_idx  on public.dossier_commissions (requester_email);
create unique index if not exists dossier_commissions_token_idx  on public.dossier_commissions (access_token);

-- keep updated_at fresh on every change
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists dossier_commissions_touch on public.dossier_commissions;
create trigger dossier_commissions_touch
  before update on public.dossier_commissions
  for each row execute function public.touch_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────────────
-- Anyone may SUBMIT a commission request (insert), and only as a fresh
-- 'requested' row — they cannot mark their own order paid. Reading, quoting,
-- status changes and delivery all run through the service-role key (your back
-- office), never the public anon/auth keys.
alter table public.dossier_commissions enable row level security;

drop policy if exists dossier_commissions_insert_any on public.dossier_commissions;
create policy dossier_commissions_insert_any
  on public.dossier_commissions
  for insert
  to anon, authenticated
  with check (status = 'requested');

-- No select/update/delete policy for anon/authenticated  =>  service role only.
-- ─────────────────────────────────────────────────────────────────────────
