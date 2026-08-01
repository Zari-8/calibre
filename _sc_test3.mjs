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
function clampText(s, max) {
  const str = String(s || "");
  return str.length > max ? str.slice(0, max - 1) + "\u2026" : str;
}
function fallbackCrest(clubName) {
  const str = String(clubName || "").trim();
  if (!str) return null;
  return str.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || null;
}
function crest(label, color) {
  return e(
    "div",
    {
      style: {
        width: 64,
        height: 64,
        borderRadius: 32,
        background: color ? `${color}33` : "#141414",
        border: `2px solid ${color || "#2c2c2c"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
        fontWeight: 800,
        color: color || "#888"
      }
    },
    label
  );
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
  const toCrest = searchParams.get("toCrest") || fallbackCrest(toClub);
  const toColor = searchParams.get("toColor") || null;
  const fromCrest = fallbackCrest(fromClub);
  const showCrestRow = !!(fromClub && toClub);
  const meta = [pos, age ? `${age} yrs` : null, club].filter(Boolean).join("   \xB7   ");
  const showPremiumHero = asking && value && premium;
  const stats = [
    risk ? { label: "RISK", v: risk } : null,
    traj ? { label: "TRAJECTORY", v: traj } : null,
    fit ? { label: "SYSTEM FIT", v: fit } : null
  ].filter(Boolean);
  const headerRow = e(
    "div",
    { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
    e("img", {
      src: "https://www.calibrefootball.com/assets/calibre-wordmark.png",
      width: 101,
      height: 30,
      style: { objectFit: "contain" }
    }),
    showCrestRow ? e(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 14 } },
      crest(fromCrest || "?", null),
      e("div", { style: { fontSize: 26, color: "#555", display: "flex" } }, "\u2192"),
      crest(toCrest || "?", toColor)
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
        fontWeight: 800,
        color: "#333"
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
          padding: "12px 22px",
          borderRadius: 12,
          border: `1px solid ${accent}55`,
          background: `${accent}22`,
          color: accent,
          fontSize: 40,
          fontWeight: 800
        }
      },
      `${Number(premium) >= 0 ? "+" : ""}${premium}% over fair value`
    ),
    e(
      "div",
      { style: { fontSize: 20, color: "#999", marginTop: 10, display: "flex" } },
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
        { style: { fontSize: 15, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", display: "flex" } },
        "Calibre Estimated Value"
      ),
      e(
        "div",
        { style: { fontSize: 76, fontWeight: 800, color: "#c8ff00", lineHeight: 1.05, display: "flex" } },
        value ? `\u20AC${value}M` : "\u2014"
      ),
      fair ? e("div", { style: { fontSize: 18, color: "#777", marginTop: 4, display: "flex" } }, `Fair range \u20AC${fair}M`) : null
    )
  );
  const statsRow = stats.length > 0 ? e(
    "div",
    { style: { display: "flex", gap: 40, marginTop: 26, paddingTop: 20, borderTop: "1px solid #1c1c1c" } },
    ...stats.map(
      (s) => e(
        "div",
        { key: s.label, style: { display: "flex", flexDirection: "column" } },
        e("div", { style: { fontSize: 14, color: "#666", letterSpacing: "0.08em", display: "flex" } }, s.label),
        e("div", { style: { fontSize: 30, fontWeight: 800, color: accent, display: "flex" } }, s.v)
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
      e("div", { style: { fontSize: 54, fontWeight: 800, lineHeight: 1.05, display: "flex" } }, name),
      meta ? e("div", { style: { fontSize: 22, color: "#999", marginTop: 10, display: "flex" } }, meta) : null,
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
        paddingTop: 20,
        fontSize: 17,
        color: "#555"
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
        padding: "14px 28px",
        color: accent,
        fontSize: 38,
        fontWeight: 800,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        background: `${accent}11`
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
        fontFamily: "sans-serif",
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
  return new ImageResponse(root, { width: 1200, height: 630 });
}
export {
  config,
  handler as default
};
