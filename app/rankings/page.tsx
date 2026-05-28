import Link from 'next/link';

const rankings = [
  ['1','Jude Bellingham','94.0','Box Crasher','Impact monster'],
  ['2','Pedri','93.2','Puppeteer','System protector'],
  ['3','Kylian Mbappé','92.8','Poacher+','Space punisher'],
  ['4','Vinícius Jr','92.4','Chaos Winger','Structure breaker'],
  ['5','Florian Wirtz','91.7','Advanced Playmaker','Between-lines weapon']
];

export default function RankingsPage() {
  return (
    <main className="container section">
      <span className="kicker">Rankings</span>
      <h1>Universal rating. Endless debate.</h1>
      <p className="lead">Rankings are early V7 seed data. The live version will update from the player database and fan voting layer.</p>
      <div className="panel">
        {rankings.map(([rank, name, rating, archetype, tag]) => (
          <div className="ranking-row" key={name}>
            <strong>#{rank}</strong>
            <div><h3>{name}</h3><p className="muted">{archetype} · {tag}</p></div>
            <span className="score">{rating}</span>
          </div>
        ))}
      </div>
      <Link className="cta" href="/players">Compare players</Link>
    </main>
  );
}
