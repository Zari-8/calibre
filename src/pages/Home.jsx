import { ArrowRight, Flame, Star, Crown } from 'lucide-react';
import BattleHero from '../components/BattleHero.jsx';
import Panel from '../components/Panel.jsx';
import StatCard from '../components/StatCard.jsx';
import Meter from '../components/Meter.jsx';
import PlayerImage from '../components/PlayerImage.jsx';
import { competitions, players, rateBattles, talents } from '../data/calibreData.js';
import { navigateTo } from '../components/NavLink.jsx';

function TrendLine() {
  return <svg className="spark" viewBox="0 0 100 32" aria-hidden="true"><polyline points="0,24 18,22 32,15 48,17 62,10 80,9 100,3" /></svg>;
}

function HexRadar() {
  return <div className="hex-radar"><i /><i /><i /><b /></div>;
}

export default function Home() {
  return (
    <div className="page home-page">
      <section className="hero-grid">
        <BattleHero />
        <aside className="right-rail">
          <Panel title="Trending Battles" eyebrow="🔥 Debate Index" action="View all">
            <div className="stack-list trends">
              {rateBattles.map((battle, index) => (
                <div className="trend-row" key={battle.title}>
                  <div className="avatar-pair"><img src={index === 0 ? '/assets/players/kylian-mbappe.jpg' : '/assets/players/vinicius-junior.jpg'} /><img src={index === 0 ? '/assets/players/jude-bellingham.jpg' : '/assets/players/pedri.jpg'} /></div>
                  <div><strong>{battle.title}</strong><span>{battle.votes} votes</span></div>
                  <TrendLine />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="System Fit" eyebrow="◎ Gordon in FC Barcelona" className="system-card-home">
            <div className="system-grid">
              <img className="gordon-img" src="/assets/players/gordon.jpg" alt="Gordon mockup" />
              <HexRadar />
              <div className="fit-score"><strong>86%</strong><span>Fit score</span></div>
            </div>
            <div className="dot-metrics"><span>Width <b>87</b></span><span>Pressing <b>83</b></span><span>Transition <b>83</b></span></div>
            <p>Good fit for Barça’s wide rotations and high-tempo transitions.</p>
          </Panel>

          <Panel title="World Cup Breakout Star" eyebrow="⭐ Scout Pulse" className="breakout-card">
            <img src="/assets/players/ibrahim-musa.jpg" alt="Ibrahim Musa" />
            <div><strong>The next<br />hero?</strong><span>Scouted. Analysed.<br />Ready to explode.</span></div>
            <button type="button">See shortlist <ArrowRight size={15} /></button>
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
        <Panel title="Featured Archetype" eyebrow="Press-Resistant Midfielder" className="archetype-panel">
          <div className="archetype-card"><img src="/assets/players/vitinha.jpg" alt="Vitinha" /><div className="score-orb">89<span>Archetype score</span></div><div><strong>Vitinha</strong><span>Paris Saint-Germain</span></div></div>
          <Meter label="Press Resistance" value={92} />
        </Panel>

        <Panel title="Competitions Snapshot" eyebrow="Leagues" className="table-panel">
          <div className="mini-table">
            {competitions.slice(0, 4).map((league) => <div key={league.name}><span>{league.name}</span><b>W D W W</b><em>{league.topScorer}</em></div>)}
          </div>
        </Panel>

        <Panel title="Rising Talents" eyebrow="View all">
          {players.slice(2, 6).map((player, index) => <div className="mini-row" key={player.name}><div><strong>{player.name}</strong><span>{player.role} · {player.team}</span></div><b>{87 - index * 2} +{4 + index}</b></div>)}
        </Panel>

        <Panel title="Live Debates" eyebrow="Join the conversation">
          {rateBattles.map((battle, i) => <button className="battle-chip" key={battle.title} onClick={() => navigateTo('/debates')}>{battle.question}<span>{i === 0 ? 'HOT' : i === 1 ? 'LIVE' : 'NEW'}</span></button>)}
        </Panel>
      </section>

      <section className="founder-strip">
        <Crown size={34} /><strong>Get World Cup Founder Pass</strong><span>Unlock premium insights, advanced filters & exclusive World Cup content.</span><button type="button">Explore plans <ArrowRight size={17} /></button>
      </section>
    </div>
  );
}
