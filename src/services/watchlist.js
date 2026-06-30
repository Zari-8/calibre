import { supabase, supabaseConfigured } from './supabaseClient.js';

// ─────────────────────────────────────────────────────────────────────────
// WATCHLIST — saved players, shared by the Players page (senior players,
// Pro-gated) and the Talents page (youth shortlist).
//
// TWO SURFACES, ONE STORE:
//   • Players.jsx uses a SYNCHRONOUS, id-based, event-driven API:
//       getWatchlist(), isWatched(id), toggleWatch(player), removeWatch(id),
//       and the WATCHLIST_EVENT broadcast so every component re-syncs on change.
//   • Talents.jsx uses an async name-based API for its youth shortlist:
//       loadWatchlist(user), addToWatchlist(), removeFromWatchlist(), mergeLocalIntoAccount().
//
// localStorage is the immediate source of truth (so getWatchlist() can be
// synchronous and the UI is instant). When a user is logged in, every change
// also writes through to Supabase (user_watchlist) so the list persists to the
// account and across devices. On login, mergeLocalIntoAccount() pushes any
// anonymous local picks up to the account.
// ─────────────────────────────────────────────────────────────────────────

const LOCAL_KEY = 'calibre:watchlist';
export const WATCHLIST_EVENT = 'calibre:watchlist-changed';

function read() {
  try { return JSON.parse(window.localStorage.getItem(LOCAL_KEY)) || []; }
  catch { return []; }
}
function write(items) {
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(items)); } catch {}
  try { window.dispatchEvent(new CustomEvent(WATCHLIST_EVENT)); } catch {}
}

// Normalise a player object to a stable id + a light stored record.
function playerId(p) {
  if (p == null) return null;
  if (typeof p === 'number' || typeof p === 'string') return String(p);
  return String(p.apiPlayerId ?? p.id ?? p.api_player_id ?? p.name ?? '');
}
function toRecord(p) {
  return {
    id: playerId(p),
    apiPlayerId: p?.apiPlayerId ?? p?.api_player_id ?? null,
    name: p?.name ?? null,
    club: p?.club ?? p?.team ?? null,
    pos: p?.pos ?? p?.position ?? null,
    photo: p?.photo ?? null,
  };
}

// ── Synchronous, id-based API (Players.jsx) ──────────────────────────────

export function getWatchlist() {
  return read();
}

export function isWatched(id) {
  const key = String(id ?? '');
  return read().some(item => item.id === key);
}

export function toggleWatch(player) {
  const rec = toRecord(player);
  if (!rec.id) return;
  const items = read();
  const exists = items.some(item => item.id === rec.id);
  const next = exists ? items.filter(item => item.id !== rec.id) : [rec, ...items];
  write(next);
  // Background account sync (no await — UI already updated).
  syncToAccount(rec, exists ? 'remove' : 'add');
}

export function removeWatch(id) {
  const key = String(id ?? '');
  const items = read();
  if (!items.some(item => item.id === key)) return;
  write(items.filter(item => item.id !== key));
  syncToAccount({ id: key }, 'remove');
}

// ── Async, account-persistence layer (write-through) ─────────────────────

let _user = null;
// Components with auth context call this so background writes know who to
// persist for. Safe to call repeatedly.
export function bindWatchlistUser(user) { _user = user || null; }

async function syncToAccount(rec, action) {
  if (!supabaseConfigured || !_user?.id || !rec?.id) return;
  try {
    if (action === 'add') {
      await supabase.from('user_watchlist').insert({
        user_id: _user.id, player_name: rec.name || rec.id, api_player_id: rec.apiPlayerId ?? null, context: 'senior',
      });
    } else {
      await supabase.from('user_watchlist').delete()
        .eq('user_id', _user.id)
        .eq('player_name', rec.name || rec.id);
    }
  } catch { /* localStorage already holds the truth; ignore */ }
}

// ── Talents youth shortlist API (name-based, async) ──────────────────────
// Kept for the youth radar, which speaks player names.

export async function loadWatchlist(user) {
  if (supabaseConfigured && user?.id) {
    const { data, error } = await supabase
      .from('user_watchlist').select('player_name')
      .eq('user_id', user.id).order('created_at', { ascending: false });
    if (!error && data) return data.map(r => r.player_name);
  }
  return read().map(item => item.name).filter(Boolean);
}

export async function addToWatchlist({ name, apiPlayerId = null, context = null }, user) {
  if (supabaseConfigured && user?.id) {
    const { error } = await supabase.from('user_watchlist')
      .insert({ user_id: user.id, player_name: name, api_player_id: apiPlayerId, context });
    if (error && error.code !== '23505') throw error;
    return;
  }
  const items = read();
  if (!items.some(i => i.name === name)) write([{ id: name, name, apiPlayerId }, ...items]);
}

export async function removeFromWatchlist({ name }, user) {
  if (supabaseConfigured && user?.id) {
    const { error } = await supabase.from('user_watchlist')
      .delete().eq('user_id', user.id).eq('player_name', name);
    if (error) throw error;
    return;
  }
  write(read().filter(i => i.name !== name));
}

export async function mergeLocalIntoAccount(user) {
  if (!supabaseConfigured || !user?.id) return;
  const local = read();
  if (!local.length) return;
  const rows = local.map(item => ({
    user_id: user.id, player_name: item.name || item.id, api_player_id: item.apiPlayerId ?? null,
  }));
  const { error } = await supabase.from('user_watchlist').insert(rows);
  if (!error || error.code === '23505') { /* keep local copy; it mirrors the account now */ }
}
