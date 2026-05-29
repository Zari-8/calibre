import BattleHero from '../components/BattleHero.jsx';
import Panel from '../components/Panel.jsx';
import StatCard from '../components/StatCard.jsx';
import Meter from '../components/Meter.jsx';
import PlayerImage from '../components/PlayerImage.jsx';
import { competitions, players, rateBattles, talents } from '../data/calibreData.js';
import { navigateTo } from '../components/NavLink.jsx';

export default function Home() {
  return (
    <div className="page home-page">
      <section className="hero-grid">
        <BattleHero />
        <aside className="right-rail">
          <Panel title="Trending Battles" eyebrow="Debate Index">
            <div className="stack-list">
              {rateBattles.map((battle) => (
                <div className="mini-row" key={battle.title}>
                  <div><strong>{battle.title}</strong><span>{battle.question}</span></div>
                  <b>{battle.heat}</b>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Gordon in FC Barcelona" eyebrow="System Fit mockup" className="fit-card-mini">
            <div className="fit-score-ring">86%</div>
            <p>Wide runner profile tests as a high-tempo squad fit: pressing, depth threat, defensive work rate.</p>
          </Panel>
          <Panel title="World Cup Breakout Star" eyebrow="Scout pulse">
            <div className="mini-row talent-pulse"><strong>{talents[0].name}</strong><b>{talents[0].trend}</b></div>
            <p className="muted">Next Step: {talents[0].nextStep}</p>
          </Panel>
        </aside>
      </section>

      <section className="data-row segmented">
        <StatCard label="Data-Driven Player Insights" value="Live engine" />
        <StatCard label="1.2M+ Data Points Daily" value="Tracking" />
        <StatCard label="AI Models" value="Proprietary & Trained" />
        <StatCard label="Trusted By" value="Clubs & Scouts" />
        <StatCard label="Global Coverage" value="200+ Countries" />
      </section>

      <section className="dashboard-grid lower-dashboard">
        <Panel title="Featured Archetype" eyebrow="Role language">
          <div className="archetype-feature"><span>🧙</span><div><strong>Advanced Playmaker</strong><p>Magic Wand profile: chance creation, disguise, tempo disruption, final pass.</p></div></div>
          <Meter label="Debate pull" value={91} />
        </Panel>
        <Panel title="Competitions Snapshot" eyebrow="63 leagues">
          <div className="league-stack">
            {competitions.slice(0, 3).map((league) => <div key={league.name}><span>{league.name}</span><strong>{league.calibre}</strong></div>)}
          </div>
        </Panel>
        <Panel title="Rising Talents" eyebrow="Trajectory engine">
          {talents.slice(0, 3).map((talent) => <div className="mini-row" key={talent.name}><div><strong>{talent.name}</strong><span>{talent.role} · {talent.league}</span></div><b>{talent.trend}</b></div>)}
        </Panel>
        <Panel title="Live Debates" eyebrow="Fan pulse">
          {rateBattles.map((battle) => <button className="battle-chip" key={battle.title} onClick={() => navigateTo('/debates')}>{battle.title}<span>{battle.votes}</span></button>)}
        </Panel>
        <Panel title="Founder Pass CTA" eyebrow="World Cup window" className="cta-panel">
          <h3>Get World Cup Founder Pass</h3>
          <p>Unlock deeper profile debates, system-fit cards and talent discovery drops before the tournament noise peaks.</p>
          <button className="founder-btn wide" type="button">Get World Cup Founder Pass</button>
        </Panel>
        <Panel title="Featured Player" eyebrow="Not a FIFA overall">
          <div className="featured-player-row"><PlayerImage player={players[2]} /><div><strong>{players[2].name}</strong><span>{players[2].archetype} · {players[2].rating}</span><p>Calibre separates talent profile from raw hype using form, consistency, impact and trajectory.</p></div></div>
        </Panel>
      </section>
    </div>
  );
}
