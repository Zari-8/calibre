import { Zap, Target, Star, MessageSquare, GaugeCircle } from 'lucide-react';
import { players } from '../data/calibreData.js';
import PlayerImage from './PlayerImage.jsx';

export default function BattleHero() {
  const pedri = players[0];
  const jude = players[1];
  const categories = [
    ['Control', Target],
    ['Impact', Zap],
    ['Creativity', Star],
    ['Debate', MessageSquare],
  ];

  return (
    <section className="battle-hero">
      <div className="battle-topline">
        <div className="countdown"><Zap size={21} /><span>02 : 18 : 47</span><small>HRS&nbsp;&nbsp; MINS&nbsp;&nbsp; SECS</small></div>
        <div className="vote-box"><strong>12,458</strong><span>Votes</span></div>
      </div>

      <div className="battle-title-lockup">
        <h1><span>RATE</span><span>BATTLE</span></h1>
      </div>

      <div className="fighter fighter-left">
        <div className="club-ghost barca">FCB</div>
        <PlayerImage player={pedri} />
        <div className="fighter-name"><strong>Pedri</strong><span>Barcelona</span></div>
      </div>

      <div className="fighter fighter-right">
        <div className="club-ghost madrid">RM</div>
        <PlayerImage player={jude} />
        <div className="fighter-name"><strong>Jude<br />Bellingham</strong><span>Real Madrid</span></div>
      </div>

      <div className="rate-control">
        <div className="category-line"><span>who gives more:</span>{categories.map(([label, Icon]) => <button key={label} type="button"><Icon size={13} /> {label}</button>)}</div>
        <div className="vs-mark">VS</div>
        <div className="question-box">
          <h2>Who owns the <mark>midfield?</mark></h2>
          <small>31,248 votes</small>
          <b>Tap to rate</b>
          <div className="tap-scale" aria-label="1 to 10 tap to rate scale">
            {Array.from({ length: 10 }, (_, i) => <button className={i === 4 ? 'selected' : ''} key={i + 1} type="button">{i + 1}</button>)}
          </div>
          <div className="scale-labels"><span>Pedri</span><span>Equal</span><span>Bellingham</span></div>
        </div>
      </div>

      <div className="proof-strip">
        {[['Archetypes', GaugeCircle], ['63 Leagues', Target], ['186,000 Players Tracked', Star], ['System Fit', Target], ['Talent Discovery', GaugeCircle]].map(([proof, Icon]) => <span key={proof}><Icon size={22} />{proof}</span>)}
      </div>
    </section>
  );
}
