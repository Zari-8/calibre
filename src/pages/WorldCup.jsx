import { useState } from 'react';
import { Star, Zap, Trophy, ArrowRight } from 'lucide-react';
import Panel from '../components/Panel.jsx';
import { navigateTo } from '../components/NavLink.jsx';
import {
  WC_CONFIG,
  liveMoments,
  breakoutStars,
  iconicEditions,
  iconicGoals,
  tournamentPlayers,
  wcFacts,
} from '../data/worldCupData.js';

// ── Countdown ────────────────────────────────────────────────────
function useDaysToWC() {
  const kick = new Date(WC_CONFIG.kickoff);
  const now  = new Date();
  return Math.max(0, Math.ceil((kick - now) / 86400000));
}

function formatMomentTime(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ── Sub-components ───────────────────────────────────────────────
function SectionHead({ eyebrow, title }) {
  return (
    <div className="wc-section-head">
      <span className="wc-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
    </div>
  );
}

function MomentBadge({ type }) {
  const MAP = {
    goal:      { label: 'GOAL',      cls: 'mb-goal'  },
    red_card:  { label: 'RED CARD',  cls: 'mb-red'   },
    var:       { label: 'VAR',       cls: 'mb-var'   },
    milestone: { label: 'MILESTONE', cls: 'mb-mile'  },
    upset:     { label: 'UPSET',     cls: 'mb-upset' },
    stat:      { label: 'STAT',      cls: 'mb-stat'  },
  };
  const b = MAP[type] || { label: type, cls: 'mb-stat' };
  return <span className={`moment-badge ${b.cls}`}>{b.label}</span>;
}

function BreakoutCard({ star }) {
  return (
    <div className={`wc-breakout-card ${star.featured ? 'wc-breakout-card--featured' : ''}`}>
      {star.featured && <div className="wc-featured-tag">Featured</div>}
      <div className="wc-bc-top">
        <img src={star.image} alt={star.name} className="wc-bc-img" />
        <div className="wc-bc-meta">
          <div className="wc-bc-flag">{star.flag} {star.nation}</div>
          <strong className="wc-bc-name">{star.name}</strong>
          <span className="wc-bc-role">{star.role} · {star.club}</span>
          <div className="wc-bc-rating">
            <span className="wc-bc-score">{star.wcRating}</span>
            <span className="wc-bc-trend">{star.trend}</span>
          </div>
        </div>
      </div>
      <div className="wc-bc-stats">
        <div className="wc-bc-stat"><b>{star.matches}</b><span>Matches</span></div>
        <div className="wc-bc-stat"><b>{star.goals}</b><span>Goals</span></div>
        <div className="wc-bc-stat"><b>{star.assists}</b><span>Assists</span></div>
      </div>
      <p className="wc-bc-note">"{star.note}"</p>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
export default function WorldCup() {
  const daysLeft = useDaysToWC();
  const isLive   = daysLeft === 0;

  const [activeEdition,  setActiveEdition]  = useState(iconicEditions[iconicEditions.length - 1]);
  const [momentFilter,   setMomentFilter]   = useState('all');
  const [factCategory,   setFactCategory]   = useState('all');
  const [factSearch,     setFactSearch]     = useState('');

  const filteredMoments = momentFilter === 'all'
    ? liveMoments
    : liveMoments.filter(m => m.type === momentFilter);

  const FACT_CATS = ['all', 'tournament', 'goals', 'players', 'hosts', 'records', 'curiosities'];

  const filteredFacts = wcFacts.filter(f => {
    const matchCat    = factCategory === 'all' || f.category === factCategory;
    const matchSearch = !factSearch || f.fact.toLowerCase().includes(factSearch.toLowerCase()) ||
                        f.tags.some(t => t.toLowerCase().includes(factSearch.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div className="page wc-page">

      {/* ── HERO ── */}
      <div className="wc-hero">
        <div className="wc-hero-eyebrow"><Trophy size={16} /> {WC_CONFIG.edition}</div>
        <h1 className="wc-hero-title">
          {isLive ? "It's happening." : `${daysLeft} days away.`}
        </h1>
        <p className="wc-hero-sub">
          {isLive
            ? 'Live moments, breakout stars, and the data behind the tournament.'
            : `${WC_CONFIG.hosts.join(' · ')} · Kickoff ${new Date(WC_CONFIG.kickoff).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
          }
        </p>
        <div className="wc-host-flags">🇺🇸 USA &nbsp;·&nbsp; 🇨🇦 Canada &nbsp;·&nbsp; 🇲🇽 Mexico</div>
        {!isLive && (
          <div className="wc-countdown-strip">
            <div className="wc-cd-cell"><strong>{daysLeft}</strong><span>Days</span></div>
            <div className="wc-cd-cell"><strong>48</strong><span>Teams</span></div>
            <div className="wc-cd-cell"><strong>104</strong><span>Matches</span></div>
            <div className="wc-cd-cell"><strong>16</strong><span>Stadiums</span></div>
          </div>
        )}
      </div>

      {/* ── LIVE MOMENTS ── */}
      <section className="wc-section">
        <SectionHead eyebrow="Tournament Feed" title="Live Moments" />
        <div className="wc-moment-filters">
          {['all', 'goal', 'red_card', 'upset', 'milestone', 'stat'].map(f => (
            <button key={f} type="button"
              className={momentFilter === f ? 'wc-mf-btn active' : 'wc-mf-btn'}
              onClick={() => setMomentFilter(f)}
            >
              {f === 'all' ? 'All' : f.replace('_', ' ')}
            </button>
          ))}
        </div>
        {filteredMoments.length === 0 ? (
          <div className="wc-moments-empty">
            {liveMoments.length === 0
              ? "The tournament hasn't started yet. Moments will appear here as the games are played."
              : 'No moments of this type yet.'
            }
          </div>
        ) : (
          <div className="wc-moments-feed">
            {[...filteredMoments]
              .sort((a, b) => new Date(b.time) - new Date(a.time))
              .map(m => (
                <div key={m.id} className={`wc-moment ${m.featured ? 'wc-moment--featured' : ''}`}>
                  <div className="wc-moment-left">
                    <MomentBadge type={m.type} />
                    <span className="wc-moment-match">{m.match}</span>
                    <span className="wc-moment-time">{formatMomentTime(m.time)}</span>
                  </div>
                  <p className="wc-moment-text">{m.text}</p>
                </div>
              ))
            }
          </div>
        )}
      </section>

      {/* ── BREAKOUT STARS ── */}
      <section className="wc-section">
        <SectionHead eyebrow="Scout Pulse" title="Tournament Breakout Stars" />
        <div className="wc-breakout-grid">
          {breakoutStars.map(s => <BreakoutCard key={s.id} star={s} />)}
        </div>
      </section>

      {/* ── WORLD CUP FACTS ── */}
      <section className="wc-section">
        <SectionHead eyebrow="Did You Know" title="World Cup Facts" />
        <div className="wc-facts-controls">
          <div className="wc-fact-cats">
            {FACT_CATS.map(c => (
              <button key={c} type="button"
                className={factCategory === c ? 'wc-fact-cat active' : 'wc-fact-cat'}
                onClick={() => setFactCategory(c)}
              >
                {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
                {c !== 'all' && (
                  <span className="wc-fact-count">
                    {wcFacts.filter(f => f.category === c).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <input
            className="wc-fact-search"
            type="text"
            placeholder="Search facts, players, nations..."
            value={factSearch}
            onChange={e => setFactSearch(e.target.value)}
          />
        </div>
        <div className="wc-facts-grid">
          {filteredFacts.map(f => (
            <div key={f.id} className={`wc-fact-card wc-fact-cat--${f.category}`}>
              <div className="wc-fact-emoji">{f.emoji}</div>
              <p className="wc-fact-text">{f.fact}</p>
              <div className="wc-fact-tags">
                <span className="wc-fact-cat-label">{f.category}</span>
                {f.tags.slice(0, 2).map(t => (
                  <span key={t} className="wc-fact-tag"
                    onClick={() => setFactSearch(t)}
                    style={{ cursor: 'pointer' }}
                  >{t}</span>
                ))}
              </div>
            </div>
          ))}
          {filteredFacts.length === 0 && (
            <div className="wc-facts-empty">No facts match that search.</div>
          )}
        </div>
      </section>

      {/* ── ICONIC EDITIONS ── */}
      <section className="wc-section">
        <SectionHead eyebrow="History" title="Iconic Editions" />
        <div className="wc-editions-layout">
          <div className="wc-edition-selector">
            {iconicEditions.map(ed => (
              <button key={ed.year} type="button"
                className={`wc-edition-btn ${activeEdition.year === ed.year ? 'active' : ''}`}
                onClick={() => setActiveEdition(ed)}
              >
                <span className="wc-ed-flag">{ed.flag}</span>
                <span className="wc-ed-year">{ed.year}</span>
                <span className="wc-ed-host">{ed.host}</span>
              </button>
            ))}
          </div>
          <div className="wc-edition-detail">
            <div className="wc-ed-detail-top">
              <div>
                <div className="wc-ed-detail-flag">{activeEdition.flag}</div>
                <h3>{activeEdition.year} · {activeEdition.host}</h3>
                <div className="wc-ed-winner">Winners: <strong>{activeEdition.winner}</strong></div>
              </div>
              <div className="wc-calibre-score">
                <strong>{activeEdition.calibreScore}</strong>
                <span>Calibre Score</span>
              </div>
            </div>
            <p className="wc-ed-theme">"{activeEdition.theme}"</p>
            <p className="wc-ed-summary">{activeEdition.summary}</p>
            <div className="wc-ed-moment">
              <Zap size={13} style={{ color: 'var(--lime)', flexShrink: 0 }} />
              <span>{activeEdition.moment}</span>
            </div>
            <div className="wc-ed-players">
              {activeEdition.players.map(p => (
                <span key={p} className="wc-player-chip">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ICONIC GOALS ── */}
      <section className="wc-section">
        <SectionHead eyebrow="Greatest Moments" title="Goals That Defined the Tournament" />
        <div className="wc-goals-grid">
          {iconicGoals.map(g => (
            <div className="wc-goal-card" key={`${g.year}-${g.scorer}`}>
              <div className="wc-goal-top">
                <span className="wc-goal-flag">{g.flag}</span>
                <div>
                  <strong>{g.scorer}</strong>
                  <span>{g.nation} vs {g.vs} · {g.year}</span>
                </div>
                <span className="wc-goal-year-badge">{g.year}</span>
              </div>
              <div className="wc-goal-label">{g.label}</div>
              <p>{g.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── GOLDEN BALL HISTORY ── */}
      <section className="wc-section">
        <SectionHead eyebrow="Player of the Tournament" title="Golden Ball History" />
        <div className="wc-award-grid">
          {tournamentPlayers.map(t => (
            <div className="wc-award-row" key={t.year}>
              <span className="wc-award-year">{t.year}</span>
              <span className="wc-award-flag">{t.flag}</span>
              <strong className="wc-award-player">{t.player}</strong>
              <span className="wc-award-label">{t.award}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <div className="wc-cta-strip">
        <Trophy size={22} style={{ color: 'var(--lime)' }} />
        <div>
          <strong>Get World Cup Founder Pass</strong>
          <span>Unlock deeper tournament data, player breakdowns and scout tools.</span>
        </div>
        <button type="button" onClick={() => navigateTo('/pricing')}>
          Get Founder Pass <ArrowRight size={14} />
        </button>
      </div>

    </div>
  );
}
