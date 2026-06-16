import { navigateTo } from "../components/NavLink.jsx";

/**
 * PremierBetBanner
 *
 * Props:
 *   source  — "worldcup" | "competitions" | "pricing"
 *   variant — "bar" (slim horizontal) | "card" (taller standalone card)
 *
 * Usage:
 *   import PremierBetBanner from "../components/PremierBetBanner";
 *   <PremierBetBanner source="worldcup" variant="bar" />
 */

const PROMO_CODE = "ZW392";

const COPY = {
  worldcup: {
    eyebrow: "OFFICIAL BETTING PARTNER",
    headline: "Back your World Cup pick",
    sub: "Calibre rates them. PremierBet pays you.",
    cta: "BET NOW",
  },
  competitions: {
    eyebrow: "OFFICIAL BETTING PARTNER",
    headline: "Turn your league intel into winnings",
    sub: "Powered by 3,667 Calibre-rated players.",
    cta: "BET NOW",
  },
  pricing: {
    eyebrow: "EXCLUSIVE OFFER FOR CALIBRE USERS",
    headline: "Pro member? Your edge starts here.",
    sub: "Use code ZW392 and claim your 100% welcome bonus.",
    cta: "CLAIM BONUS",
  },
};

export default function PremierBetBanner({ source = "worldcup", variant = "bar" }) {
  const copy = COPY[source] || COPY.worldcup;

  const go = () => navigateTo(`/bet?from=${source}`);

  if (variant === "bar") {
    return (
      <div style={bar.wrap} onClick={go} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && go()}>
        <div style={bar.left}>
          <span style={bar.eyebrow}>{copy.eyebrow}</span>
          <span style={bar.headline}>{copy.headline}</span>
          <span style={bar.sub}>{copy.sub}</span>
        </div>
        <div style={bar.right}>
          <div style={bar.codeBox}>
            <span style={bar.codeLabel}>USE CODE</span>
            <span style={bar.code}>{PROMO_CODE}</span>
          </div>
          <button style={bar.cta} onClick={(e) => { e.stopPropagation(); go(); }}>
            {copy.cta} →
          </button>
        </div>
        <div style={bar.disclaimer}>18+ · T&Cs apply · Gamble responsibly</div>
      </div>
    );
  }

  // variant === "card"
  return (
    <div style={card.wrap}>
      <div style={card.inner}>
        <span style={card.eyebrow}>{copy.eyebrow}</span>
        <div style={card.logoRow}>
          <div style={card.logo}>PB</div>
          <span style={card.brand}>PremierBet</span>
        </div>
        <div style={card.bonus}>
          <span style={card.bonusNum}>100%</span>
          <span style={card.bonusLabel}>Welcome Bonus</span>
        </div>
        <div style={card.codeStrip}>
          <span style={card.codeStripLabel}>PROMO CODE</span>
          <span style={card.codeStripVal}>{PROMO_CODE}</span>
        </div>
        <p style={card.sub}>{copy.sub}</p>
        <button style={card.cta} onClick={go}>
          {copy.cta}
        </button>
        <div style={card.disclaimer}>18+ · Gamble responsibly · T&Cs apply</div>
      </div>
    </div>
  );
}

const C = {
  black: "#0a0a0a",
  surface: "#111111",
  border: "#1e1e1e",
  lime: "#c8ff00",
  white: "#ffffff",
  muted: "#666666",
  mutedLight: "#999999",
};

const bar = {
  wrap: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderTop: `2px solid ${C.lime}`,
    padding: "18px 24px",
    display: "flex",
    alignItems: "center",
    gap: "24px",
    cursor: "pointer",
    position: "relative",
    margin: "32px 0",
    transition: "border-color 0.15s",
  },
  left: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  eyebrow: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "9px",
    letterSpacing: "0.2em",
    color: C.lime,
    textTransform: "uppercase",
  },
  headline: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "18px",
    fontWeight: 700,
    color: C.white,
    letterSpacing: "0.01em",
  },
  sub: {
    fontSize: "12px",
    color: C.mutedLight,
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flexShrink: 0,
  },
  codeBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
  },
  codeLabel: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "9px",
    letterSpacing: "0.12em",
    color: C.muted,
  },
  code: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "22px",
    fontWeight: 800,
    color: C.lime,
    letterSpacing: "0.1em",
  },
  cta: {
    background: C.lime,
    border: "none",
    color: C.black,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: "13px",
    letterSpacing: "0.08em",
    padding: "10px 20px",
    cursor: "pointer",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    transition: "opacity 0.15s",
  },
  disclaimer: {
    position: "absolute",
    bottom: "6px",
    right: "12px",
    fontSize: "9px",
    color: C.muted,
    letterSpacing: "0.05em",
  },
};

const card = {
  wrap: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderTop: `2px solid ${C.lime}`,
  },
  inner: {
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "0",
  },
  eyebrow: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "9px",
    letterSpacing: "0.2em",
    color: C.lime,
    textTransform: "uppercase",
    display: "block",
    marginBottom: "14px",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "20px",
  },
  logo: {
    width: "32px",
    height: "32px",
    background: C.lime,
    color: C.black,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "18px",
    fontWeight: 700,
    color: C.white,
  },
  bonus: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "16px 0",
    borderTop: `1px solid ${C.border}`,
    borderBottom: `1px solid ${C.border}`,
    marginBottom: "16px",
  },
  bonusNum: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "48px",
    fontWeight: 800,
    color: C.lime,
    lineHeight: 1,
  },
  bonusLabel: {
    fontSize: "11px",
    color: C.mutedLight,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    marginTop: "4px",
  },
  codeStrip: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#0a0a0a",
    border: `1px solid ${C.border}`,
    padding: "10px 14px",
    marginBottom: "14px",
  },
  codeStripLabel: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "10px",
    letterSpacing: "0.12em",
    color: C.muted,
  },
  codeStripVal: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "20px",
    fontWeight: 800,
    color: C.lime,
    letterSpacing: "0.1em",
  },
  sub: {
    fontSize: "12px",
    color: C.mutedLight,
    lineHeight: 1.5,
    margin: "0 0 16px",
  },
  cta: {
    background: C.lime,
    border: "none",
    color: C.black,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: "13px",
    letterSpacing: "0.08em",
    padding: "13px",
    cursor: "pointer",
    textTransform: "uppercase",
    width: "100%",
    transition: "opacity 0.15s",
    marginBottom: "12px",
  },
  disclaimer: {
    fontSize: "9px",
    color: C.muted,
    textAlign: "center",
    letterSpacing: "0.04em",
  },
};
