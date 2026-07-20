-- Fixes accent-sensitive player search (e.g. "fermin lopez" not finding
-- "Fermín López"). src/services/supabasePlayers.js's searchSupabasePlayers()
-- tries an RPC called search_players_unaccent first, silently falling back
-- to a plain `ilike` search if the RPC errors or doesn't exist — plain
-- ilike does NOT strip accents in Postgres, so "fermin lopez" ilike
-- '%fermin lopez%' against a row storing "Fermín López" simply never
-- matches. A prior migration (20260708_players_hidden_flag.sql) flagged
-- that nobody could confirm whether this RPC actually existed or what it
-- did — this defines it properly (CREATE OR REPLACE is safe either way),
-- so this is no longer a silent maybe.
--
-- This likely fixes search for every accented name in the DB, not just one
-- player — Fermín López was just the one that surfaced it.

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION search_players_unaccent(search_term text, max_results integer DEFAULT 20)
RETURNS SETOF players
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM players
  WHERE coalesce(hidden, false) = false
    AND (
      unaccent(lower(name)) ILIKE '%' || unaccent(lower(search_term)) || '%'
      OR unaccent(lower(coalesce(full_name, ''))) ILIKE '%' || unaccent(lower(search_term)) || '%'
    )
  ORDER BY appearances DESC NULLS LAST
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION search_players_unaccent(text, integer) TO anon, authenticated;
