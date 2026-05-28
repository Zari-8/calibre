import React, { useState } from "react";

export default function RatingScale({ left = "Pedri", right = "Bellingham", onVote }) {
  const [selected, setSelected] = useState(5);

  return (
    <div className="scaleWrap">
      <div className="tapLabel">↧ Tap to rate ↧</div>
      <div className="ratingScale">
        {Array.from({ length: 10 }, (_, index) => index + 1).map(value => (
          <button
            key={value}
            className={`scoreButton ${selected === value ? "selected" : ""}`}
            onClick={() => {
              setSelected(value);
              onVote?.(value);
            }}
          >
            {value}
          </button>
        ))}
        <div className="scaleNames">
          <span className="leftName">{left}</span>
          <span>Equal</span>
          <span className="rightName">{right}</span>
        </div>
      </div>
    </div>
  );
}
