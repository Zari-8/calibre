-- ─────────────────────────────────────────────────────────────────────────
-- Calibre — `transfers` table: first tracked migration
--
-- FINDING (2026-08-02 audit): the `public.transfers` table powers the entire
-- Transfers page — recent transfers list, market_pulse aggregate view,
-- comparable-deals pool, spotlight pick (src/pages/Transfers.jsx) — plus the
-- backtest scripts. It has existed in production this whole time with ZERO
-- footprint in this repo: not in supabase/schema.sql, not in any prior
-- migration file. Nothing in the codebase ever INSERTs into it either — it
-- has only ever been hand-maintained directly in the Supabase dashboard/SQL
-- editor. That means no enum constraint on `status`, no documented column
-- list, no audit trail for how rows get added — and it's part of why
-- market_pulse (which aggregates this table) was found sitting on exactly 1
-- row live, with no way to tell from the repo whether that was intentional.
--
-- This migration does NOT recreate or alter the live table — `create table
-- if not exists` is a no-op if it already exists, regardless of whether its
-- real columns match this guess exactly (they were reverse-engineered from
-- every `.from('transfers')` query in the codebase — see src/pages/
-- Transfers.jsx and scripts/backtestDataPull*.mjs). Its purpose is to give
-- this table a tracked source of truth going forward. If you add or rename a
-- column, update this file in the same change so the two can't drift again.
--
-- Indexes ARE additive/safe to run live (`if not exists`) and match the
-- actual query patterns on this table today — recommended even if you don't
-- adopt the rest of this file.
--
-- RLS is deliberately NOT touched here — see the note at the bottom before
-- doing anything with it.
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

create table if not exists public.transfers (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  transfer_date  date,                   -- when the deal actually happened, NOT when the row was inserted — see 2026-08-02b note below

  -- subject of the transfer
  player_name    text not null,
  api_player_id  bigint,                 -- links to public.players.api_player_id; frequently null/stale (see Transfers.jsx namesMatch() workaround)
  position       text,                   -- coarse bucket, e.g. 'ST', 'CB' — feeds calibreValue's position multiplier
  position_label text,                   -- display label, e.g. 'ST / Power' — falls back to `position` in the UI

  -- deal
  from_club      text,
  to_club        text,
  fee_millions   numeric,                -- €m; null while a deal has no agreed/reported fee yet
  market_value   numeric,                -- €m; external (Transfermarkt-style) reference value used for premium/discount math
  status         text not null default 'watch'
                 check (status in ('done', 'rumour', 'watch', 'premium')),

  -- season scoping — every live query filters on both of these
  season         text not null,          -- e.g. '2026-27'
  published      boolean not null default false
);

-- 2026-08-02b — add-on for the API-Football sync pipeline (scripts/
-- syncTransfersFromApiFootball.mjs). Runs as a plain ALTER, not folded into
-- the CREATE TABLE above, because that CREATE is a no-op against the live
-- table (it already exists) — this is what actually reaches production.
alter table public.transfers add column if not exists transfer_date date;
-- Existing hand-entered rows have no real transfer_date yet; created_at (row
-- insert time) is the best available stand-in so "Recent Transfers" ordering
-- doesn't regress for them once queries switch to sorting by transfer_date.
update public.transfers set transfer_date = created_at::date where transfer_date is null;

-- Dedupe key for the sync script's upsert — re-running it (a player's
-- transfer history hasn't changed, or overlapping lookback windows) should
-- update the same row, not create a second one. Only meaningful when
-- api_player_id is known, which the sync script always has.
create unique index if not exists transfers_sync_dedupe_idx
  on public.transfers (api_player_id, transfer_date, to_club)
  where api_player_id is not null;

-- Matches the actual filter/sort patterns in Transfers.jsx: every read
-- query filters on (published, season), several also add status or sort by
-- fee_millions.
create index if not exists transfers_published_season_idx on public.transfers (published, season);
create index if not exists transfers_status_idx            on public.transfers (status) where published = true;
create index if not exists transfers_fee_millions_idx       on public.transfers (fee_millions desc) where published = true;
create index if not exists transfers_transfer_date_idx      on public.transfers (transfer_date desc) where published = true;

-- ── Row Level Security — NOT applied by this migration ───────────────────
-- The Transfers page reads this table with the public anon key (no
-- service-role wrapper), so `transfers` is either (a) already RLS-enabled
-- with a working public-select policy, or (b) has RLS off entirely and is
-- relying on table-level grants. Either way, blindly running
-- `alter table public.transfers enable row level security;` with no policy
-- attached would silently break the live Transfers page for every visitor
-- (RLS-enabled + zero policies = deny-all reads) — same class of mistake we
-- were careful about with the Security Definer View fix earlier today.
--
-- Before touching RLS on this table, check its current state first:
--   select relrowsecurity from pg_class where relname = 'transfers';
--   select * from pg_policies where tablename = 'transfers';
-- Only if RLS is off and you want to lock it down should you add something
-- like the read-only public policy below — and test the page against it
-- before trusting it in production:
--
-- alter table public.transfers enable row level security;
-- create policy "Public can read published transfers"
--   on public.transfers for select
--   to anon, authenticated
--   using (published = true);
-- -- No insert/update/delete policy for anon/authenticated => service role
-- -- (or the Supabase dashboard, authenticated as you) only, matching how
-- -- every row has actually been added to this table so far.
