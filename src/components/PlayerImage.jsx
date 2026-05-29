import { useState } from 'react';

export default function PlayerImage({ player, className = '' }) {
  const sourceStack = [player?.apiImage, player?.localImage, '/assets/players/neutral-player.svg'].filter(Boolean);
  const [index, setIndex] = useState(0);

  return (
    <img
      className={`player-img ${className}`}
      src={sourceStack[index]}
      alt={player?.name || 'Calibre player'}
      onError={() => setIndex((current) => Math.min(current + 1, sourceStack.length - 1))}
      loading="lazy"
    />
  );
}
