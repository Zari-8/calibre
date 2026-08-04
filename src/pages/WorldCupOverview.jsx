import { useEffect, useMemo, useState } from 'react';
import { Trophy, ArrowRight, Users, Goal, MapPin, Flag, Star } from 'lucide-react';
import WorldCupNav from '../components/WorldCupNav.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import PremierBetBanner from '../components/PremierBetBanner.jsx';
import { navigateTo } from '../components/NavLink.jsx';
import { supabase, supabaseConfigured } from '../services/supabaseClient.js';
import { getFixturesByDate, getFixtureStatistics, getFixtureLineups, getFixtureEvents, statValue } from '../services/apiFootball.js';
import { findStatsApiCompetitionId, findStatsApiMatch, getStatsApiMatchPlayerStats, getStatsApiMatchShotmap, pickStat, rowTeamName } from '../services/statsApi.js';
import { WC_CONFIG, wcFacts, featuredMatch, TEAM_FLAGS } from '../data/worldCupData.js';

// Dominance bar for one stat, home value growing from the right toward the
// label and away value growing from the left — only rendered once both
// sides have a real number (never a fabricated 0).
function DominanceBar({ label, home, away, suffix = '' }) {
  if (home == null || away == null) return null;
  const total = home + away || 1;
  const homePct = (home / total) * 100;
  return (
    <div className="wcfeat-bar-row">
      <span className="wcfeat-bar-val">{home}{suffix}</span>
      <div className="wcfeat-bar-track"><i style={{ width: `${homePct}%` }} /></div>
      <span className="wcfeat-bar-label">{label}</span>
      <div className="wcfeat-bar-track away"><i style={{ width: `${100 - homePct}%` }} /></div>
      <span className="wcfeat-bar-val away">{away}{suffix}</span>
    </div>
  );
}

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

export default function WorldCupOverview() {
  const { days, hrs, mins, secs, isLive } = useCountdown();

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

  // Live match data for the Featured Match — narrowly targeted at one known
  // fixture (a single confirmed date + the two real team names), not the
  // broad multi-week/name-substring sweep the bracket used to rely on, so
  // there's no risk of pulling in a different competition's match. If the
  // fixture can't be found or the fetch fails, the panel shows an honest
  // empty state rather than blank/fabricated numbers. Note: API-Football's
  // statistics endpoint doesn't include xG — that field isn't available
  // from this data source, so it's left out rather than estimated.
  const [matchData, setMatchData] = useState({ loading: true, stats: null, lineups: [], events: [] });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const fixtures = await getFixturesByDate(featuredMatch.fixtureDate).catch(() => []);
        const list = Array.isArray(fixtures) ? fixtures : [];
        const home = featuredMatch.homeApiName.toLowerCase();
        const away = featuredMatch.awayApiName.toLowerCase();
        const match = list.find(f => {
          const h = (f.teams?.home?.name || '').toLowerCase();
          const a = (f.teams?.away?.name || '').toLowerCase();
          return (h.includes(home) && a.includes(away)) || (h.includes(away) && a.includes(home));
        });
        const fixtureId = match?.fixture?.id;
        if (!fixtureId) { if (alive) setMatchData({ loading: false, stats: null, lineups: [], events: [] }); return; }
        const [stats, lineups, events] = await Promise.all([
          getFixtureStatistics(fixtureId).catch(() => null),
          getFixtureLineups(fixtureId).catch(() => []),
          getFixtureEvents(fixtureId).catch(() => []),
        ]);
        if (alive) setMatchData({ loading: false, stats, lineups: lineups || [], events: events || [] });
      } catch {
        if (alive) setMatchData({ loading: false, stats: null, lineups: [], events: [] });
      }
    })();
    return () => { alive = false; };
  }, []);

  const homeStatEntry = useMemo(() => matchData.stats?.find(s => (s.team?.name || '').toLowerCase().includes(featuredMatch.homeApiName.toLowerCase())) || null, [matchData.stats]);
  const awayStatEntry = useMemo(() => matchData.stats?.find(s => (s.team?.name || '').toLowerCase().includes(featuredMatch.awayApiName.toLowerCase())) || null, [matchData.stats]);
  const dominanceRows = useMemo(() => {
    if (!homeStatEntry || !awayStatEntry) return [];
    return [
      { label: 'Possession', home: statValue(homeStatEntry, 'Ball Possession'), away: statValue(awayStatEntry, 'Ball Possession'), suffix: '%' },
      { label: 'Total Shots', home: statValue(homeStatEntry, 'Total Shots'), away: statValue(awayStatEntry, 'Total Shots') },
      { label: 'Shots on Target', home: statValue(homeStatEntry, 'Shots on Goal'), away: statValue(awayStatEntry, 'Shots on Goal') },
      { label: 'Corners', home: statValue(homeStatEntry, 'Corner Kicks'), away: statValue(awayStatEntry, 'Corner Kicks') },
      { label: 'Fouls', home: statValue(homeStatEntry, 'Fouls'), away: statValue(awayStatEntry, 'Fouls') },
      { label: 'Pass Accuracy', home: statValue(homeStatEntry, 'Passes %'), away: statValue(awayStatEntry, 'Passes %'), suffix: '%' },
    ].filter(r => r.home != null && r.away != null);
  }, [homeStatEntry, awayStatEntry]);

  const homeFormation = useMemo(() => matchData.lineups.find(l => (l.team?.name || '').toLowerCase().includes(featuredMatch.homeApiName.toLowerCase()))?.formation || null, [matchData.lineups]);
  const awayFormation = useMemo(() => matchData.lineups.find(l => (l.team?.name || '').toLowerCase().includes(featuredMatch.awayApiName.toLowerCase()))?.formation || null, [matchData.lineups]);

  const timelineEvents = useMemo(() => (matchData.events || [])
    .filter(e => e.type === 'Goal' || e.type === 'Card')
    .sort((a, b) => (a.time?.elapsed || 0) - (b.time?.elapsed || 0)), [matchData.events]);

  // xG / Big Chances / Progressive Passes — API-Football's statistics
  // endpoint doesn't have these fields at all (confirmed against its
  // documented statistic types), but TheStatsAPI does, and this app already
  // uses it server-side for the Calibre rating engine (see scripts/
  // enrichStatsAPI.mjs and statsapi-enrich-advanced-season.mjs). Same
  // narrow-lookup approach as the API-Football fetch above: resolve the
  // World Cup's competition id, find this one match by date + real team
  // names, then pull its shotmap (for xG) and player-stats (for big chances
  // and progressive passes) — never a season-wide sweep.
  const [statsApiData, setStatsApiData] = useState({ loading: true, matchId: null, playerStats: [], shotmap: [] });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const compId = await findStatsApiCompetitionId('World Cup');
        const match = await findStatsApiMatch(featuredMatch.fixtureDate, featuredMatch.fixtureDate, featuredMatch.homeApiName, featuredMatch.awayApiName, compId);
        const matchId = match?.id || match?.match_id || null;
        if (!matchId) { if (alive) setStatsApiData({ loading: false, matchId: null, playerStats: [], shotmap: [] }); return; }
        const [playerStats, shotmap] = await Promise.all([
          getStatsApiMatchPlayerStats(matchId),
          getStatsApiMatchShotmap(matchId),
        ]);
        if (alive) setStatsApiData({ loading: false, matchId, playerStats, shotmap });
      } catch {
        if (alive) setStatsApiData({ loading: false, matchId: null, playerStats: [], shotmap: [] });
      }
    })();
    return () => { alive = false; };
  }, []);

  const statsApiTeamAgg = useMemo(() => {
    const home = featuredMatch.homeApiName.toLowerCase();
    const away = featuredMatch.awayApiName.toLowerCase();
    const agg = {
      home: { xg: 0, xgSeen: false, bigChances: 0, bigChancesSeen: false, progPasses: 0, progPassesSeen: false },
      away: { xg: 0, xgSeen: false, bigChances: 0, bigChancesSeen: false, progPasses: 0, progPassesSeen: false },
    };
    for (const shot of statsApiData.shotmap) {
      const teamName = rowTeamName(shot);
      const xg = pickStat(shot, ['expected_goals', 'xg']);
      if (xg == null) continue;
      const side = teamName.includes(home) ? 'home' : teamName.includes(away) ? 'away' : null;
      if (!side) continue;
      agg[side].xg += Number(xg);
      agg[side].xgSeen = true;
    }
    for (const row of statsApiData.playerStats) {
      const teamName = rowTeamName(row);
      const side = teamName.includes(home) ? 'home' : teamName.includes(away) ? 'away' : null;
      if (!side) continue;
      const bc = pickStat(row, ['shooting.big_chances_created', 'big_chances_created']);
      const pp = pickStat(row, ['passing.progressive_passes', 'progressive_passes', 'prog_passes']);
      if (bc != null) { agg[side].bigChances += Number(bc); agg[side].bigChancesSeen = true; }
      if (pp != null) { agg[side].progPasses += Number(pp); agg[side].progPassesSeen = true; }
    }
    return agg;
  }, [statsApiData]);

  const statsApiRows = useMemo(() => {
    const out = [];
    const { home, away } = statsApiTeamAgg;
    if (home.xgSeen && away.xgSeen) out.push({ label: 'xG', home: Number(home.xg.toFixed(2)), away: Number(away.xg.toFixed(2)) });
    if (home.bigChancesSeen && away.bigChancesSeen) out.push({ label: 'Big Chances', home: home.bigChances, away: away.bigChances });
    if (home.progPassesSeen && away.progPassesSeen) out.push({ label: 'Progressive Passes', home: home.progPasses, away: away.progPasses });
    return out;
  }, [statsApiTeamAgg]);

  const allDominanceRows = useMemo(() => [...statsApiRows, ...dominanceRows], [statsApiRows, dominanceRows]);
  const dataLoading = matchData.loading || statsApiData.loading;

  // Real match-specific numbers for the Man of the Match badge, if this
  // player's row can be matched by name in the same player-stats response —
  // falls back to just the static rating/Golden Ball tag if not found.
  const motmMatchStats = useMemo(() => {
    const name = featuredMatch.manOfTheMatch?.name?.toLowerCase();
    if (!name) return null;
    const row = statsApiData.playerStats.find(r => String(r.player_name || r.player?.name || '').toLowerCase().includes(name));
    if (!row) return null;
    const totalPasses = pickStat(row, ['passing.total_passes', 'total_passes']);
    const accuratePasses = pickStat(row, ['passing.accurate_passes', 'accurate_passes']);
    const duelsWon = pickStat(row, ['duels.won', 'duels_won']);
    const passAccuracy = totalPasses != null && accuratePasses != null && Number(totalPasses) > 0
      ? Math.round((Number(accuratePasses) / Number(totalPasses)) * 100) : null;
    if (passAccuracy == null && duelsWon == null) return null;
    return { passAccuracy, duelsWon };
  }, [statsApiData.playerStats]);

  const dayIndex = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const validFacts = wcFacts.filter(f => f && f.fact);
  const factOfDay = validFacts.length ? validFacts[((dayIndex % validFacts.length) + validFacts.length) % validFacts.length] : null;



  return (
    <div className="page wc2">
      <style>{`
        .wc2 { --l:#97cc0d; --line:rgba(255,255,255,.09); --muted:#888; --glass:rgba(9,13,16,.5); color:#fff; position:relative; isolation:isolate; background:#050708; }
        .wc2::before { content:""; position:fixed; inset:0; z-index:-2; background:url("/assets/WC-overview-bg.png") center/cover no-repeat; pointer-events:none; }
        .wc2::after { content:""; position:fixed; inset:0; z-index:-1; pointer-events:none; background:radial-gradient(ellipse 90% 42% at 50% -4%,rgba(151,204,13,.07),transparent 60%),radial-gradient(ellipse 120% 90% at 50% 130%,rgba(18,42,14,.30),transparent 62%),linear-gradient(180deg,rgba(5,8,11,.24) 0%,rgba(5,8,11,.45) 45%,rgba(5,8,11,.58) 100%); }
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
        .wc2-row2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:start; }
        @media(max-width:820px){ .wc2-row2 { grid-template-columns:1fr; } }
        .wcfeat { background:var(--glass); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid rgba(151,204,13,.3); border-radius:14px; padding:26px; margin-bottom:16px; }
        .wcfeat-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
        .wcfeat-rating { display:flex; align-items:center; gap:6px; background:rgba(151,204,13,.12); border:1px solid rgba(151,204,13,.35); color:var(--l); font:800 13px "Barlow Condensed",sans-serif; padding:5px 12px; border-radius:20px; }
        .wcfeat-rating small { color:var(--muted); font:700 8.5px "Barlow",sans-serif; letter-spacing:.05em; text-transform:uppercase; margin-left:2px; }
        .wcfeat-hero-moment { display:flex; align-items:center; gap:10px; background:rgba(151,204,13,.08); border:1px solid rgba(151,204,13,.25); border-radius:10px; padding:10px 14px; margin-bottom:20px; }
        .wcfeat-hm-icon { font-size:18px; }
        .wcfeat-hm-min { color:var(--l); font:800 14px "Barlow Condensed",sans-serif; flex:none; }
        .wcfeat-hm-text { color:#e9edf1; font:500 13px "Barlow",sans-serif; }
        .wcfeat-hm-text strong { color:#fff; font-weight:800; }
        .wcfeat-score { display:flex; align-items:center; justify-content:center; gap:28px; margin-bottom:8px; }
        .wcfeat-team { display:flex; flex-direction:column; align-items:center; gap:6px; flex:1; max-width:180px; }
        .wcfeat-flag { font-size:44px; line-height:1; }
        .wcfeat-team strong { font:800 15px "Barlow Condensed",sans-serif; text-transform:uppercase; text-align:center; }
        .wcfeat-team small { color:var(--muted); font:600 10px "Barlow",sans-serif; letter-spacing:.04em; }
        .wcfeat-scoreline { display:flex; align-items:center; gap:10px; flex:none; }
        .wcfeat-scoreline b { font:800 52px/1 "Barlow Condensed",sans-serif; color:var(--l); }
        .wcfeat-scoreline span { color:#555; font:800 30px "Barlow Condensed",sans-serif; }
        .wcfeat-meta { text-align:center; color:var(--muted); font:600 11px "Barlow",sans-serif; letter-spacing:.04em; text-transform:uppercase; margin-bottom:22px; }
        .wcfeat-badges { display:flex; gap:10px; margin-bottom:20px; }
        .wcfeat-badge { display:flex; align-items:center; gap:10px; flex:1; background:rgba(255,255,255,.04); border:1px solid var(--line); border-radius:10px; padding:12px 14px; }
        .wcfeat-badge svg { color:var(--l); flex:none; }
        .wcfeat-badge strong { display:block; color:#fff; font:800 13px "Barlow",sans-serif; }
        .wcfeat-badge span { color:var(--muted); font:500 11px "Barlow",sans-serif; }
        .wcfeat-label { display:block; color:var(--l); font:800 10px "Barlow Condensed",sans-serif; letter-spacing:.1em; text-transform:uppercase; margin-bottom:8px; }
        .wcfeat-why { margin-bottom:20px; }
        .wcfeat-why ul { margin:0; padding:0; list-style:none; display:grid; gap:6px; }
        .wcfeat-why li { display:flex; gap:8px; color:#d8dde2; font:500 12.5px/1.4 "Barlow",sans-serif; }
        .wcfeat-why li::before { content:"🏆"; flex:none; font-size:11px; }
        .wcfeat-tactical { margin-bottom:22px; padding-bottom:22px; border-bottom:1px solid var(--line); }
        .wcfeat-tactical p { margin:0; color:#d8dde2; font:500 12.5px/1.5 "Barlow",sans-serif; }
        .wcfeat-data { margin-bottom:20px; }
        .wcfeat-bar-row { display:grid; grid-template-columns:44px 1fr 100px 1fr 44px; align-items:center; gap:8px; margin-bottom:9px; }
        .wcfeat-bar-val { color:#fff; font:800 12px "Barlow Condensed",sans-serif; text-align:right; }
        .wcfeat-bar-val.away { text-align:left; }
        .wcfeat-bar-label { text-align:center; color:var(--muted); font:700 8.5px "Barlow",sans-serif; letter-spacing:.05em; text-transform:uppercase; }
        .wcfeat-bar-track { height:6px; border-radius:3px; background:rgba(255,255,255,.08); overflow:hidden; display:flex; justify-content:flex-end; }
        .wcfeat-bar-track.away { justify-content:flex-start; }
        .wcfeat-bar-track i { display:block; height:100%; background:var(--l); border-radius:3px; }
        .wcfeat-bar-track.away i { background:#ff8a3d; }
        .wcfeat-data-note { margin:10px 0 0; color:var(--muted); font:500 10.5px/1.5 "Barlow",sans-serif; font-style:italic; }
        .wcfeat-timeline { margin-bottom:22px; padding-bottom:22px; border-bottom:1px solid var(--line); display:grid; gap:7px; }
        .wcfeat-tl-row { display:flex; align-items:center; gap:9px; }
        .wcfeat-tl-min { color:var(--l); font:800 11px "Barlow Condensed",sans-serif; width:32px; flex:none; }
        .wcfeat-tl-icon { flex:none; }
        .wcfeat-tl-text { color:#d8dde2; font:500 12px "Barlow",sans-serif; }
        .wcfeat-tl-text strong { color:#fff; }
        .wcfeat-actions { display:flex; gap:10px; flex-wrap:wrap; }
        .wcfeat-actions button { display:inline-flex; align-items:center; gap:6px; background:var(--l); border:none; color:#0a0a0a; font:800 11px "Barlow Condensed",sans-serif; letter-spacing:.05em; text-transform:uppercase; padding:9px 16px; border-radius:8px; cursor:pointer; }
        .wcfeat-actions button.ghost { background:none; border:1px solid var(--line); color:#d8dde2; }
        .wc2-card { background:var(--glass); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid var(--line); border-radius:12px; padding:20px; margin-bottom:16px; }
        .wc2-h3 { margin:0 0 16px; color:#fff; font:800 15px "Barlow Condensed",sans-serif; text-transform:uppercase; letter-spacing:.03em; }
        .wc2-eyebrow-sm { color:var(--l); font:700 10px "Barlow",sans-serif; letter-spacing:.14em; text-transform:uppercase; margin-bottom:6px; display:block; }
        .wc2-summary-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
        .wc2-summary-cell { display:flex; flex-direction:column; align-items:center; gap:6px; text-align:center; }
        .wc2-icon { width:48px; height:48px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(151,204,13,.14); border:1.5px solid rgba(151,204,13,.5); color:var(--l); }
        .wc2-summary-cell strong { display:block; font:800 22px "Barlow Condensed",sans-serif; color:#fff; }
        .wc2-summary-cell span { display:block; color:var(--muted); font:700 9px "Barlow",sans-serif; letter-spacing:.08em; text-transform:uppercase; }
        .wc2-hosts { margin-top:16px; padding-top:14px; border-top:1px solid var(--line); color:var(--muted); font:600 11px "Barlow",sans-serif; }
        .wc2-carousel { display:flex; gap:12px; overflow-x:auto; padding-bottom:6px; scroll-snap-type:x proximity; }
        .wc2-carousel::-webkit-scrollbar { height:6px; }
        .wc2-carousel::-webkit-scrollbar-thumb { background:rgba(255,255,255,.15); border-radius:3px; }
        .wc2-fmatch { position:relative; flex:none; width:250px; background:rgba(255,255,255,.04); border:1px solid var(--line); border-radius:10px; padding:14px; cursor:pointer; scroll-snap-align:start; transition:border-color .12s; }
        .wc2-fmatch--solo { width:auto; cursor:default; }
        .wc2-fmatch--solo:hover { border-color:var(--line); }
        .wc2-fmatch-headline { margin:10px 0 0; padding-top:10px; border-top:1px solid var(--line); color:#d8dde2; font:500 11px/1.4 "Barlow",sans-serif; font-style:italic; }
        .wc2-fmatch:hover { border-color:rgba(151,204,13,.35); }
        .wc2-team-flag { display:block; font-size:32px; line-height:1; text-align:center; }
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

      <div className="wcfeat">
        <div className="wcfeat-top">
          <span className="wc2-eyebrow-sm">Featured Match — {featuredMatch.round}</span>
          <div className="wcfeat-rating"><Star size={13} fill="currentColor" /> {featuredMatch.calibreRating.score} <small>Calibre Rating</small></div>
        </div>

        {featuredMatch.heroMoment && (
          <div className="wcfeat-hero-moment">
            <span className="wcfeat-hm-icon">{featuredMatch.heroMoment.icon}</span>
            <span className="wcfeat-hm-min">{featuredMatch.heroMoment.minute}'</span>
            <span className="wcfeat-hm-text"><strong>{featuredMatch.heroMoment.scorer}</strong> — {featuredMatch.heroMoment.tag}</span>
          </div>
        )}

        <div className="wcfeat-score">
          <div className="wcfeat-team">
            <span className="wcfeat-flag">{TEAM_FLAGS[featuredMatch.home] || '🏳️'}</span>
            <strong>{featuredMatch.home}</strong>
            {homeFormation && <small>{homeFormation}</small>}
          </div>
          <div className="wcfeat-scoreline"><b>{featuredMatch.homeScore}</b><span>–</span><b>{featuredMatch.awayScore}</b></div>
          <div className="wcfeat-team">
            <span className="wcfeat-flag">{TEAM_FLAGS[featuredMatch.away] || '🏳️'}</span>
            <strong>{featuredMatch.away}</strong>
            {awayFormation && <small>{awayFormation}</small>}
          </div>
        </div>
        <div className="wcfeat-meta">{featuredMatch.note} · {featuredMatch.venue}</div>

        {featuredMatch.manOfTheMatch && (
          <div className="wcfeat-badges">
            <div className="wcfeat-badge">
              <Trophy size={18} />
              <div>
                <strong>{featuredMatch.manOfTheMatch.name} · {featuredMatch.manOfTheMatch.rating}</strong>
                <span>
                  Man of the Match — {featuredMatch.manOfTheMatch.tag}
                  {motmMatchStats && (
                    <>
                      {motmMatchStats.passAccuracy != null && ` · ${motmMatchStats.passAccuracy}% pass accuracy`}
                      {motmMatchStats.duelsWon != null && ` · ${motmMatchStats.duelsWon} duels won`}
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {featuredMatch.whyItMattered?.length > 0 && (
          <div className="wcfeat-why">
            <span className="wcfeat-label">Why It Mattered</span>
            <ul>{featuredMatch.whyItMattered.map((line, i) => <li key={i}>{line}</li>)}</ul>
          </div>
        )}

        <div className="wcfeat-tactical">
          <span className="wcfeat-label">Tactical Read</span>
          <p>{featuredMatch.analysis}</p>
        </div>

        <div className="wcfeat-data">
          <span className="wcfeat-label">Match Data</span>
          {dataLoading ? (
            <div className="wc2-empty">Loading live match statistics…</div>
          ) : allDominanceRows.length === 0 ? (
            <div className="wc2-empty">Live match statistics aren't available for this fixture right now.</div>
          ) : (
            <>
              {allDominanceRows.map(r => <DominanceBar key={r.label} {...r} />)}
              <p className="wcfeat-data-note">
                {statsApiRows.length > 0
                  ? 'xG, Big Chances and Progressive Passes via TheStatsAPI; the rest are directly reported match statistics.'
                  : "xG, Big Chances and Progressive Passes weren't available for this fixture from TheStatsAPI — the figures above are the directly reported match statistics."}
              </p>
            </>
          )}
        </div>

        {timelineEvents.length > 0 && (
          <div className="wcfeat-timeline">
            <span className="wcfeat-label">Timeline</span>
            {timelineEvents.map((e, i) => (
              <div className="wcfeat-tl-row" key={i}>
                <span className="wcfeat-tl-min">{e.time?.elapsed}{e.time?.extra ? `+${e.time.extra}` : ''}'</span>
                <span className="wcfeat-tl-icon">{e.type === 'Goal' ? '⚽' : e.detail === 'Red Card' ? '🟥' : '🟨'}</span>
                <span className="wcfeat-tl-text"><strong>{e.player?.name}</strong> · {e.team?.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="wcfeat-actions">
          <button type="button" onClick={() => navigateTo('/world-cup/matches')}>Knockout Bracket <ArrowRight size={13} /></button>
          <button type="button" className="ghost" onClick={() => navigateTo('/world-cup/stats')}>Tournament Stats <ArrowRight size={13} /></button>
        </div>
      </div>

      <div className="wc2-row2">
        <div className="wc2-card">
          <h3 className="wc2-h3">Tournament Summary</h3>
          <div className="wc2-summary-grid">
            <div className="wc2-summary-cell"><span className="wc2-icon"><Users size={24} strokeWidth={2.25} /></span><strong>{TOURNAMENT_FORMAT.teams}</strong><span>Teams</span></div>
            <div className="wc2-summary-cell"><span className="wc2-icon"><Goal size={24} strokeWidth={2.25} /></span><strong>{TOURNAMENT_FORMAT.matches}</strong><span>Matches</span></div>
            <div className="wc2-summary-cell"><span className="wc2-icon"><MapPin size={24} strokeWidth={2.25} /></span><strong>{TOURNAMENT_FORMAT.stadiums}</strong><span>Host Cities</span></div>
            <div className="wc2-summary-cell"><span className="wc2-icon"><Flag size={24} strokeWidth={2.25} /></span><strong>{WC_CONFIG.hosts.length}</strong><span>Host Nations</span></div>
          </div>
          <div className="wc2-hosts">{WC_CONFIG.hosts.map((h, i) => <span key={h}>{i > 0 && ' · '}{HOST_FLAGS[h] || ''} {h}</span>)}</div>
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
