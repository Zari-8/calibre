import { useEffect, useMemo, useRef, useState } from 'react';
import { clearPlayerPhotoCache, getPlayerPhotoByName, playerPhotoUrl } from '../services/apiFootball.js';

const NEUTRAL = '/assets/players/neutral-player.svg';

function remoteImage(value='') {
  const src = String(value || '').trim();
  return /^https?:\/\//i.test(src) ? src : '';
}

export default function ApiPlayerImage({
  playerId=null,
  name,
  fallbackSrc=NEUTRAL,
  preferredSrc='',
  allowLookup=true,
  alt,
  className='',
  style,
  loading='eager',
  ...rest
}) {
  const safeFallback = fallbackSrc || NEUTRAL;
  const officialSrc = useMemo(() => playerPhotoUrl(playerId), [playerId]);
  const suppliedRemoteSrc = useMemo(() => remoteImage(preferredSrc), [preferredSrc]);
  const initialSrc = officialSrc || suppliedRemoteSrc || safeFallback;
  const [src, setSrc] = useState(initialSrc);
  const attemptedLookup = useRef(false);

  useEffect(() => {
    let cancelled = false;
    attemptedLookup.current = false;
    setSrc(initialSrc);

    if (officialSrc || suppliedRemoteSrc || !allowLookup || !name) return undefined;

    attemptedLookup.current = true;
    getPlayerPhotoByName(name)
      .then(url => { if (!cancelled && url) setSrc(url); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [name, officialSrc, suppliedRemoteSrc, safeFallback, allowLookup, initialSrc]);

  const handleError = () => {
    if (src === officialSrc && suppliedRemoteSrc && suppliedRemoteSrc !== src) {
      setSrc(suppliedRemoteSrc);
      return;
    }

    if (allowLookup && name && !attemptedLookup.current) {
      attemptedLookup.current = true;
      clearPlayerPhotoCache(name);
      getPlayerPhotoByName(name)
        .then(url => setSrc(url || safeFallback))
        .catch(() => setSrc(safeFallback));
      return;
    }

    if (src !== safeFallback) {
      setSrc(safeFallback);
      return;
    }

    if (safeFallback !== NEUTRAL) setSrc(NEUTRAL);
  };

  return (
    <img
      {...rest}
      className={className}
      style={style}
      src={src}
      alt={alt || name || 'Calibre player'}
      loading={loading}
      onError={handleError}
    />
  );
}
