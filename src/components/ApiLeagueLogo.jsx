import { useEffect, useState } from 'react';
import { leagueLogoUrl, searchLeagues } from '../services/apiFootball.js';

export default function ApiLeagueLogo({ id, src, name='', fallback='', className='', style }) {
  const [url, setUrl] = useState(src || leagueLogoUrl(id));
  const [failed, setFailed] = useState(false);
  useEffect(()=>{
    let cancelled=false;
    setFailed(false);
    const immediate=src||leagueLogoUrl(id);
    if(immediate){setUrl(immediate);return undefined;}
    if(!name)return undefined;
    searchLeagues(name).then(rows=>{if(!cancelled&&rows?.[0]?.logo)setUrl(rows[0].logo);}).catch(()=>{});
    return()=>{cancelled=true;};
  },[id,src,name]);
  if(!url||failed)return <span className={`api-league-logo-fallback ${className}`} style={style}>{fallback||name.slice(0,4).toUpperCase()}</span>;
  return <img src={url} alt={name} className={className} style={style} loading="lazy" onError={()=>setFailed(true)}/>;
}
