-- Persists the per-team-season shotmap aggregate enrichStatsAPI.mjs was
-- already computing (via aggregateShotmap's teamAgg) but never wrote
-- anywhere — it just got discarded at the end of every run. Same shape as
-- team_indices (computeTeamIndices.mjs), keyed by StatsAPI's own team_id,
-- joined into derived_team_profiles downstream by normalized team name
-- (aggregateTeamStats.mjs already does this exact join for team_indices/PPDA).
--
-- The genuinely new signal here vs. what team_indices already has: shotmap
-- events carry situation (corner/free-kick/open play) and header/box flags
-- that per-match player-stats totals don't, so this is the only source for
-- the SHAPE of a team's attacking threat (how much of it comes from open
-- play vs. set pieces/penalties vs. headers), not just the volume.

CREATE TABLE IF NOT EXISTS team_shot_profiles (
  statsapi_team_id text NOT NULL,
  statsapi_competition_id text NOT NULL DEFAULT '',
  statsapi_season_id text NOT NULL DEFAULT '',
  team_name text,

  shots_for integer DEFAULT 0,
  shots_on_target_for integer DEFAULT 0,
  goals_for integer DEFAULT 0,
  xg_for numeric DEFAULT 0,
  open_play_xg_for numeric DEFAULT 0,
  set_piece_xg_for numeric DEFAULT 0,
  penalty_xg_for numeric DEFAULT 0,

  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (statsapi_team_id, statsapi_competition_id, statsapi_season_id)
);

CREATE INDEX IF NOT EXISTS team_shot_profiles_name_idx
  ON team_shot_profiles (team_name);
