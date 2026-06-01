import { useState } from 'react';

export default function ApiTeamLogo({ src, name='', fallback='', className='', style }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span className={`api-team-logo-fallback ${className}`} style={style}>{fallback || name.split(' ').slice(0,2).map(word=>word[0]).join('').slice(0,3).toUpperCase()}</span>;
  }
  return <img src={src} alt={name} className={className} style={style} loading="lazy" onError={()=>setFailed(true)}/>;
}
