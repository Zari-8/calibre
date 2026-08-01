import { useState } from 'react';
import { X, Download, Link2, Check, MessageCircle } from 'lucide-react';

// Same modal shell every other popup on the site uses (CommissionForm.jsx's
// dark card, lime top accent, fixed dim overlay) — this was previously just
// a bare <a target="_blank"> straight to the raw PNG, which dropped the
// person on an unstyled browser image tab with no context and no obvious
// next step. Opening this instead: shows the actual card so they can
// confirm it before sharing, then gives explicit per-platform actions.

const BC = "'Barlow Condensed', sans-serif";
const LIME = '#c8ff00';

const wrap = { position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' };
const card = { width: '100%', maxWidth: 560, background: '#0c0c0e', border: '1px solid #1c1c1c', borderTop: `3px solid ${LIME}`, borderRadius: 12, boxShadow: '0 30px 90px rgba(0,0,0,.6)' };

const actionBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '7px 10px', borderRadius: 6, border: '1px solid #242424', background: '#141414',
  color: '#eee', fontFamily: BC, fontSize: 11, fontWeight: 700, letterSpacing: '0.03em',
  textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', flex: '1 1 110px',
};

function XMark({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.59l-5.17-6.76L5.3 22H2.04l8.03-9.17L1.5 2h6.75l4.67 6.18L18.244 2Zm-1.16 18h1.83L7.01 3.9H5.05L17.084 20Z" />
    </svg>
  );
}

// player  : { name/full_name } — just for the intent text and download filename
// cardUrl : the api/share-card.js image URL (buildShareCardUrl output)
// text    : same shareText Transfers.jsx already builds for ShareBar
// url     : the page link (shareUrl('/transfers'))
export default function ShareModal({ player, cardUrl, text = '', url, onClose }) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const name = (player?.full_name || player?.name || 'player').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const absoluteCardUrl = typeof window !== 'undefined' && cardUrl?.startsWith('/') ? window.location.origin + cardUrl : cardUrl;

  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url || '')}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${text} ${url || ''}`.trim())}`;
  const canNativeShareFiles = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  const copyImageLink = async () => {
    try { await navigator.clipboard.writeText(absoluteCardUrl); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { /* clipboard blocked */ }
  };

  // Native share sheet WITH the actual image attached (not just a link) —
  // fetches the PNG as a blob first since navigator.share only accepts a
  // File, not a URL. Falls back silently to the manual buttons below on any
  // browser that doesn't support file sharing (most desktop browsers).
  const nativeShareImage = async () => {
    try {
      const res = await fetch(cardUrl);
      const blob = await res.blob();
      const file = new File([blob], `calibre-${name}.png`, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Calibre', text });
      }
    } catch { /* user dismissed, or fetch/share unsupported — buttons below still work */ }
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
                Card image couldn&apos;t load — you can still copy the link or open it directly below.
              </div>
            ) : (
              <img src={cardUrl} alt="Shareable valuation card" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} onError={() => setImgError(true)} />
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {canNativeShareFiles && (
              <button type="button" onClick={nativeShareImage} style={{ ...actionBtn, background: LIME, color: '#0a0a0a', border: 'none' }}>
                Share image
              </button>
            )}
            <a href={cardUrl} download={`calibre-${name}.png`} style={actionBtn}><Download size={12} /> Download</a>
            <button type="button" onClick={copyImageLink} style={actionBtn}>{copied ? <Check size={12} /> : <Link2 size={12} />} {copied ? 'Copied' : 'Copy link'}</button>
            <a href={xHref} target="_blank" rel="noopener noreferrer" style={actionBtn}><XMark size={12} /> X</a>
            <a href={waHref} target="_blank" rel="noopener noreferrer" style={actionBtn}><MessageCircle size={12} /> WhatsApp</a>
          </div>

          <p style={{ fontSize: 11, color: '#666', marginTop: 10, lineHeight: 1.5 }}>
            X and WhatsApp open with the caption pre-filled — download or share the image first so you can attach it, since neither platform accepts an image straight from a link.
          </p>
        </div>
      </div>
    </div>
  );
}
