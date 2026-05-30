import { useState } from 'react';
import { ArrowRight, Crown, Zap, Globe, Star, TrendingUp } from 'lucide-react';
import { asianTalents, TALENT_REGIONS } from '../data/calibreData.js';
import { navigateTo } from '../components/NavLink.jsx';

const RISING = [
  { rank:1, name:'Lamine Yamal',     sub:'RW · Barcelona',  score:87, delta:'+4', img:'/assets/players/lamine-yamal.jpg' },
  { rank:2, name:'Estevão',          sub:'RW · Palmeiras',  score:85, delta:'+6', img:'/assets/players/lamine-yamal.jpg' },
  { rank:3, name:'Warren Zaire-Emery',sub:'CM · PSG',       score:84, delta:'+5', img:'/assets/players/pedri.jpg' },
  { rank:4, name:'Arda Güler',       sub:'AM · Real Madrid',score:83, delta:'+4', img:'/assets/players/vitinha.jpg' },
  { rank:5, name:'Pau Cubarsi',      sub:'CB · Barcelona',  score:82, delta:'+3', img:'/assets/players/pedri.jpg' },
  { rank:6, name:'Savinho',          sub:'RW · Man City',   score:82, delta:'+3', img:'/assets/players/lamine-yamal.jpg' },
  { rank:7, name:'Mathys Tel',       sub:'ST · Bayern München',score:81,delta:'+3',img:'/assets/players/florian-wirtz.jpg' },
  { rank:8, name:'João Neves',       sub:'CM · Benfica',    score:81, delta:'+2', img:'/assets/players/vitinha.jpg' },
];
const EMERGING = [
  { name:'Francisco Conceição',club:'FC Porto',      pos:'LW', rating:81, pot:89, flag:'🇵🇹', img:'/assets/players/vinicius-junior.jpg' },
  { name:'Kobbie Mainoo',       club:'Man Utd',      pos:'CM', rating:80, pot:88, flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', img:'/assets/players/pedri.jpg' },
  { name:'Dean Huijsen',        club:'Bournemouth',  pos:'CB', rating:79, pot:87, flag:'🇪🇸', img:'/assets/players/vitinha.jpg' },
  { name:'Claudio Echeverri',   club:'Man City',     pos:'AM', rating:79, pot:87, flag:'🇦🇷', img:'/assets/players/florian-wirtz.jpg' },
  { name:'Facundo Buonanotte',  club:'Brighton',     pos:'RW', rating:78, pot:86, flag:'🇦🇷', img:'/assets/players/lamine-yamal.jpg' },
  { name:'Alejandro Garnacho',  club:'Man Utd',      pos:'ST', rating:78, pot:86, flag:'🇦🇷', img:'/assets/players/kylian-mbappe.jpg' },
];
const TREND_MOVERS = [
  { name:'Estevão',   club:'Palmeiras',  delta:'+15', img:'/assets/players/lamine-yamal.jpg' },
  { name:'Kenan Yildiz',club:'Juventus',delta:'+11', img:'/assets/players/pedri.jpg' },
  { name:'Endrick',  club:'Real Madrid', delta:'+10', img:'/assets/players/florian-wirtz.jpg' },
  { name:'Jorrel Hato',club:'Ajax',     delta:'+9',  img:'/assets/players/vitinha.jpg' },
];
const YOUTH = [
  { name:'Max Dowman',  club:'Arsenal · CAM · 15 yrs', rating:78, pot:92, img:'/assets/players/lamine-yamal.jpg' },
  { name:'Will Wright', club:'Salzburg · ST · 17 yrs', rating:76, pot:90, img:'/assets/players/pedri.jpg' },
  { name:'Rio Ngumoha', club:'Liverpool · LW · 16 yrs',rating:75, pot:89, img:'/assets/players/florian-wirtz.jpg' },
];

function SmallRadar({ attrs }) {
  const axes  = [[60,8],[105,34],[105,86],[60,112],[15,86],[15,34]];
  const scores= [[60,16],[96,40],[88,80],[60,92],[22,78],[28,36]];
  const pts   = a => a.map(([x,y])=>`${x},${y}`).join(' ');
  return (
    <svg viewBox="0 0 120 120" style={{width:140,height:140}}>
      <polygon fill="none" stroke="rgba(125,220,0,.2)" strokeWidth="1.2" points={pts(axes)}/>
      {axes.map(([x,y],i)=><line key={i} stroke="rgba(125,220,0,.12)" strokeWidth="1" x1="60" y1="60" x2={x} y2={y}/>)}
      <polygon fill="rgba(125,220,0,.28)" stroke="var(--lime)" strokeWidth="1.8" points={pts(scores)}/>
    </svg>
  );
}

export default function Talents() {
  const [region, setRegion] = useState('all');
  const [sort,   setSort]   = useState('readiness');

  const ALL_POOL = [
    ...asianTalents,
    { name:'Ibrahim Musa',    age:19, nation:'Nigeria',  flag:'🇳🇬', league:'NPFL',          club:'Remo Stars',    role:'Wide Creator',    rating:77, readiness:82, trend:'+12%', region:'africa',  trajectory:'rising', localImage:'/assets/players/ibrahim-musa.jpg' },
    { name:'Tawanda Moyo',    age:18, nation:'Zimbabwe', flag:'🇿🇼', league:'Zimbabwe PSL',  club:'FC Platinum',   role:'Controller',      rating:71, readiness:66, trend:'+8%',  region:'africa',  trajectory:'rising', localImage:'' },
    { name:'Mateo Silva',     age:20, nation:'Uruguay',  flag:'🇺🇾', league:'Uruguay Primera',club:'Nacional',     role:'Pressing Engine', rating:80, readiness:79, trend:'+10%', region:'south_america', trajectory:'rising', localImage:'' },
    { name:'Noah Adebayo',    age:17, nation:'Nigeria',  flag:'🇳🇬', league:'Academy/U21',   club:'Enyimba Youth', role:'False Nine',      rating:74, readiness:63, trend:'+15%', region:'academy', trajectory:'rising', localImage:'' },
  ];
  const filtered = ALL_POOL
    .filter(p => region==='all' || p.region===region)
    .sort((a,b) => sort==='rating'?b.rating-a.rating:sort==='trend'?parseFloat(b.trend)-parseFloat(a.trend):sort==='age'?a.age-b.age:b.readiness-a.readiness);

  return (
    <div className="page talents-page">
      {/* Header */}
      <div className="td-header">
        <div className="td-title">
          <div className="td-title-icon"><Zap size={20}/></div>
          <div>
            <h1>Talent <em>Discovery</em></h1>
            <p>Discover, scout and track the next generation of world-class footballers.</p>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{display:'flex'}}>
            {['/assets/players/lamine-yamal.jpg','/assets/players/pedri.jpg','/assets/players/florian-wirtz.jpg'].map((img,i)=>(
              <img key={i} src={img} alt="" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--border)',marginLeft:i?-8:0}}/>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="td-filters">
        {[['Age','15-21'],['Position','All Positions'],['Potential','70+'],['Region','All Regions']].map(([l,v])=>(
          <select key={l} className="td-filter-select"><option>{v}</option></select>
        ))}
        <button className="btn btn--outline btn--sm" type="button">MORE FILTERS</button>
      </div>

      {/* Region tabs */}
      <div className="td-region-tabs">
        {TALENT_REGIONS.map(r=>(
          <button key={r.key} type="button"
            className={`td-region-tab ${region===r.key?'active':''}`}
            onClick={()=>setRegion(r.key)}
          >
            {r.label}
            {r.key!=='all' && <span className="td-region-count">{ALL_POOL.filter(p=>p.region===r.key).length}</span>}
          </button>
        ))}
      </div>

      <div className="talents-layout">
        {/* Main */}
        <div>
          {/* Featured breakout */}
          <div className="td-featured">
            <div className="td-featured-img-wrap">
              <img className="td-featured-img" src="/assets/players/lamine-yamal.jpg" alt="Lamine Yamal"/>
            </div>
            <div className="td-featured-body">
              <div>
                <div className="td-featured-new">NEW</div>
                <div className="td-featured-name">Lamine Yamal</div>
                <div className="td-featured-club">FC Barcelona</div>
                <div className="td-featured-meta">RW &nbsp;·&nbsp; 16 yrs &nbsp;·&nbsp; Spain 🇪🇸</div>
              </div>
              <div className="td-featured-ratings">
                <div className="td-featured-rating">
                  <strong>87</strong>
                  <span>Current Ability</span>
                </div>
                <div className="td-featured-rating">
                  <strong style={{color:'var(--green)'}}>94</strong>
                  <span>Potential</span>
                </div>
              </div>
              <div className="td-featured-radar-area">
                <SmallRadar/>
                <div className="td-featured-attrs">
                  {[['Technical','92'],['Mental','81'],['Attacking','90'],['Physical','72'],['Creativity','93']].map(([l,v])=>(
                    <div key={l} className="td-featured-attr"><span className="td-featured-attr-label">{l}</span><span className="td-featured-attr-val">{v}</span></div>
                  ))}
                </div>
              </div>
              <div style={{marginTop:'auto'}}>
                <div className="td-featured-profile-label">Player Profile</div>
                <div className="td-featured-profile-text">Electric right winger with elite close control, vision and composure beyond his years. Already influencing matches at the highest level.</div>
                <button className="btn btn--outline btn--sm" style={{marginTop:10}} type="button">VIEW FULL REPORT <ArrowRight size={13}/></button>
              </div>
            </div>
          </div>

          {/* Rising talents panel */}
          <div className="panel" style={{marginBottom:14}}>
            <div className="panel-head">
              <div className="panel-title"><TrendingUp size={12} style={{marginRight:5,verticalAlign:'middle',color:'var(--lime)'}}/>Rising Talents</div>
              <a className="panel-action">View all</a>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 20px'}}>
              {RISING.map(r=>(
                <div key={r.rank} className="td-rising-row">
                  <div className="td-rising-num">{r.rank}</div>
                  <img className="td-rising-img" src={r.img} alt={r.name}/>
                  <div className="td-rising-info">
                    <strong>{r.name}</strong>
                    <span>{r.sub}</span>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{font:'800 18px/1 "Barlow Condensed"',color:'var(--lime)'}}>{r.score}</div>
                    <div className="trend-up">{r.delta}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Emerging stars */}
          <div style={{marginBottom:14}}>
            <div style={{font:'700 12px/1 "Barlow Condensed"',letterSpacing:'.12em',textTransform:'uppercase',color:'var(--text2)',marginBottom:12}}>Emerging Stars</div>
            <div className="td-emerging-grid">
              {EMERGING.map(p=>(
                <div key={p.name} className="td-emerging-card">
                  <div className="td-emerging-pos">{p.pos}</div>
                  <img className="td-emerging-img" src={p.img} alt={p.name}/>
                  <div className="td-emerging-body">
                    <div className="td-emerging-name">{p.name}</div>
                    <div className="td-emerging-club">{p.club} {p.flag}</div>
                    <div className="td-emerging-ratings">
                      <div><div className="td-emerging-rating"><strong>{p.rating}</strong></div></div>
                      <div className="td-emerging-potential">POT <strong>{p.pot}</strong></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom strip */}
          <div className="td-bottom-strip">
            {[['1.2M+','Talents Scouted',Globe],['200+','Countries Covered',Globe],['AI-Powered','Scouting Engine',Zap],['Real-Time','Performance Tracking',Star]].map(([v,l,Icon])=>(
              <div key={l} className="td-bottom-cell">
                <Icon size={18} className="td-bottom-cell-icon"/>
                <div><strong>{v}</strong><span>{l}</span></div>
              </div>
            ))}
            <div className="td-adv-search">
              <button className="btn btn--lime btn--sm" type="button">ADVANCED SEARCH <ArrowRight size={13}/></button>
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div className="td-right">
          {/* Scout shortlist */}
          <div className="panel">
            <div className="td-shortlist-head">
              <span style={{font:'700 13px/1 "Barlow Condensed"',letterSpacing:'.1em',textTransform:'uppercase'}}>Scout Shortlist<span className="td-shortlist-count">12</span></span>
              <button className="btn btn--lime btn--sm" type="button">VIEW SHORTLIST <ArrowRight size={13}/></button>
            </div>
            <div style={{font:'500 11px/1 "Barlow"',color:'var(--text2)'}}>Your saved talents</div>
          </div>

          {/* Scouted regions */}
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Scouted Regions</div><a className="panel-action">View all</a></div>
            <div className="td-world-map">
              <div style={{font:'600 12px/1 "Barlow"',color:'var(--text3)',textAlign:'center'}}>Global Scout Map</div>
            </div>
            {[['Europe','54%'],['South America','22%'],['Africa','12%'],['Asia','8%'],['North America','3%'],['Oceania','1%']].map(([r,p])=>(
              <div key={r} className="td-map-stat"><span>{r}</span><strong>{p}</strong></div>
            ))}
          </div>

          {/* Trend movers */}
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Trend Movers</div><a className="panel-action">View all</a></div>
            {TREND_MOVERS.map(t=>(
              <div key={t.name} className="td-trend-row">
                <img src={t.img} alt={t.name}/>
                <div className="td-trend-info"><strong>{t.name}</strong><span>{t.club}</span></div>
                <div style={{textAlign:'right'}}>
                  <div className="td-trend-delta">{t.delta} ↑</div>
                  <div className="td-trend-period">Last 30 days</div>
                </div>
              </div>
            ))}
          </div>

          {/* Youth standouts */}
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Youth Standouts</div><a className="panel-action">View all</a></div>
            {YOUTH.map(y=>(
              <div key={y.name} className="td-youth-row">
                <img src={y.img} alt={y.name}/>
                <div className="td-youth-info"><strong>{y.name}</strong><span>{y.club}</span></div>
                <div className="td-youth-scores">
                  <strong>{y.rating}</strong>
                  <span>POT <span style={{color:'var(--lime)'}}>{y.pot}</span></span>
                </div>
              </div>
            ))}
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
