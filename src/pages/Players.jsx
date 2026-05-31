import { useEffect, useMemo, useState } from 'react';
import { Search, ArrowRight, Crown, Star, TrendingUp, X, LoaderCircle, Plus, Database, GitCompareArrows } from 'lucide-react';
import { navigateTo } from '../components/NavLink.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import { getPlayerStats, searchPlayerProfiles } from '../services/apiFootball.js';

const DB_PLAYERS = [
  { rank:1, name:'Kylian Mbappé', age:27, club:'Real Madrid', pos:'ST', rating:91, buzz:96, fanRating:4.8, img:'/assets/players/kylian-mbappe.jpg' },
  { rank:2, name:'Erling Haaland', age:25, club:'Man City', pos:'ST', rating:90, buzz:95, fanRating:4.7, img:'/assets/players/lamine-yamal.jpg' },
  { rank:3, name:'Jude Bellingham', age:22, club:'Real Madrid', pos:'CM', rating:86, buzz:92, fanRating:4.7, img:'/assets/players/jude-bellingham.jpg' },
  { rank:4, name:'Vinícius Júnior', age:25, club:'Real Madrid', pos:'LW', rating:85, buzz:90, fanRating:4.6, img:'/assets/players/vinicius-junior.jpg' },
  { rank:5, name:'Phil Foden', age:26, club:'Man City', pos:'CAM', rating:85, buzz:88, fanRating:4.5, img:'/assets/players/florian-wirtz.jpg' },
  { rank:6, name:'Bukayo Saka', age:24, club:'Arsenal', pos:'RW', rating:84, buzz:87, fanRating:4.6, img:'/assets/players/lamine-yamal.jpg' },
  { rank:7, name:'Rodri', age:29, club:'Man City', pos:'CDM', rating:84, buzz:85, fanRating:4.6, img:'/assets/players/vitinha.jpg' },
  { rank:8, name:'Federico Valverde', age:27, club:'Real Madrid', pos:'CM', rating:83, buzz:83, fanRating:4.4, img:'/assets/players/pedri.jpg' },
  { rank:9, name:'Martin Ødegaard', age:27, club:'Arsenal', pos:'CAM', rating:83, buzz:82, fanRating:4.4, img:'/assets/players/florian-wirtz.jpg' },
  { rank:10, name:'Mohamed Salah', age:33, club:'Liverpool', pos:'RW', rating:82, buzz:80, fanRating:4.6, img:'/assets/players/kylian-mbappe.jpg' },
];

const RANKINGS = DB_PLAYERS.slice(0, 5);
const RISING = [
  { rank:1, name:'Lamine Yamal', sub:'RW · Barcelona', rating:87, delta:'+4', img:'/assets/players/lamine-yamal.jpg' },
  { rank:2, name:'Pau Cubarsí', sub:'CB · Barcelona', rating:84, delta:'+5', img:'/assets/players/pedri.jpg' },
  { rank:3, name:'Alejandro Garnacho', sub:'LW · Man Utd', rating:83, delta:'+4', img:'/assets/players/florian-wirtz.jpg' },
  { rank:4, name:'João Neves', sub:'CM · PSG', rating:83, delta:'+3', img:'/assets/players/vitinha.jpg' },
  { rank:5, name:'Arda Güler', sub:'AM · Real Madrid', rating:82, delta:'+3', img:'/assets/players/lamine-yamal.jpg' },
];

function HexRadarSmall() {
  const axes = [[40,4],[70,22],[70,58],[40,76],[10,58],[10,22]];
  const score = [[40,10],[64,28],[58,54],[40,68],[16,52],[22,28]];
  const pts = a => a.map(([x,y])=>`${x},${y}`).join(' ');
  return (
    <svg viewBox="0 0 80 80" style={{width:80,height:80}}>
      <polygon fill="none" stroke="rgba(166,255,0,.25)" strokeWidth="1" points={pts(axes)}/>
      {axes.map(([x,y],i)=><line key={i} stroke="rgba(166,255,0,.15)" strokeWidth=".8" x1="40" y1="40" x2={x} y2={y}/>)}
      <polygon fill="rgba(166,255,0,.28)" stroke="var(--lime)" strokeWidth="1.5" points={pts(score)}/>
    </svg>
  );
}

function fallbackFor(player) {
  return player?.img || '/assets/players/neutral-player.svg';
}

function localToProfile(player) {
  return { ...player, source:'calibre-index', image: player.img, position: player.pos };
}

function PlayerProfileModal({ player, stats, loading, onClose, onCompare }) {
  if (!player) return null;
  const stat = stats?.statistics?.[0];
  const club = stat?.team?.name || player.club || player.team || 'Club data loading';
  const position = stat?.games?.position || player.position || player.pos || 'Player';
  const appearances = stat?.games?.appearences ?? stat?.games?.appearances ?? '—';
  const goals = stat?.goals?.total ?? '—';
  const assists = stat?.goals?.assists ?? '—';
  return (
    <div className="player-profile-modal" role="dialog" aria-modal="true" aria-label={`${player.name} player profile`}>
      <section className="player-profile-modal__dialog">
        <button type="button" className="player-profile-modal__close" onClick={onClose} aria-label="Close"><X size={16}/></button>
        <div className="player-profile-modal__hero">
          <ApiPlayerImage name={player.name} fallbackSrc={player.image || fallbackFor(player)} alt={player.name}/>
          <div>
            <div className="player-profile-modal__kicker"><Database size={12}/> Live player profile</div>
            <h2>{player.name}</h2>
            <p>{club} · {position}{player.nationality ? ` · ${player.nationality}` : ''}</p>
          </div>
        </div>
        {loading ? (
          <div className="player-profile-modal__loading"><LoaderCircle size={16}/> Pulling current-season statistics…</div>
        ) : (
          <div className="player-profile-modal__stats">
            <div><strong>{player.age || '—'}</strong><span>Age</span></div>
            <div><strong>{appearances}</strong><span>Appearances</span></div>
            <div><strong>{goals}</strong><span>Goals</span></div>
            <div><strong>{assists}</strong><span>Assists</span></div>
          </div>
        )}
        <p className="player-profile-modal__note">This is the live API profile shell. Calibre ratings, trajectory, archetype and system-fit layers sit on top of this source data.</p>
        <div className="player-profile-modal__actions">
          <button type="button" className="btn btn--lime btn--sm" onClick={()=>onCompare(player)}><Plus size={13}/> Add to compare</button>
          <button type="button" className="btn btn--outline btn--sm" onClick={()=>navigateTo(`/system-fit?player=${encodeURIComponent(player.name)}`)}>Run system fit <ArrowRight size={13}/></button>
        </div>
      </section>
    </div>
  );
}

function CompareModal({ players, onClose }) {
  if (players.length < 2) return null;
  return (
    <div className="player-profile-modal" role="dialog" aria-modal="true" aria-label="Compare players">
      <section className="player-profile-modal__dialog player-compare-modal__dialog">
        <button type="button" className="player-profile-modal__close" onClick={onClose} aria-label="Close"><X size={16}/></button>
        <div className="player-profile-modal__kicker"><GitCompareArrows size={12}/> Calibre comparison workspace</div>
        <h2>{players[0].name} <em>vs</em> {players[1].name}</h2>
        <div className="player-compare-modal__grid">
          {players.slice(0,2).map(player => (
            <article key={`${player.id || player.name}`}>
              <ApiPlayerImage name={player.name} fallbackSrc={player.image || fallbackFor(player)} alt={player.name}/>
              <strong>{player.name}</strong>
              <span>{player.team || player.club || player.position || 'Live API profile'}</span>
            </article>
          ))}
        </div>
        <p className="player-profile-modal__note">The live profile layer is connected. The next comparison build will merge current-season output with Calibre’s weighted performance, consistency, form, impact and trajectory model.</p>
      </section>
    </div>
  );
}

export default function Players() {
  const [rankTab, setRankTab] = useState('Calibre Rating');
  const [search, setSearch] = useState('');
  const [liveRows, setLiveRows] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [activePlayer, setActivePlayer] = useState(null);
  const [activeStats, setActiveStats] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [comparePlayers, setComparePlayers] = useState([localToProfile(DB_PLAYERS[2]), localToProfile({ ...DB_PLAYERS[0], name:'Pedri', club:'Barcelona', pos:'CM', rating:89, img:'/assets/players/pedri.jpg' })]);
  const [compareOpen, setCompareOpen] = useState(false);

  const featured = DB_PLAYERS[2];
  const hasLiveQuery = search.trim().length >= 3;

  useEffect(() => {
    const query = search.trim();
    if (query.length < 3) {
      setLiveRows([]);
      setSearching(false);
      setSearchError('');
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const rows = await searchPlayerProfiles(query, { skipCache:true, ttl:5 * 60 * 1000 });
        if (!cancelled) setLiveRows(rows);
      } catch {
        if (!cancelled) setSearchError('Live player search could not load. Try again.');
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [search]);

  const tableRows = useMemo(() => hasLiveQuery ? liveRows : DB_PLAYERS.map(localToProfile), [hasLiveQuery, liveRows]);

  async function openProfile(player) {
    setActivePlayer(player);
    setActiveStats(null);
    if (!player?.id) return;
    setProfileLoading(true);
    try { setActiveStats(await getPlayerStats(player.id)); }
    finally { setProfileLoading(false); }
  }

  function addToCompare(player) {
    setComparePlayers(current => {
      const exists = current.some(item => (item.id && player.id ? item.id === player.id : item.name === player.name));
      if (exists) return current;
      return [...current.slice(-1), player].slice(0,2);
    });
    setActivePlayer(null);
  }

  function removeCompare(index) {
    setComparePlayers(current => current.filter((_, i) => i !== index));
  }

  return (
    <div className="page players-page">
      <div className="plp-header">
        <div className="plp-title">Players</div>
        <div className="plp-sub">Discover, analyse and compare the world's football talent.</div>
      </div>

      <div className="plp-stats-bar">
        <div className="plp-stat"><div className="plp-stat-label">Players in Database</div><div className="plp-stat-val">128,457</div><div className="plp-stat-sub">API directory connected</div></div>
        <div className="plp-stat"><div className="plp-stat-label">Live Search</div><div className="plp-stat-val">Active</div><div className="plp-stat-sub" style={{color:'var(--text2)'}}>Type any player surname</div></div>
        <div className="plp-stat"><div className="plp-stat-label">Scout Layer</div><div className="plp-stat-val">Beta</div><div className="plp-stat-sub" style={{color:'var(--text2)'}}>Calibre enrichment next</div></div>
        <div className="plp-stat"><div className="plp-stat-label">Market Buzz (7D)</div><div className="plp-stat-val" style={{color:'var(--green)'}}>High</div><div className="plp-stat-sub">+18%</div></div>
      </div>

      <div className="plp-search-bar">
        <div className="plp-search">
          <Search size={16} color="var(--text3)"/>
          <input placeholder="Search the live player database — try Messi, Gordon or Bellingham…" value={search} onChange={e=>setSearch(e.target.value)}/>
          {searching && <LoaderCircle className="player-live-spinner" size={15}/>} 
        </div>
        <button className="btn btn--outline" type="button">Advanced Filters</button>
      </div>

      <div className="plp-filters">
        {['All Positions','16-40','All Leagues','All Nations','All Archetypes'].map(f=><select key={f} className="plp-filter-select" defaultValue={f}><option>{f}</option></select>)}
        <button className="btn btn--ghost btn--sm" type="button" onClick={()=>setSearch('')}>Clear all</button>
        <button className="btn btn--lime btn--sm" type="button">Apply Filters</button>
      </div>

      <div className="plp-layout">
        <div>
          <button className="plp-featured panel--featured player-card-button" type="button" onClick={()=>openProfile(localToProfile(featured))}>
            <div className="plp-featured-img-wrap">
              <ApiPlayerImage className="plp-featured-img" name={featured.name} fallbackSrc={featured.img} alt={featured.name}/>
              <div className="plp-featured-img-overlay"/>
              <div className="plp-featured-rating-badge"><strong>{featured.rating}</strong><span>Calibre</span></div>
            </div>
            <div className="plp-featured-body">
              <div className="plp-featured-tag"><Star size={12} color="var(--lime)"/><span>Featured Player</span></div>
              <div className="plp-featured-name">{featured.name}</div>
              <div className="plp-featured-club">⚽ {featured.club}</div>
              <div className="plp-featured-meta">CM · Box-to-Box Midfielder · ENG</div>
              <div className="plp-featured-stats">
                <div className="plp-featured-stat"><strong>{featured.rating}</strong><span>Overall</span><small>Top 2%</small></div>
                <div className="plp-featured-stat"><strong>{featured.buzz}</strong><span>Market Buzz</span><small>Very High</small></div>
                <div className="plp-featured-stat"><strong>{featured.fanRating} ★</strong><span>Fan Rating</span><small>(12.4K)</small></div>
                <div className="plp-featured-stat"><strong>93</strong><span>Potential</span><small>Elite</small></div>
              </div>
              <span className="btn btn--outline btn--sm" style={{width:'100%'}}>Open Live Profile <ArrowRight size={13}/></span>
            </div>
          </button>

          <div className="plp-rankings panel" style={{marginTop:12}}>
            <div className="panel-head"><div className="panel-title">Player Rankings</div></div>
            <div className="plp-rankings-tabs">
              {['Calibre Rating','Market Buzz','Fan Rating','Potential'].map(t=><button key={t} type="button" className={`plp-rank-tab ${rankTab===t?'active':''}`} onClick={()=>setRankTab(t)}>{t}</button>)}
            </div>
            {RANKINGS.map(r=><button key={r.rank} className="plp-rank-row player-row-button" type="button" onClick={()=>openProfile(localToProfile(r))}><div className="plp-rank-num">{r.rank}</div><ApiPlayerImage className="avatar avatar--28" name={r.name} fallbackSrc={r.img} alt={r.name}/><div className="plp-rank-name">{r.name}</div><div className="rating-badge rating-badge--sm">{r.rating}</div></button>)}
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="plp-db-header">
              <div style={{font:'700 13px/1 "Rajdhani"',letterSpacing:'.1em',textTransform:'uppercase'}}>Player Database</div>
              <div className="plp-db-count">{hasLiveQuery ? `${liveRows.length} live API matches` : 'Calibre launch index'}</div>
            </div>
            {searchError && <div className="player-search-state">{searchError}</div>}
            {hasLiveQuery && !searching && !searchError && liveRows.length === 0 && <div className="player-search-state">No live profile matched “{search}”. Try a surname or at least three letters.</div>}
            <table className="plp-db-table">
              <thead><tr><th>#</th><th>Player</th><th>Age</th><th>Club / source</th><th>Pos</th><th>Rating</th><th>Profile</th></tr></thead>
              <tbody>
                {tableRows.map((p,i)=><tr key={p.id || p.name} className="player-table-row" onClick={()=>openProfile(p)}>
                  <td className="plp-rank-col">{i+1}</td>
                  <td><div className="plp-player-cell"><ApiPlayerImage name={p.name} fallbackSrc={p.image || fallbackFor(p)} alt={p.name}/><strong>{p.name}</strong></div></td>
                  <td>{p.age || '—'}</td>
                  <td>{p.team || p.club || (p.source==='api-profile' ? 'API-Football profile' : 'Calibre index')}</td>
                  <td><span className="plp-pos-badge">{p.position || p.pos || '—'}</span></td>
                  <td>{p.rating ? <div className="rating-badge rating-badge--sm">{p.rating}</div> : <span className="live-profile-pill">LIVE</span>}</td>
                  <td><button className="btn btn--ghost btn--sm" type="button" onClick={(event)=>{event.stopPropagation();openProfile(p)}}>Open <ArrowRight size={12}/></button></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="panel plp-compare" style={{marginBottom:10}}>
            <div className="panel-head"><div className="panel-title">Compare Players</div><button type="button" className="panel-action" onClick={()=>setComparePlayers([])}>Clear</button></div>
            <div className="plp-compare-slots">
              {[0,1].map(index => {
                const player = comparePlayers[index];
                return player ? <div className="plp-compare-slot" key={player.id || player.name}><ApiPlayerImage name={player.name} fallbackSrc={player.image || fallbackFor(player)} alt={player.name}/><strong>{player.name}</strong><span>{player.team || player.club || 'Live profile'}</span><div className="plp-compare-slot-rating">{player.rating ? <div className="rating-badge rating-badge--sm">{player.rating}</div> : <span className="live-profile-pill">LIVE</span>}<span>{player.position || player.pos || ''}</span></div><button className="plp-compare-remove" type="button" onClick={()=>removeCompare(index)}>×</button></div> : <div className="plp-compare-slot plp-compare-slot--empty" key={index}>Select a player</div>;
              })}
            </div>
            <button className="btn btn--lime btn--sm" style={{width:'100%'}} type="button" disabled={comparePlayers.length<2} onClick={()=>setCompareOpen(true)}>COMPARE PLAYERS <ArrowRight size={13}/></button>
          </div>

          <div className="panel" style={{marginBottom:10}}>
            <div className="panel-head"><div className="panel-title"><TrendingUp size={12}/> Rising Players</div></div>
            {RISING.map(r=><button key={r.rank} type="button" className="plp-rising-row player-row-button" onClick={()=>openProfile(localToProfile(r))}><div className="plp-rising-num">{r.rank}</div><ApiPlayerImage name={r.name} fallbackSrc={r.img} alt={r.name}/><div className="plp-rising-info"><strong>{r.name}</strong><span>{r.sub}</span></div><div><div className="rating-badge rating-badge--sm">{r.rating}</div><div className="trend-up">{r.delta}</div></div></button>)}
          </div>

          <div className="panel">
            <div className="panel-head"><div className="panel-title">Archetype Distribution</div></div>
            <HexRadarSmall/>
            <div className="archetype-mini-grid">{[['Playmaker','18%'],['Box-to-Box','22%'],['Winger','16%'],['Goal Scorer','17%'],['Defensive Mid','12%'],['Ball Winner','15%']].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
          </div>
        </div>
      </div>

      <div className="founder-strip" style={{marginTop:16}}><Crown size={22}/><strong>Get World Cup Founder Pass</strong><span>Unlock premium insights, advanced filters and exclusive World Cup content.</span><button type="button" className="btn btn--lime" onClick={()=>navigateTo('/pricing')}>EXPLORE PLANS <ArrowRight size={14}/></button></div>

      <PlayerProfileModal player={activePlayer} stats={activeStats} loading={profileLoading} onClose={()=>setActivePlayer(null)} onCompare={addToCompare}/>
      {compareOpen && <CompareModal players={comparePlayers} onClose={()=>setCompareOpen(false)}/>} 
    </div>
  );
}
