import { Zap } from 'lucide-react';
import { players } from '../data/calibreData.js';
import PlayerImage from './PlayerImage.jsx';

export default function BattleHero() {
  const pedri = players[0];
  const jude = players[1];
  return (
    <section className="battle-hero panel neon-hero">
      <div className="battle-meta top-left"><Zap size={17} /> 14D : 08H : 22M</div>
      <div className="battle-meta top-right">428,912 votes</div>
      <div className="battle-title">
        <p className="eyebrow">Live Rate Battle</p>
        <h1>RATE BATTLE</h1>
      </div>
      <div className="versus-stage">
        <div className="fighter left-fighter">
          <PlayerImage player={pedri} />
          <div className="fighter-copy">
            <strong>Pedri</strong>
            <span>Controller · Puppeteer</span>
          </div>
        </div>
        <div className="versus-core">
          <span className="bolt">⚡</span>
          <small>who gives more:</small>
          <div className="category-pills">
            {['Control', 'Impact', 'Creativity', 'Debate'].map((pill) => <span key={pill}>{pill}</span>)}
          </div>
          <h2>Who owns the midfield?</h2>
          <div className="tap-scale" aria-label="1 to 10 tap to rate scale">
            {Array.from({ length: 10 }, (_, i) => <button key={i + 1} type="button">{i + 1}</button>)}
          </div>
          <div className="battle-separator" />
        </div>
        <div className="fighter right-fighter">
          <PlayerImage player={jude} />
          <div className="fighter-copy">
            <strong>Jude Bellingham</strong>
            <span>Impact 8 · Box Crasher</span>
          </div>
        </div>
      </div>
      <div className="proof-strip">
        {['Archetypes', '63 Leagues', '186,000 Players Tracked', 'System Fit', 'Talent Discovery'].map((proof) => <span key={proof}>{proof}</span>)}
      </div>
    </section>
  );
}
