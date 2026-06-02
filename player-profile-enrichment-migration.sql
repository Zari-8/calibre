-- Calibre player-profile enrichment migration
-- Run once in Supabase SQL Editor before running the enrichment script.

alter table public.players
  add column if not exists firstname text,
  add column if not exists lastname text,
  add column if not exists date_of_birth date,
  add column if not exists birth_place text,
  add column if not exists birth_country text,
  add column if not exists nationality text,
  add column if not exists height text,
  add column if not exists weight text,
  add column if not exists injured boolean,
  add column if not exists appearances integer,
  add column if not exists starts integer,
  add column if not exists minutes integer,
  add column if not exists goals integer,
  add column if not exists assists integer,
  add column if not exists api_average_rating numeric,
  add column if not exists profile_enriched_at timestamptz,
  add column if not exists market_value_eur numeric,
  add column if not exists market_value_currency text,
  add column if not exists market_value_source text,
  add column if not exists market_value_updated_at timestamptz;

create index if not exists players_nationality_idx
  on public.players (lower(nationality));

create index if not exists players_date_of_birth_idx
  on public.players (date_of_birth);
