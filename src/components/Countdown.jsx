import React, { useEffect, useState } from "react";

export default function Countdown({ initialSeconds = 8327 }) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const timer = setInterval(() => setSeconds(value => value <= 0 ? 86400 : value - 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const block = (number, label) => (
    <div>
      <strong>{String(number).padStart(2, "0")}</strong>
      <small>{label}</small>
    </div>
  );

  return (
    <div className="countdown">
      <div className="bolt">⚡</div>
      <div className="timeBlocks">
        {block(hrs, "HRS")}<b>:</b>{block(mins, "MINS")}<b>:</b>{block(secs, "SECS")}
      </div>
    </div>
  );
}
