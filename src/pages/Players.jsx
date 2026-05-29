import PageHero from '../components/PageHero.jsx';
import Panel from '../components/Panel.jsx';
import PlayerImage from '../components/PlayerImage.jsx';
import RatingBreakdown from '../components/RatingBreakdown.jsx';
import Meter from '../components/Meter.jsx';
import { players } from '../data/calibreData.js';

export default function Players() {
  const featured = players[0];
  return (
    <div className="page inner-page">
      <PageHero eyebrow="Searchable database" title="Players">
        Filter by archetype, league, role, debate pull and Calibre Rating architecture — not FIFA-style overall scores.
      </PageHero>
      <section className="control-bar panel">
        <input placeholder="Search 186,000 players" />
        <select><option>All roles</option><option>Controller</option><option>Inside Forward</option><option>Target Man</option></select>
        <select><option>All leagues</option><option>La Liga</option><option>Bundesliga</option><option>NPFL</option></select>
      </section>
      <section className="dashboard-grid player-layout">
        <Panel title="Featured Player" eyebrow="Calibre profile" className="feature-player-panel">
          <div className="player-profile-card"><PlayerImage player={featured} /><div><h2>{featured.name}</h2><p>{featured.team} · {featured.role} · {featured.archetype}</p><strong className="giant-rating">{featured.rating}</strong></div></div>
          <RatingBreakdown player={featured} />
        </Panel>
        <Panel title="Compare Players" eyebrow="Profile clash">
          <div className="compare-row"><span>Pedri</span><b>Control</b><span>Jude</span></div>
          <Meter label="System protection vs game attack" value={94} />
          <p className="verdict-line">Pedri protects the system. Jude attacks the game. That is the argument.</p>
        </Panel>
        <Panel title="Rising Players" eyebrow="Form + trajectory">
          {players.slice(2).map((player) => <div className="mini-row" key={player.name}><div><strong>{player.name}</strong><span>{player.archetype} · {player.league}</span></div><b>{player.trajectory}</b></div>)}
        </Panel>
        <Panel title="Archetype Distribution" eyebrow="Icon system">
          <div className="category-cloud icons"><span>🚂 Pressing Engine</span><span>🎼 Deep-Lying Playmaker</span><span>🪄 Advanced Playmaker</span><span>🛡 Ball Winner</span><span>🗡 Inside Forward</span><span>🦊 Poacher</span></div>
        </Panel>
      </section>
    </div>
  );
}
