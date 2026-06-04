import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowRight, BarChart3, CheckCircle2, CircleDot, Crown, Database,
  Download, FileText, GitCompare, Layers3, Search, Share2, ShieldCheck, Sparkles, Star,
} from 'lucide-react';
import { navigateTo } from '../components/NavLink.jsx';
import { searchPlayerProfiles as searchApiPlayers, searchTeams as searchApiTeams } from '../services/apiFootball.js';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import {
  SYSTEM_PLAYERS, SYSTEM_TEAMS, TRANSFER_SPOTLIGHTS, buildPlayerComparison, buildSystemFitReport,
  searchLocalPlayers, searchLocalTeams,
} from '../data/systemFitData.js';
import {
  exportComparisonCsv, exportComparisonPdf, exportFitCsv, exportFitPdf,
} from '../services/reportExport.js';

const DEMO_PLAN = (import.meta.env.VITE_DEMO_PLAN || 'pro').toLowerCase();
const CAN_EXPORT = ['pro', 'scout', 'club'].includes(DEMO_PLAN);

function normalizeApiTeam(team) {
  return {
    ...SYSTEM_TEAMS[0],
    id: team.id,
    name: team.name,
    short: team.name,
    country: team.country || 'International',
    league: team.league || 'API-Football database',
    crestUrl: team.crestUrl,
    crest: team.name.split(' ').slice(0, 2).map(word => word[0]).join('').slice(0, 3).toUpperCase(),
    philosophy: 'Data profile pending enrichment',
    source: 'api',
  };
}

function normalizeApiPlayer(player) {
  return {
    ...SYSTEM_PLAYERS[0],
    id: player.id,
    name: player.name,
    team: player.team || 'Live API player directory',
    age: player.age || '—',
    image: player.image || '/assets/players/neutral-player.svg',
    position: player.position || 'Profile pending',
    archetype: 'Profile pending enrichment',
    source: 'api',
  };
}

function useDatabaseSearch(kind, query) {
  const [remote, setRemote] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (query.trim().length < 3) {
      setRemote([]);
      setLoading(false);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = kind === 'team' ? await searchApiTeams(query) : await searchApiPlayers(query);
        if (!cancelled) setRemote(rows || []);
      } catch {
        if (!cancelled) setRemote([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind, query]);

  return { remote, loading };
}

function Crest({ team, size = 38 }) {
  if (team.crestUrl) {
    return <img src={team.crestUrl} alt="" className="sf-crest-img" style={{ width: size, height: size }} />;
  }
  return (
    <div className="sf-crest" style={{ width: size, height: size, background: team.accent, color: team.secondary }}>
      {team.crest}
    </div>
  );
}

function ScoreRing({ score, compact = false }) {
  const radius = compact ? 31 : 43;
  const width = compact ? 84 : 116;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className={`sf-score-ring ${compact ? 'sf-score-ring--compact' : ''}`} style={{ width, height: width }}>
      <svg width={width} height={width} viewBox={`0 0 ${width} ${width}`}>
        <circle cx={width / 2} cy={width / 2} r={radius} className="sf-ring-track" />
        <circle cx={width / 2} cy={width / 2} r={radius} className="sf-ring-fill" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="sf-score-ring-value"><strong>{score}</strong><span>FIT</span></div>
    </div>
  );
}

function MetricBar({ label, value, compare }) {
  return (
    <div className="sf-metric-row">
      <div className="sf-metric-label"><span>{label}</span><b>{value}</b></div>
      <div className="sf-metric-track">
        <span className="sf-metric-fill" style={{ width: `${value}%` }} />
        {typeof compare === 'number' && <span className="sf-metric-compare" style={{ left: `${compare}%` }} />}
      </div>
    </div>
  );
}

function ExportButtons({ mode, fitReport, comparison }) {
  function blocked() {
    navigateTo('/pricing');
  }
  const fit = mode !== 'compare';
  const run = (format) => {
    if (!CAN_EXPORT) return blocked();
    if (fit && format === 'csv') return exportFitCsv(fitReport);
    if (fit && format === 'pdf') return exportFitPdf(fitReport);
    if (!fit && format === 'csv') return exportComparisonCsv(comparison);
    return exportComparisonPdf(comparison);
  };
  return (
    <div className="sf-export-actions">
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => run('pdf')}>
        <FileText size={14} /> PDF REPORT <span className="sf-pro-chip">PRO+</span>
      </button>
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => run('csv')}>
        <Download size={14} /> CSV DATA <span className="sf-pro-chip">PRO+</span>
      </button>
    </div>
  );
}

function SearchSidebar({ selectedTeam, selectedPlayer, setSelectedTeam, setSelectedPlayer }) {
  const [kind, setKind] = useState('team');
  const [query, setQuery] = useState('');
  const { remote, loading } = useDatabaseSearch(kind, query);
  const local = kind === 'team' ? searchLocalTeams(query) : searchLocalPlayers(query);
  const localIds = new Set(local.map(item => String(item.id)));
  const merged = [...local, ...remote.filter(item => !localIds.has(String(item.id)))].slice(0, 8);

  const choose = (item) => {
    if (kind === 'team') setSelectedTeam(String(item.source || '').startsWith('api') ? normalizeApiTeam(item) : item);
    else setSelectedPlayer(String(item.source || '').startsWith('api') ? normalizeApiPlayer(item) : item);
  };

  return (
    <aside className="sf-sidebar">
      <div className="sf-search-tabs">
        <button type="button" className={kind === 'team' ? 'active' : ''} onClick={() => { setKind('team'); setQuery(''); }}>TEAM SEARCH</button>
        <button type="button" className={kind === 'player' ? 'active' : ''} onClick={() => { setKind('player'); setQuery(''); }}>PLAYER SEARCH</button>
      </div>
      <label className="sf-search-box">
        <Search size={14} />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder={kind === 'team' ? 'Search clubs...' : 'Search players...'} />
      </label>
      <div className="sf-database-note"><Database size={13} /> Local index + API-Football database {loading && <span>SEARCHING…</span>}</div>
      <div className="sf-search-results">
        {merged.map(item => (
          <button type="button" className="sf-search-result" key={`${kind}-${item.id}`} onClick={() => choose(item)}>
            {kind === 'team' ? <Crest team={item.source === 'api' ? normalizeApiTeam(item) : item} size={32} /> : <ApiPlayerImage playerId={item.id} name={item.name} preferredSrc={item.image} fallbackSrc="/assets/players/neutral-player.svg" alt={item.name} />}
            <span><b>{item.name}</b><small>{kind === 'team' ? `${item.country} · ${item.league || 'database club'}` : `${item.team} · ${item.position}`}</small></span>
          </button>
        ))}
      </div>
      <div className="sf-sidebar-section">
        <div className="sf-kicker">CURRENT REPORT</div>
        <div className="sf-current-pair">
          <Crest team={selectedTeam} size={38} />
          <div><b>{selectedTeam.name}</b><small>{selectedTeam.formation} · {selectedTeam.philosophy}</small></div>
        </div>
        <div className="sf-current-pair">
          <ApiPlayerImage playerId={selectedPlayer.id} name={selectedPlayer.name} preferredSrc={selectedPlayer.image} fallbackSrc="/assets/players/neutral-player.svg" alt={selectedPlayer.name} />
          <div><b>{selectedPlayer.name}</b><small>{selectedPlayer.position} · {selectedPlayer.archetype}</small></div>
        </div>
      </div>
      <div className="sf-sidebar-section">
        <div className="sf-kicker">REPORT ENGINE</div>
        <div className="sf-engine-row"><CheckCircle2 size={14} /> Dynamic fit scoring</div>
        <div className="sf-engine-row"><CheckCircle2 size={14} /> Compare-player dataset</div>
        <div className="sf-engine-row"><CheckCircle2 size={14} /> PDF + CSV export layer</div>
      </div>
    </aside>
  );
}

function PlayerHero({ report, mode, comparison, challenger }) {
  const player = report.player;
  return (
    <section className="sf-hero-card">
      <div className="sf-hero-topline">
        <div><span>CALIBRE SYSTEM FIT ENGINE</span><b>REPORT GENERATED FROM LIVE SELECTIONS</b></div>
        <div className="sf-live"><i /> DATA MODEL ACTIVE</div>
      </div>
      <div className="sf-hero-grid">
        <div className="sf-player-portrait">
          <ApiPlayerImage playerId={player.id} name={player.name} preferredSrc={player.image} fallbackSrc="/assets/players/neutral-player.svg" alt={player.name} />
          <div className="sf-player-portrait-fade" />
          <div className="sf-player-portrait-label"><small>{player.archetype}</small><strong>{player.name}</strong><span>{player.position} · {player.team}</span></div>
        </div>
        <div className="sf-score-summary">
          <div className="sf-kicker">DOES HE FIT?</div>
          <div className="sf-score-main"><ScoreRing score={report.score} /><div><h2>{report.verdict}</h2><p>{report.conclusion}</p></div></div>
          <div className="sf-score-chips"><span>{report.team.formation}</span><span>{report.team.philosophy}</span><span>{player.archetype}</span></div>
        </div>
        <div className="sf-breakdown-card">
          <div className="sf-kicker">FIT BREAKDOWN</div>
          {report.breakdown.slice(0, 6).map(item => <MetricBar key={item.label} label={item.label} value={item.value} />)}
        </div>
      </div>
      {mode === 'compare' && (
        <div className="sf-compare-banner"><GitCompare size={16} /><span>COMPARISON MODE</span><b>{player.name}</b><em>vs</em><b>{challenger.name}</b><strong>{comparison.primaryScore}% / {comparison.challengerScore}%</strong></div>
      )}
    </section>
  );
}


function TransferSpotlight({ spotlight, onLoad }) {
  const player = SYSTEM_PLAYERS.find(item => item.id === spotlight.playerId) || SYSTEM_PLAYERS[0];
  const team = SYSTEM_TEAMS.find(item => item.id === spotlight.teamId) || SYSTEM_TEAMS[0];
  return (
    <section className="sf-transfer-spotlight">
      <div className="sf-transfer-topline">
        <span><Sparkles size={14} /> {spotlight.window}</span>
        <em>{spotlight.status}</em>
      </div>
      <div className="sf-transfer-grid">
        <div className="sf-transfer-player">
          <ApiPlayerImage playerId={player.id} name={player.name} preferredSrc={player.image} fallbackSrc="/assets/players/neutral-player.svg" alt={player.name} />
          <div className="sf-transfer-player-copy">
            <small>{player.team} → {team.name}</small>
            <h2>{spotlight.headline}</h2>
            <p>{spotlight.dek}</p>
            <button type="button" className="btn btn--lime btn--sm" onClick={() => onLoad(player, team)}>LOAD FULL FIT REPORT <ArrowRight size={13} /></button>
          </div>
        </div>
        <div className="sf-lineup-board" aria-label="Possible lineup positions">
          <div className="sf-lineup-board__title"><Layers3 size={14} /> POSSIBLE LINEUP POSITIONS <b>{team.formation}</b></div>
          <div className="sf-pitch">
            <span className="sf-pitch-half" />
            <span className="sf-pitch-box sf-pitch-box--top" />
            <span className="sf-pitch-box sf-pitch-box--bottom" />
            <span className="sf-pitch-direction">ATTACK ↑</span>
            {spotlight.lineup.map(position => (
              <div className={`sf-pitch-role ${position.label === 'PRIMARY' ? 'sf-pitch-role--primary' : ''}`} key={`${position.role}-${position.label}`} style={{ left: `${position.x}%`, top: `${position.y}%` }}>
                <CircleDot size={18} /><b>{position.role}</b><em>{position.score}%</em><small>{position.label}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="sf-transfer-read">
          <div className="sf-kicker">TRANSFER FIT READ</div>
          <p>{spotlight.verdict}</p>
          <div className="sf-transfer-points">{spotlight.talkingPoints.map(text => <span key={text}><i />{text}</span>)}</div>
          <small>{spotlight.sourceNote}</small>
        </div>
      </div>
    </section>
  );
}

function FitOverview({ report }) {
  return (
    <div className="sf-content-grid">
      <section className="sf-panel sf-panel--wide">
        <div className="sf-panel-head"><div><Activity size={17} /><span>ROLE FIT PULSE</span></div><b>{report.player.archetype}</b></div>
        <div className="sf-role-pulse-intro"><div className="sf-pulse-icon"><Activity size={26} /><span /></div><p>The pulse measures how reliably the player's strongest actions survive inside the selected system. It is a football-role signal, not a body map.</p></div>
        <div className="sf-pulse-grid">{report.rolePulse.map(item => <MetricBar key={item.label} label={item.label} value={item.value} />)}</div>
      </section>
      <section className="sf-panel">
        <div className="sf-panel-head"><div><BarChart3 size={17} /><span>TEAM DNA MATCH</span></div></div>
        {Object.entries(report.team.traits).map(([label, value]) => <MetricBar key={label} label={label.replace('defensiveLoad', 'defensive load')} value={value} compare={report.player.traits[label]} />)}
        <div className="sf-panel-legend"><span><i className="lime" />team demand</span><span><i className="marker" />player profile</span></div>
      </section>
      <section className="sf-panel sf-panel--wide">
        <div className="sf-panel-head"><div><ShieldCheck size={17} /><span>TACTICAL READ</span></div></div>
        <div className="sf-analysis-columns">
          <div><div className="sf-kicker">WHAT WORKS</div>{report.strengths.map(text => <p key={text}>+ {text}</p>)}</div>
          <div><div className="sf-kicker">WHAT NEEDS PROTECTION</div>{report.risks.map(text => <p key={text}>- {text}</p>)}</div>
        </div>
      </section>
      <section className="sf-panel">
        <div className="sf-panel-head"><div><Star size={17} /><span>ROLE MAP</span></div></div>
        <div className="sf-role-list">{report.primaryRoles.map((role, index) => <div key={role}><b>0{index + 1}</b><span>{role}</span><strong>{Math.max(72, report.score - index * 6)}%</strong></div>)}</div>
      </section>
    </div>
  );
}

function ComparePlayers({ comparison, challenger, setChallenger }) {
  return (
    <div className="sf-content-grid">
      <section className="sf-panel sf-panel--wide">
        <div className="sf-panel-head"><div><GitCompare size={17} /><span>COMPARE PLAYER PROFILES</span></div><select value={challenger.id} onChange={event => setChallenger(SYSTEM_PLAYERS.find(player => String(player.id) === event.target.value) || SYSTEM_PLAYERS[1])}>{SYSTEM_PLAYERS.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}</select></div>
        <div className="sf-compare-head">
          <div><ApiPlayerImage playerId={comparison.primary.id} name={comparison.primary.name} preferredSrc={comparison.primary.image} fallbackSrc="/assets/players/neutral-player.svg" alt={comparison.primary.name}/><span><b>{comparison.primary.name}</b><small>{comparison.primary.archetype}</small></span><strong>{comparison.primaryScore}%</strong></div>
          <em>VS</em>
          <div><ApiPlayerImage playerId={comparison.challenger.id} name={comparison.challenger.name} preferredSrc={comparison.challenger.image} fallbackSrc="/assets/players/neutral-player.svg" alt={comparison.challenger.name}/><span><b>{comparison.challenger.name}</b><small>{comparison.challenger.archetype}</small></span><strong>{comparison.challengerScore}%</strong></div>
        </div>
        <div className="sf-versus-bars">{comparison.dimensions.map(item => (
          <div key={item.label}><span>{item.primary}</span><div><i style={{ width: `${item.primary}%` }} /><b>{item.label}</b><i className="right" style={{ width: `${item.challenger}%` }} /></div><span>{item.challenger}</span></div>
        ))}</div>
      </section>
      <section className="sf-panel">
        <div className="sf-panel-head"><div><FileText size={17} /><span>COMPARISON VERDICT</span></div></div>
        <p className="sf-verdict-copy">{comparison.verdict}</p>
      </section>
    </div>
  );
}

function DetailedAnalysis({ report }) {
  return (
    <div className="sf-analysis-report">
      <section className="sf-panel">
        <div className="sf-panel-head"><div><FileText size={17} /><span>DETAILED ANALYSIS</span></div><b>{report.generatedAt.slice(0, 10)}</b></div>
        <div className="sf-report-copy">
          <div className="sf-report-lead"><ScoreRing score={report.score} compact /><div><h3>{report.player.name} at {report.team.name}</h3><p>{report.conclusion}</p></div></div>
          <h4>Why the fit works</h4>{report.strengths.map(text => <p key={text}>• {text}</p>)}
          <h4>Where the model is cautious</h4>{report.risks.map(text => <p key={text}>• {text}</p>)}
          <h4>Recommended role usage</h4><p>{report.player.name} should be used primarily as a {report.primaryRoles[0].toLowerCase()}, with permission to attack the decisive phase rather than becoming a generic all-purpose midfielder.</p>
        </div>
      </section>
      <section className="sf-panel">
        <div className="sf-panel-head"><div><Database size={17} /><span>REPORT DATASET</span></div></div>
        <div className="sf-data-table"><div><b>Metric</b><b>Score</b></div>{report.breakdown.map(item => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>
      </section>
    </div>
  );
}

export default function SystemFit() {
  const [selectedTeam, setSelectedTeam] = useState(SYSTEM_TEAMS[0]);
  const [selectedPlayer, setSelectedPlayer] = useState(SYSTEM_PLAYERS[0]);
  const [challenger, setChallenger] = useState(SYSTEM_PLAYERS[1]);
  const [mode, setMode] = useState('fit');

  useEffect(() => {
    const playerQuery = new URLSearchParams(window.location.search).get('player');
    if (!playerQuery) return;
    searchApiPlayers(playerQuery).then(rows => {
      if (rows?.[0]) setSelectedPlayer(normalizeApiPlayer(rows[0]));
    }).catch(() => {});
  }, []);

  const report = useMemo(() => buildSystemFitReport(selectedPlayer, selectedTeam), [selectedPlayer, selectedTeam]);
  const comparison = useMemo(() => buildPlayerComparison(selectedPlayer, challenger, selectedTeam), [selectedPlayer, challenger, selectedTeam]);

  return (
    <div className="page sf-page">
      <SearchSidebar selectedTeam={selectedTeam} selectedPlayer={selectedPlayer} setSelectedTeam={setSelectedTeam} setSelectedPlayer={setSelectedPlayer} />
      <main className="sf-main">
        <div className="sf-pagebar">
          <div><div className="sf-kicker">PLAYER INTELLIGENCE</div><h1>SYSTEM FIT ENGINE</h1></div>
          <div className="sf-pagebar-actions"><button type="button" className="btn btn--ghost btn--sm"><Share2 size={14} /> SHARE</button><ExportButtons mode={mode} fitReport={report} comparison={comparison} /></div>
        </div>
        <div className="sf-mode-tabs">
          <button type="button" className={mode === 'fit' ? 'active' : ''} onClick={() => setMode('fit')}>SYSTEM FIT</button>
          <button type="button" className={mode === 'compare' ? 'active' : ''} onClick={() => setMode('compare')}>COMPARE PLAYER</button>
          <button type="button" className={mode === 'analysis' ? 'active' : ''} onClick={() => setMode('analysis')}>DETAILED ANALYSIS</button>
        </div>
        <TransferSpotlight spotlight={TRANSFER_SPOTLIGHTS[0]} onLoad={(player, team) => { setSelectedPlayer(player); setSelectedTeam(team); setMode('fit'); }} />
        <PlayerHero report={report} mode={mode} comparison={comparison} challenger={challenger} />
        {mode === 'fit' && <FitOverview report={report} />}
        {mode === 'compare' && <ComparePlayers comparison={comparison} challenger={challenger} setChallenger={setChallenger} />}
        {mode === 'analysis' && <DetailedAnalysis report={report} />}
        <section className="sf-panel sf-ranking-panel">
          <div className="sf-panel-head"><div><Star size={17} /><span>BEST-FIT CLUB RANKING</span></div><b>MODEL OUTPUT</b></div>
          <div className="sf-ranking-grid">{report.alternativeFits.slice(0, 6).map((team, index) => <button type="button" key={team.id} onClick={() => setSelectedTeam(team)}><b>0{index + 1}</b><Crest team={team} size={32} /><span><strong>{team.name}</strong><small>{team.formation} · {team.league}</small></span><em>{team.score}%</em></button>)}</div>
        </section>
        <div className="sf-founder-strip"><Crown size={18} /><div><b>Get World Cup Founder Pass</b><span>Pro exports, advanced analysis and World Cup intelligence.</span></div><button type="button" className="btn btn--lime btn--sm" onClick={() => navigateTo('/pricing')}>EXPLORE PLANS <ArrowRight size={13} /></button></div>
      </main>
    </div>
  );
}
