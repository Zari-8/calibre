import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import WorldCupNav from '../components/WorldCupNav.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import ShareBar, { shareUrl } from '../components/Share.jsx';
import { navigateTo } from '../components/NavLink.jsx';
import { playerIdFor } from '../data/playerIds.js';
import { getSupabasePlayersByApiIds } from '../services/supabasePlayers.js';
import { supabase, supabaseConfigured } from '../services/supabaseClient.js';
import { resolveRating } from '../services/calibreRating.js';
import { breakoutStars } from '../data/worldCupData.js';

const FILTERS = ['All 48', 'Qualified', 'Potential', 'Defenders', 'Goalkeepers', 'Young Talents'];

function BreakoutCard({ star, live, wc, eliminated, tournamentLive }) {
  const rating = live?.rating ?? '—';
  const wcBadge = eliminated
    ? { label: 'Eliminated', bg: '#241414', color: '#ef4444', border: '#3a1d1d' }
    : wc
      ? { label: 'In form at the WC', bg: '#16240a', color: '#c8ff00', border: '#2a3d12' }
      : tournamentLive
        ? { label: 'No returns yet', bg: '#161616', color: '#888', border: '#262626' }
        : null;
  const resolvedId = live?.apiPlayerId || playerIdFor(star.name);
  const club = live?.club || star.club;
  const hasForm = !!(live && (live.appearances || live.goals || live.assists));
  const seasonLabel = live?.season ? `${String(live.season).slice(2)}–${String(Number(live.season) + 1).slice(2)} club season` : 'Club season';

  function openProfile() {
    if (resolvedId) navigateTo(`/players?playerId=${resolvedId}&player=${encodeURIComponent(star.name)}`);
    else navigateTo(`/players?player=${encodeURIComponent(star.name)}`);
  }

  return (
    <div className={`ptw-card ${star.featured ? 'ptw-card--featured' : ''}`} onClick={openProfile} role="button" tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openProfile()} aria-label={`Open ${star.name} player profile`}>
      {star.featured && <div className="ptw-featured-tag"><Star size={11} /> One to watch</div>}
      <div className="ptw-top">
        <ApiPlayerImage className="ptw-img" playerId={resolvedId} name={star.name} preferredSrc={resolvedId ? undefined : star.image} fallbackSrc="/assets/players/neutral-player.svg" alt={star.name} />
        <div className="ptw-meta">
          <div className="ptw-flag">{star.flag} {star.nation}</div>
          <strong className="ptw-name">{star.name}</strong>
          <span className="ptw-role">{star.role} · {club}</span>
          <div className="ptw-rating"><span className="score">{rating}</span><span className="trend">{live?.rating != null ? 'Calibre' : 'Awaiting data'}</span></div>
        </div>
      </div>
      {wcBadge && (
        <div className="ptw-badge-row">
          <span className="ptw-badge" style={{ background: wcBadge.bg, color: wcBadge.color, borderColor: wcBadge.border }}>{wcBadge.label}</span>
          {wc && !eliminated && (wc.goals || wc.assists) ? <span className="ptw-wc-line">{wc.goals}G {wc.assists}A in {wc.appearances} apps</span> : null}
        </div>
      )}
      <div className="ptw-stats">
        <div className="ptw-stat"><b>{hasForm ? live.appearances : '—'}</b><span>Apps</span></div>
        <div className="ptw-stat"><b>{hasForm ? live.goals : '—'}</b><span>Goals</span></div>
        <div className="ptw-stat"><b>{hasForm ? live.assists : '—'}</b><span>Assists</span></div>
      </div>
      <div className="ptw-season">{hasForm ? seasonLabel : 'Pre-tournament — form loads at kickoff'}</div>
      <p className="ptw-note">{star.note}</p>
      <div className="ptw-share" onClick={e => e.stopPropagation()}>
        <ShareBar text={`${star.name} — ${rating} Calibre rating on Calibre.`} url={shareUrl('/world-cup/players-to-watch')} label={false} />
      </div>
    </div>
  );
}

export default function WorldCupPlayersToWatch() {
  const [liveRatings, setLiveRatings] = useState({});
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ids = breakoutStars.map(s => Number(s.apiPlayerId)).filter(Boolean);
        const rows = await getSupabasePlayersByApiIds(ids);
        const byId = new Map();
        for (const r of rows) {
          const id = Number(r.api_player_id ?? r.apiPlayerId);
          if (Number.isInteger(id) && id > 0) byId.set(id, r);
        }
        const entries = breakoutStars.map((star) => {
          const match = byId.get(Number(star.apiPlayerId));
          if (!match) return [star.name, null];
          const scored = resolveRating(match);
          const finalRating = scored.rating ?? (match.rating ? Math.round(Number(match.rating)) : null);
          if (finalRating == null) return [star.name, null];
          return [star.name, {
            rating: finalRating, apiPlayerId: Number(star.apiPlayerId) || null,
            appearances: Number(match.appearances || 0), goals: Number(match.goals || 0), assists: Number(match.assists || 0),
            club: match.club || match.team || null, season: match.stats_season || null,
          }];
        });
        if (alive) setLiveRatings(Object.fromEntries(entries.filter(e => e[1])));
      } catch { /* keep editorial fallback */ }
    })();
    return () => { alive = false; };
  }, []);

  const [wcLeaders, setWcLeaders] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabaseConfigured || !supabase) return;
      const { data, error } = await supabase.from('wc_leaders').select('*')
        .order('goals', { ascending: false }).order('assists', { ascending: false }).limit(20);
      if (!error && alive) setWcLeaders(data || []);
    })();
    return () => { alive = false; };
  }, []);

  const [wcTeams, setWcTeams] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabaseConfigured || !supabase) return;
      const { data, error } = await supabase.from('wc_teams').select('*');
      if (!error && alive) setWcTeams(data || []);
    })();
    return () => { alive = false; };
  }, []);

  const [filter, setFilter] = useState('All 48');

  const leaderById = {};
  wcLeaders.forEach(l => { leaderById[l.api_player_id] = l; });
  const NATION_ALIASES = { usa: ['usa', 'united states'], uk: ['england', 'united kingdom'] };
  const normNation = (x) => String(x || '').trim().toLowerCase();
  const eliminatedSet = new Set(wcTeams.filter(t => t.eliminated).map(t => normNation(t.team_name)));
  const isNationEliminated = (nation) => {
    const n = normNation(nation);
    return (NATION_ALIASES[n] || [n]).some(a => eliminatedSet.has(a));
  };

  const filtered = breakoutStars.filter(s => {
    if (filter === 'All 48') return true;
    if (filter === 'Qualified') return !isNationEliminated(s.nation);
    if (filter === 'Potential') return s.featured;
    if (filter === 'Defenders') return /defen|back/i.test(s.role);
    if (filter === 'Goalkeepers') return /keeper|gk/i.test(s.role);
    if (filter === 'Young Talents') return s.age <= 20;
    return true;
  });

  return (
    <div className="page wc2">
      <style>{`
        .wc2 { --l:#c8ff00; --line:#1c1c1c; --muted:#888; color:#fff; }
        .wc2 * { box-sizing:border-box; }
        .wc2-title { margin:4px 0 18px; }
        .wc2-title h1 { margin:0 0 6px; font:800 34px "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .wc2-title p { margin:0; color:var(--muted); font:500 13px "Barlow",sans-serif; }
        .ptw-filters { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:20px; }
        .ptw-filters button { background:#0f0f0f; border:1px solid var(--line); color:#888; font:800 11px "Barlow Condensed",sans-serif; letter-spacing:.05em; text-transform:uppercase; padding:9px 14px; border-radius:8px; cursor:pointer; }
        .ptw-filters button.on { background:var(--l); color:#0a0a0a; border-color:var(--l); }
        .ptw-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:14px; }
        .ptw-card { position:relative; background:#0f0f0f; border:1px solid var(--line); border-radius:12px; padding:16px; cursor:pointer; transition:border-color .15s; }
        .ptw-card:hover { border-color:#333; }
        .ptw-card--featured { border-color:rgba(200,255,0,.4); }
        .ptw-featured-tag { position:absolute; top:-9px; left:14px; display:flex; align-items:center; gap:4px; background:var(--l); color:#0a0a0a; font:800 9px "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; padding:3px 8px; border-radius:5px; }
        .ptw-top { display:flex; gap:12px; }
        .ptw-img { width:64px; height:64px; border-radius:10px; object-fit:cover; object-position:top; flex:none; background:#1a1a1a; }
        .ptw-meta { min-width:0; flex:1; }
        .ptw-flag { color:var(--muted); font:600 10.5px "Barlow",sans-serif; margin-bottom:2px; }
        .ptw-name { display:block; font:800 16px "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .ptw-role { display:block; color:var(--muted); font:500 11px "Barlow",sans-serif; margin:2px 0 6px; }
        .ptw-rating { display:flex; align-items:baseline; gap:6px; }
        .ptw-rating .score { font:800 22px "Barlow Condensed",sans-serif; color:var(--l); }
        .ptw-rating .trend { color:var(--muted); font:600 9px "Barlow",sans-serif; text-transform:uppercase; }
        .ptw-badge-row { display:flex; align-items:center; gap:8px; margin:10px 0 2px; flex-wrap:wrap; }
        .ptw-badge { font:800 9px "Barlow Condensed",sans-serif; letter-spacing:.08em; text-transform:uppercase; padding:3px 8px; border:1px solid; border-radius:5px; }
        .ptw-wc-line { color:#999; font:600 10.5px "Barlow",sans-serif; }
        .ptw-stats { display:flex; gap:16px; margin-top:12px; }
        .ptw-stat b { display:block; font:800 16px "Barlow Condensed",sans-serif; }
        .ptw-stat span { color:var(--muted); font:600 9px "Barlow",sans-serif; text-transform:uppercase; }
        .ptw-season { margin-top:8px; font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; opacity:.45; }
        .ptw-note { margin:10px 0 0; color:#ccc; font:500 12px/1.5 "Barlow",sans-serif; }
        .ptw-share { margin-top:10px; padding-top:10px; border-top:1px solid var(--line); }
      `}</style>

      <WorldCupNav active="players-to-watch" />

      <div className="wc2-title">
        <h1>Players to Watch</h1>
        <p>The players set to define the tournament.</p>
      </div>

      <div className="ptw-filters">
        {FILTERS.map(f => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>)}
      </div>

      <div className="ptw-grid">
        {filtered.map(s => (
          <BreakoutCard key={s.id} star={s} live={liveRatings[s.name]} wc={leaderById[s.apiPlayerId]} eliminated={isNationEliminated(s.nation)} tournamentLive={wcLeaders.length > 0} />
        ))}
      </div>
    </div>
  );
}
