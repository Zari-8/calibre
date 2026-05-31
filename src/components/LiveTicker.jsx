/**
 * LiveTicker — scrolling live scores bar beneath the nav
 * Pulls today's fixtures from API Football (free plan, cached 6h).
 * Falls back to mock live scores if API key not set or quota hit.
 */
import { useState, useEffect, useRef } from 'react';

const KEY  = import.meta.env.VITE_API_FOOTBALL_KEY || '';
const BASE = 'https://v3.football.api-sports.io';

// League IDs we care about
const WATCH_LEAGUES = [39, 140, 135, 78, 61, 2]; // PL, LaLiga, SerieA, Bundesliga, Ligue1, UCL

const STATUS_LIVE   = ['1H','HT','2H','ET','BT','P','SUSP','INT','LIVE'];
const STATUS_FIN    = ['FT','AET','PEN'];
const STATUS_SCHED  = ['TBD','NS','PST','CANC','ABD','AWD','WO'];

const MOCK_SCORES = [
  { home:'Arsenal',    away:'Man City',    sh:2, sa:1, status:'LIVE 67\'', league:'Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { home:'Barcelona',  away:'Real Madrid', sh:1, sa:1, status:'HT',        league:'La Liga 🇪🇸' },
  { home:'Inter',      away:'Juventus',    sh:0, sa:0, status:'17\'',       league:'Serie A 🇮🇹' },
  { home:'Bayern',     away:'Dortmund',    sh:3, sa:0, status:'FT',         league:'Bundesliga 🇩🇪' },
  { home:'PSG',        away:'Lyon',        sh:2, sa:2, status:'LIVE 88\'', league:'Ligue 1 🇫🇷' },
  { home:'Liverpool',  away:'Chelsea',     sh:1, sa:0, status:'FT',         league:'Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { home:'Atlético',   away:'Sevilla',     sh:1, sa:1, status:'72\'',       league:'La Liga 🇪🇸' },
  { home:'Milan',      away:'Roma',        sh:2, sa:1, status:'FT',         league:'Serie A 🇮🇹' },
];

function cacheKey(url) { return `calibre_ticker_${url.replace(/[^a-z0-9]/gi,'_')}`; }
function getCached(url) {
  try {
    const raw = localStorage.getItem(cacheKey(url));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > 60*60*1000) { localStorage.removeItem(cacheKey(url)); return null; } // 1h TTL for live scores
    return data;
  } catch { return null; }
}
function setCache(url, data) {
  try { localStorage.setItem(cacheKey(url), JSON.stringify({ ts: Date.now(), data })); } catch {}
}

async function fetchFixtures() {
  if (!KEY) return null;
  const today = new Date().toISOString().split('T')[0];
  const url = `${BASE}/fixtures?date=${today}`;
  const cached = getCached(url);
  if (cached) return cached;
  try {
    const res = await fetch(url, { headers: { 'x-apisports-key': KEY } });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.errors && Object.keys(json.errors).length) return null;
    setCache(url, json);
    return json;
  } catch { return null; }
}

function statusLabel(s) {
  const e = s.elapsed ? ` ${s.elapsed}'` : '';
  if (STATUS_LIVE.includes(s.short)) return `🔴 ${s.short}${e}`;
  if (STATUS_FIN.includes(s.short))  return `FT`;
  return s.short === 'HT' ? 'HT' : s.long?.split(' ').slice(0,2).join(' ') || s.short;
}

export default function LiveTicker() {
  const [items, setItems] = useState(MOCK_SCORES);
  const [isLive, setIsLive] = useState(false);
  const trackRef = useRef(null);

  useEffect(() => {
    fetchFixtures().then(json => {
      if (!json?.response?.length) return;
      const filtered = json.response
        .filter(f => WATCH_LEAGUES.includes(f.league.id))
        .slice(0, 20)
        .map(f => ({
          home:   f.teams.home.name,
          away:   f.teams.away.name,
          sh:     f.goals.home ?? '–',
          sa:     f.goals.away ?? '–',
          status: statusLabel(f.fixture.status),
          league: f.league.name,
        }));
      if (filtered.length > 0) { setItems(filtered); setIsLive(true); }
    });
  }, []);

  // Duplicate items so scroll loops seamlessly
  const display = [...items, ...items];

  return (
    <div className="live-ticker">
      <div className="live-ticker-label">{isLive ? '🔴 LIVE' : '⚽ TODAY'}</div>
      <div className="live-ticker-track" ref={trackRef}>
        <div className="live-ticker-inner">
          {display.map((m, i) => (
            <div key={i} className="ticker-match">
              <span className="ticker-league">{m.league}</span>
              <span className="ticker-home">{m.home}</span>
              <span className={`ticker-score ${String(m.status).includes('🔴') ? 'ticker-score--live' : ''}`}>
                {m.sh} – {m.sa}
              </span>
              <span className="ticker-away">{m.away}</span>
              <span className="ticker-status">{m.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
