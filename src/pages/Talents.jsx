import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, Bookmark, BookmarkCheck, ChevronRight, Crown, Filter,
  FileText, Globe, GraduationCap, Route, Search, SlidersHorizontal, Sparkles, Star, TrendingUp, X, Zap
} from 'lucide-react';
import { asianTalents, TALENT_REGIONS } from '../data/calibreData.js';
import { navigateTo } from '../components/NavLink.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import ShareBar, { shareUrl } from '../components/Share.jsx';
import CommissionForm from '../components/CommissionForm.jsx';
import DiscoveryDossier from '../components/DiscoveryDossier.jsx';
import useAuth from '../hooks/useAuth.js';
import { resolveTier, can } from '../services/access.js';
import { searchPlayerProfiles } from '../services/apiFootball.js';
import { getSupabaseTalentCandidates } from '../services/supabasePlayers.js';
import { calibreRating, resolveRating } from '../services/calibreRating.js';
import { deriveArchetype } from '../services/playerTraits.js';
import { leagueContext, LEAGUES } from '../data/leagues.js';
import { loadYouthProspects } from '../services/youthProspects.js';

// Decode HTML entities that survive in stored/imported names ("O&apos;Reilly" → "O'Reilly").
function cleanName(value){
  return String(value ?? '')
    .replace(/&apos;|&#0?39;/g, "'")
    .replace(/&quot;|&#0?34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// Fabricated demo players removed. The discovery pool is now sourced from the
// real Supabase registry (scored by calibreRating); live search covers the rest.
const LOCAL_TALENTS = [];

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
  { key:'youth', label:'Youth Radar', icon:GraduationCap },
];
const POSITION_OPTIONS = ['all','RW','LW','CM','DM','ST','FB'];

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function trendValue(trend='0') { return Number.parseFloat(String(trend).replace('%','').replace('+','')) || 0; }
function imageFor(player) {
  return player.verifiedImage || player.apiImage || player.image || player.img || player.localImage || '';
}
function playerApiId(player) {
  return player.apiPlayerId ?? (player.source === 'api-profile' || player.source === 'supabase-registry' ? player.id : null);
}
function allowOfficialLookup(player) {
  return Boolean(playerApiId(player) || player.source === 'api-profile' || player.source === 'supabase-registry');
}
function playerKey(player) { return player.id ? `api-${player.id}` : player.name; }
function regionForNation(nation='') {
  const value = String(nation).toLowerCase();
  if (/nigeria|ghana|senegal|morocco|egypt|algeria|south africa|zimbabwe|cameroon|mali|ivory coast|côte d/i.test(value)) return 'africa';
  if (/brazil|argentina|uruguay|colombia|chile|ecuador|paraguay|peru|venezuela/i.test(value)) return 'south_america';
  if (/saudi arabia|qatar|uae|united arab emirates|bahrain|oman|kuwait/i.test(value)) return 'saudi';
  if (/united states|usa|canada|mexico|costa rica|honduras|jamaica|panama|guatemala|trinidad|el salvador/i.test(value)) return 'north_america';
  if (/japan|korea|china|india|indonesia|australia|thailand|vietnam|malaysia|singapore/i.test(value)) return 'asia';
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
    id: profile.id, name: cleanName(profile.name), age: age || '—', nation, flag: '🌍', league: 'Live API profile', club: 'Club loads with stats feed',
    role: roleForPosition(profile.position), position, rating: 'API', potential: 'Pending', readiness: 'LIVE', trend: 'Profile found',
    region: regionForNation(nation), trajectory: 'profile', nextStep: 'Run Calibre trajectory analysis',
    pathway: ['API-Football identity profile', 'Statistics and minutes ingest', 'Calibre Next Step projection'], image: profile.image, provisional: true, source: 'api-profile',
  };
}
function registryTalentFromProfile(profile) {
  const minutes = numeric(profile.minutes);
  const appearances = numeric(profile.appearances);
  const starts = numeric(profile.starts);
  const goals = numeric(profile.goals);
  const assists = numeric(profile.assists);
  const apiRating = numeric(profile.api_average_rating ?? profile.apiAverageRating);
  // Calibre rating from the shared engine (one number, every page). Honors a
  // stored 0-99 rating if the model has written one; otherwise computes from
  // minutes, output, role, league and age. Form & Impact are proxied for now.
  const scored = resolveRating(profile);
  const rating = scored.rating != null ? scored.rating : '—';
  const ratingProvisional = scored.provisional === true && scored.rating != null;
  const breakdown = scored.breakdown;
  const hasEvidence = minutes > 0 || appearances > 0 || apiRating > 0;
  const age = Number(profile.age);
  const startRate = appearances > 0 ? starts / appearances : 0;
  const experience = clamp(minutes / 4500, 0, 1) * 100; // senior-minutes evidence, saturating
  const ratingValue = Number.isFinite(Number(rating)) ? Number(rating) : 60;
  // Readiness = how proven the player is right now: current Calibre level
  // reinforced by accumulated senior minutes and regular-starter reliability.
  // Career-minute totals saturate (÷4500) so they sharpen the score instead of
  // pegging everyone at the top bucket the way the old minutes-only ladder did.
  const readiness = hasEvidence
    ? clamp(Math.round(ratingValue * 0.6 + experience * 0.2 + clamp(startRate * 100, 0, 100) * 0.2), 40, 99)
    : 60;
  const ratingNum = Number.isFinite(Number(rating)) ? Number(rating) : null;
  // Real projection: current level + development headroom. Younger players and
  // those with room below the elite ceiling get more upside; a player already
  // near the top, or older, gets a smaller, honest bump. Trajectory (the engine's
  // age/form component) nudges it. Not a fixed prediction — a development band.
  const potential = ratingNum == null
    ? 'Review'
    : (() => {
        const youth    = clamp((23 - age) / (23 - 16), 0, 1);              // 1.0 ≤16 → 0 ≥23
        const headroom = clamp((92 - ratingNum) / 30, 0, 1);              // less ceiling near elite
        const traj     = breakdown?.Trajectory != null
          ? clamp((breakdown.Trajectory - 55) / 30, 0, 1)
          : youth;
        const upside   = Math.round(2 + youth * 7 + headroom * 3 + traj * 2); // ~2..14
        return clamp(ratingNum + upside, ratingNum, 96);
      })();
  // Card momentum signal — the real ceiling headroom, replacing the old
  // "EVIDENCE READY" placeholder. Shows how much projected room is left.
  const headroomDelta = (ratingNum != null && typeof potential === 'number')
    ? potential - ratingNum
    : null;
  const momentum = headroomDelta == null
    ? 'Awaiting stats'
    : headroomDelta >= 6 ? `High ceiling +${headroomDelta}`
    : headroomDelta >= 3 ? `Rising +${headroomDelta}`
    : headroomDelta >= 1 ? `Near ceiling +${headroomDelta}`
    : 'At projected ceiling';
  // Tier-aware next-step recommendation: uses the player's current league tier,
  // rating and minutes to suggest a concrete development move rather than a
  // generic label. E.g. a Tier 2 player rated 76+ with 1800+ min → "Step up to
  // a mid-table Tier 1 league for higher-level minutes."
  const currentTier = (() => {
    const lid = profile.league_id ?? profile.leagueId;
    const l = lid ? LEAGUES[Number(lid)] : null;
    return l ? l.tier : null;
  })();

  const nextStep = (() => {
    if (minutes < 900) return 'Build a larger senior-minutes sample at current level';
    if (minutes < 1800) return currentTier === 1
      ? 'Needs consistent Tier 1 starts before a role-fit review'
      : 'Senior-minutes consolidation with step-up monitoring';

    // 1800+ minutes — ready for trajectory assessment
    if (currentTier === 1) {
      return ratingNum >= 82 ? 'Established Tier 1 — role optimization and continental exposure'
        : ratingNum >= 75 ? 'Tier 1 rotation — needs a defined starting role'
        : 'Tier 1 fringe — loan to a strong Tier 2 league for guaranteed minutes';
    }
    if (currentTier === 2) {
      return ratingNum >= 78 ? 'Step up to a mid-table Tier 1 league for higher-level minutes'
        : ratingNum >= 72 ? 'Strong Tier 2 performer — Tier 1 bottom-half or top Tier 2 move'
        : 'Consolidate at Tier 2 before a step-up';
    }
    // Tier 3+
    return ratingNum >= 75 ? 'Move to a Tier 2 league as a stepping stone to Tier 1'
      : ratingNum >= 68 ? 'Tier 3 standout — target a Tier 2 league for the next step'
      : 'Continue development at current level';
  })();

  return {
    ...profile,
    id: profile.apiPlayerId ?? profile.id,
    apiPlayerId: profile.apiPlayerId ?? profile.id,
    name: cleanName(profile.name),
    age,
    nation: profile.nationality || 'Unknown',
    flag: '🌐',
    club: profile.club || profile.team || 'Club pending',
    league: profile.league || leagueContext(profile.league_id ?? profile.leagueId) || 'Imported registry',
    role: profile.archetype || deriveArchetype(profile),
    position: shortPosition(profile.position),
    rating,
    ratingProvisional,
    breakdown,
    readiness,
    potential,
    trend: momentum,
    trajectory: hasEvidence ? 'rising' : 'profile',
    region: regionForNation(profile.nationality),
    nextStep,
    pathway: [
      profile.club || profile.team || 'Current club',
      nextStep,
      (typeof potential === 'number' ? `Projected ceiling · ${potential}` : 'Projection pending')
    ],
    image: profile.image || profile.img || null,
    provisional: !hasEvidence,
    source: 'supabase-registry',
    minutes,
    appearances,
    starts,
    goals,
    assists,
    apiRating
  };
}

function numeric(value, fallback=0) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }

function TalentCard({ player, selected, shortlisted, onSelect, onToggleShortlist }) {
  return (
    <article className={`talent-result-card${selected ? ' is-selected' : ''}`} onClick={() => onSelect(player)}>
      <ApiPlayerImage playerId={playerApiId(player)} name={player.name} preferredSrc={imageFor(player)} fallbackSrc="/assets/players/neutral-player.svg" allowLookup={allowOfficialLookup(player)} alt={player.name} loading="lazy"/>
      <div className="talent-result-card__body">
        <div className="talent-result-card__topline"><span>{player.flag} {player.nation}</span><b>{player.provisional ? 'LIVE' : player.rating}</b></div>
        <h3>{player.name}</h3>
        <p>{player.position} · {player.club}</p>{player.provisional && <small className="talent-live-profile">API DIRECTORY PROFILE · MODEL PENDING</small>}
        <div className="talent-result-card__meta"><span>{player.role}</span><span>{player.age} yrs</span><span className="trend-up">{player.trend}</span></div>
        {player.source === 'supabase-registry' && <div className="talent-result-card__meta">
          <span>{numeric(player.minutes)} mins</span>
          <span>{numeric(player.appearances)} apps</span>
          <span>{numeric(player.starts)} starts</span>
          <span>{numeric(player.goals)}G · {numeric(player.assists)}A</span>
          <span>{numeric(player.apiRating) ? `API ${numeric(player.apiRating).toFixed(1)}` : 'rating pending'}</span>
        </div>}
        {player.source === 'supabase-registry' && <div className="talent-result-card__meta">
          <span>U22 · senior-minute screen · registry-backed</span>
        </div>}
        <div className="talent-result-card__footer">
          <span>{player.nextStep}</span>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <button
              type="button"
              style={{background:'none',border:'none',color:'rgba(166,255,0,0.7)',cursor:'pointer',fontSize:10,letterSpacing:'.06em',padding:0,display:'flex',alignItems:'center',gap:3}}
              onClick={(event) => {
                event.stopPropagation();
                const apiId = playerApiId(player);
                if (apiId) {
                  navigateTo(`/players?playerId=${apiId}&player=${encodeURIComponent(player.name)}`);
                } else {
                  navigateTo(`/players?player=${encodeURIComponent(player.name)}`);
                }
              }}
              aria-label={`Open ${player.name} full profile`}
            >
              PROFILE <ArrowRight size={10}/>
            </button>
            <button type="button" aria-label={`${shortlisted ? 'Remove' : 'Add'} ${player.name} ${shortlisted ? 'from' : 'to'} shortlist`} onClick={(event) => { event.stopPropagation(); onToggleShortlist(player.name); }}>
              {shortlisted ? <BookmarkCheck size={15}/> : <Bookmark size={15}/>}
            </button>
          </div>
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
        <div><span>Projected trajectory</span><strong>{player.provisional ? 'Awaiting stats' : player.trend}</strong></div>
        <div><span>League context</span><strong>{player.league}</strong></div>
      </div>
    </section>
  );
}

function TalentDetailModal({ player, pool = [], onClose }) {
  useEffect(() => {
    function onKey(event) { if (event.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const [showCommission, setShowCommission] = useState(false);
  const [showDossier, setShowDossier] = useState(false);
  const { user: dossierUser } = useAuth();
  const canGenerateDossier = can(resolveTier(dossierUser?.email), 'valuation.dossier');
  if (!player) return null;
  // Real DB comparables from the loaded talent pool: closest-rated same-position
  // talents, excluding the player himself (falls back to the whole pool if the
  // position is sparse).
  const _norm = v => (v || '').toString().trim().toUpperCase();
  const _ppos = _norm(player.position || player.role);
  const _others = (pool || []).filter(p => p && p.name !== player.name);
  let _peers = _others.filter(p => _norm(p.position || p.role) === _ppos);
  if (_peers.length < 3) _peers = _others;
  const dossierComparables = _peers
    .map(p => ({ ...p, _d: Math.abs((Number(p.rating) || 0) - (Number(player.rating) || 0)) }))
    .sort((a, b) => a._d - b._d)
    .slice(0, 4);
  const lime = '#c6ff3a';
  const muted = '#9aa4b2';
  const isReg = player.source === 'supabase-registry';
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(3,5,7,0.82)',backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'24px',overflowY:'auto'}}>
      <div onClick={event=>event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${player.name} talent detail`} style={{position:'relative',width:'min(720px,100%)',margin:'4vh 0 40px',background:'#0b0d0f',border:'1px solid #1d242d',borderRadius:18,boxShadow:'0 30px 80px rgba(0,0,0,0.6)',overflow:'hidden'}}>
        <button type="button" onClick={onClose} aria-label="Close" style={{position:'absolute',top:14,right:14,zIndex:2,width:36,height:36,display:'grid',placeItems:'center',borderRadius:10,background:'rgba(255,255,255,0.06)',border:'1px solid #283039',color:muted,cursor:'pointer'}}><X size={18}/></button>
        <div style={{display:'flex',gap:20,alignItems:'center',padding:'26px 26px 18px'}}>
          <div style={{width:110,height:110,borderRadius:14,overflow:'hidden',flex:'0 0 auto',background:'#14181c',border:'1px solid #232b34'}}>
            <ApiPlayerImage playerId={playerApiId(player)} name={player.name} preferredSrc={imageFor(player)} fallbackSrc="/assets/players/neutral-player.svg" allowLookup={allowOfficialLookup(player)} alt={player.name} loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
          </div>
          <div style={{minWidth:0}}>
            <div style={{color:lime,fontSize:12,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:6}}>{player.flag} {player.nation}</div>
            <h2 style={{margin:0,fontSize:30,lineHeight:1.05,color:'#f4f6f8'}}>{player.name}</h2>
            <div style={{color:muted,marginTop:8,fontSize:15}}>{player.position} · {player.club} · {player.age} yrs</div>
            <div style={{color:muted,marginTop:4,fontSize:13}}>{player.role}</div>
          </div>
          <div style={{marginLeft:'auto',textAlign:'right',flex:'0 0 auto'}}>
            <div style={{fontSize:40,fontWeight:800,color:lime,lineHeight:1}}>{player.provisional ? 'LIVE' : player.rating}</div>
            <div style={{fontSize:11,color:muted,letterSpacing:'0.08em',marginTop:4}}>{player.ratingProvisional ? 'INTERIM RATING' : player.provisional ? 'API PROFILE' : 'CALIBRE RATING'}</div>
          </div>
        </div>
        {isReg && <div style={{display:'flex',flexWrap:'wrap',gap:'8px 18px',padding:'0 26px 20px',color:muted,fontSize:13}}>
          <span>{numeric(player.minutes)} mins</span>
          <span>{numeric(player.appearances)} apps</span>
          <span>{numeric(player.starts)} starts</span>
          <span>{numeric(player.goals)}G · {numeric(player.assists)}A</span>
          <span>{numeric(player.apiRating) ? `API ${numeric(player.apiRating).toFixed(1)}` : 'rating pending'}</span>
        </div>}
        <div style={{padding:'0 18px 22px'}}>
          <Pathway player={player}/>
        </div>

        {/* ── Link to full player bank profile ── */}
        <div style={{padding:'0 26px 16px',display:'flex',gap:10}}>
          <button
            type="button"
            className="btn btn--lime btn--sm"
            style={{flex:1}}
            onClick={() => {
              const apiId = playerApiId(player);
              if (apiId) {
                navigateTo(`/players?playerId=${apiId}&player=${encodeURIComponent(player.name)}`);
              } else {
                navigateTo(`/players?player=${encodeURIComponent(player.name)}`);
              }
            }}
          >
            VIEW FULL PROFILE <ArrowRight size={13}/>
          </button>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => {
              const name = encodeURIComponent(player.name);
              navigateTo(`/system-fit?player=${name}`);
            }}
          >
            RUN SYSTEM FIT <ArrowRight size={13}/>

          </button>
        </div>

        {/* ── Discovery Dossier (quiet) ── */}
        <div style={{padding:'0 26px 18px'}}>
          <button type="button" onClick={() => setShowCommission(true)} style={{width:'100%',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,background:'transparent',color:'#9aa4b2',border:'1px solid #232b34',borderRadius:10,padding:'10px 14px',fontFamily:"'Barlow Condensed', sans-serif",fontSize:12,fontWeight:800,letterSpacing:'0.12em',textTransform:'uppercase',cursor:'pointer'}}><FileText size={13}/> Commission a Discovery Dossier · $499</button>
          <div style={{textAlign:'center',fontSize:11,color:'#5f6976',marginTop:8,lineHeight:1.5}}>Should your club bet on him? A commissioned brief on the ceiling, the pathway and the risk.</div>
          {canGenerateDossier && <button type="button" onClick={() => setShowDossier(true)} style={{width:'100%',marginTop:10,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,background:'#c8ff00',color:'#0a0a0a',border:'none',borderRadius:10,padding:'9px 14px',fontFamily:"'Barlow Condensed', sans-serif",fontSize:11,fontWeight:800,letterSpacing:'0.12em',textTransform:'uppercase',cursor:'pointer'}}>Generate Discovery dossier \u2192</button>}
        </div>

        {/* ── Share bar ── */}
        <div style={{padding:'0 26px 22px'}}>
          <ShareBar
            text={`${player.name} — ${Math.round(player.rating || 0)} Calibre rating, ${player.role || 'rising talent'}. Scouted on Calibre.`}
            url={shareUrl('/talents')}
            label={false}
          />
        </div>

        {showCommission && <CommissionForm player={{ name: player.name, apiPlayerId: playerApiId(player), pos: player.position }} club={{ name: player.club }} dossierType="discovery" onClose={() => setShowCommission(false)} />}
        {showDossier && <DiscoveryDossier player={player} buyerKind="club" recipient={dossierUser?.email} comparables={dossierComparables} onClose={() => setShowDossier(false)} />}
      </div>
    </div>
  );
}

export default function Talents() {
  const [view, setView] = useState('discover');
  const [region, setRegion] = useState('all');
  const [age, setAge] = useState('all');
  const [position, setPosition] = useState('all');
  const [potential, setPotential] = useState('70');
  const [minRating, setMinRating] = useState('all');
  const [sort, setSort] = useState('readiness');
  const [trajectory, setTrajectory] = useState('all');
  const [query, setQuery] = useState('');
  const [moreFilters, setMoreFilters] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const [detailPlayer, setDetailPlayer] = useState(null);
  const [visibleCount, setVisibleCount] = useState(48);
  const [shortlist, setShortlist] = useState([]);
  const [liveTalents, setLiveTalents] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveSearched, setLiveSearched] = useState(false);
  const [registryTalents, setRegistryTalents] = useState([]);
  const [registryLoading, setRegistryLoading] = useState(true);
  // Youth Radar (academy prospect directory — identity + age only, no ratings)
  const [youthProspects, setYouthProspects] = useState([]);
  const [youthLoading, setYouthLoading] = useState(false);
  const [youthLoaded, setYouthLoaded] = useState(false);
  const [youthAge, setYouthAge] = useState('all');
  const [youthPos, setYouthPos] = useState('all');
  const [youthLeague, setYouthLeague] = useState('all');
  const [youthQuery, setYouthQuery] = useState('');
  const [youthPlayingUpOnly, setYouthPlayingUpOnly] = useState(false);
  const resultsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    getSupabaseTalentCandidates({ limit: 240 })
      .then(rows => {
        if (cancelled) return;

        const candidates = rows
          .map(registryTalentFromProfile)
          .filter(player =>
            Number.isFinite(Number(player.age))
            && Number(player.age) >= 16
            && Number(player.age) <= MAX_DISCOVERY_AGE
            && (player.minutes >= 450 || player.appearances >= 8)
          );

        setRegistryTalents(candidates);
        if (candidates[0]) {
          setSelectedName(current =>
            current === 'Ibrahim Musa' || !candidates.some(player => player.name === current)
              ? candidates[0].name
              : current
          );
        }
      })
      .catch(() => {
        if (!cancelled) setRegistryTalents([]);
      })
      .finally(() => {
        if (!cancelled) setRegistryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
  const sourceTalents =
    liveMode && liveSearched
      ? liveTalents
      : registryTalents;

  const filtered = useMemo(() => sourceTalents
    .filter(p => region === 'all' || p.region === region)
    .filter(p => age === 'all' || !Number.isFinite(Number(p.age)) || (age === 'u18' ? Number(p.age) <= 18 : age === 'u21' ? Number(p.age) <= 21 : Number(p.age) <= 23))
    .filter(p => position === 'all' || p.position === position)
    .filter(p => p.provisional || numeric(p.potential) >= Number(potential))
    .filter(p => minRating === 'all' || p.provisional || numeric(p.rating) >= Number(minRating))
    .filter(p => p.provisional || trajectory === 'all' || p.trajectory === trajectory)
    .filter(p => liveMode || `${p.name} ${p.club} ${p.league} ${p.role} ${p.nation}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a,b) => sort === 'rating' ? numeric(b.rating) - numeric(a.rating) : sort === 'trend' ? trendValue(b.trend) - trendValue(a.trend) : sort === 'age' ? numeric(a.age,99) - numeric(b.age,99) : numeric(b.readiness) - numeric(a.readiness)),
  [sourceTalents, region, age, position, potential, minRating, trajectory, query, sort, liveMode]);

  useEffect(() => { setVisibleCount(48); }, [region, age, position, potential, minRating, trajectory, query, sort, liveMode]);

  const selected = sourceTalents.find(player => player.name === selectedName) || filtered[0] || sourceTalents[0] || null;
  const ranked = [...sourceTalents]
    .sort((a,b) =>
      numeric(b.minutes) - numeric(a.minutes)
      || numeric(b.apiRating) - numeric(a.apiRating)
      || numeric(b.appearances) - numeric(a.appearances)
      || (numeric(b.goals) + numeric(b.assists)) - (numeric(a.goals) + numeric(a.assists))
      || numeric(b.readiness) - numeric(a.readiness)
    )
    .slice(0,10);
  const counts = Object.fromEntries(TALENT_REGIONS.map(item => [item.key, item.key === 'all' ? sourceTalents.length : sourceTalents.filter(p => p.region === item.key).length]));

  function toggleShortlist(name) {
    setShortlist(current => current.includes(name) ? current.filter(item => item !== name) : [...current, name]);
  }

  function resetFilters() {
    setRegion('all'); setAge('all'); setPosition('all'); setPotential('70'); setMinRating('all'); setSort('readiness'); setTrajectory('all'); setQuery('');
  }

  // Lazy-load the youth directory only when the Youth Radar tab is first opened.
  useEffect(() => {
    if (view !== 'youth' || youthLoaded || youthLoading) return;
    setYouthLoading(true);
    loadYouthProspects()
      .then(rows => { setYouthProspects(rows || []); setYouthLoaded(true); })
      .finally(() => setYouthLoading(false));
  }, [view, youthLoaded, youthLoading]);

  // Distinct leagues present, for the league filter chips.
  const youthLeagueOptions = useMemo(() => {
    const set = new Map();
    for (const p of youthProspects) if (p.youth_league) set.set(p.youth_league, true);
    return ['all', ...set.keys()];
  }, [youthProspects]);

  // Filtered + sorted youth list. Age is the PRIMARY axis (youngest first),
  // so a 15yo anywhere surfaces above an 18yo regardless of league ceiling.
  const youthFiltered = useMemo(() => {
    const q = youthQuery.trim().toLowerCase();
    return youthProspects
      .filter(p => {
        if (youthPlayingUpOnly && !(p.plays_up_years >= 3)) return false;
        if (youthLeague !== 'all' && p.youth_league !== youthLeague) return false;
        if (youthPos !== 'all' && (p.position || '').toLowerCase() !== youthPos.toLowerCase()) return false;
        if (youthAge !== 'all') {
          const a = Number(p.age);
          if (youthAge === '15-16' && !(a <= 16)) return false;
          if (youthAge === '17' && a !== 17) return false;
          if (youthAge === '18' && a !== 18) return false;
          if (youthAge === '19-20' && !(a >= 19)) return false;
        }
        if (q) {
          const hay = `${p.name} ${p.club} ${p.nationality}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) =>
        (Number(a.age) || 99) - (Number(b.age) || 99)
        || (Number(b.plays_up_years) || 0) - (Number(a.plays_up_years) || 0)
        || String(a.name).localeCompare(String(b.name))
      );
  }, [youthProspects, youthQuery, youthAge, youthPos, youthLeague, youthPlayingUpOnly]);

  const YOUTH_POSITIONS = ['all', 'Goalkeeper', 'Defender', 'Midfielder', 'Attacker'];
  const YOUTH_AGE_BANDS = ['all', '15-16', '17', '18', '19-20'];

  // Signal tier from plays_up_years — the honest "how far above level" read.
  function youthSignal(years) {
    if (years >= 6) return { label: 'Extreme', cls: 'extreme' };
    if (years >= 5) return { label: 'Strong', cls: 'strong' };
    if (years >= 4) return { label: 'Notable', cls: 'notable' };
    if (years >= 3) return { label: 'Watchlist', cls: 'watch' };
    return null;
  }

  // Header stats for the Youth Radar.
  const youthStats = useMemo(() => {
    const total = youthProspects.length;
    const leagues = new Set(youthProspects.map(p => p.youth_league).filter(Boolean)).size;
    const extreme = youthProspects.filter(p => p.plays_up_years >= 6).length;
    const youngest = youthProspects.reduce((min, p) => {
      const a = Number(p.age); return (a && a < min) ? a : min;
    }, 99);
    return { total, leagues, extreme, youngest: youngest === 99 ? '—' : youngest };
  }, [youthProspects]);

  // Group the filtered list by league for the sectioned layout.
  const youthByLeague = useMemo(() => {
    const groups = new Map();
    for (const p of youthFiltered) {
      const k = p.youth_league || 'Other';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p);
    }
    return [...groups.entries()];
  }, [youthFiltered]);

  return (
    <div className="page talents-page">
      <div className="td-header">
        <div className="td-title">
          <div className="td-title-icon"><Zap size={20}/></div>
          <div><h1>Talent <em>Discovery</em></h1><p>Find the players nobody is watching — and decide which ones are worth betting on.</p></div>
        </div>
        <div className="td-header-stats"><span><b>{liveMode ? liveTalents.length : sourceTalents.length}</b> {liveMode ? 'live matches' : 'indexed'}</span><span><b>{shortlist.length}</b> shortlisted</span></div>
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
          <select className="td-filter-select" aria-label="Calibre rating filter" value={minRating} onChange={event=>setMinRating(event.target.value)}><option value="all">All ratings</option><option value="80">Calibre 80+</option><option value="75">Calibre 75+</option><option value="70">Calibre 70+</option></select>
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
        {selected && <Pathway player={selected}/>}
        {selected && <div className="talent-share"><ShareBar text={`${selected.name} — Calibre rating ${Math.round(selected.rating)}, ${selected.role || 'rising talent'}. Scouted on Calibre.`} url={shareUrl('/talents')} label={false}/></div>}
        <div className="talent-results-head" ref={resultsRef}><div><span>{liveMode ? 'API-Football U22 directory' : 'Curated discovery pool'}</span><strong>{filtered.length} talents match your filters</strong></div><button type="button" onClick={()=>setView('pathways')}>Open pathways <ArrowRight size={14}/></button></div>
        <div className="talent-results-grid">
          {filtered.length ? filtered.slice(0, visibleCount).map(player => <TalentCard key={playerKey(player)} player={player} selected={selected?.name===player.name} shortlisted={shortlist.includes(player.name)} onSelect={chosen=>{setSelectedName(chosen.name);setDetailPlayer(chosen);}} onToggleShortlist={toggleShortlist}/>) : <div className="talent-empty"><Search size={22}/><h3>No talents match those filters.</h3><button type="button" onClick={resetFilters}>Reset filters</button></div>}
        </div>
        {filtered.length > visibleCount && <div style={{display:'flex',justifyContent:'center',marginTop:18}}>
          <button type="button" className="btn btn--lime" onClick={()=>setVisibleCount(count=>count+48)}>Load more ({filtered.length - visibleCount} remaining)</button>
        </div>}
      </>}

      {view === 'pathways' && <div className="pathway-workspace">
        <div className="pathway-list">
          <div className="pathway-list__head"><span>Trajectory watchlist</span><strong>Select a talent to inspect the pathway model</strong></div>
          {filtered.map(player=><button type="button" className={player.name===selected?.name?'is-active':''} key={playerKey(player)} onClick={()=>setSelectedName(player.name)}><ApiPlayerImage playerId={playerApiId(player)} name={player.name} preferredSrc={imageFor(player)} fallbackSrc="/assets/players/neutral-player.svg" allowLookup={allowOfficialLookup(player)} alt={player.name} loading="lazy"/><span><strong>{player.name}</strong><small>{player.club} · {player.role}</small></span><b>{player.provisional ? 'LIVE' : player.readiness}</b></button>)}
        </div>
        {selected && <Pathway player={selected}/>}
        <div className="tier-explainer" style={{ marginTop:18, padding:'14px 18px', background:'rgba(198,255,58,.04)', border:'1px solid rgba(198,255,58,.12)', borderRadius:10 }}>
          <strong style={{ fontSize:11, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--lime,#c6ff3a)' }}>League tier ladder</strong>
          <p style={{ fontSize:13, opacity:.75, margin:'6px 0 10px', lineHeight:1.5 }}>Calibre grades leagues by competitive strength. The pathway model uses these tiers to recommend development moves — a Tier 2 standout rated 78+ is flagged for a Tier 1 step-up, while a Tier 3 prospect targets Tier 2 first.</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, fontSize:12 }}>
            <div><strong style={{color:'var(--lime,#c6ff3a)'}}>Tier 1</strong><br/><span style={{opacity:.6}}>Premier League, La Liga, Bundesliga, Serie A, Ligue 1</span></div>
            <div><strong style={{color:'var(--lime,#c6ff3a)'}}>Tier 2</strong><br/><span style={{opacity:.6}}>Primeira Liga, Eredivisie, Brasileirão, Pro League, Championship</span></div>
            <div><strong style={{color:'var(--lime,#c6ff3a)'}}>Tier 3</strong><br/><span style={{opacity:.6}}>Liga Profesional, Süper Lig, MLS, Saudi Pro League, J1 League</span></div>
          </div>
        </div>
      </div>}

      {view === 'rankings' && <section className="talent-ranking-panel">
        <div className="talent-ranking-panel__head"><div><span>Trajectory-adjusted ranking</span><h2>Players moving fastest</h2></div><p>Readiness, potential and recent movement combine to surface the most actionable prospects.</p></div>
        {ranked.map((player,index)=><button type="button" className="talent-ranking-row" key={player.name} onClick={()=>{setSelectedName(player.name);setView('pathways')}}><i>{String(index+1).padStart(2,'0')}</i><ApiPlayerImage playerId={playerApiId(player)} name={player.name} preferredSrc={imageFor(player)} fallbackSrc="/assets/players/neutral-player.svg" allowLookup={allowOfficialLookup(player)} alt={player.name} loading="lazy"/><span><strong>{player.name}</strong><small>{player.flag} {player.club} · {player.role}</small></span><em>{player.trend}</em><b>{clamp(Math.round((player.readiness+player.potential)/2),0,99)}</b></button>)}
      </section>}

      {view === 'youth' && <section className="yr">
        <style>{`
          .yr { margin-top: 16px; --yr-line: rgba(255,255,255,0.09); --yr-card: rgba(255,255,255,0.025); --yr-muted: #8b9096; --yr-lime: #c8fa3c; }
          .yr * { box-sizing: border-box; }
          .yr-head { display: grid; grid-template-columns: minmax(220px, 1.1fr) 2fr; gap: 22px; align-items: start; margin-bottom: 18px; }
          .yr-eyebrow { color: var(--yr-lime); font-size: 11px; letter-spacing: .18em; text-transform: uppercase; font-weight: 600; }
          .yr-title { font-family: 'Barlow Condensed', sans-serif; font-size: 38px; line-height: .98; letter-spacing: .01em; margin: 6px 0 10px; color: #fff; text-transform: uppercase; }
          .yr-lede { color: var(--yr-muted); font-size: 13px; line-height: 1.5; max-width: 340px; }
          .yr-lede a { color: var(--yr-lime); text-decoration: none; border-bottom: 1px solid rgba(200,250,60,0.3); }
          .yr-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
          .yr-stat { background: var(--yr-card); border: 1px solid var(--yr-line); border-radius: 12px; padding: 14px 14px 12px; }
          .yr-stat b { display: block; font-family: 'Barlow Condensed', sans-serif; font-size: 30px; line-height: 1; color: #fff; }
          .yr-stat span { display: block; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--yr-muted); margin-top: 6px; }
          .yr-stat small { display: block; font-size: 10.5px; color: var(--yr-lime); margin-top: 3px; }
          .yr-note { display: flex; gap: 10px; align-items: flex-start; background: rgba(200,250,60,0.05); border: 1px solid rgba(200,250,60,0.18); border-radius: 10px; padding: 11px 14px; margin-bottom: 18px; color: #c4c9ce; font-size: 12.5px; line-height: 1.45; }
          .yr-note svg { color: var(--yr-lime); flex: none; margin-top: 1px; }
          .yr-body { display: grid; grid-template-columns: 220px 1fr; gap: 20px; }
          .yr-rail { border-right: 1px solid var(--yr-line); padding-right: 18px; }
          .yr-rail h4 { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--yr-muted); margin: 0 0 10px; }
          .yr-rail .yr-clear { float: right; color: var(--yr-lime); font-size: 11px; cursor: pointer; text-transform: none; letter-spacing: 0; background: none; border: none; }
          .yr-search { display: flex; align-items: center; gap: 8px; background: var(--yr-card); border: 1px solid var(--yr-line); border-radius: 9px; padding: 9px 11px; margin-bottom: 16px; }
          .yr-search input { background: none; border: none; outline: none; color: #fff; font-size: 13px; width: 100%; }
          .yr-search svg { color: var(--yr-muted); flex: none; }
          .yr-field { margin-bottom: 15px; }
          .yr-field label { display: block; font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--yr-muted); margin-bottom: 7px; }
          .yr-field select { width: 100%; background: var(--yr-card); border: 1px solid var(--yr-line); border-radius: 9px; padding: 9px 11px; color: #fff; font-size: 13px; }
          .yr-bands { display: flex; flex-wrap: wrap; gap: 6px; }
          .yr-bands button { background: var(--yr-card); border: 1px solid var(--yr-line); color: #c4c9ce; border-radius: 999px; padding: 6px 11px; font-size: 12px; cursor: pointer; }
          .yr-bands button.on { background: var(--yr-lime); color: #0a0d08; border-color: var(--yr-lime); font-weight: 600; }
          .yr-tiers { display: flex; flex-direction: column; gap: 8px; }
          .yr-tier { display: flex; align-items: center; gap: 9px; font-size: 12.5px; color: #c4c9ce; cursor: pointer; }
          .yr-tier input { accent-color: var(--yr-lime); width: 15px; height: 15px; }
          .yr-tier i { margin-left: auto; font-style: normal; font-size: 11px; color: var(--yr-muted); background: var(--yr-card); border: 1px solid var(--yr-line); border-radius: 6px; padding: 1px 7px; }
          .yr-main { min-width: 0; }
          .yr-league { margin-bottom: 26px; }
          .yr-league-head { display: flex; align-items: center; gap: 10px; padding-bottom: 9px; border-bottom: 1px solid var(--yr-line); margin-bottom: 13px; }
          .yr-league-head img { width: 22px; height: 22px; object-fit: contain; }
          .yr-league-head strong { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; letter-spacing: .03em; text-transform: uppercase; color: #fff; }
          .yr-league-head em { margin-left: auto; font-style: normal; font-size: 11.5px; color: var(--yr-muted); }
          .yr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(228px, 1fr)); gap: 11px; }
          .yr-card { display: flex; gap: 11px; background: var(--yr-card); border: 1px solid var(--yr-line); border-radius: 11px; padding: 12px; transition: border-color .12s, transform .12s; }
          .yr-card:hover { border-color: rgba(200,250,60,0.35); transform: translateY(-1px); }
          .yr-card-img { width: 46px; height: 46px; border-radius: 8px; overflow: hidden; flex: none; background: rgba(255,255,255,0.04); }
          .yr-card-img img { width: 100%; height: 100%; object-fit: cover; }
          .yr-card-body { min-width: 0; flex: 1; }
          .yr-card-body strong { display: block; color: #fff; font-size: 13.5px; line-height: 1.2; }
          .yr-card-body .yr-role { font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--yr-muted); margin: 2px 0 7px; }
          .yr-card-foot { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #c4c9ce; }
          .yr-card-foot .yr-flag { color: var(--yr-muted); }
          .yr-card-side { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; flex: none; }
          .yr-up { text-align: right; }
          .yr-up b { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; line-height: 1; color: var(--yr-lime); }
          .yr-up span { display: block; font-size: 8.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--yr-muted); }
          .yr-sig { font-size: 9.5px; letter-spacing: .04em; text-transform: uppercase; font-weight: 700; padding: 2px 7px; border-radius: 5px; }
          .yr-sig.extreme { background: #b388ff; color: #1a0a2e; }
          .yr-sig.strong { background: #5ec8ff; color: #042033; }
          .yr-sig.notable { background: #4fe3a0; color: #033322; }
          .yr-sig.watch { background: rgba(255,255,255,0.12); color: #c4c9ce; }
          .yr-status { color: var(--yr-muted); font-size: 13px; padding: 30px 4px; }
          .yr-more { display: block; margin: 6px auto 0; background: var(--yr-card); border: 1px solid var(--yr-line); color: #fff; border-radius: 9px; padding: 10px 20px; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; }
          @media (max-width: 880px) { .yr-head { grid-template-columns: 1fr; } .yr-stats { grid-template-columns: repeat(2, 1fr); } .yr-body { grid-template-columns: 1fr; } .yr-rail { border-right: none; border-bottom: 1px solid var(--yr-line); padding-right: 0; padding-bottom: 16px; } }
        `}</style>

        <div className="yr-head">
          <div>
            <div className="yr-eyebrow">Academy &amp; reserve pipelines</div>
            <h2 className="yr-title">Prospect Signals</h2>
            <p className="yr-lede">Young players flagged by how far above their age group they're competing. A discovery surface, <strong style={{color:'#c4c9ce'}}>not a performance ranking</strong>.</p>
          </div>
          <div className="yr-stats">
            <div className="yr-stat"><b>{youthStats.total.toLocaleString()}</b><span>Prospects</span><small>Across all leagues</small></div>
            <div className="yr-stat"><b>{youthStats.leagues}</b><span>Leagues tracked</span><small>Academy &amp; reserve</small></div>
            <div className="yr-stat"><b>{youthStats.extreme}</b><span>Extreme signals</span><small>+6 years up</small></div>
            <div className="yr-stat"><b>{youthStats.youngest}</b><span>Youngest age</span><small>Years old</small></div>
            <div className="yr-stat"><b style={{fontSize:'20px',color:'var(--yr-lime)'}}>LIVE</b><span>Data pipeline</span><small>Updated daily</small></div>
          </div>
        </div>

        <div className="yr-note">
          <Filter size={15}/>
          <span>Signal strength is the age-level gap: a 16-year-old in U21 football reads +5 years up. Youth match data isn't published, so use these as discovery signals, not performance ratings.</span>
        </div>

        <div className="yr-body">
          <aside className="yr-rail">
            <h4>Filters <button type="button" className="yr-clear" onClick={()=>{setYouthQuery('');setYouthAge('all');setYouthPos('all');setYouthLeague('all');setYouthPlayingUpOnly(false);}}>Clear all</button></h4>
            <div className="yr-search">
              <Search size={14}/>
              <input type="text" value={youthQuery} placeholder="Search prospect, club, nation…" onChange={e=>setYouthQuery(e.target.value)}/>
              {youthQuery && <button type="button" style={{background:'none',border:'none',color:'var(--yr-muted)',cursor:'pointer',display:'flex'}} onClick={()=>setYouthQuery('')}><X size={13}/></button>}
            </div>
            <div className="yr-field">
              <label>Age band</label>
              <div className="yr-bands">
                {YOUTH_AGE_BANDS.map(b => <button type="button" key={b} className={youthAge===b?'on':''} onClick={()=>setYouthAge(b)}>{b==='all'?'All':b}</button>)}
              </div>
            </div>
            <div className="yr-field">
              <label>Position</label>
              <select value={youthPos} onChange={e=>setYouthPos(e.target.value)}>
                {YOUTH_POSITIONS.map(p => <option key={p} value={p}>{p==='all'?'All positions':p}</option>)}
              </select>
            </div>
            <div className="yr-field">
              <label>League / competition</label>
              <select value={youthLeague} onChange={e=>setYouthLeague(e.target.value)}>
                {youthLeagueOptions.map(l => <option key={l} value={l}>{l==='all'?'All leagues':l}</option>)}
              </select>
            </div>
            <div className="yr-field">
              <label>Playing up (years)</label>
              <label className="yr-tier"><input type="checkbox" checked={youthPlayingUpOnly} onChange={e=>setYouthPlayingUpOnly(e.target.checked)}/> 3+ years up only <i>{youthProspects.filter(p=>p.plays_up_years>=3).length}</i></label>
            </div>
          </aside>

          <div className="yr-main">
            {youthLoading && <p className="yr-status">Loading prospect directory…</p>}
            {!youthLoading && youthLoaded && youthFiltered.length === 0 && <p className="yr-status">No prospects match these filters. Try widening the age band or clearing the search.</p>}

            {!youthLoading && youthByLeague.map(([league, players]) => (
              <div className="yr-league" key={league}>
                <div className="yr-league-head">
                  {players[0]?.logo && <img src={players[0].logo} alt="" loading="lazy"/>}
                  <strong>{league}</strong>
                  <em>{players.length} prospect{players.length===1?'':'s'}</em>
                </div>
                <div className="yr-grid">
                  {players.slice(0, league === youthLeague || youthLeague !== 'all' ? 200 : 10).map(p => {
                    const sig = youthSignal(p.plays_up_years);
                    return (
                      <article className="yr-card" key={`${p.api_player_id}-${p.season}`}>
                        <div className="yr-card-img">
                          <ApiPlayerImage playerId={p.api_player_id} name={p.name} preferredSrc={p.photo} fallbackSrc="/assets/players/neutral-player.svg" allowLookup={false} alt={cleanName(p.name)} loading="lazy"/>
                        </div>
                        <div className="yr-card-body">
                          <strong>{cleanName(p.name)}</strong>
                          <div className="yr-role">{p.position || '—'}</div>
                          <div className="yr-card-foot">{p.club}</div>
                          <div className="yr-card-foot"><span className="yr-flag">Age {p.age ?? '—'} · {p.nationality || '—'}</span></div>
                        </div>
                        <div className="yr-card-side">
                          {p.plays_up_years >= 1 && <div className="yr-up"><b>+{p.plays_up_years}</b><span>yrs up</span></div>}
                          {sig && <span className={`yr-sig ${sig.cls}`}>{sig.label}</span>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>}

      <div className="founder-strip" style={{marginTop:18}}>
        <Crown size={22} className="founder-strip-icon"/>
        <strong>Get World Cup Founder Pass</strong>
        <span>Unlock premium insights, advanced filters &amp; exclusive World Cup content.</span>
        <button type="button" className="btn btn--lime" onClick={()=>navigateTo('/pricing')}>EXPLORE PLANS <ArrowRight size={14}/></button>
      </div>

      <TalentDetailModal player={detailPlayer} pool={sourceTalents} onClose={()=>setDetailPlayer(null)}/>
    </div>
  );
}
