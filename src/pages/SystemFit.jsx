import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity, ArrowRight, BarChart3, CheckCircle2, CircleDot, Compass, Crown, Database,
  Download, FileText, GitCompare, Layers3, Search, Share2, ShieldCheck, Sparkles, Star, Target, Users, X,
} from 'lucide-react';
import { navigateTo } from '../components/NavLink.jsx';
import { getPlayerProfile, searchPlayerProfiles as searchApiPlayers, searchTeams as searchApiTeams } from '../services/apiFootball.js';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import ShareBar, { shareUrl } from '../components/Share.jsx';
import { getSupabasePlayersByApiIds, searchSupabasePlayers } from '../services/supabasePlayers.js';
import { loadDerivedTeams, enrichFromDerived, allDerivedTeams, searchDerivedTeams } from '../services/derivedTeams.js';
import useAuth from '../hooks/useAuth.js';
import { resolveTier, can } from '../services/access.js';
import { playerIdFor } from '../data/playerIds.js';
import { calibreRating, resolveRating } from '../services/calibreRating.js';
import { playerTraits, deriveArchetype } from '../services/playerTraits.js';
import {
  SYSTEM_PLAYERS, SYSTEM_TEAMS, TRANSFER_SPOTLIGHTS, buildPlayerComparison, buildSystemFitReport,
  searchLocalPlayers, searchLocalTeams, TRANSFER_STORYLINES, pickTransferStoryline, buildTransferSpotlight,
  registerTeamUniverse,
} from '../data/systemFitData.js';
import {
  exportComparisonCsv, exportComparisonPdf, exportFitCsv, exportFitPdf,
} from '../services/reportExport.js';

// Export access is resolved per-user via services/access.js (owner allowlist +
// paid tier), consistent with the PDF report and dossier gating.

function normalizeApiTeam(team) {
  // If we have a derived profile for this club (real traits from API-Football
  // stats), use it instead of the generic "pending enrichment" placeholder.
  const derived = enrichFromDerived(team);
  if (derived) return derived;

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

// Trait derivation, role metrics and individual archetype labels now come from
// the shared engine in services/playerTraits.js — the same one the Transfers
// page uses — so a player's traits and fit score are identical across pages.

function normalizeApiPlayer(player) {
  const { traits, roleMetrics } = playerTraits(player);
  return {
    ...SYSTEM_PLAYERS[0],
    id: player.id,
    apiPlayerId: Number(player.id) > 0 ? Number(player.id) : null,
    name: player.name,
    team: player.team || 'Live API player directory',
    age: player.age || '—',
    image: player.image || '/assets/players/neutral-player.svg',
    position: player.position || 'Profile pending',
    archetype: deriveArchetype(player),
    traits,
    roleMetrics,
    source: 'api',
  };
}

function normalizeDbPlayer(player) {
  const rawId = player.api_player_id ?? player.apiPlayerId ?? player.id;
  const numId = Number(rawId);
  const apiPlayerId = Number.isInteger(numId) && numId > 0 ? numId : null;
  const { traits, roleMetrics } = playerTraits(player);
  const scored = resolveRating(player);
  return {
    ...SYSTEM_PLAYERS[0],
    ...player,                 // carry real per-90 stat fields through to Key Stats + trait tuning
    id: apiPlayerId ?? player.id,
    apiPlayerId,
    name: player.name,
    team: player.team || player.club || 'Registry profile',
    age: player.age || '—',
    image: player.image || player.img
      || (apiPlayerId ? `https://media.api-sports.io/football/players/${apiPlayerId}.png` : '/assets/players/neutral-player.svg'),
    position: player.position || 'Profile pending',
    archetype: deriveArchetype(player),
    rating: scored.rating ?? SYSTEM_PLAYERS[0].rating,
    traits,
    roleMetrics,
    source: 'db',
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
        let rows;
        if (kind === 'team') {
          // Measured profiles first: every club in derived_team_profiles is
          // reachable here (not just the hand-authored 54). API-Football is a
          // fallback only for clubs we haven't enriched yet.
          const derivedRows = (await searchDerivedTeams(query, 8) || []).map(item => ({ ...item, source: 'derived' }));
          if (derivedRows.length) {
            rows = derivedRows;
          } else {
            rows = (await searchApiTeams(query) || []).map(item => ({ ...item, source: 'api' }));
          }
        } else {
          const dbRows = await searchSupabasePlayers(query, { limit: 8 });
          if (dbRows && dbRows.length) {
            rows = dbRows.map(item => ({ ...item, source: 'db' }));
          } else {
            rows = (await searchApiPlayers(query) || []).map(item => ({ ...item, source: 'api' }));
          }
        }
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
  const [failed, setFailed] = useState(false);
  // SYSTEM_TEAMS carry the real API-Football team id, so we can pull the club
  // logo from the media CDN when no explicit crestUrl is set. Falls back to the
  // coloured initials badge if the logo id is missing or the image 404s.
  const url = team.crestUrl || (Number(team.id) > 0 ? `https://media.api-sports.io/football/teams/${team.id}.png` : null);
  if (url && !failed) {
    return <img src={url} alt="" className="sf-crest-img" style={{ width: size, height: size, objectFit: 'contain' }} onError={() => setFailed(true)} />;
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
  const hasScore = typeof score === 'number' && !Number.isNaN(score);
  const offset = hasScore ? circumference - (score / 100) * circumference : circumference;
  return (
    <div className={`sf-score-ring ${compact ? 'sf-score-ring--compact' : ''} ${hasScore ? '' : 'sf-score-ring--empty'}`} style={{ width, height: width }}>
      <svg width={width} height={width} viewBox={`0 0 ${width} ${width}`}>
        <circle cx={width / 2} cy={width / 2} r={radius} className="sf-ring-track" />
        {hasScore && <circle cx={width / 2} cy={width / 2} r={radius} className="sf-ring-fill" strokeDasharray={circumference} strokeDashoffset={offset} />}
      </svg>
      <div className="sf-score-ring-value"><strong>{hasScore ? score : 'N/A'}</strong><span>FIT</span></div>
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

function ExportButtons({ mode, fitReport, comparison, canExport }) {
  function blocked() {
    navigateTo('/pricing');
  }
  const fit = mode !== 'compare';
  const run = (format) => {
    if (!canExport) return blocked();
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
    if (kind === 'team') { setSelectedTeam(String(item.source || '').startsWith('api') ? normalizeApiTeam(item) : item); return; }
    const src = String(item.source || '');
    setSelectedPlayer(src === 'db' ? normalizeDbPlayer(item) : src.startsWith('api') ? normalizeApiPlayer(item) : item);
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
      <div className="sf-database-note"><Database size={13} /> Calibre registry + API-Football database {loading && <span>SEARCHING…</span>}</div>
      <div className="sf-search-results">
        {merged.map(item => (
          <button type="button" className="sf-search-result" key={`${kind}-${item.id}`} onClick={() => choose(item)}>
            {kind === 'team' ? <Crest team={item.source === 'api' ? normalizeApiTeam(item) : item} size={32} /> : <ApiPlayerImage playerId={item.api_player_id ?? item.apiPlayerId ?? playerIdFor(item.name) ?? item.id} name={item.name} fallbackSrc={item.image || '/assets/players/neutral-player.svg'} alt={item.name} />}
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
          <ApiPlayerImage playerId={selectedPlayer.apiPlayerId ?? playerIdFor(selectedPlayer.name) ?? selectedPlayer.id} name={selectedPlayer.name} fallbackSrc={selectedPlayer.image || '/assets/players/neutral-player.svg'} alt={selectedPlayer.name} />
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

function PositionBoard({ report }) {
  const s = typeof report.score === 'number' ? report.score : null;
  const roles = [
    { role: report.primaryRoles?.[0] || report.player.position || 'Primary', score: s ?? '—', label: 'PRIMARY', x: 50, y: 32 },
    { role: report.primaryRoles?.[1] || 'Secondary', score: s == null ? '—' : Math.max(70, s - 14), label: 'SECONDARY', x: 28, y: 58 },
    { role: report.primaryRoles?.[2] || 'Option', score: s == null ? '—' : Math.max(66, s - 18), label: 'SECONDARY', x: 72, y: 58 },
    { role: 'Depth option', score: s == null ? '—' : Math.max(62, s - 25), label: 'DEPTH OPTION', x: 50, y: 78 },
  ];
  return (
    <div className="sf-lineup-board sf-lineup-board--dashboard" aria-label="Possible lineup positions">
      <div className="sf-lineup-board__title"><Layers3 size={14} /> POSSIBLE LINEUP POSITIONS <b>{report.team.formation}</b></div>
      <div className="sf-pitch sf-pitch--dashboard">
        <span className="sf-pitch-half" />
        <span className="sf-pitch-box sf-pitch-box--top" />
        <span className="sf-pitch-box sf-pitch-box--bottom" />
        <span className="sf-pitch-direction">ATTACK ↑</span>
        {roles.map(position => (
          <div className={`sf-pitch-role ${position.label === 'PRIMARY' ? 'sf-pitch-role--primary' : ''}`} key={`${position.role}-${position.label}`} style={{ left: `${position.x}%`, top: `${position.y}%` }}>
            <CircleDot size={18} /><b>{position.role}</b><em>{position.score}%</em><small>{position.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function TacticalImpact({ report }) {
  const t = report.player.traits || {};
  const impact = [
    { label: 'Ball Progression', text: `${report.player.name.split(' ')[0]} helps ${report.team.short || report.team.name} advance through pressure.`, score: Math.min(9.8, ((t.control || 80) + (t.tempo || 80)) / 20).toFixed(1) },
    { label: 'Chance Creation', text: 'Final-third involvement and decision quality survive in this role.', score: Math.min(9.6, ((t.transition || 80) + (t.width || 72)) / 20).toFixed(1) },
    { label: 'Defensive Work Rate', text: 'Pressing intensity and recovery runs fit the team structure.', score: Math.min(9.4, ((t.pressing || 78) + (t.defensiveLoad || 72)) / 20).toFixed(1) },
  ];
  return (
    <section className="sf-panel sf-tactical-impact">
      <div className="sf-panel-head"><div><Sparkles size={17} /><span>TACTICAL IMPACT</span></div></div>
      {impact.map(item => (
        <div className="sf-impact-row" key={item.label}>
          <div className="sf-impact-icon"><Sparkles size={17} /></div>
          <div><b>{item.label}</b><p>{item.text}</p></div>
          <strong>{item.score}<small>/10</small></strong>
        </div>
      ))}
    </section>
  );
}

function KeyStats({ report }) {
  const p = report.player;
  const mins = Number(p.stats_minutes || p.minutes || 0);
  const per90 = (val) => {
    const n = Number(val || 0);
    if (!mins || !n) return null;
    return (n / mins * 90).toFixed(2);
  };
  const fmt = (val) => (val == null ? '—' : val);
  const goalsP90   = per90(p._goals   ?? p.goals);
  const assistsP90 = per90(p._assists ?? p.assists);
  const keyPassP90 = per90(p.key_passes);
  const tacklesP90 = per90(p.tackles);
  const dribPct    = Number(p.dribbles_attempts) > 0
    ? Math.round((Number(p.dribbles_success) / Number(p.dribbles_attempts)) * 100) + '%'
    : null;
  const passAcc    = p.pass_accuracy != null
    ? Math.round(Number(p.pass_accuracy)) + '%'
    : null;
  const hasReal = mins > 0;
  const cells = hasReal
    ? [
        { value: fmt(goalsP90),   label: 'Goals',      sub: 'per 90' },
        { value: fmt(assistsP90), label: 'Assists',     sub: 'per 90' },
        { value: fmt(keyPassP90), label: 'Key passes',  sub: 'per 90' },
        { value: fmt(tacklesP90), label: 'Tackles',     sub: 'per 90' },
        { value: fmt(dribPct),    label: 'Dribbles',    sub: 'success %' },
        { value: fmt(passAcc),    label: 'Pass acc.',   sub: '' },
      ]
    : [
        { value: report.score == null ? 'N/A' : `${report.score}%`,                          label: 'Fit score',    sub: '' },
        { value: report.score == null ? '—' : `${Math.max(72, report.score)}%`,             label: 'Primary role', sub: '' },
        { value: String(report.risks.length),                  label: 'Risk flags',   sub: '' },
        { value: report.verdict?.replace(' FIT', '') || '—',   label: 'Model read',   sub: '' },
      ];
  return (
    <section className="sf-panel sf-key-stats">
      <div className="sf-panel-head">
        <div><BarChart3 size={17} /><span>KEY STATS</span></div>
        {hasReal && <b style={{ fontSize: '10px', color: 'var(--sf-muted)' }}>{Math.round(mins / 90)}× 90s</b>}
      </div>
      <div className="sf-key-stats-grid">
        {cells.map(item => (
          <div key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            {item.sub && <em style={{ display: 'block', fontSize: '9px', color: 'var(--sf-muted)', marginTop: '1px' }}>{item.sub}</em>}
          </div>
        ))}
      </div>
      {!hasReal && <small style={{ color: 'var(--sf-muted)', fontSize: '10px', marginTop: '8px', display: 'block' }}>Per-90 stats load once this player is selected from the registry.</small>}
    </section>
  );
}

function RoleRadar({ report, player }) {
  const items = report.rolePulse.slice(0, 6);
  const cx = 110, cy = 110, r = 76;
  const angles = items.map((_, i) => (Math.PI / 2) - (i * (Math.PI * 2)) / 6);
  const toXY = (angle, radius) => [
    cx + radius * Math.cos(angle),
    cy - radius * Math.sin(angle),
  ];
  const poly = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const playerPts = items.map((item, i) => toXY(angles[i], (item.value / 100) * r));
  const systemPts = items.map((item, i) => toXY(angles[i], (Math.max(58, item.value - 10) / 100) * r));
  return (
    <section className="sf-panel sf-role-radar-panel">
      <div className="sf-panel-head"><div><Activity size={17} /><span>ROLE FIT MAP</span></div><b>{player.archetype}</b></div>
      <svg viewBox="0 0 220 220" width="100%" style={{ maxHeight: 210, display: 'block', margin: '0 auto' }} aria-label="Role fit radar chart">
        {[0.33, 0.66, 1].map(pct => (
          <polygon key={pct} points={poly(angles.map(a => toXY(a, r * pct)))} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        ))}
        {angles.map((a, i) => {
          const [x1, y1] = toXY(a, 0);
          const [x2, y2] = toXY(a, r);
          return <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />;
        })}
        <polygon points={poly(systemPts)} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 3" />
        <polygon points={poly(playerPts)} fill="rgba(166,255,0,0.13)" stroke="#a6ff00" strokeWidth="1.5" />
        {playerPts.map(([x, y], i) => <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="3" fill="#a6ff00" />)}
        {items.map((item, i) => {
          const [lx, ly] = toXY(angles[i], r + 18);
          const anchor = lx < cx - 6 ? 'end' : lx > cx + 6 ? 'start' : 'middle';
          return (
            <g key={item.label}>
              <text x={lx.toFixed(1)} y={(ly - 5).toFixed(1)} textAnchor={anchor} fontSize="8" fill="#7a8290" fontFamily="'Barlow Condensed',sans-serif" letterSpacing="0.05em">{item.label.toUpperCase()}</text>
              <text x={lx.toFixed(1)} y={(ly + 8).toFixed(1)} textAnchor={anchor} fontSize="11" fill="#a6ff00" fontWeight="700" fontFamily="'Barlow Condensed',sans-serif">{item.value}</text>
            </g>
          );
        })}
      </svg>
      <div className="sf-panel-legend"><span><i className="lime" />player profile</span><span><i className="marker" />system need</span></div>
    </section>
  );
}

function SystemFitLock({ mode }) {
  const isCompare = mode === 'compare';
  return (
    <section className="sf-panel" style={{ textAlign: 'center', padding: '52px 24px', margin: '16px 0' }}>
      <div style={{ width: 44, height: 44, margin: '0 auto 16px', borderRadius: '50%', border: '1px solid #a6ff00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a6ff00" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
      </div>
      <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>{isCompare ? 'Compare players' : 'The full System Fit desk'}</h3>
      <p style={{ color: '#999', maxWidth: 440, margin: '10px auto 18px', lineHeight: 1.6 }}>{isCompare ? 'Put two real players head-to-head across the six tactical dimensions for a club \u2014 part of the Scout toolkit.' : 'Fit breakdown, role-fit map, tactical read and key stats \u2014 the full analysis, available on Scout.'}</p>
      <button type="button" className="btn btn--lime btn--sm" onClick={() => navigateTo('/pricing')}>UNLOCK WITH SCOUT <ArrowRight size={13} /></button>
    </section>
  );
}

function FitIntelligenceDashboard({ report, mode, comparison, challenger, canFitFull }) {
  const player = report.player;
  return (
    <section className="sf-dashboard-shell">
      <div className="sf-dashboard-hero">
        <div className="sf-player-portrait sf-player-portrait--dashboard">
          <ApiPlayerImage playerId={player.apiPlayerId ?? playerIdFor(player.name) ?? player.id} name={player.name} fallbackSrc={player.image || '/assets/players/neutral-player.svg'} alt={player.name} />
          <div className="sf-player-portrait-fade" />
          <div className="sf-player-portrait-label"><small>{player.archetype}</small><strong>{player.name}</strong><span>{player.position} · {player.team}</span></div>
        </div>

        <div className="sf-dashboard-verdict">
          <div className="sf-kicker">DOES HE FIT?</div>
          <div className="sf-score-main"><ScoreRing score={report.score} /><div><h2>{report.verdict}</h2><p>{report.conclusion}</p></div></div>
          {report.score == null && report.note && (
            <div style={{ marginTop: 4, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, background: 'rgba(255,255,255,0.03)', fontSize: 12.5, color: '#bbb', lineHeight: 1.5 }}>
              {report.note}
            </div>
          )}
          <div className="sf-dashboard-checks">
            {report.strengths.slice(0, 3).map(text => <span key={text}><CheckCircle2 size={14} />{text}</span>)}
          </div>
          <div className="sf-score-chips"><span>{report.team.formation}</span><span>{report.team.philosophy}</span><span>{player.archetype}</span></div>
          <ShareBar
            text={`${player.name} → ${report.team.name}: ${report.score}% system fit on Calibre — “${report.verdict}”.`}
            url={shareUrl('/system-fit')}
            title="Calibre System Fit"
          />
        </div>

        <PositionBoard report={report} />

        <div className="sf-system-read">
          <div className="sf-kicker">SYSTEM FIT READ</div>
          <div className="sf-transfer-points">
            {report.strengths.slice(0, 3).map(text => <span key={text}><i />{text}</span>)}
          </div>
          {report.risks?.length > 0 && (
            <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#ff6464', textTransform: 'uppercase', fontFamily: 'var(--font-condensed, sans-serif)', marginBottom: 8 }}>Risk flags</div>
              <div className="sf-transfer-points" style={{ opacity: 0.8 }}>
                {report.risks.slice(0, 2).map(text => <span key={text} style={{ color: '#bbb' }}><i style={{ background: '#ff6464', boxShadow: '0 0 10px rgba(255,100,100,0.5)' }} />{text}</span>)}
              </div>
            </div>
          )}
          <small>Auto-generated by Calibre System Fit from the selected player profile and team model.</small>
        </div>
      </div>

      {mode === 'compare' && (
        <div className="sf-compare-banner"><GitCompare size={16} /><span>COMPARISON MODE</span><b>{player.name}</b><em>vs</em><b>{challenger.name}</b><strong>{comparison.primaryScore}% / {comparison.challengerScore}%</strong></div>
      )}

      {canFitFull ? (<>
      <div className="sf-dashboard-grid">
        <section className="sf-panel sf-fit-breakdown-panel">
          <div className="sf-panel-head"><div><Activity size={17} /><span>FIT BREAKDOWN</span></div><b>MODEL OUTPUT</b></div>
          {report.breakdown.slice(0, 6).map(item => <MetricBar key={item.label} label={item.label} value={item.value} compare={Math.max(58, item.value - 8)} />)}
          <div className="sf-panel-legend"><span><i className="lime" />player score</span><span><i className="marker" />system avg</span></div>
        </section>

        <RoleRadar report={report} player={player} />

        <TacticalImpact report={report} />
      </div>

      <div className="sf-dashboard-grid sf-dashboard-grid--lower">
        <section className="sf-panel sf-panel--wide">
          <div className="sf-panel-head"><div><ShieldCheck size={17} /><span>TACTICAL READ</span></div></div>
          <div className="sf-analysis-columns">
            <div><div className="sf-kicker">WHAT WORKS</div>{report.strengths.map(text => <p key={text}>✓ {text}</p>)}</div>
            <div><div className="sf-kicker sf-kicker--risk">WHAT NEEDS PROTECTION</div>{report.risks.map(text => <p key={text}>− {text}</p>)}</div>
          </div>
        </section>
        <KeyStats report={report} />
      </div>
      </>) : <SystemFitLock />}
    </section>
  );
}


function TransferSpotlight({ spotlight, player, team, onLoad }) {
  return (
    <section className="sf-transfer-spotlight">
      <div className="sf-transfer-topline">
        <span><Sparkles size={14} /> {spotlight.window}</span>
        <em>{spotlight.status}</em>
      </div>
      <div className="sf-transfer-grid">
        <div className="sf-transfer-player">
          <ApiPlayerImage playerId={player.apiPlayerId || playerIdFor(player.name)} name={player.name} fallbackSrc={player.image || '/assets/players/neutral-player.svg'} alt={player.name} />
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
          <ShareBar
            text={`${spotlight.headline} — ${spotlight.score}% fit on Calibre.`}
            url={shareUrl('/system-fit')}
            title="Calibre Transfer Spotlight"
          />
        </div>
      </div>
    </section>
  );
}

// Picks the week's storyline, fetches the real player from the registry, runs
// System Fit, and renders an auto-generated spotlight. The photo comes from the
// registry row's real api id, so it always matches the player.
function TransferSpotlightLoader({ onLoad }) {
  const [state, setState] = useState(null);
  useEffect(() => {
    let alive = true;
    const storyline = pickTransferStoryline();
    if (!storyline) return;
    const team = SYSTEM_TEAMS.find(t => t.id === storyline.toTeamId) || SYSTEM_TEAMS[0];
    searchSupabasePlayers(storyline.query, { limit: 6 })
      .then(rows => {
        if (!alive) return;
        const q = String(storyline.query).toLowerCase();
        const matches = (rows || []).filter(r => String(r.name || '').toLowerCase().includes(q));
        // Prefer a row that actually carries a numeric API id (i.e. an enriched
        // profile, so the portrait resolves) and, among those, the one with the
        // most minutes — that's the real first-team player, not a namesake.
        const enriched = matches
          .filter(r => Number(r.api_player_id ?? r.apiPlayerId) > 0)
          .sort((a, b) => (Number(b.minutes) || 0) - (Number(a.minutes) || 0));
        const hit = enriched[0] || matches[0] || (rows || [])[0];
        if (!hit) return;
        const player = normalizeDbPlayer(hit);
        const spotlight = buildTransferSpotlight(player, team, storyline);
        if (spotlight) setState({ spotlight, player, team });
      })
      .catch(() => { /* no spotlight if the registry can't resolve the player */ });
    return () => { alive = false; };
  }, []);
  if (!state || !state.spotlight) return null;
  return <TransferSpotlight spotlight={state.spotlight} player={state.player} team={state.team} onLoad={onLoad} />;
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
  const [query, setQuery] = useState('');
  const { remote, loading } = useDatabaseSearch('player', query);
  const local = searchLocalPlayers(query);
  const localIds = new Set(local.map(item => String(item.id)));
  const merged = [...local, ...remote.filter(item => !localIds.has(String(item.id)))].slice(0, 6);
  const choose = (item) => {
    const src = String(item.source || '');
    setChallenger(src === 'db' ? normalizeDbPlayer(item) : src.startsWith('api') ? normalizeApiPlayer(item) : item);
    setQuery('');
  };
  return (
    <div className="sf-content-grid">
      <section className="sf-panel sf-panel--wide">
        <div className="sf-panel-head"><div><GitCompare size={17} /><span>COMPARE PLAYER PROFILES</span></div></div>
        <label className="sf-search-box" style={{ marginBottom: 6 }}>
          <Search size={14} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search any registry player to compare with ${comparison.primary.name}\u2026`} />
          {loading && <span style={{ fontSize: 10, color: 'var(--sf-muted)' }}>SEARCHING\u2026</span>}
        </label>
        {query.trim().length >= 2 && (
          <div className="sf-search-results" style={{ marginBottom: 10 }}>
            {merged.map(item => (
              <button type="button" className="sf-search-result" key={`cmp-${item.id}`} onClick={() => choose(item)}>
                <ApiPlayerImage playerId={item.api_player_id ?? item.apiPlayerId ?? playerIdFor(item.name) ?? item.id} name={item.name} fallbackSrc={item.image || '/assets/players/neutral-player.svg'} alt={item.name} />
                <span><b>{item.name}</b><small>{item.team} \u00b7 {item.position}</small></span>
              </button>
            ))}
            {!merged.length && !loading && <div className="sf-database-note" style={{ padding: 8 }}>No registry match yet \u2014 keep typing.</div>}
          </div>
        )}
        <div className="sf-compare-head">
          <div><ApiPlayerImage playerId={comparison.primary.apiPlayerId ?? playerIdFor(comparison.primary.name) ?? comparison.primary.id} name={comparison.primary.name} fallbackSrc={comparison.primary.image || '/assets/players/neutral-player.svg'} alt={comparison.primary.name}/><span><b>{comparison.primary.name}</b><small>{comparison.primary.archetype}</small></span><strong>{comparison.primaryScore}%</strong></div>
          <em>VS</em>
          <div><ApiPlayerImage playerId={comparison.challenger.apiPlayerId ?? playerIdFor(comparison.challenger.name) ?? comparison.challenger.id} name={comparison.challenger.name} fallbackSrc={comparison.challenger.image || '/assets/players/neutral-player.svg'} alt={comparison.challenger.name}/><span><b>{comparison.challenger.name}</b><small>{comparison.challenger.archetype}</small></span><strong>{comparison.challengerScore}%</strong></div>
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


/* ================================================================== *
 * Image-2 layout, archetype-honest edition (v3).
 *  - positional fit is scored RELATIVE to the player's real position
 *  - GK is forced low for outfielders (and vice-versa)
 *  - comparables = same archetype, ranked by rating proximity (any age)
 *  - VIEW FULL PROFILE opens an in-page modal (no navigation)
 * ================================================================== */

const sf2clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function sf2Tier(v) { const n = Number(v); if (!Number.isFinite(n)) return 'na'; if (n >= 80) return 'exc'; if (n >= 68) return 'good'; if (n >= 55) return 'avg'; return 'low'; }

const SF2_POS_IDX = {
  GK: 0, CB: 1, RCB: 1, LCB: 1, LB: 1.6, RB: 1.6, LWB: 1.6, RWB: 1.6, WB: 1.6,
  DM: 2.2, CDM: 2.2, CM: 3, RCM: 3, LCM: 3, B2B: 3, LM: 3.6, RM: 3.6,
  LW: 3.8, RW: 3.8, W: 3.8, AM: 4, CAM: 4, SS: 4.4, CF: 4.7, ST: 5, FW: 5,
};
const SF2_GROUP = {
  GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF', WB: 'DEF',
  DM: 'MID', CDM: 'MID', CM: 'MID', B2B: 'MID', LM: 'MID', RM: 'MID', AM: 'MID', CAM: 'MID',
  LW: 'ATT', RW: 'ATT', W: 'ATT', SS: 'ATT', CF: 'ATT', ST: 'ATT', FW: 'ATT',
};
function sf2Tokens(positionStr) { return String(positionStr || '').toUpperCase().split(/[\/,\-\s]+/).filter(Boolean); }
function sf2PlayerIdxs(positionStr) { const i = sf2Tokens(positionStr).map(t => SF2_POS_IDX[t]).filter(v => typeof v === 'number'); return i.length ? i : [3]; }
function sf2Group(positionStr) { for (const t of sf2Tokens(positionStr)) { if (SF2_GROUP[t]) return SF2_GROUP[t]; } return 'MID'; }
function sf2SlotFit(base, slot, playerIdxs) {
  const cat = slot.cat ?? slot.c;
  if (cat === 'GK') return playerIdxs.includes(0) ? Math.min(96, base) : sf2clamp(Math.round(base * 0.32 + 6), 20, 32);
  const si = SF2_POS_IDX[cat] ?? 3;
  const d = Math.min(...playerIdxs.map(pi => Math.abs(si - pi)));
  return sf2clamp(Math.round(base - 6.6 * d), 24, 96);
}

const SF2_FORMATIONS = {
  '4-3-3': [
    { c: 'GK', x: 50, y: 93 }, { c: 'LB', x: 13, y: 71 }, { c: 'CB', x: 37, y: 79 }, { c: 'CB', x: 63, y: 79 }, { c: 'RB', x: 87, y: 71 },
    { c: 'CM', x: 30, y: 52 }, { c: 'DM', x: 50, y: 60 }, { c: 'CM', x: 70, y: 52 },
    { c: 'LW', x: 17, y: 24 }, { c: 'ST', x: 50, y: 15 }, { c: 'RW', x: 83, y: 24 },
  ],
  '4-2-3-1': [
    { c: 'GK', x: 50, y: 93 }, { c: 'LB', x: 13, y: 72 }, { c: 'CB', x: 37, y: 80 }, { c: 'CB', x: 63, y: 80 }, { c: 'RB', x: 87, y: 72 },
    { c: 'DM', x: 35, y: 60 }, { c: 'DM', x: 65, y: 60 }, { c: 'AM', x: 50, y: 40 },
    { c: 'LW', x: 17, y: 30 }, { c: 'RW', x: 83, y: 30 }, { c: 'ST', x: 50, y: 15 },
  ],
  '4-4-2': [
    { c: 'GK', x: 50, y: 93 }, { c: 'LB', x: 13, y: 72 }, { c: 'CB', x: 37, y: 80 }, { c: 'CB', x: 63, y: 80 }, { c: 'RB', x: 87, y: 72 },
    { c: 'LM', x: 14, y: 50 }, { c: 'CM', x: 38, y: 55 }, { c: 'CM', x: 62, y: 55 }, { c: 'RM', x: 86, y: 50 },
    { c: 'ST', x: 38, y: 18 }, { c: 'ST', x: 62, y: 18 },
  ],
  '3-5-2': [
    { c: 'GK', x: 50, y: 93 }, { c: 'CB', x: 28, y: 80 }, { c: 'CB', x: 50, y: 83 }, { c: 'CB', x: 72, y: 80 },
    { c: 'LWB', x: 11, y: 56 }, { c: 'CM', x: 34, y: 54 }, { c: 'DM', x: 50, y: 60 }, { c: 'CM', x: 66, y: 54 }, { c: 'RWB', x: 89, y: 56 },
    { c: 'ST', x: 38, y: 18 }, { c: 'ST', x: 62, y: 18 },
  ],
  '3-4-3': [
    { c: 'GK', x: 50, y: 93 }, { c: 'CB', x: 28, y: 80 }, { c: 'CB', x: 50, y: 83 }, { c: 'CB', x: 72, y: 80 },
    { c: 'LM', x: 13, y: 55 }, { c: 'CM', x: 38, y: 58 }, { c: 'CM', x: 62, y: 58 }, { c: 'RM', x: 87, y: 55 },
    { c: 'LW', x: 20, y: 22 }, { c: 'ST', x: 50, y: 16 }, { c: 'RW', x: 80, y: 22 },
  ],
  '4-2-2-2': [
    { c: 'GK', x: 50, y: 93 }, { c: 'LB', x: 13, y: 72 }, { c: 'CB', x: 37, y: 80 }, { c: 'CB', x: 63, y: 80 }, { c: 'RB', x: 87, y: 72 },
    { c: 'DM', x: 38, y: 58 }, { c: 'DM', x: 62, y: 58 }, { c: 'AM', x: 28, y: 38 }, { c: 'AM', x: 72, y: 38 },
    { c: 'ST', x: 38, y: 17 }, { c: 'ST', x: 62, y: 17 },
  ],
};
function sf2SlotsFor(formation) { return SF2_FORMATIONS[String(formation || '').trim()] || SF2_FORMATIONS['4-3-3']; }

const SF2_ROLE_TIERS = ['PRIMARY ROLE', 'SECONDARY ROLE', 'ALTERNATE ROLE', 'SITUATIONAL ROLE', 'SPECIALIST ROLE'];

function sf2Summary(report) {
  const s = typeof report.score === 'number' ? report.score : null;
  if (s == null) return { tactical: null, role: null, team: null, chem: null, risk: '—' };
  let bonus = 0;
  try {
    const tt = report.team?.traits || {}; const pt = report.player?.traits || {};
    const keys = Object.keys(tt).filter(k => typeof pt[k] === 'number');
    if (keys.length) { const avgDiff = keys.reduce((a, k) => a + Math.abs(Number(tt[k]) - Number(pt[k])), 0) / keys.length; bonus = sf2clamp(Math.round(5 - avgDiff / 6), -4, 6); }
  } catch { bonus = 0; }
  const risks = report.risks?.length || 0;
  const risk = (risks >= 3 || s < 74) ? 'High' : (risks === 2 || s < 82) ? 'Medium' : 'Low';
  return { tactical: s, role: sf2clamp(s - 3, 55, 97), team: sf2clamp(s - 4 + bonus, 55, 97), chem: sf2clamp(s - 6 + Math.round(bonus / 2), 55, 95), risk };
}
function sf2Why(report, sum) {
  const bd = Array.isArray(report.breakdown) ? [...report.breakdown] : [];
  const team = report.team?.name || 'the club'; const shape = report.team?.formation || 'their shape';
  if (!bd.length) return `Projects as a ${String(sum.risk).toLowerCase()}-risk addition to ${team}'s ${shape}.`;
  bd.sort((a, b) => b.value - a.value); const top = bd[0]; const low = bd[bd.length - 1];
  return `Projects as a ${String(sum.risk).toLowerCase()}-risk fit for ${team}'s ${shape}. Strongest on ${String(top.label).toLowerCase()} (${top.value}); the system has to account for ${String(low.label).toLowerCase()} (${low.value}).`;
}

// Comparables: same archetype first (ranked by rating closeness, any age);
// if the curated pool is thin, extend with the same position group.
// Comparables = SAME ARCHETYPE only, ranked by rating proximity (age ignored).
// No position fallback — a Controller must never be offered as a peer to a Box
// Crasher. The curated SYSTEM_PLAYERS set has one player per archetype, so this
// legitimately returns none there; the real bench comes from the enriched DB
// pool once that query is wired in (see fetchArchetypePeers TODO).
function sf2Similar(player) {
  const arch = String(player.archetype || '').trim().toLowerCase();
  if (!arch) return [];
  const rate = x => Number(x && x.rating) || 80;
  const pr = rate(player);
  const pool = (Array.isArray(SYSTEM_PLAYERS) ? SYSTEM_PLAYERS : [])
    .filter(p => p && p.name && p.name !== player.name && String(p.archetype || '').trim().toLowerCase() === arch)
    .sort((a, b) => Math.abs(rate(a) - pr) - Math.abs(rate(b) - pr))
    .slice(0, 3);
  return pool.map(p => ({ player: p, name: p.name, apiPlayerId: p.apiPlayerId, image: p.image, pct: sf2clamp(Math.round(96 - Math.abs(rate(p) - pr) * 2), 74, 98) }));
}

function SelectorRow({ selectedPlayer, selectedTeam, setSelectedPlayer, setSelectedTeam }) {
  const [pq, setPq] = useState('');
  const [tq, setTq] = useState('');
  const { remote: pRemote } = useDatabaseSearch('player', pq);
  const { remote: tRemote } = useDatabaseSearch('team', tq);
  const pLocal = searchLocalPlayers(pq);
  const tLocal = searchLocalTeams(tq);
  const pIds = new Set(pLocal.map(i => String(i.id)));
  const tIds = new Set(tLocal.map(i => String(i.id)));
  const pMerged = [...pLocal, ...pRemote.filter(i => !pIds.has(String(i.id)))].slice(0, 6);
  const tMerged = [...tLocal, ...tRemote.filter(i => !tIds.has(String(i.id)))].slice(0, 6);
  const pickPlayer = (item) => { const s = String(item.source || ''); setSelectedPlayer(s === 'db' ? normalizeDbPlayer(item) : s.startsWith('api') ? normalizeApiPlayer(item) : item); setPq(''); };
  const pickTeam = (item) => { setSelectedTeam(String(item.source || '').startsWith('api') ? normalizeApiTeam(item) : item); setTq(''); };
  return (
    <div className="sf2-selectors">
      <div className="sf2-select">
        <label>SELECT PLAYER</label>
        <div className="sf2-search"><Search size={14} /><input value={pq} onChange={e => setPq(e.target.value)} placeholder="Search player..." /></div>
        {pMerged.length > 0 && pq.trim().length >= 3 && (
          <div className="sf2-dropdown">{pMerged.map(item => (
            <button type="button" key={`p-${item.id}`} onClick={() => pickPlayer(item)}>
              <ApiPlayerImage playerId={item.api_player_id ?? item.apiPlayerId ?? playerIdFor(item.name) ?? item.id} name={item.name} fallbackSrc={item.image || '/assets/players/neutral-player.svg'} alt={item.name} />
              <span><b>{item.name}</b><small>{item.team} · {item.position}</small></span>
            </button>))}</div>
        )}
      </div>
      <div className="sf2-select sf2-select--player">
        <ApiPlayerImage playerId={selectedPlayer.apiPlayerId ?? playerIdFor(selectedPlayer.name) ?? selectedPlayer.id} name={selectedPlayer.name} fallbackSrc={selectedPlayer.image || '/assets/players/neutral-player.svg'} alt={selectedPlayer.name} />
        <div><b>{selectedPlayer.name}</b><small>{[selectedPlayer.position, selectedPlayer.age && selectedPlayer.age !== '—' ? `AGE ${selectedPlayer.age}` : null, selectedPlayer.team].filter(Boolean).join(' · ')}</small></div>
      </div>
      <div className="sf2-select">
        <label>SELECT TEAM / SYSTEM</label>
        <div className="sf2-search"><Crest team={selectedTeam} size={20} /><input value={tq} onChange={e => setTq(e.target.value)} placeholder={selectedTeam.name} /></div>
        {tMerged.length > 0 && tq.trim().length >= 3 && (
          <div className="sf2-dropdown">{tMerged.map(item => (
            <button type="button" key={`t-${item.id}`} onClick={() => pickTeam(item)}>
              <Crest team={item.source === 'api' ? normalizeApiTeam(item) : item} size={26} />
              <span><b>{item.name}</b><small>{item.country} · {item.league || 'club'} · {(item.formation || '4-3-3')}</small></span>
            </button>))}</div>
        )}
      </div>
    </div>
  );
}

function LeftNav({ mode, setMode, canFitFull, canCompare }) {
  const item = (id, label, gated) => (
    <button type="button" className={`sf2-nav-item${mode === id ? ' is-active' : ''}`} onClick={() => setMode(id)}>
      {id === 'fit' ? <Target size={15} /> : id === 'compare' ? <GitCompare size={15} /> : <BarChart3 size={15} />}
      <span>{label}</span>{gated && <em>SCOUT</em>}
    </button>
  );
  const qa = (icon, label, onClick) => <button type="button" className="sf2-qa" onClick={onClick}>{icon}<span>{label}</span></button>;
  const scrollTo = sel => document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <aside className="sf2-nav">
      <div className="sf2-nav-block">
        <div className="sf-kicker"><Sparkles size={12} /> SYSTEM FIT ENGINE</div>
        {item('fit', 'System Fit', false)}
        {item('compare', 'Compare Player', !canCompare)}
        {item('analysis', 'Detailed Analysis', !canFitFull)}
      </div>
      <div className="sf2-nav-block">
        <div className="sf-kicker">QUICK ACTIONS</div>
        {qa(<Users size={14} />, 'Compare Players', () => setMode('compare'))}
        {qa(<Compass size={14} />, 'Scout Alternatives', () => scrollTo('.sf2-ranking'))}
        {qa(<Activity size={14} />, 'Change System', () => scrollTo('.sf2-selectors'))}
      </div>
      <div className="sf2-pro">
        <b>UNLOCK PRO INSIGHTS</b><span>Deeper reports. Smarter decisions.</span>
        <button type="button" className="btn btn--lime btn--sm" onClick={() => navigateTo('/pricing')}>GO PRO</button>
      </div>
    </aside>
  );
}

function PlayerProfileModal({ player, report, onClose }) {
  const [data, setData] = useState(player);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Curated SYSTEM_PLAYERS carry only name/age/rating/traits — no bio, no event
  // stats — and their ids are placeholders. Resolve the REAL API-Football id by
  // name, then pull the enriched DB row (base API-Football + StatsAPI layers) and
  // the API bio (height/weight the DB doesn't store). A player selected from a DB
  // search already carries stats, so we skip the fetch for those.
  useEffect(() => {
    let alive = true;
    setData(player);
    const alreadyRich = player.goals != null || player.shots != null || player.pass_accuracy != null;
    const realId = player.apiPlayerId ?? playerIdFor(player.name) ?? (Number(player.id) > 0 ? Number(player.id) : null);
    if (alreadyRich || !realId) return;
    setLoading(true);
    (async () => {
      let db = null, profile = null;
      try { const rows = await getSupabasePlayersByApiIds([realId]); db = rows?.[0] || null; } catch { /* supabase off */ }
      try { profile = await getPlayerProfile(realId); } catch { /* api off */ }
      if (!alive) return;
      const merged = {
        ...(db || {}),
        height: profile?.height || db?.height || player.height,
        weight: profile?.weight || db?.weight || player.weight,
        country: db?.nationality || profile?.nationality || player.country || player.nationality,
        ...player, // curated display fields (name, rating, archetype, team, image) win; stat keys only exist on db
      };
      setData(merged);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [player]);

  const p = data;
  const dash = v => (v == null || v === '' || v === '—') ? '—' : v;
  const pick = (...keys) => { for (const k of keys) { const v = p[k]; if (typeof v === 'number' || (typeof v === 'string' && v !== '' && v !== '—')) return v; } return '—'; };
  const bio = [
    ['COUNTRY', dash(p.country || p.nationality || p.nation)],
    ['AGE', dash(p.age)],
    ['HEIGHT', dash(p.height)],
    ['WEIGHT', dash(p.weight)],
    ['FOOT', dash(p.foot)],
    ['CLUB', dash(p.team || p.club)],
  ];
  const stats = [
    ['GOALS', pick('goals', '_goals')],
    ['ASSISTS', pick('assists', '_assists')],
    ['xG / 90', pick('xg_per_90', 'xg_per90', 'xgPer90', 'xg')],
    ['KEY PASSES', pick('key_passes', 'keyPasses')],
    ['SHOTS', pick('shots', 'total_shots', 'shots_total')],
    ['DRIBBLES', pick('dribbles_success', 'successful_dribbles', 'dribbles', 'dribbles_completed')],
    ['DUELS WON', pick('duels_won', 'duel_win_pct', 'duelsWon')],
    ['TACKLES', pick('tackles')],
    ['INTERCEPTIONS', pick('interceptions')],
    ['PASS ACC %', pick('pass_accuracy', 'passAccuracy')],
    ['MINUTES', pick('minutes', 'stats_minutes')],
    ['CALIBRE', dash(p.rating)],
  ];
  const chips = sf2Tokens(p.position).slice(0, 3);
  return createPortal(
    <div className="sf2-modal" role="presentation" onMouseDown={onClose}>
      <section className="sf2-modal-card" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <button className="sf2-modal-close" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="sf2-modal-head">
          <div className="sf2-modal-photo"><ApiPlayerImage playerId={p.apiPlayerId ?? playerIdFor(p.name) ?? p.id} name={p.name} fallbackSrc={p.image || '/assets/players/neutral-player.svg'} alt={p.name} /></div>
          <div className="sf2-modal-id">
            <div className="sf-kicker">PLAYER PROFILE</div>
            <h3>{p.name}</h3>
            <div className="sf2-modal-tags">{chips.map(c => <span key={c}>{c}</span>)}{p.archetype && <em>{p.archetype}</em>}</div>
          </div>
          <div className="sf2-modal-rating"><strong>{p.rating ?? '—'}</strong><span>CALIBRE</span></div>
        </div>
        <div className="sf2-modal-sec"><small>BIO</small><div className="sf2-modal-grid">{bio.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div></div>
        <div className="sf2-modal-sec"><small>PERFORMANCE</small><div className="sf2-modal-grid sf2-modal-grid--stats">{stats.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div></div>
        <p className="sf2-modal-note">{loading ? 'Loading live stats from the connected player dataset\u2026' : 'Stats populate from the connected player dataset \u2014 blanks fill in as data syncs.'}</p>
      </section>
    </div>,
    document.body
  );
}

function AttributeCard({ player, report }) {
  const [open, setOpen] = useState(false);
  const rating = player.rating ?? '—';
  const chips = sf2Tokens(player.position).slice(0, 3);
  const grid = [
    ['NATIONALITY', player.nationality || player.country || null],
    ['AGE', player.age && player.age !== '—' ? player.age : null],
    ['CLUB', player.team],
    ['TOP ROLE', report.primaryRoles?.[0]],
  ].filter(([, v]) => v != null && v !== '');
  return (
    <section className="sf2-card sf2-attr">
      <div className="sf2-attr-top">
        <div className="sf2-attr-photo"><ApiPlayerImage playerId={player.apiPlayerId ?? playerIdFor(player.name) ?? player.id} name={player.name} fallbackSrc={player.image || '/assets/players/neutral-player.svg'} alt={player.name} /></div>
        <div className="sf2-attr-rating"><strong>{rating}</strong><span>CALIBRE RATING</span><div className="sf2-attr-chips">{chips.map(c => <em key={c}>{c}</em>)}</div></div>
      </div>
      <div className="sf2-attr-pos">
        <div><small>POSITION</small><b>{player.position || '—'}</b></div>
        <div><small>ARCHETYPE</small><b>{player.archetype || '—'}</b></div>
      </div>
      <button type="button" className="sf2-attr-view" onClick={() => setOpen(true)}>VIEW FULL PROFILE <ArrowRight size={13} /></button>
      <div className="sf2-attr-grid">{grid.map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
      {open && <PlayerProfileModal player={player} report={report} onClose={() => setOpen(false)} />}
    </section>
  );
}

function DoesHeFit({ report, player }) {
  return (
    <section className="sf2-card sf2-fit">
      <div className="sf-kicker">DOES HE FIT?</div>
      <div className="sf2-fit-head"><ScoreRing score={report.score} /><div><h2>{report.verdict}</h2><p>{report.conclusion}</p></div></div>
      <div className="sf2-fit-checks">{report.strengths.slice(0, 4).map(t => <span key={t}><CheckCircle2 size={14} />{t}</span>)}</div>
      <div className="sf2-chips"><span>{report.team.formation}</span><span>{(report.primaryRoles?.[0] || player.position || 'ROLE')}</span><span>{player.archetype}</span></div>
    </section>
  );
}

function PositionalFitMap({ report, player }) {
  const base = typeof report.score === 'number' ? report.score : 70;
  const idxs = sf2PlayerIdxs(player.position);
  let best = -1, bestVal = -1;
  const slots = sf2SlotsFor(report.team.formation).map((slot, i) => {
    const val = sf2SlotFit(base, slot, idxs);
    if (slot.c !== 'GK' && val > bestVal) { bestVal = val; best = i; }
    return { key: i, label: slot.c, x: slot.x, y: slot.y, val, tier: sf2Tier(val) };
  });
  return (
    <section className="sf2-card sf2-map">
      <div className="sf2-card-head"><span>POSITIONAL FIT MAP</span><b>{report.team.formation}</b></div>
      <div className="sf2-pitch">
        <span className="sf2-pitch-circle" /><span className="sf2-pitch-box sf2-pitch-box--t" /><span className="sf2-pitch-box sf2-pitch-box--b" />
        {slots.map(slot => (
          <div className={`sf2-slot sf2-slot--${slot.tier}`} key={slot.key} style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
            <i /><b>{slot.label}</b><strong>{slot.val}%</strong>{slot.key === best && <small>BEST FIT</small>}
          </div>
        ))}
      </div>
      <div className="sf2-legend"><span><i className="exc" />Excellent</span><span><i className="good" />Good</span><span><i className="avg" />Average</span><span><i className="low" />Low</span></div>
    </section>
  );
}

function FitBreakdownRow({ report }) {
  const items = report.breakdown.slice(0, 5);
  return (
    <section className="sf2-card sf2-breakdown">
      <div className="sf2-card-head"><span>FIT BREAKDOWN</span><b>MODEL OUTPUT · /100</b></div>
      <div className="sf2-breakdown-grid" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, 1fr)` }}>{items.map(item => (
        <div key={item.label}><small>{String(item.label).toUpperCase()}</small><div className="sf2-breakdown-val"><strong>{item.value}</strong><em>/100</em></div><div className="sf2-breakdown-bar"><span style={{ width: `${item.value}%` }} /></div></div>))}</div>
    </section>
  );
}

function BestRoleFits({ report }) {
  const base = typeof report.score === 'number' ? report.score : 78;
  const roles = (report.primaryRoles || []).slice(0, 5);
  if (!roles.length) return null;
  return (
    <section className="sf2-card sf2-roles">
      <div className="sf2-card-head"><span>BEST ROLE FITS IN THIS SYSTEM</span></div>
      <div className="sf2-roles-grid" style={{ gridTemplateColumns: `repeat(${roles.length}, minmax(0,1fr))` }}>{roles.map((role, i) => {
        const pct = sf2clamp(base - i * 6, 58, 96);
        return (<div className="sf2-role" key={role}><div className="sf2-role-top"><i className={`sf2-dot sf2-dot--${sf2Tier(pct)}`} /><b>{role}</b></div><small>{SF2_ROLE_TIERS[i] || 'ROLE'}</small><div className="sf2-role-foot"><span>FIT</span><strong>{pct}%</strong></div></div>);
      })}</div>
    </section>
  );
}

function ClubRanking({ report, onPick }) {
  const fits = report.alternativeFits || [];
  if (!fits.length) return null;
  return (
    <section className="sf2-card sf2-ranking">
      <div className="sf2-card-head"><span><Star size={13} style={{ verticalAlign: '-2px', marginRight: 6, color: '#a6ff00' }} />BEST-FIT CLUB RANKING</span><b>MODEL OUTPUT</b></div>
      <div className="sf2-ranking-list">{fits.slice(0, 6).map((t, i) => (
        <button type="button" key={t.id} onClick={() => onPick(t)}><em>0{i + 1}</em><Crest team={t} size={28} /><span><b>{t.name}</b><small>{t.formation} · {t.league}</small></span><strong>{t.score}%</strong></button>))}</div>
    </section>
  );
}

function SummaryRail({ report, player, canExport, setSelectedPlayer }) {
  const sum = sf2Summary(report);
  const row = (icon, label, val, unit) => (<div className="sf2-sum-row">{icon}<span>{label}</span><b className={val === 'High' ? 'is-risk-high' : val === 'Medium' ? 'is-risk-med' : ''}>{val}{unit || ''}</b></div>);
  const download = () => { if (!canExport) return navigateTo('/pricing'); try { exportFitPdf(report); } catch { navigateTo('/pricing'); } };
  const similar = sf2Similar(player);
  return (
    <aside className="sf2-rail">
      <section className="sf2-card">
        <div className="sf2-card-head"><span>SYSTEM FIT SUMMARY</span></div>
        <div className="sf2-sum">
          {row(<ShieldCheck size={15} />, 'Tactical Fit', sum.tactical ?? '—', sum.tactical == null ? '' : '/100')}
          {row(<Target size={15} />, 'Role Fit', sum.role ?? '—', sum.role == null ? '' : '/100')}
          {row(<Activity size={15} />, 'Team Context', sum.team ?? '—', sum.team == null ? '' : '/100')}
          {row(<Sparkles size={15} />, 'Chemistry Potential', sum.chem ?? '—', sum.chem == null ? '' : '/100')}
          {row(<GitCompare size={15} />, 'Adaptation Risk', sum.risk, '')}
        </div>
        <div className="sf2-why"><small>WHY?</small><p>{sf2Why(report, sum)}</p></div>
        <button type="button" className="btn btn--lime btn--sm sf2-download" onClick={download}>DOWNLOAD FULL REPORT <ArrowRight size={13} /></button>
        {report.risks?.length > 0 && (<div className="sf2-risk"><small>RISK FLAGS</small>{report.risks.slice(0, 4).map(t => <span key={t}><i />{t}</span>)}</div>)}
      </section>
      <section className="sf2-card">
        <div className="sf2-card-head"><span>SIMILAR PLAYER PROFILES</span><b>SAME ARCHETYPE</b></div>
        {similar.length > 0
          ? <div className="sf2-similar">{similar.map((p, i) => (
              <button type="button" key={p.name} onClick={() => setSelectedPlayer(p.player)}><em>{i + 1}</em><ApiPlayerImage playerId={p.apiPlayerId ?? playerIdFor(p.name)} name={p.name} fallbackSrc={p.image || '/assets/players/neutral-player.svg'} alt={p.name} /><b>{p.name}</b><strong>{p.pct}%</strong></button>))}</div>
          : <p className="sf2-similar-empty">No same-archetype peer in the current player set. Comparables populate from the enriched database as it connects.</p>}
      </section>
    </aside>
  );
}

export default function SystemFit() {
  const { user } = useAuth();
  const tier = resolveTier(user?.email);
  const canExport  = can(tier, 'fit.export');
  const canFitFull = can(tier, 'fit.full');
  const canCompare = can(tier, 'fit.compare');
  const [selectedTeam, setSelectedTeam] = useState(SYSTEM_TEAMS[0]);
  const [selectedPlayer, setSelectedPlayer] = useState(SYSTEM_PLAYERS[0]);
  const [challenger, setChallenger] = useState(SYSTEM_PLAYERS[1]);
  const [mode, setMode] = useState('fit');

  useEffect(() => {
    // Warm the derived-team cache, then register the MERGED team universe so
    // System Fit's picker and alternative-fit ranking see every measured club
    // in the DB — not just the hand-authored 54. Merge rule: measured traits
    // win (that's the whole point of the DNA pipeline), but marquee clubs keep
    // their hand-authored brand colours + philosophy prose, which the derived
    // rows don't carry. Fire-and-forget; on failure the universe stays as
    // SYSTEM_TEAMS so nothing regresses.
    loadDerivedTeams().then(() => {
      const byId = new Map(allDerivedTeams().map(t => [Number(t.id), { ...t }]));
      for (const s of SYSTEM_TEAMS) {
        const measured = byId.get(Number(s.id));
        if (measured) {
          byId.set(Number(s.id), {
            ...measured,                       // measured traits + categoricals
            accent: s.accent,                  // hand-authored brand colours
            secondary: s.secondary,
            philosophy: s.philosophy || measured.philosophy,
            short: s.short || measured.short,
          });
        } else {
          byId.set(Number(s.id), s);           // hand-authored-only club (no measured row yet)
        }
      }
      registerTeamUniverse([...byId.values()]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const playerQuery = new URLSearchParams(window.location.search).get('player');
    if (!playerQuery) return;
    (async () => {
      try {
        const dbRows = await searchSupabasePlayers(playerQuery, { limit: 1 });
        if (dbRows && dbRows.length) { setSelectedPlayer(normalizeDbPlayer(dbRows[0])); return; }
        const apiRows = await searchApiPlayers(playerQuery);
        if (apiRows?.[0]) setSelectedPlayer(normalizeApiPlayer(apiRows[0]));
      } catch { /* keep default selection */ }
    })();
  }, []);

  const report = useMemo(() => buildSystemFitReport(selectedPlayer, selectedTeam), [selectedPlayer, selectedTeam]);
  const comparison = useMemo(() => buildPlayerComparison(selectedPlayer, challenger, selectedTeam), [selectedPlayer, challenger, selectedTeam]);

  return (
    <div className="page sf-page">
      <div className="sf2-wrap">
        <div className="sf2-hero">
          <div className="sf2-hero-lead">
            <div className="sf-kicker">PLAYER INTELLIGENCE</div>
            <h1>SYSTEM FIT ENGINE</h1>
            <p>We analyse the player. You decide the role.<br />Does he fit your system?</p>
          </div>
          <div className="sf2-hero-actions">
            <ShareBar
              text={`${selectedPlayer.name} \u2192 ${report.team.name}: ${report.score}% system fit on Calibre \u2014 \u201c${report.verdict}\u201d.`}
              url={shareUrl('/system-fit')}
              title="Calibre System Fit"
            />
            <ExportButtons mode={mode} fitReport={report} comparison={comparison} canExport={canExport} />
          </div>
        </div>

        <SelectorRow selectedPlayer={selectedPlayer} selectedTeam={selectedTeam} setSelectedPlayer={setSelectedPlayer} setSelectedTeam={setSelectedTeam} />

        <div className="sf2-body">
          <LeftNav mode={mode} setMode={setMode} canFitFull={canFitFull} canCompare={canCompare} />
          <div className="sf2-center">
            {mode === 'fit' && (<>
              <div className="sf2-topcards">
                <AttributeCard player={selectedPlayer} report={report} />
                <DoesHeFit report={report} player={selectedPlayer} />
                <PositionalFitMap report={report} player={selectedPlayer} />
              </div>
              <FitBreakdownRow report={report} />
              <BestRoleFits report={report} />
              <ClubRanking report={report} onPick={setSelectedTeam} />
            </>)}
            {mode === 'compare' && (canCompare ? <ComparePlayers comparison={comparison} challenger={challenger} setChallenger={setChallenger} /> : <SystemFitLock mode="compare" />)}
            {mode === 'analysis' && (canFitFull ? <DetailedAnalysis report={report} /> : <SystemFitLock />)}
          </div>
          {mode === 'fit'
            ? <SummaryRail report={report} player={selectedPlayer} canExport={canExport} setSelectedPlayer={setSelectedPlayer} />
            : <aside className="sf2-rail" />}
        </div>

        <div className="sf-founder-strip"><Crown size={18} /><div><b>Get World Cup Founder Pass</b><span>Pro exports, advanced analysis and World Cup intelligence.</span></div><button type="button" className="btn btn--lime btn--sm" onClick={() => navigateTo('/pricing')}>EXPLORE PLANS <ArrowRight size={13} /></button></div>
      </div>

      <style>{`
        .sf-page { display:block !important; }
        .sf2-wrap { position:relative; z-index:1; width:min(1500px, calc(100% - 40px)); margin:0 auto; padding:22px 0 40px; display:flex; flex-direction:column; gap:14px; }
        .sf2-wrap .sf-kicker { display:flex; align-items:center; gap:6px; color:#a6ff00; font:800 10px/1 "IBM Plex Mono","Barlow",monospace; letter-spacing:.15em; text-transform:uppercase; }
        .sf2-card { background:rgba(9,13,16,.46); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.08); border-radius:12px; box-shadow:0 12px 34px rgba(0,0,0,.30); padding:15px; }
        .sf2-card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:12px; }
        .sf2-card-head span { font:800 11px/1 "Barlow",sans-serif; letter-spacing:.1em; text-transform:uppercase; color:#fff; }
        .sf2-card-head b { font:800 9px/1 "IBM Plex Mono",monospace; letter-spacing:.08em; color:#a6ff00; text-transform:uppercase; }

        .sf2-hero { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; padding:4px 2px 0; }
        .sf2-hero-lead h1 { margin:8px 0 0; font:900 clamp(34px,4.2vw,52px)/.9 "Barlow Condensed","Space Grotesk",sans-serif; letter-spacing:.01em; text-transform:uppercase; color:#fff; }
        .sf2-hero-lead p { margin:11px 0 0; max-width:340px; color:#aeb4bd; font:500 13px/1.5 "Barlow",sans-serif; }
        .sf2-hero-actions { display:flex; gap:8px; flex-wrap:wrap; }

        /* selector row lifted above the body so its dropdowns are never clipped */
        .sf2-selectors { position:relative; z-index:50; display:grid; grid-template-columns:minmax(200px,1fr) minmax(240px,1.2fr) minmax(200px,1fr); gap:12px; }
        .sf2-select { position:relative; background:rgba(9,13,16,.46); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.08); border-radius:12px; box-shadow:0 12px 34px rgba(0,0,0,.30); padding:12px 14px; }
        .sf2-select > label { display:block; font:800 9px/1 "IBM Plex Mono",monospace; letter-spacing:.12em; color:#8d929b; text-transform:uppercase; margin-bottom:9px; }
        .sf2-search { display:flex; align-items:center; gap:8px; height:34px; padding:0 10px; border:1px solid rgba(255,255,255,.10); border-radius:8px; background:rgba(255,255,255,.03); }
        .sf2-search svg { color:#8d929b; flex:none; }
        .sf2-search input { min-width:0; flex:1; background:none; border:0; color:#fff; font:500 12.5px/1 "Barlow",sans-serif; outline:none; }
        .sf2-search input::placeholder { color:#6f757e; }
        .sf2-select--player { display:flex; align-items:center; gap:11px; }
        .sf2-select--player img { width:44px; height:44px; border-radius:50%; object-fit:cover; object-position:top; border:1px solid rgba(255,255,255,.14); flex:none; }
        .sf2-select--player b { display:block; color:#fff; font:800 16px/1 "Barlow",sans-serif; }
        .sf2-select--player small { display:block; margin-top:5px; color:#8d929b; font:600 10.5px/1.3 "Barlow",sans-serif; }
        .sf2-dropdown { position:absolute; left:10px; right:10px; top:calc(100% - 4px); z-index:60; max-height:250px; overflow:auto; background:rgba(10,14,17,.98); backdrop-filter:blur(18px); border:1px solid rgba(255,255,255,.10); border-radius:10px; box-shadow:0 20px 50px rgba(0,0,0,.6); }
        .sf2-dropdown button { display:flex; align-items:center; gap:9px; width:100%; padding:9px 11px; text-align:left; border-bottom:1px solid rgba(255,255,255,.05); background:none; cursor:pointer; }
        .sf2-dropdown button:hover { background:rgba(166,255,0,.06); }
        .sf2-dropdown img { width:30px; height:30px; border-radius:50%; object-fit:cover; object-position:top; border:1px solid rgba(255,255,255,.12); flex:none; }
        .sf2-dropdown b { display:block; color:#fff; font:700 12px/1.1 "Barlow",sans-serif; }
        .sf2-dropdown small { display:block; margin-top:3px; color:#8d929b; font:600 9.5px/1 "Barlow",sans-serif; }

        .sf2-body { position:relative; z-index:1; display:grid; grid-template-columns:220px minmax(0,1fr) 300px; gap:14px; align-items:start; }
        .sf2-center { display:flex; flex-direction:column; gap:14px; min-width:0; }

        .sf2-nav { display:flex; flex-direction:column; gap:14px; position:sticky; top:14px; }
        .sf2-nav-block { background:rgba(9,13,16,.46); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.08); border-radius:12px; box-shadow:0 12px 34px rgba(0,0,0,.30); padding:14px 12px; display:flex; flex-direction:column; gap:4px; }
        .sf2-nav-block .sf-kicker { margin-bottom:8px; }
        .sf2-nav-item, .sf2-qa { display:flex; align-items:center; gap:9px; width:100%; padding:9px 10px; border-radius:8px; background:none; border:1px solid transparent; color:#c4c9ce; font:600 12.5px/1 "Barlow",sans-serif; cursor:pointer; text-align:left; }
        .sf2-nav-item svg, .sf2-qa svg { color:#8d929b; flex:none; }
        .sf2-nav-item span, .sf2-qa span { flex:1; }
        .sf2-nav-item em { font:800 8px/1 "IBM Plex Mono",monospace; letter-spacing:.06em; color:#a6ff00; font-style:normal; }
        .sf2-nav-item:hover, .sf2-qa:hover { background:rgba(255,255,255,.04); color:#fff; }
        .sf2-nav-item.is-active { background:rgba(166,255,0,.10); border-color:rgba(166,255,0,.24); color:#fff; }
        .sf2-nav-item.is-active svg { color:#a6ff00; }
        .sf2-pro { border:1px solid rgba(166,255,0,.24); border-radius:12px; background:linear-gradient(180deg,rgba(166,255,0,.06),rgba(9,13,16,.5)); padding:15px 14px; }
        .sf2-pro b { display:block; color:#a6ff00; font:800 12px/1 "Barlow",sans-serif; letter-spacing:.04em; text-transform:uppercase; }
        .sf2-pro span { display:block; margin:7px 0 12px; color:#aeb4bd; font:500 11.5px/1.4 "Barlow",sans-serif; }

        .sf2-topcards { display:grid; grid-template-columns:minmax(210px,.85fr) minmax(240px,1.05fr) minmax(260px,1.2fr); gap:12px; align-items:stretch; }
        .sf2-topcards > .sf2-card { display:flex; flex-direction:column; }

        .sf2-attr-top { display:flex; gap:12px; }
        .sf2-attr-photo { width:92px; height:112px; border-radius:9px; overflow:hidden; flex:none; background:#0a0d10; }
        .sf2-attr-photo img { width:100%; height:100%; object-fit:cover; object-position:top; }
        .sf2-attr-rating strong { display:block; color:#fff; font:900 42px/.85 "Barlow Condensed",sans-serif; }
        .sf2-attr-rating span { display:block; margin-top:4px; color:#8d929b; font:800 8px/1 "IBM Plex Mono",monospace; letter-spacing:.1em; }
        .sf2-attr-chips { display:flex; gap:5px; margin-top:11px; flex-wrap:wrap; }
        .sf2-attr-chips em { padding:3px 8px; border:1px solid rgba(166,255,0,.28); border-radius:4px; color:#a6ff00; font:800 9px/1 "IBM Plex Mono",monospace; font-style:normal; }
        .sf2-attr-pos { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:14px; }
        .sf2-attr-pos small { display:block; color:#8d929b; font:700 8px/1 "IBM Plex Mono",monospace; letter-spacing:.08em; }
        .sf2-attr-pos b { display:block; margin-top:5px; color:#a6ff00; font:800 13px/1.15 "Barlow",sans-serif; }
        .sf2-attr-view { display:flex; align-items:center; justify-content:center; gap:7px; width:100%; margin:14px 0; padding:10px; border:1px solid rgba(166,255,0,.30); border-radius:8px; background:rgba(166,255,0,.05); color:#a6ff00; font:800 10px/1 "IBM Plex Mono",monospace; letter-spacing:.08em; cursor:pointer; }
        .sf2-attr-view:hover { background:rgba(166,255,0,.12); }
        .sf2-attr-grid { display:grid; grid-template-columns:1fr 1fr; gap:11px 10px; border-top:1px solid rgba(255,255,255,.07); padding-top:13px; margin-top:auto; }
        .sf2-attr-grid small { display:block; color:#8d929b; font:700 8px/1 "IBM Plex Mono",monospace; letter-spacing:.07em; }
        .sf2-attr-grid b { display:block; margin-top:5px; color:#fff; font:700 13px/1.15 "Barlow",sans-serif; }

        .sf2-fit .sf-kicker { margin-bottom:12px; }
        .sf2-fit-head { display:flex; align-items:center; gap:14px; }
        .sf2-fit-head h2 { margin:0; color:#a6ff00; font:900 24px/.95 "Barlow Condensed",sans-serif; letter-spacing:.02em; text-transform:uppercase; }
        .sf2-fit-head p { margin:7px 0 0; color:#c7cbd2; font:500 12px/1.5 "Barlow",sans-serif; }
        .sf2-fit-checks { display:grid; gap:8px; margin:14px 0; }
        .sf2-fit-checks span { display:flex; align-items:flex-start; gap:8px; color:#cfd3d8; font:500 12px/1.4 "Barlow",sans-serif; }
        .sf2-fit-checks svg { color:#a6ff00; flex:none; margin-top:1px; }
        .sf2-chips { display:flex; gap:6px; flex-wrap:wrap; margin-top:auto; }
        .sf2-chips span { padding:5px 8px; border:1px solid rgba(255,255,255,.12); border-radius:4px; background:rgba(255,255,255,.02); color:#c4c9ce; font:700 9px/1 "IBM Plex Mono",monospace; letter-spacing:.05em; text-transform:uppercase; }

        .sf2-pitch { position:relative; flex:1; min-height:300px; border-radius:8px; overflow:hidden; background:linear-gradient(180deg,rgba(20,44,16,.55),rgba(8,14,8,.5)), repeating-linear-gradient(180deg,transparent 0 11%,rgba(255,255,255,.02) 12%,transparent 13% 22%); border:1px solid rgba(255,255,255,.07); }
        .sf2-pitch-circle { position:absolute; left:50%; top:50%; width:60px; height:60px; margin:-30px 0 0 -30px; border:1px solid rgba(255,255,255,.10); border-radius:50%; }
        .sf2-pitch-box { position:absolute; left:50%; width:96px; height:30px; margin-left:-48px; border:1px solid rgba(255,255,255,.10); }
        .sf2-pitch-box--t { top:0; } .sf2-pitch-box--b { bottom:0; }
        .sf2-slot { position:absolute; transform:translate(-50%,-50%); display:grid; justify-items:center; text-align:center; width:74px; }
        .sf2-slot i { width:10px; height:10px; border-radius:50%; margin-bottom:3px; }
        .sf2-slot b { color:#e7ebe9; font:700 8.5px/1.1 "Barlow",sans-serif; }
        .sf2-slot strong { margin-top:1px; font:900 13px/1 "Barlow Condensed",sans-serif; }
        .sf2-slot small { margin-top:2px; color:#a6ff00; font:800 6.5px/1 "IBM Plex Mono",monospace; letter-spacing:.06em; }
        .sf2-slot--exc i { background:#4ade80; box-shadow:0 0 10px rgba(74,222,128,.6);} .sf2-slot--exc strong { color:#4ade80; }
        .sf2-slot--good i { background:#a6ff00; box-shadow:0 0 10px rgba(166,255,0,.5);} .sf2-slot--good strong { color:#a6ff00; }
        .sf2-slot--avg i { background:#f5c84b; box-shadow:0 0 10px rgba(245,200,75,.5);} .sf2-slot--avg strong { color:#f5c84b; }
        .sf2-slot--low i { background:#ff6464; box-shadow:0 0 10px rgba(255,100,100,.45);} .sf2-slot--low strong { color:#ff6464; }
        .sf2-legend { display:flex; gap:14px; margin-top:11px; flex-wrap:wrap; }
        .sf2-legend span { display:flex; align-items:center; gap:6px; color:#9aa0a9; font:600 10px/1 "Barlow",sans-serif; }
        .sf2-legend i { width:9px; height:9px; border-radius:50%; }
        .sf2-legend .exc { background:#4ade80; } .sf2-legend .good { background:#a6ff00; } .sf2-legend .avg { background:#f5c84b; } .sf2-legend .low { background:#ff6464; }

        .sf2-breakdown-grid { display:grid; gap:14px; }
        .sf2-breakdown-grid > div { min-width:0; }
        .sf2-breakdown-grid small { display:block; color:#9aa0a9; font:700 9px/1.2 "IBM Plex Mono",monospace; letter-spacing:.04em; }
        .sf2-breakdown-val { display:flex; align-items:baseline; gap:3px; margin:8px 0 7px; }
        .sf2-breakdown-val strong { color:#a6ff00; font:900 26px/1 "Barlow Condensed",sans-serif; }
        .sf2-breakdown-val em { color:#6f757e; font:600 10px/1 "Barlow",sans-serif; font-style:normal; }
        .sf2-breakdown-bar { height:4px; border-radius:4px; background:rgba(255,255,255,.08); overflow:hidden; }
        .sf2-breakdown-bar span { display:block; height:100%; background:linear-gradient(90deg,rgba(166,255,0,.4),#a6ff00); border-radius:4px; }

        .sf2-roles-grid { display:grid; gap:10px; }
        .sf2-role { border:1px solid rgba(255,255,255,.08); border-radius:9px; background:rgba(255,255,255,.02); padding:12px 11px; min-width:0; }
        .sf2-role-top { display:flex; align-items:center; gap:7px; }
        .sf2-dot { width:9px; height:9px; border-radius:50%; flex:none; }
        .sf2-dot--exc { background:#4ade80; } .sf2-dot--good { background:#a6ff00; } .sf2-dot--avg { background:#f5c84b; } .sf2-dot--low { background:#ff6464; }
        .sf2-role-top b { color:#fff; font:800 12px/1.1 "Barlow",sans-serif; }
        .sf2-role small { display:block; margin:8px 0 12px; color:#8d929b; font:700 8px/1 "IBM Plex Mono",monospace; letter-spacing:.06em; }
        .sf2-role-foot { display:flex; align-items:baseline; justify-content:space-between; }
        .sf2-role-foot span { color:#8d929b; font:700 9px/1 "IBM Plex Mono",monospace; }
        .sf2-role-foot strong { color:#a6ff00; font:900 18px/1 "Barlow Condensed",sans-serif; }

        .sf2-ranking-list { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .sf2-ranking-list button { display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid rgba(255,255,255,.07); border-radius:9px; background:rgba(255,255,255,.02); cursor:pointer; text-align:left; }
        .sf2-ranking-list button:hover { border-color:rgba(166,255,0,.3); background:rgba(166,255,0,.05); }
        .sf2-ranking-list em { color:#8d929b; font:900 13px/1 "Barlow Condensed",sans-serif; font-style:normal; width:16px; flex:none; }
        .sf2-ranking-list span { flex:1; min-width:0; }
        .sf2-ranking-list b { display:block; color:#fff; font:700 13px/1.1 "Barlow",sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sf2-ranking-list small { display:block; margin-top:3px; color:#8d929b; font:600 9.5px/1 "Barlow",sans-serif; }
        .sf2-ranking-list strong { color:#a6ff00; font:900 15px/1 "Barlow Condensed",sans-serif; flex:none; }

        .sf2-rail { display:flex; flex-direction:column; gap:14px; position:sticky; top:14px; }
        .sf2-sum { display:flex; flex-direction:column; }
        .sf2-sum-row { display:flex; align-items:center; gap:10px; padding:10px 0; border-top:1px solid rgba(255,255,255,.06); }
        .sf2-sum-row:first-child { border-top:0; }
        .sf2-sum-row svg { color:#a6ff00; flex:none; }
        .sf2-sum-row span { flex:1; color:#c4c9ce; font:600 12px/1 "Barlow",sans-serif; }
        .sf2-sum-row b { color:#a6ff00; font:900 16px/1 "Barlow Condensed",sans-serif; }
        .sf2-sum-row b.is-risk-med { color:#f5c84b; } .sf2-sum-row b.is-risk-high { color:#ff6464; }
        .sf2-why { margin-top:13px; border-top:1px solid rgba(255,255,255,.06); padding-top:12px; }
        .sf2-why small { color:#8d929b; font:800 9px/1 "IBM Plex Mono",monospace; letter-spacing:.1em; }
        .sf2-why p { margin:8px 0 0; color:#c7cbd2; font:500 12px/1.55 "Barlow",sans-serif; }
        .sf2-download { width:100%; margin:14px 0 0; justify-content:center; }
        .sf2-risk { margin-top:14px; border-top:1px solid rgba(255,255,255,.06); padding-top:12px; display:flex; flex-direction:column; gap:9px; }
        .sf2-risk small { color:#ff6464; font:800 9px/1 "IBM Plex Mono",monospace; letter-spacing:.1em; }
        .sf2-risk span { display:flex; align-items:flex-start; gap:8px; color:#c4c9ce; font:500 11.5px/1.4 "Barlow",sans-serif; }
        .sf2-risk i { width:7px; height:7px; border-radius:50%; background:#ff6464; box-shadow:0 0 8px rgba(255,100,100,.5); flex:none; margin-top:4px; }
        .sf2-similar button { display:flex; align-items:center; gap:10px; width:100%; padding:10px 0; border:0; border-top:1px solid rgba(255,255,255,.06); background:none; cursor:pointer; text-align:left; }
        .sf2-similar button:first-child { border-top:0; }
        .sf2-similar button:hover b { color:#a6ff00; }
        .sf2-similar em { color:#8d929b; font:900 13px/1 "Barlow Condensed",sans-serif; font-style:normal; width:14px; }
        .sf2-similar img { width:34px; height:34px; border-radius:50%; object-fit:cover; object-position:top; border:1px solid rgba(255,255,255,.12); flex:none; }
        .sf2-similar b { flex:1; color:#fff; font:700 13px/1.1 "Barlow",sans-serif; }
        .sf2-similar strong { padding:3px 8px; border:1px solid rgba(166,255,0,.24); border-radius:5px; color:#a6ff00; font:900 12px/1 "Barlow Condensed",sans-serif; }
        .sf2-similar-empty { margin:2px 0 0; color:#7a828c; font:500 11.5px/1.5 "Barlow",sans-serif; }

        .sf-founder-strip { margin-top:0; }

        /* full-profile modal (portaled to <body>, sits above everything) */
        .sf2-modal { position:fixed; inset:0; z-index:1000; background:rgba(3,5,7,.72); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:40px 20px; overflow:auto; }
        .sf2-modal-card { position:relative; width:min(560px,100%); background:rgba(11,15,18,.97); border:1px solid rgba(255,255,255,.10); border-radius:16px; box-shadow:0 30px 80px rgba(0,0,0,.65); padding:22px; }
        .sf2-modal-close { position:absolute; top:14px; right:14px; width:30px; height:30px; display:grid; place-items:center; border-radius:8px; border:1px solid rgba(255,255,255,.10); background:rgba(255,255,255,.03); color:#c4c9ce; cursor:pointer; }
        .sf2-modal-close:hover { background:rgba(255,255,255,.08); color:#fff; }
        .sf2-modal-head { display:flex; align-items:center; gap:14px; padding-right:34px; }
        .sf2-modal-photo { width:70px; height:84px; border-radius:9px; overflow:hidden; flex:none; background:#0a0d10; }
        .sf2-modal-photo img { width:100%; height:100%; object-fit:cover; object-position:top; }
        .sf2-modal-id { flex:1; min-width:0; }
        .sf2-modal-id h3 { margin:6px 0 0; color:#fff; font:900 24px/1 "Barlow Condensed",sans-serif; text-transform:uppercase; letter-spacing:.01em; }
        .sf2-modal-tags { display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; }
        .sf2-modal-tags span { padding:3px 8px; border:1px solid rgba(255,255,255,.14); border-radius:4px; color:#c4c9ce; font:700 9px/1 "IBM Plex Mono",monospace; }
        .sf2-modal-tags em { padding:3px 8px; border:1px solid rgba(166,255,0,.3); border-radius:4px; color:#a6ff00; font:800 9px/1 "IBM Plex Mono",monospace; font-style:normal; }
        .sf2-modal-rating { text-align:center; flex:none; }
        .sf2-modal-rating strong { display:block; color:#a6ff00; font:900 40px/.85 "Barlow Condensed",sans-serif; }
        .sf2-modal-rating span { display:block; margin-top:4px; color:#8d929b; font:800 8px/1 "IBM Plex Mono",monospace; letter-spacing:.1em; }
        .sf2-modal-sec { margin-top:18px; }
        .sf2-modal-sec > small { display:block; color:#8d929b; font:800 9px/1 "IBM Plex Mono",monospace; letter-spacing:.12em; margin-bottom:11px; }
        .sf2-modal-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px 10px; }
        .sf2-modal-grid--stats { grid-template-columns:repeat(4,1fr); }
        .sf2-modal-grid > div { min-width:0; }
        .sf2-modal-grid span { display:block; color:#8d929b; font:700 8px/1.2 "IBM Plex Mono",monospace; letter-spacing:.05em; }
        .sf2-modal-grid b { display:block; margin-top:5px; color:#fff; font:800 15px/1 "Barlow Condensed",sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sf2-modal-note { margin:18px 0 0; color:#6f757e; font:500 10.5px/1.4 "Barlow",sans-serif; }

        @media (max-width: 1200px) {
          .sf2-body { grid-template-columns:1fr; }
          .sf2-nav, .sf2-rail { position:static; }
          .sf2-rail { flex-direction:row; flex-wrap:wrap; }
          .sf2-rail > .sf2-card { flex:1 1 300px; }
          .sf2-topcards { grid-template-columns:1fr; }
          .sf2-selectors { grid-template-columns:1fr 1fr; }
        }
        @media (max-width: 760px) {
          .sf2-selectors { grid-template-columns:1fr; }
          .sf2-ranking-list { grid-template-columns:1fr; }
          .sf2-modal-grid, .sf2-modal-grid--stats { grid-template-columns:repeat(2,1fr); }
          .sf2-hero { flex-direction:column; }
        }
      `}</style>
    </div>
  );
}
