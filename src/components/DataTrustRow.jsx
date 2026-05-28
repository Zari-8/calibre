import React from "react";

const metrics = [
  ["↗", "Data-Driven", "Player insights"],
  ["♙", "1.2M+", "Data points daily"],
  ["⚙", "AI Models", "Proprietary & trained"],
  ["◎", "Trusted By", "Clubs & scouts"],
  ["◉", "Global Coverage", "200+ countries"]
];

export default function DataTrustRow() {
  return (
    <>
      <section className="metricRow">
        {metrics.map(([icon, top, bottom]) => (
          <div className="metric" key={top}>
            <i>{icon}</i>
            <div><strong>{top}</strong><span>{bottom}</span></div>
          </div>
        ))}
      </section>
      <div className="sectionSeparator" />
    </>
  );
}
