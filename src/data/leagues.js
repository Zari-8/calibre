// ─────────────────────────────────────────────────────────────────────────
// League directory — maps an API-Football league_id to a human-readable name
// and a strength tier (1 = elite, 4 = developmental). Used to turn the registry's
// bare `league_id` into a readable "League context" on talent/player cards
// instead of the "Imported registry" placeholder.
//
// Tiers mirror the strength bands the Calibre rating engine uses, so the label
// a card shows ("Tier 1") is consistent with how the rating was weighted.
// Only confidently-known ids are listed; anything else falls back gracefully.
// ─────────────────────────────────────────────────────────────────────────
export const LEAGUES = {
  // Tier 1 — elite men's
  39:  { name: 'Premier League',  country: 'England',     tier: 1 },
  140: { name: 'La Liga',         country: 'Spain',       tier: 1 },
  78:  { name: 'Bundesliga',      country: 'Germany',     tier: 1 },
  135: { name: 'Serie A',         country: 'Italy',       tier: 1 },
  61:  { name: 'Ligue 1',         country: 'France',      tier: 1 },
  // Tier 2 — strong men's
  94:  { name: 'Primeira Liga',   country: 'Portugal',    tier: 2 },
  88:  { name: 'Eredivisie',      country: 'Netherlands', tier: 2 },
  71:  { name: 'Brasileirão',     country: 'Brazil',      tier: 2 },
  144: { name: 'Jupiler Pro League', country: 'Belgium',  tier: 2 },
  40:  { name: 'Championship',    country: 'England',     tier: 2 },
  // Tier 3 — competitive men's
  128: { name: 'Liga Profesional', country: 'Argentina',  tier: 3 },
  203: { name: 'Süper Lig',       country: 'Turkey',      tier: 3 },
  253: { name: 'Major League Soccer', country: 'USA',     tier: 3 },
  307: { name: 'Saudi Pro League', country: 'Saudi Arabia', tier: 3 },
  98:  { name: 'J1 League',       country: 'Japan',       tier: 3 },
  // Women's
  525: { name: "Women's Champions League", country: 'Europe',  tier: 1 },
  44:  { name: "Women's Super League",     country: 'England', tier: 1 },
  254: { name: 'NWSL',           country: 'USA',         tier: 2 },
  142: { name: 'Liga F',         country: 'Spain',       tier: 2 },
};

const TIER_LABEL = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3', 4: 'Development' };

// Just the league name, or null when the id isn't in the directory.
export function leagueName(leagueId) {
  const l = LEAGUES[Number(leagueId)];
  return l ? l.name : null;
}

// Readable context label, e.g. "La Liga · Tier 1". Returns null when unknown so
// the caller can fall back to whatever it already had.
export function leagueContext(leagueId) {
  const l = LEAGUES[Number(leagueId)];
  if (!l) return null;
  return `${l.name} · ${TIER_LABEL[l.tier]}`;
}

export default leagueContext;
