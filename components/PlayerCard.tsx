import { Player } from '@/lib/data';
import { MetricBar } from './MetricBar';

export function PlayerCard({ player, pulse=false }: { player: Player; pulse?: boolean }) {
  return (
    <div className="card player-card">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="avatar">{player.icon}</div>
        <span className="pill">{player.archetype}</span>
      </div>
      <h2 style={{marginTop:18}}>{player.name}</h2>
      <p className="muted">{player.club} · {player.nation} · {player.age}</p>
      <p><strong>{player.role}</strong></p>
      <MetricBar label="Control" value={player.control} pulse={pulse}/>
      <MetricBar label="Impact" value={player.impact} pulse={pulse}/>
      <MetricBar label="Creation" value={player.creation} pulse={pulse}/>
      <p className="muted" style={{marginTop:14}}>{player.verdict}</p>
    </div>
  );
}
