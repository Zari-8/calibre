import { ArrowRight } from 'lucide-react';
import ApiPlayerImage from './ApiPlayerImage.jsx';
import { deriveArchetype } from '../services/playerTraits.js';

// Canonical archetype -> role list. Kept in sync with services/systemFitData.js
// ROLE_MAP so a player's "Top role" reads identically here and on System Fit.
const ROLE_MAP = {
  'Sweeper Keeper': ['Sweeper keeper', 'Build-up initiator', 'High-line support'],
  'Shot-Stopper': ['Shot stopper', 'Line keeper', 'Set-piece anchor'],
  'Ball-Playing Defender': ['Ball-playing defender', 'Progressive passer', 'Line-breaker'],
  Stopper: ['Stopper', 'Aerial dominator', 'Front-foot defender'],
  'Wing-Back': ['Wing-back', 'Overlapping runner', 'Width provider'],
  'Inverted Full-Back': ['Inverted full-back', 'Midfield tuck-in', 'Build-up support'],
  'Full-Back': ['Full-back', 'Defensive width', 'Recovery runner'],
  Anchor: ['Anchor', 'Screen the defence', 'Positional shield'],
  'Ball-Winning Midfielder': ['Ball-winner', 'Pressing trigger', 'Duel monster'],
  'Holding Midfielder': ['Holding midfielder', 'Deep distributor', 'Rest-defence anchor'],
  'Deep-Lying Playmaker': ['Deep-lying playmaker', 'Tempo controller', 'Press escape valve'],
  'Box-to-Box Midfielder': ['Advanced 8', 'Roaming midfielder', 'Second-wave creator'],
  Mezzala: ['Mezzala', 'Half-space runner', 'Wide-8 creator'],
  'Advanced Playmaker': ['Free 10', 'Between-the-lines threat', 'Final-third creator'],
  'Central Midfielder': ['Central midfielder', 'Two-way linker', 'Box-to-box option'],
  Winger: ['Wide outlet', 'Touchline isolator', 'Chalk-on-boots runner'],
  'Inside Forward': ['Inside forward', 'Cut-inside threat', 'Half-space runner'],
  'Advanced Forward': ['Advanced forward', 'Channel runner', 'Transition finisher'],
  'False Nine': ['False nine', 'Drop-and-link', 'Space creator'],
  'Second Striker': ['Second striker', 'Support forward', 'Between-the-lines runner'],
  'Target Man': ['Target man', 'Hold-up focal point', 'Aerial outlet'],
  Poacher: ['Poacher', 'Six-yard finisher', 'Last-line runner'],
};

function fmtRating(r) {
  const n = Number(r);
  return Number.isFinite(n) ? Math.round(n) : '—';
}
function positionText(p) {
  return p.position || p.pos || '—';
}
function chipsOf(p) {
  return String(positionText(p)).split(/[\/,]/).map(t => t.trim()).filter(Boolean).slice(0, 3);
}

/**
 * The standard Calibre player card. Used inside the player pop-up across the app
 * so every player surface reads the same: portrait, Calibre rating, position
 * chips, position + archetype, a "View full profile" CTA, and a bio grid
 * (archetype / age / club / top role).
 *
 * Props:
 *   player        — { name, rating|calibreRating, position|pos, archetype, age, club|team, apiPlayerId|id, image, provisional }
 *   onViewProfile — click handler for the CTA (omit to hide the button)
 *   actions       — optional node rendered under the grid (compare/watch/share, etc.)
 */
export default function PlayerCard({ player, onViewProfile, actions = null }) {
  if (!player) return null;

  const rating = player.provisional ? 'LIVE' : fmtRating(player.rating ?? player.calibreRating);
  const pos = positionText(player);
  const chips = chipsOf(player);
  const archetype = player.archetype || deriveArchetype(player) || '—';
  const age = (player.age ?? null) != null && player.age !== '' ? player.age : '—';
  const club = player.club || player.team || '—';
  const topRole = (ROLE_MAP[archetype] && ROLE_MAP[archetype][0]) || player.topRole || player.role || archetype || '—';
  const imgId = player.apiPlayerId ?? player.api_player_id ?? player.id;
  const preferred = player.image || player.photo || undefined;

  return (
    <div className="pcard">
      <style>{`
        .pcard { --l:#c8fa3c; --line:rgba(255,255,255,.09); --muted:#8b9299; }
        .pcard * { box-sizing:border-box; }
        .pcard-top { display:flex; gap:20px; align-items:flex-start; }
        .pcard-photo { flex:0 0 auto; width:132px; height:132px; border-radius:14px; overflow:hidden; background:radial-gradient(120% 120% at 50% 0%, #eef2f5, #b3bdc6 92%); border:1px solid var(--line); }
        .pcard-photo img { width:100%; height:100%; object-fit:cover; object-position:center top; display:block; }
        .pcard-head { min-width:0; padding-top:2px; flex:1; }
        .pcard-name { margin:0 0 8px; color:#f4f6f8; font:800 24px/1.02 "Barlow Condensed",sans-serif; letter-spacing:.01em; text-transform:uppercase; }
        .pcard-rating { display:flex; align-items:baseline; gap:9px; }
        .pcard-rating b { color:#fff; font:800 44px/.85 "Barlow Condensed",sans-serif; }
        .pcard-rating span { color:var(--muted); font:700 10px/1.2 "Barlow",sans-serif; letter-spacing:.14em; text-transform:uppercase; }
        .pcard-chips { display:flex; gap:7px; margin-top:12px; flex-wrap:wrap; }
        .pcard-chips em { font-style:normal; padding:4px 11px; border:1px solid rgba(200,250,60,.45); border-radius:7px; color:var(--l); font:800 12px/1 "Barlow Condensed",sans-serif; letter-spacing:.05em; }
        .pcard-cols { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin:22px 0 18px; }
        .pcard-col label { display:block; color:var(--muted); font:700 10px/1 "Barlow",sans-serif; letter-spacing:.12em; text-transform:uppercase; margin-bottom:7px; }
        .pcard-col b { color:var(--l); font:800 19px/1.1 "Barlow Condensed",sans-serif; }
        .pcard-cta { width:100%; display:inline-flex; align-items:center; justify-content:center; gap:9px; padding:14px; border:1px solid rgba(200,250,60,.55); border-radius:12px; background:transparent; color:var(--l); font:800 13px/1 "Barlow Condensed",sans-serif; letter-spacing:.14em; text-transform:uppercase; cursor:pointer; transition:background .14s,color .14s; }
        .pcard-cta:hover { background:var(--l); color:#0a0d05; }
        .pcard-rule { height:1px; background:var(--line); margin:20px 0; border:none; }
        .pcard-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px 20px; }
        .pcard-grid label { display:block; color:var(--muted); font:700 10px/1 "Barlow",sans-serif; letter-spacing:.12em; text-transform:uppercase; margin-bottom:6px; }
        .pcard-grid b { color:#f2f5f7; font:700 16px/1.15 "Barlow",sans-serif; }
        .pcard-actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:20px; }
      `}</style>

      <div className="pcard-top">
        <div className="pcard-photo">
          <ApiPlayerImage playerId={imgId} name={player.name} preferredSrc={preferred} fallbackSrc="/assets/players/neutral-player.svg" alt={player.name} />
        </div>
        <div className="pcard-head">
          {player.name && <h3 className="pcard-name">{player.name}</h3>}
          <div className="pcard-rating"><b>{rating}</b><span>Calibre rating</span></div>
          {chips.length > 0 && <div className="pcard-chips">{chips.map(c => <em key={c}>{c}</em>)}</div>}
        </div>
      </div>

      <div className="pcard-cols">
        <div className="pcard-col"><label>Position</label><b>{pos}</b></div>
        <div className="pcard-col"><label>Archetype</label><b>{archetype}</b></div>
      </div>

      {onViewProfile && (
        <button type="button" className="pcard-cta" onClick={onViewProfile}>View full profile <ArrowRight size={16} /></button>
      )}

      <div className="pcard-rule" />

      <div className="pcard-grid">
        <div><label>Archetype</label><b>{archetype}</b></div>
        <div><label>Age</label><b>{age}</b></div>
        <div><label>Club</label><b>{club}</b></div>
        <div><label>Top role</label><b>{topRole}</b></div>
      </div>

      {actions && <div className="pcard-actions">{actions}</div>}
    </div>
  );
}
