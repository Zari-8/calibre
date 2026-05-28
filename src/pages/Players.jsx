import React, { useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import PlayerCard from "../components/PlayerCard.jsx";
import { players, archetypes } from "../data/mockData.js";

export default function Players() {
  const [query, setQuery] = useState("");
  const filtered = players.filter(p => [p.name, p.club, p.league, p.archetype].join(" ").toLowerCase().includes(query.toLowerCase()));

  return (
    <main className="page">
      <PageHeader
        eyebrow="Players"
        title="Rate every player on earth."
        copy="Searchable player intelligence with Calibre Rating, archetype fit, fan rating, role profile and comparison logic. Not FIFA overall. Calibre has its own formula."
      >
        <input className="searchInput" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search player, club, league or archetype..." />
      </PageHeader>

      <section className="playersLayout">
        <aside className="panel filterPanel">
          <div className="panelTitle">Archetypes</div>
          {archetypes.map(a => <button key={a.name} className="filterChip">{a.icon} {a.name}</button>)}
        </aside>
        <div className="playerGrid">
          {filtered.map(player => <PlayerCard player={player} key={player.name} />)}
        </div>
      </section>
    </main>
  );
}
