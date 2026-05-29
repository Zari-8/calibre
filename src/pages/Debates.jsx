import PageHero from '../components/PageHero.jsx';
import Panel from '../components/Panel.jsx';
import Meter from '../components/Meter.jsx';
import { rateBattles } from '../data/calibreData.js';

export default function Debates() {
  return (
    <div className="page inner-page">
      <PageHero eyebrow="Rate Battle visual language" title="Debates">
        Debate Index powers the arguments: overrated profiles, underrated production, and instant comparisons within two points.
      </PageHero>
      <section className="dashboard-grid three">
        <Panel title="Active Battles" eyebrow="Live now">
          {rateBattles.map((battle) => <div className="battle-card" key={battle.title}><strong>{battle.title}</strong><p>{battle.question}</p><Meter label={battle.category} value={battle.heat} /></div>)}
        </Panel>
        <Panel title="Upcoming Battles" eyebrow="Scheduled heat">
          {['Best U21 creator worldwide?', 'Is Ter Stegen truly finished?', 'Should women players get equal pay?', 'Pure striker or false nine?'].map((item, index) => <div className="mini-row" key={item}><strong>{item}</strong><b>{index + 1}</b></div>)}
        </Panel>
        <Panel title="Fan Nominations" eyebrow="Community queue">
          {['Rice vs Vitinha', 'Yamal vs Saka', 'Osimhen vs Gyökeres', 'Pedri vs Wirtz'].map((item) => <button className="battle-chip" key={item}>{item}<span>Nominate</span></button>)}
        </Panel>
        <Panel title="Live Debate Feed" eyebrow="Broadcast pulse">
          {['Pedri gives control. Jude gives impact.', 'Vini breaks structure. Mbappé punishes space.', 'Talent rating means nothing without league difficulty.'].map((line) => <p className="feed-line" key={line}>“{line}”</p>)}
        </Panel>
        <Panel title="Debate Index" eyebrow="Virality engine">
          <Meter label="Overrated relative to stats" value={82} />
          <Meter label="Underrated output vs bigger names" value={91} />
          <Meter label="Within 2-point comparison heat" value={96} />
        </Panel>
        <Panel title="Category Breakdown" eyebrow="Why fans argue">
          <div className="category-cloud"><span>Control</span><span>Impact</span><span>Creativity</span><span>Clutch</span><span>System Fit</span><span>Trajectory</span></div>
        </Panel>
      </section>
    </div>
  );
}
