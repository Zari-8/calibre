import { useState } from 'react';
import { Share2, MessageCircle, Link2, Check } from 'lucide-react';

// X (Twitter) glyph isn't in lucide; use a tiny inline mark so the brand reads right.
function XMark({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.59l-5.17-6.76L5.3 22H2.04l8.03-9.17L1.5 2h6.75l4.67 6.18L18.244 2Zm-1.16 18h1.83L7.01 3.9H5.05L17.084 20Z" />
    </svg>
  );
}

/**
 * Drop-in share control. Pass the text and a URL; everything else is handled.
 *   <ShareBar text="Mbappé → Real Madrid: 91% system fit on Calibre" url={shareUrl('/system-fit')} />
 *
 * Renders: native share (mobile only, one tap to any app incl. WhatsApp/X),
 * plus explicit X, WhatsApp and copy-link buttons for desktop.
 */
export function shareUrl(path) {
  if (typeof window === 'undefined') return path || '';
  if (!path) return window.location.href;
  return path.startsWith('http') ? path : window.location.origin + path;
}

const wrap = { display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const labelStyle = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.7 };
const btn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.04)', color: 'inherit', cursor: 'pointer', textDecoration: 'none' };

export default function ShareBar({ text = '', url, title = 'Calibre', label = true }) {
  const [copied, setCopied] = useState(false);
  const link = url || (typeof window !== 'undefined' ? window.location.href : '');
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
      {label && <span className="share-bar__label" style={labelStyle}><Share2 size={14} /> Share</span>}
      {canNative && (
        <button type="button" className="share-btn share-btn--native" style={btn} onClick={native} aria-label="Share">
          <Share2 size={15} />
        </button>
      )}
      <a className="share-btn share-btn--x" style={btn} href={xHref} target="_blank" rel="noopener noreferrer" aria-label="Share on X"><XMark /></a>
      <a className="share-btn share-btn--wa" style={btn} href={waHref} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><MessageCircle size={15} /></a>
      <button type="button" className="share-btn share-btn--copy" style={btn} onClick={copy} aria-label="Copy link">
        {copied ? <Check size={15} /> : <Link2 size={15} />}
      </button>
    </div>
  );
}
