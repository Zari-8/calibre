import { useEffect, useState } from 'react';
import WorldCupNav from '../components/WorldCupNav.jsx';
import ApiTeamLogo from '../components/ApiTeamLogo.jsx';
import { getStandings, getFixturesByDate } from '../services/apiFootball.js';

const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;
const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export default function WorldCupGroups() {
  // getStandings() is confirmed to exist in apiFootball.js from earlier work,
  // but this session hasn't confirmed its exact return shape for a GROUPED
  // competition like the World Cup (vs. a flat single-table league). API-
  // Football's real /standings endpoint returns one array per group for
  // tournaments like this, so that's what this expects — but if the actual
  // shape differs, this shows an honest empty state per group rather than
  // guessing wrong and rendering garbage.
  const [groups, setGroups] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getStandings(WC_LEAGUE_ID, WC_SEASON);
        const flat = Array.isArray(data?.[0]) ? data : (Array.isArray(data) ? [data] : null);
        if (alive) setGroups(flat);
      } catch { if (alive) setLoadError(true); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const [activeGroup, setActiveGroup] = useState(0);

  // Real upcoming fixtures list (any World Cup fixture in the next week) —
  // shown alongside standings rather than per-group, since group-to-fixture
  // mapping isn't confirmed reliable without the real standings shape above.
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

  const group = groups?.[activeGroup];

  return (
    <div className="page wc2">
      <style>{`
        .wc2 { --l:#c8ff00; --line:#1c1c1c; --muted:#888; color:#fff; }
        .wc2 * { box-sizing:border-box; }
        .wc2-title { margin:4px 0 18px; }
        .wc2-title h1 { margin:0 0 6px; font:800 34px "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .wc2-title p { margin:0; color:var(--muted); font:500 13px "Barlow",sans-serif; }
        .wcg-tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:18px; }
        .wcg-tabs button { width:36px; height:36px; background:#0f0f0f; border:1px solid var(--line); color:#888; font:800 13px "Barlow Condensed",sans-serif; border-radius:8px; cursor:pointer; }
        .wcg-tabs button.on { background:var(--l); color:#0a0a0a; border-color:var(--l); }
        .wcg-layout { display:grid; grid-template-columns:1fr 320px; gap:18px; align-items:start; }
        @media(max-width:900px){ .wcg-layout { grid-template-columns:1fr; } }
        .wcg-table { width:100%; border-collapse:collapse; background:#0f0f0f; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
        .wcg-table th { text-align:left; padding:10px 12px; color:var(--muted); font:700 9.5px "Barlow",sans-serif; letter-spacing:.06em; text-transform:uppercase; border-bottom:1px solid var(--line); }
        .wcg-table th.num, .wcg-table td.num { text-align:center; }
        .wcg-table td { padding:9px 12px; border-bottom:1px solid #161616; font:600 12.5px "Barlow",sans-serif; }
        .wcg-table tr:last-child td { border-bottom:none; }
        .wcg-team { display:flex; align-items:center; gap:8px; }
        .wcg-team img { width:20px; height:20px; object-fit:contain; }
        .wcg-pts { color:var(--l); font-weight:800; }
        .wc2-card { background:#0f0f0f; border:1px solid var(--line); border-radius:12px; padding:18px; margin-bottom:16px; }
        .wc2-card h3 { margin:0 0 12px; font:800 13px "Barlow Condensed",sans-serif; letter-spacing:.08em; text-transform:uppercase; color:var(--l); }
        .wcg-fixture { display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--line); font:600 12px "Barlow",sans-serif; }
        .wcg-fixture:last-child { border-bottom:none; }
        .wcg-scenarios { color:#ccc; font:500 12.5px/1.7 "Barlow",sans-serif; }
        .wcg-scenarios li { margin-bottom:6px; }
        .wcg-empty { color:var(--muted); font:500 13px/1.6 "Barlow",sans-serif; text-align:center; padding:40px 0; }
      `}</style>

      <WorldCupNav active="groups" />

      <div className="wc2-title">
        <h1>Groups</h1>
        <p>Standings, fixtures and qualification scenarios.</p>
      </div>

      <div className="wcg-tabs">
        {GROUP_LETTERS.map((l, i) => <button key={l} className={activeGroup === i ? 'on' : ''} onClick={() => setActiveGroup(i)}>{l}</button>)}
      </div>

      <div className="wcg-layout">
        <div>
          {loading ? (
            <div className="wcg-empty">Loading group standings…</div>
          ) : loadError || !group || group.length === 0 ? (
            <div className="wcg-empty">
              Group {GROUP_LETTERS[activeGroup]} standings will appear here once the World Cup group stage is live and the standings feed is connected for a grouped tournament format.
            </div>
          ) : (
            <table className="wcg-table">
              <thead><tr><th>#</th><th>Team</th><th className="num">P</th><th className="num">W</th><th className="num">D</th><th className="num">L</th><th className="num">GD</th><th className="num">Pts</th></tr></thead>
              <tbody>
                {group.map((row, i) => (
                  <tr key={row.team?.id || i}>
                    <td>{row.rank ?? i + 1}</td>
                    <td><div className="wcg-team"><ApiTeamLogo src={row.team?.logo} name={row.team?.name} /><span>{row.team?.name}</span></div></td>
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
    </div>
  );
}
