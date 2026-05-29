import PageHero from '../components/PageHero.jsx';
import Panel from '../components/Panel.jsx';
import Radar from '../components/Radar.jsx';
import Meter from '../components/Meter.jsx';
import { fitRadar } from '../data/calibreData.js';

export default function SystemFit() {
  return (
    <div className="page inner-page">
      <PageHero eyebrow="Player-to-system fit" title="System Fit">
        Match a player’s profile to tactical requirements: role, tempo, pressing load, possession shape and transition value.
      </PageHero>
      <section className="control-bar panel">
        <input placeholder="Search team: FC Barcelona" />
        <input placeholder="Search player: Antony Gordon" />
        <button className="founder-btn" type="button">Run Fit</button>
      </section>
      <section className="dashboard-grid three">
        <Panel title="Fit Radar Breakdown" eyebrow="Gordon → FC Barcelona">
          <Radar items={fitRadar} />
        </Panel>
        <Panel title="Role Analysis" eyebrow="Profile translation">
          <Meter label="Pressing width" value={92} />
          <Meter label="Touchline discipline" value={76} />
          <Meter label="Combination play" value={81} />
          <p className="verdict-line">High-energy winger fits Barça’s pressing and depth threat, but must prove tight-space patience.</p>
        </Panel>
        <Panel title="Alternative System Fits" eyebrow="Best environments">
          {['Liverpool 89%', 'Barcelona 86%', 'Arsenal 82%', 'Dortmund 80%'].map((fit) => <div className="mini-row" key={fit}><strong>{fit.split(' ')[0]}</strong><b>{fit.split(' ')[1]}</b></div>)}
        </Panel>
        <Panel title="Tactical Recommendations" eyebrow="Coach notes">
          <p className="feed-line">Use him as a weak-side runner first, not a primary half-space creator.</p>
          <p className="feed-line">Pair with a Controller to reduce forced touches under pressure.</p>
        </Panel>
        <Panel title="Team Search" eyebrow="System profile">
          <div className="category-cloud"><span>4-3-3</span><span>High press</span><span>Wide overload</span><span>Positional play</span></div>
        </Panel>
        <Panel title="Fit Verdict" eyebrow="Sharp, defensible">
          <p className="verdict-line">The fit is real because the work rate travels. The risk is not effort. It is whether his chaos can become controlled danger.</p>
        </Panel>
      </section>
    </div>
  );
}
