import { useState } from 'react';
import { Search, ArrowRight, Crown, Star, TrendingUp } from 'lucide-react';
import { players } from '../data/calibreData.js';
import { navigateTo } from '../components/NavLink.jsx';

const DB_PLAYERS = [
  { rank:1, name:"Kylian Mbappé",   age:25, club:'Real Madrid', clubIcon:'⚽', pos:'ST',  rating:91, buzz:96, fanRating:4.8, img:'/assets/players/kylian-mbappe.jpg' },
  { rank:2, name:"Erling Haaland",  age:24, club:'Man City',    clubIcon:'⚽', pos:'ST',  rating:90, buzz:95, fanRating:4.7, img:'/assets/players/lamine-yamal.jpg' },
  { rank:3, name:"Jude Bellingham", age:21, club:'Real Madrid', clubIcon:'⚽', pos:'CM',  rating:86, buzz:92, fanRating:4.7, img:'/assets/players/jude-bellingham.jpg' },
  { rank:4, name:"Vinícius Júnior", age:24, club:'Real Madrid', clubIcon:'⚽', pos:'LW',  rating:85, buzz:90, fanRating:4.6, img:'/assets/players/vinicius-junior.jpg' },
  { rank:5, name:"Phil Foden",      age:24, club:'Man City',    clubIcon:'⚽', pos:'CAM', rating:85, buzz:88, fanRating:4.5, img:'/assets/players/florian-wirtz.jpg' },
  { rank:6, name:"Bukayo Saka",     age:22, club:'Arsenal',     clubIcon:'⚽', pos:'RW',  rating:84, buzz:87, fanRating:4.6, img:'/assets/players/lamine-yamal.jpg' },
  { rank:7, name:"Rodri",           age:28, club:'Man City',    clubIcon:'⚽', pos:'CDM', rating:84, buzz:85, fanRating:4.6, img:'/assets/players/vitinha.jpg' },
  { rank:8, name:"Federico Valverde",age:25,club:'Real Madrid', clubIcon:'⚽', pos:'CM',  rating:83, buzz:83, fanRating:4.4, img:'/assets/players/pedri.jpg' },
  { rank:9, name:"Martin Ødegaard", age:25, club:'Arsenal',     clubIcon:'⚽', pos:'CAM', rating:83, buzz:82, fanRating:4.4, img:'/assets/players/florian-wirtz.jpg' },
  { rank:10,name:"Mohamed Salah",   age:31, club:'Liverpool',   clubIcon:'⚽', pos:'RW',  rating:82, buzz:80, fanRating:4.6, img:'/assets/players/kylian-mbappe.jpg' },
];
const RANKINGS = [
  { rank:1, name:"Kylian Mbappé",   img:'/assets/players/kylian-mbappe.jpg', val:91 },
  { rank:2, name:"Erling Haaland",  img:'/assets/players/lamine-yamal.jpg',  val:90 },
  { rank:3, name:"Pedri",           img:'/assets/players/pedri.jpg',         val:89 },
  { rank:4, name:"Jude Bellingham", img:'/assets/players/jude-bellingham.jpg',val:86 },
  { rank:5, name:"Vinícius Júnior", img:'/assets/players/vinicius-junior.jpg',val:85 },
];
const RISING = [
  { rank:1, name:'Lamine Yamal',  sub:'RW · Barcelona',  rating:87, delta:'+4', img:'/assets/players/lamine-yamal.jpg' },
  { rank:2, name:'Pau Cubarsi',   sub:'CB · Barcelona',  rating:84, delta:'+5', img:'/assets/players/pedri.jpg' },
  { rank:3, name:'A. Garnacho',   sub:'LW · Man Utd',    rating:83, delta:'+4', img:'/assets/players/florian-wirtz.jpg' },
  { rank:4, name:'João Neves',    sub:'CM · Benfica',    rating:83, delta:'+3', img:'/assets/players/vitinha.jpg' },
  { rank:5, name:'Arda Güler',    sub:'AM · Real Madrid',rating:82, delta:'+3', img:'/assets/players/lamine-yamal.jpg' },
];

function HexRadarSmall() {
  const axes  = [[40,4],[70,22],[70,58],[40,76],[10,58],[10,22]];
  const score = [[40,10],[64,28],[58,54],[40,68],[16,52],[22,28]];
  const pts   = a => a.map(([x,y])=>`${x},${y}`).join(' ');
  return (
    <svg viewBox="0 0 80 80" style={{width:80,height:80}}>
      <polygon fill="none" stroke="rgba(166,255,0,.25)" strokeWidth="1" points={pts(axes)}/>
      {axes.map(([x,y],i)=><line key={i} stroke="rgba(166,255,0,.15)" strokeWidth=".8" x1="40" y1="40" x2={x} y2={y}/>)}
      <polygon fill="rgba(166,255,0,.28)" stroke="var(--lime)" strokeWidth="1.5" points={pts(score)}/>
    </svg>
  );
}

export default function Players() {
  const [rankTab, setRankTab]   = useState('Calibre Rating');
  const [search, setSearch]     = useState('');
  const featured = DB_PLAYERS[2]; // Bellingham featured

  return (
    <div className="page players-page">
      <div className="plp-header">
        <div className="plp-title">Players</div>
        <div className="plp-sub">Discover, analyse and compare the world's best football talent.</div>
      </div>

      <div className="plp-stats-bar">
        <div className="plp-stat">
          <div className="plp-stat-label">Players in Database</div>
          <div className="plp-stat-val">128,457</div>
          <div className="plp-stat-sub">+1,342 this week</div>
        </div>
        <div className="plp-stat">
          <div className="plp-stat-label">Live Updates</div>
          <div className="plp-stat-val">2,458</div>
          <div className="plp-stat-sub" style={{color:'var(--text2)'}}>Players updated</div>
        </div>
        <div className="plp-stat">
          <div className="plp-stat-label">Scouts Online</div>
          <div className="plp-stat-val">263</div>
          <div className="plp-stat-sub" style={{color:'var(--text2)'}}>Across 52 countries</div>
        </div>
        <div className="plp-stat">
          <div className="plp-stat-label">Market Buzz (7D)</div>
          <div className="plp-stat-val" style={{color:'var(--green)'}}>High</div>
          <div className="plp-stat-sub">+18%</div>
        </div>
      </div>

      <div className="plp-search-bar">
        <div className="plp-search">
          <Search size={16} color="var(--text3)"/>
          <input placeholder="Search players by name, club, or keyword..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <button className="btn btn--outline" type="button">Advanced Filters</button>
      </div>

      <div className="plp-filters">
        {['All Positions','16-40','All Leagues','All Nations','All Archetypes'].map(f=>(
          <select key={f} className="plp-filter-select"><option>{f}</option></select>
        ))}
        <button className="btn btn--ghost btn--sm" type="button">Clear all</button>
        <button className="btn btn--lime btn--sm" type="button">Apply Filters</button>
      </div>

      <div className="plp-layout">
        {/* Left: Featured + Rankings */}
        <div>
          <div className="plp-featured panel--featured" style={{borderRadius:'var(--r-lg)',overflow:'hidden',border:'1px solid var(--border-lime)',background:'var(--panel)'}}>
            <div className="plp-featured-img-wrap">
              <img className="plp-featured-img" src={featured.img} alt={featured.name}/>
              <div className="plp-featured-img-overlay"/>
              <div className="plp-featured-rating-badge">
                <strong>{featured.rating}</strong>
                <span>Calibre</span>
              </div>
            </div>
            <div className="plp-featured-body">
              <div className="plp-featured-tag">
                <Star size={12} color="var(--lime)"/>
                <span style={{font:'700 10px/1 "Barlow Condensed"',color:'var(--lime)',letterSpacing:'.1em',textTransform:'uppercase'}}>Featured Player</span>
              </div>
              <div className="plp-featured-name">{featured.name}</div>
              <div className="plp-featured-club">⚽ {featured.club}</div>
              <div className="plp-featured-meta">CM · Box-to-Box Midfielder &nbsp;|&nbsp; 🏴󠁧󠁢󠁥󠁮󠁧󠁿 ENG · 21 Years old</div>
              <div className="plp-featured-stats">
                <div className="plp-featured-stat"><strong style={{color:'var(--lime)'}}>{featured.rating}</strong><span>Overall</span><small>Top 2%</small></div>
                <div className="plp-featured-stat"><strong style={{color:'var(--lime)'}}>{featured.buzz}</strong><span>Market Buzz</span><small>Very High</small></div>
                <div className="plp-featured-stat"><strong style={{color:'var(--lime)'}}>{featured.fanRating} ★</strong><span>Fan Rating</span><small>(12.4K)</small></div>
                <div className="plp-featured-stat"><strong style={{color:'var(--green)'}}>93</strong><span>Potential</span><small>Elite</small></div>
              </div>
              <button className="btn btn--outline btn--sm" style={{width:'100%'}} type="button" onClick={()=>navigateTo('/players')}>
                View Full Profile <ArrowRight size={13}/>
              </button>
            </div>
          </div>

          <div className="plp-rankings panel" style={{marginTop:12}}>
            <div className="panel-head"><div className="panel-title">Player Rankings</div></div>
            <div className="plp-rankings-tabs">
              {['Calibre Rating','Market Buzz','Fan Rating','Potential'].map(t=>(
                <button key={t} type="button" className={`plp-rank-tab ${rankTab===t?'active':''}`} onClick={()=>setRankTab(t)}>{t}</button>
              ))}
            </div>
            {RANKINGS.map(r=>(
              <div key={r.rank} className="plp-rank-row">
                <div className="plp-rank-num">{r.rank}</div>
                <img className="avatar avatar--28" src={r.img} alt={r.name} style={{borderRadius:3,height:32,objectPosition:'top'}}/>
                <div className="plp-rank-name">{r.name}</div>
                <div className="rating-badge rating-badge--sm">{r.val}</div>
              </div>
            ))}
            <button className="btn btn--ghost btn--sm" style={{width:'100%',marginTop:10,justifyContent:'center'}} type="button">VIEW ALL RANKINGS <ArrowRight size={13}/></button>
          </div>
        </div>

        {/* Centre: Database */}
        <div>
          <div className="panel">
            <div className="plp-db-header">
              <div style={{font:'700 13px/1 "Barlow Condensed"',letterSpacing:'.1em',textTransform:'uppercase'}}>Player Database</div>
              <div className="plp-db-count">128,457 players found</div>
            </div>
            <table className="plp-db-table">
              <thead>
                <tr>
                  <th>Rank</th><th>Player</th><th>Age</th><th>Club</th><th>Pos</th>
                  <th className="sortable">Rating ↓</th><th>Market Buzz</th><th>Fan Rating</th>
                </tr>
              </thead>
              <tbody>
                {DB_PLAYERS.map(p=>(
                  <tr key={p.rank}>
                    <td className="plp-rank-col">{p.rank}</td>
                    <td>
                      <div className="plp-player-cell">
                        <img src={p.img} alt={p.name} style={{width:28,height:32,objectFit:'cover',objectPosition:'top',borderRadius:3}}/>
                        <strong>{p.name}</strong>
                      </div>
                    </td>
                    <td style={{color:'var(--text2)'}}>{p.age}</td>
                    <td style={{color:'var(--text2)',fontSize:12}}>{p.club}</td>
                    <td><span className="plp-pos-badge">{p.pos}</span></td>
                    <td><div className="rating-badge rating-badge--sm">{p.rating}</div></td>
                    <td><span style={{color:'var(--green)',font:'700 13px/1 "Barlow Condensed"'}}>{p.buzz}</span></td>
                    <td><div className="plp-fan-rating">★ {p.fanRating}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn--outline btn--sm" style={{width:'100%',marginTop:12}} type="button">VIEW FULL DATABASE <ArrowRight size={13}/></button>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:10}}>
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Most Rated Players (30D)</div><a className="panel-action">View all</a></div>
              {[{name:'Jude Bellingham',club:'Real Madrid',rating:4.8,count:'12.4K'},{name:'Lionel Messi',club:'Inter Miami',rating:4.8,count:'11.1K'},{name:'Cristiano Ronaldo',club:'Al Nassr',rating:4.7,count:'9.8K'},{name:'Kylian Mbappé',club:'Real Madrid',rating:4.7,count:'9.3K'},{name:'Vinícius Júnior',club:'Real Madrid',rating:4.6,count:'8.7K'}].map((p,i)=>(
                <div key={i} className="row-item">
                  <img src={DB_PLAYERS[i%DB_PLAYERS.length].img} alt="" className="avatar avatar--28" style={{borderRadius:3,height:32,objectPosition:'top'}}/>
                  <div style={{flex:1}}><div style={{font:'700 13px/1 "Barlow Condensed"'}}>{p.name}</div><div style={{fontSize:11,color:'var(--text2)'}}>{p.club}</div></div>
                  <span style={{color:'var(--lime)',font:'700 13px/1 "Barlow Condensed"'}}>★ {p.rating}</span>
                </div>
              ))}
            </div>
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Recently Compared</div><a className="panel-action">View all</a></div>
              {[{a:'Bellingham',b:'Pedri',n:2341},{a:'Haaland',b:'Mbappé',n:1987},{a:'Saka',b:'Vinícius Jr.',n:1521},{a:'Foden',b:'Musiala',n:1217},{a:'Rodri',b:'Rice',n:1003}].map((c,i)=>(
                <div key={i} className="row-item">
                  <div style={{display:'flex',gap:4}}>
                    <img src={DB_PLAYERS[i%5].img} alt="" style={{width:22,height:26,objectFit:'cover',borderRadius:2,objectPosition:'top'}}/>
                    <img src={DB_PLAYERS[(i+1)%5].img} alt="" style={{width:22,height:26,objectFit:'cover',borderRadius:2,objectPosition:'top'}}/>
                  </div>
                  <div style={{flex:1,fontSize:13,font:'600 13px/1 "Barlow Condensed"'}}>{c.a} vs {c.b}</div>
                  <span style={{fontSize:11,color:'var(--text2)'}}>{c.n.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Compare + Rising + Archetype */}
        <div>
          <div className="panel plp-compare" style={{marginBottom:10}}>
            <div className="panel-head"><div className="panel-title">Compare Players</div><a className="panel-action">Clear</a></div>
            <div className="plp-compare-slots">
              <div className="plp-compare-slot">
                <img src="/assets/players/jude-bellingham.jpg" alt="Bellingham" style={{width:48,height:56,objectFit:'cover',objectPosition:'top',borderRadius:4}}/>
                <strong>Jude Bellingham</strong>
                <span>Real Madrid</span>
                <div className="plp-compare-slot-rating"><div className="rating-badge rating-badge--sm">86</div><span>CM</span></div>
                <button className="plp-compare-remove" type="button">×</button>
              </div>
              <div className="plp-compare-slot">
                <img src="/assets/players/pedri.jpg" alt="Pedri" style={{width:48,height:56,objectFit:'cover',objectPosition:'top',borderRadius:4}}/>
                <strong>Pedri</strong>
                <span>Barcelona</span>
                <div className="plp-compare-slot-rating"><div className="rating-badge rating-badge--sm">89</div><span>CM</span></div>
                <button className="plp-compare-remove" type="button">×</button>
              </div>
            </div>
            <button className="btn btn--lime btn--sm" style={{width:'100%'}} type="button">COMPARE PLAYERS <ArrowRight size={13}/></button>
          </div>

          <div className="panel" style={{marginBottom:10}}>
            <div className="panel-head">
              <div className="panel-title"><TrendingUp size={12} style={{marginRight:5,verticalAlign:'middle',color:'var(--lime)'}}/>Rising Players</div>
              <a className="panel-action">View all</a>
            </div>
            {RISING.map(r=>(
              <div key={r.rank} className="plp-rising-row">
                <div className="plp-rising-num">{r.rank}</div>
                <img src={r.img} alt="" style={{width:28,height:34,objectFit:'cover',objectPosition:'top',borderRadius:3}}/>
                <div className="plp-rising-info">
                  <strong>{r.name}</strong>
                  <span>{r.sub}</span>
                </div>
                <div style={{textAlign:'right'}}>
                  <div className="rating-badge rating-badge--sm">{r.rating}</div>
                  <div className="trend-up" style={{marginTop:3}}>{r.delta}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-head"><div className="panel-title">Archetype Distribution</div><a className="panel-action">View all</a></div>
            <HexRadarSmall/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:8,fontSize:11,color:'var(--text2)'}}>
              {[['Playmaker','18%'],['Box-to-Box','22%'],['Winger','16%'],['Goal Scorer','17%'],['Defensive Mid','12%'],['Ball Winner','15%']].map(([l,v])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between'}}><span>{l}</span><span style={{color:'var(--lime)',fontWeight:700}}>{v}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="founder-strip" style={{marginTop:16}}>
        <Crown size={22} className="founder-strip-icon"/>
        <strong>Get World Cup Founder Pass</strong>
        <span>Unlock premium insights, advanced filters &amp; exclusive World Cup content.</span>
        <button type="button" className="btn btn--lime" onClick={()=>navigateTo('/pricing')}>EXPLORE PLANS <ArrowRight size={14}/></button>
      </div>
    </div>
  );
}
