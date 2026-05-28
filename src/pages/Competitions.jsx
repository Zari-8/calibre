import React from "react";
import PageHeader from "../components/PageHeader.jsx";
import { leagues } from "../data/mockData.js";

export default function Competitions() {
  return (
    <main className="page">
      <PageHeader
        eyebrow="Competitions"
        title="League context changes everything."
        copy="Calibre does not treat a 9/10 in every league the same. League difficulty multipliers help separate raw dominance from translatable dominance."
      />

      <section className="competitionGrid">
        {leagues.map(league => (
          <article className="leagueCard" key={league.name}>
            <div className="leagueLogo">{league.country.slice(0, 2).toUpperCase()}</div>
            <div>
              <h3>{league.name}</h3>
              <p>{league.country} · {league.players.toLocaleString()} players tracked</p>
            </div>
            <div className="leagueStats">
              <span>Multiplier <b>{league.multiplier}</b></span>
              <span>Debate Heat <b>{league.debateHeat}</b></span>
              <span>Top Player <b>{league.topPlayer}</b></span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
