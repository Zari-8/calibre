// api/share-card.js
import { ImageResponse } from "@vercel/og";
import { createElement as e } from "react";
var config = { runtime: "edge" };
var BASE_WIDTH = 1200;
var BASE_HEIGHT = 630;
var CARD_SCALE = 0.8;
var CARD_WIDTH = Math.round(BASE_WIDTH * CARD_SCALE);
var CARD_HEIGHT = Math.round(BASE_HEIGHT * CARD_SCALE);
function px(n) {
  return Math.max(1, Math.round(n * CARD_SCALE));
}
function pxShorthand(str) {
  return str.replace(/(\d+(?:\.\d+)?)px/g, (_, n) => `${px(Number(n))}px`);
}
var TONE_COLOR = {
  good: "#c8ff00",
  warn: "#e8b13a",
  bad: "#ef4444",
  neutral: "#8a8a8a"
};
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
  const str = String(s || "");
  return str.length > max ? str.slice(0, max - 1) + "\u2026" : str;
}
function fallbackCrest(clubName) {
  const str = String(clubName || "").trim();
  if (!str) return null;
  return str.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || null;
}
function crest(url, label, color) {
  const ring = {
    width: px(64),
    height: px(64),
    borderRadius: px(32),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: color ? `${color}22` : "#141414",
    border: `${px(2)}px solid ${color || "#2c2c2c"}`
  };
  if (url) {
    return e(
      "div",
      { style: ring },
      e("img", { src: url, width: px(44), height: px(44), style: { objectFit: "contain" } })
    );
  }
  return e("div", { style: { ...ring, fontSize: px(18), fontWeight: 700, color: color || "#888" } }, label);
}
function kpiCell(label, value, color, isFirst) {
  return e(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        flex: 1,
        padding: pxShorthand("9px 20px"),
        borderLeft: isFirst ? "none" : `${px(1)}px solid #1c1c1c`
      }
    },
    e("div", { style: { fontSize: px(13), color: "#777", letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", fontFamily: "Barlow", fontWeight: 700 } }, label),
    e("div", { style: { fontSize: px(30), fontWeight: 700, color: color || "#fff", marginTop: px(4), display: "flex", fontFamily: "Barlow Condensed" } }, value)
  );
}
async function handler(req) {
  const { searchParams } = new URL(req.url);
  const name = clampText(searchParams.get("name") || "Unknown Player", 28);
  const club = clampText(searchParams.get("club") || "", 24);
  const pos = clampText(searchParams.get("pos") || "", 12);
  const age = searchParams.get("age");
  const value = searchParams.get("value");
  const asking = searchParams.get("asking");
  const premium = searchParams.get("premium");
  const risk = searchParams.get("risk");
  const scarcity = searchParams.get("scarcity");
  const fit = searchParams.get("fit");
  const verdict = clampText(searchParams.get("verdict") || "", 20);
  const tone = TONE_COLOR[searchParams.get("tone")] ? searchParams.get("tone") : "neutral";
  const img = searchParams.get("img");
  const accent = TONE_COLOR[tone];
  const fromClub = clampText(searchParams.get("fromClub") || club || "", 20);
  const toClub = clampText(searchParams.get("toClub") || "", 20);
  const fromCrestUrl = searchParams.get("fromCrestUrl") || null;
  const toCrestUrl = searchParams.get("toCrestUrl") || null;
  const toColor = searchParams.get("toColor") || null;
  const meta = [pos, age ? `${age} yrs` : null, club].filter(Boolean).join("   \xB7   ");
  const showKpiRow = !!(asking && value && premium);
  const stats = [
    risk ? { label: "RISK", v: risk } : null,
    fit ? { label: "SYSTEM FIT", v: fit } : null,
    scarcity ? { label: "POSITION SCARCITY", v: scarcity } : null
  ].filter(Boolean);
  const glyphText = Array.from(
    new Set(
      `${name}${club}${meta}${verdict}${asking}${value}${premium}${stats.map((s) => s.label + s.v).join("")}CALIBREabcdefghijklmnopqrstuvwxyz0123456789\u20AC%+-\xB7\u2192 Value Asking Price Premium Estimated Fair`
    )
  ).join("");
  const DISPLAY = "Barlow Condensed";
  const BODY = "Barlow";
  const LOGO_W = px(170);
  const LOGO_H = px(50);
  const headerRow = e(
    "div",
    { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
    e("img", {
      src: "https://www.calibrefootball.com/assets/calibre-wordmark.png",
      width: LOGO_W,
      height: LOGO_H,
      style: { objectFit: "contain" }
    }),
    // Shows a from-crest alone if that's all we have; adds the arrow + to-crest
    // once a buying club is actually picked. Never gated all-or-nothing.
    fromClub || toClub ? e(
      "div",
      { style: { display: "flex", alignItems: "center", gap: px(12) } },
      fromClub ? crest(fromCrestUrl, fallbackCrest(fromClub) || "?", null) : null,
      toClub ? e("div", { style: { fontSize: px(22), color: "#555", display: "flex" } }, "\u2192") : null,
      toClub ? crest(toCrestUrl, fallbackCrest(toClub) || "?", toColor) : null
    ) : null
  );
  const photo = img ? e("img", {
    src: img,
    width: px(220),
    height: px(220),
    style: { borderRadius: px(24), objectFit: "cover", border: `${px(2)}px solid #1c1c1c` }
  }) : e(
    "div",
    {
      style: {
        width: px(220),
        height: px(220),
        borderRadius: px(24),
        background: "#141414",
        border: `${px(2)}px solid #1c1c1c`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: px(84),
        fontWeight: 700,
        color: "#333",
        fontFamily: DISPLAY
      }
    },
    name.trim().charAt(0).toUpperCase()
  );
  const premiumColor = Number(premium) > 100 ? "#ef4444" : Number(premium) > 50 ? "#e8b13a" : "#c8ff00";
  const kpiRow = e(
    "div",
    {
      style: {
        display: "flex",
        marginTop: px(14),
        border: `${px(1)}px solid #1c1c1c`,
        borderRadius: px(12),
        background: "#0d0f0c"
      }
    },
    kpiCell("Calibre Value", `\u20AC${value}M`, "#c8ff00", true),
    kpiCell("Asking Price", `\u20AC${asking}M`, "#fff", false),
    kpiCell("Premium", `${Number(premium) >= 0 ? "+" : ""}${premium}%`, premiumColor, false)
  );
  const verdictBox = verdict ? e(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minWidth: px(200),
        padding: pxShorthand("12px 22px"),
        border: `${px(2)}px solid ${accent}`,
        borderRadius: px(12),
        background: `${accent}14`
      }
    },
    e("div", { style: { fontSize: px(12), color: accent, letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", fontFamily: BODY, fontWeight: 700, opacity: 0.85 } }, "Calibre Verdict"),
    e("div", { style: { fontSize: px(34), fontWeight: 700, color: accent, marginTop: px(2), display: "flex", fontFamily: DISPLAY, textTransform: "uppercase" } }, verdict)
  ) : null;
  const plainValue = e(
    "div",
    { style: { display: "flex", alignItems: "flex-end", gap: px(28), marginTop: px(16) } },
    e(
      "div",
      { style: { display: "flex", flexDirection: "column" } },
      e(
        "div",
        { style: { fontSize: px(14), color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", fontFamily: BODY, fontWeight: 700 } },
        "Calibre Estimated Value"
      ),
      e(
        "div",
        { style: { fontSize: px(70), fontWeight: 700, color: "#c8ff00", lineHeight: 1.02, display: "flex", fontFamily: DISPLAY } },
        value ? `\u20AC${value}M` : "\u2014"
      )
    )
  );
  const bareStats = stats.length > 0 ? e(
    "div",
    { style: { display: "flex", gap: px(32) } },
    ...stats.map(
      (s) => e(
        "div",
        { key: s.label, style: { display: "flex", flexDirection: "column" } },
        e("div", { style: { fontSize: px(12), color: "#666", letterSpacing: "0.08em", display: "flex", fontFamily: BODY, fontWeight: 700 } }, s.label),
        e("div", { style: { fontSize: px(26), fontWeight: 700, color: accent, display: "flex", fontFamily: DISPLAY } }, s.v)
      )
    )
  ) : null;
  const verdictRow = verdictBox || bareStats ? e(
    "div",
    { style: { display: "flex", alignItems: "center", gap: px(28), marginTop: px(16) } },
    verdictBox,
    bareStats
  ) : null;
  const body = e(
    "div",
    { style: { display: "flex", alignItems: "center", gap: px(40), marginTop: px(18) } },
    photo,
    e(
      "div",
      { style: { display: "flex", flexDirection: "column", flex: 1 } },
      e("div", { style: { fontSize: px(50), fontWeight: 700, lineHeight: 1.02, display: "flex", fontFamily: DISPLAY } }, name),
      meta ? e("div", { style: { fontSize: px(20), color: "#999", marginTop: px(8), display: "flex", fontFamily: BODY } }, meta) : null
    )
  );
  const footer = e(
    "div",
    {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderTop: `${px(1)}px solid #1c1c1c`,
        paddingTop: px(10),
        marginTop: px(14),
        fontSize: px(14),
        color: "#555",
        fontFamily: BODY
      }
    },
    e("div", { style: { display: "flex" } }, "calibrefootball.com/transfers"),
    e("div", { style: { display: "flex" } }, "Ability-based \xB7 position, league & age adjusted")
  );
  const bgGlow = e("div", {
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      backgroundImage: "radial-gradient(ellipse 55% 40% at 8% 0%, rgba(166,255,0,0.16) 0%, transparent 60%), radial-gradient(ellipse 45% 35% at 92% 0%, rgba(166,255,0,0.12) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 50% 100%, rgba(166,255,0,0.07) 0%, transparent 65%)"
    }
  });
  const bgGrid = e("div", {
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      backgroundImage: `linear-gradient(rgba(255,255,255,0.05) ${px(1)}px, transparent ${px(1)}px), linear-gradient(90deg, rgba(255,255,255,0.04) ${px(1)}px, transparent ${px(1)}px)`,
      backgroundSize: `${px(48)}px ${px(48)}px`
    }
  });
  const root = e(
    "div",
    {
      style: {
        width: `${CARD_WIDTH}px`,
        height: `${CARD_HEIGHT}px`,
        display: "flex",
        flexDirection: "column",
        background: "#030405",
        fontFamily: BODY,
        padding: pxShorthand("38px 56px"),
        color: "#fff",
        position: "relative"
      }
    },
    bgGlow,
    bgGrid,
    headerRow,
    body,
    showKpiRow ? kpiRow : plainValue,
    verdictRow,
    footer
  );
  const fonts = (await Promise.allSettled([
    loadGoogleFont(DISPLAY, 700, glyphText).then((data) => ({ name: DISPLAY, data, weight: 700, style: "normal" })),
    loadGoogleFont(BODY, 400, glyphText).then((data) => ({ name: BODY, data, weight: 400, style: "normal" })),
    loadGoogleFont(BODY, 700, glyphText).then((data) => ({ name: BODY, data, weight: 700, style: "normal" }))
  ])).filter((r) => r.status === "fulfilled").map((r) => r.value);
  const imageOptions = { width: CARD_WIDTH, height: CARD_HEIGHT };
  if (fonts.length > 0) imageOptions.fonts = fonts;
  return new ImageResponse(root, imageOptions);
}
export {
  config,
  handler as default
};
