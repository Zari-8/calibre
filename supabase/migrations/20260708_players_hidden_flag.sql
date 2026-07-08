-- Adds a visibility flag so duplicate/hollow player rows can be hidden from
-- every read surface (search, listings, talent pool) without deleting them.
-- The good sibling row is untouched; only the confirmed hollow duplicate gets
-- hidden = true, via scripts/hideDuplicateHollowShells.mjs.

ALTER TABLE players ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_players_hidden ON players (hidden) WHERE hidden;

-- If you have a search_players_unaccent RPC (checked from the client with a
-- try/catch fallback in supabasePlayers.js), it also needs a `WHERE NOT hidden`
-- clause. Locate it in the Supabase SQL editor under Database > Functions,
-- confirm its exact current body, and add `and coalesce(hidden, false) = false`
-- to its WHERE clause, then re-save. Not included here since its current
-- definition wasn't available to generate a safe CREATE OR REPLACE from.
