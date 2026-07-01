// scripts/generateRatingNotifications.mjs
// ─────────────────────────────────────────────────────────────────────────
// Calibre — calibreRating movement → watchlist notifications.
//
// One run does two things:
//   1) SNAPSHOT: for each player, if this is the first time we've seen them,
//      record a baseline in player_rating_history (no alert — nothing to
//      compare yet). The very first run of this script therefore just seeds
//      baselines and sends zero notifications. That's intended.
//   2) DETECT + NOTIFY: compare each player's current calibreRating to their
//      most recent snapshot. If it has moved by >= THRESHOLD, record the new
//      level and drop a notification to every user watching that player.
//
// Snapshots are written ONLY on a first-seen baseline or a threshold move, so
// player_rating_history stays lean and each stored point is a meaningful level.
// Because the baseline only advances when we notify, slow sub-threshold drift
// still eventually crosses and fires (we compare against the last level we told
// watchers about, not against yesterday's tick).
//
// Run (one line, no quotes):
//   SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_service_key node scripts/generateRatingNotifications.mjs
//
// PREREQUISITES for the bell to actually SHOW these:
//   • notifications table created (notifications.sql)
//   • player_rating_history table created (player_rating_history_clean.sql)
//   • NOTIFICATIONS_READY = true in src/services/notifications.js
// ─────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

// ── TUNING ──────────────────────────────────────────────────────────────
const THRESHOLD = 2.0;             // calibreRating points; a move >= this fires.

// ⚠️ VERIFY THESE against user_watchlist if you haven't:
//     select column_name from information_schema.columns where table_name='user_watchlist';
//   If your watchlist names them differently, change the two lines below.
const WATCHLIST_TABLE      = 'user_watchlist';
const WATCHLIST_PLAYER_COL = 'api_player_id';   // how a watched player is referenced
const WATCHLIST_USER_COL   = 'user_id';         // who is watching

// Where a notification click lands. '/players' is safe; make it a deep link
// once you tell me the player-profile route param.
const linkFor = (id) => '/players';
// ────────────────────────────────────────────────────────────────────────

const URL  = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!URL || !SKEY) {
  console.error('Missing credentials. Run it like this (one line, no quotes):');
  console.error('  SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_service_key node scripts/generateRatingNotifications.mjs');
  process.exit(1);
}

const sb = createClient(URL, SKEY, { auth: { persistSession: false } });

// Paginated read so we never hit the 1000-row cap.
async function fetchAll(table, columns, shape) {
  const out = []; const size = 1000; let from = 0;
  while (true) {
    let q = sb.from(table).select(columns).range(from, from + size - 1);
    if (shape) q = shape(q);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < size) break;
    from += size;
  }
  return out;
}

// Insert in chunks so a big first run doesn't send one giant payload.
async function insertChunked(table, rows) {
  const size = 500;
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + size));
    if (error) throw error;
  }
}

async function run() {
  console.log('Calibre ratings → notifications');

  // 1) Current ratings.
  const players = await fetchAll(
    'players',
    'api_player_id, name, rating',
    (q) => q.not('api_player_id', 'is', null).not('rating', 'is', null),
  );
  console.log(`  players with a rating: ${players.length}`);

  // 2) Latest snapshot per player (dedupe newest-first in JS).
  const history = await fetchAll('player_rating_history', 'api_player_id, rating, captured_at');
  history.sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at));
  const lastRating = new Map();
  for (const row of history) {
    if (!lastRating.has(row.api_player_id)) lastRating.set(row.api_player_id, Number(row.rating));
  }

  // 3) Who watches whom (fails SAFE — snapshots still record if this errors).
  const watchMap = new Map(); // api_player_id -> Set(user_id)
  try {
    const watch = await fetchAll(WATCHLIST_TABLE, `${WATCHLIST_USER_COL}, ${WATCHLIST_PLAYER_COL}`);
    for (const w of watch) {
      const pid = w[WATCHLIST_PLAYER_COL]; const uid = w[WATCHLIST_USER_COL];
      if (pid == null || uid == null) continue;
      if (!watchMap.has(pid)) watchMap.set(pid, new Set());
      watchMap.get(pid).add(uid);
    }
    console.log(`  watchlist rows mapped for ${watchMap.size} players`);
  } catch (e) {
    console.error(`  ⚠️ could not read ${WATCHLIST_TABLE} (check WATCHLIST_* constants): ${e.message}`);
    console.error('     Continuing — snapshots will record, but no notifications will be sent this run.');
  }

  const newSnapshots = [];
  const notifications = [];
  let baselines = 0, moves = 0;

  for (const p of players) {
    const id = p.api_player_id;
    const current = Number(p.rating);
    if (!Number.isFinite(current)) continue;

    const last = lastRating.get(id);
    if (last == null) {                       // first time we've seen this player
      newSnapshots.push({ api_player_id: id, player_name: p.name || null, rating: current });
      baselines++;
      continue;
    }

    const delta = current - last;
    if (Math.abs(delta) < THRESHOLD) continue; // not a material move

    moves++;
    newSnapshots.push({ api_player_id: id, player_name: p.name || null, rating: current });

    const watchers = watchMap.get(id);
    if (!watchers || !watchers.size) continue;

    const up = delta > 0;
    const name = p.name || 'A player you follow';
    for (const uid of watchers) {
      notifications.push({
        user_id: uid,
        type: 'watchlist_rating',
        title: `${name}'s rating ${up ? 'climbed' : 'dropped'} to ${current}`,
        body: `calibreRating moved ${up ? '+' : ''}${delta.toFixed(1)} (was ${last}). You're watching ${name}.`,
        link: linkFor(id),
        meta: { api_player_id: id, from: last, to: current, delta: Number(delta.toFixed(2)) },
      });
    }
  }

  if (newSnapshots.length) await insertChunked('player_rating_history', newSnapshots);
  if (notifications.length) await insertChunked('notifications', notifications);

  console.log(`  baselines seeded: ${baselines}  |  threshold moves: ${moves}  |  notifications sent: ${notifications.length}`);
  console.log('Done.');
}

run().catch((e) => { console.error(e); process.exit(1); });
