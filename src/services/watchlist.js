// src/services/watchlist.js
// ─────────────────────────────────────────────────────────────────────────────
// "Watchlist" — a personal saved-players list (advertised as a Pro feature).
//
// localStorage-backed for now, so it works instantly for everyone without any
// backend. A per-account Supabase sync can layer on top once auth + ContiPay
// subscriptions are wired (store the same shape in a `watchlists` table keyed by
// user_id, and hydrate this list from it on login).
//
// Reactivity: every write dispatches a `calibre:watchlist-change` window event,
// so any component can re-read getWatchlist() and stay in sync across the page.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = 'calibre:watchlist';
export const WATCHLIST_EVENT = 'calibre:watchlist-change';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full / blocked */ }
  try { window.dispatchEvent(new CustomEvent(WATCHLIST_EVENT)); } catch { /* SSR / no window */ }
  return list;
}

function apiIdOf(player) {
  return player?.apiPlayerId ?? player?.api_player_id ?? player?.id ?? null;
}

export function getWatchlist() {
  return read();
}

export function isWatched(apiId) {
  if (apiId == null) return false;
  return read().some(p => String(p.apiPlayerId) === String(apiId));
}

export function toggleWatch(player) {
  const apiId = apiIdOf(player);
  if (apiId == null) return read();
  const list = read();
  const idx = list.findIndex(p => String(p.apiPlayerId) === String(apiId));
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.unshift({
      apiPlayerId: apiId,
      name: player.full_name || player.name || 'Player',
      position: player.position || player.pos || '',
      team: player.team || player.club || '',
      rating: player.rating ?? null,
      img: player.img || player.image || null,
      addedAt: Date.now(),
    });
  }
  return write(list);
}

export function removeWatch(apiId) {
  if (apiId == null) return read();
  return write(read().filter(p => String(p.apiPlayerId) !== String(apiId)));
}
