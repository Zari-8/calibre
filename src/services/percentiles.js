// ─────────────────────────────────────────────────────────────────────────
// Percentile-vs-pool engine — single source of truth.
//
// Extracted from the Players page's v3 profile pop-up (where this was first
// built for "Advanced Stats" / "Scout Report") so System Fit — and any other
// page — can show the same real, honest percentile read instead of each
// page growing its own slightly-different copy. Every number here is either
// a genuine column on the Supabase player row or a per-90 rate derived from
// one; a metric with no evidence returns `pct: null` rather than a guessed
// value (same convention used everywhere else in this codebase).
//
// Usage:
//   import { computeKeyStatPercentiles } from '../services/percentiles.js';
//   const keyStats = computeKeyStatPercentiles(player, pool);
//   // -> [{ key, label, dp, value, pct }, ...]
// ─────────────────────────────────────────────────────────────────────────

// Real per-90 "Key Stats" config. Every key here is a genuine column in the
// Supabase player bank (see PLAYER_SELECT in supabasePlayers.js) — most are
// TheStatsAPI enrichment fields.
export const KEY_STAT_FIELDS = [
  { key: 'goals', label: 'Goals', dp: 2 },
  { key: 'assists', label: 'Assists', dp: 2 },
  { key: 'xg', label: 'xG', dp: 2, per90Field: 'xg_per_90' },
  { key: 'xa', label: 'xA', dp: 2, per90Field: 'xa_per_90' },
  { key: 'shots', label: 'Shots', dp: 2 },
  { key: 'shots_on_target', label: 'Shots on Target', dp: 2 },
  { key: 'pass_accuracy', label: 'Pass Accuracy', dp: 1, rate: true, suffix: '%' },
  { key: 'touches', label: 'Touches', dp: 1 },
  { key: 'duels_won', label: 'Duels Won', dp: 2 },
  { key: 'aerial_duels_won', label: 'Aerial Won', dp: 2 },
  { key: 'pressures', label: 'Pressures', dp: 2 },
  { key: 'progressive_carries', label: 'Progressive Runs', dp: 2 },
];

export function statMinutesOf(row) {
  return Number(row?.stats_minutes) || Number(row?.minutes) || 0;
}

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Converts a raw season-total stat into a per-90 rate. Returns null when
// there's no minutes evidence to normalize against — never a fabricated 0.
export function per90Value(row, field) {
  const m = statMinutesOf(row);
  const raw = row?.[field];
  if (raw == null || !(m > 0)) return null;
  return (Number(raw) / m) * 90;
}

export function keyStatValue(row, def) {
  if (def.rate) return num(row?.[def.key]);
  if (def.per90Field && row?.[def.per90Field] != null) return Number(row[def.per90Field]);
  return per90Value(row, def.key);
}

// value's rank inside pool, as a 0-100 percentile. Requires at least 8 real
// comparison points — below that a percentile is more noise than signal, so
// this returns null (rendered as "not enough data" by callers) rather than
// a misleadingly precise number off a tiny sample.
export function percentileRank(value, pool) {
  if (value == null || !Array.isArray(pool) || pool.length < 8) return null;
  const below = pool.filter(v => v < value).length;
  return Math.round((below / pool.length) * 100);
}

// Convenience: run every KEY_STAT_FIELDS metric for one player against a
// pool in one call, returning the shape every percentile-bar UI wants.
export function computeKeyStatPercentiles(player, pool, fields = KEY_STAT_FIELDS) {
  return fields.map(def => {
    const value = keyStatValue(player, def);
    const poolVals = (pool || []).map(row => keyStatValue(row, def)).filter(v => v != null);
    return { ...def, value, pct: percentileRank(value, poolVals) };
  });
}
