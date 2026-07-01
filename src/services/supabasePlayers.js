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
  'full_name',
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
  // ── TheStatsAPI enriched event stats (v8.1) ──
  'statsapi_player_id',
  'big_chances_created',
  'big_chances_missed',
  'total_shots',
  'shots_on_target',
  'shot_accuracy',
  'final_third_passes',
  'opp_half_passes',
  'own_half_passes',
  'accurate_crosses',
  'cross_accuracy',
  'ground_duel_win_pct',
  'aerial_duel_win_pct',
  'dribble_success_pct',
  'successful_dribbles',
  'statsapi_enriched_at',
  'pressures',
  'progressive_carries',
  'clearances',
  'dispossessed',
  'aerial_duels_won',
  'possession_lost',
  'was_fouled',
  'touches',
  'long_ball_accuracy',
  'accurate_long_balls',
  'total_long_balls',
  'total_crosses',
  'blocked_shots',
  'shots_off_target',
  'accurate_passes',
  'total_passes',
  'shot_quality',
  'xa_per_90',
  'xg_per_90',
  'outside_box_xg',
  'headed_xg',
  'penalty_xg',
  'set_piece_xg',
  'open_play_xg',
  'expected_assists',
  'np_expected_goals',
  'expected_goals',
  'xa',
  'npxg',
  'xg',
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
    // full_name for search display
    full_name:row.full_name ?? null,
    // event stats pass through
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
    competition_splits:row.competition_splits ?? null,
    // TheStatsAPI enriched signals (v8.1)
    statsapi_player_id:row.statsapi_player_id ?? null,
    big_chances_created:row.big_chances_created ?? null,
    big_chances_missed:row.big_chances_missed ?? null,
    total_shots:row.total_shots ?? null,
    shots_on_target:row.shots_on_target ?? null,
    shot_accuracy:row.shot_accuracy ?? null,
    final_third_passes:row.final_third_passes ?? null,
    opp_half_passes:row.opp_half_passes ?? null,
    own_half_passes:row.own_half_passes ?? null,
    accurate_crosses:row.accurate_crosses ?? null,
    cross_accuracy:row.cross_accuracy ?? null,
    ground_duel_win_pct:row.ground_duel_win_pct ?? null,
    aerial_duel_win_pct:row.aerial_duel_win_pct ?? null,
    dribble_success_pct:row.dribble_success_pct ?? null,
    successful_dribbles:row.successful_dribbles ?? null,

    // TheStatsAPI advanced enrichment layer
    xg:row.xg ?? null,
    npxg:row.npxg ?? null,
    xa:row.xa ?? null,
    expected_goals:row.expected_goals ?? null,
    np_expected_goals:row.np_expected_goals ?? null,
    expected_assists:row.expected_assists ?? null,
    open_play_xg:row.open_play_xg ?? null,
    set_piece_xg:row.set_piece_xg ?? null,
    penalty_xg:row.penalty_xg ?? null,
    headed_xg:row.headed_xg ?? null,
    outside_box_xg:row.outside_box_xg ?? null,
    xg_per_90:row.xg_per_90 ?? null,
    xa_per_90:row.xa_per_90 ?? null,
    shot_quality:row.shot_quality ?? null,

    total_passes:row.total_passes ?? null,
    accurate_passes:row.accurate_passes ?? null,
    total_crosses:row.total_crosses ?? null,
    total_long_balls:row.total_long_balls ?? null,
    accurate_long_balls:row.accurate_long_balls ?? null,
    long_ball_accuracy:row.long_ball_accuracy ?? null,

    shots_off_target:row.shots_off_target ?? null,
    blocked_shots:row.blocked_shots ?? null,

    touches:row.touches ?? null,
    was_fouled:row.was_fouled ?? null,
    possession_lost:row.possession_lost ?? null,
    aerial_duels_won:row.aerial_duels_won ?? null,
    dispossessed:row.dispossessed ?? null,
    clearances:row.clearances ?? null,

    progressive_carries:row.progressive_carries ?? null,
    pressures:row.pressures ?? null,
    statsapi_enriched_at:row.statsapi_enriched_at ?? null,

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

  const selectCols = hasLeagueFilter
    ? PLAYER_SELECT.split(',').filter(col => col !== 'competition_splits').join(',')
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

// Resolve players by api_player_id — used by WC breakout stars, player modals,
// and any surface that knows the numeric API id.
// Tries the primary row first (best stats), then falls back to any row for that id.
export async function getSupabasePlayersByApiIds(apiIds=[]){
  const client = requireSupabase();
  const ids = (Array.isArray(apiIds)?apiIds:[apiIds])
    .map(Number)
    .filter(n=>Number.isInteger(n)&&n>0);
  if(!ids.length) return [];

  // First pass: rows that have a rating and appearances (real enriched data)
  const { data: enriched, error: e1 } = await client
    .from('players')
    .select(PLAYER_SELECT)
    .in('api_player_id',ids)
    .not('rating','is',null)
    .order('appearances',{ascending:false,nullsFirst:false});

  if(e1) throw e1;

  // Deduplicate — keep the best row per api_player_id
  const seen = new Set();
  const best = [];
  for(const row of (enriched||[])){
    const aid = row.api_player_id;
    if(!seen.has(aid)){ seen.add(aid); best.push(row); }
  }

  // Second pass: any ids not yet resolved (no enriched row exists yet)
  const missing = ids.filter(id => !seen.has(id));
  if(missing.length){
    const { data: fallback, error: e2 } = await client
      .from('players')
      .select(PLAYER_SELECT)
      .in('api_player_id',missing);
    if(e2) throw e2;
    for(const row of (fallback||[])){
      const aid = row.api_player_id;
      if(!seen.has(aid)){ seen.add(aid); best.push(row); }
    }
  }

  return best.map(normalizePlayer);
}

// Full search: matches on abbreviated name (L. Messi), full_name (Lionel Messi),
// or unaccented variants. Falls through three layers for max coverage.
export async function searchSupabasePlayers(search,{limit=DEFAULT_LIMIT}={}){
  const client = requireSupabase();
  const query = String(search || '').trim();
  if(query.length<2) return [];

  // Layer 1 — accent-insensitive RPC (best results, requires DB function)
  try {
    const { data, error } = await client.rpc('search_players_unaccent', {
      search_term: query,
      max_results: limit,
    });
    if(!error && data && data.length) return (data||[]).map(normalizePlayer);
  } catch { /* RPC not available — fall through */ }

  // Layer 2 — search both name and full_name columns simultaneously
  // This handles "Lionel Messi" → finds row stored as "L. Messi" via full_name,
  // and "Güler" → finds "Arda Güler" via name ilike
  const { data: nameData, error: nameError } = await client
    .from('players')
    .select(PLAYER_SELECT)
    .or(`name.ilike.%${query}%,full_name.ilike.%${query}%`)
    .order('appearances',{ascending:false,nullsFirst:false})
    .limit(limit);

  if(!nameError && nameData && nameData.length){
    return nameData.map(normalizePlayer);
  }

  // Layer 3 — firstname/lastname fallback for partial matches
  // "Lionel" alone hits firstname, "Junior" hits name directly
  const { data: namePartial, error: e3 } = await client
    .from('players')
    .select(PLAYER_SELECT)
    .or(`firstname.ilike.%${query}%,lastname.ilike.%${query}%`)
    .order('appearances',{ascending:false,nullsFirst:false})
    .limit(limit);

  if(e3) throw e3;
  return (namePartial||[]).map(normalizePlayer);
}
