import { useEffect, useMemo, useRef, useState } from 'react';
import { Trophy, ArrowRight, Star, Play, ChevronRight, ChevronLeft } from 'lucide-react';
import WorldCupNav from '../components/WorldCupNav.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import ApiTeamLogo from '../components/ApiTeamLogo.jsx';
import PremierBetBanner from '../components/PremierBetBanner.jsx';
import { navigateTo } from '../components/NavLink.jsx';
import { supabase, supabaseConfigured } from '../services/supabaseClient.js';
import { getFixturesByDate, getFixtureLineups, getFixtureEvents, teamLogoUrl } from '../services/apiFootball.js';
import { WC_CONFIG, wcFacts, featuredMatch, TEAM_FLAGS } from '../data/worldCupData.js';

// Dominance bar for one stat, home value growing from the right toward the
// label and away value growing from the left — only rendered once both
// sides have a real number (never a fabricated 0). Shares the wc-data-*
// classes with the rest of the redesigned dashboard so it drops into any
// stat table (Overview tab preview, full Match Data table) without its own
// stylesheet.
function DominanceBar({ label, home, away, suffix = '' }) {
  if (home == null || away == null) return null;
  const total = home + away || 1;
  const homePct = (home / total) * 100;
  return (
    <div className="wc-data-row">
      <div className="wc-data-value">{home}{suffix}</div>
      <div className="wc-data-track"><div style={{ width: `${homePct}%` }} /></div>
      <div className="wc-data-label">{label}</div>
      <div className="wc-data-track away"><div style={{ width: `${100 - homePct}%` }} /></div>
      <div className="wc-data-value">{away}{suffix}</div>
    </div>
  );
}

// Renders a formation string ("4-3-3") as a small dot diagram — a real,
// deterministic layout of the actual lineup formation already fetched from
// API-Football, not a fabricated tactical map. Returns null if no formation
// was returned for this fixture (never guesses a shape).
function FormationPitch({ formation, side = 'home' }) {
  if (!formation) return null;
  const lines = formation.split('-').map(n => parseInt(n, 10)).filter(n => Number.isFinite(n) && n > 0);
  if (!lines.length) return null;
  const rows = [1, ...lines]; // goalkeeper + each outfield line, GK first
  return (
    <div className="wc-pitch">
      <svg className="wc-pitch-markings" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="4" y="4" width="92" height="92" />
        <rect x="22" y="4" width="56" height="20" />
        <rect x="38" y="4" width="24" height="9" />
        <circle cx="50" cy="34" r="10" />
      </svg>
      <div className="wc-pitch-field">
        {rows.map((count, i) => (
          <div className="wc-pitch-row" key={i}>
            {Array.from({ length: count }).map((_, j) => <span className={`wc-pitch-dot ${side}`} key={j} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function useCountdown() {
  const [left, setLeft] = useState(() => Math.max(0, new Date(WC_CONFIG.kickoff) - new Date()));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, new Date(WC_CONFIG.kickoff) - new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  const days = Math.floor(left / 86400000);
  const hrs = Math.floor((left % 86400000) / 3600000);
  const mins = Math.floor((left % 3600000) / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  return { days, hrs, mins, secs, isLive: left <= 0 };
}

// FIFA's published 2026 format — 48 teams, 104 matches, 16 host stadiums —
// is a fixed tournament rule, not performance data that a live query could
// contradict or that changes as the tournament runs. Kept as a named,
// documented constant rather than a bare literal in JSX, and never presented
// as something the DB "verified" — only Host Nations below is truly
// config-derived (WC_CONFIG.hosts), since that's actual project data.
const TOURNAMENT_FORMAT = { teams: 48, matches: 104, stadiums: 16 };
const HOST_FLAGS = { USA: '🇺🇸', Canada: '🇨🇦', Mexico: '🇲🇽' };

// Real API-Football team IDs for the host nations' men's senior sides,
// verified against /api/football?endpoint=teams&country=<name> (national:true,
// filtered to the senior men's entry — API-Football also returns women's and
// youth national sides under the same country, which is easy to grab by
// mistake). Used to pull real crests via teamLogoUrl() instead of flag emoji.
const HOST_TEAM_IDS = { USA: 2384, Canada: 5529, Mexico: 16 };

// Match Intelligence tabs — each maps to real, already-computed data below.
// No tab renders anything that isn't backed by featuredMatch.stats, the
// live formations/timeline fetch, or the Sofascore embed.
const INTEL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'xg', label: 'xG' },
  { id: 'momentum', label: 'Momentum' },
  { id: 'tactical', label: 'Tactical' },
  { id: 'shots', label: 'Shots' },
];

export default function WorldCupOverview() {
  const { days, hrs, mins, secs, isLive } = useCountdown();

  const [activeTab, setActiveTab] = useState('overview');
  const highlightsRef = useRef(null);

  // Stats leaders preview — real wc_leaders table, same source the full
  // Stats page uses, just capped to a short preview here.
  const [wcLeaders, setWcLeaders] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabaseConfigured || !supabase) return;
      const { data, error } = await supabase
        .from('wc_leaders').select('*')
        .order('goals', { ascending: false })
        .order('assists', { ascending: false })
        .limit(5);
      if (!error && alive) setWcLeaders(data || []);
    })();
    return () => { alive = false; };
  }, []);

  // Live formations + goal/card timeline for the Featured Match — narrowly
  // targeted at one known fixture (a single confirmed date + the two real
  // team names), not the broad multi-week/name-substring sweep the bracket
  // used to rely on. The rest of the Match Data panel below now comes from
  // curated real numbers (see featuredMatch.stats in worldCupData.js) rather
  // than a live fetch, since that proved unreliable for a one-off historical
  // match — this fetch is only for the two things not covered by the
  // curated Sofascore data: lineup formations and the goal/card timeline.
  const [matchData, setMatchData] = useState({ loading: true, lineups: [], events: [] });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const fixtures = await getFixturesByDate(featuredMatch.fixtureDate).catch(() => []);
        const list = Array.isArray(fixtures) ? fixtures : [];
        const home = featuredMatch.homeApiName.toLowerCase();
        const away = featuredMatch.awayApiName.toLowerCase();
        const match = list.find(f => {
          const h = (f.teams?.home?.name || '').toLowerCase();
          const a = (f.teams?.away?.name || '').toLowerCase();
          return (h.includes(home) && a.includes(away)) || (h.includes(away) && a.includes(home));
        });
        const fixtureId = match?.fixture?.id;
        if (!fixtureId) { if (alive) setMatchData({ loading: false, lineups: [], events: [] }); return; }
        const [lineups, events] = await Promise.all([
          getFixtureLineups(fixtureId).catch(() => []),
          getFixtureEvents(fixtureId).catch(() => []),
        ]);
        if (alive) setMatchData({ loading: false, lineups: lineups || [], events: events || [] });
      } catch {
        if (alive) setMatchData({ loading: false, lineups: [], events: [] });
      }
    })();
    return () => { alive = false; };
  }, []);

  const homeFormation = useMemo(() => matchData.lineups.find(l => (l.team?.name || '').toLowerCase().includes(featuredMatch.homeApiName.toLowerCase()))?.formation || null, [matchData.lineups]);
  const awayFormation = useMemo(() => matchData.lineups.find(l => (l.team?.name || '').toLowerCase().includes(featuredMatch.awayApiName.toLowerCase()))?.formation || null, [matchData.lineups]);

  const timelineEvents = useMemo(() => (matchData.events || [])
    .filter(e => e.type === 'Goal' || e.type === 'Card')
    .sort((a, b) => (a.time?.elapsed || 0) - (b.time?.elapsed || 0)), [matchData.events]);

  // Match Data panel — built directly from featuredMatch.stats, curated from
  // Sofascore's own match center for this fixture (see worldCupData.js for
  // sourcing notes). Always available, no loading/empty state needed.
  const allDominanceRows = useMemo(() => {
    const s = featuredMatch.stats;
    if (!s) return [];
    const passAcc = (attempted, accurate) => attempted > 0 ? Math.round((accurate / attempted) * 100) : null;
    return [
      { label: 'Possession', home: s.possession.home, away: s.possession.away, suffix: '%' },
      { label: 'xG', home: s.xg.home, away: s.xg.away },
      { label: 'Big Chances', home: s.bigChances.home, away: s.bigChances.away },
      { label: 'Total Shots', home: s.totalShots.home, away: s.totalShots.away },
      { label: 'Shots on Target', home: s.shotsOnTarget.home, away: s.shotsOnTarget.away },
      { label: 'Pass Accuracy', home: passAcc(s.passesAttempted.home, s.passesAccurate.home), away: passAcc(s.passesAttempted.away, s.passesAccurate.away), suffix: '%' },
      { label: 'Corners', home: s.corners.home, away: s.corners.away },
      { label: 'Fouls', home: s.fouls.home, away: s.fouls.away },
      { label: 'Tackles', home: s.tackles.home, away: s.tackles.away },
      { label: 'Yellow Cards', home: s.yellowCards.home, away: s.yellowCards.away },
      { label: 'Distance Covered', home: s.distanceCoveredKm.home, away: s.distanceCoveredKm.away, suffix: 'km' },
      { label: 'Sprints', home: s.sprints.home, away: s.sprints.away },
      { label: 'GK Saves', home: s.goalkeeperSaves.home, away: s.goalkeeperSaves.away },
    ];
  }, []);
  // The compact top-row card only has room for the headline numbers — same
  // real source, just a shorter cut. The rest still render in full below in
  // the Shots tab, nothing is dropped.
  const compactRows = useMemo(() => allDominanceRows.filter(r => ['Possession', 'Total Shots', 'Big Chances', 'Pass Accuracy'].includes(r.label)), [allDominanceRows]);
  const xgRow = useMemo(() => allDominanceRows.find(r => r.label === 'xG') || null, [allDominanceRows]);

  // Shot Breakdown — from the same curated Sofascore numbers. Deliberately
  // not a spatial "shot map": Sofascore's per-shot pitch coordinates can't be
  // read reliably off a static screenshot for all 22 shots, so this stays a
  // count/xG breakdown rather than plotted dots on a pitch.
  const shotBreakdown = useMemo(() => {
    const s = featuredMatch.stats;
    if (!s) return null;
    return {
      home: { shots: s.totalShots.home, onTarget: s.shotsOnTarget.home, offTarget: s.shotsOffTarget.home, xg: s.xg.home },
      away: { shots: s.totalShots.away, onTarget: s.shotsOnTarget.away, offTarget: s.shotsOffTarget.away, xg: s.xg.away },
    };
  }, []);

  // Calibre Insight — short bullet read built only from the curated real
  // numbers above (xG, possession, big chances, touches in the box).
  const calibreInsightBullets = useMemo(() => {
    const s = featuredMatch.stats;
    if (!s) return [];
    const winnerIsHome = featuredMatch.homeScore > featuredMatch.awayScore;
    const winnerName = winnerIsHome ? featuredMatch.home : featuredMatch.away;
    const pick = (row) => winnerIsHome ? row.home : row.away;
    const pickOpp = (row) => winnerIsHome ? row.away : row.home;
    return [
      `${winnerName} won on a scoreline that ran ahead of the underlying chances: ${pick(s.xg).toFixed(2)} xG for them vs ${pickOpp(s.xg).toFixed(2)} xG against.`,
      `${pick(s.possession)}% possession and ${pick(s.totalShots)} shots to the opponent's ${pickOpp(s.totalShots)}.`,
      `${pick(s.bigChances)} big chances created to the opponent's ${pickOpp(s.bigChances)}.`,
      `${pick(s.touchesInOppositionBox)} touches in the opposition box, against ${pickOpp(s.touchesInOppositionBox)}.`,
    ];
  }, []);

  const dayIndex = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const validFacts = wcFacts.filter(f => f && f.fact);
  const factOfDay = validFacts.length ? validFacts[((dayIndex % validFacts.length) + validFacts.length) % validFacts.length] : null;

  const topScorer = wcLeaders[0] || null;

  const scrollHighlights = (dir) => {
    if (!highlightsRef.current) return;
    highlightsRef.current.scrollBy({ left: dir * 280, behavior: 'smooth' });
  };

  return (
    <div className="page calibre-wc-overview">

      <style>{`
        .calibre-wc-overview {
          --lime:#97cc0d;
          --bg:#050708;
          --glass:rgba(12,16,20,.72);
          --border:rgba(255,255,255,.10);
          --muted:#8b929a;
          color:#fff;
          min-height:100vh;
          background:#050708;
          position:relative;
          overflow:hidden;
        }

        .calibre-wc-overview:before {
          content:"";
          position:fixed;
          inset:0;
          background:
            linear-gradient(180deg, rgba(5,7,8,.15), rgba(5,7,8,.85)),
            url("/assets/WC-overview-bg.png") center/cover no-repeat;
          z-index:-1;
        }

        .calibre-wc-overview * { box-sizing:border-box; }

        .page.calibre-wc-overview {
          max-width:1600px;
        }

        .wc-overview-shell {
          width:100%;
        }

        /* ============ HERO ROW ============ */

        .wc-hero-row {
          position:relative;
          display:grid;
          grid-template-columns:1.85fr 1fr;
          gap:22px;
          margin-top:22px;
          align-items:start;
          border-radius:24px;
          overflow:hidden;
          background:url("/assets/WC-overview-bg.png") center/cover no-repeat;
        }

        .wc-hero-row > * { min-width:0; }

        @media(max-width:1100px){
          .wc-hero-row { grid-template-columns:1fr; }
        }

        .wc-hero2 {
          position:relative;
          min-height:460px;
          padding:40px;
          display:flex;
          flex-direction:column;
          justify-content:flex-end;
          background:linear-gradient(180deg, rgba(5,7,8,.25) 0%, rgba(5,7,8,.92) 100%);
        }

        .wc-hero2-eyebrow {
          position:absolute;
          top:36px;
          left:40px;
          display:flex;
          align-items:center;
          gap:8px;
          color:var(--lime);
          font-size:11px;
          font-weight:800;
          letter-spacing:.16em;
          text-transform:uppercase;
        }

        .wc-hero2-grid {
          display:flex;
          justify-content:space-between;
          align-items:flex-end;
          gap:40px;
          flex-wrap:wrap;
        }

        .wc-hero2-title {
          font-family:"Barlow Condensed";
          font-size:64px;
          line-height:.92;
          font-weight:900;
          text-transform:uppercase;
          letter-spacing:-1px;
          margin:0 0 14px;
        }

        .wc-hero2-sub {
          color:#c8ced5;
          max-width:420px;
          font-size:15px;
          line-height:1.5;
          margin:0 0 22px;
        }

        .wc-hero2-actions {
          display:flex;
          gap:12px;
        }

        .wc-btn-primary {
          display:flex;
          align-items:center;
          gap:8px;
          background:var(--lime);
          border:none;
          color:#050708;
          font-weight:800;
          font-size:13px;
          letter-spacing:.03em;
          text-transform:uppercase;
          padding:13px 22px;
          border-radius:10px;
          cursor:pointer;
        }

        .wc-btn-outline {
          background:rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.18);
          color:#fff;
          font-weight:700;
          font-size:13px;
          letter-spacing:.03em;
          text-transform:uppercase;
          padding:13px 22px;
          border-radius:10px;
          cursor:pointer;
        }

        .wc-hero2-card {
          flex:none;
          width:340px;
          background:rgba(255,255,255,.07);
          border:1px solid rgba(255,255,255,.16);
          border-radius:18px;
          padding:22px;
          -webkit-backdrop-filter:blur(20px) saturate(160%);
          backdrop-filter:blur(20px) saturate(160%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.14),
            0 20px 40px rgba(0,0,0,.35);
        }

        .wc-hero2-badge {
          display:inline-flex;
          align-items:center;
          gap:6px;
          font-size:10px;
          font-weight:800;
          letter-spacing:.1em;
          text-transform:uppercase;
          color:var(--lime);
          margin-bottom:16px;
        }

        .wc-hero2-card-match {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
        }

        .wc-hero2-card-team {
          flex:1;
          text-align:center;
          display:flex;
          flex-direction:column;
          align-items:center;
          gap:8px;
        }

        .wc-hero2-card-team span { font-size:38px; }

        .wc-hero2-card-team strong {
          font-family:"Barlow Condensed";
          font-size:15px;
          text-transform:uppercase;
        }

        .wc-hero2-card-score {
          flex:none;
          font-family:"Barlow Condensed";
          font-size:88px;
          font-weight:450;
          color:var(--lime);
          padding:0 6px;
        }

        .wc-hero2-card-moment {
          margin-top:18px;
          padding-top:16px;
          border-top:1px solid var(--border);
          font-size:13px;
          font-weight:700;
          color:#fff;
          text-align:center;
        }

        .wc-hero2-card-moment span {
          display:block;
          margin-top:4px;
          color:var(--muted);
          font-size:11px;
          font-weight:600;
          text-transform:uppercase;
          letter-spacing:.06em;
        }

        .wc-hero2-dots {
          display:flex;
          gap:6px;
          margin-top:26px;
        }

        .wc-hero2-dot {
          width:6px;
          height:6px;
          border-radius:50%;
          background:rgba(255,255,255,.25);
        }

        .wc-hero2-dot.active {
          width:20px;
          border-radius:4px;
          background:var(--lime);
        }

        /* ============ CARD BASE ============ */

        .wc-card {
          position:relative;
          background:linear-gradient(145deg, rgba(255,255,255,.14), rgba(255,255,255,.05));
          -webkit-backdrop-filter:blur(24px) saturate(180%);
          backdrop-filter:blur(24px) saturate(180%);
          border:1px solid rgba(255,255,255,.18);
          border-radius:20px;
          padding:14px;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.16),
            0 20px 40px rgba(0,0,0,.3);
          transition:transform .25s ease, border-color .25s ease, box-shadow .25s ease;
        }

        .wc-card:hover {
          transform:translateY(-3px);
          border-color:rgba(151,204,13,.25);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.12),
            0 24px 48px rgba(0,0,0,.4);
        }

        .wc-card-title {
          font-size:13px;
          color:#c8ced5;
          letter-spacing:.15em;
          text-transform:uppercase;
          font-weight:800;
          margin-bottom:12px;
        }

        /* ============ SNAPSHOT CARD ============ */

        .wc-snapshot-card {
          display:flex;
          flex-direction:column;
        }

        .wc-snapshot-grid {
          display:grid;
          grid-template-columns:1fr 1fr 1fr;
          gap:7px;
        }

        .wc-snap-cell {
          background:rgba(255,255,255,.04);
          border:1px solid var(--border);
          border-radius:14px;
          padding:8px;
        }

        .wc-snap-cell strong {
          display:block;
          font-family:"Barlow Condensed";
          font-size:32px;
          font-weight:450;
          line-height:1;
        }

        .wc-snap-cell span {
          display:block;
          margin-top:6px;
          font-size:10.5px;
          text-transform:uppercase;
          letter-spacing:.08em;
          color:var(--muted);
        }

        .wc-snap-cell.wide {
          display:flex;
          align-items:center;
          gap:10px;
        }

        .wc-snap-cell.wide img,
        .wc-snap-cell.wide .wc-snap-avatar {
          width:34px;
          height:34px;
          border-radius:50%;
          object-fit:cover;
          flex:none;
        }

        .wc-snap-cell.wide strong {
          font-size:14px;
          font-family:"Barlow",sans-serif;
          font-weight:800;
        }

        .wc-snapshot-hosts {
          margin-top:10px;
          padding-top:10px;
          border-top:1px solid var(--border);
          display:flex;
          flex-wrap:wrap;
          gap:8px;
        }

        .wc-snapshot-host-chip {
          display:flex;
          align-items:center;
          gap:6px;
          background:rgba(255,255,255,.04);
          border:1px solid var(--border);
          border-radius:20px;
          padding:6px 16px;
          font-size:12px;
          font-weight:700;
          color:#d8dde2;
        }

        .wc-snapshot-host-crest {
          display:flex;
          align-items:center;
          justify-content:center;
          width:16px;
          height:16px;
          flex:none;
        }

        .wc-snapshot-host-crest img { width:100%; height:100%; object-fit:contain; display:block; }
        .wc-snapshot-host-crest .api-team-logo-fallback { font-size:9px; font-weight:800; letter-spacing:.02em; }

        .wc-snapshot-card .wc2-explore-btn {
          margin-top:18px;
        }

        /* ============ MID ROW ============ */

        .wc-mid-row {
          display:grid;
          grid-template-columns:2.6fr 1.6fr 1fr;
          gap:22px;
          margin-top:22px;
          align-items:start;
        }

        .wc-mid-row > * { min-width:0; }

        @media(max-width:1100px){
          .wc-mid-row { grid-template-columns:1fr; }
        }

        /* ============ MATCH INTELLIGENCE ============ */

        .wc-intel-top {
          display:flex;
          align-items:center;
          justify-content:space-between;
          margin-bottom:12px;
          flex-wrap:wrap;
          gap:7px;
        }

        .wc-intel-score-chip {
          display:flex;
          align-items:center;
          gap:6px;
          background:rgba(151,204,13,.12);
          border:1px solid rgba(151,204,13,.3);
          color:var(--lime);
          font-family:"Barlow Condensed";
          font-size:16px;
          font-weight:800;
          padding:4px 14px;
          border-radius:20px;
        }

        .wc-intel-score-chip small {
          font-family:"Barlow",sans-serif;
          color:var(--muted);
          font-size:10px;
          font-weight:700;
          text-transform:uppercase;
          margin-left:4px;
        }

        .wc-intel-tabs {
          display:flex;
          gap:4px;
          border-bottom:1px solid var(--border);
          margin-bottom:13px;
          overflow-x:auto;
        }

        .wc-intel-tab {
          background:none;
          border:none;
          color:var(--muted);
          font-size:12px;
          font-weight:800;
          letter-spacing:.06em;
          text-transform:uppercase;
          padding:6px 4px;
          margin-right:22px;
          cursor:pointer;
          border-bottom:2px solid transparent;
          white-space:nowrap;
        }

        .wc-intel-tab.active {
          color:var(--lime);
          border-bottom-color:var(--lime);
        }

        .wc-ov-grid {
          display:grid;
          grid-template-columns:1fr 260px;
          gap:24px;
          align-items:start;
        }

        .wc-ov-grid > * { min-width:0; }

        @media(max-width:900px){
          .wc-ov-grid { grid-template-columns:1fr; }
        }

        .wc-ov-main {
          display:flex;
          flex-direction:column;
          gap:11px;
        }

        .wc-ov-stats {
          background:rgba(255,255,255,.04);
          border:1px solid var(--border);
          border-radius:12px;
          padding:2px 16px;
        }

        .wc-ov-statline {
          display:flex;
          align-items:center;
          gap:14px;
          padding:7px 0;
          border-bottom:1px solid var(--border);
        }

        .wc-ov-statline:last-child { border-bottom:none; }

        .wc-ov-statline-val {
          font-family:"Barlow Condensed";
          font-size:22px;
          font-weight:800;
          width:56px;
          flex-shrink:0;
        }

        .wc-ov-statline-val.home { text-align:right; }
        .wc-ov-statline-val.away { text-align:left; }

        .wc-ov-statline-label {
          flex:1;
          text-align:center;
          font-size:10.5px;
          color:var(--muted);
          text-transform:uppercase;
          letter-spacing:.06em;
        }

        .wc-ov-teams {
          display:flex;
          flex-direction:column;
          gap:8px;
        }

        .wc-ov-team-row {
          display:flex;
          align-items:center;
          gap:10px;
          background:rgba(255,255,255,.04);
          border:1px solid var(--border);
          border-radius:12px;
          padding:7px 14px;
        }

        .wc-ov-flag { font-size:24px; }

        .wc-ov-team-row strong {
          flex:1;
          font-family:"Barlow Condensed";
          font-size:15px;
          text-transform:uppercase;
        }

        .wc-ov-team-row b {
          color:var(--lime);
          font-family:"Barlow Condensed";
          font-size:20px;
        }

        .wc-ov-stats {
          display:flex;
          flex-direction:column;
          justify-content:center;
        }

        .wc-key-insight {
          background:rgba(255,255,255,.04);
          border:1px solid var(--border);
          border-radius:14px;
          padding:11px 18px;
          display:flex;
          flex-direction:column;
          gap:7px;
        }

        .wc-key-insight-label {
          font-size:11px;
          color:var(--muted);
          text-transform:uppercase;
          letter-spacing:.1em;
        }

        .wc-key-insight-headline {
          font-size:15px;
          font-weight:800;
          line-height:1.4;
        }

        .wc-key-insight p {
          margin:0;
          color:#d8dde2;
          font-size:13px;
          line-height:1.6;
        }

        .wc-deep-dive {
          display:inline-flex;
          align-items:center;
          gap:6px;
          background:none;
          border:none;
          color:var(--lime);
          font-size:11px;
          font-weight:800;
          letter-spacing:.06em;
          text-transform:uppercase;
          cursor:pointer;
          padding:0;
        }

        .wc-data-row{
          display:grid;
          grid-template-columns:60px 1fr 110px 1fr 60px;
          gap:12px;
          align-items:center;
          margin-bottom:7px;
        }

        .wc-data-value{
          font-weight:800;
          font-family:"Barlow Condensed";
          font-size:20px;
        }

        .wc-data-value:last-child { text-align:right; }

        .wc-data-label{
          text-align:center;
          font-size:10.5px;
          text-transform:uppercase;
          color:var(--muted);
          letter-spacing:.04em;
        }

        .wc-data-track{
          height:6px;
          background:rgba(255,255,255,.08);
          border-radius:10px;
          overflow:hidden;
        }

        .wc-data-track div{
          height:100%;
          background:var(--lime);
        }

        .wc-data-track.away div{
          background:#ff8a3d;
        }

        .wc-momentum-frame {
          border-radius:14px;
          overflow:hidden;
          border:1px solid var(--border);
          background:#0d1114;
        }

        .wc-momentum-frame iframe { display:block; }

        .wc-timeline {
          margin-top:11px;
          display:flex;
          flex-direction:column;
          gap:5px;
        }

        .wc-timeline-row {
          display:flex;
          align-items:center;
          gap:10px;
          font-size:12.5px;
          color:#d8dde2;
        }

        .wc-timeline-min {
          color:var(--lime);
          font-family:"Barlow Condensed";
          font-weight:800;
          width:34px;
          flex:none;
        }

        .wc-tactical-text {
          margin:0 0 11px;
          color:#d8dde2;
          font-size:14px;
          line-height:1.7;
        }

        .wc-why-list {
          margin:0 0 13px;
          padding:0;
          list-style:none;
          display:flex;
          flex-direction:column;
          gap:6px;
        }

        .wc-why-list li {
          display:flex;
          gap:10px;
          color:#d8dde2;
          font-size:13px;
          line-height:1.5;
        }

        .wc-why-list li .wc-dot {
          width:7px;
          height:7px;
          border-radius:50%;
          background:var(--lime);
          margin-top:6px;
          flex:none;
        }

        .wc-formations {
          display:flex;
          gap:16px;
          margin-top:11px;
        }

        .wc-formation-col {
          flex:1;
          text-align:center;
        }

        .wc-formation-code {
          display:block;
          margin-top:6px;
          font-family:"Barlow Condensed";
          font-size:13px;
          font-weight:800;
        }

        .wc-pitch {
          position:relative;
          background:
            repeating-linear-gradient(180deg,#0e2a10,#0e2a10 13px,#0c250f 13px,#123312 26px),
            linear-gradient(180deg,#123815,#0d2a10);
          border:1px solid rgba(255,255,255,.14);
          border-radius:8px;
          height:58px;
          overflow:hidden;
        }

        .wc-pitch-markings {
          position:absolute;
          inset:0;
          width:100%;
          height:100%;
        }

        .wc-pitch-markings rect, .wc-pitch-markings circle {
          fill:none;
          stroke:rgba(255,255,255,.32);
          stroke-width:.6;
          vector-effect:non-scaling-stroke;
        }

        .wc-pitch-field {
          position:relative;
          z-index:1;
          display:flex;
          flex-direction:column-reverse;
          justify-content:space-between;
          height:100%;
          padding:10px 6px;
        }

        .wc-pitch-row {
          display:flex;
          justify-content:center;
          gap:6px;
        }

        .wc-pitch-dot {
          width:6px;
          height:6px;
          border-radius:50%;
          background:var(--lime);
          flex:none;
        }

        .wc-pitch-dot.away { background:#ff8a3d; }

        .wc-shots-grid {
          display:grid;
          grid-template-columns:1fr auto 1fr;
          gap:20px;
          align-items:center;
        }

        .wc-shots-side { text-align:right; }
        .wc-shots-side.away { text-align:left; }

        .wc-shots-big {
          font-family:"Barlow Condensed";
          font-size:44px;
          font-weight:900;
          line-height:1;
        }

        .wc-shots-label {
          font-size:10.5px;
          text-transform:uppercase;
          letter-spacing:.1em;
          color:var(--muted);
          margin-top:4px;
        }

        .wc-shots-vs {
          font-weight:900;
          color:var(--lime);
        }

        .wc-shots-bar {
          height:8px;
          background:rgba(255,255,255,.08);
          border-radius:20px;
          overflow:hidden;
          margin-top:24px;
        }

        .wc-shots-bar div {
          height:100%;
          background:var(--lime);
        }

        /* ============ STORY CARD ============ */

        .wc-story-card {
          padding:0;
          overflow:hidden;
          display:flex;
          flex-direction:column;
          background:#0b0d10;
          -webkit-backdrop-filter:none;
          backdrop-filter:none;
        }

        .wc-story-image {
          position:relative;
          height:114px;
          background:
            linear-gradient(180deg, rgba(5,7,8,0) 0%, rgba(5,7,8,.95) 100%),
            url("/assets/WC-overview-bg.png") center/cover no-repeat;
        }

        .wc-story-tag {
          position:absolute;
          top:16px;
          left:16px;
          background:rgba(5,7,8,.7);
          border:1px solid var(--border);
          color:var(--lime);
          font-size:10px;
          font-weight:800;
          letter-spacing:.1em;
          text-transform:uppercase;
          padding:6px 12px;
          border-radius:20px;
        }

        .wc-story-body {
          padding:13px;
          flex:1;
          display:flex;
          flex-direction:column;
        }

        .wc-story-title {
          margin:0 0 6px;
          font-family:"Barlow Condensed";
          font-size:26px;
          font-weight:900;
          line-height:1.05;
        }

        .wc-story-body p {
          margin:0 0 11px;
          color:#c8ced5;
          font-size:13.5px;
          line-height:1.6;
          flex:1;
        }

        /* ============ TOURNAMENT LEADERS ============ */

        .wc-leader-row {
          display:flex;
          align-items:center;
          gap:12px;
          padding:7px 0;
          border-bottom:1px solid var(--border);
        }

        .wc-leader-row:last-of-type { border-bottom:none; }

        .wc-leader-rank {
          width:26px;
          height:26px;
          border-radius:50%;
          display:flex;
          align-items:center;
          justify-content:center;
          font-weight:900;
          font-size:12px;
          flex:none;
        }

        .wc-leader-row .n { flex:1; min-width:0; }

        .wc-leader-row .n strong {
          display:block;
          font-size:14px;
        }

        .wc-leader-row .n span {
          display:block;
          color:var(--muted);
          font-size:11.5px;
          margin-top:1px;
        }

        .wc-leader-goals {
          text-align:center;
          flex:none;
        }

        .wc-leader-goals strong {
          display:block;
          color:var(--lime);
          font-family:"Barlow Condensed";
          font-size:20px;
        }

        .wc-leader-goals span {
          display:block;
          font-size:9px;
          text-transform:uppercase;
          color:var(--muted);
        }

        /* ============ HIGHLIGHTS (single bar, matches mockup) ============ */

        .wc-highlights-bar {
          margin-top:22px;
          display:flex;
          align-items:center;
          gap:20px;
          background:linear-gradient(145deg, rgba(255,255,255,.14), rgba(255,255,255,.05));
          -webkit-backdrop-filter:blur(24px) saturate(180%);
          backdrop-filter:blur(24px) saturate(180%);
          border:1px solid rgba(255,255,255,.18);
          border-radius:40px;
          padding:14px 24px;
        }

        .wc-highlights-label {
          flex:none;
          font-size:13px;
          color:#c8ced5;
          letter-spacing:.15em;
          text-transform:uppercase;
          font-weight:800;
        }

        .wc-highlights-track {
          flex:1;
          min-width:0;
          display:flex;
          align-items:center;
          gap:10px;
          overflow-x:auto;
          scroll-snap-type:x proximity;
          scrollbar-width:none;
        }

        .wc-highlights-track::-webkit-scrollbar { display:none; }

        .wc-highlight-connector {
          flex:none;
          width:20px;
          height:1px;
          background:var(--border);
        }

        .wc-highlight-node {
          flex:none;
          scroll-snap-align:start;
          display:flex;
          align-items:center;
          gap:8px;
          white-space:nowrap;
        }

        .wc-highlight-node-icon {
          flex:none;
          width:36px;
          height:36px;
          border-radius:50%;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:15px;
          background:rgba(255,255,255,.06);
          border:1px solid var(--border);
        }

        .wc-highlight-node.active .wc-highlight-node-icon {
          background:rgba(151,204,13,.14);
          border-color:rgba(151,204,13,.4);
        }

        .wc-highlight-node-text {
          display:flex;
          flex-direction:column;
          gap:2px;
        }

        .wc-highlight-node-text strong {
          font-family:"Barlow Condensed";
          font-size:13px;
          font-weight:800;
          line-height:1.1;
        }

        .wc-highlight-node-text span {
          font-size:10.5px;
          color:var(--muted);
        }

        .wc-highlights-nav {
          flex:none;
          display:flex;
          gap:8px;
        }

        .wc-highlights-arrow {
          width:32px;
          height:32px;
          border-radius:50%;
          background:rgba(255,255,255,.06);
          border:1px solid var(--border);
          color:#fff;
          display:flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
        }

        /* ============ DID YOU KNOW / FOUNDER (unchanged) ============ */

        .wc-fade-card { animation:wcFade .6s ease forwards; }

        .wc-founder-card {
          position:relative;
          padding:22px;
          border-radius:24px;
          overflow:hidden;
          background:linear-gradient(135deg, rgba(151,204,13,.18), rgba(255,255,255,.04));
          -webkit-backdrop-filter:blur(24px) saturate(180%);
          backdrop-filter:blur(24px) saturate(180%);
          border:1px solid rgba(151,204,13,.25);
        }

        .wc-founder-glow {
          position:absolute;
          width:280px;
          height:280px;
          right:-100px;
          top:-100px;
          border-radius:50%;
          background:rgba(151,204,13,.25);
          filter:blur(80px);
          animation:wcPulse 4s infinite alternate;
        }

        .wc-founder-button {
          display:flex;
          align-items:center;
          gap:10px;
          padding:10px 28px;
          border-radius:999px;
          border:none;
          background:var(--lime);
          color:#050708;
          font-weight:900;
          font-size:15px;
          cursor:pointer;
          transition:transform .2s ease, box-shadow .2s ease;
        }

        .wc-founder-button:hover {
          transform:translateY(-3px);
          box-shadow:0 15px 35px rgba(151,204,13,.25);
        }

        @keyframes wcFade {
          from { opacity:0; transform:translateY(20px); }
          to { opacity:1; transform:translateY(0); }
        }

        @keyframes wcPulse {
          from { transform:scale(1); }
          to { transform:scale(1.25); }
        }

        @media(max-width:900px){
          .wc-founder-card > div { flex-direction:column; align-items:flex-start!important; }
          .wc-founder-button { width:100%; justify-content:center; }
          .wc-card { padding:12px; }
        }

        @media(max-width:600px){
          .wc-hero2-title { font-size:42px; }
          .wc-overview-shell { padding:0 14px 14px; }
          .wc-founder-card h2 { font-size:28px; }
          .wc-hero2-grid { align-items:flex-start; }
          .wc-hero2-card { width:100%; }
        }
      `}</style>

      <div className="wc-overview-shell">

        {/* HERO ROW */}

        <section className="wc-hero-row">

          <div className="wc-hero2">

            <div className="wc-hero2-eyebrow">
              <Trophy size={14}/>
              <span>{WC_CONFIG.edition}</span>
            </div>

            <div className="wc-hero2-grid">

              <div>
                <h1 className="wc-hero2-title">
                  The World
                  <br/>
                  Is Watching
                </h1>

                <p className="wc-hero2-sub">
                  Follow every match, player and storyline from the biggest football
                  tournament ever held, powered by Calibre Intelligence.
                </p>

                <div className="wc-hero2-actions">
                  <button className="wc-btn-primary" onClick={() => navigateTo('/world-cup/matches')}>
                    <Play size={13} fill="#050708"/> Watch Live
                  </button>
                  <button className="wc-btn-outline" onClick={() => navigateTo('/world-cup/teams')}>
                    Explore World Cup
                  </button>
                </div>
              </div>

              <div className="wc-hero2-card">

                <div className="wc-hero2-badge">● Final</div>

                <div className="wc-hero2-card-match">
                  <div className="wc-hero2-card-team">
                    <span>{TEAM_FLAGS[featuredMatch.home] || '🏳️'}</span>
                    <strong>{featuredMatch.home}</strong>
                  </div>

                  <div className="wc-hero2-card-score">
                    {featuredMatch.homeScore}-{featuredMatch.awayScore}
                  </div>

                  <div className="wc-hero2-card-team">
                    <span>{TEAM_FLAGS[featuredMatch.away] || '🏳️'}</span>
                    <strong>{featuredMatch.away}</strong>
                  </div>
                </div>

                {featuredMatch.heroMoment && (
                  <div className="wc-hero2-card-moment">
                    {featuredMatch.heroMoment.minute}' {featuredMatch.heroMoment.scorer}
                    <span>{featuredMatch.heroMoment.tag}</span>
                  </div>
                )}

              </div>

            </div>

            <div className="wc-hero2-dots">
              {[0, 1, 2, 3, 4].map(i => (
                <span key={i} className={`wc-hero2-dot${i === 0 ? ' active' : ''}`} />
              ))}
            </div>

          </div>

          {/* TOURNAMENT SNAPSHOT */}

          <div className="wc-card wc-snapshot-card">

            <div className="wc-card-title">Tournament Snapshot</div>

            <div className="wc-snapshot-grid">

              <div className="wc-snap-cell">
                <strong>{TOURNAMENT_FORMAT.teams}</strong>
                <span>Teams</span>
              </div>

              <div className="wc-snap-cell">
                <strong>{TOURNAMENT_FORMAT.matches}</strong>
                <span>Matches</span>
              </div>

              <div className="wc-snap-cell">
                <strong>{TOURNAMENT_FORMAT.stadiums}</strong>
                <span>Stadiums</span>
              </div>

              <div className="wc-snap-cell">
                <strong>{isLive ? '—' : days}</strong>
                <span>{isLive ? 'Live Now' : 'Days To Go'}</span>
              </div>

              <div className="wc-snap-cell">
                <strong>{WC_CONFIG.hosts.length}</strong>
                <span>Host Nations</span>
              </div>

              <div className="wc-snap-cell wide">
                {topScorer ? (
                  <>
                    <ApiPlayerImage
                      playerId={topScorer.api_player_id}
                      name={topScorer.name}
                      fallbackSrc="/assets/players/neutral-player.svg"
                      className="wc-snap-avatar"
                    />
                    <div>
                      <span style={{ marginBottom: 2 }}>Top Scorer</span>
                      <strong>{topScorer.name}</strong>
                      <span>{topScorer.goals} Goals</span>
                    </div>
                  </>
                ) : (
                  <div>
                    <span>Top Scorer</span>
                    <strong style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
                      Populates once matches begin
                    </strong>
                  </div>
                )}
              </div>

            </div>

            <div className="wc-snapshot-hosts">
              {WC_CONFIG.hosts.map(h => (
                <div className="wc-snapshot-host-chip" key={h}>
                  <span className="wc-snapshot-host-crest">
                    <ApiTeamLogo
                      src={HOST_TEAM_IDS[h] ? teamLogoUrl(HOST_TEAM_IDS[h]) : ''}
                      name={h}
                      fallback={HOST_FLAGS[h] || ''}
                    />
                  </span>
                  {h}
                </div>
              ))}
            </div>

            <button
              className="wc2-explore-btn"
              onClick={() => navigateTo('/world-cup/teams')}
            >
              Explore Tournament <ArrowRight size={14}/>
            </button>

          </div>

        </section>

        {/* MID ROW — Match Intelligence / Story / Leaders */}

        <section className="wc-mid-row">

          {/* MATCH INTELLIGENCE */}

          <div className="wc-card">

            <div className="wc-intel-top">
              <div className="wc-card-title" style={{ margin: 0 }}>Match Intelligence</div>
              {featuredMatch.calibreRating?.score != null && (
                <div className="wc-intel-score-chip">
                  <Star size={13} fill="#97cc0d"/> {featuredMatch.calibreRating.score}
                  <small>Calibre Score</small>
                </div>
              )}
            </div>

            <div className="wc-intel-tabs">
              {INTEL_TABS.map(tab => (
                <button
                  key={tab.id}
                  className={`wc-intel-tab${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div className="wc-ov-grid">

                <div className="wc-ov-main">

                  <div className="wc-ov-teams">
                    <div className="wc-ov-team-row">
                      <span className="wc-ov-flag">{TEAM_FLAGS[featuredMatch.home] || '🏳️'}</span>
                      <strong>{featuredMatch.home}</strong>
                      <b>{xgRow?.home ?? '–'}</b>
                    </div>
                    <div className="wc-ov-team-row">
                      <span className="wc-ov-flag">{TEAM_FLAGS[featuredMatch.away] || '🏳️'}</span>
                      <strong>{featuredMatch.away}</strong>
                      <b>{xgRow?.away ?? '–'}</b>
                    </div>
                  </div>

                  <div className="wc-ov-stats">
                    {compactRows.map(row => (
                      <div className="wc-ov-statline" key={row.label}>
                        <span className="wc-ov-statline-val home">{row.home}{row.suffix}</span>
                        <span className="wc-ov-statline-label">{row.label}</span>
                        <span className="wc-ov-statline-val away">{row.away}{row.suffix}</span>
                      </div>
                    ))}
                  </div>

                </div>

                <div className="wc-key-insight">
                  <div className="wc-key-insight-label">Key Insight</div>
                  <div className="wc-key-insight-headline">
                    The winner controlled the moments that mattered.
                  </div>
                  <p>{featuredMatch.analysis}</p>
                  <button className="wc-deep-dive" onClick={() => navigateTo('/world-cup/stats')}>
                    Deep Dive <ArrowRight size={12}/>
                  </button>
                </div>

              </div>
            )}

            {activeTab === 'xg' && (
              <div>
                {allDominanceRows.filter(r => ['xG', 'Big Chances', 'Shots on Target', 'Total Shots'].includes(r.label)).length > 0 ? (
                  allDominanceRows.filter(r => ['xG', 'Big Chances', 'Shots on Target', 'Total Shots'].includes(r.label)).map(row => (
                    <DominanceBar key={row.label} {...row} />
                  ))
                ) : (
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                    xG data isn't available for this fixture.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'momentum' && (
              <div>
                {featuredMatch.sofascoreMatchId ? (
                  <div className="wc-momentum-frame">
                    <iframe
                      title="Match Momentum"
                      src={`https://widgets.sofascore.com/embed/attackMomentum?id=${featuredMatch.sofascoreMatchId}&widgetTheme=dark`}
                      width="100%"
                      height="150"
                      frameBorder="0"
                      scrolling="no"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                    Momentum data isn't available for this fixture.
                  </div>
                )}

                {timelineEvents.length > 0 && (
                  <div className="wc-timeline">
                    {timelineEvents.map((e, i) => (
                      <div className="wc-timeline-row" key={i}>
                        <span className="wc-timeline-min">
                          {e.time?.elapsed}{e.time?.extra ? `+${e.time.extra}` : ''}'
                        </span>
                        <span>{e.type === 'Goal' ? '⚽' : e.detail === 'Red Card' ? '🟥' : '🟨'}</span>
                        <span><strong>{e.player?.name}</strong> · {e.team?.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tactical' && (
              <div>
                <p className="wc-tactical-text">{featuredMatch.analysis}</p>

                {featuredMatch.whyItMattered?.length > 0 && (
                  <ul className="wc-why-list">
                    {featuredMatch.whyItMattered.map((line, i) => (
                      <li key={i}><div className="wc-dot"/>{line}</li>
                    ))}
                  </ul>
                )}

                {calibreInsightBullets.length > 0 && (
                  <ul className="wc-why-list">
                    {calibreInsightBullets.map((line, i) => (
                      <li key={i}><div className="wc-dot"/>{line}</li>
                    ))}
                  </ul>
                )}

                {(homeFormation || awayFormation) && (
                  <div className="wc-formations">
                    <div className="wc-formation-col">
                      <FormationPitch formation={homeFormation} side="home" />
                      {homeFormation && <strong className="wc-formation-code">{homeFormation}</strong>}
                    </div>
                    <div className="wc-formation-col">
                      <FormationPitch formation={awayFormation} side="away" />
                      {awayFormation && <strong className="wc-formation-code">{awayFormation}</strong>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'shots' && (
              shotBreakdown ? (
                <div>
                  <div className="wc-shots-grid">
                    <div className="wc-shots-side">
                      <div className="wc-shots-big">{shotBreakdown.home.shots}</div>
                      <div className="wc-shots-label">Shots · {shotBreakdown.home.onTarget} on target</div>
                    </div>
                    <div className="wc-shots-vs">VS</div>
                    <div className="wc-shots-side away">
                      <div className="wc-shots-big">{shotBreakdown.away.shots}</div>
                      <div className="wc-shots-label">Shots · {shotBreakdown.away.onTarget} on target</div>
                    </div>
                  </div>

                  <div className="wc-shots-bar">
                    <div style={{ width: `${(shotBreakdown.home.onTarget / ((shotBreakdown.home.shots) || 1)) * 100}%` }} />
                  </div>

                  <div style={{ marginTop: 26 }}>
                    {allDominanceRows.map(row => <DominanceBar key={row.label} {...row} />)}
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  Shot data isn't available for this fixture.
                </div>
              )
            )}

          </div>

          {/* STORY OF THE TOURNAMENT — no real editorial desk exists yet, so
              this headline/body is built from the same demo featuredMatch
              data already used across the rest of this page (hero card,
              highlights, etc.) rather than a separate generic placeholder —
              swap in a real editorial pipeline when one exists. */}

          <div className="wc-card wc-story-card">
            <div className="wc-story-image">
              <span className="wc-story-tag">Story of the Tournament</span>
            </div>
            <div className="wc-story-body">
              <h3 className="wc-story-title">The Rise of a New Dynasty?</h3>
              <p>
                {featuredMatch.home}'s control, composure and identity have made them
                the team to beat in {WC_CONFIG.year || '2026'}.
              </p>
              <button className="wc-deep-dive" onClick={() => navigateTo('/world-cup/history')}>
                Read The Full Story <ArrowRight size={12}/>
              </button>
            </div>
          </div>

          {/* TOURNAMENT LEADERS */}

          <div className="wc-card">

            <div className="wc-card-title">Tournament Leaders</div>

            {wcLeaders.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                Leaders populate once tournament matches begin.
              </div>
            ) : (
              wcLeaders.slice(0, 5).map((l, i) => (
                <div className="wc-leader-row" key={l.api_player_id}>
                  <div
                    className="wc-leader-rank"
                    style={{
                      background: i === 0 ? 'rgba(151,204,13,.18)' : 'rgba(255,255,255,.06)',
                      color: i === 0 ? 'var(--lime)' : 'var(--muted)',
                    }}
                  >
                    {i + 1}
                  </div>

                  <ApiPlayerImage
                    playerId={l.api_player_id}
                    name={l.name}
                    fallbackSrc="/assets/players/neutral-player.svg"
                    style={{ width: 40, height: 40, borderRadius: '50%' }}
                  />

                  <div className="n">
                    <strong>{l.name}</strong>
                    <span>{l.team}</span>
                  </div>

                  <div className="wc-leader-goals">
                    <strong>{l.goals ?? 0}</strong>
                    <span>Goals</span>
                  </div>
                </div>
              ))
            )}

            <button
              className="wc2-link"
              style={{ marginTop: 14 }}
              onClick={() => navigateTo('/world-cup/stats')}
            >
              View All Stats <ArrowRight size={13}/>
            </button>

          </div>

        </section>

        {/* TOURNAMENT HIGHLIGHTS — only "Most Dramatic" is backed by real
            data (the featured match). The rest have no source in
            worldCupData.js yet, so they're left as honest placeholders
            rather than invented stats attributed to real players. */}

        <section className="wc-highlights-bar">

          <div className="wc-highlights-label">Tournament Highlights</div>

          <div className="wc-highlights-track" ref={highlightsRef}>

            <div className="wc-highlight-node">
              <div className="wc-highlight-node-icon">⚡</div>
              <div className="wc-highlight-node-text">
                <strong>—</strong>
                <span>Fastest Goal · Coming soon</span>
              </div>
            </div>

            <div className="wc-highlight-connector" />

            <div className="wc-highlight-node">
              <div className="wc-highlight-node-icon">😱</div>
              <div className="wc-highlight-node-text">
                <strong>—</strong>
                <span>Biggest Upset · Coming soon</span>
              </div>
            </div>

            <div className="wc-highlight-connector" />

            <div className="wc-highlight-node active">
              <div className="wc-highlight-node-icon">🔥</div>
              <div className="wc-highlight-node-text">
                <strong>{featuredMatch.home} {featuredMatch.homeScore}-{featuredMatch.awayScore} {featuredMatch.away}</strong>
                <span>Most Dramatic · {featuredMatch.heroMoment ? `${featuredMatch.heroMoment.minute}' ${featuredMatch.heroMoment.scorer}` : featuredMatch.round}</span>
              </div>
            </div>

            <div className="wc-highlight-connector" />

            <div className="wc-highlight-node">
              <div className="wc-highlight-node-icon">📊</div>
              <div className="wc-highlight-node-text">
                <strong>—</strong>
                <span>Highest xG · Coming soon</span>
              </div>
            </div>

            <div className="wc-highlight-connector" />

            <div className="wc-highlight-node">
              <div className="wc-highlight-node-icon">🏟️</div>
              <div className="wc-highlight-node-text">
                <strong>—</strong>
                <span>Largest Crowd · Coming soon</span>
              </div>
            </div>

          </div>

          <div className="wc-highlights-nav">
            <button className="wc-highlights-arrow" onClick={() => scrollHighlights(-1)}>
              <ChevronLeft size={16}/>
            </button>
            <button className="wc-highlights-arrow" onClick={() => scrollHighlights(1)}>
              <ChevronRight size={16}/>
            </button>
          </div>

        </section>

        {/* DID YOU KNOW */}

        {factOfDay && (
          <section
            className="wc-card wc-fade-card"
            style={{ marginTop: 22, position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', top: -40, right: -40, fontSize: 140, opacity: .04 }}>
              🏆
            </div>

            <div className="wc-card-title">Did You Know</div>

            <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: 12, alignItems: 'center' }}>
              <div
                style={{
                  width: 42, height: 42, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, background: 'rgba(151,204,13,.12)', border: '1px solid rgba(151,204,13,.25)',
                }}
              >
                {factOfDay.emoji}
              </div>

              <p style={{ margin: 0, color: '#d8dde2', fontSize: 17, lineHeight: 1.7, maxWidth: 900 }}>
                {factOfDay.fact}
              </p>
            </div>

            <button
              className="wc2-link"
              style={{ marginTop: 14 }}
              onClick={() => navigateTo('/world-cup/history')}
            >
              Explore World Cup History <ArrowRight size={13}/>
            </button>
          </section>
        )}

        <PremierBetBanner source="worldcup" variant="bar" />

        {/* PREMIUM CTA */}

        <section className="wc-founder-card" style={{ marginTop: 22 }}>
          <div className="wc-founder-glow" />

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 30 }}>
            <div>
              <div className="wc-card-title">Calibre Founder Pass</div>

              <h2 style={{ margin: '0 0 6px', fontFamily: 'Barlow Condensed', fontSize: 36, fontWeight: 900 }}>
                Unlock the complete
                <br/>
                World Cup Intelligence Layer
              </h2>

              <p style={{ margin: 0, color: '#b0b7bf', maxWidth: 600, lineHeight: 1.6 }}>
                Get deeper player analysis, tactical breakdowns, scouting insights
                and the complete Calibre football intelligence experience.
              </p>
            </div>

            <button className="wc-founder-button" onClick={() => navigateTo('/pricing')}>
              Get Founder Pass <ArrowRight size={16}/>
            </button>
          </div>
        </section>

      </div>

    </div>
  );
}
