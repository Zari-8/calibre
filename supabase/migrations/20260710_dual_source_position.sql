-- Two independent, real per-match/per-competition position signals, kept
-- separate from the existing position/pos/primary_role/raw_position columns
-- (whose original source we could not trace in this repo) so they can be
-- compared before anything gets overwritten.
--
-- api_position      — API-Football's games.position, already fetched by
--                      enrichPlayerStats.mjs on every re-enrichment run but
--                      previously discarded.
-- statsapi_position — mode of TheStatsAPI's per-match position code (G/D/M/F)
--                      across every match enrichStatsAPI.mjs processed for
--                      that player, translated to word form.
-- statsapi_position_counts — jsonb breakdown of the raw per-code match counts
--                      behind statsapi_position, for transparency (e.g. a
--                      player who's 30 M / 4 D across the season should be
--                      trusted more than one who's 4 M / 3 D).

ALTER TABLE players ADD COLUMN IF NOT EXISTS api_position text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS statsapi_position text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS statsapi_position_counts jsonb;
