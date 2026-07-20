-- player_competition_profiles (the view backing league-filtered player
-- listings) explicitly lists columns rather than SELECT * — it needs the two
-- new dual-score fields added directly, or league-filtered views of a player
-- (e.g. searching Players by league) never see ability_rating/
-- availability_score even after computeRatings.mjs backfills them.

CREATE OR REPLACE VIEW player_competition_profiles AS
SELECT
  p.id,
  p.api_player_id,

  pc.api_team_id,
  pc.league_id,
  pc.season,

  p.slug,
  p.name,
  p.firstname,
  p.lastname,
  p.date_of_birth,
  p.nationality,
  p.gender,

  p.club,
  pc.team,

  p.pos,
  p.position,
  p.raw_position,
  p.shirt_number,

  p.rating,
  p.ability_rating,
  p.availability_score,
  p.archetype,
  p.primary_role,

  p.img,
  p.image,
  p.image_url,

  p.appearances,
  p.starts,
  p.minutes,
  p.goals,
  p.assists,
  p.api_average_rating,

  p.source,
  p.last_synced_at,
  p.profile_enriched_at,

  p.trajectory_score,
  p.next_step,
  p.calibre_tier
FROM player_competitions pc
JOIN players p
  ON p.api_player_id = pc.api_player_id;
