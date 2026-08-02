// Vercel Function — deploy at: api/share-unfurl.js
//
// The actual fix for "sharing a link to WhatsApp/X shows no card at all".
// api/share-card.js and api/talent-card.js return a raw PNG — but when
// someone pastes a *page* link (calibrefootball.com/transfers) into
// WhatsApp/X/iMessage/Slack, those platforms build their preview by
// server-side-fetching that URL and reading its <meta property="og:image">
// tag. The SPA's index.html has none (and can't have a per-player one — it's
// a single static file), so every share showed a bare text-only preview,
// regardless of which card was actually being shared.
//
// This is the standard fix: a tiny server-rendered HTML "bridge" page, one
// per share, whose only job is to carry the right og:image/og:title meta
// tags (pointing at the real share-card.js/talent-card.js PNG) so the
// platform's preview shows the actual card — then instantly hands a real
// visitor on to the live site via JS. Crawlers (WhatsApp, Facebook, Twitter,
// Slack, iMessage) never execute JS when unfurling a link, so they only ever
// see the meta tags; a human clicking the link gets redirected before the
// blank page is even visible. No meta http-equiv="refresh" here on purpose —
// some crawlers do follow it, which would make them chase the redirect
// instead of reading the OG tags.
//
// Wire-up: build this URL with buildShareLinkUrl() (src/components/Share.jsx)
// from the same cardUrl/text/destination every call site already has — don't
// hand-assemble the query string.
//
// Usage:
//   /api/share-unfurl?card=%2Fapi%2Fshare-card%3Fname%3D...
//     &title=Junior%20Kroupi%20%E2%80%94%20Calibre
//     &desc=WALK%20AWAY.%20Calibre%20values%20him%20at%20%E2%82%AC59.1M.
//     &redirect=https%3A%2F%2Fwww.calibrefootball.com%2Ftransfers

export const config = { runtime: 'edge' };

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req) {
  const url = new URL(req.url);
  const { origin, searchParams } = url;

  const cardParam = searchParams.get('card') || '';
  const title = searchParams.get('title') || 'Calibre Football Intelligence';
  const desc = searchParams.get('desc') || 'Ability-based valuations, system fit and risk — calibrefootball.com';
  const redirectParam = searchParams.get('redirect') || '/';

  if (!cardParam) {
    return new Response('Missing card param', { status: 400 });
  }

  // og:image (and the redirect target) must be absolute — relative paths
  // don't reliably resolve for link-preview crawlers.
  const absCard = cardParam.startsWith('http') ? cardParam : `${origin}${cardParam}`;
  const absRedirect = redirectParam.startsWith('http') ? redirectParam : `${origin}${redirectParam}`;

  // Matches api/share-card.js's / api/talent-card.js's actual rendered
  // pixel size (BASE 1200x630 * CARD_SCALE 0.8) — real dimensions, not
  // the OG-image-standard default, so platforms don't letterbox it.
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Calibre Football Intelligence">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(absCard)}">
<meta property="og:image:width" content="960">
<meta property="og:image:height" content="504">
<meta property="og:url" content="${esc(url.toString())}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(absCard)}">
</head>
<body style="background:#030405;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
<p>Opening <a href="${esc(absRedirect)}" style="color:#c8ff00;">Calibre Football Intelligence</a>…</p>
<script>location.replace(${JSON.stringify(absRedirect)});</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Short-lived cache — long enough to absorb a burst of crawler
      // re-fetches from the same share, short enough that a stale
      // valuation never lingers.
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  });
}
