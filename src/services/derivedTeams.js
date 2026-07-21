// ============================================================
// derivedTeams.js  —  read layer for derived_team_profiles
// ------------------------------------------------------------
// A club resolves in this order once warmTeamUniverse() has run:
//   1. derived_team_profiles (this file) — measured traits win; this is the
//      whole point of the DNA pipeline, and covers every club we've
//      actually enriched, not just the hand-authored 54.
//   2. SYSTEM_TEAMS (hand-authored 54) — kept ONLY for brand colours and
//      philosophy prose on marquee clubs (measured rows don't carry those),
//      and as the profile for a curated club we haven't measured yet.
//   3. generic API normalize — last-resort "pending" placeholder.
// (This used to say "SYSTEM_TEAMS always wins" — that was the pre-Phase-1
// behavior; warmTeamUniverse's merge below is what actually runs today.)
//
// This module fetches the derived rows once, caches them in memory,
// and exposes a by-team-id lookup that returns a profile shaped
// exactly like a SYSTEM_TEAMS entry (so the fit engine can score it
// with no special-casing).
// ============================================================

import { supabase } from './supabaseClient.js';
import { SYSTEM_TEAMS, registerTeamUniverse } from '../data/systemFitData.js';

let _cache = null;       // Map<team_id, profile>
let _loading = null;     // in-flight promise (dedupe concurrent calls)

// Shape a derived DB row into the same object the fit engine expects
// from a SYSTEM_TEAMS entry.
function shapeRow(row) {
  return {
    id: row.team_id,
    name: row.name,
    short: row.short || row.name,
    country: row.country || 'International',
    league: row.league || 'Derived profile',
    formation: row.formation || '4-3-3',
    philosophy: row.philosophy || 'Balanced structure',
    intensity: row.intensity || 'Medium',
    lineHeight: row.line_height || 'Medium',
    crest: row.crest || (row.name || '').split(' ').slice(0, 2).map(w => w[0]).join('').slice(0, 3).toUpperCase(),
    crestUrl: row.logo || null,
    traits: row.traits || { control: 75, transition: 75, pressing: 75, width: 75, tempo: 75, defensiveLoad: 75 },
    derived: true,
    source: 'derived',
  };
}

// Load all derived profiles once, cache as Map keyed by team_id.
export async function loadDerivedTeams() {
  if (_cache) return _cache;
  if (_loading) return _loading;

  _loading = (async () => {
    try {
      const { data, error } = await supabase
        .from('derived_team_profiles')
        .select('team_id,name,short,country,league,formation,philosophy,intensity,line_height,crest,logo,traits');
      if (error) throw error;
      const map = new Map();
      for (const row of (data || [])) {
        map.set(Number(row.team_id), shapeRow(row));
      }
      _cache = map;
      return map;
    } catch {
      _cache = new Map();
      return _cache;
    } finally {
      _loading = null;
    }
  })();

  return _loading;
}

// Synchronous lookup against the in-memory cache (call loadDerivedTeams first).
export function getDerivedTeam(teamId) {
  if (!_cache) return null;
  return _cache.get(Number(teamId)) || null;
}

// Every measured profile as an array, shaped like SYSTEM_TEAMS entries.
// Sync — call loadDerivedTeams() first (returns [] if the cache is cold).
export function allDerivedTeams() {
  if (!_cache) return [];
  return [..._cache.values()];
}

// Search the measured profiles by club / country / league. Awaits the cache
// load itself, so it's safe to call before loadDerivedTeams() has resolved.
// This is what makes EVERY team in the DB reachable from the picker, not just
// the hand-authored 54.
export async function searchDerivedTeams(query = '', limit = 8) {
  const map = await loadDerivedTeams();
  const all = [...map.values()];
  const needle = query.trim().toLowerCase();
  if (!needle) return all.slice(0, limit);
  return all
    .filter(t => `${t.name} ${t.short} ${t.country} ${t.league}`.toLowerCase().includes(needle))
    .slice(0, limit);
}

// Convenience: given an API team object, return a derived-enriched profile if
// we have one, else null. Used by normalizeApiTeam's enrichment path.
export function enrichFromDerived(apiTeam) {
  if (!apiTeam || !_cache) return null;
  const hit = _cache.get(Number(apiTeam.id));
  if (!hit) return null;
  return {
    ...hit,
    crestUrl: apiTeam.crestUrl || hit.crestUrl || null,
  };
}

// Warm the derived-team cache and register the MERGED team universe with the
// canonical fit engine (systemFitData.js's registerTeamUniverse), so EVERY
// page that runs System Fit — not just the System Fit page — searches and
// ranks against every measured club in the DB, not just the hand-authored 54.
//
// This used to be duplicated inline inside SystemFit.jsx's mount effect only
// — which meant the Transfers page's own team search/auto-select never
// called it, never saw a derived club, and was structurally stuck at 54
// clubs regardless of how much real data existed. Centralizing it here so
// every consuming page calls the same warm-up and can't drift out of sync
// again.
//
// Merge rule: measured traits win (that's the whole point of the DNA
// pipeline); marquee clubs keep their hand-authored brand colours +
// philosophy prose, which derived rows don't carry. Fire-and-forget-safe —
// on failure the universe stays as SYSTEM_TEAMS so nothing regresses. Safe
// to call from multiple pages/effects; cheap after the first call since
// loadDerivedTeams() caches.
export async function warmTeamUniverse() {
  await loadDerivedTeams().catch(() => {});
  const byId = new Map(allDerivedTeams().map(t => [Number(t.id), { ...t }]));
  for (const s of SYSTEM_TEAMS) {
    const measured = byId.get(Number(s.id));
    if (measured) {
      byId.set(Number(s.id), {
        ...measured,               // measured traits + categoricals
        accent: s.accent,          // hand-authored brand colours
        secondary: s.secondary,
        philosophy: s.philosophy || measured.philosophy,
        short: s.short || measured.short,
      });
    } else {
      byId.set(Number(s.id), s);   // hand-authored-only club (no measured row yet)
    }
  }
  registerTeamUniverse([...byId.values()]);
}
