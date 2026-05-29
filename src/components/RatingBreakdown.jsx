import { ratingFormula } from '../data/calibreData.js';
import Meter from './Meter.jsx';

export default function RatingBreakdown({ player }) {
  return (
    <div className="rating-breakdown">
      {ratingFormula.map((part) => (
        <Meter
          key={part.label}
          label={`${part.label} · ${part.value}%`}
          value={player?.breakdown?.[part.label] || part.value * 2}
          detail={part.detail}
        />
      ))}
    </div>
  );
}
