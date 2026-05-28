import React from "react";
import RateBattleHero from "../components/RateBattleHero.jsx";
import SidebarPanels from "../components/SidebarPanels.jsx";
import DataTrustRow from "../components/DataTrustRow.jsx";
import PlayerCard from "../components/PlayerCard.jsx";
import TalentCard from "../components/TalentCard.jsx";
import { players, leagues } from "../data/mockData.js";

export default function Home() {
  return (
    <main className="page">
      <div className="homeGrid">
        <RateBattleHero />
        <SidebarPanels />
      </div>

      <DataTrustRow />

      <section className="dashboardGrid">
        <article className="module wide">
          <h2>Featured Archetype <span>Press-Resistant Midfielder</span></h2>
          <div className="archetypeFeature">
            <PlayerCard player={players[0]} compact />
            <div className="radarBlob" />
          </div>
        </article>

        <article className="module">
          <h2>Competitions Snapshot</h2>
          <table className="calibreTable">
            <thead><tr><th>League</th><th>Multiplier</th><th>Heat</th><th>Top Player</th></tr></thead>
            <tbody>
              {leagues.slice(0, 5).map(league => (
                <tr key={league.name}>
                  <td>{league.name}</td>
                  <td>{league.multiplier}</td>
                  <td>{league.debateHeat}</td>
                  <td>{league.topPlayer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="module">
          <h2>Rising Talents</h2>
          {players.filter(p => p.age <= 22).slice(0, 3).map(player => (
            <div className="miniList" key={player.name}>
              <div className="avatarTiny" />
              <div><strong>{player.name}</strong><span>{player.archetype}</span></div>
              <b>{player.calibreRating}</b>
            </div>
          ))}
        </article>

        <article className="module">
          <h2>Live Debates</h2>
          {["Is Wirtz worth €120M+?", "Best DM in the world?", "Do women players deserve rating parity?"].map((debate, index) => (
            <div className="debateMini" key={debate}>
              <span>{debate}</span><b>{index === 0 ? "HOT" : index === 1 ? "LIVE" : "NEW"}</b>
            </div>
          ))}
          <a className="outlineCta" href="/debates">Join a debate →</a>
        </article>
      </section>

      <section className="founderCta">
        <strong>♛ Get World Cup Founder Pass</strong>
        <span>Unlock premium insights, advanced filters and exclusive World Cup content.</span>
        <button>Explore Plans →</button>
      </section>
    </main>
  );
}
