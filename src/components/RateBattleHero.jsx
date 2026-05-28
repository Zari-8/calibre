import React, { useMemo, useState } from "react";
import Countdown from "./Countdown.jsx";
import RatingScale from "./RatingScale.jsx";
import ProofStrip from "./ProofStrip.jsx";
import { battles } from "../data/mockData.js";
import { calculateDebateIndex, getDebateLabel } from "../data/calibreEngine.js";

const categoryWords = {
  control: "midfield?",
  impact: "big moments?",
  creativity: "chance creation?",
  debate: "football Twitter?"
};

export default function RateBattleHero() {
  const battle = battles[0];
  const [votes, setVotes] = useState(battle.votes);
  const [category, setCategory] = useState("control");
  const debateIndex = useMemo(() => calculateDebateIndex(battle.a, battle.b), [battle]);

  return (
    <section className="homeHero">
      <div className="heroTop">
        <Countdown />
        <div className="votePill">
          <strong>{votes.toLocaleString()}</strong>
          <span>Votes</span>
        </div>
      </div>

      <div className="heroCenter">
        <h1>Rate <span>Battle</span></h1>

        <div className="categoryPills">
          <span className="pillHint">who gives more:</span>
          {Object.keys(categoryWords).map(key => (
            <button
              key={key}
              className={`categoryPill ${category === key ? "active" : ""}`}
              onClick={() => setCategory(key)}
            >
              {key === "control" ? "◎" : key === "impact" ? "⚡" : key === "creativity" ? "☆" : "▱"} {key}
            </button>
          ))}
        </div>

        <div className="vs">VS</div>

        <div className="playerLabel left">
          <strong>Pedri</strong>
          <span>Barcelona · {battle.a.archetype}</span>
        </div>
        <div className="playerLabel right">
          <strong>Jude<br />Bellingham</strong>
          <span>Real Madrid · {battle.b.archetype}</span>
        </div>

        <div className="ratingCard">
          <div className="question">Who owns the <span>{categoryWords[category]}</span></div>
          <div className="battleMeta">
            <span>{votes.toLocaleString()} votes</span>
            <span>Debate Index {debateIndex} · {getDebateLabel(debateIndex)}</span>
          </div>
          <RatingScale left="Pedri" right="Bellingham" onVote={() => setVotes(v => v + 1)} />
          <ProofStrip />
        </div>
      </div>
    </section>
  );
}
