import { useState } from 'react';
import { Share2, MessageCircle, Link2, Check, Image as ImageIcon } from 'lucide-react';
import { playerPhotoUrl, teamLogoUrl } from '../services/apiFootball.js';

// X (Twitter) glyph isn't in lucide; use a tiny inline mark so the brand reads right.
function XMark({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.59l-5.17-6.76L5.3 22H2.04l8.03-9.17L1.5 2h6.75l4.67 6.18L18.244 2Zm-1.16 18h1.83L7.01 3.9H5.05L17.084 20Z" />
    </svg>
  );
}

// The real public domain — deliberately NOT window.location.origin for
// anything that gets shared externally. Vercel gives every preview/branch
// deployment its own throwaway host (calibre-xxxxxxx-calibre-project.
// vercel.app), and those are gated behind Vercel's deployment-protection
// login wall by default — a link built from window.location.origin while
// testing on a preview looks fine in-app but is unreachable to anyone else,
// including WhatsApp/X's own preview crawlers (confirmed: this is exactly
// why a real WhatsApp share showed nothing — the shared link pointed at a
// preview host, not calibrefootball.com). Every outward-facing share link
// must resolve to the same real domain no matter which deployment it was
// generated from.
export const SITE_ORIGIN = 'https://www.calibrefootball.com';

/**
 * Drop-in share control. Pass the text and a URL; everything else is handled.
 *   <ShareBar text="Mbappé → Real Madrid: 91% system fit on Calibre" url={shareUrl('/system-fit')} />
 *
 * Pass cardUrl too on pages that have a shareable card (buildShareCardUrl/
 * buildTalentCardUrl output) and every button here — native share, X,
 * WhatsApp, copy — hands out the interactive api/share-unfurl.js link
 * instead of the bare page URL, same as ShareModal. Without cardUrl this
 * behaves exactly as before (plain link share) — that's still correct on
 * pages with no card to unfurl (Players, SystemFit, WorldCup, Debates).
 *
 * Renders: native share (mobile only, one tap to any app incl. WhatsApp/X),
 * plus explicit X, WhatsApp and copy-link buttons for desktop.
 */
export function shareUrl(path) {
  if (!path) return SITE_ORIGIN;
  return path.startsWith('http') ? path : SITE_ORIGIN + path;
}

// Builds the URL for the shareable valuation-card image (api/share-card.js,
// a Vercel Edge Function rendering a 1200x630 PNG). Kept as one helper so
// every call site (Transfers, Dossier, DealReport) builds the same shape of
// URL from a live valuation/verdict object instead of hand-assembling query
// strings — same "one seam" pattern calibreFitValue.js uses for consuming
// calibreValue.js's output.
//   player  : { name/full_name, club, pos/position, age, image/img }
//   valuation: the object returned by calibreValue(player) — reads
//              estimatedValue and fairRange
//   verdict : { label, tone } — e.g. what dealVerdict/verdictDisplay produce
// verdictLabel is a REQUIRED separate param, deliberately not read off
// verdict.label — calibreFitValue.js's raw labels (BACK IT / FAIR DEAL /
// NEGOTIATE HARD / CONDITIONAL DEAL / SYSTEM RISK / PUNT / WALK AWAY) are
// internal taxonomy, not user-facing copy. Callers must pass the same
// friendly text they render on-page (Transfers.jsx's `verdictDisplay`) so
// the card never shows a label a viewer wasn't already shown on the site.
//
// fit/askingPrice/premium/buyingTeam are all optional and only render on
// the card when actually present — see api/share-card.js's own comments
// on why (nothing here should ever be fabricated for the sake of a fuller-
// looking card).
export function buildShareCardUrl({ player, valuation, verdict, verdictLabel, fit, askingPrice, buyingTeam, riskPct } = {}) {
  const p = new URLSearchParams();
  const name = player?.full_name || player?.name;
  if (name) p.set('name', name);
  if (player?.club) p.set('club', player.club);
  const pos = player?.pos || player?.position;
  if (pos) p.set('pos', pos);
  if (player?.age != null) p.set('age', String(player.age));
  // Same rating shown in the page's own player panel (Transfers.jsx reads
  // ability_rating first, falling back to rating).
  const rating = player?.ability_rating ?? player?.rating;
  if (rating != null) p.set('rating', String(Math.round(rating)));
  // Mirrors ApiPlayerImage.jsx's tier-2 resolution (direct API-Football URL
  // from a trusted apiPlayerId) — that component's tier-4 fuzzy name search
  // is async and can't run inside this synchronous URL builder, so it's
  // skipped here; a card with no id and no preferred photo just falls back
  // to the initial-letter placeholder rather than guessing a face.
  const img = player?.image || player?.img || playerPhotoUrl(player?.apiPlayerId);
  if (img) p.set('img', img);

  const displayValue = buyingTeam && fit?.fitAdjustedValue != null ? fit.fitAdjustedValue : valuation?.estimatedValue;
  if (displayValue != null) p.set('value', String(displayValue));
  if (valuation?.fairRange) p.set('fair', `${valuation.fairRange.low}-${valuation.fairRange.high}`);

  if (askingPrice != null) p.set('asking', String(askingPrice));
  if (verdict?.premium != null) p.set('premium', String(verdict.premium));
  if (buyingTeam && fit?.fitScore != null) p.set('fit', String(fit.fitScore));
  // Same 0-100 figure driving the page's own SYSTEM RISK slider
  // (Transfers.jsx's riskPct) — not a separate invented card-only number.
  if (riskPct != null) p.set('risk', String(riskPct));
  // Position scarcity (valuation.scarcity) — real, club-agnostic, so unlike
  // fit it's always available. Swapped in for the "Trajectory" stat an
  // earlier revision shipped, which was a real number in calibreRating.js
  // but had its weight zeroed out for being non-discriminating — not
  // something to surface as a public "mystery stat" on a shared card.
  if (valuation?.scarcity != null) p.set('scarcity', String(valuation.scarcity));

  const label = verdictLabel || verdict?.label;
  if (label) p.set('verdict', label);
  if (verdict?.tone) p.set('tone', verdict.tone);

  // Real crest images (teamLogoUrl -> API-Football's actual logo CDN, same
  // one player photos already come from), not the text-abbreviation badges
  // the card used at first. player.apiTeamId is the DB's real API-Football
  // id for the player's current club; buyingTeam.id is systemFitData.js's
  // real id for the candidate club (e.g. Chelsea=49, Real Madrid=541).
  if (player?.club) {
    p.set('fromClub', player.club);
    const fromLogo = teamLogoUrl(player?.apiTeamId);
    if (fromLogo) p.set('fromCrestUrl', fromLogo);
  }
  if (buyingTeam) {
    p.set('toClub', buyingTeam.short || buyingTeam.name || '');
    const toLogo = teamLogoUrl(buyingTeam.id);
    if (toLogo) p.set('toCrestUrl', toLogo);
    if (buyingTeam.accent) p.set('toColor', buyingTeam.accent);
  }

  return `/api/share-card?${p.toString()}`;
}

// Builds the URL for the shareable talent card image (api/talent-card.js —
// sibling to buildShareCardUrl()/api/share-card.js above, but for the
// Talents page: no asking price or verdict, just potential and a
// development pathway. Kept as its own helper, not a mode on
// buildShareCardUrl(), for the same reason api/talent-card.js is its own
// file — a talent isn't a deal, and the two shapes shouldn't be forced to
// share one builder just because they both end in a PNG.
//
//   player: the talent-pool player object (src/pages/Talents.jsx) — name,
//           nation, position/role, club, age, rating, potential, trend,
//           pathway (array), provisional
//
// Provisional (API-only, not yet scored) talents omit rating/potential/
// trend/pathway entirely rather than sending a placeholder string like
// "Model pending" onto the card — same "never fabricate" rule as
// buildShareCardUrl() above.
export function buildTalentCardUrl(player = {}) {
  const p = new URLSearchParams();
  const name = player.full_name || player.name;
  if (name) p.set('name', name);
  if (player.nation) p.set('nation', player.nation);
  const pos = player.pos || player.position;
  if (pos) p.set('pos', pos);
  if (player.club) p.set('club', player.club);
  if (player.age != null) p.set('age', String(player.age));
  if (player.role) p.set('role', player.role);

  const apiPlayerId = player.apiPlayerId ?? (player.source === 'api-profile' || player.source === 'supabase-registry' ? player.id : null);
  const img = player.verifiedImage || player.apiImage || player.image || player.img || player.localImage || playerPhotoUrl(apiPlayerId);
  if (img) p.set('img', img);

  if (!player.provisional) {
    if (player.rating != null) p.set('rating', String(Math.round(player.rating)));
    if (player.potential) p.set('potential', String(player.potential));
    if (player.trend) p.set('trend', String(player.trend));
    // Same fallback Pathway (src/pages/Talents.jsx) uses when no explicit
    // pathway array is set on the player.
    const stages = player.pathway || [player.league, player.nextStep, 'Senior-minutes consolidation'];
    const realStages = (stages || []).filter(Boolean);
    if (realStages[0]) p.set('stage1', String(realStages[0]));
    if (realStages[1]) p.set('stage2', String(realStages[1]));
    if (realStages[2]) p.set('stage3', String(realStages[2]));
  }

  return `/api/talent-card?${p.toString()}`;
}

// Builds the link used for every *sharing* action (X, WhatsApp, copy-link)
// as opposed to the raw PNG (buildShareCardUrl/buildTalentCardUrl) used for
// downloading or attaching the actual file. Points at api/share-unfurl.js —
// a bridge page carrying og:image/og:title meta tags so WhatsApp/X/iMessage/
// Slack render the card itself as a big clickable preview instead of a bare
// text link (see api/share-unfurl.js's own comments for why that page has
// to exist at all: platforms fetch the shared URL server-side and read its
// meta tags, they never receive a file from a wa.me/twitter intent link).
//   cardUrl      : buildShareCardUrl()/buildTalentCardUrl() output
//   title        : short line for og:title/twitter:title (e.g. player name)
//   text         : the same caption already shown on the ShareBar/X/WhatsApp
//                  buttons — becomes og:description
//   redirectPath : where a real visitor lands after the bridge page (e.g.
//                  shareUrl('/transfers'))
export function buildShareLinkUrl({ cardUrl, title, text, redirectPath }) {
  const p = new URLSearchParams();
  if (cardUrl) p.set('card', cardUrl);
  if (title) p.set('title', title);
  if (text) p.set('desc', text);
  if (redirectPath) p.set('redirect', redirectPath);
  return `/api/share-unfurl?${p.toString()}`;
}

const wrap = { display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' };
const labelStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.7 };
const btn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 6, border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.04)', color: 'inherit', cursor: 'pointer', textDecoration: 'none' };

export default function ShareBar({ text = '', url, title = 'Calibre', label = true, cardUrl }) {
  const [copied, setCopied] = useState(false);
  const bareLink = url || (typeof window !== 'undefined' ? window.location.href : '');
  // Same bridge-page swap ShareModal does: when this page has a shareable
  // card, every button below carries that interactive link instead of the
  // bare page URL, so WhatsApp/X actually unfurl the card.
  const link = cardUrl
    ? SITE_ORIGIN + buildShareLinkUrl({ cardUrl, title, text, redirectPath: bareLink })
    : bareLink;
  const full = `${text} ${link}`.trim();
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(full)}`;
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const native = async () => { try { await navigator.share({ title, text, url: link }); } catch { /* user dismissed */ } };
  const copy = async () => {
    try { await navigator.clipboard.writeText(full); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { /* clipboard blocked */ }
  };

  return (
    <div className="share-bar" style={wrap}>
      {label && <span className="share-bar__label" style={labelStyle}><Share2 size={11} /> Share</span>}
      {canNative && (
        <button type="button" className="share-btn share-btn--native" style={btn} onClick={native} aria-label="Share">
          <Share2 size={11} />
        </button>
      )}
      <a className="share-btn share-btn--x" style={btn} href={xHref} target="_blank" rel="noopener noreferrer" aria-label="Share on X"><XMark /></a>
      <a className="share-btn share-btn--wa" style={btn} href={waHref} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><MessageCircle size={11} /></a>
      <button type="button" className="share-btn share-btn--copy" style={btn} onClick={copy} aria-label="Copy link">
        {copied ? <Check size={11} /> : <Link2 size={11} />}
      </button>
    </div>
  );
}

// Companion to ShareBar — opens the ShareModal (preview + Download/Copy/X/
// WhatsApp actions) instead of dumping the person straight onto a bare
// browser image tab, which is what this used to do (a raw <a target="_blank">
// to the PNG). Deliberately a separate small control (not folded into
// ShareBar) since it needs the player/valuation/verdict shape, not just
// text+url, and not every ShareBar call site has that data on hand yet.
export function ShareCardLink({ cardUrl, onOpen, label = true }) {
  if (!cardUrl) return null;
  return (
    <button
      type="button"
      className="share-btn share-btn--card"
      style={{ ...btn, width: label ? 'auto' : 20, gap: 5, padding: label ? '0 8px' : 0 }}
      onClick={onOpen}
      aria-label="Open shareable card"
      title="Open shareable card"
    >
      <ImageIcon size={11} />
      {label && <span style={{ fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase' }}>Card</span>}
    </button>
  );
}
