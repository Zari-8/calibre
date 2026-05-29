import { useState } from 'react';
import { ArrowRight, Flame, Star, Crown, Users } from 'lucide-react';
import BattleHero from '../components/BattleHero.jsx';
import Panel from '../components/Panel.jsx';
import Meter from '../components/Meter.jsx';
import { players, rateBattles } from '../data/calibreData.js';
import { navigateTo } from '../components/NavLink.jsx';
import { useCompetitions } from '../hooks/useCompetitions.js';

/* ── Sparkline ── */
function TrendLine() {
  return (
    <svg className="spark" viewBox="0 0 100 32" aria-hidden="true">
      <polyline points="0,28 18,24 32,16 48,18 62,10 80,8 100,3" />
    </svg>
  );
}

/* ── Hex radar (System Fit) ── */
function HexRadar() {
  const axes  = [[60,8],[105,34],[105,86],[60,112],[15,86],[15,34]];
  const inner = [[60,28],[88,44],[88,76],[60,92],[32,76],[32,44]];
  const score = [[60,22],[92,48],[84,79],[60,88],[28,78],[35,42]];
  const pts   = arr => arr.map(([x,y]) => `${x},${y}`).join(' ');
  return (
    <svg className="hex-radar" viewBox="0 0 120 120" role="img" aria-label="System fit radar">
      <polygon className="radar-grid outer" points={pts(axes)} />
      <polygon className="radar-grid inner" points={pts(inner)} />
      {axes.map(([x,y],i) => <line key={i} className="radar-axis" x1="60" y1="60" x2={x} y2={y} />)}
      <polygon className="radar-fill"   points={pts(score)} />
      <polygon className="radar-stroke" points={pts(score)} />
      <circle  className="radar-core" cx="60" cy="60" r="3" />
    </svg>
  );
}

/* ── Archetype radar ── */
function ArchetypeRadar() {
  const axes  = [[60,8],[105,34],[105,86],[60,112],[15,86],[15,34]];
  const score = [[60,18],[96,42],[90,82],[60,96],[24,80],[30,38]];
  const pts   = arr => arr.map(([x,y]) => `${x},${y}`).join(' ');
  return (
    <svg className="archetype-radar" viewBox="0 0 120 120" role="img" aria-label="Archetype radar">
      <polygon className="radar-grid outer" points={pts(axes)} />
      {axes.map(([x,y],i) => <line key={i} className="radar-axis" x1="60" y1="60" x2={x} y2={y} />)}
      <polygon className="radar-fill"   points={pts(score)} />
      <polygon className="radar-stroke" points={pts(score)} />
    </svg>
  );
}

/* ── Trending data ── */
const TRENDING = [
  { label:'Mbappé vs Haaland', votes:'24.7K', left:'/assets/players/kylian-mbappe.jpg',  right:'/assets/players/jude-bellingham.jpg' },
  { label:'Messi vs Ronaldo',  votes:'18.3K', left:'/assets/players/pedri.jpg',           right:'/assets/players/vinicius-junior.jpg' },
  { label:'Haaland vs Kane',   votes:'15.1K', left:'/assets/players/florian-wirtz.jpg',   right:'/assets/players/lamine-yamal.jpg' },
];

/* ── Form badge ── */
function FormBadge({ r }) {
  const bg = r === 'W' ? '#15c45a' : r === 'D' ? '#c9b800' : '#e03c3c';
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:18, height:18, borderRadius:3, background:bg,
      color:'#000', fontSize:9, fontWeight:900, marginRight:2,
    }}>{r}</span>
  );
}

/* ── Rising talents ── */
const RISING = [
  { name:'Lamine Yamal',  role:'RW', team:'Barcelona',  score:87, delta:'+4' },
  { name:'Rico Lewis',    role:'DM', team:'Man City',   score:84, delta:'+6' },
  { name:'João Neves',    role:'CM', team:'Benfica',    score:84, delta:'+6' },
  { name:'Arda Güler',    role:'AM', team:'Real Madrid',score:82, delta:'+3' },
  { name:'Kobbie Mainoo', role:'CM', team:'Man Utd',    score:81, delta:'+2' },
];

/* ── Live debates ── */
const LIVE_DEBATES = [
  { question:'Is Florian Wirtz worth €120M+?',       votes:'7.3k votes', badge:'HOT',  cls:'badge-hot',  img:'/assets/players/florian-wirtz.jpg' },
  { question:"Who's the best DM in the world?",      votes:'5.1k votes', badge:'LIVE', cls:'badge-live', img:'/assets/players/pedri.jpg' },
  { question:'Which team has the best youth system?', votes:'3.8k votes', badge:'NEW',  cls:'badge-new',  img:'/assets/players/lamine-yamal.jpg' },
];

/* ══════════════════════════════════════════════════════════════ */
export default function Home() {
  const [compTab, setCompTab] = useState('Leagues');
  const { rows: compRows, loading: compLoading, isLive } = useCompetitions();

  return (
    <div className="page home-page">

      {/* ── HERO + RAIL ── */}
      <section className="hero-grid">
        <BattleHero />

        <aside className="right-rail">

          {/* Trending Battles */}
          <Panel
            title="Trending Battles"
            eyebrow={<><Flame size={13} style={{color:'#ff6b35',marginRight:5,verticalAlign:'middle'}}/>Debate Index</>}
            action={<span style={{cursor:'pointer'}} onClick={() => navigateTo('/debates')}>View all</span>}
          >
            <div className="stack-list">
              {TRENDING.map(b => (
                <div className="trend-row" key={b.label} style={{cursor:'pointer'}} onClick={() => navigateTo('/debates')}>
                  <div className="avatar-pair">
                    <img src={b.left}  alt="" />
                    <img src={b.right} alt="" />
                  </div>
                  <div className="trend-info">
                    <strong>{b.label}</strong>
                    <span>{b.votes} votes</span>
                  </div>
                  <TrendLine />
                </div>
              ))}
            </div>
          </Panel>

          {/* System Fit — clickable → /system-fit */}
          <Panel
            title="System Fit"
            eyebrow="◎ Gordon in FC Barcelona"
            className="system-card-home"
          >
            <div
              className="system-grid"
              style={{cursor:'pointer'}}
              onClick={() => navigateTo('/system-fit')}
              title="View full System Fit analysis"
            >
              <img className="gordon-img" src="/assets/players/gordon.jpg" alt="Gordon" />
              <HexRadar />
              <div className="fit-score">
                <strong>86<span className="fit-pct">%</span></strong>
                <span>Fit score</span>
              </div>
            </div>
            <div className="dot-metrics">
              <div className="dot-row"><span>Width</span><span className="dot-dots">●●●●●●●●○○</span><b>87</b></div>
              <div className="dot-row"><span>Pressing</span><span className="dot-dots">●●●●●●●●○○</span><b>83</b></div>
              <div className="dot-row"><span>Transition</span><span className="dot-dots">●●●●●●●●○○</span><b>83</b></div>
            </div>
            <p style={{cursor:'pointer'}} onClick={() => navigateTo('/system-fit')}>
              Good fit for Barça's wide rotations and high-tempo transitions. →
            </p>
          </Panel>

          {/* World Cup Breakout Star */}
          <Panel
            title="World Cup Breakout Star"
            eyebrow={<><Star size={12} style={{color:'#f5c518',marginRight:5,verticalAlign:'middle'}}/>Scout Pulse</>}
            className="breakout-card"
          >
            <div className="breakout-inner">
              <img src="/assets/players/ibrahim-musa.jpg" alt="Ibrahim Musa" />
              <div className="breakout-copy">
                <strong>The next<br />tournament hero?</strong>
                <span>Scouted. Analysed.<br />Ready to explode.</span>
              </div>
              <svg className="wc-trophy-svg" viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="30" cy="74" rx="18" ry="4" fill="#c9a84c" opacity=".7"/>
                <rect x="24" y="58" width="12" height="16" rx="2" fill="#c9a84c"/>
                <rect x="18" y="56" width="24" height="4" rx="2" fill="#b8973b"/>
                <path d="M12 8h36l-6 28c-2 8-8 14-12 16-4-2-10-8-12-16L12 8z" fill="#d4a843"/>
                <path d="M12 8C4 8 2 18 2 24c0 10 6 18 16 20l2-8-10-4 6-24z" fill="#c9a03a" opacity=".8"/>
                <path d="M48 8C56 8 58 18 58 24c0 10-6 18-16 20l-2-8 10-4-6-24z" fill="#c9a03a" opacity=".8"/>
              </svg>
            </div>
            <button type="button" className="breakout-btn" onClick={() => navigateTo('/talents')}>
              See shortlist <ArrowRight size={13}/>
            </button>
          </Panel>

        </aside>
      </section>

      {/* ── DATA STRIP ── */}
      <section className="data-row segmented">
        {[
          ['📊','Data-Driven','Player Insights'],
          ['👥','1.2M+','Data Points Daily'],
          ['🤖','AI Models','Proprietary & Trained'],
          ['🏟️','Trusted By','Clubs & Scouts'],
          ['🌍','Global Coverage','200+ Countries'],
        ].map(([icon, val, label]) => (
          <div className="stat-card" key={label}>
            <span className="stat-icon">{icon}</span>
            <strong>{val}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      {/* ── LOWER DASHBOARD ── */}
      <section className="lower-dashboard">

        {/* Featured Archetype */}
        <Panel title="Featured Archetype" eyebrow={<span style={{color:'var(--lime)'}}>Press-Resistant Midfielder</span>} className="archetype-panel">
          <div className="archetype-body">
            <div className="archetype-left">
              <img src="/assets/players/vitinha.jpg" alt="Vitinha" />
              <div className="score-orb">
                <span className="orb-num">89</span>
                <span className="orb-label">Archetype score</span>
              </div>
            </div>
            <div className="archetype-radar-block">
              <div className="radar-label-grid">
                <span className="rl top">Press Resistance <b>92</b></span>
                <span className="rl right">Progression <b>85</b></span>
                <span className="rl bottom-right">Vision <b>84</b></span>
                <span className="rl bottom">Work Rate <b>76</b></span>
                <span className="rl left">Duels <b>88</b></span>
                <span className="rl top-left">Composure <b>90</b></span>
              </div>
              <ArchetypeRadar />
            </div>
          </div>
          <div className="archetype-footer">
            <div>
              <strong>Vitinha</strong>
              <span>Paris Saint-Germain</span>
            </div>
            <button type="button" className="view-archetype-btn" onClick={() => navigateTo('/players')}>
              View archetype <ArrowRight size={13}/>
            </button>
          </div>
          <div className="carousel-dots">
            {[0,1,2,3,4].map(i => <span key={i} className={i===0?'dot active':'dot'}/>)}
          </div>
        </Panel>

        {/* Competitions Snapshot */}
        <Panel title="Competitions Snapshot" className="table-panel">
          <div className="comp-tabs">
            {['Leagues','Clubs','Nations'].map(t => (
              <button key={t} type="button"
                className={compTab===t ? 'comp-tab active' : 'comp-tab'}
                onClick={() => setCompTab(t)}
              >{t}</button>
            ))}
            {isLive && <span className="live-dot-label">● LIVE</span>}
          </div>
          {compLoading ? (
            <div className="comp-loading">Loading league data…</div>
          ) : (
            <table className="comp-table">
              <thead>
                <tr>
                  <th>League</th>
                  <th>Form (Last 5)</th>
                  <th>Trend</th>
                  <th>Top Player</th>
                </tr>
              </thead>
              <tbody>
                {compRows.map(row => (
                  <tr key={row.name}>
                    <td><span className="league-flag">{row.flag}</span>{row.name}</td>
                    <td>{row.form.map((r,i) => <FormBadge key={i} r={r}/>)}</td>
                    <td>
                      <svg style={{width:44,height:14}} viewBox="0 0 100 32">
                        <polyline points="0,28 30,20 60,12 100,4" fill="none" stroke="var(--lime)" strokeWidth="3"/>
                      </svg>
                    </td>
                    <td>{row.top}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        {/* Rising Talents */}
        <Panel
          title="Rising Talents"
          eyebrow={<span style={{color:'var(--lime)',cursor:'pointer'}} onClick={() => navigateTo('/talents')}>View all</span>}
          className="talents-panel"
        >
          {RISING.map(p => (
            <div className="talent-row" key={p.name}>
              <div className="talent-info">
                <strong>{p.name}</strong>
                <span>{p.role} · {p.team}</span>
              </div>
              <div className="talent-score">
                <b>{p.score}</b>
                <span className="delta">{p.delta}</span>
              </div>
            </div>
          ))}
        </Panel>

        {/* Live Debates */}
        <Panel title="Live Debates" eyebrow="Join the conversation" className="debates-panel">
          {LIVE_DEBATES.map(d => (
            <button key={d.question} className="debate-chip" type="button" onClick={() => navigateTo('/debates')}>
              <div className="debate-chip-left">
                <img src={d.img} alt="" />
                <div>
                  <span className="debate-q">{d.question}</span>
                  <span className="debate-votes">{d.votes}</span>
                </div>
              </div>
              <span className={`debate-badge ${d.cls}`}>{d.badge}</span>
            </button>
          ))}
          <button className="join-debate-btn" type="button" onClick={() => navigateTo('/debates')}>
            Join a debate <ArrowRight size={13}/>
          </button>
        </Panel>

      </section>

      {/* ── FOUNDER STRIP ── */}
      <section className="founder-strip">
        <Crown size={26} style={{color:'var(--lime)',fill:'var(--lime)',flexShrink:0}}/>
        <strong>Get World Cup Founder Pass</strong>
        <span>Unlock premium insights, advanced filters &amp; exclusive World Cup content.</span>
        <button type="button" onClick={() => navigateTo('/pricing')}>
          Explore plans <ArrowRight size={15}/>
        </button>
      </section>

    </div>
  );
}
