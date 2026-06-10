// ─────────────────────────────────────────────────────────────────────────
// Shared player-id registry.
//
// Single source of truth mapping a player NAME to their API-Football id, so any
// surface that renders a portrait from hardcoded / editorial / snapshot data
// resolves the SAME official image (media.api-sports.io/football/players/{id}.png)
// the same way everywhere — Home, Debates, Competitions, World Cup, Players.
//
// Add a name here once and every page that uses playerIdFor() picks it up.
// ─────────────────────────────────────────────────────────────────────────
export const PLAYER_IDS = {
  // — confirmed via Supabase —
  'kylian mbappé': 278, 'mbappé': 278, 'mbappe': 278,
  'erling haaland': 1100, 'haaland': 1100,
  'jude bellingham': 129718, 'bellingham': 129718,
  'vinícius júnior': 762, 'vinicius júnior': 762, 'vinícius': 762, 'vinicius': 762, 'vini jr.': 762, 'vini jr': 762,
  'bukayo saka': 1460, 'saka': 1460,
  'phil foden': 631, 'foden': 631,
  'rodri': 44,
  'federico valverde': 756, 'valverde': 756,
  'martin ødegaard': 37127, 'ødegaard': 37127, 'odegaard': 37127,
  'mohamed salah': 306, 'salah': 306,
  'lamine yamal': 152981, 'yamal': 152981,
  'pedri': 133609,
  'declan rice': 2937, 'rice': 2937,
  'vitinha': 128384,
  'florian wirtz': 203224, 'wirtz': 203224,
  'lionel messi': 154, 'messi': 154,
  'cristiano ronaldo': 874, 'c. ronaldo': 874,
  'harry kane': 184, 'kane': 184,
  'raphinha': 1496,
  'ousmane dembélé': 153, 'ousmane dembele': 153, 'o. dembélé': 153, 'o. dembele': 153, 'dembélé': 153, 'dembele': 153,
  'lautaro martínez': 217, 'lautaro martinez': 217, 'l. martínez': 217, 'l. martinez': 217, 'lautaro': 217,
  'jamal musiala': 181812, 'musiala': 181812,
  'nicolò barella': 30558, 'nicolo barella': 30558, 'barella': 30558,
  'alexander isak': 2864, 'isak': 2864,
  'cole palmer': 152982, 'palmer': 152982,
  'kevin de bruyne': 629, 'de bruyne': 629,
  'dominik szoboszlai': 1096, 'szoboszlai': 1096,
  'arda güler': 291964, 'arda guler': 291964, 'güler': 291964, 'guler': 291964,
  'pau cubarsí': 396623, 'pau cubarsi': 396623, 'cubarsí': 396623, 'cubarsi': 396623,
  'joão neves': 335051, 'joao neves': 335051,
};

// Resolve a name (full, abbreviated like "K. Mbappé", or surname) to an id.
// Returns null when unknown so callers can fall back to their own image.
export function playerIdFor(name) {
  if (!name) return null;
  const key = String(name).trim().toLowerCase().replace(/\s+/g, ' ');
  if (PLAYER_IDS[key] != null) return PLAYER_IDS[key];
  const parts = key.split(' ');
  if (parts.length >= 2) {
    const lastTwo = parts.slice(-2).join(' ');
    if (PLAYER_IDS[lastTwo] != null) return PLAYER_IDS[lastTwo];
  }
  const last = parts[parts.length - 1];
  if (PLAYER_IDS[last] != null) return PLAYER_IDS[last];
  return null;
}

export default playerIdFor;
