// Vercel Function — deploy at: api/talent-card.js
//
// Renders a shareable "talent card" PNG for the Talents page — sibling to
// api/share-card.js (the Transfers page's valuation card), deliberately a
// SEPARATE file rather than a "mode" flag on that one. A talent isn't a deal:
// there's no asking price, no verdict, no fee to negotiate — the whole point
// is potential and a development pathway, which needed its own layout (the
// three-stage pathway strip below) rather than bending the deal card's
// VALUE/ASKING/PREMIUM + verdict-box shape to fit a concept it wasn't built
// for. Same visual language on purpose (same base canvas, same CARD_SCALE,
// same brand glow/grid background, same Barlow Condensed/Barlow fonts, same
// lime accent) so the two cards read as the same product — the boilerplate
// (font loading, px scaling, background) is intentionally duplicated from
// share-card.js rather than factored into a shared import, so a change to
// the (already-shipped, working) deal card can never accidentally touch
// this one, and vice versa.
//
// Degrades gracefully field-by-field — nothing here is fabricated. A
// provisional/API-only talent (no Calibre model run yet) simply omits
// rating/potential/trend/pathway rather than showing placeholder guesses;
// see TalentDetailModal/Pathway in src/pages/Talents.jsx for the same rule
// applied in-app ("Model pending" / "Awaiting stats", never a fake number).
//
// Usage:
//   /api/talent-card?name=Takudzwa%20Ncube&nation=Zimbabwe&pos=ST&club=Dynamos
//     &age=17&role=Poacher&rating=79&potential=85-90&trend=Rising
//     &stage1=Dynamos%20FC&stage2=European%20trial&stage3=Full-time%20academy%20move
//     &img=<player photo url>
//
// Required Vercel env: none. Every field is optional except `name`.
//
// Wire-up: build the URL with buildTalentCardUrl() (src/components/Share.jsx)
// from a live talent-pool player object rather than hand-assembling query
// strings at each call site.

import { ImageResponse } from '@vercel/og';
import { createElement as e } from 'react';

export const config = { runtime: 'edge' };

const BASE_WIDTH = 1200;
const BASE_HEIGHT = 630;
const CARD_SCALE = 0.8; // matches api/share-card.js — same physical card size across the site
const CARD_WIDTH = Math.round(BASE_WIDTH * CARD_SCALE);
const CARD_HEIGHT = Math.round(BASE_HEIGHT * CARD_SCALE);

function px(n) {
  return Math.max(1, Math.round(n * CARD_SCALE));
}
function pxShorthand(str) {
  return str.replace(/(\d+(?:\.\d+)?)px/g, (_, n) => `${px(Number(n))}px`);
}

const LIME = '#c8ff00';

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

export default async function handler(req) {
  const { searchParams } = new URL(req.url);

  const name = clampText(searchParams.get('name') || 'Unknown Talent', 28);
  const nation = clampText(searchParams.get('nation') || '', 20);
  const pos = clampText(searchParams.get('pos') || '', 12);
  const club = clampText(searchParams.get('club') || '', 24);
  const age = searchParams.get('age');
  const role = clampText(searchParams.get('role') || '', 24);
  const rating = searchParams.get('rating'); // 0-100 Calibre rating, omitted entirely for provisional/unscored talents
  const potential = clampText(searchParams.get('potential') || '', 16); // e.g. "85-90" potential band
  const trend = clampText(searchParams.get('trend') || '', 16); // e.g. "Rising", "Breakout"
  const img = searchParams.get('img');

  // Pathway strip — mirrors src/pages/Talents.jsx's Pathway component
  // (current level -> next step -> development ceiling). Only rendered when
  // at least one real stage is present; never invents a stage.
  const stages = [searchParams.get('stage1'), searchParams.get('stage2'), searchParams.get('stage3')]
    .map((s) => clampText(s || '', 26))
    .filter(Boolean);

  const meta = [pos, age ? `${age} yrs` : null, club].filter(Boolean).join('   ·   ');

  const glyphText = Array.from(
    new Set(
      `${name}${nation}${meta}${role}${potential}${trend}${stages.join('')}` +
        'CALIBREabcdefghijklmnopqrstuvwxyz0123456789€%+-·→ TALENT SCOUT Rating Potential Trend Current Next Step Ceiling'
    )
  ).join('');

  const DISPLAY = 'Barlow Condensed';
  const BODY = 'Barlow';

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
    nation
      ? e(
          'div',
          { style: { fontSize: px(14), color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', fontFamily: BODY, fontWeight: 700 } },
          nation
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

  // Same big-number-plus-label treatment as share-card.js's ratingBadge —
  // ported, not reinvented, for visual consistency between the two cards.
  const ratingBadge = rating
    ? e(
        'div',
        {
          style: {
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: px(96), height: px(96), borderRadius: px(16),
            border: `${px(2)}px solid ${LIME}`, background: 'rgba(200,255,0,0.08)',
          },
        },
        e('div', { style: { fontSize: px(40), fontWeight: 700, color: LIME, lineHeight: 1, display: 'flex', fontFamily: DISPLAY } }, rating),
        e('div', { style: { fontSize: px(11), color: LIME, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: px(4), display: 'flex', fontFamily: BODY, fontWeight: 700, opacity: 0.85 } }, 'Calibre')
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
      meta ? e('div', { style: { fontSize: px(20), color: '#999', marginTop: px(8), display: 'flex', fontFamily: BODY } }, meta) : null,
      role ? e('div', { style: { fontSize: px(15), color: '#666', marginTop: px(4), display: 'flex', fontFamily: BODY } }, role) : null
    ),
    ratingBadge
  );

  // Potential / Trend row — same bordered-box KPI shape share-card.js uses,
  // just the two fields a talent (not a deal) actually has.
  const statCells = [
    potential ? { label: 'Potential Band', v: potential } : null,
    trend ? { label: 'Trajectory', v: trend } : null,
  ].filter(Boolean);
  const statsRow =
    statCells.length > 0
      ? e(
          'div',
          {
            style: {
              display: 'flex', marginTop: px(14), border: `${px(1)}px solid #1c1c1c`,
              borderRadius: px(12), background: '#0d0f0c',
            },
          },
          ...statCells.map((s, i) =>
            e(
              'div',
              {
                key: s.label,
                style: {
                  display: 'flex', flexDirection: 'column', flex: 1, padding: pxShorthand('9px 20px'),
                  borderLeft: i === 0 ? 'none' : `${px(1)}px solid #1c1c1c`,
                },
              },
              e('div', { style: { fontSize: px(13), color: '#777', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', fontFamily: BODY, fontWeight: 700 } }, s.label),
              e('div', { style: { fontSize: px(28), fontWeight: 700, color: LIME, marginTop: px(4), display: 'flex', fontFamily: DISPLAY } }, s.v)
            )
          )
        )
      : null;

  // Pathway strip — the card's real differentiator from the deal card. Each
  // stage a bordered box; the middle ("Next Step") stage highlighted, same
  // as the in-app Pathway component's `is-next` treatment.
  const pathwayLabels = ['Current Level', 'Next Step', 'Development Ceiling'];
  const pathwayRow =
    stages.length > 0
      ? e(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: px(10), marginTop: px(16) } },
          ...stages.flatMap((stage, i) => {
            const isNext = i === 1;
            const box = e(
              'div',
              {
                key: `stage-${i}`,
                style: {
                  display: 'flex', flexDirection: 'column', flex: 1,
                  padding: pxShorthand('10px 14px'), borderRadius: px(10),
                  border: `${px(isNext ? 2 : 1)}px solid ${isNext ? LIME : '#1c1c1c'}`,
                  background: isNext ? 'rgba(200,255,0,0.06)' : '#0a0a0a',
                },
              },
              e('div', { style: { fontSize: px(11), color: isNext ? LIME : '#666', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', fontFamily: BODY, fontWeight: 700, opacity: 0.9 } }, pathwayLabels[i] || `Stage ${i + 1}`),
              e('div', { style: { fontSize: px(17), color: '#eee', marginTop: px(4), display: 'flex', fontFamily: DISPLAY, fontWeight: 700 } }, stage)
            );
            const arrow = i < stages.length - 1 ? e('div', { key: `arrow-${i}`, style: { fontSize: px(18), color: '#444', display: 'flex' } }, '→') : null;
            return arrow ? [box, arrow] : [box];
          })
        )
      : null;

  const footer = e(
    'div',
    {
      style: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: `${px(1)}px solid #1c1c1c`, paddingTop: px(10), marginTop: px(14), fontSize: px(14), color: '#555', fontFamily: BODY,
      },
    },
    e('div', { style: { display: 'flex' } }, 'calibrefootball.com/talents'),
    e('div', { style: { display: 'flex' } }, 'Development pathway, not a fixed prediction')
  );

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
    statsRow,
    pathwayRow,
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

  const imageOptions = { width: CARD_WIDTH, height: CARD_HEIGHT };
  if (fonts.length > 0) imageOptions.fonts = fonts;

  return new ImageResponse(root, imageOptions);
}
