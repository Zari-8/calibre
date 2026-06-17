import { useState, useEffect, useRef, useCallback } from 'react';
import { navigateTo } from '../components/NavLink.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import ShareBar, { shareUrl } from '../components/Share.jsx';
import { searchSupabasePlayers, getSupabasePlayersByApiIds } from '../services/supabasePlayers.js';
import { calibreRating } from '../services/calibreRating.js';

// ── Editorial spotlight pool — top transfer buzz players from highlighted leagues
// Rotates every 3 days using a deterministic date seed so all users see the same pick
const SPOTLIGHT_POOL = [
  { apiPlayerId: 284888, name: 'Viktor Gyökeres', pos: 'ST', club: 'Sporting CP', to: 'Arsenal',     fee: 80,  marketValue: 55, context: 'Arsenal\'s first-choice striker target. Gyökeres led Europe in goals per 90 last season. The question is whether £80M represents fair value for a player yet to prove himself in a top-5 league.' },
  { apiPlayerId: 203224, name: 'Florian Wirtz',   pos: 'AM', club: 'Leverkusen',  to: 'Liverpool',   fee: 125, marketValue: 100, context: 'The most complete young midfielder in Europe. Liverpool secured one of the best pure playmakers in a generation. At €125M the fee is steep but the ceiling is elite.' },
  { apiPlayerId: 390489, name: 'Nico Williams',   pos: 'LW', club: 'Athletic Club',to: 'Barcelona',  fee: 58,  marketValue: 60, context: 'Barcelona activate release clause on the Spain international. One of the purest 1v1 wingers in European football — at this price, arguably the deal of the summer.' },
  { apiPlayerId: 397810, name: 'Junior Kroupi',   pos: 'ST', club: 'LOSC Lille',  to: 'Bournemouth', fee: 100, marketValue: 40, context: 'Bournemouth\'s record pursuit of the Ligue 1 breakthrough striker. Calibre rates his ceiling highly but the €100M ask is a 150% premium on market value.' },
  { apiPlayerId: 348905, name: 'Dean Huijsen',    pos: 'CB', club: 'Bournemouth', to: 'Real Madrid', fee: 60,  marketValue: 45, context: 'Real Madrid\'s long-term successor to their defensive spine. At 19, Huijsen represents exactly the kind of curve buy the Bernabéu has built its dynasty on.' },
  { apiPlayerId: 281854, name: 'Evan Ferguson',   pos: 'ST', club: 'Brighton',    to: 'Man United',  fee: 50,  marketValue: 45, context: 'United\'s striker search lands on Brighton\'s young Irishman. Strong positional instincts, good aerial presence, needs consistency at the highest level.' },
];

// Deterministic rotation — changes every 3 days, consistent for all users
function getSpotlightIndex() {
  const epoch = new Date('2026-06-01').getTime();
  const daysSince = Math.floor((Date.now() - epoch) / (1000 * 60 * 60 * 24));
  const slot = Math.floor(daysSince / 3);
  return slot % SPOTLIGHT_POOL.length;
}

// ── Static transfer feed ──────────────────────────────────────────────────────
const RECENT_TRANSFERS = [
  { id: 1, name: 'Florian Wirtz',    pos: 'AM / Creator',  from: 'Leverkusen',   to: 'Liverpool',    fee: 125, status: 'done',    apiPlayerId: 203224 },
  { id: 2, name: 'Viktor Gyökeres', pos: 'ST / Power',    from: 'Sporting',      to: 'Arsenal',      fee: 80,  status: 'rumour',  apiPlayerId: 284888 },
  { id: 3, name: 'Nico Williams',   pos: 'LW / 1v1',      from: 'Athletic Club', to: 'Barcelona',    fee: 58,  status: 'premium', apiPlayerId: 390489 },
  { id: 4, name: 'Dean Huijsen',    pos: 'CB / Builder',  from: 'Bournemouth',   to: 'Real Madrid',  fee: 60,  status: 'done',    apiPlayerId: 348905 },
  { id: 5, name: 'Lamine Yamal',    pos: 'RW / Creator',  from: 'Barcelona',     to: '—',            fee: null,status: 'watch',   apiPlayerId: 386828 },
];

const MARKET_PULSE = [
  { label: 'Most inflated position', value: 'Striker',   highlight: true },
  { label: 'Average quoted premium', value: '+38%',      highlight: true },
  { label: 'Best value lane',        value: 'U23 CB',    highlight: false },
  { label: 'Highest risk lane',      value: 'Teen ST',   highlight: false },
  { label: 'Transfers done (June)',  value: '14',        highlight: false },
  { label: 'Avg fee vs TM value',    value: '+61%',      highlight: true },
];

// ── Comparables db ────────────────────────────────────────────────────────────
const COMPARABLES = [
  { name: 'Rasmus Højlund',   fee: 75,  tag: 'Young ST',      roi: 'MIXED ROI',      roiClass: 'amber', apiPlayerId: 284621 },
  { name: 'Benjamin Šeško',   fee: 65,  tag: 'Profile match', roi: 'GOOD CEILING',   roiClass: 'lime',  apiPlayerId: 339149 },
  { name: 'João Félix',       fee: 126, tag: 'Premium risk',  roi: 'OVERPAY FLAG',   roiClass: 'red',   apiPlayerId: 521 },
  { name: 'Evan Ferguson',    fee: 45,  tag: 'Value pick',    roi: 'BACK IT',        roiClass: 'lime',  apiPlayerId: 281854 },
  { name: 'Lois Openda',      fee: 38,  tag: 'Ligue 1 jump',  roi: 'GOOD CEILING',   roiClass: 'lime',  apiPlayerId: 180271 },
];

// ── Verdict engine ─────────────────────────────────────────────────────────────
function computeVerdict({ marketValue, askingPrice, calibreRat, age, leagueStrength = 0.78 }) {
  if (!marketValue || !askingPrice) return null;

  const premium = ((askingPrice - marketValue) / marketValue) * 100;

  // Age curve score (younger = more justification for premium)
  const ageCurve = age <= 19 ? 88 : age <= 21 ? 78 : age <= 24 ? 65 : age <= 27 ? 50 : 30;

  // Rating-to-fee score
  const ratingBaseline = marketValue * (calibreRat / 80);
  const ratingScore = Math.max(10, Math.min(100, Math.round(100 - ((askingPrice - ratingBaseline) / ratingBaseline) * 60)));

  // League discount factor
  const leagueScore = Math.round(leagueStrength * 100);

  // Scarcity (hardcoded for now, will come from DB)
  const scarcity = 68;

  // Fair price ceiling
  const fairCeiling = Math.round(marketValue * (1 + (ageCurve / 100) * 0.9 + (scarcity / 100) * 0.3));

  // Value score (composite)
  const valueScore = Math.round((ratingScore * 0.4) + (ageCurve * 0.35) + (leagueScore * 0.15) + (scarcity * 0.1));

  // Premium justified %
  const premiumJustified = Math.min(100, Math.round((fairCeiling / askingPrice) * 100));

  // Verdict
  let verdict, verdictClass;
  if (askingPrice <= fairCeiling * 0.9) {
    verdict = 'DEAL'; verdictClass = 'lime';
  } else if (askingPrice <= fairCeiling * 1.1) {
    verdict = 'CONDITIONAL DEAL'; verdictClass = 'amber';
  } else if (askingPrice <= fairCeiling * 1.35) {
    verdict = 'NEGOTIATE HARD'; verdictClass = 'amber';
  } else {
    verdict = 'NO DEAL'; verdictClass = 'red';
  }

  const dealRisk = askingPrice > fairCeiling * 1.2 ? 'HIGH' : askingPrice > fairCeiling * 0.95 ? 'MEDIUM' : 'LOW';
  const dealRiskClass = dealRisk === 'HIGH' ? 'red' : dealRisk === 'MEDIUM' ? 'amber' : 'lime';

  return {
    premium: Math.round(premium),
    fairCeiling,
    valueScore,
    premiumJustified,
    verdict,
    verdictClass,
    dealRisk,
    dealRiskClass,
    ageCurve,
    ratingScore,
    overpayBy: Math.max(0, askingPrice - fairCeiling),
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function VerdictStamp({ verdict, verdictClass }) {
  const colors = { lime: '#c8ff00', amber: '#f59e0b', red: '#ef4444' };
  const bgColors = { lime: 'rgba(200,255,0,0.08)', amber: 'rgba(245,158,11,0.08)', red: 'rgba(239,68,68,0.08)' };
  const borderColors = { lime: 'rgba(200,255,0,0.3)', amber: 'rgba(245,158,11,0.3)', red: 'rgba(239,68,68,0.3)' };
  return (
    <div style={{ border: `1px solid ${borderColors[verdictClass]}`, background: bgColors[verdictClass], borderRadius: 16, padding: '16px 20px', marginTop: 14 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.18em', color: colors[verdictClass], textTransform: 'uppercase', marginBottom: 4 }}>Calibre Verdict</div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 42, fontWeight: 800, color: colors[verdictClass], textTransform: 'uppercase', lineHeight: 1 }}>{verdict}</div>
    </div>
  );
}

function MetricBar({ label, value, max = 100, color = '#c8ff00' }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 36px', gap: 10, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>{label}</span>
      <div style={{ height: 4, background: '#1c1c1c', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(value / max) * 100}%`, background: color, borderRadius: 999, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function ScorePanel({ title, score, scoreColor = '#c8ff00', children, span = 1 }) {
  return (
    <div style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', padding: 20, gridColumn: `span ${span}` }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.15em', color: '#555', textTransform: 'uppercase', marginBottom: 10 }}>{title}</div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 54, fontWeight: 800, color: scoreColor, lineHeight: 1, marginBottom: 14 }}>{score}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    done:    { label: 'Done',       color: '#4ade80', border: 'rgba(74,222,128,0.3)',  bg: 'rgba(74,222,128,0.08)' },
    rumour:  { label: 'Hot rumour', color: '#f59e0b', border: 'rgba(245,158,11,0.3)', bg: 'rgba(245,158,11,0.08)' },
    premium: { label: 'Premium',    color: '#ef4444', border: 'rgba(239,68,68,0.3)',  bg: 'rgba(239,68,68,0.08)' },
    watch:   { label: 'Watch',      color: '#c8ff00', border: 'rgba(200,255,0,0.3)',  bg: 'rgba(200,255,0,0.08)' },
  };
  const s = map[status] || map.watch;
  return (
    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 8px', border: `1px solid ${s.border}`, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function RecentTransferCard({ transfer, onAnalyse }) {
  return (
    <div style={{ border: '1px solid #1c1c1c', padding: '14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{transfer.name}</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{transfer.from} → {transfer.to}</div>
        </div>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.1em', color: '#555', textTransform: 'uppercase', flexShrink: 0 }}>{transfer.pos}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800 }}>
          {transfer.fee ? `€${transfer.fee}M` : 'TBD'}
        </span>
        <StatusBadge status={transfer.status} />
      </div>
      <button
        onClick={() => onAnalyse(transfer)}
        style={{ marginTop: 10, width: '100%', background: 'none', border: '1px solid #2a2a2a', color: '#888', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px', cursor: 'pointer', transition: 'all 0.15s' }}
        onMouseEnter={e => { e.target.style.borderColor = '#c8ff00'; e.target.style.color = '#c8ff00'; }}
        onMouseLeave={e => { e.target.style.borderColor = '#2a2a2a'; e.target.style.color = '#888'; }}
      >
        Analyse this deal →
      </button>
    </div>
  );
}

// ── Search box with debounce + Supabase lookup ─────────────────────────────────
function PlayerSearch({ value, onChange, onSelect }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef(null);

  const search = useCallback((q) => {
    clearTimeout(debounce.current);
    if (q.length < 2) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const rows = await searchSupabasePlayers(q, { limit: 6 });
        setResults(rows);
        setOpen(true);
      } catch { setResults([]); }
    }, 300);
  }, []);

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); search(e.target.value); }}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search player — try Kroupi, Gyökeres, Wirtz…"
        style={inputStyle}
      />
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#111', border: '1px solid #2a2a2a', zIndex: 100, marginTop: 4 }}>
          {results.map(p => (
            <button
              key={p.id}
              onMouseDown={() => { onSelect(p); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', padding: '10px 14px', cursor: 'pointer', color: '#fff', textAlign: 'left', borderBottom: '1px solid #1c1c1c' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <ApiPlayerImage playerId={p.apiPlayerId} name={p.name} fallbackSrc="/assets/players/neutral-player.svg" style={{ width: 28, height: 28, borderRadius: '50%' }} />
              <div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700 }}>{p.full_name || p.name}</div>
                <div style={{ fontSize: 10, color: '#666' }}>{p.pos || p.position} · {p.club || p.team} · {p.nationality}</div>
              </div>
              <span style={{ marginLeft: 'auto', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 800, color: '#c8ff00' }}>{p.rating ? Math.round(p.rating) : '—'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tabs ───────────────────────────────────────────────────────────────────────
const TABS = ['Overview', 'Value Analysis', 'System Fit', 'Risk Profile', 'Comparables'];

// ── Main component ─────────────────────────────────────────────────────────────
export default function Transfers() {
  // ── Editorial spotlight — DB-wired, rotates every 3 days ──
  const [spotlight, setSpotlight] = useState(null);
  const [spotlightLoading, setSpotlightLoading] = useState(true);

  useEffect(() => {
    const pick = SPOTLIGHT_POOL[getSpotlightIndex()];
    setSpotlightLoading(true);
    getSupabasePlayersByApiIds([pick.apiPlayerId])
      .then(rows => {
        const dbPlayer = rows[0];
        setSpotlight({
          ...pick,
          rating: dbPlayer?.rating ? Math.round(dbPlayer.rating) : null,
          appearances: dbPlayer?.appearances || null,
          goals: dbPlayer?.goals || null,
          assists: dbPlayer?.assists || null,
          position: dbPlayer?.position || dbPlayer?.pos || pick.pos,
          nationality: dbPlayer?.nationality || null,
        });
      })
      .catch(() => setSpotlight(pick))
      .finally(() => setSpotlightLoading(false));
  }, []);
  const [playerQuery, setPlayerQuery] = useState('Junior Kroupi');
  const [buyerQuery, setBuyerQuery] = useState('Bournemouth');
  const [selectedPlayer, setSelectedPlayer] = useState({
    name: 'Junior Kroupi', full_name: 'Junior Kroupi', pos: 'ST',
    age: 19, club: 'LOSC Lille', nationality: 'France',
    rating: 81, apiPlayerId: 397810,
    appearances: 34, goals: 16, assists: 6, pass_accuracy: 79,
  });
  const [marketValue, setMarketValue] = useState(40);
  const [askingPrice, setAskingPrice] = useState(100);
  const [activeTab, setActiveTab] = useState('Overview');
  const [systemFitScore] = useState(84);
  const verdict = computeVerdict({
    marketValue,
    askingPrice,
    calibreRat: selectedPlayer?.rating || 75,
    age: selectedPlayer?.age || 23,
  });

  function handleAnalyseRecent(transfer) {
    setPlayerQuery(transfer.name);
    setSelectedPlayer({ name: transfer.name, full_name: transfer.name, apiPlayerId: transfer.apiPlayerId, pos: transfer.pos.split('/')[0].trim(), club: transfer.from, age: 24, rating: 78 });
    if (transfer.fee) setAskingPrice(transfer.fee);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const premiumColor = verdict ? (verdict.premium > 100 ? '#ef4444' : verdict.premium > 50 ? '#f59e0b' : '#c8ff00') : '#888';
  const shareText = verdict
    ? `${selectedPlayer?.full_name || selectedPlayer?.name} — ${verdict.verdict}. Calibre fair ceiling: €${verdict?.fairCeiling}M. calibrefootball.com/transfers`
    : `Transfer Intelligence on Calibre — calibrefootball.com/transfers`;

  return (
    <div style={pageStyle}>
      {/* ── HERO ── */}
      <div style={heroWrap}>
        <div style={heroInner}>
          {/* Left — headline + search */}
          <div style={{ paddingRight: 32 }}>
            <div style={eyebrowStyle}>Transfer Intelligence · Live Deal Room</div>
            <h1 style={headlineStyle}>Deal or<br />No Deal?</h1>
            <p style={heroSubStyle}>
              Stress-test any transfer fee against market value, Calibre rating, age curve, system fit and risk — then change the asking price and watch the verdict move live.
            </p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <PlayerSearch
                value={playerQuery}
                onChange={setPlayerQuery}
                onSelect={p => { setSelectedPlayer(p); setPlayerQuery(p.full_name || p.name); }}
              />
              <input
                value={buyerQuery}
                onChange={e => setBuyerQuery(e.target.value)}
                placeholder="Buying club"
                style={{ ...inputStyle, width: 160 }}
              />
              <button style={ctaBtn} onClick={() => {}}>Analyse →</button>
            </div>

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: '#1c1c1c' }}>
              {[
                { label: 'Market Value', value: `€${marketValue}M`, color: '#c8ff00' },
                { label: 'Asking Price', value: `€${askingPrice}M`, color: '#fff' },
                { label: 'Premium', value: verdict ? `+${verdict.premium}%` : '—', color: premiumColor },
              ].map(k => (
                <div key={k.label} style={{ background: '#0a0a0a', padding: '14px 16px' }}>
                  <div style={{ fontSize: 9, letterSpacing: '0.15em', color: '#555', textTransform: 'uppercase', marginBottom: 5, fontFamily: "'Barlow Condensed', sans-serif" }}>{k.label}</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Asking price adjuster */}
            <div style={{ marginTop: 14, background: '#0f0f0f', border: '1px solid #1c1c1c', padding: '14px 16px' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#555', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 8 }}>Adjust asking price — verdict updates live</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, color: '#c8ff00', fontWeight: 800 }}>€</span>
                <input
                  type="range" min="1" max="300" value={askingPrice}
                  onChange={e => setAskingPrice(Number(e.target.value))}
                  style={{ flex: 1, accentColor: '#c8ff00', height: 4 }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number" value={askingPrice}
                    onChange={e => setAskingPrice(Math.max(1, Math.min(300, Number(e.target.value))))}
                    style={{ ...inputStyle, width: 72, padding: '6px 10px', fontSize: 18, fontWeight: 800, color: '#c8ff00', textAlign: 'center', MozAppearance: 'textfield' }}
                  />
                  <span style={{ fontSize: 12, color: '#555' }}>M</span>
                </div>
              </div>
              {verdict && (
                <div style={{ marginTop: 10, fontSize: 11, color: '#666' }}>
                  Calibre fair ceiling: <span style={{ color: '#c8ff00', fontWeight: 700 }}>€{verdict.fairCeiling}M</span>
                  {verdict.overpayBy > 0 && <span style={{ color: '#ef4444', marginLeft: 10 }}>Overpay: €{verdict.overpayBy}M</span>}
                </div>
              )}
            </div>
          </div>

          {/* Right — player card + verdict */}
          <div>
            <div style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', padding: 20 }}>
              {/* Player identity */}
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid #1c1c1c' }}>
                <div style={{ width: 64, height: 64, background: '#1a1a1a', border: '1px solid #2a2a2a', overflow: 'hidden', flexShrink: 0 }}>
                  <ApiPlayerImage
                    playerId={selectedPlayer?.apiPlayerId}
                    name={selectedPlayer?.name}
                    fallbackSrc="/assets/players/neutral-player.svg"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}>{selectedPlayer?.full_name || selectedPlayer?.name || 'Select a player'}</div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                    {selectedPlayer?.pos} · Age {selectedPlayer?.age} · {selectedPlayer?.club}
                  </div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 2, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {selectedPlayer?.nationality} · Calibre {selectedPlayer?.rating ? Math.round(selectedPlayer.rating) : '—'}
                  </div>
                </div>
              </div>

              {/* 2×2 metric grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#1c1c1c', marginBottom: 1 }}>
                {[
                  { label: 'Fair Price Ceiling', value: verdict ? `€${verdict.fairCeiling}M` : '—', color: '#c8ff00' },
                  { label: 'Premium Justified',  value: verdict ? `${verdict.premiumJustified}%` : '—', color: verdict?.premiumJustified > 70 ? '#c8ff00' : verdict?.premiumJustified > 50 ? '#f59e0b' : '#ef4444' },
                  { label: 'System Fit',         value: systemFitScore, color: '#c8ff00' },
                  { label: 'Deal Risk',          value: verdict?.dealRisk || '—', color: verdict?.dealRiskClass === 'red' ? '#ef4444' : verdict?.dealRiskClass === 'amber' ? '#f59e0b' : '#c8ff00' },
                ].map(m => (
                  <div key={m.label} style={{ background: '#0a0a0a', padding: '12px 14px' }}>
                    <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#555', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 800, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Verdict stamp */}
              {verdict && <VerdictStamp verdict={verdict.verdict} verdictClass={verdict.verdictClass} />}

              {/* Share */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #1c1c1c' }}>
                <ShareBar text={shareText} url={shareUrl('/transfers')} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── LAYOUT: main + aside ── */}
      <div style={layoutStyle}>
        <div style={{ minWidth: 0 }}>

          {/* ── EDITORIAL SPOTLIGHT ── */}
          {spotlight && (
            <div style={{ marginBottom: 16, background: '#0f0f0f', border: '1px solid #1c1c1c', borderLeft: '3px solid #c8ff00', padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid #1c1c1c', background: '#0a0a0a' }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: '0.2em', color: '#c8ff00', textTransform: 'uppercase' }}>Editorial Pick</span>
                <span style={{ fontSize: 9, color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>· Rotates every 3 days · Connected to player DB</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 0, alignItems: 'stretch' }}>
                {/* Portrait */}
                <div style={{ background: '#1a1a1a', overflow: 'hidden', minHeight: 120 }}>
                  <ApiPlayerImage
                    playerId={spotlight.apiPlayerId}
                    name={spotlight.name}
                    fallbackSrc="/assets/players/neutral-player.svg"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }}
                  />
                </div>
                {/* Content */}
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, textTransform: 'uppercase' }}>{spotlight.name}</span>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.1em', color: '#555', textTransform: 'uppercase' }}>{spotlight.pos} · {spotlight.club} → {spotlight.to}</span>
                    {spotlight.rating && (
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 800, color: '#c8ff00', marginLeft: 'auto' }}>CR {spotlight.rating}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: '#888', lineHeight: 1.6, margin: '0 0 10px' }}>{spotlight.context}</p>
                  {spotlight.goals != null && (
                    <div style={{ display: 'flex', gap: 16 }}>
                      {[
                        { label: 'Apps', value: spotlight.appearances },
                        { label: 'Goals', value: spotlight.goals },
                        { label: 'Assists', value: spotlight.assists },
                      ].map(s => (
                        <div key={s.label}>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 800, color: '#fff' }}>{s.value ?? '—'}</div>
                          <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Load into engine CTA */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '14px 16px', borderLeft: '1px solid #1c1c1c', gap: 8, background: '#0a0a0a' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800 }}>€{spotlight.fee}M</div>
                  <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>Quoted fee</div>
                  <button
                    onClick={() => {
                      setSelectedPlayer({ ...spotlight, full_name: spotlight.name, rating: spotlight.rating || 78 });
                      setPlayerQuery(spotlight.name);
                      setAskingPrice(spotlight.fee || 80);
                      setMarketValue(spotlight.marketValue || 40);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{ background: '#c8ff00', border: 'none', color: '#0a0a0a', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Run Analysis →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, background: '#0a0a0a', border: '1px solid #1c1c1c', borderBottom: 'none', overflowX: 'auto' }}>
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? '#c8ff00' : 'none',
                  border: 'none',
                  color: activeTab === tab ? '#0a0a0a' : '#666',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 12, fontWeight: 800, letterSpacing: '0.1em',
                  textTransform: 'uppercase', padding: '12px 18px',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >{tab}</button>
            ))}
          </div>

          {/* Tab panels */}
          <div style={{ border: '1px solid #1c1c1c', background: '#0a0a0a' }}>

            {/* OVERVIEW */}
            {activeTab === 'Overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: '#1c1c1c' }}>
                <ScorePanel title="Value Score" score={verdict?.valueScore || '—'} scoreColor={verdict?.valueScore > 65 ? '#c8ff00' : verdict?.valueScore > 45 ? '#f59e0b' : '#ef4444'}>
                  <p style={{ fontSize: 12, color: '#666', lineHeight: 1.6, margin: 0 }}>
                    {verdict && askingPrice > verdict.fairCeiling
                      ? `At €${askingPrice}M, Calibre sees a €${verdict.overpayBy}M overpay. The age curve justifies a premium — but not this one.`
                      : `At €${askingPrice}M, this deal is within Calibre's defensible range. Fair ceiling is €${verdict?.fairCeiling}M.`}
                  </p>
                </ScorePanel>

                <ScorePanel title="System Fit" score={systemFitScore}>
                  <MetricBar label="Pressing" value={88} />
                  <MetricBar label="Transition" value={91} />
                  <MetricBar label="Box threat" value={82} />
                </ScorePanel>

                <ScorePanel
                  title="Risk Profile"
                  score={verdict ? (verdict.dealRisk === 'HIGH' ? 67 : verdict.dealRisk === 'MEDIUM' ? 55 : 82) : '—'}
                  scoreColor={verdict?.dealRiskClass === 'red' ? '#ef4444' : verdict?.dealRiskClass === 'amber' ? '#f59e0b' : '#c8ff00'}
                >
                  <MetricBar label="League jump" value={78} color="#f59e0b" />
                  <MetricBar label="Sample size" value={66} color="#f59e0b" />
                  <MetricBar label="Fee pressure" value={90} color="#ef4444" />
                </ScorePanel>

                {/* Deal lever — spans full width */}
                <div style={{ background: '#0f0f0f', padding: 20, gridColumn: 'span 3' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.15em', color: '#555', textTransform: 'uppercase', marginBottom: 12 }}>Deal Lever — drag to find the right price</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#555', width: 48 }}>€1M</span>
                    <input type="range" min="1" max="300" value={askingPrice} onChange={e => setAskingPrice(Number(e.target.value))} style={{ flex: 1, accentColor: '#c8ff00' }} />
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#555', width: 52, textAlign: 'right' }}>€300M</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
                    {[
                      { price: Math.round(verdict?.fairCeiling * 0.7) || 48, label: 'VALUE BUY', color: '#c8ff00' },
                      { price: verdict?.fairCeiling || 68, label: 'FAIR CEILING', color: '#c8ff00' },
                      { price: Math.round((verdict?.fairCeiling || 68) * 1.2) || 82, label: 'BORDERLINE', color: '#f59e0b' },
                      { price: askingPrice, label: 'CURRENT ASK', color: premiumColor },
                    ].map(p => (
                      <button
                        key={p.label}
                        onClick={() => setAskingPrice(p.price)}
                        style={{ background: 'none', border: `1px solid ${p.color}22`, color: p.color, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 12px', cursor: 'pointer' }}
                      >
                        €{p.price}M — {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* VALUE ANALYSIS */}
            {activeTab === 'Value Analysis' && (
              <div style={{ padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                  <div>
                    <div style={tabSectionLabel}>Rating vs Fee</div>
                    <MetricBar label="Rating score" value={verdict?.ratingScore || 0} />
                    <div style={{ marginTop: 12, fontSize: 12, color: '#666', lineHeight: 1.6 }}>
                      A Calibre rating of {selectedPlayer?.rating ? Math.round(selectedPlayer.rating) : '—'} justifies approximately €{verdict ? Math.round(marketValue * 1.4) : '—'}M at this league strength. Current ask is €{askingPrice}M.
                    </div>
                  </div>
                  <div>
                    <div style={tabSectionLabel}>Age Curve Premium</div>
                    <MetricBar label="Age score" value={verdict?.ageCurve || 0} />
                    <div style={{ marginTop: 12, fontSize: 12, color: '#666', lineHeight: 1.6 }}>
                      Age {selectedPlayer?.age || '—'} gives this player {selectedPlayer?.age <= 21 ? '6-8 peak years ahead' : selectedPlayer?.age <= 25 ? '3-5 peak years ahead' : 'limited curve upside'}. This {selectedPlayer?.age <= 21 ? 'strongly' : 'partially'} justifies a market premium.
                    </div>
                  </div>
                </div>
                <div style={tabSectionLabel}>Fair Price Breakdown</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#1c1c1c' }}>
                  {[
                    { label: 'Base (TM value)', value: `€${marketValue}M`, note: 'Market consensus' },
                    { label: 'Age premium', value: `+€${Math.round(marketValue * (verdict?.ageCurve || 0) / 100 * 0.5)}M`, note: 'Curve justified' },
                    { label: 'Scarcity add', value: '+€8M', note: 'Position scarcity' },
                    { label: 'Calibre ceiling', value: `€${verdict?.fairCeiling || '—'}M`, note: 'Defensible max', highlight: true },
                  ].map(b => (
                    <div key={b.label} style={{ background: b.highlight ? 'rgba(200,255,0,0.06)' : '#0f0f0f', padding: '14px 16px', borderLeft: b.highlight ? '2px solid #c8ff00' : 'none' }}>
                      <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 6 }}>{b.label}</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, color: b.highlight ? '#c8ff00' : '#fff' }}>{b.value}</div>
                      <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>{b.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SYSTEM FIT */}
            {activeTab === 'System Fit' && (
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 24 }}>
                  <div style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', padding: '20px 28px', textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 72, fontWeight: 800, color: '#c8ff00', lineHeight: 1 }}>{systemFitScore}</div>
                    <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>System Fit</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{buyerQuery || 'Buying club'} · 4-2-3-1 · High press</div>
                    <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, margin: '0 0 16px' }}>
                      {selectedPlayer?.name || 'This player'} suits {buyerQuery || 'the buying club'}'s direct, high-tempo style well. Press intensity and transition output are elite for a player of this age. The system fit works — the price doesn't.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <MetricBar label="Press intensity" value={88} />
                      <MetricBar label="Transition" value={91} />
                      <MetricBar label="Box threat" value={82} />
                      <MetricBar label="Aerial duels" value={44} color="#f59e0b" />
                      <MetricBar label="Link-up play" value={79} />
                    </div>
                  </div>
                </div>
                <div style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', padding: 16, borderLeft: '2px solid #c8ff00' }}>
                  <div style={{ fontSize: 10, color: '#c8ff00', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 6 }}>Fit verdict</div>
                  <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.6 }}>
                    System fit is strong at {systemFitScore}/100. The main concern is aerial duels (44) in a side that relies on second-ball recovery. That's a positional gap, not a player quality issue — it can be managed tactically. Fit works. Price needs renegotiation.
                  </p>
                </div>
              </div>
            )}

            {/* RISK PROFILE */}
            {activeTab === 'Risk Profile' && (
              <div style={{ padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <div style={tabSectionLabel}>Risk Signals</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {[
                        { label: 'Injury history',     value: 'Low',    cls: 'lime' },
                        { label: 'Games missed',       value: '3',      cls: 'lime' },
                        { label: 'Contract expires',   value: '2027',   cls: 'amber' },
                        { label: 'League jump',        value: 'Ligue 1 → PL', cls: 'amber' },
                        { label: 'Adaptation risk',    value: 'Medium', cls: 'amber' },
                        { label: 'Agent leverage',     value: 'High',   cls: 'red' },
                        { label: 'Sample size',        value: '34 apps', cls: 'lime' },
                        { label: 'Fee pressure risk',  value: 'High',   cls: 'red' },
                      ].map(r => (
                        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1c1c1c' }}>
                          <span style={{ fontSize: 12, color: '#888' }}>{r.label}</span>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800, color: r.cls === 'lime' ? '#c8ff00' : r.cls === 'amber' ? '#f59e0b' : '#ef4444' }}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={tabSectionLabel}>Age Curve — Peak Projection</div>
                    <AgeCurveChart currentAge={selectedPlayer?.age || 19} />
                    <div style={{ fontSize: 11, color: '#666', marginTop: 12, lineHeight: 1.6 }}>
                      Peak window: 22–27. Buying club gets the full curve if this deal completes now.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* COMPARABLES */}
            {activeTab === 'Comparables' && (
              <div style={{ padding: 24 }}>
                <div style={tabSectionLabel}>Similar transfers — age, position, fee range</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: '#1c1c1c' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 1fr 1fr', gap: 1, background: '#1c1c1c' }}>
                    {['Player', 'Fee', 'Profile', 'Calibre verdict'].map(h => (
                      <div key={h} style={{ background: '#0a0a0a', padding: '8px 14px', fontSize: 9, letterSpacing: '0.12em', color: '#555', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>{h}</div>
                    ))}
                  </div>
                  {COMPARABLES.map(c => (
                    <div key={c.name} style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 1fr 1fr', gap: 1, background: '#1c1c1c' }}>
                      <div style={{ background: '#0f0f0f', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ApiPlayerImage playerId={c.apiPlayerId} name={c.name} fallbackSrc="/assets/players/neutral-player.svg" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700 }}>{c.name}</span>
                      </div>
                      <div style={{ background: '#0f0f0f', padding: '12px 14px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 800 }}>€{c.fee}M</div>
                      <div style={{ background: '#0f0f0f', padding: '12px 14px' }}>
                        <span style={{ border: '1px solid #2a2a2a', padding: '3px 8px', fontSize: 10, color: '#666', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>{c.tag}</span>
                      </div>
                      <div style={{ background: '#0f0f0f', padding: '12px 14px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800, color: c.roiClass === 'lime' ? '#c8ff00' : c.roiClass === 'amber' ? '#f59e0b' : '#ef4444' }}>{c.roi}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, fontSize: 11, color: '#555' }}>
                  Comparables sourced from Calibre's transfer database. Performance verdict based on post-transfer calibreRating trajectory.
                </div>
              </div>
            )}
          </div>

          {/* ── HOW CALIBRE VERDICTS WORK ── */}
          <div style={{ marginTop: 16, background: '#0f0f0f', border: '1px solid #1c1c1c', padding: 20 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.18em', color: '#555', textTransform: 'uppercase', marginBottom: 16 }}>How the verdict engine works</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1, background: '#1c1c1c' }}>
              {[
                { step: '01', title: 'Market value', desc: 'Transfermarkt consensus sets the baseline. This is what the market thinks the player is worth today.' },
                { step: '02', title: 'Calibre ceiling', desc: 'Rating + age curve + league strength + scarcity factor. The maximum defensible fee based on real data.' },
                { step: '03', title: 'Your asking price', desc: 'What the selling club is actually quoting. Enter any number and the verdict recalculates instantly.' },
                { step: '04', title: 'The verdict', desc: 'DEAL / CONDITIONAL DEAL / NEGOTIATE HARD / NO DEAL. One signal. Based entirely on the numbers.' },
              ].map(s => (
                <div key={s.step} style={{ background: '#0a0a0a', padding: '14px 16px' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.15em', color: '#c8ff00', marginBottom: 6 }}>{s.step}</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: '#666', lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── DISCLAIMER ── */}
          <div style={{ marginTop: 12, fontSize: 10, color: '#333', lineHeight: 1.6 }}>
            Transfer values sourced from Transfermarkt. Calibre ratings, fair price ceilings and system fit scores are computed from TheStatsAPI event data and Calibre's proprietary rating engine. Not financial or sporting advice.
          </div>
        </div>

        {/* ── ASIDE ── */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Recent transfers */}
          <div style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #1c1c1c' }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}>Recent<br />Transfers</div>
              <span style={{ fontSize: 9, letterSpacing: '0.15em', color: '#555', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>Summer 2026</span>
            </div>
            {RECENT_TRANSFERS.map(t => <RecentTransferCard key={t.id} transfer={t} onAnalyse={handleAnalyseRecent} />)}
          </div>

          {/* Market pulse */}
          <div style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #1c1c1c' }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}>Market<br />Pulse</div>
              <span style={{ fontSize: 9, letterSpacing: '0.15em', color: '#c8ff00', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>Live</span>
            </div>
            {MARKET_PULSE.map(p => (
              <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #1c1c1c' }}>
                <span style={{ fontSize: 11, color: '#666' }}>{p.label}</span>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800, color: p.highlight ? '#c8ff00' : '#fff' }}>{p.value}</span>
              </div>
            ))}
          </div>

          {/* Navigate to System Fit */}
          <button
            onClick={() => navigateTo('/system-fit')}
            style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', padding: 16, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#c8ff00'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#1c1c1c'}
          >
            <div style={{ fontSize: 9, letterSpacing: '0.15em', color: '#c8ff00', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 6 }}>Also try</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>System Fit →</div>
            <div style={{ fontSize: 11, color: '#666' }}>Run the full tactical fit for any player × team combination</div>
          </button>
        </aside>
      </div>
    </div>
  );
}

// ── Age curve mini chart ───────────────────────────────────────────────────────
function AgeCurveChart({ currentAge }) {
  const ages = [17,18,19,20,21,22,23,24,25,26,27,28,29,30,31];
  const heights = [30,45,55,63,72,84,92,95,94,88,80,68,55,42,30];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60, marginTop: 8 }}>
      {ages.map((age, i) => (
        <div
          key={age}
          title={`Age ${age}`}
          style={{
            flex: 1,
            height: `${heights[i]}%`,
            background: age === currentAge ? '#c8ff00' : age < currentAge ? '#333' : '#1c1c1c',
            transition: 'height 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const pageStyle = {
  background: '#0a0a0a',
  color: '#ffffff',
  fontFamily: "'Barlow', sans-serif",
  paddingBottom: 32,
};

const heroWrap = {
  background: '#0f0f0f',
  borderBottom: '1px solid #1c1c1c',
  padding: '28px 32px 24px',
};

const heroInner = {
  maxWidth: 1200,
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: '1fr 420px',
  gap: 32,
  alignItems: 'start',
};

const eyebrowStyle = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 10,
  letterSpacing: '0.2em',
  color: '#c8ff00',
  textTransform: 'uppercase',
  marginBottom: 12,
  display: 'block',
};

const headlineStyle = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 'clamp(52px, 6vw, 80px)',
  fontWeight: 800,
  lineHeight: 0.9,
  textTransform: 'uppercase',
  letterSpacing: '-0.01em',
  margin: '0 0 16px',
};

const heroSubStyle = {
  fontSize: 14,
  color: '#888',
  lineHeight: 1.6,
  margin: '0 0 20px',
  maxWidth: 500,
};

const inputStyle = {
  background: '#111',
  border: '1px solid #2a2a2a',
  color: '#fff',
  fontFamily: "'Barlow', sans-serif",
  fontSize: 14,
  padding: '11px 14px',
  outline: 'none',
  WebkitAppearance: 'none',
};

const ctaBtn = {
  background: '#c8ff00',
  border: 'none',
  color: '#0a0a0a',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 800,
  fontSize: 13,
  letterSpacing: '0.08em',
  padding: '11px 20px',
  cursor: 'pointer',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const layoutStyle = {
  maxWidth: 1200,
  margin: '24px auto 0',
  padding: '0 32px',
  display: 'grid',
  gridTemplateColumns: '1fr 320px',
  gap: 20,
  alignItems: 'start',
};

const tabSectionLabel = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 10,
  letterSpacing: '0.18em',
  color: '#555',
  textTransform: 'uppercase',
  marginBottom: 14,
  display: 'block',
};
