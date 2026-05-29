import { useState, useEffect } from 'react';
import { Zap, Target, Star, MessageSquare, GaugeCircle, Users } from 'lucide-react';
import { useBattle } from '../hooks/useBattle.js';
import { navigateTo } from './NavLink.jsx';
import PlayerImage from './PlayerImage.jsx';

/* ── Live countdown to midnight UTC ── */
function useCountdown() {
  const getLeft = () => {
    const now  = new Date();
    const next = new Date(now); next.setUTCHours(24, 0, 0, 0);
    const d    = Math.max(0, next - now);
    return {
      h: String(Math.floor(d / 3600000)).padStart(2, '0'),
      m: String(Math.floor((d % 3600000) / 60000)).padStart(2, '0'),
      s: String(Math.floor((d % 60000) / 1000)).padStart(2, '0'),
    };
  };
  const [t, setT] = useState(getLeft);
  useEffect(() => { const id = setInterval(() => setT(getLeft()), 1000); return () => clearInterval(id); }, []);
  return t;
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
  ['186,000 Players', Users],
  ['System Fit', Target],
  ['Talent Discovery', GaugeCircle],
];

export default function BattleHero() {
  const { battle, playerA, playerB, loading } = useBattle();
  const { h, m, s } = useCountdown();

  const [activeCategory, setActiveCategory] = useState('Control');
  const [rating,  setRating]  = useState(null);
  const [voted,   setVoted]   = useState(false);
  const [votes,   setVotes]   = useState(31248);

  function handleRate(n) {
    setRating(n);
    if (!voted) { setVoted(true); setVotes(v => v + 1); }
  }

  const playerLeft  = playerA ?? { name: 'Pedri',          team: 'Barcelona',   localImage: '/assets/players/pedri.jpg' };
  const playerRight = playerB ?? { name: 'Jude Bellingham', team: 'Real Madrid', localImage: '/assets/players/jude-bellingham.jpg' };
  const question    = battle?.question ?? 'Who owns the midfield?';

  return (
    <section className="battle-hero" onClick={() => navigateTo('/debates')} style={{cursor:'pointer'}} title="View all battles">

      {/* top bar — stop propagation so inner buttons still work */}
      <div className="battle-topline" onClick={e => e.stopPropagation()}>
        <div className="countdown">
          <Zap size={20} />
          <div className="countdown-inner">
            <span className="countdown-digits">{h} : {m} : {s}</span>
            <small>HRS&nbsp;&nbsp;&nbsp;MINS&nbsp;&nbsp;&nbsp;SECS</small>
          </div>
        </div>
        <div className="avatar-voters">
          <img className="voter-thumb" src="/assets/players/kylian-mbappe.jpg" alt="" />
          <img className="voter-thumb" src="/assets/players/lamine-yamal.jpg" alt="" />
          <img className="voter-thumb" src="/assets/players/florian-wirtz.jpg" alt="" />
        </div>
        <div className="vote-box">
          <strong>{votes.toLocaleString()}</strong>
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
        <PlayerImage player={playerLeft} />
        <div className="fighter-name">
          <strong>{playerLeft.name}</strong>
          <span>{playerLeft.team}</span>
        </div>
      </div>

      <div className="fighter fighter-right">
        <div className="club-ghost madrid">RM</div>
        <PlayerImage player={playerRight} />
        <div className="fighter-name fighter-name-right">
          <strong>{playerRight.name}</strong>
          <span>{playerRight.team}</span>
        </div>
      </div>

      {/* rating controls — stop propagation */}
      <div className="rate-control" onClick={e => e.stopPropagation()}>
        <div className="category-line">
          <span className="cat-label">who gives more:</span>
          {CATEGORIES.map(([label, Icon]) => (
            <button
              key={label} type="button"
              className={activeCategory === label ? 'cat-pill active' : 'cat-pill'}
              onClick={() => setActiveCategory(label)}
            >
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>

        <div className="vs-mark">VS</div>

        <div className="question-box">
          <h2>{question.replace(/midfield/i, '').trim()
            ? question
            : <>Who owns the <mark>midfield?</mark></>}
          </h2>
          <small><Users size={11} style={{verticalAlign:'middle',marginRight:3}}/>{votes.toLocaleString()} votes</small>
          <b>↓ Tap to rate ↓</b>
          <div className="tap-scale">
            {Array.from({length:10},(_,i) => (
              <button
                key={i+1} type="button"
                className={rating === i+1 ? 'selected' : ''}
                onClick={() => handleRate(i+1)}
              >{i+1}</button>
            ))}
          </div>
          <div className="scale-labels">
            <span className="label-left">{playerLeft.name.split(' ')[0]}</span>
            <span>Equal</span>
            <span className="label-right">{playerRight.name.split(' ').pop()}</span>
          </div>
          {voted && <div className="vote-confirm">✓ Rating added to community score</div>}
          {!voted && <div className="vote-hint">Your rating adds to the community score</div>}
        </div>
      </div>

      {/* proof strip */}
      <div className="proof-strip" onClick={e => e.stopPropagation()}>
        {PROOF.map(([label, Icon]) => (
          <span key={label}><Icon size={16}/>{label}</span>
        ))}
      </div>

      {/* loading overlay */}
      {loading && (
        <div style={{
          position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
          background:'rgba(0,0,0,.55)', zIndex:20, borderRadius:16,
        }}>
          <span style={{color:'var(--lime)', fontFamily:'Barlow Condensed', fontSize:18, letterSpacing:'.1em'}}>
            LOADING BATTLE...
          </span>
        </div>
      )}
    </section>
  );
}
