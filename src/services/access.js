// src/services/access.js
// ─────────────────────────────────────────────────────────────────────────────
// Central access / tier resolver for Calibre.
//
// Tiers (low → high):
//   free     – anonymous visitors and signed-in users with no subscription
//   pro      – $4.99 /mo  · volume tier · full valuation + unlimited analyses
//   scout    – $19 /mo    · full deal toolkit · comparables + Deal Report
//   club     – $99 /mo    · recruitment desk · System Fit + compare + exports + seats
//   founder  – internal / owner accounts · everything, always
//
// Usage:
//   import { resolveTier, can } from '../services/access.js';
//   const tier = resolveTier(user?.email);
//   if (can(tier, 'valuation.breakdown')) { ... }
//
// Owner accounts always resolve to 'founder' so you can test every gated
// feature without touching localStorage. Tied to your Supabase auth email,
// so it survives cache clears and works on any device.
// ─────────────────────────────────────────────────────────────────────────────

// 👇 Replace with the email(s) you log into Calibre with (lowercase fine).
export const OWNER_EMAILS = [
  'team@calibrefootball.com',
];

// Tier order — each tier includes all capabilities of every tier below it.
export const TIERS = ['free', 'pro', 'scout', 'club', 'founder'];

// ── Capability definitions ────────────────────────────────────────────────────
// Each capability has the MINIMUM tier required to unlock it.
// Call can(tier, capability) anywhere in the app.
const CAPABILITIES = {
  // Depth per player — Transfers page
  'valuation.verdict':       'free',    // transfer verdict + calibre value point estimate
  'valuation.breakdown':     'pro',     // fair range, max bid, premium %, age curve
  'valuation.comparables':   'scout',   // DB-sourced comparable players with engine value
  'valuation.report':        'scout',   // Deal Report PDF download
  'valuation.dossier':       'club',    // trigger the founder-generated dossier overlay

  // System Fit
  'fit.score':               'free',    // fit score visible (capped volume for free)
  'fit.full':                'club',    // key stats, role radar, lineup, best-fit ranking
  'fit.compare':             'club',    // compare two live players
  'fit.export':              'club',    // export fit / comparison PDF or CSV

  // Volume
  'volume.unlimited':        'pro',     // unlimited analyses (free is rate-capped)

  // Watchlist (advertised Pro feature)
  'watchlist':               'pro',     // save players to a personal watchlist

  // Exports (general)
  'export.pdf':              'scout',   // Deal Report PDF
  'export.csv':              'club',    // CSV exports (System Fit etc.)
};

// ── Tier resolution ───────────────────────────────────────────────────────────

export function isOwnerEmail(email) {
  if (!email) return false;
  const e = String(email).trim().toLowerCase();
  return OWNER_EMAILS.some(x => String(x).trim().toLowerCase() === e);
}

/**
 * Resolve the effective tier for a user.
 * Owner email → 'founder' always.
 * Otherwise falls back to localStorage until ContiPay/Supabase subscription
 * state is wired in.
 */
export function resolveTier(userEmail) {
  if (isOwnerEmail(userEmail)) return 'founder';
  if (typeof window === 'undefined') return 'free';
  try {
    const stored = localStorage.getItem('calibre:tier');
    return TIERS.includes(stored) ? stored : 'free';
  } catch {
    return 'free';
  }
}

// ── Capability checks ─────────────────────────────────────────────────────────

/**
 * Check whether a tier has a specific capability.
 * can('scout', 'valuation.comparables') → true
 * can('pro',   'valuation.comparables') → false
 */
export function can(tier, capability) {
  const required = CAPABILITIES[capability];
  if (!required) return false; // unknown capability → deny
  return TIERS.indexOf(tier) >= TIERS.indexOf(required);
}

// ── Legacy helpers (kept so existing call-sites don't break) ─────────────────

/** True for any paying tier (pro and above). */
export const PAID_TIERS = ['pro', 'scout', 'club', 'founder'];
export function hasPaidAccess(tier) { return PAID_TIERS.includes(tier); }

/** True for scout tier and above. */
export function hasScoutAccess(tier) { return can(tier, 'valuation.comparables'); }

/** True for club tier and above. */
export function hasClubAccess(tier) { return can(tier, 'fit.full'); }
