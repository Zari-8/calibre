import { ProLock } from '@/components/ProLock';

const cards = [
  ['Goals','Who carried the scoring load across club, Europe and international football?'],
  ['Creation','Who created more shots, chances, danger and control for others?'],
  ['Finals','Who bent the biggest matches? Goals are one piece. Attacking gravity is the deeper question.'],
  ['Longevity','Who stayed decisive across more tactical eras, coaches and physical phases?'],
  ['Peak','Who had the highest footballing ceiling at their absolute best?'],
  ['Context','Who had the better platform, and who was the platform?']
];

export default function GoatPage() {
  return (
    <main className="container section">
      <span className="kicker">GOAT Debate Layer</span>
      <h1>Messi vs Ronaldo needs more than lazy totals.</h1>
      <p className="lead">Calibre uses the GOAT debate as a gateway into better football arguments: output, creation, finals, peak, longevity, context and attacking gravity.</p>
      <div className="grid grid-3" style={{marginTop:24}}>
        {cards.map(([title,body])=>(
          <div className="card" key={title}>
            <span className="pill">GOAT metric</span>
            <h2>{title}</h2>
            <p className="muted">{body}</p>
          </div>
        ))}
      </div>
      <section className="section">
        <div className="card glow">
          <span className="kicker">Calibre verdict frame</span>
          <h2>The real GOAT argument is attacking gravity.</h2>
          <p className="lead">Not just who scored. Not just who assisted. Who forced the opponent, manager, system and era to bend around them?</p>
        </div>
      </section>
      <ProLock title="Founder Pass unlocks deeper GOAT cards and sourced debate packs" />
    </main>
  );
}
