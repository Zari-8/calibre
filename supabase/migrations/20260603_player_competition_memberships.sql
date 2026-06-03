CREATE TABLE IF NOT EXISTS player_competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  api_player_id bigint NOT NULL,
  league_id integer NOT NULL,
  season integer NOT NULL,
  api_team_id bigint,
  team text,
  source text DEFAULT 'api-football',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT player_competitions_unique_membership
    UNIQUE (api_player_id, league_id, season)
);

CREATE INDEX IF NOT EXISTS player_competitions_api_player_id_idx
  ON player_competitions (api_player_id);

CREATE INDEX IF NOT EXISTS player_competitions_league_id_idx
  ON player_competitions (league_id);

CREATE INDEX IF NOT EXISTS player_competitions_api_team_id_idx
  ON player_competitions (api_team_id);

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
