/** LiveTicker — scrolling scores bar fed by the Calibre API bridge. */
import { useEffect, useState } from 'react';
import { getFixturesByDate } from '../services/apiFootball.js';

const WATCH_LEAGUES = [39, 140, 135, 78, 61, 88, 144, 2];
const STATUS_LIVE = ['1H','HT','2H','ET','BT','P','SUSP','INT','LIVE'];
const STATUS_FIN = ['FT','AET','PEN'];

const MOCK_SCORES = [
  { home:'Arsenal', away:'Man City', sh:2, sa:1, status:'LIVE 67\'', league:'Premier League' },
  { home:'Barcelona', away:'Real Madrid', sh:1, sa:1, status:'HT', league:'La Liga' },
  { home:'Inter', away:'Juventus', sh:0, sa:0, status:'17\'', league:'Serie A' },
  { home:'Bayern', away:'Dortmund', sh:3, sa:0, status:'FT', league:'Bundesliga' },
  { home:'PSG', away:'Lyon', sh:2, sa:2, status:'LIVE 88\'', league:'Ligue 1' },
  { home:'Ajax', away:'PSV', sh:1, sa:1, status:'FT', league:'Eredivisie' },
];

function statusLabel(status) {
  const elapsed = status.elapsed ? ` ${status.elapsed}'` : '';
  if (STATUS_LIVE.includes(status.short)) return `LIVE${elapsed}`;
  if (STATUS_FIN.includes(status.short)) return 'FT';
  return status.short === 'NS' ? 'UPCOMING' : status.short;
}

export default function LiveTicker() {
  const [items, setItems] = useState(MOCK_SCORES);
  const [source, setSource] = useState('DEMO FEED');

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    getFixturesByDate(today).then(fixtures => {
      if (!fixtures?.length) return;
      const selected = fixtures
        .filter(match => WATCH_LEAGUES.includes(match.league.id))
        .slice(0, 24)
        .map(match => ({
          home: match.teams.home.name,
          away: match.teams.away.name,
          sh: match.goals.home ?? '–',
          sa: match.goals.away ?? '–',
          status: statusLabel(match.fixture.status),
          league: match.league.name,
        }));
      if (selected.length) {
        setItems(selected);
        setSource('LIVE API');
      }
    });
  }, []);

  const display = [...items, ...items];
  return (
    <div className="live-ticker">
      <div className="live-ticker-label"><span className={source === 'LIVE API' ? 'live-dot' : ''} />{source}</div>
      <div className="live-ticker-track">
        <div className="live-ticker-inner">
          {display.map((match, index) => (
            <div key={`${match.home}-${match.away}-${index}`} className="ticker-match">
              <span className="ticker-league">{match.league}</span>
              <span className="ticker-home">{match.home}</span>
              <span className={`ticker-score ${match.status.includes('LIVE') ? 'ticker-score--live' : ''}`}>{match.sh} – {match.sa}</span>
              <span className="ticker-away">{match.away}</span>
              <span className="ticker-status">{match.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
