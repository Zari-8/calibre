import { useState } from 'react';
import { ArrowRight, Crown, Share2, Star } from 'lucide-react';
import { navigateTo } from '../components/NavLink.jsx';

const BREAKDOWN = [
  { label:'Tactical Role',        val:90 },
  { label:'Position Compatibility',val:88 },
  { label:'Playing Style Match',  val:85 },
  { label:'Team Chemistry',       val:84 },
  { label:'Physical Demands',     val:83 },
  { label:'Growth Potential',     val:87 },
];
const ALT_FITS = [
  { name:'Real Madrid',   formation:'4-3-1-2', pct:83, verdict:'Very Good Fit' },
  { name:'Manchester City',formation:'4-3-3',  pct:81, verdict:'Very Good Fit' },
  { name:'Arsenal',       formation:'4-3-3',   pct:79, verdict:'Good Fit' },
  { name:'Bayern München',formation:'4-2-3-1', pct:78, verdict:'Good Fit' },
];
const ROLE_PULSE = [
  { label:'Positioning',         val:92 },
  { label:'Decision Making',     val:91 },
  { label:'Link-Up Play',        val:87 },
  { label:'Final Third Impact',  val:86 },
  { label:'Press Resistance',    val:85 },
  { label:'Transition Contribution',val:83 },
];
const KEY_METRICS = [
  { label:'Ball Possession', val:92, grade:'Excellent' },
  { label:'Chance Creation', val:88, grade:'Very Good' },
  { label:'Pressing Involvement',val:84,grade:'Very Good' },
  { label:'Defensive Cover', val:81, grade:'Good' },
];
const BEST_FITS = [
  { rank:1, team:'FC Barcelona',   formation:'4-3-3 Possession', pct:86, verdict:'Excellent Fit',  cls:'excellent' },
  { rank:2, team:'Real Madrid',    formation:'4-3-1-2',          pct:83, verdict:'Very Good Fit',  cls:'good' },
  { rank:3, team:'Manchester City',formation:'4-3-3',            pct:81, verdict:'Very Good Fit',  cls:'good' },
  { rank:4, team:'Arsenal',        formation:'4-3-3',            pct:79, verdict:'Good Fit',       cls:'good' },
  { rank:5, team:'Bayern München', formation:'4-2-3-1',          pct:78, verdict:'Good Fit',       cls:'good' },
];
const INSIGHTS = [
  { icon:'💡', text:"Bellingham's box-to-box dynamism perfectly suits Barcelona's high-tempo positional play." },
  { icon:'✓',  text:"His progressive passing and intelligent runs match the team's chance creation patterns." },
  { icon:'△',  text:"Could become a top-3 performing midfielder in this system." },
];
const RECENT = [
  { name:'Jude Bellingham',  pct:86, club:'Real Madrid', img:'/assets/players/jude-bellingham.jpg' },
  { name:'Pedri',            pct:84, club:'FC Barcelona',img:'/assets/players/pedri.jpg' },
  { name:'Florian Wirtz',    pct:82, club:'Bayer Leverkusen',img:'/assets/players/florian-wirtz.jpg' },
];

function MiniRadar() {
  const axes  = [[40,4],[70,22],[70,58],[40,76],[10,58],[10,22]];
  const score = [[40,10],[64,28],[58,54],[40,68],[16,52],[22,28]];
  const pts   = a => a.map(([x,y])=>`${x},${y}`).join(' ');
  return (
    <svg viewBox="0 0 80 80" className="sf-sys-radar">
      <polygon fill="none" stroke="rgba(215,249,0,.25)" strokeWidth="1" points={pts(axes)}/>
      {axes.map(([x,y],i)=><line key={i} stroke="rgba(215,249,0,.12)" x1="40" y1="40" x2={x} y2={y}/>)}
      <polygon fill="rgba(215,249,0,.3)" stroke="var(--lime)" strokeWidth="1.5" points={pts(score)}/>
    </svg>
  );
}

function FitRing({ pct }) {
  const r = 50, circ = 2*Math.PI*r;
  const filled = circ * (pct/100);
  return (
    <div className="sf-fit-score-ring" style={{width:130,height:130}}>
      <svg className="sf-fit-score-svg" viewBox="0 0 120 120">
        <circle className="sf-fit-track" cx="60" cy="60" r={r}/>
        <circle className="sf-fit-fill" cx="60" cy="60" r={r} strokeDasharray={`${filled} ${circ}`}/>
      </svg>
      <div className="sf-fit-score-center">
        <div className="sf-fit-pct">{pct}%</div>
        <div className="sf-fit-label">Fit Score</div>
        <div className="sf-fit-verdict">Excellent Fit</div>
      </div>
    </div>
  );
}

export default function SystemFit() {
  const [searchTab, setSearchTab] = useState('Team Search');

  return (
    <div className="page" style={{paddingTop:16}}>
      <div className="sf-layout">
        {/* Left sidebar */}
        <div className="sf-sidebar">
          <div className="sf-search-tabs">
            {['Team Search','Player Search'].map(t=>(
              <div key={t} className={`sf-search-tab ${searchTab===t?'active':''}`} onClick={()=>setSearchTab(t)}>{t}</div>
            ))}
          </div>
          <input className="sf-search-input" type="text" placeholder="Search for a club..."/>

          {/* Club result */}
          <div className="sf-club-result">
            <span style={{fontSize:28}}>🔵</span>
            <div>
              <strong>FC Barcelona</strong>
              <span>🇪🇸 LaLiga &nbsp;·&nbsp; SPAIN</span>
              <div style={{marginTop:3}}><small>4-3-3 Possession</small></div>
            </div>
            <ArrowRight size={16} color="var(--lime)" style={{marginLeft:'auto'}}/>
          </div>

          {/* System profile */}
          <div className="sf-sys-profile">
            <div style={{font:'700 11px/1 "Barlow Condensed"',letterSpacing:'.12em',textTransform:'uppercase',color:'var(--text2)',marginBottom:10}}>System Profile</div>
            <div className="sf-sys-head">
              <MiniRadar/>
              <div className="sf-sys-meta">
                <strong>86%</strong>
                <div style={{font:'500 11px/1 "Barlow"',color:'var(--text2)'}}>System Compatibility</div>
              </div>
            </div>
            {[['Philosophy','Positional Play'],['Balance','82/100'],['Intensity','High'],['Line Height','High']].map(([l,v])=>(
              <div key={l} className="sf-sys-attr"><span>{l}</span><strong>{v}</strong></div>
            ))}
            <button className="btn btn--outline btn--sm" style={{width:'100%',marginTop:10}} type="button">VIEW FULL SYSTEM BREAKDOWN <ArrowRight size={13}/></button>
          </div>

          {/* Compare with other systems */}
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Compare with Other Systems</div></div>
            <div className="sf-compare-list">
              {[['Real Madrid','4-3-1-2',83],['Manchester City','4-3-3',81],['Arsenal','4-3-3',79],['Bayern München','4-2-3-1',78],['Liverpool','4-3-3',76]].map(([t,f,p])=>(
                <div key={t} className="sf-compare-row">
                  <span style={{fontSize:16}}>⚽</span>
                  <span style={{flex:1,font:'700 12px/1 "Barlow Condensed"'}}>{t}</span>
                  <small>{f}</small>
                  <span className="sf-compare-pct">{p}%</span>
                </div>
              ))}
            </div>
            <button className="btn btn--ghost btn--sm" style={{width:'100%',marginTop:8,justifyContent:'center'}} type="button">COMPARE MULTIPLE SYSTEMS <ArrowRight size={13}/></button>
          </div>

          {/* Recently viewed */}
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Recently Viewed</div></div>
            {RECENT.map(r=>(
              <div key={r.name} className="sf-recent-row">
                <img src={r.img} alt={r.name}/>
                <div className="sf-recent-info"><strong>{r.name}</strong><span>{r.club}</span></div>
                <div style={{textAlign:'right'}}>
                  <div className="sf-recent-pct">{r.pct}%</div>
                  <div className="sf-recent-label">Fit Score</div>
                </div>
              </div>
            ))}
            <button className="btn btn--ghost btn--sm" style={{width:'100%',marginTop:8,justifyContent:'center'}} type="button">VIEW ALL HISTORY <ArrowRight size={13}/></button>
          </div>
        </div>

        {/* Centre main panel */}
        <div className="sf-main">
          {/* Player hero */}
          <div className="sf-player-hero">
            <div className="panel-head" style={{padding:'14px 16px 0',marginBottom:0}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{font:'700 12px/1 "Barlow Condensed"',letterSpacing:'.1em',textTransform:'uppercase',color:'var(--text2)'}}>Player to System Fit</span>
                <div className="sf-ai-tag">AI Calculated</div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn--outline btn--sm" type="button"><Share2 size={12}/> Share</button>
                <button className="btn btn--outline btn--sm" type="button"><Star size={12}/> Add to Watchlist</button>
              </div>
            </div>

            <div className="sf-player-hero-inner">
              <div className="sf-player-img-wrap">
                <img className="sf-player-img" src="/assets/players/jude-bellingham.jpg" alt="Bellingham"/>
                <div className="sf-player-img-overlay"/>
              </div>
              <div className="sf-player-body">
                <div className="sf-player-name">Jude Bellingham</div>
                <div className="sf-player-meta">CM · Age 21 · Real Madrid</div>

                <div style={{display:'flex',alignItems:'flex-start',gap:20}}>
                  <div style={{flex:1}}>
                    <div style={{font:'600 10px/1 "Barlow Condensed"',color:'var(--text2)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:8}}>Fit Breakdown</div>
                    <div className="sf-breakdown">
                      {BREAKDOWN.map(b=>(
                        <div key={b.label} className="sf-breakdown-row">
                          <span>{b.label}</span>
                          <div className="sf-breakdown-dots">
                            {Array.from({length:10},(_,i)=>(
                              <div key={i} className={`sf-breakdown-dot ${i<Math.round(b.val/10)?'':'sf-breakdown-dot--empty'}`}/>
                            ))}
                          </div>
                          <span style={{font:'700 12px/1 "Barlow Condensed"',color:'var(--lime)',textAlign:'right'}}>{b.val}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{font:'500 11px/1 "Barlow"',color:'var(--text2)',marginTop:8}}>🏆 Top 6% of CMs in World Football</div>
                  </div>
                  <FitRing pct={86}/>
                </div>

                <div className="sf-actions">
                  <button className="btn btn--outline btn--sm" type="button">DETAILED ANALYSIS <ArrowRight size={12}/></button>
                  <button className="btn btn--outline btn--sm" type="button">PLAYER REPORT <ArrowRight size={12}/></button>
                  <button className="btn btn--outline btn--sm" type="button">COMPARE <ArrowRight size={12}/></button>
                </div>
              </div>
            </div>
          </div>

          {/* Alternative system fits */}
          <div className="panel" style={{marginBottom:12}}>
            <div className="panel-head">
              <div className="panel-title">Alternative System Fits</div>
              <a className="panel-action">View all <ArrowRight size={11} style={{verticalAlign:'middle'}}/></a>
            </div>
            <div className="sf-alt-grid">
              {ALT_FITS.map(f=>(
                <div key={f.name} className="sf-alt-card">
                  <span style={{fontSize:24,marginBottom:6,display:'block'}}>⚽</span>
                  <strong>{f.name}</strong>
                  <span>{f.formation}</span>
                  <div className="sf-alt-pct">{f.pct}%</div>
                  <div style={{font:'700 10px/1 "Barlow Condensed"',letterSpacing:'.06em',textTransform:'uppercase',marginBottom:6,color:'var(--text2)'}}>Fit Score</div>
                  <div className="sf-alt-verdict">{f.verdict}</div>
                  <button className="btn btn--ghost btn--sm" style={{width:'100%',marginTop:8,justifyContent:'center'}} type="button">VIEW ANALYSIS <ArrowRight size={11}/></button>
                </div>
              ))}
            </div>
          </div>

          {/* Role Pulse + Key Metrics */}
          <div className="sf-lower-grid">
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Role Fit Pulse</div></div>
              <div style={{display:'flex',gap:14,alignItems:'center'}}>
                <div style={{fontSize:32,flexShrink:0}}>🧍</div>
                <div style={{flex:1}}>
                  {ROLE_PULSE.map(r=>(
                    <div key={r.label} style={{display:'grid',gridTemplateColumns:'1fr auto 80px',alignItems:'center',gap:8,marginBottom:5,font:'500 11px/1 "Barlow"',color:'var(--text2)'}}>
                      <span>{r.label}</span>
                      <div style={{display:'flex',gap:2}}>
                        {Array.from({length:10},(_,i)=>(
                          <div key={i} style={{width:7,height:7,borderRadius:2,background:i<Math.round(r.val/10)?'var(--lime)':'rgba(215,249,0,.12)'}}/>
                        ))}
                      </div>
                      <span style={{font:'700 12px/1 "Barlow Condensed"',color:'var(--lime)',textAlign:'right'}}>{r.val}</span>
                    </div>
                  ))}
                  <div style={{display:'flex',gap:12,marginTop:8,font:'600 10px/1 "Barlow"',color:'var(--text3)'}}>
                    <span>● Excellent</span><span>● Good</span><span>● Average</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><div className="panel-title">Key System Metrics</div></div>
              <div className="sf-metrics-grid">
                {KEY_METRICS.map(m=>(
                  <div key={m.label} style={{textAlign:'center'}}>
                    <div className="sf-metric-circle" style={{margin:'0 auto 6px'}}>
                      <div className="sf-metric-val">{m.val}</div>
                      <div className="sf-metric-label">{m.label.split(' ')[0]}<br/>{m.label.split(' ').slice(1).join(' ')}</div>
                    </div>
                    <div className="sf-metric-grade">{m.grade}</div>
                  </div>
                ))}
              </div>
              <button className="btn btn--ghost btn--sm" style={{width:'100%',marginTop:10,justifyContent:'center'}} type="button">VIEW ALL METRICS <ArrowRight size={13}/></button>
            </div>
          </div>

          {/* Match log */}
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Recent Match Impact in This System</div><a className="panel-action">View match log <ArrowRight size={11} style={{verticalAlign:'middle'}}/></a></div>
            <div className="sf-match-log">
              {[{res:'W',score:'3-0',vs:'vs Atletico Madrid',rating:8.6},{res:'W',score:'4-1',vs:'vs Girona FC',rating:8.2},{res:'W',score:'2-1',vs:'vs Real Sociedad',rating:7.8},{res:'W',score:'5-0',vs:'vs Real Betis',rating:8.9}].map((m,i)=>(
                <div key={i} className="sf-match-row" style={{flex:1,flexDirection:'column',alignItems:'flex-start',gap:4}}>
                  <span className={`sf-match-result sf-match-result--${m.res}`}>{m.res} {m.score}</span>
                  <span style={{font:'500 10px/1 "Barlow"',color:'var(--text2)'}}>{m.vs}</span>
                  <span style={{font:'700 14px/1 "Barlow Condensed"',color:'var(--lime)'}}>Rating {m.rating}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div className="sf-right">
          {/* Tactical role */}
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Tactical Role Analysis</div></div>
            <div style={{font:'600 10px/1 "Barlow Condensed"',color:'var(--text2)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:4}}>Primary Role Fit</div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
              <div className="sf-primary-role-name">Advanced Midfielder</div>
              <div className="sf-primary-role-pct">90%</div>
            </div>
            <div className="sf-primary-role-desc">Links midfield and attack, late box arrivals, chance creation.</div>
            <div className="sf-pitch">
              <svg viewBox="0 0 200 120" className="sf-pitch-lines" style={{width:'100%',height:'100%'}}>
                <rect x="1" y="1" width="198" height="118" fill="none" stroke="rgba(21,196,90,.3)" strokeWidth="1"/>
                <line x1="100" y1="1" x2="100" y2="119" stroke="rgba(21,196,90,.2)" strokeWidth="1"/>
                <circle cx="100" cy="60" r="20" fill="none" stroke="rgba(21,196,90,.2)" strokeWidth="1"/>
                <rect x="1" y="40" width="25" height="40" fill="none" stroke="rgba(21,196,90,.2)" strokeWidth="1"/>
                <rect x="174" y="40" width="25" height="40" fill="none" stroke="rgba(21,196,90,.2)" strokeWidth="1"/>
                <circle cx="140" cy="55" r="5" fill="var(--lime)" opacity=".9"/>
              </svg>
            </div>
            <div style={{marginTop:12}}>
              <div style={{font:'600 10px/1 "Barlow Condensed"',color:'var(--text2)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:8}}>Other Suitable Roles</div>
              {[['Central Midfielder (B2B)',85],['Roaming Playmaker',82],['Deep-Lying Playmaker',74]].map(([r,p])=>(
                <div key={r} style={{display:'flex',justifyContent:'space-between',font:'700 12px/1 "Barlow Condensed"',color:'var(--text2)',padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
                  <span>{r}</span><span style={{color:'var(--lime)'}}>{p}%</span>
                </div>
              ))}
            </div>
            <button className="btn btn--ghost btn--sm" style={{width:'100%',marginTop:10,justifyContent:'center'}} type="button">VIEW TACTICAL ROLE MAP <ArrowRight size={13}/></button>
          </div>

          {/* Best fit recommendations */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Best Fit Recommendations</div>
              <span style={{display:'flex',alignItems:'center',gap:4,font:'700 9px/1 "Barlow Condensed"',color:'var(--lime)',letterSpacing:'.08em',textTransform:'uppercase'}}>AI Powered ✦</span>
            </div>
            <div className="sf-best-list">
              {BEST_FITS.map(f=>(
                <div key={f.rank} className="sf-best-row">
                  <div className="sf-best-rank">{f.rank}</div>
                  <span style={{fontSize:18}}>⚽</span>
                  <div className="sf-best-info">
                    <strong>{f.team}</strong>
                    <span>{f.formation}</span>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div className="sf-best-pct">{f.pct}%</div>
                    <div className={`sf-best-verdict sf-best-verdict--${f.cls}`}>{f.verdict}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn--ghost btn--sm" style={{width:'100%',marginTop:10,justifyContent:'center'}} type="button">VIEW FULL RANKINGS <ArrowRight size={13}/></button>
          </div>

          {/* System fit insights */}
          <div className="panel">
            <div className="panel-head"><div className="panel-title">System Fit Insights</div></div>
            {INSIGHTS.map((ins,i)=>(
              <div key={i} className="sf-insight-row">
                <span className="sf-insight-icon">{ins.icon}</span>
                <span>{ins.text}</span>
              </div>
            ))}
            <button className="btn btn--ghost btn--sm" style={{width:'100%',marginTop:10,justifyContent:'center'}} type="button">VIEW FULL INSIGHTS <ArrowRight size={13}/></button>
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
