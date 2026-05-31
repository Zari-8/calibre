import { useState } from 'react';
import { ArrowRight, Zap, Crown, Users, Target, Star, MessageSquare, GaugeCircle, TrendingUp, BarChart2, Trophy, Compass } from 'lucide-react';
import BattleHero from '../components/BattleHero.jsx';
import { navigateTo } from '../components/NavLink.jsx';

function Spark() {
  const pts = ['0,28','18,24','32,16','48,18','62,10','80,8','100,3'];
  return (
    <svg className="spark" viewBox="0 0 100 32" aria-hidden="true">
      <polyline points={pts.join(' ')} />
    </svg>
  );
}

function HexRadar() {
  const axes  = [[60,8],[105,34],[105,86],[60,112],[15,86],[15,34]];
  const score = [[60,22],[92,48],[84,79],[60,88],[28,78],[35,42]];
  const pts   = arr => arr.map(([x,y]) => `${x},${y}`).join(' ');
  return (
    <svg className="hex-radar" viewBox="0 0 120 120">
      <polygon className="radar-grid outer" points={pts(axes)} />
      <polygon className="radar-grid inner" points={pts([[60,28],[88,44],[88,76],[60,92],[32,76],[32,44]])} />
      {axes.map(([x,y],i) => <line key={i} className="radar-axis" x1="60" y1="60" x2={x} y2={y} />)}
      <polygon className="radar-fill"   points={pts(score)} />
      <polygon className="radar-stroke" points={pts(score)} />
      <circle  className="radar-core" cx="60" cy="60" r="3" />
    </svg>
  );
}

/* ── Data ── */
const TRENDING = [
  { rank:1, label:"Mbappé vs Haaland",    votes:"24.7K", l:'/assets/players/kylian-mbappe.jpg',   r:'/assets/players/lamine-yamal.jpg' },
  { rank:2, label:"Messi vs Ronaldo",     votes:"18.3K", l:'/assets/players/vinicius-junior.jpg',  r:'/assets/players/pedri.jpg' },
  { rank:3, label:"Bellingham vs Pedri",  votes:"15.1K", l:'/assets/players/jude-bellingham.jpg',  r:'/assets/players/pedri.jpg' },
  { rank:4, label:"Vinícius vs Saka",     votes:"12.6K", l:'/assets/players/vinicius-junior.jpg',  r:'/assets/players/lamine-yamal.jpg' },
  { rank:5, label:"Rodri vs Rice",        votes:"10.8K", l:'/assets/players/vitinha.jpg',           r:'/assets/players/florian-wirtz.jpg' },
];

const FEED = [
  { user:'@TacticalMind',    action:'rated',       battle:'Pedri vs Bellingham',  score:7,    ago:'Just now', img:'/assets/players/pedri.jpg' },
  { user:'@FootyGuru',       action:'joined',      battle:'Haaland vs Mbappé',    score:null, ago:'1m ago',   img:'/assets/players/kylian-mbappe.jpg' },
  { user:'@MidfieldMaestro', action:'nominated',   battle:'Musiala vs Wirtz',     score:null, ago:'3m ago',   img:'/assets/players/florian-wirtz.jpg' },
  { user:'@TheStatKing',     action:'commented on',battle:'Rice vs Rodri',        quote:"Rodri's positional control is unmatched.", score:null, ago:'5m ago', img:'/assets/players/vitinha.jpg' },
  { user:'@BarcaTalks',      action:'rated',       battle:'Bellingham vs Pedri',  score:8,    ago:'7m ago',   img:'/assets/players/jude-bellingham.jpg' },
];

const TOP_PLAYERS = [
  { rank:1, name:'K. Mbappé',    club:'Real Madrid', pos:'ST',  rating:91, img:'/assets/players/kylian-mbappe.jpg' },
  { rank:2, name:'J. Bellingham',club:'Real Madrid', pos:'CM',  rating:86, img:'/assets/players/jude-bellingham.jpg' },
  { rank:3, name:'Vinícius Jr.', club:'Real Madrid', pos:'LW',  rating:85, img:'/assets/players/vinicius-junior.jpg' },
  { rank:4, name:'Pedri',        club:'Barcelona',   pos:'CM',  rating:84, img:'/assets/players/pedri.jpg' },
  { rank:5, name:'Vitinha',      club:'PSG',         pos:'CM',  rating:83, img:'/assets/players/vitinha.jpg' },
];

const HOT_POTATO = [
  { q:"Is Mbappé already better than Ronaldo ever was at Real Madrid?", votes:'3.4k', badge:'🔥 HOT POTATO' },
  { q:"Should Bellingham be starting every game for England at the World Cup?", votes:'2.1k', badge:'🗳️ VOTE NOW' },
];

const BANGER_TWEETS = [
  { handle:'@GaryLineker', text:'"Pedri at 21 is already the best Spanish midfielder since Xavi. No debate."', likes:'18.4K' },
  { handle:'@OptaJoe',     text:'"Erling Haaland has scored in 14 consecutive home games. Frightening."', likes:'12.7K' },
];

const RISING_TALENTS = [
  { name:'Lamine Yamal', club:'Barcelona', pos:'RW', age:16, pot:94, img:'/assets/players/lamine-yamal.jpg' },
  { name:'Florian Wirtz',club:'Leverkusen',pos:'CAM',age:21, pot:92, img:'/assets/players/florian-wirtz.jpg' },
  { name:'Pedri',        club:'Barcelona', pos:'CM', age:22, pot:91, img:'/assets/players/pedri.jpg' },
];

const FIXTURES = [
  { date:'10 MAY', time:'Sat 17:30', home:'Man City',    away:'Arsenal',  league:'Premier League' },
  { date:'11 MAY', time:'Sun 20:45', home:'Juventus',    away:'Inter',    league:'Serie A' },
  { date:'14 MAY', time:'Wed 21:00', home:'Real Madrid', away:'Bayern',   league:'UCL Semi-final' },
];

const CAT_BREAKDOWN = [
  { label:'Control', pct:'28%', side:'left' },
  { label:'Impact',  pct:'26%', side:'right' },
  { label:'Creativity', pct:'24%', side:'left' },
  { label:'Debate',  pct:'22%', side:'right' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('All Categories');

  return (
    <div className="page" style={{ padding: '0 0 64px' }}>

      {/* ── RATE BATTLE HERO ── */}
      <BattleHero />

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 20px' }}>

        {/* ── FILTER BAR ── */}
        <div className="dbp-filters" style={{ marginTop: 12 }}>
          {['All Categories','Control','Impact','Creativity','Debate'].map(f => (
            <button key={f} type="button"
              className={`dbp-filter-btn${activeTab===f?' active':''}`}
              onClick={() => setActiveTab(f)}>
              {f==='Control'    && <Target size={12}/>}
              {f==='Impact'     && <Zap size={12}/>}
              {f==='Creativity' && <Star size={12}/>}
              {f==='Debate'     && <MessageSquare size={12}/>}
              {f}
            </button>
          ))}
          <select className="dbp-sort-select" style={{marginLeft:'auto'}}>
            <option>Sort by: Trending</option>
            <option>Most Votes</option>
            <option>Newest</option>
          </select>
        </div>

        {/* ── 2-COL LAYOUT ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:12, marginTop:12, alignItems:'start' }}>

          {/* ═══ LEFT COLUMN ═══ */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Active Rate Battles */}
            <div>
              <div className="section-heading">
                <Zap size={14} style={{color:'var(--lime)'}} className="section-heading-icon"/>
                <h3>Active Rate Battles</h3>
                <a href="/debates" className="section-heading-link" onClick={e=>{e.preventDefault();navigateTo('/debates');}}>View all →</a>
              </div>
              <div className="active-battles">
                {[
                  { l:{n:'Haaland',c:'Man City',img:'/assets/players/kylian-mbappe.jpg'},  r:{n:'Mbappé',c:'PSG',img:'/assets/players/jude-bellingham.jpg'},        cat:'Impact',     vl:'28.7K',vr:'24.1K',pct:54 },
                  { l:{n:'Rice',c:'Arsenal',img:'/assets/players/florian-wirtz.jpg'},        r:{n:'Rodri',c:'Man City',img:'/assets/players/vitinha.jpg'},             cat:'Control',    vl:'19.3K',vr:'17.2K',pct:53 },
                  { l:{n:'Vinicius Jr.',c:'Real Madrid',img:'/assets/players/vinicius-junior.jpg'}, r:{n:'Saka',c:'Arsenal',img:'/assets/players/lamine-yamal.jpg'}, cat:'Creativity',  vl:'15.6K',vr:'14.8K',pct:51 },
                ].map((b,i) => (
                  <div key={i} className="battle-card" onClick={()=>navigateTo('/debates')}>
                    <div className="battle-card-live">LIVE</div>
                    <div className="battle-card-cat">
                      {b.cat==='Impact'&&<Zap size={9}/>}
                      {b.cat==='Control'&&<Target size={9}/>}
                      {b.cat==='Creativity'&&<Star size={9}/>}
                      {b.cat}
                    </div>
                    <div className="battle-card-imgs">
                      <img src={b.l.img} alt={b.l.n}/>
                      <img src={b.r.img} alt={b.r.n}/>
                      <div className="battle-vs-badge">VS</div>
                    </div>
                    <div className="battle-card-names">
                      <div><span>{b.l.n}</span><span className="card-club">{b.l.c}</span></div>
                      <div style={{textAlign:'right'}}><span>{b.r.n}</span><span className="card-club">{b.r.c}</span></div>
                    </div>
                    <div className="battle-card-bar"><div className="battle-card-bar-fill" style={{width:b.pct+'%'}}/></div>
                    <div className="battle-card-votes"><span>{b.vl}</span><span>{b.vr}</span></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hot Potato + Banger Tweet — unique home-only formats */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>

              {/* Hot Potato of the Week */}
              <div className="panel">
                <div className="panel-head">
                  <div className="panel-title">🔥 Hot Potato of the Week</div>
                  <a className="panel-action" onClick={()=>navigateTo('/debates')}>View all</a>
                </div>
                {HOT_POTATO.map((h,i)=>(
                  <div key={i} className="row-item" style={{cursor:'pointer',flexDirection:'column',alignItems:'flex-start',gap:6}} onClick={()=>navigateTo('/debates')}>
                    <span style={{font:'700 9px/1 "Rajdhani"',letterSpacing:'.12em',textTransform:'uppercase',color:'var(--lime)'}}>{h.badge}</span>
                    <div style={{font:'600 13px/1.4 "Rajdhani"',color:'var(--text)'}}>{h.q}</div>
                    <div style={{font:'500 10px/1 "Inter"',color:'var(--text2)'}}>{h.votes} votes cast</div>
                  </div>
                ))}
                <button className="btn btn--outline btn--sm" style={{width:'100%',marginTop:8}} type="button" onClick={()=>navigateTo('/debates')}>
                  CAST YOUR VOTE <ArrowRight size={13}/>
                </button>
              </div>

              {/* Banger Tweet of the Day */}
              <div className="panel">
                <div className="panel-head">
                  <div className="panel-title">💬 Banger Tweet of the Day</div>
                  <a className="panel-action" onClick={()=>navigateTo('/debates')}>View all</a>
                </div>
                {BANGER_TWEETS.map((t,i)=>(
                  <div key={i} style={{padding:'10px 0',borderBottom:'1px solid var(--thin)'}}>
                    <div style={{font:'700 11px/1 "Rajdhani"',color:'var(--lime)',marginBottom:5}}>{t.handle}</div>
                    <div style={{font:'400 12px/1.5 "Inter"',color:'var(--text)',fontStyle:'italic'}}>{t.text}</div>
                    <div style={{font:'700 10px/1 "Rajdhani"',color:'var(--text3)',marginTop:5}}>♥ {t.likes}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Two-col: Upcoming + Nominations */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>

              {/* Upcoming Battles */}
              <div className="upcoming-battles">
                <div className="upcoming-battles-head">
                  <div className="section-heading" style={{marginBottom:0}}>
                    <GaugeCircle size={13} style={{color:'var(--lime)'}}/>
                    <h3 style={{fontSize:12}}>Upcoming Battles</h3>
                    <a href="/debates" onClick={e=>{e.preventDefault();navigateTo('/debates');}} className="section-heading-link">View all</a>
                  </div>
                </div>
                {[
                  {l:{n:'Mo Salah',c:'Liverpool',img:'/assets/players/kylian-mbappe.jpg'},r:{n:'Son Heung-min',c:'Spurs',img:'/assets/players/lamine-yamal.jpg'},cd:'01 : 45 : 32'},
                  {l:{n:'B. Fernández',c:'Man Utd',img:'/assets/players/pedri.jpg'},r:{n:'Ødegaard',c:'Arsenal',img:'/assets/players/vitinha.jpg'},cd:'03 : 22 : 10'},
                  {l:{n:'Lewandowski',c:'Barcelona',img:'/assets/players/vinicius-junior.jpg'},r:{n:'V. Osimhen',c:'Napoli',img:'/assets/players/florian-wirtz.jpg'},cd:'06 : 11 : 28'},
                ].map((u,i)=>(
                  <div key={i} className="upcoming-row">
                    <div className="upcoming-fighter">
                      <img src={u.l.img} alt={u.l.n}/>
                      <div><div className="upcoming-fighter-name">{u.l.n}</div><div className="upcoming-fighter-club">{u.l.c}</div></div>
                    </div>
                    <div className="upcoming-vs">VS</div>
                    <div className="upcoming-fighter" style={{justifyContent:'flex-end'}}>
                      <div style={{textAlign:'right'}}><div className="upcoming-fighter-name">{u.r.n}</div><div className="upcoming-fighter-club">{u.r.c}</div></div>
                      <img src={u.r.img} alt={u.r.n}/>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div className="upcoming-cd">{u.cd}</div>
                      <div className="upcoming-cd-label">Starts in</div>
                    </div>
                  </div>
                ))}
                <button type="button" className="view-schedule-btn" onClick={()=>navigateTo('/debates')}>VIEW FULL SCHEDULE <ArrowRight size={13}/></button>
              </div>

              {/* Fan Nominations */}
              <div className="nominations">
                <div style={{padding:'12px 14px',borderBottom:'1px solid var(--thin)'}}>
                  <div className="section-heading" style={{marginBottom:0}}>
                    <Users size={13} style={{color:'var(--lime)'}}/>
                    <h3 style={{fontSize:12}}>Fan Nominations</h3>
                    <a href="/debates" onClick={e=>{e.preventDefault();navigateTo('/debates');}} className="section-heading-link">View all</a>
                  </div>
                </div>
                {[
                  {title:'Jamal Musiala vs Florian Wirtz',by:'@MidfieldMaestro',votes:2341},
                  {title:'Gavi vs Camavinga',by:'@BarcaTalks',votes:1876},
                  {title:'Lautaro Martínez vs D. Nuñez',by:'@InterZone',votes:1542},
                ].map((n,i)=>(
                  <div key={i} className="nomination-row">
                    <div className="nomination-rank">{i+1}</div>
                    <div style={{flex:1}}>
                      <div className="nomination-title">{n.title}</div>
                      <div className="nomination-by">{n.by}</div>
                    </div>
                    <div className="nomination-votes">{n.votes.toLocaleString()} 👍</div>
                  </div>
                ))}
                <button type="button" className="nominate-btn" onClick={()=>navigateTo('/debates')}>NOMINATE A DEBATE +</button>
              </div>
            </div>

            {/* ── PLAYER RANKINGS SNAPSHOT ── */}
            <div>
              <div className="section-heading">
                <Star size={14} style={{color:'var(--lime)'}} className="section-heading-icon"/>
                <h3>Top Rated Players</h3>
                <a href="/players" className="section-heading-link" onClick={e=>{e.preventDefault();navigateTo('/players');}}>View all →</a>
              </div>
              <div className="panel" style={{padding:0,overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{borderBottom:'1px solid var(--thin)'}}>
                      {['#','Player','Club','Pos','Rating'].map(h=>(
                        <th key={h} style={{padding:'8px 12px',font:'700 9px/1 "Rajdhani"',letterSpacing:'.14em',textTransform:'uppercase',color:'var(--text3)',textAlign:'left'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TOP_PLAYERS.map(p=>(
                      <tr key={p.rank} style={{borderBottom:'1px solid var(--thin)',cursor:'pointer'}} onClick={()=>navigateTo('/players')}>
                        <td style={{padding:'9px 12px',font:'900 14px/1 "Rajdhani"',color:'var(--text3)'}}>{p.rank}</td>
                        <td style={{padding:'9px 12px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <img src={p.img} alt={p.name} style={{width:28,height:32,objectFit:'cover',objectPosition:'top',borderRadius:3,border:'1px solid var(--thin)'}}/>
                            <span style={{font:'700 13px/1 "Rajdhani"',color:'var(--text)'}}>{p.name}</span>
                          </div>
                        </td>
                        <td style={{padding:'9px 12px',font:'500 11px/1 "Inter"',color:'var(--text2)'}}>{p.club}</td>
                        <td style={{padding:'9px 12px'}}>
                          <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'2px 6px',border:'1px solid var(--thin)',borderRadius:3,font:'700 9px/1 "Inter"',letterSpacing:'.1em',textTransform:'uppercase',color:'var(--text2)'}}>{p.pos}</span>
                        </td>
                        <td style={{padding:'9px 12px'}}>
                          <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:32,padding:'3px 6px',border:'1px solid rgba(166,255,0,.4)',borderRadius:4,font:'900 14px/1 "Rajdhani"',color:'var(--lime)'}}>{p.rating}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="btn btn--ghost btn--sm" style={{width:'100%',justifyContent:'center',borderRadius:0,borderTop:'1px solid var(--thin)',padding:12}} type="button" onClick={()=>navigateTo('/players')}>
                  VIEW FULL DATABASE <ArrowRight size={13}/>
                </button>
              </div>
            </div>

            {/* ── TALENT SPOTLIGHT + FIXTURES ── */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>

              {/* Rising Talents Spotlight */}
              <div className="panel">
                <div className="panel-head">
                  <div className="panel-title"><Compass size={12} style={{marginRight:5,verticalAlign:'middle',color:'var(--lime)'}}/>Rising Talents</div>
                  <a className="panel-action" onClick={()=>navigateTo('/talents')}>View all</a>
                </div>
                {RISING_TALENTS.map(t=>(
                  <div key={t.name} className="row-item" style={{cursor:'pointer'}} onClick={()=>navigateTo('/talents')}>
                    <img src={t.img} alt={t.name} style={{width:32,height:38,objectFit:'cover',objectPosition:'top',borderRadius:3,border:'1px solid var(--thin)',flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{font:'700 13px/1 "Rajdhani"',color:'var(--text)'}}>{t.name}</div>
                      <div style={{font:'600 9px/1 "Inter"',letterSpacing:'.1em',textTransform:'uppercase',color:'var(--text2)',marginTop:3}}>{t.pos} · {t.club} · {t.age} yrs</div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{font:'700 9px/1 "Inter"',letterSpacing:'.12em',textTransform:'uppercase',color:'var(--text3)'}}>POT</div>
                      <div style={{font:'900 18px/1 "Rajdhani"',color:'var(--lime)'}}>{t.pot}</div>
                    </div>
                  </div>
                ))}
                <button className="btn btn--outline btn--sm" style={{width:'100%',marginTop:8}} type="button" onClick={()=>navigateTo('/talents')}>SCOUT TALENTS <ArrowRight size={13}/></button>
              </div>

              {/* Upcoming Key Fixtures */}
              <div className="panel">
                <div className="panel-head">
                  <div className="panel-title"><Trophy size={12} style={{marginRight:5,verticalAlign:'middle',color:'var(--lime)'}}/>Upcoming Fixtures</div>
                  <a className="panel-action" onClick={()=>navigateTo('/competitions')}>View all</a>
                </div>
                {FIXTURES.map((f,i)=>(
                  <div key={i} className="row-item">
                    <div style={{minWidth:44,flexShrink:0}}>
                      <div style={{font:'700 11px/1 "Rajdhani"',color:'var(--lime)'}}>{f.date}</div>
                      <div style={{font:'500 10px/1 "Inter"',color:'var(--text2)',marginTop:2}}>{f.time}</div>
                    </div>
                    <div style={{flex:1,font:'700 13px/1 "Rajdhani"',color:'var(--text)'}}>{f.home} <span style={{color:'var(--text3)'}}>vs</span> {f.away}</div>
                    <div style={{font:'600 9px/1 "Inter"',letterSpacing:'.08em',textTransform:'uppercase',color:'var(--text2)',textAlign:'right',flexShrink:0,fontSize:9}}>{f.league}</div>
                  </div>
                ))}
                <button className="btn btn--outline btn--sm" style={{width:'100%',marginTop:8}} type="button" onClick={()=>navigateTo('/competitions')}>VIEW COMPETITIONS <ArrowRight size={13}/></button>
              </div>
            </div>

          </div>{/* end left col */}

          {/* ═══ RIGHT SIDEBAR ═══ */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Trending This Week */}
            <div className="card">
              <div className="card-head">
                <span className="card-title"><TrendingUp size={13} className="card-title-icon"/> TRENDING THIS WEEK</span>
                <a href="/debates" onClick={e=>{e.preventDefault();navigateTo('/debates');}} className="card-link">View all</a>
              </div>
              {TRENDING.map(t=>(
                <div key={t.rank} className="trending-row">
                  <span className="trending-rank">{t.rank}</span>
                  <div className="trending-avatars">
                    <img src={t.l} alt=""/>
                    <img src={t.r} alt=""/>
                  </div>
                  <span className="trending-label">{t.label}</span>
                  <span className="trending-votes">{t.votes}</span>
                  <Spark/>
                </div>
              ))}
            </div>

            {/* Category Breakdown */}
            <div className="card">
              <div className="card-head">
                <span className="card-title"><BarChart2 size={13} className="card-title-icon"/> CATEGORY BREAKDOWN</span>
              </div>
              <div className="cat-breakdown">
                <div>
                  {CAT_BREAKDOWN.filter(c=>c.side==='left').map(c=>(
                    <div key={c.label} className="cat-metric" style={{marginBottom:12}}>
                      <div className="cat-metric-label">{c.label}</div>
                      <div className="cat-metric-pct">{c.pct}</div>
                    </div>
                  ))}
                </div>
                <HexRadar/>
                <div>
                  {CAT_BREAKDOWN.filter(c=>c.side==='right').map(c=>(
                    <div key={c.label} className="cat-metric cat-metric--right" style={{marginBottom:12}}>
                      <div className="cat-metric-label">{c.label}</div>
                      <div className="cat-metric-pct">{c.pct}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Debate Feed */}
            <div className="card">
              <div className="card-head">
                <span className="card-title"><Zap size={13} className="card-title-icon"/> LIVE DEBATE FEED</span>
                <select style={{background:'none',color:'var(--text2)',fontSize:10,fontFamily:'Inter',fontWeight:700,letterSpacing:'.1em'}}>
                  <option>All Activity</option>
                </select>
              </div>
              {FEED.map((f,i)=>(
                <div key={i} className="feed-item">
                  <img className="feed-avatar" src={f.img} alt={f.user}/>
                  <div className="feed-body">
                    <div><span className="feed-user">{f.user}</span>{' '}<span className="feed-action">{f.action}</span></div>
                    <div className="feed-battle">
                      {f.battle}
                      {f.score && <span className="feed-score">{f.score}</span>}
                    </div>
                    {f.quote && <div className="feed-quote">"{f.quote}"</div>}
                  </div>
                  <span className="feed-ago">{f.ago}</span>
                </div>
              ))}
              <button type="button" className="join-conv-btn" style={{borderRadius:0,border:'none',borderTop:'1px solid var(--thin)'}} onClick={()=>navigateTo('/debates')}>
                JOIN THE CONVERSATION →
              </button>
            </div>

            {/* Explore Calibre — nav teaser */}
            <div className="card">
              <div className="card-head">
                <span className="card-title"><Compass size={13} className="card-title-icon"/> EXPLORE CALIBRE</span>
              </div>
              {[
                {label:'Players Database',sub:'128K players tracked',icon:'👤',path:'/players'},
                {label:'Competitions',sub:'63 leagues covered',icon:'🏆',path:'/competitions'},
                {label:'Talent Discovery',sub:'Scouting engine',icon:'⚡',path:'/talents'},
                {label:'System Fit',sub:'Tactical analysis',icon:'🎯',path:'/system-fit'},
              ].map(item=>(
                <div key={item.path} className="row-item" style={{cursor:'pointer'}} onClick={()=>navigateTo(item.path)}>
                  <span style={{fontSize:18,flexShrink:0}}>{item.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{font:'700 13px/1 "Rajdhani"',color:'var(--text)'}}>{item.label}</div>
                    <div style={{font:'500 10px/1 "Inter"',color:'var(--text2)',marginTop:3}}>{item.sub}</div>
                  </div>
                  <ArrowRight size={14} style={{color:'var(--text3)',flexShrink:0}}/>
                </div>
              ))}
            </div>

          </div>{/* end right sidebar */}
        </div>
      </div>

      {/* ── PROMO STRIP ── */}
      <div className="promo-strip" style={{maxWidth:'100%'}}>
        <Crown size={24} className="promo-strip-icon"/>
        <div className="promo-strip-text">
          <strong>GET WORLD CUP FOUNDER PASS</strong>
          <span>Unlock premium debates, advanced filters &amp; exclusive World Cup content.</span>
        </div>
        <button type="button" className="promo-cta" onClick={()=>navigateTo('/pricing')}>EXPLORE PLANS <ArrowRight size={14}/></button>
      </div>

    </div>
  );
}
