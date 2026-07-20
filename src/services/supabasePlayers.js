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
  'ability_rating',
  'availability_score',
  'archetype',
  'img',
  'image',
  'appearances',
  'starts',
  'minutes',
  'goals',
  'assists',
  'yellow_cards',
  'red_cards',
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
  // ── availability / injury signals (backfillPlayerInjuries.mjs) ──
  'injured',
  'injury_days_last_365',
  'major_injuries_count',
  'injury_source',
  'injuries_synced_at',
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

    // Availability / injury (backfillPlayerInjuries.mjs) — real, or null if
    // that team hasn't been backfilled yet. Never guessed.
    injured:row.injured ?? null,
    injury_days_last_365:row.injury_days_last_365 ?? null,
    major_injuries_count:row.major_injuries_count ?? null,
    injury_source:row.injury_source ?? null,
    injuries_synced_at:row.injuries_synced_at ?? null,

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

  if(!hasLeagueFilter){
    query = query.or('hidden.is.null,hidden.eq.false');
  }

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

// A real, rotating pool of top-rated players for the Players landing page's
// "Featured Players" strip — see getSupabaseTopPlayers usage in Players.jsx.
// Ordered by ability_rating (falls back to rating) so it's an honest "best
// players in the bank" cut, not a hand-picked list.
export async function getSupabaseTopPlayers({limit=80}={}){
  const client = requireSupabase();
  const { data, error } = await client
    .from('players')
    .select(PLAYER_SELECT)
    .or('hidden.is.null,hidden.eq.false')
    .not('ability_rating','is',null)
    .order('ability_rating',{ascending:false,nullsFirst:false})
    .limit(limit);
  if(error) throw error;
  return (data || []).map(normalizePlayer);
}

export async function getSupabaseTalentCandidates({limit=240}={}){
  const client = requireSupabase();
  const { data, error } = await client
    .from('players')
    .select(PLAYER_SELECT)
    .or('hidden.is.null,hidden.eq.false')
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
    .or('hidden.is.null,hidden.eq.false')
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
      .in('api_player_id',missing)
      .or('hidden.is.null,hidden.eq.false');
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
    .or('hidden.is.null,hidden.eq.false')
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
    .or('hidden.is.null,hidden.eq.false')
    .order('appearances',{ascending:false,nullsFirst:false})
    .limit(limit);

  if(e3) throw e3;
  return (namePartial||[]).map(normalizePlayer);
}

// Club search — lets a user find a club by name and then browse its roster,
// same pattern as searchSupabasePlayers (ilike on team/club, both columns
// checked since different enrichment passes have populated one or the other
// for different rows). Returns distinct club names, not player rows — the
// caller then fetches the roster for whichever club is picked via
// getSupabasePlayersByClub below.
export async function searchSupabaseClubs(search,{limit=8}={}){
  const client = requireSupabase();
  const query = String(search || '').trim();
  if(query.length<2) return [];

  const { data, error } = await client
    .from('players')
    .select('team,club')
    .or(`team.ilike.%${query}%,club.ilike.%${query}%`)
    .or('hidden.is.null,hidden.eq.false')
    .limit(200); // dedupe client-side below; a name match can hit many player rows for the same club

  if(error) throw error;

  const seen = new Set();
  const clubs = [];
  for(const row of data || []){
    const name = row.team || row.club;
    if(!name || seen.has(name)) continue;
    seen.add(name);
    clubs.push(name);
    if(clubs.length >= limit) break;
  }
  return clubs;
}

// Full roster for a club name resolved via searchSupabaseClubs above — exact
// match (not ilike) since the caller already picked a real, disambiguated
// club name from the dropdown, not a free-text guess.
export async function getSupabasePlayersByClub(clubName,{limit=100}={}){
  const client = requireSupabase();
  const name = String(clubName || '').trim();
  if(!name) return [];

  const { data, error } = await client
    .from('players')
    .select(PLAYER_SELECT)
    .or(`team.eq.${name},club.eq.${name}`)
    .or('hidden.is.null,hidden.eq.false')
    .order('rating',{ascending:false,nullsFirst:false})
    .limit(limit);

  if(error) throw error;
  return (data || []).map(normalizePlayer);
}

// Real comparison pool for the player pop-up's "Advanced Stats" percentile
// bars. Pulls enriched, rated players from the same rough position group
// (matched on the free-text pos/position/raw_position columns, same trick
// positionBucket() in calibreRating.js uses) so a percentile reads as "vs
// other forwards/mids/defenders in the bank," not vs the whole player pool.
// leagueIds narrows to a given tier (top-5 leagues by default) when supplied.
// Real rows only — an empty/short pool just means the modal shows fewer
// percentile bars, never a fabricated one.
const POSITION_MATCH = {
  ATT: 'attack,forward,striker,winger,wing,cf,st,rw,lw,fwd',
  MID: 'midfield,cam,cdm,cm,mid',
  DEF: 'defen,back,cb,rb,lb,wing-back,wingback',
  GK: 'keeper,goalkeeper,gk',
};
export async function getSupabasePositionPool({ bucket, leagueIds = null, limit = 300 } = {}) {
  const client = requireSupabase();
  const terms = (POSITION_MATCH[bucket] || '').split(',').filter(Boolean);
  if (!terms.length) return [];

  let query = client
    .from('players')
    .select(PLAYER_SELECT)
    .or('hidden.is.null,hidden.eq.false')
    .not('rating', 'is', null)
    .or(terms.map(t => `position.ilike.%${t}%`).concat(terms.map(t => `pos.ilike.%${t}%`)).join(','))
    .order('minutes', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (Array.isArray(leagueIds) && leagueIds.length) {
    query = query.in('league_id', leagueIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizePlayer);
}

// Shared full-table pagination for the landing-page stat cards below. A
// plain `.select(col).limit(N)` with no ORDER BY has no guaranteed row order
// on a 400k+ row table — Postgres can hand back a different arbitrary N-row
// slice on every call (parallel seq scan, no index to walk), which is why
// the Nations stat was flickering between ~73 and ~102 on refresh and the
// Leagues stat was stuck at an implausible "2" (the unordered slice happened
// to land on rows from just one or two import batches). Paginating by the
// primary key in fixed windows makes every call walk the SAME rows in the
// SAME order, so a full pass sees every row exactly once — a true count,
// not a lucky/unlucky sample. 100k-row pages keep this to ~5 requests for
// the full bank rather than one single (unreliable) giant `.limit()` call.
async function fetchAllColumnValues(column){
  const client = requireSupabase();
  const pageSize = 100000;
  const values = [];
  let from = 0;
  while(true){
    const { data, error } = await client
      .from('players')
      .select(column)
      .not(column,'is',null)
      .order('id',{ ascending:true })
      .range(from, from + pageSize - 1);
    if(error) throw error;
    if(!data || !data.length) break;
    for(const row of data) values.push(row[column]);
    if(data.length < pageSize) break;
    from += pageSize;
  }
  return values;
}

// Real distinct-nationality count for the Players page's "Nations" stat card
// — replaces a hardcoded "200+" with an actual count from the DB, walking
// the full table (see fetchAllColumnValues) so it's a stable true count
// rather than a flickering sample.
export async function getSupabaseNationCount(){
  const values = await fetchAllColumnValues('nationality');
  const distinct = new Set(values.map(v => String(v || '').trim().toLowerCase()).filter(Boolean));
  return distinct.size;
}

// Real distinct-league count for the Players page's "Leagues covered" stat
// card — replaces a hardcoded count that was actually just the length of the
// quick-filter dropdown (LEAGUE_OPTIONS, 9 curated top leagues), not the real
// number of leagues represented in the player bank. league_id is the only
// reliable league identifier stored per row (no league-name column).
export async function getSupabaseLeagueCount(){
  const values = await fetchAllColumnValues('league_id');
  const distinct = new Set(values.filter(v => v != null));
  return distinct.size;
}

// Real "season coverage" for the Players page stat card — replaces a
// date-computed CURRENT_SEASON guess that flips on July 1 even though most
// leagues (and the bulk data sync) don't catch up until August, which is why
// the landing page could claim "26/27" while every player modal was still
// correctly falling back to 25/26 data. This returns the season value that
// actually has the most rows synced in the bank right now (the mode of the
// `season` column), so the badge matches what visitors actually see.
export async function getSupabaseCoverageSeason(){
  const values = await fetchAllColumnValues('season');
  const counts = new Map();
  for(const v of values){
    const s = Number(v);
    if(!Number.isFinite(s)) continue;
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  let best = null, bestCount = -1;
  for(const [season, count] of counts){
    if(count > bestCount){ best = season; bestCount = count; }
  }
  return best;
}
