-- Calibre player-registry migration
-- Run this once in Supabase: SQL Editor -> New query -> Paste -> Run

alter table public.players
  add column if not exists api_player_id bigint,
  add column if not exists api_team_id bigint,
  add column if not exists league_id integer,
  add column if not exists season integer,
  add column if not exists raw_position text,
  add column if not exists shirt_number integer,
  add column if not exists source text,
  add column if not exists last_synced_at timestamptz;

-- Required by the importer so repeat imports update a player instead of duplicating him.
create unique index if not exists players_api_player_id_key
  on public.players (api_player_id);

-- Useful for fast landing-index searches.
create index if not exists players_name_search_idx
  on public.players (lower(name));

create index if not exists players_team_search_idx
  on public.players (lower(team));

create index if not exists players_league_id_idx
  on public.players (league_id);
