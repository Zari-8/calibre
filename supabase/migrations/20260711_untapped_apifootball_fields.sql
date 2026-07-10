-- These are ALL sibling fields inside the SAME API-Football player-stats
-- response enrichPlayerStats.mjs already fetches on every run — no new API
-- calls, no new cost. They were simply never read off the response object.
--   duels.total          -> duels_total       (lets us compute a REAL win%,
--                                               not just a raw won-count)
--   shots.on              -> shots_on          (real shot accuracy from the
--                                               base source, not just StatsAPI)
--   tackles.blocks         -> tackle_blocks     (shots/crosses blocked)
--   dribbles.past          -> dribbled_past     (times beaten by a dribble —
--                                               a real defensive weakness signal)
--   cards.yellow/red       -> yellow_cards / red_cards
--   fouls.committed/drawn  -> fouls_committed / fouls_drawn
--   penalty.won/scored/missed -> penalty_won / penalty_scored / penalty_missed
--     (penalty.saved already added in 20260709_gk_shotstopping_fields.sql)

ALTER TABLE players ADD COLUMN IF NOT EXISTS duels_total integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS shots_on integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS tackle_blocks integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS dribbled_past integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS yellow_cards integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS red_cards integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS fouls_committed integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS fouls_drawn integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS penalty_won integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS penalty_scored integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS penalty_missed integer;
