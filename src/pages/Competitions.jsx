import { useState } from 'react';
import { ArrowRight, Crown, Star } from 'lucide-react';
import { navigateTo } from '../components/NavLink.jsx';

const MY_COMPS = ['Premier League','La Liga','UEFA Champions League','Serie A','Bundesliga'];
const LEAGUES  = [
  { name:'Premier League',   country:'England',  logo:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', matchday:36, live:true  },
  { name:'La Liga',          country:'Spain',    logo:'🇪🇸', matchday:35, live:true  },
  { name:'Bundesliga',       country:'Germany',  logo:'🇩🇪', matchday:32, live:true  },
  { name:'Serie A',          country:'Italy',    logo:'🇮🇹', matchday:35, live:true  },
  { name:'Ligue 1',          country:'France',   logo:'🇫🇷', matchday:33, live:true  },
  { name:'Champions League', country:'Europe',   logo:'🇪🇺', matchday:'Semi-finals', live:true },
];
const STANDINGS = [
  { pos:1, team:'Liverpool',  P:35, W:25, D:7, L:3, GD:'+45', pts:82 },
  { pos:2, team:'Arsenal',    P:35, W:19, D:10,L:6, GD:'+28', pts:67 },
  { pos:3, team:'Man City',   P:35, W:19, D:6, L:10,GD:'+24', pts:63 },
  { pos:4, team:'Newcastle',  P:35, W:19, D:6, L:10,GD:'+20', pts:63 },
  { pos:5, team:'Chelsea',    P:35, W:18, D:9, L:8, GD:'+19', pts:63 },
];
const FORM = [
  { team:'Liverpool',  form:['W','W','D','W','W'], pts:16 },
  { team:'Arsenal',    form:['W','W','D','W','D'], pts:14 },
  { team:'Man City',   form:['W','L','W','W','W'], pts:12 },
  { team:'Newcastle',  form:['W','D','D','L','W'], pts:11 },
  { team:'Chelsea',    form:['D','W','L','W','D'], pts:10 },
];
const SCORERS = [
  { pos:1, name:'E. Haaland', team:'Man City',  goals:25, img:'/assets/players/kylian-mbappe.jpg' },
  { pos:2, name:'M. Salah',   team:'Liverpool', goals:21, img:'/assets/players/lamine-yamal.jpg' },
  { pos:3, name:'A. Isak',    team:'Newcastle', goals:18, img:'/assets/players/pedri.jpg' },
  { pos:4, name:'C. Palmer',  team:'Chelsea',   goals:15, img:'/assets/players/vitinha.jpg' },
  { pos:5, name:'O. Watkins', team:'Aston Villa',goals:14,img:'/assets/players/florian-wirtz.jpg' },
];
const CREATORS = [
  { pos:1, name:'B. Saka',       team:'Arsenal',   assists:13, img:'/assets/players/lamine-yamal.jpg' },
  { pos:2, name:'K. De Bruyne',  team:'Man City',  assists:11, img:'/assets/players/pedri.jpg' },
  { pos:3, name:'P. Foden',      team:'Man City',  assists:9,  img:'/assets/players/florian-wirtz.jpg' },
  { pos:4, name:'M. Ødegaard',   team:'Arsenal',   assists:9,  img:'/assets/players/vitinha.jpg' },
  { pos:5, name:'D. Szoboszlai', team:'Liverpool', assists:8,  img:'/assets/players/kylian-mbappe.jpg' },
];
const DB_PLAYERS = [
  { img:'/assets/players/lamine-yamal.jpg' },
  { img:'/assets/players/pedri.jpg' },
  { img:'/assets/players/florian-wirtz.jpg' },
];
const DEBATES = [
  { q:'Is Arsenal now genuine title contenders?', votes:'1.2k votes', comments:342, badge:'HOT' },
  { q:'Can anyone stop Haaland winning the Golden Boot?', votes:'980 votes', comments:210, badge:'LIVE' },
  { q:"Newcastle's top 4 push — sustainable or overperforming?", votes:'760 votes', comments:188, badge:'NEW' },
];
const FIXTURES = [
  { date:'10 MAY', day:'Sat 17:30', homeClub:'Man City',   awayClub:'Arsenal',  league:'Premier League' },
  { date:'11 MAY', day:'Sun 20:45', homeClub:'Juventus',   awayClub:'Inter',    league:'Serie A' },
  { date:'13 MAY', day:'Tue 21:00', homeClub:'Dortmund',   awayClub:'Bayern',   league:'Bundesliga' },
  { date:'14 MAY', day:'Wed 21:00', homeClub:'Real Madrid',awayClub:'Bayern',   league:'UCL Semi-final' },
];

function FormBadge({ r }) {
  return <span className={`form-badge form-badge--${r}`}>{r}</span>;
}

export default function Competitions() {
  const [activeLeague, setActiveLeague] = useState('Premier League');
  const [tab, setTab] = useState('Top Leagues');

  return (
    <div className="page" style={{paddingTop:16}}>
      <div className="comp-page">
        {/* Sidebar */}
        <div className="comp-sidebar">
          <div className="comp-sidebar-title">Competitions</div>
          <div className="comp-sidebar-label">Browse</div>
          {['Overview','Leagues','Tournaments','Domestic Cups',"Women's Football"].map(l=>(
            <div key={l} className={`comp-sidebar-link ${l==='Overview'?'active':''}`}>{l}</div>
          ))}
          <div className="comp-my-section">
            <div className="comp-sidebar-label" style={{marginBottom:8}}>My Competitions <span style={{float:'right',color:'var(--lime)',fontSize:11,cursor:'pointer'}}>Manage</span></div>
            {MY_COMPS.map(c=>(
              <div key={c} className="comp-my-row">
                <span style={{fontSize:18}}>🏆</span>
                <span style={{flex:1,font:'600 12px/1 "Barlow Condensed"'}}>{c}</span>
                <span className="comp-star">★</span>
              </div>
            ))}
          </div>
          <div className="comp-login-box">
            <p>Follow your favourite competitions. Sign in to personalise your feed and unlock advanced insights.</p>
            <button className="btn btn--lime btn--sm" style={{width:'100%'}} type="button">LOG IN</button>
          </div>
        </div>

        {/* Main */}
        <div>
          {/* Featured hero */}
          <div className="comp-hero">
            <div className="comp-hero-bg">⚽</div>
            <div className="comp-hero-left">
              <div className="comp-hero-eyebrow">Featured Competition</div>
              <div className="comp-hero-title">UEFA Champions League</div>
              <div className="comp-hero-season">2024/25 · Knockout Stage</div>
              <div className="comp-hero-desc">Europe's elite. One trophy. Endless glory.<br/>Follow every match, metric and momentum shift.</div>
              <button className="btn btn--lime btn--sm" type="button">VIEW COMPETITION HUB <ArrowRight size={13}/></button>
            </div>
            <div className="comp-hero-right">
              <div className="comp-hero-next-label">Next Match</div>
              <div className="comp-hero-matchup">
                <div className="comp-hero-team"><span style={{fontSize:28}}>⚽</span>Real Madrid</div>
                <div className="comp-hero-vs">VS</div>
                <div className="comp-hero-team"><span style={{fontSize:28}}>⚽</span>Bayern München</div>
              </div>
              <div className="comp-hero-kickoff">Tomorrow, 21:00</div>
            </div>
          </div>

          {/* Type tabs */}
          <div className="comp-type-tabs">
            {['Top Leagues','Top Tournaments','Domestic Cups',"Women's Football"].map(t=>(
              <div key={t} className={`comp-type-tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t}</div>
            ))}
          </div>

          {/* Leagues grid */}
          <div className="comp-leagues-grid">
            {LEAGUES.map(l=>(
              <div key={l.name} className={`comp-league-card ${activeLeague===l.name?'active':''}`} onClick={()=>setActiveLeague(l.name)}>
                <div style={{fontSize:32,marginBottom:8}}>{l.logo}</div>
                <div className="comp-league-name">{l.name}</div>
                <div className="comp-league-country">{l.country}</div>
                <div className="comp-league-status">
                  <span className="live-dot">LIVE</span>
                  <span style={{fontSize:10,color:'var(--text2)'}}>Matchday {l.matchday}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Data grid */}
          <div className="comp-data-grid">
            {/* Standings */}
            <div className="comp-data-panel">
              <div className="comp-data-panel-title">Standings Snapshot <span className="comp-data-panel-sub">· {activeLeague}</span></div>
              <div className="comp-standings-row header">
                <span>#</span><span></span><span>Team</span><span>P</span><span>W</span><span>D</span><span>L</span><span>GD</span><span>PTS</span>
              </div>
              {STANDINGS.map(s=>(
                <div key={s.pos} className="comp-standings-row">
                  <span className="comp-standings-pos">{s.pos}</span>
                  <span style={{fontSize:14}}>🏟️</span>
                  <span className="comp-standings-name">{s.team}</span>
                  <span style={{color:'var(--text2)'}}>{s.P}</span>
                  <span style={{color:'var(--text2)'}}>{s.W}</span>
                  <span style={{color:'var(--text2)'}}>{s.D}</span>
                  <span style={{color:'var(--text2)'}}>{s.L}</span>
                  <span style={{color:'var(--text2)',fontSize:11}}>{s.GD}</span>
                  <span className="comp-standings-pts">{s.pts}</span>
                </div>
              ))}
              <button className="btn btn--ghost btn--sm" style={{width:'100%',marginTop:8,justifyContent:'center'}} type="button">VIEW FULL TABLE <ArrowRight size={13}/></button>
            </div>

            {/* Form guide */}
            <div className="comp-data-panel">
              <div className="comp-data-panel-title">Form Guide (Last 5) <span className="comp-data-panel-sub">· PTS</span></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:4,marginBottom:8,paddingBottom:6,borderBottom:'1px solid var(--border)'}}>
                <span style={{font:'700 9px/1 "Barlow Condensed"',color:'var(--text3)',letterSpacing:'.1em',textTransform:'uppercase'}}>TEAM</span>
                <span style={{font:'700 9px/1 "Barlow Condensed"',color:'var(--text3)',letterSpacing:'.1em',textTransform:'uppercase',minWidth:100}}>LAST 5</span>
                <span style={{font:'700 9px/1 "Barlow Condensed"',color:'var(--text3)',letterSpacing:'.1em',textTransform:'uppercase'}}>PTS</span>
              </div>
              {FORM.map(f=>(
                <div key={f.team} style={{display:'grid',gridTemplateColumns:'1fr auto auto',alignItems:'center',gap:4,padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{font:'700 13px/1 "Barlow Condensed"',display:'flex',alignItems:'center',gap:5}}><span style={{fontSize:16}}>🏟️</span>{f.team}</span>
                  <div style={{display:'flex',gap:2}}>{f.form.map((r,i)=><FormBadge key={i} r={r}/>)}</div>
                  <span className="comp-form-pts">{f.pts}</span>
                </div>
              ))}
              <button className="btn btn--ghost btn--sm" style={{width:'100%',marginTop:8,justifyContent:'center'}} type="button">VIEW FORM GUIDE <ArrowRight size={13}/></button>
            </div>

            {/* Top scorers */}
            <div className="comp-data-panel">
              <div className="comp-data-panel-title">Top Scorers <span className="comp-data-panel-sub">· {activeLeague}</span></div>
              <div style={{display:'grid',gridTemplateColumns:'16px 22px 1fr auto auto',gap:6,marginBottom:6,paddingBottom:4,borderBottom:'1px solid var(--border)'}}>
                <span style={{font:'700 9px/1 "Barlow Condensed"',color:'var(--text3)',fontSize:9}}>#</span>
                <span></span><span style={{font:'700 9px/1 "Barlow Condensed"',color:'var(--text3)'}}>PLAYER</span>
                <span style={{font:'700 9px/1 "Barlow Condensed"',color:'var(--text3)'}}>TEAM</span>
                <span style={{font:'700 9px/1 "Barlow Condensed"',color:'var(--text3)'}}>G</span>
              </div>
              {SCORERS.map(s=>(
                <div key={s.pos} className="comp-scorer-row">
                  <span style={{font:'700 12px/1 "Barlow Condensed"',color:'var(--text3)'}}>{s.pos}</span>
                  <img src={s.img} alt="" style={{width:22,height:26,objectFit:'cover',objectPosition:'top',borderRadius:3}}/>
                  <span style={{font:'700 13px/1 "Barlow Condensed"'}}>{s.name}</span>
                  <span style={{font:'500 11px/1 "Barlow"',color:'var(--text2)'}}>{s.team}</span>
                  <span className="comp-scorer-goals">{s.goals}</span>
                </div>
              ))}
              <button className="btn btn--ghost btn--sm" style={{width:'100%',marginTop:8,justifyContent:'center'}} type="button">VIEW ALL STATS <ArrowRight size={13}/></button>
            </div>

            {/* Top creators */}
            <div className="comp-data-panel">
              <div className="comp-data-panel-title">Top Creators <span className="comp-data-panel-sub">· {activeLeague}</span></div>
              <div style={{display:'grid',gridTemplateColumns:'16px 22px 1fr auto auto',gap:6,marginBottom:6,paddingBottom:4,borderBottom:'1px solid var(--border)'}}>
                <span style={{font:'700 9px/1 "Barlow Condensed"',color:'var(--text3)',fontSize:9}}>#</span>
                <span></span><span style={{font:'700 9px/1 "Barlow Condensed"',color:'var(--text3)'}}>PLAYER</span>
                <span style={{font:'700 9px/1 "Barlow Condensed"',color:'var(--text3)'}}>TEAM</span>
                <span style={{font:'700 9px/1 "Barlow Condensed"',color:'var(--text3)'}}>A</span>
              </div>
              {CREATORS.map(c=>(
                <div key={c.pos} className="comp-scorer-row">
                  <span style={{font:'700 12px/1 "Barlow Condensed"',color:'var(--text3)'}}>{c.pos}</span>
                  <img src={c.img} alt="" style={{width:22,height:26,objectFit:'cover',objectPosition:'top',borderRadius:3}}/>
                  <span style={{font:'700 13px/1 "Barlow Condensed"'}}>{c.name}</span>
                  <span style={{font:'500 11px/1 "Barlow"',color:'var(--text2)'}}>{c.team}</span>
                  <span className="comp-scorer-goals">{c.assists}</span>
                </div>
              ))}
              <button className="btn btn--ghost btn--sm" style={{width:'100%',marginTop:8,justifyContent:'center'}} type="button">VIEW ALL STATS <ArrowRight size={13}/></button>
            </div>
          </div>

          {/* Lower row */}
          <div className="comp-lower">
            {/* Map */}
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Global Coverage</div><span style={{font:'700 11px/1 "Barlow Condensed"',color:'var(--lime)'}}>Live competition coverage</span></div>
              <div style={{width:'100%',height:120,background:'radial-gradient(ellipse at 50% 50%, rgba(166,255,0,.06), transparent 70%), #050607',borderRadius:6,display:'flex',alignItems:'flex-end',padding:12}}>
                <span style={{font:'900 36px/1 "Barlow Condensed"',color:'var(--lime)'}}>200+</span>
                <span style={{font:'600 12px/1 "Barlow"',color:'var(--text2)',marginLeft:6,marginBottom:4}}>Countries</span>
              </div>
            </div>

            {/* Hot debates */}
            <div className="panel">
              <div className="panel-head">
                <div className="panel-title">Hot Debates by Competition</div>
                <select style={{background:'var(--panel2)',border:'1px solid var(--border)',borderRadius:4,padding:'4px 8px',fontSize:11,color:'var(--text2)'}}>
                  <option>Premier League</option>
                </select>
              </div>
              {DEBATES.map((d,i)=>(
                <div key={i} className="row-item" style={{cursor:'pointer'}} onClick={()=>navigateTo('/debates')}>
                  <img src={DB_PLAYERS[i].img} alt="" style={{width:28,height:28,borderRadius:'50%',objectFit:'cover'}}/>
                  <div style={{flex:1}}>
                    <div style={{font:'600 13px/1.3 "Barlow Condensed"'}}>{d.q}</div>
                    <div style={{font:'500 10px/1 "Barlow"',color:'var(--text2)',marginTop:3}}>{d.votes} · {d.comments} comments</div>
                  </div>
                  <span className={`debate-badge ${d.badge==='HOT'?'badge-hot':d.badge==='LIVE'?'badge-live':'badge-new'}`}>{d.badge}</span>
                </div>
              ))}
            </div>

            {/* Upcoming fixtures */}
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Upcoming Key Fixtures</div><a className="panel-action">View calendar</a></div>
              {FIXTURES.map((f,i)=>(
                <div key={i} className="row-item">
                  <div style={{minWidth:44}}>
                    <div style={{font:'700 11px/1 "Barlow Condensed"',color:'var(--lime)'}}>{f.date}</div>
                    <div style={{font:'500 10px/1 "Barlow"',color:'var(--text2)',marginTop:2}}>{f.day}</div>
                  </div>
                  <div style={{flex:1,font:'700 13px/1 "Barlow Condensed"'}}>{f.homeClub} <span style={{color:'var(--text3)'}}>vs</span> {f.awayClub}</div>
                  <div style={{font:'500 10px/1 "Barlow"',color:'var(--text2)',textAlign:'right',fontSize:10}}>{f.league}</div>
                </div>
              ))}
              <button className="btn btn--ghost btn--sm" style={{width:'100%',marginTop:8,justifyContent:'center'}} type="button">VIEW ALL FIXTURES <ArrowRight size={13}/></button>
            </div>
          </div>
        </div>
      </div>

      <div className="founder-strip">
        <Crown size={22} className="founder-strip-icon"/>
        <strong>Get World Cup Founder Pass</strong>
        <span>Unlock premium insights, advanced filters &amp; exclusive World Cup content.</span>
        <button type="button" className="btn btn--lime" onClick={()=>navigateTo('/pricing')}>EXPLORE PLANS <ArrowRight size={14}/></button>
      </div>
    </div>
  );
}
