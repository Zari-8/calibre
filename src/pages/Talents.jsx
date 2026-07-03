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
import { loadWatchlist, addToWatchlist, removeFromWatchlist, mergeLocalIntoAccount } from '../services/watchlist.js';
import { resolveTier, can } from '../services/access.js';
import { searchPlayerProfiles } from '../services/apiFootball.js';
import { getSupabaseTalentCandidates } from '../services/supabasePlayers.js';
import { calibreRating, resolveRating } from '../services/calibreRating.js';
import playerTraits, { deriveArchetype } from '../services/playerTraits.js';
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

// Nationality name -> flag emoji. Handles ISO countries plus the UK home
// nations (England/Scotland/Wales need special subdivision tags), and common
// football-data name variants. Unknown -> globe, never a broken box.
const FLAG_SPECIAL = {
  England: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  Scotland: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
  Wales: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}',
};
const FLAG_ISO = {
  Italy:'IT',France:'FR',Germany:'DE',Spain:'ES',Netherlands:'NL',Belgium:'BE',
  Portugal:'PT',Nigeria:'NG',Brazil:'BR',Argentina:'AR',USA:'US','United States':'US',
  'Saudi Arabia':'SA',Ireland:'IE','Northern Ireland':'GB',Switzerland:'CH',
  Austria:'AT',Denmark:'DK',Sweden:'SE',Norway:'NO',Poland:'PL',Croatia:'HR',
  Serbia:'RS',Turkey:'TR','Türkiye':'TR',Greece:'GR','Czech Republic':'CZ',Czechia:'CZ',
  Ukraine:'UA',Russia:'RU',Morocco:'MA',Algeria:'DZ',Senegal:'SN',Ghana:'GH',
  'Ivory Coast':'CI',"Cote d'Ivoire":'CI',Cameroon:'CM',Egypt:'EG',Tunisia:'TN',
  Mali:'ML',Japan:'JP','South Korea':'KR','Korea Republic':'KR',Australia:'AU',
  Mexico:'MX',Colombia:'CO',Uruguay:'UY',Chile:'CL',Peru:'PE',Ecuador:'EC',
  Paraguay:'PY',Canada:'CA',Albania:'AL',Slovenia:'SI',Slovakia:'SK',Hungary:'HU',
  Romania:'RO',Bulgaria:'BG',Finland:'FI',Iceland:'IS','Cape Verde':'CV',
  'DR Congo':'CD','Congo DR':'CD',Gabon:'GA',Guinea:'GN',Angola:'AO',Zambia:'ZM',
  Zimbabwe:'ZW','South Africa':'ZA',Kenya:'KE',Israel:'IL',Georgia:'GE',Armenia:'AM',
  Montenegro:'ME',Kosovo:'XK','North Macedonia':'MK','Bosnia and Herzegovina':'BA',
  Luxembourg:'LU',
};
function flagFor(nation) {
  if (!nation) return '🌍';
  const n = String(nation).trim();
  if (FLAG_SPECIAL[n]) return FLAG_SPECIAL[n];
  const iso = FLAG_ISO[n];
  if (!iso || iso.length !== 2) return '🌍';
  const A = 0x1F1E6;
  return String.fromCodePoint(A + iso.charCodeAt(0) - 65) + String.fromCodePoint(A + iso.charCodeAt(1) - 65);
}
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

// ── Discovery Pool (mockup) helpers + components ────────────────────────────
// Development-pathway tag derived from projected headroom — a real signal, not
// a stored label. Elite Breakout = big ceiling gap; Developmental = moderate.
function pathwayTag(player) {
  if (player?.provisional) return { label: 'Live Profile', cls: 'live' };
  const r = Number(player?.rating), pot = Number(player?.potential);
  const head = (Number.isFinite(r) && Number.isFinite(pot)) ? pot - r : null;
  if (head == null) return { label: 'Project', cls: 'project' };
  if (head >= 6) return { label: 'Elite Breakout', cls: 'elite' };
  if (head >= 3) return { label: 'Developmental', cls: 'dev' };
  return { label: 'Project', cls: 'project' };
}
const PATHWAY_FILTERS = [
  { key: 'all', label: 'All pathways' },
  { key: 'elite', label: 'Elite Breakout' },
  { key: 'dev', label: 'Developmental' },
  { key: 'project', label: 'Project' },
];
function abbrevName(name = '') {
  const parts = String(name).trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}
// Five scouting axes mapped from the trait engine (real per-90 signals when the
// player is enriched, positional baseline otherwise). Never fabricated numbers.
function radarAxes(player) {
  let t = {};
  try { t = playerTraits(player).traits || {}; } catch { t = {}; }
  const g = (v, d) => Number.isFinite(Number(v)) ? Math.round(Number(v)) : d;
  const readiness = g(player?.readiness, 60);
  return [
    { key: 'Technical', value: g(t.control, 62) },
    { key: 'Mental', value: clamp(Math.round((g(t.control, 62) + readiness) / 2), 30, 96) },
    { key: 'Physical', value: g(t.defensiveLoad, 58) },
    { key: 'Tactical', value: g(t.pressing, 60) },
    { key: 'Decision', value: g(t.tempo, 62) },
  ];
}
// Why-he-stands-out bullets, assembled from real engine fields (no invented prose).
function standoutPoints(player) {
  const out = [];
  if (player?.role) out.push(`${player.role} profile at ${player.age} years old`);
  if (typeof player?.potential === 'number' && typeof player?.rating === 'number' && player.potential > player.rating) {
    out.push(`Projected ceiling ${player.potential} \u2014 ${player.potential - player.rating} points of headroom`);
  }
  if (numeric(player?.minutes) > 0) out.push(`${numeric(player.minutes)} senior minutes logged this season`);
  if (player?.nextStep) out.push(player.nextStep);
  return out.slice(0, 4);
}

function TdeRadar({ axes, size = 176 }) {
  const cx = size / 2, cy = size / 2, R = size / 2 - 30, n = axes.length;
  const pt = (i, rad) => {
    const ang = -Math.PI / 2 + i * (2 * Math.PI / n);
    return [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
  };
  const ring = f => axes.map((_, i) => pt(i, R * f).join(',')).join(' ');
  const area = axes.map((a, i) => pt(i, R * clamp(a.value, 0, 100) / 100).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="tde-radar-svg" role="img" aria-label="Core attribute radar">
      {[0.25, 0.5, 0.75, 1].map(f => <polygon key={f} points={ring(f)} className="tde-radar-ring" />)}
      {axes.map((a, i) => { const [x, y] = pt(i, R); return <line key={a.key} x1={cx} y1={cy} x2={x} y2={y} className="tde-radar-spoke" />; })}
      <polygon points={area} className="tde-radar-area" />
      {axes.map((a, i) => { const [x, y] = pt(i, R + 15); return (
        <text key={a.key} x={x} y={y} className="tde-radar-label" textAnchor="middle">{a.key}
          <tspan x={x} dy="12" className="tde-radar-val">{a.value}</tspan>
        </text>
      ); })}
    </svg>
  );
}

function TdeRing({ value, size = 104, label }) {
  const r = size / 2 - 8, c = 2 * Math.PI * r, v = clamp(Number(value) || 0, 0, 100);
  return (
    <div className="tde-ring">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} className="tde-ring-bg" />
        <circle cx={size / 2} cy={size / 2} r={r} className="tde-ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="tde-ring-mid"><b>{Math.round(v)}%</b>{label && <span>{label}</span>}</div>
    </div>
  );
}

function PoolCard({ player, selected, shortlisted, onSelect, onToggleShortlist }) {
  const tag = pathwayTag(player);
  const ready = player.provisional ? null : numeric(player.readiness);
  return (
    <article className={`tde-card${selected ? ' is-sel' : ''}`} onClick={() => onSelect(player)}>
      <div className="tde-card-photo">
        <div className="tde-card-top">
          <div className="tde-card-badge"><b>{player.provisional ? 'LIVE' : player.rating}</b><span>{player.position}</span></div>
          <button type="button" className="tde-card-star" onClick={e => { e.stopPropagation(); onToggleShortlist(player.name); }} aria-label={`${shortlisted ? 'Remove from' : 'Add to'} shortlist`}>{shortlisted ? <BookmarkCheck size={15} /> : <Star size={15} />}</button>
        </div>
        <ApiPlayerImage playerId={playerApiId(player)} name={player.name} preferredSrc={imageFor(player)} fallbackSrc="/assets/players/neutral-player.svg" allowLookup={allowOfficialLookup(player)} alt={player.name} loading="lazy" />
      </div>
      <div className="tde-card-body">
        <h3>{player.name}</h3>
        <p>{player.club}</p>
        <small>{player.league}</small>
        <span className={`tde-tag tde-tag--${tag.cls}`}>{tag.label}</span>
        <div className="tde-card-ready">
          <div className="tde-card-ready-row"><span>Readiness</span><b>{ready == null ? '\u2014' : `${ready}%`}</b></div>
          <div className="tde-card-bar"><i style={{ width: `${ready == null ? 0 : ready}%` }} /></div>
        </div>
      </div>
    </article>
  );
}

function ScoutPanel({ player, shortlisted, onToggleShortlist }) {
  if (!player) return (
    <div className="tde-scout tde-scout--empty"><p>Select a prospect to open the scouting read.</p></div>
  );
  const axes = radarAxes(player);
  const points = standoutPoints(player);
  const tag = pathwayTag(player);
  return (
    <div className="tde-scout">
      <div className="tde-scout-head">
        <div className="tde-scout-face"><ApiPlayerImage playerId={playerApiId(player)} name={player.name} preferredSrc={imageFor(player)} fallbackSrc="/assets/players/neutral-player.svg" allowLookup={allowOfficialLookup(player)} alt={player.name} loading="lazy" /></div>
        <div className="tde-scout-headid">
          <h2>{player.name}</h2>
          <div className="tde-scout-chips">{player.flag && <span className="fl">{player.flag}</span>}<em>{player.position}</em><em>{player.age}y</em></div>
          <p>{player.club} · {player.league}</p>
        </div>
        <div className="tde-scout-rt">
          <button type="button" className={`tde-scout-star${shortlisted ? ' on' : ''}`} onClick={() => onToggleShortlist(player.name)} aria-label={`${shortlisted ? 'Remove from' : 'Add to'} shortlist`}>{shortlisted ? <BookmarkCheck size={15} /> : <Star size={15} />}</button>
          <div className="tde-scout-rating"><b>{player.provisional ? 'LIVE' : player.rating}</b><span>Calibre</span></div>
        </div>
      </div>
      <div className="tde-scout-metrics">
        <TdeRing value={player.provisional ? 0 : player.readiness} size={92} label="Readiness" />
        <div className="tde-scout-facts">
          <div><span>Potential</span><b>{typeof player.potential === 'number' ? player.potential : '—'}</b></div>
          <div><span>Trend</span><b className="lime">{player.trend}</b></div>
          <div><span>Pathway</span><b>{tag.label}</b></div>
        </div>
      </div>
      <div className="tde-scout-radar">
        <span className="tde-scout-h">Core attributes · model estimate</span>
        <TdeRadar axes={axes} size={158} />
      </div>
      {points.length > 0 && <ul className="tde-scout-why">{points.map(p => <li key={p}><i className="tde-tick" /> {p}</li>)}</ul>}
      <div className="tde-scout-cta">
        <button type="button" className="btn btn--lime btn--sm" onClick={() => { const id = playerApiId(player); navigateTo(id ? `/players?playerId=${id}&player=${encodeURIComponent(player.name)}` : `/players?player=${encodeURIComponent(player.name)}`); }}>View full profile <ArrowRight size={13} /></button>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => navigateTo(`/system-fit?player=${encodeURIComponent(player.name)}`)}>Run System Fit</button>
      </div>
    </div>
  );
}

// ── Trajectory Pathway (mockup) ─────────────────────────────────────────────
function tpSeason(off) { const y = 2024 + off; return `${y}/${String((y + 1) % 100).padStart(2, '0')}`; }
function tpTier(league = '') { return /Tier 1/.test(league) ? 'Tier 1' : /Tier 2/.test(league) ? 'Tier 2' : /Tier 3/.test(league) ? 'Tier 3' : 'Current level'; }
function tpStages(player) {
  const age = Number(player.age) || 19;
  const rating = Number(player.rating) || 70;
  const potential = typeof player.potential === 'number' ? player.potential : rating + 6;
  const readiness = Number(player.readiness) || 60;
  const p2 = clamp(Math.round(readiness * 0.86), 30, 95);
  const p3 = clamp(Math.round(readiness * 0.72), 24, 84);
  const p4 = clamp(Math.round(((readiness + potential) / 2) * 0.6), 20, 74);
  const p5 = clamp(Math.round(potential * 0.42), 14, 60);
  return [
    { key: 'Current', when: `${tpSeason(0)} · Age ${age}`, level: player.club || 'Current club', sub: player.league || tpTier(player.league), bullets: ['Senior-minute base', player.role || 'Role established'].filter(Boolean), prob: readiness, probLabel: 'Readiness' },
    { key: 'Next step', when: `${tpSeason(1)} · Age ${age + 1}`, level: tpTier(player.league), sub: 'Development move', bullets: [player.nextStep || 'Consolidate senior minutes'], prob: p2, probLabel: 'Probability' },
    { key: 'Breakout window', when: `${tpSeason(2)}–${tpSeason(3)} · Age ${age + 2}–${age + 3}`, level: 'Stronger club', sub: 'Consistent starter', bullets: ['20–30 apps per season', 'Europe exposure'], prob: p3, probLabel: 'Probability' },
    { key: 'Peak projection', when: `${tpSeason(4)}–${tpSeason(5)} · Age ${age + 4}–${age + 5}`, level: 'Top-tier club', sub: 'Key starter', bullets: ['Domestic + Europe', 'High impact'], prob: p4, probLabel: 'Probability' },
    { key: 'Long-term ceiling', when: `${tpSeason(6)}+ · Age ${age + 6}+`, level: `Projected ceiling · ${potential}`, sub: 'Elite band', bullets: ['Star-player potential'], prob: p5, probLabel: 'Probability' },
  ];
}
function tpMilestones() {
  return [
    { t: 'Secure 15+ senior appearances', when: `Target ${tpSeason(0)}` },
    { t: 'Establish as a regular starter', when: `Target ${tpSeason(1)}` },
    { t: 'European competition exposure', when: `Target ${tpSeason(2)}` },
  ];
}
function tpRisks(player) {
  const out = [];
  if (numeric(player.minutes) < 1200) out.push('Minutes could stagnate below the starter threshold');
  if ((Number(player.age) || 19) <= 18) out.push('Physical development timeline still to come');
  out.push('Adaptation risk on a step-up to a higher tier');
  return out.slice(0, 3);
}
function tpPeers(player, pool) {
  const pos = String(player.position || player.role || '').toUpperCase();
  const others = (pool || []).filter(p => p && p.name !== player.name);
  let peers = others.filter(p => String(p.position || p.role || '').toUpperCase() === pos);
  if (peers.length < 4) peers = others;
  return peers
    .map(p => {
      const rd = Math.abs((Number(p.rating) || 0) - (Number(player.rating) || 0));
      const sim = clamp(Math.round(92 - rd * 4), 40, 96);
      return { ...p, _sim: sim };
    })
    .sort((a, b) => b._sim - a._sim)
    .slice(0, 5);
}

function TrajectoryPathway({ player, pool = [], onSelect }) {
  const [horizon, setHorizon] = useState(5);
  const [posFocus, setPosFocus] = useState('all');
  const [minThresh, setMinThresh] = useState(0);
  const [showComp, setShowComp] = useState(true);
  const [compareName, setCompareName] = useState('');

  const options = (pool || [])
    .filter(p => posFocus === 'all' || String(p.position || '').toUpperCase() === posFocus)
    .filter(p => numeric(p.minutes) >= minThresh);

  if (!player) return <div className="tp-empty">Select a prospect to inspect the pathway model.</div>;

  const rating = Number(player.rating) || 70;
  const potential = typeof player.potential === 'number' ? player.potential : rating + 6;
  const readiness = Number(player.readiness) || 60;
  const confidence = clamp(Math.round(40 + Math.min(1, numeric(player.minutes) / 3000) * 40 + Math.min(1, numeric(player.appearances) / 25) * 20), 30, 96);
  const trendN = (typeof player.potential === 'number' && typeof player.rating === 'number') ? player.potential - player.rating : trendValue(player.trend);
  const potLabel = potential - rating >= 6 ? 'High ceiling' : potential - rating >= 3 ? 'Rising ceiling' : 'Near ceiling';
  const stages = tpStages(player).slice(0, horizon <= 1 ? 2 : horizon <= 2 ? 3 : horizon <= 3 ? 4 : 5);
  const axes = radarAxes(player);
  const sortedAxes = [...axes].sort((a, b) => b.value - a.value);
  const milestones = tpMilestones();
  const risks = tpRisks(player);
  const peers = tpPeers(player, pool);
  const compare = pool.find(p => p.name === compareName) || null;

  // Development curve
  const W = 920, H = 150, PAD = 46;
  const n = stages.length;
  const norm = v => clamp((v - 58) / (96 - 58), 0, 1);
  const pts = stages.map((_, i) => {
    const val = rating + (potential - rating) * (i / Math.max(1, n - 1));
    const x = PAD + (W - 2 * PAD) * (i / Math.max(1, n - 1));
    const y = (H - 24) - norm(val) * (H - 54);
    return [x, y];
  });
  const line = pts.map(p => p.join(',')).join(' ');

  return (
    <div className="tp">
      <style>{`
        .tp { --l:#c8fa3c; --line:rgba(255,255,255,.09); --card:rgba(255,255,255,.03); --muted:#8b9299; }
        .tp * { box-sizing:border-box; }
        .tp-top { display:flex; gap:16px; align-items:flex-end; justify-content:space-between; flex-wrap:wrap; margin-bottom:16px; }
        .tp-top h2 { margin:0; color:#fff; font:800 30px/1 "Barlow Condensed",sans-serif; letter-spacing:.01em; text-transform:uppercase; }
        .tp-top h2 em { color:var(--l); font-style:normal; }
        .tp-top p { margin:6px 0 0; color:var(--muted); font:500 13px "Barlow",sans-serif; }
        .tp-selects { display:flex; gap:10px; }
        .tp-pick { border:1px solid var(--line); border-radius:11px; background:var(--card); padding:9px 12px; min-width:210px; }
        .tp-pick span { display:block; color:var(--muted); font:700 9px/1 "Barlow",sans-serif; letter-spacing:.1em; text-transform:uppercase; margin-bottom:5px; }
        .tp-pick select { width:100%; background:none; border:none; outline:none; color:#eef1f4; font:700 14px "Barlow",sans-serif; cursor:pointer; }
        .tp-grid { display:grid; grid-template-columns:236px minmax(0,1fr) 316px; gap:16px; align-items:start; }
        @media (max-width:1200px){ .tp-grid { grid-template-columns:220px minmax(0,1fr); } .tp-insights { grid-column:1/-1; } }
        @media (max-width:820px){ .tp-grid { grid-template-columns:1fr; } .tp-controls { display:none; } }
        .tp-controls, .tp-insights, .tp-main > * { border:1px solid var(--line); border-radius:14px; background:var(--card); }
        .tp-controls { padding:16px; position:sticky; top:14px; }
        .tp-controls .h { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .tp-controls .h span { color:#e9edf1; font:800 12px/1 "Barlow Condensed",sans-serif; letter-spacing:.12em; text-transform:uppercase; }
        .tp-controls .h button { background:none; border:none; color:var(--l); font:700 10px "Barlow",sans-serif; text-transform:uppercase; letter-spacing:.06em; cursor:pointer; }
        .tp-ctl { margin-bottom:14px; }
        .tp-ctl > label { display:block; color:var(--muted); font:700 9.5px "Barlow",sans-serif; letter-spacing:.1em; text-transform:uppercase; margin-bottom:7px; }
        .tp-seg { display:flex; gap:5px; }
        .tp-seg button { flex:1; padding:7px 0; border:1px solid var(--line); border-radius:8px; background:rgba(255,255,255,.02); color:#b6bcc3; font:700 11px "Barlow Condensed",sans-serif; cursor:pointer; }
        .tp-seg button.on { background:var(--l); color:#0a0d05; border-color:var(--l); }
        .tp-ctl select { width:100%; height:34px; padding:0 10px; border:1px solid var(--line); border-radius:9px; background:rgba(255,255,255,.03); color:#d8dde2; font:600 12px "Barlow",sans-serif; cursor:pointer; }
        .tp-toggle { display:flex; align-items:center; justify-content:space-between; cursor:pointer; }
        .tp-toggle span { color:#cfd4da; font:600 12px "Barlow",sans-serif; }
        .tp-switch { width:38px; height:21px; border-radius:11px; background:rgba(255,255,255,.12); position:relative; transition:background .15s; flex:none; }
        .tp-switch.on { background:var(--l); }
        .tp-switch i { position:absolute; top:2px; left:2px; width:17px; height:17px; border-radius:50%; background:#fff; transition:left .15s; }
        .tp-switch.on i { left:19px; }
        .tp-note { border-top:1px solid var(--line); margin-top:14px; padding-top:12px; }
        .tp-note b { display:block; color:var(--l); font:700 10px "Barlow",sans-serif; letter-spacing:.1em; text-transform:uppercase; margin-bottom:6px; }
        .tp-note p { margin:0; color:var(--muted); font:500 11.5px/1.5 "Barlow",sans-serif; }
        .tp-main { display:grid; gap:14px; min-width:0; }
        .tp-hero { display:flex; align-items:center; gap:16px; padding:16px; }
        .tp-hero-rating { text-align:center; flex:none; }
        .tp-hero-rating b { display:block; font:800 40px/1 "Barlow Condensed",sans-serif; color:var(--l); }
        .tp-hero-rating span { font:700 9px "Barlow",sans-serif; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
        .tp-hero-photo { width:64px; height:64px; border-radius:12px; overflow:hidden; background:#0a0d10; border:1px solid var(--line); flex:none; }
        .tp-hero-photo img { width:100%; height:100%; object-fit:cover; object-position:top center; }
        .tp-hero-id h3 { margin:0; color:#f4f6f8; font:800 26px/1 "Barlow Condensed",sans-serif; letter-spacing:.01em; text-transform:uppercase; }
        .tp-hero-id p { margin:5px 0 0; color:#b6bcc3; font:500 13px "Barlow",sans-serif; }
        .tp-hero-meta { margin-left:auto; display:flex; gap:22px; flex-wrap:wrap; }
        .tp-hero-meta div span { display:block; color:var(--muted); font:600 9px "Barlow",sans-serif; letter-spacing:.08em; text-transform:uppercase; margin-bottom:3px; }
        .tp-hero-meta div b { color:#e9edf1; font:700 13px "Barlow",sans-serif; }
        .tp-rings { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; padding:16px; }
        .tp-ringcard { display:flex; align-items:center; gap:12px; }
        .tp-ringcard .lab { min-width:0; }
        .tp-ringcard .lab span { display:block; color:var(--muted); font:700 9px "Barlow",sans-serif; letter-spacing:.08em; text-transform:uppercase; }
        .tp-ringcard .lab b { display:block; color:#fff; font:800 22px/1.1 "Barlow Condensed",sans-serif; }
        .tp-ringcard .lab small { color:var(--muted); font:500 10px "Barlow",sans-serif; }
        .tp-bignum { flex:none; width:56px; height:56px; border-radius:12px; display:grid; place-items:center; background:rgba(200,250,60,.1); border:1px solid rgba(200,250,60,.24); }
        .tp-bignum b { color:var(--l); font:800 22px/1 "Barlow Condensed",sans-serif; }
        .tp-dev { padding:18px; }
        .tp-dev-h { color:#e9edf1; font:800 13px/1 "Barlow Condensed",sans-serif; letter-spacing:.12em; text-transform:uppercase; margin-bottom:14px; }
        .tp-timeline { position:relative; margin-bottom:6px; }
        .tp-timeline svg { display:block; width:100%; height:auto; }
        .tp-stage-heads { display:grid; grid-auto-flow:column; grid-auto-columns:1fr; margin-bottom:6px; }
        .tp-stage-heads div { text-align:left; padding-right:8px; }
        .tp-stage-heads div i { display:block; color:var(--l); font:800 10px "Barlow Condensed",sans-serif; letter-spacing:.08em; text-transform:uppercase; font-style:normal; }
        .tp-stage-heads div small { color:var(--muted); font:500 10px "Barlow",sans-serif; }
        .tp-stages { display:grid; grid-auto-flow:column; grid-auto-columns:1fr; gap:10px; margin-top:12px; }
        .tp-stage { border:1px solid var(--line); border-radius:11px; background:rgba(255,255,255,.02); padding:12px; }
        .tp-stage.next { border-color:rgba(200,250,60,.4); background:rgba(200,250,60,.05); }
        .tp-stage b { color:#eef1f4; font:700 13px "Barlow",sans-serif; }
        .tp-stage small { display:block; color:var(--muted); font:500 11px "Barlow",sans-serif; margin:2px 0 8px; }
        .tp-stage ul { list-style:none; margin:0 0 10px; padding:0; display:grid; gap:5px; }
        .tp-stage li { display:flex; gap:6px; color:#cfd4da; font:500 11.5px/1.3 "Barlow",sans-serif; }
        .tp-stage li::before { content:"›"; color:var(--l); }
        .tp-stage .prob { display:flex; align-items:center; justify-content:space-between; border-top:1px solid var(--line); padding-top:8px; }
        .tp-stage .prob span { color:var(--muted); font:600 9px "Barlow",sans-serif; letter-spacing:.06em; text-transform:uppercase; }
        .tp-stage .prob b { color:var(--l); font:800 15px "Barlow Condensed",sans-serif; }
        .tp-comp { padding:16px; }
        .tp-comp-h { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .tp-comp-h span { color:#e9edf1; font:800 12px "Barlow Condensed",sans-serif; letter-spacing:.1em; text-transform:uppercase; }
        .tp-comp-row { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; }
        .tp-peer { display:flex; align-items:center; gap:9px; border:1px solid var(--line); border-radius:10px; background:rgba(255,255,255,.02); padding:9px; cursor:pointer; }
        .tp-peer img { width:34px; height:34px; border-radius:50%; object-fit:cover; object-position:top; flex:none; border:1px solid var(--line); }
        .tp-peer .pi { min-width:0; }
        .tp-peer .pi b { display:block; color:#eef1f4; font:700 12px "Barlow",sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .tp-peer .pi small { color:var(--muted); font:500 10px "Barlow",sans-serif; }
        .tp-peer .sim { margin-left:auto; text-align:right; flex:none; }
        .tp-peer .sim b { color:var(--l); font:800 14px "Barlow Condensed",sans-serif; }
        .tp-peer .sim small { display:block; color:var(--muted); font:600 8px "Barlow",sans-serif; letter-spacing:.06em; text-transform:uppercase; }
        .tp-insights { padding:16px; position:sticky; top:14px; }
        .tp-ins-h { color:#e9edf1; font:800 12px "Barlow Condensed",sans-serif; letter-spacing:.1em; text-transform:uppercase; margin-bottom:8px; }
        .tp-ins-list { list-style:none; margin:12px 0 0; padding:0; display:grid; gap:8px; }
        .tp-ins-list li { display:flex; gap:8px; color:#cfd4da; font:500 12px/1.4 "Barlow",sans-serif; }
        .tp-ins-list li i { width:12px; height:12px; border-radius:50%; background:rgba(200,250,60,.18); position:relative; flex:none; margin-top:2px; }
        .tp-ins-list li i::after { content:""; position:absolute; left:4px; top:2px; width:2.5px; height:5px; border:solid var(--l); border-width:0 1.5px 1.5px 0; transform:rotate(45deg); }
        .tp-block { margin-top:16px; border-top:1px solid var(--line); padding-top:14px; }
        .tp-block h4 { margin:0 0 10px; font:800 11px "Barlow Condensed",sans-serif; letter-spacing:.1em; text-transform:uppercase; }
        .tp-block.mile h4 { color:#e9edf1; }
        .tp-block.risk h4 { color:#ff8a6b; }
        .tp-mile { display:flex; align-items:flex-start; gap:9px; margin-bottom:10px; }
        .tp-mile i { width:16px; height:16px; border-radius:50%; border:1px solid var(--l); color:var(--l); font:800 9px/16px "Barlow",sans-serif; text-align:center; flex:none; }
        .tp-mile b { display:block; color:#e9edf1; font:600 12px/1.3 "Barlow",sans-serif; }
        .tp-mile small { color:var(--muted); font:500 10.5px "Barlow",sans-serif; }
        .tp-risk { display:flex; gap:8px; color:#d3c0bb; font:500 12px/1.4 "Barlow",sans-serif; margin-bottom:8px; }
        .tp-risk::before { content:"⚠"; color:#ff8a6b; }
        .tp-empty { padding:60px 18px; text-align:center; color:var(--muted); border:1px dashed rgba(255,255,255,.12); border-radius:14px; }
      `}</style>

      <div className="tp-top">
        <div>
          <h2>Trajectory <em>Pathway</em></h2>
          <p>Map the development pathway and potential arc of any prospect.</p>
        </div>
        <div className="tp-selects">
          <label className="tp-pick"><span>Select player</span>
            <select value={player.name} onChange={e => onSelect(e.target.value)}>
              {options.map(p => <option key={playerKey(p)} value={p.name}>{p.name}</option>)}
            </select>
          </label>
          <label className="tp-pick"><span>Compare with</span>
            <select value={compareName} onChange={e => setCompareName(e.target.value)}>
              <option value="">Select player</option>
              {options.filter(p => p.name !== player.name).map(p => <option key={playerKey(p)} value={p.name}>{p.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="tp-grid">
        <aside className="tp-controls">
          <div className="h"><span>Pathway controls</span><button type="button" onClick={() => { setHorizon(5); setPosFocus('all'); setMinThresh(0); setShowComp(true); setCompareName(''); }}>Reset</button></div>
          <div className="tp-ctl"><label>Time horizon</label><div className="tp-seg">{[1, 2, 3, 5].map(y => <button type="button" key={y} className={horizon === y ? 'on' : ''} onClick={() => setHorizon(y)}>{y}Y</button>)}</div></div>
          <div className="tp-ctl"><label>Position focus</label><select value={posFocus} onChange={e => setPosFocus(e.target.value)}>{POSITION_OPTIONS.map(o => <option key={o} value={o === 'all' ? 'all' : o.toUpperCase()}>{o === 'all' ? 'All positions' : o}</option>)}</select></div>
          <div className="tp-ctl"><label>Minutes threshold</label><select value={minThresh} onChange={e => setMinThresh(Number(e.target.value))}><option value={0}>Any minutes</option><option value={500}>500+ mins</option><option value={1000}>1000+ mins</option><option value={1800}>1800+ mins</option></select></div>
          <div className="tp-ctl"><div className="tp-toggle" onClick={() => setShowComp(v => !v)} role="switch" aria-checked={showComp}><span>Show comparables</span><div className={`tp-switch${showComp ? ' on' : ''}`}><i /></div></div></div>
          <div className="tp-note"><b>Understanding pathways</b><p>The pathway model uses age, role, league strength, senior minutes and current trajectory to project a most-likely arc. Not a guarantee — a probability map.</p></div>
        </aside>

        <div className="tp-main">
          <div className="tp-hero">
            <div className="tp-hero-rating"><b>{player.rating}</b><span>Calibre</span></div>
            <div className="tp-hero-photo"><ApiPlayerImage playerId={playerApiId(player)} name={player.name} preferredSrc={imageFor(player)} fallbackSrc="/assets/players/neutral-player.svg" allowLookup={allowOfficialLookup(player)} alt={player.name} loading="lazy" /></div>
            <div className="tp-hero-id"><h3>{player.name}</h3><p>{player.flag} {player.club} · {player.position} · {player.age} yrs</p></div>
            <div className="tp-hero-meta">
              <div><span>Minutes</span><b>{numeric(player.minutes)}</b></div>
              <div><span>Apps</span><b>{numeric(player.appearances)}</b></div>
              <div><span>Nation</span><b>{player.nation}</b></div>
            </div>
          </div>

          <div className="tp-rings">
            <div className="tp-ringcard"><TdeRing value={readiness} size={72} /><div className="lab"><span>Readiness</span><small>{readiness >= 75 ? 'High' : readiness >= 60 ? 'Building' : 'Early'}</small></div></div>
            <div className="tp-ringcard"><div className="tp-bignum"><b>{potential}</b></div><div className="lab"><span>Potential</span><b> </b><small>{potLabel}</small></div></div>
            <div className="tp-ringcard"><div className="tp-bignum"><b>+{trendN}</b></div><div className="lab"><span>Trend</span><small>Projected headroom</small></div></div>
            <div className="tp-ringcard"><TdeRing value={confidence} size={72} /><div className="lab"><span>Confidence</span><small>Model confidence</small></div></div>
          </div>

          <div className="tp-dev">
            <div className="tp-dev-h">Development pathway</div>
            <div className="tp-stage-heads" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
              {stages.map(st => <div key={st.key}><i>{st.key}</i><small>{st.when}</small></div>)}
            </div>
            <div className="tp-timeline">
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Development curve">
                <polyline points={line} fill="none" stroke="var(--l)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === 1 ? 6 : 5} fill={i <= 1 ? 'var(--l)' : '#0b0d0f'} stroke="var(--l)" strokeWidth="2" />)}
              </svg>
            </div>
            <div className="tp-stages" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
              {stages.map((st, i) => (
                <div className={`tp-stage${i === 1 ? ' next' : ''}`} key={st.key}>
                  <b>{st.level}</b><small>{st.sub}</small>
                  <ul>{st.bullets.map(b => <li key={b}>{b}</li>)}</ul>
                  <div className="prob"><span>{st.probLabel}</span><b>{st.prob}%</b></div>
                </div>
              ))}
            </div>
          </div>

          {showComp && (
            <div className="tp-comp">
              <div className="tp-comp-h"><span>Comparable trajectories</span></div>
              <div className="tp-comp-row">
                {peers.map(p => (
                  <button type="button" className="tp-peer" key={playerKey(p)} onClick={() => onSelect(p.name)}>
                    <ApiPlayerImage playerId={playerApiId(p)} name={p.name} preferredSrc={imageFor(p)} fallbackSrc="/assets/players/neutral-player.svg" allowLookup={allowOfficialLookup(p)} alt={p.name} loading="lazy" />
                    <div className="pi"><b>{p.name}</b><small>{p.club}</small></div>
                    <div className="sim"><b>{p._sim}%</b><small>Path sim</small></div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="tp-insights">
          <div className="tp-ins-h">Pathway insights</div>
          <TdeRadar axes={axes} />
          <ul className="tp-ins-list">
            <li><i />Strongest on {sortedAxes[0].key.toLowerCase()} ({sortedAxes[0].value}) for the profile</li>
            <li><i />{player.role} traits suit a {/Tier 1/.test(player.league || '') ? 'Tier 1' : 'step-up'} role</li>
            {numeric(player.minutes) > 0 && <li><i />{numeric(player.minutes)} senior minutes banked at {player.age}</li>}
            <li><i />{sortedAxes[sortedAxes.length - 1].value < 55 ? `Development area: ${sortedAxes[sortedAxes.length - 1].key.toLowerCase()} (${sortedAxes[sortedAxes.length - 1].value})` : 'Balanced attribute spread for the age'}</li>
          </ul>
          {compare && <div className="tp-block"><h4>Vs {compare.name}</h4><p style={{ margin: 0, color: '#cfd4da', font: '500 12px/1.5 "Barlow",sans-serif' }}>{compare.name}: {compare.rating} rating → {typeof compare.potential === 'number' ? compare.potential : '—'} ceiling. {clamp(Math.round(92 - Math.abs((Number(compare.rating) || 0) - rating) * 4), 40, 96)}% path similarity.</p></div>}
          <div className="tp-block mile">
            <h4>Key milestones to watch</h4>
            {milestones.map((m, i) => <div className="tp-mile" key={m.t}><i>{i + 1}</i><div><b>{m.t}</b><small>{m.when}</small></div></div>)}
          </div>
          <div className="tp-block risk">
            <h4>Risk factors</h4>
            {risks.map(r => <div className="tp-risk" key={r}>{r}</div>)}
          </div>
        </aside>
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
  const [pathwayType, setPathwayType] = useState('all');
  const [selectedName, setSelectedName] = useState('');
  const [detailPlayer, setDetailPlayer] = useState(null);
  const [visibleCount, setVisibleCount] = useState(48);
  const [shortlist, setShortlist] = useState([]);
  const { user: watchUser } = useAuth();
  // Hydrate the shortlist from the user's saved watchlist (Supabase if logged
  // in, localStorage otherwise). On login, merge any anonymous local picks up
  // into the account first so nothing is lost.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (watchUser?.id) await mergeLocalIntoAccount(watchUser);
        const saved = await loadWatchlist(watchUser);
        if (active && saved?.length) {
          setShortlist(current => Array.from(new Set([...saved, ...current])));
        }
      } catch { /* watchlist table may not exist yet — fail soft */ }
    })();
    return () => { active = false; };
  }, [watchUser?.id]);
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
  const [youthShortlistOnly, setYouthShortlistOnly] = useState(false);
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
    .filter(p => pathwayType === 'all' || pathwayTag(p).cls === pathwayType)
    .filter(p => liveMode || `${p.name} ${p.club} ${p.league} ${p.role} ${p.nation}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a,b) => sort === 'rating' ? numeric(b.rating) - numeric(a.rating) : sort === 'trend' ? trendValue(b.trend) - trendValue(a.trend) : sort === 'age' ? numeric(a.age,99) - numeric(b.age,99) : numeric(b.readiness) - numeric(a.readiness)),
  [sourceTalents, region, age, position, potential, minRating, trajectory, pathwayType, query, sort, liveMode]);

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

  function toggleShortlist(name, meta = {}) {
    const isSaved = shortlist.includes(name);
    // Optimistic UI update — instant toggle.
    setShortlist(current => isSaved ? current.filter(item => item !== name) : [...current, name]);
    // Persist in the background (Supabase if logged in, localStorage otherwise).
    const op = isSaved
      ? removeFromWatchlist({ name }, watchUser)
      : addToWatchlist({ name, apiPlayerId: meta.apiPlayerId ?? null, context: meta.context ?? null }, watchUser);
    Promise.resolve(op).catch(() => {
      // On failure, roll the optimistic change back so UI matches reality.
      setShortlist(current => isSaved ? [...current, name] : current.filter(item => item !== name));
    });
  }

  function resetFilters() {
    setRegion('all'); setAge('all'); setPosition('all'); setPotential('70'); setMinRating('all'); setSort('readiness'); setTrajectory('all'); setPathwayType('all'); setQuery('');
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
        if (youthShortlistOnly && !shortlist.includes(p.name)) return false;
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
  }, [youthProspects, youthQuery, youthAge, youthPos, youthLeague, youthPlayingUpOnly, youthShortlistOnly, shortlist]);

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
    <div className="page talents-page tde">
      <style>{`
        .tde { --tde-lime:#c8fa3c; --tde-line:rgba(255,255,255,.09); --tde-card:rgba(255,255,255,.03); --tde-muted:#8b9299; }
        .tde * { box-sizing:border-box; }
        .talents-page.tde { max-width:1600px; }
        .tde-ticker { display:flex; align-items:center; gap:16px; border:1px solid var(--tde-line); border-radius:10px; background:rgba(255,255,255,.02); padding:0 14px; height:40px; margin-bottom:16px; overflow:hidden; }
        .tde-ticker-label { display:inline-flex; align-items:center; gap:6px; color:var(--tde-lime); font:700 10px/1 "Barlow Condensed",sans-serif; letter-spacing:.14em; text-transform:uppercase; flex:none; }
        .tde-ticker-track { display:flex; align-items:center; gap:22px; flex:1; overflow:hidden; white-space:nowrap; }
        .tde-ticker-track span { display:inline-flex; align-items:center; gap:7px; color:#cfd4da; font:600 12px/1 "Barlow",sans-serif; }
        .tde-ticker-track span b { color:#e9edf1; }
        .tde-ticker-track span em { color:var(--tde-lime); font-style:normal; font-weight:800; }
        .tde-ticker-track span i { color:#6b7480; font-style:normal; font-size:10px; letter-spacing:.08em; }
        .tde-ticker-end { flex:none; color:var(--tde-muted); font:700 10px/1 "Barlow Condensed",sans-serif; letter-spacing:.1em; text-transform:uppercase; }
        .tde-hero { position:relative; overflow:hidden; border:1px solid var(--tde-line); border-radius:16px; padding:30px 30px 22px; margin-bottom:18px; display:flex; gap:26px; align-items:flex-end; justify-content:space-between; }
        .tde-hero::before { content:""; position:absolute; inset:0; background:url('/assets/debates-bg.png') center/cover no-repeat; opacity:.5; z-index:0; }
        .tde-hero::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg,rgba(4,6,9,.72),rgba(3,5,7,.94)); z-index:1; }
        .tde-hero-main, .tde-hero-stats { position:relative; z-index:2; }
        .tde-hero-main { min-width:0; }
        .tde-eyebrow { display:inline-flex; align-items:center; gap:6px; color:var(--tde-lime); font:600 11px/1 "Barlow",sans-serif; letter-spacing:.16em; text-transform:uppercase; }
        .tde-hero h1 { margin:12px 0 8px; font:800 44px/.96 "Barlow Condensed",sans-serif; letter-spacing:.01em; color:#fff; text-transform:uppercase; }
        .tde-hero h1 em { color:var(--tde-lime); font-style:normal; }
        .tde-hero p { margin:0 0 18px; color:#c3c9cf; font:500 14px/1.5 "Barlow",sans-serif; max-width:440px; }
        .tde-tabs { display:inline-flex; gap:4px; background:rgba(6,9,12,.6); border:1px solid var(--tde-line); border-radius:10px; padding:4px; }
        .tde-tabs button { display:inline-flex; align-items:center; gap:7px; border:none; background:none; color:#aeb4bb; font:700 12px/1 "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; padding:9px 14px; border-radius:7px; cursor:pointer; }
        .tde-tabs button.is-active { background:var(--tde-lime); color:#0a0d05; }
        .tde-hero-stats { display:flex; gap:12px; flex:none; }
        .tde-hstat { background:rgba(8,11,14,.6); border:1px solid var(--tde-line); border-radius:12px; padding:14px 16px; min-width:96px; }
        .tde-hstat b { display:block; font:800 30px/1 "Barlow Condensed",sans-serif; color:#fff; }
        .tde-hstat span { display:block; margin-top:6px; color:var(--tde-muted); font:600 9.5px/1.3 "Barlow",sans-serif; letter-spacing:.08em; text-transform:uppercase; }
        .tde-grid { display:grid; grid-template-columns:240px minmax(0,1fr) 360px; gap:16px; align-items:start; }
        @media (max-width:1180px){ .tde-grid { grid-template-columns:220px minmax(0,1fr); } .tde-detail { display:none; } }
        @media (max-width:820px){ .tde-grid { grid-template-columns:1fr; } .tde-rail { display:none; } }
        .tde-rail { background:var(--tde-card); border:1px solid var(--tde-line); border-radius:14px; padding:16px; position:sticky; top:14px; }
        .tde-rail-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .tde-rail-head span { color:#e9edf1; font:800 12px/1 "Barlow Condensed",sans-serif; letter-spacing:.12em; text-transform:uppercase; }
        .tde-rail-head button { background:none; border:none; color:var(--tde-lime); font:700 10px/1 "Barlow",sans-serif; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; }
        .tde-search { display:flex; align-items:center; gap:8px; height:36px; padding:0 10px; border:1px solid var(--tde-line); border-radius:9px; background:rgba(255,255,255,.03); color:var(--tde-muted); margin-bottom:10px; }
        .tde-search input { flex:1; min-width:0; background:none; border:none; outline:none; color:#e9edf1; font:500 13px "Barlow",sans-serif; }
        .tde-rail select { width:100%; height:34px; margin-bottom:8px; padding:0 10px; border:1px solid var(--tde-line); border-radius:9px; background:rgba(255,255,255,.03); color:#d8dde2; font:600 12px "Barlow",sans-serif; cursor:pointer; }
        .tde-rail-group { margin-top:14px; }
        .tde-rail-group h4 { margin:0 0 8px; color:var(--tde-muted); font:700 10px/1 "Barlow",sans-serif; letter-spacing:.12em; text-transform:uppercase; }
        .tde-check { display:flex; align-items:center; gap:9px; padding:6px 0; cursor:pointer; color:#cfd4da; font:600 12.5px "Barlow",sans-serif; }
        .tde-check input { appearance:none; width:16px; height:16px; border:1px solid rgba(255,255,255,.22); border-radius:5px; background:rgba(255,255,255,.03); flex:none; cursor:pointer; position:relative; }
        .tde-check input:checked { background:var(--tde-lime); border-color:var(--tde-lime); }
        .tde-check input:checked::after { content:""; position:absolute; left:5px; top:2px; width:4px; height:8px; border:solid #0a0d05; border-width:0 2px 2px 0; transform:rotate(45deg); }
        .tde-check span { flex:1; }
        .tde-check b { color:var(--tde-muted); font:700 11px "Barlow",sans-serif; }
        .tde-pool { min-width:0; }
        .tde-pool-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:12px; }
        .tde-pool-head .tde-eyebrow { letter-spacing:.14em; }
        .tde-pool-head strong { display:block; margin-top:4px; color:#fff; font:800 20px/1 "Barlow Condensed",sans-serif; letter-spacing:.02em; text-transform:uppercase; }
        .tde-sort { display:inline-flex; align-items:center; gap:8px; color:var(--tde-muted); font:600 11px "Barlow",sans-serif; text-transform:uppercase; letter-spacing:.06em; }
        .tde-sort select { height:32px; padding:0 8px; border:1px solid var(--tde-line); border-radius:8px; background:rgba(255,255,255,.03); color:#d8dde2; font:600 12px "Barlow",sans-serif; cursor:pointer; }
        .tde-region-chips { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:14px; }
        .tde-chip { display:inline-flex; align-items:center; gap:7px; padding:7px 12px; border:1px solid var(--tde-line); border-radius:8px; background:rgba(255,255,255,.02); color:#b6bcc3; font:700 11px "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; }
        .tde-chip b { color:var(--tde-muted); font-weight:800; }
        .tde-chip.on { border-color:var(--tde-lime); background:rgba(200,250,60,.12); color:#eaffb0; }
        .tde-chip.on b { color:var(--tde-lime); }
        .tde-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }
        .tde-card { position:relative; border:1px solid var(--tde-line); border-radius:14px; background:var(--tde-card); overflow:hidden; cursor:pointer; transition:border-color .15s,transform .15s; }
        .tde-card:hover { border-color:rgba(200,250,60,.4); transform:translateY(-2px); }
        .tde-card.is-sel { border-color:var(--tde-lime); box-shadow:0 0 0 1px var(--tde-lime) inset; }
        .tde-card-top { position:absolute; inset:8px 8px auto 8px; display:flex; align-items:flex-start; justify-content:space-between; z-index:2; }
        .tde-card-badge { display:flex; flex-direction:column; align-items:center; background:rgba(6,9,12,.72); border:1px solid var(--tde-line); border-radius:9px; padding:5px 8px; backdrop-filter:blur(6px); }
        .tde-card-badge b { font:800 20px/1 "Barlow Condensed",sans-serif; color:var(--tde-lime); }
        .tde-card-badge span { font:700 9px/1 "Barlow",sans-serif; letter-spacing:.08em; color:#aeb4bb; margin-top:3px; }
        .tde-card-star { width:28px; height:28px; display:grid; place-items:center; border-radius:8px; border:1px solid var(--tde-line); background:rgba(6,9,12,.72); color:#cdd3d9; cursor:pointer; backdrop-filter:blur(6px); }
        .tde-card-photo { position:relative; margin:12px 12px 0; height:132px; border-radius:11px; overflow:hidden; border:1px solid rgba(255,255,255,.1); background:radial-gradient(120% 110% at 50% 0%, rgba(255,255,255,.07), #0a0d10 70%); }
        .tde-card-photo img { width:100%; height:100%; object-fit:cover; object-position:center 12%; display:block; }
        .tde-card-photo::after { content:""; position:absolute; inset:0; border-radius:11px; background:linear-gradient(180deg,transparent 60%,rgba(11,13,15,.5)); }
        .tde-card-body { padding:12px 13px 13px; }
        .tde-card-body h3 { margin:0; color:#f2f5f7; font:700 15px/1.15 "Barlow",sans-serif; }
        .tde-card-body p { margin:3px 0 1px; color:#b6bcc3; font:500 12px "Barlow",sans-serif; }
        .tde-card-body small { display:block; color:#6b7480; font:500 10.5px "Barlow",sans-serif; }
        .tde-tag { display:inline-block; margin:9px 0 10px; padding:3px 8px; border-radius:6px; font:800 9px/1.4 "Barlow Condensed",sans-serif; letter-spacing:.1em; text-transform:uppercase; }
        .tde-tag--elite { background:rgba(200,250,60,.16); color:var(--tde-lime); }
        .tde-tag--dev { background:rgba(80,180,255,.14); color:#7fc4ff; }
        .tde-tag--project { background:rgba(255,255,255,.07); color:#aeb4bb; }
        .tde-tag--live { background:rgba(255,180,60,.14); color:#ffbf6b; }
        .tde-card-ready-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:5px; }
        .tde-card-ready-row span { color:var(--tde-muted); font:600 10px "Barlow",sans-serif; letter-spacing:.06em; text-transform:uppercase; }
        .tde-card-ready-row b { color:#e9edf1; font:800 12px "Barlow Condensed",sans-serif; }
        .tde-card-bar { height:5px; border-radius:5px; background:rgba(255,255,255,.08); overflow:hidden; }
        .tde-card-bar i { display:block; height:100%; background:linear-gradient(90deg,rgba(200,250,60,.5),var(--tde-lime)); border-radius:5px; }
        .tde-more { display:flex; justify-content:center; margin-top:18px; }
        .tde-detail { position:sticky; top:14px; }
        .tde-scout { border:1px solid var(--tde-line); border-radius:16px; background:var(--tde-card); padding:16px; }
        .tde-scout--empty { color:var(--tde-muted); font:500 13px "Barlow",sans-serif; text-align:center; padding:40px 18px; }
        .tde-scout-head { display:flex; align-items:flex-start; gap:12px; }
        .tde-scout-face { width:66px; height:66px; flex:none; border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,.12); background:radial-gradient(120% 110% at 50% 0%, rgba(255,255,255,.08), #0a0d10 70%); }
        .tde-scout-face img { width:100%; height:100%; object-fit:cover; object-position:center 12%; display:block; }
        .tde-scout-headid { min-width:0; flex:1; }
        .tde-scout-headid h2 { margin:0; color:#f4f6f8; font:800 20px/1 "Barlow Condensed",sans-serif; letter-spacing:.01em; text-transform:uppercase; }
        .tde-scout-chips { display:flex; align-items:center; gap:5px; margin:6px 0 5px; flex-wrap:wrap; }
        .tde-scout-chips .fl { font-size:14px; }
        .tde-scout-chips em { font-style:normal; padding:2px 6px; border-radius:5px; background:rgba(200,250,60,.12); color:var(--tde-lime); font:800 8.5px/1.4 "Barlow Condensed",sans-serif; letter-spacing:.08em; text-transform:uppercase; }
        .tde-scout-headid p { margin:0; color:#b6bcc3; font:500 11.5px "Barlow",sans-serif; overflow:hidden; text-overflow:ellipsis; }
        .tde-scout-rt { display:flex; flex-direction:column; align-items:flex-end; gap:8px; flex:none; }
        .tde-scout-star { width:30px; height:30px; display:grid; place-items:center; border-radius:9px; border:1px solid var(--tde-line); background:rgba(255,255,255,.03); color:#cdd3d9; cursor:pointer; }
        .tde-scout-star.on { color:var(--tde-lime); border-color:rgba(200,250,60,.4); }
        .tde-scout-rating { text-align:right; }
        .tde-scout-rating b { display:block; font:800 30px/1 "Barlow Condensed",sans-serif; color:var(--tde-lime); }
        .tde-scout-rating span { font:700 8px/1 "Barlow",sans-serif; letter-spacing:.1em; text-transform:uppercase; color:var(--tde-muted); }
        .tde-scout-metrics { display:flex; align-items:center; gap:14px; margin:14px 0 4px; padding:12px 0; border-top:1px solid var(--tde-line); border-bottom:1px solid var(--tde-line); }
        .tde-ring { position:relative; flex:none; display:inline-block; line-height:0; }
        .tde-ring-bg { fill:none; stroke:rgba(255,255,255,.08); stroke-width:7; }
        .tde-ring-fg { fill:none; stroke:var(--tde-lime); stroke-width:7; stroke-linecap:round; transition:stroke-dashoffset .4s ease; }
        .tde-ring-mid { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
        .tde-ring-mid b { font:800 20px/1 "Barlow Condensed",sans-serif; color:#fff; }
        .tde-ring-mid span { font:600 8px/1 "Barlow",sans-serif; letter-spacing:.08em; text-transform:uppercase; color:var(--tde-muted); margin-top:3px; }
        .tde-scout-facts { flex:1; display:grid; gap:6px; }
        .tde-scout-facts > div { display:flex; align-items:center; justify-content:space-between; }
        .tde-scout-facts span { color:var(--tde-muted); font:600 10px "Barlow",sans-serif; letter-spacing:.06em; text-transform:uppercase; }
        .tde-scout-facts b { color:#e9edf1; font:800 14px "Barlow Condensed",sans-serif; }
        .tde-scout-facts b.lime { color:var(--tde-lime); font-size:12px; }
        .tde-scout-h { display:block; color:var(--tde-muted); font:700 10px/1 "Barlow",sans-serif; letter-spacing:.12em; text-transform:uppercase; margin:12px 0 4px; }
        .tde-radar-svg { width:100%; height:auto; display:block; }
        .tde-radar-ring { fill:none; stroke:rgba(255,255,255,.08); stroke-width:1; }
        .tde-radar-spoke { stroke:rgba(255,255,255,.07); stroke-width:1; }
        .tde-radar-area { fill:rgba(200,250,60,.18); stroke:var(--tde-lime); stroke-width:1.5; }
        .tde-radar-label { fill:#b6bcc3; font:700 9px "Barlow Condensed",sans-serif; letter-spacing:.04em; text-transform:uppercase; }
        .tde-radar-val { fill:#fff; font:800 10px "Barlow Condensed",sans-serif; }
        ul.tde-scout-why { list-style:none; margin:12px 0 0; padding:0; display:grid; gap:7px; }
        ul.tde-scout-why li { display:flex; align-items:flex-start; gap:8px; color:#cfd4da; font:500 12px/1.4 "Barlow",sans-serif; }
        .tde-tick { width:13px; height:13px; border-radius:50%; flex:none; margin-top:2px; background:rgba(200,250,60,.18); position:relative; }
        .tde-tick::after { content:""; position:absolute; left:4px; top:2px; width:3px; height:6px; border:solid var(--tde-lime); border-width:0 1.6px 1.6px 0; transform:rotate(45deg); }
        .tde-scout-cta { display:grid; gap:8px; margin-top:16px; }
        .tde-empty-pool { grid-column:1/-1; text-align:center; padding:44px 18px; color:var(--tde-muted); border:1px dashed var(--tde-line); border-radius:14px; }
        .tde-empty-pool button { margin-top:12px; }
      `}</style>

      <div className="tde-ticker">
        <span className="tde-ticker-label"><Zap size={13} /> Live scout feed</span>
        <div className="tde-ticker-track">
          {ranked.slice(0, 8).map(p => (
            <span key={p.name}>{abbrevName(p.name)} <i>U{p.age}</i> <em>{p.trend}</em></span>
          ))}
        </div>
        <span className="tde-ticker-end">{sourceTalents.length} new reports</span>
      </div>

      <header className="tde-hero">
        <div className="tde-hero-main">
          <span className="tde-eyebrow"><Sparkles size={13} /> Calibre Intelligence</span>
          <h1>Talent <em>Discovery Engine</em></h1>
          <p>Find the players nobody is watching — and decide which ones are worth betting on.</p>
          <div className="tde-tabs" role="tablist" aria-label="Talent views">
            {VIEW_TABS.map(({ key, label, icon: Icon }) => (
              <button type="button" role="tab" aria-selected={view === key} className={view === key ? 'is-active' : ''} key={key} onClick={() => setView(key)}><Icon size={14} />{label}</button>
            ))}
          </div>
        </div>
        <div className="tde-hero-stats">
          <div className="tde-hstat"><b>{sourceTalents.length}</b><span>Prospects indexed</span></div>
          <div className="tde-hstat"><b>{sourceTalents.filter(p => !p.provisional && numeric(p.readiness) >= 70).length}</b><span>70+ readiness</span></div>
          <div className="tde-hstat"><b>{new Set(sourceTalents.map(p => p.nation).filter(Boolean)).size}</b><span>Countries</span></div>
        </div>
      </header>

      {view === 'discover' && (
        <div className="tde-grid">
          <aside className="tde-rail">
            <div className="tde-rail-head"><span>Filters</span><button type="button" onClick={resetFilters}>Reset all</button></div>
            <label className="tde-search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Player, club or league" /></label>
            <select aria-label="Age" value={age} onChange={e => setAge(e.target.value)}><option value="all">All ages</option><option value="u18">U18</option><option value="u21">U21</option><option value="u23">U22</option></select>
            <select aria-label="Position" value={position} onChange={e => setPosition(e.target.value)}>{POSITION_OPTIONS.map(item => <option key={item} value={item}>{item === 'all' ? 'All positions' : item}</option>)}</select>
            <select aria-label="Potential" value={potential} onChange={e => setPotential(e.target.value)}><option value="70">Potential 70+</option><option value="80">Potential 80+</option><option value="85">Potential 85+</option><option value="90">Potential 90+</option></select>
            <select aria-label="Rating" value={minRating} onChange={e => setMinRating(e.target.value)}><option value="all">All ratings</option><option value="80">Calibre 80+</option><option value="75">Calibre 75+</option><option value="70">Calibre 70+</option></select>
            <div className="tde-rail-group">
              <h4>Trajectory pathway</h4>
              {PATHWAY_FILTERS.map(f => (
                <label className="tde-check" key={f.key}><input type="checkbox" checked={pathwayType === f.key} onChange={() => setPathwayType(pathwayType === f.key && f.key !== 'all' ? 'all' : f.key)} /><span>{f.label}</span></label>
              ))}
            </div>
            <div className="tde-rail-group">
              <h4>Region</h4>
              {TALENT_REGIONS.map(item => (
                <label className="tde-check" key={item.key}><input type="checkbox" checked={region === item.key} onChange={() => setRegion(region === item.key && item.key !== 'all' ? 'all' : item.key)} /><span>{item.label}</span><b>{counts[item.key] || 0}</b></label>
              ))}
            </div>
          </aside>

          <main className="tde-pool">
            <div className="tde-pool-head">
              <div><span className="tde-eyebrow">Discovery Pool</span><strong>{filtered.length} players found</strong></div>
              <label className="tde-sort"><span>Sort by</span>
                <select value={sort} onChange={e => setSort(e.target.value)}><option value="readiness">Readiness</option><option value="rating">Rating</option><option value="trend">Trajectory</option><option value="age">Youngest</option></select>
              </label>
            </div>
            <div className="tde-region-chips">
              {TALENT_REGIONS.map(item => (
                <button type="button" key={item.key} className={`tde-chip${region === item.key ? ' on' : ''}`} onClick={() => setRegion(item.key)}>{item.label} <b>{counts[item.key] || 0}</b></button>
              ))}
            </div>
            <div className="tde-cards" ref={resultsRef}>
              {filtered.length ? filtered.slice(0, visibleCount).map(player => (
                <PoolCard key={playerKey(player)} player={player} selected={selected?.name === player.name} shortlisted={shortlist.includes(player.name)} onSelect={chosen => setSelectedName(chosen.name)} onToggleShortlist={toggleShortlist} />
              )) : <div className="tde-empty-pool"><Search size={22} /><h3>No talents match those filters.</h3><button type="button" className="btn btn--outline btn--sm" onClick={resetFilters}>Reset filters</button></div>}
            </div>
            {filtered.length > visibleCount && <div className="tde-more"><button type="button" className="btn btn--lime" onClick={() => setVisibleCount(count => count + 48)}>Load more players ({filtered.length - visibleCount} remaining)</button></div>}
          </main>

          <aside className="tde-detail">
            <ScoutPanel player={selected} shortlisted={selected ? shortlist.includes(selected.name) : false} onToggleShortlist={toggleShortlist} />
          </aside>
        </div>
      )}

      {view === 'pathways' && <TrajectoryPathway player={selected} pool={sourceTalents} onSelect={setSelectedName} />}

      {view === 'rankings' && <section className="talent-ranking-panel">
        <div className="talent-ranking-panel__head"><div><span>Trajectory-adjusted ranking</span><h2>Players moving fastest</h2></div><p>Readiness, potential and recent movement combine to surface the most actionable prospects.</p></div>
        {ranked.map((player,index)=><button type="button" className="talent-ranking-row" key={player.name} onClick={()=>{setSelectedName(player.name);setView('pathways')}}><i>{String(index+1).padStart(2,'0')}</i><ApiPlayerImage playerId={playerApiId(player)} name={player.name} preferredSrc={imageFor(player)} fallbackSrc="/assets/players/neutral-player.svg" allowLookup={allowOfficialLookup(player)} alt={player.name} loading="lazy"/><span><strong>{player.name}</strong><small>{player.flag} {player.club} · {player.role}</small></span><em>{player.trend}</em><b>{clamp(Math.round((player.readiness+player.potential)/2),0,99)}</b></button>)}
      </section>}

      {view === 'youth' && <section className="yr2">
        <style>{`
          .yr2 { --l:#c8fa3c; --line:rgba(255,255,255,.09); --card:rgba(255,255,255,.03); --muted:#8b9299; }
          .yr2 * { box-sizing:border-box; }
          .yr2-top { display:flex; gap:18px; align-items:flex-end; justify-content:space-between; flex-wrap:wrap; margin-bottom:14px; }
          .yr2-top .eyebrow { color:var(--l); font:600 11px/1 "Barlow",sans-serif; letter-spacing:.16em; text-transform:uppercase; }
          .yr2-top h2 { margin:8px 0 6px; color:#fff; font:800 30px/1 "Barlow Condensed",sans-serif; letter-spacing:.01em; text-transform:uppercase; }
          .yr2-top h2 em { color:var(--l); font-style:normal; }
          .yr2-top p { margin:0; color:var(--muted); font:500 13px/1.5 "Barlow",sans-serif; max-width:440px; }
          .yr2-top p strong { color:#cfd4da; }
          .yr2-stats { display:flex; gap:10px; flex-wrap:wrap; }
          .yr2-stat { border:1px solid var(--line); border-radius:12px; background:var(--card); padding:12px 14px; min-width:92px; text-align:left; }
          .yr2-stat b { display:block; font:800 24px/1 "Barlow Condensed",sans-serif; color:#fff; }
          .yr2-stat span { display:block; margin-top:5px; color:var(--muted); font:600 9px/1.2 "Barlow",sans-serif; letter-spacing:.08em; text-transform:uppercase; }
          .yr2-stat small { display:block; color:#5f6976; font:500 9px "Barlow",sans-serif; margin-top:2px; }
          button.yr2-stat { cursor:pointer; }
          button.yr2-stat.on { border-color:var(--l); background:rgba(200,250,60,.1); }
          button.yr2-stat.on b { color:var(--l); }
          .yr2-note { display:flex; gap:9px; align-items:flex-start; border:1px solid var(--line); border-radius:11px; background:rgba(255,255,255,.02); padding:11px 14px; margin-bottom:16px; color:var(--muted); font:500 12px/1.5 "Barlow",sans-serif; }
          .yr2-note svg { color:var(--l); flex:none; margin-top:1px; }
          .yr2-grid { display:grid; grid-template-columns:240px minmax(0,1fr); gap:16px; align-items:start; }
          @media (max-width:820px){ .yr2-grid { grid-template-columns:1fr; } .yr2-rail { display:none; } }
          .yr2-rail { border:1px solid var(--line); border-radius:14px; background:var(--card); padding:16px; position:sticky; top:14px; }
          .yr2-rail h4 { display:flex; align-items:center; justify-content:space-between; margin:0 0 12px; color:#e9edf1; font:800 12px/1 "Barlow Condensed",sans-serif; letter-spacing:.12em; text-transform:uppercase; }
          .yr2-rail h4 button { background:none; border:none; color:var(--l); font:700 10px "Barlow",sans-serif; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; }
          .yr2-search { display:flex; align-items:center; gap:8px; height:36px; padding:0 10px; border:1px solid var(--line); border-radius:9px; background:rgba(255,255,255,.03); color:var(--muted); margin-bottom:12px; }
          .yr2-search input { flex:1; min-width:0; background:none; border:none; outline:none; color:#e9edf1; font:500 13px "Barlow",sans-serif; }
          .yr2-search button { background:none; border:none; color:var(--muted); cursor:pointer; display:flex; }
          .yr2-field { margin-bottom:14px; }
          .yr2-field > label { display:block; color:var(--muted); font:700 9.5px "Barlow",sans-serif; letter-spacing:.1em; text-transform:uppercase; margin-bottom:7px; }
          .yr2-field select { width:100%; height:34px; padding:0 10px; border:1px solid var(--line); border-radius:9px; background:rgba(255,255,255,.03); color:#d8dde2; font:600 12px "Barlow",sans-serif; cursor:pointer; }
          .yr2-bands { display:flex; flex-wrap:wrap; gap:6px; }
          .yr2-bands button { border:1px solid var(--line); background:rgba(255,255,255,.02); color:#b6bcc3; border-radius:999px; padding:6px 11px; font:700 11px "Barlow Condensed",sans-serif; cursor:pointer; }
          .yr2-bands button.on { background:var(--l); color:#0a0d05; border-color:var(--l); }
          .yr2-check { display:flex; align-items:center; gap:9px; cursor:pointer; color:#cfd4da; font:600 12px "Barlow",sans-serif; }
          .yr2-check input { appearance:none; width:16px; height:16px; border:1px solid rgba(255,255,255,.22); border-radius:5px; background:rgba(255,255,255,.03); position:relative; cursor:pointer; flex:none; }
          .yr2-check input:checked { background:var(--l); border-color:var(--l); }
          .yr2-check input:checked::after { content:""; position:absolute; left:5px; top:2px; width:4px; height:8px; border:solid #0a0d05; border-width:0 2px 2px 0; transform:rotate(45deg); }
          .yr2-check i { margin-left:auto; font-style:normal; color:var(--muted); font:700 11px "Barlow",sans-serif; }
          .yr2-main { min-width:0; }
          .yr2-status { color:var(--muted); font:500 13px "Barlow",sans-serif; padding:26px 4px; }
          .yr2-inline-clear { background:none; border:none; color:var(--l); cursor:pointer; font:inherit; text-decoration:underline; }
          .yr2-league { margin-bottom:22px; }
          .yr2-league-head { display:flex; align-items:center; gap:10px; margin-bottom:11px; }
          .yr2-league-head img { width:22px; height:22px; object-fit:contain; }
          .yr2-league-head strong { color:#eef1f4; font:800 15px "Barlow Condensed",sans-serif; letter-spacing:.02em; text-transform:uppercase; }
          .yr2-league-head em { color:var(--muted); font:600 11px "Barlow",sans-serif; font-style:normal; }
          .yr2-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(206px,1fr)); gap:12px; }
          .yr2-card { position:relative; border:1px solid var(--line); border-radius:14px; background:var(--card); overflow:hidden; transition:border-color .15s,transform .15s; }
          .yr2-card:hover { border-color:rgba(200,250,60,.4); transform:translateY(-2px); }
          .yr2-card-top { position:absolute; inset:8px 8px auto 8px; display:flex; align-items:flex-start; justify-content:space-between; z-index:2; }
          .yr2-badge { display:flex; flex-direction:column; align-items:center; background:rgba(6,9,12,.72); border:1px solid var(--line); border-radius:9px; padding:5px 9px; backdrop-filter:blur(6px); }
          .yr2-badge b { font:800 20px/1 "Barlow Condensed",sans-serif; color:#fff; }
          .yr2-badge span { font:700 8px/1 "Barlow",sans-serif; letter-spacing:.08em; color:#aeb4bb; margin-top:3px; }
          .yr2-star { width:28px; height:28px; display:grid; place-items:center; border-radius:8px; border:1px solid var(--line); background:rgba(6,9,12,.72); color:#cdd3d9; cursor:pointer; backdrop-filter:blur(6px); }
          .yr2-star.on { color:var(--l); border-color:rgba(200,250,60,.4); }
          .yr2-photo { position:relative; margin:12px 12px 0; height:132px; border-radius:11px; overflow:hidden; border:1px solid rgba(255,255,255,.1); background:radial-gradient(120% 110% at 50% 0%, rgba(255,255,255,.07), #0a0d10 70%); }
          .yr2-photo img { width:100%; height:100%; object-fit:cover; object-position:center 12%; display:block; }
          .yr2-photo::after { content:""; position:absolute; inset:0; border-radius:11px; background:linear-gradient(180deg,transparent 60%,rgba(11,13,15,.5)); }
          .yr2-crest { position:absolute; right:8px; bottom:8px; width:26px; height:26px; z-index:2; }
          .yr2-crest img { width:100%; height:100%; object-fit:contain; }
          .yr2-body { padding:12px 13px 13px; }
          .yr2-body h3 { margin:0; color:#f2f5f7; font:700 15px/1.15 "Barlow",sans-serif; }
          .yr2-body .role { margin:3px 0 1px; color:#b6bcc3; font:600 10.5px "Barlow",sans-serif; letter-spacing:.05em; text-transform:uppercase; }
          .yr2-body .meta { color:#6b7480; font:500 11px "Barlow",sans-serif; display:flex; align-items:center; gap:5px; }
          .yr2-tags { display:flex; align-items:center; gap:6px; margin-top:10px; flex-wrap:wrap; }
          .yr2-up { display:inline-flex; align-items:baseline; gap:3px; padding:3px 8px; border-radius:6px; background:rgba(200,250,60,.14); }
          .yr2-up b { color:var(--l); font:800 12px "Barlow Condensed",sans-serif; }
          .yr2-up span { color:var(--l); font:700 8px "Barlow",sans-serif; letter-spacing:.06em; text-transform:uppercase; opacity:.85; }
          .yr2-sig { padding:3px 8px; border-radius:6px; font:800 8.5px/1.4 "Barlow Condensed",sans-serif; letter-spacing:.08em; text-transform:uppercase; }
          .yr2-sig.extreme { background:rgba(200,250,60,.18); color:var(--l); }
          .yr2-sig.strong { background:rgba(160,230,80,.14); color:#c3ec6a; }
          .yr2-sig.notable { background:rgba(80,180,255,.14); color:#7fc4ff; }
          .yr2-sig.watch { background:rgba(255,255,255,.07); color:#aeb4bb; }
        `}</style>

        <div className="yr2-top">
          <div>
            <div className="eyebrow">Academy &amp; reserve pipelines</div>
            <h2>Prospect <em>Signals</em></h2>
            <p>Young players flagged by how far above their age group they're competing. A discovery surface, <strong>not a performance ranking</strong>.</p>
          </div>
          <div className="yr2-stats">
            <div className="yr2-stat"><b>{youthStats.total.toLocaleString()}</b><span>Prospects</span><small>All leagues</small></div>
            <div className="yr2-stat"><b>{youthStats.leagues}</b><span>Leagues</span><small>Academy &amp; reserve</small></div>
            <div className="yr2-stat"><b>{youthStats.extreme}</b><span>Extreme</span><small>+6 years up</small></div>
            <div className="yr2-stat"><b>{youthStats.youngest}</b><span>Youngest</span><small>Years old</small></div>
            <button type="button" className={`yr2-stat${youthShortlistOnly ? ' on' : ''}`} onClick={() => setYouthShortlistOnly(v => !v)} title={shortlist.length ? 'Show only shortlisted prospects' : 'Bookmark prospects to build a watchlist'}>
              <b>{shortlist.length}</b><span>Shortlisted</span><small>{youthShortlistOnly ? 'Showing · clear' : 'Your watchlist'}</small>
            </button>
          </div>
        </div>

        <div className="yr2-note">
          <Filter size={15} />
          <span>Signal strength is the age-level gap: a 16-year-old in U21 football reads +5 years up. Youth match data isn't published, so use these as discovery signals, not performance ratings.</span>
        </div>

        <div className="yr2-grid">
          <aside className="yr2-rail">
            <h4>Filters <button type="button" onClick={() => { setYouthQuery(''); setYouthAge('all'); setYouthPos('all'); setYouthLeague('all'); setYouthPlayingUpOnly(false); }}>Clear all</button></h4>
            <div className="yr2-search">
              <Search size={15} />
              <input type="text" value={youthQuery} placeholder="Prospect, club, nation…" onChange={e => setYouthQuery(e.target.value)} />
              {youthQuery && <button type="button" onClick={() => setYouthQuery('')}><X size={13} /></button>}
            </div>
            <div className="yr2-field">
              <label>Age band</label>
              <div className="yr2-bands">{YOUTH_AGE_BANDS.map(b => <button type="button" key={b} className={youthAge === b ? 'on' : ''} onClick={() => setYouthAge(b)}>{b === 'all' ? 'All' : b}</button>)}</div>
            </div>
            <div className="yr2-field">
              <label>Position</label>
              <select value={youthPos} onChange={e => setYouthPos(e.target.value)}>{YOUTH_POSITIONS.map(p => <option key={p} value={p}>{p === 'all' ? 'All positions' : p}</option>)}</select>
            </div>
            <div className="yr2-field">
              <label>League / competition</label>
              <select value={youthLeague} onChange={e => setYouthLeague(e.target.value)}>{youthLeagueOptions.map(l => <option key={l} value={l}>{l === 'all' ? 'All leagues' : l}</option>)}</select>
            </div>
            <div className="yr2-field">
              <label>Playing up</label>
              <label className="yr2-check"><input type="checkbox" checked={youthPlayingUpOnly} onChange={e => setYouthPlayingUpOnly(e.target.checked)} /> 3+ years up only <i>{youthProspects.filter(p => p.plays_up_years >= 3).length}</i></label>
            </div>
          </aside>

          <div className="yr2-main">
            {youthLoading && <p className="yr2-status">Loading prospect directory…</p>}
            {!youthLoading && youthShortlistOnly && shortlist.length === 0 && <p className="yr2-status">Your watchlist is empty. Tap the star on any prospect card to add them here.</p>}
            {!youthLoading && youthLoaded && !youthShortlistOnly && youthFiltered.length === 0 && <p className="yr2-status">No prospects match these filters. Try widening the age band or clearing the search.</p>}
            {!youthLoading && youthShortlistOnly && shortlist.length > 0 && youthFiltered.length === 0 && <p className="yr2-status">None of your shortlisted prospects match the current filters. <button type="button" className="yr2-inline-clear" onClick={() => { setYouthQuery(''); setYouthAge('all'); setYouthPos('all'); setYouthLeague('all'); setYouthPlayingUpOnly(false); }}>Clear filters</button></p>}

            {!youthLoading && youthByLeague.map(([league, players]) => (
              <div className="yr2-league" key={league}>
                <div className="yr2-league-head">
                  {players[0]?.logo && <img src={players[0].logo} alt="" loading="lazy" />}
                  <strong>{league}</strong>
                  <em>{players.length} prospect{players.length === 1 ? '' : 's'}</em>
                </div>
                <div className="yr2-cards">
                  {players.slice(0, youthLeague !== 'all' ? 200 : 10).map(p => {
                    const sig = youthSignal(p.plays_up_years);
                    const saved = shortlist.includes(p.name);
                    return (
                      <article className="yr2-card" key={`${p.api_player_id}-${p.season}`}>
                        <div className="yr2-photo">
                          <div className="yr2-card-top">
                            <div className="yr2-badge"><b>{p.age ?? '—'}</b><span>Age</span></div>
                            <button type="button" className={`yr2-star${saved ? ' on' : ''}`} aria-label={`${saved ? 'Remove from' : 'Add to'} shortlist`} onClick={() => toggleShortlist(p.name, { apiPlayerId: p.api_player_id, context: 'youth' })}>{saved ? <BookmarkCheck size={15} /> : <Star size={15} />}</button>
                          </div>
                          <ApiPlayerImage playerId={p.api_player_id} name={p.name} preferredSrc={p.photo} fallbackSrc="/assets/players/neutral-player.svg" allowLookup={false} alt={cleanName(p.name)} loading="lazy" />
                          {p.logo && <div className="yr2-crest"><img src={p.logo} alt="" loading="lazy" /></div>}
                        </div>
                        <div className="yr2-body">
                          <h3>{cleanName(p.name)}</h3>
                          <div className="role">{p.position || '—'}</div>
                          <div className="meta">{flagFor(p.nationality)} {p.club || '—'} · {p.nationality || '—'}</div>
                          <div className="yr2-tags">
                            {p.plays_up_years >= 1 && <span className="yr2-up"><b>+{p.plays_up_years}</b><span>yrs up</span></span>}
                            {sig && <span className={`yr2-sig ${sig.cls}`}>{sig.label}</span>}
                          </div>
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
