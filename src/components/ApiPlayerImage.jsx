import { useEffect, useState } from 'react';
import { clearPlayerPhotoCache, getPlayerPhotoByName } from '../services/apiFootball.js';

/**
 * API-first portrait with a safe local fallback.
 * The local artwork is shown instantly, then replaced by the current
 * API-Football portrait as soon as the lookup resolves.
 */
export default function ApiPlayerImage({ name, fallbackSrc = '/assets/players/neutral-player.svg', alt, className = '', style, loading = 'eager', ...rest }) {
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
      loading={loading}
      onError={() => {
        if (src !== fallbackSrc) {
          clearPlayerPhotoCache(name);
          setSrc(fallbackSrc);
        }
      }}
    />
  );
}
