import React from "react";
import { battles } from "../data/mockData.js";

export default function SidebarPanels() {
  return (
    <aside className="sidebarStack">
      <section className="panel">
        <div className="panelTitle">🔥 Trending Battles <a href="/debates">View all</a></div>
        {battles.map((battle) => (
          <div className="trendRow" key={battle.question}>
            <div className="duoAvatars"><div /><div /></div>
            <div>
              <strong>{battle.a.name} vs {battle.b.name}</strong>
              <span>{battle.votes.toLocaleString()} votes</span>
            </div>
            <div className="sparkLine" />
          </div>
        ))}
      </section>

      <section className="panel systemMini">
        <div className="panelTitle">☼ System Fit</div>
        <p>Gordon in FC Barcelona</p>
        <div className="systemMiniGrid">
          <div className="playerSilhouette" />
          <div className="miniRadar" />
          <div className="fitNumber"><strong>86%</strong><span>Fit Score</span></div>
        </div>
        <div className="fitBars">
          <div><span>Width</span><b style={{ width: "87%" }} /><strong>87</strong></div>
          <div><span>Pressing</span><b style={{ width: "83%" }} /><strong>83</strong></div>
          <div><span>Transition</span><b style={{ width: "88%" }} /><strong>88</strong></div>
        </div>
      </section>

      <section className="panel breakoutPanel">
        <div>
          <div className="panelTitle">⭐ World Cup Breakout Star</div>
          <strong>The next tournament hero?</strong>
          <p>Scouted. Analysed. Ready to explode.</p>
          <a className="smallCta" href="/talents">See shortlist →</a>
        </div>
        <div className="worldCupOrb" />
      </section>
    </aside>
  );
}
