import PageHero from '../components/PageHero.jsx';
import Panel from '../components/Panel.jsx';
import Meter from '../components/Meter.jsx';
import { leagueMultipliers, talents } from '../data/calibreData.js';

export default function Talents() {
  return (
    <div className="page inner-page">
      <PageHero eyebrow="Talent Discovery dashboard" title="Talents">
        Next Step Projection adapts to rating, age, role, minutes, league difficulty, trajectory and readiness.
      </PageHero>
      <section className="dashboard-grid three">
        <Panel title="Scout Shortlist" eyebrow="Emerging stars">
          {talents.map((talent) => <div className="talent-card" key={talent.name}><div><strong>{talent.name}</strong><span>{talent.age} · {talent.role} · {talent.league}</span></div><b>{talent.trend}</b><p>Next Step: {talent.nextStep}</p><Meter label="Readiness" value={talent.readiness} /></div>)}
        </Panel>
        <Panel title="Regional Map" eyebrow="Scouted regions">
          <div className="map-grid"><span>West Africa</span><span>Southern Africa</span><span>South America</span><span>Eastern Europe</span><span>Academy/U21</span></div>
        </Panel>
        <Panel title="Trajectory Arrows" eyebrow="Growth signal">
          {talents.map((talent) => <div className="mini-row" key={talent.name}><strong>{talent.name}</strong><b>↗ {talent.trend}</b></div>)}
        </Panel>
        <Panel title="League Difficulty Multiplier" eyebrow="Context layer">
          {leagueMultipliers.map((league) => <div className="mini-row" key={league.league}><div><strong>{league.league}</strong><span>{league.tone}</span></div><b>{league.multiplier.toFixed(2)}</b></div>)}
        </Panel>
        <Panel title="Next Step Projection Logic" eyebrow="No hardcoded destination">
          <p className="verdict-line">A youth player is not automatically “ready for Championship minutes.” Calibre projects the correct next environment based on profile, context and readiness.</p>
        </Panel>
        <Panel title="Minor-League Discovery" eyebrow="Why this matters">
          <p className="feed-line">A dominant NPFL creator and a solid Bundesliga creator should not be read with the same raw scale. Context turns noise into scouting signal.</p>
        </Panel>
      </section>
    </div>
  );
}
