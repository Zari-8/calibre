import React from "react";

const items = [
  ["♙", "Archetypes", "", "/players"],
  ["◎", "63", "Leagues", "/competitions"],
  ["♧", "186,000", "Players Tracked", "/players"],
  ["☼", "System Fit", "", "/system-fit"],
  ["♜", "Talent", "Discovery", "/talents"]
];

export default function ProofStrip() {
  return (
    <div className="proofStrip">
      {items.map(([icon, top, bottom, href]) => (
        <a className="proofItem" href={href} key={top + bottom}>
          <span className="proofIcon">{icon}</span>
          <span>
            <strong>{top}</strong>
            {bottom ? <small>{bottom}</small> : null}
          </span>
        </a>
      ))}
    </div>
  );
}
