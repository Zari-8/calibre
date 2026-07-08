import { useState } from 'react';
import { Zap } from 'lucide-react';
import WorldCupNav from '../components/WorldCupNav.jsx';
import { iconicEditions, iconicGoals, tournamentPlayers } from '../data/worldCupData.js';

const NATION_GRADIENT = {
  Brazil: ['#1b7a3e', '#d4ad1f'], Argentina: ['#5aa1de', '#16345f'], France: ['#21478f', '#9a1f2e'],
  Spain: ['#b51c2a', '#d4ad1f'], Germany: ['#2f2f2f', '#c8a11a'], Italy: ['#1c4fa0', '#0d2a57'],
  England: ['#9a1f2e', '#16245f'], Uruguay: ['#4aa3e0', '#142a4a'], Netherlands: ['#e07a1f', '#16345f'],
};
function editionBackground(ed) {
  const overlay = 'linear-gradient(158deg, rgba(10,10,11,.6), rgba(10,10,11,.9))';
  if (ed?.image) return { background: `${overlay}, url(${ed.image})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  const c = NATION_GRADIENT[ed?.winner] || ['#1f2a44', '#0a0a0b'];
  return { background: `${overlay}, linear-gradient(150deg, ${c[0]}, ${c[1]})` };
}

// Real, derivable "winners archive" from the same iconicEditions data rather
// than a second hand-authored list — one source of truth.
function winnersArchive() {
  const counts = {};
  iconicEditions.forEach(e => { counts[e.winner] = (counts[e.winner] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

export default function WorldCupHistory() {
  const [activeEdition, setActiveEdition] = useState(iconicEditions[iconicEditions.length - 1]);
  const titles = winnersArchive();

  return (
    <div className="page wc2">
      <style>{`
        .wc2 { --l:#c8ff00; --line:#1c1c1c; --muted:#888; color:#fff; }
        .wc2 * { box-sizing:border-box; }
        .wc2-title { margin:4px 0 18px; }
        .wc2-title h1 { margin:0 0 6px; font:800 34px "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .wc2-title p { margin:0; color:var(--muted); font:500 13px "Barlow",sans-serif; }
        .wc2-eyebrow-sm { color:var(--l); font:700 10px "Barlow",sans-serif; letter-spacing:.14em; text-transform:uppercase; margin-bottom:12px; display:block; }
        .wch-editions { display:grid; grid-template-columns:190px 1fr; gap:16px; margin-bottom:28px; }
        @media(max-width:760px){ .wch-editions { grid-template-columns:1fr; } }
        .wch-ed-list { display:flex; flex-direction:column; gap:6px; }
        .wch-ed-btn { display:flex; align-items:center; gap:8px; background:#0f0f0f; border:1px solid var(--line); border-radius:8px; padding:9px 12px; cursor:pointer; text-align:left; }
        .wch-ed-btn.active { border-color:var(--l); background:rgba(200,255,0,.06); }
        .wch-ed-btn .yr { font:800 14px "Barlow Condensed",sans-serif; color:#fff; }
        .wch-ed-btn .host { color:var(--muted); font:500 10.5px "Barlow",sans-serif; }
        .wch-detail { border-radius:12px; padding:24px; }
        .wch-detail-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; }
        .wch-detail-top h3 { margin:8px 0 4px; font:800 22px "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .wch-detail-top .flag { font-size:30px; }
        .wch-detail-top .winner { color:#ccc; font:500 12px "Barlow",sans-serif; }
        .wch-score { text-align:right; }
        .wch-score strong { display:block; font:800 40px "Barlow Condensed",sans-serif; color:var(--l); }
        .wch-score span { color:var(--muted); font:700 9px "Barlow",sans-serif; letter-spacing:.1em; text-transform:uppercase; }
        .wch-theme { font-style:italic; color:#eee; font:600 15px "Barlow",sans-serif; margin:0 0 10px; }
        .wch-summary { color:#ccc; font:500 13px/1.65 "Barlow",sans-serif; margin:0 0 14px; }
        .wch-moment { display:flex; gap:8px; align-items:flex-start; color:#ddd; font:500 12.5px/1.5 "Barlow",sans-serif; margin-bottom:14px; }
        .wch-players { display:flex; gap:8px; flex-wrap:wrap; }
        .wch-chip { background:rgba(255,255,255,.08); border-radius:6px; padding:5px 10px; font:600 11px "Barlow",sans-serif; }
        .wc2-card { background:#0f0f0f; border:1px solid var(--line); border-radius:12px; padding:20px; margin-bottom:20px; }
        .wch-goals-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; }
        .wch-goal-card { background:#0d0d0d; border:1px solid var(--line); border-radius:10px; padding:14px; }
        .wch-goal-top { display:flex; align-items:flex-start; gap:10px; margin-bottom:8px; }
        .wch-goal-top .flag { font-size:20px; }
        .wch-goal-top strong { display:block; font:700 14px "Barlow",sans-serif; }
        .wch-goal-top span { color:var(--muted); font:500 10.5px "Barlow",sans-serif; }
        .wch-goal-year { margin-left:auto; background:rgba(200,255,0,.12); color:var(--l); font:800 10px "Barlow Condensed",sans-serif; padding:3px 7px; border-radius:5px; }
        .wch-goal-label { color:var(--l); font:800 12px "Barlow Condensed",sans-serif; text-transform:uppercase; margin-bottom:6px; }
        .wch-goal-card p { margin:0; color:#bbb; font:500 12px/1.5 "Barlow",sans-serif; }
        .wch-award-grid { display:flex; flex-direction:column; }
        .wch-award-row { display:grid; grid-template-columns:60px 30px 1fr auto; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid var(--line); }
        .wch-award-row:last-child { border-bottom:none; }
        .wch-award-year { color:var(--muted); font:800 13px "Barlow Condensed",sans-serif; }
        .wch-award-flag { font-size:16px; }
        .wch-award-player { font:700 13px "Barlow",sans-serif; }
        .wch-award-label { color:var(--l); font:700 10px "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; }
        .wch-winners-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px; }
        .wch-winner-row { display:flex; align-items:center; justify-content:space-between; background:#0d0d0d; border:1px solid var(--line); border-radius:8px; padding:10px 12px; }
        .wch-winner-row b { font:700 12.5px "Barlow",sans-serif; }
        .wch-winner-row span { color:var(--l); font:800 16px "Barlow Condensed",sans-serif; }
      `}</style>

      <WorldCupNav active="history" />

      <div className="wc2-title">
        <h1>History</h1>
        <p>Iconic editions, greatest moments, and the records that define the World Cup.</p>
      </div>

      <span className="wc2-eyebrow-sm">Iconic Editions</span>
      <div className="wch-editions">
        <div className="wch-ed-list">
          {iconicEditions.map(ed => (
            <button key={ed.year} className={`wch-ed-btn ${activeEdition.year === ed.year ? 'active' : ''}`} onClick={() => setActiveEdition(ed)}>
              <span className="flag" style={{ fontSize: 18 }}>{ed.flag}</span>
              <div><div className="yr">{ed.year}</div><div className="host">{ed.host}</div></div>
            </button>
          ))}
        </div>
        <div className="wch-detail" style={editionBackground(activeEdition)}>
          <div className="wch-detail-top">
            <div>
              <div className="flag">{activeEdition.flag}</div>
              <h3>{activeEdition.year} · {activeEdition.host}</h3>
              <div className="winner">Winners: <strong>{activeEdition.winner}</strong></div>
            </div>
            <div className="wch-score"><strong>{activeEdition.calibreScore}</strong><span>Calibre Score</span></div>
          </div>
          <p className="wch-theme">"{activeEdition.theme}"</p>
          <p className="wch-summary">{activeEdition.summary}</p>
          <div className="wch-moment"><Zap size={13} style={{ color: '#c8ff00', flexShrink: 0, marginTop: 2 }} /><span>{activeEdition.moment}</span></div>
          <div className="wch-players">{activeEdition.players.map(p => <span key={p} className="wch-chip">{p}</span>)}</div>
        </div>
      </div>

      <div className="wc2-card">
        <span className="wc2-eyebrow-sm">Greatest Moments</span>
        <h2 style={{ margin: '0 0 14px', font: '800 20px "Barlow Condensed",sans-serif', textTransform: 'uppercase' }}>Goals That Defined the Tournament</h2>
        <div className="wch-goals-grid">
          {iconicGoals.map(g => (
            <div className="wch-goal-card" key={`${g.year}-${g.scorer}`}>
              <div className="wch-goal-top">
                <span className="flag">{g.flag}</span>
                <div><strong>{g.scorer}</strong><span>{g.nation} vs {g.vs} · {g.year}</span></div>
                <span className="wch-goal-year">{g.year}</span>
              </div>
              <div className="wch-goal-label">{g.label}</div>
              <p>{g.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="wc2-card">
        <span className="wc2-eyebrow-sm">Player of the Tournament</span>
        <h2 style={{ margin: '0 0 14px', font: '800 20px "Barlow Condensed",sans-serif', textTransform: 'uppercase' }}>Golden Ball History</h2>
        <div className="wch-award-grid">
          {tournamentPlayers.map(t => (
            <div className="wch-award-row" key={t.year}>
              <span className="wch-award-year">{t.year}</span>
              <span className="wch-award-flag">{t.flag}</span>
              <strong className="wch-award-player">{t.player}</strong>
              <span className="wch-award-label">{t.award}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="wc2-card">
        <span className="wc2-eyebrow-sm">Records</span>
        <h2 style={{ margin: '0 0 14px', font: '800 20px "Barlow Condensed",sans-serif', textTransform: 'uppercase' }}>Winners Archive — Most Titles</h2>
        <div className="wch-winners-grid">
          {titles.map(([nation, count]) => (
            <div className="wch-winner-row" key={nation}><b>{nation}</b><span>{count}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
