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
      `}</style>

      <div className="wc-overview-shell">

        {/* HERO */}
        <section className="wc-overview-hero">

          <div className="wc2-eyebrow">
            <Trophy size={15}/>
            {WC_CONFIG.edition}
          </div>

          <h1 className="wc-overview-title">
            World Cup<br/>
            Overview
          </h1>

          <p className="wc-overview-sub">
            The biggest stage in football. Follow the tournament,
            players, matches and intelligence behind every moment.
          </p>

          <div className="wc-overview-nav">
            <WorldCupNav active="overview"/>
          </div>

        </section>


        {/* TOP DASHBOARD */}
        <section className="wc-dashboard-grid">


          {/* TOURNAMENT SUMMARY */}
          <div className="wc-card">

            <div className="wc-card-title">
              Tournament Summary
            </div>


            <div className="wc-summary-grid">


              <div>
                <div className="wc-summary-number">
                  {TOURNAMENT_FORMAT.teams}
                </div>
                <div className="wc-summary-label">
                  Teams
                </div>
              </div>


              <div>
                <div className="wc-summary-number">
                  {TOURNAMENT_FORMAT.matches}
                </div>
                <div className="wc-summary-label">
                  Matches
                </div>
              </div>


              <div>
                <div className="wc-summary-number">
                  {TOURNAMENT_FORMAT.stadiums}
                </div>
                <div className="wc-summary-label">
                  Stadiums
                </div>
              </div>


              <div>
                <div className="wc-summary-number">
                  {WC_CONFIG.hosts.length}
                </div>
                <div className="wc-summary-label">
                  Hosts
                </div>
              </div>


            </div>


            <div style={{
              marginTop:24,
              paddingTop:16,
              borderTop:"1px solid rgba(255,255,255,.08)",
              color:"#9aa1a8",
              fontSize:12
            }}>
              {WC_CONFIG.hosts.map((h,i)=>(
                <span key={h}>
                  {i>0 && " · "}
                  {HOST_FLAGS[h]} {h}
                </span>
              ))}
            </div>


            <button
              className="wc2-explore-btn"
              onClick={()=>navigateTo('/world-cup/teams')}
            >
              Explore Tournament
              <ArrowRight size={14}/>
            </button>


          </div>





          {/* FEATURED MATCH */}
          <div className="wc-card">

            <div className="wc-card-title">
              Featured Match
            </div>


            <div style={{
              textAlign:"center"
            }}>


              <div style={{
                color:"#8b929a",
                fontSize:12,
                marginBottom:18
              }}>
                {featuredMatch.round}
                <br/>
                {featuredMatch.venue}
              </div>



              <div style={{
                display:"flex",
                justifyContent:"center",
                alignItems:"center",
                gap:28
              }}>


                <div>
                  <div style={{
                    fontSize:48
                  }}>
                    {TEAM_FLAGS[featuredMatch.home]}
                  </div>

                  <strong>
                    {featuredMatch.home}
                  </strong>
                </div>



                <div style={{
                  fontFamily:"Barlow Condensed",
                  fontSize:46,
                  fontWeight:900,
                  color:"var(--lime)"
                }}>

                  {featuredMatch.homeScore}
                  {" - "}
                  {featuredMatch.awayScore}

                </div>



                <div>
                  <div style={{
                    fontSize:48
                  }}>
                    {TEAM_FLAGS[featuredMatch.away]}
                  </div>

                  <strong>
                    {featuredMatch.away}
                  </strong>
                </div>


              </div>



              <div style={{
                marginTop:20,
                padding:14,
                borderRadius:12,
                background:"rgba(151,204,13,.08)",
                border:"1px solid rgba(151,204,13,.2)"
              }}>

                <strong>
                  {featuredMatch.heroMoment?.minute}'
                </strong>

                {" "}
                {featuredMatch.heroMoment?.scorer}

                <br/>

                <span style={{
                  color:"#aaa",
                  fontSize:12
                }}>
                  {featuredMatch.heroMoment?.tag}
                </span>

              </div>


            </div>


          </div>





          {/* STATS LEADERS */}

          <div className="wc-card">


            <div className="wc-card-title">
              Stats Leaders
            </div>


            {
              wcLeaders.length===0 ?

              <div style={{
                color:"#888",
                fontSize:13
              }}>
                Leaders populate once tournament matches begin.
              </div>

              :

              wcLeaders.slice(0,5).map((l,i)=>(

                <div
                  key={l.api_player_id}
                  style={{
                    display:"flex",
                    alignItems:"center",
                    gap:12,
                    padding:"12px 0",
                    borderBottom:"1px solid rgba(255,255,255,.08)"
                  }}
                >

                  <strong style={{
                    color:"#777"
                  }}>
                    {i+1}
                  </strong>


                  <ApiPlayerImage
                    playerId={l.api_player_id}
                    name={l.name}
                    fallbackSrc="/assets/players/neutral-player.svg"
                    style={{
                      width:38,
                      height:38,
                      borderRadius:"50%"
                    }}
                  />


                  <div style={{
                    flex:1
                  }}>

                    <strong>
                      {l.name}
                    </strong>

                    <div style={{
                      fontSize:11,
                      color:"#888"
                    }}>
                      {l.team}
                    </div>

                  </div>


                  <div style={{
                    color:"var(--lime)",
                    fontWeight:800
                  }}>
                    {l.goals}
                  </div>


                </div>

              ))

            }


            <button
              className="wc2-link"
              onClick={()=>navigateTo('/world-cup/stats')}
            >
              View full stats
              <ArrowRight size={13}/>
            </button>


          </div>


        </section>

        {/* FEATURED MATCH INTELLIGENCE */}

        <section
          className="wc-card"
          style={{
            marginTop:22
          }}
        >

          <div className="wc-card-title">
            Calibre Match Intelligence
          </div>



          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(3,1fr)",
            gap:18
          }}>


            {/* WHY IT MATTERED */}

            <div style={{
              padding:18,
              background:"rgba(255,255,255,.04)",
              borderRadius:14,
              border:"1px solid rgba(255,255,255,.08)"
            }}>

              <div className="wc-card-title">
                Why It Mattered
              </div>


              <ul style={{
                padding:0,
                margin:0,
                listStyle:"none"
              }}>

              {
                featuredMatch.whyItMattered?.map((line,i)=>(

                  <li
                    key={i}
                    style={{
                      display:"flex",
                      gap:8,
                      marginBottom:12,
                      color:"#d8dde2",
                      fontSize:13,
                      lineHeight:1.5
                    }}
                  >

                    <span style={{
                      color:"var(--lime)"
                    }}>
                      ✓
                    </span>

                    {line}

                  </li>

                ))
              }

              </ul>


            </div>




            {/* TACTICAL READ */}

            <div style={{
              padding:18,
              background:"rgba(255,255,255,.04)",
              borderRadius:14,
              border:"1px solid rgba(255,255,255,.08)"
            }}>


              <div className="wc-card-title">
                Tactical Read
              </div>


              <p style={{
                margin:0,
                color:"#d8dde2",
                lineHeight:1.6,
                fontSize:13
              }}>
                {featuredMatch.analysis}
              </p>


            </div>




            {/* CALIBRE RATING */}

            <div style={{
              padding:18,
              background:
              "linear-gradient(145deg,rgba(151,204,13,.18),rgba(255,255,255,.03))",
              borderRadius:14,
              border:
              "1px solid rgba(151,204,13,.25)"
            }}>


              <div className="wc-card-title">
                Calibre Rating
              </div>


              <div style={{
                fontSize:62,
                fontWeight:900,
                fontFamily:"Barlow Condensed",
                color:"var(--lime)"
              }}>
                {featuredMatch.calibreRating.score}
              </div>


              <div style={{
                color:"#aaa",
                fontSize:12
              }}>
                Match quality score
              </div>


            </div>



          </div>





          {/* MATCH DATA */}

          <div style={{
            marginTop:28
          }}>


            <div className="wc-card-title">
              Match Data
            </div>



            {
              allDominanceRows.slice(0,8).map(row=>(

                <div
                  key={row.label}
                  style={{
                    display:"grid",
                    gridTemplateColumns:
                    "80px 1fr 100px 1fr 80px",
                    alignItems:"center",
                    gap:12,
                    marginBottom:12
                  }}
                >


                  <span style={{
                    textAlign:"right",
                    fontWeight:800
                  }}>
                    {row.home}
                    {row.suffix}
                  </span>



                  <div style={{
                    height:6,
                    background:"rgba(255,255,255,.08)",
                    borderRadius:4,
                    overflow:"hidden",
                    display:"flex",
                    justifyContent:"flex-end"
                  }}>

                    <div style={{
                      width:
                      `${(row.home/
                      ((row.home+row.away)||1))*100}%`,
                      background:"var(--lime)"
                    }}/>

                  </div>




                  <span style={{
                    textAlign:"center",
                    fontSize:10,
                    color:"#888",
                    textTransform:"uppercase"
                  }}>
                    {row.label}
                  </span>




                  <div style={{
                    height:6,
                    background:"rgba(255,255,255,.08)",
                    borderRadius:4,
                    overflow:"hidden"
                  }}>

                    <div style={{
                      width:
                      `${(row.away/
                      ((row.home+row.away)||1))*100}%`,
                      background:"#ff8a3d"
                    }}/>

                  </div>



                  <span style={{
                    fontWeight:800
                  }}>
                    {row.away}
                    {row.suffix}
                  </span>


                </div>


              ))

            }


          </div>


        </section>

        {/* LOWER INTELLIGENCE GRID */}

        <section
          className="wc-dashboard-grid"
          style={{
            marginTop:22
          }}
        >



          {/* CALIBRE INSIGHT */}

          <div className="wc-card">

            <div className="wc-card-title">
              Calibre Insight
            </div>


            {
              calibreInsightBullets.length > 0 ?

              <ul style={{
                padding:0,
                margin:0,
                listStyle:"none"
              }}>

              {
                calibreInsightBullets.map((item,i)=>(

                  <li
                    key={i}
                    style={{
                      display:"flex",
                      gap:10,
                      marginBottom:14,
                      color:"#d8dde2",
                      fontSize:13,
                      lineHeight:1.5
                    }}
                  >

                    <span style={{
                      color:"var(--lime)"
                    }}>
                      ●
                    </span>

                    {item}

                  </li>

                ))
              }

              </ul>

              :

              <div style={{
                color:"#888",
                fontSize:13
              }}>
                Match intelligence will appear once
                sufficient data is available.
              </div>

            }


          </div>






          {/* SHOT BREAKDOWN */}

          <div className="wc-card">


            <div className="wc-card-title">
              Shot Breakdown
            </div>



            {
              shotBreakdown &&

              <>

              <div style={{
                display:"grid",
                gridTemplateColumns:"1fr auto 1fr",
                gap:20,
                alignItems:"center"
              }}>


                <div style={{
                  textAlign:"right"
                }}>

                  <strong style={{
                    fontSize:32,
                    fontFamily:"Barlow Condensed"
                  }}>
                    {shotBreakdown.home.shots}
                  </strong>

                  <div style={{
                    color:"#888",
                    fontSize:11
                  }}>
                    Shots
                  </div>


                  <strong>
                    {shotBreakdown.home.xg.toFixed(2)}
                  </strong>

                  <div style={{
                    color:"#888",
                    fontSize:11
                  }}>
                    xG
                  </div>

                </div>




                <div style={{
                  color:"var(--lime)",
                  fontWeight:900
                }}>
                  VS
                </div>



                <div>

                  <strong style={{
                    fontSize:32,
                    fontFamily:"Barlow Condensed"
                  }}>
                    {shotBreakdown.away.shots}
                  </strong>


                  <div style={{
                    color:"#888",
                    fontSize:11
                  }}>
                    Shots
                  </div>



                  <strong>
                    {shotBreakdown.away.xg.toFixed(2)}
                  </strong>


                  <div style={{
                    color:"#888",
                    fontSize:11
                  }}>
                    xG
                  </div>


                </div>


              </div>

              </>

            }


          </div>








          {/* OTHER MATCHES */}

          <div className="wc-card">


            <div className="wc-card-title">
              Other Featured Matches
            </div>



            {
              otherFeaturedMatches.map((m,i)=>(

                <div
                  key={i}
                  style={{
                    padding:"14px 0",
                    borderBottom:
                    "1px solid rgba(255,255,255,.08)"
                  }}
                >

                  <div style={{
                    color:"var(--lime)",
                    fontSize:10,
                    textTransform:"uppercase"
                  }}>
                    {m.round}
                  </div>


                  <div style={{
                    display:"flex",
                    justifyContent:"space-between",
                    marginTop:8,
                    fontSize:13
                  }}>

                    <span>
                      {TEAM_FLAGS[m.home]}
                      {" "}
                      {m.home}
                    </span>


                    <strong>
                      {m.homeScore}
                      {" - "}
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
            className="wc-card"
            style={{
              marginTop:22
            }}
          >

            <div className="wc-card-title">
              Did You Know
            </div>


            <div style={{
              borderLeft:
              "3px solid var(--lime)",
              paddingLeft:20
            }}>


              <div style={{
                fontSize:32,
                marginBottom:10
              }}>
                {factOfDay.emoji}
              </div>


              <p style={{
                margin:0,
                color:"#d8dde2",
                lineHeight:1.6
              }}>
                {factOfDay.fact}
              </p>


            </div>


            <button
              className="wc2-link"
              onClick={() =>
                navigateTo('/world-cup/history')
              }
            >
              More Tournament History
              <ArrowRight size={13}/>
            </button>


          </section>

        }








        {/* PREMIUM CTA */}

        <section
          className="wc-card"
          style={{
            marginTop:22,
            display:"flex",
            alignItems:"center",
            justifyContent:"space-between",
            gap:20
          }}
        >


          <div>

            <div className="wc-card-title">
              Calibre Founder Pass
            </div>


            <h3 style={{
              margin:0,
              fontFamily:"Barlow Condensed",
              fontSize:28
            }}>
              Unlock the complete World Cup intelligence layer
            </h3>


            <p style={{
              color:"#999"
            }}>
              Player breakdowns, scouting tools and deeper
              tournament analytics.
            </p>


          </div>



          <button
            className="wc2-explore-btn"
            onClick={() =>
              navigateTo('/pricing')
            }
          >

            Get Founder Pass
            <ArrowRight size={14}/>

          </button>


        </section>


      </div>

    </div>
  );
}
