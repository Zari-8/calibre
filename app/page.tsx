import Link from 'next/link';
import { debates, players, competitions } from '@/lib/data';
import { PlayerCard } from '@/components/PlayerCard';
import { Flame, Globe2, Trophy } from 'lucide-react';

export default function Home() {
  return (
    <main>
      <section className="hero container">
        <div className="eyebrow">Football intelligence for the arguments fans actually fight over</div>
        <h1>Football arguments are about to get harder to win.</h1>
        <p className="lead">Calibre is a live football intelligence platform for player comparisons, system fit, GOAT debates, World Cup narratives and the uncomfortable question: who are we wrong about?</p>
        <div className="row" style={{marginTop:24}}>
          <Link className="cta" href="/players">Start Comparing</Link>
          <Link className="cta dark" href="/pricing">Get World Cup Founder Pass</Link>
        </div>
      </section>

      <section className="section container grid grid-3">
        <div className="card glow">
          <span className="kicker"><Flame size={14}/> Debate Pulse</span>
          <h2>{debates[0].question}</h2>
          <p className="muted">{debates[0].verdict}</p>
          <span className="pill">Heat {debates[0].heat}%</span>
        </div>
        <div className="card">
          <span className="kicker"><Trophy size={14}/> World Cup Board</span>
          <h2>{competitions[0].signal}</h2>
          <p className="muted">{competitions[0].verdict}</p>
          <Link href="/competitions" className="pill">Open board</Link>
        </div>
        <div className="card">
          <span className="kicker"><Globe2 size={14}/> Global Lens</span>
          <h2>Men, women, Europe, Africa, South America.</h2>
          <p className="muted">Calibre is built to spot arguments before they become mainstream.</p>
          <Link href="/talents" className="pill">View talents</Link>
        </div>
      </section>

      <section className="section container">
        <div className="row" style={{justifyContent:'space-between'}}>
          <div>
            <span className="kicker">Identity Debate</span>
            <h2>Pedri vs Jude is not a talent debate. It is a system debate.</h2>
          </div>
          <Link href="/players" className="pill">Open comparison engine</Link>
        </div>
        <div className="grid grid-2">
          <PlayerCard player={players[0]} />
          <PlayerCard player={players[1]} />
        </div>
      </section>
    </main>
  );
}
