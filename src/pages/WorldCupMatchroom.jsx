import { useEffect, useState } from 'react';
import { Clock3, Swords, ShieldCheck, BarChart3, MessageSquare, Send, LockKeyhole, X, ArrowLeft } from 'lucide-react';
import WorldCupNav from '../components/WorldCupNav.jsx';
import ApiTeamLogo from '../components/ApiTeamLogo.jsx';
import { navigateTo } from '../components/NavLink.jsx';
import { getFixturesByDate, getFixtureEvents, getTeamForm, getMatchPredictions } from '../services/apiFootball.js';
import useAuth from '../hooks/useAuth.js';
import { loadForumPosts, submitForumPost } from '../services/community.js';

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

function wcSlugify(v = '') { return String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
function wcHeadline(home, away) {
  const seed = `${home}-${away}`.split('').reduce((t, c) => t + c.charCodeAt(0), 0);
  const prompts = [
    `Where does ${home} vs ${away} break open?`,
    `Can ${home} control the game before ${away} turn it into a transition battle?`,
    `Which side wins the territory war: ${home} or ${away}?`,
    `Does this game belong to ${home}'s build-up or ${away}'s counterpress?`,
    `Who controls the spaces that decide ${home} vs ${away}?`,
  ];
  return prompts[seed % prompts.length];
}
function formStats(fixtures, teamId) {
  const done = (Array.isArray(fixtures) ? fixtures : [])
    .filter(f => ['FT', 'AET', 'PEN'].includes(f?.fixture?.status?.short)).slice(0, 5);
  let pts = 0, gf = 0, ga = 0;
  const wdl = done.map(f => {
    const hg = f.goals?.home ?? 0, ag = f.goals?.away ?? 0;
    const isHome = f.teams?.home?.id === teamId;
    const f1 = isHome ? hg : ag, a1 = isHome ? ag : hg;
    gf += f1; ga += a1;
    if (f1 > a1) { pts += 3; return 'W'; }
    if (f1 < a1) return 'L';
    pts += 1; return 'D';
  }).join('');
  return { wdl, pts, gf, ga, n: done.length };
}
function parsePct(v) { const n = parseFloat(String(v ?? '').replace('%', '')); return Number.isFinite(n) ? n : null; }
const BETTING_URL = 'https://example.com/odds';

function buildMatchroom(fx, events, forms = {}, predictions = null) {
  if (!fx?.teams || !fx?.fixture) return null;
  const home = fx.teams.home?.name || 'Home';
  const away = fx.teams.away?.name || 'Away';
  const status = fx.fixture.status?.short || 'NS';
  const live = WC_LIVE.includes(status);
  const done = WC_DONE.includes(status);
  const gh = fx.goals?.home, ga = fx.goals?.away;
  const timeline = (events || [])
    .filter(e => e?.type === 'Goal' || e?.type === 'Card')
    .map(e => ({
      minute: e.time?.elapsed != null ? `${e.time.elapsed}'${e.time.extra ? `+${e.time.extra}` : ''}` : '',
      type: e.type, detail: e.detail || '', player: e.player?.name || '', team: e.team?.name || '',
      red: e.type === 'Card' && /red/i.test(e.detail || ''),
    }));
  const reds = timeline.filter(t => t.red);
  const goals = timeline.filter(t => t.type === 'Goal');
  const scorersFor = (teamName) => goals.filter(g => g.team === teamName && g.player).map(g => g.player);
  const homeScorers = scorersFor(home), awayScorers = scorersFor(away);
  const hs = forms.home || {}, as = forms.away || {};
  const homeForm = hs.wdl || '', awayForm = as.wdl || '';

  let signals = null;
  if (predictions) {
    const pct = predictions.predictions?.percent || {};
    const h = parsePct(pct.home), d = parsePct(pct.draw), a = parsePct(pct.away);
    const cmp = predictions.comparison || {};
    const metric = (key, label) => {
      const mh = parsePct(cmp[key]?.home), ma = parsePct(cmp[key]?.away);
      return (mh != null && ma != null) ? { label, home: mh, away: ma } : null;
    };
    const metrics = [metric('form', 'Form'), metric('att', 'Attack'), metric('def', 'Defense')].filter(Boolean);
    if (h != null || a != null) {
      signals = { source: 'model', hasPercent: true, home: h ?? 0, draw: d ?? 0, away: a ?? 0,
        lean: predictions.predictions?.advice || '', winner: predictions.predictions?.winner?.name || '', metrics };
    }
  }
  if (!signals && (hs.n || as.n)) {
    const split = (h, a) => { const t = (h || 0) + (a || 0); return t ? Math.round((h || 0) / t * 100) : 50; };
    const fHome = split(hs.pts, as.pts);
    const aHome = split(hs.gf, as.gf);
    const dHome = split(as.ga, hs.ga);
    const leader = (hs.pts || 0) > (as.pts || 0) ? home : (as.pts || 0) > (hs.pts || 0) ? away : null;
    signals = {
      source: 'form', hasPercent: false,
      metrics: [
        { label: 'Form (pts)', home: fHome, away: 100 - fHome },
        { label: 'Attack (GF)', home: aHome, away: 100 - aHome },
        { label: 'Defense', home: dHome, away: 100 - dHome },
      ],
      lean: leader ? `${leader} carry the better recent form (${leader === home ? homeForm : awayForm}).` : 'Form is level across the last five.',
    };
  }

  return {
    home, away, status, live, done,
    homeLogo: fx.teams.home?.logo || '', awayLogo: fx.teams.away?.logo || '',
    score: (gh != null && ga != null) ? `${gh} – ${ga}` : 'vs',
    elapsed: fx.fixture.status?.elapsed,
    kickoff: fx.fixture.date ? new Date(fx.fixture.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '',
    venue: fx.fixture.venue?.name || '',
    headline: wcHeadline(home, away),
    homeForm, awayForm,
    pregame: `${home} and ${away} meet${fx.fixture.venue?.name ? ` at ${fx.fixture.venue.name}` : ''}.`
      + ((homeForm || awayForm) ? ` Last five — ${home}: ${homeForm || 'n/a'}, ${away}: ${awayForm || 'n/a'}.` : '')
      + (signals?.lean ? ` ${signals.lean}` : ''),
    keyDuel: (hs.n || as.n)
      ? `${(hs.gf || 0) >= (as.gf || 0) ? home : away}'s attack (${Math.max(hs.gf || 0, as.gf || 0)} in last 5) vs ${(hs.gf || 0) >= (as.gf || 0) ? away : home}'s defence`
      : `${home} vs ${away}`,
    postgame: done
      ? `Full time: ${home} ${gh}–${ga} ${away}.`
        + (homeScorers.length ? ` ${home}: ${homeScorers.join(', ')}.` : '')
        + (awayScorers.length ? ` ${away}: ${awayScorers.join(', ')}.` : '')
        + (reds.length ? ` ${reds.length} red card${reds.length > 1 ? 's' : ''}: ${reds.map(r => `${r.player} (${r.team})`).join(', ')}.` : '')
      : null,
    timeline, reds: reds.length, fixtureId: fx.fixture.id, signals,
    slug: wcSlugify(`world-cup-${fx.fixture.id || `${home}-${away}`}`),
  };
}

function WCForumModal({ room, onClose }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [posts, setPosts] = useState([]);
  const [notice, setNotice] = useState('');
  useEffect(() => { loadForumPosts(room.slug).then(setPosts).catch(() => setPosts([])); }, [room.slug]);
  const post = async () => {
    const clean = draft.trim(); if (!clean || !user) return;
    try { const saved = await submitForumPost({ threadSlug: room.slug, body: clean, user }); setPosts(c => [saved, ...c]); setDraft(''); setNotice('Post added to this match thread.'); }
    catch (e) { setNotice(e?.message || 'Post could not be saved.'); }
  };
  const requestAccess = () => { onClose(); window.dispatchEvent(new CustomEvent('calibre:open-auth', { detail: { returnTo: '/world-cup/matchroom' } })); };
  return (
    <div className="match-forum-modal" role="presentation" onMouseDown={onClose}>
      <section className="match-forum-modal__dialog" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <button className="match-forum-modal__close" type="button" aria-label="Close match forum" onClick={onClose}><X size={18} /></button>
        <div className="match-forum-modal__kicker"><MessageSquare size={14} /> World Cup matchroom · pregame to postgame</div>
        <h3>{room.home} <em>vs</em> {room.away}</h3>
        <p>The thread travels with the fixture. Pregame arguments, live reactions and post-match verdicts stay in one place.</p>
        {user ? (
          <>
            <div className="match-forum-composer">
              <textarea rows="3" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add your tactical argument…" />
              <button type="button" className="btn btn--lime btn--sm" onClick={post}><Send size={13} /> POST</button>
            </div>
            {notice && <small>{notice}</small>}
            <div className="match-forum-posts">
              {posts.length ? posts.map((item, i) => (
                <article key={`${item.created_at}-${i}`}><b>{item.author_email || '@CalibreUser'}</b><p>{item.body}</p><small>{item.created_at ? new Date(item.created_at).toLocaleString() : 'now'}</small></article>
              )) : <div className="comp-empty-state">Start the tactical discussion.</div>}
            </div>
          </>
        ) : (
          <div className="match-forum-locked">
            <LockKeyhole size={20} />
            <div><b>Verified account required</b><span>Create an account or log in before posting in a match thread.</span></div>
            <button type="button" className="btn btn--lime btn--sm" onClick={requestAccess}>LOG IN OR CREATE ACCOUNT</button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function WorldCupMatchroom() {
  const params = new URLSearchParams(window.location.search);
  const fixtureId = params.get('fixtureId');
  const dateParam = params.get('date');

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forumOpen, setForumOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // With a specific fixture requested: fetch that day's fixtures and pick
        // the matching id (the API is date-scoped, so the date travels with the
        // link from the Matches page). Without one: fall back to today's live
        // game, else the most recent finished, else the next upcoming — the
        // same default the old single-page World Cup hub used.
        const day = dateParam || new Date().toISOString().slice(0, 10);
        const all = await getFixturesByDate(day);
        const wc = (all || []).filter(f => isWorldCup(f));
        const pick = fixtureId
          ? wc.find(f => String(f.fixture?.id) === String(fixtureId))
          : (wc.find(f => WC_LIVE.includes(f.fixture?.status?.short))
              || wc.filter(f => WC_DONE.includes(f.fixture?.status?.short)).pop()
              || wc[0]);

        if (!pick) { if (alive) setRoom(null); return; }

        let forms = {};
        try {
          const [hf, af] = await Promise.all([
            getTeamForm(pick.teams?.home?.id, 5),
            getTeamForm(pick.teams?.away?.id, 5),
          ]);
          forms = { home: formStats(hf, pick.teams?.home?.id), away: formStats(af, pick.teams?.away?.id) };
        } catch { /* form optional */ }
        const events = await getFixtureEvents(pick.fixture.id).catch(() => []);
        const predictions = await getMatchPredictions(pick.fixture.id).catch(() => null);
        if (alive) setRoom(buildMatchroom(pick, events, forms, predictions));
      } catch { if (alive) setRoom(null); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [fixtureId, dateParam]);

  return (
    <div className="page wc2">
      <style>{`
        .wc2 { --l:#a6ff00; --line:rgba(255,255,255,.09); --muted:#888; --glass:rgba(9,13,16,.5); color:#fff; position:relative; isolation:isolate; background:#050708; }
        .wc2::before { content:""; position:fixed; inset:0; z-index:-2; background:url("/assets/debates-bg.png") center/cover no-repeat; pointer-events:none; }
        .wc2::after { content:""; position:fixed; inset:0; z-index:-1; pointer-events:none; background:radial-gradient(ellipse 90% 42% at 50% -4%,rgba(166,255,0,.07),transparent 60%),radial-gradient(ellipse 120% 90% at 50% 130%,rgba(18,42,14,.30),transparent 62%),linear-gradient(180deg,rgba(5,8,11,.24) 0%,rgba(5,8,11,.45) 45%,rgba(5,8,11,.58) 100%); }
        .wc2 * { box-sizing:border-box; }
        .wc2-back { display:inline-flex; align-items:center; gap:6px; background:none; border:none; color:var(--muted); font:700 11px "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; margin-bottom:14px; padding:0; }
        .wc2-back:hover { color:#fff; }
        .wc2-empty { color:var(--muted); font:500 13px/1.6 "Barlow",sans-serif; text-align:center; padding:60px 0; }
      `}</style>

      <WorldCupNav active="matches" />
      <button className="wc2-back" onClick={() => navigateTo('/world-cup/matches')}><ArrowLeft size={14} /> Back to matches</button>

      {loading ? (
        <div className="wc2-empty">Loading matchroom…</div>
      ) : !room ? (
        <div className="wc2-empty">This fixture couldn't be found — it may have moved to a different day. Go back and pick it from the list.</div>
      ) : (
        <>
          <section className="matchroom-card wc-matchroom">
            <div className="matchroom-topline">
              <span><i /> World Cup Matchroom</span>
              <em>{room.live ? `LIVE ${room.elapsed ? `${room.elapsed}'` : ''}` : room.done ? 'FULL TIME' : 'UPCOMING'}</em>
            </div>
            <div className="matchroom-grid">
              <div className="matchroom-scoreboard">
                <div className="matchroom-kickoff"><Clock3 size={13} /> {room.kickoff}{room.venue ? ` · ${room.venue}` : ''}</div>
                <div className="matchroom-teams">
                  <div><ApiTeamLogo src={room.homeLogo} name={room.home} /><b>{room.home}</b></div>
                  <strong>{room.score}</strong>
                  <div><ApiTeamLogo src={room.awayLogo} name={room.away} /><b>{room.away}</b></div>
                </div>
                <button type="button" className="btn btn--lime btn--sm" onClick={() => setForumOpen(true)}>OPEN MATCH FORUM <MessageSquare size={13} /></button>
                <p>Pregame analysis, live events and the post-match verdict stay attached to this fixture.</p>
              </div>
              <div className="matchroom-analysis">
                <span className="matchroom-label"><Swords size={13} /> {room.done ? 'Postgame verdict' : 'Pregame analysis'}</span>
                <h2>{room.headline}</h2>
                <p>{room.done && room.postgame ? room.postgame : room.pregame}</p>
                <div className="matchroom-key"><ShieldCheck size={14} /><span><b>KEY DUEL</b>{room.keyDuel}</span></div>
                {!room.done && (room.homeForm || room.awayForm) && (
                  <div className="matchroom-key"><BarChart3 size={14} /><span><b>FORM</b>{room.home} {room.homeForm || '—'} · {room.away} {room.awayForm || '—'}</span></div>
                )}
              </div>
              <div className="matchroom-signals">
                <span className="matchroom-label"><BarChart3 size={13} /> Match signals</span>
                {room.signals ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                    {room.signals.hasPercent && (
                      <>
                        <div style={{ display: 'flex', height: 30, borderRadius: 6, overflow: 'hidden', fontSize: 11, fontWeight: 800 }}>
                          <div style={{ width: `${room.signals.home}%`, background: 'var(--lime)', color: '#0b0b0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{room.signals.home}%</div>
                          <div style={{ width: `${room.signals.draw}%`, background: 'rgba(255,255,255,0.18)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{room.signals.draw}%</div>
                          <div style={{ width: `${room.signals.away}%`, background: 'rgba(255,255,255,0.40)', color: '#0b0b0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{room.signals.away}%</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', opacity: .6 }}>
                          <span>{room.home}</span><span>Draw</span><span>{room.away}</span>
                        </div>
                      </>
                    )}
                    {room.signals.metrics.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {room.signals.source === 'form' && (
                          <span style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .4 }}>Recent form · last 5 · {room.home} vs {room.away}</span>
                        )}
                        {room.signals.metrics.map((m, i) => (
                          <div key={i}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase', opacity: .6, marginBottom: 3 }}>
                              <span>{m.label}</span><span>{m.home}% · {m.away}%</span>
                            </div>
                            <div style={{ height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                              <div style={{ width: `${m.home}%`, height: '100%', background: 'var(--lime)' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {room.signals.lean && (
                      <div className="matchroom-key"><BarChart3 size={14} /><span><b>{room.signals.source === 'model' ? 'MODEL LEAN' : 'FORM READ'}</b>{room.signals.lean}</span></div>
                    )}
                    <a href={BETTING_URL} target="_blank" rel="noopener noreferrer nofollow sponsored" className="btn btn--lime btn--sm" style={{ textDecoration: 'none', textAlign: 'center', justifyContent: 'center' }}>VIEW LIVE ODDS</a>
                    <small style={{ opacity: .5, fontSize: 9.5, lineHeight: 1.45 }}>For information only — not betting advice. 18+. Please gamble responsibly.</small>
                  </div>
                ) : <small>Form and model signals appear here once the fixture feed loads.</small>}
              </div>
            </div>
          </section>

          {room.timeline.length > 0 && (
            <section className="wc-section" style={{ marginTop: 16 }}>
              <h3 style={{ font: '800 14px "Barlow Condensed",sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--l)', marginBottom: 12 }}>Live Feed</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {room.timeline.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1c1c1c' }}>
                    <span style={{ width: 36, flex: 'none', color: 'var(--muted)', fontWeight: 800, fontFamily: '"Barlow Condensed",sans-serif' }}>{t.minute}</span>
                    <span style={{ color: t.red ? '#ef4444' : 'var(--l)', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', flex: 'none' }}>{t.red ? 'RED CARD' : 'GOAL'}</span>
                    <span style={{ color: '#ccc', fontSize: 13 }}>{t.player} ({t.team})</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {forumOpen && room && <WCForumModal room={room} onClose={() => setForumOpen(false)} />}
    </div>
  );
}
