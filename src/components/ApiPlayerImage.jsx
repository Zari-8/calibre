import { useEffect, useState } from 'react';
import { getPlayerPhotoByName } from '../services/apiFootball.js';

/**
 * API-first portrait with a safe local fallback.
 * The image visibly upgrades after API-Football returns a current photo URL.
 */
export default function ApiPlayerImage({ name, fallbackSrc = '/assets/players/neutral-player.svg', alt, className = '', style, ...rest }) {
  const [src, setSrc] = useState(fallbackSrc);

  useEffect(() => {
    let cancelled = false;
    setSrc(fallbackSrc);
    if (!name) return undefined;
    getPlayerPhotoByName(name).then(url => {
      if (!cancelled && url) setSrc(url);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [name, fallbackSrc]);

  return (
    <img
      {...rest}
      className={className}
      style={style}
      src={src}
      alt={alt || name || 'Calibre player'}
      loading="lazy"
      onError={() => {
        if (src !== fallbackSrc) setSrc(fallbackSrc);
      }}
    />
  );
}
