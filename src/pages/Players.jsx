import { useEffect, useMemo, useState } from 'react';
import { Search, ArrowRight, Crown, Star, TrendingUp, X, LoaderCircle, Plus, Database, GitCompareArrows, SlidersHorizontal, Info } from 'lucide-react';
import { navigateTo } from '../components/NavLink.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import { CURRENT_SEASON, getLeaguePlayers, getPlayerStats, searchPlayerProfiles } from '../services/apiFootball.js';
import { getSupabasePlayers } from '../services/supabasePlayers.js';

const CURATED_PLAYERS = [
  { rank:1, name:'Kylian Mbappé', age:27, club:'Real Madrid', pos:'ST', rating:91, buzz:96, fanRating:4.8, potential:94, img:'/assets/players/kylian-mbappe.jpg', archetype:'Pure Striker' },
  { rank:2, name:'Erling Haaland', age:25, club:'Manchester City', pos:'ST', rating:90, buzz:95, fanRating:4.7, potential:93, img:'/assets/players/neutral-player.svg', archetype:'Poacher' },
  { rank:3, name:'Jude Bellingham', age:22, club:'Real Madrid', pos:'CM', rating:86, buzz:92, fanRating:4.7, potential:93, img:'/assets/players/jude-bellingham.jpg', archetype:'Box Crasher' },
  { rank:4, name:'Vinícius Júnior', age:25, club:'Real Madrid', pos:'LW', rating:85, buzz:90, fanRating:4.6, potential:91, img:'/assets/players/vinicius-junior.jpg', archetype:'Inside Forward' },
  { rank:5, name:'Phil Foden', age:26, club:'Manchester City', pos:'CAM', rating:85, buzz:88, fanRating:4.5, potential:90, img:'/assets/players/neutral-player.svg', archetype:'Advanced Playmaker' },
  { rank:6, name:'Bukayo Saka', age:24, club:'Arsenal', pos:'RW', rating:84, buzz:87, fanRating:4.6, potential:90, img:'/assets/players/neutral-player.svg', archetype:'Wide Creator' },
  { rank:7, name:'Rodri', age:29, club:'Manchester City', pos:'CDM', rating:84, buzz:85, fanRating:4.6, potential:88, img:'/assets/players/neutral-player.svg', archetype:'Controller' },
  { rank:8, name:'Federico Valverde', age:27, club:'Real Madrid', pos:'CM', rating:83, buzz:83, fanRating:4.4, potential:88, img:'/assets/players/neutral-player.svg', archetype:'Pressing Engine' },
  { rank:9, name:'Martin Ødegaard', age:27, club:'Arsenal', pos:'CAM', rating:83, buzz:82, fanRating:4.4, potential:88, img:'/assets/players/neutral-player.svg', archetype:'Advanced Playmaker' },
  { rank:10, name:'Mohamed Salah', age:33, club:'Liverpool', pos:'RW', rating:82, buzz:80, fanRating:4.6, potential:84, img:'/assets/players/neutral-player.svg', archetype:'Inside Forward' },
];

const RISING = [
  { name:'Lamine Yamal', sub:'RW · Barcelona', pos:'RW', rating:87, delta:'+4', metrics:[['Progressive carries','Elite'],['Chance creation','High'],['Final-third entries','High'],['Assists','Strong']], img:'/assets/players/lamine-yamal.jpg' },
  { name:'Pau Cubarsí', sub:'CB · Barcelona', pos:'CB', rating:84, delta:'+5', metrics:[['Duels won','Strong'],['Pass completion','Elite'],['Line-breaking passes','High'],['Interceptions','Strong']], img:'/assets/players/neutral-player.svg' },
  { name:'João Neves', sub:'CM · PSG', pos:'CM', rating:83, delta:'+3', metrics:[['Duels won','High'],['Progressive passes','High'],['Pass completion','Elite'],['Assists','Developing']], img:'/assets/players/neutral-player.svg' },
  { name:'Arda Güler', sub:'AM · Real Madrid', pos:'AM', rating:82, delta:'+3', metrics:[['Progressive passes','High'],['Chance creation','High'],['Pass completion','Strong'],['Assists','Developing']], img:'/assets/players/neutral-player.svg' },
];

const LEAGUE_OPTIONS = [
  ['all','All Leagues'],['39','Premier League'],['140','La Liga'],['78','Bundesliga'],['135','Serie A'],['61','Ligue 1'],['88','Eredivisie'],['144','Belgian Pro League'],['94','Primeira Liga'],['71','Brasileirão Série A'],
];

const POSITION_OPTIONS = ['all','Attacker','Midfielder','Defender','Goalkeeper'];
const AGE_OPTIONS = [['16-40','16–40'],['16-21','16–21'],['22-25','22–25'],['26-30','26–30'],['31-40','31–40']];
const RANK_TABS = ['Calibre Rating','Market Buzz','Fan Rating','Potential'];

function displayRating(rating){
  const numericRating = Number(rating);
  return Number.isFinite(numericRating) ? Math.round(numericRating) : '—';
}

function fallbackFor(player){
  return player?.img || player?.image || '/assets/players/neutral-player.svg';
}

function localToProfile(player){
  return {
    ...player,
    source:'calibre-index',
    image:player.img,
    position:player.pos,
    team:player.club,
  };
}

function weekIndex(length){
  const d = new Date();
  const oneJan = new Date(d.getFullYear(),0,1);
  return Math.floor(((d-oneJan)/86400000+oneJan.getDay()+1)/7)%length;
}

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
  const remaining = new Map(
    (dbRows || []).map(player=>[String(player.name || '').toLowerCase(),player])
  );

  const merged = curatedRows.map(curated=>{
    const key = String(curated.name || '').toLowerCase();
    const databasePlayer = remaining.get(key);

    if(!databasePlayer) return curated;

    remaining.delete(key);

    return {
      ...curated,
      ...databasePlayer,
      rank:curated.rank,
      age:databasePlayer.age || curated.age,
      club:databasePlayer.club || curated.club,
      team:databasePlayer.team || databasePlayer.club || curated.club,
      pos:databasePlayer.pos || curated.pos,
      position:databasePlayer.position || databasePlayer.pos || curated.pos,
      img:databasePlayer.img || curated.img,
      image:databasePlayer.image || databasePlayer.img || curated.img,
      rating:databasePlayer.rating ?? curated.rating,
      buzz:curated.buzz,
      fanRating:curated.fanRating,
      potential:curated.potential,
    };
  });

  const additions = [...remaining.values()].map((player,index)=>({
    rank:merged.length+index+1,
    age:player.age || null,
    club:player.club || player.team || 'Calibre database',
    team:player.team || player.club || 'Calibre database',
    pos:player.pos || player.position || 'Player',
    position:player.position || player.pos || 'Player',
    rating:player.rating ?? null,
    buzz:player.buzz ?? 0,
    fanRating:player.fanRating ?? 0,
    potential:player.potential ?? 0,
    img:player.img || player.image || '/assets/players/neutral-player.svg',
    image:player.image || player.img || '/assets/players/neutral-player.svg',
    ...player,
  }));

  return [...merged,...additions];
}

function PlayerProfileModal({player,stats,loading,onClose,onCompare}){
  if(!player) return null;

  const stat = stats?.statistics?.[0];
  const club = stat?.team?.name || player.club || player.team || 'Club data loading';
  const position = stat?.games?.position || player.position || player.pos || 'Player';

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
          <ApiPlayerImage name={player.name} fallbackSrc={fallbackFor(player)} alt={player.name}/>
          <div>
            <div className="player-profile-modal__kicker"><Database size={12}/> Live player profile</div>
            <h2>{player.name}</h2>
            <p>{club} · {position}{player.nationality ? ` · ${player.nationality}` : ''}</p>
          </div>
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
              <ApiPlayerImage name={player.name} fallbackSrc={fallbackFor(player)} alt={player.name}/>
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
  const [comparePlayers,setComparePlayers] = useState([]);
  const [compareOpen,setCompareOpen] = useState(false);
  const [notice,setNotice] = useState('');
  const [supabaseRows,setSupabaseRows] = useState([]);
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

    getSupabasePlayers()
      .then(rows=>{
        if(active){
          setSupabaseRows(rows);
          setSupabaseError('');
        }
      })
      .catch(error=>{
        if(active){
          setSupabaseError(error?.message || 'Supabase player read failed');
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
        const rows = await searchPlayerProfiles(query,{skipCache:true,ttl:5*60*1000});
        if(!cancelled) setLiveRows(rows);
      }catch{
        if(!cancelled) setSearchError('Live player search could not load. Try again.');
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
        const rows = await getLeaguePlayers(Number(filters.league),CURRENT_SEASON,1);
        setBrowseRows(rows);
        setNotice(`${rows.length} live league-player profiles loaded.`);
      }else{
        setBrowseRows([]);
        setNotice('Choose a league to browse its live player feed, or type a player name for global search.');
      }
    }catch{
      setNotice('Live league browse could not load.');
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
    ()=>sourceRows.filter(
      p=>ageInRange(p.age,filters.age)
        && posMatches(p.position||p.pos,filters.position)
        && (filters.nation==='all' || String(p.nationality||'').toLowerCase().includes(filters.nation))
    ),
    [sourceRows,filters]
  );

  const ranked = useMemo(
    ()=>sortCurated(landingPlayers,rankTab).slice(0,5),
    [landingPlayers,rankTab]
  );

  async function openProfile(player){
    setActivePlayer(player);
    setActiveStats(null);

    const apiId = player?.apiPlayerId ?? (typeof player?.id === 'number' ? player.id : null);

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
        <div className="plp-sub">Discover, analyse and compare football talent through the live API directory and Calibre enrichment layer.</div>
      </div>

      <div className="plp-stats-bar">
        <div className="plp-stat"><div className="plp-stat-label">Player Directory</div><div className="plp-stat-val">LIVE</div><div className="plp-stat-sub">Global profile search connected</div></div>
        <div className="plp-stat"><div className="plp-stat-label">League Browse</div><div className="plp-stat-val">9</div><div className="plp-stat-sub">Beta league feeds enabled</div></div>
        <div className="plp-stat"><div className="plp-stat-label">Calibre Database</div><div className="plp-stat-val">{supabaseError?'OFFLINE':supabaseLoading?'SYNC':supabaseRows.length}</div><div className="plp-stat-sub">{supabaseError?'Fallback index active':'Supabase rating profiles enriched'}</div></div>
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
              <ApiPlayerImage className="plp-featured-img" name={featured.name} fallbackSrc={featured.img} alt={featured.name}/>
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
                <ApiPlayerImage className="avatar avatar--28" name={r.name} fallbackSrc={r.img}/>
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
                {tableRows.map((p,i)=>
                  <tr key={p.id||p.name} className="player-table-row" onClick={()=>openProfile(p)}>
                    <td>{i+1}</td>
                    <td><div className="plp-player-cell"><ApiPlayerImage name={p.name} fallbackSrc={fallbackFor(p)} loading="lazy"/><strong>{p.name}</strong></div></td>
                    <td>{p.age||'—'}</td>
                    <td>{p.team||p.club||'API-Football profile'}</td>
                    <td><span className="plp-pos-badge">{p.position||p.pos||'—'}</span></td>
                    <td>{p.rating!=null?<div className="rating-badge rating-badge--sm">{displayRating(p.rating)}</div>:<span className="live-profile-pill">LIVE</span>}</td>
                    <td><button className="btn btn--ghost btn--sm" type="button" onClick={event=>{event.stopPropagation();openProfile(p);}}>Open <ArrowRight size={12}/></button></td>
                  </tr>
                )}
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
                      <ApiPlayerImage name={p.name} fallbackSrc={fallbackFor(p)}/>
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

            {RISING.map(r=>
              <button key={r.name} className="plp-rising-row player-row-button rising-row--role-aware" type="button" onClick={()=>openProfile(localToProfile(r))}>
                <ApiPlayerImage name={r.name} fallbackSrc={r.img}/>
                <div className="plp-rising-info">
                  <strong>{r.name}</strong>
                  <span>{r.sub}</span>
                  <small>{r.metrics.map(([a,b])=>`${a}: ${b}`).join(' · ')}</small>
                </div>

                <div>
                  <div className="rating-badge rating-badge--sm">{displayRating(r.rating)}</div>
                  <div className="trend-up">{r.delta}</div>
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
