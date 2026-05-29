import PageHero from '../components/PageHero.jsx';
import Panel from '../components/Panel.jsx';
import Meter from '../components/Meter.jsx';
import { competitions } from '../data/calibreData.js';

export default function Competitions() {
  return (
    <div className="page inner-page">
      <PageHero eyebrow="Competition intelligence" title="Competitions">
        League difficulty multipliers stop a 9/10 in one context being lazily treated like a 9/10 everywhere.
      </PageHero>
      <section className="competitions-layout">
        <aside className="panel competition-sidebar">
          {competitions.map((league) => <button key={league.name}>{league.name}<span>{league.country}</span></button>)}
        </aside>
        <div className="competition-main">
          <Panel title="Featured Competition Hero" eyebrow="La Liga">
            <div className="competition-hero-card"><h2>Control football vs transition power</h2><p>Top scorers, top creators, form swings and debate heat tracked in one competition layer.</p><Meter label="League signal strength" value={92} /></div>
          </Panel>
          <div className="dashboard-grid three compact">
            {competitions.map((league) => <Panel key={league.name} title={league.name} eyebrow={league.country}><Meter label="Calibre multiplier read" value={league.calibre} /><p><b>Top scorer:</b> {league.topScorer}</p><p><b>Top creator:</b> {league.topCreator}</p><p className="muted">Hot debate: {league.debate}</p></Panel>)}
            <Panel title="Standings Snapshot" eyebrow="Live table feel"><div className="league-stack"><div><span>Barcelona</span><strong>1</strong></div><div><span>Real Madrid</span><strong>2</strong></div><div><span>Atlético</span><strong>3</strong></div></div></Panel>
            <Panel title="Fixtures" eyebrow="Next pulse"><p className="feed-line">Barça vs Madrid · Rate War opens 2h before kick-off.</p><p className="feed-line">PSG vs Arsenal · Midfield dominance battle.</p></Panel>
          </div>
        </div>
      </section>
    </div>
  );
}
