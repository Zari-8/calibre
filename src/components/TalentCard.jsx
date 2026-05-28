import React from "react";

export default function TalentCard({ player }) {
  const next = player.nextStep;

  return (
    <article className="talentCard">
      <div className="talentHeader">
        <div className="avatarLarge" />
        <div>
          <h3>{player.name}</h3>
          <p>{player.club} · {player.age} · {player.archetype}</p>
        </div>
        <div className="calibreScore">{player.calibreRating}</div>
      </div>

      {next ? (
        <div className="nextStepBox">
          <strong>Next Step: {next.level}</strong>
          <span>{next.suggestedLeagues.join(" · ")}</span>
          <p>{next.reason}</p>
          <small>Caution: {next.caution}</small>
        </div>
      ) : null}
    </article>
  );
}
