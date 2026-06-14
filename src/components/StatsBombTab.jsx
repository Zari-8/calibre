/**
 * StatsBombTab.jsx
 * Tournament stats tab for the player profile modal.
 * Drop this inside your existing PlayerProfileModal, wired to the "TOURNAMENT" tab.
 *
 * Props:
 *   playerName  {string}  — player name to search (as appears in the profile)
 */

import { useState, useEffect } from 'react';
import { searchPlayerTournaments, buildTournamentNarrative } from '../services/statsBombService';

export default function StatsBombTab({ playerName }) {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerName) return;
    setLoading(true);
    setError(null);
    searchPlayerTournaments(playerName)
      .then(results => { setTournaments(results); setLoading(false); })
      .catch(() => { setError('Could not load tournament data.'); setLoading(false); });
  }, [playerName]);

  if (loading) return (
    <div style={{ padding: '24px', textAlign: 'center', color: '#9BA2AA', fontSize: 13 }}>
      Loading tournament data…
    </div>
  );

  if (error) return (
    <div style={{ padding: '24px', textAlign: 'center', color: '#FF6257', fontSize: 13 }}>{error}</div>
  );

  if (tournaments.length === 0) return (
    <div style={{ padding: '24px', textAlign: 'center', color: '#555D66', fontSize: 13 }}>
      No StatsBomb open data available for this player.
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {tournaments.map((t, i) => (
        <TournamentCard key={i} entry={t} />
      ))}
      <p style={{ fontSize: 10, color: '#555D66', marginTop: 8, lineHeight: 1.5 }}>
        Data provided by StatsBomb via StatsBomb Open Data (CC-BY-SA 4.0).
        xG and event data from match-level event granularity.
      </p>
    </div>
  );
}

function TournamentCard({ entry }) {
  const s = entry.stats;
  const narrative = buildTournamentNarrative(s, entry.competition);
  const metrics = [
    { label: 'Goals', value: s.goals, highlight: true },
    { label: 'Assists', value: s.assists },
    { label: 'xG', value: s.xg },
    { label: 'Shots', value: s.shots },
    { label: 'Key Passes', value: s.key_passes },
    { label: 'Pass Acc.', value: `${s.pass_accuracy}%` },
    { label: 'Pressures', value: s.pressures },
    { label: 'Interceptions', value: s.interceptions },
  ];

  return (
    <div style={{ background: '#0B0F13', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 6, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <span style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: 14, fontWeight: 700,
                         color: '#F4F6F8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {entry.competition}
          </span>
          {entry.has360 && (
            <span style={{ marginLeft: 8, fontSize: 9, background: 'rgba(166,255,0,0.12)',
                           color: '#A6FF00', padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em' }}>
              360°
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: '#555D66' }}>
          {s.matches} app{s.matches !== 1 ? 's' : ''} · {s.team}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
        {metrics.map(m => (
          <div key={m.label} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: 20, fontWeight: 700,
                          color: m.highlight ? '#A6FF00' : '#F4F6F8' }}>
              {m.value}
            </div>
            <div style={{ fontSize: 9, color: '#9BA2AA', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {m.label}
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, color: '#9BA2AA', lineHeight: 1.6, margin: 0 }}>{narrative}</p>
    </div>
  );
}
