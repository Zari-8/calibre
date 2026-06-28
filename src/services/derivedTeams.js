// ============================================================
// derivedTeams.js  —  read derived tactical profiles
// ------------------------------------------------------------
// The System Fit page resolves a club in this order:
//   1. curated SYSTEM_TEAMS (hand-authored, always wins)
//   2. derived_team_profiles (this file — auto-generated breadth)
//   3. generic fallback (neutral profile)
//
// This module supplies layer 2: given an API-Football team id,
// return a profile shaped exactly like a SYSTEM_TEAMS entry so
// the fit engine can score it without any special-casing.
//
// A tiny in-memory cache avoids re-querying the same club within
// a session.
// ============================================================

import * as sbClient from './supabaseClient.js';

// supabaseClient.js may export the client as `supabase` (named) or default.
const supabase = sbClient.supabase || sbClient.default || sbClient.client;

const cache = new Map();        // team_id -> profile | null

// Convert a derived_team_profiles row into the SYSTEM_TEAMS shape.
function rowToProfile(row) {
  if (!row) return null;
  // traits is stored as jsonb; supabase-js returns it already parsed.
  const traits = typeof row.traits === 'string' ? safeParse(row.traits) : row.traits;
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
    traits: traits || { control: 72, transition: 72, pressing: 72, width: 72, tempo: 72, defensiveLoad: 72 },
    derived: true,
    source: 'derived',
  };
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

/**
 * Fetch a derived profile for one API-Football team id.
 * Returns a SYSTEM_TEAMS-shaped object, or null if none exists.
 */
export async function getDerivedTeamProfile(teamId) {
  const id = Number(teamId);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (cache.has(id)) return cache.get(id);

  try {
    const { data, error } = await supabase
      .from('derived_team_profiles')
      .select('*')
      .eq('team_id', id)
      .order('season', { ascending: false })   // newest season first
      .limit(1)
      .maybeSingle();
    if (error) { cache.set(id, null); return null; }
    const profile = rowToProfile(data);
    cache.set(id, profile);
    return profile;
  } catch {
    cache.set(id, null);
    return null;
  }
}
