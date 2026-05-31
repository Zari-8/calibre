import { ArrowRight, BarChart3, ChevronRight, Compass, Flame, Gauge, Search, ShieldCheck, Sparkles, Target, TrendingUp, Users, Zap } from 'lucide-react';
import BattleHero from '../components/BattleHero.jsx';
import { navigateTo } from '../components/NavLink.jsx';

const activeBattles = [
  { category: 'Impact', left: 'Haaland', right: 'Mbappé', votes: '52.8K', split: '54–46', imageA: '/assets/players/kylian-mbappe.jpg', imageB: '/assets/players/jude-bellingham.jpg' },
  { category: 'Control', left: 'Rice', right: 'Vitinha', votes: '36.5K', split: '51–49', imageA: '/assets/players/florian-wirtz.jpg', imageB: '/assets/players/vitinha.jpg' },
  { category: 'Creativity', left: 'Vini Jr.', right: 'Yamal', votes: '30.4K', split: '57–43', imageA: '/assets/players/vinicius-junior.jpg', imageB: '/assets/players/lamine-yamal.jpg' },
];

const rankings = [
  { rank: 1, name: 'Kylian Mbappé', role: 'Pure striker', rating: 94, image: '/assets/players/kylian-mbappe.jpg' },
  { rank: 2, name: 'Vinícius Júnior', role: 'Inside forward', rating: 93, image: '/assets/players/vinicius-junior.jpg' },
  { rank: 3, name: 'Jude Bellingham', role: 'Box crasher', rating: 92, image: '/assets/players/jude-bellingham.jpg' },
  { rank: 4, name: 'Pedri', role: 'Controller', rating: 91, image: '/assets/players/pedri.jpg' },
];

const talents = [
  { name: 'Ibrahim Musa', origin: 'NPFL · Nigeria', role: 'Wide creator', rating: 77, trend: '+12%', image: '/assets/players/ibrahim-musa.jpg', next: 'Belgian Pro League watchlist' },
  { name: 'Lamine Yamal', origin: 'La Liga · Spain', role: 'Wide creator', rating: 88, trend: '+9.7%', image: '/assets/players/lamine-yamal.jpg', next: 'Elite starter trajectory' },
  { name: 'Florian Wirtz', origin: 'Bundesliga · Germany', role: 'Advanced playmaker', rating: 90, trend: '+5.8%', image: '/assets/players/florian-wirtz.jpg', next: 'Top-five league title contender' },
];

const lanes = [
  { icon: Gauge, title: 'Calibre ratings', text: 'A profile score built from performance, consistency, form, impact and trajectory — not a FIFA overall.', href: '/players', cta: 'Explore ratings' },
  { icon: Target, title: 'System fit', text: 'See why the same player can transform one team and disrupt another. Role, tempo and structure all matter.', href: '/system-fit', cta: 'Test a fit' },
  { icon: Compass, title: 'Talent pathway', text: 'Surface players before the market catches up, then project the next competitive level for their development.', href: '/talents', cta: 'Scout talent' },
];

function Metric({ value, label }) {
  return <div className="home-metric"><strong>{value}</strong><span>{label}</span></div>;
}

export default function Home() {
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero__inner">
          <div className="home-hero__copy">
            <span className="home-eyebrow"><span />Football intelligence for the arguments that matter</span>
            <h1>Rate every player.<br /><em>Understand the difference.</em></h1>
            <p>Calibre turns football opinion into something sharper: live battles, role-based ratings, system-fit verdicts and talent discovery across the game.</p>
            <div className="home-hero__actions">
              <button className="button button--primary" type="button" onClick={() => navigateTo('/players')}>
                Explore the player database <ArrowRight size={16} />
              </button>
              <button className="button button--quiet" type="button" onClick={() => navigateTo('/system-fit')}>
                See system fit <Target size={16} />
              </button>
            </div>
            <div className="home-hero__metrics">
              <Metric value="186K" label="players tracked" />
              <Metric value="63" label="leagues indexed" />
              <Metric value="Live" label="community signal" />
            </div>
          </div>
          <BattleHero />
        </div>
      </section>

      <section className="home-search-band">
        <div className="home-container home-search-band__inner">
          <div>
            <span className="section-kicker">Start with a player</span>
            <h2>Search the football intelligence layer.</h2>
          </div>
          <button className="home-search-box" type="button" onClick={() => navigateTo('/players')}>
            <Search size={18} />
            <span>Search players, clubs, leagues or roles</span>
            <kbd>⌘ K</kbd>
          </button>
        </div>
      </section>

      <section className="home-section home-container">
        <div className="section-title-row">
          <div>
            <span className="section-kicker"><Zap size={13} />Live now</span>
            <h2>Arguments moving the game.</h2>
          </div>
          <button className="section-link" type="button" onClick={() => navigateTo('/debates')}>All debates <ArrowRight size={15} /></button>
        </div>

        <div className="battle-grid">
          {activeBattles.map(battle => (
            <button className="battle-preview" type="button" key={`${battle.left}-${battle.right}`} onClick={() => navigateTo('/debates')}>
              <div className="battle-preview__header">
                <span className="battle-preview__live"><i />Live</span>
                <span>{battle.category}</span>
              </div>
              <div className="battle-preview__players">
                <div><img src={battle.imageA} alt={battle.left} /><strong>{battle.left}</strong></div>
                <span>vs</span>
                <div><img src={battle.imageB} alt={battle.right} /><strong>{battle.right}</strong></div>
              </div>
              <div className="battle-preview__bar"><span style={{ width: battle.split.split('–')[0] + '%' }} /></div>
              <div className="battle-preview__footer"><span>{battle.votes} votes</span><strong>{battle.split}</strong></div>
            </button>
          ))}
        </div>
      </section>

      <section className="home-section home-section--muted">
        <div className="home-container">
          <div className="section-title-row section-title-row--compact">
            <div>
              <span className="section-kicker"><Sparkles size={13} />The intelligence layer</span>
              <h2>More than a leaderboard.</h2>
            </div>
          </div>
          <div className="lane-grid">
            {lanes.map(({ icon: Icon, title, text, href, cta }) => (
              <button className="lane-card" type="button" key={title} onClick={() => navigateTo(href)}>
                <span className="lane-card__icon"><Icon size={20} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="lane-card__cta">{cta} <ChevronRight size={15} /></span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-container home-grid-two">
        <article className="home-panel home-panel--rankings">
          <div className="home-panel__header">
            <div>
              <span className="section-kicker"><TrendingUp size={13} />Global calibre table</span>
              <h2>Players setting the standard.</h2>
            </div>
            <button className="section-link" type="button" onClick={() => navigateTo('/players')}>Full rankings <ArrowRight size={15} /></button>
          </div>
          <div className="ranking-list">
            {rankings.map(player => (
              <button className="ranking-row" type="button" key={player.rank} onClick={() => navigateTo('/players')}>
                <span className="ranking-row__rank">0{player.rank}</span>
                <img src={player.image} alt={player.name} />
                <span className="ranking-row__name"><strong>{player.name}</strong><small>{player.role}</small></span>
                <span className="ranking-row__rating">{player.rating}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="home-panel home-panel--debate">
          <span className="section-kicker"><Flame size={13} />Hot potato of the week</span>
          <h2>Would Arsenal be better with control or chaos?</h2>
          <p>One player protects the shape. The other makes the game harder to control. The numbers say one thing. The profile says another.</p>
          <div className="home-panel--debate__meta">
            <span><Users size={15} />8,421 votes</span>
            <span><BarChart3 size={15} />52–48 split</span>
          </div>
          <button className="button button--primary" type="button" onClick={() => navigateTo('/debates')}>Enter the debate <ArrowRight size={15} /></button>
        </article>
      </section>

      <section className="home-section home-container">
        <div className="section-title-row">
          <div>
            <span className="section-kicker"><Compass size={13} />Scouting radar</span>
            <h2>Find the next step before the market does.</h2>
          </div>
          <button className="section-link" type="button" onClick={() => navigateTo('/talents')}>Talent database <ArrowRight size={15} /></button>
        </div>
        <div className="talent-grid">
          {talents.map(talent => (
            <button className="talent-card" type="button" key={talent.name} onClick={() => navigateTo('/talents')}>
              <img src={talent.image} alt={talent.name} />
              <div className="talent-card__body">
                <div className="talent-card__top"><span>{talent.origin}</span><strong>{talent.trend}</strong></div>
                <h3>{talent.name}</h3>
                <p>{talent.role}</p>
                <div className="talent-card__bottom">
                  <span><ShieldCheck size={14} />{talent.next}</span>
                  <b>{talent.rating}</b>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="home-cta">
        <div className="home-container home-cta__inner">
          <div>
            <span className="section-kicker">World Cup founder pass</span>
            <h2>Get the full intelligence layer before the biggest arguments begin.</h2>
          </div>
          <button className="button button--primary" type="button" onClick={() => navigateTo('/pricing')}>Get World Cup Founder Pass <ArrowRight size={16} /></button>
        </div>
      </section>
    </div>
  );
}
