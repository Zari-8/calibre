import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BarChart3, Clock3, Crown, Database, LockKeyhole, MessageSquare,
  Send, ShieldCheck, Swords, Trophy, X, Zap,
} from 'lucide-react';
import { navigateTo } from '../components/NavLink.jsx';
import { CURRENT_SEASON, getRecentFixtures, getStandings, getTopCreators, getTopScorers, getUpcomingFixtures, resolveLeagueId } from '../services/apiFootball.js';
import { COMPETITION_DEBATES, COMPETITION_GROUPS, featuredMatchFor, snapshotFor } from '../data/competitionData.js';

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
      <div className="comp-league-status"><span className="live-dot" /> <span>{competition.stage}</span><small>{competition.id ? 'API' : 'AUTO'}</small></div>
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

function PlayerPanel({ title, suffix, rows, stat, live = false, loading = false }) {
  return (
    <section className="comp-data-panel">
      <div className="comp-data-panel-title">{title} <span className="comp-data-panel-sub">· {suffix}</span></div>
      {rows.map(row => (
        <div className="comp-scorer-row" key={`${title}-${row.pos}-${row.name}`}>
          <span className="comp-standings-pos">{row.pos}</span><img src={row.img} alt="" /><span>{row.name}</span><small>{row.team}</small><strong>{row[stat]}</strong>
        </div>
      ))}
      <div className="comp-panel-note">{loading ? 'Refreshing competition data…' : live ? 'Live API-Football data loaded.' : 'Snapshot fallback shown until a supported feed resolves.'}</div>
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
        <div className="comp-sidebar-label">Match conversation layer</div>
        <p className="comp-sidebar-copy">Each competition hub now carries a featured match: tactical preview before kick-off, one persistent thread after full time and an API-ready fixture handoff.</p>
      </div>
      <div className="comp-login-box">
        <p>Follow matches, save reports and unlock deeper filters with Calibre Pro.</p>
        <button className="btn btn--lime btn--sm" type="button" onClick={() => navigateTo('/pricing')}>EXPLORE PRO</button>
      </div>
    </aside>
  );
}

function normalizeFixture(row, fallback) {
  if (!row?.teams || !row?.fixture) return fallback;
  const kickoff = row.fixture.date ? new Date(row.fixture.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : fallback.kickoff;
  return {
    ...fallback,
    home: row.teams.home?.name || fallback.home,
    away: row.teams.away?.name || fallback.away,
    homeLogo: row.teams.home?.logo || '',
    awayLogo: row.teams.away?.logo || '',
    kickoff,
    venue: row.fixture.venue?.name || '',
    status: row.fixture.status?.short || 'NS',
    source: 'api',
  };
}

function MatchForumModal({ match, onClose }) {
  const accountExists = Boolean(window.localStorage.getItem('calibre:user'));
  const storageKey = `calibre:match-forum:${match.slug}`;
  const [draft, setDraft] = useState('');
  const [posts, setPosts] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
      if (Array.isArray(stored)) return stored;
    } catch {}
    return [
      { user: '@CalibreMatchroom', text: 'Thread opens before kick-off and stays attached to this match after full time. Start with the tactical argument, not the score prediction.', ago: 'pinned' },
      { user: '@HalfSpaceWatch', text: `The first question is simple: can ${match.home} control the centre without leaving the transition lane open?`, ago: '6m' },
    ];
  });

  const post = () => {
    const clean = draft.trim();
    if (!clean || !accountExists) return;
    const next = [{ user: '@You', text: clean, ago: 'now' }, ...posts];
    setPosts(next);
    setDraft('');
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  };

  const requestAccountAccess = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('calibre:open-auth', { detail: { returnTo: '/competitions' } }));
  };

  return (
    <div className="match-forum-modal" role="presentation" onMouseDown={onClose}>
      <section className="match-forum-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="match-forum-title" onMouseDown={event => event.stopPropagation()}>
        <button className="match-forum-modal__close" type="button" aria-label="Close match forum" onClick={onClose}><X size={18} /></button>
        <div className="match-forum-modal__kicker"><MessageSquare size={14} /> Matchroom forum · pregame to postgame</div>
        <h3 id="match-forum-title">{match.home} <em>vs</em> {match.away}</h3>
        <p>The thread travels with the fixture. Pregame arguments, live reactions and post-match verdicts stay in one place.</p>
        {accountExists ? (
          <>
            <div className="match-forum-composer">
              <textarea rows="3" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Add your tactical argument. Keep it sharp." />
              <button type="button" className="btn btn--lime btn--sm" onClick={post}>POST TO MATCHROOM <Send size={12} /></button>
            </div>
            <div className="match-forum-posts">
              {posts.map((item, index) => <article key={`${item.user}-${index}`}><header><strong>{item.user}</strong><span>{item.ago}</span></header><p>{item.text}</p></article>)}
            </div>
          </>
        ) : (
          <div className="match-forum-locked"><LockKeyhole size={20} /><div><b>Account access required</b><span>Anyone can read the match preview. A Calibre account is required to post, reply and follow the post-match discussion.</span></div><button type="button" className="btn btn--lime btn--sm" onClick={requestAccountAccess}>LOG IN OR CREATE ACCOUNT</button></div>
        )}
      </section>
    </div>
  );
}

function FeaturedMatch({ match, openForum }) {
  return (
    <section className="matchroom-card">
      <div className="matchroom-topline"><span><i /> FEATURED MATCHROOM</span><em>{match.source === 'api' ? 'LIVE FIXTURE FEED' : 'PREVIEW SNAPSHOT · API READY'}</em></div>
      <div className="matchroom-grid">
        <div className="matchroom-scoreboard">
          <div className="matchroom-kickoff"><Clock3 size={13} /> {match.kickoff}{match.venue ? ` · ${match.venue}` : ''}</div>
          <div className="matchroom-teams">
            <div>{match.homeLogo ? <img src={match.homeLogo} alt="" /> : <span>{match.home.slice(0, 3).toUpperCase()}</span>}<b>{match.home}</b><small>{match.homeShape}</small></div>
            <strong>VS</strong>
            <div>{match.awayLogo ? <img src={match.awayLogo} alt="" /> : <span>{match.away.slice(0, 3).toUpperCase()}</span>}<b>{match.away}</b><small>{match.awayShape}</small></div>
          </div>
          <button type="button" className="btn btn--lime btn--sm" onClick={openForum}>OPEN POST-MATCH FORUM <MessageSquare size={13} /></button>
          <p>Thread opens before kick-off and stays live after full time.</p>
        </div>
        <div className="matchroom-analysis">
          <span className="matchroom-label"><Swords size={13} /> Pregame analysis</span>
          <h2>{match.headline}</h2>
          <p>{match.pregame}</p>
          <div className="matchroom-key"><ShieldCheck size={14} /><span><b>KEY DUEL</b>{match.keyDuel}</span></div>
        </div>
        <div className="matchroom-signals">
          <span className="matchroom-label"><BarChart3 size={13} /> Match signals</span>
          <div><b>Tempo</b><strong>{match.tempo}</strong></div>
          <div><b>xG outlook</b><strong>{match.xg}</strong></div>
          <div><b>BTTS context</b><strong>{match.btts}</strong></div>
          <div><b>Primary threat</b><strong>{match.threat}</strong></div>
          <small>Context only. No explicit picks.</small>
        </div>
      </div>
    </section>
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
  const [liveState, setLiveState] = useState({ standings: false, scorers: false, creators: false, fixture: false });
  const [loading, setLoading] = useState(false);
  const live = Object.values(liveState).some(Boolean);
  const [featuredMatch, setFeaturedMatch] = useState(() => featuredMatchFor(active));
  const [forumOpen, setForumOpen] = useState(false);

  useEffect(() => { setActiveName(COMPETITION_GROUPS[group][0].name); }, [group]);

  useEffect(() => {
    const fallback = snapshotFor(active);
    const fallbackMatch = featuredMatchFor(active);
    setStandings(fallback.standings);
    setScorers(fallback.scorers);
    setCreators(fallback.creators);
    setFeaturedMatch(fallbackMatch);
    setLiveState({ standings: false, scorers: false, creators: false, fixture: false });
    let cancelled = false;
    setLoading(true);

    (async () => {
      const season = active.season || CURRENT_SEASON;
      const leagueId = await resolveLeagueId(active, season);
      if (!leagueId || cancelled) return;

      const [standingRows, scorerRows, creatorRows, upcomingRows] = await Promise.all([
        active.table ? getStandings(leagueId, season) : Promise.resolve(null),
        getTopScorers(leagueId, season),
        getTopCreators(leagueId, season),
        getUpcomingFixtures(leagueId, season, 1),
      ]);
      if (cancelled) return;

      if (standingRows?.length) {
        setStandings(standingRows.slice(0, 5).map(team => ({
          pos: team.rank, team: team.team.name, P: team.all.played, W: team.all.win, D: team.all.draw, L: team.all.lose,
          GD: team.goalsDiff >= 0 ? `+${team.goalsDiff}` : String(team.goalsDiff), pts: team.points,
          form: (team.form || '').split('').slice(0, 5).map(result => result === 'W' ? 'W' : result === 'D' ? 'D' : 'L'),
        })));
        setLiveState(current => ({ ...current, standings: true }));
      }
      if (scorerRows?.length) {
        setScorers(scorerRows.slice(0, 5).map((row, index) => ({
          pos: index + 1, name: row.player.name, team: row.statistics?.[0]?.team?.name || '—',
          goals: row.statistics?.[0]?.goals?.total || 0, img: row.player.photo || fallback.scorers[index]?.img,
        })));
        setLiveState(current => ({ ...current, scorers: true }));
      }
      if (creatorRows?.length) {
        setCreators(creatorRows.map((row, index) => ({
          pos: index + 1, name: row.player.name, team: row.team || '—', assists: row.assists || 0,
          img: row.player.photo || fallback.creators[index]?.img,
        })));
        setLiveState(current => ({ ...current, creators: true }));
      }

      let fixtureRows = upcomingRows;
      if (!fixtureRows?.length) fixtureRows = await getRecentFixtures(leagueId, season, 1);
      if (!cancelled && fixtureRows?.[0]) {
        setFeaturedMatch(normalizeFixture(fixtureRows[0], fallbackMatch));
        setLiveState(current => ({ ...current, fixture: true }));
      }
    })()
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
              <div className="comp-hero-eyebrow">{group}</div><div className="comp-hero-title">{active.name}</div><div className="comp-hero-season">{active.country} · {active.stage}</div>
              <div className="comp-hero-desc">{active.hero}. Explore standings, match analysis, form, scorers and creators without leaving the category hub.</div>
              <button className="btn btn--lime btn--sm" type="button">VIEW COMPETITION HUB <ArrowRight size={13} /></button>
            </div>
            <div className="comp-hero-right"><div className="comp-hero-next-label">DATA STATUS</div><div className="comp-status-card"><Database size={17} /><b>{live ? 'LIVE DATABASE' : 'SNAPSHOT READY'}</b><span>{live ? `${Object.values(liveState).filter(Boolean).length}/4 feeds refreshed` : 'Fallback model active'}</span></div></div>
          </section>

          <div className="comp-type-tabs">{GROUPS.map(item => <button type="button" key={item} className={`comp-type-tab ${group === item ? 'active' : ''}`} onClick={() => setGroup(item)}>{item}</button>)}</div>
          <div className="comp-leagues-grid">{competitions.map(item => <CompetitionCard key={item.name} competition={item} active={item.name === active.name} onClick={() => setActiveName(item.name)} />)}</div>

          <FeaturedMatch match={featuredMatch} openForum={() => setForumOpen(true)} />

          <div className="comp-data-grid comp-data-grid--v7">
            <StandingsPanel competition={active} standings={standings} live={liveState.standings} loading={loading} /><FormPanel standings={standings} /><PlayerPanel title="Top Scorers" suffix={active.name} rows={scorers} stat="goals" live={liveState.scorers} loading={loading} /><PlayerPanel title="Top Creators" suffix={active.name} rows={creators} stat="assists" live={liveState.creators} loading={loading} />
          </div>

          <div className="comp-lower">
            <section className="panel"><div className="panel-head"><div className="panel-title">Category Intelligence</div><Trophy size={15} /></div><div className="comp-intelligence-box"><b>{competitions.length}</b><span>working competition hubs in {group}</span></div></section>
            <section className="panel"><div className="panel-head"><div className="panel-title">Hot Debates</div><span className="panel-action">{group}</span></div>{debates.map(text => <button type="button" className="row-item comp-debate-row" key={text} onClick={() => navigateTo('/debates')}>{text}<ArrowRight size={13} /></button>)}</section>
            <section className="panel"><div className="panel-head"><div className="panel-title">Coverage Architecture</div></div><div className="comp-coverage-list"><span><i /> League database refresh</span><span><i /> Featured fixture handoff</span><span><i /> Pregame tactical model</span><span><i /> Persistent post-match thread</span></div></section>
          </div>
        </main>
      </div>
      <div className="founder-strip"><Crown size={22} className="founder-strip-icon" /><strong>Get World Cup Founder Pass</strong><span>Unlock premium reports, advanced filters and exclusive World Cup intelligence.</span><button type="button" className="btn btn--lime" onClick={() => navigateTo('/pricing')}>EXPLORE PLANS <ArrowRight size={14} /></button></div>
      {forumOpen && <MatchForumModal match={featuredMatch} onClose={() => setForumOpen(false)} />}
    </div>
  );
}
