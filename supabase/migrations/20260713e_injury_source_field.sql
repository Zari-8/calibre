-- Hybrid injury backfill: for players with a statsapi_player_id, real
-- injury/suspension records from TheStatsAPI's confirmed endpoint
-- (GET /players/{id}/injuries-suspensions) now override the API-Football
-- fixture-miss reconstruction. This column records which source actually
-- produced a given player's injury_days_last_365/major_injuries_count, so
-- the difference between a verified real record and an estimate is never
-- silently lost — mirrors the same honesty pattern as injuries_synced_at
-- (stale vs synced) rather than presenting both as equally reliable.

ALTER TABLE players ADD COLUMN IF NOT EXISTS injury_source text;
