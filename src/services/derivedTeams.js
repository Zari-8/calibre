// ============================================================
// derivedTeams.js  —  read layer for derived_team_profiles
// ------------------------------------------------------------
// The System Fit page resolves a club in this order:
//   1. SYSTEM_TEAMS (hand-authored 54)  — always wins
//   2. derived_team_profiles (this file) — real traits from API-Football
//   3. generic API normalize             — last-resort "pending" placeholder
//
// This module fetches the derived rows once, caches them in memory,
// and exposes a by-team-id lookup that returns a profile shaped
// exactly like a SYSTEM_TEAMS entry (so the fit engine can score it
// with no special-casing).
// ============================================================

import { supabase } from './supabaseClient.js';

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
