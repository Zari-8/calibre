// Vercel Function — deploy at: api/share-card.js
//
// Renders a shareable "valuation card" PNG for a player. Redesigned
// 2026-08-01 after a design pass with Zari: the first version (name/value/
// verdict badge) was too flat to actually pull a Twitter influencer off the
// timeline. This version leads with the provocative number (premium over
// fair value), backs it with a row of bare, undefined real stats (position
// scarcity / system fit — deliberately not explained on the card itself;
// the ambiguity is the hook, the definition lives on calibrefootball.com),
// stamps the verdict like a rubber stamp instead of a quiet badge, shows the
// from-club → to-club crests so it reads as a specific transfer story, and
// uses the site's real typography (Barlow Condensed / Barlow) and real
// club-logo images instead of a generic font and text-abbreviation badges —
// an earlier pass shipped with those as placeholders and it read as a
// generic template next to the actual site.
//
// Sizing: the whole card is drawn at a base 1200x630 (the actual OG-image
// standard) and then uniformly scaled down by CARD_SCALE — every dimension,
// font size, padding and gap goes through px() below, so shrinking the card
// doesn't just make it smaller, it keeps every proportion identical rather
// than needing a second set of hand-tuned sizes.
//
// Card degrades gracefully field-by-field — nothing here is fabricated.
// Trajectory was dropped as a stat (was here in an earlier revision): it
// exists as a number in calibreRating.js's breakdown, but this exact
// project zeroed its weight after finding it barely varies between players
// — shipping it as a public "mystery stat" would mean surfacing a number
// the team already flagged as unreliable. Position scarcity replaced it:
// real, club-agnostic (valuation.scarcity — always available, unlike system
// fit which needs a buying club selected).
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
//     &value=59.1&fair=52-64&asking=84&premium=42&fit=68&scarcity=40
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
const CARD_SCALE = 0.7; // "the card is too big" — 30% smaller, same proportions throughout
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

export default async function handler(req) {
  const { searchParams } = new URL(req.url);

  const name = clampText(searchParams.get('name') || 'Unknown Player', 28);
  const club = clampText(searchParams.get('club') || '', 24);
  const pos = clampText(searchParams.get('pos') || '', 12);
  const age = searchParams.get('age');
  const value = searchParams.get('value'); // €m, Calibre fair value
  const fair = searchParams.get('fair'); // optional "low-high" string, already formatted
  const asking = searchParams.get('asking'); // €m, optional
  const premium = searchParams.get('premium'); // %, optional — pass pre-computed, never recomputed here
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
  const showCrestRow = !!(fromClub && toClub);

  const meta = [pos, age ? `${age} yrs` : null, club].filter(Boolean).join('   ·   ');
  const showPremiumHero = asking && value && premium;
  const stats = [
    scarcity ? { label: 'POSITION SCARCITY', v: scarcity } : null,
    fit ? { label: 'SYSTEM FIT', v: fit } : null,
  ].filter(Boolean);

  // Only the glyphs this specific card needs — keeps the Google Fonts
  // response small and fast rather than pulling the whole family.
  const glyphText = Array.from(
    new Set(
      `${name}${club}${meta}${verdict}${asking}${value}${fair}${premium}${stats.map((s) => s.label + s.v).join('')}` +
        'CALIBREabcdefghijklmnopqrstuvwxyz0123456789€%+-·→ Over fair value Asking Calibre Estimated'
    )
  ).join('');

  const DISPLAY = 'Barlow Condensed';
  const BODY = 'Barlow';

  const headerRow = e(
    'div',
    { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
    e('img', {
      src: 'https://www.calibrefootball.com/assets/calibre-wordmark.png',
      width: px(121),
      height: px(36),
      style: { objectFit: 'contain' },
    }),
    showCrestRow
      ? e(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: px(12) } },
          crest(fromCrestUrl, fallbackCrest(fromClub) || '?', null),
          e('div', { style: { fontSize: px(22), color: '#555', display: 'flex' } }, '→'),
          crest(toCrestUrl, fallbackCrest(toClub) || '?', toColor)
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

  const premiumHero = e(
    'div',
    { style: { display: 'flex', flexDirection: 'column', marginTop: px(24) } },
    e(
      'div',
      {
        style: {
          display: 'flex',
          alignSelf: 'flex-start',
          padding: pxShorthand('10px 22px'),
          borderRadius: px(12),
          border: `${px(1)}px solid ${accent}55`,
          background: `${accent}22`,
          color: accent,
          fontSize: px(42),
          fontWeight: 700,
          fontFamily: DISPLAY,
        },
      },
      `${Number(premium) >= 0 ? '+' : ''}${premium}% over fair value`
    ),
    e(
      'div',
      { style: { fontSize: px(19), color: '#999', marginTop: px(10), display: 'flex', fontFamily: BODY } },
      `Asking €${asking}M · Calibre fair value €${value}M`
    )
  );

  const plainValue = e(
    'div',
    { style: { display: 'flex', alignItems: 'flex-end', gap: px(28), marginTop: px(34) } },
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
        { style: { fontSize: px(78), fontWeight: 700, color: '#c8ff00', lineHeight: 1.02, display: 'flex', fontFamily: DISPLAY } },
        value ? `€${value}M` : '—'
      ),
      fair
        ? e('div', { style: { fontSize: px(18), color: '#777', marginTop: px(4), display: 'flex', fontFamily: BODY } }, `Fair range €${fair}M`)
        : null
    )
  );

  const statsRow =
    stats.length > 0
      ? e(
          'div',
          { style: { display: 'flex', gap: px(40), marginTop: px(26), paddingTop: px(20), borderTop: '1px solid #1c1c1c' } },
          ...stats.map((s) =>
            e(
              'div',
              { key: s.label, style: { display: 'flex', flexDirection: 'column' } },
              e('div', { style: { fontSize: px(13), color: '#666', letterSpacing: '0.08em', display: 'flex', fontFamily: BODY, fontWeight: 700 } }, s.label),
              e('div', { style: { fontSize: px(32), fontWeight: 700, color: accent, display: 'flex', fontFamily: DISPLAY } }, s.v)
            )
          )
        )
      : null;

  const body = e(
    'div',
    { style: { display: 'flex', alignItems: 'center', flex: 1, gap: px(48), marginTop: px(16) } },
    photo,
    e(
      'div',
      { style: { display: 'flex', flexDirection: 'column', flex: 1 } },
      e('div', { style: { fontSize: px(56), fontWeight: 700, lineHeight: 1.02, display: 'flex', fontFamily: DISPLAY } }, name),
      meta ? e('div', { style: { fontSize: px(21), color: '#999', marginTop: px(8), display: 'flex', fontFamily: BODY } }, meta) : null,
      showPremiumHero ? premiumHero : plainValue,
      statsRow
    )
  );

  const footer = e(
    'div',
    {
      style: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: '1px solid #1c1c1c', paddingTop: px(18), fontSize: px(15), color: '#555', fontFamily: BODY,
      },
    },
    e('div', { style: { display: 'flex' } }, 'calibrefootball.com/transfers'),
    e('div', { style: { display: 'flex' } }, 'Ability-based · position, league & age adjusted')
  );

  const stamp = verdict
    ? e(
        'div',
        {
          style: {
            position: 'absolute',
            right: px(64),
            bottom: px(128),
            display: 'flex',
            transform: 'rotate(-9deg)',
            border: `${px(4)}px solid ${accent}`,
            borderRadius: px(14),
            padding: pxShorthand('12px 26px'),
            color: accent,
            fontSize: px(36),
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            background: `${accent}11`,
            fontFamily: DISPLAY,
          },
        },
        verdict
      )
    : null;

  const root = e(
    'div',
    {
      style: {
        width: `${CARD_WIDTH}px`,
        height: `${CARD_HEIGHT}px`,
        display: 'flex',
        flexDirection: 'column',
        background: '#030405',
        backgroundImage:
          'radial-gradient(circle at 8% 0%, rgba(166,255,0,0.16), transparent 55%), radial-gradient(circle at 92% 0%, rgba(166,255,0,0.11), transparent 50%)',
        fontFamily: BODY,
        padding: pxShorthand('56px 64px'),
        color: '#fff',
        position: 'relative',
      },
    },
    headerRow,
    body,
    footer,
    stamp
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
  // font when the `fonts` key is omitted entirely. So if Google Fonts is
  // ever unreachable, this must omit the key, not pass `[]`, or a transient
  // font-CDN hiccup would take the whole card down instead of just losing
  // the custom typeface for that one render.
  // No custom Cache-Control here — @vercel/og already sets a sensible
  // default, and adding our own appended rather than replaced it in
  // testing, producing a malformed duplicate header.
  const imageOptions = { width: CARD_WIDTH, height: CARD_HEIGHT };
  if (fonts.length > 0) imageOptions.fonts = fonts;

  return new ImageResponse(root, imageOptions);
}
