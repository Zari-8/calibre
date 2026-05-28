import { competitions } from '@/lib/data';
import { ProLock } from '@/components/ProLock';

export default function CompetitionsPage() {
  return (
    <main className="container section">
      <span className="kicker">Competition Intelligence</span>
      <h1>World Cup narratives before they become obvious.</h1>
      <p className="lead">Dark horses, breakout players, flop risks, profile mismatches and the arguments fans will be fighting over before kickoff.</p>
      <div className="grid grid-3" style={{marginTop:24}}>
        {competitions.map(c=>(
          <div className="card" key={c.name}>
            <span className="pill">{c.name}</span>
            <h2>{c.signal}</h2>
            <p className="muted">{c.teams}</p>
            <p>{c.verdict}</p>
          </div>
        ))}
      </div>
      <section className="section">
        <div className="card glow">
          <span className="kicker">World Cup Founder Board</span>
          <h2>5 questions Calibre tracks</h2>
          <table className="table">
            <tbody>
              <tr><th>Breakout</th><td>Which U23 player becomes impossible to ignore?</td></tr>
              <tr><th>Flop risk</th><td>Which favourite has a system weakness hiding under star power?</td></tr>
              <tr><th>Dark horse</th><td>Which team’s profile travels better than its reputation?</td></tr>
              <tr><th>Legacy</th><td>Who uses the tournament to change how history talks about them?</td></tr>
              <tr><th>Market</th><td>Which player gets repriced by three knockout games?</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <ProLock title="Founder Pass unlocks the full World Cup intelligence board" />
    </main>
  );
}
