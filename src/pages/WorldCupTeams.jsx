import { useEffect, useMemo, useState } from 'react';
import { Search, LayoutGrid, List as ListIcon, X } from 'lucide-react';
import WorldCupNav from '../components/WorldCupNav.jsx';
import ApiTeamLogo from '../components/ApiTeamLogo.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import { navigateTo } from '../components/NavLink.jsx';
import { supabase, supabaseConfigured } from '../services/supabaseClient.js';
import { getGroupedStandings, getSquad, getFixturesByDate } from '../services/apiFootball.js';

const POSITION_ORDER = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'];
const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;
const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

// Genuine public categorization (which confederation each nation belongs to)
// — not performance data, so safe to hard-code, unlike a rating or strength
// score. Extend as more confirmed 2026 qualifiers are known.
const CONFEDERATION = {
  Brazil: 'CONMEBOL', Argentina: 'CONMEBOL', Uruguay: 'CONMEBOL', Colombia: 'CONMEBOL', Ecuador: 'CONMEBOL', Paraguay: 'CONMEBOL',
  France: 'UEFA', Spain: 'UEFA', England: 'UEFA', Germany: 'UEFA', Portugal: 'UEFA', Netherlands: 'UEFA', Italy: 'UEFA', Belgium: 'UEFA', Croatia: 'UEFA', Switzerland: 'UEFA', Norway: 'UEFA', Turkey: 'UEFA', Austria: 'UEFA', Scotland: 'UEFA',
  USA: 'CONCACAF', Mexico: 'CONCACAF', Canada: 'CONCACAF', Panama: 'CONCACAF', Jamaica: 'CONCACAF', Curacao: 'CONCACAF',
  Morocco: 'CAF', Senegal: 'CAF', Nigeria: 'CAF', Egypt: 'CAF', Tunisia: 'CAF', Algeria: 'CAF', Ghana: 'CAF', 'Ivory Coast': 'CAF', 'South Africa': 'CAF', 'Cape Verde': 'CAF',
  Japan: 'AFC', 'South Korea': 'AFC', Iran: 'AFC', Australia: 'AFC', 'Saudi Arabia': 'AFC', Qatar: 'AFC', Jordan: 'AFC', Uzbekistan: 'AFC',
  'New Zealand': 'OFC',
};
const CONFEDERATIONS = ['All', 'UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'];
const SORTS = [
  { key: 'points', label: 'Sort: Points' },
  { key: 'name', label: 'Sort: Name' },
  { key: 'group', label: 'Sort: Group' },
];
const NATION_ALIASES = { usa: ['usa', 'united states'], uk: ['england', 'united kingdom'] };
const normName = (x) => String(x || '').trim().toLowerCase();

export default function WorldCupTeams() {
  // Real grouped standings — same source the old separate Groups page used
  // (API-Football's /standings response, one array per group).
  const [groups, setGroups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getGroupedStandings(WC_LEAGUE_ID, WC_SEASON);
        const flat = Array.isArray(data?.[0]) ? data : (Array.isArray(data) ? [data] : null);
        if (alive) setGroups(flat);
      } catch { if (alive) setLoadError(true); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  // Real elimination status — the same wc_teams Supabase table the Players
  // to Watch page uses, derived server-side from actual finished fixtures
  // (see scripts/fetchWcLeaders.mjs). This is authoritative for knockout-
  // stage exits too, not just the group stage, so it takes priority over
  // the group-stage-only estimate computed below.
  const [wcTeams, setWcTeams] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabaseConfigured || !supabase) return;
      const { data, error } = await supabase.from('wc_teams').select('*');
      if (!error && alive) setWcTeams(data || []);
    })();
    return () => { alive = false; };
  }, []);
  const eliminatedSet = useMemo(() => new Set(wcTeams.filter(t => t.eliminated).map(t => normName(t.team_name))), [wcTeams]);
  const isKnownEliminated = (name) => {
    const n = normName(name);
    return (NATION_ALIASES[n] || [n]).some(a => eliminatedSet.has(a));
  };

  // Real upcoming fixtures for the side panel next to a single group's table.
  const [upcoming, setUpcoming] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const days = [0, 1, 2, 3, 4, 5, 6].map(i => new Date(Date.now() + i * 86400000).toISOString().slice(0, 10));
        const results = await Promise.all(days.map(d => getFixturesByDate(d).catch(() => [])));
        const wc = results.flat().filter(f => f?.league?.id === WC_LEAGUE_ID).slice(0, 6);
        if (alive) setUpcoming(wc);
      } catch { /* optional panel */ }
    })();
    return () => { alive = false; };
  }, []);

  // Group-stage qualification status, computed only from real standings —
  // never guessed ahead of the actual results. Top-2 in a group is safe to
  // mark "Qualified" as soon as that specific group has finished (every team
  // played 3) since it doesn't depend on any other group. 3rd place needs
  // the 8-best-thirds comparison, which only means something once every
  // group has finished — until then those rows get no badge rather than a
  // premature one. There's no group-stage play-off round in this format
  // (top 2 automatic + 8 best thirds go straight to the Round of 32, per the
  // real published 2026 format), so unlike some tournaments there's no "P"
  // status to show here.
  const groupStageStatus = useMemo(() => {
    const out = new Map(); // team name -> 'qualified' | 'eliminated'
    if (!groups) return out;
    const isGroupFinal = (g) => g.every(row => (row.all?.played ?? 0) >= 3);
    groups.forEach(g => {
      if (!isGroupFinal(g)) return;
      g.forEach((row, i) => {
        const rank = row.rank ?? i + 1;
        if (rank <= 2) out.set(row.team?.name, 'qualified');
        else if (rank === 4) out.set(row.team?.name, 'eliminated');
      });
    });
    const allFinal = groups.every(isGroupFinal);
    if (allFinal) {
      const thirds = groups.map(g => g.find((row, i) => (row.rank ?? i + 1) === 3)).filter(Boolean);
      const sorted = [...thirds].sort((a, b) => (b.points - a.points) || (b.goalsDiff - a.goalsDiff) || ((b.all?.goals?.for ?? 0) - (a.all?.goals?.for ?? 0)));
      sorted.forEach((row, i) => out.set(row.team?.name, i < 8 ? 'qualified' : 'eliminated'));
    }
    return out;
  }, [groups]);

  function statusFor(teamName) {
    if (isKnownEliminated(teamName)) return 'eliminated';
    return groupStageStatus.get(teamName) || null;
  }

  // Flatten every group's rows into one team list — the only place the list
  // of 48 teams comes from, no static/fabricated roster.
  const teams = useMemo(() => {
    if (!groups) return [];
    const out = [];
    groups.forEach((g, gi) => {
      (g || []).forEach(row => {
        out.push({
          id: row.team?.id, name: row.team?.name, logo: row.team?.logo,
          group: GROUP_LETTERS[gi] || '?',
          confederation: CONFEDERATION[row.team?.name] || null,
          played: row.all?.played, win: row.all?.win, draw: row.all?.draw, lose: row.all?.lose,
          points: row.points, gd: row.goalsDiff,
          status: statusFor(row.team?.name),
        });
      });
    });
    return out;
  }, [groups, groupStageStatus, wcTeams]);

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('All');
  const [confFilter, setConfFilter] = useState('All');
  const [sortBy, setSortBy] = useState('points');
  const [view, setView] = useState('grid');
  const [activeGroup, setActiveGroup] = useState('All');

  const filtered = useMemo(() => {
    let list = teams.filter(t =>
      (groupFilter === 'All' || t.group === groupFilter) &&
      (confFilter === 'All' || t.confederation === confFilter) &&
      (search.trim() === '' || t.name?.toLowerCase().includes(search.trim().toLowerCase()))
    );
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'group') return (a.group || '').localeCompare(b.group || '') || (b.points ?? 0) - (a.points ?? 0);
      return (b.points ?? -1) - (a.points ?? -1);
    });
    return list;
  }, [teams, groupFilter, confFilter, search, sortBy]);

  // Real tournament top scorers — same wc_leaders source the Overview page
  // uses, capped short here too.
  const [wcLeaders, setWcLeaders] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabaseConfigured || !supabase) return;
      const { data, error } = await supabase.from('wc_leaders').select('*')
        .order('goals', { ascending: false }).order('assists', { ascending: false }).limit(5);
      if (!error && alive) setWcLeaders(data || []);
    })();
    return () => { alive = false; };
  }, []);

  // Squad viewer — real roster from API-Football's /players/squads, fetched
  // on demand per team.
  const [squadFor, setSquadFor] = useState(null);
  const [squad, setSquad] = useState(null);
  const [squadLoading, setSquadLoading] = useState(false);
  const [squadError, setSquadError] = useState(false);
  async function openSquad(team) {
    setSquadFor(team); setSquad(null); setSquadError(false); setSquadLoading(true);
    try {
      const players = await getSquad(team.id);
      setSquad(players);
      if (!players) setSquadError(true);
    } catch { setSquadError(true); }
    finally { setSquadLoading(false); }
  }
  function closeSquad() { setSquadFor(null); setSquad(null); setSquadError(false); }
  const squadByPosition = useMemo(() => {
    if (!squad) return [];
    const map = new Map();
    squad.forEach(p => { const pos = p.position || 'Unknown'; if (!map.has(pos)) map.set(pos, []); map.get(pos).push(p); });
    const known = POSITION_ORDER.filter(p => map.has(p)).map(p => [p, map.get(p)]);
    const rest = [...map.entries()].filter(([p]) => !POSITION_ORDER.includes(p));
    return [...known, ...rest];
  }, [squad]);

  const groupIndex = activeGroup === 'All' ? null : GROUP_LETTERS.indexOf(activeGroup);
  const singleGroup = groupIndex != null ? groups?.[groupIndex] : null;

  function statusBadge(name) {
    const s = statusFor(name);
    if (s === 'qualified') return <span className="wct-tag q">Q</span>;
    if (s === 'eliminated') return <span className="wct-tag e">E</span>;
    return null;
  }

  return (
    <div className="page wc2">
      <style>{`
        .wc2 { --l:#97cc0d; --line:#1c1c1c; --muted:#888; color:#fff; }
        .wc2 * { box-sizing:border-box; }
        .wc2-title { margin:4px 0 18px; }
        .wc2-title h1 { margin:0 0 6px; font:800 34px "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .wc2-title p { margin:0; color:var(--muted); font:500 13px "Barlow",sans-serif; }
        .wc2-card { background:#0f0f0f; border:1px solid var(--line); border-radius:12px; padding:18px; margin-bottom:16px; }
        .wc2-card h3 { margin:0 0 12px; font:800 13px "Barlow Condensed",sans-serif; letter-spacing:.08em; text-transform:uppercase; color:var(--l); }
        .wct-leaders { display:flex; gap:10px; overflow-x:auto; padding-bottom:2px; }
        .wct-leader { flex:none; width:150px; background:#141414; border:1px solid var(--line); border-radius:10px; padding:10px; text-align:center; }
        .wct-leader img { width:44px; height:44px; border-radius:50%; object-fit:cover; object-position:top; margin:0 auto 6px; }
        .wct-leader strong { display:block; font:700 12px "Barlow",sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .wct-leader span { color:var(--muted); font:600 10px "Barlow",sans-serif; }
        .wct-leader b { display:block; margin-top:4px; color:var(--l); font:800 16px "Barlow Condensed",sans-serif; }
        .wcg-grouptabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; }
        .wcg-grouptabs button { background:#0f0f0f; border:1px solid var(--line); color:#888; font:800 11px "Barlow Condensed",sans-serif; letter-spacing:.04em; padding:8px 13px; border-radius:8px; cursor:pointer; }
        .wcg-grouptabs button.on { background:var(--l); color:#0a0a0a; border-color:var(--l); }
        .wcg-legend { display:flex; gap:16px; align-items:center; margin-bottom:14px; flex-wrap:wrap; }
        .wcg-legend span { display:flex; align-items:center; gap:6px; color:var(--muted); font:600 10.5px "Barlow",sans-serif; text-transform:uppercase; }
        .wcg-legend i { width:9px; height:9px; border-radius:2px; display:inline-block; }
        .wcg-legend i.q { background:var(--l); }
        .wcg-legend i.e { background:#ef4444; }
        .wcg-allgrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; }
        .wcg-minitable { width:100%; border-collapse:collapse; }
        .wcg-minitable th { text-align:left; padding:6px 4px; color:var(--muted); font:700 8.5px "Barlow",sans-serif; letter-spacing:.05em; text-transform:uppercase; border-bottom:1px solid var(--line); }
        .wcg-minitable th.num, .wcg-minitable td.num { text-align:center; }
        .wcg-minitable td { padding:6px 4px; border-bottom:1px solid #161616; font:600 11.5px "Barlow",sans-serif; }
        .wcg-minitable tr:last-child td { border-bottom:none; }
        .wcg-miniteam { display:flex; align-items:center; gap:6px; }
        .wcg-miniteam img { width:16px; height:16px; object-fit:contain; }
        .wct-tag { display:inline-flex; width:16px; height:16px; align-items:center; justify-content:center; border-radius:3px; font:800 8.5px "Barlow Condensed",sans-serif; margin-left:4px; }
        .wct-tag.q { background:rgba(151,204,13,.18); color:var(--l); }
        .wct-tag.e { background:rgba(239,68,68,.16); color:#ef4444; }
        .wcg-layout { display:grid; grid-template-columns:1fr 300px; gap:18px; align-items:start; }
        @media(max-width:900px){ .wcg-layout { grid-template-columns:1fr; } }
        .wcg-table { width:100%; border-collapse:collapse; background:#0f0f0f; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
        .wcg-table th { text-align:left; padding:10px 12px; color:var(--muted); font:700 9.5px "Barlow",sans-serif; letter-spacing:.06em; text-transform:uppercase; border-bottom:1px solid var(--line); }
        .wcg-table th.num, .wcg-table td.num { text-align:center; }
        .wcg-table td { padding:9px 12px; border-bottom:1px solid #161616; font:600 12.5px "Barlow",sans-serif; }
        .wcg-table tr:last-child td { border-bottom:none; }
        .wcg-team { display:flex; align-items:center; gap:8px; }
        .wcg-team img { width:20px; height:20px; object-fit:contain; }
        .wcg-pts { color:var(--l); font-weight:800; }
        .wcg-fixture { display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--line); font:600 12px "Barlow",sans-serif; }
        .wcg-fixture:last-child { border-bottom:none; }
        .wcg-scenarios { color:#ccc; font:500 12.5px/1.7 "Barlow",sans-serif; margin:0; padding-left:18px; }
        .wcg-scenarios li { margin-bottom:6px; }
        .wct-toolbar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin:22px 0 16px; }
        .wct-search { display:flex; align-items:center; gap:8px; background:#0f0f0f; border:1px solid var(--line); border-radius:8px; padding:9px 12px; flex:1; min-width:180px; }
        .wct-search input { background:none; border:none; outline:none; color:#fff; font:600 12px "Barlow",sans-serif; width:100%; }
        .wct-search svg { color:var(--muted); flex:none; }
        .wct-filters select { background:#0f0f0f; border:1px solid var(--line); color:#ddd; font:600 12px "Barlow",sans-serif; padding:9px 12px; border-radius:8px; cursor:pointer; }
        .wct-viewtoggle { display:flex; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
        .wct-viewtoggle button { background:#0f0f0f; border:none; color:#888; padding:9px 10px; cursor:pointer; display:flex; }
        .wct-viewtoggle button.on { background:var(--l); color:#0a0a0a; }
        .wct-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:12px; }
        .wct-card { position:relative; background:#0f0f0f; border:1px solid var(--line); border-radius:12px; padding:16px; }
        .wct-rank { position:absolute; top:14px; right:14px; color:#333; font:800 20px "Barlow Condensed",sans-serif; }
        .wct-top { display:flex; align-items:center; gap:12px; margin-bottom:14px; padding-right:22px; }
        .wct-crest { width:44px; height:44px; object-contain; }
        .wct-top img { width:44px; height:44px; object-fit:contain; }
        .wct-top strong { display:flex; align-items:center; font:800 16px "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .wct-top span { color:var(--muted); font:600 10px "Barlow",sans-serif; text-transform:uppercase; }
        .wct-hero { margin-bottom:8px; }
        .wct-hero b { display:block; font:800 34px "Barlow Condensed",sans-serif; color:var(--l); line-height:1; }
        .wct-hero span { color:var(--muted); font:700 9px "Barlow",sans-serif; letter-spacing:.06em; text-transform:uppercase; }
        .wct-pills { display:flex; gap:3px; margin-bottom:12px; flex-wrap:wrap; }
        .wct-pills i { width:8px; height:8px; border-radius:50%; display:block; }
        .wct-pills i.w { background:var(--l); }
        .wct-pills i.d { background:#555; }
        .wct-pills i.l { background:#ef4444; }
        .wct-record { display:flex; gap:16px; margin-bottom:12px; padding-top:10px; border-top:1px solid var(--line); }
        .wct-record div b { display:block; font:800 15px "Barlow Condensed",sans-serif; }
        .wct-record div span { color:var(--muted); font:600 8.5px "Barlow",sans-serif; text-transform:uppercase; }
        .wct-btnrow { display:flex; gap:8px; }
        .wct-btn { flex:1; width:100%; background:none; border:1px solid var(--line); color:var(--l); font:700 10.5px "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; padding:8px; border-radius:7px; cursor:pointer; }
        .wct-btn:hover { border-color:var(--l); }
        .wct-empty { color:var(--muted); font:500 13px/1.6 "Barlow",sans-serif; text-align:center; padding:60px 0; }
        .wct-listtable { width:100%; border-collapse:collapse; background:#0f0f0f; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
        .wct-listtable th { text-align:left; padding:10px 12px; color:var(--muted); font:700 9.5px "Barlow",sans-serif; letter-spacing:.06em; text-transform:uppercase; border-bottom:1px solid var(--line); }
        .wct-listtable th.num, .wct-listtable td.num { text-align:center; }
        .wct-listtable td { padding:9px 12px; border-bottom:1px solid #161616; font:600 12.5px "Barlow",sans-serif; }
        .wct-listtable tr:last-child td { border-bottom:none; }
        .wct-listtable button { background:none; border:1px solid var(--line); color:var(--l); font:700 10px "Barlow Condensed",sans-serif; letter-spacing:.05em; text-transform:uppercase; padding:6px 10px; border-radius:6px; cursor:pointer; }
        .wct-modal-backdrop { position:fixed; inset:0; z-index:60; background:rgba(0,0,0,.65); display:flex; align-items:flex-start; justify-content:center; padding:5vh 16px; overflow-y:auto; }
        .wct-modal { width:100%; max-width:560px; background:#0d0d0d; border:1px solid var(--line); border-radius:14px; padding:20px; }
        .wct-modal-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
        .wct-modal-id { display:flex; align-items:center; gap:10px; }
        .wct-modal-id img { width:30px; height:30px; object-fit:contain; }
        .wct-modal-id strong { font:800 18px "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .wct-modal-close { background:none; border:1px solid var(--line); color:#ccc; border-radius:8px; width:32px; height:32px; display:grid; place-items:center; cursor:pointer; }
        .wct-modal-close:hover { border-color:var(--l); color:var(--l); }
        .wct-squad { display:grid; gap:16px; max-height:65vh; overflow-y:auto; }
        .wct-squad-group h4 { margin:0 0 8px; color:var(--l); font:800 11px "Barlow Condensed",sans-serif; letter-spacing:.08em; text-transform:uppercase; }
        .wct-squad-list { display:grid; gap:2px; }
        .wct-squad-row { display:flex; align-items:center; gap:10px; padding:7px 4px; border-bottom:1px solid #161616; }
        .wct-squad-row img { width:28px; height:28px; border-radius:50%; object-fit:cover; object-position:top; flex:none; }
        .wct-squad-name { flex:1; font:600 13px "Barlow",sans-serif; }
        .wct-squad-num { color:var(--muted); font:700 11px "Barlow Condensed",sans-serif; width:32px; text-align:right; }
        .wct-squad-age { color:var(--muted); font:600 11px "Barlow",sans-serif; width:32px; text-align:right; }
      `}</style>

      <WorldCupNav active="teams" />

      <div className="wc2-title">
        <h1>Teams</h1>
        <p>All 48 nations at the 2026 World Cup.</p>
      </div>

      {wcLeaders.length > 0 && (
        <div className="wc2-card">
          <h3>Tournament Top Scorers</h3>
          <div className="wct-leaders">
            {wcLeaders.map(l => (
              <div className="wct-leader" key={l.api_player_id}>
                <ApiPlayerImage playerId={l.api_player_id} name={l.name} fallbackSrc="/assets/players/neutral-player.svg" alt={l.name} />
                <strong>{l.name}</strong>
                <span>{l.team}</span>
                <b>{l.goals ?? 0}G</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="wc2-card">
        <h3>Group Standings</h3>
        <div className="wcg-grouptabs">
          <button className={activeGroup === 'All' ? 'on' : ''} onClick={() => setActiveGroup('All')}>All Groups</button>
          {GROUP_LETTERS.map(l => <button key={l} className={activeGroup === l ? 'on' : ''} onClick={() => setActiveGroup(l)}>Group {l}</button>)}
        </div>
        <div className="wcg-legend">
          <span><i className="q" /> Qualified</span>
          <span><i className="e" /> Eliminated</span>
        </div>

        {loading ? (
          <div className="wct-empty">Loading group standings…</div>
        ) : loadError || !groups ? (
          <div className="wct-empty">Group standings will appear here once the World Cup group stage is live and the standings feed is connected.</div>
        ) : activeGroup === 'All' ? (
          <div className="wcg-allgrid">
            {groups.map((g, gi) => (
              <div key={GROUP_LETTERS[gi] || gi}>
                <span className="wc2-eyebrow-sm" style={{ display: 'block', marginBottom: 6, color: 'var(--l)', font: '700 10px Barlow, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase' }}>Group {GROUP_LETTERS[gi]}</span>
                <table className="wcg-minitable">
                  <thead><tr><th>Team</th><th className="num">P</th><th className="num">GD</th><th className="num">Pts</th></tr></thead>
                  <tbody>
                    {(g || []).map((row, i) => (
                      <tr key={row.team?.id || i}>
                        <td><div className="wcg-miniteam"><ApiTeamLogo src={row.team?.logo} name={row.team?.name} /><span>{row.team?.name}</span>{statusBadge(row.team?.name)}</div></td>
                        <td className="num">{row.all?.played ?? '—'}</td>
                        <td className="num">{row.goalsDiff ?? '—'}</td>
                        <td className="num wcg-pts">{row.points ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          <div className="wcg-layout">
            <div>
              {!singleGroup || singleGroup.length === 0 ? (
                <div className="wct-empty">Group {activeGroup} standings will appear here once the World Cup group stage is live.</div>
              ) : (
                <table className="wcg-table">
                  <thead><tr><th>#</th><th>Team</th><th className="num">P</th><th className="num">W</th><th className="num">D</th><th className="num">L</th><th className="num">GD</th><th className="num">Pts</th></tr></thead>
                  <tbody>
                    {singleGroup.map((row, i) => (
                      <tr key={row.team?.id || i}>
                        <td>{row.rank ?? i + 1}</td>
                        <td><div className="wcg-team"><ApiTeamLogo src={row.team?.logo} name={row.team?.name} /><span>{row.team?.name}</span>{statusBadge(row.team?.name)}</div></td>
                        <td className="num">{row.all?.played ?? '—'}</td>
                        <td className="num">{row.all?.win ?? '—'}</td>
                        <td className="num">{row.all?.draw ?? '—'}</td>
                        <td className="num">{row.all?.lose ?? '—'}</td>
                        <td className="num">{row.goalsDiff ?? '—'}</td>
                        <td className="num wcg-pts">{row.points ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <div className="wc2-card">
                <h3>Next Fixtures</h3>
                {upcoming.length === 0 ? <p style={{ color: '#666', fontSize: 12 }}>No fixtures in the next week.</p> : upcoming.map(f => (
                  <div className="wcg-fixture" key={f.fixture?.id}>
                    <span>{f.teams?.home?.name} vs {f.teams?.away?.name}</span>
                    <span style={{ color: '#666' }}>{new Date(f.fixture?.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  </div>
                ))}
              </div>
              <div className="wc2-card">
                <h3>Advancement Scenarios</h3>
                <ul className="wcg-scenarios">
                  <li>Top 2 teams in each group qualify automatically for the Round of 32.</li>
                  <li>The 8 best third-place finishers across all 12 groups also advance.</li>
                  <li>Ties are broken by head-to-head result, then goal difference, then goals scored.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="wct-toolbar">
        <div className="wct-search"><Search size={14} /><input placeholder="Search teams…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="wct-filters">
          <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
            <option value="All">All Groups</option>
            {GROUP_LETTERS.map(l => <option key={l} value={l}>Group {l}</option>)}
          </select>
        </div>
        <div className="wct-filters">
          <select value={confFilter} onChange={e => setConfFilter(e.target.value)}>
            {CONFEDERATIONS.map(c => <option key={c} value={c}>{c === 'All' ? 'All Confederations' : c}</option>)}
          </select>
        </div>
        <div className="wct-filters">
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div className="wct-viewtoggle">
          <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label="Grid view"><LayoutGrid size={15} /></button>
          <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')} aria-label="Table view"><ListIcon size={15} /></button>
        </div>
      </div>

      {loading ? (
        <div className="wct-empty">Loading team data…</div>
      ) : filtered.length === 0 ? (
        <div className="wct-empty">
          {teams.length === 0 ? "Team list populates once the 2026 World Cup group standings are live. Nothing here is filled in with placeholder teams." : 'No teams match your filters.'}
        </div>
      ) : view === 'grid' ? (
        <div className="wct-grid">
          {filtered.map((t, i) => (
            <div className="wct-card" key={t.id}>
              <div className="wct-rank">{i + 1}</div>
              <div className="wct-top">
                <ApiTeamLogo className="wct-crest" src={t.logo} name={t.name} />
                <div>
                  <strong>{t.name}{t.status === 'qualified' && <span className="wct-tag q">Q</span>}{t.status === 'eliminated' && <span className="wct-tag e">E</span>}</strong>
                  <span>Group {t.group}{t.confederation ? ` · ${t.confederation}` : ''}</span>
                </div>
              </div>
              <div className="wct-hero">
                <b>{t.points ?? '—'}</b><span>Group Stage Points</span>
              </div>
              {(t.win != null || t.draw != null || t.lose != null) && (
                <div className="wct-pills">
                  {Array.from({ length: t.win || 0 }).map((_, j) => <i className="w" key={`w${j}`} />)}
                  {Array.from({ length: t.draw || 0 }).map((_, j) => <i className="d" key={`d${j}`} />)}
                  {Array.from({ length: t.lose || 0 }).map((_, j) => <i className="l" key={`l${j}`} />)}
                </div>
              )}
              <div className="wct-record">
                <div><b>{t.played ?? '—'}</b><span>Played</span></div>
                <div><b>{t.gd > 0 ? `+${t.gd}` : t.gd ?? '—'}</b><span>GD</span></div>
              </div>
              <div className="wct-btnrow">
                <button className="wct-btn" onClick={() => openSquad(t)}>View Squad</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <table className="wct-listtable">
          <thead><tr><th>Team</th><th>Group</th><th>Confederation</th><th className="num">P</th><th className="num">W</th><th className="num">D</th><th className="num">L</th><th className="num">GD</th><th className="num">Pts</th><th></th></tr></thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td><div className="wcg-team"><ApiTeamLogo src={t.logo} name={t.name} /><span>{t.name}</span>{t.status === 'qualified' && <span className="wct-tag q">Q</span>}{t.status === 'eliminated' && <span className="wct-tag e">E</span>}</div></td>
                <td>{t.group}</td>
                <td>{t.confederation || '—'}</td>
                <td className="num">{t.played ?? '—'}</td>
                <td className="num">{t.win ?? '—'}</td>
                <td className="num">{t.draw ?? '—'}</td>
                <td className="num">{t.lose ?? '—'}</td>
                <td className="num">{t.gd ?? '—'}</td>
                <td className="num wcg-pts">{t.points ?? '—'}</td>
                <td><button onClick={() => openSquad(t)}>Squad</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {squadFor && (
        <div className="wct-modal-backdrop" onClick={closeSquad}>
          <div className="wct-modal" onClick={e => e.stopPropagation()}>
            <div className="wct-modal-head">
              <div className="wct-modal-id"><ApiTeamLogo src={squadFor.logo} name={squadFor.name} /><strong>{squadFor.name}</strong></div>
              <button className="wct-modal-close" onClick={closeSquad} aria-label="Close"><X size={18} /></button>
            </div>
            {squadLoading ? (
              <div className="wct-empty">Loading squad…</div>
            ) : squadError || !squad || squad.length === 0 ? (
              <div className="wct-empty">Squad list isn't available for {squadFor.name} yet — API-Football hasn't published a registered squad for this team.</div>
            ) : (
              <div className="wct-squad">
                {squadByPosition.map(([pos, players]) => (
                  <div className="wct-squad-group" key={pos}>
                    <h4>{pos}</h4>
                    <div className="wct-squad-list">
                      {players.map(p => (
                        <div className="wct-squad-row" key={p.id}>
                          <ApiPlayerImage playerId={p.id} name={p.name} preferredSrc={p.photo} fallbackSrc="/assets/players/neutral-player.svg" alt={p.name} loading="lazy" />
                          <span className="wct-squad-name">{p.name}</span>
                          <span className="wct-squad-num">{p.number != null ? `#${p.number}` : ''}</span>
                          <span className="wct-squad-age">{p.age != null ? `${p.age}y` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
