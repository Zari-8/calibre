import { useState } from 'react';
import { ArrowRight, Crown, Share2, Star, Search, Filter } from 'lucide-react';
import { navigateTo } from '../components/NavLink.jsx';

const BREAKDOWN = [
  { label:'Tactical Role',          val:90 },
  { label:'Position Compatibility', val:88 },
  { label:'Playing Style Match',    val:85 },
  { label:'Team Chemistry',         val:84 },
  { label:'Physical Demands',       val:83 },
  { label:'Growth Potential',       val:87 },
];
const ALT_FITS = [
  { name:'Real Madrid',    fmt:'4-3-1-2', pct:83, verdict:'Very Good Fit',  logo:'⚽' },
  { name:'Manchester City',fmt:'4-3-3',   pct:81, verdict:'Very Good Fit',  logo:'⚽' },
  { name:'Arsenal',        fmt:'4-3-3',   pct:79, verdict:'Good Fit',       logo:'⚽' },
  { name:'Bayern München', fmt:'4-2-3-1', pct:78, verdict:'Good Fit',       logo:'⚽' },
];
const ROLE_PULSE = [
  { label:'Positioning',           val:92 },
  { label:'Decision Making',       val:91 },
  { label:'Link-Up Play',          val:87 },
  { label:'Final Third Impact',    val:86 },
  { label:'Press Resistance',      val:85 },
  { label:'Transition Contribution',val:83 },
];
const KEY_METRICS = [
  { label:'Ball\nPossession',     val:92, grade:'Excellent' },
  { label:'Chance\nCreation',     val:88, grade:'Very Good' },
  { label:'Pressing\nInvolvement',val:84, grade:'Very Good' },
  { label:'Defensive\nCover',     val:81, grade:'Good' },
];
const BEST_FITS = [
  { rank:1, logo:'⚽', club:'FC Barcelona',    fmt:'4-3-3 Possession', pct:86, verdict:'Excellent Fit',  cls:'#d7f900' },
  { rank:2, logo:'⚽', club:'Real Madrid',     fmt:'4-3-1-2',          pct:83, verdict:'Very Good Fit',  cls:'#15c45a' },
  { rank:3, logo:'⚽', club:'Manchester City', fmt:'4-3-3',            pct:81, verdict:'Very Good Fit',  cls:'#15c45a' },
  { rank:4, logo:'⚽', club:'Arsenal',         fmt:'4-3-3',            pct:79, verdict:'Good Fit',       cls:'#c9b800' },
  { rank:5, logo:'⚽', club:'Bayern München',  fmt:'4-2-3-1',          pct:78, verdict:'Good Fit',       cls:'#c9b800' },
];
const INSIGHTS = [
  { icon:'💡', text:"Bellingham's box-to-box dynamism perfectly suits Barcelona's high-tempo positional play." },
  { icon:'✓',  text:"His progressive passing and intelligent runs match the team's chance creation patterns." },
  { icon:'△',  text:"Could become a top-3 performing midfielder in this system." },
];
const RECENT = [
  { name:'Jude Bellingham', pct:86, sub:'Fit Score', img:'/assets/players/jude-bellingham.jpg' },
  { name:'Pedri',           pct:84, sub:'Fit Score', img:'/assets/players/pedri.jpg' },
  { name:'Florian Wirtz',   pct:82, sub:'Fit Score', img:'/assets/players/florian-wirtz.jpg' },
];

/* ── Tiny hex radar — FIXED SIZE ONLY ── */
function MiniRadar({ size = 80 }) {
  const cx = size/2, cy = size/2, r = size*0.42;
  const hex = Array.from({length:6},(_,i) => {
    const a = (Math.PI/3)*i - Math.PI/2;
    return [cx + r*Math.cos(a), cy + r*Math.sin(a)];
  });
  const score = hex.map(([x,y]) => [cx+(x-cx)*0.72, cy+(y-cy)*0.72]);
  const pts = arr => arr.map(p=>p.join(',')).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block',flexShrink:0}}>
      <polygon fill="none" stroke="rgba(215,249,0,.18)" strokeWidth="1" points={pts(hex)}/>
      {hex.map(([x,y],i)=><line key={i} stroke="rgba(215,249,0,.1)" strokeWidth="1" x1={cx} y1={cy} x2={x} y2={y}/>)}
      <polygon fill="rgba(215,249,0,.22)" stroke="#d7f900" strokeWidth="1.5" points={pts(score)}/>
    </svg>
  );
}

/* ── Fit score ring — FIXED SIZE ── */
function FitRing({ pct }) {
  const r = 46, circ = 2*Math.PI*r;
  const fill = circ*(pct/100);
  return (
    <div style={{position:'relative',width:120,height:120,flexShrink:0}}>
      <svg width="120" height="120" viewBox="0 0 120 120" style={{transform:'rotate(-90deg)'}}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(215,249,0,.08)" strokeWidth="8"/>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#d7f900" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={`${fill} ${circ}`}/>
      </svg>
      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}>
        <span style={{font:'900 26px/1 "Barlow Condensed"',color:'#d7f900'}}>{pct}%</span>
        <span style={{font:'700 8px/1 "Rajdhani"',letterSpacing:'.15em',textTransform:'uppercase',color:'rgba(255,255,255,.4)'}}>FIT SCORE</span>
        <span style={{font:'700 10px/1 "Barlow Condensed"',color:'#15c45a',marginTop:2}}>Excellent Fit</span>
      </div>
    </div>
  );
}

/* ── Dots meter ── */
function Dots({ val, total = 10 }) {
  return (
    <div style={{display:'flex',gap:2,flexShrink:0}}>
      {Array.from({length:total},(_,i)=>(
        <div key={i} style={{
          width:9,height:9,borderRadius:2,
          background: i < Math.round(val/10) ? '#d7f900' : 'rgba(255,255,255,.08)',
        }}/>
      ))}
    </div>
  );
}

/* ── Metric ring (small) ── */
function MetricRing({ val, label, grade }) {
  const r=28, circ=2*Math.PI*r, fill=circ*(val/100);
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
      <div style={{position:'relative',width:70,height:70}}>
        <svg width="70" height="70" viewBox="0 0 70 70" style={{transform:'rotate(-90deg)'}}>
          <circle cx="35" cy="35" r={r} fill="none" stroke="rgba(215,249,0,.08)" strokeWidth="6"/>
          <circle cx="35" cy="35" r={r} fill="none" stroke="#d7f900" strokeWidth="6"
            strokeLinecap="round" strokeDasharray={`${fill} ${circ}`}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{font:'900 18px/1 "Barlow Condensed"',color:'#d7f900'}}>{val}</span>
        </div>
      </div>
      <div style={{textAlign:'center'}}>
        <div style={{font:'700 9px/1.3 "Rajdhani"',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(255,255,255,.5)',whiteSpace:'pre-line'}}>{label}</div>
        <div style={{font:'700 9px/1 "Rajdhani"',letterSpacing:'.1em',textTransform:'uppercase',color:'#15c45a',marginTop:3}}>{grade}</div>
      </div>
    </div>
  );
}

/* ── Pitch viz ── */
function Pitch() {
  return (
    <svg viewBox="0 0 500 320" style={{width:'100%',height:'100%',display:'block'}}>
      {/* grass */}
      <rect x="0" y="0" width="500" height="320" fill="#0a1a0a"/>
      {/* outer border */}
      <rect x="10" y="10" width="480" height="300" fill="none" stroke="rgba(21,196,90,.35)" strokeWidth="1.5"/>
      {/* halfway line */}
      <line x1="250" y1="10" x2="250" y2="310" stroke="rgba(21,196,90,.25)" strokeWidth="1"/>
      {/* centre circle */}
      <circle cx="250" cy="160" r="60" fill="none" stroke="rgba(21,196,90,.25)" strokeWidth="1"/>
      <circle cx="250" cy="160" r="3" fill="rgba(21,196,90,.4)"/>
      {/* left penalty area */}
      <rect x="10" y="90" width="90" height="140" fill="none" stroke="rgba(21,196,90,.25)" strokeWidth="1"/>
      {/* left goal area */}
      <rect x="10" y="125" width="35" height="70" fill="none" stroke="rgba(21,196,90,.2)" strokeWidth="1"/>
      {/* right penalty area */}
      <rect x="400" y="90" width="90" height="140" fill="none" stroke="rgba(21,196,90,.25)" strokeWidth="1"/>
      {/* right goal area */}
      <rect x="455" y="125" width="35" height="70" fill="none" stroke="rgba(21,196,90,.2)" strokeWidth="1"/>
      {/* player dot — advanced midfielder position */}
      <circle cx="330" cy="155" r="12" fill="#d7f900"/>
      <circle cx="330" cy="155" r="20" fill="none" stroke="rgba(215,249,0,.3)" strokeWidth="1"/>
    </svg>
  );
}

export default function SystemFit() {
  const [tab, setTab] = useState('Team Search');

  const S = {
    // Page wrapper
    page: {
      display:'grid',
      gridTemplateColumns:'220px minmax(0,680px) 280px',
      maxWidth:1260,
      margin:'0 auto',
      gap:0,
      minHeight:'calc(100vh - 54px)',
      maxWidth:'100%',
    },
    // Left sidebar
    sidebar: {
      borderRight:'1px solid rgba(255,255,255,.07)',
      padding:'16px 0',
      display:'flex',
      flexDirection:'column',
      gap:0,
      overflowY:'auto',
      background:'#0f1010',
    },
    // Main centre
    main: {
      padding:'16px',
      display:'flex',
      flexDirection:'column',
      gap:14,
      overflowY:'auto',
      background:'#080909',
    },
    // Right rail
    right: {
      borderLeft:'1px solid rgba(255,255,255,.07)',
      padding:'16px 14px',
      display:'flex',
      flexDirection:'column',
      gap:14,
      overflowY:'auto',
      background:'#0f1010',
    },
    // Panel card
    card: {
      border:'1px solid rgba(255,255,255,.07)',
      borderRadius:10,
      background:'#111211',
      overflow:'hidden',
    },
    cardHead: {
      display:'flex',
      alignItems:'center',
      justifyContent:'space-between',
      padding:'10px 14px',
      borderBottom:'1px solid rgba(255,255,255,.07)',
    },
    label: {
      font:'800 10px/1 "Barlow Condensed"',
      letterSpacing:'.16em',
      textTransform:'uppercase',
      color:'rgba(255,255,255,.5)',
    },
    lime: { color:'#d7f900' },
    limeBtn: {
      font:'700 10px/1 "Rajdhani"',
      letterSpacing:'.12em',
      textTransform:'uppercase',
      color:'#d7f900',
      opacity:.8,
      cursor:'pointer',
    },
    h3: {
      font:'700 11px/1 "Barlow Condensed"',
      letterSpacing:'.14em',
      textTransform:'uppercase',
      color:'rgba(255,255,255,.8)',
    },
    bodyText: {
      font:'400 12px/1 "Barlow"',
      color:'rgba(255,255,255,.5)',
    },
    divider: { height:1, background:'rgba(255,255,255,.07)', margin:'0' },
  };

  return (
    <div style={S.page}>

      {/* ═══════════════════════════
          LEFT SIDEBAR
          ═══════════════════════════ */}
      <div style={S.sidebar}>
        {/* Search tabs */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0,borderBottom:'1px solid rgba(255,255,255,.07)',margin:'0 0 12px'}}>
          {['Team Search','Player Search'].map(t=>(
            <button key={t} type="button" onClick={()=>setTab(t)} style={{
              padding:'10px 8px',textAlign:'center',
              font:'700 10px/1 "Rajdhani"',letterSpacing:'.1em',textTransform:'uppercase',
              color: tab===t ? '#d7f900' : 'rgba(255,255,255,.4)',
              borderBottom: tab===t ? '2px solid #d7f900' : '2px solid transparent',
              transition:'all .12s',
            }}>{t}</button>
          ))}
        </div>

        {/* Search input */}
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'0 12px',height:36,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',borderRadius:6,margin:'0 12px 12px'}}>
          <Search size={13} color="rgba(255,255,255,.3)"/>
          <input style={{flex:1,background:'none',color:'rgba(255,255,255,.7)',font:'400 12px/1 "Barlow"'}} placeholder="Search for a club..."/>
        </div>

        {/* Club result */}
        <div style={{margin:'0 12px 12px',padding:'10px',border:'1px solid rgba(215,249,0,.25)',borderRadius:8,background:'rgba(215,249,0,.03)',cursor:'pointer'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:32,height:32,borderRadius:6,background:'#1a3d8f',display:'grid',placeItems:'center',fontSize:18,flexShrink:0}}>🔵</div>
            <div>
              <div style={{font:'700 13px/1 "Barlow Condensed"',color:'#d7f900'}}>FC Barcelona</div>
              <div style={{font:'500 10px/1 "Barlow"',color:'rgba(255,255,255,.4)',marginTop:2}}>🇪🇸 LaLiga · SPAIN</div>
              <div style={{font:'600 10px/1 "Barlow Condensed"',color:'rgba(255,255,255,.5)',marginTop:2}}>4-3-3 Possession</div>
            </div>
          </div>
        </div>

        {/* System profile */}
        <div style={{...S.card,margin:'0 12px 12px'}}>
          <div style={{...S.cardHead}}>
            <span style={S.label}>System Profile</span>
          </div>
          <div style={{padding:'12px',display:'flex',alignItems:'center',gap:10}}>
            <MiniRadar size={72}/>
            <div>
              <div style={{font:'900 22px/1 "Barlow Condensed"',color:'#d7f900'}}>86%</div>
              <div style={{font:'600 9px/1 "Rajdhani"',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(255,255,255,.4)',marginTop:2}}>System Compatibility</div>
            </div>
          </div>
          {[['Philosophy','Positional Play'],['Balance','82/100'],['Intensity','High'],['Line Height','High']].map(([l,v])=>(
            <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 12px',borderTop:'1px solid rgba(255,255,255,.06)',font:'500 11px/1 "Barlow"'}}>
              <span style={{color:'rgba(255,255,255,.4)'}}>{l}</span>
              <span style={{color:'rgba(255,255,255,.8)',fontWeight:700}}>{v}</span>
            </div>
          ))}
          <button type="button" style={{
            display:'flex',alignItems:'center',justifyContent:'center',gap:5,
            width:'100%',padding:'10px',
            font:'700 10px/1 "Rajdhani"',letterSpacing:'.12em',textTransform:'uppercase',
            color:'#d7f900',borderTop:'1px solid rgba(255,255,255,.07)',transition:'background .12s',
          }}>VIEW FULL SYSTEM BREAKDOWN <ArrowRight size={11}/></button>
        </div>

        {/* Compare with other systems */}
        <div style={{margin:'0 12px 4px'}}>
          <div style={{...S.label,display:'block',padding:'8px 2px 6px'}}>Compare with Other Systems</div>
          {[['Real Madrid','4-3-1-2',83],['Manchester City','4-3-3',81],['Arsenal','4-3-3',79],['Bayern München','4-2-3-1',78],['Liverpool','4-3-3',76]].map(([t,f,p])=>(
            <div key={t} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 0',borderBottom:'1px solid rgba(255,255,255,.05)',cursor:'pointer'}}>
              <span style={{fontSize:14}}>⚽</span>
              <span style={{flex:1,font:'600 12px/1 "Barlow"',color:'rgba(255,255,255,.7)'}}>{t}</span>
              <span style={{font:'600 10px/1 "Barlow"',color:'rgba(255,255,255,.35)'}}>{f}</span>
              <span style={{font:'800 13px/1 "Barlow Condensed"',color:'#d7f900'}}>{p}%</span>
            </div>
          ))}
          <button type="button" style={{
            display:'flex',alignItems:'center',justifyContent:'center',gap:5,
            width:'100%',padding:'10px 0',
            font:'700 10px/1 "Rajdhani"',letterSpacing:'.12em',textTransform:'uppercase',
            color:'#d7f900',marginTop:6,
          }}>COMPARE MULTIPLE SYSTEMS <ArrowRight size={11}/></button>
        </div>

        {/* Recently viewed */}
        <div style={{margin:'8px 12px 0'}}>
          <div style={{...S.label,display:'block',padding:'8px 2px 8px'}}>Recently Viewed</div>
          {RECENT.map(r=>(
            <div key={r.name} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,.06)',cursor:'pointer'}}>
              <img src={r.img} alt={r.name} style={{width:28,height:28,borderRadius:'50%',objectFit:'cover',objectPosition:'50% 20%',border:'1px solid rgba(255,255,255,.1)',flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{font:'700 12px/1 "Barlow"',color:'rgba(255,255,255,.8)'}}>{r.name}</div>
                <div style={{font:'500 10px/1 "Barlow"',color:'rgba(255,255,255,.4)',marginTop:2}}>{r.sub}</div>
              </div>
              <div style={{font:'800 13px/1 "Barlow Condensed"',color:'#d7f900'}}>{r.pct}%</div>
            </div>
          ))}
          <button type="button" style={{
            display:'flex',alignItems:'center',justifyContent:'center',gap:5,
            width:'100%',padding:'10px 0',
            font:'700 10px/1 "Rajdhani"',letterSpacing:'.12em',textTransform:'uppercase',color:'#d7f900',
          }}>VIEW ALL HISTORY <ArrowRight size={11}/></button>
        </div>
      </div>

      {/* ═══════════════════════════
          MAIN CENTRE
          ═══════════════════════════ */}
      <div style={S.main}>

        {/* Player hero card */}
        <div style={S.card}>
          {/* top bar */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,.07)'}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                <span style={{font:'600 9px/1 "Barlow Condensed"',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(255,255,255,.4)'}}>Player to System Fit</span>
                <span style={{display:'flex',alignItems:'center',gap:4,padding:'2px 7px',border:'1px solid rgba(215,249,0,.25)',borderRadius:3,font:'700 8px/1 "Rajdhani"',letterSpacing:'.14em',textTransform:'uppercase',color:'#d7f900'}}>AI Calculated</span>
              </div>
              <div style={{font:'900 22px/1 "Barlow Condensed"',letterSpacing:'.04em',textTransform:'uppercase',color:'#fff'}}>Jude Bellingham</div>
              <div style={{font:'500 11px/1 "Barlow"',color:'rgba(255,255,255,.45)',marginTop:3}}>CM · Age 21 · Real Madrid</div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button type="button" style={{display:'flex',alignItems:'center',gap:5,padding:'7px 12px',border:'1px solid rgba(255,255,255,.07)',borderRadius:6,font:'700 10px/1 "Rajdhani"',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(255,255,255,.5)'}}>
                <Share2 size={12}/> Share
              </button>
              <button type="button" style={{display:'flex',alignItems:'center',gap:5,padding:'7px 12px',border:'1px solid rgba(255,255,255,.07)',borderRadius:6,font:'700 10px/1 "Rajdhani"',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(255,255,255,.5)'}}>
                <Star size={12}/> Add to Watchlist
              </button>
            </div>
          </div>

          {/* player body: img + fit score + breakdown */}
          <div style={{display:'grid',gridTemplateColumns:'180px 1fr',minHeight:220}}>
            <div style={{position:'relative',overflow:'hidden',background:'#0a0b0a'}}>
              <img src="/assets/players/jude-bellingham.jpg" alt="Bellingham" style={{
                width:'100%',height:'100%',objectFit:'cover',objectPosition:'50% 30%',
                maskImage:'linear-gradient(to right, rgba(0,0,0,1) 55%, transparent 100%)',
                WebkitMaskImage:'linear-gradient(to right, rgba(0,0,0,1) 55%, transparent 100%)',
              }}/>
            </div>
            <div style={{padding:'18px',display:'flex',gap:20}}>
              <FitRing pct={86}/>
              <div style={{flex:1}}>
                <div style={{...S.label,display:'block',marginBottom:10}}>Fit Breakdown</div>
                {BREAKDOWN.map(b=>(
                  <div key={b.label} style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                    <span style={{font:'500 11px/1 "Barlow"',color:'rgba(255,255,255,.5)',flex:1,minWidth:160}}>{b.label}</span>
                    <Dots val={b.val}/>
                    <span style={{font:'800 12px/1 "Barlow Condensed"',color:'#d7f900',width:24,textAlign:'right'}}>{b.val}</span>
                  </div>
                ))}
                <div style={{font:'500 10px/1 "Barlow"',color:'rgba(255,255,255,.3)',marginTop:8}}>🏆 Top 6% of CMs in World Football</div>
              </div>
            </div>
          </div>

          {/* footer actions */}
          <div style={{display:'flex',gap:8,padding:'12px 16px',borderTop:'1px solid rgba(255,255,255,.07)'}}>
            {['DETAILED ANALYSIS','PLAYER REPORT','COMPARE'].map(l=>(
              <button key={l} type="button" style={{
                flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,
                padding:'10px',border:'1px solid rgba(255,255,255,.08)',borderRadius:6,
                font:'700 10px/1 "Rajdhani"',letterSpacing:'.1em',textTransform:'uppercase',color:'#d7f900',
              }}>{l} <ArrowRight size={11}/></button>
            ))}
          </div>
        </div>

        {/* Alternative system fits */}
        <div style={S.card}>
          <div style={{...S.cardHead}}>
            <span style={S.h3}>Alternative System Fits</span>
            <button style={S.limeBtn}>View all <ArrowRight size={10} style={{verticalAlign:'middle'}}/></button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:1,background:'rgba(255,255,255,.06)'}}>
            {ALT_FITS.map(f=>(
              <div key={f.name} style={{background:'#0f1010',padding:'14px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                <span style={{fontSize:22}}>{f.logo}</span>
                <div>
                  <div style={{font:'800 12px/1 "Barlow Condensed"',letterSpacing:'.04em',textTransform:'uppercase'}}>{f.name}</div>
                  <div style={{font:'600 9px/1 "Rajdhani"',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(255,255,255,.4)',marginTop:2}}>{f.fmt}</div>
                </div>
                <MiniRadar size={56}/>
                <div style={{font:'900 20px/1 "Barlow Condensed"',color:'#d7f900'}}>{f.pct}%</div>
                <div style={{font:'700 9px/1 "Rajdhani"',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(255,255,255,.4)'}}>Fit Score</div>
                <div style={{font:'600 10px/1 "Barlow Condensed"',color: f.verdict.includes('Very') ? '#15c45a' : '#c9b800'}}>{f.verdict}</div>
                <button type="button" style={{
                  width:'100%',padding:'7px',border:'1px solid rgba(255,255,255,.08)',borderRadius:5,
                  font:'700 9px/1 "Rajdhani"',letterSpacing:'.1em',textTransform:'uppercase',color:'#d7f900',
                }}>VIEW ANALYSIS <ArrowRight size={9} style={{verticalAlign:'middle'}}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* Role Fit Pulse + Key System Metrics */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {/* Role Fit Pulse */}
          <div style={S.card}>
            <div style={S.cardHead}><span style={S.h3}>Role Fit Pulse</span></div>
            <div style={{padding:'14px',display:'flex',gap:12,alignItems:'center'}}>
              <div style={{fontSize:28,flexShrink:0}}>🧍</div>
              <div style={{flex:1}}>
                {ROLE_PULSE.map(r=>(
                  <div key={r.label} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                    <span style={{font:'500 11px/1 "Barlow"',color:'rgba(255,255,255,.45)',flex:1,minWidth:140,fontSize:11}}>{r.label}</span>
                    <Dots val={r.val}/>
                    <span style={{font:'800 12px/1 "Barlow Condensed"',color:'#d7f900',width:22,textAlign:'right'}}>{r.val}</span>
                  </div>
                ))}
                <div style={{display:'flex',gap:12,marginTop:8,font:'600 9px/1 "Barlow"',color:'rgba(255,255,255,.35)'}}>
                  <span>● Excellent</span><span>● Good</span><span>● Average</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key System Metrics */}
          <div style={S.card}>
            <div style={S.cardHead}><span style={S.h3}>Key System Metrics</span></div>
            <div style={{padding:'16px',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
              {KEY_METRICS.map(m=>(
                <MetricRing key={m.label} val={m.val} label={m.label} grade={m.grade}/>
              ))}
            </div>
            <button type="button" style={{
              display:'flex',alignItems:'center',justifyContent:'center',gap:5,
              width:'100%',padding:'10px',borderTop:'1px solid rgba(255,255,255,.07)',
              font:'700 10px/1 "Rajdhani"',letterSpacing:'.12em',textTransform:'uppercase',color:'#d7f900',
            }}>VIEW ALL METRICS <ArrowRight size={11}/></button>
          </div>
        </div>

        {/* Recent Match Impact */}
        <div style={S.card}>
          <div style={{...S.cardHead}}>
            <span style={S.h3}>Recent Match Impact in This System</span>
            <button style={S.limeBtn}>View match log <ArrowRight size={10} style={{verticalAlign:'middle'}}/></button>
          </div>
          <div style={{display:'flex',gap:8,padding:'12px'}}>
            {[{res:'W',score:'3-0',vs:'vs Atletico Madrid',r:8.6},{res:'W',score:'4-1',vs:'vs Girona FC',r:8.2},{res:'W',score:'2-1',vs:'vs Real Sociedad',r:7.8},{res:'W',score:'5-0',vs:'vs Real Betis',r:8.9}].map((m,i)=>(
              <div key={i} style={{flex:1,border:'1px solid rgba(255,255,255,.07)',borderRadius:6,padding:'10px',background:'rgba(0,0,0,.3)',display:'flex',flexDirection:'column',gap:4}}>
                <span style={{font:'800 11px/1 "Barlow Condensed"',color:'#15c45a',padding:'2px 5px',background:'rgba(21,196,90,.12)',borderRadius:3,width:'fit-content'}}>{m.res} {m.score}</span>
                <span style={{font:'500 10px/1 "Barlow"',color:'rgba(255,255,255,.4)',marginTop:2}}>{m.vs}</span>
                <span style={{font:'900 16px/1 "Barlow Condensed"',color:'#d7f900'}}>Rating {m.r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════
          RIGHT RAIL
          ═══════════════════════════ */}
      <div style={S.right}>

        {/* Tactical Role Analysis */}
        <div style={S.card}>
          <div style={S.cardHead}><span style={S.h3}>Tactical Role Analysis</span></div>
          <div style={{padding:'14px'}}>
            <div style={{font:'600 9px/1 "Rajdhani"',letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(255,255,255,.35)',marginBottom:4}}>Primary Role Fit</div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
              <span style={{font:'800 16px/1 "Barlow Condensed"',color:'#d7f900'}}>Advanced Midfielder</span>
              <span style={{font:'900 20px/1 "Barlow Condensed"',color:'#d7f900'}}>90%</span>
            </div>
            <div style={{font:'400 11px/1.5 "Barlow"',color:'rgba(255,255,255,.4)',marginBottom:12}}>Links midfield and attack, late box arrivals, chance creation.</div>

            {/* Pitch */}
            <div style={{width:'100%',height:140,borderRadius:8,overflow:'hidden',border:'1px solid rgba(21,196,90,.2)'}}>
              <Pitch/>
            </div>

            {/* Other roles */}
            <div style={{marginTop:12}}>
              <div style={{font:'600 9px/1 "Rajdhani"',letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(255,255,255,.3)',marginBottom:8}}>Other Suitable Roles</div>
              {[['Central Midfielder (B2B)',85],['Roaming Playmaker',82],['Deep-Lying Playmaker',74]].map(([r,p])=>(
                <div key={r} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderTop:'1px solid rgba(255,255,255,.06)',font:'600 11px/1 "Barlow"'}}>
                  <span style={{color:'rgba(255,255,255,.55)'}}>{r}</span>
                  <span style={{font:'700 12px/1 "Barlow Condensed"',color:'#d7f900'}}>{p}%</span>
                </div>
              ))}
            </div>
            <button type="button" style={{
              display:'flex',alignItems:'center',justifyContent:'center',gap:5,width:'100%',padding:'9px',
              border:'1px solid rgba(255,255,255,.07)',borderRadius:5,marginTop:10,
              font:'700 9px/1 "Rajdhani"',letterSpacing:'.1em',textTransform:'uppercase',color:'#d7f900',
            }}>VIEW TACTICAL ROLE MAP <ArrowRight size={10}/></button>
          </div>
        </div>

        {/* Best Fit Recommendations */}
        <div style={S.card}>
          <div style={{...S.cardHead}}>
            <span style={S.h3}>Best Fit Recommendations</span>
            <span style={{font:'700 9px/1 "Rajdhani"',letterSpacing:'.1em',textTransform:'uppercase',color:'#d7f900',display:'flex',alignItems:'center',gap:4}}>AI Powered ✦</span>
          </div>
          <div style={{padding:'0 14px'}}>
            {BEST_FITS.map(f=>(
              <div key={f.rank} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
                <span style={{font:'900 16px/1 "Barlow Condensed"',color:'rgba(255,255,255,.25)',width:16,flexShrink:0}}>{f.rank}</span>
                <span style={{fontSize:16}}>{f.logo}</span>
                <div style={{flex:1}}>
                  <div style={{font:'700 12px/1 "Barlow"',color:'rgba(255,255,255,.8)'}}>{f.club}</div>
                  <div style={{font:'600 9px/1 "Rajdhani"',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(255,255,255,.35)',marginTop:2}}>{f.fmt}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{font:'900 14px/1 "Barlow Condensed"',color:'#d7f900'}}>{f.pct}%</div>
                  <div style={{font:'600 9px/1 "Rajdhani"',letterSpacing:'.08em',textTransform:'uppercase',color:f.cls,marginTop:1}}>{f.verdict}</div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" style={{
            display:'flex',alignItems:'center',justifyContent:'center',gap:5,width:'100%',padding:'10px',
            borderTop:'1px solid rgba(255,255,255,.07)',font:'700 9px/1 "Rajdhani"',letterSpacing:'.12em',textTransform:'uppercase',color:'#d7f900',
          }}>VIEW FULL RANKINGS <ArrowRight size={10}/></button>
        </div>

        {/* System Fit Insights */}
        <div style={S.card}>
          <div style={S.cardHead}><span style={S.h3}>System Fit Insights</span></div>
          <div style={{padding:'0 14px'}}>
            {INSIGHTS.map((ins,i)=>(
              <div key={i} style={{display:'flex',gap:8,padding:'9px 0',borderBottom:'1px solid rgba(255,255,255,.06)',font:'400 11px/1.6 "Barlow"',color:'rgba(255,255,255,.5)'}}>
                <span style={{flexShrink:0,marginTop:1}}>{ins.icon}</span>
                <span>{ins.text}</span>
              </div>
            ))}
          </div>
          <button type="button" style={{
            display:'flex',alignItems:'center',justifyContent:'center',gap:5,width:'100%',padding:'10px',
            borderTop:'1px solid rgba(255,255,255,.07)',font:'700 9px/1 "Rajdhani"',letterSpacing:'.12em',textTransform:'uppercase',color:'#d7f900',
          }}>VIEW FULL INSIGHTS <ArrowRight size={10}/></button>
        </div>

        {/* Founder strip */}
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px',border:'1px solid rgba(215,249,0,.22)',borderRadius:8,background:'rgba(215,249,0,.03)'}}>
          <Crown size={18} style={{color:'#d7f900',flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{font:'700 12px/1 "Barlow Condensed"',letterSpacing:'.04em',textTransform:'uppercase',color:'#d7f900'}}>World Cup Founder Pass</div>
            <div style={{font:'400 10px/1.4 "Barlow"',color:'rgba(255,255,255,.4)',marginTop:3}}>Unlock premium insights &amp; exclusive World Cup content.</div>
          </div>
          <button type="button" onClick={()=>navigateTo('/pricing')} style={{
            display:'flex',alignItems:'center',gap:5,padding:'8px 12px',background:'#d7f900',color:'#050700',borderRadius:5,
            font:'800 10px/1 "Barlow Condensed"',letterSpacing:'.08em',textTransform:'uppercase',flexShrink:0,
          }}>EXPLORE <ArrowRight size={10}/></button>
        </div>
      </div>

    </div>
  );
}
