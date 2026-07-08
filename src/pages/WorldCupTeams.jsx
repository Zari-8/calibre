import { useEffect, useMemo, useState } from 'react';
import WorldCupNav from '../components/WorldCupNav.jsx';
import ApiTeamLogo from '../components/ApiTeamLogo.jsx';
import { navigateTo } from '../components/NavLink.jsx';
import { getStandings } from '../services/apiFootball.js';

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

export default function WorldCupTeams() {
  const [groups, setGroups] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getStandings(WC_LEAGUE_ID, WC_SEASON);
        const flat = Array.isArray(data?.[0]) ? data : (Array.isArray(data) ? [data] : null);
        if (alive) setGroups(flat);
      } catch { /* handled by empty state below */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  // Flatten every group's rows into one team list, tagging each with its
  // group letter and (if known) confederation. This is the only place the
  // list of 48 teams comes from — no static/fabricated roster.
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
        });
      });
    });
    return out;
  }, [groups]);

  const [groupFilter, setGroupFilter] = useState('All');
  const [confFilter, setConfFilter] = useState('All');

  const filtered = teams.filter(t =>
    (groupFilter === 'All' || t.group === groupFilter) &&
    (confFilter === 'All' || t.confederation === confFilter)
  );

  return (
    <div className="page wc2">
      <style>{`
        .wc2 { --l:#c8ff00; --line:#1c1c1c; --muted:#888; color:#fff; }
        .wc2 * { box-sizing:border-box; }
        .wc2-title { margin:4px 0 18px; }
        .wc2-title h1 { margin:0 0 6px; font:800 34px "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .wc2-title p { margin:0; color:var(--muted); font:500 13px "Barlow",sans-serif; }
        .wct-filters { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px; }
        .wct-filters select { background:#0f0f0f; border:1px solid var(--line); color:#ddd; font:600 12px "Barlow",sans-serif; padding:9px 12px; border-radius:8px; cursor:pointer; }
        .wct-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
        .wct-card { background:#0f0f0f; border:1px solid var(--line); border-radius:12px; padding:16px; }
        .wct-top { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
        .wct-top img { width:36px; height:36px; object-fit:contain; }
        .wct-top strong { display:block; font:800 14px "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .wct-top span { color:var(--muted); font:600 10px "Barlow",sans-serif; text-transform:uppercase; }
        .wct-record { display:flex; gap:12px; margin-bottom:12px; }
        .wct-record div b { display:block; font:800 15px "Barlow Condensed",sans-serif; }
        .wct-record div span { color:var(--muted); font:600 8.5px "Barlow",sans-serif; text-transform:uppercase; }
        .wct-uncomputed { color:#5b6168; font:500 10.5px/1.5 "Barlow",sans-serif; margin-bottom:10px; }
        .wct-btn { width:100%; background:none; border:1px solid var(--line); color:var(--l); font:700 10.5px "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; padding:8px; border-radius:7px; cursor:pointer; }
        .wct-btn:hover { border-color:var(--l); }
        .wct-empty { color:var(--muted); font:500 13px/1.6 "Barlow",sans-serif; text-align:center; padding:60px 0; }
      `}</style>

      <WorldCupNav active="teams" />

      <div className="wc2-title">
        <h1>Teams</h1>
        <p>All 48 nations at the 2026 World Cup.</p>
      </div>

      <div className="wct-filters">
        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
          <option value="All">All Groups</option>
          {GROUP_LETTERS.map(l => <option key={l} value={l}>Group {l}</option>)}
        </select>
        <select value={confFilter} onChange={e => setConfFilter(e.target.value)}>
          {CONFEDERATIONS.map(c => <option key={c} value={c}>{c === 'All' ? 'All Confederations' : c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="wct-empty">Loading team data…</div>
      ) : filtered.length === 0 ? (
        <div className="wct-empty">
          Team list populates once the 2026 World Cup group standings are live. Nothing here is filled in with placeholder teams.
        </div>
      ) : (
        <div className="wct-grid">
          {filtered.map(t => (
            <div className="wct-card" key={t.id}>
              <div className="wct-top">
                <ApiTeamLogo src={t.logo} name={t.name} />
                <div><strong>{t.name}</strong><span>Group {t.group}{t.confederation ? ` · ${t.confederation}` : ''}</span></div>
              </div>
              <div className="wct-record">
                <div><b>{t.played ?? '—'}</b><span>Played</span></div>
                <div><b>{t.win ?? '—'}</b><span>Won</span></div>
                <div><b>{t.points ?? '—'}</b><span>Points</span></div>
                <div><b>{t.gd ?? '—'}</b><span>GD</span></div>
              </div>
              <div className="wct-uncomputed">Calibre rating, strengths/weaknesses and squad depth need a national-squad data source — not shown until that's wired.</div>
              <button className="wct-btn" onClick={() => navigateTo('/world-cup/groups')}>View Group {t.group} →</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
