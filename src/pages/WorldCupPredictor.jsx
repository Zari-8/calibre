import { useEffect, useState } from 'react';
import WorldCupNav from '../components/WorldCupNav.jsx';
import ApiTeamLogo from '../components/ApiTeamLogo.jsx';
import { getFixturesByDate, getMatchPredictions } from '../services/apiFootball.js';

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
function parsePct(v) { const n = parseFloat(String(v ?? '').replace('%', '')); return Number.isFinite(n) ? n : null; }

export default function WorldCupPredictor() {
  // Real match-by-match simulator: pick any upcoming World Cup fixture, run
  // the real API-Football prediction model on it — the same call already
  // powering the Matchroom's "Match signals" panel, just standalone here.
  const [fixtures, setFixtures] = useState([]);
  const [loadingFixtures, setLoadingFixtures] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const days = [0, 1, 2, 3, 4, 5, 6, 7].map(i => new Date(Date.now() + i * 86400000).toISOString().slice(0, 10));
        const results = await Promise.all(days.map(d => getFixturesByDate(d).catch(() => [])));
        const wc = results.flat().filter(f => isWorldCup(f));
        if (alive) setFixtures(wc);
      } finally { if (alive) setLoadingFixtures(false); }
    })();
    return () => { alive = false; };
  }, []);

  const [selectedId, setSelectedId] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [predLoading, setPredLoading] = useState(false);
  const [predError, setPredError] = useState(false);

  async function runPrediction(fixtureId) {
    setSelectedId(fixtureId);
    setPrediction(null);
    setPredError(false);
    if (!fixtureId) return;
    setPredLoading(true);
    try {
      const data = await getMatchPredictions(fixtureId);
      const pct = data?.predictions?.percent || {};
      const h = parsePct(pct.home), d = parsePct(pct.draw), a = parsePct(pct.away);
      if (h == null && a == null) { setPredError(true); return; }
      setPrediction({
        home: h ?? 0, draw: d ?? 0, away: a ?? 0,
        advice: data?.predictions?.advice || '',
        winnerName: data?.predictions?.winner?.name || '',
      });
    } catch { setPredError(true); }
    finally { setPredLoading(false); }
  }

  const selectedFixture = fixtures.find(f => String(f.fixture?.id) === String(selectedId));

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
        .wc2-card { background:var(--glass); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid var(--line); border-radius:12px; padding:20px; margin-bottom:16px; }
        .wc2-eyebrow-sm { color:var(--l); font:700 10px "Barlow",sans-serif; letter-spacing:.14em; text-transform:uppercase; margin-bottom:12px; display:block; }
        .wcp-select { width:100%; background:rgba(255,255,255,.04); border:1px solid var(--line); color:#ddd; font:600 13px "Barlow",sans-serif; padding:11px 14px; border-radius:8px; margin-bottom:16px; }
        .wcp-teams { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
        .wcp-teams div { display:flex; flex-direction:column; align-items:center; gap:8px; flex:1; }
        .wcp-teams img { width:44px; height:44px; object-fit:contain; }
        .wcp-teams span { font:800 12px "Barlow Condensed",sans-serif; text-transform:uppercase; text-align:center; }
        .wcp-teams .vs { flex:none; color:#555; font:800 18px "Barlow Condensed",sans-serif; padding:0 16px; }
        .wcp-bar { display:flex; height:34px; border-radius:8px; overflow:hidden; font:800 12px "Barlow Condensed",sans-serif; margin-bottom:8px; }
        .wcp-bar .h { background:var(--l); color:#0a0a0a; display:flex; align-items:center; justify-content:center; }
        .wcp-bar .d { background:rgba(255,255,255,.18); color:#fff; display:flex; align-items:center; justify-content:center; }
        .wcp-bar .a { background:rgba(255,255,255,.42); color:#0a0a0a; display:flex; align-items:center; justify-content:center; }
        .wcp-labels { display:flex; justify-content:space-between; color:var(--muted); font:700 10px "Barlow",sans-serif; letter-spacing:.06em; text-transform:uppercase; margin-bottom:14px; }
        .wcp-advice { color:#ddd; font:500 13px/1.6 "Barlow",sans-serif; padding:12px 14px; background:rgba(200,255,0,.06); border-left:3px solid var(--l); border-radius:0 8px 8px 0; }
        .wcp-empty { color:var(--muted); font:500 13px/1.6 "Barlow",sans-serif; text-align:center; padding:30px 0; }
        .wcp-note { color:#5b6168; font:500 11px/1.6 "Barlow",sans-serif; }
        .wcp-locked { display:flex; align-items:center; gap:14px; }
        .wcp-locked > div b { display:block; font:800 15px "Barlow Condensed",sans-serif; text-transform:uppercase; margin-bottom:4px; }
        .wcp-locked > div span { color:var(--muted); font:500 12px "Barlow",sans-serif; }
        .wcp-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        @media(max-width:760px){ .wcp-grid2 { grid-template-columns:1fr; } }
      `}</style>

      <WorldCupNav active="predictor" />

      <div className="wc2-title">
        <h1>Predictor</h1>
        <p>Match-by-match predictions from Calibre's connected model.</p>
      </div>

      <div className="wc2-card">
        <span className="wc2-eyebrow-sm">Match-by-Match Simulator</span>
        {loadingFixtures ? (
          <div className="wcp-empty">Loading fixtures…</div>
        ) : fixtures.length === 0 ? (
          <div className="wcp-empty">No fixtures in the next week to run predictions on.</div>
        ) : (
          <>
            <select className="wcp-select" value={selectedId} onChange={e => runPrediction(e.target.value)}>
              <option value="">Select a fixture…</option>
              {fixtures.map(f => (
                <option key={f.fixture?.id} value={f.fixture?.id}>
                  {f.teams?.home?.name} vs {f.teams?.away?.name} — {new Date(f.fixture?.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </option>
              ))}
            </select>

            {selectedFixture && (
              <div className="wcp-teams">
                <div><ApiTeamLogo src={selectedFixture.teams?.home?.logo} name={selectedFixture.teams?.home?.name} /><span>{selectedFixture.teams?.home?.name}</span></div>
                <span className="vs">VS</span>
                <div><ApiTeamLogo src={selectedFixture.teams?.away?.logo} name={selectedFixture.teams?.away?.name} /><span>{selectedFixture.teams?.away?.name}</span></div>
              </div>
            )}

            {predLoading && <div className="wcp-empty">Running the model…</div>}
            {predError && <div className="wcp-empty">No prediction available for this fixture yet.</div>}
            {prediction && (
              <>
                <div className="wcp-bar">
                  <div className="h" style={{ width: `${prediction.home}%` }}>{prediction.home}%</div>
                  <div className="d" style={{ width: `${prediction.draw}%` }}>{prediction.draw}%</div>
                  <div className="a" style={{ width: `${prediction.away}%` }}>{prediction.away}%</div>
                </div>
                <div className="wcp-labels"><span>{selectedFixture?.teams?.home?.name}</span><span>Draw</span><span>{selectedFixture?.teams?.away?.name}</span></div>
                {prediction.advice && <div className="wcp-advice"><b style={{ color: 'var(--l)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '.08em', display: 'block', marginBottom: 4 }}>Calibre model says</b>{prediction.advice}</div>}
              </>
            )}
          </>
        )}
      </div>

      <div className="wcp-grid2">
        <div className="wc2-card">
          <span className="wc2-eyebrow-sm">Tournament Winner</span>
          <div className="wcp-locked">
            <div>
              <b>Not yet modelled</b>
              <span>A full tournament-winner probability needs a bracket-simulation model beyond single-match predictions — this connects once that engine exists, not before.</span>
            </div>
          </div>
        </div>
        <div className="wc2-card">
          <span className="wc2-eyebrow-sm">Knockout Bracket Prediction</span>
          <div className="wcp-locked">
            <div>
              <b>Not yet modelled</b>
              <span>Bracket simulation needs the group stage to finish and seeding to be confirmed before it can run on real data.</span>
            </div>
          </div>
        </div>
      </div>

      <p className="wcp-note">Match-by-match predictions are Calibre's connected model output via API-Football, refreshed per fixture. Tournament-wide winner and bracket predictions are a separate, not-yet-built model — this page never fills those in with invented percentages.</p>
    </div>
  );
}
