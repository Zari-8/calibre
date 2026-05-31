import ApiPlayerImage from './ApiPlayerImage.jsx';

export default function PlayerImage({ player, className = '', style }) {
  return (
    <ApiPlayerImage
      name={player?.name}
      fallbackSrc={player?.apiImage || player?.localImage || player?.image || '/assets/players/neutral-player.svg'}
      alt={player?.name || 'Calibre player'}
      className={`player-img ${className}`}
      style={style}
    />
  );
}
