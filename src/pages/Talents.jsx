import { useState } from 'react';
import { ArrowRight, TrendingUp, MapPin, Star } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import Panel from '../components/Panel.jsx';
import Meter from '../components/Meter.jsx';
import { leagueMultipliers, talents, asianTalents, TALENT_REGIONS } from '../data/calibreData.js';
import { navigateTo } from '../components/NavLink.jsx';

/* ── Trajectory arrow ── */
function Arrow({ t }) {
  if (t === 'rising') return <span style={{color:'#15c45a',fontSize:18}}>↗</span>;
  if (t === 'peak')   return <span style={{color:'var(--lime)',fontSize:18}}>→</span>;
  return                      <span style={{color:'#90928a',fontSize:18}}>→</span>;
}

/* ── Existing talents mapped with a region for filtering ── */
const EXISTING_POOL = [
  { name:'Ibrahim Musa',    age:19, nation:'Nigeria',   flag:'🇳🇬', league:'NPFL',             club:'Remo Stars',       role:'Wide Creator',      rating:77, readiness:82, trend:'+12%', region:'africa',        nextStep:'Belgian Pro League watchlist',             trajectory:'rising', image:'/assets/players/ibrahim-musa.jpg' },
  { name:'Tawanda Moyo',    age:18, nation:'Zimbabwe',  flag:'🇿🇼', league:'Zimbabwe PSL',     club:'FC Platinum',      role:'Controller',        rating:71, readiness:66, trend:'+8%',  region:'africa',        nextStep:'Stay and dominate current league first',   trajectory:'rising', image:'' },
  { name:'Mateo Silva',     age:20, nation:'Uruguay',   flag:'🇺🇾', league:'Uruguay Primera',  club:'Nacional',         role:'Pressing Engine',   rating:80, readiness:79, trend:'+10%', region:'south_america', nextStep:'Loan move recommended for senior minutes', trajectory:'rising', image:'' },
  { name:'Noah Adebayo',    age:17, nation:'Nigeria',   flag:'🇳🇬', league:'Academy / U21',    club:'Enyimba Youth',    role:'False Nine',        rating:74, readiness:63, trend:'+15%', region:'academy',       nextStep:'Needs one more senior-minutes season',     trajectory:'rising', image:'' },
];

/* ── Merge all pools ── */
const ALL_TALENTS = [
  ...EXISTING_POOL,
  ...asianTalents,
];

/* ── Readiness colour ── */
function readinessColor(v) {
  if (v >= 80) return '#15c45a';
  if (v >= 70) return 'var(--lime)';
  return '#c9a03a';
}

export default function Talents() {
  const [region, setRegion] = useState('all');
  const [sort,   setSort]   = useState('readiness'); // readiness | rating | trend | age

  const filtered = ALL_TALENTS
    .filter(t => region === 'all' || t.region === region)
    .sort((a, b) => {
      if (sort === 'trend')     return parseFloat(b.trend) - parseFloat(a.trend);
      if (sort === 'rating')    return b.rating - a.rating;
      if (sort === 'age')       return a.age - b.age;
      return b.readiness - a.readiness;
    });

  const risingCount = filtered.filter(t => t.trajectory === 'rising').length;

  return (
    <div className="page inner-page">
      <PageHero eyebrow="Talent Discovery · Global Scout" title="Talents">
        Next Step Projection adapts to rating, age, role, minutes, league difficulty, trajectory and readiness.
        Now tracking East Asia, Southeast Asia and the Saudi Pro League.
      </PageHero>

      {/* ── REGIONAL FILTER ── */}
      <div className="talent-filter-bar">
        <div className="region-tabs">
          {TALENT_REGIONS.map(r => (
            <button
              key={r.key} type="button"
              className={region === r.key ? 'region-tab active' : 'region-tab'}
              onClick={() => setRegion(r.key)}
            >
              {r.label}
              {r.key !== 'all' && (
                <span className="region-count">
                  {ALL_TALENTS.filter(t => t.region === r.key).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="sort-bar">
          <span>Sort:</span>
          {[['readiness','Readiness'],['rating','Rating'],['trend','Trend'],['age','Age']].map(([k,l]) => (
            <button key={k} type="button"
              className={sort === k ? 'sort-btn active' : 'sort-btn'}
              onClick={() => setSort(k)}
            >{l}</button>
          ))}
        </div>
      </div>

      {/* ── SUMMARY STRIP ── */}
      <div className="talent-summary-strip">
        <div className="ts-cell"><strong>{filtered.length}</strong><span>Players tracked</span></div>
        <div className="ts-cell"><strong>{risingCount}</strong><span>Rising trajectory</span></div>
        <div className="ts-cell"><strong>{filtered.filter(t=>t.readiness>=80).length}</strong><span>Europe-ready</span></div>
        <div className="ts-cell"><strong>{[...new Set(filtered.map(t=>t.nation))].length}</strong><span>Nations</span></div>
      </div>

      {/* ── TALENT GRID ── */}
      <div className="talent-grid">
        {filtered.map(player => (
          <div className="talent-card-full" key={player.name}>
            <div className="tcf-header">
              <div className="tcf-flag">{player.flag}</div>
              <div className="tcf-meta">
                <strong>{player.name}</strong>
                <span>{player.age} · {player.role}</span>
                <span className="tcf-club">{player.club} · {player.league}</span>
              </div>
              <div className="tcf-rating" style={{color: readinessColor(player.readiness)}}>
                {player.rating}
              </div>
            </div>

            <div className="tcf-bars">
              <div className="tcf-bar-row">
                <span>Rating</span>
                <div className="tcf-track"><div className="tcf-fill" style={{width:`${player.rating}%`,background:'var(--lime)'}}/></div>
                <b>{player.rating}</b>
              </div>
              <div className="tcf-bar-row">
                <span>Readiness</span>
                <div className="tcf-track"><div className="tcf-fill" style={{width:`${player.readiness}%`,background:readinessColor(player.readiness)}}/></div>
                <b>{player.readiness}</b>
              </div>
            </div>

            <div className="tcf-footer">
              <div className="tcf-trajectory">
                <Arrow t={player.trajectory} />
                <span style={{color:'#15c45a',fontWeight:700}}>{player.trend}</span>
              </div>
              <div className="tcf-next">
                <MapPin size={11} style={{color:'var(--lime)',marginRight:4,flexShrink:0}}/>
                <span>{player.nextStep}</span>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="talent-empty">No players found for this region yet.</div>
        )}
      </div>

      {/* ── LOWER PANELS ── */}
      <section className="dashboard-grid three" style={{marginTop:14}}>
        <Panel title="League Difficulty Multiplier" eyebrow="Context layer">
          {leagueMultipliers.map(l => (
            <div className="mini-row" key={l.league}>
              <div><strong>{l.league}</strong><span>{l.tone}</span></div>
              <b>{l.multiplier.toFixed(2)}</b>
            </div>
          ))}
        </Panel>

        <Panel title="Asian League Context" eyebrow="Why the Saudi Pro League matters">
          <p className="feed-line">
            The Saudi Pro League's calibre multiplier sits between the Championship and Ligue 1.
            Players under 24 in the SPL are tracked differently — the league inflates counting stats
            but doesn't test pressing resistance. A dominant SPL U24 is a signal to watch, not a finished product.
          </p>
          <p className="feed-line" style={{marginTop:8}}>
            J-League and K-League are rated more favourably for technical development.
            Players moving from East Asia to La Liga or Bundesliga typically face a 6-month adaptation window.
          </p>
        </Panel>

        <Panel title="Next Step Projection Logic" eyebrow="No hardcoded destination">
          <p className="verdict-line">
            A youth player is not automatically "ready for Championship minutes."
            Calibre projects the correct next environment based on profile, context and readiness score.
            Asian players are assessed against regional league multipliers — not European baselines.
          </p>
        </Panel>
      </section>
    </div>
  );
}
