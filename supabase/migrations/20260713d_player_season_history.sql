-- player_season_history — the archive table that was proposed earlier this
-- session but never actually built (task stayed "pending, if approved").
-- Purpose: `players` is a CURRENT-SEASON table — every enrichment script
-- (enrichPlayerStats.mjs, enrichStatsAPI.mjs, computeRatings.mjs,
-- backfillPlayerInjuries.mjs) overwrites its season-scoped columns in place.
-- When next season starts (~1 month out) and those scripts get pointed at
-- the new SEASON, this season's numbers would simply be overwritten with no
-- record left — there'd be no way to look back at "what was Fati's 2025-26
-- season score" once 2026-27 data lands in the same row.
--
-- This table is a frozen, dated snapshot: one row per (api_player_id,
-- season), populated by scripts/archiveSeasonSnapshot.mjs, meant to be run
-- once a season is finished/finalized and BEFORE the next season's
-- enrichment runs start overwriting `players`. Every subsequent season just
-- adds another row here — `players` never needs to grow extra season-N
-- columns, and old seasons stay queryable for career trend / trajectory
-- work indefinitely.
--
-- api_player_id (not players.id) is the join key going forward, since it's
-- the stable identity across seasons even if a `players` row gets merged,
-- re-imported, or re-keyed (see fixDuplicateIdentities.mjs precedent this
-- session — internal UUIDs have already proven less stable than the API id).

CREATE TABLE IF NOT EXISTS player_season_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  api_player_id integer NOT NULL,
  season text NOT NULL,

  -- identity/context at the time of archiving (names/teams change season to
  -- season — e.g. Fati: Barcelona -> Monaco — so this is captured per row,
  -- not assumed to match the live `players` row today)
  name text,
  team text,
  api_team_id integer,
  league_id text,
  position text,
  age integer,

  -- season totals
  appearances integer,
  starts integer,
  minutes integer,
  goals integer,
  assists integer,

  -- advanced stats (flattened for easy trend queries; full detail preserved
  -- in competition_splits below)
  api_average_rating numeric,
  pass_accuracy numeric,
  xg numeric,
  xa numeric,
  shot_accuracy numeric,
  key_passes numeric,

  -- the three Calibre scores as they stood when the season closed
  rating integer,            -- Season Score
  ability_rating integer,    -- Calibre
  availability_score integer,-- Selection

  -- durability context for that season
  injury_days_last_365 integer,
  major_injuries_count integer,

  -- full per-competition detail, preserved as-is for anything the flattened
  -- columns above don't cover
  competition_splits jsonb,

  archived_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'season_rollover',

  UNIQUE (api_player_id, season)
);

CREATE INDEX IF NOT EXISTS idx_player_season_history_player ON player_season_history (api_player_id);
CREATE INDEX IF NOT EXISTS idx_player_season_history_season ON player_season_history (season);
