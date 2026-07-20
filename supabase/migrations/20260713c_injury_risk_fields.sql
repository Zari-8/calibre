-- Injury/durability risk fields — added to support calibreValue.js's new
-- Injury Risk factor (see calibreRating.js sibling changes same date).
--
-- SOURCE: TheStatsAPI has no injuries endpoint at all (confirmed via
-- scripts/probeStatsApiInjuries.mjs — every candidate path 404'd). Pivoted to
-- API-Football's documented /injuries endpoint (scripts/probeApiFootballInjuries.mjs
-- confirmed the real shape: fixture-scoped rows, no duration field). These
-- two columns are therefore a RECONSTRUCTED ESTIMATE built by
-- scripts/backfillPlayerInjuries.mjs from fixture-linked rows, not a fact
-- read directly off any API — see that script's header comment for the
-- spell-merging method used to turn "missed these fixtures" into day counts.
--
-- injury_days_last_365   : days spent injured in the trailing 12 months —
--   the closest read of "is this player currently a durability risk," not
--   a lifetime tally that would unfairly punish an old injury he's long
--   recovered from.
-- major_injuries_count   : count of significant/long-layoff injuries across
--   career — a track-record signal distinct from the last-12-months figure
--   (a player with one bad ACL three years ago and none since reads
--   differently from one with a new soft-tissue issue every few months).
-- injuries_synced_at     : when this player's injury data was last pulled,
--   so stale/never-synced rows can be told apart from genuinely
--   injury-free ones (both look like "0 days" otherwise).

ALTER TABLE players ADD COLUMN IF NOT EXISTS injury_days_last_365 integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS major_injuries_count integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS injuries_synced_at timestamptz;
