import Link from 'next/link';

const teams = [
  ['Barcelona','Control ecosystem','Pedri, Yamal, De Jong','Needs runners around control'],
  ['Real Madrid','Impact machine','Jude, Vini, Mbappé','Can overwhelm without needing perfect structure'],
  ['Arsenal','Pressure + territory','Rice, Saka, Ødegaard','Needs final-third ruthlessness'],
  ['Man City','Positional dominance','Rodri, Foden, Haaland','Control first, punishment second']
];

export default function TeamsPage() {
  return (
    <main className="container section">
      <span className="kicker">Teams</span>
      <h1>Team profiles that explain player fit.</h1>
      <p className="lead">This page turns teams into systems: control, transition, pressing, chance creation and where a player actually belongs.</p>
      <div className="grid-2">
        {teams.map(([team, profile, core, verdict]) => (
          <div className="card glow" key={team}>
            <span className="pill">{profile}</span>
            <h2>{team}</h2>
            <p className="muted">Core: {core}</p>
            <p>{verdict}</p>
            <Link className="cta subtle" href="/system-fit">Run system fit</Link>
          </div>
        ))}
      </div>
    </main>
  );
}
