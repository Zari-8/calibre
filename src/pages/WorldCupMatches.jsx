import { useEffect, useMemo, useState } from 'react';
import { Clock3, ArrowRight } from 'lucide-react';
import WorldCupNav from '../components/WorldCupNav.jsx';
import { navigateTo } from '../components/NavLink.jsx';
import { getFixturesByDate } from '../services/apiFootball.js';

// getFixturesByDate() returns fixtures across ALL competitions for a date —
// it doesn't filter by league. The numeric World Cup league id isn't in
// LEAGUE_IDS (apiFootball.js only lists club competitions), and guessing a
// wrong number here would silently zero out every real match with no error.
// Matching by name instead is robust regardless of the real id — swap this
// for a confirmed numeric id + LEAGUE_IDS entry once you have it, and every
// page using isWorldCup() below picks it up with no further changes.
function isWorldCup(fixture) {
  return /world cup/i.test(fixture?.league?.name || '');
}
const WC_LIVE = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'];
const WC_DONE = ['FT', 'AET', 'PEN'];
const TABS = ['All', 'Live', 'Results', 'Upcoming'];

function dateKey(d) { return d.toISOString().slice(0, 10); }
function dayLabel(key) {
  const d = new Date(key + 'T00:00:00');
  const today = dateKey(new Date());
  const tomorrow = dateKey(new Date(Date.now() + 86400000));
  const yesterday = dateKey(new Date(Date.now() - 86400000));
  if (key === today) return `Today · ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`;
  if (key === tomorrow) return `Tomorrow · ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`;
  if (key === yesterday) return `Yesterday · ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function WorldCupMatches() {
  // Real multi-day schedule: the API is date-scoped, so a window of real
  // fixture-day calls is fetched and merged rather than inventing a season-wide
  // schedule. -2 to +7 days covers "recent results" through "this week's fixtures".
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const days = [];
        for (let i = -2; i <= 7; i++) days.push(dateKey(new Date(Date.now() + i * 86400000)));
        const results = await Promise.all(days.map(d => getFixturesByDate(d).catch(() => [])));
        const merged = results.flat().filter(f => isWorldCup(f));
        if (alive) setFixtures(merged);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const [tab, setTab] = useState('All');
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    if (tab === 'Live') return fixtures.filter(f => WC_LIVE.includes(f.fixture?.status?.short));
    if (tab === 'Results') return fixtures.filter(f => WC_DONE.includes(f.fixture?.status?.short));
    if (tab === 'Upcoming') return fixtures.filter(f => !WC_LIVE.includes(f.fixture?.status?.short) && !WC_DONE.includes(f.fixture?.status?.short));
    return fixtures;
  }, [fixtures, tab]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const f of filtered) {
      const key = f.fixture?.date ? f.fixture.date.slice(0, 10) : 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  function openMatchroom(f) {
    const date = f.fixture?.date ? f.fixture.date.slice(0, 10) : '';
    navigateTo(`/world-cup/matchroom?fixtureId=${f.fixture?.id}&date=${date}`);
  }

  return (
    <div className="page wc2">
      <style>{`
        .wc2 { --l:#a6ff00; --line:rgba(255,255,255,.09); --muted:#888; --glass:rgba(9,13,16,.5); color:#fff; position:relative; isolation:isolate; background:#050708; }
        .wc2::before { content:""; position:fixed; inset:0; z-index:-2; background:url("/assets/debates-bg.png") center/cover no-repeat; pointer-events:none; }
        .wc2::after { content:""; position:fixed; inset:0; z-index:-1; pointer-events:none; background:radial-gradient(ellipse 90% 42% at 50% -4%,rgba(166,255,0,.07),transparent 60%),radial-gradient(ellipse 120% 90% at 50% 130%,rgba(18,42,14,.30),transparent 62%),linear-gradient(180deg,rgba(5,8,11,.24) 0%,rgba(5,8,11,.45) 45%,rgba(5,8,11,.58) 100%); }
        .wc2 * { box-sizing:border-box; }
        .wc2-title { margin:4px 0 18px; }
        .wc2-title h1 { margin:0 0 6px; font:800 34px "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .wc2-title p { margin:0; color:var(--muted); font:500 13px "Barlow",sans-serif; }
        .wcm-layout { display:grid; grid-template-columns:1fr 320px; gap:18px; align-items:start; }
        @media(max-width:900px){ .wcm-layout { grid-template-columns:1fr; } }
        .wcm-tabs { display:flex; gap:6px; margin-bottom:16px; }
        .wcm-tabs button { background:var(--glass); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid var(--line); color:#888; font:800 11px "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; padding:9px 16px; border-radius:8px; cursor:pointer; }
        .wcm-tabs button.on { background:var(--l); color:#0a0a0a; border-color:var(--l); }
        .wcm-day { margin-bottom:20px; }
        .wcm-day-label { color:var(--l); font:800 11px "Barlow Condensed",sans-serif; letter-spacing:.1em; text-transform:uppercase; margin-bottom:10px; display:block; }
        .wcm-row { display:flex; align-items:center; gap:14px; background:var(--glass); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid var(--line); border-radius:10px; padding:12px 16px; margin-bottom:8px; cursor:pointer; transition:border-color .12s; }
        .wcm-row:hover { border-color:#333; }
        .wcm-row.on { border-color:var(--l); }
        .wcm-side { display:flex; align-items:center; gap:8px; flex:1; min-width:0; }
        .wcm-side img { width:24px; height:24px; object-fit:contain; flex:none; }
        .wcm-side span { font:700 13px "Barlow",sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .wcm-side.away { flex-direction:row-reverse; text-align:right; }
        .wcm-mid { flex:none; text-align:center; width:96px; }
        .wcm-mid .score { font:800 20px "Barlow Condensed",sans-serif; }
        .wcm-mid .vs { font:800 15px "Barlow Condensed",sans-serif; color:#555; }
        .wcm-mid .status { display:block; margin-top:2px; font:700 9px "Barlow",sans-serif; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
        .wcm-mid .status.live { color:#ef4444; }
        .wcm-btn { flex:none; background:none; border:1px solid var(--line); color:var(--l); font:700 10px "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; padding:7px 12px; border-radius:7px; cursor:pointer; white-space:nowrap; }
        .wcm-btn:hover { border-color:var(--l); }
        .wcm-empty { color:var(--muted); font:500 13px/1.6 "Barlow",sans-serif; text-align:center; padding:40px 0; }
        .wcm-preview { position:sticky; top:16px; background:var(--glass); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid var(--line); border-radius:12px; padding:20px; }
        .wcm-preview h3 { margin:0 0 14px; font:800 14px "Barlow Condensed",sans-serif; letter-spacing:.1em; text-transform:uppercase; color:var(--l); }
        .wcm-preview .teams { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .wcm-preview .teams img { width:40px; height:40px; object-fit:contain; }
        .wcm-preview .teams span { display:block; margin-top:6px; font:700 11px "Barlow Condensed",sans-serif; text-transform:uppercase; text-align:center; }
        .wcm-preview .score { font:800 26px "Barlow Condensed",sans-serif; color:var(--l); }
        .wcm-preview .meta { color:var(--muted); font:500 11.5px "Barlow",sans-serif; margin-bottom:14px; }
        .wcm-preview button { width:100%; background:var(--l); border:none; color:#0a0a0a; font:800 12px "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; padding:11px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; }
      `}</style>

      <WorldCupNav active="matches" />

      <div className="wc2-title">
        <h1>Matches</h1>
        <p>Live scores, results and upcoming fixtures.</p>
      </div>

      <div className="wcm-layout">
        <div>
          <div className="wcm-tabs">
            {TABS.map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
          </div>

          {loading ? (
            <div className="wcm-empty">Loading fixtures…</div>
          ) : grouped.length === 0 ? (
            <div className="wcm-empty">No {tab.toLowerCase()} fixtures right now.</div>
          ) : (
            grouped.map(([day, fxs]) => (
              <div className="wcm-day" key={day}>
                <span className="wcm-day-label">{dayLabel(day)}</span>
                {fxs.map(f => {
                  const status = f.fixture?.status?.short;
                  const isLive = WC_LIVE.includes(status);
                  const isDone = WC_DONE.includes(status);
                  return (
                    <div key={f.fixture?.id} className={`wcm-row ${selected?.fixture?.id === f.fixture?.id ? 'on' : ''}`} onClick={() => setSelected(f)}>
                      <div className="wcm-side home"><img src={f.teams?.home?.logo} alt="" /><span>{f.teams?.home?.name}</span></div>
                      <div className="wcm-mid">
                        {isLive || isDone ? (
                          <div className="score">{f.goals?.home ?? 0}–{f.goals?.away ?? 0}</div>
                        ) : (
                          <div className="vs">VS</div>
                        )}
                        <span className={`status ${isLive ? 'live' : ''}`}>
                          {isLive ? `LIVE ${f.fixture?.status?.elapsed ?? ''}'` : isDone ? 'FT' : new Date(f.fixture?.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="wcm-side away"><img src={f.teams?.away?.logo} alt="" /><span>{f.teams?.away?.name}</span></div>
                      <button className="wcm-btn" onClick={e => { e.stopPropagation(); openMatchroom(f); }}>{isLive || isDone ? 'Matchroom' : 'Preview'}</button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="wcm-preview">
          <h3>Selected Match</h3>
          {!selected ? (
            <div className="wcm-empty" style={{ padding: '20px 0' }}>Click a fixture to preview it here.</div>
          ) : (
            <>
              <div className="teams">
                <div><img src={selected.teams?.home?.logo} alt="" /><span>{selected.teams?.home?.name}</span></div>
                <div className="score">
                  {WC_LIVE.includes(selected.fixture?.status?.short) || WC_DONE.includes(selected.fixture?.status?.short)
                    ? `${selected.goals?.home ?? 0}–${selected.goals?.away ?? 0}` : 'VS'}
                </div>
                <div><img src={selected.teams?.away?.logo} alt="" /><span>{selected.teams?.away?.name}</span></div>
              </div>
              <div className="meta"><Clock3 size={12} style={{ verticalAlign: -2 }} /> {new Date(selected.fixture?.date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}{selected.fixture?.venue?.name ? ` · ${selected.fixture.venue.name}` : ''}</div>
              <button onClick={() => openMatchroom(selected)}>Open Matchroom <ArrowRight size={13} /></button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
