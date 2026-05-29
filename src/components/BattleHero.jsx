import { useState, useEffect } from 'react';
import { Zap, Target, Star, MessageSquare, GaugeCircle, Users } from 'lucide-react';
import { players } from '../data/calibreData.js';
import PlayerImage from './PlayerImage.jsx';

function useCountdown() {
  const getTimeLeft = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    const diff = Math.max(0, tomorrow - now);
    return {
      h: String(Math.floor(diff / 3600000)).padStart(2, '0'),
      m: String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'),
      s: String(Math.floor((diff % 60000) / 1000)).padStart(2, '0'),
    };
  };
  const [time, setTime] = useState(getTimeLeft);
  useEffect(() => {
    const t = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

const CATEGORIES = [
  ['Control', Target],
  ['Impact', Zap],
  ['Creativity', Star],
  ['Debate', MessageSquare],
];

const PROOF = [
  ['Archetypes', GaugeCircle],
  ['63 Leagues', Target],
  ['186,000 Players Tracked', Users],
  ['System Fit', Target],
  ['Talent Discovery', GaugeCircle],
];

export default function BattleHero() {
  const pedri = players[0];
  const jude  = players[1];
  const { h, m, s } = useCountdown();

  const [activeCategory, setActiveCategory] = useState('Control');
  const [rating, setRating] = useState(5);
  const [voted, setVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(31248);

  function handleRate(n) {
    setRating(n);
    if (!voted) {
      setVoted(true);
      setVoteCount(c => c + 1);
    }
  }

  return (
    <section className="battle-hero">
      {/* top bar */}
      <div className="battle-topline">
        <div className="countdown">
          <Zap size={21} />
          <div className="countdown-inner">
            <span className="countdown-digits">{h} : {m} : {s}</span>
            <small>HRS&nbsp;&nbsp;&nbsp;MINS&nbsp;&nbsp;&nbsp;SECS</small>
          </div>
        </div>
        <div className="avatar-voters">
          {[pedri, jude, players[2]].map(p => (
            <img key={p.name} className="voter-thumb" src={p.localImage} alt={p.name} />
          ))}
        </div>
        <div className="vote-box">
          <strong>{voteCount.toLocaleString()}</strong>
          <span>Votes</span>
        </div>
      </div>

      {/* RATE BATTLE title */}
      <div className="battle-title-lockup">
        <h1><span>RATE</span><span className="lime-word">BATTLE</span></h1>
      </div>

      {/* players */}
      <div className="fighter fighter-left">
        <div className="club-ghost barca">FCB</div>
        <PlayerImage player={pedri} />
        <div className="fighter-name">
          <strong>Pedri</strong>
          <span>Barcelona</span>
        </div>
      </div>

      <div className="fighter fighter-right">
        <div className="club-ghost madrid">RM</div>
        <PlayerImage player={jude} />
        <div className="fighter-name">
          <strong>Jude<br />Bellingham</strong>
          <span>Real Madrid</span>
        </div>
      </div>

      {/* rating control */}
      <div className="rate-control">
        <div className="category-line">
          <span className="cat-label">who gives more:</span>
          {CATEGORIES.map(([label, Icon]) => (
            <button
              key={label}
              type="button"
              className={activeCategory === label ? 'cat-pill active' : 'cat-pill'}
              onClick={() => setActiveCategory(label)}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        <div className="vs-mark">VS</div>

        <div className="question-box">
          <h2>Who owns the <mark>midfield?</mark></h2>
          <small><Users size={12} style={{verticalAlign:'middle',marginRight:4}} />{voteCount.toLocaleString()} votes</small>
          <b>↓ Tap to rate ↓</b>
          <div className="tap-scale" aria-label="Rate 1 to 10">
            {Array.from({ length: 10 }, (_, i) => (
              <button
                key={i + 1}
                type="button"
                className={rating === i + 1 ? 'selected' : ''}
                onClick={() => handleRate(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="scale-labels">
            <span className="label-left">Pedri</span>
            <span>Equal</span>
            <span className="label-right">Bellingham</span>
          </div>
          {voted && (
            <div className="vote-confirm">
              ✓ Your rating adds to the community score
            </div>
          )}
        </div>
      </div>

      {/* proof strip */}
      <div className="proof-strip">
        {PROOF.map(([label, Icon]) => (
          <span key={label}><Icon size={18} />{label}</span>
        ))}
      </div>
    </section>
  );
}
