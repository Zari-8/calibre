import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Crown, Database, Trophy } from 'lucide-react';
import { navigateTo } from '../components/NavLink.jsx';
import { CURRENT_SEASON, getStandings, getTopScorers } from '../services/apiFootball.js';
import { COMPETITION_DEBATES, COMPETITION_GROUPS, snapshotFor } from '../data/competitionData.js';

const GROUPS = ['Top Leagues', 'Top Tournaments', 'Domestic Cups', "Women's Football"];

function FormBadge({ result }) {
  return <span className={`form-badge form-badge--${result}`}>{result}</span>;
}

function CompetitionCard({ competition, active, onClick }) {
  return (
    <button type="button" className={`comp-league-card ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="comp-logo-token">{competition.logo}</div>
      <div className="comp-league-name">{competition.name}</div>
      <div className="comp-league-country">{competition.country}</div>
      <div className="comp-league-status"><span className="live-dot" /> <span>{competition.stage}</span></div>
    </button>
  );
}

function StandingsPanel({ competition, standings, live, loading }) {
  return (
    <section className="comp-data-panel">
      <div className="comp-data-panel-title">Standings Snapshot <span className="comp-data-panel-sub">· {competition.name}</span>{live && <em>LIVE</em>}</div>
      <div className="comp-standings-row header"><span>#</span><span>TEAM</span><span>P</span><span>GD</span><span>PTS</span></div>
      {standings.map(row => (
        <div className="comp-standings-row" key={`${competition.name}-${row.pos}`}>
          <span className="comp-standings-pos">{row.pos}</span><span className="comp-standings-name">{row.team}</span><span>{row.P}</span><span>{row.GD}</span><span className="comp-standings-pts">{row.pts}</span>
        </div>
      ))}
      <div className="comp-panel-note">{loading ? 'Refreshing competition data…' : live ? 'Live API-Football standings loaded.' : 'Snapshot data shown. Live refresh activates where standings are available.'}</div>
    </section>
  );
}

function FormPanel({ standings }) {
  return (
    <section className="comp-data-panel">
      <div className="comp-data-panel-title">Form Guide <span className="comp-data-panel-sub">· LAST 5</span></div>
      {standings.map(row => (
        <div className="comp-form-row" key={`form-${row.team}`}>
          <span>{row.team}</span><div>{(row.form || []).map((result, index) => <FormBadge key={`${row.team}-${index}`} result={result} />)}</div><strong>{row.pts}</strong>
        </div>
      ))}
    </section>
  );
}

function PlayerPanel({ title, suffix, rows, stat }) {
  return (
    <section className="comp-data-panel">
      <div className="comp-data-panel-title">{title} <span className="comp-data-panel-sub">· {suffix}</span></div>
      {rows.map(row => (
        <div className="comp-scorer-row" key={`${title}-${row.pos}-${row.name}`}>
          <span className="comp-standings-pos">{row.pos}</span><img src={row.img} alt="" /><span>{row.name}</span><small>{row.team}</small><strong>{row[stat]}</strong>
        </div>
      ))}
    </section>
  );
}

function Sidebar({ group, setGroup }) {
  return (
    <aside className="comp-sidebar">
      <div className="comp-sidebar-title">Competitions</div>
      <div className="comp-sidebar-label">Browse</div>
      {GROUPS.map(item => <button type="button" className={`comp-sidebar-link ${group === item ? 'active' : ''}`} key={item} onClick={() => setGroup(item)}>{item}</button>)}
      <div className="comp-my-section">
        <div className="comp-sidebar-label">Why this matters</div>
        <p className="comp-sidebar-copy">Every category now generates its own usable data view. Top leagues can refresh from the football database. Tournament, cup and women’s hubs retain fallback snapshots until their dedicated feeds are connected.</p>
      </div>
      <div className="comp-login-box">
        <p>Follow competitions, save reports and unlock deeper filters with Calibre Pro.</p>
        <button className="btn btn--lime btn--sm" type="button" onClick={() => navigateTo('/pricing')}>EXPLORE PRO</button>
      </div>
    </aside>
  );
}

export default function Competitions() {
  const [group, setGroup] = useState('Top Leagues');
  const competitions = COMPETITION_GROUPS[group];
  const [activeName, setActiveName] = useState(competitions[0].name);
  const active = useMemo(() => competitions.find(item => item.name === activeName) || competitions[0], [activeName, competitions]);
  const initialSnapshot = useMemo(() => snapshotFor(active), [active]);
  const [standings, setStandings] = useState(initialSnapshot.standings);
  const [scorers, setScorers] = useState(initialSnapshot.scorers);
  const [creators, setCreators] = useState(initialSnapshot.creators);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setActiveName(COMPETITION_GROUPS[group][0].name);
  }, [group]);

  useEffect(() => {
    const fallback = snapshotFor(active);
    setStandings(fallback.standings);
    setScorers(fallback.scorers);
    setCreators(fallback.creators);
    setLive(false);
    if (!active.table || !active.id) return undefined;
    let cancelled = false;
    setLoading(true);
    Promise.all([getStandings(active.id, CURRENT_SEASON), getTopScorers(active.id, CURRENT_SEASON)])
      .then(([standingRows, scorerRows]) => {
        if (cancelled) return;
        if (standingRows?.length) {
          setStandings(standingRows.slice(0, 5).map(team => ({
            pos: team.rank,
            team: team.team.name,
            P: team.all.played,
            W: team.all.win,
            D: team.all.draw,
            L: team.all.lose,
            GD: team.goalsDiff >= 0 ? `+${team.goalsDiff}` : String(team.goalsDiff),
            pts: team.points,
            form: (team.form || '').split('').slice(0, 5).map(result => result === 'W' ? 'W' : result === 'D' ? 'D' : 'L'),
          })));
          setLive(true);
        }
        if (scorerRows?.length) {
          setScorers(scorerRows.slice(0, 5).map((row, index) => ({
            pos: index + 1,
            name: row.player.name,
            team: row.statistics?.[0]?.team?.name || '—',
            goals: row.statistics?.[0]?.goals?.total || 0,
            img: row.player.photo || fallback.scorers[index]?.img,
          })));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active]);

  const debates = COMPETITION_DEBATES[group];

  return (
    <div className="page" style={{ paddingTop: 16 }}>
      <div className="comp-page">
        <Sidebar group={group} setGroup={setGroup} />
        <main className="comp-main">
          <section className="comp-hero">
            <div className="comp-hero-bg">{active.logo}</div>
            <div className="comp-hero-left">
              <div className="comp-hero-eyebrow">{group}</div>
              <div className="comp-hero-title">{active.name}</div>
              <div className="comp-hero-season">{active.country} · {active.stage}</div>
              <div className="comp-hero-desc">{active.hero}. Explore standings, form, scorers and creators without leaving the category hub.</div>
              <button className="btn btn--lime btn--sm" type="button">VIEW COMPETITION HUB <ArrowRight size={13} /></button>
            </div>
            <div className="comp-hero-right">
              <div className="comp-hero-next-label">DATA STATUS</div>
              <div className="comp-status-card"><Database size={17} /><b>{live ? 'LIVE DATABASE' : 'SNAPSHOT READY'}</b><span>{live ? 'API-Football refresh active' : 'Fallback model active'}</span></div>
            </div>
          </section>

          <div className="comp-type-tabs">
            {GROUPS.map(item => <button type="button" key={item} className={`comp-type-tab ${group === item ? 'active' : ''}`} onClick={() => setGroup(item)}>{item}</button>)}
          </div>

          <div className="comp-leagues-grid">
            {competitions.map(item => <CompetitionCard key={item.name} competition={item} active={item.name === active.name} onClick={() => setActiveName(item.name)} />)}
          </div>

          <div className="comp-data-grid comp-data-grid--v7">
            <StandingsPanel competition={active} standings={standings} live={live} loading={loading} />
            <FormPanel standings={standings} />
            <PlayerPanel title="Top Scorers" suffix={active.name} rows={scorers} stat="goals" />
            <PlayerPanel title="Top Creators" suffix={active.name} rows={creators} stat="assists" />
          </div>

          <div className="comp-lower">
            <section className="panel">
              <div className="panel-head"><div className="panel-title">Category Intelligence</div><Trophy size={15} /></div>
              <div className="comp-intelligence-box"><b>{competitions.length}</b><span>working competition hubs in {group}</span></div>
            </section>
            <section className="panel">
              <div className="panel-head"><div className="panel-title">Hot Debates</div><span className="panel-action">{group}</span></div>
              {debates.map(text => <button type="button" className="row-item comp-debate-row" key={text} onClick={() => navigateTo('/debates')}>{text}<ArrowRight size={13} /></button>)}
            </section>
            <section className="panel">
              <div className="panel-head"><div className="panel-title">Coverage Architecture</div></div>
              <div className="comp-coverage-list"><span><i /> League database refresh</span><span><i /> Tournament snapshot layer</span><span><i /> Women’s football category layer</span><span><i /> Domestic-cup category layer</span></div>
            </section>
          </div>
        </main>
      </div>
      <div className="founder-strip"><Crown size={22} className="founder-strip-icon" /><strong>Get World Cup Founder Pass</strong><span>Unlock premium reports, advanced filters and exclusive World Cup intelligence.</span><button type="button" className="btn btn--lime" onClick={() => navigateTo('/pricing')}>EXPLORE PLANS <ArrowRight size={14} /></button></div>
    </div>
  );
}
