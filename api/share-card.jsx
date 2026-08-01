// Vercel Edge Function — deploy at: api/share-card.js
//
// Renders a shareable 1200x630 PNG "valuation card" for a player: photo,
// name, club, Calibre's independent estimated value, and the verdict badge
// (DEAL / NEGOTIATE HARD / WALK AWAY / etc). This is the missing piece
// flagged in the TransferRoom competitive read (2026-07-26 session): Share.jsx
// already handles TEXT distribution (native share sheet, X/WhatsApp intent
// links, copy-link) but there was no actual IMAGE to go with it — and an
// image is what actually gets reposted/embedded by a creator, not a bare
// link. No new API key or third-party service needed: @vercel/og renders
// the JSX below server-side via Satori, entirely within Vercel's free tier.
//
// Usage:  /api/share-card?name=Junior%20Kroupi&club=LOSC%20Lille&pos=ST&age=19
//           &value=59.1&verdict=NEGOTIATE%20HARD&tone=warn&img=<player photo url>
//
// Required Vercel env: none. Uses only the query params below — every field
// is optional except `name`, so a card degrades gracefully if data is thin
// (matches calibreValue.js's own "lower confidence, don't fabricate" ethos).
//
// Wire-up: build the URL with buildShareCardUrl() (src/components/Share.jsx)
// from a live `valuation`/`dealVerdict` object rather than hand-assembling
// query strings at each call site.

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const TONE_COLOR = {
  good: '#c8ff00',
  warn: '#e8b13a',
  bad: '#ef4444',
  neutral: '#8a8a8a',
};

function clampText(s, max) {
  const str = String(s || '');
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);

  const name = clampText(searchParams.get('name') || 'Unknown Player', 28);
  const club = clampText(searchParams.get('club') || '', 24);
  const pos = clampText(searchParams.get('pos') || '', 12);
  const age = searchParams.get('age');
  const value = searchParams.get('value'); // €m, numeric string
  const fair = searchParams.get('fair'); // optional "low-high" string, already formatted
  const verdict = clampText(searchParams.get('verdict') || '', 20);
  const tone = TONE_COLOR[searchParams.get('tone')] ? searchParams.get('tone') : 'neutral';
  const img = searchParams.get('img'); // player photo URL, optional
  const accent = TONE_COLOR[tone];

  const meta = [pos, age ? `${age} yrs` : null, club].filter(Boolean).join('   ·   ');

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0a',
          backgroundImage: 'radial-gradient(circle at 85% 10%, rgba(200,255,0,0.08), transparent 45%)',
          fontFamily: 'sans-serif',
          padding: '56px 64px',
          color: '#fff',
          position: 'relative',
        }}
      >
        {/* Header / wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 14, height: 14, borderRadius: 4, background: '#c8ff00',
              }}
            />
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex' }}>
              Calibre
            </div>
          </div>
          <div style={{ fontSize: 15, color: '#666', letterSpacing: '0.04em', display: 'flex' }}>
            Independent valuation — not a market quote
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 48, marginTop: 12 }}>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              width={220}
              height={220}
              style={{ borderRadius: 24, objectFit: 'cover', border: '2px solid #1c1c1c' }}
            />
          ) : (
            <div
              style={{
                width: 220, height: 220, borderRadius: 24, background: '#141414',
                border: '2px solid #1c1c1c', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 84, fontWeight: 800, color: '#333',
              }}
            >
              {name.trim().charAt(0).toUpperCase()}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.05, display: 'flex' }}>{name}</div>
            {meta && (
              <div style={{ fontSize: 22, color: '#999', marginTop: 10, display: 'flex' }}>{meta}</div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, marginTop: 34 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 15, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex' }}>
                  Calibre Estimated Value
                </div>
                <div style={{ fontSize: 76, fontWeight: 800, color: '#c8ff00', lineHeight: 1.05, display: 'flex' }}>
                  {value ? `€${value}M` : '—'}
                </div>
                {fair && (
                  <div style={{ fontSize: 18, color: '#777', marginTop: 4, display: 'flex' }}>
                    Fair range €{fair}M
                  </div>
                )}
              </div>

              {verdict && (
                <div
                  style={{
                    display: 'flex',
                    padding: '10px 20px',
                    borderRadius: 10,
                    border: `1px solid ${accent}55`,
                    background: `${accent}18`,
                    color: accent,
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {verdict}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderTop: '1px solid #1c1c1c', paddingTop: 20, fontSize: 17, color: '#555',
          }}
        >
          <div style={{ display: 'flex' }}>calibrefootball.com/transfers</div>
          <div style={{ display: 'flex' }}>Ability-based · position, league &amp; age adjusted</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
