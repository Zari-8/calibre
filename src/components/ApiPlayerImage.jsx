import { useEffect, useState } from 'react';
import { clearPlayerPhotoCache, getPlayerPhotoByName } from '../services/apiFootball.js';

export default function ApiPlayerImage({ name, fallbackSrc='/assets/players/neutral-player.svg', preferredSrc='', alt, className='', style, loading='eager', ...rest }) {
  const safeFallback=fallbackSrc||'/assets/players/neutral-player.svg';
  const [src,setSrc]=useState(preferredSrc||safeFallback);
  useEffect(()=>{
    let cancelled=false;
    setSrc(preferredSrc||safeFallback);
    if(preferredSrc||!name)return undefined;
    getPlayerPhotoByName(name).then(url=>{if(!cancelled&&url)setSrc(url);}).catch(()=>{});
    return()=>{cancelled=true;};
  },[name,preferredSrc,safeFallback]);
  return <img {...rest} className={className} style={style} src={src} alt={alt||name||'Calibre player'} loading={loading} onError={()=>{if(src!==safeFallback){clearPlayerPhotoCache(name);setSrc(safeFallback);}else if(safeFallback!=='/assets/players/neutral-player.svg'){setSrc('/assets/players/neutral-player.svg');}}}/>;
}
