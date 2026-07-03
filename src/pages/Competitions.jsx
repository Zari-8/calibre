import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BarChart3, Clock3, Crown, Database, LockKeyhole, MessageSquare,
  Send, ShieldCheck, Swords, Trophy, X,
} from 'lucide-react';
import { navigateTo } from '../components/NavLink.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import { playerIdFor } from '../data/playerIds.js';
import ApiTeamLogo from '../components/ApiTeamLogo.jsx';
import ApiLeagueLogo from '../components/ApiLeagueLogo.jsx';
import useAuth from '../hooks/useAuth.js';
import { loadForumPosts, submitForumPost } from '../services/community.js';
import { CURRENT_SEASON, getRecentFixtures, getStandings, getTopCreators, getTopScorers, getUpcomingFixtures, resolveLeagueId, leagueLogoUrl, searchTeams } from '../services/apiFootball.js';
import { getSupabasePlayersByApiIds } from '../services/supabasePlayers.js';
import { resolveRating } from '../services/calibreRating.js';
import { COMPETITION_GROUPS, featuredMatchFor, snapshotFor, isKnockoutCompetition } from '../data/competitionData.js';
import { SYSTEM_TEAMS } from '../data/systemFitData.js';
import PremierBetBanner from '../components/PremierBetBanner.jsx';

const GROUPS = ['Top Leagues', 'Top Tournaments', 'Domestic Cups', "Women's Football"];

function FormBadge({ result }) { return <span className={`form-badge form-badge--${result}`}>{result}</span>; }

function CompetitionCard({ competition, active, onClick }) {
  const logo = competition.logoUrl || leagueLogoUrl(competition.id);
  return (
    <button type="button" className={`comp-league-card ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="comp-logo-token"><ApiLeagueLogo id={competition.id} src={logo} name={competition.name} fallback={competition.logo}/></div>
      <div className="comp-league-name">{competition.name}</div>
      <div className="comp-league-country">{competition.country}</div>
      <div className="comp-league-status"><span className="live-dot" /> <span>{competition.stage}</span><small>{competition.id ? 'API' : 'AUTO'}</small></div>
    </button>
  );
}

function StandingsModal({ competition, standings, onClose }) {
  return (
    <div className="match-forum-modal" role="presentation" onMouseDown={onClose}>
      <section className="match-forum-modal__dialog" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <button className="match-forum-modal__close" type="button" aria-label="Close table" onClick={onClose}><X size={18} /></button>
        <div className="match-forum-modal__kicker"><BarChart3 size={14} /> Full table · {competition.name}</div>
        <h3>{competition.name} <em>standings</em></h3>
        <div className="comp-fulltable">
          <div className="comp-fulltable-row header"><span>#</span><span>TEAM</span><span>P</span><span>GD</span><span>PTS</span><span>FORM</span></div>
          {standings.map(row => (
            <div className="comp-fulltable-row" key={`ft-${row.pos}-${row.team}`}>
              <span className="comp-standings-pos">{row.pos}</span>
              <span className="comp-standings-name" title={row.team}>{row.team}</span>
              <span>{row.P}</span><span>{row.GD}</span><span className="comp-standings-pts">{row.pts}</span>
              <span className="comp-ft-form">{(row.form || []).map((r, i) => <FormBadge key={i} result={r} />)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StandingsPanel({ competition, standings, live, loading, unavailable }) {
  const [fullOpen, setFullOpen] = useState(false);
  // Knockout / cup: there's no league ladder — show the field of clubs + round.
  if (isKnockoutCompetition(competition)) {
    const field = (competition.teams || []).slice(0, 12);
    return (
      <section className="comp-data-panel">
        <div className="comp-data-panel-title">Competition Field <span className="comp-data-panel-sub">· {competition.name}</span></div>
        <div className="comp-field-round">{competition.stage}</div>
        <div className="comp-field-list">
          {field.map((t, i) => (
            <div className="comp-field-row" key={t}>
              <span className="comp-field-pos">{i + 1}</span>
              <SmartCrest name={t} className="comp-field-logo" />
              <span className="comp-field-name" title={t}>{t}</span>
            </div>
          ))}
          {!field.length && <div className="comp-empty-state">The field for this competition loads from the live feed.</div>}
        </div>
        <div className="comp-panel-note">{competition.stage} — {field.length} clubs in the field. The bracket and fixtures resolve from the live feed.</div>
      </section>
    );
  }
  const rows = standings.slice(0, 8);
  return (
    <section className="comp-data-panel">
      <div className="comp-data-panel-title">Standings Snapshot <span className="comp-data-panel-sub">· {competition.name}</span>{live && <em>LIVE</em>}</div>
      <div className="comp-standings-row header"><span>#</span><span>TEAM</span><span>P</span><span>GD</span><span>PTS</span></div>
      {rows.map(row => (
        <div className="comp-standings-row" key={`${competition.name}-${row.pos}-${row.team}`}>
          <span className="comp-standings-pos">{row.pos}</span><span className="comp-standings-name" title={row.team}>{row.team}</span><span>{row.P}</span><span>{row.GD}</span><span className="comp-standings-pts">{row.pts}</span>
        </div>
      ))}
      {!standings.length && <div className="comp-empty-state">{unavailable || 'No competition standings are available for this stage.'}</div>}
      <div className="comp-panel-note">{loading ? 'Refreshing competition data…' : live ? 'Live API-Football competition standings loaded.' : unavailable || 'Snapshot data shown while the supported feed resolves.'}</div>
      {standings.length > rows.length && <button type="button" className="mr-fulltable" onClick={() => setFullOpen(true)}>VIEW FULL TABLE <ArrowRight size={12} /></button>}
      {fullOpen && <StandingsModal competition={competition} standings={standings} onClose={() => setFullOpen(false)} />}
    </section>
  );
}

function FormPanel({ standings }) {
  return (
    <section className="comp-data-panel">
      <div className="comp-data-panel-title">Form Guide <span className="comp-data-panel-sub">· LAST 5</span></div>
      {standings.map(row => <div className="comp-form-row" key={`form-${row.team}`}><span title={row.team}>{row.team}</span><div>{(row.form || []).map((result, index) => <FormBadge key={`${row.team}-${index}`} result={result} />)}</div><strong>{row.pts}</strong></div>)}
      {!standings.length && <div className="comp-empty-state">Form guide loads when the selected competition publishes a table.</div>}
    </section>
  );
}

function PlayerPanel({ title, suffix, rows, stat, live = false, loading = false }) {
  return (
    <section className="comp-data-panel">
      <div className="comp-data-panel-title">{title} <span className="comp-data-panel-sub">· {suffix}</span>{live && <em>LIVE</em>}</div>
      {rows.map(row => {
        const resolvedId = row.apiPlayerId || row.id || playerIdFor(row.name);
        const open = () => {
          if (!resolvedId) return;
          navigateTo(`/players?playerId=${encodeURIComponent(resolvedId)}&player=${encodeURIComponent(row.name)}`);
        };
        return (
        <div
          className="comp-scorer-row"
          key={`${title}-${row.pos}-${row.name}`}
          role={resolvedId ? "button" : undefined}
          tabIndex={resolvedId ? 0 : -1}
          title={resolvedId ? `Open ${row.name} profile` : undefined}
          style={resolvedId ? { cursor: "pointer" } : undefined}
          onClick={open}
          onKeyDown={(event) => {
            if (!resolvedId || (event.key !== "Enter" && event.key !== " ")) return;
            event.preventDefault();
            open();
          }}
        >
          <span className="comp-standings-pos">{row.pos}</span><ApiPlayerImage playerId={resolvedId} name={row.name} preferredSrc={row.img} fallbackSrc="/assets/players/neutral-player.svg" alt="" loading="lazy"/><span title={row.name}>{row.name}</span><small title={row.team}>{row.team}</small>{row.cal!=null&&<span style={{fontFamily:"'Barlow Condensed', sans-serif",fontSize:11,fontWeight:800,color:row.cal>=80?'#c8ff00':row.cal>=72?'#f59e0b':'#888',marginRight:8,padding:'1px 6px',border:'1px solid #2a2a2a',borderRadius:3}} title="Calibre rating">CAL {row.cal}</span>}<strong>{row[stat]}</strong>
        </div>
        );
      })}
      {!rows.length && <div className="comp-empty-state">Player statistics are not available for this competition feed yet.</div>}
      <div className="comp-panel-note">{loading ? 'Refreshing competition data…' : live ? 'Live API-Football player data loaded.' : 'Snapshot fallback shown where the provider has not returned player statistics.'}</div>
    </section>
  );
}

function Sidebar({ group, setGroup }) {
  const jump = sel => document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const TOOLS = [
    ['Standings', '#comp-data'],
    ['Fixtures', '#comp-matchrooms'],
    ['Matchrooms', '#comp-matchrooms'],
    ['Stats Hub', '#comp-data'],
    ['Scorers & Creators', '#comp-data'],
  ];
  return (
    <aside className="comp-sidebar">
      <div className="comp-sidebar-title">Competitions</div>
      <div className="comp-sidebar-label">Browse</div>
      {GROUPS.map(item => <button type="button" className={`comp-sidebar-link ${group === item ? 'active' : ''}`} key={item} onClick={() => setGroup(item)}>{item}</button>)}
      <div className="comp-my-section">
        <div className="comp-sidebar-label">Data &amp; Tools</div>
        {TOOLS.map(([label, target]) => <button type="button" className="comp-sidebar-link" key={label} onClick={() => jump(target)}>{label}</button>)}
      </div>
      <div className="comp-login-box">
        <div className="comp-sidebar-label" style={{ marginBottom: 6 }}>Unlock deeper insights</div>
        <p>Advanced competition data, historical trends and predictive models with Calibre Pro.</p>
        <button className="btn btn--lime btn--sm" type="button" onClick={() => navigateTo('/pricing')}>EXPLORE PRO</button>
      </div>
    </aside>
  );
}

// League-insights cards are derived from the real standings + scorer feed only
// (no invented xG / goals-per-game). Title race, form and GD are honest reads.
// Insights that are NOT already readable from the standings ladder or the top-
// scorers panel: leader pace (pts/game + projection), assist leader (creators
// aren't shown on the page), goal-contribution leader (goals+assists merged),
// and last-5 momentum (form isn't shown in the standings column).
function deriveInsights(standings, scorers, creators) {
  const rows = Array.isArray(standings) ? standings : [];
  const num = v => Number(String(v ?? '').replace('+', '')) || 0;
  const leader = rows[0] || null;
  const ppg = leader && num(leader.P) ? num(leader.pts) / num(leader.P) : 0;
  const projected = ppg ? Math.round(ppg * 38) : 0;
  const topCreator = (creators || [])[0] || null;
  const contrib = {};
  (scorers || []).forEach(s => { contrib[s.name] = contrib[s.name] || { name: s.name, team: s.team, g: 0, a: 0 }; contrib[s.name].g += Number(s.goals) || 0; });
  (creators || []).forEach(c => { contrib[c.name] = contrib[c.name] || { name: c.name, team: c.team, g: 0, a: 0 }; contrib[c.name].a += Number(c.assists) || 0; });
  const contribLeader = Object.values(contrib).sort((a, b) => (b.g + b.a) - (a.g + a.a))[0] || null;
  let momo = null, momoPts = -1;
  rows.forEach(r => { const f = r.form || []; const p = f.reduce((a, x) => a + (x === 'W' ? 3 : x === 'D' ? 1 : 0), 0); if (f.length && p > momoPts) { momoPts = p; momo = { team: r.team, pts: p, n: f.length }; } });
  return { leader, ppg, projected, topCreator, contribLeader, momo };
}

function slugify(value='') { return String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function analysisForFixture(home, away, competition) {
  return {
    headline: matchroomHeadline(home, away),
    pregame:`${home} and ${away} now share one fixture-specific Matchroom. The live fixture feed supplies the matchup; the Calibre layer frames the tactical argument around territory, progression and transition protection rather than recycling analysis written for another game.`,
    keyDuel:`${home} progression lanes vs ${away} transition protection`, tempo:'Coming soon', xg:'Coming soon', btts:'Coming soon', threat:`${home} structure vs ${away} transition`,
  };
}
function matchroomHeadline(home, away) {
  const seed = `${home}-${away}`
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0);

  const prompts = [
    `Where does ${home} vs ${away} break open?`,
    `Can ${home} control the game before ${away} turn it into a transition battle?`,
    `What happens when ${home}'s structure meets ${away}'s first wave?`,
    `Does ${away} have an answer when ${home} attack the second phase?`,
    `Which side wins the territory war: ${home} or ${away}?`,
    `Can ${home} survive ${away}'s pressure without surrendering the game state?`,
    `Who controls the spaces that decide ${home} vs ${away}?`,
    `Does this game belong to ${home}'s build-up or ${away}'s counterpress?`,
  ];

  return prompts[seed % prompts.length];
}

function normalizeFixture(row, fallback, competition) {
  if (!row?.teams || !row?.fixture) return fallback;
  const home = row.teams.home?.name || fallback.home;
  const away = row.teams.away?.name || fallback.away;
  const kickoff = row.fixture.date ? new Date(row.fixture.date).toLocaleString([], { dateStyle:'medium', timeStyle:'short' }) : fallback.kickoff;
  const sameFixture = fallback.home === home && fallback.away === away;
  return {
    ...fallback, ...(sameFixture ? {} : analysisForFixture(home, away, competition)),
    home, away, homeLogo:row.teams.home?.logo || '', awayLogo:row.teams.away?.logo || '', kickoff,
    venue:row.fixture.venue?.name || '', status:row.fixture.status?.short || 'NS', fixtureId:row.fixture.id,
    slug:slugify(`${competition.name}-${row.fixture.id || `${home}-${away}`}`), source:'api',
  };
}

function MatchForumModal({ match, onClose }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [posts, setPosts] = useState([]);
  const [notice, setNotice] = useState('');
  useEffect(()=>{ loadForumPosts(match.slug).then(setPosts).catch(()=>setPosts([])); },[match.slug]);
  const post = async () => {
    const clean=draft.trim(); if (!clean || !user) return;
    try { const saved=await submitForumPost({threadSlug:match.slug,body:clean,user}); setPosts(current=>[saved,...current]); setDraft(''); setNotice('Post added to this match thread.'); }
    catch (error) { setNotice(error?.message || 'Post could not be saved.'); }
  };
  const requestAccountAccess=()=>{ onClose(); window.dispatchEvent(new CustomEvent('calibre:open-auth',{detail:{returnTo:'/competitions'}})); };
  return <div className="match-forum-modal" role="presentation" onMouseDown={onClose}><section className="match-forum-modal__dialog" role="dialog" aria-modal="true" onMouseDown={event=>event.stopPropagation()}><button className="match-forum-modal__close" type="button" aria-label="Close match forum" onClick={onClose}><X size={18}/></button><div className="match-forum-modal__kicker"><MessageSquare size={14}/> Matchroom forum · pregame to postgame</div><h3>{match.home} <em>vs</em> {match.away}</h3><p>The thread travels with the fixture. Pregame arguments, live reactions and post-match verdicts stay in one place.</p>{match.headline&&<div className="mr-analysis-box"><span className="matchroom-label"><Swords size={13}/> Pregame analysis</span><h4>{match.headline}</h4>{match.pregame&&<p>{match.pregame}</p>}{match.keyDuel&&<div className="mr-analysis-key"><ShieldCheck size={14}/><span><b>KEY DUEL</b>{match.keyDuel}</span></div>}<div className="mr-signals"><div><b>Tempo</b><span className={match.tempo==='Coming soon'?'soon':''}>{match.tempo}</span></div><div><b>xG outlook</b><span className={match.xg==='Coming soon'?'soon':''}>{match.xg}</span></div><div><b>BTTS context</b><span className={match.btts==='Coming soon'?'soon':''}>{match.btts}</span></div><div><b>Primary threat</b><span>{match.threat}</span></div></div></div>}{user?<><div className="match-forum-composer"><textarea rows="3" value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Add your tactical argument…"/><button type="button" className="btn btn--lime btn--sm" onClick={post}><Send size={13}/> POST</button></div>{notice&&<small>{notice}</small>}<div className="match-forum-posts">{posts.length?posts.map((item,index)=><article key={`${item.created_at}-${index}`}><b>{item.author_email || '@CalibreUser'}</b><p>{item.body}</p><small>{item.created_at?new Date(item.created_at).toLocaleString():'now'}</small></article>):<div className="comp-empty-state">Start the tactical discussion.</div>}</div></>:<div className="match-forum-locked"><LockKeyhole size={20}/><div><b>Verified account required</b><span>Create an account or log in before posting in a match thread.</span></div><button type="button" className="btn btn--lime btn--sm" onClick={requestAccountAccess}>LOG IN OR CREATE ACCOUNT</button></div>}</section></div>;
}

function formFor(teamName, standings) {
  if (!teamName || !Array.isArray(standings)) return [];
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  const t = norm(teamName);
  const row = standings.find(r => { const n = norm(r.team); return n && (n === t || n.includes(t) || t.includes(n)); });
  return (row && row.form) || [];
}

// Resolve a real club crest from the API-Football team id carried in
// SYSTEM_TEAMS, so preview/snapshot fixtures (which have no live logo url)
// still show a badge instead of "MC / A" initials.
function teamLogoFor(name) {
  if (!name) return '';
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  const t = norm(name);
  const team = (SYSTEM_TEAMS || []).find(x => {
    const n = norm(x.name), sh = norm(x.short);
    return n === t || sh === t || (n && (n.includes(t) || t.includes(n))) || (sh && (sh.includes(t) || t.includes(sh)));
  });
  return team ? `https://media.api-sports.io/football/teams/${team.id}.png` : '';
}

// Crest resolver for clubs OUTSIDE the 54 curated SYSTEM_TEAMS (CAF, MLS,
// second tiers, etc.). teamLogoFor covers the curated set instantly; anything
// else is looked up once by name against the live API-Football team directory
// and cached module-wide so a club is only ever searched a single time.
const _crestCache = new Map();     // key -> resolved logo url ('' if none found)
const _crestPending = new Map();   // key -> in-flight promise (dedupe)

async function resolveCrestByName(name) {
  const key = String(name || '').trim().toLowerCase();
  if (key.length < 3) return '';
  if (_crestCache.has(key)) return _crestCache.get(key);
  if (_crestPending.has(key)) return _crestPending.get(key);
  const job = (async () => {
    let url = '';
    try {
      const results = await searchTeams(name);
      const exact = results.find(r => String(r.name || '').trim().toLowerCase() === key);
      const pick = exact || results[0];
      url = pick?.crestUrl || '';
    } catch { url = ''; }
    _crestCache.set(key, url);
    _crestPending.delete(key);
    return url;
  })();
  _crestPending.set(key, job);
  return job;
}

// Drop-in for <ApiTeamLogo>. Uses a passed-in live src or the curated crest
// synchronously; if neither exists it resolves by name from the API, then
// falls back to initials (handled by ApiTeamLogo) only if the API has nothing.
function SmartCrest({ name, src = '', className = '', style }) {
  const initial = src || teamLogoFor(name);
  const [resolved, setResolved] = useState(initial);
  useEffect(() => {
    let alive = true;
    const seed = src || teamLogoFor(name);
    if (seed) { setResolved(seed); return; }
    setResolved('');
    resolveCrestByName(name).then(url => { if (alive && url) setResolved(url); });
    return () => { alive = false; };
  }, [name, src]);
  return <ApiTeamLogo src={resolved} name={name} className={className} style={style} />;
}

// A preview fixture ships a "kick-off loads from live fixture feed" placeholder
// string. Never render that raw — show a clean "Kickoff TBC" until the feed lands.
function kickoffLabel(k) {
  return (!k || /loads? from|fixture feed|feed$/i.test(String(k))) ? 'Kickoff TBC' : k;
}

function FeaturedMatch({ match, openForum, standings }) {
  const homeForm = formFor(match.home, standings);
  const awayForm = formFor(match.away, standings);
  return (
    <section className="matchroom-card mr-featured">
      <div className="mr-featured-head"><span><i/> FEATURED MATCH</span><em>{match.source === 'api' ? 'LIVE FIXTURE' : 'PREVIEW · API READY'}</em></div>
      <div className="mr-featured-teams">
        <div className="mr-team">
          <SmartCrest src={match.homeLogo} name={match.home} />
          <b>{match.home}</b>
          {match.homeShape && <small>{match.homeShape}</small>}
          {homeForm.length > 0 && <div className="mr-form">{homeForm.map((r, i) => <FormBadge key={i} result={r} />)}</div>}
        </div>
        <div className="mr-center">
          <Clock3 size={16} />
          <b>{kickoffLabel(match.kickoff)}</b>
          {match.venue && <small>{match.venue}</small>}
          <span className="mr-vs">VS</span>
        </div>
        <div className="mr-team">
          <SmartCrest src={match.awayLogo} name={match.away} />
          <b>{match.away}</b>
          {match.awayShape && <small>{match.awayShape}</small>}
          {awayForm.length > 0 && <div className="mr-form">{awayForm.map((r, i) => <FormBadge key={i} result={r} />)}</div>}
        </div>
      </div>
      {match.headline && <div className="mr-writeup"><b>{match.headline}</b>{match.pregame && <p>{match.pregame}</p>}</div>}
      <button type="button" className="btn btn--lime btn--sm mr-enter" onClick={openForum}>ENTER MATCHROOM <ArrowRight size={13} /></button>
    </section>
  );
}

function MatchroomChip({ match, onOpen }) {
  return (
    <button type="button" onClick={onOpen} style={{ display:'flex', flexDirection:'column', gap:8, textAlign:'left', background:'#0c0c0e', border:'1px solid #1c1c1c', borderRadius:10, padding:'12px 14px', cursor:'pointer', color:'#ddd', width:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:14, fontWeight:700 }}>
        <SmartCrest src={match.homeLogo} name={match.home} style={{ width:22, height:22, objectFit:'contain', flexShrink:0 }} /><span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{match.home}</span>
        <em style={{ color:'#666', fontStyle:'normal', fontSize:11 }}>vs</em>
        <span style={{ flex:1, textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{match.away}</span><SmartCrest src={match.awayLogo} name={match.away} style={{ width:22, height:22, objectFit:'contain', flexShrink:0 }} />
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:11, color:'#888' }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><Clock3 size={11}/> {match.kickoff || 'TBC'}</span>
        <span style={{ display:'inline-flex', alignItems:'center', gap:4, color:'#c8ff00' }}><MessageSquare size={11}/> Open thread</span>
      </div>
    </button>
  );
}

export default function Competitions() {
  const [group,setGroup]=useState('Top Leagues'); const competitions=COMPETITION_GROUPS[group];
  const [activeName,setActiveName]=useState(competitions[0].name); const active=useMemo(()=>competitions.find(item=>item.name===activeName)||competitions[0],[activeName,competitions]);
  const initialSnapshot=useMemo(()=>snapshotFor(active),[active]); const [standings,setStandings]=useState(initialSnapshot.standings); const [scorers,setScorers]=useState(initialSnapshot.scorers); const [creators,setCreators]=useState(initialSnapshot.creators); const [standingsUnavailable,setStandingsUnavailable]=useState('');
  const [liveState,setLiveState]=useState({standings:false,scorers:false,creators:false,fixture:false}); const [loading,setLoading]=useState(false); const live=Object.values(liveState).some(Boolean); const [featuredMatch,setFeaturedMatch]=useState(()=>featuredMatchFor(active)); const [fixtures,setFixtures]=useState(()=>[featuredMatchFor(active)]); const [forumMatch,setForumMatch]=useState(null);
  useEffect(()=>{setActiveName(COMPETITION_GROUPS[group][0].name);},[group]);
  useEffect(()=>{ const fallback=snapshotFor(active); const fallbackMatch=featuredMatchFor(active); const tournamentOnly=active.standingsMode==='tournament-only'; const knockout=isKnockoutCompetition(active); setStandings((tournamentOnly||knockout)?[]:fallback.standings); setScorers(fallback.scorers); setCreators(fallback.creators); setFeaturedMatch(fallbackMatch); setFixtures([fallbackMatch]); setForumMatch(null); setStandingsUnavailable(tournamentOnly?'Competition-only standings will appear when the UWCL feed publishes a table. Domestic-league rows are deliberately not substituted.':knockout?'Knockout competition — no league table. Rounds and fixtures resolve from the live feed.':''); setLiveState({standings:false,scorers:false,creators:false,fixture:false}); let cancelled=false; setLoading(true);
    (async()=>{ const season=active.season||CURRENT_SEASON; const leagueId=await resolveLeagueId(active,season); if(!leagueId||cancelled)return; const [standingRows,scorerRows,creatorRows,upcomingRows]=await Promise.all([active.table?getStandings(leagueId,season):Promise.resolve(null),getTopScorers(leagueId,season),getTopCreators(leagueId,season),getUpcomingFixtures(leagueId,season,5)]); if(cancelled)return;
      if(standingRows?.length){setStandings(standingRows.slice(0,6).map(team=>({pos:team.rank,team:team.team.name,P:team.all.played,GD:team.goalsDiff>=0?`+${team.goalsDiff}`:String(team.goalsDiff),pts:team.points,form:(team.form||'').split('').slice(0,5).map(result=>result==='W'?'W':result==='D'?'D':'L')}))); setStandingsUnavailable(''); setLiveState(current=>({...current,standings:true}));}
      if(scorerRows?.length){setScorers(scorerRows.slice(0,5).map((row,index)=>({pos:index+1,id:row.player.id,apiPlayerId:row.player.id,name:row.player.name,team:row.statistics?.[0]?.team?.name||'—',goals:row.statistics?.[0]?.goals?.total||0,img:row.player.photo||'/assets/players/neutral-player.svg'})));setLiveState(current=>({...current,scorers:true}));}
      if(creatorRows?.length){setCreators(creatorRows.map((row,index)=>({pos:index+1,id:row.player.id,apiPlayerId:row.player.id,name:row.player.name,team:row.team||'—',assists:row.assists||0,img:row.player.photo||'/assets/players/neutral-player.svg'})));setLiveState(current=>({...current,creators:true}));}
      let fixtureRows=upcomingRows; if(!fixtureRows?.length)fixtureRows=await getRecentFixtures(leagueId,season,5); if(!cancelled&&fixtureRows?.length){const normalized=fixtureRows.slice(0,5).map(row=>normalizeFixture(row,fallbackMatch,active)); setFeaturedMatch(normalized[0]); setFixtures(normalized); setLiveState(current=>({...current,fixture:true}));}
    })().catch(()=>{}).finally(()=>{if(!cancelled)setLoading(false);}); return()=>{cancelled=true;}; },[active]);
  // B: Calibre-rate the scorer / creator boards \u2014 resolve each player's engine
  // rating by the API id the leaderboard already carries, then show it inline.
  useEffect(()=>{
    const pending=[...scorers,...creators].filter(r=>(r.apiPlayerId||r.id)&&!r._calTried);
    if(!pending.length)return;
    const ids=[...new Set(pending.map(r=>r.apiPlayerId||r.id))];
    let cancelled=false;
    getSupabasePlayersByApiIds(ids).then(dbRows=>{
      if(cancelled)return;
      const byApi={};
      (dbRows||[]).forEach(row=>{ const apiId=row.api_player_id??row.apiPlayerId??row.id; const rt=resolveRating(row)?.rating; if(apiId!=null&&rt!=null)byApi[apiId]=Math.round(rt); });
      const enrich=list=>{ let changed=false; const out=list.map(r=>{ const apiId=r.apiPlayerId||r.id; if(r._calTried||!apiId)return r; changed=true; return {...r,cal:byApi[apiId]??null,_calTried:true}; }); return changed?out:list; };
      setScorers(prev=>enrich(prev));
      setCreators(prev=>enrich(prev));
    }).catch(()=>{});
    return()=>{cancelled=true;};
  },[scorers,creators]);
  const ins=deriveInsights(standings,scorers,creators);
  return <div className="page" style={{paddingTop:16}}><style>{`
.comp-matchroom-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; align-items:stretch; }
@media (max-width:1100px){ .comp-matchroom-grid{ grid-template-columns:1fr; } }
.comp-matchroom-grid > * { min-width:0; }
.comp-matchroom-grid > .mr-featured, .comp-matchroom-grid > .comp-data-panel { height:100%; display:flex; flex-direction:column; }
.comp-matchroom-grid .comp-panel-note { margin-top:auto; }
.mr-right > .comp-data-panel:first-child { flex:1 1 auto; display:flex; flex-direction:column; }
.mr-featured { display:flex; flex-direction:column; gap:14px; padding:16px; }
.mr-featured-head { display:flex; align-items:center; justify-content:space-between; }
.mr-featured-head span { display:inline-flex; align-items:center; gap:6px; font:800 10px/1 'IBM Plex Mono',monospace; letter-spacing:.12em; text-transform:uppercase; color:#a6ff00; }
.mr-featured-head span i { width:6px; height:6px; border-radius:50%; background:#a6ff00; display:inline-block; }
.mr-featured-head em { font:700 9px/1 'IBM Plex Mono',monospace; letter-spacing:.08em; color:#8d929b; font-style:normal; }
.mr-featured-teams { display:grid; grid-template-columns:1fr auto 1fr; align-items:start; gap:8px; }
.mr-team { display:flex; flex-direction:column; align-items:center; gap:7px; text-align:center; min-width:0; }
.mr-team img { width:50px; height:50px; object-fit:contain; }
.mr-team b { color:#fff; font:800 13px/1.15 'Barlow',sans-serif; }
.mr-team small { color:#8d929b; font:600 9px/1 'IBM Plex Mono',monospace; letter-spacing:.06em; }
.mr-form { display:flex; gap:3px; margin-top:2px; }
.mr-center { display:flex; flex-direction:column; align-items:center; gap:4px; padding:4px 6px 0; }
.mr-center svg { color:#8d929b; }
.mr-center b { color:#fff; font:800 12px/1.2 'Barlow',sans-serif; text-align:center; }
.mr-center small { color:#8d929b; font:600 9px/1.25 'Barlow',sans-serif; text-align:center; }
.mr-vs { margin-top:4px; color:#6b7075; font:900 13px/1 'Barlow Condensed',sans-serif; }
.mr-enter { width:100%; justify-content:center; margin-top:auto; }
.mr-right { display:flex; flex-direction:column; gap:12px; }
.mr-fixtures .comp-data-panel-title { margin-bottom:8px; }
.mr-fixture-row { display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%; padding:8px 0; border:0; border-bottom:1px solid var(--thin); background:none; cursor:pointer; text-align:left; }
.mr-fixture-row:last-child { border-bottom:none; }
.mr-fixture-teams { color:#e7ebe9; font:600 12px/1.2 'Barlow',sans-serif; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mr-fixture-teams em { color:#6b7075; font-style:normal; margin:0 4px; }
.mr-fixture-row:hover .mr-fixture-teams { color:#a6ff00; }
.mr-fixture-row small { color:#8d929b; font:600 10px/1 'Barlow',sans-serif; flex:none; }
.mr-fulltable { display:inline-flex; align-items:center; gap:5px; margin-top:8px; padding:6px 0; background:none; border:0; color:#a6ff00; font:800 9px/1 'IBM Plex Mono',monospace; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; }
.mr-analysis-box { border:1px solid rgba(166,255,0,.18); background:rgba(166,255,0,.04); border-radius:10px; padding:14px; margin:14px 0 4px; }
.mr-analysis-box .matchroom-label { display:inline-flex; align-items:center; gap:6px; font:800 9px/1 'IBM Plex Mono',monospace; letter-spacing:.1em; text-transform:uppercase; color:#a6ff00; }
.mr-analysis-box h4 { margin:9px 0 0; color:#fff; font:800 16px/1.25 'Barlow',sans-serif; }
.mr-analysis-box p { margin:8px 0 0; color:#c7cbd2; font:500 12px/1.55 'Barlow',sans-serif; }
.mr-analysis-key { display:flex; align-items:flex-start; gap:7px; margin-top:10px; color:#cfd3d8; font:500 11.5px/1.4 'Barlow',sans-serif; }
.mr-analysis-key svg { color:#a6ff00; flex:none; margin-top:1px; }
.mr-analysis-key b { color:#8d929b; font:700 9px/1 'IBM Plex Mono',monospace; letter-spacing:.06em; display:block; margin-bottom:3px; }
.mr-signals { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:12px; }
.mr-signals > div { border:1px solid var(--thin); border-radius:8px; padding:9px 10px; }
.mr-signals b { display:block; color:#8d929b; font:700 8px/1 'IBM Plex Mono',monospace; letter-spacing:.06em; }
.mr-signals span { display:block; margin-top:5px; color:#fff; font:800 13px/1 'Barlow Condensed',sans-serif; }
.mr-signals span.soon { color:#6b7075; font-weight:400; font-size:11px; }
.comp-fulltable { margin-top:10px; }
.comp-fulltable-row { display:grid; grid-template-columns:28px 1fr 34px 44px 44px auto; align-items:center; gap:8px; padding:9px 4px; border-bottom:1px solid var(--thin); font:600 12px/1 'Barlow', sans-serif; color:#e7ebe9; }
.comp-fulltable-row.header { color:#8d929b; font:700 9px/1 'IBM Plex Mono', monospace; letter-spacing:.06em; text-transform:uppercase; border-bottom:1px solid rgba(255,255,255,.14); }
.comp-fulltable-row:last-child { border-bottom:none; }
.comp-fulltable-row .comp-standings-pts { color:#a6ff00; font-weight:800; }
.comp-ft-form { display:flex; gap:3px; }
.mr-writeup { margin-top:2px; }
.mr-writeup b { display:block; color:#fff; font:800 14px/1.3 'Barlow', sans-serif; }
.mr-writeup p { margin:7px 0 0; color:#b8bec6; font:500 12px/1.55 'Barlow', sans-serif; }
.comp-field-round { margin:2px 0 8px; color:#a6ff00; font:700 9px/1 'IBM Plex Mono', monospace; letter-spacing:.1em; text-transform:uppercase; }
.comp-field-list { display:flex; flex-direction:column; }
.comp-field-row { display:flex; align-items:center; gap:10px; padding:8px 2px; border-bottom:1px solid var(--thin); }
.comp-field-row:last-child { border-bottom:none; }
.comp-field-pos { width:18px; color:#6b7075; font:700 11px/1 'IBM Plex Mono', monospace; }
.comp-field-logo { width:22px; height:22px; object-fit:contain; flex:none; }
.api-team-logo-fallback.comp-field-logo { display:inline-flex; align-items:center; justify-content:center; font-size:8px; background:rgba(255,255,255,.06); border-radius:4px; color:#8d929b; }
.comp-field-name { color:#e7ebe9; font:600 13px/1.2 'Barlow', sans-serif; }
`}</style><div className="comp-page"><Sidebar group={group} setGroup={setGroup}/><main className="comp-main"><section className="comp-hero"><div className="comp-hero-bg"><ApiLeagueLogo id={active.id} name={active.name} fallback={active.logo}/></div><div className="comp-hero-left"><div className="comp-hero-eyebrow">{group}</div><div className="comp-hero-title">{active.name}</div><div className="comp-hero-season">{active.country} · {active.stage}</div><div className="comp-hero-desc">{active.hero}. Explore standings, match analysis, form, scorers and creators without leaving the category hub.</div></div><div className="comp-hero-right"><div className="comp-hero-next-label">DATA STATUS</div><div className="comp-status-card"><Database size={17}/><b>{live?'LIVE DATABASE':'SNAPSHOT READY'}</b><span>{live?`${Object.values(liveState).filter(Boolean).length}/4 feeds refreshed`:'Fallback model active'}</span></div></div></section><div className="comp-type-tabs">{GROUPS.map(item=><button type="button" key={item} className={`comp-type-tab ${group===item?'active':''}`} onClick={()=>setGroup(item)}>{item}</button>)}</div><div className="comp-leagues-grid">{competitions.map(item=><CompetitionCard key={item.name} competition={item} active={item.name===active.name} onClick={()=>setActiveName(item.name)}/>)}</div><section id="comp-matchrooms" style={{marginTop:8}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:6}}><span style={{display:'inline-flex',alignItems:'center',gap:8,fontFamily:"'Barlow Condensed', sans-serif",fontWeight:800,letterSpacing:'0.12em',textTransform:'uppercase',color:'#fff',fontSize:15}}><MessageSquare size={15}/> Matchroom</span><em style={{color:'#8d929b',fontStyle:'normal',fontSize:11,letterSpacing:'0.08em',textTransform:'uppercase'}}>{active.name} · one thread per fixture</em></div><div id="comp-data" className="comp-matchroom-grid"><FeaturedMatch match={featuredMatch} openForum={()=>setForumMatch(featuredMatch)} standings={standings}/><StandingsPanel competition={active} standings={standings} live={liveState.standings} loading={loading} unavailable={standingsUnavailable}/><div className="mr-right"><PlayerPanel title="Top Scorers" suffix={active.name} rows={scorers} stat="goals" live={liveState.scorers} loading={loading}/><section className="comp-data-panel mr-fixtures"><div className="comp-data-panel-title">Next Fixtures</div>{fixtures.slice(0,5).map(m=><button type="button" className="mr-fixture-row" key={m.slug||`${m.home}-${m.away}`} onClick={()=>setForumMatch(m)}><span className="mr-fixture-teams">{m.home} <em>v</em> {m.away}</span><small>{kickoffLabel(m.kickoff)}</small></button>)}{!fixtures.length&&<div className="comp-empty-state">Fixtures load when the feed resolves.</div>}</section></div></div></section><PremierBetBanner source="competitions" variant="bar" />{!isKnockoutCompetition(active)&&<section style={{marginTop:4}}><div style={{display:'inline-flex',alignItems:'center',gap:8,fontFamily:"'Barlow Condensed', sans-serif",fontWeight:800,letterSpacing:'0.12em',textTransform:'uppercase',color:'#fff',fontSize:15,marginBottom:10}}><BarChart3 size={15}/> League Insights</div><div className="comp-lower" style={{gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',alignItems:'start'}}>{[{icon:<Crown size={16}/>,label:'Leader pace',value:ins.leader?`${ins.leader.team} · ${ins.ppg.toFixed(2)} PPG`:'—',tag:ins.projected?`PROJ ${ins.projected}`:null},{icon:<Send size={16}/>,label:'Assist leader',value:ins.topCreator?`${ins.topCreator.name} · ${ins.topCreator.assists} assists`:'—',tag:null},{icon:<BarChart3 size={16}/>,label:'Goal contributions',value:ins.contribLeader?`${ins.contribLeader.name} · ${ins.contribLeader.g}G ${ins.contribLeader.a}A`:'—',tag:ins.contribLeader?`${ins.contribLeader.g+ins.contribLeader.a} G+A`:null},{icon:<Swords size={16}/>,label:'Momentum · last 5',value:ins.momo?`${ins.momo.team} · ${ins.momo.pts}/${ins.momo.n*3} pts`:'—',tag:null}].map(card=><section className="comp-data-card" key={card.label} style={{padding:'15px 16px'}}><div style={{color:'#a6ff00',marginBottom:10}}>{card.icon}</div><div style={{font:'700 9px/1 "IBM Plex Mono", monospace',letterSpacing:'0.12em',textTransform:'uppercase',color:'#8d929b'}}>{card.label}</div><div style={{marginTop:8,color:'#fff',font:'800 15px/1.25 "Barlow", sans-serif'}}>{card.value}</div>{card.tag&&<div style={{marginTop:10,display:'inline-block',padding:'3px 9px',borderRadius:4,font:'800 9px/1 "IBM Plex Mono", monospace',letterSpacing:'0.08em',color:card.tag==='High'?'#4ade80':card.tag==='Medium'?'#f5c84b':'#8d929b',border:`1px solid ${card.tag==='High'?'rgba(74,222,128,.4)':card.tag==='Medium'?'rgba(245,200,75,.4)':'rgba(255,255,255,.14)'}`}}>{card.tag}</div>}</section>)}</div></section>}</main></div><div className="founder-strip"><Crown size={22} className="founder-strip-icon"/><strong>Get World Cup Founder Pass</strong><span>Unlock premium reports, advanced filters and exclusive World Cup intelligence.</span><button type="button" className="btn btn--lime" onClick={()=>navigateTo('/pricing')}>EXPLORE PLANS <ArrowRight size={14}/></button></div>{forumMatch&&<MatchForumModal match={forumMatch} onClose={()=>setForumMatch(null)}/>}</div>;
}
