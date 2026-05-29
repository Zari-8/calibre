/**
 * useCompetitions hook
 * Fetches live standings + top scorers from API Football.
 * Falls back to mock data if API is unavailable or quota exhausted.
 * Results cached 6h in localStorage via apiFootball service.
 */
import { useState, useEffect } from 'react';
import { getAllLeagueStandings, getAllTopScorers } from '../services/apiFootball.js';

const LEAGUE_FLAGS = {
  'Premier League': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'La Liga':        '🇪🇸',
  'Serie A':        '🇮🇹',
  'Bundesliga':     '🇩🇪',
  'Ligue 1':        '🇫🇷',
};

// Fallback mock (shown if API call fails or key not set)
const MOCK_ROWS = [
  { flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', name:'Premier League', form:['W','D','W','W','W'], top:'Haaland',   points:82 },
  { flag:'🇪🇸',         name:'La Liga',        form:['W','W','D','W','W'], top:'Bellingham', points:79 },
  { flag:'🇮🇹',         name:'Serie A',        form:['D','W','W','W','D'], top:'Lautaro',    points:74 },
  { flag:'🇩🇪',         name:'Bundesliga',     form:['W','D','D','W','W'], top:'Musiala',    points:71 },
  { flag:'🇫🇷',         name:'Ligue 1',        form:['W','D','W','W','D'], top:'Mbappé',     points:68 },
];

function formStringToArray(str = '') {
  return str.split('').slice(0, 5).map(c => c === 'W' ? 'W' : c === 'D' ? 'D' : 'L');
}

export function useCompetitions() {
  const [rows, setRows]       = useState(MOCK_ROWS);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive]   = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [standings, topScorers] = await Promise.all([
          getAllLeagueStandings(),
          getAllTopScorers(),
        ]);

        if (!standings || Object.keys(standings).length === 0) {
          setLoading(false);
          return; // use mock
        }

        const live = Object.entries(standings).map(([name, entries]) => {
          const leader = entries?.[0];
          return {
            flag:    LEAGUE_FLAGS[name] ?? '🌍',
            name,
            form:    formStringToArray(leader?.form ?? ''),
            top:     topScorers[name] ?? '—',
            points:  leader?.points ?? 0,
          };
        });

        // Sort by points descending (most competitive league first)
        live.sort((a, b) => b.points - a.points);
        setRows(live);
        setIsLive(true);
      } catch (e) {
        console.warn('useCompetitions: falling back to mock data', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { rows, loading, isLive };
}
