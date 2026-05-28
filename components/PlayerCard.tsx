'use client';

import { useState } from 'react';
import { Player } from '@/lib/data';
import { MetricBar } from './MetricBar';

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

export function PlayerCard({ player, pulse=false }: { player: Player; pulse?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasApiImage = Boolean(player.photoUrl && !imageFailed);

  return (
    <div className="card player-card">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className={`avatar player-avatar ${hasApiImage ? 'has-photo' : ''}`} title={player.imageStatus === 'api' ? 'API image' : 'Fallback image'}>
          {hasApiImage ? (
            <img
              src={player.photoUrl}
              alt={`${player.name} photo`}
              className="player-photo"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="avatar-fallback">{player.icon || initials(player.name)}</span>
          )}
        </div>
        <div className="row" style={{gap:8}}>
          {player.teamLogoUrl && (
            <img
              src={player.teamLogoUrl}
              alt={`${player.club} logo`}
              className="team-logo-mini"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="pill">{player.archetype}</span>
        </div>
      </div>
      <h2 style={{marginTop:18}}>{player.name}</h2>
      <p className="muted">{player.club} · {player.nation} · {player.age}</p>
      <p><strong>{player.role}</strong></p>
      <MetricBar label="Control" value={player.control} pulse={pulse}/>
      <MetricBar label="Impact" value={player.impact} pulse={pulse}/>
      <MetricBar label="Creation" value={player.creation} pulse={pulse}/>
      <p className="muted" style={{marginTop:14}}>{player.verdict}</p>
      <p className="image-source-note">
        {hasApiImage ? 'API image source' : 'Calibre fallback avatar'}
      </p>
    </div>
  );
}
