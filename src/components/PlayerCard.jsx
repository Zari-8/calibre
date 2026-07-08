import { ArrowRight } from 'lucide-react';
import ApiPlayerImage from './ApiPlayerImage.jsx';
import ApiTeamLogo from './ApiTeamLogo.jsx';
import { deriveArchetype } from '../services/playerTraits.js';
import { teamLogoUrl } from '../services/apiFootball.js';

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
 * The standard Calibre player card — a faithful replica of the System Fit
 * AttributeCard (sf2-attr): 92x112 portrait with the club crest beneath it,
 * big white Calibre rating, position chips, Position + Archetype, the
 * "View full profile" bar (opens the profile pop-up), then the bio grid.
 * Colours/fonts match System Fit exactly (#a6ff00 lime, #8d929b muted, IBM Plex Mono labels).
 *
 * Props:
 *   player        — { name, rating|calibreRating, position|pos, archetype, age, club|team, apiPlayerId|id, apiTeamId, image }
 *   onViewProfile — click handler for the View-profile bar (opens the pop-up)
 */
export default function PlayerCard({ player, onViewProfile }) {
  if (!player) return null;

  const rating = player.provisional ? 'LIVE' : fmtRating(player.rating ?? player.calibreRating);
  const chips = chipsOf(player);
  const archetype = player.archetype || deriveArchetype(player) || '—';
  const age = (player.age ?? null) != null && player.age !== '' ? player.age : null;
  const club = player.club || player.team || null;
  const shirtNumber = player.shirt_number ?? player.shirtNumber ?? player.number ?? null;
  const imgId = player.apiPlayerId ?? player.api_player_id ?? player.id;
  const preferred = player.image || player.img || player.photo || undefined;
  const teamId = player.apiTeamId ?? player.api_team_id ?? player.teamId ?? null;
  const teamLogo = teamId ? teamLogoUrl(teamId) : undefined;

  const grid = [
    ['NATIONALITY', player.nationality || player.country || null],
    ['AGE', age],
    ['CLUB', club],
    ['SHIRT NUMBER', shirtNumber != null && shirtNumber !== '' ? `#${shirtNumber}` : null],
  ].filter(([, v]) => v != null && v !== '' && v !== '—');

  return (
    <div className="pcard">
      <style>{`
        .pcard { --l:#a6ff00; --muted:#8d929b; background:rgba(9,13,16,.46); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:16px; display:flex; flex-direction:column; height:100%; }
        .pcard * { box-sizing:border-box; }
        .pcard-top { display:flex; gap:12px; }
        .pcard-left { flex:none; display:flex; flex-direction:column; align-items:center; gap:9px; }
        .pcard-photo { width:92px; height:112px; border-radius:9px; overflow:hidden; background:#0a0d10; }
        .pcard-photo img { width:100%; height:100%; object-fit:cover; object-position:top; display:block; }
        .pcard-crest { width:36px; height:36px; display:grid; place-items:center; }
        .pcard-crest img { max-width:100%; max-height:100%; object-fit:contain; display:block; }
        .pcard-crest .api-team-logo-fallback { font:800 11px "IBM Plex Mono",monospace; color:var(--muted); letter-spacing:.04em; }
        .pcard-rating strong { display:block; color:#fff; font:900 42px/.85 "Barlow Condensed",sans-serif; }
        .pcard-rating span { display:block; margin-top:4px; color:var(--muted); font:800 8px/1 "IBM Plex Mono",monospace; letter-spacing:.1em; }
        .pcard-chips { display:flex; gap:5px; margin-top:11px; flex-wrap:wrap; }
        .pcard-chips em { padding:3px 8px; border:1px solid rgba(166,255,0,.28); border-radius:4px; color:var(--l); font:800 9px/1 "IBM Plex Mono",monospace; font-style:normal; }
        .pcard-arch { display:block; margin-top:10px; color:var(--l); font:800 13px/1.15 "Barlow",sans-serif; }
        .pcard-view { display:flex; align-items:center; justify-content:center; gap:7px; width:100%; margin:14px 0; padding:10px; border:1px solid rgba(166,255,0,.30); border-radius:8px; background:rgba(166,255,0,.05); color:var(--l); font:800 10px/1 "IBM Plex Mono",monospace; letter-spacing:.08em; cursor:pointer; }
        .pcard-view:hover { background:rgba(166,255,0,.12); }
        .pcard-grid { display:grid; grid-template-columns:1fr 1fr; gap:11px 10px; border-top:1px solid rgba(255,255,255,.07); padding-top:13px; margin-top:auto; }
        .pcard-grid small { display:block; color:var(--muted); font:700 8px/1 "IBM Plex Mono",monospace; letter-spacing:.07em; }
        .pcard-grid b { display:block; margin-top:5px; color:#fff; font:700 13px/1.15 "Barlow",sans-serif; }
      `}</style>

      <div className="pcard-top">
        <div className="pcard-left">
          <div className="pcard-photo">
            <ApiPlayerImage playerId={imgId} name={player.name} preferredSrc={preferred} fallbackSrc="/assets/players/neutral-player.svg" alt={player.name} />
          </div>
          <div className="pcard-crest"><ApiTeamLogo src={teamLogo} name={club || player.name} /></div>
        </div>
        <div className="pcard-rating">
          <strong>{rating}</strong>
          <span>CALIBRE RATING</span>
          {chips.length > 0 && <div className="pcard-chips">{chips.map(c => <em key={c}>{c}</em>)}</div>}
          {archetype && archetype !== '—' && <b className="pcard-arch">{archetype}</b>}
        </div>
      </div>

      {onViewProfile && (
        <button type="button" className="pcard-view" onClick={onViewProfile}>VIEW FULL PROFILE <ArrowRight size={13} /></button>
      )}

      <div className="pcard-grid">{grid.map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
    </div>
  );
}
