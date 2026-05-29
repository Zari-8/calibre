import { useState, useEffect, useRef } from 'react';
import { Zap, Target, Star, MessageSquare, GaugeCircle, Users, ArrowRight, Crown, Filter } from 'lucide-react';
import { useBattle } from '../hooks/useBattle.js';
import { navigateTo } from '../components/NavLink.jsx';
import { players, rateBattles } from '../data/calibreData.js';

function useCountdown() {
  const get = () => {
    const now = new Date(), next = new Date(now); next.setUTCHours(24,0,0,0);
    const d = Math.max(0, next - now);
    return { h:String(Math.floor(d/3600000)).padStart(2,'0'), m:String(Math.floor((d%3600000)/60000)).padStart(2,'0'), s:String(Math.floor((d%60000)/1000)).padStart(2,'0') };
  };
  const [t,setT] = useState(get);
  useEffect(() => { const id = setInterval(()=>setT(get()),1000); return ()=>clearInterval(id); },[]);
  return t;
}

const CATS = [['Control',Target],['Impact',Zap],['Creativity',Star],['Debate',MessageSquare]];
const FILTER_CATS = ['All Categories','Control','Impact','Creativity','Debate'];

const ACTIVE_BATTLES = [
  { left:{name:'Haaland',club:'Man City',img:'/assets/players/kylian-mbappe.jpg'}, right:{name:'Mbappé',club:'PSG',img:'/assets/players/jude-bellingham.jpg'}, cat:'Impact', votesL:'28.7K', votesR:'24.1K', pct:54 },
  { left:{name:'Rice',club:'Arsenal',img:'/assets/players/pedri.jpg'}, right:{name:'Rodri',club:'Man City',img:'/assets/players/vitinha.jpg'}, cat:'Control', votesL:'19.3K', votesR:'17.2K', pct:53 },
  { left:{name:'Vinicius Jr.',club:'Real Madrid',img:'/assets/players/vinicius-junior.jpg'}, right:{name:'Saka',club:'Arsenal',img:'/assets/players/lamine-yamal.jpg'}, cat:'Creativity', votesL:'15.6K', votesR:'14.8K', pct:51 },
];
const UPCOMING = [
  { left:{name:'Mo Salah',club:'Liverpool',img:'/assets/players/kylian-mbappe.jpg'}, right:{name:'Son Heung-min',club:'Spurs',img:'/assets/players/lamine-yamal.jpg'}, cd:'01 : 45 : 32' },
  { left:{name:'B. Fernández',club:'Man Utd',img:'/assets/players/pedri.jpg'}, right:{name:'Ødegaard',club:'Arsenal',img:'/assets/players/vitinha.jpg'}, cd:'03 : 22 : 10' },
  { left:{name:'R. Lewandowski',club:'Barcelona',img:'/assets/players/vinicius-junior.jpg'}, right:{name:'V. Osimhen',club:'Napoli',img:'/assets/players/florian-wirtz.jpg'}, cd:'06 : 11 : 28' },
];
const NOMINATIONS = [
  { title:'Jamal Musiala vs Florian Wirtz', by:'@MidfieldMaestro', votes:2341 },
  { title:'Gavi vs Camavinga',             by:'@BarcaTalks',      votes:1876 },
  { title:'Lautaro Martínez vs D. Nuñez',  by:'@InterZone',       votes:1542 },
];
const TRENDING_RAIL = [
  { label:'Mbappé vs Haaland', votes:'24.7K', l:'/assets/players/kylian-mbappe.jpg', r:'/assets/players/jude-bellingham.jpg' },
  { label:'Messi vs Ronaldo',  votes:'18.3K', l:'/assets/players/pedri.jpg',          r:'/assets/players/vinicius-junior.jpg' },
  { label:'Bellingham vs Pedri',votes:'15.1K',l:'/assets/players/jude-bellingham.jpg',r:'/assets/players/pedri.jpg' },
  { label:'Vinícius Jr. vs Saka',votes:'12.6K',l:'/assets/players/vinicius-junior.jpg',r:'/assets/players/lamine-yamal.jpg' },
  { label:'Rodri vs Rice',     votes:'10.8K', l:'/assets/players/vitinha.jpg',         r:'/assets/players/florian-wirtz.jpg' },
];
const FEED = [
  { user:'@TacticalMind', action:'rated', battle:'Pedri vs Bellingham', score:7, ago:'Just now', img:'/assets/players/pedri.jpg' },
  { user:'@FootyGuru',    action:'joined', battle:'Haaland vs Mbappé',  score:null, ago:'1m ago', img:'/assets/players/kylian-mbappe.jpg' },
  { user:'@MidfieldMaestro', action:'nominated', battle:'Musiala vs Wirtz', score:null, ago:'3m ago', img:'/assets/players/florian-wirtz.jpg' },
  { user:'@TheStatKing', action:'commented on', battle:'Rice vs Rodri', quote:"Rodri's positional control is unmatched.", score:null, ago:'5m ago', img:'/assets/players/vitinha.jpg' },
  { user:'@BarcaTalks', action:'rated', battle:'Bellingham vs Pedri', score:8, ago:'7m ago', img:'/assets/players/jude-bellingham.jpg' },
];

function Spark() {
  return <svg className="spark" viewBox="0 0 100 32"><polyline points="0,28 20,22 40,16 55,19 70,10 85,8 100,4" /></svg>;
}

export default function Debates() {
  const { battle, playerA, playerB } = useBattle();
  const { h,m,s } = useCountdown();
  const [cat, setCat]     = useState('Control');
  const [rating, setRating] = useState(5);
  const [voted, setVoted]   = useState(false);
  const [votes, setVotes]   = useState(12458);
  const [filter, setFilter] = useState('All Categories');

  const pL = playerA || players[0];
  const pR = playerB || players[1];

  function handleRate(n) { setRating(n); if(!voted){setVoted(true);setVotes(v=>v+1);} }

  return (
    <div className="page debates-page">
      <div className="dbp-layout">
        {/* LEFT: hero + battles + upcoming */}
        <div>
          {/* Rate Battle Hero */}
          <div className="dbp-hero">
            <div className="dbp-hero-topbar">
              <div className="dbp-live-tag"><div className="live-dot" style={{marginRight:0}} />LIVE RATE BATTLE</div>
              <div className="dbp-hero-right">
                <div className="dbp-voter-stack">
                  {[pL,pR,players[2]].map(p=><img key={p.name} src={p.localImage} alt={p.name}/>)}
                </div>
                <div className="dbp-vote-badge">
                  <strong>{votes.toLocaleString()}</strong>
                  <span>Votes</span>
                </div>
              </div>
            </div>

            <div className="dbp-hero-body">
              {/* Left fighter */}
              <div className="dbp-fighter dbp-fighter--left">
                <img className="dbp-fighter-img" src={pL.localImage} alt={pL.name} />
                <div className="dbp-fighter-info">
                  <div className="dbp-fighter-name">{pL.name}</div>
                  <div className="dbp-fighter-club">{pL.team}</div>
                </div>
              </div>

              {/* Centre rating */}
              <div className="dbp-centre">
                <div className="dbp-rate-title">
                  <span>RATE</span><span>BATTLE</span>
                </div>
                <div className="dbp-vs">VS</div>
                <div className="dbp-rating-box" onClick={e=>e.stopPropagation()}>
                  <div className="dbp-category-row">
                    <span className="dbp-cat-label">who gives more:</span>
                    {CATS.map(([label,Icon])=>(
                      <button key={label} type="button"
                        className={`dbp-cat-pill ${cat===label?'active':''}`}
                        onClick={()=>setCat(label)}
                      ><Icon size={10}/> {label}</button>
                    ))}
                  </div>
                  <div className="dbp-question">Who owns the <mark>midfield?</mark></div>
                  <div className="dbp-votes-count"><Users size={10} style={{verticalAlign:'middle',marginRight:3}}/>{votes.toLocaleString()} votes · {h}:{m}:{s} left</div>
                  <div className="dbp-tap-label">↓ Tap to rate ↓</div>
                  <div className="dbp-scale">
                    {Array.from({length:10},(_,i)=>(
                      <button key={i+1} type="button" className={rating===i+1?'sel':''} onClick={()=>handleRate(i+1)}>{i+1}</button>
                    ))}
                  </div>
                  <div className="dbp-scale-labels">
                    <span>{pL.name.split(' ')[0]}</span>
                    <span style={{textAlign:'center'}}>Equal</span>
                    <span style={{textAlign:'right'}}>{pR.name.split(' ').pop()}</span>
                  </div>
                  {voted && <div className="dbp-confirm">✓ Rating added to community score</div>}
                </div>
              </div>

              {/* Right fighter */}
              <div className="dbp-fighter dbp-fighter--right">
                <img className="dbp-fighter-img" src={pR.localImage} alt={pR.name} />
                <div className="dbp-fighter-info" style={{textAlign:'right'}}>
                  <div className="dbp-fighter-name">{pR.name}</div>
                  <div className="dbp-fighter-club">{pR.team}</div>
                </div>
              </div>
            </div>

            {/* Proof strip */}
            <div className="dbp-proof-strip">
              {[['63','Active Battles'],[`${votes.toLocaleString()}`,'Votes Today'],['24.7K','Debates Joined'],['Global','200+ Countries']].map(([v,l])=>(
                <div key={l} className="dbp-proof-cell">
                  <div className="dbp-proof-val">{v}</div>
                  <div className="dbp-proof-label">{l}</div>
                </div>
              ))}
              <div className="dbp-proof-cell">
                <button className="btn btn--outline btn--sm" type="button">HOW IT WORKS</button>
              </div>
            </div>
          </div>

          {/* Filter bar */}
          <div className="dbp-filter-bar">
            {FILTER_CATS.map(f=>(
              <button key={f} type="button"
                className={`dbp-filter-btn ${filter===f?'active':''}`}
                onClick={()=>setFilter(f)}
              >{f}</button>
            ))}
            <div className="dbp-sort-bar">
              <span className="dbp-sort-label">SORT BY</span>
              <select className="dbp-sort-select"><option>Trending</option><option>Newest</option><option>Most voted</option></select>
              <button type="button" className="icon-btn"><Filter size={16}/></button>
            </div>
          </div>

          {/* Active Battles */}
          <div className="dbp-battles-section">
            <div className="dbp-section-head">
              <div className="dbp-section-title"><Zap size={15} color="var(--lime)"/>Active Rate Battles</div>
              <a className="panel-action">View all</a>
            </div>
            <div className="dbp-battles-grid">
              {ACTIVE_BATTLES.map((b,i)=>(
                <div key={i} className="dbp-battle-card">
                  <div className="dbp-battle-card-img">
                    <div className="dbp-bc-fighter dbp-bc-fighter-left">
                      <img src={b.left.img} alt={b.left.name} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top'}}/>
                      <div className="dbp-bc-fighter-left">
                        <div className="dbp-bc-fighter-name">{b.left.name}</div>
                        <div className="dbp-bc-fighter-club">{b.left.club}</div>
                      </div>
                    </div>
                    <div className="dbp-bc-vs">
                      <div className="dbp-bc-vs-text">VS</div>
                      <div className="dbp-bc-cat">{b.cat}</div>
                    </div>
                    <div className="dbp-bc-fighter dbp-bc-fighter-right">
                      <img src={b.right.img} alt={b.right.name} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top'}}/>
                      <div className="dbp-bc-fighter-right">
                        <div className="dbp-bc-fighter-name">{b.right.name}</div>
                        <div className="dbp-bc-fighter-club">{b.right.club}</div>
                      </div>
                    </div>
                    <div style={{position:'absolute',top:8,left:8}}><span className="live-dot">LIVE</span></div>
                  </div>
                  <div className="dbp-battle-card-foot">
                    <div>
                      <div className="dbp-bc-votes">{b.votesL}</div>
                      <div className="dbp-bc-bar"><div className="dbp-bc-bar-fill" style={{width:`${b.pct}%`}}/></div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div className="dbp-bc-votes">{b.votesR}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming + Nominations */}
          <div className="dbp-lower-grid">
            <div className="panel">
              <div className="panel-head">
                <div className="panel-title"><GaugeCircle size={13} style={{marginRight:5,verticalAlign:'middle',color:'var(--lime)'}}/>Upcoming Battles</div>
                <a className="panel-action">View all</a>
              </div>
              {UPCOMING.map((u,i)=>(
                <div key={i} className="dbp-upcoming-row">
                  <div className="dbp-upcoming-players">
                    <div className="dbp-upcoming-player">
                      <img src={u.left.img} alt={u.left.name}/>
                      <span>{u.left.name}</span>
                      <small>{u.left.club}</small>
                    </div>
                    <div className="dbp-vs-small" style={{margin:'0 8px'}}>VS</div>
                    <div className="dbp-upcoming-player">
                      <img src={u.right.img} alt={u.right.name}/>
                      <span>{u.right.name}</span>
                      <small>{u.right.club}</small>
                    </div>
                  </div>
                  <div className="dbp-countdown-sm">
                    <div className="dbp-cd-label">Starts in</div>
                    <div className="dbp-cd-time">{u.cd}</div>
                  </div>
                </div>
              ))}
              <button className="btn btn--outline btn--sm" style={{width:'100%',marginTop:12}} type="button">VIEW FULL SCHEDULE <ArrowRight size={13}/></button>
            </div>

            <div className="panel">
              <div className="panel-head">
                <div className="panel-title"><Star size={13} style={{marginRight:5,verticalAlign:'middle',color:'var(--lime)'}}/>Fan Nominations</div>
                <a className="panel-action">View all</a>
              </div>
              {NOMINATIONS.map((n,i)=>(
                <div key={i} className="dbp-nom-row">
                  <div className="dbp-nom-rank">{i+1}</div>
                  <div className="dbp-nom-info">
                    <strong>{n.title}</strong>
                    <small>Nominated by {n.by}</small>
                  </div>
                  <div className="dbp-nom-votes">{n.votes.toLocaleString()} 👍</div>
                </div>
              ))}
              <button className="btn btn--outline btn--sm" style={{width:'100%',marginTop:12}} type="button">NOMINATE A DEBATE +</button>
            </div>
          </div>
        </div>

        {/* RIGHT RAIL */}
        <div className="dbp-right-rail">
          {/* Trending This Week */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title"><Zap size={13} style={{marginRight:5,verticalAlign:'middle',color:'#ff6b35'}}/>Trending This Week</div>
              <a className="panel-action">View all</a>
            </div>
            {TRENDING_RAIL.map((t,i)=>(
              <div key={t.label} className="dbp-trending-row">
                <div className="dbp-trending-num">{i+1}</div>
                <div className="dbp-trending-avatars">
                  <img src={t.l} alt="" style={{width:22,height:26,objectFit:'cover',borderRadius:3}}/>
                  <img src={t.r} alt="" style={{width:22,height:26,objectFit:'cover',borderRadius:3}}/>
                </div>
                <div className="dbp-trending-info">
                  <strong>{t.label}</strong>
                  <span>{t.votes} votes</span>
                </div>
                <Spark/>
              </div>
            ))}
          </div>

          {/* Category Breakdown */}
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Category Breakdown</div></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:8}}>
              <div>
                <div className="dbp-cat-label-text">CONTROL</div>
                <div className="dbp-cat-pct">28%</div>
              </div>
              <div style={{width:80,height:80}}>
                <svg viewBox="0 0 120 120" style={{width:'100%',height:'100%'}}>
                  {[[[60,8],[105,34],[105,86],[60,112],[15,86],[15,34]]].map((axes,_)=>{
                    const pts=axes.map(([x,y])=>`${x},${y}`).join(' ');
                    const score=[[60,22],[92,48],[84,79],[60,88],[28,78],[35,42]].map(([x,y])=>`${x},${y}`).join(' ');
                    return <g key="r"><polygon fill="none" stroke="rgba(215,249,0,.25)" strokeWidth="1" points={pts}/><polygon fill="rgba(215,249,0,.3)" stroke="var(--lime)" strokeWidth="1.5" points={score}/></g>;
                  })}
                </svg>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="dbp-cat-label-text">IMPACT</div>
                <div className="dbp-cat-pct">26%</div>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}>
              <div><div className="dbp-cat-label-text">CREATIVITY</div><div className="dbp-cat-pct">24%</div></div>
              <div style={{textAlign:'right'}}><div className="dbp-cat-label-text">DEBATE</div><div className="dbp-cat-pct">22%</div></div>
            </div>
          </div>

          {/* Live Debate Feed */}
          <div className="panel" style={{flex:1}}>
            <div className="panel-head">
              <div className="panel-title">Live Debate Feed</div>
              <select style={{background:'var(--panel2)',border:'1px solid var(--border)',borderRadius:4,padding:'4px 8px',fontSize:11,color:'var(--text2)'}}>
                <option>All Activity</option>
              </select>
            </div>
            {FEED.map((f,i)=>(
              <div key={i} className="dbp-feed-row">
                <img className="dbp-feed-avatar" src={f.img} alt=""/>
                <div className="dbp-feed-body">
                  <span className="dbp-feed-user">{f.user}</span>
                  <div className="dbp-feed-text">
                    {f.action} {f.battle}
                    {f.score && <span className="dbp-score-chip">{f.score}</span>}
                  </div>
                  {f.quote && <div className="dbp-feed-quote">"{f.quote}"</div>}
                </div>
                <div className="dbp-feed-time">{f.ago}</div>
              </div>
            ))}
            <button className="btn btn--outline btn--sm" style={{width:'100%',marginTop:12}} type="button">JOIN THE CONVERSATION <ArrowRight size={13}/></button>
          </div>
        </div>
      </div>

      {/* Founder strip */}
      <div className="founder-strip">
        <Crown size={24} className="founder-strip-icon"/>
        <strong>Get World Cup Founder Pass</strong>
        <span>Unlock premium debates, advanced filters &amp; exclusive World Cup content.</span>
        <button type="button" className="btn btn--lime" onClick={()=>navigateTo('/pricing')}>EXPLORE PLANS <ArrowRight size={14}/></button>
      </div>
    </div>
  );
}
