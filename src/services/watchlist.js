import { supabase, supabaseConfigured } from './supabaseClient.js';

// ─────────────────────────────────────────────────────────────────────────
// WATCHLIST — per-account saved players.
//
// Mirrors the community.js pattern: when a user is logged in, the watchlist
// persists to Supabase (user_watchlist table) and follows them across devices.
// When not logged in, it falls back to localStorage so the feature still works
// for anonymous browsing — those local picks are merged up to the account on
// first login (mergeLocalIntoAccount).
//
// The UI stores the shortlist as an array of player NAMES (matching the
// existing Talents `shortlist` state), so these helpers speak names too, with
// an optional apiPlayerId/context carried through for richer rows.
// ─────────────────────────────────────────────────────────────────────────

const LOCAL_KEY = 'calibre:watchlist:device';

function localRead() {
  try { return JSON.parse(window.localStorage.getItem(LOCAL_KEY)) || []; }
  catch { return []; }
}
function localWrite(names) {
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(names)); } catch {}
}

// Load the user's watchlist as an array of player names.
export async function loadWatchlist(user) {
  if (supabaseConfigured && user?.id) {
    const { data, error } = await supabase
      .from('user_watchlist')
      .select('player_name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) return data.map(r => r.player_name);
  }
  return localRead();
}

// Add a player. Logged in → Supabase; otherwise localStorage.
export async function addToWatchlist({ name, apiPlayerId = null, context = null }, user) {
  if (supabaseConfigured && user?.id) {
    const { error } = await supabase
      .from('user_watchlist')
      .insert({ user_id: user.id, player_name: name, api_player_id: apiPlayerId, context });
    // 23505 = unique violation (already saved) — treat as success, not error.
    if (error && error.code !== '23505') throw error;
    return;
  }
  const names = localRead();
  if (!names.includes(name)) localWrite([name, ...names]);
}

// Remove a player. Logged in → Supabase; otherwise localStorage.
export async function removeFromWatchlist({ name }, user) {
  if (supabaseConfigured && user?.id) {
    const { error } = await supabase
      .from('user_watchlist')
      .delete()
      .eq('user_id', user.id)
      .eq('player_name', name);
    if (error) throw error;
    return;
  }
  localWrite(localRead().filter(n => n !== name));
}

// On first login, push any anonymous local picks up to the account, then clear
// the local cache so the account becomes the single source of truth.
export async function mergeLocalIntoAccount(user) {
  if (!supabaseConfigured || !user?.id) return;
  const local = localRead();
  if (!local.length) return;
  // Insert all; ignore unique-violation duplicates.
  const rows = local.map(name => ({ user_id: user.id, player_name: name }));
  const { error } = await supabase.from('user_watchlist').insert(rows);
  if (!error || error.code === '23505') localWrite([]);
}
