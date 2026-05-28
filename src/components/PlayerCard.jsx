import React from "react";

export default function PlayerCard({ player, compact = false }) {
  return (
    <article className={`playerCard ${compact ? "compact" : ""}`}>
      <div className="avatarLarge" />
      <div className="playerCardBody">
        <div className="playerCardTop">
          <div>
            <h3>{player.name}</h3>
            <p>{player.club} · {player.league}</p>
          </div>
          <div className="calibreScore">{player.calibreRating}</div>
        </div>
        <div className="archetypeBadge">{player.archetype}</div>
        <div className="ratingBreakdown">
          <div><span>Performance</span><b>{player.performance}</b></div>
          <div><span>Consistency</span><b>{player.consistency}</b></div>
          <div><span>Form</span><b>{player.form}</b></div>
          <div><span>Impact</span><b>{player.impact}</b></div>
          <div><span>Trajectory</span><b>{player.trajectory}</b></div>
        </div>
      </div>
    </article>
  );
}
