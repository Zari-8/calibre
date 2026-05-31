import { useEffect, useState } from 'react';
import { ArrowRight, BarChart3, Clock3, MessageCircle, Sparkles, Target, Zap } from 'lucide-react';
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

const categories = [
  { label: 'Control', icon: Target },
  { label: 'Impact', icon: Zap },
  { label: 'Creativity', icon: Sparkles },
  { label: 'Debate', icon: MessageCircle },
];

export default function BattleHero() {
  const { battle, playerA, playerB } = useBattle();
  const [category, setCategory] = useState('Control');
  const [rating, setRating] = useState(null);
  const [votes, setVotes] = useState(12458);
  const { h, m, s } = useCountdown();

  const left = playerA ?? { name: 'Pedri', team: 'FC Barcelona', localImage: '/assets/players/pedri.jpg' };
  const right = playerB ?? { name: 'Jude Bellingham', team: 'Real Madrid', localImage: '/assets/players/jude-bellingham.jpg' };
  const question = battle?.question ?? 'Who owns the midfield?';

  const rate = (number) => {
    if (rating === null) setVotes(v => v + 1);
    setRating(number);
  };

  return (
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
          <p>Rate the argument. The community score moves with every vote.</p>
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
          <div className="battle-category-list">
            {categories.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                className={`battle-category${category === label ? ' is-selected' : ''}`}
                onClick={() => setCategory(label)}
              >
                <Icon size={13} />{label}
              </button>
            ))}
          </div>
        </div>

        <div className="battle-rating">
          <div className="battle-rating__header">
            <span>Move the argument</span>
            <strong>{votes.toLocaleString()} votes</strong>
          </div>
          <div className="battle-rating__scale">
            {Array.from({ length: 10 }, (_, index) => index + 1).map(number => (
              <button
                key={number}
                type="button"
                className={rating === number ? 'is-selected' : ''}
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

        <button className="featured-battle__details" type="button" onClick={() => navigateTo('/debates')}>
          See full debate <ArrowRight size={15} />
        </button>
      </div>

      <div className="featured-battle__footer">
        <span><BarChart3 size={14} />Data-backed profiles</span>
        <span><Zap size={14} />Live community signal</span>
        <span><Target size={14} />System-fit context</span>
      </div>
    </section>
  );
}
