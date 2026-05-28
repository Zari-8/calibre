'use client';
import { useState } from 'react';
import { players, getPlayer, compareVerdict } from '@/lib/data';
import { PlayerCard } from '@/components/PlayerCard';
import { ProLock } from '@/components/ProLock';

export default function PlayersPage() {
  const [a, setA] = useState('pedri');
  const [b, setB] = useState('bellingham');
  const pa = getPlayer(a);
  const pb = getPlayer(b);
  return (
    <main className="container section">
      <span className="kicker">Player Comparison Engine</span>
      <h1>Compare profiles, not just numbers.</h1>
      <p className="lead">Pick two players. Calibre translates role, archetype, and performance signals into an argument you can actually use.</p>
      <div className="grid grid-2" style={{margin:'24px 0'}}>
        <select value={a} onChange={e=>setA(e.target.value)}>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select value={b} onChange={e=>setB(e.target.value)}>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>
      <div className="compare-card">
        <PlayerCard player={pa} />
        <div className="card" style={{display:'grid',placeItems:'center',textAlign:'center'}}>
          <span className="pill">VS</span>
          <p className="muted">Control · Impact · Creation · Pressing · Transition</p>
        </div>
        <PlayerCard player={pb} />
      </div>
      <div className="card glow" style={{marginTop:16}}>
        <span className="kicker">Calibre Verdict</span>
        <h2>{pa.name} vs {pb.name}</h2>
        <p className="lead">{compareVerdict(pa,pb)}</p>
      </div>
      <div style={{marginTop:16}}>
        <ProLock title="Unlock advanced comparison history and shareable debate cards" />
      </div>
    </main>
  );
}
