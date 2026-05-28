import React from "react";
import PageHeader from "../components/PageHeader.jsx";
import TalentCard from "../components/TalentCard.jsx";
import { players } from "../data/mockData.js";

export default function Talents() {
  const talents = players.filter(player => player.age <= 23);

  return (
    <main className="page">
      <PageHeader
        eyebrow="Talent Discovery"
        title="Find the next step, not just the next star."
        copy="Calibre projects talents into the right football environment relative to rating, age, league difficulty, role, minutes and trajectory."
      />

      <section className="talentLayout">
        <article className="module mapPanel">
          <h2>Scouted Regions</h2>
          <div className="mapGlow">AFRICA · EUROPE · SOUTH AMERICA · WOMEN'S FOOTBALL</div>
          <p>Minor-league and youth players are surfaced with trajectory arrows and league translation logic.</p>
        </article>

        <div className="talentGrid">
          {talents.map(player => <TalentCard player={player} key={player.name} />)}
        </div>
      </section>
    </main>
  );
}
