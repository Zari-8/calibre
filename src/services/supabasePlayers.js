import { supabase, supabaseConfigured } from './supabaseClient.js';

const DEFAULT_LIMIT = 20;

const PLAYER_SELECT = [
  'id',
  'api_player_id',
  'api_team_id',
  'league_id',
  'season',
  'slug',
  'name',
  'firstname',
  'lastname',
  'age',
  'date_of_birth',
  'nationality',
  'club',
  'team',
  'pos',
  'position',
  'raw_position',
  'shirt_number',
  'rating',
  'archetype',
  'img',
  'image',
  'appearances',
  'starts',
  'minutes',
  'goals',
  'assists',
  'api_average_rating',
  'source',
  'last_synced_at',
  'profile_enriched_at',
].join(',');

function requireSupabase(){
  if(!supabaseConfigured || !supabase){
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.');
  }

  return supabase;
}

function normalizePlayer(row){
  return {
    ...row,
    apiPlayerId:row.api_player_id ?? null,
    apiTeamId:row.api_team_id ?? null,
    leagueId:row.league_id ?? null,
    club:row.club || row.team || null,
    team:row.team || row.club || null,
    pos:row.pos || row.position || row.raw_position || 'Player',
    position:row.position || row.pos || row.raw_position || 'Player',
    img:row.img || row.image || null,
    image:row.image || row.img || null,
  };
}

export async function getSupabasePlayerCount(){
  const client = requireSupabase();

  const { count, error } = await client
    .from('players')
    .select('*',{count:'exact',head:true});

  if(error) throw error;
  return count || 0;
}

export async function getSupabasePlayers({
  names=[],
  leagueId=null,
  limit=DEFAULT_LIMIT,
  offset=0,
}={}){
  const client = requireSupabase();

  let query = client
    .from('players')
    .select(PLAYER_SELECT)
    .range(offset,offset+limit-1);

  if(Array.isArray(names) && names.length){
    query = query.in('name',names);
  }

  if(leagueId!==null && leagueId!==undefined && leagueId!==''){
    query = query.eq('league_id',Number(leagueId));
  }

  const { data, error } = await query.order('name',{ascending:true});

  if(error) throw error;
  return (data || []).map(normalizePlayer);
}

export async function searchSupabasePlayers(search,{limit=DEFAULT_LIMIT}={}){
  const client = requireSupabase();
  const query = String(search || '').trim();

  if(query.length<3) return [];

  const { data, error } = await client
    .from('players')
    .select(PLAYER_SELECT)
    .ilike('name',`%${query}%`)
    .order('name',{ascending:true})
    .limit(limit);

  if(error) throw error;
  return (data || []).map(normalizePlayer);
}
