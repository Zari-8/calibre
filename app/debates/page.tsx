import { debates } from '@/lib/data';

export default function DebatesPage() {
  return (
    <main className="container section">
      <span className="kicker">Debate Engine</span>
      <h1>Hot Potato of the Week.</h1>
      <p className="lead">Football culture, tactical arguments, legacy fights and uncomfortable questions with enough edge to travel on X.</p>
      <div className="grid grid-2" style={{marginTop:24}}>
        {debates.map(d=>(
          <div className="card" key={d.question}>
            <span className="pill">{d.title} · Heat {d.heat}%</span>
            <h2>{d.question}</h2>
            <p className="muted">{d.verdict}</p>
            <button className="cta dark">Vote coming live</button>
          </div>
        ))}
      </div>
    </main>
  );
}
