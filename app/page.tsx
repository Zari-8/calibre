import Link from 'next/link';

const stats = [
  ['△','186,000','Players Tracked','Across 63 leagues'],
  ['◎','63','Leagues Live','Full coverage'],
  ['▱','20','Archetypes','From poacher to controller'],
  ['◈','9.7M','Fan Votes','Debate data layer']
];

export default function Home() {
  return (
    <main>
      <section className="hero-grid">
        <div className="container-wide hero-inner">
          <div className="hero-copy">
            <h1>Rate every footballer on earth<span className="accent">.</span></h1>
            <p>20 archetypes. 63 leagues. 186,000 players. One universal rating. <span className="accent">Endless debate.</span></p>
            <div className="stats-row">
              {stats.map(([icon,num,label,sub]) => (
                <div className="stat-card" key={label}>
                  <div className="stat-icon">{icon}</div>
                  <div><div className="stat-num">{num}</div><div className="stat-label">{label}</div><div className="stat-sub">{sub}</div></div>
                </div>
              ))}
            </div>
          </div>
          <div className="radar-wrap" aria-label="Calibre radar visual">
            <div className="radar" />
            <div className="radar-player rp1">VJ</div>
            <div className="radar-player rp2">KM</div>
            <div className="radar-player rp3">JB</div>
            <div className="radar-player rp4">FW</div>
          </div>
        </div>

        <div className="container-wide panel-grid">
          <div className="panel">
            <div className="panel-head">◎ Debate of the Day <Link href="/debates"><span>Open debate</span></Link></div>
            <div className="debate-card">
              <div className="debate-side"><div className="avatar">P<small>FC</small></div><div><h3>Pedri</h3><p className="muted">Controller · Barcelona</p><div className="score">93.2</div><small>Calibre rating</small></div></div>
              <div className="vs">VS</div>
              <div className="debate-side"><div><h3>Jude Bellingham</h3><p className="muted">Box Crasher · Real Madrid</p><div className="score">94.0</div><small>Calibre rating</small></div><div className="avatar">JB<small>RM</small></div></div>
            </div>
            <div className="vote-bar"><span /></div>
          </div>

          <div className="panel">
            <div className="panel-head">◎ Leagues <Link href="/competitions"><span>View all</span></Link></div>
            <div className="league-grid">
              {['PL','LL','BL','SA','L1'].map((l,i)=><div className="league-card" key={l}><div className="league-icon">{l}</div><strong>{['Premier League','LaLiga','Bundesliga','Serie A','Ligue 1'][i]}</strong><span>{['ENG','ESP','GER','ITA','FRA'][i]}</span></div>)}
            </div>
            <p className="muted" style={{padding:'0 28px 24px',fontSize:12}}>Drop real league SVGs into images/leagues/. The page already has premium fallback marks, so GitHub will not break if an asset is missing.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
