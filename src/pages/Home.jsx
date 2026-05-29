import { useState } from 'react';
import { ArrowRight, Zap, Crown, Users, Target, Star, MessageSquare, GaugeCircle, TrendingUp, BarChart2 } from 'lucide-react';
import BattleHero from '../components/BattleHero.jsx';
import { navigateTo } from '../components/NavLink.jsx';
import { players } from '../data/calibreData.js';

/* ── Sparkline ── */
function Spark() {
  const pts = ['0,28','18,24','32,16','48,18','62,10','80,8','100,3'];
  return (
    <svg className="spark" viewBox="0 0 100 32" aria-hidden="true">
      <polyline points={pts.join(' ')} />
    </svg>
  );
}

/* ── Hex radar ── */
function HexRadar({ small }) {
  const axes  = [[60,8],[105,34],[105,86],[60,112],[15,86],[15,34]];
  const score = [[60,22],[92,48],[84,79],[60,88],[28,78],[35,42]];
  const pts   = arr => arr.map(([x,y]) => `${x},${y}`).join(' ');
  const cls   = small ? 'hex-radar' : 'archetype-radar';
  return (
    <svg className={cls} viewBox="0 0 120 120">
      <polygon className="radar-grid outer" points={pts(axes)} />
      <polygon className="radar-grid inner" points={pts([[60,28],[88,44],[88,76],[60,92],[32,76],[32,44]])} />
      {axes.map(([x,y],i) => <line key={i} className="radar-axis" x1="60" y1="60" x2={x} y2={y} />)}
      <polygon className="radar-fill"   points={pts(score)} />
      <polygon className="radar-stroke" points={pts(score)} />
      <circle  className="radar-core" cx="60" cy="60" r="3" />
    </svg>
  );
}

/* ── Trending data ── */
const TRENDING = [
  { rank:1, label:"Mbappé vs Haaland", votes:"24.7K", l:'/assets/players/kylian-mbappe.jpg',  r:'/assets/players/jude-bellingham.jpg' },
  { rank:2, label:"Messi vs Ronaldo",  votes:"18.3K", l:'/assets/players/pedri.jpg',           r:'/assets/players/vinicius-junior.jpg' },
  { rank:3, label:"Bellingham vs Pedri",votes:"15.1K",l:'/assets/players/jude-bellingham.jpg', r:'/assets/players/pedri.jpg' },
  { rank:4, label:"Vinícius Jr. vs Saka",votes:"12.6K",l:'/assets/players/vinicius-junior.jpg',r:'/assets/players/lamine-yamal.jpg' },
  { rank:5, label:"Rodri vs Rice",     votes:"10.8K", l:'/assets/players/vitinha.jpg',          r:'/assets/players/florian-wirtz.jpg' },
];

/* ── Category breakdown ── */
const CAT_BREAKDOWN = [
  { label:'Control', pct:'28%', side:'left' },
  { label:'Impact',  pct:'26%', side:'right' },
  { label:'Creativity', pct:'24%', side:'left' },
  { label:'Debate', pct:'22%', side:'right' },
];

/* ── Live debate feed ── */
const FEED = [
  { user:'@TacticalMind', action:'rated', battle:'Pedri vs Bellingham', score:7, ago:'Just now', img:'/assets/players/pedri.jpg' },
  { user:'@FootyGuru',    action:'joined', battle:'Haaland vs Mbappé',  score:null, ago:'1m ago',  img:'/assets/players/kylian-mbappe.jpg' },
  { user:'@MidfieldMaestro', action:'nominated', battle:'Musiala vs Wirtz', score:null, ago:'3m ago', img:'/assets/players/florian-wirtz.jpg' },
  { user:'@TheStatKing', action:'commented on', battle:'Rice vs Rodri', quote:"Rodri's positional control is unmatched.", score:null, ago:'5m ago', img:'/assets/players/vitinha.jpg' },
  { user:'@BarcaTalks', action:'rated', battle:'Bellingham vs Pedri', score:8, ago:'7m ago', img:'/assets/players/jude-bellingham.jpg' },
];

export default function Home() {
  return (
    <div className="page" style={{ padding: '0 0 64px' }}>

      {/* ── RATE BATTLE HERO ── */}
      <BattleHero />

      {/* ── PAGE BODY: Filter bar + 2-col layout ── */}
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 20px' }}>

        {/* ── FILTER BAR ── */}
        <div className="dbp-filters" style={{ marginTop: 12 }}>
          {['All Categories','Control','Impact','Creativity','Debate'].map(f => (
            <button key={f} type="button" className={`dbp-filter-btn${f === 'All Categories' ? ' active' : ''}`}>
              {f === 'Control'    && <Target size={12} />}
              {f === 'Impact'     && <Zap size={12} />}
              {f === 'Creativity' && <Star size={12} />}
              {f === 'Debate'     && <MessageSquare size={12} />}
              {f}
            </button>
          ))}
          <select className="dbp-sort-select">
            <option>Sort by: Trending</option>
            <option>Most Votes</option>
            <option>Newest</option>
          </select>
        </div>

        {/* ── 2-COL: MAIN LEFT + RIGHT SIDEBAR ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12, marginTop: 12 }}>

          {/* ═══ LEFT COLUMN ═══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Active Rate Battles */}
            <div>
              <div className="section-heading">
                <Zap size={14} className="section-heading-icon" style={{ color: 'var(--lime)' }} />
                <h3>Active Rate Battles</h3>
                <a href="/debates" className="section-heading-link" onClick={e => { e.preventDefault(); navigateTo('/debates'); }}>
                  View all →
                </a>
              </div>
              <div className="active-battles">
                {[
                  { l:{n:'Haaland',c:'Man City',img:'/assets/players/kylian-mbappe.jpg'}, r:{n:'Mbappé',c:'PSG',img:'/assets/players/jude-bellingham.jpg'}, cat:'Impact', vl:'28.7K', vr:'24.1K', pct:54 },
                  { l:{n:'Rice',c:'Arsenal',img:'/assets/players/pedri.jpg'}, r:{n:'Rodri',c:'Man City',img:'/assets/players/vitinha.jpg'}, cat:'Control', vl:'19.3K', vr:'17.2K', pct:53 },
                  { l:{n:'Vinicius Jr.',c:'Real Madrid',img:'/assets/players/vinicius-junior.jpg'}, r:{n:'Saka',c:'Arsenal',img:'/assets/players/lamine-yamal.jpg'}, cat:'Creativity', vl:'15.6K', vr:'14.8K', pct:51 },
                ].map((b,i) => (
                  <div key={i} className="battle-card" onClick={() => navigateTo('/debates')}>
                    <div className="battle-card-live">LIVE</div>
                    <div className="battle-card-cat">
                      {b.cat === 'Impact' && <Zap size={9} />}
                      {b.cat === 'Control' && <Target size={9} />}
                      {b.cat === 'Creativity' && <Star size={9} />}
                      {b.cat}
                    </div>
                    <div className="battle-card-imgs">
                      <img src={b.l.img} alt={b.l.n} />
                      <img src={b.r.img} alt={b.r.n} />
                      <div className="battle-vs-badge">VS</div>
                    </div>
                    <div className="battle-card-names">
                      <div><span>{b.l.n}</span><span className="card-club">{b.l.c}</span></div>
                      <div style={{ textAlign:'right' }}><span>{b.r.n}</span><span className="card-club">{b.r.c}</span></div>
                    </div>
                    <div className="battle-card-bar">
                      <div className="battle-card-bar-fill" style={{ width: b.pct + '%' }} />
                    </div>
                    <div className="battle-card-votes">
                      <span>{b.vl}</span><span>{b.vr}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Two-col: Upcoming + Nominations */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

              {/* Upcoming Battles */}
              <div className="upcoming-battles">
                <div className="upcoming-battles-head">
                  <div className="section-heading" style={{ marginBottom: 0 }}>
                    <GaugeCircle size={13} style={{ color: 'var(--lime)' }} />
                    <h3 style={{ fontSize: 12 }}>Upcoming Battles</h3>
                    <a href="/debates" onClick={e => { e.preventDefault(); navigateTo('/debates'); }} className="section-heading-link">View all</a>
                  </div>
                </div>
                {[
                  { l:{n:'Mo Salah',c:'Liverpool',img:'/assets/players/kylian-mbappe.jpg'}, r:{n:'Son Heung-min',c:'Spurs',img:'/assets/players/lamine-yamal.jpg'}, cd:'01 : 45 : 32' },
                  { l:{n:'B. Fernández',c:'Man Utd',img:'/assets/players/pedri.jpg'}, r:{n:'Ødegaard',c:'Arsenal',img:'/assets/players/vitinha.jpg'}, cd:'03 : 22 : 10' },
                  { l:{n:'R. Lewandowski',c:'Barcelona',img:'/assets/players/vinicius-junior.jpg'}, r:{n:'V. Osimhen',c:'Napoli',img:'/assets/players/florian-wirtz.jpg'}, cd:'06 : 11 : 28' },
                ].map((u,i) => (
                  <div key={i} className="upcoming-row">
                    <div className="upcoming-fighter">
                      <img src={u.l.img} alt={u.l.n} />
                      <div><div className="upcoming-fighter-name">{u.l.n}</div><div className="upcoming-fighter-club">{u.l.c}</div></div>
                    </div>
                    <div className="upcoming-vs">VS</div>
                    <div className="upcoming-fighter" style={{ justifyContent:'flex-end' }}>
                      <div style={{ textAlign:'right' }}><div className="upcoming-fighter-name">{u.r.n}</div><div className="upcoming-fighter-club">{u.r.c}</div></div>
                      <img src={u.r.img} alt={u.r.n} />
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div className="upcoming-cd">{u.cd}</div>
                      <div className="upcoming-cd-label">Starts in</div>
                    </div>
                  </div>
                ))}
                <button type="button" className="view-schedule-btn" onClick={() => navigateTo('/debates')}>
                  VIEW FULL SCHEDULE <ArrowRight size={13} />
                </button>
              </div>

              {/* Fan Nominations */}
              <div className="nominations">
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--thin)' }}>
                  <div className="section-heading" style={{ marginBottom: 0 }}>
                    <Users size={13} style={{ color: 'var(--lime)' }} />
                    <h3 style={{ fontSize: 12 }}>Fan Nominations</h3>
                    <a href="/debates" onClick={e => { e.preventDefault(); navigateTo('/debates'); }} className="section-heading-link">View all</a>
                  </div>
                </div>
                {[
                  { title:'Jamal Musiala vs Florian Wirtz', by:'@MidfieldMaestro', votes:2341 },
                  { title:'Gavi vs Camavinga',              by:'@BarcaTalks',      votes:1876 },
                  { title:'Lautaro Martínez vs D. Nuñez',   by:'@InterZone',       votes:1542 },
                ].map((n,i) => (
                  <div key={i} className="nomination-row">
                    <div className="nomination-rank">{i+1}</div>
                    <div style={{ flex:1 }}>
                      <div className="nomination-title">{n.title}</div>
                      <div className="nomination-by">{n.by}</div>
                    </div>
                    <div>
                      <div className="nomination-votes">{n.votes.toLocaleString()} 👍</div>
                    </div>
                  </div>
                ))}
                <button type="button" className="nominate-btn" onClick={() => navigateTo('/debates')}>
                  NOMINATE A DEBATE +
                </button>
              </div>
            </div>
          </div>

          {/* ═══ RIGHT SIDEBAR ═══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Trending This Week */}
            <div className="card">
              <div className="card-head">
                <span className="card-title"><TrendingUp size={13} className="card-title-icon" /> TRENDING THIS WEEK</span>
                <a href="/debates" onClick={e => { e.preventDefault(); navigateTo('/debates'); }} className="card-link">View all</a>
              </div>
              {TRENDING.map(t => (
                <div key={t.rank} className="trending-row">
                  <span className="trending-rank">{t.rank}</span>
                  <div className="trending-avatars">
                    <img src={t.l} alt="" />
                    <img src={t.r} alt="" />
                  </div>
                  <span className="trending-label">{t.label}</span>
                  <span className="trending-votes">{t.votes}</span>
                  <Spark />
                </div>
              ))}
            </div>

            {/* Category Breakdown */}
            <div className="card">
              <div className="card-head">
                <span className="card-title"><BarChart2 size={13} className="card-title-icon" /> CATEGORY BREAKDOWN</span>
              </div>
              <div className="cat-breakdown">
                <div>
                  {CAT_BREAKDOWN.filter(c => c.side === 'left').map(c => (
                    <div key={c.label} className="cat-metric" style={{ marginBottom: 12 }}>
                      <div className="cat-metric-label">{c.label}</div>
                      <div className="cat-metric-pct">{c.pct}</div>
                    </div>
                  ))}
                </div>
                <HexRadar small />
                <div>
                  {CAT_BREAKDOWN.filter(c => c.side === 'right').map(c => (
                    <div key={c.label} className="cat-metric cat-metric--right" style={{ marginBottom: 12 }}>
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
                <span className="card-title"><Zap size={13} className="card-title-icon" /> LIVE DEBATE FEED</span>
                <select style={{ background:'none', color:'var(--text2)', fontSize:10, fontFamily:'Rajdhani', fontWeight:700, letterSpacing:'.1em' }}>
                  <option>All Activity</option>
                </select>
              </div>
              {FEED.map((f,i) => (
                <div key={i} className="feed-item">
                  <img className="feed-avatar" src={f.img} alt={f.user}
                    onError={e => { e.target.style.display='none'; }} />
                  <div className="feed-body">
                    <div>
                      <span className="feed-user">{f.user}</span>{' '}
                      <span className="feed-action">{f.action}</span>
                    </div>
                    <div className="feed-battle">
                      {f.battle}
                      {f.score && <span className="feed-score">{f.score}</span>}
                    </div>
                    {f.quote && <div className="feed-quote">"{f.quote}"</div>}
                  </div>
                  <span className="feed-ago">{f.ago}</span>
                </div>
              ))}
              <button type="button" className="join-conv-btn" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--thin)' }}
                onClick={() => navigateTo('/debates')}>
                JOIN THE CONVERSATION →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── PROMO STRIP ── */}
      <div className="promo-strip" style={{ maxWidth: '100%' }}>
        <Crown size={24} className="promo-strip-icon" />
        <div className="promo-strip-text">
          <strong>GET WORLD CUP FOUNDER PASS</strong>
          <span>Unlock premium debates, advanced filters & exclusive World Cup content.</span>
        </div>
        <button type="button" className="promo-cta" onClick={() => navigateTo('/pricing')}>
          EXPLORE PLANS <ArrowRight size={14} />
        </button>
      </div>

    </div>
  );
}
