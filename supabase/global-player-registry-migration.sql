-- Calibre global player-registry support
-- Run once in Supabase SQL Editor.
-- Safe to run after the previous registry and enrichment migrations.

alter table public.players
  add column if not exists api_player_id bigint,
  add column if not exists slug text,
  add column if not exists name text,
  add column if not exists firstname text,
  add column if not exists lastname text,
  add column if not exists age integer,
  add column if not exists date_of_birth date,
  add column if not exists birth_place text,
  add column if not exists birth_country text,
  add column if not exists nationality text,
  add column if not exists height text,
  add column if not exists weight text,
  add column if not exists injured boolean,
  add column if not exists img text,
  add column if not exists image text,
  add column if not exists source text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists profile_enriched_at timestamptz;

create unique index if not exists players_api_player_id_key
  on public.players (api_player_id);

create index if not exists players_name_search_idx
  on public.players (lower(name));

create index if not exists players_nationality_idx
  on public.players (lower(nationality));
