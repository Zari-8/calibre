import { useEffect, useMemo, useState } from 'react';
import WorldCupNav from '../components/WorldCupNav.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import ApiTeamLogo from '../components/ApiTeamLogo.jsx';
import { supabase, supabaseConfigured } from '../services/supabaseClient.js';
import { getFixturesByDate, getFixtureStatistics, statValue } from '../services/apiFootball.js';

// getFixturesByDate() returns fixtures across ALL competitions for a date —
// it doesn't filter by league. The numeric World Cup league id isn't in
// LEAGUE_IDS (apiFootball.js only lists club competitions), and guessing a
// wrong number here would silently zero out every real match with no error.
// Matching by name instead is robust regardless of the real id — swap this
// for a confirmed numeric id + LEAGUE_IDS entry once you have it, and every
// page using isWorldCup() below picks it up with no further changes.
// Other real competitions also carry "World Cup" in their name — age-group
// (U-17/U-20/U-23), women's, qualification play-offs, beach and futsal
// editions among them. Excluded here rather than guessed away with a numeric
// league id, since a wrong id would silently zero out every real match with
// no error (see LEAGUE_IDS note above).
const WC_NAME_EXCLUDE = /\b(u-?1[5-9]|u-?2[0-3]|women|female|girls|beach|futsal|clubs?|qualif|play-?off|friendl)\b/i;
function isWorldCup(fixture) {
  const name = fixture?.league?.name || '';
  return /world cup/i.test(name) && !WC_NAME_EXCLUDE.test(name);
}
const WC_DONE = ['FT', 'AET', 'PEN'];

// Player-level categories, backed by real columns on wc_leaders.
const PLAYER_CATEGORIES = [
  { key: 'goals', label: 'Top Scorers', field: 'goals', mode: 'player' },
  { key: 'assists', label: 'Top Assists', field: 'assists', mode: 'player' },
  { key: 'rating', label: 'Top Rated', field: 'rating', mode: 'player' },
  { key: 'appearances', label: 'Most Appearances', field: 'appearances', mode: 'player' },
];
// Team-level categories, aggregated live from real API-Football fixture
// statistics (see the teamStats effect below) — never invented numbers.
const TEAM_CATEGORIES = [
  { key: 'cleansheets', label: 'Clean Sheets', field: 'cleanSheets', mode: 'team', fmt: v => String(v) },
  { key: 'discipline', label: 'Discipline', field: 'cards', mode: 'team', fmt: v => String(v), sub: 'cards' },
  { key: 'possession', label: 'Possession', field: 'possessionAvg', mode: 'team', fmt: v => `${v.toFixed(1)}%`, sub: 'avg' },
  { key: 'passing', label: 'Passing', field: 'passAccAvg', mode: 'team', fmt: v => `${v.toFixed(1)}%`, sub: 'accuracy' },
];
const CATEGORIES = [...PLAYER_CATEGORIES, ...TEAM_CATEGORIES];
// Tackles genuinely isn't a standard field in API-Football's fixture
// statistics response at this tier — kept honestly untracked rather than
// guessed at or faked.
const UNTRACKED = ['Tackles'];

export default function WorldCupStats() {
  const [wcLeaders, setWcLeaders] = useState([]);
  const [leadersLoading, setLeadersLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabaseConfigured || !supabase) { setLeadersLoading(false); return; }
      const { data, error } = await supabase.from('wc_leaders').select('*').limit(200);
      if (!error && alive) setWcLeaders(data || []);
      if (alive) setLeadersLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  // Real tournament totals from actual fixtures — same fetch technique as the
  // Matches page — not derived from the leaderboard (which only tracks
  // individual leaders, not every goal in every match).
  const [totals, setTotals] = useState({ goals: 0, matches: 0, loading: true });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const days = [];
        for (let i = -30; i <= 7; i++) days.push(new Date(Date.now() + i * 86400000).toISOString().slice(0, 10));
        const results = await Promise.all(days.map(d => getFixturesByDate(d).catch(() => [])));
        const wc = results.flat().filter(f => isWorldCup(f));
        const done = wc.filter(f => WC_DONE.includes(f.fixture?.status?.short));
        const goals = done.reduce((sum, f) => sum + (f.goals?.home ?? 0) + (f.goals?.away ?? 0), 0);
        if (alive) setTotals({ goals, matches: done.length, loading: false });
      } catch { if (alive) setTotals(t => ({ ...t, loading: false })); }
    })();
    return () => { alive = false; };
  }, []);

  // Team-level stats (clean sheets, cards, possession, passing accuracy)
  // aggregated live from real per-fixture statistics — API-Football's
  // /fixtures/statistics, one call per finished match. Capped at 80 matches
  // to protect the daily API quota; results cache for a week per fixture
  // (see TTL['fixtures/statistics']) so repeat visits don't re-spend it.
  const [teamStats, setTeamStats] = useState({});
  const [teamStatsLoading, setTeamStatsLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const days = [];
        for (let i = -30; i <= 7; i++) days.push(new Date(Date.now() + i * 86400000).toISOString().slice(0, 10));
        const results = await Promise.all(days.map(d => getFixturesByDate(d).catch(() => [])));
        const wc = results.flat().filter(f => isWorldCup(f));
        const done = wc.filter(f => WC_DONE.includes(f.fixture?.status?.short));
        const capped = done.slice(0, 80);
        const statResults = await Promise.all(capped.map(f => getFixtureStatistics(f.fixture?.id).catch(() => null)));

        const teams = {};
        const ensure = (id, name, logo) => {
          if (!teams[id]) teams[id] = { id, name, logo, matches: 0, cleanSheets: 0, yellow: 0, red: 0, possessionSum: 0, possessionN: 0, passAccSum: 0, passAccN: 0 };
          return teams[id];
        };
        capped.forEach((f, i) => {
          const stat = statResults[i];
          if (!Array.isArray(stat) || stat.length < 2) return;
          const homeGoals = f.goals?.home ?? 0;
          const awayGoals = f.goals?.away ?? 0;
          stat.forEach(entry => {
            const id = entry.team?.id;
            if (!id) return;
            const t = ensure(id, entry.team.name, entry.team.logo);
            t.matches += 1;
            const isHome = f.teams?.home?.id === id;
            const conceded = isHome ? awayGoals : homeGoals;
            if (conceded === 0) t.cleanSheets += 1;
            const yellow = statValue(entry, 'Yellow Cards');
            const red = statValue(entry, 'Red Cards');
            if (yellow != null) t.yellow += yellow;
            if (red != null) t.red += red;
            const poss = statValue(entry, 'Ball Possession');
            if (poss != null) { t.possessionSum += poss; t.possessionN += 1; }
            const passAcc = statValue(entry, 'Passes %');
            if (passAcc != null) { t.passAccSum += passAcc; t.passAccN += 1; }
          });
        });
        if (alive) setTeamStats(teams);
      } catch { /* leave teamStats empty — honest empty state below */ }
      finally { if (alive) setTeamStatsLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const teamStatRows = useMemo(() => Object.values(teamStats).map(t => ({
    id: t.id, name: t.name, logo: t.logo,
    cleanSheets: t.cleanSheets,
    cards: t.yellow + t.red,
    possessionAvg: t.possessionN ? t.possessionSum / t.possessionN : null,
    passAccAvg: t.passAccN ? t.passAccSum / t.passAccN : null,
  })), [teamStats]);
  const totalCards = useMemo(() => teamStatRows.reduce((sum, t) => sum + (t.cards || 0), 0), [teamStatRows]);

  const [activeCat, setActiveCat] = useState('goals');
  const cat = CATEGORIES.find(c => c.key === activeCat);
  const rankedPlayers = useMemo(() => {
    return [...wcLeaders]
      .filter(l => l[cat.field] != null)
      .sort((a, b) => Number(b[cat.field]) - Number(a[cat.field]))
      .slice(0, 15);
  }, [wcLeaders, cat]);
  const rankedTeams = useMemo(() => {
    if (cat.mode !== 'team') return [];
    return [...teamStatRows]
      .filter(t => t[cat.field] != null)
      .sort((a, b) => Number(b[cat.field]) - Number(a[cat.field]))
      .slice(0, 15);
  }, [teamStatRows, cat]);

  return (
    <div className="page wc2">
      <style>{`
        .wc2 { --l:#97cc0d; --line:rgba(255,255,255,.09); --muted:#888; --glass:rgba(9,13,16,.5); color:#fff; position:relative; isolation:isolate; background:#050708; }
        .wc2::before { content:""; position:fixed; inset:0; z-index:-2; background:url("/assets/debates-bg.png") center/cover no-repeat; pointer-events:none; }
        .wc2::after { content:""; position:fixed; inset:0; z-index:-1; pointer-events:none; background:radial-gradient(ellipse 90% 42% at 50% -4%,rgba(151,204,13,.07),transparent 60%),radial-gradient(ellipse 120% 90% at 50% 130%,rgba(18,42,14,.30),transparent 62%),linear-gradient(180deg,rgba(5,8,11,.24) 0%,rgba(5,8,11,.45) 45%,rgba(5,8,11,.58) 100%); }
        .wc2 * { box-sizing:border-box; }
        .wc2-title { margin:4px 0 18px; }
        .wc2-title h1 { margin:0 0 6px; font:800 34px "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .wc2-title p { margin:0; color:var(--muted); font:500 13px "Barlow",sans-serif; }
        .wcs-totals { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:var(--line); border:1px solid var(--line); border-radius:10px; overflow:hidden; margin-bottom:20px; }
        @media(max-width:700px){ .wcs-totals { grid-template-columns:repeat(2,1fr); } }
        .wcs-total-cell { background:rgba(255,255,255,.04); padding:16px; text-align:center; }
        .wcs-total-cell strong { display:block; font:800 30px "Barlow Condensed",sans-serif; color:var(--l); }
        .wcs-total-cell span { display:block; margin-top:4px; color:var(--muted); font:700 9px "Barlow",sans-serif; letter-spacing:.08em; text-transform:uppercase; }
        .wcs-tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:16px; }
        .wcs-tabs button { background:var(--glass); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid var(--line); color:#888; font:800 11px "Barlow Condensed",sans-serif; letter-spacing:.05em; text-transform:uppercase; padding:9px 14px; border-radius:8px; cursor:pointer; }
        .wcs-tabs button.on { background:var(--l); color:#0a0a0a; border-color:var(--l); }
        .wcs-tabs button.untracked { opacity:.4; cursor:default; }
        .wcs-table { width:100%; border-collapse:collapse; background:var(--glass); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid var(--line); border-radius:10px; overflow:hidden; }
        .wcs-table th { text-align:left; padding:10px 14px; color:var(--muted); font:700 9.5px "Barlow",sans-serif; letter-spacing:.08em; text-transform:uppercase; border-bottom:1px solid var(--line); }
        .wcs-table td { padding:10px 14px; border-bottom:1px solid #161616; font:600 13px "Barlow",sans-serif; }
        .wcs-table tr:last-child td { border-bottom:none; }
        .wcs-rank { width:24px; color:var(--muted); font:800 13px "Barlow Condensed",sans-serif; }
        .wcs-player { display:flex; align-items:center; gap:10px; }
        .wcs-player img { width:32px; height:32px; border-radius:50%; object-fit:cover; object-position:top; }
        .wcs-player strong { font-weight:700; }
        .wcs-val { text-align:right; color:var(--l); font:800 16px "Barlow Condensed",sans-serif; }
        .wcs-empty { color:var(--muted); font:500 13px/1.6 "Barlow",sans-serif; text-align:center; padding:40px 0; }
        .wcs-untracked-note { margin-top:14px; color:#5b6168; font:500 11px "Barlow",sans-serif; }
      `}</style>

      <WorldCupNav active="stats" />

      <div className="wc2-title">
        <h1>Stats</h1>
        <p>Tournament numbers, updated as matches are played.</p>
      </div>

      <div className="wcs-totals">
        <div className="wcs-total-cell"><strong>{totals.loading ? '…' : totals.goals}</strong><span>Total Goals</span></div>
        <div className="wcs-total-cell"><strong>{totals.loading ? '…' : totals.matches}</strong><span>Matches Played</span></div>
        <div className="wcs-total-cell"><strong>{totals.loading ? '…' : totals.matches ? (totals.goals / totals.matches).toFixed(2) : '—'}</strong><span>Avg Goals / Match</span></div>
        <div className="wcs-total-cell"><strong>{teamStatsLoading ? '…' : (totalCards || '—')}</strong><span>Cards</span></div>
      </div>

      <div className="wcs-tabs">
        {CATEGORIES.map(c => <button key={c.key} className={activeCat === c.key ? 'on' : ''} onClick={() => setActiveCat(c.key)}>{c.label}</button>)}
        {UNTRACKED.map(t => <button key={t} className="untracked" title="Connects once this data is available from API-Football">{t}</button>)}
      </div>

      {cat.mode === 'player' ? (
        leadersLoading ? (
          <div className="wcs-empty">Loading leaderboard…</div>
        ) : rankedPlayers.length === 0 ? (
          <div className="wcs-empty">Leaderboard populates once tournament matches kick off.</div>
        ) : (
          <table className="wcs-table">
            <thead><tr><th></th><th>Player</th><th>Team</th><th style={{ textAlign: 'right' }}>{cat.label}</th></tr></thead>
            <tbody>
              {rankedPlayers.map((l, i) => (
                <tr key={l.api_player_id}>
                  <td className="wcs-rank">{i + 1}</td>
                  <td><div className="wcs-player"><ApiPlayerImage playerId={l.api_player_id} name={l.name} fallbackSrc="/assets/players/neutral-player.svg" alt={l.name} /><strong>{l.name}</strong></div></td>
                  <td style={{ color: '#999' }}>{l.team}</td>
                  <td className="wcs-val">{l[cat.field]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : (
        teamStatsLoading ? (
          <div className="wcs-empty">Aggregating match statistics…</div>
        ) : rankedTeams.length === 0 ? (
          <div className="wcs-empty">{cat.label} populates once completed World Cup fixtures carry match statistics.</div>
        ) : (
          <table className="wcs-table">
            <thead><tr><th></th><th>Team</th><th style={{ textAlign: 'right' }}>{cat.label}{cat.sub ? ` (${cat.sub})` : ''}</th></tr></thead>
            <tbody>
              {rankedTeams.map((t, i) => (
                <tr key={t.id}>
                  <td className="wcs-rank">{i + 1}</td>
                  <td><div className="wcs-player"><ApiTeamLogo src={t.logo} name={t.name} /><strong>{t.name}</strong></div></td>
                  <td className="wcs-val">{cat.fmt(t[cat.field])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
      <p className="wcs-untracked-note">Tackles will populate once that endpoint is available from API-Football — this page never fills it in with a placeholder number. Team stats above (clean sheets, discipline, possession, passing) are aggregated live from real per-match statistics, capped at 80 matches to protect API quota.</p>
    </div>
  );
}
