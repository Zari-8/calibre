import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, Clock3, LockKeyhole, MessageCircle, Sparkles, Target, X, Zap } from 'lucide-react';
import { useBattle } from '../hooks/useBattle.js';
import { navigateTo } from './NavLink.jsx';

function useCountdown() {
  const get = () => {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(24, 0, 0, 0);
    const diff = Math.max(0, next - now);
    return {
      h: String(Math.floor(diff / 3600000)).padStart(2, '0'),
      m: String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'),
      s: String(Math.floor((diff % 60000) / 1000)).padStart(2, '0'),
    };
  };
  const [time, setTime] = useState(get);
  useEffect(() => {
    const timer = setInterval(() => setTime(get()), 1000);
    return () => clearInterval(timer);
  }, []);
  return time;
}

const categoryMatrix = [
  {
    label: 'Control',
    icon: Target,
    left: 72,
    right: 28,
    prompt: 'Who gives the midfield more control?',
    note: 'Tempo, press resistance and the ability to protect the structure.',
  },
  {
    label: 'Impact',
    icon: Zap,
    left: 41,
    right: 59,
    prompt: 'Who changes the scoreboard more?',
    note: 'Final-third arrival, match-winning actions and big-game threat.',
  },
  {
    label: 'Creativity',
    icon: Sparkles,
    left: 63,
    right: 37,
    prompt: 'Who creates more for the team?',
    note: 'Progression, chance creation and the quality of the next action.',
  },
];

function ratingToSplit(rating) {
  if (!rating) return null;
  const right = Math.round(((rating - 1) / 9) * 100);
  return { left: 100 - right, right };
}

export default function BattleHero() {
  const { battle, playerA, playerB } = useBattle();
  const [category, setCategory] = useState('Control');
  const [ratings, setRatings] = useState({});
  const [votes, setVotes] = useState(12458);
  const [forumModalOpen, setForumModalOpen] = useState(false);
  const { h, m, s } = useCountdown();

  const left = playerA ?? { name: 'Pedri', team: 'FC Barcelona', localImage: '/assets/players/pedri.jpg' };
  const right = playerB ?? { name: 'Jude Bellingham', team: 'Real Madrid', localImage: '/assets/players/jude-bellingham.jpg' };
  const question = battle?.question ?? 'Who owns the midfield?';
  const activeMatrix = categoryMatrix.find(item => item.label === category) ?? categoryMatrix[0];
  const selectedRating = ratings[category] ?? null;
  const battleSlug = 'pedri-vs-jude';

  const accountExists = useMemo(() => Boolean(window.localStorage.getItem('calibre:user')), []);

  useEffect(() => {
    if (!forumModalOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setForumModalOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [forumModalOpen]);

  const rate = (number) => {
    setRatings(previous => {
      if (!previous[category]) setVotes(value => value + 1);
      return { ...previous, [category]: number };
    });
  };

  const enterForum = () => {
    setForumModalOpen(false);
    navigateTo(`/debates?forum=${battleSlug}${accountExists ? '' : '&auth=required'}`);
  };

  return (
    <>
      <section className="featured-battle" aria-label="Featured rate battle">
        <div className="featured-battle__topline">
          <span className="live-chip"><span className="live-chip__dot" />Live rate battle</span>
          <div className="featured-battle__clock">
            <Clock3 size={14} />
            <span>Next battle in</span>
            <strong>{h}:{m}:{s}</strong>
          </div>
        </div>

        <div className="featured-battle__stage">
          <article className="featured-player featured-player--left">
            <div className="featured-player__image-wrap">
              <div className="featured-player__glow" />
              <img src={left.localImage} alt={left.name} className="featured-player__image" />
            </div>
            <div className="featured-player__meta">
              <span>Controller</span>
              <h3>{left.name}</h3>
              <p>{left.team}</p>
            </div>
          </article>

          <div className="featured-battle__centre">
            <span className="featured-battle__eyebrow">Control vs impact</span>
            <h2>{question}</h2>
            <p>Rate each part of the argument. The matrix changes as the community votes.</p>
            <div className="featured-battle__vs">VS</div>
          </div>

          <article className="featured-player featured-player--right">
            <div className="featured-player__image-wrap">
              <div className="featured-player__glow" />
              <img src={right.localImage} alt={right.name} className="featured-player__image" />
            </div>
            <div className="featured-player__meta">
              <span>Box crasher</span>
              <h3>{right.name}</h3>
              <p>{right.team}</p>
            </div>
          </article>
        </div>

        <div className="featured-battle__controls">
          <div className="battle-category-row">
            <span>Who gives more?</span>
            <div className="battle-category-list" role="tablist" aria-label="Rate battle categories">
              {categoryMatrix.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={category === label}
                  className={`battle-category${category === label ? ' is-selected' : ''}`}
                  onClick={() => setCategory(label)}
                >
                  <Icon size={13} />{label}
                </button>
              ))}
              <button
                type="button"
                className="battle-category battle-category--forum"
                onClick={() => setForumModalOpen(true)}
              >
                <MessageCircle size={13} />Debate
              </button>
            </div>
          </div>

          <div className="battle-matrix" aria-label="Live category rating matrix">
            <div className="battle-matrix__heading">
              <span>Live rating matrix</span>
              <strong>{left.name.split(' ')[0]} <i /> {right.name.split(' ').pop()}</strong>
            </div>
            <div className="battle-matrix__grid">
              {categoryMatrix.map(item => {
                const personalSplit = ratingToSplit(ratings[item.label]);
                const split = personalSplit ?? item;
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={`battle-matrix__item${category === item.label ? ' is-active' : ''}`}
                    onClick={() => setCategory(item.label)}
                  >
                    <span>{item.label}</span>
                    <strong>{split.left}<small>–</small>{split.right}</strong>
                    <div className="battle-matrix__bar"><i style={{ width: `${split.left}%` }} /></div>
                    <em>{personalSplit ? `Your rating: ${ratings[item.label]}/10` : 'Community split'}</em>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="battle-rating">
            <div className="battle-rating__header">
              <span>{activeMatrix.prompt}</span>
              <strong>{votes.toLocaleString()} votes</strong>
            </div>
            <p className="battle-rating__note">{activeMatrix.note}</p>
            <div className="battle-rating__scale">
              {Array.from({ length: 10 }, (_, index) => index + 1).map(number => (
                <button
                  key={number}
                  type="button"
                  className={selectedRating === number ? 'is-selected' : ''}
                  aria-label={`Rate ${category} ${number} out of 10`}
                  onClick={() => rate(number)}
                >
                  {number}
                </button>
              ))}
            </div>
            <div className="battle-rating__labels">
              <span>{left.name.split(' ')[0]}</span>
              <span>Balanced</span>
              <span>{right.name.split(' ').pop()}</span>
            </div>
          </div>

          <button className="featured-battle__details" type="button" onClick={() => setForumModalOpen(true)}>
            Open battle forum <ArrowRight size={15} />
          </button>
        </div>

        <div className="featured-battle__footer">
          <span><BarChart3 size={14} />Data-backed profiles</span>
          <span><Zap size={14} />Live community signal</span>
          <span><Target size={14} />System-fit context</span>
        </div>
      </section>

      {forumModalOpen && (
        <div className="battle-forum-modal" role="presentation" onMouseDown={() => setForumModalOpen(false)}>
          <section
            className="battle-forum-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="battle-forum-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <button className="battle-forum-modal__close" type="button" aria-label="Close forum prompt" onClick={() => setForumModalOpen(false)}>
              <X size={18} />
            </button>
            <span className="battle-forum-modal__kicker"><MessageCircle size={14} />Battle forum</span>
            <h3 id="battle-forum-title">Pedri vs Jude: who owns the midfield?</h3>
            <p>Take the rate battle beyond a single number. The forum keeps the conversation attached to this exact matchup and its live rating matrix.</p>
            <div className="battle-forum-modal__rule">
              <LockKeyhole size={16} />
              <span>{accountExists ? 'Your Calibre account is ready. Enter the discussion.' : 'A Calibre account is required to post and reply in the forum.'}</span>
            </div>
            <button className="button button--primary battle-forum-modal__cta" type="button" onClick={enterForum}>
              {accountExists ? 'Enter battle forum' : 'Continue to account access'} <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}
    </>
  );
}
