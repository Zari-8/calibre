import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import WorldCupNav from '../components/WorldCupNav.jsx';
import ApiTeamLogo from '../components/ApiTeamLogo.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import { navigateTo } from '../components/NavLink.jsx';
import { getGroupedStandings, getSquad } from '../services/apiFootball.js';

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

export default function WorldCupTeams() {
  const [groups, setGroups] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getGroupedStandings(WC_LEAGUE_ID, WC_SEASON);
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

  // Squad viewer — real roster from API-Football's /players/squads, fetched
  // on demand per team (not eagerly for all 48, to spare the API quota).
  const [squadFor, setSquadFor] = useState(null);
  const [squad, setSquad] = useState(null);
  const [squadLoading, setSquadLoading] = useState(false);
  const [squadError, setSquadError] = useState(false);

  async function openSquad(team) {
    setSquadFor(team);
    setSquad(null);
    setSquadError(false);
    setSquadLoading(true);
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
    const groupsMap = new Map();
    squad.forEach(p => {
      const pos = p.position || 'Unknown';
      if (!groupsMap.has(pos)) groupsMap.set(pos, []);
      groupsMap.get(pos).push(p);
    });
    const known = POSITION_ORDER.filter(p => groupsMap.has(p)).map(p => [p, groupsMap.get(p)]);
    const rest = [...groupsMap.entries()].filter(([p]) => !POSITION_ORDER.includes(p));
    return [...known, ...rest];
  }, [squad]);

  const filtered = teams.filter(t =>
    (groupFilter === 'All' || t.group === groupFilter) &&
    (confFilter === 'All' || t.confederation === confFilter)
  );

  return (
    <div className="page wc2">
      <style>{`
        .wc2 { --l:#97cc0d; --line:#1c1c1c; --muted:#888; color:#fff; }
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
        .wct-btnrow { display:flex; gap:8px; }
        .wct-btn { flex:1; width:100%; background:none; border:1px solid var(--line); color:var(--l); font:700 10.5px "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; padding:8px; border-radius:7px; cursor:pointer; }
        .wct-btn:hover { border-color:var(--l); }
        .wct-empty { color:var(--muted); font:500 13px/1.6 "Barlow",sans-serif; text-align:center; padding:60px 0; }
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
              <div className="wct-uncomputed">Calibre rating and strengths/weaknesses need deeper per-player modeling — not shown yet. Squad list below is real.</div>
              <div className="wct-btnrow">
                <button className="wct-btn" onClick={() => openSquad(t)}>View Squad</button>
                <button className="wct-btn" onClick={() => navigateTo('/world-cup/groups')}>Group {t.group} →</button>
              </div>
            </div>
          ))}
        </div>
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
