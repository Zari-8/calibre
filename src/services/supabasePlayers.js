import { supabase } from './supabaseClient.js';

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;

  const birthDate = new Date(dateOfBirth);

  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasNotHadBirthday =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate());

  if (hasNotHadBirthday) age -= 1;

  return age;
}

function latestRating(ratings) {
  const rows = Array.isArray(ratings)
    ? ratings
    : ratings
      ? [ratings]
      : [];

  return [...rows].sort((a, b) =>
    String(b?.season || '').localeCompare(String(a?.season || '')),
  )[0] || null;
}

function relatedTeam(teamValue) {
  if (Array.isArray(teamValue)) return teamValue[0] || null;
  return teamValue || null;
}

export async function getSupabasePlayers() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('players')
    .select(`
      id,
      api_player_id,
      name,
      slug,
      date_of_birth,
      nationality,
      gender,
      position,
      primary_role,
      archetype,
      image_url,
      teams (
        name,
        short_name
      ),
      player_ratings (
        calibre_rating,
        debate_index,
        season
      )
    `)
    .order('name');

  if (error) throw error;

  return (data || []).map((row) => {
    const team = relatedTeam(row.teams);
    const rating = latestRating(row.player_ratings);
    const club = team?.short_name || team?.name || '';

    return {
      id: row.id,
      apiPlayerId: row.api_player_id,
      name: row.name,
      slug: row.slug,
      age: calculateAge(row.date_of_birth),
      nationality: row.nationality,
      gender: row.gender,
      team: club,
      club,
      position: row.position,
      pos: row.position,
      primaryRole: row.primary_role,
      archetype: row.archetype,
      image: row.image_url || '/assets/players/neutral-player.svg',
      img: row.image_url || '/assets/players/neutral-player.svg',
      rating:
        rating?.calibre_rating === null ||
        rating?.calibre_rating === undefined
          ? null
          : Number(rating.calibre_rating),
      debateIndex:
        rating?.debate_index === null ||
        rating?.debate_index === undefined
          ? null
          : Number(rating.debate_index),
      season: rating?.season || null,
      source: 'supabase',
    };
  });
}
