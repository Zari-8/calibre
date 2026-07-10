-- Missed this sibling of penalty.won/scored/missed last time (API-Football
-- spells it "commited"). A real defensive-lapse signal — surfaced by cross-
-- checking against TheStatsAPI's independent season endpoint, which has the
-- same concept as discipline.penalty_conceded (probeStatsApiSeasonEndpoint.mjs
-- real sample: Ben White, 20260712).

ALTER TABLE players ADD COLUMN IF NOT EXISTS penalty_conceded integer;
