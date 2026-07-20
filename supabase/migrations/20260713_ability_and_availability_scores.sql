-- Dual-score rating redesign. Calibre Rating (players.rating) blends realized
-- season output with selection/availability factors (Consistency, Impact) —
-- correct for "how good has he been this season" but wrong for "how good is
-- he," since it silently punishes players with limited minutes for reasons
-- that have nothing to do with ability (injury recovery, new-manager trust,
-- squad depth at their prior club). Real case: Ansu Fati, 11 goals in 1086
-- minutes at Monaco, scored 59 (stale) / 74 (recomputed) on the blended
-- season score despite a 91/100 production read once selection is factored
-- out.
--
-- ability_rating: current true-skill snapshot, decoupled from how much a
--   manager played him this season — production + match-quality signal only,
--   passed through the same calibration curve as players.rating so the two
--   numbers sit on the same visual scale (e.g. Musiala 77 season / 89
--   ability).
-- availability_score: the season workload/reliability signal that used to be
--   silently baked into players.rating (start-rate, minutes-per-appearance,
--   total minutes) — surfaced as its own labeled metric instead, meaningful
--   context for Transfer/System Fit risk framing rather than a hidden
--   discount on "is he good."

ALTER TABLE players ADD COLUMN IF NOT EXISTS ability_rating integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS availability_score integer;
