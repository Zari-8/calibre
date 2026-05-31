import { useState, useEffect } from 'react';
import { Zap, Target, Star, MessageSquare, GaugeCircle, Users, ArrowRight, Crown, Filter, TrendingUp } from 'lucide-react';
import { navigateTo } from '../components/NavLink.jsx';

/* ── Countdown to midnight ── */
function useCountdown() {
  const get = () => {
    const now = new Date(), next = new Date(now);
    next.setUTCHours(24,0,0,0);
    const d = Math.max(0, next - now);
    return {
      h: String(Math.floor(d/3600000)).padStart(2,'0'),
      m: String(Math.floor((d%3600000)/60000)).padStart(2,'0'),
      s: String(Math.floor((d%60000)/1000)).padStart(2,'0'),
    };
  };
  const [t, setT] = useState(get);
  useEffect(() => { const id = setInterval(()=>setT(get()),1000); return ()=>clearInterval(id); },[]);
  return t;
}

function Spark() {
  return (
    <svg className="spark" viewBox="0 0 100 32">
      <polyline points="0,28 20,22 40,16 55,19 70,10 85,8 100,4" />
    </svg>
  );
}

/* ── Data ── */
const ACTIVE_BATTLES = [
  { left:{name:'Haaland',club:'Man City',img:'/assets/players/kylian-mbappe.jpg'},    right:{name:'Mbappé',club:'Real Madrid',img:'/assets/players/jude-bellingham.jpg'},   cat:'Impact',     votesL:'28.7K', votesR:'24.1K', pct:54 },
  { left:{name:'Rice',club:'Arsenal',img:'/assets/players/florian-wirtz.jpg'},          right:{name:'Rodri',club:'Man City',img:'/assets/players/vitinha.jpg'},                cat:'Control',    votesL:'19.3K', votesR:'17.2K', pct:53 },
  { left:{name:'Vinicius Jr.',club:'Real Madrid',img:'/assets/players/vinicius-junior.jpg'}, right:{name:'Saka',club:'Arsenal',img:'/assets/players/lamine-yamal.jpg'},       cat:'Creativity', votesL:'15.6K', votesR:'14.8K', pct:51 },
];

const UPCOMING = [
  { left:{name:'Mo Salah',club:'Liverpool',img:'/assets/players/kylian-mbappe.jpg'},    right:{name:'Son Heung-min',club:'Spurs',img:'/assets/players/lamine-yamal.jpg'},    cd:'01:45:32' },
  { left:{name:'B. Fernández',club:'Man Utd',img:'/assets/players/pedri.jpg'},           right:{name:'Ødegaard',club:'Arsenal',img:'/assets/players/vitinha.jpg'},             cd:'03:22:10' },
  { left:{name:'Lewandowski',club:'Barcelona',img:'/assets/players/vinicius-junior.jpg'},right:{name:'V. Osimhen',club:'Napoli',img:'/assets/players/florian-wirtz.jpg'},     cd:'06:11:28' },
];

const NOMINATIONS = [
  { title:'Jamal Musiala vs Florian Wirtz', by:'@MidfieldMaestro', votes:2341 },
  { title:'Gavi vs Camavinga',              by:'@BarcaTalks',      votes:1876 },
  { title:'Lautaro Martínez vs D. Nuñez',   by:'@InterZone',       votes:1542 },
];

const TRENDING = [
  { label:'Mbappé vs Haaland',      votes:'24.7K', l:'/assets/players/kylian-mbappe.jpg',    r:'/assets/players/lamine-yamal.jpg' },
  { label:'Messi vs Ronaldo',       votes:'18.3K', l:'/assets/players/vinicius-junior.jpg',   r:'/assets/players/pedri.jpg' },
  { label:'Bellingham vs Pedri',    votes:'15.1K', l:'/assets/players/jude-bellingham.jpg',   r:'/assets/players/pedri.jpg' },
  { label:'Vinícius vs Saka',       votes:'12.6K', l:'/assets/players/vinicius-junior.jpg',   r:'/assets/players/lamine-yamal.jpg' },
  { label:'Rodri vs Rice',          votes:'10.8K', l:'/assets/players/vitinha.jpg',            r:'/assets/players/florian-wirtz.jpg' },
];

const FEED = [
  { user:'@TacticalMind',    action:'rated',       battle:'Pedri vs Bellingham', score:7,    ago:'Just now', img:'/assets/players/pedri.jpg' },
  { user:'@FootyGuru',       action:'joined',      battle:'Haaland vs Mbappé',   score:null, ago:'1m ago',   img:'/assets/players/kylian-mbappe.jpg' },
  { user:'@MidfieldMaestro', action:'nominated',   battle:'Musiala vs Wirtz',    score:null, ago:'3m ago',   img:'/assets/players/florian-wirtz.jpg' },
  { user:'@TheStatKing',     action:'commented on',battle:'Rice vs Rodri',       quote:"Rodri's positional control is unmatched.", score:null, ago:'5m ago', img:'/assets/players/vitinha.jpg' },
  { user:'@BarcaTalks',      action:'rated',       battle:'Bellingham vs Pedri', score:8,    ago:'7m ago',   img:'/assets/players/jude-bellingham.jpg' },
];

const HOT_POTATO = [
  { q:"Is Mbappé already better than Ronaldo ever was at Real Madrid?",          yes:61, votes:'3,412', badge:'HOT' },
  { q:"Should Bellingham start every England game at the World Cup?",             yes:74, votes:'2,108', badge:'VOTE' },
  { q:"Is the Premier League still the best league in the world?",                yes:55, votes:'1,876', badge:'DEBATE' },
  { q:"Would Messi have been as great without Barça?",                            yes:48, votes:'1,543', badge:'THINK' },
];

const BANGER_TWEETS = [
  { handle:'@GaryLineker',   text:'"Pedri at 21 is already the best Spanish midfielder since Xavi. No debate."',       likes:'18.4K', rt:'4.2K' },
  { handle:'@OptaJoe',       text:'"Erling Haaland has scored in 14 consecutive home games. Absolutely frightening."', likes:'12.7K', rt:'3.1K' },
  { handle:'@FabrizioRomano',text:'"Here we go! The transfer market never sleeps and neither do the debates."',         likes:'31.2K', rt:'8.6K' },
  { handle:'@MikelArteta',   text:'"Every single player gives absolutely everything. Incredibly proud."',               likes:'9.8K',  rt:'1.9K' },
];

const CAT_BREAKDOWN = [
  { label:'Control',    pct:28, side:'left' },
  { label:'Impact',     pct:26, side:'right' },
  { label:'Creativity', pct:24, side:'left' },
  { label:'Debate',     pct:22, side:'right' },
];

const FILTER_CATS = ['All','Control','Impact','Creativity','Debate'];

/* ── Inline style helpers ── */
const S = {
  label:   { fontSize:10, fontWeight:600, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--text2)' },
  label2:  { fontSize:10, fontWeight:600, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--text3)' },
  mono:    { fontVariantNumeric:'tabular-nums' },
  divider: { borderBottom:'1px solid var(--thin)' },
};

export default function Debates() {
  const { h, m, s } = useCountdown();
  const [filter, setFilter] = useState('All');
  const [votes, setVotes]   = useState(12458);
  const [voted, setVoted]   = useState(false);
  const [rating, setRating] = useState(null);

  function handleRate(n) {
    setRating(n);
    if (!voted) { setVoted(true); setVotes(v => v+1); }
  }

  const filteredBattles = filter === 'All'
    ? ACTIVE_BATTLES
    : ACTIVE_BATTLES.filter(b => b.cat === filter);

  return (
    <div className="page" style={{paddingTop:24}}>

      {/* ── Page header ── */}
      <div style={{marginBottom:24, paddingBottom:20, borderBottom:'1px solid var(--thin)'}}>
        <div style={{display:'flex', alignItems:'flex-end', justifyContent:'space-between'}}>
          <div>
            <div style={{...S.label, color:'var(--lime)', marginBottom:6}}>Debates</div>
            <h1 style={{fontSize:28, fontWeight:700, letterSpacing:'-.03em', color:'var(--text)', lineHeight:1}}>Rate Battles</h1>
            <p style={{fontSize:13, color:'var(--text2)', marginTop:6}}>
              Vote on today's matchups · {votes.toLocaleString()} votes cast · <span style={{color:'var(--lime)', fontVariantNumeric:'tabular-nums'}}>{h}:{m}:{s}</span> left today
            </p>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <button className="btn btn--outline btn--sm" type="button">HOW IT WORKS</button>
            <button className="btn btn--lime btn--sm" type="button" onClick={()=>navigateTo('/pricing')}>
              NOMINATE A BATTLE
            </button>
          </div>
        </div>
      </div>

      {/* ── 2-col layout ── */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 300px', gap:24, alignItems:'start'}}>

        {/* ═══ LEFT COLUMN ═══ */}
        <div style={{display:'flex', flexDirection:'column', gap:24}}>

          {/* Filter bar */}
          <div style={{display:'flex', alignItems:'center', gap:6}}>
            {FILTER_CATS.map(f => (
              <button key={f} type="button"
                onClick={() => setFilter(f)}
                style={{
                  padding:'6px 14px', borderRadius:'var(--r)',
                  border:`1px solid ${filter===f ? 'var(--lime)' : 'var(--thin)'}`,
                  background: filter===f ? 'var(--lime-dim)' : 'none',
                  color: filter===f ? 'var(--lime)' : 'var(--text2)',
                  fontSize:11, fontWeight:600, letterSpacing:'.05em', textTransform:'uppercase',
                  transition:'all .12s',
                }}
              >
                {f === 'Control'    && <Target size={11} style={{marginRight:4, verticalAlign:'middle'}}/>}
                {f === 'Impact'     && <Zap size={11} style={{marginRight:4, verticalAlign:'middle'}}/>}
                {f === 'Creativity' && <Star size={11} style={{marginRight:4, verticalAlign:'middle'}}/>}
                {f === 'Debate'     && <MessageSquare size={11} style={{marginRight:4, verticalAlign:'middle'}}/>}
                {f}
              </button>
            ))}
            <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8}}>
              <span style={{...S.label2}}>Sort</span>
              <select style={{
                background:'var(--panel2)', border:'1px solid var(--thin)',
                borderRadius:'var(--r)', padding:'5px 10px',
                fontSize:11, color:'var(--text2)',
              }}>
                <option>Trending</option>
                <option>Newest</option>
                <option>Most voted</option>
              </select>
            </div>
          </div>

          {/* ── Active Rate Battles ── */}
          <div>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
              <div style={{display:'flex', alignItems:'center', gap:7}}>
                <Zap size={13} color="var(--lime)"/>
                <span style={{...S.label}}>Active Rate Battles</span>
              </div>
              <a style={{...S.label2, cursor:'pointer'}} onClick={()=>{}}>View all</a>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12}}>
              {filteredBattles.map((b,i) => (
                <div key={i} className="panel" style={{overflow:'hidden', cursor:'pointer'}}>
                  {/* Image area */}
                  <div style={{position:'relative', display:'grid', gridTemplateColumns:'1fr auto 1fr', height:110}}>
                    <img src={b.left.img} alt={b.left.name} style={{width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center', maskImage:'linear-gradient(to right,rgba(0,0,0,1) 50%,transparent 100%)', WebkitMaskImage:'linear-gradient(to right,rgba(0,0,0,1) 50%,transparent 100%)'}}/>
                    <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 10px', zIndex:2, flexShrink:0}}>
                      <span style={{fontSize:14, fontWeight:700, color:'var(--lime)', letterSpacing:'.04em'}}>VS</span>
                      <span style={{...S.label2, marginTop:4}}>{b.cat}</span>
                    </div>
                    <img src={b.right.img} alt={b.right.name} style={{width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center', maskImage:'linear-gradient(to left,rgba(0,0,0,1) 50%,transparent 100%)', WebkitMaskImage:'linear-gradient(to left,rgba(0,0,0,1) 50%,transparent 100%)'}}/>
                    <div style={{position:'absolute', top:8, left:8}}>
                      <span style={{fontSize:9, fontWeight:700, letterSpacing:'.12em', color:'var(--lime)', background:'var(--lime-dim)', border:'1px solid var(--line-lime)', borderRadius:'var(--r)', padding:'3px 6px'}}>LIVE</span>
                    </div>
                  </div>
                  {/* Names + bar */}
                  <div style={{padding:'10px 12px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                      <div>
                        <div style={{fontSize:12, fontWeight:700, color:'var(--text)'}}>{b.left.name}</div>
                        <div style={{...S.label2, marginTop:2}}>{b.left.club}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:12, fontWeight:700, color:'var(--text)'}}>{b.right.name}</div>
                        <div style={{...S.label2, marginTop:2}}>{b.right.club}</div>
                      </div>
                    </div>
                    <div style={{height:3, background:'var(--thin)', borderRadius:2, overflow:'hidden'}}>
                      <div style={{height:'100%', width:`${b.pct}%`, background:'var(--lime)', borderRadius:2}}/>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', marginTop:5}}>
                      <span style={{fontSize:12, fontWeight:700, color:'var(--lime)'}}>{b.votesL}</span>
                      <span style={{fontSize:12, fontWeight:700, color:'var(--text2)'}}>{b.votesR}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Today's Rate — compact vote widget ── */}
          <div className="panel" style={{padding:0, overflow:'hidden'}}>
            <div className="panel-head" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <div style={{width:6, height:6, borderRadius:'50%', background:'var(--lime)', boxShadow:'0 0 8px var(--lime)'}}/>
                <span className="panel-title">Today's Rate Battle</span>
              </div>
              <span style={{fontSize:12, fontVariantNumeric:'tabular-nums', color:'var(--lime)', fontWeight:600}}>
                {h}:{m}:{s} left
              </span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', minHeight:140}}>
              {/* Left player */}
              <div style={{display:'flex', alignItems:'center', gap:14, padding:16, borderRight:'1px solid var(--thin)'}}>
                <img src="/assets/players/pedri.jpg" alt="Pedri" style={{width:56, height:68, objectFit:'cover', objectPosition:'top', borderRadius:'var(--r)', border:'1px solid var(--thin)'}}/>
                <div>
                  <div style={{fontSize:16, fontWeight:700, color:'var(--text)', letterSpacing:'-.02em'}}>Pedri</div>
                  <div style={{...S.label2, marginTop:3}}>FC Barcelona · CM</div>
                </div>
              </div>
              {/* Right player */}
              <div style={{display:'flex', alignItems:'center', gap:14, padding:16}}>
                <img src="/assets/players/jude-bellingham.jpg" alt="Bellingham" style={{width:56, height:68, objectFit:'cover', objectPosition:'top', borderRadius:'var(--r)', border:'1px solid var(--thin)'}}/>
                <div>
                  <div style={{fontSize:16, fontWeight:700, color:'var(--text)', letterSpacing:'-.02em'}}>Bellingham</div>
                  <div style={{...S.label2, marginTop:3}}>Real Madrid · CM</div>
                </div>
              </div>
            </div>
            {/* Question + scale */}
            <div style={{padding:'16px', borderTop:'1px solid var(--thin)'}}>
              <p style={{fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:12, textAlign:'center'}}>
                Who owns the <span style={{color:'var(--lime)'}}>midfield</span>?
              </p>
              <div style={{display:'flex', gap:4, justifyContent:'center', marginBottom:10}}>
                {Array.from({length:10},(_,i) => (
                  <button key={i+1} type="button"
                    onClick={() => handleRate(i+1)}
                    style={{
                      width:30, height:30, borderRadius:'var(--r)',
                      border:`1px solid ${rating===i+1 ? 'var(--lime)' : 'var(--thin)'}`,
                      background: rating===i+1 ? 'var(--lime)' : 'none',
                      color: rating===i+1 ? '#060800' : 'var(--text2)',
                      fontSize:12, fontWeight:700,
                      transition:'all .1s',
                    }}
                  >{i+1}</button>
                ))}
              </div>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:10, fontWeight:600, color:'var(--text3)', letterSpacing:'.06em', textTransform:'uppercase', marginBottom:10}}>
                <span style={{color:'#6ab4ff'}}>Pedri</span>
                <span>Equal</span>
                <span style={{color:'#ffb06a'}}>Bellingham</span>
              </div>
              {voted
                ? <div style={{textAlign:'center', fontSize:11, color:'var(--lime)', fontWeight:600}}>✓ Rating added to community score</div>
                : <div style={{textAlign:'center', fontSize:11, color:'var(--text3)'}}>Your rating contributes to the community average</div>
              }
            </div>
          </div>

          {/* ── Upcoming + Nominations ── */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            {/* Upcoming */}
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title"><GaugeCircle size={11} style={{marginRight:5,verticalAlign:'middle'}}/>Upcoming Battles</span>
                <a className="panel-action">View all</a>
              </div>
              <div style={{padding:'4px 0'}}>
                {UPCOMING.map((u,i) => (
                  <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 16px', ...S.divider}}>
                    <div style={{display:'flex', alignItems:'center', gap:6, flex:1}}>
                      <img src={u.left.img} alt={u.left.name} style={{width:24,height:28,objectFit:'cover',objectPosition:'top',borderRadius:3,border:'1px solid var(--thin)'}}/>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{u.left.name}</div>
                        <div style={{...S.label2,marginTop:1}}>{u.left.club}</div>
                      </div>
                    </div>
                    <span style={{fontSize:10,fontWeight:700,color:'var(--text3)'}}>VS</span>
                    <div style={{display:'flex', alignItems:'center', gap:6, flex:1, justifyContent:'flex-end'}}>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{u.right.name}</div>
                        <div style={{...S.label2,marginTop:1}}>{u.right.club}</div>
                      </div>
                      <img src={u.right.img} alt={u.right.name} style={{width:24,height:28,objectFit:'cover',objectPosition:'top',borderRadius:3,border:'1px solid var(--thin)'}}/>
                    </div>
                    <div style={{flexShrink:0, textAlign:'right', minWidth:60}}>
                      <div style={{fontSize:11,fontWeight:700,color:'var(--lime)',fontVariantNumeric:'tabular-nums'}}>{u.cd}</div>
                      <div style={{...S.label2,marginTop:1}}>starts in</div>
                    </div>
                  </div>
                ))}
                <div style={{padding:'12px 16px'}}>
                  <button className="btn btn--outline btn--sm" style={{width:'100%', justifyContent:'center'}} type="button">
                    VIEW FULL SCHEDULE <ArrowRight size={12}/>
                  </button>
                </div>
              </div>
            </div>

            {/* Nominations */}
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title"><Star size={11} style={{marginRight:5,verticalAlign:'middle'}}/>Fan Nominations</span>
                <a className="panel-action">View all</a>
              </div>
              <div style={{padding:'4px 0'}}>
                {NOMINATIONS.map((n,i) => (
                  <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 16px', ...S.divider}}>
                    <span style={{fontSize:14, fontWeight:700, color:'var(--text3)', width:16}}>{i+1}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12, fontWeight:600, color:'var(--text)', lineHeight:1.3}}>{n.title}</div>
                      <div style={{...S.label2, marginTop:3}}>by {n.by}</div>
                    </div>
                    <span style={{fontSize:12, fontWeight:700, color:'var(--lime)', flexShrink:0}}>{n.votes.toLocaleString()} 👍</span>
                  </div>
                ))}
                <div style={{padding:'12px 16px'}}>
                  <button className="btn btn--lime btn--sm" style={{width:'100%', justifyContent:'center'}} type="button">
                    NOMINATE A DEBATE
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Hot Potato of the Week ── */}
          <div>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
              <span style={{...S.label}}>🔥 Hot Potato of the Week</span>
              <a style={{...S.label2, cursor:'pointer'}}>Archive</a>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              {HOT_POTATO.map((h,i) => (
                <div key={i} className="panel" style={{padding:16, cursor:'pointer'}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
                    <span style={{fontSize:9, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--lime)', background:'var(--lime-dim)', border:'1px solid var(--line-lime)', borderRadius:'var(--r)', padding:'3px 7px'}}>{h.badge}</span>
                    <span style={{fontSize:11, color:'var(--text3)'}}>{h.votes} votes</span>
                  </div>
                  <p style={{fontSize:13, fontWeight:500, color:'var(--text)', lineHeight:1.45, marginBottom:12}}>{h.q}</p>
                  <div style={{height:3, background:'var(--thin)', borderRadius:2, overflow:'hidden', marginBottom:6}}>
                    <div style={{height:'100%', width:`${h.yes}%`, background:'var(--lime)', borderRadius:2}}/>
                  </div>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:10, fontWeight:600, color:'var(--text3)', letterSpacing:'.05em', textTransform:'uppercase'}}>
                    <span style={{color:'var(--lime)'}}>YES {h.yes}%</span>
                    <span>NO {100-h.yes}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Banger Tweet of the Day ── */}
          <div>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
              <span style={{...S.label}}>💬 Banger Tweet of the Day</span>
              <a style={{...S.label2, cursor:'pointer'}}>View all</a>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              {BANGER_TWEETS.map((t,i) => (
                <div key={i} className="panel" style={{padding:16, cursor:'pointer'}}>
                  <div style={{fontSize:12, fontWeight:700, color:'var(--lime)', marginBottom:8}}>{t.handle}</div>
                  <p style={{fontSize:13, color:'var(--text)', lineHeight:1.5, fontStyle:'italic', marginBottom:10}}>{t.text}</p>
                  <div style={{display:'flex', gap:14, fontSize:11, color:'var(--text3)', fontWeight:500}}>
                    <span>♥ {t.likes}</span>
                    <span>↩ {t.rt}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── GOAT Debate ── */}
          <div>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
              <span style={{...S.label}}>🐐 GOAT Debate</span>
              <a style={{...S.label2, cursor:'pointer'}}>All time debates</a>
            </div>
            <div className="panel" style={{padding:24}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 120px 1fr', alignItems:'center', gap:24, marginBottom:20}}>
                <div style={{display:'flex', alignItems:'center', gap:14}}>
                  <img src="/assets/players/vinicius-junior.jpg" alt="Messi" style={{width:64,height:76,objectFit:'cover',objectPosition:'top',borderRadius:'var(--r)',border:'2px solid var(--lime)'}}/>
                  <div>
                    <div style={{fontSize:18,fontWeight:700,color:'var(--text)',letterSpacing:'-.02em'}}>Messi</div>
                    <div style={{...S.label2,marginTop:3}}>Inter Miami</div>
                    <div style={{fontSize:22,fontWeight:700,color:'var(--lime)',marginTop:6}}>54%</div>
                  </div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:16,fontWeight:700,color:'var(--text3)',letterSpacing:'.04em'}}>VS</div>
                  <div style={{...S.label2,marginTop:6}}>All Time</div>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--lime)',marginTop:4}}>48.2K votes</div>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:14, justifyContent:'flex-end'}}>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:18,fontWeight:700,color:'var(--text)',letterSpacing:'-.02em'}}>Ronaldo</div>
                    <div style={{...S.label2,marginTop:3}}>Al Nassr</div>
                    <div style={{fontSize:22,fontWeight:700,color:'var(--text2)',marginTop:6}}>46%</div>
                  </div>
                  <img src="/assets/players/kylian-mbappe.jpg" alt="Ronaldo" style={{width:64,height:76,objectFit:'cover',objectPosition:'top',borderRadius:'var(--r)',border:'1px solid var(--thin)'}}/>
                </div>
              </div>
              <div style={{display:'flex',gap:3,marginBottom:16}}>
                <div style={{flex:54,height:4,background:'var(--lime)',borderRadius:2}}/>
                <div style={{flex:46,height:4,background:'var(--thin)',borderRadius:2}}/>
              </div>
              <button className="btn btn--lime btn--sm" style={{width:'100%',justifyContent:'center'}} type="button">
                CAST YOUR GOAT VOTE <ArrowRight size={12}/>
              </button>
            </div>
          </div>

        </div>{/* end left */}

        {/* ═══ RIGHT RAIL ═══ */}
        <div style={{display:'flex', flexDirection:'column', gap:16}}>

          {/* Trending */}
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title"><TrendingUp size={11} style={{marginRight:5,verticalAlign:'middle'}}/>Trending This Week</span>
              <a className="panel-action">View all</a>
            </div>
            <div style={{padding:'4px 0'}}>
              {TRENDING.map((t,i) => (
                <div key={t.label} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 16px',...S.divider}}>
                  <span style={{fontSize:13,fontWeight:700,color:'var(--text3)',width:14,flexShrink:0}}>{i+1}</span>
                  <div style={{display:'flex',gap:2,flexShrink:0}}>
                    <img src={t.l} alt="" style={{width:20,height:24,objectFit:'cover',objectPosition:'top',borderRadius:3}}/>
                    <img src={t.r} alt="" style={{width:20,height:24,objectFit:'cover',objectPosition:'top',borderRadius:3}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--text)',lineHeight:1.2}}>{t.label}</div>
                    <div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>{t.votes} votes</div>
                  </div>
                  <Spark/>
                </div>
              ))}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Category Breakdown</span>
            </div>
            <div style={{padding:16}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 72px 1fr', alignItems:'center', gap:12, marginBottom:12}}>
                <div>
                  {CAT_BREAKDOWN.filter(c=>c.side==='left').map(c=>(
                    <div key={c.label} style={{marginBottom:12}}>
                      <div style={{...S.label2, marginBottom:3}}>{c.label}</div>
                      <div style={{fontSize:20,fontWeight:700,color:'var(--lime)'}}>{c.pct}%</div>
                    </div>
                  ))}
                </div>
                <svg viewBox="0 0 120 120" style={{width:72,height:72}}>
                  {(()=>{
                    const axes=[[60,8],[105,34],[105,86],[60,112],[15,86],[15,34]];
                    const score=[[60,22],[92,48],[84,79],[60,88],[28,78],[35,42]];
                    const pts=a=>a.map(([x,y])=>`${x},${y}`).join(' ');
                    return <><polygon fill="none" stroke="rgba(168,255,0,.2)" strokeWidth="1" points={pts(axes)}/><polygon fill="rgba(168,255,0,.18)" stroke="var(--lime)" strokeWidth="1.5" points={pts(score)}/></>;
                  })()}
                </svg>
                <div style={{textAlign:'right'}}>
                  {CAT_BREAKDOWN.filter(c=>c.side==='right').map(c=>(
                    <div key={c.label} style={{marginBottom:12}}>
                      <div style={{...S.label2, marginBottom:3}}>{c.label}</div>
                      <div style={{fontSize:20,fontWeight:700,color:'var(--text2)'}}>{c.pct}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Live Feed */}
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Live Activity</span>
              <div style={{width:6,height:6,borderRadius:'50%',background:'var(--lime)',boxShadow:'0 0 8px var(--lime)'}}/>
            </div>
            <div style={{padding:'4px 0'}}>
              {FEED.map((f,i) => (
                <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 16px',...S.divider}}>
                  <img src={f.img} alt="" style={{width:28,height:28,borderRadius:'50%',objectFit:'cover',objectPosition:'top',flexShrink:0,border:'1px solid var(--thin)'}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--lime)'}}>{f.user}</div>
                    <div style={{fontSize:12,color:'var(--text2)',marginTop:2,lineHeight:1.4}}>
                      {f.action} <span style={{color:'var(--text)'}}>{f.battle}</span>
                      {f.score && <span style={{marginLeft:5,padding:'2px 6px',borderRadius:'var(--r)',border:'1px solid var(--line-lime)',fontSize:11,fontWeight:700,color:'var(--lime)'}}>{f.score}</span>}
                    </div>
                    {f.quote && <div style={{fontSize:11,color:'var(--text3)',marginTop:4,fontStyle:'italic'}}>"{f.quote}"</div>}
                  </div>
                  <span style={{fontSize:10,color:'var(--text3)',flexShrink:0,whiteSpace:'nowrap'}}>{f.ago}</span>
                </div>
              ))}
              <div style={{padding:'12px 16px'}}>
                <button className="btn btn--outline btn--sm" style={{width:'100%',justifyContent:'center'}} type="button">
                  JOIN THE CONVERSATION <ArrowRight size={12}/>
                </button>
              </div>
            </div>
          </div>

        </div>{/* end right rail */}
      </div>

      {/* Founder strip */}
      <div className="founder-strip" style={{marginTop:32}}>
        <Crown size={20} className="founder-strip-icon"/>
        <strong>Get World Cup Founder Pass</strong>
        <span>Unlock premium debates, advanced filters &amp; exclusive World Cup content.</span>
        <button type="button" className="btn btn--lime" onClick={()=>navigateTo('/pricing')}>
          EXPLORE PLANS <ArrowRight size={13}/>
        </button>
      </div>
    </div>
  );
}
