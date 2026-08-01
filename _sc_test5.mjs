// api/share-card.js
import { ImageResponse } from "@vercel/og";
import { createElement as e } from "react";
var config = { runtime: "edge" };
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
    width: 56,
    height: 56,
    borderRadius: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: color ? `${color}22` : "#141414",
    border: `2px solid ${color || "#2c2c2c"}`
  };
  if (url) {
    return e(
      "div",
      { style: ring },
      e("img", { src: url, width: 38, height: 38, style: { objectFit: "contain" } })
    );
  }
  return e("div", { style: { ...ring, fontSize: 16, fontWeight: 700, color: color || "#888" } }, label);
}
async function handler(req) {
  const { searchParams } = new URL(req.url);
  const name = clampText(searchParams.get("name") || "Unknown Player", 28);
  const club = clampText(searchParams.get("club") || "", 24);
  const pos = clampText(searchParams.get("pos") || "", 12);
  const age = searchParams.get("age");
  const value = searchParams.get("value");
  const fair = searchParams.get("fair");
  const asking = searchParams.get("asking");
  const premium = searchParams.get("premium");
  const risk = searchParams.get("risk");
  const traj = searchParams.get("traj");
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
  const showCrestRow = !!(fromClub && toClub);
  const meta = [pos, age ? `${age} yrs` : null, club].filter(Boolean).join("   \xB7   ");
  const showPremiumHero = asking && value && premium;
  const stats = [
    risk ? { label: "RISK", v: risk } : null,
    traj ? { label: "TRAJECTORY", v: traj } : null,
    fit ? { label: "SYSTEM FIT", v: fit } : null
  ].filter(Boolean);
  const glyphText = Array.from(
    new Set(
      `${name}${club}${meta}${verdict}${asking}${value}${fair}${premium}${stats.map((s) => s.label + s.v).join("")}CALIBREabcdefghijklmnopqrstuvwxyz0123456789\u20AC%+-\xB7\u2192 Over fair value Asking Calibre Estimated`
    )
  ).join("");
  const DISPLAY = "Barlow Condensed";
  const BODY = "Barlow";
  const headerRow = e(
    "div",
    { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
    e("img", {
      src: "https://www.calibrefootball.com/assets/calibre-wordmark.png",
      width: 121,
      height: 36,
      style: { objectFit: "contain" }
    }),
    showCrestRow ? e(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 12 } },
      crest(fromCrestUrl, fallbackCrest(fromClub) || "?", null),
      e("div", { style: { fontSize: 22, color: "#555", display: "flex" } }, "\u2192"),
      crest(toCrestUrl, fallbackCrest(toClub) || "?", toColor)
    ) : null
  );
  const photo = img ? e("img", {
    src: img,
    width: 220,
    height: 220,
    style: { borderRadius: 24, objectFit: "cover", border: "2px solid #1c1c1c" }
  }) : e(
    "div",
    {
      style: {
        width: 220,
        height: 220,
        borderRadius: 24,
        background: "#141414",
        border: "2px solid #1c1c1c",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 84,
        fontWeight: 700,
        color: "#333",
        fontFamily: DISPLAY
      }
    },
    name.trim().charAt(0).toUpperCase()
  );
  const premiumHero = e(
    "div",
    { style: { display: "flex", flexDirection: "column", marginTop: 24 } },
    e(
      "div",
      {
        style: {
          display: "flex",
          alignSelf: "flex-start",
          padding: "10px 22px",
          borderRadius: 12,
          border: `1px solid ${accent}55`,
          background: `${accent}22`,
          color: accent,
          fontSize: 42,
          fontWeight: 700,
          fontFamily: DISPLAY
        }
      },
      `${Number(premium) >= 0 ? "+" : ""}${premium}% over fair value`
    ),
    e(
      "div",
      { style: { fontSize: 19, color: "#999", marginTop: 10, display: "flex", fontFamily: BODY } },
      `Asking \u20AC${asking}M \xB7 Calibre fair value \u20AC${value}M`
    )
  );
  const plainValue = e(
    "div",
    { style: { display: "flex", alignItems: "flex-end", gap: 28, marginTop: 34 } },
    e(
      "div",
      { style: { display: "flex", flexDirection: "column" } },
      e(
        "div",
        { style: { fontSize: 14, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", fontFamily: BODY, fontWeight: 700 } },
        "Calibre Estimated Value"
      ),
      e(
        "div",
        { style: { fontSize: 78, fontWeight: 700, color: "#c8ff00", lineHeight: 1.02, display: "flex", fontFamily: DISPLAY } },
        value ? `\u20AC${value}M` : "\u2014"
      ),
      fair ? e("div", { style: { fontSize: 18, color: "#777", marginTop: 4, display: "flex", fontFamily: BODY } }, `Fair range \u20AC${fair}M`) : null
    )
  );
  const statsRow = stats.length > 0 ? e(
    "div",
    { style: { display: "flex", gap: 40, marginTop: 26, paddingTop: 20, borderTop: "1px solid #1c1c1c" } },
    ...stats.map(
      (s) => e(
        "div",
        { key: s.label, style: { display: "flex", flexDirection: "column" } },
        e("div", { style: { fontSize: 13, color: "#666", letterSpacing: "0.08em", display: "flex", fontFamily: BODY, fontWeight: 700 } }, s.label),
        e("div", { style: { fontSize: 32, fontWeight: 700, color: accent, display: "flex", fontFamily: DISPLAY } }, s.v)
      )
    )
  ) : null;
  const body = e(
    "div",
    { style: { display: "flex", alignItems: "center", flex: 1, gap: 48, marginTop: 16 } },
    photo,
    e(
      "div",
      { style: { display: "flex", flexDirection: "column", flex: 1 } },
      e("div", { style: { fontSize: 56, fontWeight: 700, lineHeight: 1.02, display: "flex", fontFamily: DISPLAY } }, name),
      meta ? e("div", { style: { fontSize: 21, color: "#999", marginTop: 8, display: "flex", fontFamily: BODY } }, meta) : null,
      showPremiumHero ? premiumHero : plainValue,
      statsRow
    )
  );
  const footer = e(
    "div",
    {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderTop: "1px solid #1c1c1c",
        paddingTop: 18,
        fontSize: 15,
        color: "#555",
        fontFamily: BODY
      }
    },
    e("div", { style: { display: "flex" } }, "calibrefootball.com/transfers"),
    e("div", { style: { display: "flex" } }, "Ability-based \xB7 position, league & age adjusted")
  );
  const stamp = verdict ? e(
    "div",
    {
      style: {
        position: "absolute",
        right: 64,
        bottom: 128,
        display: "flex",
        transform: "rotate(-9deg)",
        border: `4px solid ${accent}`,
        borderRadius: 14,
        padding: "12px 26px",
        color: accent,
        fontSize: 36,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: `${accent}11`,
        fontFamily: DISPLAY
      }
    },
    verdict
  ) : null;
  const root = e(
    "div",
    {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        background: "#030405",
        backgroundImage: "radial-gradient(circle at 8% 0%, rgba(166,255,0,0.16), transparent 55%), radial-gradient(circle at 92% 0%, rgba(166,255,0,0.11), transparent 50%)",
        fontFamily: BODY,
        padding: "56px 64px",
        color: "#fff",
        position: "relative"
      }
    },
    headerRow,
    body,
    footer,
    stamp
  );
  const fonts = (await Promise.allSettled([
    loadGoogleFont(DISPLAY, 700, glyphText).then((data) => ({ name: DISPLAY, data, weight: 700, style: "normal" })),
    loadGoogleFont(BODY, 400, glyphText).then((data) => ({ name: BODY, data, weight: 400, style: "normal" })),
    loadGoogleFont(BODY, 700, glyphText).then((data) => ({ name: BODY, data, weight: 700, style: "normal" }))
  ])).filter((r) => r.status === "fulfilled").map((r) => r.value);
  const imageOptions = { width: 1200, height: 630 };
  if (fonts.length > 0) imageOptions.fonts = fonts;
  return new ImageResponse(root, imageOptions);
}
export {
  config,
  handler as default
};
