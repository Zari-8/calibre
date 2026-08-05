import { useState } from 'react';
import { X, Download, Share2 as Share2Icon } from 'lucide-react';
import { buildShareLinkUrl, SITE_ORIGIN } from './Share.jsx';

// Same modal shell every other popup on the site uses (CommissionForm.jsx's
// dark card, lime top accent, fixed dim overlay) — this was previously just
// a bare <a target="_blank"> straight to the raw PNG, which dropped the
// person on an unstyled browser image tab with no context and no obvious
// next step. Opening this instead: shows the actual card so they can
// confirm it before sharing.
//
// Down to two actions on purpose (Share / Download) — X, WhatsApp and Copy
// link were dropped after Zari asked to simplify. Share still hands out the
// interactive api/share-unfurl.js link (via buildShareLinkUrl), not a file —
// an earlier version attached the actual PNG via navigator.share({files}),
// confirmed by a real WhatsApp screenshot that this produces a plain
// attached photo with no clickable link at all, the opposite of the point
// of this feature. navigator.share({url}) triggers the same native OS share
// sheet (one tap to WhatsApp, X, Messages, anything installed) without a
// file, so the platform on the other end unfurls it into the interactive
// card. Download is the one remaining path to the actual PNG file, for
// anyone who deliberately wants it (e.g. posting natively on Instagram,
// which needs the real file, not a link).
//
// Note: navigator.share isn't supported on most desktop browsers (Safari
// aside), so on desktop this modal currently only offers Download — there's
// no share-the-link fallback there anymore now that Copy link is gone.

const BC = "'Barlow Condensed', sans-serif";
const LIME = '#97cc0d';

const wrap = { position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' };
const card = { width: '100%', maxWidth: 560, background: '#0c0c0e', border: '1px solid #1c1c1c', borderTop: `3px solid ${LIME}`, borderRadius: 12, boxShadow: '0 30px 90px rgba(0,0,0,.6)' };

const actionBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '7px 10px', borderRadius: 6, border: '1px solid #242424', background: '#141414',
  color: '#eee', fontFamily: BC, fontSize: 11, fontWeight: 700, letterSpacing: '0.03em',
  textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', flex: '1 1 110px',
};

// player  : { name/full_name } — just for the intent text and download filename
// cardUrl : the api/share-card.js image URL (buildShareCardUrl output)
// text    : same shareText Transfers.jsx already builds for ShareBar
// url     : the page link (shareUrl('/transfers'))
export default function ShareModal({ player, cardUrl, text = '', url, onClose }) {
  const [imgError, setImgError] = useState(false);
  const displayName = player?.full_name || player?.name || 'Calibre';
  const name = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // The link Share hands out — NOT the raw PNG and NOT the bare page URL.
  // It's the api/share-unfurl.js bridge page, so whichever app the person
  // shares to (WhatsApp, X, iMessage, Slack) shows the card itself as a
  // rich, clickable preview instead of a bare text link. SITE_ORIGIN, not
  // window.location.origin — a share built while previewing on a Vercel
  // preview deployment must still point at the real public domain, never
  // the throwaway preview host (see Share.jsx's SITE_ORIGIN comment for the
  // concrete WhatsApp failure this caused).
  const shareLinkPath = buildShareLinkUrl({ cardUrl, title: `${displayName} — Calibre`, text, redirectPath: url });
  const absoluteShareLink = shareLinkPath.startsWith('/') ? SITE_ORIGIN + shareLinkPath : shareLinkPath;

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // Native OS share sheet (mobile: one tap to any installed app) — shares
  // the interactive link, not a file. See the file-header comment for why
  // this changed from attaching the raw PNG.
  const nativeShare = async () => {
    try { await navigator.share({ title: `${displayName} — Calibre`, text, url: absoluteShareLink }); }
    catch { /* user dismissed, or unsupported — Download still works */ }
  };

  return (
    <div style={wrap} role="presentation" onMouseDown={onClose}>
      <div style={card} role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 20px 12px', borderBottom: '1px solid #161616' }}>
          <div>
            <div style={{ fontFamily: BC, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: LIME }}>Shareable card</div>
            <div style={{ fontFamily: BC, fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1, marginTop: 4 }}>Share this valuation</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}><X size={20} /></button>
        </div>

        <div style={{ padding: '16px 20px 20px' }}>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #1c1c1c', background: '#050505', aspectRatio: '10 / 5.25' }}>
            {imgError ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 13, textAlign: 'center', padding: 16 }}>
                Card image couldn&apos;t load — you can still download it directly below.
              </div>
            ) : (
              <img src={cardUrl} alt="Shareable valuation card" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} onError={() => setImgError(true)} />
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {canNativeShare && (
              <button type="button" onClick={nativeShare} style={{ ...actionBtn, background: LIME, color: '#0a0a0a', border: 'none' }}>
                <Share2Icon size={12} /> Share
              </button>
            )}
            <a href={cardUrl} download={`calibre-${name}.png`} style={actionBtn}><Download size={12} /> Download</a>
          </div>

          <p style={{ fontSize: 11, color: '#666', marginTop: 10, lineHeight: 1.5 }}>
            Share sends a link that shows this card as the preview and opens straight through to Calibre. Download gets you the raw image file instead, for posting it directly somewhere.
          </p>
        </div>
      </div>
    </div>
  );
}
