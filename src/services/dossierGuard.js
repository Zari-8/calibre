// ============================================================
// dossierGuard.js  —  Client-report delivery gate
// ------------------------------------------------------------
// Purpose: a $499 client dossier must NEVER be exported while
// any analyst-verification field is still empty. This module
// is the single source of truth for "is this report complete
// enough to deliver to a paying client?"
//
// Used by BOTH dossiers (Deal + Discovery). The dossier
// component asks the guard before allowing client-mode export.
//
// Two render modes the component should honour:
//   - mode "internal"  -> always allowed; shows PENDING rows;
//                         stamps "INTERNAL DRAFT - NOT FOR DELIVERY"
//   - mode "client"    -> only exportable when guard.ready === true
// ============================================================

// The verification fields the analyst must supply before a
// client report is deliverable. These are the "human layer"
// items the engine cannot compute and must not fabricate.
// Keyed by dossier type, because Deal and Discovery ask
// different questions.
export const REQUIRED_VERIFICATION = {
  deal: [
    { key: 'wageStructure',   label: 'Wage structure impact' },
    { key: 'injuryLoad',      label: 'Injury & load history' },
    { key: 'temperament',     label: 'Off-pitch & temperament' },
    { key: 'contractLeverage',label: 'Contract leverage / terms' },
    { key: 'analystVerdict',  label: 'Analyst written verdict' },
  ],
  discovery: [
    { key: 'injuryLoad',      label: 'Injury & load history' },
    { key: 'temperament',     label: 'Character & adaptability' },
    { key: 'pathwayRead',     label: 'Development pathway read' },
    { key: 'riskRead',        label: 'Risk-of-stalling read' },
    { key: 'analystVerdict',  label: 'Analyst written verdict' },
  ],
};

// A field counts as "filled" if it's a non-empty, non-whitespace
// string (or any truthy non-string value). Placeholder tokens the
// engine emits for unfilled rows are treated as empty.
const PLACEHOLDER_TOKENS = new Set([
  '', '—', '-', 'pending', 'pending verification', 'tbd', 'n/a',
  'analyst layer', 'awaiting analyst', 'to be supplied',
]);

function isFilled(value) {
  if (value == null) return false;
  if (typeof value !== 'string') return Boolean(value);
  const v = value.trim().toLowerCase();
  if (!v) return false;
  return !PLACEHOLDER_TOKENS.has(v);
}

/**
 * Evaluate whether a dossier is ready for client delivery.
 *
 * @param {('deal'|'discovery')} dossierType
 * @param {object} verification  - object of { fieldKey: value } the analyst filled
 * @returns {{ ready:boolean, missing:Array<{key,label}>, filled:Array<{key,label}>, total:number }}
 */
export function evaluateDossier(dossierType, verification = {}) {
  const required = REQUIRED_VERIFICATION[dossierType] || REQUIRED_VERIFICATION.deal;
  const missing = [];
  const filled = [];
  for (const field of required) {
    if (isFilled(verification[field.key])) filled.push(field);
    else missing.push(field);
  }
  return {
    ready: missing.length === 0,
    missing,
    filled,
    total: required.length,
  };
}

/**
 * Convenience: the watermark text the dossier should stamp,
 * given mode + readiness. Client mode never reaches here unless
 * ready, but we guard anyway.
 *
 * @param {('internal'|'client')} mode
 * @param {boolean} ready
 * @param {string} recipient  - e.g. "FC Barcelona" or owner email
 */
export function watermarkFor(mode, ready, recipient = 'CALIBRE') {
  if (mode === 'client' && ready) {
    return `CALIBRE · PREPARED FOR ${recipient.toUpperCase()} · CONFIDENTIAL`;
  }
  // any non-ready or internal render is explicitly a draft
  return `INTERNAL DRAFT · NOT FOR DELIVERY · ${recipient.toUpperCase()}`;
}
