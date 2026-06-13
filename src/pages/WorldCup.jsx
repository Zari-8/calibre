import { useEffect, useState } from 'react';
import { Star, Zap, Trophy, ArrowRight, Clock3, Swords, ShieldCheck, BarChart3, MessageSquare, Send, LockKeyhole, X } from 'lucide-react';
import Panel from '../components/Panel.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import ApiTeamLogo from '../components/ApiTeamLogo.jsx';
import ShareBar, { shareUrl } from '../components/Share.jsx';
import { navigateTo } from '../components/NavLink.jsx';
import { playerIdFor } from '../data/playerIds.js';
import { getSupabasePlayersByApiIds } from '../services/supabasePlayers.js';
import { calibreRating } from '../services/calibreRating.js';
import { getFixturesByDate, getFixtureEvents, getTeamForm, getMatchPredictions } from '../services/apiFootball.js';
import useAuth from '../hooks/useAuth.js';
import { loadForumPosts, submitForumPost } from '../services/community.js';
import {
  WC_CONFIG,
  breakoutStars,
  iconicEditions,
  iconicGoals,
  tournamentPlayers,
  wcFacts,
} from '../data/worldCupData.js';

// ── Countdown ────────────────────────────────────────────────────
function useDaysToWC() {
  const kick = new Date(WC_CONFIG.kickoff);
  const now  = new Date();
  return Math.max(0, Math.ceil((kick - now) / 86400000));
}

function formatMomentTime(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ── Sub-components ───────────────────────────────────────────────
function SectionHead({ eyebrow, title }) {
  return (
    <div className="wc-section-head">
      <span className="wc-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
    </div>
  );
}

function MomentBadge({ type }) {
  const MAP = {
    goal:      { label: 'GOAL',      cls: 'mb-goal'  },
    red_card:  { label: 'RED CARD',  cls: 'mb-red'   },
    var:       { label: 'VAR',       cls: 'mb-var'   },
    milestone: { label: 'MILESTONE', cls: 'mb-mile'  },
    upset:     { label: 'UPSET',     cls: 'mb-upset' },
    stat:      { label: 'STAT',      cls: 'mb-stat'  },
  };
  const b = MAP[type] || { label: type, cls: 'mb-stat' };
  return <span className={`moment-badge ${b.cls}`}>{b.label}</span>;
}

function BreakoutCard({ star, live }) {
  // Everything quantitative is live: the rating comes from the shared Calibre
  // engine off the registry row, and the form boxes show the player's real club
  // season (apps/goals/assists) — never hand-authored World Cup numbers. Before
  // a player resolves (or pre-tournament), the card shows a clean "awaiting
  // data" state rather than inventing a stat line.
  const rating = live?.rating ?? '—';
  const resolvedId = live?.apiPlayerId || playerIdFor(star.name);
  const club = live?.club || star.club;
  const hasForm = !!(live && (live.appearances || live.goals || live.assists));
  const seasonLabel = live?.season
    ? `${String(live.season).slice(2)}–${String(Number(live.season) + 1).slice(2)} club season`
    : 'Club season';
  return (
    <div className={`wc-breakout-card ${star.featured ? 'wc-breakout-card--featured' : ''}`}>
      {star.featured && <div className="wc-featured-tag">One to watch</div>}
      <div className="wc-bc-top">
        <ApiPlayerImage
          className="wc-bc-img"
          playerId={resolvedId}
          name={star.name}
          preferredSrc={resolvedId ? undefined : star.image}
          fallbackSrc="/assets/players/neutral-player.svg"
          alt={star.name}
        />
        <div className="wc-bc-meta">
          <div className="wc-bc-flag">{star.flag} {star.nation}</div>
          <strong className="wc-bc-name">{star.name}</strong>
          <span className="wc-bc-role">{star.role} · {club}</span>
          <div className="wc-bc-rating">
            <span className="wc-bc-score">{rating}</span>
            <span className="wc-bc-trend">{live?.rating != null ? 'Calibre' : 'Awaiting data'}</span>
          </div>
        </div>
      </div>
      <div className="wc-bc-stats">
        <div className="wc-bc-stat"><b>{hasForm ? live.appearances : '—'}</b><span>Apps</span></div>
        <div className="wc-bc-stat"><b>{hasForm ? live.goals : '—'}</b><span>Goals</span></div>
        <div className="wc-bc-stat"><b>{hasForm ? live.assists : '—'}</b><span>Assists</span></div>
      </div>
      <div style={{ fontSize: '9.5px', letterSpacing: '.09em', textTransform: 'uppercase', opacity: .45, marginTop: '7px' }}>
        {hasForm ? seasonLabel : 'Pre-tournament — form loads at kickoff'}
      </div>
      <p className="wc-bc-note">{star.note}</p>
      <div className="wc-bc-share"><ShareBar text={`${star.name} — ${rating} Calibre rating on Calibre.`} url={shareUrl('/world-cup')} label={false}/></div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
// ── World Cup Matchroom (self-contained; mirrors the Competitions room so it can
// be deleted wholesale with the page once the tournament ends, touching nothing
// else). Fed by API-Football World Cup fixtures (league 1) + fixtures/events.
const WC_LEAGUE_ID = 1;
const WC_LIVE = ['1H','HT','2H','ET','BT','P','SUSP','INT','LIVE'];
const WC_DONE = ['FT','AET','PEN'];

function wcSlugify(v=''){ return String(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function wcHeadline(home, away){
  const seed = `${home}-${away}`.split('').reduce((t,c)=>t+c.charCodeAt(0),0);
  const prompts = [
    `Where does ${home} vs ${away} break open?`,
    `Can ${home} control the game before ${away} turn it into a transition battle?`,
    `Which side wins the territory war: ${home} or ${away}?`,
    `Does this game belong to ${home}'s build-up or ${away}'s counterpress?`,
    `Who controls the spaces that decide ${home} vs ${away}?`,
  ];
  return prompts[seed % prompts.length];
}
// Recent W/D/L from a team's last fixtures (most recent first).
function formFromFixtures(fixtures, teamId){
  if(!Array.isArray(fixtures)) return '';
  return fixtures
    .filter(f => ['FT','AET','PEN'].includes(f?.fixture?.status?.short))
    .slice(0,5)
    .map(f => {
      const hg = f.goals?.home ?? 0, ag = f.goals?.away ?? 0;
      const isHome = f.teams?.home?.id === teamId;
      const gf = isHome ? hg : ag, ga = isHome ? ag : hg;
      return gf > ga ? 'W' : gf < ga ? 'L' : 'D';
    })
    .join('');
}

// Build a real moments feed (goals + red cards) from live/finished fixtures.
function buildLiveMoments(fixtures, eventsById){
  const out = [];
  for(const f of (fixtures||[])){
    const home = f.teams?.home?.name || 'Home';
    const away = f.teams?.away?.name || 'Away';
    const match = `${home} vs ${away}`;
    const kickoff = f.fixture?.date ? new Date(f.fixture.date).getTime() : Date.now();
    for(const e of (eventsById[f.fixture?.id] || [])){
      const elapsed = Number(e.time?.elapsed) || 0;
      const extra = Number(e.time?.extra) || 0;
      const min = `${elapsed}${extra?`+${extra}`:''}'`;
      const player = e.player?.name || '';
      const team = e.team?.name || '';
      const when = new Date(kickoff + (elapsed + extra) * 60000).toISOString();
      if(e.type === 'Goal' && !/missed|cancelled/i.test(e.detail||'')){
        out.push({ id:`${f.fixture.id}-g-${elapsed}-${player}`, type:'goal', match, time:when,
          text:`${player || 'Goal'} scores for ${team} — ${min}.` });
      } else if(e.type === 'Card' && /red/i.test(e.detail||'')){
        out.push({ id:`${f.fixture.id}-r-${elapsed}-${player}`, type:'red_card', match, time:when,
          text:`${player} (${team}) sent off — ${min}.` });
      }
    }
  }
  return out.sort((a,b)=> new Date(b.time) - new Date(a.time));
}

// Affiliate betting link for the "View live odds" CTA in the matchroom.
// REPLACE this with your real affiliate URL before go-live. Keep the 18+ /
// responsible-gambling note that renders beside it.
const BETTING_URL = 'https://example.com/odds';

// "45%" / 45 / "45.0%" → 45 (number) | null
function parsePct(v){ const n = parseFloat(String(v ?? '').replace('%','')); return Number.isFinite(n) ? n : null; }

function buildMatchroom(fx, events, forms = {}, predictions = null){
  if(!fx?.teams || !fx?.fixture) return null;
  const home = fx.teams.home?.name || 'Home';
  const away = fx.teams.away?.name || 'Away';
  const status = fx.fixture.status?.short || 'NS';
  const live = WC_LIVE.includes(status);
  const done = WC_DONE.includes(status);
  const gh = fx.goals?.home, ga = fx.goals?.away;
  const timeline = (events||[])
    .filter(e => e?.type === 'Goal' || e?.type === 'Card')
    .map(e => ({
      minute: e.time?.elapsed!=null ? `${e.time.elapsed}'${e.time.extra?`+${e.time.extra}`:''}` : '',
      type: e.type, detail: e.detail || '', player: e.player?.name || '', team: e.team?.name || '',
      red: e.type === 'Card' && /red/i.test(e.detail || ''),
    }));
  const reds = timeline.filter(t => t.red);
  const goals = timeline.filter(t => t.type === 'Goal');
  const scorersFor = (teamName) => goals.filter(g => g.team === teamName && g.player).map(g => g.player);
  const homeScorers = scorersFor(home), awayScorers = scorersFor(away);
  const homeForm = forms.home || '', awayForm = forms.away || '';

  // Real model signals from API-Football /predictions: win/draw/win %, advice,
  // and side-by-side comparison metrics. Stays null when the feed has none, so
  // the panel shows a clean empty state rather than fabricated numbers.
  let signals = null;
  if (predictions) {
    const pct = predictions.predictions?.percent || {};
    const h = parsePct(pct.home), d = parsePct(pct.draw), a = parsePct(pct.away);
    const cmp = predictions.comparison || {};
    const metric = (key, label) => {
      const mh = parsePct(cmp[key]?.home), ma = parsePct(cmp[key]?.away);
      return (mh!=null && ma!=null) ? { label, home: mh, away: ma } : null;
    };
    const metrics = [metric('form','Form'), metric('att','Attack'), metric('def','Defense')].filter(Boolean);
    if (h!=null || a!=null) {
      signals = { home: h ?? 0, draw: d ?? 0, away: a ?? 0,
        advice: predictions.predictions?.advice || '', winner: predictions.predictions?.winner?.name || '', metrics };
    }
  }

  return {
    home, away, status, live, done,
    homeLogo: fx.teams.home?.logo || '', awayLogo: fx.teams.away?.logo || '',
    score: (gh!=null && ga!=null) ? `${gh} – ${ga}` : 'vs',
    elapsed: fx.fixture.status?.elapsed,
    kickoff: fx.fixture.date ? new Date(fx.fixture.date).toLocaleString([], {dateStyle:'medium', timeStyle:'short'}) : '',
    venue: fx.fixture.venue?.name || '',
    headline: wcHeadline(home, away),
    homeForm, awayForm,
    pregame: `${home} and ${away} meet in the Matchroom${fx.fixture.venue?.name ? ` at ${fx.fixture.venue.name}` : ''}.`
      + ((homeForm || awayForm) ? ` Recent form — ${home}: ${homeForm || 'n/a'}, ${away}: ${awayForm || 'n/a'}.` : '')
      + ` Calibre frames the argument around territory, progression and how each side protects transition.`,
    keyDuel: `${home} progression lanes vs ${away} transition protection`,
    postgame: done
      ? `Full time: ${home} ${gh}–${ga} ${away}.`
        + (homeScorers.length ? ` ${home}: ${homeScorers.join(', ')}.` : '')
        + (awayScorers.length ? ` ${away}: ${awayScorers.join(', ')}.` : '')
        + (reds.length ? ` ${reds.length} red card${reds.length>1?'s':''}: ${reds.map(r=>`${r.player} (${r.team})`).join(', ')}.` : '')
      : null,
    timeline, reds: reds.length, fixtureId: fx.fixture.id, signals,
    slug: wcSlugify(`world-cup-${fx.fixture.id || `${home}-${away}`}`),
  };
}

function WCMatchRoom({ room, openForum }){
  if(!room) return null;
  return (
    <section className="matchroom-card wc-matchroom">
      <div className="matchroom-topline">
        <span><i/> World Cup Matchroom</span>
        <em>{room.live ? `LIVE ${room.elapsed?`${room.elapsed}'`:''}` : room.done ? 'FULL TIME' : 'UPCOMING'}</em>
      </div>
      <div className="matchroom-grid">
        <div className="matchroom-scoreboard">
          <div className="matchroom-kickoff"><Clock3 size={13}/> {room.kickoff}{room.venue?` · ${room.venue}`:''}</div>
          <div className="matchroom-teams">
            <div><ApiTeamLogo src={room.homeLogo} name={room.home}/><b>{room.home}</b></div>
            <strong>{room.score}</strong>
            <div><ApiTeamLogo src={room.awayLogo} name={room.away}/><b>{room.away}</b></div>
          </div>
          <button type="button" className="btn btn--lime btn--sm" onClick={openForum}>OPEN MATCH FORUM <MessageSquare size={13}/></button>
          <p>Pregame analysis, live events and the post-match verdict stay attached to this fixture.</p>
        </div>
        <div className="matchroom-analysis">
          <span className="matchroom-label"><Swords size={13}/> {room.done ? 'Postgame verdict' : 'Pregame analysis'}</span>
          <h2>{room.headline}</h2>
          <p>{room.done && room.postgame ? room.postgame : room.pregame}</p>
          <div className="matchroom-key"><ShieldCheck size={14}/><span><b>KEY DUEL</b>{room.keyDuel}</span></div>
          {!room.done && (room.homeForm || room.awayForm) && (
            <div className="matchroom-key"><BarChart3 size={14}/><span><b>FORM</b>{room.home} {room.homeForm||'—'} · {room.away} {room.awayForm||'—'}</span></div>
          )}
        </div>
        <div className="matchroom-signals">
          <span className="matchroom-label"><BarChart3 size={13}/> Match signals</span>
          {room.signals ? (
            <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
              <div style={{ display:'flex', height:30, borderRadius:6, overflow:'hidden', fontSize:11, fontWeight:800 }}>
                <div style={{ width:`${room.signals.home}%`, background:'var(--lime)', color:'#0b0b0b', display:'flex', alignItems:'center', justifyContent:'center' }}>{room.signals.home}%</div>
                <div style={{ width:`${room.signals.draw}%`, background:'rgba(255,255,255,0.18)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>{room.signals.draw}%</div>
                <div style={{ width:`${room.signals.away}%`, background:'rgba(255,255,255,0.40)', color:'#0b0b0b', display:'flex', alignItems:'center', justifyContent:'center' }}>{room.signals.away}%</div>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, letterSpacing:'.06em', textTransform:'uppercase', opacity:.6 }}>
                <span>{room.home}</span><span>Draw</span><span>{room.away}</span>
              </div>
              {room.signals.metrics.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {room.signals.metrics.map((m,i)=>(
                    <div key={i}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:9.5, letterSpacing:'.05em', textTransform:'uppercase', opacity:.6, marginBottom:3 }}>
                        <span>{m.label}</span><span>{m.home}% · {m.away}%</span>
                      </div>
                      <div style={{ height:4, borderRadius:3, background:'rgba(255,255,255,0.12)', overflow:'hidden' }}>
                        <div style={{ width:`${m.home}%`, height:'100%', background:'var(--lime)' }}/>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {room.signals.advice && (
                <div className="matchroom-key"><BarChart3 size={14}/><span><b>MODEL LEAN</b>{room.signals.advice}</span></div>
              )}
              <a href={BETTING_URL} target="_blank" rel="noopener noreferrer nofollow sponsored" className="btn btn--lime btn--sm" style={{ textDecoration:'none', textAlign:'center', justifyContent:'center' }}>VIEW LIVE ODDS</a>
              <small style={{ opacity:.5, fontSize:9.5, lineHeight:1.45 }}>Model probabilities, shown for information only — not betting advice. 18+. Please gamble responsibly.</small>
            </div>
          ) : <small>Win probabilities and model signals appear here once the fixture feed publishes them.</small>}
        </div>
      </div>
    </section>
  );
}

function WCForumModal({ room, onClose }){
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [posts, setPosts] = useState([]);
  const [notice, setNotice] = useState('');
  useEffect(()=>{ loadForumPosts(room.slug).then(setPosts).catch(()=>setPosts([])); },[room.slug]);
  const post = async () => {
    const clean = draft.trim(); if(!clean || !user) return;
    try { const saved = await submitForumPost({threadSlug:room.slug, body:clean, user}); setPosts(c=>[saved,...c]); setDraft(''); setNotice('Post added to this match thread.'); }
    catch(e){ setNotice(e?.message || 'Post could not be saved.'); }
  };
  const requestAccess = ()=>{ onClose(); window.dispatchEvent(new CustomEvent('calibre:open-auth',{detail:{returnTo:'/world-cup'}})); };
  return <div className="match-forum-modal" role="presentation" onMouseDown={onClose}><section className="match-forum-modal__dialog" role="dialog" aria-modal="true" onMouseDown={e=>e.stopPropagation()}><button className="match-forum-modal__close" type="button" aria-label="Close match forum" onClick={onClose}><X size={18}/></button><div className="match-forum-modal__kicker"><MessageSquare size={14}/> World Cup matchroom · pregame to postgame</div><h3>{room.home} <em>vs</em> {room.away}</h3><p>The thread travels with the fixture. Pregame arguments, live reactions and post-match verdicts stay in one place.</p>{user?<><div className="match-forum-composer"><textarea rows="3" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Add your tactical argument…"/><button type="button" className="btn btn--lime btn--sm" onClick={post}><Send size={13}/> POST</button></div>{notice&&<small>{notice}</small>}<div className="match-forum-posts">{posts.length?posts.map((item,i)=><article key={`${item.created_at}-${i}`}><b>{item.author_email || '@CalibreUser'}</b><p>{item.body}</p><small>{item.created_at?new Date(item.created_at).toLocaleString():'now'}</small></article>):<div className="comp-empty-state">Start the tactical discussion.</div>}</div></>:<div className="match-forum-locked"><LockKeyhole size={20}/><div><b>Verified account required</b><span>Create an account or log in before posting in a match thread.</span></div><button type="button" className="btn btn--lime btn--sm" onClick={requestAccess}>LOG IN OR CREATE ACCOUNT</button></div>}</section></div>;
}

export default function WorldCup() {
  const daysLeft = useDaysToWC();
  const isLive   = daysLeft === 0;

  // Resolve each breakout star against the Supabase registry once, then score
  // with the shared Calibre engine so the World Cup rating matches every other
  // surface. Editorial wcRating remains the fallback for players not yet in the
  // registry (e.g. emerging-league names).
  const [liveRatings, setLiveRatings] = useState({});
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ids = breakoutStars.map(s => Number(s.apiPlayerId)).filter(Boolean);
        const rows = await getSupabasePlayersByApiIds(ids);
        const byId = new Map();
        for (const r of rows) {
          const id = Number(r.api_player_id ?? r.apiPlayerId);
          if (Number.isInteger(id) && id > 0) byId.set(id, r);
        }
        const entries = breakoutStars.map((star) => {
          const match = byId.get(Number(star.apiPlayerId));
          if (!match) return [star.name, null];
          const scored = calibreRating(match);
          if (scored.rating == null) return [star.name, null];
          return [star.name, {
            rating: scored.rating,
            apiPlayerId: Number(star.apiPlayerId) || null,
            appearances: Number(match.appearances || 0),
            goals: Number(match.goals || 0),
            assists: Number(match.assists || 0),
            club: match.club || match.team || null,
            season: match.stats_season || null,
          }];
        });
        if (alive) setLiveRatings(Object.fromEntries(entries.filter(e => e[1])));
      } catch { /* keep editorial wcRating fallback on failure */ }
    })();
    return () => { alive = false; };
  }, []);

  const [activeEdition,  setActiveEdition]  = useState(iconicEditions[iconicEditions.length - 1]);

  // Featured World Cup match: today's live game, else the most recent finished,
  // else the next upcoming — with goals/cards from the events feed.
  const [room, setRoom] = useState(null);
  const [liveFeed, setLiveFeed] = useState([]);
  const [forumOpen, setForumOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const today = new Date().toISOString().slice(0,10);
        const all = await getFixturesByDate(today);
        const wc = (all || []).filter(f => f?.league?.id === WC_LEAGUE_ID);
        const pick = wc.find(f => WC_LIVE.includes(f.fixture?.status?.short))
          || wc.filter(f => WC_DONE.includes(f.fixture?.status?.short)).pop()
          || wc[0];

        // Pull events for every live/finished fixture (bounded) to drive the
        // real Live Moments feed — not the static editorial entry.
        const eventful = wc
          .filter(f => WC_LIVE.includes(f.fixture?.status?.short) || WC_DONE.includes(f.fixture?.status?.short))
          .slice(0, 8);
        const eventsById = {};
        for (const f of eventful) {
          try { eventsById[f.fixture.id] = await getFixtureEvents(f.fixture.id); }
          catch { eventsById[f.fixture.id] = []; }
        }
        if (alive) setLiveFeed(buildLiveMoments(eventful, eventsById));

        if (pick) {
          // Recent form for the featured two teams = real pre-match signal.
          let forms = {};
          try {
            const [hf, af] = await Promise.all([
              getTeamForm(pick.teams?.home?.id, 5),
              getTeamForm(pick.teams?.away?.id, 5),
            ]);
            forms = { home: formFromFixtures(hf, pick.teams?.home?.id), away: formFromFixtures(af, pick.teams?.away?.id) };
          } catch { /* form optional */ }
          const events = eventsById[pick.fixture.id]
            || await getFixtureEvents(pick.fixture.id).catch(() => []);
          const predictions = await getMatchPredictions(pick.fixture.id).catch(() => null);
          if (alive) setRoom(buildMatchroom(pick, events, forms, predictions));
        }
      } catch { /* leave room hidden if the WC feed is quiet */ }
    })();
    return () => { alive = false; };
  }, []);
  const [momentFilter,   setMomentFilter]   = useState('all');
  const [factCategory,   setFactCategory]   = useState('all');
  const [factSearch,     setFactSearch]     = useState('');
  const [factPage,       setFactPage]       = useState(0);

  const filteredMoments = momentFilter === 'all'
    ? liveFeed
    : liveFeed.filter(m => m.type === momentFilter);

  const FACT_CATS = ['all', 'tournament', 'goals', 'players', 'hosts', 'records', 'curiosities'];

  // Fact of the Day — one fact, rotates daily, same for everyone on a given date.
  const dayIndex = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const factOfDay = wcFacts.length ? wcFacts[dayIndex % wcFacts.length] : null;

  const filteredFacts = wcFacts.filter(f => {
    const matchCat    = factCategory === 'all' || f.category === factCategory;
    const matchSearch = !factSearch || f.fact.toLowerCase().includes(factSearch.toLowerCase()) ||
                        f.tags.some(t => t.toLowerCase().includes(factSearch.toLowerCase()));
    return matchCat && matchSearch && f.id !== factOfDay?.id; // bank excludes the daily fact
  });

  // The bank shows 6 at a time; the rest live on the next pages.
  const FACTS_PER_PAGE = 6;
  const factPageCount  = Math.max(1, Math.ceil(filteredFacts.length / FACTS_PER_PAGE));
  const factSafePage   = Math.min(factPage, factPageCount - 1);
  const pagedFacts     = filteredFacts.slice(factSafePage * FACTS_PER_PAGE, factSafePage * FACTS_PER_PAGE + FACTS_PER_PAGE);
  const setFactCat     = (c) => { setFactCategory(c); setFactPage(0); };
  const setFactQuery   = (q) => { setFactSearch(q); setFactPage(0); };

  return (
    <div className="page wc-page">

      {/* ── HERO ── */}
      <div className="wc-hero">
        <div className="wc-hero-eyebrow"><Trophy size={16} /> {WC_CONFIG.edition}</div>
        <h1 className="wc-hero-title">
          {isLive ? "It's happening." : `${daysLeft} days away.`}
        </h1>
        <p className="wc-hero-sub">
          {isLive
            ? 'Live moments, the watchlist, and the data behind the tournament.'
            : `${WC_CONFIG.hosts.join(' · ')} · Kickoff ${new Date(WC_CONFIG.kickoff).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
          }
        </p>
        <div className="wc-host-flags">🇺🇸 USA &nbsp;·&nbsp; 🇨🇦 Canada &nbsp;·&nbsp; 🇲🇽 Mexico</div>
        {!isLive && (
          <div className="wc-countdown-strip">
            <div className="wc-cd-cell"><strong>{daysLeft}</strong><span>Days</span></div>
            <div className="wc-cd-cell"><strong>48</strong><span>Teams</span></div>
            <div className="wc-cd-cell"><strong>104</strong><span>Matches</span></div>
            <div className="wc-cd-cell"><strong>16</strong><span>Stadiums</span></div>
          </div>
        )}
      </div>

      {room && (
        <section className="wc-section">
          <SectionHead eyebrow="Featured Fixture" title="World Cup Matchroom" />
          <WCMatchRoom room={room} openForum={() => setForumOpen(true)} />
        </section>
      )}

      {/* ── LIVE MOMENTS ── */}
      <section className="wc-section">
        <SectionHead eyebrow="Tournament Feed" title="Live Moments" />
        <div className="wc-moment-filters">
          {['all', 'goal', 'red_card', 'upset', 'milestone', 'stat'].map(f => (
            <button key={f} type="button"
              className={momentFilter === f ? 'wc-mf-btn active' : 'wc-mf-btn'}
              onClick={() => setMomentFilter(f)}
            >
              {f === 'all' ? 'All' : f.replace('_', ' ')}
            </button>
          ))}
        </div>
        {filteredMoments.length === 0 ? (
          <div className="wc-moments-empty">
            {liveFeed.length === 0
              ? 'No goals or red cards in the feed yet — moments appear here live as the games are played.'
              : 'No moments of this type yet.'
            }
          </div>
        ) : (
          <div className="wc-moments-feed">
            {[...filteredMoments]
              .sort((a, b) => new Date(b.time) - new Date(a.time))
              .map(m => (
                <div key={m.id} className={`wc-moment ${m.featured ? 'wc-moment--featured' : ''}`}>
                  <div className="wc-moment-left">
                    <MomentBadge type={m.type} />
                    <span className="wc-moment-match">{m.match}</span>
                    <span className="wc-moment-time">{formatMomentTime(m.time)}</span>
                  </div>
                  <p className="wc-moment-text">{m.text}</p>
                </div>
              ))
            }
          </div>
        )}
      </section>

      {/* ── BREAKOUT STARS ── */}
      <section className="wc-section">
        <SectionHead eyebrow="Scout Pulse" title="Pre-Tournament Watchlist" />
        <div className="wc-breakout-grid">
          {breakoutStars.map(s => <BreakoutCard key={s.id} star={s} live={liveRatings[s.name]} />)}
        </div>
      </section>

      {/* ── WORLD CUP FACTS ── */}
      <section className="wc-section">
        <SectionHead eyebrow="Did You Know" title="World Cup Facts" />

        {factOfDay && (
          <div className={`wc-fact-card wc-fact-card--daily wc-fact-cat--${factOfDay.category}`}>
            <span className="wc-fact-daily-label">Fact of the day</span>
            <div className="wc-fact-emoji">{factOfDay.emoji}</div>
            <p className="wc-fact-text">{factOfDay.fact}</p>
            <div className="wc-fact-tags">
              <span className="wc-fact-cat-label">{factOfDay.category}</span>
              {factOfDay.tags.slice(0, 2).map(t => (
                <span key={t} className="wc-fact-tag" onClick={() => setFactQuery(t)} style={{ cursor: 'pointer' }}>{t}</span>
              ))}
            </div>
          </div>
        )}

        <div className="wc-facts-controls">
          <div className="wc-fact-cats">
            {FACT_CATS.map(c => (
              <button key={c} type="button"
                className={factCategory === c ? 'wc-fact-cat active' : 'wc-fact-cat'}
                onClick={() => setFactCat(c)}
              >
                {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
                {c !== 'all' && (
                  <span className="wc-fact-count">
                    {wcFacts.filter(f => f.category === c).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <input
            className="wc-fact-search"
            type="text"
            placeholder="Search facts, players, nations..."
            value={factSearch}
            onChange={e => setFactQuery(e.target.value)}
          />
        </div>

        {pagedFacts.length === 0 ? (
          <div className="wc-facts-empty">No facts match that search.</div>
        ) : (
          <>
            <div className="wc-facts-grid">
              {pagedFacts.map(f => (
                <div key={f.id} className={`wc-fact-card wc-fact-cat--${f.category}`}>
                  <div className="wc-fact-emoji">{f.emoji}</div>
                  <p className="wc-fact-text">{f.fact}</p>
                  <div className="wc-fact-tags">
                    <span className="wc-fact-cat-label">{f.category}</span>
                    {f.tags.slice(0, 2).map(t => (
                      <span key={t} className="wc-fact-tag"
                        onClick={() => setFactQuery(t)}
                        style={{ cursor: 'pointer' }}
                      >{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {factPageCount > 1 && (
              <div className="wc-facts-pager">
                <button type="button" className="wc-mf-btn" disabled={factSafePage === 0}
                  onClick={() => setFactPage(p => Math.max(0, p - 1))}>← Prev</button>
                <span className="wc-facts-pageinfo">Page {factSafePage + 1} of {factPageCount}</span>
                <button type="button" className="wc-mf-btn" disabled={factSafePage >= factPageCount - 1}
                  onClick={() => setFactPage(p => Math.min(factPageCount - 1, p + 1))}>Next →</button>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── ICONIC EDITIONS ── */}
      <section className="wc-section">
        <SectionHead eyebrow="History" title="Iconic Editions" />
        <div className="wc-editions-layout">
          <div className="wc-edition-selector">
            {iconicEditions.map(ed => (
              <button key={ed.year} type="button"
                className={`wc-edition-btn ${activeEdition.year === ed.year ? 'active' : ''}`}
                onClick={() => setActiveEdition(ed)}
              >
                <span className="wc-ed-flag">{ed.flag}</span>
                <span className="wc-ed-year">{ed.year}</span>
                <span className="wc-ed-host">{ed.host}</span>
              </button>
            ))}
          </div>
          <div className="wc-edition-detail">
            <div className="wc-ed-detail-top">
              <div>
                <div className="wc-ed-detail-flag">{activeEdition.flag}</div>
                <h3>{activeEdition.year} · {activeEdition.host}</h3>
                <div className="wc-ed-winner">Winners: <strong>{activeEdition.winner}</strong></div>
              </div>
              <div className="wc-calibre-score">
                <strong>{activeEdition.calibreScore}</strong>
                <span>Calibre Score</span>
              </div>
            </div>
            <p className="wc-ed-theme">"{activeEdition.theme}"</p>
            <p className="wc-ed-summary">{activeEdition.summary}</p>
            <div className="wc-ed-moment">
              <Zap size={13} style={{ color: 'var(--lime)', flexShrink: 0 }} />
              <span>{activeEdition.moment}</span>
            </div>
            <div className="wc-ed-players">
              {activeEdition.players.map(p => (
                <span key={p} className="wc-player-chip">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ICONIC GOALS ── */}
      <section className="wc-section">
        <SectionHead eyebrow="Greatest Moments" title="Goals That Defined the Tournament" />
        <div className="wc-goals-grid">
          {iconicGoals.map(g => (
            <div className="wc-goal-card" key={`${g.year}-${g.scorer}`}>
              <div className="wc-goal-top">
                <span className="wc-goal-flag">{g.flag}</span>
                <div>
                  <strong>{g.scorer}</strong>
                  <span>{g.nation} vs {g.vs} · {g.year}</span>
                </div>
                <span className="wc-goal-year-badge">{g.year}</span>
              </div>
              <div className="wc-goal-label">{g.label}</div>
              <p>{g.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── GOLDEN BALL HISTORY ── */}
      <section className="wc-section">
        <SectionHead eyebrow="Player of the Tournament" title="Golden Ball History" />
        <div className="wc-award-grid">
          {tournamentPlayers.map(t => (
            <div className="wc-award-row" key={t.year}>
              <span className="wc-award-year">{t.year}</span>
              <span className="wc-award-flag">{t.flag}</span>
              <strong className="wc-award-player">{t.player}</strong>
              <span className="wc-award-label">{t.award}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <div className="wc-cta-strip">
        <Trophy size={22} style={{ color: 'var(--lime)' }} />
        <div>
          <strong>Get World Cup Founder Pass</strong>
          <span>Unlock deeper tournament data, player breakdowns and scout tools.</span>
        </div>
        <button type="button" onClick={() => navigateTo('/pricing')}>
          Get Founder Pass <ArrowRight size={14} />
        </button>
      </div>

      {forumOpen && room && <WCForumModal room={room} onClose={() => setForumOpen(false)} />}

    </div>
  );
}
