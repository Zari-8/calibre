import { useEffect, useState } from 'react';
import { Trophy, ArrowRight } from 'lucide-react';
import WorldCupNav from '../components/WorldCupNav.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import PremierBetBanner from '../components/PremierBetBanner.jsx';
import { navigateTo } from '../components/NavLink.jsx';
import { supabase, supabaseConfigured } from '../services/supabaseClient.js';
import { getFixturesByDate } from '../services/apiFootball.js';
import { WC_CONFIG, wcFacts } from '../data/worldCupData.js';

// ── shared with the original WorldCup.jsx — same fixture picking logic, kept
// local since this page only needs a compact featured-match card, not the
// full Matchroom experience. ──
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

function useCountdown() {
  const [left, setLeft] = useState(() => Math.max(0, new Date(WC_CONFIG.kickoff) - new Date()));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, new Date(WC_CONFIG.kickoff) - new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  const days = Math.floor(left / 86400000);
  const hrs = Math.floor((left % 86400000) / 3600000);
  const mins = Math.floor((left % 3600000) / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  return { days, hrs, mins, secs, isLive: left <= 0 };
}

// FIFA's published 2026 format — 48 teams, 104 matches, 16 host stadiums —
// is a fixed tournament rule, not performance data that a live query could
// contradict or that changes as the tournament runs. Kept as a named,
// documented constant rather than a bare literal in JSX, and never presented
// as something the DB "verified" — only Host Nations below is truly
// config-derived (WC_CONFIG.hosts), since that's actual project data.
const TOURNAMENT_FORMAT = { teams: 48, matches: 104, stadiums: 16 };
const HOST_FLAGS = { USA: '🇺🇸', Canada: '🇨🇦', Mexico: '🇲🇽' };

// Same headline generator the full Matchroom uses — deterministic off the two
// team names, no API call needed, so every card in the carousel below can
// carry the "mini matchroom" framing line the original featured-fixture card
// had, not just a bare scoreboard.
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

export default function WorldCupOverview() {
  const { days, hrs, mins, secs, isLive } = useCountdown();

  // Featured Matches carousel — a real window of fixtures (yesterday through
  // next week), live ones first, so there's genuinely more than one to scroll
  // through — same date-window technique the Matches page uses, not a mock.
  const [featuredList, setFeaturedList] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const days = [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => new Date(Date.now() + i * 86400000).toISOString().slice(0, 10));
        const results = await Promise.all(days.map(d => getFixturesByDate(d).catch(() => [])));
        const wc = results.flat().filter(f => isWorldCup(f));
        const live = wc.filter(f => WC_LIVE.includes(f.fixture?.status?.short));
        const done = wc.filter(f => WC_DONE.includes(f.fixture?.status?.short));
        const upcoming = wc.filter(f => !WC_LIVE.includes(f.fixture?.status?.short) && !WC_DONE.includes(f.fixture?.status?.short));
        const ordered = [...live, ...upcoming, ...done.reverse()].slice(0, 12);
        if (alive) setFeaturedList(ordered);
      } catch { /* carousel just shows its empty state */ }
      finally { if (alive) setFeaturedLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  // Stats leaders preview — real wc_leaders table, same source the full
  // Stats page uses, just capped to a short preview here.
  const [wcLeaders, setWcLeaders] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabaseConfigured || !supabase) return;
      const { data, error } = await supabase
        .from('wc_leaders').select('*')
        .order('goals', { ascending: false })
        .order('assists', { ascending: false })
        .limit(5);
      if (!error && alive) setWcLeaders(data || []);
    })();
    return () => { alive = false; };
  }, []);

  const dayIndex = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const validFacts = wcFacts.filter(f => f && f.fact);
  const factOfDay = validFacts.length ? validFacts[((dayIndex % validFacts.length) + validFacts.length) % validFacts.length] : null;



  return (
    <div className="page wc2">
      <style>{`
        .wc2 { --l:#a6ff00; --line:rgba(255,255,255,.09); --muted:#888; --glass:rgba(9,13,16,.5); color:#fff; position:relative; isolation:isolate; background:#050708; }
        .wc2::before { content:""; position:fixed; inset:0; z-index:-2; background:url("/assets/WC-overview-bg.png") center/cover no-repeat; pointer-events:none; }
        .wc2::after { content:""; position:fixed; inset:0; z-index:-1; pointer-events:none; background:radial-gradient(ellipse 90% 42% at 50% -4%,rgba(166,255,0,.07),transparent 60%),radial-gradient(ellipse 120% 90% at 50% 130%,rgba(18,42,14,.30),transparent 62%),linear-gradient(180deg,rgba(5,8,11,.24) 0%,rgba(5,8,11,.45) 45%,rgba(5,8,11,.58) 100%); }
        .wc2 * { box-sizing:border-box; }
        .wc2-hero { position:relative; overflow:hidden; border-radius:14px; padding:34px 30px 0; margin-bottom:20px; }
        .wc2-hero::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg,rgba(5,8,11,.55) 0%,rgba(5,8,11,.85) 100%); z-index:0; }
        .wc2-hero > * { position:relative; z-index:1; }
        .wc2-eyebrow { display:flex; align-items:center; gap:8px; color:var(--l); font:800 11px "Barlow Condensed",sans-serif; letter-spacing:.16em; text-transform:uppercase; }
        .wc2-hero h1 { margin:12px 0 10px; font:800 clamp(38px,5vw,64px)/.92 "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .wc2-hero p { margin:0 0 18px; color:#c9ced4; font:500 14px "Barlow",sans-serif; max-width:520px; }
        .wc2-kickoff-note { margin:10px 0 26px; color:var(--muted); font:600 11px "Barlow",sans-serif; letter-spacing:.04em; }
        .wc2-hero .wcnav { margin:22px 0 0; border-bottom:1px solid rgba(255,255,255,.1); }
        .wc2-countdown { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:var(--line); border:1px solid var(--line); border-radius:10px; overflow:hidden; max-width:460px; }
        .wc2-cd-cell { background:rgba(255,255,255,.04); padding:12px 14px; text-align:center; }
        .wc2-cd-cell strong { display:block; font:800 30px "Barlow Condensed",sans-serif; color:var(--l); }
        .wc2-cd-cell span { display:block; margin-top:3px; color:var(--muted); font:700 9px "Barlow",sans-serif; letter-spacing:.1em; text-transform:uppercase; }
        .wc2-row3 { display:grid; grid-template-columns:1.1fr 1.3fr 1fr; gap:16px; align-items:start; }
        @media(max-width:980px){ .wc2-row3 { grid-template-columns:1fr; } }
        .wc2-card { background:var(--glass); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid var(--line); border-radius:12px; padding:20px; margin-bottom:16px; }
        .wc2-h3 { margin:0 0 16px; color:#fff; font:800 15px "Barlow Condensed",sans-serif; text-transform:uppercase; letter-spacing:.03em; }
        .wc2-eyebrow-sm { color:var(--l); font:700 10px "Barlow",sans-serif; letter-spacing:.14em; text-transform:uppercase; margin-bottom:6px; display:block; }
        .wc2-summary-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
        .wc2-summary-cell { display:flex; flex-direction:column; align-items:center; gap:6px; text-align:center; }
        .wc2-icon { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid rgba(166,255,0,.35); font-size:16px; line-height:1; }
        .wc2-summary-cell strong { display:block; font:800 22px "Barlow Condensed",sans-serif; color:#fff; }
        .wc2-summary-cell span { display:block; color:var(--muted); font:700 9px "Barlow",sans-serif; letter-spacing:.08em; text-transform:uppercase; }
        .wc2-hosts { margin-top:16px; padding-top:14px; border-top:1px solid var(--line); color:var(--muted); font:600 11px "Barlow",sans-serif; }
        .wc2-carousel { display:flex; gap:12px; overflow-x:auto; padding-bottom:6px; scroll-snap-type:x proximity; }
        .wc2-carousel::-webkit-scrollbar { height:6px; }
        .wc2-carousel::-webkit-scrollbar-thumb { background:rgba(255,255,255,.15); border-radius:3px; }
        .wc2-fmatch { position:relative; flex:none; width:250px; background:rgba(255,255,255,.04); border:1px solid var(--line); border-radius:10px; padding:14px; cursor:pointer; scroll-snap-align:start; transition:border-color .12s; }
        .wc2-fmatch-headline { margin:10px 0 0; padding-top:10px; border-top:1px solid var(--line); color:#d8dde2; font:500 11px/1.4 "Barlow",sans-serif; font-style:italic; }
        .wc2-fmatch:hover { border-color:rgba(166,255,0,.35); }
        .wc2-fmatch-live { position:absolute; top:10px; right:10px; background:rgba(239,68,68,.15); color:#ef4444; font:800 8.5px "Barlow",sans-serif; letter-spacing:.06em; text-transform:uppercase; padding:2px 6px; border-radius:5px; }
        .wc2-fmatch-teams { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .wc2-fmatch-meta { margin-top:10px; text-align:center; color:var(--muted); font:600 10px "Barlow",sans-serif; letter-spacing:.04em; text-transform:uppercase; }
        .wc2-team { display:flex; flex-direction:column; align-items:center; gap:8px; flex:1; min-width:0; }
        .wc2-team img { width:36px; height:36px; object-fit:contain; }
        .wc2-team span { font:800 10.5px "Barlow Condensed",sans-serif; text-transform:uppercase; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
        .wc2-vs { text-align:center; flex:none; padding:0 6px; }
        .wc2-vs .score { font:800 22px "Barlow Condensed",sans-serif; color:var(--l); }
        .wc2-vs .vs { font:800 14px "Barlow Condensed",sans-serif; color:#666; }
        .wc2-empty { color:var(--muted); font:500 13px/1.6 "Barlow",sans-serif; text-align:center; padding:20px 0; }
        .wc2-leader-row { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--line); }
        .wc2-leader-row:last-child { border-bottom:none; }
        .wc2-leader-row .rank { width:22px; color:var(--muted); font:800 14px "Barlow Condensed",sans-serif; }
        .wc2-leader-row img { width:36px; height:36px; border-radius:50%; object-fit:cover; object-position:top; flex:none; }
        .wc2-leader-row .n { flex:1; min-width:0; }
        .wc2-leader-row .n strong { display:block; font:700 13px "Barlow",sans-serif; }
        .wc2-leader-row .n span { color:var(--muted); font:500 10.5px "Barlow",sans-serif; }
        .wc2-leader-row .g { text-align:right; }
        .wc2-leader-row .g b { display:block; color:var(--l); font:800 16px "Barlow Condensed",sans-serif; }
        .wc2-leader-row .g span { color:var(--muted); font:600 8.5px "Barlow",sans-serif; text-transform:uppercase; }
        .wc2-link { display:inline-flex; align-items:center; gap:6px; margin-top:12px; color:var(--l); font:700 11px "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; background:none; border:none; padding:0; }
        .wc2-fact { border-left:3px solid var(--l); background:rgba(255,255,255,.04); padding:16px 18px; border-radius:0 10px 10px 0; }
        .wc2-fact-emoji { font-size:26px; margin-bottom:8px; }
        .wc2-fact p { margin:0; color:#d8dde2; font:500 13px/1.6 "Barlow",sans-serif; }
        @media(max-width:820px){ .wc2-countdown { grid-template-columns:repeat(2,1fr); } }
        .wc2-cta { display:flex; align-items:center; gap:16px; background:var(--glass); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid var(--line); border-radius:12px; padding:18px 22px; flex-wrap:wrap; }
        .wc2-cta strong { display:block; font:800 15px "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .wc2-cta span { color:var(--muted); font:500 12px "Barlow",sans-serif; }
        .wc2-cta button { margin-left:auto; display:inline-flex; align-items:center; gap:8px; background:var(--l); border:none; color:#0a0a0a; font:800 12px "Barlow Condensed",sans-serif; letter-spacing:.08em; text-transform:uppercase; padding:10px 18px; border-radius:8px; cursor:pointer; }
      `}</style>

      <div className="wc2-hero">
        <div className="wc2-eyebrow"><Trophy size={14} /> {WC_CONFIG.edition}</div>
        <h1>Overview</h1>
        <p>The biggest stage. The ultimate data hub.</p>
        {!isLive ? (
          <>
            <div className="wc2-countdown">
              <div className="wc2-cd-cell"><strong>{days}</strong><span>Days</span></div>
              <div className="wc2-cd-cell"><strong>{String(hrs).padStart(2, '0')}</strong><span>Hrs</span></div>
              <div className="wc2-cd-cell"><strong>{String(mins).padStart(2, '0')}</strong><span>Mins</span></div>
              <div className="wc2-cd-cell"><strong>{String(secs).padStart(2, '0')}</strong><span>Secs</span></div>
            </div>
            <div className="wc2-kickoff-note">Until kickoff · {new Date(WC_CONFIG.kickoff).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </>
        ) : (
          <p>Live moments, the watchlist, and the data behind the tournament.</p>
        )}
        <WorldCupNav active="overview" />
      </div>

      <div className="wc2-row3">
        <div className="wc2-card">
          <h3 className="wc2-h3">Tournament Summary</h3>
          <div className="wc2-summary-grid">
            <div className="wc2-summary-cell"><span className="wc2-icon">👥</span><strong>{TOURNAMENT_FORMAT.teams}</strong><span>Teams</span></div>
            <div className="wc2-summary-cell"><span className="wc2-icon">⚽</span><strong>{TOURNAMENT_FORMAT.matches}</strong><span>Matches</span></div>
            <div className="wc2-summary-cell"><span className="wc2-icon">📍</span><strong>{TOURNAMENT_FORMAT.stadiums}</strong><span>Host Cities</span></div>
            <div className="wc2-summary-cell"><span className="wc2-icon">🏳️</span><strong>{WC_CONFIG.hosts.length}</strong><span>Host Nations</span></div>
          </div>
          <div className="wc2-hosts">{WC_CONFIG.hosts.map((h, i) => <span key={h}>{i > 0 && ' · '}{HOST_FLAGS[h] || ''} {h}</span>)}</div>
        </div>

        <div className="wc2-card">
          <span className="wc2-eyebrow-sm">Featured Match{featuredList[0]?.league?.round ? ` — ${featuredList[0].league.round}` : ''}</span>
          {featuredLoading ? (
            <div className="wc2-empty">Loading fixtures…</div>
          ) : featuredList.length === 0 ? (
            <div className="wc2-empty">No World Cup fixtures in range — check the full schedule.</div>
          ) : (
            <div className="wc2-carousel">
              {featuredList.map(f => {
                const st = f.fixture?.status?.short;
                const live = WC_LIVE.includes(st);
                const done = WC_DONE.includes(st);
                return (
                  <div className="wc2-fmatch" key={f.fixture?.id} onClick={() => navigateTo(`/world-cup/matchroom?fixtureId=${f.fixture?.id}&date=${(f.fixture?.date || '').slice(0, 10)}`)}>
                    {live && <span className="wc2-fmatch-live">LIVE {f.fixture?.status?.elapsed ?? ''}'</span>}
                    <div className="wc2-fmatch-teams">
                      <div className="wc2-team"><img src={f.teams?.home?.logo} alt={f.teams?.home?.name} /><span>{f.teams?.home?.name}</span></div>
                      <div className="wc2-vs">
                        {live || done ? <div className="score">{f.goals?.home ?? 0}–{f.goals?.away ?? 0}</div> : <div className="vs">VS</div>}
                      </div>
                      <div className="wc2-team"><img src={f.teams?.away?.logo} alt={f.teams?.away?.name} /><span>{f.teams?.away?.name}</span></div>
                    </div>
                    <div className="wc2-fmatch-meta">
                      {live ? 'Live now' : done ? 'Full time' : new Date(f.fixture?.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <p className="wc2-fmatch-headline">{wcHeadline(f.teams?.home?.name || 'Home', f.teams?.away?.name || 'Away')}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="wc2-card">
          <span className="wc2-eyebrow-sm">Stats Leaders</span>
          {wcLeaders.length === 0 ? (
            <div className="wc2-empty">Leaders populate once tournament matches kick off.</div>
          ) : (
            <>
              {wcLeaders.map((l, i) => (
                <div className="wc2-leader-row" key={l.api_player_id}>
                  <span className="rank">{i + 1}</span>
                  <ApiPlayerImage playerId={l.api_player_id} name={l.name} fallbackSrc="/assets/players/neutral-player.svg" alt={l.name} />
                  <div className="n"><strong>{l.name}</strong><span>{l.team}</span></div>
                  <div className="g"><b>{l.goals ?? 0}</b><span>Goals</span></div>
                </div>
              ))}
              <button className="wc2-link" onClick={() => navigateTo('/world-cup/stats')}>View full stats <ArrowRight size={13} /></button>
            </>
          )}
        </div>
      </div>

      {factOfDay && (
        <div className="wc2-card">
          <span className="wc2-eyebrow-sm">Did You Know</span>
          <div className="wc2-fact">
            <div className="wc2-fact-emoji">{factOfDay.emoji}</div>
            <p>{factOfDay.fact}</p>
          </div>
          <button className="wc2-link" onClick={() => navigateTo('/world-cup/history')}>More tournament history <ArrowRight size={13} /></button>
        </div>
      )}

      <PremierBetBanner source="worldcup" variant="bar" />

      <div className="wc2-cta" style={{ marginTop: 16 }}>
        <Trophy size={22} style={{ color: 'var(--l)' }} />
        <div>
          <strong>Get World Cup Founder Pass</strong>
          <span>Unlock deeper tournament data, player breakdowns and scout tools.</span>
        </div>
        <button type="button" onClick={() => navigateTo('/pricing')}>Get Founder Pass <ArrowRight size={14} /></button>
      </div>
    </div>
  );
}
