-- Adds real goalkeeper shot-stopping fields, sourced from API-Football's
-- existing player-statistics response (goals.saves, goals.conceded,
-- penalty.saved) — these were already in the raw payload enrichPlayerStats.mjs
-- fetches every run, just never extracted or stored. No new API calls needed,
-- only a re-run of the enrichment script (see scripts/listGoalkeepers.mjs).
--
-- Used by calibreRating.js to compute a real save% signal for GKs instead of
-- relying almost entirely on reputation (api_average_rating).

ALTER TABLE players ADD COLUMN IF NOT EXISTS saves integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS goals_conceded integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS penalty_saved integer;
