'use client';
import { useState } from 'react';
import { players, getPlayer } from '@/lib/data';
import { MetricBar } from '@/components/MetricBar';
import { FitRadar } from '@/components/FitRadar';
import { ProLock } from '@/components/ProLock';

const teams = [
  { id:'barca', name:'Barcelona', needs:'control, wide creation, positional discipline' },
  { id:'madrid', name:'Real Madrid', needs:'transition threat, box arrival, individual damage' },
  { id:'city', name:'Manchester City', needs:'press resistance, control, rest-defense security' },
  { id:'nigeria', name:'Nigeria', needs:'vertical power, transition threat, penalty box violence' }
];

export default function SystemFitPage() {
  const [playerId,setPlayerId]=useState('pedri');
  const [teamId,setTeamId]=useState('barca');
  const p=getPlayer(playerId);
  const team=teams.find(t=>t.id===teamId)!;
  const fit=Math.round((p.control + p.creation + p.pressing + p.transition) / 4);
  return (
    <main className="container section">
      <span className="kicker">System Fit Engine</span>
      <h1>Talent is one thing. Fit is the fight.</h1>
      <p className="lead">Use the engine to see whether a player protects the system, attacks the game, or creates a beautiful tactical headache.</p>
      <div className="grid grid-2" style={{margin:'24px 0'}}>
        <select value={playerId} onChange={e=>setPlayerId(e.target.value)}>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select value={teamId} onChange={e=>setTeamId(e.target.value)}>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </div>
      <div className="grid grid-2">
        <div className="card glow">
          <span className="kicker">Active Fit Pulse</span>
          <h2>{p.name} → {team.name}</h2>
          <p className="muted">Team needs: {team.needs}</p>
          <MetricBar label="Overall fit" value={fit} pulse />
          <MetricBar label="System control" value={p.control} pulse />
          <MetricBar label="Transition threat" value={p.transition} pulse />
          <MetricBar label="Pressing value" value={p.pressing} pulse />
          <p className="lead">{p.name} gives {team.name} a {p.archetype.toLowerCase()} profile. The question is whether the system wants more control, more damage, or more chaos.</p>
        </div>
        <div className="card">
          <span className="kicker">Animated Fit Radar</span>
          <FitRadar player={p} />
        </div>
      </div>
      <div style={{marginTop:16}}><ProLock title="Unlock full tactical fit reports and squad-level matching" /></div>
    </main>
  );
}
