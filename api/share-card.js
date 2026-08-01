// Vercel Function — deploy at: api/share-card.js
//
// Renders a shareable "valuation card" PNG for a player. Deliberately built
// to mirror the layout of the Transfers page's own player panel: photo +
// name + meta, a bordered VALUE / ASKING / PREMIUM box row (same shape as
// the page's own KPI strip), then a bordered CALIBRE VERDICT box sitting
// next to a row of bare, undefined stats (risk / system fit / position
// scarcity — deliberately not explained on the card itself; the ambiguity
// is the hook, the definition lives on calibrefootball.com) — the exact
// same pairing the page itself uses (verdict box beside the SYSTEM RISK
// slider). An earlier revision put the verdict in a rotated rubber-stamp
// graphic instead; that was this card's own invention, didn't match
// anything on the actual site, and kept colliding with other elements.
// Real club-logo crests and the site's real typography (Barlow Condensed /
// Barlow), not a generic font and text-abbreviation badges — an earlier
// pass shipped with those as placeholders and it read as a generic
// template next to the actual site.
//
// Sizing: the whole card is drawn at a base 1200x630 (the actual OG-image
// standard) and then uniformly scaled by CARD_SCALE — every dimension,
// font size, padding and gap goes through px() below, so resizing the card
// doesn't need a second set of hand-tuned numbers. Logo and verdict stamp
// use their own larger base sizes (LOGO_BASE_*, STAMP_BASE_*) precisely so
// they DON'T shrink in lockstep with everything else — both were getting
// visually lost at the uniform scale.
//
// Card degrades gracefully field-by-field — nothing here is fabricated.
// risk/fit/scarcity are the same numbers already live on the Transfers page
// (Transfers.jsx's riskPct for the SYSTEM RISK slider, systemFitScore,
// valuation.scarcity) — never invented for the card alone. Trajectory was
// dropped as a stat in an earlier revision: it exists as a number in
// calibreRating.js's breakdown, but this exact project zeroed its weight
// after finding it barely varies between players — shipping it as a public
// "mystery stat" would mean surfacing a number the team already flagged as
// unreliable.
//
// IMPORTANT — no JSX in this file, on purpose. An earlier version was named
// share-card.jsx to make sure JSX got transformed, which quietly broke
// something more basic: Vercel's zero-config /api function detection (for
// non-Next projects) only recognizes .js/.ts/.mjs entry files, not .jsx —
// so the whole route 404'd at the platform level (never even reached the
// function). Building the tree with React.createElement sidesteps the JSX
// question entirely and keeps this a plain, definitely-recognized .js file.
//
// Usage:
//   /api/share-card?name=Junior%20Kroupi&club=LOSC%20Lille&pos=ST&age=19
//     &value=59.1&fair=52-64&asking=84&premium=42&fit=68&scarcity=40&risk=61
//     &fromClub=LOSC%20Lille&fromCrestUrl=<url>
//     &toClub=Chelsea&toCrestUrl=<url>&toColor=%23034684
//     &verdict=NEGOTIATE%20HARD&tone=warn&img=<player photo url>
//
// Required Vercel env: none. Every field is optional except `name`.
//
// Wire-up: build the URL with buildShareCardUrl() (src/components/Share.jsx)
// from a live valuation/fit/dealVerdict object rather than hand-assembling
// query strings at each call site.

import { ImageResponse } from '@vercel/og';
import { createElement as e } from 'react';

export const config = { runtime: 'edge' };

const BASE_WIDTH = 1200;
const BASE_HEIGHT = 630;
const CARD_SCALE = 0.8; // "reduce by 20%" — was 0.7 (30% down); every proportion still scales together
const CARD_WIDTH = Math.round(BASE_WIDTH * CARD_SCALE);
const CARD_HEIGHT = Math.round(BASE_HEIGHT * CARD_SCALE);

// Scales a single px number, rounding but never collapsing a real border/gap to 0.
function px(n) {
  return Math.max(1, Math.round(n * CARD_SCALE));
}
// Scales every number inside a "12px 22px"-style CSS shorthand string.
function pxShorthand(str) {
  return str.replace(/(\d+(?:\.\d+)?)px/g, (_, n) => `${px(Number(n))}px`);
}

const TONE_COLOR = {
  good: '#c8ff00',
  warn: '#e8b13a',
  bad: '#ef4444',
  neutral: '#8a8a8a',
};

// The site's real typography (index.html preconnects/loads these; global.css
// defines --cal-display: "Barlow Condensed" and --cal-body: "Barlow"). Satori
// can't reach a browser's installed/linked fonts, so the same families are
// fetched from Google Fonts at render time instead — the standard @vercel/og
// pattern. `text` is passed to only fetch the glyphs this card actually uses.
async function loadGoogleFont(family, weight, text) {
  const params = new URLSearchParams({ family: `${family}:wght@${weight}`, text });
  const css = await (await fetch(`https://fonts.googleapis.com/css2?${params}`)).text();
  const match = css.match(/src: url\(([^)]+)\) format\('(opentype|truetype)'\)/);
  if (!match) throw new Error(`no font resource resolved for ${family} ${weight}`);
  const res = await fetch(match[1]);
  if (res.status !== 200) throw new Error(`font fetch failed for ${family} ${weight}: ${res.status}`);
  return res.arrayBuffer();
}

function clampText(s, max) {
  const str = String(s || '');
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

// Turns "LOSC Lille" -> "LOS", "Chelsea" -> "CHE" — last-resort label when
// there's no real crest image URL to render (see crest() below).
function fallbackCrest(clubName) {
  const str = String(clubName || '').trim();
  if (!str) return null;
  return str.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || null;
}

// Real crest image when a URL is available (teamLogoUrl() from
// apiFootball.js — actual API-Football team logos, same CDN the player
// photos already come from). Falls back to a text-abbreviation badge only
// when no real logo could be resolved, rather than ever inventing one.
function crest(url, label, color) {
  const ring = {
    width: px(64),
    height: px(64),
    borderRadius: px(32),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: color ? `${color}22` : '#141414',
    border: `${px(2)}px solid ${color || '#2c2c2c'}`,
  };
  if (url) {
    return e(
      'div',
      { style: ring },
      e('img', { src: url, width: px(44), height: px(44), style: { objectFit: 'contain' } })
    );
  }
  return e('div', { style: { ...ring, fontSize: px(18), fontWeight: 700, color: color || '#888' } }, label);
}

// One cell of the VALUE / ASKING / PREMIUM box row — mirrors the Transfers
// page's own KPI strip shape (bordered box, small caps label, big value).
function kpiCell(label, value, color, isFirst) {
  return e(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        padding: pxShorthand('9px 20px'),
        borderLeft: isFirst ? 'none' : `${px(1)}px solid #1c1c1c`,
      },
    },
    e('div', { style: { fontSize: px(13), color: '#777', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', fontFamily: 'Barlow', fontWeight: 700 } }, label),
    e('div', { style: { fontSize: px(30), fontWeight: 700, color: color || '#fff', marginTop: px(4), display: 'flex', fontFamily: 'Barlow Condensed' } }, value)
  );
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);

  const name = clampText(searchParams.get('name') || 'Unknown Player', 28);
  const club = clampText(searchParams.get('club') || '', 24);
  const pos = clampText(searchParams.get('pos') || '', 12);
  const age = searchParams.get('age');
  const value = searchParams.get('value'); // €m, Calibre fair value
  const asking = searchParams.get('asking'); // €m, optional
  const premium = searchParams.get('premium'); // %, optional — pass pre-computed, never recomputed here
  const risk = searchParams.get('risk'); // 0-100 — Transfers.jsx's own riskPct (SYSTEM RISK slider), not invented here
  const scarcity = searchParams.get('scarcity'); // 0-100, position scarcity — club-agnostic, always available
  const fit = searchParams.get('fit'); // 0-100, optional — only real when a buying club was selected
  const verdict = clampText(searchParams.get('verdict') || '', 20);
  const tone = TONE_COLOR[searchParams.get('tone')] ? searchParams.get('tone') : 'neutral';
  const img = searchParams.get('img'); // player photo URL, optional
  const accent = TONE_COLOR[tone];

  const fromClub = clampText(searchParams.get('fromClub') || club || '', 20);
  const toClub = clampText(searchParams.get('toClub') || '', 20);
  const fromCrestUrl = searchParams.get('fromCrestUrl') || null;
  const toCrestUrl = searchParams.get('toCrestUrl') || null;
  const toColor = searchParams.get('toColor') || null;

  const meta = [pos, age ? `${age} yrs` : null, club].filter(Boolean).join('   ·   ');
  const showKpiRow = !!(asking && value && premium);
  const stats = [
    risk ? { label: 'RISK', v: risk } : null,
    fit ? { label: 'SYSTEM FIT', v: fit } : null,
    scarcity ? { label: 'POSITION SCARCITY', v: scarcity } : null,
  ].filter(Boolean);

  // Only the glyphs this specific card needs — keeps the Google Fonts
  // response small and fast rather than pulling the whole family.
  const glyphText = Array.from(
    new Set(
      `${name}${club}${meta}${verdict}${asking}${value}${premium}${stats.map((s) => s.label + s.v).join('')}` +
        'CALIBREabcdefghijklmnopqrstuvwxyz0123456789€%+-·→ Value Asking Price Premium Estimated Fair'
    )
  ).join('');

  const DISPLAY = 'Barlow Condensed';
  const BODY = 'Barlow';

  // Logo scales off its own larger base size rather than shrinking in
  // lockstep with the rest of the card — it was getting visually lost at
  // the uniform CARD_SCALE.
  const LOGO_W = px(170);
  const LOGO_H = px(50);

  const headerRow = e(
    'div',
    { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
    e('img', {
      src: 'https://www.calibrefootball.com/assets/calibre-wordmark.png',
      width: LOGO_W,
      height: LOGO_H,
      style: { objectFit: 'contain' },
    }),
    // Shows a from-crest alone if that's all we have; adds the arrow + to-crest
    // once a buying club is actually picked. Never gated all-or-nothing.
    fromClub || toClub
      ? e(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: px(12) } },
          fromClub ? crest(fromCrestUrl, fallbackCrest(fromClub) || '?', null) : null,
          toClub ? e('div', { style: { fontSize: px(22), color: '#555', display: 'flex' } }, '→') : null,
          toClub ? crest(toCrestUrl, fallbackCrest(toClub) || '?', toColor) : null
        )
      : null
  );

  const photo = img
    ? e('img', {
        src: img,
        width: px(220),
        height: px(220),
        style: { borderRadius: px(24), objectFit: 'cover', border: `${px(2)}px solid #1c1c1c` },
      })
    : e(
        'div',
        {
          style: {
            width: px(220), height: px(220), borderRadius: px(24), background: '#141414',
            border: `${px(2)}px solid #1c1c1c`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: px(84), fontWeight: 700, color: '#333',
            fontFamily: DISPLAY,
          },
        },
        name.trim().charAt(0).toUpperCase()
      );

  const premiumColor = Number(premium) > 100 ? '#ef4444' : Number(premium) > 50 ? '#e8b13a' : '#c8ff00';

  const kpiRow = e(
    'div',
    {
      style: {
        display: 'flex',
        marginTop: px(14),
        border: `${px(1)}px solid #1c1c1c`,
        borderRadius: px(12),
        background: '#0d0f0c',
      },
    },
    kpiCell('Calibre Value', `€${value}M`, '#c8ff00', true),
    kpiCell('Asking Price', `€${asking}M`, '#fff', false),
    kpiCell('Premium', `${Number(premium) >= 0 ? '+' : ''}${premium}%`, premiumColor, false)
  );

  // The page's own verdict treatment is a bordered "CALIBRE VERDICT / DEAL"
  // box sitting next to the SYSTEM RISK slider — not a rotated stamp (that
  // was this card's own invention, and it kept colliding with other
  // elements). This ports the real layout: a same-shaped box holding the
  // verdict, sized to fit its normal flow instead of floating over anything.
  const verdictBox = verdict
    ? e(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minWidth: px(200),
            padding: pxShorthand('12px 22px'),
            border: `${px(2)}px solid ${accent}`,
            borderRadius: px(12),
            background: `${accent}14`,
          },
        },
        e('div', { style: { fontSize: px(12), color: accent, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', fontFamily: BODY, fontWeight: 700, opacity: 0.85 } }, 'Calibre Verdict'),
        e('div', { style: { fontSize: px(34), fontWeight: 700, color: accent, marginTop: px(2), display: 'flex', fontFamily: DISPLAY, textTransform: 'uppercase' } }, verdict)
      )
    : null;

  const plainValue = e(
    'div',
    { style: { display: 'flex', alignItems: 'flex-end', gap: px(28), marginTop: px(16) } },
    e(
      'div',
      { style: { display: 'flex', flexDirection: 'column' } },
      e(
        'div',
        { style: { fontSize: px(14), color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', fontFamily: BODY, fontWeight: 700 } },
        'Calibre Estimated Value'
      ),
      e(
        'div',
        { style: { fontSize: px(70), fontWeight: 700, color: '#c8ff00', lineHeight: 1.02, display: 'flex', fontFamily: DISPLAY } },
        value ? `€${value}M` : '—'
      )
    )
  );

  const bareStats =
    stats.length > 0
      ? e(
          'div',
          { style: { display: 'flex', gap: px(32) } },
          ...stats.map((s) =>
            e(
              'div',
              { key: s.label, style: { display: 'flex', flexDirection: 'column' } },
              e('div', { style: { fontSize: px(12), color: '#666', letterSpacing: '0.08em', display: 'flex', fontFamily: BODY, fontWeight: 700 } }, s.label),
              e('div', { style: { fontSize: px(26), fontWeight: 700, color: accent, display: 'flex', fontFamily: DISPLAY } }, s.v)
            )
          )
        )
      : null;

  // Verdict box + bare stats share one row, same pairing the page itself
  // uses (CALIBRE VERDICT box beside the SYSTEM RISK slider).
  const verdictRow = verdictBox || bareStats
    ? e(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: px(28), marginTop: px(16) } },
        verdictBox,
        bareStats
      )
    : null;

  const body = e(
    'div',
    { style: { display: 'flex', alignItems: 'center', gap: px(40), marginTop: px(18) } },
    photo,
    e(
      'div',
      { style: { display: 'flex', flexDirection: 'column', flex: 1 } },
      e('div', { style: { fontSize: px(50), fontWeight: 700, lineHeight: 1.02, display: 'flex', fontFamily: DISPLAY } }, name),
      meta ? e('div', { style: { fontSize: px(20), color: '#999', marginTop: px(8), display: 'flex', fontFamily: BODY } }, meta) : null
    )
  );

  const footer = e(
    'div',
    {
      style: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: `${px(1)}px solid #1c1c1c`, paddingTop: px(10), marginTop: px(14), fontSize: px(14), color: '#555', fontFamily: BODY,
      },
    },
    e('div', { style: { display: 'flex' } }, 'calibrefootball.com/transfers'),
    e('div', { style: { display: 'flex' } }, 'Ability-based · position, league & age adjusted')
  );

  // Matches global.css's real body::before/::after treatment: three lime
  // radial glows (top-left, top-right, bottom-center) over the same base
  // #030405, plus a faint pixel grid. Glow opacities are boosted from the
  // site's own .07/.05/.025 — those are tuned for a full page background,
  // and read as almost invisible at card size, so they're louder here on
  // purpose while keeping the same colors/positions.
  const bgGlow = e('div', {
    style: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex',
      backgroundImage:
        'radial-gradient(ellipse 55% 40% at 8% 0%, rgba(166,255,0,0.16) 0%, transparent 60%), ' +
        'radial-gradient(ellipse 45% 35% at 92% 0%, rgba(166,255,0,0.12) 0%, transparent 55%), ' +
        'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(166,255,0,0.07) 0%, transparent 65%)',
    },
  });
  const bgGrid = e('div', {
    style: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex',
      backgroundImage:
        `linear-gradient(rgba(255,255,255,0.05) ${px(1)}px, transparent ${px(1)}px), ` +
        `linear-gradient(90deg, rgba(255,255,255,0.04) ${px(1)}px, transparent ${px(1)}px)`,
      backgroundSize: `${px(48)}px ${px(48)}px`,
    },
  });

  const root = e(
    'div',
    {
      style: {
        width: `${CARD_WIDTH}px`,
        height: `${CARD_HEIGHT}px`,
        display: 'flex',
        flexDirection: 'column',
        background: '#030405',
        fontFamily: BODY,
        padding: pxShorthand('38px 56px'),
        color: '#fff',
        position: 'relative',
      },
    },
    bgGlow,
    bgGrid,
    headerRow,
    body,
    showKpiRow ? kpiRow : plainValue,
    verdictRow,
    footer
  );

  const fonts = (
    await Promise.allSettled([
      loadGoogleFont(DISPLAY, 700, glyphText).then((data) => ({ name: DISPLAY, data, weight: 700, style: 'normal' })),
      loadGoogleFont(BODY, 400, glyphText).then((data) => ({ name: BODY, data, weight: 400, style: 'normal' })),
      loadGoogleFont(BODY, 700, glyphText).then((data) => ({ name: BODY, data, weight: 700, style: 'normal' })),
    ])
  )
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
  // If Google Fonts is unreachable (or every fetch fails), `fonts` is just
  // empty and Satori falls back to its default font rather than erroring —
  // same degrade-gracefully rule as every other field on this card.

  // IMPORTANT: only pass `fonts` when at least one actually loaded. Satori
  // throws outright on an empty fonts array ("No fonts are loaded") rather
  // than falling back — but it DOES fall back to its own bundled default
  // font when the `fonts` key is omitted entirely.
  const imageOptions = { width: CARD_WIDTH, height: CARD_HEIGHT };
  if (fonts.length > 0) imageOptions.fonts = fonts;

  return new ImageResponse(root, imageOptions);
}
