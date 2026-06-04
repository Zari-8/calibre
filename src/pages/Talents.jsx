import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, Bookmark, BookmarkCheck, ChevronRight, Crown, Filter,
  Globe, Route, Search, SlidersHorizontal, Sparkles, Star, TrendingUp, Zap
} from 'lucide-react';
import { asianTalents, TALENT_REGIONS } from '../data/calibreData.js';
import { navigateTo } from '../components/NavLink.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import { searchPlayerProfiles } from '../services/apiFootball.js';

const LOCAL_TALENTS = [
  { name:'Ibrahim Musa', age:19, nation:'Nigeria', flag:'🇳🇬', league:'NPFL', club:'Remo Stars', role:'Wide Creator', position:'RW', rating:77, potential:87, readiness:82, trend:'+12%', region:'africa', trajectory:'rising', nextStep:'Belgian Pro League watchlist', pathway:['NPFL breakout','Belgian Pro League minutes','Top-five league rotation'], localImage:'/assets/players/ibrahim-musa.jpg' },
  { name:'Tawanda Moyo', age:18, nation:'Zimbabwe', flag:'🇿🇼', league:'Zimbabwe PSL', club:'FC Platinum', role:'Controller', position:'CM', rating:71, potential:83, readiness:66, trend:'+8%', region:'africa', trajectory:'rising', nextStep:'Stay and dominate current league first', pathway:['Zimbabwe PSL starter','Regional step-up','Belgian or Dutch development move'], localImage:'/assets/players/neutral-player.svg' },
  { name:'Mateo Silva', age:20, nation:'Uruguay', flag:'🇺🇾', league:'Uruguay Primera', club:'Nacional', role:'Pressing Engine', position:'CM', rating:80, potential:88, readiness:79, trend:'+10%', region:'south_america', trajectory:'rising', nextStep:'Eredivisie development move', pathway:['Uruguay Primera starter','Eredivisie development move','Top-five league squad'], localImage:'/assets/players/florian-wirtz.jpg' },
  { name:'Noah Adebayo', age:17, nation:'Nigeria', flag:'🇳🇬', league:'Academy / U21', club:'Enyimba Youth', role:'False Nine', position:'ST', rating:74, potential:90, readiness:63, trend:'+15%', region:'academy', trajectory:'rising', nextStep:'Needs one senior-minutes season', pathway:['Academy / U21','NPFL senior minutes','European development league'], localImage:'/assets/players/neutral-player.svg' },
  { name:'Milan Petrovic', age:19, nation:'Serbia', flag:'🇷🇸', league:'Serbian SuperLiga', club:'Čukarički', role:'Ball-Winning Midfielder', position:'DM', rating:76, potential:85, readiness:75, trend:'+9%', region:'europe', trajectory:'rising', nextStep:'Belgian Pro League or 2. Bundesliga minutes', pathway:['Serbian SuperLiga','Belgian Pro League / 2. Bundesliga','Top-five league rotation'], localImage:'/assets/players/vitinha.jpg' },
  { name:'Sofía Benítez', age:20, nation:'Argentina', flag:'🇦🇷', league:'Liga Femenina', club:'River Plate Women', role:'Inside Forward', position:'LW', rating:78, potential:88, readiness:77, trend:'+11%', region:'south_america', trajectory:'rising', nextStep:'Liga F or WSL development move', pathway:['Argentina senior football','Liga F / WSL development move','Champions League-level squad'], localImage:'/assets/players/lamine-yamal.jpg' },
];

const MAX_DISCOVERY_AGE = 22;

const ESTABLISHED_DISCOVERY_EXCLUSIONS = new Set([
  'Takefusa Kubo',
  'Lee Kang-in',
  'Kaoru Mitoma',
  'Ao Tanaka',
  'Hwang Hee-chan',
  'Gue-sung Cho',
  'Chanathip Songkrasin',
  'Nguyen Quang Hai',
  'Salem Al-Dawsari',
  'Yasser Al-Shahrani',
  'Akram Afif',
  'Florian Wirtz',
]);

function isDiscoveryTalent(player) {
  const age = Number(player?.age);
  const trajectory = String(player?.trajectory || '').toLowerCase();
  const trend = Number(String(player?.trend || '0').replace('%', '').replace('+', ''));

  return Number.isFinite(age)
    && age >= 16
    && age <= MAX_DISCOVERY_AGE
    && trajectory === 'rising'
    && Number.isFinite(trend)
    && trend > 0
    && !ESTABLISHED_DISCOVERY_EXCLUSIONS.has(player?.name);
}

const NORMALISED_ASIAN = asianTalents
  .filter(isDiscoveryTalent)
  .map((p, index) => ({
  ...p,
  position: /Forward|Striker/.test(p.role) ? 'ST' : /Fullback/.test(p.role) ? 'FB' : /Wide|Inside/.test(p.role) ? 'RW' : 'CM',
  potential: Math.min(94, p.rating + (p.trajectory === 'rising' ? 7 : 3)),
  pathway: [p.league, p.nextStep, p.rating >= 82 ? 'Top-five league impact player' : 'Senior-minutes consolidation'],
  localImage: ['/assets/players/lamine-yamal.jpg','/assets/players/pedri.jpg','/assets/players/florian-wirtz.jpg','/assets/players/vitinha.jpg'][index % 4],
}));

const TALENTS = [...LOCAL_TALENTS, ...NORMALISED_ASIAN].filter(isDiscoveryTalent);
const VIEW_TABS = [
  { key:'discover', label:'Discovery Pool', icon:Sparkles },
  { key:'pathways', label:'Trajectory Pathways', icon:Route },
  { key:'rankings', label:'Rising Rankings', icon:TrendingUp },
];
const POSITION_OPTIONS = ['all','RW','LW','CM','DM','ST','FB'];

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function trendValue(trend='0') { return Number.parseFloat(String(trend).replace('%','').replace('+','')) || 0; }
function imageFor(player) {
  return player.verifiedImage || player.apiImage || '/assets/players/neutral-player.svg';
}
function playerKey(player) { return player.id ? `api-${player.id}` : player.name; }
function regionForNation(nation='') {
  const value = String(nation).toLowerCase();
  if (/nigeria|ghana|senegal|morocco|egypt|algeria|south africa|zimbabwe|cameroon|mali|ivory coast|côte d/i.test(value)) return 'africa';
  if (/brazil|argentina|uruguay|colombia|chile|ecuador|paraguay|peru|venezuela/i.test(value)) return 'south_america';
  if (/japan|korea|china|india|indonesia|australia|thailand|vietnam|malaysia|singapore|saudi|qatar|uae/i.test(value)) return 'asia';
  return 'europe';
}
function roleForPosition(position='') {
  const value = String(position).toLowerCase();
  if (/goalkeeper|keeper/.test(value)) return 'Goalkeeper';
  if (/defender|back/.test(value)) return 'Defensive Prospect';
  if (/midfielder/.test(value)) return 'Emerging Midfielder';
  if (/attacker|forward|striker/.test(value)) return 'Emerging Forward';
  return 'Emerging Talent';
}
function shortPosition(position='') {
  const value = String(position).toLowerCase();
  if (/goalkeeper|keeper/.test(value)) return 'GK';
  if (/defender|back/.test(value)) return 'DF';
  if (/midfielder/.test(value)) return 'CM';
  if (/attacker|forward|striker/.test(value)) return 'ST';
  return 'U22';
}
function liveTalentFromProfile(profile) {
  const age = Number(profile.age || 0);
  const position = shortPosition(profile.position);
  const nation = profile.nationality || 'International';
  return {
    id: profile.id, name: profile.name, age: age || '—', nation, flag: '🌍', league: 'Live API profile', club: 'Club loads with stats feed',
    role: roleForPosition(profile.position), position, rating: 'API', potential: 'Pending', readiness: 'LIVE', trend: 'Profile found',
    region: regionForNation(nation), trajectory: 'profile', nextStep: 'Run Calibre trajectory analysis',
    pathway: ['API-Football identity profile', 'Statistics and minutes ingest', 'Calibre Next Step projection'], image: profile.image, provisional: true, source: 'api-profile',
  };
}
function numeric(value, fallback=0) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }

function TalentCard({ player, selected, shortlisted, onSelect, onToggleShortlist }) {
  return (
    <article className={`talent-result-card${selected ? ' is-selected' : ''}`} onClick={() => onSelect(player)}>
      <ApiPlayerImage name={player.name} preferredSrc={imageFor(player)} fallbackSrc="/assets/players/neutral-player.svg" allowLookup={false} alt={player.name} loading="lazy"/>
      <div className="talent-result-card__body">
        <div className="talent-result-card__topline"><span>{player.flag} {player.nation}</span><b>{player.provisional ? 'LIVE' : player.rating}</b></div>
        <h3>{player.name}</h3>
        <p>{player.position} · {player.club}</p>{player.provisional && <small className="talent-live-profile">API DIRECTORY PROFILE · MODEL PENDING</small>}
        <div className="talent-result-card__meta"><span>{player.role}</span><span>{player.age} yrs</span><span className="trend-up">{player.trend}</span></div>
        <div className="talent-result-card__footer">
          <span>{player.nextStep}</span>
          <button type="button" aria-label={`${shortlisted ? 'Remove' : 'Add'} ${player.name} ${shortlisted ? 'from' : 'to'} shortlist`} onClick={(event) => { event.stopPropagation(); onToggleShortlist(player.name); }}>
            {shortlisted ? <BookmarkCheck size={15}/> : <Bookmark size={15}/>}
          </button>
        </div>
      </div>
    </article>
  );
}

function Pathway({ player }) {
  const stages = player.pathway || [player.league, player.nextStep, 'Senior-minutes consolidation'];
  return (
    <section className="trajectory-panel">
      <div className="trajectory-panel__head">
        <div><span>Talent trajectory pathway</span><h2>{player.name}</h2></div>
        <div className="trajectory-readiness"><strong>{player.provisional ? 'LIVE' : player.readiness}</strong><small>{player.provisional ? 'API profile' : 'Readiness'}</small></div>
      </div>
      <p className="trajectory-panel__intro">{player.provisional ? 'This player identity is live from API-Football. The pathway shell is ready, but Calibre will only publish the rating and Next Step projection after the statistics, minutes and league-strength layers have been ingested.' : 'The projection is relative to age, role, league strength, senior minutes and current trajectory. It is a development pathway, not a fixed transfer prediction.'}</p>
      <div className="trajectory-path">
        {stages.map((stage, index) => (
          <div className={`trajectory-step${index === 1 ? ' is-next' : ''}`} key={`${stage}-${index}`}>
            <div className="trajectory-step__num">0{index + 1}</div>
            <div><span>{index === 0 ? 'Current level' : index === 1 ? 'Next step' : 'Development ceiling'}</span><strong>{stage}</strong></div>
            {index < stages.length - 1 && <ChevronRight size={17}/>} 
          </div>
        ))}
      </div>
      <div className="trajectory-panel__metrics">
        <div><span>Current rating</span><strong>{player.provisional ? 'Pending ingest' : player.rating}</strong></div>
        <div><span>Potential band</span><strong>{player.provisional ? 'Model pending' : player.potential}</strong></div>
        <div><span>30-day movement</span><strong>{player.provisional ? 'Awaiting stats' : player.trend}</strong></div>
        <div><span>League context</span><strong>{player.league}</strong></div>
      </div>
    </section>
  );
}

export default function Talents() {
  const [view, setView] = useState('discover');
  const [region, setRegion] = useState('all');
  const [age, setAge] = useState('all');
  const [position, setPosition] = useState('all');
  const [potential, setPotential] = useState('70');
  const [sort, setSort] = useState('readiness');
  const [trajectory, setTrajectory] = useState('all');
  const [query, setQuery] = useState('');
  const [moreFilters, setMoreFilters] = useState(false);
  const [selectedName, setSelectedName] = useState('Ibrahim Musa');
  const [shortlist, setShortlist] = useState(['Ibrahim Musa','Mateo Silva']);
  const [liveTalents, setLiveTalents] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveSearched, setLiveSearched] = useState(false);
  const resultsRef = useRef(null);

  useEffect(() => {
    const search = query.trim();
    if (search.length < 3) { setLiveTalents([]); setLiveSearched(false); setLiveLoading(false); return undefined; }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLiveLoading(true);
      searchPlayerProfiles(search)
        .then(rows => {
          if (cancelled) return;
          const talents = rows
          .filter(row => {
            const age = Number(row.age);
            return Number.isFinite(age) && age >= 16 && age <= MAX_DISCOVERY_AGE;
          })
          .map(liveTalentFromProfile);
          setLiveTalents(talents);
          setLiveSearched(true);
        })
        .catch(() => { if (!cancelled) { setLiveTalents([]); setLiveSearched(true); } })
        .finally(() => { if (!cancelled) setLiveLoading(false); });
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query]);

  const liveMode = query.trim().length >= 3;
  const sourceTalents = liveMode && liveSearched ? liveTalents : TALENTS;

  const filtered = useMemo(() => sourceTalents
    .filter(p => region === 'all' || p.region === region)
    .filter(p => age === 'all' || !Number.isFinite(Number(p.age)) || (age === 'u18' ? Number(p.age) <= 18 : age === 'u21' ? Number(p.age) <= 21 : Number(p.age) <= 23))
    .filter(p => position === 'all' || p.position === position)
    .filter(p => p.provisional || numeric(p.potential) >= Number(potential))
    .filter(p => p.provisional || trajectory === 'all' || p.trajectory === trajectory)
    .filter(p => liveMode || `${p.name} ${p.club} ${p.league} ${p.role} ${p.nation}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a,b) => sort === 'rating' ? numeric(b.rating) - numeric(a.rating) : sort === 'trend' ? trendValue(b.trend) - trendValue(a.trend) : sort === 'age' ? numeric(a.age,99) - numeric(b.age,99) : numeric(b.readiness) - numeric(a.readiness)),
  [sourceTalents, region, age, position, potential, trajectory, query, sort, liveMode]);

  const selected = sourceTalents.find(player => player.name === selectedName) || TALENTS.find(player => player.name === selectedName) || filtered[0] || TALENTS[0];
  const ranked = [...TALENTS].sort((a,b) => (numeric(b.readiness) + numeric(b.potential) + trendValue(b.trend)) - (numeric(a.readiness) + numeric(a.potential) + trendValue(a.trend))).slice(0,10);
  const counts = Object.fromEntries(TALENT_REGIONS.map(item => [item.key, item.key === 'all' ? sourceTalents.length : sourceTalents.filter(p => p.region === item.key).length]));

  function toggleShortlist(name) {
    setShortlist(current => current.includes(name) ? current.filter(item => item !== name) : [...current, name]);
  }

  function resetFilters() {
    setRegion('all'); setAge('all'); setPosition('all'); setPotential('70'); setSort('readiness'); setTrajectory('all'); setQuery('');
  }

  return (
    <div className="page talents-page">
      <div className="td-header">
        <div className="td-title">
          <div className="td-title-icon"><Zap size={20}/></div>
          <div><h1>Talent <em>Discovery</em></h1><p>Discover, compare and project the next generation of footballers.</p></div>
        </div>
        <div className="td-header-stats"><span><b>{liveMode ? liveTalents.length : TALENTS.length}</b> {liveMode ? 'live matches' : 'indexed'}</span><span><b>{shortlist.length}</b> shortlisted</span></div>
      </div>

      <div className="talent-mode-tabs" role="tablist" aria-label="Talent discovery views">
        {VIEW_TABS.map(({key,label,icon:Icon}) => <button type="button" role="tab" aria-selected={view === key} className={view === key ? 'is-active' : ''} key={key} onClick={() => setView(key)}><Icon size={15}/>{label}</button>)}
      </div>

      <section className="talent-filter-shell">
        <label className="talent-search"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search player, club, role or league" /></label>
        <div className="td-filters">
          <select className="td-filter-select" aria-label="Age filter" value={age} onChange={event=>setAge(event.target.value)}><option value="all">All ages</option><option value="u18">U18</option><option value="u21">U21</option><option value="u23">U22</option></select>
          <select className="td-filter-select" aria-label="Position filter" value={position} onChange={event=>setPosition(event.target.value)}>{POSITION_OPTIONS.map(item=><option key={item} value={item}>{item === 'all' ? 'All positions' : item}</option>)}</select>
          <select className="td-filter-select" aria-label="Potential filter" value={potential} onChange={event=>setPotential(event.target.value)}><option value="70">Potential 70+</option><option value="80">Potential 80+</option><option value="85">Potential 85+</option><option value="90">Potential 90+</option></select>
          <select className="td-filter-select" aria-label="Sort talents" value={sort} onChange={event=>setSort(event.target.value)}><option value="readiness">Sort: readiness</option><option value="rating">Sort: rating</option><option value="trend">Sort: trajectory</option><option value="age">Sort: youngest</option></select>
          <button className={`btn btn--outline btn--sm${moreFilters ? ' is-active' : ''}`} type="button" onClick={()=>setMoreFilters(value=>!value)}><SlidersHorizontal size={14}/> MORE FILTERS</button>
          <button className="talent-reset" type="button" onClick={resetFilters}>Reset</button>
        </div>
        {moreFilters && <div className="talent-advanced-filters"><Filter size={14}/><span>Trajectory</span>{['all','rising','stable','peak'].map(item=><button className={trajectory===item?'is-active':''} type="button" key={item} onClick={()=>setTrajectory(item)}>{item}</button>)}</div>}
      </section>

      <div className={`talent-api-status${liveMode ? ' is-live' : ''}`}><span className="live-dot" />{liveLoading ? 'Searching API-Football U22 profiles…' : liveMode ? `${liveTalents.length} live U22 profile matches · identity and portraits from API-Football` : 'Curated launch pool · type at least 3 letters to search the live U22 directory'}</div>

      <div className="td-region-tabs">
        {TALENT_REGIONS.map(item => <button key={item.key} type="button" className={`td-region-tab ${region===item.key?'active':''}`} onClick={()=>setRegion(item.key)}>{item.label}<span className="td-region-count">{counts[item.key] || 0}</span></button>)}
      </div>

      {view === 'discover' && <>
        <Pathway player={selected}/>
        <div className="talent-results-head" ref={resultsRef}><div><span>{liveMode ? 'API-Football U22 directory' : 'Curated discovery pool'}</span><strong>{filtered.length} talents match your filters</strong></div><button type="button" onClick={()=>setView('pathways')}>Open pathways <ArrowRight size={14}/></button></div>
        <div className="talent-results-grid">
          {filtered.length ? filtered.map(player => <TalentCard key={playerKey(player)} player={player} selected={selected.name===player.name} shortlisted={shortlist.includes(player.name)} onSelect={player=>setSelectedName(player.name)} onToggleShortlist={toggleShortlist}/>) : <div className="talent-empty"><Search size={22}/><h3>No talents match those filters.</h3><button type="button" onClick={resetFilters}>Reset filters</button></div>}
        </div>
      </>}

      {view === 'pathways' && <div className="pathway-workspace">
        <div className="pathway-list">
          <div className="pathway-list__head"><span>Trajectory watchlist</span><strong>Select a talent to inspect the pathway model</strong></div>
          {filtered.map(player=><button type="button" className={player.name===selected.name?'is-active':''} key={playerKey(player)} onClick={()=>setSelectedName(player.name)}><ApiPlayerImage name={player.name} preferredSrc={imageFor(player)} fallbackSrc="/assets/players/neutral-player.svg" allowLookup={false} alt={player.name} loading="lazy"/><span><strong>{player.name}</strong><small>{player.club} · {player.role}</small></span><b>{player.provisional ? 'LIVE' : player.readiness}</b></button>)}
        </div>
        <Pathway player={selected}/>
      </div>}

      {view === 'rankings' && <section className="talent-ranking-panel">
        <div className="talent-ranking-panel__head"><div><span>Trajectory-adjusted ranking</span><h2>Players moving fastest</h2></div><p>Readiness, potential and recent movement combine to surface the most actionable prospects.</p></div>
        {ranked.map((player,index)=><button type="button" className="talent-ranking-row" key={player.name} onClick={()=>{setSelectedName(player.name);setView('pathways')}}><i>{String(index+1).padStart(2,'0')}</i><ApiPlayerImage name={player.name} preferredSrc={imageFor(player)} fallbackSrc="/assets/players/neutral-player.svg" allowLookup={false} alt={player.name} loading="lazy"/><span><strong>{player.name}</strong><small>{player.flag} {player.club} · {player.role}</small></span><em>{player.trend}</em><b>{clamp(Math.round((player.readiness+player.potential)/2),0,99)}</b></button>)}
      </section>}

      <div className="founder-strip" style={{marginTop:18}}>
        <Crown size={22} className="founder-strip-icon"/>
        <strong>Get World Cup Founder Pass</strong>
        <span>Unlock premium insights, advanced filters &amp; exclusive World Cup content.</span>
        <button type="button" className="btn btn--lime" onClick={()=>navigateTo('/pricing')}>EXPLORE PLANS <ArrowRight size={14}/></button>
      </div>
    </div>
  );
}
