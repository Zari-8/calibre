import { supabase } from './supabaseClient.js';

export async function getSupabasePlayers() {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('players')
    .select(`
      id,
      name,
      slug,
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

  if (error) {
    throw error;
  }

  return data || [];
}
