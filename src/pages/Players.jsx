import { useEffect, useMemo, useState } from 'react';
import { Search, ArrowRight, Crown, Star, TrendingUp, X, LoaderCircle, Plus, Database, GitCompareArrows, SlidersHorizontal, Info } from 'lucide-react';
import { navigateTo } from '../components/NavLink.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import ApiTeamLogo from '../components/ApiTeamLogo.jsx';
import ShareBar, { shareUrl } from '../components/Share.jsx';
import { CURRENT_SEASON, getLeaguePlayers, getPlayerProfile, getPlayerStats, searchPlayerProfiles, teamLogoUrl } from '../services/apiFootball.js';
import { getSupabasePlayerCount, getSupabaseNationCount, getSupabasePlayers, getSupabasePlayersByApiIds, searchSupabasePlayers } from '../services/supabasePlayers.js';
import { calibreRating, resolveRating } from '../services/calibreRating.js';
import useAuth from '../hooks/useAuth.js';
import { resolveTier, can } from '../services/access.js';
import { getWatchlist, isWatched, toggleWatch, removeWatch, WATCHLIST_EVENT, bindWatchlistUser, mergeLocalIntoAccount, loadWatchlist } from '../services/watchlist.js';

const CURATED_PLAYERS = [
  { rank:1, name:'Kylian Mbappé', apiPlayerId:278, age:27, club:'Real Madrid', pos:'ST', rating:91, buzz:96, fanRating:4.8, potential:94, img:'/assets/players/kylian-mbappe.jpg', archetype:'Pure Striker' },
  { rank:2, name:'Erling Haaland', apiPlayerId:1100, age:25, club:'Manchester City', pos:'ST', rating:90, buzz:95, fanRating:4.7, potential:93, img:'/assets/players/neutral-player.svg', archetype:'Poacher' },
  { rank:3, name:'Jude Bellingham', apiPlayerId:129718, age:22, club:'Real Madrid', pos:'CM', rating:86, buzz:92, fanRating:4.7, potential:93, img:'/assets/players/jude-bellingham.jpg', archetype:'Box Crasher' },
  { rank:4, name:'Vinícius Júnior', apiPlayerId:762, age:25, club:'Real Madrid', pos:'LW', rating:85, buzz:90, fanRating:4.6, potential:91, img:'/assets/players/vinicius-junior.jpg', archetype:'Inside Forward' },
  { rank:5, name:'Phil Foden', apiPlayerId:631, age:26, club:'Manchester City', pos:'CAM', rating:85, buzz:88, fanRating:4.5, potential:90, img:'/assets/players/neutral-player.svg', archetype:'Advanced Playmaker' },
  { rank:6, name:'Bukayo Saka', apiPlayerId:1460, age:24, club:'Arsenal', pos:'RW', rating:84, buzz:87, fanRating:4.6, potential:90, img:'/assets/players/neutral-player.svg', archetype:'Wide Creator' },
  { rank:7, name:'Rodri', apiPlayerId:44, age:29, club:'Manchester City', pos:'CDM', rating:84, buzz:85, fanRating:4.6, potential:88, img:'/assets/players/neutral-player.svg', archetype:'Controller' },
  { rank:8, name:'Federico Valverde', apiPlayerId:756, age:27, club:'Real Madrid', pos:'CM', rating:83, buzz:83, fanRating:4.4, potential:88, img:'/assets/players/neutral-player.svg', archetype:'Pressing Engine' },
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
  if (v == null || v === '') return '\u2014';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return dp ? n.toFixed(dp) : String(n);
}
// Exact replica of the System Fit player pop-up (sf2-modal): 560px, #a6ff00 lime,
// #8d929b muted, IBM Plex Mono labels, BIO (3-col) + PERFORMANCE (4-col).
function PlayerProfileModal({ player, loading, onClose, onCompare, watched, onToggleWatch, canWatch }) {
  if (!player) return null;
  const arch = player.archetype || '';
  const chips = String(player.position || player.pos || '').split(/[\/,]/).map(t => t.trim()).filter(Boolean).slice(0, 3);
  const bio = [
    ['COUNTRY', player.nationality || player.country || '\u2014'],
    ['AGE', player.age || '\u2014'],
    ['HEIGHT', player.height ? String(player.height) : '\u2014'],
    ['WEIGHT', player.weight ? String(player.weight) : '\u2014'],
    ['FOOT', player.foot || '\u2014'],
    ['CLUB', player.club || player.team || '\u2014'],
  ];
  const stats = [
    ['GOALS', ppmStat(player.goals)],
    ['ASSISTS', ppmStat(player.assists)],
    ['xG / 90', ppmStat(player.xg_per_90, 3)],
    ['KEY PASSES', ppmStat(player.key_passes)],
    ['SHOTS', ppmStat(player.shots)],
    ['DRIBBLES', ppmStat(player.dribbles_success ?? player.successful_dribbles)],
    ['DUELS WON', ppmStat(player.duels_won)],
    ['TACKLES', ppmStat(player.tackles)],
    ['INTERCEPTIONS', ppmStat(player.interceptions)],
    ['PASS ACC %', ppmStat(player.pass_accuracy)],
    ['MINUTES', ppmStat(player.minutes)],
    ['CALIBRE', displayRating(player.rating)],
  ];
  return (
    <div className="ppm2" role="presentation" onMouseDown={onClose}>
      <section className="ppm2-card" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <style>{`
          .ppm2 { position:fixed; inset:0; z-index:1000; background:rgba(3,5,7,.72); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:40px 20px; overflow:auto; }
          .ppm2 * { box-sizing:border-box; }
          .ppm2-card { --l:#a6ff00; --muted:#8d929b; position:relative; width:min(560px,100%); background:rgba(11,15,18,.97); border:1px solid rgba(255,255,255,.10); border-radius:16px; box-shadow:0 30px 80px rgba(0,0,0,.65); padding:22px; }
          .ppm2-close { position:absolute; top:14px; right:14px; width:30px; height:30px; display:grid; place-items:center; border-radius:8px; border:1px solid rgba(255,255,255,.10); background:rgba(255,255,255,.03); color:#c4c9ce; cursor:pointer; }
          .ppm2-close:hover { background:rgba(255,255,255,.08); color:#fff; }
          .ppm2-head { display:flex; align-items:center; gap:14px; padding-right:34px; }
          .ppm2-photo { width:70px; height:84px; border-radius:9px; overflow:hidden; flex:none; background:#0a0d10; }
          .ppm2-photo img { width:100%; height:100%; object-fit:cover; object-position:top; }
          .ppm2-id { flex:1; min-width:0; }
          .ppm2-kicker { color:var(--l); font:800 10px/1 "IBM Plex Mono",monospace; letter-spacing:.15em; text-transform:uppercase; }
          .ppm2-id h3 { margin:6px 0 0; color:#fff; font:900 24px/1 "Barlow Condensed",sans-serif; text-transform:uppercase; letter-spacing:.01em; }
          .ppm2-tags { display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; }
          .ppm2-tags span { padding:3px 8px; border:1px solid rgba(255,255,255,.14); border-radius:4px; color:#c4c9ce; font:700 9px/1 "IBM Plex Mono",monospace; }
          .ppm2-tags em { padding:3px 8px; border:1px solid rgba(166,255,0,.3); border-radius:4px; color:var(--l); font:800 9px/1 "IBM Plex Mono",monospace; font-style:normal; }
          .ppm2-rating { text-align:center; flex:none; }
          .ppm2-rating strong { display:block; color:var(--l); font:900 40px/.85 "Barlow Condensed",sans-serif; }
          .ppm2-rating span { display:block; margin-top:4px; color:var(--muted); font:800 8px/1 "IBM Plex Mono",monospace; letter-spacing:.1em; }
          .ppm2-sec { margin-top:18px; }
          .ppm2-sec > small { display:block; color:var(--muted); font:800 9px/1 "IBM Plex Mono",monospace; letter-spacing:.12em; margin-bottom:11px; }
          .ppm2-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px 10px; }
          .ppm2-grid--stats { grid-template-columns:repeat(4,1fr); }
          .ppm2-grid > div { min-width:0; }
          .ppm2-grid span { display:block; color:var(--muted); font:700 8px/1.2 "IBM Plex Mono",monospace; letter-spacing:.05em; }
          .ppm2-grid b { display:block; margin-top:5px; color:#fff; font:800 15px/1 "Barlow Condensed",sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
          .ppm2-actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:18px; }
          .ppm2-note { margin:18px 0 0; color:#6f757e; font:500 10.5px/1.4 "Barlow",sans-serif; }
          @media(max-width:760px){ .ppm2-grid, .ppm2-grid--stats { grid-template-columns:repeat(2,1fr); } }
        `}</style>
        <button className="ppm2-close" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="ppm2-head">
          <div className="ppm2-photo"><ApiPlayerImage playerId={apiIdFor(player)} name={player.name} preferredSrc={portraitFor(player)} fallbackSrc={fallbackFor(player)} alt={player.name} /></div>
          <div className="ppm2-id">
            <div className="ppm2-kicker">Player profile</div>
            <h3>{player.name}</h3>
            <div className="ppm2-tags">{chips.map(c => <span key={c}>{c}</span>)}{arch && <em>{arch}</em>}</div>
          </div>
          <div className="ppm2-rating"><strong>{displayRating(player.rating)}</strong><span>CALIBRE</span></div>
        </div>
        <div className="ppm2-sec"><small>BIO</small><div className="ppm2-grid">{bio.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div></div>
        <div className="ppm2-sec"><small>PERFORMANCE</small><div className="ppm2-grid ppm2-grid--stats">{stats.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div></div>
        <div className="ppm2-actions">
          <button type="button" className="btn btn--outline btn--sm" onClick={() => onCompare(player)}><Plus size={13} /> Add to compare</button>
          <button type="button" className={`btn btn--sm ${watched ? 'btn--lime' : 'btn--outline'}`} onClick={onToggleWatch} title={canWatch ? (watched ? 'Remove from watchlist' : 'Add to watchlist') : 'Watchlist is a Pro feature'}><Star size={13} /> {watched ? 'Watching' : 'Watch'}</button>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => navigateTo(`/system-fit?player=${encodeURIComponent(player.name)}`)}>Run System Fit <ArrowRight size={13} /></button>
          <ShareBar text={`${player.name} \u2014 Calibre ${displayRating(player.rating)}${arch ? `, ${arch}` : ''}.`} url={shareUrl('/players')} label={false} />
        </div>
        <p className="ppm2-note">{loading ? 'Loading live stats from the connected player dataset\u2026' : 'Stats populate from the connected player dataset \u2014 blanks fill in as data syncs.'}</p>
      </section>
    </div>
  );
}
function CompareModal({players,onClose}){
  if(players.length<2) return null;

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

        <p className="player-profile-modal__note">This beta workspace now receives real player profiles. The full comparison report will apply Calibre’s performance, consistency, form, impact and trajectory weights after the statistics pipeline is complete.</p>
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

  const featured = landingPlayers[weekIndex(landingPlayers.length)];
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

  // Separate, non-blocking: the nation count reads more rows than the main
  // fetch above, so it shouldn't delay featured players from showing.
  useEffect(()=>{
    let active = true;
    getSupabaseNationCount()
      .then(n => { if(active) setNationCount(n); })
      .catch(() => { /* stat card falls back to a loading dash, never a guess */ });
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
      }
    } catch { /* keep DB bio if the profile lookup fails */ }

    try{
      setActiveStats(await getPlayerStats(apiId));
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

  const filteredRows = useMemo(()=>sourceRows.filter(p=>{
    const posVal = p.position || p.pos || '';
    const posOk = !posVal || posMatches(posVal,filters.position);
    const natOk = filters.nation==='all' || !p.nationality || String(p.nationality).toLowerCase().includes(filters.nation);
    const archOk = filters.archetype==='all' || foldAccents(p.archetype)===foldAccents(filters.archetype);
    const ratingOk = filters.rating==='all' || (Number.isFinite(Number(p.rating)) && Number(p.rating)>=Number(filters.rating));
    return ageInRange(p.age,filters.age) && posOk && natOk && archOk && ratingOk;
  }),[sourceRows,filters]);
  const rankingRows = useMemo(()=>sortCurated(filteredRows,rankTab),[filteredRows,rankTab]);
  const featuredList = useMemo(()=>sortCurated(landingPlayers,'Calibre Rating').slice(0,8),[landingPlayers]);
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
    { key:'wonder', icon:TrendingUp, label:'Wonderkids (U21)', run:()=>{ setFilters(f=>({...f,age:'16-21'})); document.querySelector('.plp2-rankings')?.scrollIntoView({behavior:'smooth'}); } },
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
        <div className="plp2-stat"><b>{LEAGUE_OPTIONS.length - 1}</b><span>Leagues covered</span></div>
        <div className="plp2-stat"><b>{nationCount != null ? nationCount : '…'}</b><span>Nations</span></div>
        <div className="plp2-stat"><b>{supabaseLoading ? '…' : formatCompact(supabaseTotal * METRIC_FIELDS.length)}</b><span>Data points</span></div>
        <div className="plp2-stat"><b>{String(CURRENT_SEASON).slice(2)}/{String(CURRENT_SEASON + 1).slice(2)}</b><span>Season coverage</span></div>
      </div>

      <div className="plp2-searchrow">
        <div className="plp2-search"><Search size={16} /><input placeholder="Search player by name — Gordon, Messi, Bellingham…" value={search} onChange={e => setSearch(e.target.value)} />{searching && <LoaderCircle className="player-live-spinner" size={15} />}</div>
        <button className="btn btn--outline" type="button" onClick={() => document.querySelector('.plp2-filters')?.scrollIntoView({ behavior: 'smooth' })}><SlidersHorizontal size={14} /> Advanced Filters</button>
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

      <PlayerProfileModal player={activePlayer} stats={activeStats} loading={profileLoading} onClose={() => setActivePlayer(null)} onCompare={addToCompare} watched={activePlayer ? isWatched(activePlayer.apiPlayerId ?? activePlayer.id) : false} onToggleWatch={() => handleToggleWatch(activePlayer)} canWatch={canWatch} />
      {compareOpen && <CompareModal players={comparePlayers} onClose={() => setCompareOpen(false)} />}
      {watchlistOpen && <WatchlistModal items={watchlist} onOpen={pl => { setWatchlistOpen(false); openProfile(pl); }} onRemove={id => removeWatch(id)} onClose={() => setWatchlistOpen(false)} />}
    </div>
  );
}
