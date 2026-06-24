import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { navigateTo } from '../components/NavLink.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import ShareBar, { shareUrl } from '../components/Share.jsx';
import DealReport from '../components/DealReport.jsx';
import { searchSupabasePlayers, getSupabasePlayersByApiIds } from '../services/supabasePlayers.js';
import { calibreRating } from '../services/calibreRating.js';
import { supabase, supabaseConfigured } from '../services/supabaseClient.js';
import { SYSTEM_TEAMS } from '../data/systemFitData.js';
import { playerTraits } from '../services/playerTraits.js';
import { calibreValue } from '../services/calibreValue.js';
import { fitAdjustedValue, fitVerdict } from '../services/calibreFitValue.js';

// ── Team search ──────────────────────────────────────────────────────────────
function searchTeams(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return SYSTEM_TEAMS.slice(0, 8);
  return SYSTEM_TEAMS.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.short.toLowerCase().includes(q) ||
    t.country.toLowerCase().includes(q) ||
    t.league.toLowerCase().includes(q)
  ).slice(0, 8);
}

// ── System Fit calculator — runs player traits against team traits ────────────
function computeSystemFit(player, team) {
  if (!player || !team) return null;
  const { traits } = playerTraits(player);
  const tt = team.traits;
  // Compatibility = weighted similarity across 6 trait dimensions
  const dims = ['control', 'transition', 'pressing', 'width', 'tempo', 'defensiveLoad'];
  let total = 0;
  dims.forEach(dim => {
    const playerVal = traits[dim] || 70;
    const teamVal = tt[dim] || 70;
    // The closer the player's trait is to the team's demand, the higher the score
    const diff = Math.abs(playerVal - teamVal);
    const dimScore = Math.max(0, 100 - diff * 1.2);
    total += dimScore;
  });
  const fit = Math.round(total / dims.length);
  return {
    score: Math.max(40, Math.min(99, fit)),
    traits,
    teamTraits: tt,
    pressing: Math.round((traits.pressing + tt.pressing) / 2),
    transition: Math.round((traits.transition + tt.transition) / 2),
    boxThreat: Math.round((traits.width + tt.tempo) / 2),
  };
}

// ── Live data fetchers ────────────────────────────────────────────────────────

async function fetchRecentTransfers() {
  if (!supabaseConfigured || !supabase) return FALLBACK_TRANSFERS;
  const { data, error } = await supabase
    .from('transfers')
    .select('*')
    .eq('published', true)
    .eq('season', '2026-27')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) {
    console.warn('[Calibre] transfers fetch failed:', error.message);
    return FALLBACK_TRANSFERS;
  }
  if (!data?.length) return FALLBACK_TRANSFERS;
  return data.map(t => ({
    id: t.id,
    name: t.player_name,
    pos: t.position_label || t.position,
    from: t.from_club,
    to: t.to_club || '—',
    fee: t.fee_millions,
    status: t.status,
    apiPlayerId: t.api_player_id,
    marketValue: t.market_value,
  }));
}

async function fetchMarketPulse() {
  if (!supabaseConfigured || !supabase) return FALLBACK_PULSE;
  const { data, error } = await supabase
    .from('market_pulse')
    .select('*')
    .limit(1);
  if (error) {
    console.warn('[Calibre] market_pulse fetch failed:', error.message);
    return FALLBACK_PULSE;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return FALLBACK_PULSE;
  return [
    { label: 'Most inflated position', value: row.most_inflated_position || 'ST', highlight: true },
    { label: 'Average quoted premium', value: `+${row.avg_premium_pct ?? 0}%`, highlight: true },
    { label: 'Best value lane',        value: row.best_value_lane || 'U23 CB',  highlight: false },
    { label: 'Highest risk lane',      value: row.highest_risk_lane || 'Teen ST', highlight: false },
    { label: 'Transfers done (2026)',  value: String(row.transfers_done ?? 0),  highlight: false },
    { label: 'Avg fee vs TM value',    value: `+${row.avg_fee_vs_tm_pct ?? 0}%`, highlight: true },
  ];
}

async function fetchComparablePool() {
  if (!supabaseConfigured || !supabase) return FALLBACK_COMPARABLES;
  const { data, error } = await supabase
    .from('transfers')
    .select('*')
    .eq('published', true)
    .eq('season', '2026-27')
    .not('fee_millions', 'is', null)
    .order('fee_millions', { ascending: false })
    .limit(40);
  if (error || !data?.length) return FALLBACK_COMPARABLES;
  return data.map(t => {
    const premium = t.market_value ? ((t.fee_millions - t.market_value) / t.market_value * 100) : 0;
    const roi = premium > 60 ? 'OVERPAY FLAG' : premium > 20 ? 'MIXED ROI' : 'GOOD CEILING';
    const roiClass = premium > 60 ? 'red' : premium > 20 ? 'amber' : 'lime';
    return {
      name: t.player_name,
      fee: t.fee_millions,
      tag: t.position_label || t.position || '—',
      position: t.position || t.position_label || '',
      roi,
      roiClass,
      apiPlayerId: t.api_player_id,
    };
  });
}

// Group a position label into a broad bucket so comparables match like-for-like.
function comparableGroup(pos = '') {
  const t = String(pos).toLowerCase();
  if (/(gk|keeper|goal)/.test(t)) return 'GK';
  if (/(cb|centre.?back|center.?back|central def)/.test(t)) return 'CB';
  if (/(\blb\b|\brb\b|wing.?back|full.?back|\bfb\b|left.?back|right.?back)/.test(t)) return 'FB';
  if (/(\bdm\b|cdm|defensive mid|anchor|regista|holding)/.test(t)) return 'DM';
  if (/(\blw\b|\brw\b|wing|wide|inside forward)/.test(t)) return 'WIDE';
  if (/(\bst\b|\bcf\b|striker|forward|\bfw\b|\bfwd\b|attacker|poacher)/.test(t)) return 'FWD';
  if (/(\bam\b|\bcm\b|midfield|playmaker|creator|box.?to.?box)/.test(t)) return 'MID';
  return 'MID';
}

// Comparables shown in the tab: same position group as the analysed player,
// ranked by how close their fee is to the current asking price. Falls back to
// the whole pool only when too few in-group matches exist, so the tab is never
// empty — but it never again mixes centre-backs into a striker's list.
function deriveComparables(pool, player, askingPrice) {
  if (!Array.isArray(pool) || !pool.length) return [];
  const group = comparableGroup(player?.position || player?.pos || '');
  const refFee = Number(askingPrice) || Number(player?.marketValue) || null;
  const self = String(player?.name || player?.full_name || '').toLowerCase();
  const others = pool.filter(c => c && c.name && c.name.toLowerCase() !== self);
  const inGroup = others.filter(c => comparableGroup(c.tag || c.position) === group);
  const base = inGroup.length >= 3 ? inGroup : others;
  const ranked = [...base].sort((a, b) => {
    if (refFee == null) return (b.fee || 0) - (a.fee || 0);
    return Math.abs((a.fee || 0) - refFee) - Math.abs((b.fee || 0) - refFee);
  });
  return ranked.slice(0, 6);
}

// ── Spotlight — picks from live transfers table (highest-fee rumour/watch) ────
async function fetchSpotlight() {
  if (!supabaseConfigured || !supabase) return null;
  // Pick the highest-fee active deal that isn't 'done' — most buzz
  const slot = Math.floor(Math.floor((Date.now() - new Date('2026-06-01').getTime()) / 86400000) / 3);
  const { data, error } = await supabase
    .from('transfers')
    .select('*')
    .eq('published', true)
    .in('status', ['rumour', 'watch', 'premium'])
    .not('fee_millions', 'is', null)
    .order('fee_millions', { ascending: false })
    .limit(6);
  if (error || !data?.length) return null;
  const pick = data[slot % data.length];
  return {
    apiPlayerId: pick.api_player_id,
    name: pick.player_name,
    pos: pick.position,
    club: pick.from_club,
    to: pick.to_club || 'Unknown destination',
    fee: pick.fee_millions,
    marketValue: pick.market_value,
    context: buildSpotlightContext(pick),
  };
}

function buildSpotlightContext(t) {
  const premium = t.market_value ? Math.round((t.fee_millions - t.market_value) / t.market_value * 100) : null;
  const premiumStr = premium != null ? ` The quoted fee of €${t.fee_millions}M represents a ${premium > 0 ? '+' : ''}${premium}% ${premium > 0 ? 'premium' : 'discount'} on Transfermarkt value.` : '';
  return `${t.player_name} is one of the most talked-about moves of the summer window. ${t.from_club} to ${t.to_club || 'an unnamed destination'} — the deal is still developing.${premiumStr} Run the analysis to see Calibre's full verdict.`;
}

// ── Fallbacks (shown while Supabase loads or if unavailable) ─────────────────
const FALLBACK_TRANSFERS = [
  { id: '1', name: 'Florian Wirtz',   pos: 'AM / Creator', from: 'Leverkusen',   to: 'Liverpool',   fee: 125, status: 'done',   apiPlayerId: 203224, marketValue: 100 },
  { id: '2', name: 'Viktor Gyökeres', pos: 'ST / Power',   from: 'Sporting CP',  to: 'Arsenal',     fee: 80,  status: 'rumour', apiPlayerId: 284888, marketValue: 60 },
  { id: '3', name: 'Nico Williams',   pos: 'LW / 1v1',     from: 'Athletic Club',to: 'Barcelona',   fee: 58,  status: 'done',   apiPlayerId: 390489, marketValue: 60 },
  { id: '4', name: 'Dean Huijsen',    pos: 'CB / Builder', from: 'Bournemouth',  to: 'Real Madrid',  fee: 60,  status: 'done',   apiPlayerId: 348905, marketValue: 45 },
  { id: '5', name: 'Lamine Yamal',    pos: 'RW / Creator', from: 'Barcelona',    to: '—',            fee: null,status: 'watch',  apiPlayerId: 386828, marketValue: 180 },
];

const FALLBACK_PULSE = [
  { label: 'Most inflated position', value: 'Striker', highlight: true },
  { label: 'Average quoted premium', value: '+48%',    highlight: true },
  { label: 'Best value lane',        value: 'U23 CB',  highlight: false },
  { label: 'Highest risk lane',      value: 'Teen ST', highlight: false },
  { label: 'Transfers done (2026)',  value: '—',       highlight: false },
  { label: 'Avg fee vs TM value',    value: '—',       highlight: true },
];

const FALLBACK_COMPARABLES = [
  { name: 'Rasmus Højlund',   fee: 75,  tag: 'Young ST',      roi: 'MIXED ROI',    roiClass: 'amber', apiPlayerId: 284621 },
  { name: 'Benjamin Šeško',   fee: 65,  tag: 'Profile match', roi: 'GOOD CEILING', roiClass: 'lime',  apiPlayerId: 339149 },
  { name: 'João Félix',       fee: 126, tag: 'Premium risk',  roi: 'OVERPAY FLAG', roiClass: 'red',   apiPlayerId: 521 },
];

// ── Spotlight pool fallback ───────────────────────────────────────────────────
const SPOTLIGHT_POOL_FALLBACK = [
  { apiPlayerId: 284888, name: 'Viktor Gyökeres', pos: 'ST', club: 'Sporting CP', to: 'Arsenal',     fee: 80,  marketValue: 60,  context: "Arsenal's first-choice striker target. Gyökeres led Europe in goals per 90 last season. The question is whether €80M represents fair value for a player yet to prove himself in a top-5 league." },
  { apiPlayerId: 397810, name: 'Junior Kroupi',   pos: 'ST', club: 'LOSC Lille',  to: 'Bournemouth', fee: 100, marketValue: 40,  context: "Bournemouth's record pursuit of the Ligue 1 breakthrough striker. At €100M the ask is a 150% premium on market value. Calibre rates his ceiling highly but the price is the problem." },
  { apiPlayerId: 281854, name: 'Evan Ferguson',   pos: 'ST', club: 'Brighton',    to: 'Man United',  fee: 50,  marketValue: 45,  context: "United's striker search lands on Brighton's young Irishman. Strong positional instincts, good aerial presence, needs consistency at the highest level." },
];

function getSpotlightFallback() {
  const slot = Math.floor(Math.floor((Date.now() - new Date('2026-06-01').getTime()) / 86400000) / 3);
  return SPOTLIGHT_POOL_FALLBACK[slot % SPOTLIGHT_POOL_FALLBACK.length];
}

// ── Verdict engine ─────────────────────────────────────────────────────────────
function computeVerdict({ marketValue, askingPrice, calibreRat, age, leagueStrength = 0.78, position = 'MID' }) {
  if (!marketValue || !askingPrice) return null;

  const premium = ((askingPrice - marketValue) / marketValue) * 100;

  // Age curve score (younger = more justification for premium)
  const ageCurve = age <= 19 ? 88 : age <= 21 ? 78 : age <= 24 ? 65 : age <= 27 ? 50 : 30;

  // Rating multiplier — high rating directly lifts the ceiling
  // 75 baseline = 1.0x, every 5 rating points = +20% ceiling room
  const ratingMult = Math.max(0.6, Math.min(1.8, 1 + (calibreRat - 75) * 0.04));

  // Rating-to-fee score
  const ratingBaseline = marketValue * (calibreRat / 80);
  const ratingScore = Math.max(10, Math.min(100, Math.round(100 - ((askingPrice - ratingBaseline) / ratingBaseline) * 60)));

  // League discount factor
  const leagueScore = Math.round(leagueStrength * 100);

  // Position scarcity — CB and DM are most scarce, FB and WIDE less so
  const scarcityMap = { ST: 75, CB: 82, DM: 80, AM: 70, CM: 65, LW: 55, RW: 55, FB: 45, LB: 45, RB: 45, GK: 70 };
  const scarcity = scarcityMap[position] || 60;

  // Fair price ceiling — now factors rating, age curve, AND position scarcity
  const fairCeiling = Math.round(
    marketValue * ratingMult * (1 + (ageCurve / 100) * 0.7 + (scarcity / 100) * 0.25)
  );

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
    ratingMult: Math.round(ratingMult * 100) / 100,
    scarcity,
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
function PlayerSearch({ value, onChange, onSelect, onEnter }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce = useRef(null);

  const search = useCallback((q) => {
    clearTimeout(debounce.current);
    if (q.length < 2) { setResults([]); setOpen(false); setLoading(false); return; }
    setLoading(true);
    setOpen(true);
    debounce.current = setTimeout(async () => {
      try {
        const rows = await searchSupabasePlayers(q, { limit: 8 });
        setResults(rows || []);
      } catch (e) {
        console.warn('[Calibre] player search failed:', e?.message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, []);

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); search(e.target.value); }}
        onFocus={() => { if (value && value.length >= 2) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onKeyDown={e => e.key === 'Enter' && onEnter?.()}
        placeholder="Search player — try Bellingham, Vitinha, Wirtz…"
        style={inputStyle}
      />
      {open && value && value.length >= 2 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#111', border: '1px solid #2a2a2a', zIndex: 100, marginTop: 4, maxHeight: 320, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '12px 14px', fontSize: 12, color: '#666' }}>Searching…</div>
          )}
          {!loading && results.length === 0 && (
            <div style={{ padding: '12px 14px', fontSize: 12, color: '#666' }}>No players found for "{value}"</div>
          )}
          {!loading && results.map(p => (
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

// ── Team search — local SYSTEM_TEAMS dataset, real tactical profiles ──────────
function TeamSearch({ value, onChange, onSelect }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  const search = useCallback((q) => {
    if (!q || q.length < 1) { setResults([]); return; }
    setResults(searchTeams(q).slice(0, 6));
    setOpen(true);
  }, []);

  return (
    <div style={{ position: 'relative', width: 200 }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); search(e.target.value); }}
        onFocus={() => { if (value) search(value); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buying club"
        style={{ ...inputStyle, width: '100%' }}
      />
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#111', border: '1px solid #2a2a2a', zIndex: 100, marginTop: 4, maxHeight: 280, overflowY: 'auto' }}>
          {results.map(t => (
            <button
              key={t.id}
              onMouseDown={() => { onSelect(t); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', padding: '10px 14px', cursor: 'pointer', color: '#fff', textAlign: 'left', borderBottom: '1px solid #1c1c1c' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.accent || '#333', color: t.secondary || '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", flexShrink: 0 }}>{t.crest}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                <div style={{ fontSize: 10, color: '#666' }}>{t.league} · {t.formation}</div>
              </div>
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
  const [recentTransfers, setRecentTransfers] = useState(FALLBACK_TRANSFERS);
  const [marketPulse, setMarketPulse] = useState(FALLBACK_PULSE);
  const [comparablePool, setComparablePool] = useState(FALLBACK_COMPARABLES);
  const [transfersLoading, setTransfersLoading] = useState(true);

  useEffect(() => {
    // Load all live data in parallel
    setSpotlightLoading(true);
    setTransfersLoading(true);

    Promise.all([
      fetchRecentTransfers(),
      fetchMarketPulse(),
      fetchComparablePool(),
      fetchSpotlight(),
    ]).then(([transfers, pulse, comps, liveSpotlight]) => {
      setRecentTransfers(transfers);
      setMarketPulse(pulse);
      setComparablePool(comps);

      // Wire spotlight player to DB for live rating/stats
      const spotlightBase = liveSpotlight || getSpotlightFallback();
      if (spotlightBase?.apiPlayerId) {
        getSupabasePlayersByApiIds([spotlightBase.apiPlayerId])
          .then(rows => {
            const dbPlayer = rows[0];
            setSpotlight({
              ...spotlightBase,
              rating: dbPlayer?.rating ? Math.round(dbPlayer.rating) : null,
              appearances: dbPlayer?.appearances || null,
              goals: dbPlayer?.goals || null,
              assists: dbPlayer?.assists || null,
              position: dbPlayer?.position || dbPlayer?.pos || spotlightBase.pos,
              nationality: dbPlayer?.nationality || null,
            });
          })
          .catch(() => setSpotlight(spotlightBase))
          .finally(() => setSpotlightLoading(false));
      } else {
        setSpotlight(spotlightBase);
        setSpotlightLoading(false);
      }
    }).catch(() => {
      setSpotlight(getSpotlightFallback());
      setSpotlightLoading(false);
    }).finally(() => setTransfersLoading(false));
  }, []);

  const [playerQuery, setPlayerQuery] = useState('Junior Kroupi');
  const [buyerQuery, setBuyerQuery] = useState('Bournemouth');
  const [selectedPlayer, setSelectedPlayer] = useState({
    name: 'Junior Kroupi', full_name: 'Junior Kroupi', pos: 'ST',
    age: 19, club: 'LOSC Lille', league: 'Ligue 1', nationality: 'France',
    rating: 81, apiPlayerId: 397810,
    appearances: 34, goals: 16, assists: 6, pass_accuracy: 79,
  });
  const [marketValue, setMarketValue] = useState(40);
  const [askingPrice, setAskingPrice] = useState(100);
  const [activeTab, setActiveTab] = useState('Overview');
  const [selectedTeam, setSelectedTeam] = useState(null);
  // System Fit recalculates whenever player OR team changes
  const sysFit = selectedTeam ? computeSystemFit(selectedPlayer, selectedTeam) : null;
  const systemFitScore = sysFit ? sysFit.score : null;

  // ── Calibre valuation: base value (Piece 1) → fit-adjusted (Piece 2) → verdict ──
  const valuation = useMemo(() => calibreValue({
    rating: selectedPlayer?.rating,
    age: selectedPlayer?.age,
    position: selectedPlayer?.pos || selectedPlayer?.position,
    league: selectedPlayer?.league || selectedPlayer?.competition,
    club: selectedPlayer?.club,
    minutes: selectedPlayer?.minutes ?? (selectedPlayer?.appearances ? selectedPlayer.appearances * 80 : undefined),
    hasContractData: false,
  }), [selectedPlayer]);
  const fit = useMemo(() => fitAdjustedValue(valuation, systemFitScore), [valuation, systemFitScore]);
  const dealVerdict = useMemo(() => fitVerdict(valuation, fit, askingPrice), [valuation, fit, askingPrice]);
  const verdictClass = dealVerdict.tone === 'good' ? 'lime' : dealVerdict.tone === 'bad' ? 'red' : 'amber';
  const verdict = computeVerdict({
    marketValue: valuation.estimatedValue,
    askingPrice,
    calibreRat: selectedPlayer?.rating || 75,
    age: selectedPlayer?.age || 23,
    position: (selectedPlayer?.pos || selectedPlayer?.position || 'MID').toUpperCase().slice(0, 3),
  });

  // ── Player loader: fetches full DB data and sets all related state ──
  async function loadPlayerIntoEngine(apiPlayerId, name, fallbackMarketValue) {
    try {
      let dbPlayer = null;
      if (apiPlayerId) {
        const rows = await getSupabasePlayersByApiIds([apiPlayerId]);
        dbPlayer = rows[0];
      }
      if (!dbPlayer && name) {
        const rows = await searchSupabasePlayers(name, { limit: 1 });
        dbPlayer = rows[0];
      }
      if (dbPlayer) {
        // Use live computed rating when stored is null/missing — same logic the hero card uses
        const liveRating = dbPlayer.rating || calibreRating(dbPlayer)?.rating || 75;
        setSelectedPlayer({
          ...dbPlayer,
          rating: Math.round(liveRating),
        });
        setPlayerQuery(dbPlayer.full_name || dbPlayer.name);
        // Market value: use real transfer market_value if provided, else estimate from live rating
        const mv = fallbackMarketValue || Math.round(liveRating * 0.65);
        setMarketValue(mv);
        return dbPlayer;
      }
    } catch (e) { /* keep current state */ }
    return null;
  }

  async function handleAnalyseRecent(transfer) {
    setPlayerQuery(transfer.name);
    if (transfer.fee) setAskingPrice(transfer.fee);
    // Try to auto-select destination team from SYSTEM_TEAMS by name match
    if (transfer.to && transfer.to !== '—') {
      const teamMatch = SYSTEM_TEAMS.find(t =>
        t.name.toLowerCase().includes(transfer.to.toLowerCase()) ||
        t.short.toLowerCase().includes(transfer.to.toLowerCase()) ||
        transfer.to.toLowerCase().includes(t.short.toLowerCase())
      );
      if (teamMatch) {
        setSelectedTeam(teamMatch);
        setBuyerQuery(teamMatch.name);
      }
    }
    await loadPlayerIntoEngine(transfer.apiPlayerId, transfer.name, transfer.marketValue);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleAnalyse() {
    if (!playerQuery.trim()) return;
    await loadPlayerIntoEngine(null, playerQuery.trim(), null);
  }

  const premiumColor = dealVerdict.premium > 100 ? '#ef4444' : dealVerdict.premium > 50 ? '#f59e0b' : '#c8ff00';
  const shareText = `${selectedPlayer?.full_name || selectedPlayer?.name} — ${dealVerdict.label}. Calibre values him at €${valuation.estimatedValue}M${selectedTeam ? ` (€${fit.fitAdjustedValue}M to ${selectedTeam.short || selectedTeam.name})` : ''}. calibrefootball.com/transfers`;

  // Comparables react to whoever is being analysed (position group + fee proximity)
  const comparables = useMemo(
    () => deriveComparables(comparablePool, selectedPlayer, askingPrice),
    [comparablePool, selectedPlayer, askingPrice]
  );

  return (
    <div style={pageStyle}>
      {/* ── SINGLE OUTER GRID: main | right sidebar ── */}
      <div style={{ maxWidth: 1340, margin: '0 auto', padding: '0 24px 32px', display: 'grid', gridTemplateColumns: '1fr 290px', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT COLUMN: hero + tabs ── */}
        <div style={{ minWidth: 0 }}>

          {/* ── HERO ── */}
          <div style={{ background: '#0f0f0f', borderBottom: '1px solid #1c1c1c', padding: '20px 0 18px', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
          {/* Left — headline + search */}
          <div style={{ paddingRight: 0 }}>
            <div style={eyebrowStyle}>Transfer Intelligence · Live Deal Room</div>
            <h1 style={headlineStyle}>Deal or<br />No Deal?</h1>
            <p style={heroSubStyle}>
              Stress-test any transfer fee against Calibre’s independent valuation — rating, position scarcity, league strength, age curve, system fit and risk — then change the asking price and watch the verdict move live.
            </p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <PlayerSearch
                value={playerQuery}
                onChange={setPlayerQuery}
                onSelect={p => {
                  const live = p.rating || calibreRating(p)?.rating || 75;
                  setSelectedPlayer({ ...p, rating: Math.round(live) });
                  setPlayerQuery(p.full_name || p.name);
                  setMarketValue(Math.round(live * 0.65));
                }}
                onEnter={handleAnalyse}
              />
              <TeamSearch
                value={buyerQuery}
                onChange={setBuyerQuery}
                onSelect={t => { setSelectedTeam(t); setBuyerQuery(t.name); }}
              />
              <button style={ctaBtn} onClick={handleAnalyse}>Analyse →</button>
            </div>

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: '#1c1c1c' }}>
              {[
                { label: 'Calibre Estimated Value', value: `€${valuation.estimatedValue}M`, color: '#c8ff00' },
                { label: 'Asking Price', value: `€${askingPrice}M`, color: '#fff' },
                { label: 'Premium vs Calibre', value: `${dealVerdict.premium >= 0 ? '+' : ''}${dealVerdict.premium}%`, color: premiumColor },
              ].map(k => (
                <div key={k.label} style={{ background: '#0a0a0a', padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.15em', color: '#8a8a8a', textTransform: 'uppercase', marginBottom: 5, fontFamily: "'Barlow Condensed', sans-serif" }}>{k.label}</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Asking price adjuster */}
            <div style={{ marginTop: 14, background: '#0f0f0f', border: '1px solid #1c1c1c', padding: '14px 16px' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.12em', color: '#8a8a8a', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 8 }}>Adjust asking price — verdict updates live</div>
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
              <div style={{ marginTop: 10, fontSize: 13, color: '#8a8a8a' }}>
                {selectedTeam ? `Max sensible bid for ${selectedTeam.short || selectedTeam.name}` : 'Max sensible bid'}: <span style={{ color: '#c8ff00', fontWeight: 700 }}>€{fit.clubMaxSensibleBid}M</span>
                <span style={{ marginLeft: 10, color: '#8a8a8a' }}>Fair range €{fit.fitFairRange.low}–{fit.fitFairRange.high}M</span>
              </div>
            </div>
          </div>

          {/* Right — player card + verdict */}
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
                  <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
                    {selectedPlayer?.pos} · Age {selectedPlayer?.age} · {selectedPlayer?.club}
                  </div>
                  <div style={{ fontSize: 11, color: '#8a8a8a', marginTop: 2, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {selectedPlayer?.nationality} · Calibre {selectedPlayer?.rating ? Math.round(selectedPlayer.rating) : '—'}
                  </div>
                </div>
              </div>

              {/* 2×2 metric grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#1c1c1c', marginBottom: 1 }}>
                {[
                  { label: 'Fit-Adjusted Value', value: selectedTeam ? `€${fit.fitAdjustedValue}M` : 'Pick a club', color: '#c8ff00' },
                  { label: 'Max Sensible Bid',   value: `€${fit.clubMaxSensibleBid}M`, color: '#c8ff00' },
                  { label: 'System Fit',         value: systemFitScore != null ? `${systemFitScore}` : '—', color: '#c8ff00' },
                  { label: 'Confidence',         value: `${valuation.confidence}`, color: valuation.confidence >= 70 ? '#c8ff00' : valuation.confidence >= 55 ? '#f59e0b' : '#ef4444' },
                ].map(m => (
                  <div key={m.label} style={{ background: '#0a0a0a', padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, letterSpacing: '0.12em', color: '#8a8a8a', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 800, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Verdict stamp */}
              <VerdictStamp verdict={dealVerdict.label} verdictClass={verdictClass} />
              {dealVerdict.why && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>
                  <span style={{ color: '#c8ff00', fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.1em' }}>Why · </span>{dealVerdict.why}
                </div>
              )}

              {/* Share */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #1c1c1c' }}>
                <ShareBar text={shareText} url={shareUrl('/transfers')} />
              </div>

              {/* PDF Report download — Scout & Club tier feature */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #1c1c1c' }}>
                <DealReport
                  player={selectedPlayer}
                  team={selectedTeam}
                  verdict={verdict}
                  sysFit={sysFit}
                  marketValue={valuation.estimatedValue}
                  askingPrice={askingPrice}
                />
              </div>
            </div>{/* close left hero col */}
            </div>{/* close hero grid */}
          </div>{/* close hero wrap */}

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
            {/* Data source note */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #1c1c1c', background: '#080808', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, letterSpacing: '0.12em', color: '#777', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>
                Value Score — computed · System Fit — model estimate · Risk Profile — model estimate · Full live wiring in V2
              </span>
            </div>

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

                <ScorePanel title="System Fit" score={systemFitScore ?? '—'}>
                  {sysFit ? (
                    <>
                      <MetricBar label="Pressing" value={sysFit.pressing} />
                      <MetricBar label="Transition" value={sysFit.transition} />
                      <MetricBar label="Box threat" value={sysFit.boxThreat} />
                    </>
                  ) : (
                    <p style={{ fontSize: 11, color: '#666', lineHeight: 1.6, margin: 0 }}>
                      Select a buying club above to run the System Fit analysis. Calibre will recalculate based on the team's tactical profile.
                    </p>
                  )}
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
                <div style={tabSectionLabel}>Calibre Value Breakdown</div>
                <p style={{ fontSize: 12.5, color: '#999', lineHeight: 1.6, margin: '0 0 18px', maxWidth: 640 }}>
                  How Calibre builds {selectedPlayer?.full_name || selectedPlayer?.name || 'this player'}&rsquo;s value from the ground up &mdash; each factor&rsquo;s marginal effect in euros, summing to the Calibre Estimated Value. This is the model&rsquo;s own number, not a market quote.
                </p>

                {/* Waterfall */}
                <div style={{ border: '1px solid #1c1c1c', background: '#0a0a0a' }}>
                  {valuation.breakdown.filter(f => !f.stub).map(f => {
                    const isBase = f.name === 'Performance Level';
                    const pos = f.impact > 0, neg = f.impact < 0;
                    const impactColor = isBase ? '#c8ff00' : neg ? '#ef4444' : pos ? '#c8ff00' : '#666';
                    const impactTxt = isBase ? `\u20ac${f.impact}M` : pos ? `+\u20ac${f.impact}M` : neg ? `\u2212\u20ac${Math.abs(f.impact)}M` : '\u2014';
                    return (
                      <div key={f.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '13px 18px', borderBottom: '1px solid #141414' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: '#fff' }}>
                            {isBase ? 'Base \u00b7 ' : ''}{f.name}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#888', marginTop: 2 }}>{f.note}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                          {f.score != null && (
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#777', letterSpacing: '0.04em', minWidth: 46, textAlign: 'right' }}>{f.score}<span style={{ color: '#3a3a3a' }}>/100</span></span>
                          )}
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, color: impactColor, minWidth: 88, textAlign: 'right' }}>{impactTxt}</span>
                        </div>
                      </div>
                    );
                  })}
                  {/* Result */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 18px', background: 'rgba(200,255,0,0.06)', borderTop: '1px solid #c8ff0033' }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8ff00' }}>Calibre Estimated Value</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 800, color: '#c8ff00' }}>&euro;{valuation.estimatedValue}M</div>
                  </div>
                </div>

                {/* Confidence + range strip */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 16, padding: '14px 18px', background: '#0f0f0f', border: '1px solid #1c1c1c' }}>
                  {[
                    { k: 'Confidence', v: `${valuation.confidence}/100` },
                    { k: 'Fair range', v: `\u20ac${valuation.fairRange.low}\u2013${valuation.fairRange.high}M` },
                    { k: 'Max sensible bid', v: `\u20ac${valuation.maxSensibleBid}M` },
                    { k: 'Scarcity', v: `${valuation.scarcity}/100` },
                  ].map(s => (
                    <div key={s.k}>
                      <div style={{ fontSize: 10, color: '#8a8a8a', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 3 }}>{s.k}</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 800, color: '#fff' }}>{s.v}</div>
                    </div>
                  ))}
                </div>

                {valuation.confidenceDrivers && valuation.confidenceDrivers.length > 0 && (
                  <div style={{ marginTop: 12, fontSize: 12, color: '#888', lineHeight: 1.6 }}>
                    <span style={{ color: '#8a8a8a', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.1em', fontFamily: "'Barlow Condensed', sans-serif" }}>Confidence notes &middot; </span>
                    {valuation.confidenceDrivers.map(d => Array.isArray(d) ? `${d[0]}: ${d[1]}` : d).join('  \u00b7  ')}
                  </div>
                )}

                {/* Not-yet-modelled stubs */}
                <div style={{ ...tabSectionLabel, marginTop: 24 }}>Not yet in the model &mdash; shown for transparency</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {valuation.breakdown.filter(f => f.stub).map(f => (
                    <div key={f.name} style={{ border: '1px solid #1c1c1c', background: '#0c0c0c', padding: '8px 12px' }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: '#aaa', fontWeight: 700 }}>{f.name}</span>
                      <span style={{ fontSize: 11, color: '#666', marginLeft: 8 }}>{f.note}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, fontSize: 11, color: '#666', lineHeight: 1.6, maxWidth: 640 }}>
                  The five live factors are applied in order and sum to the Calibre Estimated Value. The items above are disclosed but held neutral until they&rsquo;re calibrated &mdash; Calibre shows what it doesn&rsquo;t yet model rather than inventing it.
                </div>
              </div>
            )}

            {/* SYSTEM FIT */}
            {activeTab === 'System Fit' && (
              <div style={{ padding: 24 }}>
                {!selectedTeam ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>SELECT A BUYING CLUB</div>
                    <p style={{ fontSize: 13, color: '#666', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
                      Type a club name in the search box above and select from the dropdown. Calibre will recalculate System Fit based on the team's real tactical profile — formation, press intensity, line height, and possession style.
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 24 }}>
                      <div style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', padding: '20px 28px', textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 72, fontWeight: 800, color: '#c8ff00', lineHeight: 1 }}>{systemFitScore}</div>
                        <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>System Fit</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
                          {selectedTeam.name} · {selectedTeam.formation} · {selectedTeam.philosophy}
                        </div>
                        <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, margin: '0 0 16px' }}>
                          {selectedPlayer?.full_name || selectedPlayer?.name} {systemFitScore >= 80 ? `fits ${selectedTeam.short}'s ${selectedTeam.philosophy.toLowerCase()} system strongly` : systemFitScore >= 65 ? `is a workable fit for ${selectedTeam.short} but with adjustments needed` : `is a tactical stretch for ${selectedTeam.short}'s ${selectedTeam.philosophy.toLowerCase()}`}. {selectedTeam.intensity} press intensity and {selectedTeam.lineHeight.toLowerCase()} line height shape the demands on every signing.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <MetricBar label="Press match" value={sysFit.pressing} />
                          <MetricBar label="Transition" value={sysFit.transition} />
                          <MetricBar label="Control" value={Math.round((sysFit.traits.control + sysFit.teamTraits.control) / 2)} />
                          <MetricBar label="Width" value={Math.round((sysFit.traits.width + sysFit.teamTraits.width) / 2)} />
                          <MetricBar label="Tempo" value={Math.round((sysFit.traits.tempo + sysFit.teamTraits.tempo) / 2)} />
                        </div>
                      </div>
                    </div>
                    <div style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', padding: 16, borderLeft: `2px solid ${systemFitScore >= 75 ? '#c8ff00' : systemFitScore >= 60 ? '#f59e0b' : '#ef4444'}` }}>
                      <div style={{ fontSize: 10, color: systemFitScore >= 75 ? '#c8ff00' : systemFitScore >= 60 ? '#f59e0b' : '#ef4444', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 6 }}>Fit verdict</div>
                      <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.6 }}>
                        {systemFitScore >= 80
                          ? `Elite fit at ${systemFitScore}/100. ${selectedPlayer?.name} matches ${selectedTeam.short}'s tactical demands closely. The system works — the rest is about price.`
                          : systemFitScore >= 65
                          ? `Workable fit at ${systemFitScore}/100. There are areas where ${selectedPlayer?.name}'s profile diverges from ${selectedTeam.short}'s structure, but a competent coach can manage it.`
                          : `Stretched fit at ${systemFitScore}/100. ${selectedPlayer?.name} would need significant tactical adjustment to thrive in ${selectedTeam.short}'s system. Worth the price only if there's a structural shift coming.`}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* placeholder so old tab block is removed below */}
            {false && (
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
            {activeTab === 'Risk Profile' && (() => {
              const col = c => c === 'lime' ? '#c8ff00' : c === 'amber' ? '#f59e0b' : '#ef4444';
              const age = Number(selectedPlayer?.age);
              const mins = Number.isFinite(Number(selectedPlayer?.minutes)) ? Number(selectedPlayer.minutes)
                : Number.isFinite(Number(selectedPlayer?.appearances)) ? Number(selectedPlayer.appearances) * 90 : null;
              const ageMult = valuation.inputs?.ageMult ?? 1;
              const conf = valuation.confidence;
              const prem = dealVerdict?.premium ?? 0;
              const scar = valuation.scarcity;
              const fitS = (selectedTeam && systemFitScore != null) ? systemFitScore : null;
              const fromLeague = selectedPlayer?.league || selectedPlayer?.competition || null;
              const toLeague = selectedTeam ? (selectedTeam.league || selectedTeam.competition || null) : null;
              const crossLeague = (fromLeague && toLeague) ? String(fromLeague).toLowerCase() !== String(toLeague).toLowerCase() : null;

              const signals = [
                { label: 'Confidence', value: `${conf}/100`, cls: conf >= 70 ? 'lime' : conf >= 55 ? 'amber' : 'red' },
                { label: 'Minutes sample', value: mins == null ? 'Unknown' : `${Math.round(mins)}\u2032`, cls: mins == null ? 'amber' : mins >= 1800 ? 'lime' : mins >= 900 ? 'amber' : 'red' },
                { label: 'Age profile', value: !Number.isFinite(age) ? 'Unknown' : age <= 21 ? `${age} \u00b7 developing` : age <= 27 ? `${age} \u00b7 peak` : age <= 29 ? `${age} \u00b7 late peak` : `${age} \u00b7 decline risk`, cls: !Number.isFinite(age) ? 'amber' : age <= 21 ? 'amber' : age <= 27 ? 'lime' : age <= 29 ? 'amber' : 'red' },
                { label: 'Curve direction', value: ageMult >= 1.05 ? 'Appreciating' : ageMult >= 0.85 ? 'Stable' : 'Depreciating', cls: ageMult >= 1.05 ? 'lime' : ageMult >= 0.85 ? 'amber' : 'red' },
                { label: 'League adaptation', value: !toLeague ? 'Select a club' : crossLeague ? `${fromLeague} \u2192 ${toLeague}` : 'Same league', cls: !toLeague ? 'amber' : crossLeague ? 'amber' : 'lime' },
                { label: 'System fit', value: fitS == null ? 'Select a club' : fitS < 58 ? `${fitS} \u00b7 system risk` : `${fitS}/100`, cls: fitS == null ? 'amber' : fitS < 58 ? 'red' : fitS < 72 ? 'amber' : 'lime' },
                { label: 'Fee pressure', value: `${prem >= 0 ? '+' : ''}${prem}% vs Calibre`, cls: prem <= 0 ? 'lime' : prem <= 30 ? 'amber' : 'red' },
                { label: 'Seller leverage', value: `${scar}/100`, cls: scar >= 65 ? 'red' : scar >= 40 ? 'amber' : 'lime' },
              ];

              const drivers = Array.isArray(valuation.confidenceDrivers) ? valuation.confidenceDrivers : [];
              const dCls = s => /known|strong|calibrated/i.test(s) ? 'lime' : /medium/i.test(s) ? 'amber' : 'red';

              return (
              <div style={{ padding: 24 }}>
                <p style={{ fontSize: 12.5, color: '#999', lineHeight: 1.6, margin: '0 0 18px', maxWidth: 660 }}>
                  Every signal below is computed from Calibre&rsquo;s own inputs &mdash; rating, minutes, age curve, league and system fit. Calibre does not invent injury, contract or agent data it cannot see; those are listed separately as not modelled.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <div style={tabSectionLabel}>Risk &amp; Uncertainty Signals</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {signals.map(r => (
                        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid #1c1c1c' }}>
                          <span style={{ fontSize: 12.5, color: '#999' }}>{r.label}</span>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 800, color: col(r.cls) }}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={tabSectionLabel}>Why confidence is {conf}/100</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
                      {drivers.length === 0 ? (
                        <span style={{ fontSize: 12, color: '#888' }}>All key inputs present.</span>
                      ) : drivers.map((d, i) => {
                        const label = Array.isArray(d) ? d[0] : d;
                        const status = Array.isArray(d) ? d[1] : '';
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: '#999' }}>{label}</span>
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800, color: col(dCls(String(status))) }}>{status}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={tabSectionLabel}>Age Curve &mdash; Peak Projection</div>
                    <AgeCurveChart currentAge={Number.isFinite(age) ? age : 24} />
                    <div style={{ fontSize: 11.5, color: '#888', marginTop: 12, lineHeight: 1.6 }}>
                      {Number.isFinite(age)
                        ? `At ${age}, Calibre applies an age multiplier of \u00d7${ageMult.toFixed(2)} to the valuation. Peak window is 22\u201327.`
                        : 'Age unknown \u2014 the curve shows the model\u2019s generic peak projection (22\u201327).'}
                    </div>
                  </div>
                </div>
                <div style={{ ...tabSectionLabel, marginTop: 24 }}>Not modelled &mdash; Calibre has no data for these</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['Injury history', 'Contract term', 'Agent leverage', 'Disciplinary record'].map(x => (
                    <div key={x} style={{ border: '1px solid #1c1c1c', background: '#0c0c0c', padding: '8px 12px' }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: '#aaa', fontWeight: 700 }}>{x}</span>
                      <span style={{ fontSize: 11, color: '#666', marginLeft: 8 }}>not modelled</span>
                    </div>
                  ))}
                </div>
              </div>
              );
            })()}

            {/* COMPARABLES */}
            {activeTab === 'Comparables' && (
              <div style={{ padding: 24 }}>
                <div style={tabSectionLabel}>Similar transfers — same position group, closest fees</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: '#1c1c1c' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 1fr 1fr', gap: 1, background: '#1c1c1c' }}>
                    {['Player', 'Fee', 'Profile', 'Calibre verdict'].map(h => (
                      <div key={h} style={{ background: '#0a0a0a', padding: '8px 14px', fontSize: 9, letterSpacing: '0.12em', color: '#555', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>{h}</div>
                    ))}
                  </div>
                  {comparables.map(c => (
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

          {/* ── HOW CALIBRE VERDICTS WORK ── */}
          <div style={{ marginTop: 16, background: '#0f0f0f', border: '1px solid #1c1c1c', padding: 20 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.18em', color: '#555', textTransform: 'uppercase', marginBottom: 16 }}>How the verdict engine works</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1, background: '#1c1c1c' }}>
              {[
                { step: '01', title: 'Calibre Estimated Value', desc: 'Derived from the rating, position scarcity, league strength and age curve — an independent valuation, not a market quote.' },
                { step: '02', title: 'Fair range & max bid', desc: 'A defensible band around the estimate, plus the walk-away ceiling — widened by scarcity, narrowed by confidence.' },
                { step: '03', title: 'The asking price', desc: 'What the selling club is quoting. Enter any number and the verdict recalculates instantly.' },
                { step: '04', title: 'The verdict', desc: 'VALUE BUY / FAIR DEAL / NEGOTIATE HARD / WALK AWAY — adjusted for how the player fits the buying club.' },
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
            Calibre Estimated Value, fair ranges and system fit scores are computed independently from Calibre’s rating engine and TheStatsAPI event data — they are not market quotes. Not financial or sporting advice.
          </div>
        </div>

        {/* ── RIGHT ASIDE — Market Pulse + System Fit link ── */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 0, paddingTop: 16 }}>
          {/* Recent transfers — top 4 above Market Pulse */}
          <div style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #1c1c1c' }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}>Recent<br />Transfers</div>
              <span style={{ fontSize: 9, letterSpacing: '0.15em', color: '#555', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>Summer 2026</span>
            </div>
            {recentTransfers.slice(0, 4).map(t => <RecentTransferCard key={t.id} transfer={t} onAnalyse={handleAnalyseRecent} />)}
          </div>

          {/* Market pulse — promoted up the sidebar */}
          <div style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #1c1c1c' }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}>Market<br />Pulse</div>
              <span style={{ fontSize: 9, letterSpacing: '0.15em', color: transfersLoading ? '#444' : '#c8ff00', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>{transfersLoading ? 'Loading…' : 'Live'}</span>
            </div>
            {marketPulse.map(p => (
              <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #1c1c1c' }}>
                <span style={{ fontSize: 11, color: '#666' }}>{p.label}</span>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800, color: p.highlight ? '#c8ff00' : '#fff' }}>{p.value}</span>
              </div>
            ))}
          </div>

          {/* Recent transfers — remaining cards below Market Pulse */}
          {recentTransfers.length > 4 && (
            <div style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #1c1c1c' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}>More<br />Deals</div>
                <span style={{ fontSize: 9, letterSpacing: '0.15em', color: '#555', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>Summer 2026</span>
              </div>
              {recentTransfers.slice(4).map(t => <RecentTransferCard key={t.id} transfer={t} onAnalyse={handleAnalyseRecent} />)}
            </div>
          )}

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
  padding: '28px 24px 24px',
};

const heroInner = {
  maxWidth: 1340,
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
  fontSize: 11,
  letterSpacing: '0.18em',
  color: '#8a8a8a',
  textTransform: 'uppercase',
  marginBottom: 14,
  display: 'block',
};
