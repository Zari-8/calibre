import { useEffect, useState, useRef } from "react";
import { navigateTo } from "../components/NavLink.jsx";

const AFFILIATE_LINKS = {
  sportsbook: "https://media.premierbetpartners.com/redirect.aspx?pid=143895&bid=5246",
  slots: "https://media.premierbetpartners.com/redirect.aspx?pid=143895&bid=5250",
  aviator: "https://media.premierbetpartners.com/redirect.aspx?pid=143895&bid=5250",
};

const PROMO_CODE = "ZW392";

// Context cards keyed by source param
const CONTEXT = {
  worldcup: {
    eyebrow: "FIFA WORLD CUP 2026",
    headline: "Back your pick. Every game. Every stake.",
    sub: "Calibre rates the teams. PremierBet pays when you're right.",
    cta: "BET ON THE WORLD CUP",
    dest: "sportsbook",
    stat1: { label: "Teams Analysed", value: "32" },
    stat2: { label: "Calibre Accuracy", value: "74%" },
    stat3: { label: "Signup Bonus", value: "100%" },
  },
  competitions: {
    eyebrow: "PREMIER LEAGUE · LA LIGA · UCL",
    headline: "The intel is here. Put money on it.",
    sub: "Every league, every fixture — rated by Calibre, funded by PremierBet.",
    cta: "BET ON YOUR LEAGUE",
    dest: "sportsbook",
    stat1: { label: "Leagues Covered", value: "9" },
    stat2: { label: "Players Rated", value: "3,667" },
    stat3: { label: "Signup Bonus", value: "100%" },
  },
  pricing: {
    eyebrow: "CALIBRE PRO MEMBERS",
    headline: "Your edge just got sharper.",
    sub: "Pro members get Calibre's deepest ratings. Now pair that with PremierBet odds.",
    cta: "CLAIM YOUR BONUS",
    dest: "sportsbook",
    stat1: { label: "Pro Insights", value: "∞" },
    stat2: { label: "Promo Code", value: PROMO_CODE },
    stat3: { label: "Signup Bonus", value: "100%" },
  },
};

const DEFAULT_CONTEXT = CONTEXT.worldcup;

export default function BetLanding() {
  const params = new URLSearchParams(window.location.search);
  const source = params.get("from") || "worldcup";
  const ctx = CONTEXT[source] || DEFAULT_CONTEXT;

  const [countdown, setCountdown] = useState(null);
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef(null);

  const handleBet = () => {
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      window.open(AFFILIATE_LINKS[ctx.dest], "_blank", "noopener,noreferrer");
      setCountdown(null);
      return;
    }
    intervalRef.current = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(intervalRef.current);
  }, [countdown, ctx.dest]);

  const copyCode = () => {
    navigator.clipboard.writeText(PROMO_CODE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={styles.page}>
      {/* Back nav */}
      <button style={styles.back} onClick={() => navigateTo('/')}>
        ← Back to Calibre
      </button>

      <div style={styles.shell}>
        {/* Left — editorial */}
        <div style={styles.left}>
          <span style={styles.eyebrow}>{ctx.eyebrow}</span>

          <h1 style={styles.headline}>{ctx.headline}</h1>

          <p style={styles.sub}>{ctx.sub}</p>

          {/* Promo code strip */}
          <div style={styles.codeStrip}>
            <div style={styles.codeLabel}>YOUR PROMO CODE</div>
            <div style={styles.codeRow}>
              <span style={styles.code}>{PROMO_CODE}</span>
              <button style={styles.copyBtn} onClick={copyCode}>
                {copied ? "COPIED ✓" : "COPY"}
              </button>
            </div>
            <div style={styles.codeNote}>
              Enter at registration — tags your account to Calibre permanently
            </div>
          </div>

          {/* Stats row */}
          <div style={styles.stats}>
            {[ctx.stat1, ctx.stat2, ctx.stat3].map((s) => (
              <div key={s.label} style={styles.stat}>
                <span style={styles.statVal}>{s.value}</span>
                <span style={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div style={styles.steps}>
            {[
              { n: "01", t: "Register", d: "Create your PremierBet account using code " + PROMO_CODE },
              { n: "02", t: "Deposit", d: "Fund your account and claim the welcome bonus" },
              { n: "03", t: "Bet smart", d: "Use Calibre ratings to inform every stake" },
            ].map((s) => (
              <div key={s.n} style={styles.step}>
                <span style={styles.stepN}>{s.n}</span>
                <div>
                  <div style={styles.stepT}>{s.t}</div>
                  <div style={styles.stepD}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — CTA panel */}
        <div style={styles.right}>
          <div style={styles.ctaCard}>
            <div style={styles.logoMark}>PB</div>
            <div style={styles.partner}>Official Betting Partner</div>
            <div style={styles.partnerName}>PremierBet Zimbabwe</div>

            <div style={styles.divider} />

            <div style={styles.bonus}>
              <div style={styles.bonusNum}>100%</div>
              <div style={styles.bonusLabel}>Welcome Bonus on first deposit</div>
            </div>

            <div style={styles.divider} />

            <button
              style={{
                ...styles.ctaBtn,
                ...(countdown !== null ? styles.ctaBtnActive : {}),
              }}
              onClick={handleBet}
              disabled={countdown !== null}
            >
              {countdown !== null
                ? `Opening in ${countdown}…`
                : ctx.cta}
            </button>

            <div style={styles.altLinks}>
              <button style={styles.altLink} onClick={() => window.open(AFFILIATE_LINKS.slots, "_blank", "noopener,noreferrer")}>
                Slots →
              </button>
              <button style={styles.altLink} onClick={() => window.open(AFFILIATE_LINKS.aviator, "_blank", "noopener,noreferrer")}>
                Aviator →
              </button>
            </div>

            <div style={styles.disclaimer}>
              18+ only. Gamble responsibly. T&Cs apply.{" "}
              <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" style={styles.disclaimerLink}>
                BeGambleAware.org
              </a>
            </div>
          </div>

          {/* Trust signals */}
          <div style={styles.trustRow}>
            <span style={styles.trust}>✓ Licensed in Zimbabwe</span>
            <span style={styles.trust}>✓ Instant payouts</span>
            <span style={styles.trust}>✓ EcoCash accepted</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const C = {
  black: "#0a0a0a",
  surface: "#111111",
  border: "#1e1e1e",
  lime: "#c8ff00",
  limeDim: "#a8d600",
  white: "#ffffff",
  muted: "#888888",
  mutedLight: "#aaaaaa",
};

const styles = {
  page: {
    minHeight: "100vh",
    background: C.black,
    color: C.white,
    fontFamily: "'Barlow', sans-serif",
    padding: "0 0 60px",
  },
  back: {
    background: "none",
    border: "none",
    color: C.muted,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "13px",
    letterSpacing: "0.05em",
    padding: "20px 32px",
    cursor: "pointer",
    display: "block",
    transition: "color 0.15s",
  },
  shell: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "0 32px",
    display: "grid",
    gridTemplateColumns: "1fr 360px",
    gap: "60px",
    alignItems: "start",
  },
  left: {
    paddingTop: "12px",
  },
  eyebrow: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "11px",
    letterSpacing: "0.18em",
    color: C.lime,
    display: "block",
    marginBottom: "16px",
  },
  headline: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "clamp(36px, 5vw, 64px)",
    fontWeight: 800,
    lineHeight: 1.0,
    margin: "0 0 20px",
    textTransform: "uppercase",
    letterSpacing: "-0.01em",
  },
  sub: {
    fontSize: "16px",
    lineHeight: 1.6,
    color: C.mutedLight,
    margin: "0 0 36px",
    maxWidth: "480px",
  },
  codeStrip: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderLeft: `3px solid ${C.lime}`,
    padding: "20px 24px",
    marginBottom: "36px",
  },
  codeLabel: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "10px",
    letterSpacing: "0.15em",
    color: C.muted,
    marginBottom: "10px",
  },
  codeRow: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "8px",
  },
  code: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "36px",
    fontWeight: 800,
    color: C.lime,
    letterSpacing: "0.08em",
  },
  copyBtn: {
    background: "none",
    border: `1px solid ${C.lime}`,
    color: C.lime,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "11px",
    letterSpacing: "0.1em",
    padding: "6px 14px",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  codeNote: {
    fontSize: "12px",
    color: C.muted,
    lineHeight: 1.5,
  },
  stats: {
    display: "flex",
    gap: "40px",
    marginBottom: "40px",
    borderTop: `1px solid ${C.border}`,
    paddingTop: "28px",
  },
  stat: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  statVal: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "28px",
    fontWeight: 700,
    color: C.white,
  },
  statLabel: {
    fontSize: "11px",
    color: C.muted,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  steps: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  step: {
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
  },
  stepN: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "13px",
    fontWeight: 700,
    color: C.lime,
    letterSpacing: "0.05em",
    minWidth: "24px",
    paddingTop: "2px",
  },
  stepT: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "16px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    marginBottom: "3px",
  },
  stepD: {
    fontSize: "13px",
    color: C.mutedLight,
    lineHeight: 1.5,
  },
  right: {
    paddingTop: "12px",
    position: "sticky",
    top: "24px",
  },
  ctaCard: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    padding: "32px",
  },
  logoMark: {
    width: "44px",
    height: "44px",
    background: C.lime,
    color: C.black,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "16px",
  },
  partner: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "10px",
    letterSpacing: "0.15em",
    color: C.muted,
    textTransform: "uppercase",
    marginBottom: "4px",
  },
  partnerName: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "20px",
    fontWeight: 700,
    marginBottom: "0",
  },
  divider: {
    height: "1px",
    background: C.border,
    margin: "24px 0",
  },
  bonus: {
    textAlign: "center",
    padding: "8px 0",
  },
  bonusNum: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "56px",
    fontWeight: 800,
    color: C.lime,
    lineHeight: 1,
    marginBottom: "6px",
  },
  bonusLabel: {
    fontSize: "13px",
    color: C.mutedLight,
    lineHeight: 1.4,
  },
  ctaBtn: {
    width: "100%",
    background: C.lime,
    color: C.black,
    border: "none",
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: "15px",
    letterSpacing: "0.08em",
    padding: "16px",
    cursor: "pointer",
    textTransform: "uppercase",
    transition: "all 0.15s",
    marginBottom: "16px",
  },
  ctaBtnActive: {
    background: C.limeDim,
    cursor: "not-allowed",
  },
  altLinks: {
    display: "flex",
    gap: "12px",
    marginBottom: "20px",
  },
  altLink: {
    flex: 1,
    background: "none",
    border: `1px solid ${C.border}`,
    color: C.mutedLight,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "12px",
    letterSpacing: "0.05em",
    padding: "10px",
    cursor: "pointer",
    transition: "all 0.15s",
    textAlign: "center",
  },
  disclaimer: {
    fontSize: "10px",
    color: C.muted,
    lineHeight: 1.6,
    borderTop: `1px solid ${C.border}`,
    paddingTop: "16px",
  },
  disclaimerLink: {
    color: C.muted,
    textDecoration: "underline",
  },
  trustRow: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "16px",
    padding: "0 4px",
  },
  trust: {
    fontSize: "11px",
    color: C.muted,
    letterSpacing: "0.03em",
  },
};
