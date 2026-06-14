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
  'primary_role',
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
  // ── event stats (required by the v6 rating engine) ──
  'stats_minutes',
  'passes',
  'pass_accuracy',
  'key_passes',
  'dribbles_success',
  'dribbles_attempts',
  'tackles',
  'interceptions',
  'duels_won',
  'shots',
  'competition_splits',
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

function officialPlayerImage(row){
  const apiPlayerId = row.api_player_id ?? null;
  return row.image || row.img || (apiPlayerId ? `https://media.api-sports.io/football/players/${apiPlayerId}.png` : null);
}

function normalizePlayer(row){
  const image = officialPlayerImage(row);
  return {
    ...row,
    apiPlayerId:row.api_player_id ?? null,
    apiTeamId:row.api_team_id ?? null,
    leagueId:row.league_id ?? null,
    club:row.club || row.team || null,
    team:row.team || row.club || null,
    pos:row.pos || row.position || row.raw_position || 'Player',
    position:row.position || row.pos || row.raw_position || 'Player',
    img:image,
    image,
    apiAverageRating:row.api_average_rating ?? null,
    appearances:Number(row.appearances || 0),
    starts:Number(row.starts || 0),
    minutes:Number(row.minutes || 0),
    goals:Number(row.goals || 0),
    assists:Number(row.assists || 0),
    // event stats pass through (numbers kept as-is; rating engine coerces safely)
    stats_minutes:row.stats_minutes ?? null,
    passes:row.passes ?? null,
    pass_accuracy:row.pass_accuracy ?? null,
    key_passes:row.key_passes ?? null,
    dribbles_success:row.dribbles_success ?? null,
    dribbles_attempts:row.dribbles_attempts ?? null,
    tackles:row.tackles ?? null,
    interceptions:row.interceptions ?? null,
    duels_won:row.duels_won ?? null,
    shots:row.shots ?? null,
    // competition splits drive the 70/30 base+overlay blend (jsonb → object)
    competition_splits:row.competition_splits ?? null,
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

  const hasLeagueFilter =
    leagueId !== null &&
    leagueId !== undefined &&
    leagueId !== '';

  // The league-browse path reads the player_competition_profiles VIEW, which
  // does not carry the players-table-only competition_splits column. Requesting
  // it there makes Supabase throw ("League browse could not load"). Drop it for
  // the view; the rating engine simply falls back to its no-splits path.
  const selectCols = hasLeagueFilter
    ? PLAYER_SELECT.filter(col => col !== 'competition_splits')
    : PLAYER_SELECT;

  let query = client
    .from(hasLeagueFilter ? 'player_competition_profiles' : 'players')
    .select(selectCols)
    .range(offset,offset+limit-1);

  if(Array.isArray(names) && names.length){
    query = query.in('name',names);
  }

  if(hasLeagueFilter){
    query = query.eq('league_id',Number(leagueId));
  }

  const { data, error } = await query.order('name',{ascending:true});

  if(error) throw error;
  return (data || []).map(normalizePlayer);
}

export async function getSupabaseTalentCandidates({limit=240}={}){
  const client = requireSupabase();

  const { data, error } = await client
    .from('players')
    .select(PLAYER_SELECT)
    .not('age','is',null)
    .gte('age',16)
    .lte('age',22)
    .order('minutes',{ascending:false,nullsFirst:false})
    .limit(limit);

  if(error) throw error;
  return (data || []).map(normalizePlayer);
}

// Resolve players by their api_player_id — the stable key the enrichment writes.
// Name lookups miss players stored under accented/legal names (Güler, Neves),
// so any surface that knows the id should resolve by id and never fall back to a
// stale hardcoded anchor.
export async function getSupabasePlayersByApiIds(apiIds=[]){
  const client = requireSupabase();
  const ids = (Array.isArray(apiIds)?apiIds:[apiIds]).map(Number).filter(n=>Number.isInteger(n)&&n>0);
  if(!ids.length) return [];

  const { data, error } = await client
    .from('players')
    .select(PLAYER_SELECT)
    .in('api_player_id',ids);

  if(error) throw error;
  return (data || []).map(normalizePlayer);
}

export async function searchSupabasePlayers(search,{limit=DEFAULT_LIMIT}={}){
  const client = requireSupabase();
  const query = String(search || '').trim();

  if(query.length<3) return [];

  // Try the accent-insensitive RPC first (requires the unaccent extension +
  // search_players_unaccent function in the DB). Falls back to plain ilike if
  // the function hasn't been created yet, so existing installs keep working.
  try {
    const { data, error } = await client.rpc('search_players_unaccent', {
      search_term: query,
      max_results: limit,
    });
    if (!error && data) return (data || []).map(normalizePlayer);
  } catch { /* RPC not available — fall through */ }

  const { data, error } = await client
    .from('players')
    .select(PLAYER_SELECT)
    .ilike('name',`%${query}%`)
    .order('name',{ascending:true})
    .limit(limit);

  if(error) throw error;
  return (data || []).map(normalizePlayer);
}
