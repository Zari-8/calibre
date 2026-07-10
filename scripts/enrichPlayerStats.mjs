// ─────────────────────────────────────────────────────────────────────────
// Calibre · player-stat enrichment v2  (API-Football Pro → Supabase)
//
// What changed vs v1 and WHY:
//
// 1. LEAGUE-TRUE STATS (fixes the inflation: Kane 64 goals, Neves 6,590 mins).
//    v1 summed EVERY statistics entry for a season — domestic league + UCL +
//    cups — into one row, so a "league" stat was really an all-competitions
//    total. v2 isolates the player's PRIMARY DOMESTIC-LEAGUE line (the entry
//    matching the stored league_id, else the league entry with the most
//    minutes) and aggregates only the entries sharing that league id (so a
//    mid-season transfer within the same league still adds up). Cups and
//    continental competitions no longer leak into the league line.
//
// 2. SEASON LADDER (fewer false "no minutes"). v1 tried SEASON then one
//    fallback. v2 walks SEASON → FALLBACK_SEASON → FALLBACK_SEASON-1 and uses
//    the first season that actually has minutes.
//
// 3. OPTIONAL ID RE-RESOLUTION (RESOLVE_IDS=1). The big "no minutes" list is
//    mostly rows whose stored api_player_id was mis-mapped at import time (a
//    different person with the same name). When the stored id yields nothing
//    across the ladder, v2 can search API-Football by name, pick the best
//    match (name + nationality, must actually have minutes), write the
//    corrected api_player_id back, and enrich from it.
//
// 4. WRITES THE CORRECTED OUTPUT STATS. Because v1 left goals/assists/minutes
//    alone, the inflated values from the original bulk import survived. v2
//    overwrites minutes, appearances, starts, goals, assists from the league
//    line so the rating engine and leaderboards read league-true numbers.
//    Run with DRY_RUN=1 first to preview every change without writing.
//
//   npm i @supabase/supabase-js          (Node 18+ has global fetch)
//   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  API_FOOTBALL_KEY=...  \
//   SEASON=2025 FALLBACK_SEASON=2024 RESOLVE_IDS=1 DRY_RUN=1 \
//   node scripts/enrichPlayerStats.mjs
//
// Use the SERVICE ROLE key (server-side secret), NOT the anon key.
// ─────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

// ── config ────────────────────────────────────────────────────────────────
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY       = process.env.API_FOOTBALL_KEY;

const SEASON          = String(process.env.SEASON || '2025');
const FALLBACK_SEASON = String(process.env.FALLBACK_SEASON || (Number(SEASON) - 1));
const FALLBACK_SEASON2= String(process.env.FALLBACK_SEASON2 || (Number(FALLBACK_SEASON) - 1));
const SEASON_LADDER   = [...new Set([SEASON, FALLBACK_SEASON, FALLBACK_SEASON2])];

// API-Football under-reports pass completion for some players vs Opta/FBref.
// Curated corrections (keyed by api_player_id), sourced from FBref/FotMob/UEFA,
// applied after aggregation. Add players here as the gap is found.
const PASS_ACCURACY_OVERRIDE = {
  335051: 89.3,   // João Neves — API-Football ~82%; FBref/FotMob ~89%, UEFA CL ~93%
};

const TARGET_UUIDS_RAW = (process.env.TARGET_UUIDS || '').split(',').map(s => s.trim()).filter(Boolean);
const MAX_PLAYERS     = Number(process.env.MAX_PLAYERS || (TARGET_UUIDS_RAW.length ? TARGET_UUIDS_RAW.length : 250));
const REFRESH_DAYS    = Number(process.env.REFRESH_DAYS || 7);
const DELAY_MS        = Number(process.env.DELAY_MS || 250);
const FORCE           = process.env.FORCE === '1';
const NATIONALITY     = process.env.NATIONALITY || null;
const LEAGUE_ID       = process.env.LEAGUE_ID ? Number(process.env.LEAGUE_ID) : null; // enrich one league at a time, e.g. 39 = Premier League
const PLAYER_NAMES    = process.env.PLAYER_NAMES || null; // comma-separated names to target, e.g. "Vitinha,Pedri,Raphinha"
// Deterministic targeting by API id — bypasses name-guessing and the
// "never-enriched first" ordering entirely. Use this for the marquee names
// whose registry rows are stored under inconsistent legal names.
const PLAYER_IDS      = (process.env.PLAYER_IDS || '')
  .split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n > 0);
// Target by internal players.id (UUID) instead of api_player_id. Use this for
// rows whose api_player_id is NULL — they're invisible to the normal read
// filter below and to PLAYER_IDS, but RESOLVE_IDS can still find them a real
// api_player_id by name+nationality once they're in the working set.
const TARGET_UUIDS    = TARGET_UUIDS_RAW;
const RESOLVE_IDS     = process.env.RESOLVE_IDS === '1';   // re-resolve mis-mapped ids by name
const DRY_RUN         = process.env.DRY_RUN === '1';       // preview only, no writes
const API_HOST        = 'https://v3.football.api-sports.io';

if (!SUPABASE_URL || !SUPABASE_KEY || !API_KEY) {
  console.error('Missing env: need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_FOOTBALL_KEY');
  process.exit(1);
}
if (SEASON_LADDER.some(s => !Number.isFinite(Number(s)))) {
  console.error('SEASON / FALLBACK_SEASON must be numeric API-Football starting years, e.g. 2025 and 2024.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

// strip accents/punctuation for name matching
function normName(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── API-Football ──────────────────────────────────────────────────────────
async function apiGet(path, attempt = 1) {
  const MAX = 4;
  try {
    const res = await fetch(`${API_HOST}/${path}`, { headers: { 'x-apisports-key': API_KEY } });
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) throw new Error(`API HTTP ${res.status}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`API HTTP ${res.status}: ${JSON.stringify(json)}`);
    if (json?.errors && Object.keys(json.errors).length) throw new Error('API: ' + JSON.stringify(json.errors));
    return json;
  } catch (e) {
    const msg = String(e?.message || e);
    const transient = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket|HTTP 5|HTTP 429/i.test(msg);
    if (transient && attempt < MAX) {
      const wait = 800 * attempt;            // 0.8s → 1.6s → 2.4s
      console.warn(`  ↻ ${path}: ${msg} — retry ${attempt}/${MAX - 1} in ${wait}ms`);
      await sleep(wait);
      return apiGet(path, attempt + 1);
    }
    throw e;
  }
}

async function fetchPlayerStats(apiId, season) {
  const json = await apiGet(`players?id=${apiId}&season=${season}`);
  return json?.response?.[0]?.statistics || [];
}

// Search the profile directory and return candidate {id, name, nationality}.
async function searchProfiles(name) {
  const surname = normName(name).split(' ').pop();
  if (surname.length < 3) return [];
  const json = await apiGet(`players/profiles?search=${encodeURIComponent(surname)}`);
  return (json?.response ?? []).map((row) => {
    const p = row?.player ?? row ?? {};
    return { id: p.id, name: p.name || [p.firstname, p.lastname].filter(Boolean).join(' '), nationality: p.nationality || p.birth?.country || '', age: p.age ?? null };
  }).filter((p) => p.id && p.name);
}

// ── league-true extraction ──────────────────────────────────────────────
// Competitions that are NOT competitive football — excluded from totals so a
// pre-season runout doesn't pollute a player's season line.
const FRIENDLY_LEAGUE_IDS = new Set([10, 667, 666]);
function isCompetitive(s) {
  const id = num(s?.league?.id);
  const name = String(s?.league?.name || '').toLowerCase();
  if (FRIENDLY_LEAGUE_IDS.has(id)) return false;
  return !(name.includes('friendl') || name.includes('exhibition') || name.includes('testimonial'));
}

// ── competition classification + strength (for the 70/30 base+overlay blend) ─
// CLUB continental competitions → overlay. Strength = how strong the arena is.
const CONTINENTAL_STRENGTH = {
  2:1.00,    // UEFA Champions League
  531:0.95,  // UEFA Super Cup
  15:0.90,   // FIFA Club World Cup
  3:0.85,    // UEFA Europa League
  13:0.85,   // CONMEBOL Libertadores
  541:0.78,  // CONMEBOL Recopa
  11:0.72,   // CONMEBOL Sudamericana
  848:0.70,  // UEFA Europa Conference League
  12:0.68,   // CAF Champions League
  16:0.68,   // CONCACAF Champions
  17:0.68,   // AFC Champions League
};
// COMPETITIVE national-team competitions → overlay. Friendlies (club OR country)
// are caught by isCompetitive and fall to the friendly bucket instead.
const NATIONAL_STRENGTH = {
  1:1.00,    // World Cup (finals)
  4:0.95,    // UEFA Euro (finals)
  9:0.90,    // Copa América
  6:0.80,    // Africa Cup of Nations
  5:0.78,    // UEFA Nations League
  7:0.68,    // AFC Asian Cup
  22:0.68,   // CONCACAF Gold Cup
  34:0.74,29:0.70,32:0.70,30:0.68,31:0.68,33:0.62,  // World Cup qualifiers (S.America/Africa/Europe/Asia/Concacaf/Oceania)
  960:0.70,  // Euro qualifiers
};
const NATIONAL_DEFAULT = 0.70;   // an unenumerated 'World' competitive comp (e.g. a qualifier we didn't list)

// 'friendly' | 'continental' | 'national' | 'base'  (base = domestic league or domestic cup)
export function classifyComp(s) {
  const id = num(s?.league?.id);
  if (!isCompetitive(s)) return 'friendly';
  if (CONTINENTAL_STRENGTH[id] != null) return 'continental';
  if (NATIONAL_STRENGTH[id] != null) return 'national';
  const country = String(s?.league?.country || '').toLowerCase();
  const type = String(s?.league?.type || '').toLowerCase();
  if (country === 'world' && type === 'cup') return 'national';   // unlisted NT/qualifier
  return 'base';
}
function compStrength(s) {
  const id = num(s?.league?.id);
  if (CONTINENTAL_STRENGTH[id] != null) return CONTINENTAL_STRENGTH[id];
  if (NATIONAL_STRENGTH[id] != null) return NATIONAL_STRENGTH[id];
  return NATIONAL_DEFAULT;
}

// Sum a set of statistics entries into one stat line (identical maths to leagueLine).
function accumulate(entries) {
  let minutes=0,apps=0,starts=0,passes=0,key=0,dribS=0,dribA=0;
  let tackles=0,inter=0,duelsWon=0,shots=0,goals=0,assists=0;
  let saves=0,conceded=0,penaltySaved=0,hasGkFields=false;
  let duelsTotal=0,shotsOn=0,tackleBlocks=0,dribbledPast=0;
  let yellowCards=0,redCards=0,foulsCommitted=0,foulsDrawn=0;
  let penaltyWon=0,penaltyScored=0,penaltyMissed=0,penaltyConceded=0,hasExtraFields=false;
  let accSum=0,accW=0,ratingSum=0,ratingW=0,pos=null,posMin=-1;
  for (const s of entries) {
    const m=num(s?.games?.minutes);
    minutes+=m; apps+=num(s?.games?.appearences); starts+=num(s?.games?.lineups);
    passes+=num(s?.passes?.total); key+=num(s?.passes?.key);
    dribS+=num(s?.dribbles?.success); dribA+=num(s?.dribbles?.attempts);
    tackles+=num(s?.tackles?.total); inter+=num(s?.tackles?.interceptions);
    duelsWon+=num(s?.duels?.won); shots+=num(s?.shots?.total);
    goals+=num(s?.goals?.total); assists+=num(s?.goals?.assists);
    // Shot-stopping — already in the API-Football payload, just unread until now.
    if (s?.goals?.saves != null) { saves += num(s.goals.saves); hasGkFields = true; }
    if (s?.goals?.conceded != null) { conceded += num(s.goals.conceded); hasGkFields = true; }
    if (s?.penalty?.saved != null) { penaltySaved += num(s.penalty.saved); hasGkFields = true; }
    // Sibling fields of ones we already read above — same response, zero extra API cost.
    if (s?.duels?.total != null) { duelsTotal += num(s.duels.total); hasExtraFields = true; }
    if (s?.shots?.on != null) { shotsOn += num(s.shots.on); hasExtraFields = true; }
    if (s?.tackles?.blocks != null) { tackleBlocks += num(s.tackles.blocks); hasExtraFields = true; }
    if (s?.dribbles?.past != null) { dribbledPast += num(s.dribbles.past); hasExtraFields = true; }
    if (s?.cards?.yellow != null) { yellowCards += num(s.cards.yellow); hasExtraFields = true; }
    if (s?.cards?.red != null) { redCards += num(s.cards.red); hasExtraFields = true; }
    if (s?.fouls?.committed != null) { foulsCommitted += num(s.fouls.committed); hasExtraFields = true; }
    if (s?.fouls?.drawn != null) { foulsDrawn += num(s.fouls.drawn); hasExtraFields = true; }
    if (s?.penalty?.won != null) { penaltyWon += num(s.penalty.won); hasExtraFields = true; }
    if (s?.penalty?.scored != null) { penaltyScored += num(s.penalty.scored); hasExtraFields = true; }
    if (s?.penalty?.missed != null) { penaltyMissed += num(s.penalty.missed); hasExtraFields = true; }
    if (s?.penalty?.commited != null) { penaltyConceded += num(s.penalty.commited); hasExtraFields = true; }
    const accRaw=s?.passes?.accuracy;
    if (accRaw!=null && m>0){ const total=num(s?.passes?.total);
      const pct=Number(accRaw)<=100?Number(accRaw):(total>0?(Number(accRaw)/total)*100:null);
      if (pct!=null){ accSum+=pct*m; accW+=m; } }
    const r=parseFloat(s?.games?.rating);
    if (Number.isFinite(r)&&m>0){ ratingSum+=r*m; ratingW+=m; }
    if (m>posMin){ posMin=m; pos=s?.games?.position||pos; }
  }
  return { minutes, stats_minutes:minutes, appearances:apps, starts, goals, assists,
    passes, key_passes:key, dribbles_success:dribS, dribbles_attempts:dribA,
    tackles, interceptions:inter, duels_won:duelsWon, shots,
    saves: hasGkFields?saves:null, goals_conceded: hasGkFields?conceded:null,
    penalty_saved: hasGkFields?penaltySaved:null,
    duels_total: hasExtraFields?duelsTotal:null, shots_on: hasExtraFields?shotsOn:null,
    tackle_blocks: hasExtraFields?tackleBlocks:null, dribbled_past: hasExtraFields?dribbledPast:null,
    yellow_cards: hasExtraFields?yellowCards:null, red_cards: hasExtraFields?redCards:null,
    fouls_committed: hasExtraFields?foulsCommitted:null, fouls_drawn: hasExtraFields?foulsDrawn:null,
    penalty_won: hasExtraFields?penaltyWon:null, penalty_scored: hasExtraFields?penaltyScored:null,
    penalty_missed: hasExtraFields?penaltyMissed:null, penalty_conceded: hasExtraFields?penaltyConceded:null,
    pass_accuracy: accW>0?Math.round((accSum/accW)*10)/10:null,
    api_average_rating: ratingW>0?Math.round((ratingSum/ratingW)*100)/100:null,
    position: pos };
}

// Build the base / friendly / overlay splits the rating engine blends.
// base = domestic league + domestic cups (strength from the primary league)
// friendly = club + international friendlies (engine credits availability only)
// overlay = continental + competitive national-team, with a minutes-weighted strength
export function competitionSplits(stats, preferredLeagueId) {
  if (!stats || !stats.length) return null;
  const withMins = stats.filter((s)=>num(s?.games?.minutes)>0);
  const pool = withMins.length ? withMins : stats;

  let primary=null;
  if (preferredLeagueId) primary = pool.find((s)=>num(s?.league?.id)===num(preferredLeagueId)) || null;
  if (!primary){
    const lg=pool.filter((s)=>String(s?.league?.type||'').toLowerCase()==='league');
    const from=lg.length?lg:pool;
    primary=from.reduce((b,s)=>(num(s?.games?.minutes)>num(b?.games?.minutes)?s:b),from[0]);
  }
  const baseLid=num(primary?.league?.id)||null;

  const groups={ base:[], friendly:[], continental:[], national:[] };
  for (const s of pool) groups[classifyComp(s)].push(s);

  const base = accumulate(groups.base);
  base.league_id = baseLid;
  base.league_name = primary?.league?.name || null;

  const friendly = accumulate(groups.friendly);

  const overlayEntries = [...groups.continental, ...groups.national];
  const overlay = accumulate(overlayEntries);
  let sW=0, sWt=0;
  for (const s of overlayEntries){ const m=num(s?.games?.minutes); if (m>0){ sW+=compStrength(s)*m; sWt+=m; } }
  overlay.strength = sWt>0 ? Math.round((sW/sWt)*1000)/1000 : 0.95;

  return { base, friendly, overlay };
}

// Aggregate a player's FULL competitive season — domestic league + domestic cups
// + continental (UCL/UEL) — instead of league-only. The API call is already
// season-scoped, so summing the entries gives the true season total without the
// multi-season inflation the v1 code had. The primary domestic league still sets
// league strength downstream.
function leagueLine(stats, preferredLeagueId) {
  if (!stats.length) return null;

  const withMins = stats.filter((s) => num(s?.games?.minutes) > 0);
  const pool = withMins.length ? withMins : stats;

  // primary = the domestic-league entry that sets league strength (stored
  // league_id if it has minutes, else the most-played LEAGUE-type entry).
  let primary = null;
  if (preferredLeagueId) {
    primary = pool.find((s) => num(s?.league?.id) === num(preferredLeagueId)) || null;
  }
  if (!primary) {
    const leagueType = pool.filter((s) => String(s?.league?.type || '').toLowerCase() === 'league');
    const fromPool = leagueType.length ? leagueType : pool;
    primary = fromPool.reduce((best, s) => (num(s?.games?.minutes) > num(best?.games?.minutes) ? s : best), fromPool[0]);
  }

  const lid = num(primary?.league?.id);

  // Sum ALL OFFICIAL competitions this season — domestic league + domestic cups
  // + continental + competitive national-team matches — and exclude only
  // friendlies/exhibitions (isCompetitive). We do NOT restrict to the club:
  // per-90 normalisation (downstream) handles the extra minutes honestly, so a
  // World Cup or Nations League run counts as the real official football it is.
  const lines = pool.filter(isCompetitive);

  let minutes = 0, apps = 0, starts = 0, passes = 0, key = 0, dribS = 0, dribA = 0;
  let tackles = 0, inter = 0, duelsWon = 0, shots = 0, goals = 0, assists = 0;
  let saves = 0, conceded = 0, penaltySaved = 0, hasGkFields = false;
  let duelsTotal = 0, shotsOn = 0, tackleBlocks = 0, dribbledPast = 0;
  let yellowCards = 0, redCards = 0, foulsCommitted = 0, foulsDrawn = 0;
  let penaltyWon = 0, penaltyScored = 0, penaltyMissed = 0, penaltyConceded = 0, hasExtraFields = false;
  let accSum = 0, accW = 0, ratingSum = 0, ratingW = 0, pos = null, posMin = -1;

  for (const s of lines) {
    const m = num(s?.games?.minutes);
    minutes += m;
    apps    += num(s?.games?.appearences); // API spelling
    starts  += num(s?.games?.lineups);
    passes  += num(s?.passes?.total);
    key     += num(s?.passes?.key);
    dribS   += num(s?.dribbles?.success);
    dribA   += num(s?.dribbles?.attempts);
    tackles += num(s?.tackles?.total);
    inter   += num(s?.tackles?.interceptions);
    duelsWon+= num(s?.duels?.won);
    shots   += num(s?.shots?.total);
    goals   += num(s?.goals?.total);
    assists += num(s?.goals?.assists);
    // Shot-stopping — already in the API-Football payload, just unread until now.
    if (s?.goals?.saves != null) { saves += num(s.goals.saves); hasGkFields = true; }
    if (s?.goals?.conceded != null) { conceded += num(s.goals.conceded); hasGkFields = true; }
    if (s?.penalty?.saved != null) { penaltySaved += num(s.penalty.saved); hasGkFields = true; }
    // Sibling fields of ones we already read above — same response, zero extra API cost.
    if (s?.duels?.total != null) { duelsTotal += num(s.duels.total); hasExtraFields = true; }
    if (s?.shots?.on != null) { shotsOn += num(s.shots.on); hasExtraFields = true; }
    if (s?.tackles?.blocks != null) { tackleBlocks += num(s.tackles.blocks); hasExtraFields = true; }
    if (s?.dribbles?.past != null) { dribbledPast += num(s.dribbles.past); hasExtraFields = true; }
    if (s?.cards?.yellow != null) { yellowCards += num(s.cards.yellow); hasExtraFields = true; }
    if (s?.cards?.red != null) { redCards += num(s.cards.red); hasExtraFields = true; }
    if (s?.fouls?.committed != null) { foulsCommitted += num(s.fouls.committed); hasExtraFields = true; }
    if (s?.fouls?.drawn != null) { foulsDrawn += num(s.fouls.drawn); hasExtraFields = true; }
    if (s?.penalty?.won != null) { penaltyWon += num(s.penalty.won); hasExtraFields = true; }
    if (s?.penalty?.scored != null) { penaltyScored += num(s.penalty.scored); hasExtraFields = true; }
    if (s?.penalty?.missed != null) { penaltyMissed += num(s.penalty.missed); hasExtraFields = true; }
    if (s?.penalty?.commited != null) { penaltyConceded += num(s.penalty.commited); hasExtraFields = true; }

    const accRaw = s?.passes?.accuracy;
    if (accRaw != null && m > 0) {
      const total = num(s?.passes?.total);
      const pct = Number(accRaw) <= 100 ? Number(accRaw) : (total > 0 ? (Number(accRaw) / total) * 100 : null);
      if (pct != null) { accSum += pct * m; accW += m; }
    }
    const r = parseFloat(s?.games?.rating);
    if (Number.isFinite(r) && m > 0) { ratingSum += r * m; ratingW += m; }
    if (m > posMin) { posMin = m; pos = s?.games?.position || pos; }
  }

  return {
    league_id: lid || null,
    league_name: primary?.league?.name || null,
    team_name: primary?.team?.name || null,
    stats_minutes: minutes,
    minutes,
    appearances: apps,
    starts,
    goals,
    assists,
    passes,
    key_passes: key,
    dribbles_success: dribS,
    dribbles_attempts: dribA,
    tackles,
    interceptions: inter,
    duels_won: duelsWon,
    shots,
    saves: hasGkFields ? saves : null,
    goals_conceded: hasGkFields ? conceded : null,
    penalty_saved: hasGkFields ? penaltySaved : null,
    duels_total: hasExtraFields ? duelsTotal : null,
    shots_on: hasExtraFields ? shotsOn : null,
    tackle_blocks: hasExtraFields ? tackleBlocks : null,
    dribbled_past: hasExtraFields ? dribbledPast : null,
    yellow_cards: hasExtraFields ? yellowCards : null,
    red_cards: hasExtraFields ? redCards : null,
    fouls_committed: hasExtraFields ? foulsCommitted : null,
    fouls_drawn: hasExtraFields ? foulsDrawn : null,
    penalty_won: hasExtraFields ? penaltyWon : null,
    penalty_scored: hasExtraFields ? penaltyScored : null,
    penalty_missed: hasExtraFields ? penaltyMissed : null,
    penalty_conceded: hasExtraFields ? penaltyConceded : null,
    pass_accuracy: accW > 0 ? Math.round((accSum / accW) * 10) / 10 : null,
    api_average_rating: ratingW > 0 ? Math.round((ratingSum / ratingW) * 100) / 100 : null,
    position: pos,
  };
}

// Walk the season ladder for one id; return the first season with minutes.
async function enrichById(apiId, preferredLeagueId) {
  let calls = 0;
  for (const season of SEASON_LADDER) {
    calls++;
    const stats = await fetchPlayerStats(apiId, season);
    const line = leagueLine(stats, preferredLeagueId);
    if (line && line.stats_minutes > 0) return { season, line, stats, calls };
    await sleep(DELAY_MS);
  }
  return { season: null, line: null, stats: null, calls };
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  function buildRead() {
    let q = supabase
      .from('players')
      .select('id, name, api_player_id, league_id, nationality, age, stats_updated_at');
    if (TARGET_UUIDS.length) {
      // Explicit UUID targeting bypasses the api_player_id-not-null gate —
      // rows with a null api_player_id are only reachable this way.
      q = q.in('id', TARGET_UUIDS);
    } else {
      q = q.not('api_player_id', 'is', null).gt('api_player_id', 0); // skip placeholder/0 ids (API rejects id=0)
      if (LEAGUE_ID) q = q.eq('league_id', LEAGUE_ID);
      if (NATIONALITY) q = q.ilike('nationality', `%${NATIONALITY}%`);
      if (PLAYER_IDS.length) q = q.in('api_player_id', PLAYER_IDS);
      else if (PLAYER_NAMES) q = q.or(PLAYER_NAMES.split(',').map(n => `name.ilike.%${n.trim()}%`).join(','));
    }
    return q.order('stats_updated_at', { ascending: true, nullsFirst: true }).limit(MAX_PLAYERS);
  }

  if (TARGET_UUIDS.length) console.log(`Targeting ${TARGET_UUIDS.length} player(s) by internal id (bypasses api_player_id filter)`);
  else if (PLAYER_IDS.length) console.log(`Targeting ${PLAYER_IDS.length} player(s) by api_player_id: ${PLAYER_IDS.join(', ')}`);

  // Retry the read on transient connection drops (fetch failed) before giving up.
  let rows = null, readErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const { data, error } = await buildRead();
    if (!error) { rows = data; break; }
    readErr = error;
    const transient = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket/i.test(String(error.message));
    if (!transient || attempt === 4) break;
    console.warn(`  ↻ Supabase read: ${error.message} — retry ${attempt}/3`);
    await sleep(800 * attempt);
  }
  if (!rows) { console.error('Supabase read failed:', readErr?.message || 'unknown'); process.exit(1); }

  const cutoff = Date.now() - REFRESH_DAYS * 86400000;
  let enriched = 0, remapped = 0, skipped = 0, empty = 0, failed = 0, calls = 0;

  if (DRY_RUN) console.log('DRY RUN — no rows will be written.\n');

  for (const row of rows) {
    if (!FORCE && row.stats_updated_at && new Date(row.stats_updated_at).getTime() > cutoff) {
      skipped++;
      continue;
    }

    try {
      // A null/0 api_player_id (e.g. rows only ever touched by TheStatsAPI)
      // can't be looked up directly — skip straight to name resolution below
      // instead of letting an API error here abort the whole row before
      // RESOLVE_IDS gets a chance. A non-null id that throws (bad/stale id)
      // is treated the same way rather than failing the row outright.
      let season = null, line = null, stats = null;
      if (row.api_player_id) {
        try {
          const res0 = await enrichById(row.api_player_id, row.league_id);
          season = res0.season; line = res0.line; stats = res0.stats; calls += res0.calls;
        } catch (e0) {
          console.log(`· ${row.name}: initial id ${row.api_player_id} lookup failed (${e0.message})`);
        }
      }
      let usedId = row.api_player_id;
      let didRemap = false;

      // Stored id found nothing across the ladder → try to re-resolve by name.
      // Registry names are abbreviated (e.g. "C. Hughes"), so surname + first
      // initial is all we can match on — far too loose for common surnames on
      // its own. We therefore REQUIRE a nationality match and a close age, or we
      // refuse to remap. Without a stored nationality we don't remap at all.
      if ((!line || line.stats_minutes === 0) && RESOLVE_IDS) {
        if (!normName(row.nationality)) {
          console.log(`· ${row.name}: no minutes; remap skipped (no nationality on record to verify a match)`);
        } else {
          const candidates = await searchProfiles(row.name); calls++;
          const wantNat  = normName(row.nationality);
          const wantTok  = normName(row.name).split(' ');
          const wantSur  = wantTok[wantTok.length - 1];
          const wantInit = (wantTok[0] || '')[0] || '';
          const wantAge  = num(row.age);

          const ranked = candidates
            .filter((cand) => cand.id !== row.api_player_id)
            .map((cand) => {
              const cn = normName(cand.name);
              const ct = cn.split(' ');
              const surOk  = ct[ct.length - 1] === wantSur;
              const initOk = !wantInit || (ct[0] || '')[0] === wantInit;
              const natOk  = normName(cand.nationality) === wantNat;
              const ageDiff = (wantAge && cand.age) ? Math.abs(num(cand.age) - wantAge) : null;
              const ageOk  = ageDiff == null ? true : ageDiff <= 2;
              return { ...cand, surOk, initOk, natOk, ageOk, ageDiff: ageDiff == null ? 99 : ageDiff };
            })
            .filter((cand) => cand.surOk && cand.initOk && cand.natOk && cand.ageOk)
            .sort((a, b) => a.ageDiff - b.ageDiff);

          for (const cand of ranked.slice(0, 2)) {
            const res = await enrichById(cand.id, row.league_id); calls += res.calls;
            if (res.line && res.line.stats_minutes > 0) {
              season = res.season; line = res.line; stats = res.stats; usedId = cand.id; didRemap = true;
              break;
            }
            await sleep(DELAY_MS);
          }
        }
      }

      if (!season || !line || line.stats_minutes === 0) {
        if (!DRY_RUN) {
          const { error: e } = await supabase.from('players')
            .update({ stats_season: null, stats_updated_at: new Date().toISOString() })
            .eq('id', row.id);
          if (e) throw new Error(e.message);
        }
        empty++;
        console.log(`· ${row.name}: no league minutes in ${SEASON_LADDER.join('/')}${RESOLVE_IDS ? ' (id re-resolve found nothing)' : ''}`);
        await sleep(DELAY_MS);
        continue;
      }

      const accFixed = PASS_ACCURACY_OVERRIDE[Number(row.api_player_id)] ?? line.pass_accuracy;

      // Competition splits for the 70/30 base+overlay blend (additive — the flat
      // fields above still drive the competitive-only card display).
      const splits = competitionSplits(stats, row.league_id);
      const ovrAcc = PASS_ACCURACY_OVERRIDE[Number(usedId)] ?? PASS_ACCURACY_OVERRIDE[Number(row.api_player_id)];
      if (splits && splits.base && ovrAcc != null) splits.base.pass_accuracy = ovrAcc;

      const update = {
        passes: line.passes,
        pass_accuracy: accFixed,
        key_passes: line.key_passes,
        dribbles_success: line.dribbles_success,
        dribbles_attempts: line.dribbles_attempts,
        tackles: line.tackles,
        interceptions: line.interceptions,
        duels_won: line.duels_won,
        shots: line.shots,
        minutes: line.minutes,
        appearances: line.appearances,
        starts: line.starts,
        goals: line.goals,
        assists: line.assists,
        stats_minutes: line.stats_minutes,
        stats_season: season,
        stats_updated_at: new Date().toISOString(),
      };
      if (line.api_average_rating != null) update.api_average_rating = line.api_average_rating;
      if (line.saves != null) update.saves = line.saves;
      if (line.goals_conceded != null) update.goals_conceded = line.goals_conceded;
      if (line.penalty_saved != null) update.penalty_saved = line.penalty_saved;
      // Sibling fields of ones we already wrote above — same API-Football
      // response, zero extra API cost. Real duel win%, real shot accuracy,
      // blocks, times-dribbled-past, discipline, and penalty involvement —
      // all previously fetched and discarded.
      if (line.duels_total != null) update.duels_total = line.duels_total;
      if (line.shots_on != null) update.shots_on = line.shots_on;
      if (line.tackle_blocks != null) update.tackle_blocks = line.tackle_blocks;
      if (line.dribbled_past != null) update.dribbled_past = line.dribbled_past;
      if (line.yellow_cards != null) update.yellow_cards = line.yellow_cards;
      if (line.red_cards != null) update.red_cards = line.red_cards;
      if (line.fouls_committed != null) update.fouls_committed = line.fouls_committed;
      if (line.fouls_drawn != null) update.fouls_drawn = line.fouls_drawn;
      if (line.penalty_won != null) update.penalty_won = line.penalty_won;
      if (line.penalty_scored != null) update.penalty_scored = line.penalty_scored;
      if (line.penalty_missed != null) update.penalty_missed = line.penalty_missed;
      if (line.penalty_conceded != null) update.penalty_conceded = line.penalty_conceded;
      // API-Football's own per-competition position tag — already computed
      // by leagueLine() above (from games.position) but never written until
      // now. Kept in its own column, independent of whatever originally
      // populated position/pos/primary_role/raw_position, pending review.
      if (line.position) update.api_position = line.position;
      if (splits) update.competition_splits = splits;
      if (didRemap) update.api_player_id = usedId;

      if (!DRY_RUN) {
        const { error: e } = await supabase.from('players').update(update).eq('id', row.id);
        if (e) throw new Error(e.message);
      }

      enriched++;
      if (didRemap) remapped++;
      const tag = didRemap ? ` ⟳ remapped→${usedId}` : '';
      const accTag = (PASS_ACCURACY_OVERRIDE[Number(row.api_player_id)] != null) ? ' ✎acc' : '';
      const sb = (splits && splits.base) || {}, sf = (splits && splits.friendly) || {}, so = (splits && splits.overlay) || {};
      const splitTag = splits ? ` | base ${sb.minutes||0}'/${sb.goals||0}g/${sb.pass_accuracy ?? '–'}% · fr ${sf.minutes||0}' · ov ${so.minutes||0}'/${so.goals||0}g@${so.strength ?? '–'}` : '';
      const gkTag = line.saves != null ? ` | GK: ${line.saves}sv/${line.goals_conceded ?? 0}ga` : '';
      console.log(`✓ ${row.name}${tag} · ${season} · ${line.league_name || 'league'} · ${line.stats_minutes}' · ${line.appearances}app · ${line.goals}g ${line.assists}a · ${accFixed}%${accTag}${splitTag}${gkTag}`);
    } catch (e) {
      failed++;
      console.warn(`✗ ${row.name} (${row.api_player_id}): ${e.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone${DRY_RUN ? ' (DRY RUN)' : ''}. enriched=${enriched} remapped=${remapped} skipped=${skipped} no-minutes=${empty} failed=${failed} · api calls=${calls}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
