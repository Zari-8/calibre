import { useEffect, useMemo, useState } from 'react';
import { Search, ArrowRight, Crown, Star, TrendingUp, X, LoaderCircle, Plus, Database, GitCompareArrows, SlidersHorizontal, Info } from 'lucide-react';
import { navigateTo } from '../components/NavLink.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import ShareBar, { shareUrl } from '../components/Share.jsx';
import { CURRENT_SEASON, getLeaguePlayers, getPlayerStats, searchPlayerProfiles } from '../services/apiFootball.js';
import { getSupabasePlayerCount, getSupabasePlayers, getSupabasePlayersByApiIds, searchSupabasePlayers } from '../services/supabasePlayers.js';
import { calibreRating, resolveRating } from '../services/calibreRating.js';

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

function PlayerProfileModal({player,stats,loading,onClose,onCompare}){
  if(!player) return null;

  const stat = pickLeagueLine(stats?.statistics);
  const liveInput = stat ? lineToRatingInput(player, stat) : null;
  const liveCalc = liveInput && liveInput.minutes > 0 ? calibreRating(liveInput) : null;

  // Reconciliation rule: the player list and the modal must show the SAME number.
  // The list computes calibreRating from the enriched Supabase row and stores it
  // on player.rating. The modal fetches fresh API-Football stats and recomputes —
  // which produces a different result whenever the stat sets differ.
  // Fix: always prefer the stored row rating so the badge is consistent with
  // the table. Fall back to the live re-computation only for raw API search hits
  // that have no pre-computed rating at all (player.rating is null/undefined).
  const storedRating = (player.rating != null && Number.isFinite(Number(player.rating)))
    ? Number(player.rating)
    : null;
  const liveRating = storedRating ?? (liveCalc ? liveCalc.rating : null);
  const club = stat?.team?.name || player.club || player.team || 'Club data loading';
  const position = specificPosition(stat?.games?.position,specificPosition(player.position,player.pos));

  const items = [
    ['Age', player.age || '—'],
    ['Appearances', stat?.games?.appearences ?? stat?.games?.appearances ?? player.appearances ?? '—'],
    ['Goals', stat?.goals?.total ?? player.goals ?? '—'],
    ['Assists', stat?.goals?.assists ?? player.assists ?? '—'],
    [
      'Pass accuracy',
      stat?.passes?.accuracy
        ? String(stat.passes.accuracy) + '%'
        : player.passAccuracy
          ? String(player.passAccuracy) + '%'
          : '—',
    ],
    ['Duels won', stat?.duels?.won ?? player.duelsWon ?? '—'],
  ];

  return (
    <div className="player-profile-modal" role="presentation" onMouseDown={onClose}>
      <section className="player-profile-modal__dialog" onMouseDown={event=>event.stopPropagation()}>
        <button type="button" className="player-profile-modal__close" onClick={onClose}><X size={16}/></button>

        <div className="player-profile-modal__hero">
          <ApiPlayerImage playerId={apiIdFor(player)} name={player.name} preferredSrc={portraitFor(player)} fallbackSrc={fallbackFor(player)} alt={player.name}/>
          <div>
            <div className="player-profile-modal__kicker"><Database size={12}/> Live player profile</div>
            <h2>{player.name}</h2>
            <p>{club} · {position}{player.nationality ? ` · ${player.nationality}` : ''}</p>
          </div>
          {liveRating != null && (
            <div className="player-profile-modal__rating"><strong>{displayRating(liveRating)}</strong><span>Calibre</span></div>
          )}
        </div>

        {loading
          ? <div className="player-profile-modal__loading"><LoaderCircle size={16}/> Pulling current-season statistics…</div>
          : <div className="player-profile-modal__stats player-profile-modal__stats--six">
              {items.map(([label,value])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}
            </div>
        }

        <p className="player-profile-modal__note">The live identity and available season statistics come from API-Football. Calibre’s weighted rating, archetype and system-fit layers sit on top of that source data.</p>

        <div className="player-profile-modal__actions">
          <button type="button" className="btn btn--lime btn--sm" onClick={()=>onCompare(player)}><Plus size={13}/> Add to compare</button>
          <button type="button" className="btn btn--outline btn--sm" onClick={()=>navigateTo(`/system-fit?player=${encodeURIComponent(player.name)}`)}>Run system fit <ArrowRight size={13}/></button>
          <ShareBar text={`${player.name} — Calibre rating ${displayRating(liveRating)}${player.archetype ? `, ${player.archetype}` : ''}.`} url={shareUrl('/players')} label={false}/>
        </div>
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
            </article>
          )}
        </div>

        <p className="player-profile-modal__note">This beta workspace now receives real player profiles. The full comparison report will apply Calibre’s performance, consistency, form, impact and trajectory weights after the statistics pipeline is complete.</p>
      </section>
    </div>
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
  const [supabaseError,setSupabaseError] = useState('');
  const [supabaseLoading,setSupabaseLoading] = useState(true);

  const [filters,setFilters] = useState({
    position:'all',
    age:'16-40',
    league:'all',
    nation:'all',
    archetype:'all',
  });

  const landingPlayers = useMemo(
    ()=>mergeCuratedWithSupabase(CURATED_PLAYERS,supabaseRows),
    [supabaseRows]
  );

  const featured = landingPlayers[weekIndex(landingPlayers.length)];
  const hasLiveQuery = search.trim().length>=3;

  useEffect(()=>{
    let active = true;

    Promise.all([
      getSupabasePlayers({
        names:CURATED_PLAYERS.map(player=>player.name),
        limit:60,
      }),
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
      return ageInRange(p.age,filters.age) && posOk && natOk;
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

  return (
    <div className="page players-page">
      <div className="plp-header">
        <div className="plp-title">Players</div>
        <div className="plp-sub">Discover, analyse and compare football talent through the Calibre player bank and live enrichment layer.</div>
      </div>

      <div className="plp-stats-bar">
        <div className="plp-stat"><div className="plp-stat-label">Player Directory</div><div className="plp-stat-val">LIVE</div><div className="plp-stat-sub">Global profile search connected</div></div>
        <div className="plp-stat"><div className="plp-stat-label">League Browse</div><div className="plp-stat-val">9</div><div className="plp-stat-sub">Beta league feeds enabled</div></div>
        <div className="plp-stat"><div className="plp-stat-label">Calibre Database</div><div className="plp-stat-val">{supabaseError?'OFFLINE':supabaseLoading?'SYNC':supabaseTotal.toLocaleString()}</div><div className="plp-stat-sub">{supabaseError?'Fallback index active':'Supabase rating profiles enriched'}</div></div>
        <div className="plp-stat"><div className="plp-stat-label">Featured Player</div><div className="plp-stat-val">Weekly</div><div className="plp-stat-sub">Editorial rotation</div></div>
      </div>

      <div className="plp-search-bar">
        <div className="plp-search">
          <Search size={16}/>
          <input placeholder="Search the live player directory — try Gordon, Messi or Bellingham…" value={search} onChange={event=>setSearch(event.target.value)}/>
          {searching && <LoaderCircle className="player-live-spinner" size={15}/>}
        </div>

        <button className="btn btn--outline" type="button" onClick={()=>document.querySelector('.plp-filters')?.scrollIntoView({behavior:'smooth'})}>
          <SlidersHorizontal size={14}/> Advanced Filters
        </button>
      </div>

      <div className="plp-filters">
        <select className="plp-filter-select" value={filters.position} onChange={e=>setFilters({...filters,position:e.target.value})}>
          {POSITION_OPTIONS.map(v=><option key={v} value={v}>{v==='all'?'All Positions':v}</option>)}
        </select>

        <select className="plp-filter-select" value={filters.age} onChange={e=>setFilters({...filters,age:e.target.value})}>
          {AGE_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>

        <select className="plp-filter-select" value={filters.league} onChange={e=>setFilters({...filters,league:e.target.value})}>
          {LEAGUE_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>

        <select className="plp-filter-select" value={filters.nation} onChange={e=>setFilters({...filters,nation:e.target.value})}>
          <option value="all">All Nations</option>
          <option value="england">England</option>
          <option value="spain">Spain</option>
          <option value="france">France</option>
          <option value="brazil">Brazil</option>
          <option value="nigeria">Nigeria</option>
        </select>

        <select className="plp-filter-select" value={filters.archetype} onChange={e=>setFilters({...filters,archetype:e.target.value})}>
          <option value="all">All Archetypes</option>
          <option>Controller</option>
          <option>Advanced Playmaker</option>
          <option>Pressing Engine</option>
          <option>Inside Forward</option>
          <option>Wide Creator</option>
        </select>

        <button className="btn btn--ghost btn--sm" type="button" onClick={()=>{
          setSearch('');
          setBrowseRows([]);
          setFilters({position:'all',age:'16-40',league:'all',nation:'all',archetype:'all'});
        }}>
          Clear all
        </button>

        <button className="btn btn--lime btn--sm" type="button" onClick={applyFilters}>Apply Filters</button>
      </div>

      {notice && <div className="player-search-state">{notice}</div>}

      <div className="plp-layout">
        <div>
          <button className="plp-featured panel--featured player-card-button" type="button" onClick={()=>openProfile(localToProfile(featured))}>
            <div className="plp-featured-img-wrap">
              <ApiPlayerImage className="plp-featured-img" playerId={apiIdFor(featured)} name={featured.name} preferredSrc={portraitFor(featured)} fallbackSrc={fallbackFor(featured)} alt={featured.name}/>
              <div className="plp-featured-img-overlay"/>
              <div className="plp-featured-rating-badge"><strong>{displayRating(featured.rating)}</strong><span>Calibre</span></div>
            </div>

            <div className="plp-featured-body">
              <div className="plp-featured-tag"><Star size={12}/><span>Featured player · weekly editorial spotlight</span></div>
              <div className="plp-featured-name">{featured.name}</div>
              <div className="plp-featured-club">⚽ {featured.club}</div>
              <div className="plp-featured-meta">{featured.pos} · {featured.archetype}</div>
              <p className="featured-selection-note"><Info size={12}/> Chosen from the current debate and transfer-window rotation, not solely by goals.</p>

              <div className="plp-featured-stats">
                <div className="plp-featured-stat"><strong>{displayRating(featured.rating)}</strong><span>Calibre</span></div>
                <div className="plp-featured-stat"><strong>{featured.buzz}</strong><span>Market Buzz</span></div>
                <div className="plp-featured-stat"><strong>{featured.fanRating} ★</strong><span>Fan Rating</span></div>
                <div className="plp-featured-stat"><strong>{featured.potential}</strong><span>Potential</span></div>
              </div>
            </div>
          </button>

          <div className="plp-rankings panel" style={{marginTop:12}}>
            <div className="panel-head"><div className="panel-title">Player Rankings</div></div>

            <div className="plp-rankings-tabs">
              {RANK_TABS.map(tab=>
                <button key={tab} type="button" className={`plp-rank-tab ${rankTab===tab?'active':''}`} onClick={()=>setRankTab(tab)}>
                  {tab}
                </button>
              )}
            </div>

            {ranked.map((r,index)=>
              <button key={r.name} className="plp-rank-row player-row-button" type="button" onClick={()=>openProfile(localToProfile(r))}>
                <div className="plp-rank-num">{index+1}</div>
                <ApiPlayerImage className="avatar avatar--28" playerId={apiIdFor(r)} name={r.name} preferredSrc={portraitFor(r)} fallbackSrc={fallbackFor(r)}/>
                <div className="plp-rank-name">{r.name}</div>
                <div className="rating-badge rating-badge--sm">{rankTab==='Market Buzz'?r.buzz:rankTab==='Fan Rating'?r.fanRating:rankTab==='Potential'?r.potential:displayRating(r.rating)}</div>
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="plp-db-header">
              <div className="panel-title">Player Database</div>
              <div className="plp-db-count">{hasLiveQuery?`${liveRows.length} global matches`:browseRows.length?`${browseRows.length} live league players`:'Curated landing index · use search or league browse'}</div>
            </div>

            {searchError && <div className="player-search-state">{searchError}</div>}

            <table className="plp-db-table">
              <thead>
                <tr><th>#</th><th>Player</th><th>Age</th><th>Club / source</th><th>Pos</th><th>Rating</th><th>Profile</th></tr>
              </thead>

              <tbody>
                {tableRows.map((p,i)=>{
                  const rt = rowRating(p);
                  return (
                  <tr key={p.id||p.name} className="player-table-row" onClick={()=>openProfile(p)}>
                    <td>{i+1}</td>
                    <td><div className="plp-player-cell"><div className="plp-portrait-wrap"><ApiPlayerImage playerId={apiIdFor(p)} name={p.name} preferredSrc={portraitFor(p)} fallbackSrc={fallbackFor(p)} loading="lazy"/></div><strong>{p.name}</strong></div></td>
                    <td>{p.age||'—'}</td>
                    <td>{p.team||p.club||'API-Football profile'}</td>
                    <td><span className="plp-pos-badge">{p.position||p.pos||'—'}</span></td>
                    <td>{rt!=null?<div className="rating-badge rating-badge--sm">{displayRating(rt)}</div>:<span className="live-profile-pill">LIVE</span>}</td>
                    <td><button className="btn btn--ghost btn--sm" type="button" onClick={event=>{event.stopPropagation();openProfile(p);}}>Open <ArrowRight size={12}/></button></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="panel plp-compare">
            <div className="panel-head">
              <div className="panel-title">Compare Players</div>
              <button className="panel-action" type="button" onClick={()=>setComparePlayers([])}>Clear</button>
            </div>

            <div className="plp-compare-slots">
              {[0,1].map(index=>{
                const p = comparePlayers[index];

                return p
                  ? <div className="plp-compare-slot" key={p.id||p.name}>
                      <ApiPlayerImage playerId={apiIdFor(p)} name={p.name} preferredSrc={portraitFor(p)} fallbackSrc={fallbackFor(p)}/>
                      <strong>{p.name}</strong>
                      <span>{p.team||p.club||'Live profile'}</span>
                      <button className="plp-compare-remove" type="button" onClick={()=>setComparePlayers(current=>current.filter((_,i)=>i!==index))}>×</button>
                    </div>
                  : <div className="plp-compare-slot plp-compare-slot--empty" key={index}>Select a player</div>;
              })}
            </div>

            <button className="btn btn--lime btn--sm" style={{width:'100%'}} type="button" disabled={comparePlayers.length<2} onClick={()=>setCompareOpen(true)}>
              COMPARE PLAYERS <ArrowRight size={13}/>
            </button>
          </div>

          <div className="panel" style={{marginTop:10}}>
            <div className="panel-head"><div className="panel-title"><TrendingUp size={12}/> Rising Players · role-aware</div></div>

            {risingComputed.map(r=>
              <button key={r.name} className="plp-rising-row player-row-button rising-row--role-aware" type="button" onClick={()=>openProfile(localToProfile(r))}>
                <ApiPlayerImage playerId={apiIdFor(r)} name={r.name} preferredSrc={portraitFor(r)} fallbackSrc={fallbackFor(r)}/>
                <div className="plp-rising-info">
                  <strong>{r.name}</strong>
                  <span>{r.sub}</span>
                  <small>{r.metrics.map(([a,b])=>`${a}: ${b}`).join(' · ')}</small>
                </div>

                <div>
                  <div className="rating-badge rating-badge--sm">{displayRating(r.rating)}</div>
                </div>
              </button>
            )}

            <p className="player-role-note">Midfielders are not ranked as strikers. The beta card prioritises duels, progression, pass completion and assists. Progressive-passing coverage will deepen where the live provider exposes the required event data.</p>
          </div>
        </div>
      </div>

      <div className="founder-strip" style={{marginTop:16}}>
        <Crown size={22}/>
        <strong>Get World Cup Founder Pass</strong>
        <span>Unlock premium insights, advanced filters and exclusive World Cup content.</span>
        <button type="button" className="btn btn--lime" onClick={()=>navigateTo('/pricing')}>EXPLORE PLANS <ArrowRight size={14}/></button>
      </div>

      <PlayerProfileModal player={activePlayer} stats={activeStats} loading={profileLoading} onClose={()=>setActivePlayer(null)} onCompare={addToCompare}/>

      {compareOpen && <CompareModal players={comparePlayers} onClose={()=>setCompareOpen(false)}/>}
    </div>
  );
}
