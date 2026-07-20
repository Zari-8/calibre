import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, ArrowRight, Crown, Star, TrendingUp, X, LoaderCircle, Plus, Database, GitCompareArrows, SlidersHorizontal, Info, Activity, Users, ShieldAlert } from 'lucide-react';
import { navigateTo } from '../components/NavLink.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import ApiTeamLogo from '../components/ApiTeamLogo.jsx';
import ApiLeagueLogo from '../components/ApiLeagueLogo.jsx';
import ShareBar, { shareUrl } from '../components/Share.jsx';
import { CURRENT_SEASON, getLeaguePlayers, getPlayerProfile, getPlayerStats, getPlayerStatsWithFallback, getPlayerCareerSeasons, getRecentPlayerForm, getNationalTeamId, searchPlayerProfiles, teamLogoUrl } from '../services/apiFootball.js';
import { getSupabasePlayerCount, getSupabaseNationCount, getSupabaseLeagueCount, getSupabaseCoverageSeason, getSupabaseTopPlayers, getSupabasePlayers, getSupabasePlayersByApiIds, getSupabasePositionPool, searchSupabasePlayers, searchSupabaseClubs, getSupabasePlayersByClub } from '../services/supabasePlayers.js';
import { calibreRating, resolveRating, positionBucket as ratingPositionBucket } from '../services/calibreRating.js';
import { calibreValue } from '../services/calibreValue.js';
import useAuth from '../hooks/useAuth.js';
import { resolveTier, can } from '../services/access.js';
import { getWatchlist, isWatched, toggleWatch, removeWatch, WATCHLIST_EVENT, bindWatchlistUser, mergeLocalIntoAccount, loadWatchlist } from '../services/watchlist.js';

// archetype below is only ever a fallback — mergeCuratedWithSupabase prefers
// the live, trait-engine-derived value from Supabase (see deriveArchetype in
// services/playerTraits.js) whenever a DB row is found, which for these ten
// well-known players is essentially always. It only surfaces on the very
// first render before the Supabase fetch resolves, or if a row's archetype
// genuinely hasn't been computed yet. Values here are pulled from that same
// canonical vocabulary (ARCHETYPE_LABELS) instead of a since-abandoned label
// set ("Pure Striker", "Box Crasher", "Wide Creator", "Controller",
// "Pressing Engine") that doesn't exist anywhere else in the app.
const CURATED_PLAYERS = [
  { rank:1, name:'Kylian Mbappé', apiPlayerId:278, age:27, club:'Real Madrid', pos:'ST', rating:91, buzz:96, fanRating:4.8, potential:94, img:'/assets/players/kylian-mbappe.jpg', archetype:'Second Striker' },
  { rank:2, name:'Erling Haaland', apiPlayerId:1100, age:25, club:'Manchester City', pos:'ST', rating:90, buzz:95, fanRating:4.7, potential:93, img:'/assets/players/neutral-player.svg', archetype:'Poacher' },
  { rank:3, name:'Jude Bellingham', apiPlayerId:129718, age:22, club:'Real Madrid', pos:'CM', rating:86, buzz:92, fanRating:4.7, potential:93, img:'/assets/players/jude-bellingham.jpg', archetype:'Advanced Playmaker' },
  { rank:4, name:'Vinícius Júnior', apiPlayerId:762, age:25, club:'Real Madrid', pos:'LW', rating:85, buzz:90, fanRating:4.6, potential:91, img:'/assets/players/vinicius-junior.jpg', archetype:'Inside Forward' },
  { rank:5, name:'Phil Foden', apiPlayerId:631, age:26, club:'Manchester City', pos:'CAM', rating:85, buzz:88, fanRating:4.5, potential:90, img:'/assets/players/neutral-player.svg', archetype:'Advanced Playmaker' },
  { rank:6, name:'Bukayo Saka', apiPlayerId:1460, age:24, club:'Arsenal', pos:'RW', rating:84, buzz:87, fanRating:4.6, potential:90, img:'/assets/players/neutral-player.svg', archetype:'Winger' },
  { rank:7, name:'Rodri', apiPlayerId:44, age:29, club:'Manchester City', pos:'CDM', rating:84, buzz:85, fanRating:4.6, potential:88, img:'/assets/players/neutral-player.svg', archetype:'Central Midfielder' },
  { rank:8, name:'Federico Valverde', apiPlayerId:756, age:27, club:'Real Madrid', pos:'CM', rating:83, buzz:83, fanRating:4.4, potential:88, img:'/assets/players/neutral-player.svg', archetype:'Box-to-Box Midfielder' },
  { rank:9, name:'Martin Ødegaard', apiPlayerId:37127, age:27, club:'Arsenal', pos:'CAM', rating:83, buzz:82, fanRating:4.4, potential:88, img:'/assets/players/neutral-player.svg', archetype:'Advanced Playmaker' },
  { rank:10, name:'Mohamed Salah', apiPlayerId:306, age:33, club:'Liverpool', pos:'RW', rating:82, buzz:80, fanRating:4.6, potential:84, img:'/assets/players/neutral-player.svg', archetype:'Inside Forward' },
];

// Rising players carry their REAL season stat line, so the rating is computed
// and the card metrics are actual numbers — no invented "Elite/High" labels.
const RISING_ANCHORS = [
  { name:'Lamine Yamal', sub:'RW · Barcelona', apiPlayerId:386828, img:'/assets/players/lamine-yamal.jpg',
    position:'FWD', league_id:140, age:18, minutes:3828, appearances:50, starts:46, goals:26, assists:17, api_average_rating:7.91,
    stats_minutes:3828, passes:2231, pass_accuracy:80.9, key_passes:119, dribbles_success:232, tackles:57, interceptions:22, duels_won:394, shots:124 },
  { name:'Pau Cubarsí', sub:'CB · Barcelona', apiPlayerId:396623, img:'/assets/players/neutral-player.svg',
    position:'DEF', league_id:140, age:18, minutes:4054, appearances:46, starts:44, goals:1, assists:0, api_average_rating:7.06,
    stats_minutes:4234, passes:4083, pass_accuracy:90.9, key_passes:7, dribbles_success:1, tackles:61, interceptions:44, duels_won:171, shots:9 },
  { name:'João Neves', sub:'CM · PSG', apiPlayerId:335051, img:'/assets/players/neutral-player.svg',
    position:'MID', league_id:61, age:21, minutes:3128, appearances:43, starts:36, goals:9, assists:5, api_average_rating:7.21,
    stats_minutes:3244, passes:2164, pass_accuracy:82.1, key_passes:35, dribbles_success:20, tackles:85, interceptions:34, duels_won:204, shots:44 },
];

const LEAGUE_OPTIONS = [
  ['all','All Leagues'],['39','Premier League'],['140','La Liga'],['78','Bundesliga'],['135','Serie A'],['61','Ligue 1'],['88','Eredivisie'],['144','Belgian Pro League'],['94','Primeira Liga'],['71','Brasileirão Série A'],
];

const POSITION_OPTIONS = ['all','Attacker','Midfielder','Defender','Goalkeeper'];
const AGE_OPTIONS = [['16-40','16–40'],['16-21','16–21'],['22-25','22–25'],['26-30','26–30'],['31-40','31–40']];
const RANK_TABS = ['Calibre Rating','Market Buzz','Fan Rating','Potential'];
const PLAYER_TABLE_LIMIT = 25;

// Live "data points" = indexed players x the stat metrics we store per player.
// Real per-player metric columns from the enriched Supabase bank (base + StatsAPI).
const METRIC_FIELDS = ['goals','assists','shots','shots_on','key_passes','dribbles_success','dribbles_attempts','tackles','interceptions','blocks','clearances','duels_won','duels_total','aerials_won','pass_accuracy','passes','minutes','appearances','starts','rating','xg_per_90','fouls_drawn','fouls_committed','yellow','crosses','saves'];
function formatCompact(n){
  n = Number(n) || 0;
  if(n >= 1e9) return (n/1e9).toFixed(1).replace(/\.0$/,'') + 'B';
  if(n >= 1e6) return (n/1e6).toFixed(1).replace(/\.0$/,'') + 'M';
  if(n >= 1e3) return (n/1e3).toFixed(1).replace(/\.0$/,'') + 'K';
  return String(Math.round(n));
}
function displayRating(rating){
  const numericRating = Number(rating);
  return Number.isFinite(numericRating) ? Math.round(numericRating) : '—';
}

// Compute a Calibre rating from any row (curated, Supabase bank, or live API).
// Returns a number, or null when there isn't enough evidence to rate.
function ratingOf(row){
  const r = resolveRating(row || {});
  return r && r.rating != null ? r.rating : null;
}
// Prefer an already-computed finite rating; otherwise compute from the row.
function rowRating(row){
  const stored = Number(row && row.rating);
  return Number.isFinite(stored) ? stored : ratingOf(row);
}
// Real, position-aware card metrics from actual season totals (no fake labels).
function deriveMetrics(row, bucket){
  const n = v => { const x = Number(v); return Number.isFinite(x) ? x : null; };
  const pct = v => n(v) != null ? `${Math.round(n(v))}%` : null;
  const out = [];
  const push = (label, val) => { if(val != null && val !== '') out.push([label, val]); };
  if(bucket === 'DEF'){
    push('Tackles', n(row.tackles)); push('Interceptions', n(row.interceptions));
    push('Duels won', n(row.duels_won)); push('Pass acc', pct(row.pass_accuracy));
  } else if(bucket === 'ATT'){
    push('Goals', n(row.goals)); push('Assists', n(row.assists));
    push('Key passes', n(row.key_passes)); push('Dribbles', n(row.dribbles_success));
  } else {
    push('Key passes', n(row.key_passes)); push('Assists', n(row.assists));
    push('Pass acc', pct(row.pass_accuracy)); push('Dribbles', n(row.dribbles_success));
  }
  return out.slice(0, 4);
}

function specificPosition(primaryPosition,fallbackPosition='Player'){
  const broadPositions = new Set([
    'attacker',
    'forward',
    'midfielder',
    'defender',
    'goalkeeper',
    'player',
  ]);

  const primary = String(primaryPosition || '').trim();
  const fallback = String(fallbackPosition || '').trim();

  if(primary && !broadPositions.has(primary.toLowerCase())) return primary;
  if(fallback) return fallback;
  return primary || 'Player';
}

function fallbackFor(){
  return '/assets/players/neutral-player.svg';
}
function portraitFor(player){
  return player?.image || player?.img || '';
}
function apiIdFor(player){
  // Explicit API-Football id from the Calibre (Supabase) player bank wins.
  const explicit = player?.apiPlayerId ?? player?.api_player_id;
  const explicitNum = Number(explicit);
  if(Number.isInteger(explicitNum) && explicitNum>0) return explicitNum;

  // A bank row carries apiPlayerId/api_player_id, so its numeric `id` is a
  // DATABASE ROW ID — never an API id. Don't borrow it (that hung the wrong
  // face on people who had no API match).
  const isBankRow = !!player && ('apiPlayerId' in player || 'api_player_id' in player);
  if(isBankRow) return null;

  // Otherwise this is an API-Football profile, where `id` IS the API id.
  const idNum = Number(player?.id);
  return Number.isInteger(idNum) && idNum>0 ? idNum : null;
}

function localToProfile(player){
  return {
    ...player,
    source:'calibre-index',
    image:player.img,
    position:specificPosition(player.pos,player.position),
    team:player.club,
  };
}

function weekIndex(length){
  const d = new Date();
  const oneJan = new Date(d.getFullYear(),0,1);
  return Math.floor(((d-oneJan)/86400000+oneJan.getDay()+1)/7)%length;
}

// Strip diacritics so "fermin" matches "Fermín", "odegaard" matches "Ødegaard"
function foldAccents(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }

function ageInRange(age,range){
  if(!age || range==='16-40') return true;
  const [a,b] = range.split('-').map(Number);
  return Number(age)>=a && Number(age)<=b;
}

function posMatches(position,filter){
  if(filter==='all') return true;
  return String(position||'').toLowerCase().includes(filter.toLowerCase());
}

function sortCurated(rows,tab){
  const key = tab==='Market Buzz'
    ? 'buzz'
    : tab==='Fan Rating'
      ? 'fanRating'
      : tab==='Potential'
        ? 'potential'
        : 'rating';

  return [...rows].sort((a,b)=>(b[key]||0)-(a[key]||0));
}


function mergeCuratedWithSupabase(curatedRows,dbRows){
  const rows = dbRows || [];

  // Index the bank rows two ways: by exact API id (unambiguous) and by name
  // (first occurrence wins, so the result is deterministic even when two
  // different players share a name — e.g. two separate "Mohamed Salah" rows).
  const byId = new Map();
  const byName = new Map();
  for(const player of rows){
    const apiId = Number(player.api_player_id);
    if(Number.isInteger(apiId) && apiId>0 && !byId.has(apiId)) byId.set(apiId,player);
    const key = String(player.name || '').toLowerCase();
    if(!byName.has(key)) byName.set(key,player);
  }

  const merged = curatedRows.map(curated=>{
    // Prefer an explicit API id on the curated entry. This is what makes a
    // famous player with a common name resolve to the RIGHT person instead of
    // whichever duplicate row happened to come back first. Fall back to name
    // only when no curated id is provided.
    const curatedId = Number(curated.apiPlayerId ?? curated.api_player_id);
    const databasePlayer = (Number.isInteger(curatedId) && byId.has(curatedId))
      ? byId.get(curatedId)
      : byName.get(String(curated.name || '').toLowerCase());

    if(!databasePlayer) return curated;

    return {
      ...curated,
      ...databasePlayer,
      rank:curated.rank,
      apiPlayerId:databasePlayer.api_player_id ?? curated.apiPlayerId ?? null,
      age:databasePlayer.age || curated.age,
      club:databasePlayer.club || curated.club,
      team:databasePlayer.team || databasePlayer.club || curated.club,
      pos:specificPosition(databasePlayer.pos,curated.pos),
      position:specificPosition(databasePlayer.position,specificPosition(databasePlayer.pos,curated.pos)),
      img:databasePlayer.img || curated.img,
      image:databasePlayer.image || databasePlayer.img || curated.img,
      // Same class of bug already fixed on the profile-modal merge below
      // (openProfile's archetype fallback) — a plain `{...curated,
      // ...databasePlayer}` spread lets a null DB archetype silently clobber
      // a perfectly good curated one, since spread copies the key regardless
      // of its value. Every other display field here already guards against
      // this (age/club/img/rating); archetype was the one left exposed.
      archetype:databasePlayer.archetype || curated.archetype,
      rating:ratingOf(databasePlayer) ?? curated.rating,
      buzz:curated.buzz,
      fanRating:curated.fanRating,
      potential:curated.potential,
    };
  });

  // Important: keep the landing page editorial and compact.
  // Supabase is the full player bank, but only curated names belong here.
  return merged;
}

// Aggregate the player's FULL competitive season (league + cups + continental,
// friendlies excluded) into one synthetic line — matching the enrichment backend,
// so the modal shows the same all-competitions totals and rating as the rest of
// the app instead of an arbitrary single competition.
function pickLeagueLine(statistics){
  const rows = Array.isArray(statistics) ? statistics.filter(s => s && s.games) : [];
  if(!rows.length) return null;
  const mins = s => Number(s.games?.minutes) || 0;
  const friendly = s => {
    const n = String(s?.league?.name || '').toLowerCase();
    return [10,667,666].includes(Number(s?.league?.id)) || n.includes('friendl') || n.includes('exhibition') || n.includes('testimonial');
  };
  const pool = (rows.filter(s => !friendly(s))).length ? rows.filter(s => !friendly(s)) : rows;
  const leagueType = pool.filter(s => String(s?.league?.type || '').toLowerCase() === 'league');
  const primaryPool = leagueType.length ? leagueType : pool;
  const primary = primaryPool.reduce((b,s) => (mins(s) > mins(b) ? s : b), primaryPool[0]);
  const sum = sel => pool.reduce((t,s) => t + (Number(sel(s)) || 0), 0);
  let accW=0, accSum=0, rW=0, rSum=0, pos=null, posMin=-1;
  for(const s of pool){
    const m = mins(s);
    const acc = Number(s?.passes?.accuracy);
    if(Number.isFinite(acc) && m>0){ accSum += acc*m; accW += m; }
    const r = parseFloat(s?.games?.rating);
    if(Number.isFinite(r) && m>0){ rSum += r*m; rW += m; }
    if(m > posMin){ posMin = m; pos = s?.games?.position || pos; }
  }
  return {
    league: { id: primary?.league?.id, name: primary?.league?.name, type: 'League' },
    team: primary?.team,
    games: { minutes: sum(s=>s.games?.minutes), appearences: sum(s=>s.games?.appearences), lineups: sum(s=>s.games?.lineups), position: pos, rating: rW>0 ? (rSum/rW) : null },
    goals: { total: sum(s=>s.goals?.total), assists: sum(s=>s.goals?.assists) },
    passes: { total: sum(s=>s.passes?.total), key: sum(s=>s.passes?.key), accuracy: accW>0 ? Math.round(accSum/accW) : null },
    dribbles: { success: sum(s=>s.dribbles?.success) },
    tackles: { total: sum(s=>s.tackles?.total), interceptions: sum(s=>s.tackles?.interceptions) },
    duels: { won: sum(s=>s.duels?.won) },
    shots: { total: sum(s=>s.shots?.total) },
  };
}

// Map an API statistics line onto the shape calibreRating expects, so the live
// modal shows the same weighted rating the rest of the app does.
function lineToRatingInput(player, stat){
  const g = stat?.games || {};
  return {
    name: player.name,
    position: g.position || player.position || player.pos || '',
    league_id: stat?.league?.id ?? player.league_id ?? null,
    age: player.age ?? null,
    minutes: Number(g.minutes) || 0,
    stats_minutes: Number(g.minutes) || 0,
    appearances: Number(g.appearences ?? g.appearances) || 0,
    goals: Number(stat?.goals?.total) || 0,
    assists: Number(stat?.goals?.assists) || 0,
    api_average_rating: Number(g.rating) || 0,
    passes: Number(stat?.passes?.total) || 0,
    pass_accuracy: Number(stat?.passes?.accuracy) || 0,
    key_passes: Number(stat?.passes?.key) || 0,
    dribbles_success: Number(stat?.dribbles?.success) || 0,
    tackles: Number(stat?.tackles?.total) || 0,
    interceptions: Number(stat?.tackles?.interceptions) || 0,
    duels_won: Number(stat?.duels?.won) || 0,
    shots: Number(stat?.shots?.total) || 0,
  };
}

function ppmStat(v, dp = 0) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return dp ? n.toFixed(dp) : String(n);
}

// ── Player pop-up v3 ─ competition breakdown, per-90 percentiles, form,
// availability, similar players. Every number below is either read straight
// off the player row / the already-fetched API-Football statistics array, or
// computed from them (per-90 rates, percentiles vs a real position pool,
// nearest-neighbour similarity). Nothing here is a placeholder label — a
// field with no evidence yet renders '—', same convention as the rest of
// this file, rather than a guessed number.

const PPM_TABS = ['Overview', 'Season', 'Career', 'Advanced Stats', 'Form', 'Scout Report', 'Compare'];

// Real per-90 "Key Stats" config. Every key here is a genuine column in the
// Supabase player bank (see PLAYER_SELECT in supabasePlayers.js) — most are
// TheStatsAPI enrichment fields that were already being collected but never
// surfaced anywhere in the UI before this pop-up.
const KEY_STAT_FIELDS = [
  { key: 'goals', label: 'Goals', dp: 2 },
  { key: 'xg', label: 'xG', dp: 2, per90Field: 'xg_per_90' },
  { key: 'xa', label: 'xA', dp: 2, per90Field: 'xa_per_90' },
  { key: 'shots', label: 'Shots', dp: 2 },
  { key: 'shots_on_target', label: 'Shots on Target', dp: 2 },
  { key: 'pass_accuracy', label: 'Pass Accuracy', dp: 1, rate: true, suffix: '%' },
  { key: 'touches', label: 'Touches', dp: 1 },
  { key: 'duels_won', label: 'Duels Won', dp: 2 },
  { key: 'aerial_duels_won', label: 'Aerial Won', dp: 2 },
  { key: 'pressures', label: 'Pressures', dp: 2 },
  { key: 'progressive_carries', label: 'Progressive Runs', dp: 2 },
];

function statMinutesOf(row) { return Number(row?.stats_minutes) || Number(row?.minutes) || 0; }

function per90Value(row, field) {
  const m = statMinutesOf(row);
  const raw = row?.[field];
  if (raw == null || !(m > 0)) return null;
  return cmpPer90(raw, m);
}

function keyStatValue(row, def) {
  if (def.rate) { return numOrNullPPM(row?.[def.key]); }
  if (def.per90Field && row?.[def.per90Field] != null) return Number(row[def.per90Field]);
  return per90Value(row, def.key);
}
function numOrNullPPM(v) { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }

function percentileRank(value, pool) {
  if (value == null || !Array.isArray(pool) || pool.length < 8) return null;
  const below = pool.filter(v => v < value).length;
  return Math.round((below / pool.length) * 100);
}

// Real nearest-neighbour similarity — four real, weighted signals, not one:
//   1. Position bucket (hard filter — the pool passed in is already scoped
//      to ATT/MID/DEF/GK, so this is enforced before any scoring happens).
//   2. Archetype match (30%) — same tactical role label (Poacher, Advanced
//      Playmaker, etc.), a genuine categorical field on the row.
//   3. Playing-style distance (40%) — a real per-90 output vector (goals,
//      assists, key passes, dribbles, tackles, interceptions, duels), so two
//      players with the same rating but opposite job descriptions (e.g. a
//      poacher vs a false nine) don't score as near-identical just because
//      their headline number matches.
//   4. Rating + age proximity (30%) — the coarse "same tier, same career
//      stage" signal the old version used alone.
const STYLE_METRICS = ['goals', 'assists', 'key_passes', 'dribbles_success', 'tackles', 'interceptions', 'duels_won'];
const STYLE_SCALE = { goals: 0.7, assists: 0.4, key_passes: 2.5, dribbles_success: 2.5, tackles: 2.5, interceptions: 1.8, duels_won: 5 };
function styleDistance(a, b) {
  let sumSq = 0, n = 0;
  for (const k of STYLE_METRICS) {
    const av = per90Value(a, k), bv = per90Value(b, k);
    if (av == null && bv == null) continue;
    const scale = STYLE_SCALE[k] || 1;
    const d = ((av ?? 0) - (bv ?? 0)) / scale;
    sumSq += d * d;
    n++;
  }
  return n ? Math.sqrt(sumSq / n) : null; // null = no overlapping per-90 evidence
}
function similarPlayers(player, pool, limit = 4) {
  if (!Array.isArray(pool) || !pool.length) return [];
  const r = Number(player.ability_rating ?? player.rating) || 0;
  const age = Number(player.age) || 0;
  const arch = String(player.archetype || '').trim().toLowerCase();
  const selfKey = player.apiPlayerId ?? player.api_player_id ?? player.name;
  return pool
    .filter(cand => (cand.apiPlayerId ?? cand.api_player_id ?? cand.name) !== selfKey)
    .map(cand => {
      const cr = Number(cand.ability_rating ?? cand.rating) || 0;
      const cAge = Number(cand.age) || 0;
      const ratingScore = clampPPM(1 - Math.abs(r - cr) / 40, 0, 1);
      const ageScore = clampPPM(1 - Math.abs(age - cAge) / 20, 0, 1);
      const archMatch = arch && String(cand.archetype || '').trim().toLowerCase() === arch ? 1 : 0;
      const dist = styleDistance(player, cand);
      const styleScore = dist == null ? 0.5 : clampPPM(1 - dist / 2.5, 0, 1); // no evidence -> neutral, not zero
      const score = Math.round(archMatch * 30 + styleScore * 40 + ratingScore * 20 + ageScore * 10);
      return { player: cand, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
function clampPPM(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function daysAgo(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr).getTime();
  if (!Number.isFinite(d)) return null;
  return Math.max(0, Math.round((Date.now() - d) / 86400000));
}

function PlayerProfileModal({ player, stats, loading, onClose, onCompare, onCompareWith, watched, onToggleWatch, canWatch }) {
  const [tab, setTab] = useState('Season');
  const [pool, setPool] = useState([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [form, setForm] = useState([]);
  const [formLoading, setFormLoading] = useState(false);
  const [career, setCareer] = useState([]);
  const [careerLoading, setCareerLoading] = useState(false);
  const [careerNationalTeamId, setCareerNationalTeamId] = useState(null);
  const [seasonPick, setSeasonPick] = useState(null); // null = use the auto-resolved default season
  const [pickedStats, setPickedStats] = useState(null);
  const [pickedLoading, setPickedLoading] = useState(false);

  const apiId = apiIdFor(player);
  const bucket = player ? ratingPositionBucket(player) : null;

  // Reset every player-scoped state when the identity actually changes — not
  // just the tab. Without this, career/pool/form stayed populated with the
  // PREVIOUS player's data forever: the Career effect below only fetches
  // when `career.length` is 0, so opening Messi right after Haaland left
  // Haaland's career rows on screen under Messi's name, since the array was
  // never cleared and the guard silently skipped the refetch.
  useEffect(() => {
    setTab('Season');
    setCareer([]);
    setCareerLoading(false);
    setCareerNationalTeamId(null);
    setPool([]);
    setForm([]);
    setSeasonPick(null);
    setPickedStats(null);
  }, [player?.name, player?.apiPlayerId]);

  // Season picker (Season tab) — the default season is whatever
  // getPlayerStatsWithFallback resolved (`stats` prop), but the user can pick
  // any of the last few seasons to see that season's competition breakdown
  // instead. Only fetches when the pick actually differs from the default
  // season already sitting in `stats`.
  const defaultSeason = stats?.__season ?? CURRENT_SEASON;
  useEffect(() => {
    if (seasonPick == null || seasonPick === defaultSeason || !apiId) { setPickedStats(null); return; }
    let alive = true;
    setPickedLoading(true);
    getPlayerStats(apiId, seasonPick)
      .then(data => { if (alive) setPickedStats(data); })
      .catch(() => { if (alive) setPickedStats(null); })
      .finally(() => { if (alive) setPickedLoading(false); });
    return () => { alive = false; };
  }, [seasonPick, defaultSeason, apiId]);

  // Position pool — powers percentile bars (Season / Advanced Stats) and the
  // similar-players list (Season / Compare). Fetched once per player.
  useEffect(() => {
    if (!player || !bucket) return;
    let alive = true;
    setPoolLoading(true);
    getSupabasePositionPool({ bucket, limit: 300 })
      .then(rows => { if (alive) setPool(rows); })
      .catch(() => { if (alive) setPool([]); })
      .finally(() => { if (alive) setPoolLoading(false); });
    return () => { alive = false; };
  }, [player?.name, player?.apiPlayerId, bucket]);

  // Recent form — real match-by-match ratings via /fixtures + /fixtures/players.
  // Needs a real API-Football team id, which curated/search rows carry as
  // apiTeamId once resolved against the DB. Also resolves the player's
  // NATIONAL team id from nationality and merges those fixtures in — a club
  // fixture-only query is blind to World Cup / international matches, which
  // meant a player's actual most recent game (e.g. a WC knockout tie) was
  // silently dropped in favour of an older club match.
  useEffect(() => {
    const teamId = player?.apiTeamId ?? player?.api_team_id;
    if (!teamId || !apiId) { setForm([]); return; }
    let alive = true;
    setFormLoading(true);
    (async () => {
      let nationalTeamId = null;
      try { nationalTeamId = await getNationalTeamId(player?.nationality); } catch { /* falls back to club-only below */ }
      if (!alive) return null;
      return getRecentPlayerForm(teamId, apiId, 8, nationalTeamId);
    })()
      .then(rows => { if (alive && rows) setForm(rows); })
      .catch(() => { if (alive) setForm([]); })
      .finally(() => { if (alive) setFormLoading(false); });
    return () => { alive = false; };
  }, [player?.name, apiId, player?.apiTeamId, player?.api_team_id, player?.nationality]);

  // Career history — only fetched once the Career tab is actually opened
  // (up to ~25 extra API-Football calls otherwise, not worth it for a tab
  // most people never click). Goes back to 2002, which covers essentially
  // any pro career API-Football has records for; seasons with no evidence
  // are dropped by getPlayerCareerSeasons itself, so this is "whole career
  // on file," not a fabricated fixed window. Also resolves the player's
  // national team id so country caps (World Cup, qualifiers, continental
  // tournaments, friendlies) can be tagged and shown alongside club stats
  // instead of being silently collapsed into a single club-only line.
  useEffect(() => {
    if (tab !== 'Career' || !apiId || career.length || careerLoading) return;
    let alive = true;
    setCareerLoading(true);
    Promise.all([
      getPlayerCareerSeasons(apiId, CURRENT_SEASON - 2002 + 1),
      getNationalTeamId(player?.nationality).catch(() => null),
    ])
      .then(([rows, natId]) => { if (alive) { setCareer(rows); setCareerNationalTeamId(natId); } })
      .catch(() => { if (alive) setCareer([]); })
      .finally(() => { if (alive) setCareerLoading(false); });
    return () => { alive = false; };
  }, [tab, apiId, player?.nationality]);

  if (!player) return null;

  const arch = player.archetype || '';
  const chips = String(player.position || player.pos || '').split(/[\/,]/).map(t => t.trim()).filter(Boolean).slice(0, 3);
  const headlineRating = player.ability_rating ?? player.rating;
  const scores = [
    ['SEASON SCORE', displayRating(player.rating)],
    ['CALIBRE', displayRating(player.ability_rating)],
    ['SELECTION', displayRating(player.availability_score)],
  ];
  const bio = [
    ['COUNTRY', player.nationality || player.country || '—'],
    ['AGE', player.age || '—'],
    ['HEIGHT', player.height ? String(player.height) : '—'],
    ['WEIGHT', player.weight ? String(player.weight) : '—'],
    ['FOOT', player.foot || '—'],
    ['CLUB', player.club || player.team || '—'],
  ];

  let value = null;
  try { value = calibreValue(player); } catch { value = null; }

  // Competition breakdown — straight off the already-fetched API-Football
  // `stats.statistics` array (one row per competition), same source the
  // rest of the app aggregates via pickLeagueLine. Friendlies excluded, same
  // rule pickLeagueLine uses.
  const seasonInFlight = seasonPick != null && seasonPick !== defaultSeason;
  const seasonStats = seasonInFlight ? pickedStats : stats;
  const compRows = (Array.isArray(seasonStats?.statistics) ? seasonStats.statistics : []).filter(s => {
    if (!s?.games) return false;
    const n = String(s?.league?.name || '').toLowerCase();
    return ![10, 667, 666].includes(Number(s?.league?.id)) && !n.includes('friendl') && !n.includes('exhibition');
  });
  const compTotal = compRows.length ? pickLeagueLine(compRows) : null;
  const compLoading = seasonInFlight ? pickedLoading : loading;
  // Last 6 seasons, newest first, for the season picker.
  const seasonOptions = Array.from({ length: 6 }, (_, i) => CURRENT_SEASON - i);

  const keyStats = KEY_STAT_FIELDS.map(def => {
    const val = keyStatValue(player, def);
    const poolVals = pool.map(row => keyStatValue(row, def)).filter(v => v != null);
    return { ...def, value: val, pct: percentileRank(val, poolVals) };
  });
  const goalsN = Number(player.goals), shotsN = Number(player.shots ?? player.total_shots);
  const conversion = (Number.isFinite(goalsN) && shotsN > 0) ? clampPPM((goalsN / shotsN) * 100, 0, 100) : null;

  const ratedForm = form.filter(m => m.rating);
  const formAvgRating = ratedForm.length ? (ratedForm.reduce((s, m) => s + m.rating, 0) / ratedForm.length) : null;
  const formGoals = form.reduce((s, m) => s + (m.goals || 0), 0);
  const formAssists = form.reduce((s, m) => s + (m.assists || 0), 0);
  const lastMatchDaysAgo = form.length ? daysAgo(form[form.length - 1]?.date) : null;
  const recentMinutesAvg = form.length ? form.slice(-4).reduce((s, m) => s + (m.minutes || 0), 0) / Math.min(4, form.length) : null;
  const workload = recentMinutesAvg == null ? '—' : recentMinutesAvg >= 75 ? 'High' : recentMinutesAvg >= 45 ? 'Normal' : 'Low';
  const injuryKnown = player.injury_days_last_365 != null || player.injured != null;
  const injuryStatus = player.injured === true ? 'Injured' : player.injured === false ? 'Fit' : injuryKnown ? 'Fit' : '—';
  const similar = similarPlayers(player, pool, 4);
  // Which season the competition breakdown is actually showing — falls back
  // to a prior season when the current one has no evidence yet (see
  // getPlayerStatsWithFallback), so the heading never claims a season that's
  // sitting empty just because it hasn't kicked off. A manual pick from the
  // season selector always wins over the auto fallback.
  const statsSeason = seasonPick ?? defaultSeason;
  const statsSeasonIsFallback = seasonPick == null && stats?.__season != null && stats.__season !== CURRENT_SEASON;

  const spinnerNote = loading ? 'Loading live stats from the connected player dataset…' : 'Stats populate from the connected player dataset — blanks fill in as data syncs.';

  return (
    <div className="ppm3" role="presentation" onMouseDown={onClose}>
      <section className="ppm3-card" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <style>{PPM3_CSS}</style>

        <div className="ppm3-topbar">
          <div className="ppm3-brand"><img src="/assets/calibre-logo.png" alt="" /> CALIBRE</div>
          <div className="ppm3-topbar-actions">
            <ShareBar text={`${player.name} — Calibre ${displayRating(headlineRating)}${arch ? `, ${arch}` : ''}.`} url={shareUrl('/players')} label={false} />
            <button className="ppm3-close" type="button" onClick={onClose} aria-label="Close"><X size={16} /></button>
          </div>
        </div>

        <div className="ppm3-head">
          <div className="ppm3-photo"><ApiPlayerImage playerId={apiId} name={player.name} preferredSrc={portraitFor(player)} fallbackSrc={fallbackFor(player)} alt={player.name} /></div>
          <div className="ppm3-id">
            <div className="ppm3-kicker">{[player.pos || player.position, player.club || player.team].filter(Boolean).join(' · ') || 'Player profile'}</div>
            <h3>{player.name}</h3>
            <div className="ppm3-tags">
              {chips.map(c => <span key={c}>{c}</span>)}
              {arch && <em>{arch}</em>}
            </div>
            <div className="ppm3-bioline">
              {player.nationality && <span>{player.nationality}</span>}
              {player.age ? <span>{player.age} yrs</span> : null}
              {player.height ? <span>{player.height}</span> : null}
              {player.foot ? <span>{player.foot}</span> : null}
              {(player.club || player.team) ? <span>{player.club || player.team}</span> : null}
            </div>
          </div>
          <div className="ppm3-rating">
            <strong>{displayRating(headlineRating)}</strong>
            <span>CALIBRE</span>
            <em className="ppm3-rating-sub">Season {displayRating(player.rating)} · Avail {displayRating(player.availability_score)}</em>
          </div>
          <div className="ppm3-value">
            <span className="ppm3-value-label">Calibre value</span>
            <strong>{value ? `€${value.estimatedValue}M` : '—'}</strong>
            <span className="ppm3-value-sub">{chips[0] || player.position || 'Position'} · Fair range {value ? `€${value.fairRange.low}–${value.fairRange.high}M` : '—'}</span>
          </div>
        </div>

        <div className="ppm3-tabs">
          {PPM_TABS.map(t => <button key={t} type="button" className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
        </div>

        <div className="ppm3-body">
          {tab === 'Overview' && (
            <>
              <div className="ppm3-sec"><small>RATING BREAKDOWN</small><div className="ppm3-grid">{scores.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div></div>
              <div className="ppm3-sec"><small>BIO</small><div className="ppm3-grid">{bio.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div></div>
              <div className="ppm3-sec">
                <small>SEASON SNAPSHOT {CURRENT_SEASON}/{String(CURRENT_SEASON + 1).slice(2)}</small>
                <div className="ppm3-grid ppm3-grid--4">
                  <div><span>Appearances</span><b>{ppmStat(player.appearances)}</b></div>
                  <div><span>Minutes</span><b>{ppmStat(player.minutes)}</b></div>
                  <div><span>Goals</span><b>{ppmStat(player.goals)}</b></div>
                  <div><span>Assists</span><b>{ppmStat(player.assists)}</b></div>
                </div>
              </div>
            </>
          )}

          {tab === 'Season' && (
            <>
              <div className="ppm3-row2">
                <div className="ppm3-sec">
                  <div className="ppm3-sec-head">
                    <small>SEASON {statsSeason}/{String(statsSeason + 1).slice(2)}{statsSeasonIsFallback ? ' (last completed)' : ''} — COMPETITION BREAKDOWN</small>
                    <select
                      className="ppm3-season-pick"
                      value={statsSeason}
                      onChange={e => setSeasonPick(Number(e.target.value))}
                      aria-label="Season"
                    >
                      {seasonOptions.map(s => (
                        <option key={s} value={s}>{s}/{String(s + 1).slice(2)}{s === defaultSeason ? ' (default)' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="ppm3-table-wrap">
                    <table className="ppm3-table">
                      <thead><tr><th>Competition</th><th className="num">Apps</th><th className="num">Mins</th><th className="num">Goals</th><th className="num">Assists</th><th className="num">G/A</th><th className="num">G/90</th><th className="num">Rating</th></tr></thead>
                      <tbody>
                        {compRows.map((s, i) => {
                          const mins = Number(s.games?.minutes) || 0;
                          const g = Number(s.goals?.total) || 0, a = Number(s.goals?.assists) || 0;
                          const g90 = mins > 0 ? (g / mins) * 90 : 0;
                          const rating = Number.parseFloat(s.games?.rating) || null;
                          return (
                            <tr key={i}>
                              <td><div className="ppm3-comp"><ApiLeagueLogo id={s.league?.id} src={s.league?.logo} name={s.league?.name} className="ppm3-comp-logo" />{s.league?.name || '—'}</div></td>
                              <td className="num">{Number(s.games?.appearences ?? s.games?.appearances) || 0}</td>
                              <td className="num">{mins}</td>
                              <td className="num">{g}</td>
                              <td className="num">{a}</td>
                              <td className="num">{g + a}</td>
                              <td className="num">{g90.toFixed(2)}</td>
                              <td className="num"><span className="ppm3-pill">{rating ? rating.toFixed(2) : '—'}</span></td>
                            </tr>
                          );
                        })}
                        {!compRows.length && <tr><td colSpan={8} className="ppm3-empty">{compLoading ? 'Loading season statistics…' : 'No competition data synced yet for this season.'}</td></tr>}
                        {compTotal && (
                          <tr className="ppm3-total">
                            <td>Total</td>
                            <td className="num">{Number(compTotal.games?.appearences) || 0}</td>
                            <td className="num">{Number(compTotal.games?.minutes) || 0}</td>
                            <td className="num">{Number(compTotal.goals?.total) || 0}</td>
                            <td className="num">{Number(compTotal.goals?.assists) || 0}</td>
                            <td className="num">{(Number(compTotal.goals?.total) || 0) + (Number(compTotal.goals?.assists) || 0)}</td>
                            <td className="num">{compTotal.games?.minutes > 0 ? ((Number(compTotal.goals?.total) || 0) / compTotal.games.minutes * 90).toFixed(2) : '0.00'}</td>
                            <td className="num"><span className="ppm3-pill">{compTotal.games?.rating ? compTotal.games.rating.toFixed(2) : '—'}</span></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="ppm3-foot">All stats per 90 minutes<Info size={11} /></p>
                </div>

                <div className="ppm3-sec">
                  <small>KEY STATS (PER 90)</small>
                  <div className="ppm3-key-grid">
                    {keyStats.map(k => (
                      <div key={k.key}>
                        <span>{k.label}</span>
                        <b>{k.value == null ? '—' : k.value.toFixed(k.dp)}{k.suffix || ''}</b>
                        <em>{k.pct != null ? `${k.pct}th %ile` : '—'}</em>
                      </div>
                    ))}
                    <div><span>Conversion %</span><b>{conversion != null ? `${conversion.toFixed(1)}%` : '—'}</b><em>—</em></div>
                  </div>
                  <p className="ppm3-foot">Percentile ranks vs {bucket || 'position'} players in the Calibre bank{poolLoading ? ' — loading…' : ` (n=${pool.length})`}<Info size={11} /></p>
                </div>
              </div>

              <div className="ppm3-row3">
                <div className="ppm3-sec ppm3-sec--wide">
                  <small><Activity size={11} /> FORM (LAST {form.length || 8} MATCHES)</small>
                  {form.length ? (
                    <>
                      <div className="ppm3-sparkline ppm3-sparkline--lg">
                        {form.map((m, i) => (
                          <div key={i} className={`ppm3-spark-col${m.international ? ' ppm3-spark-col--intl' : ''}`} title={`${m.competition ? m.competition + ' — ' : ''}${m.opponentName} — ${m.rating ?? '—'}`}>
                            {m.opponentLogo ? <img src={m.opponentLogo} alt="" /> : <span className="ppm3-spark-dot" />}
                            <b className={m.rating >= 7.5 ? 'hi' : m.rating && m.rating < 6.2 ? 'lo' : ''}>{m.rating ? m.rating.toFixed(1) : '—'}</b>
                            <em>{m.opponentName}</em>
                          </div>
                        ))}
                      </div>
                      <div className="ppm3-grid ppm3-grid--4">
                        <div><span>Avg Rating</span><b>{formAvgRating ? formAvgRating.toFixed(1) : '—'}</b></div>
                        <div><span>Goals</span><b>{formGoals}</b></div>
                        <div><span>Assists</span><b>{formAssists}</b></div>
                        <div><span>Days Since Last Match</span><b>{lastMatchDaysAgo != null ? lastMatchDaysAgo : '—'}</b></div>
                      </div>
                    </>
                  ) : <p className="ppm3-empty">{formLoading ? 'Loading recent fixtures…' : 'Recent match ratings need a resolved team id — not yet synced for this player.'}</p>}
                </div>

                <div className="ppm3-sec">
                  <small><ShieldAlert size={11} /> AVAILABILITY</small>
                  <ul className="ppm3-avail">
                    <li><span>Minutes Played</span><b>{ppmStat(player.minutes)}</b></li>
                    <li><span>Injury Status</span>{injuryStatus === '—' ? <b>—</b> : <em className={`ppm3-status ppm3-status--${injuryStatus === 'Injured' ? 'bad' : 'good'}`}>{injuryStatus}</em>}</li>
                    <li><span>Days Out (365d)</span><b>{player.injury_days_last_365 != null ? player.injury_days_last_365 : '—'}</b></li>
                    <li><span>Major Injuries</span><b>{player.major_injuries_count != null ? player.major_injuries_count : '—'}</b></li>
                    <li><span>Workload</span>{workload === '—' ? <b>—</b> : <em className={`ppm3-status ppm3-status--${workload === 'High' ? 'warn' : workload === 'Low' ? 'dim' : 'good'}`}>{workload}</em>}</li>
                  </ul>
                </div>

                <div className="ppm3-sec">
                  <small><Users size={11} /> PLAYER COMPARISON</small>
                  {poolLoading ? <p className="ppm3-empty">Loading similar players…</p> : similar.length ? (
                    <div className="ppm3-similar">
                      {similar.map(({ player: cand, score }) => (
                        <button type="button" key={cand.apiPlayerId ?? cand.name} onClick={() => setTab('Compare')}>
                          <ApiPlayerImage playerId={apiIdFor(cand)} name={cand.name} preferredSrc={portraitFor(cand)} fallbackSrc={fallbackFor(cand)} />
                          <span>{cand.name}</span>
                          <div className="ppm3-simbar"><i style={{ width: `${score}%` }} /></div>
                          <em>{score}%</em>
                        </button>
                      ))}
                    </div>
                  ) : <p className="ppm3-empty">No comparable {bucket || ''} players synced yet.</p>}
                  <p className="ppm3-foot">Weighted match: archetype, playing style, rating &amp; age — within {bucket || 'position'}.</p>
                </div>
              </div>
            </>
          )}

          {tab === 'Career' && (() => {
            // Every competition entry API-Football has on file per season —
            // club league, domestic cups, continental, AND national team
            // (World Cup, qualifiers, continental tournaments, friendlies).
            // Previously this collapsed each season into one club-only line
            // via pickLeagueLine (which also stripped friendlies), hiding
            // international duty entirely. Now each entry is its own row,
            // tagged INTL when it's the player's national team.
            const careerLines = career
              .flatMap(({ season, data }) => (Array.isArray(data?.statistics) ? data.statistics : [])
                .filter(s => s?.games && (Number(s.games?.appearences ?? s.games?.appearances) > 0 || Number(s.games?.minutes) > 0))
                .map(s => ({
                  season,
                  s,
                  isNational: careerNationalTeamId != null && Number(s.team?.id) === Number(careerNationalTeamId),
                })))
              .sort((a, b) => b.season - a.season || (Number(b.s.games?.minutes) || 0) - (Number(a.s.games?.minutes) || 0));
            const seasonCount = new Set(careerLines.map(r => r.season)).size;
            const totals = careerLines.reduce((acc, { s }) => {
              acc.apps += Number(s.games?.appearences ?? s.games?.appearances) || 0;
              acc.mins += Number(s.games?.minutes) || 0;
              acc.goals += Number(s.goals?.total) || 0;
              acc.assists += Number(s.goals?.assists) || 0;
              const r = Number.parseFloat(s.games?.rating);
              const mins = Number(s.games?.minutes) || 0;
              if (Number.isFinite(r) && mins > 0) { acc.ratingWeighted += r * mins; acc.ratedMins += mins; }
              return acc;
            }, { apps: 0, mins: 0, goals: 0, assists: 0, ratingWeighted: 0, ratedMins: 0 });
            const avgRating = totals.ratedMins ? totals.ratingWeighted / totals.ratedMins : null;
            return (
            <div className="ppm3-sec">
              <small>CAREER — CLUB &amp; COUNTRY, ALL COMPETITIONS{seasonCount ? ` — ${seasonCount} SEASON${seasonCount === 1 ? '' : 'S'} SINCE 2002` : ' SINCE 2002'}</small>
              <div className="ppm3-table-wrap">
                <table className="ppm3-table">
                  <thead><tr><th>Season</th><th>Team</th><th>Competition</th><th className="num">Apps</th><th className="num">Mins</th><th className="num">Goals</th><th className="num">Assists</th><th className="num">G/90</th><th className="num">G+A/90</th><th className="num">Rating</th></tr></thead>
                  <tbody>
                    {careerLines.map(({ season, s, isNational }, i) => {
                      const mins = Number(s.games?.minutes) || 0;
                      const g = Number(s.goals?.total) || 0;
                      const a = Number(s.goals?.assists) || 0;
                      const g90 = mins > 0 ? (g / mins) * 90 : null;
                      const ga90 = mins > 0 ? ((g + a) / mins) * 90 : null;
                      return (
                      <tr key={`${season}-${s.team?.id}-${s.league?.id}-${i}`}>
                        <td>{season}/{String(season + 1).slice(2)}</td>
                        <td>{s.team?.name || '—'}{isNational && <em className="ppm3-intl-tag">INTL</em>}</td>
                        <td>{s.league?.name || '—'}</td>
                        <td className="num">{Number(s.games?.appearences ?? s.games?.appearances) || 0}</td>
                        <td className="num">{mins}</td>
                        <td className="num">{g}</td>
                        <td className="num">{a}</td>
                        <td className="num">{g90 == null ? '—' : g90.toFixed(2)}</td>
                        <td className="num">{ga90 == null ? '—' : ga90.toFixed(2)}</td>
                        <td className="num"><span className="ppm3-pill">{s.games?.rating ? Number.parseFloat(s.games.rating).toFixed(2) : '—'}</span></td>
                      </tr>
                      );
                    })}
                    {!careerLines.length && <tr><td colSpan={10} className="ppm3-empty">{careerLoading ? 'Loading career history…' : 'No prior-season data synced yet.'}</td></tr>}
                    {careerLines.length > 0 && (
                      <tr className="ppm3-total">
                        <td colSpan={3}>Career total</td>
                        <td className="num">{totals.apps}</td>
                        <td className="num">{totals.mins}</td>
                        <td className="num">{totals.goals}</td>
                        <td className="num">{totals.assists}</td>
                        <td className="num">{totals.mins > 0 ? ((totals.goals / totals.mins) * 90).toFixed(2) : '—'}</td>
                        <td className="num">{totals.mins > 0 ? (((totals.goals + totals.assists) / totals.mins) * 90).toFixed(2) : '—'}</td>
                        <td className="num"><span className="ppm3-pill">{avgRating ? avgRating.toFixed(2) : '—'}</span></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            );
          })()}

          {tab === 'Advanced Stats' && (
            <div className="ppm3-sec">
              <small>ADVANCED METRICS — {defaultSeason ? `${defaultSeason}/${String(defaultSeason + 1).slice(2)}${(stats?.__season != null && stats.__season !== CURRENT_SEASON) ? ' (LAST COMPLETED)' : ''} — ` : ''}PERCENTILE VS {(bucket || 'POSITION').toUpperCase()} ({poolLoading ? '…' : pool.length} PLAYERS)</small>
              <div className="ppm3-bars">
                {keyStats.map(k => (
                  <div className="ppm3-bar-row" key={k.key}>
                    <span>{k.label}</span>
                    <div className="ppm3-bar"><i style={{ width: `${k.pct ?? 0}%` }} /></div>
                    <b>{k.value == null ? '—' : k.value.toFixed(k.dp)}{k.suffix || ''}</b>
                    <em>{k.pct != null ? `${k.pct}th` : '—'}</em>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'Form' && (
            <div className="ppm3-sec">
              <small><Activity size={11} /> MATCH-BY-MATCH FORM</small>
              {form.length ? (
                <div className="ppm3-table-wrap">
                  <table className="ppm3-table">
                    <thead><tr><th>Date</th><th>Competition</th><th>Opponent</th><th className="num">Mins</th><th className="num">Goals</th><th className="num">Assists</th><th className="num">Rating</th></tr></thead>
                    <tbody>
                      {form.map((m, i) => (
                        <tr key={i}>
                          <td>{m.date ? new Date(m.date).toLocaleDateString() : '—'}</td>
                          <td>{m.competition || '—'}{m.international && <em className="ppm3-intl-tag">INTL</em>}</td>
                          <td>{m.opponentName}</td>
                          <td className="num">{m.minutes}</td>
                          <td className="num">{m.goals}</td>
                          <td className="num">{m.assists}</td>
                          <td className="num"><span className="ppm3-pill">{m.rating ? m.rating.toFixed(2) : '—'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="ppm3-empty">{formLoading ? 'Loading recent fixtures…' : 'Recent match ratings need a resolved team id — not yet synced for this player.'}</p>}
            </div>
          )}

          {tab === 'Scout Report' && (
            <div className="ppm3-sec">
              <small>SCOUT REPORT</small>
              {(() => {
                const ranked = keyStats.filter(k => k.pct != null).sort((a, b) => b.pct - a.pct);
                const strengths = ranked.slice(0, 3);
                const weaknesses = ranked.slice(-2).reverse();
                return (
                  <>
                    <p className="ppm3-scout-lede">
                      {player.name}{arch ? `, deployed as a ${arch.toLowerCase()},` : ''} carries a Calibre of {displayRating(headlineRating)}{compTotal?.games?.rating ? ` and a ${compTotal.games.rating.toFixed(2)} average match rating across ${Number(compTotal.games?.appearences) || 0} appearances this season.` : '.'}
                    </p>
                    <div className="ppm3-row2">
                      <div>
                        <small>STRENGTHS</small>
                        {strengths.length ? strengths.map(k => <div className="ppm3-scout-row" key={k.key}><span>{k.label}</span><b>{k.pct}th percentile</b></div>) : <p className="ppm3-empty">Not enough position-pool data yet.</p>}
                      </div>
                      <div>
                        <small>WATCH AREAS</small>
                        {weaknesses.length ? weaknesses.map(k => <div className="ppm3-scout-row" key={k.key}><span>{k.label}</span><b>{k.pct}th percentile</b></div>) : <p className="ppm3-empty">Not enough position-pool data yet.</p>}
                      </div>
                    </div>
                    <p className="ppm3-foot">Generated from real per-90 percentiles vs the {bucket || 'position'} pool — not editorial scouting notes.</p>
                  </>
                );
              })()}
            </div>
          )}

          {tab === 'Compare' && (
            <div className="ppm3-sec">
              <small><Users size={11} /> SIMILAR PLAYERS</small>
              {poolLoading ? <p className="ppm3-empty">Loading…</p> : similar.length ? (
                <div className="ppm3-similar ppm3-similar--lg">
                  {similar.map(({ player: cand, score }) => (
                    <div className="ppm3-similar-row" key={cand.apiPlayerId ?? cand.name}>
                      <ApiPlayerImage playerId={apiIdFor(cand)} name={cand.name} preferredSrc={portraitFor(cand)} fallbackSrc={fallbackFor(cand)} />
                      <div className="ri"><strong>{cand.name || 'Unnamed player'}</strong><span>{cand.club || cand.team || '—'} · Calibre {displayRating(cand.rating)}</span></div>
                      <div className="ppm3-simbar"><i style={{ width: `${score}%` }} /></div>
                      <em>{score}%</em>
                      <button type="button" className="btn btn--outline btn--sm" onClick={() => onCompareWith(cand)}><Plus size={12} /> Compare</button>
                    </div>
                  ))}
                </div>
              ) : <p className="ppm3-empty">No comparable {bucket || ''} players synced yet.</p>}
            </div>
          )}
        </div>

        <div className="ppm3-actions">
          <button type="button" className={`btn btn--sm ${watched ? 'btn--lime' : 'btn--outline'}`} onClick={onToggleWatch} title={canWatch ? (watched ? 'Remove from watchlist' : 'Add to watchlist') : 'Watchlist is a Pro feature'}><Star size={13} /> {watched ? 'Watching' : 'Add to Watchlist'}</button>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => onCompare(player)}><GitCompareArrows size={13} /> Compare Player</button>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => navigateTo(`/system-fit?player=${encodeURIComponent(player.name)}`)}>Run System Fit <ArrowRight size={13} /></button>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setTab('Scout Report')}>View Scout Report</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>Close</button>
        </div>
        <p className="ppm3-note">{spinnerNote}</p>
      </section>
    </div>
  );
}

const PPM3_CSS = `
  .ppm3 { position:fixed; inset:0; z-index:1000; background:rgba(3,5,7,.72); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); display:flex; align-items:flex-start; justify-content:center; padding:40px 20px; overflow:auto; }
  .ppm3 * { box-sizing:border-box; }
  .ppm3-card { --l:#a6ff00; --muted:#8d929b; position:relative; width:min(920px,100%); background:rgba(11,15,18,.97); border:1px solid rgba(255,255,255,.10); border-radius:16px; box-shadow:0 30px 80px rgba(0,0,0,.65); padding:20px 22px 22px; }
  .ppm3-topbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
  .ppm3-brand { display:flex; align-items:center; gap:7px; color:#c4c9ce; font:800 11px/1 "IBM Plex Mono",monospace; letter-spacing:.14em; text-transform:uppercase; }
  .ppm3-brand img { width:18px; height:18px; object-fit:contain; }
  .ppm3-topbar-actions { display:flex; align-items:center; gap:8px; }
  .ppm3-close { width:28px; height:28px; display:grid; place-items:center; border-radius:8px; border:1px solid rgba(255,255,255,.10); background:rgba(255,255,255,.03); color:#c4c9ce; cursor:pointer; }
  .ppm3-close:hover { background:rgba(255,255,255,.08); color:#fff; }
  .ppm3-head { display:flex; align-items:flex-start; gap:14px; padding:12px 0; border-top:1px solid rgba(255,255,255,.06); border-bottom:1px solid rgba(255,255,255,.06); margin-bottom:12px; }
  .ppm3-photo { width:70px; height:84px; border-radius:9px; overflow:hidden; flex:none; background:#0a0d10; }
  .ppm3-photo img { width:100%; height:100%; object-fit:cover; object-position:top; }
  .ppm3-id { flex:1; min-width:0; }
  .ppm3-kicker { color:var(--l); font:800 10px/1 "IBM Plex Mono",monospace; letter-spacing:.12em; text-transform:uppercase; }
  .ppm3-id h3 { margin:6px 0 0; color:#fff; font:900 26px/1 "Barlow Condensed",sans-serif; text-transform:uppercase; letter-spacing:.01em; }
  .ppm3-tags { display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; }
  .ppm3-tags span { padding:3px 8px; border:1px solid rgba(255,255,255,.14); border-radius:4px; color:#c4c9ce; font:700 9px/1 "IBM Plex Mono",monospace; }
  .ppm3-tags em { padding:3px 8px; border:1px solid rgba(166,255,0,.3); border-radius:4px; color:var(--l); font:800 9px/1 "IBM Plex Mono",monospace; font-style:normal; }
  .ppm3-bioline { display:flex; gap:10px; margin-top:8px; flex-wrap:wrap; }
  .ppm3-bioline span { color:var(--muted); font:600 10.5px "Barlow",sans-serif; }
  .ppm3-rating { text-align:center; flex:none; padding:0 18px; border-left:1px solid rgba(255,255,255,.08); }
  .ppm3-rating strong { display:block; color:var(--l); font:900 38px/.85 "Barlow Condensed",sans-serif; text-shadow:0 0 22px rgba(166,255,0,.25); }
  .ppm3-rating span { display:block; margin-top:4px; color:var(--muted); font:800 8px/1 "IBM Plex Mono",monospace; letter-spacing:.1em; }
  .ppm3-rating-sub { display:block; margin-top:6px; color:var(--muted); font:600 8.5px/1.3 "Barlow",sans-serif; font-style:normal; white-space:nowrap; }
  .ppm3-value { text-align:center; flex:none; width:132px; padding-left:18px; border-left:1px solid rgba(255,255,255,.08); }
  .ppm3-value-label { display:block; color:var(--muted); font:700 8px/1 "IBM Plex Mono",monospace; letter-spacing:.08em; text-transform:uppercase; }
  .ppm3-value strong { display:block; margin:3px 0 6px; color:var(--l); font:800 18px/1 "Barlow Condensed",sans-serif; }
  .ppm3-value-sub { display:block; margin-top:2px; color:var(--muted); font:600 9.5px "Barlow",sans-serif; }
  .ppm3-tabs { display:flex; gap:2px; flex-wrap:wrap; border-bottom:1px solid rgba(255,255,255,.08); margin-bottom:14px; }
  .ppm3-tabs button { background:none; border:none; border-radius:6px 6px 0 0; border-bottom:2px solid transparent; color:var(--muted); font:700 11.5px "Barlow Condensed",sans-serif; letter-spacing:.05em; text-transform:uppercase; padding:9px 10px; cursor:pointer; transition:background .12s,color .12s; }
  .ppm3-tabs button:hover { color:#eef1f4; background:rgba(255,255,255,.03); }
  .ppm3-tabs button.on { color:var(--l); border-bottom-color:var(--l); background:rgba(166,255,0,.05); }
  .ppm3-body { max-height:56vh; overflow:auto; padding-right:4px; }
  .ppm3-body::-webkit-scrollbar { width:7px; }
  .ppm3-body::-webkit-scrollbar-track { background:transparent; }
  .ppm3-body::-webkit-scrollbar-thumb { background:rgba(166,255,0,.22); border-radius:8px; }
  .ppm3-body::-webkit-scrollbar-thumb:hover { background:rgba(166,255,0,.4); }
  .ppm3-sec { margin-bottom:14px; border:1px solid rgba(255,255,255,.07); background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01)); border-radius:12px; padding:14px 16px 16px; }
  .ppm3-sec > small { display:flex; align-items:center; gap:6px; color:var(--muted); font:800 9px/1 "IBM Plex Mono",monospace; letter-spacing:.1em; margin:-2px 0 12px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,.06); }
  .ppm3-sec-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:-2px 0 12px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,.06); }
  .ppm3-sec-head > small { margin:0; padding-bottom:0; border-bottom:none; flex:1 1 auto; }
  .ppm3-season-pick { flex:none; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.12); border-radius:6px; color:#cfd4da; font:700 10px "IBM Plex Mono",monospace; padding:4px 8px; cursor:pointer; }
  .ppm3-season-pick:hover { border-color:rgba(255,255,255,.24); }
  .ppm3-season-pick:focus { outline:none; border-color:var(--l); }
  .ppm3-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px 10px; }
  .ppm3-grid--4 { grid-template-columns:repeat(4,1fr); }
  .ppm3-grid--3 { grid-template-columns:repeat(3,1fr); }
  .ppm3-grid > div span { display:block; color:var(--muted); font:700 8px/1.2 "IBM Plex Mono",monospace; letter-spacing:.05em; }
  .ppm3-grid > div b { display:block; margin-top:5px; color:#fff; font:800 15px/1 "Barlow Condensed",sans-serif; }
  .ppm3-row2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .ppm3-row3 { display:grid; grid-template-columns:1.7fr 1fr 1fr; gap:12px; }
  .ppm3-sec--wide { min-width:0; }
  @media(max-width:820px){ .ppm3-row2, .ppm3-row3 { grid-template-columns:1fr 1fr; } }
  .ppm3-table-wrap { overflow-x:auto; }
  .ppm3-table { width:100%; border-collapse:collapse; }
  .ppm3-table th { text-align:left; padding:6px 8px; color:var(--muted); font:700 8.5px/1 "Barlow",sans-serif; letter-spacing:.06em; text-transform:uppercase; border-bottom:1px solid rgba(255,255,255,.09); white-space:nowrap; }
  .ppm3-table th.num, .ppm3-table td.num { text-align:center; }
  .ppm3-table td { padding:7px 8px; border-bottom:1px solid rgba(255,255,255,.05); color:#cfd4da; font:500 11.5px "Barlow",sans-serif; white-space:nowrap; }
  .ppm3-table tbody tr:not(.ppm3-total):hover { background:rgba(255,255,255,.025); }
  .ppm3-table tr.ppm3-total td { font-weight:800; color:#fff; border-top:1px solid rgba(166,255,0,.25); background:rgba(166,255,0,.05); }
  .ppm3-pill { display:inline-block; padding:1px 6px; border-radius:4px; background:rgba(166,255,0,.12); color:var(--l); font-weight:800; }
  .ppm3-comp { display:flex; align-items:center; gap:8px; }
  .ppm3-comp-logo { width:16px; height:16px; object-fit:contain; flex:none; }
  .ppm3-status { display:inline-block; padding:2px 8px; border-radius:20px; font:800 10.5px "Barlow Condensed",sans-serif; letter-spacing:.02em; font-style:normal; }
  .ppm3-status--good { background:rgba(166,255,0,.14); color:var(--l); }
  .ppm3-status--bad { background:rgba(255,138,107,.14); color:#ff8a6b; }
  .ppm3-status--warn { background:rgba(255,190,90,.14); color:#ffbe5a; }
  .ppm3-status--dim { background:rgba(255,255,255,.06); color:var(--muted); }
  .ppm3-empty { padding:14px 0; color:var(--muted); font:500 11.5px "Barlow",sans-serif; text-align:center; }
  .ppm3-foot { display:flex; align-items:center; gap:5px; margin:8px 0 0; color:#6f757e; font:500 10px/1.3 "Barlow",sans-serif; }
  .ppm3-key-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
  .ppm3-key-grid > div { min-width:0; }
  .ppm3-key-grid span { display:block; color:var(--muted); font:700 8px/1.2 "IBM Plex Mono",monospace; letter-spacing:.03em; }
  .ppm3-key-grid b { display:block; margin-top:4px; color:#fff; font:800 16px/1 "Barlow Condensed",sans-serif; }
  .ppm3-key-grid em { display:block; margin-top:2px; color:var(--l); font:700 9px "IBM Plex Mono",monospace; font-style:normal; }
  .ppm3-sparkline { display:flex; gap:8px; align-items:flex-end; padding:4px 0 10px; }
  .ppm3-sparkline--lg { gap:12px; padding:8px 0 16px; }
  .ppm3-spark-col { display:flex; flex-direction:column; align-items:center; gap:5px; flex:1; }
  .ppm3-spark-col img { width:18px; height:18px; object-fit:contain; }
  .ppm3-spark-col em { font:600 8px "Barlow",sans-serif; color:var(--muted); font-style:normal; text-align:center; max-width:56px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ppm3-spark-dot { width:6px; height:6px; border-radius:50%; background:var(--muted); }
  .ppm3-spark-col b { font:800 11px "Barlow Condensed",sans-serif; color:#cfd4da; }
  .ppm3-spark-col b.hi { color:var(--l); } .ppm3-spark-col b.lo { color:#ff8a6b; }
  .ppm3-spark-col--intl { position:relative; }
  .ppm3-spark-col--intl::before { content:"INTL"; display:block; margin-bottom:3px; color:#7dd3fc; font:800 6.5px "IBM Plex Mono",monospace; letter-spacing:.06em; }
  .ppm3-intl-tag { margin-left:6px; padding:1px 5px; border-radius:3px; background:rgba(125,211,252,.14); color:#7dd3fc; font:800 8px "IBM Plex Mono",monospace; font-style:normal; }
  .ppm3-avail { list-style:none; margin:0; padding:0; display:grid; gap:8px; }
  .ppm3-avail li { display:flex; align-items:center; justify-content:space-between; }
  .ppm3-avail span { color:var(--muted); font:600 10.5px "Barlow",sans-serif; }
  .ppm3-avail b { color:#eef1f4; font:800 12px "Barlow Condensed",sans-serif; }
  .ppm3-avail b.warn { color:#ff8a6b; }
  .ppm3-similar { display:grid; gap:6px; }
  .ppm3-similar button { display:flex; align-items:center; gap:8px; width:100%; background:none; border:1px solid transparent; border-radius:8px; padding:4px 6px; cursor:pointer; text-align:left; transition:background .12s,border-color .12s; }
  .ppm3-similar button:hover { background:rgba(255,255,255,.03); border-color:rgba(255,255,255,.08); }
  .ppm3-similar button img { width:24px; height:24px; border-radius:50%; object-fit:cover; object-position:top; flex:none; border:1px solid rgba(255,255,255,.12); }
  .ppm3-similar button span { flex:none; width:76px; color:#cfd4da; font:600 10.5px "Barlow",sans-serif; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ppm3-simbar { flex:1; height:5px; border-radius:3px; background:rgba(255,255,255,.08); overflow:hidden; }
  .ppm3-simbar i { display:block; height:100%; background:var(--l); }
  .ppm3-similar button em, .ppm3-similar-row > em { flex:none; width:34px; text-align:right; color:var(--l); font:800 10px "IBM Plex Mono",monospace; font-style:normal; }
  .ppm3-similar--lg { gap:10px; }
  .ppm3-similar-row { display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid rgba(255,255,255,.08); border-radius:9px; flex-wrap:nowrap; }
  .ppm3-similar-row img { width:34px; height:34px; border-radius:50%; object-fit:cover; object-position:top; border:1px solid rgba(255,255,255,.12); flex:0 0 34px; }
  .ppm3-similar-row .ri { flex:1 1 0%; min-width:60px; max-width:100%; overflow:hidden; }
  .ppm3-similar-row .ri strong { display:block; color:#eef1f4; font:700 12.5px "Barlow",sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ppm3-similar-row .ri span { display:block; color:var(--muted); font:500 10px "Barlow",sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ppm3-similar-row .ppm3-simbar { flex:0 0 70px; width:70px; }
  .ppm3-similar-row > em { flex:0 0 34px; }
  .ppm3-similar-row > button { flex:0 0 auto; }
  @media(max-width:700px){ .ppm3-similar-row .ppm3-simbar { display:none; } }
  .ppm3-bars { display:grid; gap:10px; }
  .ppm3-bar-row { display:grid; grid-template-columns:120px 1fr 60px 44px; align-items:center; gap:10px; }
  .ppm3-bar-row span { color:var(--muted); font:600 11px "Barlow",sans-serif; }
  .ppm3-bar { height:7px; border-radius:4px; background:rgba(255,255,255,.08); overflow:hidden; }
  .ppm3-bar i { display:block; height:100%; background:var(--l); }
  .ppm3-bar-row b { color:#eef1f4; font:800 12px "Barlow Condensed",sans-serif; text-align:right; }
  .ppm3-bar-row em { color:var(--l); font:700 10px "IBM Plex Mono",monospace; font-style:normal; text-align:right; }
  .ppm3-scout-lede { color:#d8dde2; font:500 13px/1.5 "Barlow",sans-serif; margin:0 0 14px; }
  .ppm3-scout-row { display:flex; justify-content:space-between; padding:7px 0; border-bottom:1px solid rgba(255,255,255,.06); font:600 11.5px "Barlow",sans-serif; color:#cfd4da; }
  .ppm3-scout-row b { color:var(--l); }
  .ppm3-actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:6px; padding-top:14px; border-top:1px solid rgba(255,255,255,.08); }
  .ppm3-note { margin:10px 0 0; color:#6f757e; font:500 10.5px/1.4 "Barlow",sans-serif; }
  @media(max-width:760px){ .ppm3-grid, .ppm3-grid--4, .ppm3-key-grid { grid-template-columns:repeat(2,1fr); } .ppm3-row3 { grid-template-columns:1fr; } .ppm3-row2 { grid-template-columns:1fr; } }
`;
// Renders its children through a portal straight to document.body, fixed-
// positioned from the anchor's live screen coordinates. Needed because
// .plp2-search and the filter <select> elements both use backdrop-filter,
// which creates its own CSS stacking context — a known browser gotcha where
// an absolutely-positioned dropdown child gets trapped/misordered behind
// other blurred siblings regardless of z-index. Escaping to a portal
// sidesteps the whole stacking-context problem rather than fighting it.
function PortalDropdown({ anchorRef, open, children }) {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    if (!open || !anchorRef.current) { setRect(null); return undefined; }
    const update = () => setRect(anchorRef.current.getBoundingClientRect());
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef]);
  if (!open || !rect) return null;
  return createPortal(
    <div className="plp2-dropdown" style={{ position: 'fixed', left: rect.left, top: rect.bottom + 4, width: rect.width, zIndex: 9999 }}>
      {children}
    </div>,
    document.body
  );
}
// Real per-90 rate — same convention as the System Fit / Players profile
// cards: raw counting stats are only comparable per-90, since a 20-appearance
// starter and a 5-appearance sub otherwise look directly comparable when
// they aren't.
function cmpPer90(raw, minutes) {
  const n = Number(raw), m = Number(minutes);
  if (!Number.isFinite(n) || !(m > 0)) return null;
  return (n / m) * 90;
}
function cmpFmt(v, dp = 0) {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
  return dp ? Number(v).toFixed(dp) : String(Math.round(Number(v)));
}
// Row definitions for the comparison table. `dir` controls which side gets
// the winner highlight: 'higher' (most stats), 'lower' (cards — fewer is
// better), or 'neutral' (context stats like minutes/games where more isn't
// inherently better, just a bigger sample).
function compareRows(p) {
  const m = Number(p.minutes) || 0;
  return {
    'SEASON SCORE': { v: p.rating, dir: 'higher' },
    'CALIBRE': { v: p.ability_rating, dir: 'higher' },
    'SELECTION': { v: p.availability_score, dir: 'higher' },
    'GOALS': { v: p.goals, dir: 'higher' },
    'ASSISTS': { v: p.assists, dir: 'higher' },
    'GAMES PLAYED': { v: p.appearances, dir: 'neutral' },
    'MINUTES': { v: p.minutes, dir: 'neutral' },
    'xG / 90': { v: p.xg_per_90 ?? p.xg_per90 ?? p.xgPer90 ?? p.xg, dir: 'higher', dp: 2 },
    'KEY PASSES / 90': { v: cmpPer90(p.key_passes, m), dir: 'higher', dp: 2 },
    'SHOTS / 90': { v: cmpPer90(p.shots ?? p.total_shots, m), dir: 'higher', dp: 2 },
    'DRIBBLES / 90': { v: cmpPer90(p.dribbles_success ?? p.successful_dribbles, m), dir: 'higher', dp: 2 },
    'DUELS WON / 90': { v: cmpPer90(p.duels_won, m), dir: 'higher', dp: 2 },
    'TACKLES / 90': { v: cmpPer90(p.tackles, m), dir: 'higher', dp: 2 },
    'INTERCEPTIONS / 90': { v: cmpPer90(p.interceptions, m), dir: 'higher', dp: 2 },
    'PASS ACC %': { v: p.pass_accuracy, dir: 'higher' },
    'YELLOW CARDS': { v: p.yellow_cards, dir: 'lower' },
    'RED CARDS': { v: p.red_cards, dir: 'lower' },
  };
}
function CompareModal({players,onClose}){
  if(players.length<2) return null;
  const [a, b] = players;
  const rowsA = compareRows(a), rowsB = compareRows(b);
  const labels = Object.keys(rowsA);

  return (
    <div className="player-profile-modal" role="presentation" onMouseDown={onClose}>
      <section className="player-profile-modal__dialog player-compare-modal__dialog" onMouseDown={event=>event.stopPropagation()}>
        <button type="button" className="player-profile-modal__close" onClick={onClose}><X size={16}/></button>
        <div className="player-profile-modal__kicker"><GitCompareArrows size={12}/> Calibre comparison workspace</div>
        <h2>{players[0].name} <em>vs</em> {players[1].name}</h2>

        <div className="player-compare-modal__grid">
          {players.slice(0,2).map(player=>
            <article key={player.id||player.name}>
              <ApiPlayerImage playerId={apiIdFor(player)} name={player.name} preferredSrc={portraitFor(player)} fallbackSrc={fallbackFor(player)} alt={player.name}/>
              <strong>{player.name}</strong>
              <span>{player.team||player.club||player.position||'Live API profile'}</span>
              <button type="button" className="btn btn--outline btn--sm" style={{marginTop:8}} onClick={() => navigateTo(`/system-fit?player=${encodeURIComponent(player.name)}`)}>Run System Fit <ArrowRight size={12} /></button>
            </article>
          )}
        </div>

        <div className="pcmp-table">
          <div className="pcmp-row pcmp-row--head">
            <span>{a.name}</span>
            <span></span>
            <span>{b.name}</span>
          </div>
          {labels.map(label => {
            const ra = rowsA[label], rb = rowsB[label];
            const va = Number(ra.v), vb = Number(rb.v);
            const bothKnown = Number.isFinite(va) && Number.isFinite(vb);
            let winA = false, winB = false;
            if (bothKnown && ra.dir !== 'neutral' && va !== vb) {
              const aWins = ra.dir === 'higher' ? va > vb : va < vb;
              winA = aWins; winB = !aWins;
            }
            return (
              <div className="pcmp-row" key={label}>
                <span className={winA ? 'pcmp-win' : ''}>{cmpFmt(ra.v, ra.dp)}</span>
                <small>{label}</small>
                <span className={winB ? 'pcmp-win' : ''}>{cmpFmt(rb.v, rb.dp)}</span>
              </div>
            );
          })}
        </div>

        <p className="player-profile-modal__note">Live comparison from each player's Calibre profile — Season Score/Calibre/Selection plus per-90 output. Highlighted values mark the stronger side per row (cards: fewer is better). Blanks mean that stat hasn't synced for this player yet.</p>
        <style>{`
          .pcmp-table { margin-top:16px; border:1px solid rgba(255,255,255,.08); border-radius:10px; overflow:hidden; }
          .pcmp-row { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:10px; padding:8px 12px; border-bottom:1px solid rgba(255,255,255,.06); }
          .pcmp-row:last-child { border-bottom:none; }
          .pcmp-row--head { background:rgba(255,255,255,.03); }
          .pcmp-row--head span { font:800 11px "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; color:#eef1f4; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          .pcmp-row span { font:700 13px "IBM Plex Mono",monospace; color:#c4c9ce; text-align:center; }
          .pcmp-row small { font:700 9px "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; color:#8d929b; text-align:center; }
          .pcmp-win { color:var(--lime,#a6ff00); font-weight:800; }
        `}</style>
      </section>
    </div>
  );
}

function WatchlistModal({ items, onOpen, onRemove, onClose }) {
  return (
    <div role="presentation" onMouseDown={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
      <section onMouseDown={e=>e.stopPropagation()} style={{ position:'relative', width:'100%', maxWidth:520, maxHeight:'82vh', overflowY:'auto', background:'#0a0a0c', border:'1px solid #1c1c1c', borderRadius:14, padding:'24px 22px' }}>
        <button type="button" onClick={onClose} aria-label="Close watchlist" style={{ position:'absolute', top:14, right:14, background:'none', border:'none', color:'#888', cursor:'pointer' }}><X size={18} /></button>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, color:'#a6ff00', fontSize:12, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase' }}><Star size={14} /> Your watchlist</div>
        <h3 style={{ fontFamily:"'Barlow Condensed', sans-serif", fontSize:26, fontWeight:800, margin:'0 0 14px', textTransform:'uppercase', color:'#fff' }}>{items.length} player{items.length === 1 ? '' : 's'} saved</h3>
        {items.length ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {items.map(pl => (
              <div key={pl.apiPlayerId} style={{ display:'flex', alignItems:'center', gap:10, background:'#0c0c0e', border:'1px solid #1c1c1c', borderRadius:8, padding:'10px 12px' }}>
                <button type="button" onClick={()=>onOpen({ id: pl.apiPlayerId, apiPlayerId: pl.apiPlayerId, name: pl.name })} style={{ flex:1, display:'flex', alignItems:'center', gap:12, background:'none', border:'none', color:'#eee', cursor:'pointer', textAlign:'left', minWidth:0 }}>
                  <ApiPlayerImage playerId={pl.apiPlayerId} name={pl.name} preferredSrc={pl.img} fallbackSrc="/assets/players/neutral-player.svg" alt="" />
                  <span style={{ display:'flex', flexDirection:'column', minWidth:0 }}><strong style={{ fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pl.name}</strong><small style={{ color:'#888' }}>{[pl.position, pl.team].filter(Boolean).join(' \u00b7 ') || '\u2014'}</small></span>
                  {pl.rating != null && <span style={{ marginLeft:'auto', fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, color:'#a6ff00' }}>{Math.round(pl.rating)}</span>}
                </button>
                <button type="button" onClick={()=>onRemove(pl.apiPlayerId)} aria-label={`Remove ${pl.name}`} style={{ background:'none', border:'none', color:'#666', cursor:'pointer', padding:4, flexShrink:0 }}><X size={15} /></button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color:'#888', lineHeight:1.6 }}>No players saved yet. Open any player profile and tap <b style={{ color:'#a6ff00' }}>Watch</b> to add them here.</p>
        )}
      </section>
    </div>
  );
}

function posChips(p) {
  return String(p.pos || p.position || '').split(/[\/,]/).map(t => t.trim()).filter(Boolean).slice(0, 2);
}
// Specific position abbreviation (ST/CAM/LW/CDM/CB/GK etc), not a broad
// bucket like "FWD"/"MID" — prefers the granular `pos` field, falls back to
// `position` only if that's all that's available. Named distinctly from the
// pre-existing specificPosition(a,b) helper above (used in player
// normalization/merging) so the two never collide — they had the same name
// briefly and the merge logic at lines ~141/214/215 was silently broken by it.
function cardPosition(p) {
  return p.pos || p.position || '—';
}
// Which stat set to show below the crest. CAM/AM group with forwards per
// spec ("forwards and AM"); everything else midfield-shaped goes to the
// pass%/duels set.
function positionBucket(p) {
  const pos = String(p.pos || p.position || '').toUpperCase();
  if (/^GK/.test(pos)) return 'GK';
  if (/^(CB|LB|RB|WB|LWB|RWB|DF|DEF|SW)/.test(pos)) return 'DEF';
  if (/^(ST|CF|SS|LW|RW|CAM|AM|FWD|ATT)/.test(pos)) return 'FWD';
  if (/^(CM|CDM|DM|RM|LM|MF|MID)/.test(pos)) return 'MID';
  return 'MID';
}
function statVal(v) { return (v == null || v === '') ? '—' : v; }
function bucketStats(p) {
  const bucket = positionBucket(p);
  if (bucket === 'GK') return [
    ['Games', statVal(p.appearances)], ['Min', statVal(p.minutes)],
    ['Shots Stopped', statVal(p.shots_saved ?? p.saves)], ['Saves', statVal(p.saves)], ['Pass %', statVal(p.pass_accuracy)],
  ];
  if (bucket === 'DEF') return [
    ['Games', statVal(p.appearances)], ['Min', statVal(p.minutes)],
    ['Duels', statVal(p.duels_won)], ['Interceptions', statVal(p.interceptions)],
  ];
  if (bucket === 'MID') return [
    ['Pass %', statVal(p.pass_accuracy)], ['Duels', statVal(p.duels_won)],
    ['Games', statVal(p.appearances)], ['Min', statVal(p.minutes)],
  ];
  return [
    ['Games', statVal(p.appearances)], ['Min', statVal(p.minutes)],
    ['Goals', statVal(p.goals)], ['Assists', statVal(p.assists)],
  ];
}
// The youth-style card (same layout as Talents' discovery-pool cards): portrait
// + club crest on the left, name/role/archetype/club in the middle, Calibre
// rating on the right. Adopted here so Featured Players matches Talents
// instead of the separate System Fit-styled card (which stays as its own
// thing, untouched, on the System Fit page).
function FeaturedCard({ player, onOpen, watched, onToggleWatch }) {
  const arch = player.archetype || player.role;
  const teamId = player.apiTeamId ?? player.api_team_id ?? player.teamId ?? null;
  const crest = player.logo || player.crestUrl || (teamId ? teamLogoUrl(teamId) : undefined);
  const rating = player.provisional ? 'LIVE' : displayRating(player.rating);
  const shirtNumber = player.shirt_number ?? player.shirtNumber ?? player.number ?? null;
  const stats = bucketStats(player);
  return (
    <article className="plp2-yc" onClick={() => onOpen(player)}>
      <div className="plp2-yc-top">
        <div className="plp2-yc-media">
          <div className="plp2-yc-img"><ApiPlayerImage playerId={apiIdFor(player)} name={player.name} preferredSrc={portraitFor(player)} fallbackSrc={fallbackFor(player)} alt={player.name} loading="lazy" /></div>
          <div className="plp2-yc-crest"><ApiTeamLogo src={crest} name={player.club || player.team || player.name} /></div>
        </div>
        <div className="plp2-yc-body">
          <strong>{player.name}</strong>
          <div className="plp2-yc-meta">{[player.age ? `${player.age} yrs` : null, player.nationality || null].filter(Boolean).join(' · ') || '—'}</div>
          <div className="plp2-yc-role">
            <em>{cardPosition(player)}</em>
            {shirtNumber != null && <span className="plp2-yc-no">No. {shirtNumber}</span>}
          </div>
          {arch && <div className="plp2-yc-arch">{arch}</div>}
          <div className="plp2-yc-foot">{[player.club || player.team, player.league].filter(Boolean).join(' · ') || '—'}</div>
        </div>
        <div className="plp2-yc-side">
          <button type="button" className={`plp2-yc-star${watched ? ' on' : ''}`} onClick={e => { e.stopPropagation(); onToggleWatch(player); }} aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}>
            {watched ? <Star size={15} fill="currentColor" /> : <Star size={15} />}
          </button>
          <div className="plp2-yc-rating"><b>{rating}</b><span>Calibre</span></div>
        </div>
      </div>

      <div className={`plp2-yc-stats plp2-yc-stats--${stats.length}`}>
        {stats.map(([label, val]) => <div key={label}><b>{val}</b><span>{label}</span></div>)}
      </div>

      <button type="button" className="plp2-yc-more" onClick={e => { e.stopPropagation(); onOpen(player); }}>
        View Full Profile <ArrowRight size={12} />
      </button>
    </article>
  );
}

export default function Players(){
  const [rankTab,setRankTab] = useState('Calibre Rating');
  const [search,setSearch] = useState('');
  const [liveRows,setLiveRows] = useState([]);
  const [browseRows,setBrowseRows] = useState([]);
  const [searching,setSearching] = useState(false);
  const [searchError,setSearchError] = useState('');
  const [clubQuery,setClubQuery] = useState('');
  const [clubMatches,setClubMatches] = useState([]);
  const [clubSearching,setClubSearching] = useState(false);
  const playerSearchRef = useRef(null);
  const clubSearchRef = useRef(null);
  const [activePlayer,setActivePlayer] = useState(null);
  const [activeStats,setActiveStats] = useState(null);
  const { user } = useAuth();
  const tier = resolveTier(user?.email);
  const canWatch = can(tier, 'watchlist');
  const [watchlist,setWatchlist] = useState(()=>getWatchlist());
  const [watchlistOpen,setWatchlistOpen] = useState(false);
  useEffect(()=>{ const sync=()=>setWatchlist(getWatchlist()); window.addEventListener(WATCHLIST_EVENT,sync); return ()=>window.removeEventListener(WATCHLIST_EVENT,sync); },[]);
  // Bind the logged-in user so watchlist changes persist to their account, and
  // merge any anonymous local picks up on login.
  useEffect(()=>{ bindWatchlistUser(user); if(user?.id){ mergeLocalIntoAccount(user).catch(()=>{}); } },[user?.id]);
  const handleToggleWatch=(pl)=>{ if(!canWatch){ navigateTo('/pricing'); return; } toggleWatch(pl); };
  const [profileLoading,setProfileLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const playerId = Number(params.get('playerId'));
    const playerName = params.get('player');

    if (!Number.isFinite(playerId) || !playerId || !playerName) return;

    openProfile({
      id: playerId,
      apiPlayerId: playerId,
      name: playerName,
    });
  }, []);
  const [comparePlayers,setComparePlayers] = useState([]);
  const [compareOpen,setCompareOpen] = useState(false);
  const [notice,setNotice] = useState('');
  const [supabaseRows,setSupabaseRows] = useState([]);
  const [supabaseTotal,setSupabaseTotal] = useState(0);
  const [nationCount,setNationCount] = useState(null);
  const [leagueCount,setLeagueCount] = useState(null);
  const [coverageSeason,setCoverageSeason] = useState(null);
  const [topPool,setTopPool] = useState([]);
  const [supabaseError,setSupabaseError] = useState('');
  const [supabaseLoading,setSupabaseLoading] = useState(true);

  const [filters,setFilters] = useState({
    position:'all',
    age:'16-40',
    league:'all',
    nation:'all',
    archetype:'all',
    rating:'all',
  });

  const landingPlayers = useMemo(
    ()=>mergeCuratedWithSupabase(CURATED_PLAYERS,supabaseRows),
    [supabaseRows]
  );

  const hasLiveQuery = search.trim().length>=3;

  useEffect(()=>{
    let active = true;

    // Resolve by api_player_id, NOT by exact name string. getSupabasePlayers'
    // name filter requires a byte-for-byte match against the DB's stored name — e.g. curated 'Phil Foden' vs DB 'Philip Walter Foden' silently
    // fails, so the merge falls back to the bare curated stub with no
    // apiTeamId/nationality at all, breaking the crest and Nationality field.
    // Every curated entry already carries a real apiPlayerId, so id lookup
    // via getSupabasePlayersByApiIds is the reliable path.
    Promise.all([
      getSupabasePlayersByApiIds(CURATED_PLAYERS.map(player=>player.apiPlayerId).filter(Boolean)),
      getSupabasePlayerCount(),
    ])
      .then(([rows,total])=>{
        if(active){
          setSupabaseRows(rows);
          setSupabaseTotal(total);
          setSupabaseError('');
        }
      })
      .catch(error=>{
        if(active){
          setSupabaseError(error?.message || 'Supabase player-bank read failed');
        }
      })
      .finally(()=>{
        if(active){
          setSupabaseLoading(false);
        }
      });

    return ()=>{
      active = false;
    };
  },[]);

  // Separate, non-blocking: these read more rows than the main fetch above,
  // so they shouldn't delay featured players from showing.
  useEffect(()=>{
    let active = true;
    getSupabaseNationCount()
      .then(n => { if(active) setNationCount(n); })
      .catch(() => { /* stat card falls back to a loading dash, never a guess */ });
    getSupabaseLeagueCount()
      .then(n => { if(active) setLeagueCount(n); })
      .catch(() => { /* falls back to the curated filter count below */ });
    getSupabaseCoverageSeason()
      .then(s => { if(active) setCoverageSeason(s); })
      .catch(() => { /* falls back to the date-computed CURRENT_SEASON below */ });
    // Real, larger pool for Featured Players to rotate through — see
    // featuredList below. Falls back to the small hardcoded CURATED_PLAYERS
    // shortlist if this never loads.
    getSupabaseTopPlayers({limit:80})
      .then(rows => { if(active) setTopPool(rows); })
      .catch(() => { /* featuredList below falls back to the curated list */ });
    return () => { active = false; };
  },[]);

  useEffect(()=>{
    const query = search.trim();

    if(query.length<3){
      setLiveRows([]);
      setSearching(false);
      setSearchError('');
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async()=>{
      setSearching(true);
      setSearchError('');

      try{
        const bankRows = await searchSupabasePlayers(query,{limit:20});

        if(bankRows.length){
          if(!cancelled) setLiveRows(bankRows);
        }else{
          const apiRows = await searchPlayerProfiles(query,{skipCache:true,ttl:5*60*1000});
          if(!cancelled) setLiveRows(apiRows.slice(0,20));
        }
      }catch{
        if(!cancelled) setSearchError('Player-bank search could not load. Try again.');
      }finally{
        if(!cancelled) setSearching(false);
      }
    },350);

    return ()=>{
      cancelled = true;
      clearTimeout(timer);
    };
  },[search]);

  useEffect(()=>{
    const query = clubQuery.trim();
    if(query.length<2){
      setClubMatches([]);
      setClubSearching(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async()=>{
      setClubSearching(true);
      try{
        const clubs = await searchSupabaseClubs(query,{limit:8});
        if(!cancelled) setClubMatches(clubs);
      }catch{
        if(!cancelled) setClubMatches([]);
      }finally{
        if(!cancelled) setClubSearching(false);
      }
    },350);
    return ()=>{ cancelled = true; clearTimeout(timer); };
  },[clubQuery]);

  async function pickClub(clubName){
    setClubQuery('');
    setClubMatches([]);
    setSearching(true);
    try{
      const rows = await getSupabasePlayersByClub(clubName,{limit:100});
      setBrowseRows(rows);
      setNotice(`Showing ${rows.length} player${rows.length===1?'':'s'} from ${clubName}.`);
    }catch{
      setNotice(`Could not load ${clubName}'s roster. Try again.`);
    }finally{
      setSearching(false);
    }
  }

  async function applyFilters(){
    setSearching(true);
    setNotice('');

    try{
      if(filters.league!=='all'){
        const leagueId = Number(filters.league);
        const bankRows = await getSupabasePlayers({leagueId,limit:PLAYER_TABLE_LIMIT});

        if(bankRows.length){
          setBrowseRows(bankRows);
          setNotice(`Showing ${bankRows.length} players from the Calibre bank. Use search to find a specific player.`);
        }else{
          const apiRows = await getLeaguePlayers(leagueId,CURRENT_SEASON,1);
          setBrowseRows(apiRows.slice(0,PLAYER_TABLE_LIMIT));
          setNotice(`Showing ${Math.min(apiRows.length,PLAYER_TABLE_LIMIT)} live league profiles.`);
        }
      }else{
        setBrowseRows([]);
        setNotice('Choose a league to browse a limited player sample, or type a player name to search the Calibre bank.');
      }
    }catch{
      setNotice('League browse could not load.');
    }finally{
      setSearching(false);
    }
  }

  const sourceRows = hasLiveQuery
    ? liveRows
    : browseRows.length
      ? browseRows
      : landingPlayers.map(localToProfile);

  const tableRows = useMemo(
    ()=>sourceRows.filter(p=>{
      // Global search profiles often arrive without position/nationality. Match
      // the lenient age behaviour: only exclude on a field the row actually has,
      // so a name search surfaces its hits instead of being filtered to zero.
      const posVal = p.position || p.pos || '';
      const posOk = !posVal || posMatches(posVal,filters.position);
      const natOk = filters.nation==='all' || !p.nationality || String(p.nationality).toLowerCase().includes(filters.nation);
      const archOk = filters.archetype==='all' || foldAccents(p.archetype)===foldAccents(filters.archetype);
      const ratingOk = filters.rating==='all' || (Number.isFinite(Number(p.rating)) && Number(p.rating)>=Number(filters.rating));
      return ageInRange(p.age,filters.age) && posOk && natOk && archOk && ratingOk;
    }).slice(0,PLAYER_TABLE_LIMIT),
    [sourceRows,filters]
  );

  const ranked = useMemo(
    ()=>sortCurated(landingPlayers,rankTab).slice(0,5),
    [landingPlayers,rankTab]
  );

  // Rising sidebar reads the SAME enriched DB rows as Home's radar and the main
  // list, so a player shows one rating everywhere instead of flickering between
  // the hardcoded anchor and the live number.
  const [risingRows, setRisingRows] = useState(RISING_ANCHORS);
  useEffect(()=>{
    let alive = true;
    const ids = RISING_ANCHORS.map(a=>Number(a.apiPlayerId)).filter(Boolean);
    getSupabasePlayersByApiIds(ids)
      .then(db=>{
        if(!alive || !Array.isArray(db) || !db.length) return;
        const byId = new Map();
        for(const p of db){
          const id = Number(p.api_player_id);
          if(Number.isInteger(id) && id>0 && !byId.has(id)) byId.set(id,p);
        }
        const merged = RISING_ANCHORS.map(a=>{
          const hit = byId.get(Number(a.apiPlayerId));
          if(!hit) return a;
          const clean = Object.fromEntries(Object.entries(hit).filter(([,v])=>v!=null && v!==''));
          return { ...a, ...clean };
        });
        setRisingRows(merged);
      })
      .catch(()=>{});
    return ()=>{ alive=false; };
  }, []);

  const risingComputed = useMemo(
    ()=>risingRows.map(a=>{
      const r = resolveRating(a);
      return { ...a, rating:r.rating, bucket:r.bucket, metrics:deriveMetrics(a,r.bucket) };
    }).sort((a,b)=>b.rating-a.rating),
    [risingRows]
  );

  async function openProfile(player){
    setActivePlayer(player);
    setActiveStats(null);

    const apiId = apiIdFor(player);

    if(!apiId) return;

    setProfileLoading(true);
    let nationality = player?.nationality || null;

    // Reconcile against the enriched DB row for bio + performance stats, but
    // — same pattern as System Fit's pop-up — let curated identity fields
    // (rating, archetype, position) win when the card that opened this
    // pop-up already carried them. The players table has its own live-computed
    // rating/archetype columns which can legitimately disagree with the
    // curated Featured Players values (e.g. Haaland: curated 90/Poacher vs a
    // partial-data live compute of 80/Inside Forward) — without this, the
    // pop-up contradicts the very card the person clicked.
    try {
      const dbRows = await getSupabasePlayersByApiIds([apiId]);
      const db = dbRows && dbRows[0];
      if (db) {
        nationality = db.nationality || nationality;
        const scored = resolveRating(db);
        setActivePlayer(prev => ({
          ...db,
          ...prev,
          name: (prev && prev.name) || db.full_name || db.name,
          apiPlayerId: apiId,
          id: (prev && prev.id) ?? db.id ?? apiId,
          age: db.age ?? (prev && prev.age) ?? null,
          position: (prev && (prev.position || prev.pos)) || db.position || db.pos || '',
          pos: (prev && (prev.pos || prev.position)) || db.pos || db.position || '',
          rating: (prev && prev.rating != null) ? prev.rating : ((scored && scored.rating != null) ? scored.rating : (db.rating ?? null)),
          // Calibre/Selection aren't curated per-card the way rating is — always
          // trust the freshly-resolved DB values here, otherwise a `prev` object
          // from a search row/featured card that carries a stale or null
          // ability_rating/availability_score silently wins the spread above and
          // the profile pop-up shows blank Calibre/Selection (same class of bug
          // already fixed on System Fit's card).
          ability_rating: (scored && scored.ability != null) ? scored.ability : (db.ability_rating ?? (prev && prev.ability_rating) ?? null),
          availability_score: (scored && scored.availability != null) ? scored.availability : (db.availability_score ?? (prev && prev.availability_score) ?? null),
          archetype: (prev && prev.archetype) || db.archetype || null,
          league_id: db.league_id ?? (prev && prev.league_id) ?? null,
        }));
      }
    } catch { /* keep the original record if the lookup fails */ }

    try {
      const prof = await getPlayerProfile(apiId);
      if (prof) {
        setActivePlayer(prev => ({
          ...prev,
          height: prof.height || prev?.height || null,
          weight: prof.weight || prev?.weight || null,
          nationality: prev?.nationality || prof.nationality || null,
          image: prev?.image || prof.image || null,
        }));
        nationality = nationality || prof.nationality || null;
      }
    } catch { /* keep DB bio if the profile lookup fails */ }

    try{
      let nationalTeamId = null;
      try { nationalTeamId = await getNationalTeamId(nationality); } catch { /* club-evidence check just degrades to "any evidence" below */ }
      setActiveStats(await getPlayerStatsWithFallback(apiId, undefined, nationalTeamId));
    }finally{
      setProfileLoading(false);
    }
  }

  function addToCompare(player){
    setComparePlayers(current=>{
      const filtered = current.filter(item=>
        (item.id && player.id)
          ? item.id!==player.id
          : item.name!==player.name
      );

      return [...filtered,player].slice(-2);
    });

    setActivePlayer(null);
  }

  // Compare tab's "+ Compare" on a similar player: the person's clear intent
  // is "show me THIS player vs THAT one", not "silently queue one player and
  // close the pop-up" (which is what reusing addToCompare alone did — it
  // looked broken because nothing visibly happened). Load both sides and
  // open the real comparison immediately.
  function compareWithSimilar(candidate){
    if(!activePlayer) return;
    setComparePlayers([activePlayer, candidate]);
    setCompareOpen(true);
    setActivePlayer(null);
  }

  const filteredRows = useMemo(()=>sourceRows.filter(p=>{
    const posVal = p.position || p.pos || '';
    const posOk = !posVal || posMatches(posVal,filters.position);
    const natOk = filters.nation==='all' || !p.nationality || String(p.nationality).toLowerCase().includes(filters.nation);
    const archOk = filters.archetype==='all' || foldAccents(p.archetype)===foldAccents(filters.archetype);
    const ratingOk = filters.rating==='all' || (Number.isFinite(Number(p.rating)) && Number(p.rating)>=Number(filters.rating));
    return ageInRange(p.age,filters.age) && posOk && natOk && archOk && ratingOk;
  }),[sourceRows,filters]);
  const rankingRows = useMemo(()=>sortCurated(filteredRows,rankTab),[filteredRows,rankTab]);
  // Featured Players — a rotating window into a real, larger pool (top ~80
  // by ability_rating) instead of a fixed top-8-of-10 cut of a hardcoded
  // shortlist. weekIndex() existed in this file already but was never wired
  // to anything; it now picks which 8-player window shows this week, so the
  // set changes on a weekly cadence instead of being static. Falls back to
  // the curated shortlist if the live pool hasn't loaded yet (e.g. first
  // paint, or Supabase unreachable) so the section is never empty.
  const featuredList = useMemo(()=>{
    if(topPool.length>=8){
      const windows = Math.max(1,Math.floor(topPool.length/8));
      const start = weekIndex(windows)*8;
      return topPool.slice(start,start+8);
    }
    return sortCurated(landingPlayers,'Calibre Rating').slice(0,8);
  },[topPool,landingPlayers]);
  const [rankPage,setRankPage] = useState(1);
  const [pageSize,setPageSize] = useState(10);
  useEffect(()=>{ setRankPage(1); },[rankTab,filters,search,notice]);
  const rankPageCount = Math.max(1, Math.ceil(rankingRows.length / pageSize));
  const rankPageRows = rankingRows.slice((rankPage-1)*pageSize, rankPage*pageSize);
  const trendArrow = (p)=>{ const pot=Number(p.potential), rat=Number(rowRating(p)); if(!Number.isFinite(pot)||!Number.isFinite(rat)) return '—'; return pot>rat?'up':pot<rat?'down':'flat'; };
  const quickActions = [
    { key:'compare', icon:GitCompareArrows, label:'Compare Players', run:()=>{ if(comparePlayers.length>=2) setCompareOpen(true); else document.querySelector('.plp2-compare')?.scrollIntoView({behavior:'smooth'}); } },
    { key:'search', icon:Search, label:'Advanced Search', run:()=>document.querySelector('.plp2-filters')?.scrollIntoView({behavior:'smooth'}) },
    { key:'watch', icon:Star, label:'My Watchlist', run:()=>setWatchlistOpen(true) },
    { key:'top', icon:Crown, label:'Top 100 Players', run:()=>{ setRankTab('Calibre Rating'); setFilters(f=>({...f,rating:'all'})); document.querySelector('.plp2-rankings')?.scrollIntoView({behavior:'smooth'}); } },
    { key:'free', icon:Database, label:'Free Agents', run:()=>setNotice('Free-agent data connects with the transfers feed — coming soon.') },
  ];

  return (
    <div className="page players-page plp2">
      <style>{`
        .plp2 { --l:#a6ff00; --line:rgba(255,255,255,.09); --glass:rgba(9,13,16,.52); --muted:#8b9299; max-width:1500px; position:relative; isolation:isolate; }
        .plp2 * { box-sizing:border-box; }
        .plp2::before { content:""; position:fixed; inset:0; z-index:-2; background:url("/assets/debates-bg.png") center/cover no-repeat; pointer-events:none; }
        .plp2::after { content:""; position:fixed; inset:0; z-index:-1; pointer-events:none; background:radial-gradient(ellipse 90% 42% at 50% -4%,rgba(166,255,0,.07),transparent 60%),radial-gradient(ellipse 120% 90% at 50% 130%,rgba(18,42,14,.20),transparent 62%),linear-gradient(180deg,rgba(5,8,11,.14) 0%,rgba(5,8,11,.26) 45%,rgba(5,8,11,.34) 100%); }
        .plp2-hero { border:1px solid var(--line); border-radius:16px; background:var(--glass); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); padding:26px 30px; margin-bottom:14px; }
        .plp2-hero .eyebrow { color:var(--l); font:600 11px/1 "Barlow",sans-serif; letter-spacing:.16em; text-transform:uppercase; }
        .plp2-hero h1 { margin:12px 0 8px; color:#fff; font:800 46px/.95 "Barlow Condensed",sans-serif; text-transform:uppercase; letter-spacing:.01em; }
        .plp2-hero p { margin:0; color:#c3c9cf; font:500 14px "Barlow",sans-serif; }
        .plp2-stats { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin-bottom:14px; }
        @media(max-width:900px){ .plp2-stats { grid-template-columns:repeat(2,1fr); } }
        .plp2-stat { border:1px solid var(--line); border-radius:12px; background:var(--glass); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); padding:14px 16px; }
        .plp2-stat b { display:block; color:var(--l); font:800 26px/1 "Barlow Condensed",sans-serif; }
        .plp2-stat span { display:block; margin-top:6px; color:var(--muted); font:600 9.5px/1.3 "Barlow",sans-serif; letter-spacing:.08em; text-transform:uppercase; }
        .plp2-searchrow { display:flex; gap:10px; margin-bottom:10px; }
        .plp2-search { flex:1; display:flex; align-items:center; gap:9px; height:44px; padding:0 14px; border:1px solid var(--line); border-radius:11px; background:var(--glass); backdrop-filter:blur(12px); color:var(--muted); }
        .plp2-search input { flex:1; min-width:0; background:none; border:none; outline:none; color:#eef1f4; font:500 14px "Barlow",sans-serif; }
        .plp2-filters { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
        .plp2-filters select { height:38px; padding:0 12px; border:1px solid var(--line); border-radius:9px; background:var(--glass); backdrop-filter:blur(10px); color:#d8dde2; font:600 12px "Barlow",sans-serif; cursor:pointer; }
        .plp2-body { display:grid; grid-template-columns:minmax(0,1fr) 300px; gap:16px; align-items:start; }
        @media(max-width:1080px){ .plp2-body { grid-template-columns:1fr; } }
        .plp2-sec { border:1px solid var(--line); border-radius:16px; background:var(--glass); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); padding:18px; margin-bottom:14px; }
        .plp2-sec-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .plp2-sec-head h3 { margin:0; color:#fff; font:800 18px/1 "Barlow Condensed",sans-serif; letter-spacing:.02em; text-transform:uppercase; }
        .plp2-fcards { display:grid; grid-template-columns:repeat(auto-fill,minmax(228px,1fr)); gap:11px; }
        .plp2-yc { display:flex; flex-direction:column; gap:0; background:rgba(255,255,255,.02); border:1px solid var(--line); border-radius:11px; padding:12px; cursor:pointer; transition:border-color .12s,transform .12s; }
        .plp2-yc:hover { border-color:rgba(166,255,0,.35); transform:translateY(-1px); }
        .plp2-yc-top { display:flex; gap:11px; }
        .plp2-yc-media { display:flex; flex-direction:column; gap:7px; flex:none; align-items:center; }
        .plp2-yc-img { width:46px; height:46px; border-radius:8px; overflow:hidden; flex:none; background:rgba(255,255,255,.04); }
        .plp2-yc-img img { width:100%; height:100%; object-fit:cover; object-position:top center; display:block; }
        .plp2-yc-crest { width:40px; height:40px; display:flex; align-items:center; justify-content:center; }
        .plp2-yc-crest img { max-width:100%; max-height:100%; object-fit:contain; display:block; }
        .plp2-yc-crest .api-team-logo-fallback { font:800 10px "Barlow Condensed",sans-serif; color:var(--muted); letter-spacing:.03em; }
        .plp2-yc-body { min-width:0; flex:1; }
        .plp2-yc-body strong { display:block; color:#fff; font:700 13.5px/1.2 "Barlow",sans-serif; }
        .plp2-yc-meta { font-size:10.5px; color:var(--muted); margin:2px 0 4px; }
        .plp2-yc-role { display:flex; align-items:center; gap:7px; margin:0 0 5px; }
        .plp2-yc-role em { font-style:normal; font:800 10.5px "Barlow Condensed",sans-serif; letter-spacing:.05em; text-transform:uppercase; color:var(--l); border:1px solid rgba(166,255,0,.35); border-radius:5px; padding:2px 7px; }
        .plp2-yc-no { font-size:10px; color:var(--muted); font-weight:700; }
        .plp2-yc-arch { color:var(--l); font:700 11px "Barlow",sans-serif; margin-bottom:5px; }
        .plp2-yc-foot { display:flex; align-items:center; gap:6px; font-size:11px; color:#c4c9ce; }
        .plp2-yc-side { display:flex; flex-direction:column; align-items:flex-end; justify-content:space-between; flex:none; gap:6px; }
        .plp2-yc-star { background:none; border:none; color:var(--muted); cursor:pointer; padding:0; display:flex; transition:color .12s,transform .12s; }
        .plp2-yc-star:hover { color:#fff; transform:scale(1.1); }
        .plp2-yc-star.on { color:var(--l); }
        .plp2-yc-rating { text-align:right; }
        .plp2-yc-rating b { display:block; font:800 22px/1 "Barlow Condensed",sans-serif; color:var(--l); }
        .plp2-yc-rating span { display:block; font-size:8.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
        .plp2-yc-stats { display:grid; gap:6px; margin-top:11px; padding-top:11px; border-top:1px solid var(--line); }
        .plp2-yc-stats--4 { grid-template-columns:repeat(4,1fr); }
        .plp2-yc-stats--5 { grid-template-columns:repeat(5,1fr); }
        .plp2-yc-stats div { text-align:center; min-width:0; }
        .plp2-yc-stats b { display:block; font:800 15px/1 "Barlow Condensed",sans-serif; color:#fff; }
        .plp2-yc-stats span { display:block; margin-top:3px; font-size:8px; letter-spacing:.04em; text-transform:uppercase; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .plp2-yc-more { display:flex; align-items:center; justify-content:center; gap:6px; width:100%; margin-top:11px; background:none; border:1px solid var(--line); color:var(--l); font:700 10.5px "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; padding:8px; border-radius:7px; cursor:pointer; transition:border-color .12s,background .12s; }
        .plp2-yc-more:hover { border-color:var(--l); background:rgba(166,255,0,.06); }
        .plp2-rank-tabs { display:flex; gap:6px; flex-wrap:wrap; }
        .plp2-rank-tabs button { border:1px solid var(--line); background:rgba(255,255,255,.02); color:#aeb4bb; border-radius:8px; padding:7px 12px; font:700 11px "Barlow Condensed",sans-serif; letter-spacing:.04em; text-transform:uppercase; cursor:pointer; }
        .plp2-rank-tabs button.on { background:var(--l); color:#0a0d05; border-color:var(--l); }
        .plp2-table-wrap { overflow-x:auto; }
        .plp2-table { width:100%; border-collapse:collapse; }
        .plp2-table th { text-align:left; padding:8px 10px; color:var(--muted); font:700 9px/1 "Barlow",sans-serif; letter-spacing:.08em; text-transform:uppercase; border-bottom:1px solid var(--line); white-space:nowrap; }
        .plp2-table th.num, .plp2-table td.num { text-align:center; }
        .plp2-table td { padding:9px 10px; border-bottom:1px solid rgba(255,255,255,.05); color:#cfd4da; font:500 12.5px "Barlow",sans-serif; white-space:nowrap; }
        .plp2-table tbody tr { cursor:pointer; transition:background .12s; }
        .plp2-table tbody tr:hover { background:rgba(200,250,60,.05); }
        .plp2-tp { display:flex; align-items:center; gap:9px; }
        .plp2-tp-img { width:30px; height:30px; border-radius:50%; overflow:hidden; background:radial-gradient(120% 120% at 50% 0%, #eef2f5, #b3bdc6 92%); border:1px solid var(--line); flex:none; }
        .plp2-tp-img img { width:100%; height:100%; object-fit:cover; object-position:top center; }
        .plp2-tp strong { color:#f2f5f7; font-weight:700; }
        .plp2-pos { padding:2px 7px; border:1px solid var(--line); border-radius:5px; color:#b6bcc3; font:700 10px "Barlow Condensed",sans-serif; }
        .plp2-rate { color:var(--l); font:800 15px "Barlow Condensed",sans-serif; }
        .plp2-trend.up { color:var(--l); } .plp2-trend.down { color:#ff8a6b; } .plp2-trend.flat { color:#6b7480; }
        .plp2-pot { color:#e9edf1; font:700 13px "Barlow Condensed",sans-serif; }
        .plp2-pager { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:14px; flex-wrap:wrap; }
        .plp2-pages { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
        .plp2-pages button { min-width:30px; height:30px; padding:0 8px; border:1px solid var(--line); border-radius:7px; background:rgba(255,255,255,.02); color:#b6bcc3; font:700 12px "Barlow Condensed",sans-serif; cursor:pointer; }
        .plp2-pages button.on { background:var(--l); color:#0a0d05; border-color:var(--l); }
        .plp2-pages button:disabled { opacity:.4; cursor:default; }
        .plp2-pages span { color:#6b7480; padding:0 3px; }
        .plp2-pagesize { display:flex; align-items:center; gap:8px; color:var(--muted); font:600 11px "Barlow",sans-serif; }
        .plp2-pagesize select { height:30px; padding:0 8px; border:1px solid var(--line); border-radius:7px; background:rgba(255,255,255,.02); color:#d8dde2; font:600 12px "Barlow",sans-serif; cursor:pointer; }
        .plp2-rail > * { margin-bottom:14px; }
        .plp2-qa { border:1px solid var(--line); border-radius:14px; background:var(--glass); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); padding:14px; }
        .plp2-qa h4 { margin:0 0 10px; color:#e9edf1; font:800 11px/1 "Barlow Condensed",sans-serif; letter-spacing:.12em; text-transform:uppercase; }
        .plp2-qa button { display:flex; align-items:center; gap:10px; width:100%; text-align:left; padding:11px 12px; margin-bottom:7px; border:1px solid var(--line); border-radius:9px; background:rgba(255,255,255,.02); color:#d8dde2; font:600 12.5px "Barlow",sans-serif; cursor:pointer; transition:border-color .12s,color .12s; }
        .plp2-qa button:hover { border-color:rgba(200,250,60,.4); color:#fff; }
        .plp2-qa button svg { color:var(--l); flex:none; }
        .plp2-qa button:last-child { margin-bottom:0; }
        .plp2-compare, .plp2-rising { border:1px solid var(--line); border-radius:14px; background:var(--glass); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); padding:14px; }
        .plp2-side-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:11px; }
        .plp2-side-head h4 { margin:0; color:#e9edf1; font:800 11px/1 "Barlow Condensed",sans-serif; letter-spacing:.1em; text-transform:uppercase; }
        .plp2-side-head button { background:none; border:none; color:var(--l); font:700 10px "Barlow",sans-serif; text-transform:uppercase; cursor:pointer; }
        .plp2-cmp-slots { display:grid; gap:8px; margin-bottom:10px; }
        .plp2-cmp-slot { display:flex; align-items:center; gap:9px; padding:8px; border:1px solid var(--line); border-radius:9px; background:rgba(255,255,255,.02); position:relative; }
        .plp2-cmp-slot img { width:30px; height:30px; border-radius:50%; object-fit:cover; object-position:top; flex:none; border:1px solid var(--line); }
        .plp2-cmp-slot strong { color:#eef1f4; font:700 12px "Barlow",sans-serif; }
        .plp2-cmp-slot span { color:var(--muted); font:500 10px "Barlow",sans-serif; }
        .plp2-cmp-slot--empty { color:var(--muted); font:500 12px "Barlow",sans-serif; justify-content:center; }
        .plp2-cmp-x { position:absolute; right:7px; top:7px; background:none; border:none; color:var(--muted); cursor:pointer; font-size:15px; }
        .plp2-rising-row { display:flex; align-items:center; gap:9px; width:100%; text-align:left; padding:8px 0; border:none; background:none; border-top:1px solid rgba(255,255,255,.05); cursor:pointer; }
        .plp2-rising-row:first-of-type { border-top:none; }
        .plp2-rising-row img { width:30px; height:30px; border-radius:50%; object-fit:cover; object-position:top; flex:none; border:1px solid var(--line); }
        .plp2-rising-row .ri { flex:1; min-width:0; }
        .plp2-rising-row .ri strong { display:block; color:#eef1f4; font:700 12.5px "Barlow",sans-serif; }
        .plp2-rising-row .ri span { color:var(--muted); font:500 10px "Barlow",sans-serif; }
        .plp2-rising-row .rr { color:var(--l); font:800 15px "Barlow Condensed",sans-serif; }
        .plp2-notice { border:1px solid rgba(200,250,60,.3); background:rgba(200,250,60,.06); border-radius:10px; padding:10px 14px; margin-bottom:12px; color:#dfeeb6; font:500 12.5px "Barlow",sans-serif; }
      `}</style>

      <header className="plp2-hero">
        <div className="eyebrow">Calibre Intelligence</div>
        <h1>Players</h1>
        <p>Discover, analyse and compare the world's best football talent.</p>
      </header>

      <div className="plp2-stats">
        <div className="plp2-stat"><b>{supabaseError ? '—' : supabaseLoading ? '…' : supabaseTotal.toLocaleString()}</b><span>Players indexed</span></div>
        <div className="plp2-stat"><b>{leagueCount != null ? leagueCount : '…'}</b><span>Leagues covered</span></div>
        <div className="plp2-stat"><b>{nationCount != null ? nationCount : '…'}</b><span>Nations</span></div>
        <div className="plp2-stat"><b>{supabaseLoading ? '…' : formatCompact(supabaseTotal * METRIC_FIELDS.length)}</b><span>Data points</span></div>
        <div className="plp2-stat"><b>{String(coverageSeason ?? CURRENT_SEASON).slice(2)}/{String((coverageSeason ?? CURRENT_SEASON) + 1).slice(2)}</b><span>Season coverage</span></div>
      </div>

      <div className="plp2-searchrow">
        <div className="plp2-search" ref={playerSearchRef}>
          <Search size={16} /><input placeholder="Search player by name — Gordon, Messi, Bellingham…" value={search} onChange={e => setSearch(e.target.value)} />{searching && <LoaderCircle className="player-live-spinner" size={15} />}
          <PortalDropdown anchorRef={playerSearchRef} open={hasLiveQuery && liveRows.length > 0}>
            {liveRows.slice(0, 8).map(p => (
              <button type="button" key={p.id || p.apiPlayerId || p.name} onClick={() => { openProfile(p); setSearch(''); }}>
                <ApiPlayerImage playerId={apiIdFor(p)} name={p.name} preferredSrc={portraitFor(p)} fallbackSrc={fallbackFor(p)} alt="" />
                <span><b>{p.name}</b><small>{[p.position || p.pos, p.team || p.club].filter(Boolean).join(' · ')}</small></span>
                {p.rating != null && <em>{Math.round(p.rating)}</em>}
              </button>
            ))}
          </PortalDropdown>
        </div>
        <div className="plp2-search" ref={clubSearchRef}>
          <Search size={16} /><input placeholder="Search by club — Barcelona, Arsenal…" value={clubQuery} onChange={e => setClubQuery(e.target.value)} />{clubSearching && <LoaderCircle className="player-live-spinner" size={15} />}
          <PortalDropdown anchorRef={clubSearchRef} open={clubMatches.length > 0}>
            {clubMatches.map(name => (
              <button type="button" key={name} onClick={() => pickClub(name)}><span><b>{name}</b></span></button>
            ))}
          </PortalDropdown>
        </div>
        <button className="btn btn--outline" type="button" onClick={() => document.querySelector('.plp2-filters')?.scrollIntoView({ behavior: 'smooth' })}><SlidersHorizontal size={14} /> Advanced Filters</button>
        <style>{`
          .plp2-dropdown { max-height:280px; overflow:auto; background:rgba(10,14,17,.98); backdrop-filter:blur(18px); border:1px solid rgba(255,255,255,.10); border-radius:10px; box-shadow:0 20px 50px rgba(0,0,0,.6); }
          .plp2-dropdown button { display:flex; align-items:center; gap:9px; width:100%; padding:9px 11px; text-align:left; border-bottom:1px solid rgba(255,255,255,.05); background:none; cursor:pointer; }
          .plp2-dropdown button:last-child { border-bottom:none; }
          .plp2-dropdown button:hover { background:rgba(166,255,0,.06); }
          .plp2-dropdown img { width:30px; height:30px; border-radius:50%; object-fit:cover; object-position:top; border:1px solid rgba(255,255,255,.12); flex:none; }
          .plp2-dropdown b { display:block; color:#fff; font:700 12px/1.1 "Barlow",sans-serif; }
          .plp2-dropdown small { display:block; margin-top:3px; color:#8d929b; font:600 9.5px/1 "Barlow",sans-serif; }
          .plp2-dropdown em { margin-left:auto; flex:none; font:800 13px "Barlow Condensed",sans-serif; color:#a6ff00; font-style:normal; }
        `}</style>
      </div>

      <div className="plp2-filters">
        <select value={filters.position} onChange={e => setFilters({ ...filters, position: e.target.value })}>{POSITION_OPTIONS.map(v => <option key={v} value={v}>{v === 'all' ? 'All Positions' : v}</option>)}</select>
        <select value={filters.league} onChange={e => setFilters({ ...filters, league: e.target.value })}>{LEAGUE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select value={filters.nation} onChange={e => setFilters({ ...filters, nation: e.target.value })}><option value="all">All Nations</option><option value="england">England</option><option value="spain">Spain</option><option value="france">France</option><option value="brazil">Brazil</option><option value="nigeria">Nigeria</option></select>
        <select value={filters.age} onChange={e => setFilters({ ...filters, age: e.target.value })}>{AGE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select value={filters.archetype} onChange={e => setFilters({ ...filters, archetype: e.target.value })}><option value="all">All Archetypes</option><option>Sweeper Keeper</option><option>Shot-Stopper</option><option>Ball-Playing Defender</option><option>Stopper</option><option>Wing-Back</option><option>Inverted Full-Back</option><option>Full-Back</option><option>Deep-Lying Playmaker</option><option>Ball-Winning Midfielder</option><option>Anchor</option><option>Holding Midfielder</option><option>Box-to-Box Midfielder</option><option>Mezzala</option><option>Advanced Playmaker</option><option>Central Midfielder</option><option>Winger</option><option>Inside Forward</option><option>Advanced Forward</option><option>False Nine</option><option>Second Striker</option><option>Target Man</option><option>Poacher</option></select>
        <select value={filters.rating} onChange={e => setFilters({ ...filters, rating: e.target.value })}><option value="all">All Ratings</option><option value="90">Calibre 90+</option><option value="85">Calibre 85+</option><option value="80">Calibre 80+</option><option value="75">Calibre 75+</option><option value="70">Calibre 70+</option></select>
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => { setSearch(''); setBrowseRows([]); setNotice(''); setFilters({ position: 'all', age: '16-40', league: 'all', nation: 'all', archetype: 'all', rating: 'all' }); }}>Clear all</button>
        <button className="btn btn--lime btn--sm" type="button" onClick={applyFilters}>Apply Filters</button>
      </div>

      {notice && <div className="plp2-notice">{notice}</div>}

      <div className="plp2-body">
        <main>
          <section className="plp2-sec plp2-featured">
            <div className="plp2-sec-head"><h3>Featured players</h3></div>
            <div className="plp2-fcards">
              {featuredList.map(p => { const pl = localToProfile(p); return <FeaturedCard key={p.name} player={pl} onOpen={openProfile} watched={isWatched(apiIdFor(pl))} onToggleWatch={handleToggleWatch} />; })}
            </div>
          </section>

          <section className="plp2-sec plp2-rankings">
            <div className="plp2-sec-head"><h3>Player rankings</h3><div className="plp2-rank-tabs">{RANK_TABS.map(tab => <button key={tab} type="button" className={rankTab === tab ? 'on' : ''} onClick={() => setRankTab(tab)}>{tab}</button>)}</div></div>
            <div className="plp2-table-wrap">
              <table className="plp2-table">
                <thead><tr><th className="num">#</th><th>Player</th><th className="num">Age</th><th>Pos</th><th>Nation</th><th>Club</th><th className="num">Calibre</th><th className="num">Trend</th><th className="num">Potential</th></tr></thead>
                <tbody>
                  {rankPageRows.map((p, i) => {
                    const rt = rowRating(p); const tr = trendArrow(p);
                    return (
                      <tr key={p.id || p.name} onClick={() => openProfile(p)}>
                        <td className="num">{(rankPage - 1) * pageSize + i + 1}</td>
                        <td><div className="plp2-tp"><div className="plp2-tp-img"><ApiPlayerImage playerId={apiIdFor(p)} name={p.name} preferredSrc={portraitFor(p)} fallbackSrc={fallbackFor(p)} loading="lazy" /></div><strong>{p.name}</strong></div></td>
                        <td className="num">{p.age || '—'}</td>
                        <td><span className="plp2-pos">{p.position || p.pos || '—'}</span></td>
                        <td>{p.nationality || '—'}</td>
                        <td>{p.club || p.team || '—'}</td>
                        <td className="num">{rt != null ? <span className="plp2-rate">{displayRating(rt)}</span> : <span className="live-profile-pill">LIVE</span>}</td>
                        <td className="num"><span className={`plp2-trend ${tr}`}>{tr === 'up' ? '▲' : tr === 'down' ? '▼' : '—'}</span></td>
                        <td className="num"><span className="plp2-pot">{Number.isFinite(Number(p.potential)) ? p.potential : '—'}</span></td>
                      </tr>
                    );
                  })}
                  {rankPageRows.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>No players match those filters.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="plp2-pager">
              <div className="plp2-pagesize"><span>Show</span><select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setRankPage(1); }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select><span>· {rankingRows.length} players</span></div>
              <div className="plp2-pages">
                <button type="button" disabled={rankPage <= 1} onClick={() => setRankPage(p => Math.max(1, p - 1))}>‹</button>
                {Array.from({ length: rankPageCount }, (_, i) => i + 1).filter(n => n === 1 || n === rankPageCount || Math.abs(n - rankPage) <= 1).map((n, idx, arr) => (
                  <span key={n} style={{ display: 'contents' }}>
                    {idx > 0 && arr[idx - 1] !== n - 1 && <span>…</span>}
                    <button type="button" className={n === rankPage ? 'on' : ''} onClick={() => setRankPage(n)}>{n}</button>
                  </span>
                ))}
                <button type="button" disabled={rankPage >= rankPageCount} onClick={() => setRankPage(p => Math.min(rankPageCount, p + 1))}>›</button>
              </div>
            </div>
          </section>
        </main>

        <aside className="plp2-rail">
          <div className="plp2-qa">
            <h4>Quick actions</h4>
            {quickActions.map(a => <button key={a.key} type="button" onClick={a.run}><a.icon size={15} /> {a.label}</button>)}
          </div>

          <div className="plp2-compare">
            <div className="plp2-side-head"><h4>Compare players</h4><button type="button" onClick={() => setComparePlayers([])}>Clear</button></div>
            <div className="plp2-cmp-slots">
              {[0, 1].map(index => { const p = comparePlayers[index]; return p
                ? <div className="plp2-cmp-slot" key={p.id || p.name}><ApiPlayerImage playerId={apiIdFor(p)} name={p.name} preferredSrc={portraitFor(p)} fallbackSrc={fallbackFor(p)} /><div><strong>{p.name}</strong><br /><span>{p.team || p.club || 'Live profile'}</span></div><button className="plp2-cmp-x" type="button" onClick={() => setComparePlayers(cur => cur.filter((_, i) => i !== index))}>×</button></div>
                : <div className="plp2-cmp-slot plp2-cmp-slot--empty" key={index}>Select a player</div>; })}
            </div>
            <button className="btn btn--lime btn--sm" style={{ width: '100%' }} type="button" disabled={comparePlayers.length < 2} onClick={() => setCompareOpen(true)}>Compare players <ArrowRight size={13} /></button>
          </div>

          <div className="plp2-rising">
            <div className="plp2-side-head"><h4><TrendingUp size={12} /> Rising players</h4></div>
            {risingComputed.map(r => (
              <button key={r.name} type="button" className="plp2-rising-row" onClick={() => openProfile(localToProfile(r))}>
                <ApiPlayerImage playerId={apiIdFor(r)} name={r.name} preferredSrc={portraitFor(r)} fallbackSrc={fallbackFor(r)} />
                <div className="ri"><strong>{r.name}</strong><span>{r.sub}</span></div>
                <div className="rr">{displayRating(r.rating)}</div>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <div className="founder-strip" style={{ marginTop: 16 }}>
        <Crown size={22} />
        <strong>Get World Cup Founder Pass</strong>
        <span>Unlock premium insights, advanced filters and exclusive World Cup content.</span>
        <button type="button" className="btn btn--lime" onClick={() => navigateTo('/pricing')}>EXPLORE PLANS <ArrowRight size={14} /></button>
      </div>

      <PlayerProfileModal player={activePlayer} stats={activeStats} loading={profileLoading} onClose={() => setActivePlayer(null)} onCompare={addToCompare} onCompareWith={compareWithSimilar} watched={activePlayer ? isWatched(activePlayer.apiPlayerId ?? activePlayer.id) : false} onToggleWatch={() => handleToggleWatch(activePlayer)} canWatch={canWatch} />
      {compareOpen && <CompareModal players={comparePlayers} onClose={() => setCompareOpen(false)} />}
      {watchlistOpen && <WatchlistModal items={watchlist} onOpen={pl => { setWatchlistOpen(false); openProfile(pl); }} onRemove={id => removeWatch(id)} onClose={() => setWatchlistOpen(false)} />}
    </div>
  );
}
