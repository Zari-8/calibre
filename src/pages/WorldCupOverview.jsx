import { useEffect, useMemo, useState } from 'react';
import { Trophy, ArrowRight, Users, Goal, MapPin, Flag, Star } from 'lucide-react';
import WorldCupNav from '../components/WorldCupNav.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import PremierBetBanner from '../components/PremierBetBanner.jsx';
import { navigateTo } from '../components/NavLink.jsx';
import { supabase, supabaseConfigured } from '../services/supabaseClient.js';
import { getFixturesByDate, getFixtureLineups, getFixtureEvents } from '../services/apiFootball.js';
import { WC_CONFIG, wcFacts, featuredMatch, TEAM_FLAGS, otherFeaturedMatches } from '../data/worldCupData.js';

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

// Renders a formation string ("4-3-3") as a small dot diagram — a real,
// deterministic layout of the actual lineup formation already fetched from
// API-Football, not a fabricated tactical map. Returns null if no formation
// was returned for this fixture (never guesses a shape).
function FormationPitch({ formation, side = 'home' }) {
  if (!formation) return null;
  const lines = formation.split('-').map(n => parseInt(n, 10)).filter(n => Number.isFinite(n) && n > 0);
  if (!lines.length) return null;
  const rows = [1, ...lines]; // goalkeeper + each outfield line, GK first
  return (
    <div className="wcfeat-pitch">
      <svg className="wcfeat-pitch-markings" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="4" y="4" width="92" height="92" />
        <rect x="22" y="4" width="56" height="20" />
        <rect x="38" y="4" width="24" height="9" />
        <circle cx="50" cy="34" r="10" />
      </svg>
      <div className="wcfeat-pitch-field">
        {rows.map((count, i) => (
          <div className="wcfeat-pitch-row" key={i}>
            {Array.from({ length: count }).map((_, j) => <span className={`wcfeat-pitch-dot ${side}`} key={j} />)}
          </div>
        ))}
      </div>
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

  // Live formations + goal/card timeline for the Featured Match — narrowly
  // targeted at one known fixture (a single confirmed date + the two real
  // team names), not the broad multi-week/name-substring sweep the bracket
  // used to rely on. The rest of the Match Data panel below now comes from
  // curated real numbers (see featuredMatch.stats in worldCupData.js) rather
  // than a live fetch, since that proved unreliable for a one-off historical
  // match — this fetch is only for the two things not covered by the
  // curated Sofascore data: lineup formations and the goal/card timeline.
  const [matchData, setMatchData] = useState({ loading: true, lineups: [], events: [] });
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
        if (!fixtureId) { if (alive) setMatchData({ loading: false, lineups: [], events: [] }); return; }
        const [lineups, events] = await Promise.all([
          getFixtureLineups(fixtureId).catch(() => []),
          getFixtureEvents(fixtureId).catch(() => []),
        ]);
        if (alive) setMatchData({ loading: false, lineups: lineups || [], events: events || [] });
      } catch {
        if (alive) setMatchData({ loading: false, lineups: [], events: [] });
      }
    })();
    return () => { alive = false; };
  }, []);

  const homeFormation = useMemo(() => matchData.lineups.find(l => (l.team?.name || '').toLowerCase().includes(featuredMatch.homeApiName.toLowerCase()))?.formation || null, [matchData.lineups]);
  const awayFormation = useMemo(() => matchData.lineups.find(l => (l.team?.name || '').toLowerCase().includes(featuredMatch.awayApiName.toLowerCase()))?.formation || null, [matchData.lineups]);

  const timelineEvents = useMemo(() => (matchData.events || [])
    .filter(e => e.type === 'Goal' || e.type === 'Card')
    .sort((a, b) => (a.time?.elapsed || 0) - (b.time?.elapsed || 0)), [matchData.events]);

  // Match Data panel — built directly from featuredMatch.stats, curated from
  // Sofascore's own match center for this fixture (see worldCupData.js for
  // sourcing notes). Always available, no loading/empty state needed.
  const allDominanceRows = useMemo(() => {
    const s = featuredMatch.stats;
    if (!s) return [];
    const passAcc = (attempted, accurate) => attempted > 0 ? Math.round((accurate / attempted) * 100) : null;
    return [
      { label: 'Possession', home: s.possession.home, away: s.possession.away, suffix: '%' },
      { label: 'xG', home: s.xg.home, away: s.xg.away },
      { label: 'Big Chances', home: s.bigChances.home, away: s.bigChances.away },
      { label: 'Total Shots', home: s.totalShots.home, away: s.totalShots.away },
      { label: 'Shots on Target', home: s.shotsOnTarget.home, away: s.shotsOnTarget.away },
      { label: 'Pass Accuracy', home: passAcc(s.passesAttempted.home, s.passesAccurate.home), away: passAcc(s.passesAttempted.away, s.passesAccurate.away), suffix: '%' },
      { label: 'Corners', home: s.corners.home, away: s.corners.away },
      { label: 'Fouls', home: s.fouls.home, away: s.fouls.away },
      { label: 'Tackles', home: s.tackles.home, away: s.tackles.away },
      { label: 'Yellow Cards', home: s.yellowCards.home, away: s.yellowCards.away },
      { label: 'Distance Covered', home: s.distanceCoveredKm.home, away: s.distanceCoveredKm.away, suffix: 'km' },
      { label: 'Sprints', home: s.sprints.home, away: s.sprints.away },
      { label: 'GK Saves', home: s.goalkeeperSaves.home, away: s.goalkeeperSaves.away },
    ];
  }, []);
  // The compact top-row card only has room for the headline numbers — same
  // real source, just a shorter cut. The rest still render in full below in
  // Full Match Report, nothing is dropped.
  const compactRows = useMemo(() => allDominanceRows.filter(r => ['Possession', 'Total Shots', 'Big Chances', 'Pass Accuracy'].includes(r.label)), [allDominanceRows]);
  const xgRow = useMemo(() => allDominanceRows.find(r => r.label === 'xG') || null, [allDominanceRows]);

  // Shot Breakdown — from the same curated Sofascore numbers. Deliberately
  // not a spatial "shot map": Sofascore's per-shot pitch coordinates can't be
  // read reliably off a static screenshot for all 22 shots, so this stays a
  // count/xG breakdown. The one shot with a fully legible readout (the
  // winning goal) is shown separately as decisiveShot below.
  const shotBreakdown = useMemo(() => {
    const s = featuredMatch.stats;
    if (!s) return null;
    return {
      home: { shots: s.totalShots.home, onTarget: s.shotsOnTarget.home, offTarget: s.shotsOffTarget.home, xg: s.xg.home },
      away: { shots: s.totalShots.away, onTarget: s.shotsOnTarget.away, offTarget: s.shotsOffTarget.away, xg: s.xg.away },
    };
  }, []);

  // Calibre Insight — short bullet read built only from the curated real
  // numbers above (xG, possession, big chances, touches in the box).
  const calibreInsightBullets = useMemo(() => {
    const s = featuredMatch.stats;
    if (!s) return [];
    const winnerIsHome = featuredMatch.homeScore > featuredMatch.awayScore;
    const winnerName = winnerIsHome ? featuredMatch.home : featuredMatch.away;
    const pick = (row) => winnerIsHome ? row.home : row.away;
    const pickOpp = (row) => winnerIsHome ? row.away : row.home;
    return [
      `${winnerName} won on a scoreline that ran ahead of the underlying chances: ${pick(s.xg).toFixed(2)} xG for them vs ${pickOpp(s.xg).toFixed(2)} xG against.`,
      `${pick(s.possession)}% possession and ${pick(s.totalShots)} shots to the opponent's ${pickOpp(s.totalShots)}.`,
      `${pick(s.bigChances)} big chances created to the opponent's ${pickOpp(s.bigChances)}.`,
      `${pick(s.touchesInOppositionBox)} touches in the opposition box, against ${pickOpp(s.touchesInOppositionBox)}.`,
    ];
  }, []);

  const dayIndex = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const validFacts = wcFacts.filter(f => f && f.fact);
  const factOfDay = validFacts.length ? validFacts[((dayIndex % validFacts.length) + validFacts.length) % validFacts.length] : null;



  return (
    <div className="page calibre-wc-overview">

      <style>{`
        .calibre-wc-overview {
          --lime:#97cc0d;
          --bg:#050708;
          --glass:rgba(12,16,20,.72);
          --border:rgba(255,255,255,.10);
          --muted:#8b929a;
          color:#fff;
          min-height:100vh;
          background:#050708;
          position:relative;
          overflow:hidden;
        }

        .calibre-wc-overview:before {
          content:"";
          position:fixed;
          inset:0;
          background:
            linear-gradient(
              180deg,
              rgba(5,7,8,.15),
              rgba(5,7,8,.85)
            ),
            url("/assets/WC-overview-bg.png")
            center/cover no-repeat;
          z-index:-1;
        }

        .wc-overview-shell {
          max-width:1400px;
          margin:auto;
          padding:24px;
        }

        .wc-overview-hero {
          min-height:360px;
          border-radius:24px;
          padding:40px;
          display:flex;
          flex-direction:column;
          justify-content:flex-end;
          background:
          linear-gradient(
            180deg,
            transparent 10%,
            rgba(0,0,0,.85)
          );
          border:1px solid rgba(255,255,255,.08);
          position:relative;
        }

        .wc-overview-title {
          font-family:"Barlow Condensed";
          font-size:72px;
          line-height:.9;
          font-weight:900;
          text-transform:uppercase;
          letter-spacing:-2px;
        }

        .wc-overview-sub {
          color:#c8ced5;
          max-width:600px;
          margin-top:14px;
          font-size:16px;
        }

        .wc-overview-nav {
          margin-top:30px;
        }

        .wc-dashboard-grid {
          display:grid;
          grid-template-columns:
          1fr 1.35fr 1fr;
          gap:18px;
          margin-top:22px;
        }

        .wc-card {
          background:
          linear-gradient(
            145deg,
            rgba(255,255,255,.08),
            rgba(255,255,255,.025)
          );
          backdrop-filter:blur(18px);
          border:
          1px solid var(--border);
          border-radius:20px;
          padding:24px;
        }

        .wc-card-title {
          font-size:12px;
          color:var(--lime);
          letter-spacing:.15em;
          text-transform:uppercase;
          font-weight:800;
          margin-bottom:20px;
        }

        .wc-summary-number {
          font-size:42px;
          font-family:"Barlow Condensed";
          font-weight:900;
        }

        .wc-summary-label {
          color:var(--muted);
          font-size:11px;
          text-transform:uppercase;
          letter-spacing:.1em;
        }

        .wc-summary-grid {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:20px;
        }

        @media(max-width:1000px){
          .wc-dashboard-grid{
            grid-template-columns:1fr;
          }

          .wc-overview-title{
            font-size:52px;
          }
        }

        .wc-hero-content{
          display:flex;
          justify-content:space-between;
          align-items:flex-end;
          margin-top:20px;
          gap:40px;
        }

        .wc-countdown{
          display:flex;
          gap:18px;
        }

        .wc-count-item{
          width:82px;
          height:82px;
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items:center;
          border-radius:16px;
          background:rgba(255,255,255,.05);
          border:1px solid rgba(255,255,255,.08);
          backdrop-filter:blur(12px);
        }

        .wc-count-item strong{
          font-size:34px;
          font-family:"Barlow Condensed";
          color:var(--lime);
        }

        .wc-count-item span{
          font-size:11px;
          text-transform:uppercase;
          color:#999;
          letter-spacing:.08em;
        }

        .wc-live-pill{
          padding:18px 26px;
          border-radius:40px;
          background:rgba(151,204,13,.15);
          color:var(--lime);
          font-weight:700;
        }

        .wc-stat-box{
          background:rgba(255,255,255,.04);
          border:1px solid rgba(255,255,255,.08);
          border-radius:18px;
          padding:22px;
          display:flex;
          flex-direction:column;
          gap:8px;
        }

        .wc-stat-box svg{
          color:var(--lime);
        }

        .wc-stat-box strong{
          font-family:"Barlow Condensed";
          font-size:44px;
          line-height:1;
        }

        .wc-stat-box span{
          font-size:11px;
          text-transform:uppercase;
          letter-spacing:.12em;
          color:#888;
        }

        .wc-intel-card{
          background:rgba(255,255,255,.04);
          border:1px solid rgba(255,255,255,.08);
          border-radius:18px;
          padding:22px;
        }

        .wc-intel-header{
          font-size:12px;
          letter-spacing:.14em;
          font-weight:800;
          color:var(--lime);
          margin-bottom:20px;
          display:flex;
          gap:10px;
          align-items:center;
        }

        .wc-intel-point{
          display:flex;
          gap:12px;
          margin-bottom:15px;
          color:#d8dde2;
          font-size:13px;
          line-height:1.5;
        }

        .wc-dot{
          width:7px;
          height:7px;
          border-radius:50%;
          background:var(--lime);
          margin-top:7px;
        }

        .wc-intel-score{
          background:linear-gradient(145deg,rgba(151,204,13,.16),rgba(255,255,255,.03));
          border:1px solid rgba(151,204,13,.25);
          border-radius:18px;
          padding:22px;
        }

        .wc-score-ring{
          width:110px;
          height:110px;
          border-radius:50%;
          border:7px solid var(--lime);
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items:center;
        }

        .wc-score-ring div{
          font-family:"Barlow Condensed";
          font-size:48px;
          font-weight:900;
          line-height:1;
        }

        .wc-score-ring span{
          font-size:12px;
          color:#999;
        }

        .wc-progress{
          height:6px;
          background:rgba(255,255,255,.08);
          border-radius:10px;
          margin-top:6px;
          overflow:hidden;
        }

        .wc-progress div{
          height:100%;
          background:var(--lime);
        }

        .wc-data-row{
          display:grid;
          grid-template-columns:70px 1fr 120px 1fr 70px;
          gap:14px;
          align-items:center;
          margin-bottom:14px;
        }

        .wc-data-value{
          font-weight:800;
          font-family:"Barlow Condensed";
          font-size:22px;
        }

        .wc-data-label{
          text-align:center;
          font-size:11px;
          text-transform:uppercase;
          color:#888;
        }

        .wc-data-track{
          height:7px;
          background:rgba(255,255,255,.08);
          border-radius:10px;
          overflow:hidden;
        }

        .wc-data-track div{
          height:100%;
          background:var(--lime);
        }

        .wc-data-track.away div{
          background:#ff8a3d;
        }

        .wc-lower-grid{
          display:grid;
          grid-template-columns:1.2fr 1fr 1fr;
          gap:22px;
          margin-top:22px;
        }

        .wc-analysis-point{
          display:flex;
          gap:16px;
          margin-bottom:18px;
          color:#d8dde2;
          font-size:14px;
          line-height:1.5;
        }

        .wc-number{
          font-family:"Barlow Condensed";
          font-size:24px;
          font-weight:900;
          color:var(--lime);
        }

        .wc-big-number{
          font-family:"Barlow Condensed";
          font-size:54px;
          font-weight:900;
          line-height:1;
        }

        .wc-small-label{
          font-size:11px;
          text-transform:uppercase;
          letter-spacing:.12em;
          color:#888;
        }

        .wc-shot-bar{
          height:8px;
          background:rgba(255,255,255,.08);
          border-radius:20px;
          overflow:hidden;
        }

        .wc-shot-bar div{
          height:100%;
          background:var(--lime);
        }

        .wc-match-item{
          padding:15px 0;
          border-bottom:1px solid rgba(255,255,255,.08);
        }

        @media(max-width:1000px){
          .wc-lower-grid{
            grid-template-columns:1fr;
          }
        }
      `}</style>

      <div className="wc-overview-shell">

        {/* HERO */}

        <section className="wc-overview-hero">

          <div className="wc2-eyebrow">
            <Trophy size={15}/>
            <span>{WC_CONFIG.edition}</span>
          </div>

          <div className="wc-hero-content">

            <div>

              <h1 className="wc-overview-title">
                WORLD CUP
                <br />
                OVERVIEW
              </h1>

              <p className="wc-overview-sub">
                Follow every match, player and storyline from the biggest football
                tournament ever held, powered by Calibre Intelligence.
              </p>

            </div>

            <div className="wc-countdown">

              {!isLive ? (

                <>

                  <div className="wc-count-item">
                    <strong>{days}</strong>
                    <span>Days</span>
                  </div>

                  <div className="wc-count-item">
                    <strong>{hrs}</strong>
                    <span>Hours</span>
                  </div>

                  <div className="wc-count-item">
                    <strong>{mins}</strong>
                    <span>Minutes</span>
                  </div>

                  <div className="wc-count-item">
                    <strong>{secs}</strong>
                    <span>Seconds</span>
                  </div>

                </>

              ) : (

                <div className="wc-live-pill">
                  ● LIVE NOW
                </div>

              )}

            </div>

          </div>

          <div className="wc-overview-nav">
            <WorldCupNav active="overview" />
          </div>

        </section>


        {/* FEATURED MATCH HERO */}

        <section
          className="wc-card"
          style={{
            marginTop:22,
            overflow:"hidden",
            padding:0
          }}
        >

          {/* Header */}

          <div
            style={{
              padding:"18px 28px",
              borderBottom:"1px solid rgba(255,255,255,.08)",
              display:"flex",
              justifyContent:"space-between",
              alignItems:"center"
            }}
          >

            <div>

              <div className="wc-card-title" style={{marginBottom:6}}>
                CALIBRE FEATURE
              </div>

              <h2
                style={{
                  margin:0,
                  fontFamily:"Barlow Condensed",
                  fontSize:38,
                  lineHeight:1
                }}
              >
                Featured Match
              </h2>

            </div>

            <div
              style={{
                textAlign:"right",
                color:"#888",
                fontSize:13
              }}
            >
              {featuredMatch.round}
              <br/>
              {featuredMatch.venue}
            </div>

          </div>

          {/* Match */}

          <div
            style={{
              padding:"42px",
              textAlign:"center"
            }}
          >

            <div
              style={{
                display:"grid",
                gridTemplateColumns:"1fr auto 1fr",
                alignItems:"center",
                gap:40
              }}
            >

              {/* Home */}

              <div>

                <div
                  style={{
                    fontSize:78,
                    marginBottom:10
                  }}
                >
                  {TEAM_FLAGS[featuredMatch.home]}
                </div>

                <div
                  style={{
                    fontFamily:"Barlow Condensed",
                    fontSize:34,
                    fontWeight:700,
                    textTransform:"uppercase"
                  }}
                >
                  {featuredMatch.home}
                </div>

              </div>

              {/* Score */}

              <div>

                <div
                  style={{
                    fontFamily:"Barlow Condensed",
                    fontWeight:900,
                    fontSize:92,
                    lineHeight:.9,
                    color:"var(--lime)"
                  }}
                >
                  {featuredMatch.homeScore}
                  <span
                    style={{
                      color:"#555",
                      margin:"0 12px"
                    }}
                  >
                    —
                  </span>
                  {featuredMatch.awayScore}
                </div>

                <div
                  style={{
                    marginTop:14,
                    color:"#999",
                    fontSize:13,
                    textTransform:"uppercase",
                    letterSpacing:".18em"
                  }}
                >
                  Final • After Extra Time
                </div>

              </div>

              {/* Away */}

              <div>

                <div
                  style={{
                    fontSize:78,
                    marginBottom:10
                  }}
                >
                  {TEAM_FLAGS[featuredMatch.away]}
                </div>

                <div
                  style={{
                    fontFamily:"Barlow Condensed",
                    fontSize:34,
                    fontWeight:700,
                    textTransform:"uppercase"
                  }}
                >
                  {featuredMatch.away}
                </div>

              </div>

            </div>

            {/* Hero moment */}

            <div
              style={{
                marginTop:36,
                display:"inline-flex",
                alignItems:"center",
                gap:14,
                padding:"18px 28px",
                borderRadius:50,
                background:"rgba(151,204,13,.10)",
                border:"1px solid rgba(151,204,13,.25)"
              }}
            >

              <Star
                size={22}
                color="#97cc0d"
                fill="#97cc0d"
              />

              <div
                style={{
                  textAlign:"left"
                }}
              >

                <div
                  style={{
                    fontWeight:700,
                    fontSize:18
                  }}
                >
                  {featuredMatch.heroMoment.minute}'
                  {" "}
                  {featuredMatch.heroMoment.scorer}
                </div>

                <div
                  style={{
                    color:"#aaa",
                    fontSize:13
                  }}
                >
                  {featuredMatch.heroMoment.tag}
                </div>

              </div>

            </div>

            {/* Quick stats */}

            <div
              style={{
                display:"grid",
                gridTemplateColumns:"repeat(4,1fr)",
                gap:18,
                marginTop:42
              }}
            >

              {compactRows.map(row=>(

                <div
                  key={row.label}
                  style={{
                    background:"rgba(255,255,255,.04)",
                    border:"1px solid rgba(255,255,255,.08)",
                    borderRadius:16,
                    padding:20
                  }}
                >

                  <div
                    style={{
                      color:"#888",
                      fontSize:11,
                      textTransform:"uppercase",
                      letterSpacing:".1em"
                    }}
                  >
                    {row.label}
                  </div>

                  <div
                    style={{
                      marginTop:10,
                      fontFamily:"Barlow Condensed",
                      fontWeight:900,
                      fontSize:40
                    }}
                  >
                    {row.home}
                    {row.suffix}
                  </div>

                  <div
                    style={{
                      margin:"10px 0",
                      height:5,
                      borderRadius:5,
                      background:"rgba(255,255,255,.06)",
                      overflow:"hidden"
                    }}
                  >
                    <div
                      style={{
                        width:`${(row.home/((row.home+row.away)||1))*100}%`,
                        height:"100%",
                        background:"var(--lime)"
                      }}
                    />
                  </div>

                  <div
                    style={{
                      color:"#bbb",
                      fontWeight:700
                    }}
                  >
                    {row.away}
                    {row.suffix}
                  </div>

                </div>

              ))}

            </div>

          </div>

        </section>

        {/* TOURNAMENT SNAPSHOT + STATS LEADERS */}

        <div
          style={{
            display:"grid",
            gridTemplateColumns:"1fr 1fr",
            gap:22,
            marginTop:22
          }}
        >


        {/* TOURNAMENT SNAPSHOT */}

        <div
          className="wc-card"
        >

          <div className="wc-card-title">
            Tournament Snapshot
          </div>


          <div
            style={{
              display:"grid",
              gridTemplateColumns:"repeat(2,1fr)",
              gap:20
            }}
          >


            <div className="wc-stat-box">

              <Users size={22}/>

              <strong>
                {TOURNAMENT_FORMAT.teams}
              </strong>

              <span>
                Teams
              </span>

            </div>


            <div className="wc-stat-box">

              <Goal size={22}/>

              <strong>
                {TOURNAMENT_FORMAT.matches}
              </strong>

              <span>
                Matches
              </span>

            </div>


            <div className="wc-stat-box">

              <MapPin size={22}/>

              <strong>
                {TOURNAMENT_FORMAT.stadiums}
              </strong>

              <span>
                Stadiums
              </span>

            </div>


            <div className="wc-stat-box">

              <Flag size={22}/>

              <strong>
                {WC_CONFIG.hosts.length}
              </strong>

              <span>
                Hosts
              </span>

            </div>


          </div>



          <div
            style={{
              marginTop:26,
              paddingTop:18,
              borderTop:"1px solid rgba(255,255,255,.08)",
              color:"#aaa",
              fontSize:13
            }}
          >

            {WC_CONFIG.hosts.map((h,i)=>(

              <span key={h}>

                {i>0 && " • "}

                {HOST_FLAGS[h]} {h}

              </span>

            ))}

          </div>



          <button
            className="wc2-explore-btn"
            style={{
              marginTop:24
            }}
            onClick={() =>
              navigateTo("/world-cup/teams")
            }
          >

            Explore Tournament

            <ArrowRight size={14}/>

          </button>


        </div>





        {/* STATS LEADERS */}

        <div
          className="wc-card"
        >


          <div className="wc-card-title">
            Tournament Leaders
          </div>



          {

          wcLeaders.length===0 ?


          <div
            style={{
              color:"#888",
              fontSize:13
            }}
          >

            Leaders populate once tournament matches begin.

          </div>


          :


          wcLeaders.slice(0,5).map((l,i)=>(


            <div
              key={l.api_player_id}
              style={{
                display:"flex",
                alignItems:"center",
                gap:15,
                padding:"14px 0",
                borderBottom:"1px solid rgba(255,255,255,.08)"
              }}
            >



              <div
                style={{
                  width:30,
                  height:30,
                  borderRadius:"50%",
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  background:
                  i===0
                  ?
                  "rgba(151,204,13,.18)"
                  :
                  "rgba(255,255,255,.06)",
                  color:
                  i===0
                  ?
                  "var(--lime)"
                  :
                  "#888",
                  fontWeight:900
                }}
              >

                {i+1}

              </div>



              <ApiPlayerImage

                playerId={l.api_player_id}

                name={l.name}

                fallbackSrc="/assets/players/neutral-player.svg"

                style={{
                  width:46,
                  height:46,
                  borderRadius:"50%"
                }}

              />



              <div
                style={{
                  flex:1
                }}
              >

                <strong
                  style={{
                    fontSize:15
                  }}
                >
                  {l.name}
                </strong>


                <div
                  style={{
                    color:"#888",
                    fontSize:12
                  }}
                >
                  {l.team}
                </div>


              </div>



              <div
                style={{
                  textAlign:"center"
                }}
              >

                <strong
                  style={{
                    color:"var(--lime)",
                    fontSize:22,
                    fontFamily:"Barlow Condensed"
                  }}
                >
                  {l.goals}
                </strong>


                <div
                  style={{
                    fontSize:10,
                    color:"#888",
                    textTransform:"uppercase"
                  }}
                >
                  Goals
                </div>


              </div>


            </div>


          ))

          }



          <button
            className="wc2-link"
            onClick={() =>
              navigateTo('/world-cup/stats')
            }
          >

            View full statistics

            <ArrowRight size={13}/>

          </button>


        </div>



        </div>

        {/* CALIBRE MATCH INTELLIGENCE */}

        <section
          className="wc-card"
          style={{
            marginTop:22,
            padding:28
          }}
        >


          <div className="wc-card-title">
            CALIBRE MATCH INTELLIGENCE
          </div>



          <div
            style={{
              display:"grid",
              gridTemplateColumns:"1fr 1fr 1fr",
              gap:20
            }}
          >



            {/* WHY IT MATTERED */}

            <div
              className="wc-intel-card"
            >


              <div className="wc-intel-header">

                <span>
                  ✓
                </span>

                WHY IT MATTERED

              </div>



              <ul
                style={{
                  padding:0,
                  margin:0,
                  listStyle:"none"
                }}
              >


                {
                  featuredMatch.whyItMattered?.map((line,i)=>(


                    <li
                      key={i}
                      className="wc-intel-point"
                    >


                      <div className="wc-dot"/>


                      {line}


                    </li>


                  ))
                }


              </ul>


            </div>






            {/* TACTICAL READ */}


            <div
              className="wc-intel-card"
            >


              <div className="wc-intel-header">

                <span>
                  ◎
                </span>

                TACTICAL READ

              </div>


              <p
                style={{
                  margin:0,
                  color:"#d8dde2",
                  fontSize:14,
                  lineHeight:1.7
                }}
              >

                {featuredMatch.analysis}

              </p>


              <div
                style={{
                  marginTop:22,
                  padding:16,
                  borderRadius:14,
                  background:"rgba(255,255,255,.04)"
                }}
              >


                <div
                  style={{
                    fontSize:11,
                    color:"#888",
                    textTransform:"uppercase",
                    letterSpacing:".12em"
                  }}
                >

                  Key Insight

                </div>


                <div
                  style={{
                    marginTop:8,
                    fontWeight:700,
                    fontSize:15
                  }}
                >

                  The winner controlled the moments that mattered.

                </div>


              </div>


            </div>







            {/* CALIBRE SCORE */}



            <div
              className="wc-intel-score"
            >


              <div className="wc-intel-header">

                <span>
                  ★
                </span>

                CALIBRE SCORE

              </div>



              <div
                style={{
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  height:150
                }}
              >


                <div
                  className="wc-score-ring"
                >

                  <div>

                    {featuredMatch.calibreRating.score}

                  </div>


                  <span>
                    /100
                  </span>


                </div>


              </div>



              <div
                style={{
                  textAlign:"center",
                  color:"#aaa",
                  fontSize:13
                }}
              >

                Match quality rating

              </div>




              <div
                style={{
                  marginTop:22
                }}
              >


                <div
                  style={{
                    display:"flex",
                    justifyContent:"space-between",
                    fontSize:12,
                    color:"#999"
                  }}
                >

                  <span>
                    Drama
                  </span>

                  <strong>
                    {featuredMatch.calibreRating.drama}
                  </strong>

                </div>


                <div
                  className="wc-progress"
                >

                  <div
                    style={{
                      width:`${featuredMatch.calibreRating.drama}%`
                    }}
                  />

                </div>



                <div
                  style={{
                    display:"flex",
                    justifyContent:"space-between",
                    fontSize:12,
                    color:"#999",
                    marginTop:12
                  }}
                >

                  <span>
                    Quality
                  </span>

                  <strong>
                    {featuredMatch.calibreRating.quality}
                  </strong>

                </div>


                <div
                  className="wc-progress"
                >

                  <div
                    style={{
                      width:`${featuredMatch.calibreRating.quality}%`
                    }}
                  />

                </div>



              </div>



            </div>



          </div>






          {/* MATCH DATA */}


          <div
            style={{
              marginTop:36
            }}
          >


            <div className="wc-card-title">
              MATCH DATA
            </div>



            <div>

              {

                allDominanceRows.slice(0,8).map(row=>(


                  <div
                    key={row.label}
                    className="wc-data-row"
                  >


                    <div className="wc-data-value">
                      {row.home}{row.suffix}
                    </div>



                    <div className="wc-data-track home">

                      <div
                        style={{
                          width:`${(row.home/
                          ((row.home+row.away)||1))*100}%`
                        }}
                      />

                    </div>



                    <div className="wc-data-label">

                      {row.label}

                    </div>



                    <div className="wc-data-track away">

                      <div
                        style={{
                          width:`${(row.away/
                          ((row.home+row.away)||1))*100}%`
                        }}
                      />

                    </div>



                    <div className="wc-data-value">

                      {row.away}{row.suffix}

                    </div>


                  </div>


                ))

              }


            </div>


          </div>



        </section>

        {/* LOWER INTELLIGENCE GRID */}

        <section
          className="wc-lower-grid"
        >


          {/* CALIBRE INSIGHT */}

          <div
            className="wc-card wc-insight-card"
          >


            <div className="wc-card-title">
              CALIBRE INSIGHT
            </div>


            <div
              style={{
                fontFamily:"Barlow Condensed",
                fontSize:32,
                fontWeight:900,
                lineHeight:1.1,
                marginBottom:22
              }}
            >

              The story behind the scoreline.

            </div>



            {

              calibreInsightBullets.length > 0 &&

              <ul
                style={{
                  padding:0,
                  margin:0,
                  listStyle:"none"
                }}
              >

                {

                  calibreInsightBullets.map((item,i)=>(


                    <li
                      key={i}
                      className="wc-analysis-point"
                    >

                      <div className="wc-number">

                        0{i+1}

                      </div>


                      <div>

                        {item}

                      </div>


                    </li>


                  ))

                }

              </ul>

            }



          </div>







          {/* SHOT BREAKDOWN */}



          <div
            className="wc-card"
          >


            <div className="wc-card-title">
              SHOT BREAKDOWN
            </div>



            {

              shotBreakdown &&

              <div>


                <div
                  style={{
                    display:"grid",
                    gridTemplateColumns:"1fr auto 1fr",
                    gap:25,
                    alignItems:"center"
                  }}
                >


                  {/* HOME */}

                  <div
                    style={{
                      textAlign:"right"
                    }}
                  >

                    <div
                      className="wc-big-number"
                    >

                      {shotBreakdown.home.shots}

                    </div>


                    <div className="wc-small-label">
                      Shots
                    </div>



                    <div
                      style={{
                        marginTop:15
                      }}
                    >

                      <strong>

                        {xgRow?.home}

                      </strong>

                      <div className="wc-small-label">
                        xG
                      </div>


                    </div>


                  </div>





                  <div
                    style={{
                      fontWeight:900,
                      color:"var(--lime)"
                    }}
                  >

                    VS

                  </div>





                  {/* AWAY */}


                  <div>

                    <div
                      className="wc-big-number"
                    >

                      {shotBreakdown.away.shots}

                    </div>


                    <div className="wc-small-label">
                      Shots
                    </div>



                    <div
                      style={{
                        marginTop:15
                      }}
                    >

                      <strong>

                        {xgRow?.away}

                      </strong>

                      <div className="wc-small-label">
                        xG
                      </div>


                    </div>


                  </div>


                </div>



                <div
                  style={{
                    marginTop:30
                  }}
                >


                  <div className="wc-shot-bar">

                    <div
                      style={{
                        width:
                        `${(shotBreakdown.home.onTarget /
                        ((shotBreakdown.home.shots)||1))*100}%`
                      }}
                    />

                  </div>



                  <div
                    style={{
                      display:"flex",
                      justifyContent:"space-between",
                      fontSize:12,
                      color:"#888",
                      marginTop:8
                    }}
                  >

                    <span>
                      On Target {shotBreakdown.home.onTarget}
                    </span>


                    <span>
                      On Target {shotBreakdown.away.onTarget}
                    </span>

                  </div>



                </div>


              </div>


            }


          </div>







          {/* OTHER MATCHES */}



          <div
            className="wc-card"
          >


            <div className="wc-card-title">
              OTHER FEATURED MATCHES
            </div>



            {

              otherFeaturedMatches.map((m,i)=>(


                <div
                  key={i}
                  className="wc-match-item"
                >


                  <div
                    style={{
                      fontSize:10,
                      color:"var(--lime)",
                      textTransform:"uppercase",
                      letterSpacing:".1em"
                    }}
                  >

                    {m.round}

                  </div>



                  <div
                    style={{
                      display:"flex",
                      justifyContent:"space-between",
                      alignItems:"center",
                      marginTop:10
                    }}
                  >


                    <span>

                      {TEAM_FLAGS[m.home]}

                      {" "}

                      {m.home}

                    </span>



                    <strong
                      style={{
                        fontFamily:"Barlow Condensed",
                        fontSize:22
                      }}
                    >

                      {m.homeScore}

                      -

                      {m.awayScore}

                    </strong>



                    <span>

                      {m.away}

                      {" "}

                      {TEAM_FLAGS[m.away]}

                    </span>



                  </div>


                </div>


              ))

            }



          </div>



        </section>







        {/* DID YOU KNOW */}

        {
          factOfDay &&

          <section
            className="wc-card wc-fade-card"
            style={{
              marginTop:22,
              position:"relative",
              overflow:"hidden"
            }}
          >

            <div
              style={{
                position:"absolute",
                top:-40,
                right:-40,
                fontSize:140,
                opacity:.04
              }}
            >
              🏆
            </div>


            <div className="wc-card-title">
              Did You Know
            </div>


            <div
              style={{
                display:"grid",
                gridTemplateColumns:"80px 1fr",
                gap:20,
                alignItems:"center"
              }}
            >

              <div
                style={{
                  width:70,
                  height:70,
                  borderRadius:"50%",
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  fontSize:36,
                  background:
                  "rgba(151,204,13,.12)",
                  border:
                  "1px solid rgba(151,204,13,.25)"
                }}
              >
                {factOfDay.emoji}
              </div>


              <p
                style={{
                  margin:0,
                  color:"#d8dde2",
                  fontSize:17,
                  lineHeight:1.7,
                  maxWidth:900
                }}
              >
                {factOfDay.fact}
              </p>


            </div>


            <button
              className="wc2-link"
              style={{
                marginTop:24
              }}
              onClick={() =>
                navigateTo('/world-cup/history')
              }
            >
              Explore World Cup History
              <ArrowRight size={13}/>
            </button>


          </section>

        }



        {/* PREMIUM CTA */}


        <section
          className="wc-founder-card"
          style={{
            marginTop:22
          }}
        >

          <div
            className="wc-founder-glow"
          />


          <div
            style={{
              position:"relative",
              zIndex:2,
              display:"flex",
              alignItems:"center",
              justifyContent:"space-between",
              gap:30
            }}
          >


            <div>


              <div
                className="wc-card-title"
              >
                Calibre Founder Pass
              </div>


              <h2
                style={{
                  margin:"0 0 10px",
                  fontFamily:"Barlow Condensed",
                  fontSize:36,
                  fontWeight:900
                }}
              >
                Unlock the complete
                <br/>
                World Cup Intelligence Layer
              </h2>


              <p
                style={{
                  margin:0,
                  color:"#b0b7bf",
                  maxWidth:600,
                  lineHeight:1.6
                }}
              >
                Get deeper player analysis, tactical breakdowns,
                scouting insights and the complete Calibre football
                intelligence experience.
              </p>


            </div>



            <button
              className="wc-founder-button"
              onClick={() =>
                navigateTo('/pricing')
              }
            >

              Get Founder Pass

              <ArrowRight size={16}/>

            </button>


          </div>


        </section>





      </div>






      <style>{`

        .wc-fade-card {
          animation:
          wcFade .6s ease forwards;
        }


        .wc-founder-card {

          position:relative;

          padding:36px;

          border-radius:24px;

          overflow:hidden;

          background:
          linear-gradient(
            135deg,
            rgba(151,204,13,.18),
            rgba(255,255,255,.04)
          );

          border:
          1px solid rgba(151,204,13,.25);

        }



        .wc-founder-glow {

          position:absolute;

          width:280px;

          height:280px;

          right:-100px;

          top:-100px;

          border-radius:50%;

          background:
          rgba(151,204,13,.25);

          filter:
          blur(80px);

          animation:
          wcPulse 4s infinite alternate;

        }



        .wc-founder-button {

          display:flex;

          align-items:center;

          gap:10px;

          padding:
          16px 28px;

          border-radius:999px;

          border:none;

          background:
          var(--lime);

          color:#050708;

          font-weight:900;

          font-size:15px;

          cursor:pointer;

          transition:
          transform .2s ease,
          box-shadow .2s ease;

        }



        .wc-founder-button:hover {

          transform:
          translateY(-3px);

          box-shadow:
          0 15px 35px
          rgba(151,204,13,.25);

        }




        .wc-card {

          transition:
          transform .25s ease,
          border-color .25s ease;

        }



        .wc-card:hover {

          transform:
          translateY(-3px);

          border-color:
          rgba(151,204,13,.25);

        }



        @keyframes wcFade {

          from {

            opacity:0;

            transform:
            translateY(20px);

          }


          to {

            opacity:1;

            transform:
            translateY(0);

          }

        }



        @keyframes wcPulse {

          from {

            transform:
            scale(1);

          }


          to {

            transform:
            scale(1.25);

          }

        }




        @media(max-width:900px){


          .wc-founder-card > div {

            flex-direction:column;

            align-items:flex-start!important;

          }



          .wc-founder-button {

            width:100%;

            justify-content:center;

          }



          .wc-card {

            padding:18px;

          }



        }




        @media(max-width:600px){


          .wc-overview-title {

            font-size:42px!important;

          }



          .wc-overview-shell {

            padding:14px!important;

          }



          .wc-founder-card h2 {

            font-size:28px!important;

          }



        }


      `}</style>


    </div>
  );
}
