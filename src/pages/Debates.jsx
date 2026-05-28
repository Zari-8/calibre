import React from "react";
import PageHeader from "../components/PageHeader.jsx";
import RatingScale from "../components/RatingScale.jsx";
import { battles } from "../data/mockData.js";
import { calculateDebateIndex, getDebateLabel } from "../data/calibreEngine.js";

export default function Debates() {
  return (
    <main className="page">
      <PageHeader
        eyebrow="Rate Battles"
        title="Football arguments with a scoreboard."
        copy="Active battles, fan nominations, category filters and Debate Index heat. This page keeps the rate-card visual language from the homepage but expands it into a live debate room."
      />

      <section className="debatesLayout">
        <article className="module battleRoom">
          <h2>Active Rate Battle</h2>
          <div className="battleArena">
            <div className="battlePlayer left"><div className="avatarMega" /><strong>{battles[0].a.name}</strong><span>{battles[0].a.archetype}</span></div>
            <div className="battleCore">
              <div className="vs">VS</div>
              <h3>{battles[0].question}</h3>
              <div className="debateIndex">
                Debate Index <b>{calculateDebateIndex(battles[0].a, battles[0].b)}</b> · {getDebateLabel(calculateDebateIndex(battles[0].a, battles[0].b))}
              </div>
              <RatingScale left={battles[0].a.name} right={battles[0].b.name} />
            </div>
            <div className="battlePlayer right"><div className="avatarMega" /><strong>{battles[0].b.name}</strong><span>{battles[0].b.archetype}</span></div>
          </div>
        </article>

        <aside className="sideColumn">
          <article className="panel">
            <div className="panelTitle">Fan Nominations</div>
            {["Rice vs Vitinha", "Yamal vs Saka", "Kane vs Haaland"].map(x => <div className="nomination" key={x}>{x}<button>Vote</button></div>)}
          </article>
          <article className="panel">
            <div className="panelTitle">Upcoming Battle</div>
            <div className="countdownLarge">⚡ 02:18:47</div>
            <p>Next matchup unlocks when the countdown hits zero.</p>
          </article>
        </aside>
      </section>
    </main>
  );
}
