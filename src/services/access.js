// src/services/access.js
// ─────────────────────────────────────────────────────────────────────────
// Central access / tier resolver.
//
// Owner accounts always resolve to full 'founder' access so you can test every
// gated feature without touching localStorage. This is tied to your logged-in
// Calibre account (Supabase auth email), so it survives cache clears and works
// on any device you sign in on.
//
// Everyone else falls back to the localStorage tier placeholder until real
// subscription state (ContiPay / Supabase) is wired in.
// ─────────────────────────────────────────────────────────────────────────

// 👇 PUT THE EMAIL YOU LOG INTO CALIBRE WITH HERE (lowercase is fine).
//    You can list more than one if you have multiple owner/test accounts.
export const OWNER_EMAILS = [
  'team@calibrefootball.com', // <-- REPLACE with your Calibre login email
];

export const PAID_TIERS = ['scout', 'club', 'founder'];

export function isOwnerEmail(email) {
  if (!email) return false;
  const e = String(email).trim().toLowerCase();
  return OWNER_EMAILS.some(x => String(x).trim().toLowerCase() === e);
}

// Effective tier for a user. Owner -> 'founder' always. Otherwise the
// localStorage placeholder ('scout' | 'club' | 'founder' | null).
export function resolveTier(userEmail) {
  if (isOwnerEmail(userEmail)) return 'founder';
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem('calibre:tier'); } catch { return null; }
}

export function hasPaidAccess(tier) {
  return PAID_TIERS.includes(tier);
}
