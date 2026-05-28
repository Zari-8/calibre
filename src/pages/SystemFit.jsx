import React from "react";
import PageHeader from "../components/PageHeader.jsx";
import { players } from "../data/mockData.js";

export default function SystemFit() {
  const gordon = players.find(p => p.name === "Anthony Gordon");

  return (
    <main className="page">
      <PageHeader
        eyebrow="System Fit"
        title="Talent only matters if the system can use it."
        copy="Compare player traits against club style, tactical role, league demands and development pathway."
      />

      <section className="systemFitPage">
        <article className="module fitHero">
          <div className="playerSilhouette large" />
          <div>
            <span className="eyebrow">Mockup Fit</span>
            <h2>Anthony Gordon in FC Barcelona</h2>
            <p>Gordon gives Barcelona more verticality, pressing bite and transition threat, but the fit depends on whether the left-wing role gives him enough space to run rather than just receive-to-feet.</p>
            <div className="fitScoreBig">86%</div>
          </div>
          <div className="radarBlob large" />
        </article>

        <div className="fitGrid">
          {[
            ["Width", 87],
            ["Pressing", 83],
            ["Transition", 88],
            ["Combination Play", 74],
            ["Final Third Impact", 81],
            ["Role Security", 77]
          ].map(([label, value]) => (
            <article className="fitMetric" key={label}>
              <span>{label}</span>
              <div><b style={{ width: `${value}%` }} /></div>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
