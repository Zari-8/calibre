-- search_players_unaccent (20260714_search_players_unaccent.sql) fixed
-- accents but still requires an exact substring match — it does not
-- tolerate typos. "bernado silva" (missing the second 'r' in Bernardo)
-- is simply not a substring of "bernardo silva", so the ILIKE-only
-- version returns nothing and the caller falls through to the external
-- API-Football search, which has the same problem and can return
-- unrelated players.
--
-- This replaces the function with a trigram-similarity version (pg_trgm)
-- that tolerates missing/extra/swapped letters, while still keeping exact
-- substring matches (which score highest) ranked first. CREATE OR REPLACE
-- is safe to run even if the prior migration was never applied.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() is STABLE, not IMMUTABLE, so it can't be used directly in a
-- functional index. This wrapper pins it to the default text search
-- dictionary and marks it IMMUTABLE so it can back a trigram index.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, extensions
AS $$
  SELECT unaccent($1);
$$;

CREATE INDEX IF NOT EXISTS players_name_trgm_idx
  ON players USING gin (immutable_unaccent(lower(name)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS players_full_name_trgm_idx
  ON players USING gin (immutable_unaccent(lower(coalesce(full_name, ''))) gin_trgm_ops);

-- v2: similarity() compares two WHOLE strings, so it's diluted by target
-- length — "silva" vs "Vitinha" (both short) could out-score "silva" vs
-- "Bernardo Silva" (much longer) even though the latter contains an exact
-- substring match. That let irrelevant short names outrank real Silvas.
-- word_similarity() finds the best-matching substring regardless of target
-- length, which is the correct tool here, and exact ILIKE matches are now
-- always ranked first regardless of fuzzy score.
CREATE OR REPLACE FUNCTION search_players_unaccent(search_term text, max_results integer DEFAULT 20)
RETURNS SETOF players
LANGUAGE sql
STABLE
AS $$
  WITH q AS (
    SELECT immutable_unaccent(lower(search_term)) AS term
  )
  SELECT p.*
  FROM players p, q
  WHERE coalesce(p.hidden, false) = false
    AND (
      immutable_unaccent(lower(p.name)) ILIKE '%' || q.term || '%'
      OR immutable_unaccent(lower(coalesce(p.full_name, ''))) ILIKE '%' || q.term || '%'
      OR GREATEST(
           word_similarity(q.term, immutable_unaccent(lower(p.name))),
           word_similarity(q.term, immutable_unaccent(lower(coalesce(p.full_name, ''))))
         ) > 0.35
    )
  ORDER BY
    (
      immutable_unaccent(lower(p.name)) ILIKE '%' || q.term || '%'
      OR immutable_unaccent(lower(coalesce(p.full_name, ''))) ILIKE '%' || q.term || '%'
    ) DESC,
    GREATEST(
      word_similarity(q.term, immutable_unaccent(lower(p.name))),
      word_similarity(q.term, immutable_unaccent(lower(coalesce(p.full_name, ''))))
    ) DESC,
    p.appearances DESC NULLS LAST
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION search_players_unaccent(text, integer) TO anon, authenticated;
