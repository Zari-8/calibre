import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowRight, BarChart3, CheckCircle2, CircleDot, Crown, Database,
  Download, FileText, GitCompare, Layers3, Search, Share2, ShieldCheck, Sparkles, Star,
} from 'lucide-react';
import { navigateTo } from '../components/NavLink.jsx';
import { searchPlayerProfiles as searchApiPlayers, searchTeams as searchApiTeams } from '../services/apiFootball.js';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import ShareBar, { shareUrl } from '../components/Share.jsx';
import { searchSupabasePlayers } from '../services/supabasePlayers.js';
import useAuth from '../hooks/useAuth.js';
import { resolveTier, can } from '../services/access.js';
import { playerIdFor } from '../data/playerIds.js';
import { calibreRating, resolveRating } from '../services/calibreRating.js';
import { playerTraits, deriveArchetype } from '../services/playerTraits.js';
import {
  SYSTEM_PLAYERS, SYSTEM_TEAMS, TRANSFER_SPOTLIGHTS, buildPlayerComparison, buildSystemFitReport,
  searchLocalPlayers, searchLocalTeams, TRANSFER_STORYLINES, pickTransferStoryline, buildTransferSpotlight,
} from '../data/systemFitData.js';
import {
  exportComparisonCsv, exportComparisonPdf, exportFitCsv, exportFitPdf,
} from '../services/reportExport.js';

// Export access is resolved per-user via services/access.js (owner allowlist +
// paid tier), consistent with the PDF report and dossier gating.

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
          rows = (await searchApiTeams(query) || []).map(item => ({ ...item, source: 'api' }));
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
  const roles = [
    { role: report.primaryRoles?.[0] || report.player.position || 'Primary', score: report.score, label: 'PRIMARY', x: 50, y: 32 },
    { role: report.primaryRoles?.[1] || 'Secondary', score: Math.max(70, report.score - 14), label: 'SECONDARY', x: 28, y: 58 },
    { role: report.primaryRoles?.[2] || 'Option', score: Math.max(66, report.score - 18), label: 'SECONDARY', x: 72, y: 58 },
    { role: 'Depth option', score: Math.max(62, report.score - 25), label: 'DEPTH OPTION', x: 50, y: 78 },
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
        { value: `${report.score}%`,                          label: 'Fit score',    sub: '' },
        { value: `${Math.max(72, report.score)}%`,             label: 'Primary role', sub: '' },
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

function FitIntelligenceDashboard({ report, mode, comparison, challenger }) {
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
      <SearchSidebar selectedTeam={selectedTeam} selectedPlayer={selectedPlayer} setSelectedTeam={setSelectedTeam} setSelectedPlayer={setSelectedPlayer} />
      <main className="sf-main">
        <div className="sf-pagebar">
          <div><div className="sf-kicker">PLAYER INTELLIGENCE</div><h1>SYSTEM FIT ENGINE</h1></div>
          <div className="sf-pagebar-actions"><button type="button" className="btn btn--ghost btn--sm"><Share2 size={14} /> SHARE</button><ExportButtons mode={mode} fitReport={report} comparison={comparison} canExport={canExport} /></div>
        </div>
        <div className="sf-mode-tabs">
          <button type="button" className={mode === 'fit' ? 'active' : ''} onClick={() => setMode('fit')}>SYSTEM FIT</button>
          <button type="button" className={mode === 'compare' ? 'active' : ''} onClick={() => setMode('compare')}>COMPARE PLAYER</button>
          <button type="button" className={mode === 'analysis' ? 'active' : ''} onClick={() => setMode('analysis')}>DETAILED ANALYSIS</button>
        </div>
        <FitIntelligenceDashboard report={report} mode={mode} comparison={comparison} challenger={challenger} />
        {mode === 'compare' && <ComparePlayers comparison={comparison} challenger={challenger} setChallenger={setChallenger} />}
        {mode === 'analysis' && <DetailedAnalysis report={report} />}
        <section className="sf-panel sf-ranking-panel">
          <div className="sf-panel-head"><div><Star size={17} /><span>BEST-FIT CLUB RANKING</span></div><b>MODEL OUTPUT</b></div>
          <div className="sf-ranking-grid">{report.alternativeFits.slice(0, 6).map((team, index) => <button type="button" key={team.id} onClick={() => setSelectedTeam(team)}><b>0{index + 1}</b><Crest team={team} size={32} /><span><strong>{team.name}</strong><small>{team.formation} · {team.league}</small></span><em>{team.score}%</em></button>)}</div>
        </section>
        <div className="sf-founder-strip"><Crown size={18} /><div><b>Get World Cup Founder Pass</b><span>Pro exports, advanced analysis and World Cup intelligence.</span></div><button type="button" className="btn btn--lime btn--sm" onClick={() => navigateTo('/pricing')}>EXPLORE PLANS <ArrowRight size={13} /></button></div>

        <style>{`
          .sf-page { --sf-lime:#a6ff00; --sf-panel:rgba(15,15,19,.92); --sf-border:rgba(166,255,0,.16); --sf-muted:#8d929b; }
          .sf-main { padding-bottom: 34px; }
          .sf-dashboard-shell { display:flex; flex-direction:column; gap:14px; }
          .sf-dashboard-hero { display:grid; grid-template-columns: 120px minmax(260px, 1.3fr) minmax(240px, .95fr) minmax(220px, .85fr); gap:12px; align-items:stretch; background:linear-gradient(135deg, rgba(166,255,0,.08), rgba(12,12,16,.96) 30%, rgba(10,10,12,.98)); border:1px solid var(--sf-border); border-radius:14px; padding:12px; box-shadow:0 0 0 1px rgba(255,255,255,.025) inset, 0 24px 70px rgba(0,0,0,.45); }
          .sf-player-portrait--dashboard { min-height:160px; max-height:200px; border-radius:10px; overflow:hidden; }
          .sf-player-portrait--dashboard img { width:100%; height:100%; object-fit:cover; object-position:top center; }
          .sf-dashboard-verdict, .sf-system-read, .sf-lineup-board--dashboard { background:rgba(10,10,13,.78); border:1px solid rgba(255,255,255,.07); border-radius:10px; padding:16px; }
          .sf-dashboard-verdict { display:flex; flex-direction:column; justify-content:center; gap:12px; }
          .sf-dashboard-verdict h2 { margin:0 0 6px; color:var(--sf-lime); font-size:34px; line-height:.95; letter-spacing:-.03em; }
          .sf-dashboard-verdict p, .sf-system-read p { color:#c7cbd2; line-height:1.55; margin:0; }
          .sf-dashboard-checks { display:grid; gap:8px; }
          .sf-dashboard-checks span { display:flex; gap:7px; align-items:flex-start; color:#cfd3d8; font-size:12px; line-height:1.35; }
          .sf-dashboard-checks svg { color:var(--sf-lime); flex:0 0 auto; margin-top:1px; }
          .sf-pitch--dashboard { min-height:220px; }
          .sf-system-read { display:flex; flex-direction:column; justify-content:center; gap:12px; }
          .sf-transfer-points { display:grid; gap:9px; }
          .sf-transfer-points span { display:flex; gap:8px; color:#d8dce1; font-size:12px; line-height:1.35; }
          .sf-transfer-points i { width:7px; height:7px; border-radius:999px; background:var(--sf-lime); margin-top:4px; box-shadow:0 0 14px rgba(166,255,0,.7); flex:0 0 auto; }
          .sf-system-read small { color:var(--sf-muted); line-height:1.4; }
          .sf-dashboard-grid { display:grid; grid-template-columns: 1.05fr .95fr 1fr; gap:12px; }
          .sf-dashboard-grid--lower { grid-template-columns: 1.45fr .55fr; }
          .sf-fit-breakdown-panel .sf-metric-row { margin-bottom:10px; }
          .sf-role-radar-panel { overflow: hidden; }
          .sf-impact-row { display:grid; grid-template-columns:42px 1fr auto; gap:12px; align-items:center; padding:12px 0; border-bottom:1px solid rgba(255,255,255,.06); }
          .sf-impact-row:last-child { border-bottom:0; }
          .sf-impact-icon { width:38px; height:38px; border-radius:9px; display:grid; place-items:center; color:var(--sf-lime); background:rgba(166,255,0,.08); border:1px solid rgba(166,255,0,.22); }
          .sf-impact-row b { color:#fff; display:block; margin-bottom:3px; }
          .sf-impact-row p { color:#aeb4bd; margin:0; font-size:12px; line-height:1.35; }
          .sf-impact-row strong { color:var(--sf-lime); font-size:25px; letter-spacing:-.05em; }
          .sf-impact-row strong small { color:#cbd0d6; font-size:12px; margin-left:2px; }
          .sf-key-stats-grid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; }
          .sf-key-stats-grid div { padding:14px 10px; border:1px solid rgba(255,255,255,.06); border-radius:10px; background:rgba(255,255,255,.025); text-align:center; }
          .sf-key-stats-grid strong { display:block; color:#fff; font-size:24px; line-height:1; letter-spacing:-.04em; }
          .sf-key-stats-grid span { display:block; margin-top:6px; color:#9aa0a9; text-transform:uppercase; font-size:10px; letter-spacing:.08em; }
          .sf-kicker--risk { color:#ff6464; }
          .sf-ranking-panel { margin-top:0; }
          .sf-lineup-board--dashboard { display:flex; flex-direction:column; flex:1; }
          .sf-pitch--dashboard { flex:1; min-height:180px; }
          @media (max-width: 1280px) { .sf-dashboard-hero { grid-template-columns:120px 1fr 1fr; } .sf-system-read { grid-column:2 / 4; } .sf-dashboard-grid, .sf-dashboard-grid--lower { grid-template-columns:1fr; } }
          @media (max-width: 900px) { .sf-dashboard-hero { grid-template-columns:80px 1fr; } .sf-system-read { grid-column:auto; } .sf-player-portrait--dashboard { min-height:120px; max-height:160px; } }
        `}</style>
      </main>
    </div>
  );
}
