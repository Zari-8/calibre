import { useState } from 'react';
import { ArrowRight, Crown, Share2, Star, Search } from 'lucide-react';
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
  { name:'Real Madrid',    fmt:'4-3-1-2', pct:83, verdict:'Very Good Fit',  abbr:'RM',  bg:'#00529f', fg:'#ffd700', ring:'#ffd700' },
  { name:'Manchester City',fmt:'4-3-3',   pct:81, verdict:'Very Good Fit',  abbr:'MC',  bg:'#6cabdd', fg:'#1c2c5b', ring:'#6cabdd' },
  { name:'Arsenal',        fmt:'4-3-3',   pct:79, verdict:'Good Fit',       abbr:'ARS', bg:'#ef0107', fg:'#fff',    ring:'#ef0107' },
  { name:'Bayern München', fmt:'4-2-3-1', pct:78, verdict:'Good Fit',       abbr:'FCB', bg:'#dc052d', fg:'#fff',    ring:'#dc052d' },
];
const ROLE_PULSE = [
  { label:'Positioning',            val:92 },
  { label:'Decision Making',        val:91 },
  { label:'Link-Up Play',           val:87 },
  { label:'Final Third Impact',     val:86 },
  { label:'Press Resistance',       val:85 },
  { label:'Transition Contribution',val:83 },
];
const KEY_METRICS = [
  { label:'Ball\nPossession',      val:92, grade:'Excellent' },
  { label:'Chance\nCreation',      val:88, grade:'Very Good' },
  { label:'Pressing\nInvolvement', val:84, grade:'Very Good' },
  { label:'Defensive\nCover',      val:81, grade:'Good'      },
];
const BEST_FITS = [
  { rank:1, abbr:'FCB', bg:'#a50044', fg:'#ffd700', club:'FC Barcelona',    fmt:'4-3-3 Possession', pct:86, verdict:'Excellent Fit',  clr:'#A6FF00' },
  { rank:2, abbr:'RM',  bg:'#00529f', fg:'#ffd700', club:'Real Madrid',     fmt:'4-3-1-2',          pct:83, verdict:'Very Good Fit',  clr:'#A6FF00' },
  { rank:3, abbr:'MC',  bg:'#6cabdd', fg:'#1c2c5b', club:'Manchester City', fmt:'4-3-3',            pct:81, verdict:'Very Good Fit',  clr:'#A6FF00' },
  { rank:4, abbr:'ARS', bg:'#ef0107', fg:'#fff',    club:'Arsenal',         fmt:'4-3-3',            pct:79, verdict:'Good Fit',       clr:'#F5C84B' },
  { rank:5, abbr:'FCB', bg:'#dc052d', fg:'#fff',    club:'Bayern München',  fmt:'4-2-3-1',          pct:78, verdict:'Good Fit',       clr:'#F5C84B' },
];
const INSIGHTS = [
  { icon:'💡', text:"Bellingham's box-to-box dynamism perfectly suits Barcelona's high-tempo positional play." },
  { icon:'✓',  text:"His progressive passing and intelligent runs match the team's chance creation patterns." },
  { icon:'△',  text:"Could become a top-3 performing midfielder in this system." },
];
const RECENT = [
  { name:'Jude Bellingham', pct:86, sub:'Real Madrid',      img:'/assets/players/jude-bellingham.jpg' },
  { name:'Pedri',           pct:84, sub:'FC Barcelona',     img:'/assets/players/pedri.jpg' },
  { name:'Florian Wirtz',   pct:82, sub:'Bayer Leverkusen', img:'/assets/players/florian-wirtz.jpg' },
];

/* Circular club crest badge */
function Crest({ abbr, bg, fg, ring, size = 28 }) {
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={r} cy={r} r={r - 1} fill={bg} stroke={ring || bg} strokeWidth="1.5" strokeOpacity="0.6" />
      <circle cx={r} cy={r} r={r * 0.62} fill="rgba(0,0,0,.25)" />
      <text x={r} y={r + r * 0.22} textAnchor="middle" fill={fg}
        fontSize={size < 32 ? 7 : 9} fontWeight="900"
        fontFamily="'Barlow Condensed',sans-serif" letterSpacing=".04em">
        {abbr}
      </text>
    </svg>
  );
}

/* Dots meter */
function Dots({ val, total = 10 }) {
  return (
    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: 2, flexShrink: 0,
          background: i < Math.round(val / 10) ? '#A6FF00' : 'rgba(255,255,255,.08)',
        }} />
      ))}
    </div>
  );
}

/* Fit score ring */
function FitRing({ pct }) {
  const r = 46, circ = 2 * Math.PI * r, fill = circ * (pct / 100);
  return (
    <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
      <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(166,255,0,.08)" strokeWidth="8" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#A6FF00" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={`${fill} ${circ}`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <span style={{ font: '900 26px/1 "Barlow Condensed"', color: '#A6FF00' }}>{pct}%</span>
        <span style={{ font: '700 8px/1 "Barlow"', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)' }}>FIT SCORE</span>
        <span style={{ font: '700 10px/1 "Barlow"', color: '#A6FF00', marginTop: 2 }}>Excellent Fit</span>
      </div>
    </div>
  );
}

/* Metric circle */
function MetricRing({ val, label, grade }) {
  const r = 28, circ = 2 * Math.PI * r, fill = circ * (val / 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{ position: 'relative', width: 70, height: 70 }}>
        <svg width="70" height="70" viewBox="0 0 70 70" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="35" cy="35" r={r} fill="none" stroke="rgba(166,255,0,.08)" strokeWidth="6" />
          <circle cx="35" cy="35" r={r} fill="none" stroke="#A6FF00" strokeWidth="6"
            strokeLinecap="round" strokeDasharray={`${fill} ${circ}`} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ font: '900 18px/1 "Barlow Condensed"', color: '#A6FF00' }}>{val}</span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ font: '600 8px/1.4 "Barlow"', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', whiteSpace: 'pre-line' }}>{label}</div>
        <div style={{ font: '700 9px/1 "Barlow"', color: grade === 'Excellent' ? '#A6FF00' : grade === 'Very Good' ? '#A6FF00' : '#F5C84B', marginTop: 3 }}>{grade}</div>
      </div>
    </div>
  );
}

/* Body silhouette for Role Fit Pulse */
function BodySilhouette() {
  return (
    <svg width="32" height="80" viewBox="0 0 32 80" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="16" cy="7" r="5.5" fill="none" stroke="rgba(166,255,0,.7)" strokeWidth="1.5" />
      <line x1="16" y1="12.5" x2="16" y2="18" stroke="rgba(166,255,0,.5)" strokeWidth="1.5" />
      <line x1="5" y1="21" x2="27" y2="21" stroke="rgba(166,255,0,.7)" strokeWidth="1.5" />
      <line x1="16" y1="21" x2="16" y2="43" stroke="rgba(166,255,0,.7)" strokeWidth="1.5" />
      <line x1="5" y1="21" x2="3" y2="38" stroke="rgba(166,255,0,.5)" strokeWidth="1.5" />
      <line x1="27" y1="21" x2="29" y2="38" stroke="rgba(166,255,0,.5)" strokeWidth="1.5" />
      <line x1="9" y1="43" x2="23" y2="43" stroke="rgba(166,255,0,.6)" strokeWidth="1.5" />
      <line x1="11" y1="43" x2="9" y2="62" stroke="rgba(166,255,0,.5)" strokeWidth="1.5" />
      <line x1="9" y1="62" x2="7" y2="77" stroke="rgba(166,255,0,.35)" strokeWidth="1.5" />
      <line x1="21" y1="43" x2="23" y2="62" stroke="rgba(166,255,0,.5)" strokeWidth="1.5" />
      <line x1="23" y1="62" x2="25" y2="77" stroke="rgba(166,255,0,.35)" strokeWidth="1.5" />
      <circle cx="16" cy="21" r="2.5" fill="#A6FF00" opacity="0.85" />
      <circle cx="16" cy="43" r="2"   fill="#A6FF00" opacity="0.7"  />
      <circle cx="5"  cy="21" r="1.5" fill="#A6FF00" opacity="0.5"  />
      <circle cx="27" cy="21" r="1.5" fill="#A6FF00" opacity="0.5"  />
      <circle cx="9"  cy="62" r="1.5" fill="#A6FF00" opacity="0.4"  />
      <circle cx="23" cy="62" r="1.5" fill="#A6FF00" opacity="0.4"  />
    </svg>
  );
}

/* Top-down football pitch with position heatmap */
function TacticalPitch() {
  return (
    <svg viewBox="0 0 300 175" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <radialGradient id="posGlow" cx="66%" cy="47%" r="22%">
          <stop offset="0%"   stopColor="#A6FF00" stopOpacity="0.65" />
          <stop offset="45%"  stopColor="#A6FF00" stopOpacity="0.2"  />
          <stop offset="100%" stopColor="#A6FF00" stopOpacity="0"    />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="300" height="175" fill="#050607" />
      {/* Alternating grass stripes */}
      {[0,1,2,3,4,5,6,7,8,9].map(i => (
        <rect key={i} x={i * 30} y="0" width="15" height="175" fill="rgba(255,255,255,.012)" />
      ))}
      {/* Pitch border */}
      <rect x="7" y="7" width="286" height="161" fill="none" stroke="rgba(166,255,0,.45)" strokeWidth="1.2" />
      {/* Halfway */}
      <line x1="150" y1="7" x2="150" y2="168" stroke="rgba(166,255,0,.3)" strokeWidth="1" />
      {/* Centre circle */}
      <circle cx="150" cy="87.5" r="34" fill="none" stroke="rgba(166,255,0,.28)" strokeWidth="1" />
      <circle cx="150" cy="87.5" r="2"  fill="rgba(166,255,0,.5)" />
      {/* Left penalty box */}
      <rect x="7" y="52" width="50" height="71" fill="none" stroke="rgba(166,255,0,.3)" strokeWidth="1" />
      {/* Left goal box */}
      <rect x="7" y="68" width="20" height="39" fill="none" stroke="rgba(166,255,0,.22)" strokeWidth="1" />
      {/* Left penalty arc */}
      <path d="M 57 67 A 26 26 0 0 1 57 108" fill="none" stroke="rgba(166,255,0,.2)" strokeWidth="1" />
      {/* Right penalty box */}
      <rect x="243" y="52" width="50" height="71" fill="none" stroke="rgba(166,255,0,.3)" strokeWidth="1" />
      {/* Right goal box */}
      <rect x="273" y="68" width="20" height="39" fill="none" stroke="rgba(166,255,0,.22)" strokeWidth="1" />
      {/* Right penalty arc */}
      <path d="M 243 67 A 26 26 0 0 0 243 108" fill="none" stroke="rgba(166,255,0,.2)" strokeWidth="1" />
      {/* Position heatmap — Advanced Midfielder (right of centre, attacking third) */}
      <ellipse cx="197" cy="84" rx="44" ry="36" fill="url(#posGlow)" />
      {/* Player dot */}
      <circle cx="197" cy="84" r="5.5" fill="#A6FF00" />
      <circle cx="197" cy="84" r="10"  fill="none" stroke="#A6FF00" strokeWidth="1"   strokeOpacity="0.45" />
      <circle cx="197" cy="84" r="16"  fill="none" stroke="#A6FF00" strokeWidth="0.5" strokeOpacity="0.2"  />
    </svg>
  );
}

const T = {
  page:    { display:'grid', gridTemplateColumns:'240px 1fr 290px', gap:0, minHeight:'calc(100vh - 54px)', maxWidth:'100%' },
  sidebar: { borderRight:'1px solid rgba(255,255,255,.08)', padding:'14px 0', display:'flex', flexDirection:'column', background:'#090C0F', overflowY:'auto' },
  main:    { padding:'16px', display:'flex', flexDirection:'column', gap:12, background:'transparent', overflowY:'auto' },
  right:   { borderLeft:'1px solid rgba(255,255,255,.08)', padding:'14px 12px', display:'flex', flexDirection:'column', gap:14, background:'#090C0F', overflowY:'auto' },
  card:    { border:'1px solid rgba(255,255,255,.09)', borderRadius:10, background:'#0B0F13', overflow:'hidden' },
  head:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,.07)' },
  h3:      { font:'800 12px/1 "Barlow Condensed"', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(255,255,255,.75)' },
  label:   { font:'600 11px/1 "Barlow"', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(255,255,255,.38)' },
  limeBtn: { font:'600 11px/1 "Barlow"', letterSpacing:'.08em', textTransform:'uppercase', color:'#A6FF00', opacity:.8, cursor:'pointer', background:'none', border:'none' },
  div:     { height:1, background:'rgba(255,255,255,.07)' },
};

export default function SystemFit() {
  const [tab, setTab] = useState('Team Search');

  return (
    <div style={T.page}>

      {/* ═══ LEFT SIDEBAR ═══ */}
      <div style={T.sidebar}>
        {/* Search tabs */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', borderBottom:'1px solid rgba(255,255,255,.07)', marginBottom:12 }}>
          {['Team Search','Player Search'].map(t => (
            <button key={t} type="button" onClick={() => setTab(t)} style={{
              padding:'10px 8px', textAlign:'center', background:'none', border:'none',
              font:'700 10px/1 "Barlow"', letterSpacing:'.1em', textTransform:'uppercase',
              color: tab === t ? '#A6FF00' : 'rgba(255,255,255,.38)',
              borderBottom: `2px solid ${tab === t ? '#A6FF00' : 'transparent'}`,
            }}>{t}</button>
          ))}
        </div>

        {/* Search */}
        <div style={{ display:'flex', alignItems:'center', gap:6, margin:'0 12px 12px', padding:'0 10px', height:34, background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', borderRadius:6 }}>
          <Search size={13} color="rgba(255,255,255,.3)" />
          <input placeholder="Search for a club..." style={{ flex:1, background:'none', color:'rgba(255,255,255,.6)', font:'400 12px/1 "Barlow"' }} />
        </div>

        {/* Club result */}
        <div style={{ margin:'0 12px 12px', padding:'10px', border:'1px solid rgba(166,255,0,.25)', borderRadius:8, background:'rgba(166,255,0,.03)', cursor:'pointer' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Crest abbr="FCB" bg="#a50044" fg="#ffd700" ring="#ffd700" size={34} />
            <div>
              <div style={{ font:'700 13px/1 "Barlow"', color:'#A6FF00' }}>FC Barcelona</div>
              <div style={{ font:'500 10px/1 "Barlow"', color:'rgba(255,255,255,.4)', marginTop:3 }}>🇪🇸 LaLiga · SPAIN</div>
              <div style={{ font:'600 10px/1 "Barlow"', color:'rgba(255,255,255,.45)', marginTop:2 }}>4-3-3 Possession</div>
            </div>
          </div>
        </div>

        {/* System profile */}
        <div style={{ ...T.card, margin:'0 12px 12px' }}>
          <div style={T.head}><span style={T.label}>System Profile</span></div>
          <div style={{ padding:'12px', display:'flex', alignItems:'center', gap:10 }}>
            <svg width="76" height="76" viewBox="0 0 120 120" style={{ flexShrink:0 }}>
              <polygon fill="none" stroke="rgba(166,255,0,.2)" strokeWidth="1.5" points="60,8 105,34 105,86 60,112 15,86 15,34" />
              {[[60,8],[105,34],[105,86],[60,112],[15,86],[15,34]].map(([x,y],i) => (
                <line key={i} stroke="rgba(166,255,0,.1)" strokeWidth="1" x1="60" y1="60" x2={x} y2={y} />
              ))}
              <polygon fill="rgba(166,255,0,.2)" stroke="#A6FF00" strokeWidth="1.5" points="60,22 92,46 84,78 60,90 28,76 35,44" />
            </svg>
            <div>
              <div style={{ font:'900 24px/1 "Barlow Condensed"', color:'#A6FF00' }}>86%</div>
              <div style={T.label}>System Compatibility</div>
            </div>
          </div>
          {[['Philosophy','Positional Play'],['Balance','82/100'],['Intensity','High'],['Line Height','High']].map(([l,v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'6px 12px', borderTop:'1px solid rgba(255,255,255,.06)', font:'500 11px/1 "Barlow"' }}>
              <span style={{ color:'rgba(255,255,255,.4)' }}>{l}</span>
              <span style={{ fontWeight:700 }}>{v}</span>
            </div>
          ))}
          <button type="button" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, width:'100%', padding:'10px', borderTop:'1px solid rgba(255,255,255,.07)', font:'700 10px/1 "Barlow"', letterSpacing:'.12em', textTransform:'uppercase', color:'#A6FF00', background:'none', border:'none', cursor:'pointer' }}>
            VIEW FULL SYSTEM BREAKDOWN <ArrowRight size={11} />
          </button>
        </div>

        {/* Compare list */}
        <div style={{ padding:'0 12px', marginBottom:4 }}>
          <div style={{ ...T.label, display:'block', marginBottom:8 }}>Compare with Other Systems</div>
          {[['Real Madrid','4-3-1-2',83,'RM','#00529f','#ffd700'],['Manchester City','4-3-3',81,'MC','#6cabdd','#1c2c5b'],['Arsenal','4-3-3',79,'ARS','#ef0107','#fff'],['Bayern München','4-2-3-1',78,'FCB','#dc052d','#fff'],['Liverpool','4-3-3',76,'LFC','#c8102e','#fff']].map(([t,f,p,abbr,bg,fg]) => (
            <div key={t} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,.05)', cursor:'pointer' }}>
              <Crest abbr={abbr} bg={bg} fg={fg} size={22} />
              <span style={{ flex:1, font:'600 12px/1 "Barlow"', color:'rgba(255,255,255,.7)' }}>{t}</span>
              <span style={{ font:'500 10px/1 "Barlow"', color:'rgba(255,255,255,.35)' }}>{f}</span>
              <span style={{ font:'800 13px/1 "Barlow Condensed"', color:'#A6FF00', width:36, textAlign:'right' }}>{p}%</span>
            </div>
          ))}
          <button type="button" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, width:'100%', padding:'10px 0', font:'700 10px/1 "Barlow"', letterSpacing:'.12em', textTransform:'uppercase', color:'#A6FF00', background:'none', border:'none', cursor:'pointer' }}>
            COMPARE MULTIPLE SYSTEMS <ArrowRight size={11} />
          </button>
        </div>

        {/* Recently viewed */}
        <div style={{ padding:'0 12px' }}>
          <div style={{ ...T.label, display:'block', padding:'10px 0 8px' }}>Recently Viewed</div>
          {RECENT.map(r => (
            <div key={r.name} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,.06)', cursor:'pointer' }}>
              <img src={r.img} alt={r.name} style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', objectPosition:'50% 25%', border:'1px solid rgba(255,255,255,.1)', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ font:'700 12px/1 "Barlow"', color:'rgba(255,255,255,.8)' }}>{r.name}</div>
                <div style={{ font:'500 10px/1 "Barlow"', color:'rgba(255,255,255,.38)', marginTop:2 }}>{r.sub}</div>
              </div>
              <div style={{ font:'800 13px/1 "Barlow Condensed"', color:'#A6FF00' }}>{r.pct}%</div>
            </div>
          ))}
          <button type="button" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, width:'100%', padding:'10px 0', font:'700 10px/1 "Barlow"', letterSpacing:'.12em', textTransform:'uppercase', color:'#A6FF00', background:'none', border:'none', cursor:'pointer' }}>
            VIEW ALL HISTORY <ArrowRight size={11} />
          </button>
        </div>
      </div>

      {/* ═══ MAIN ═══ */}
      <div style={T.main}>

        {/* Player hero */}
        <div style={T.card}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,.07)' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                <span style={T.label}>Player to System Fit</span>
                <span style={{ background:'rgba(166,255,0,.12)', border:'1px solid rgba(166,255,0,.3)', borderRadius:3, padding:'2px 7px', font:'700 8px/1 "Barlow"', letterSpacing:'.14em', textTransform:'uppercase', color:'#A6FF00' }}>AI Calculated</span>
              </div>
              <div style={{ font:'900 22px/1 "Barlow Condensed"', letterSpacing:'.04em', textTransform:'uppercase', color:'#fff' }}>Jude Bellingham</div>
              <div style={{ font:'500 11px/1 "Barlow"', color:'rgba(255,255,255,.45)', marginTop:3 }}>CM · Age 21 · Real Madrid</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {['Share','Add to Watchlist'].map(l => (
                <button key={l} type="button" style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', border:'1px solid rgba(255,255,255,.08)', borderRadius:5, font:'700 10px/1 "Barlow"', letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.5)', background:'none', cursor:'pointer' }}>
                  {l === 'Share' ? <Share2 size={11}/> : <Star size={11}/>} {l}
                </button>
              ))}
            </div>
          </div>

          {/* Body: photo (no name overlay) + ring + breakdown */}
          <div style={{ display:'grid', gridTemplateColumns:'170px 1fr', minHeight:220 }}>
            <div style={{ position:'relative', overflow:'hidden', background:'#050607' }}>
              {/* Black cover at top hides the "VOTES" text baked into the photo file */}
              <div style={{ position:'absolute', top:0, left:0, right:0, height:'24%', background:'#050607', zIndex:3 }} />
              {/* Gradient fade at bottom */}
              <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'20%', background:'linear-gradient(to top,#0B0F13,transparent)', zIndex:3 }} />
              <img
                src="/assets/players/jude-bellingham.jpg"
                alt="Bellingham"
                style={{
                  width:'100%', height:'130%', marginTop:'-8%',
                  objectFit:'cover', objectPosition:'50% 40%',
                  maskImage:'linear-gradient(to right, rgba(0,0,0,1) 60%, transparent 100%)',
                  WebkitMaskImage:'linear-gradient(to right, rgba(0,0,0,1) 60%, transparent 100%)',
                }}
              />
            </div>
            <div style={{ padding:'16px 20px', display:'flex', gap:16, alignItems:'flex-start' }}>
              <FitRing pct={86} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ ...T.label, display:'block', marginBottom:10 }}>Fit Breakdown</div>
                {BREAKDOWN.map(b => (
                  <div key={b.label} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                    <span style={{ font:'500 11px/1 "Barlow"', color:'rgba(255,255,255,.55)', width:165, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.label}</span>
                    <div style={{ flex:1, display:'flex' }}><Dots val={b.val} /></div>
                    <span style={{ font:'800 13px/1 "Barlow Condensed"', color:'#A6FF00', width:26, textAlign:'right', flexShrink:0 }}>{b.val}</span>
                  </div>
                ))}
                <div style={{ font:'500 10px/1 "Barlow"', color:'rgba(255,255,255,.3)', marginTop:8 }}>🏆 Top 6% of CMs in World Football</div>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,.07)' }}>
            {['DETAILED ANALYSIS','PLAYER REPORT','COMPARE'].map(l => (
              <button key={l} type="button" style={{ flex:1, padding:'10px', border:'1px solid rgba(255,255,255,.08)', borderRadius:5, font:'700 10px/1 "Barlow"', letterSpacing:'.1em', textTransform:'uppercase', color:'#A6FF00', background:'none', cursor:'pointer' }}>
                {l} <ArrowRight size={11} style={{ verticalAlign:'middle' }} />
              </button>
            ))}
          </div>
        </div>

        {/* Alt system fits */}
        <div style={T.card}>
          <div style={T.head}>
            <span style={T.h3}>Alternative System Fits</span>
            <button style={T.limeBtn}>VIEW ALL <ArrowRight size={10} style={{ verticalAlign:'middle' }} /></button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:'rgba(255,255,255,.06)' }}>
            {ALT_FITS.map(f => (
              <div key={f.name} style={{ background:'#0B0F13', padding:'14px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:7 }}>
                <Crest abbr={f.abbr} bg={f.bg} fg={f.fg} ring={f.ring} size={44} />
                <div>
                  <div style={{ font:'800 11px/1 "Barlow"', letterSpacing:'.04em', textTransform:'uppercase' }}>{f.name}</div>
                  <div style={{ font:'600 9px/1 "Barlow"', letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.38)', marginTop:2 }}>{f.fmt}</div>
                </div>
                <svg width="62" height="62" viewBox="0 0 120 120">
                  <polygon fill="none" stroke="rgba(166,255,0,.2)" strokeWidth="1.5" points="60,8 105,34 105,86 60,112 15,86 15,34" />
                  {[[60,8],[105,34],[105,86],[60,112],[15,86],[15,34]].map(([x,y],i) => (
                    <line key={i} stroke="rgba(166,255,0,.1)" x1="60" y1="60" x2={x} y2={y} />
                  ))}
                  <polygon fill="rgba(166,255,0,.2)" stroke="#A6FF00" strokeWidth="2" points={
                    f.pct > 82 ? "60,20 94,44 86,80 60,92 26,78 33,42" :
                    f.pct > 80 ? "60,22 92,46 82,78 60,90 28,76 36,44" :
                    "60,24 90,48 80,79 60,90 30,76 38,46"
                  } />
                </svg>
                <div style={{ font:'900 22px/1 "Barlow Condensed"', color:'#A6FF00' }}>{f.pct}%</div>
                <div style={{ font:'700 9px/1 "Barlow"', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.35)' }}>Fit Score</div>
                <div style={{ font:'600 10px/1 "Barlow"', color: f.verdict.includes('Very') ? '#A6FF00' : '#F5C84B' }}>{f.verdict}</div>
                <button type="button" style={{ width:'100%', padding:'7px', border:'1px solid rgba(255,255,255,.08)', borderRadius:5, font:'700 9px/1 "Barlow"', letterSpacing:'.08em', textTransform:'uppercase', color:'#A6FF00', background:'none', cursor:'pointer' }}>
                  VIEW ANALYSIS <ArrowRight size={9} style={{ verticalAlign:'middle' }} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Role Fit Pulse + Key Metrics */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={T.card}>
            <div style={T.head}><span style={T.h3}>Role Fit Pulse</span></div>
            <div style={{ padding:'14px', display:'flex', gap:12, alignItems:'flex-start' }}>
              <BodySilhouette />
              <div style={{ flex:1, minWidth:0 }}>
                {ROLE_PULSE.map(r => (
                  <div key={r.label} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                    <span style={{ font:'500 11px/1 "Barlow"', color:'rgba(255,255,255,.5)', width:158, flexShrink:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.label}</span>
                    <div style={{ flex:1, display:'flex' }}><Dots val={r.val} /></div>
                    <span style={{ font:'800 12px/1 "Barlow Condensed"', color:'#A6FF00', width:22, textAlign:'right', flexShrink:0 }}>{r.val}</span>
                  </div>
                ))}
                <div style={{ display:'flex', gap:12, marginTop:8, font:'500 9px/1 "Barlow"', color:'rgba(255,255,255,.3)' }}>
                  <span>● Excellent</span><span>● Good</span><span>● Average</span>
                </div>
              </div>
            </div>
          </div>

          <div style={T.card}>
            <div style={T.head}><span style={T.h3}>Key System Metrics</span></div>
            <div style={{ padding:'16px', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
              {KEY_METRICS.map(m => <MetricRing key={m.label} val={m.val} label={m.label} grade={m.grade} />)}
            </div>
            <button type="button" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, width:'100%', padding:'10px', borderTop:'1px solid rgba(255,255,255,.07)', font:'700 10px/1 "Barlow"', letterSpacing:'.1em', textTransform:'uppercase', color:'#A6FF00', background:'none', border:'none', cursor:'pointer' }}>
              VIEW ALL METRICS <ArrowRight size={11} />
            </button>
          </div>
        </div>

        {/* Recent match impact */}
        <div style={T.card}>
          <div style={T.head}>
            <span style={T.h3}>Recent Match Impact in This System</span>
            <button style={T.limeBtn}>View match log <ArrowRight size={10} style={{ verticalAlign:'middle' }} /></button>
          </div>
          <div style={{ display:'flex', gap:8, padding:'12px' }}>
            {[{r:'W',s:'3-0',vs:'vs Atletico Madrid',rt:8.6},{r:'W',s:'4-1',vs:'vs Girona FC',rt:8.2},{r:'W',s:'2-1',vs:'vs Real Sociedad',rt:7.8},{r:'W',s:'5-0',vs:'vs Real Betis',rt:8.9}].map((m,i) => (
              <div key={i} style={{ flex:1, border:'1px solid rgba(255,255,255,.07)', borderRadius:6, padding:'10px', background:'rgba(0,0,0,.3)', display:'flex', flexDirection:'column', gap:4 }}>
                <span style={{ font:'800 11px/1 "Barlow"', color:'#A6FF00', padding:'2px 5px', background:'rgba(166,255,0,.12)', borderRadius:3, width:'fit-content' }}>{m.r} {m.s}</span>
                <span style={{ font:'500 10px/1 "Barlow"', color:'rgba(255,255,255,.4)', marginTop:2 }}>{m.vs}</span>
                <span style={{ font:'900 16px/1 "Barlow Condensed"', color:'#A6FF00' }}>Rating {m.rt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ RIGHT ═══ */}
      <div style={T.right}>
        {/* Tactical Role Analysis */}
        <div style={T.card}>
          <div style={T.head}><span style={T.h3}>Tactical Role Analysis</span></div>
          <div style={{ padding:'14px' }}>
            <div style={{ font:'700 9px/1 "Barlow"', letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(255,255,255,.3)', marginBottom:4 }}>Primary Role Fit</div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
              <span style={{ font:'800 15px/1 "Barlow"', color:'#A6FF00' }}>Advanced Midfielder</span>
              <span style={{ font:'900 20px/1 "Barlow Condensed"', color:'#A6FF00' }}>90%</span>
            </div>
            <div style={{ font:'400 11px/1.5 "Barlow"', color:'rgba(255,255,255,.4)', marginBottom:12 }}>Links midfield and attack, late box arrivals, chance creation.</div>
            <div style={{ width:'100%', height:140, borderRadius:8, overflow:'hidden', border:'1px solid rgba(166,255,0,.2)', marginBottom:12 }}>
              <TacticalPitch />
            </div>
            <div style={{ font:'700 9px/1 "Barlow"', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(255,255,255,.3)', marginBottom:8 }}>Other Suitable Roles</div>
            {[['Central Midfielder (B2B)',85],['Roaming Playmaker',82],['Deep-Lying Playmaker',74]].map(([r,p]) => (
              <div key={r} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderTop:'1px solid rgba(255,255,255,.06)', font:'600 11px/1 "Barlow"' }}>
                <span style={{ color:'rgba(255,255,255,.55)' }}>{r}</span>
                <span style={{ font:'700 12px/1 "Barlow Condensed"', color:'#A6FF00' }}>{p}%</span>
              </div>
            ))}
            <button type="button" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, width:'100%', padding:'9px', border:'1px solid rgba(255,255,255,.07)', borderRadius:5, marginTop:10, font:'700 9px/1 "Barlow"', letterSpacing:'.1em', textTransform:'uppercase', color:'#A6FF00', background:'none', cursor:'pointer' }}>
              VIEW TACTICAL ROLE MAP <ArrowRight size={10} />
            </button>
          </div>
        </div>

        {/* Best Fit */}
        <div style={T.card}>
          <div style={T.head}>
            <span style={T.h3}>Best Fit Recommendations</span>
            <span style={{ font:'700 9px/1 "Barlow"', letterSpacing:'.08em', textTransform:'uppercase', color:'#A6FF00', display:'flex', alignItems:'center', gap:3 }}>AI Powered ✦</span>
          </div>
          <div style={{ padding:'0 14px' }}>
            {BEST_FITS.map(f => (
              <div key={f.rank} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                <span style={{ font:'900 14px/1 "Barlow Condensed"', color:'rgba(255,255,255,.22)', width:16, flexShrink:0 }}>{f.rank}</span>
                <Crest abbr={f.abbr} bg={f.bg} fg={f.fg} size={26} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ font:'700 12px/1 "Barlow"', color:'rgba(255,255,255,.8)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.club}</div>
                  <div style={{ font:'600 9px/1 "Barlow"', letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.32)', marginTop:2 }}>{f.fmt}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ font:'900 14px/1 "Barlow Condensed"', color:'#A6FF00' }}>{f.pct}%</div>
                  <div style={{ font:'600 9px/1 "Barlow"', letterSpacing:'.06em', textTransform:'uppercase', color:f.clr, marginTop:1 }}>{f.verdict}</div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, width:'100%', padding:'10px', borderTop:'1px solid rgba(255,255,255,.07)', font:'700 9px/1 "Barlow"', letterSpacing:'.1em', textTransform:'uppercase', color:'#A6FF00', background:'none', border:'none', cursor:'pointer' }}>
            VIEW FULL RANKINGS <ArrowRight size={10} />
          </button>
        </div>

        {/* System Fit Insights */}
        <div style={T.card}>
          <div style={T.head}><span style={T.h3}>System Fit Insights</span></div>
          <div style={{ padding:'0 14px' }}>
            {INSIGHTS.map((ins,i) => (
              <div key={i} style={{ display:'flex', gap:8, padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,.06)', font:'400 11px/1.6 "Barlow"', color:'rgba(255,255,255,.5)' }}>
                <span style={{ flexShrink:0, marginTop:1 }}>{ins.icon}</span>
                <span>{ins.text}</span>
              </div>
            ))}
          </div>
          <button type="button" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, width:'100%', padding:'10px', borderTop:'1px solid rgba(255,255,255,.07)', font:'700 9px/1 "Barlow"', letterSpacing:'.1em', textTransform:'uppercase', color:'#A6FF00', background:'none', border:'none', cursor:'pointer' }}>
            VIEW FULL INSIGHTS <ArrowRight size={10} />
          </button>
        </div>

        {/* Founder strip */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px', border:'1px solid rgba(166,255,0,.22)', borderRadius:8, background:'rgba(166,255,0,.03)' }}>
          <Crown size={18} style={{ color:'#A6FF00', flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <div style={{ font:'700 12px/1 "Barlow"', letterSpacing:'.04em', textTransform:'uppercase', color:'#A6FF00' }}>World Cup Founder Pass</div>
            <div style={{ font:'400 10px/1.4 "Barlow"', color:'rgba(255,255,255,.4)', marginTop:3 }}>Unlock premium insights & exclusive World Cup content.</div>
          </div>
          <button type="button" onClick={() => navigateTo('/pricing')} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', background:'#A6FF00', color:'#050700', borderRadius:5, font:'800 10px/1 "Barlow"', letterSpacing:'.08em', textTransform:'uppercase', flexShrink:0, cursor:'pointer', border:'none' }}>
            EXPLORE <ArrowRight size={10} />
          </button>
        </div>
      </div>

    </div>
  );
}
