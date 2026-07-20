import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { navigateTo } from '../components/NavLink.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import ShareBar, { shareUrl } from '../components/Share.jsx';
import DealReport from '../components/DealReport.jsx';
import Dossier from '../components/Dossier.jsx';
import CommissionForm from '../components/CommissionForm.jsx';
import useAuth from '../hooks/useAuth.js';
import { resolveTier, can } from '../services/access.js';
import { searchSupabasePlayers, getSupabasePlayersByApiIds } from '../services/supabasePlayers.js';
import { calibreRating, resolveRating } from '../services/calibreRating.js';
import { supabase, supabaseConfigured } from '../services/supabaseClient.js';
import { SYSTEM_TEAMS, computeSystemFit, scoreRoleFit, scoreFormationFit } from '../data/systemFitData.js';
import { calibreValue, valuationVerdict } from '../services/calibreValue.js';
import { fitAdjustedValue, fitVerdict } from '../services/calibreFitValue.js';

// API-Football league id -> Calibre league name. DB player rows store league_id (a
// number), not a league name, so any value run through the engine must map it first
// or the league multiplier silently falls back to the 0.45 "unknown league" default.
const LEAGUE_ID_TO_NAME = {
  39: 'Premier League', 140: 'La Liga', 135: 'Serie A', 78: 'Bundesliga', 61: 'Ligue 1',
  88: 'Eredivisie', 94: 'Primeira Liga', 71: 'Brasileir\u00e3o S\u00e9rie A', 144: 'Belgian Pro League', 253: 'MLS',
};

// Guard against wrong-id / wrong-name DB matches: the queried player's last-name
// token must appear in the resolved record, otherwise we treat it as unresolved and
// show a neutral placeholder rather than a confidently-wrong face. Accent-folded.
function namesMatch(queryName, row) {
  if (!row) return false;
  const strip = s => String(s || '').toLowerCase().normalize('NFD').split('').filter(ch => { const c = ch.charCodeAt(0); return c < 0x300 || c > 0x36f; }).join('');
  const cand = strip(row.full_name) + ' ' + strip(row.name);
  const tokens = strip(queryName).split(' ').filter(t => t.length >= 3);
  const last = tokens.length ? tokens[tokens.length - 1] : '';
  return last.length >= 3 && cand.indexOf(last) !== -1;
}

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
// computeSystemFit is now imported from systemFitData.js (shared engine), so the
// Transfers page and the System Fit page score the same player x club identically.

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
      from: t.from_club || null,
      to: t.to_club || null,
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
  const selfRating = Number(player?.rating);
  const self = String(player?.name || player?.full_name || '').toLowerCase();
  const others = pool.filter(c => c && c.name && c.name.toLowerCase() !== self);
  const inGroup = others.filter(c => comparableGroup(c.tag || c.position || c.pos) === group);
  const base = inGroup.length >= 3 ? inGroup : others;
  const ranked = [...base].sort((a, b) => {
    if (Number.isFinite(selfRating) && a.rating != null && b.rating != null) {
      return Math.abs(a.rating - selfRating) - Math.abs(b.rating - selfRating);
    }
    if (refFee == null) return (b.fee || 0) - (a.fee || 0);
    return Math.abs((a.fee || 0) - refFee) - Math.abs((b.fee || 0) - refFee);
  });
  return ranked.slice(0, 6);
}

// Player-specific comparables: pull like-rated players in the same position
// group from the DB and value each on the engine, so the tab changes with the
// deal instead of recycling the same handful of transfers.
async function fetchSimilarPlayers(player) {
  if (!supabaseConfigured || !supabase || !player) return null;
  const r = Number(player.rating);
  if (!Number.isFinite(r)) return null;
  const group = comparableGroup(player.position || player.pos || '');
  const selfId = player.apiPlayerId;
  const selfName = String(player.full_name || player.name || '').toLowerCase();
  let data;
  try {
    const res = await supabase
      .from('players').select('*')
      .gte('rating', Math.round(r) - 5).lte('rating', Math.round(r) + 5)
      .not('rating', 'is', null).limit(500);
    if (res.error || !res.data || !res.data.length) return null;
    data = res.data;
  } catch { return null; }

  const seen = new Set();
  const cand = [];
  for (const row of data) {
    const key = row.api_player_id != null ? `a${row.api_player_id}` : `i${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const nm = String(row.full_name || row.name || '').toLowerCase();
    if ((selfId != null && row.api_player_id === selfId) || (nm && nm === selfName)) continue;
    if (comparableGroup(row.pos || row.position || '') !== group) continue;
    cand.push(row);
  }
  cand.sort((a, b) => Math.abs((Number(a.rating) || 0) - r) - Math.abs((Number(b.rating) || 0) - r));

  return cand.slice(0, 8).map(row => {
    let estimate = null;
    try {
      const cv = calibreValue({
        rating: row.rating, age: row.age,
        position: row.pos || row.position,
        league: LEAGUE_ID_TO_NAME[row.league_id],
        minutes: row.minutes ?? (row.appearances ? row.appearances * 80 : undefined),
      });
      estimate = cv.estimatedValue;
    } catch { /* leave null */ }
    const pos = row.pos || row.position || '';
    return {
      name: row.full_name || row.name,
      apiPlayerId: row.api_player_id, resolvedApiId: row.api_player_id,
      rating: row.rating != null ? Math.round(row.rating) : null,
      pos, position: pos, tag: pos,
      image: row.image || row.img || null,
      estimate, fee: estimate != null ? Math.round(estimate) : null,
      resolved: true,
    };
  });
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
  { label: 'Avg fee vs Calibre value', value: '—',    highlight: true },
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
const TABS = ['System Fit', 'Scout Report', 'Financial Context', 'Risk Analysis', 'Market Context'];
const TAB_GATE = { 'Financial Context': 'valuation.breakdown', 'Market Context': 'valuation.comparables' };

// ── Main component ─────────────────────────────────────────────────────────────
export default function Transfers() {
  // ── Editorial spotlight — DB-wired, rotates every 3 days ──
  const [spotlight, setSpotlight] = useState(null);
  const [spotlightLoading, setSpotlightLoading] = useState(true);
  const [recentTransfers, setRecentTransfers] = useState(FALLBACK_TRANSFERS);
  const [marketPulse, setMarketPulse] = useState(FALLBACK_PULSE);
  const [comparablePool, setComparablePool] = useState(FALLBACK_COMPARABLES);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [moreDealsPage, setMoreDealsPage] = useState(0);
  const [showDossier, setShowDossier] = useState(false);
  const [showCommission, setShowCommission] = useState(false);
  const { user } = useAuth();
  const tier = resolveTier(user?.email);
  const canDossier = can(tier, 'valuation.dossier');
  const canBreakdown = can(tier, 'valuation.breakdown');
  const canComparables = can(tier, 'valuation.comparables');

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
  const [activeTab, setActiveTab] = useState('System Fit');
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Safety net, same pattern used on System Fit's card: every place above that
  // sets selectedPlayer (search select, quick-pick spotlight, curated default
  // state) only ever sets `rating` (Season Score) — none of them resolve
  // ability_rating/availability_score. calibreRating.js is explicit that
  // Transfers needs Calibre (ability), not Season Score, for "how good is
  // this player" — a player recovering from injury or out of favour isn't
  // worse at football, just less selected. Without this, valuation below
  // silently used the wrong number for any player where the two diverge.
  useEffect(() => {
    const apiId = selectedPlayer?.apiPlayerId;
    if (!apiId) return;
    let alive = true;
    (async () => {
      try {
        const rows = await getSupabasePlayersByApiIds([apiId]);
        const db = rows && rows[0];
        if (!alive || !db) return;
        const scored = resolveRating(db);
        setSelectedPlayer(prev => {
          if (prev?.apiPlayerId !== apiId) return prev; // selection changed again before this resolved
          const nextAbility = scored.ability ?? prev.ability_rating;
          const nextAvailability = scored.availability ?? prev.availability_score;
          if (prev.ability_rating === nextAbility && prev.availability_score === nextAvailability) return prev;
          return { ...prev, ability_rating: nextAbility, availability_score: nextAvailability };
        });
      } catch { /* keep whatever selectedPlayer already had */ }
    })();
    return () => { alive = false; };
  }, [selectedPlayer?.apiPlayerId]);

  // System Fit recalculates whenever player OR team changes
  const sysFit = selectedTeam ? computeSystemFit(selectedPlayer, selectedTeam) : null;
  const systemFitScore = sysFit ? sysFit.score : null;

  // ── Calibre valuation: base value (Piece 1) → fit-adjusted (Piece 2) → verdict ──
  const valuation = useMemo(() => calibreValue({
    rating: selectedPlayer?.ability_rating ?? selectedPlayer?.rating,
    age: selectedPlayer?.age,
    position: selectedPlayer?.pos || selectedPlayer?.position,
    league: selectedPlayer?.league || selectedPlayer?.competition || LEAGUE_ID_TO_NAME[selectedPlayer?.league_id],
    club: selectedPlayer?.club,
    minutes: selectedPlayer?.minutes ?? (selectedPlayer?.appearances ? selectedPlayer.appearances * 80 : undefined),
    hasContractData: false,
  }), [selectedPlayer]);
  const fit = useMemo(() => fitAdjustedValue(valuation, systemFitScore), [valuation, systemFitScore]);
  const dealVerdict = useMemo(() => fitVerdict(valuation, fit, askingPrice), [valuation, fit, askingPrice]);
  const verdictClass = dealVerdict.tone === 'good' ? 'lime' : dealVerdict.tone === 'bad' ? 'red' : 'amber';
  // Display-only simplification: the engine can return 7 distinct labels
  // (BACK IT / FAIR DEAL / NEGOTIATE HARD / CONDITIONAL DEAL / SYSTEM RISK /
  // PUNT / WALK AWAY) — the underlying calibreFitValue.js logic is untouched,
  // this just collapses the headline stamp to the classic DEAL / NEGOTIATE /
  // WALK AWAY vocabulary using the same real tone the engine already computed.
  // The full reasoning (dealVerdict.why) still reflects the real verdict.
  const verdictDisplay = dealVerdict.tone === 'good' ? 'DEAL' : dealVerdict.tone === 'warn' ? 'NEGOTIATE' : dealVerdict.tone === 'bad' ? 'WALK AWAY' : dealVerdict.label;
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
        const row = rows && rows[0];
        // Guard against a stale/wrong api_player_id on the transfers row
        // silently loading a different (or badly-enriched) player's stats.
        if (row && (!name || namesMatch(name, row))) dbPlayer = row;
      }
      if (!dbPlayer && name) {
        const rows = await searchSupabasePlayers(name, { limit: 1 });
        const row = rows && rows[0];
        if (row && namesMatch(name, row)) dbPlayer = row;
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
  const shareText = `${selectedPlayer?.full_name || selectedPlayer?.name} — ${verdictDisplay}. Calibre values him at €${valuation.estimatedValue}M${selectedTeam ? ` (€${fit.fitAdjustedValue}M to ${selectedTeam.short || selectedTeam.name})` : ''}. calibrefootball.com/transfers`;

  // Comparables react to whoever is being analysed (position group + fee proximity)
  const rankedComparables = useMemo(
    () => deriveComparables(comparablePool, selectedPlayer, askingPrice),
    [comparablePool, selectedPlayer, askingPrice]
  );

  // Refresh the comparables pool from the DB whenever the analysed player changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sims = await fetchSimilarPlayers(selectedPlayer);
      if (!cancelled && sims && sims.length) setComparablePool(sims);
    })();
    return () => { cancelled = true; };
  }, [selectedPlayer?.apiPlayerId, selectedPlayer?.rating, selectedPlayer?.pos, selectedPlayer?.position]);

  // Resolve each comparable against the player DB by name (the fallback apiPlayerIds
  // are unreliable, so name-resolution is the trustworthy key), then run the real
  // value engine on the actual fee. Each name is resolved once and cached; verdicts
  // recompute locally, so dragging the asking price never re-queries the DB.
  const [comparableIntel, setComparableIntel] = useState({});
  const comparableIntelRef = useRef({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabaseConfigured || !supabase || !rankedComparables.length) return;
      const cache = comparableIntelRef.current;
      const need = rankedComparables.filter(c => c.name && c.resolved !== true && !((c.name).toLowerCase() in cache));
      await Promise.all(need.map(async c => {
        const key = c.name.toLowerCase();
        try {
          const rows = await searchSupabasePlayers(c.name, { limit: 1 });
          const row = rows && rows[0];
          cache[key] = (row && namesMatch(c.name, row)) ? row : null;
        } catch { cache[key] = null; }
      }));
      if (cancelled) return;
      const intel = {};
      for (const c of rankedComparables) {
        const key = (c.name || '').toLowerCase();
        const row = cache[key];
        if (!row) { intel[key] = { resolved: false }; continue; }
        let verdict = null, estimate = null;
        if (row.rating != null) {
          try {
            const cv = calibreValue({
              rating: row.rating, age: row.age,
              position: row.pos || row.position || String(c.tag || c.position || '').split('/')[0].trim(),
              league: LEAGUE_ID_TO_NAME[row.league_id] || undefined,
              minutes: row.minutes,
            });
            estimate = cv.estimatedValue;
            verdict = c.fee ? valuationVerdict(cv, c.fee) : null;
          } catch { /* leave verdict null on engine error */ }
        }
        intel[key] = { resolved: true, image: row.image || row.img || null, resolvedApiId: row.apiPlayerId, verdict, estimate };
      }
      if (!cancelled) setComparableIntel(intel);
    })();
    return () => { cancelled = true; };
  }, [rankedComparables]);

  // Recent Transfers rows only trust the transfers table's own api_player_id,
  // which is frequently null/stale — the same class of data gap already
  // diagnosed for valuations. Comparable Deals works around this by resolving
  // each name against the real players table; do the same here so photos
  // (and a trustworthy id for the fuzzy-lookup fallback) actually show.
  const [transferIntel, setTransferIntel] = useState({});
  const transferIntelRef = useRef({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabaseConfigured || !supabase || !recentTransfers.length) return;
      const cache = transferIntelRef.current;
      const need = recentTransfers.filter(t => t.name && !(t.id in cache));
      await Promise.all(need.map(async t => {
        try {
          const rows = await searchSupabasePlayers(t.name, { limit: 1 });
          const row = rows && rows[0];
          cache[t.id] = (row && namesMatch(t.name, row)) ? row : null;
        } catch { cache[t.id] = null; }
      }));
      if (cancelled) return;
      const intel = {};
      for (const t of recentTransfers) {
        const row = cache[t.id];
        intel[t.id] = row
          ? { resolved: true, image: row.image || row.img || null, resolvedApiId: row.apiPlayerId }
          : { resolved: false };
      }
      if (!cancelled) setTransferIntel(intel);
    })();
    return () => { cancelled = true; };
  }, [recentTransfers]);

  const recentTransfersResolved = useMemo(
    () => recentTransfers.map(t => ({ ...t, ...(transferIntel[t.id] || {}) })),
    [recentTransfers, transferIntel]
  );

  const comparables = useMemo(
    () => rankedComparables.map(c => ({ ...c, ...(comparableIntel[(c.name || '').toLowerCase()] || {}) })),
    [rankedComparables, comparableIntel]
  );

  const shirtNumber = selectedPlayer?.shirt_number ?? selectedPlayer?.shirtNumber ?? null;
  const roleFits = useMemo(() => { try { return scoreRoleFit(selectedPlayer); } catch { return []; } }, [selectedPlayer]);
  const formationFits = useMemo(() => { try { return scoreFormationFit(selectedPlayer); } catch { return []; } }, [selectedPlayer]);
  const riskPct = Math.max(4, Math.min(96, Math.round(
    ((dealVerdict.premium ?? 0) > 100 ? 92 : (dealVerdict.premium ?? 0) > 40 ? 68 : (dealVerdict.premium ?? 0) > 0 ? 42 : 22)
    * 0.6 + (100 - valuation.confidence) * 0.4
  )));
  const riskLabel = riskPct >= 70 ? 'High risk' : riskPct >= 45 ? 'Medium risk' : 'Low risk';
  const riskWhy = `Fit score is ${systemFitScore != null ? (systemFitScore >= 75 ? 'strong' : systemFitScore >= 60 ? 'workable' : 'low') : 'unknown'} for this system and the asking price is ${dealVerdict.premium > 40 ? 'high' : dealVerdict.premium > 0 ? 'above estimate' : 'reasonable'}. ${riskPct >= 70 ? 'High risk of overpaying for limited impact.' : riskPct >= 45 ? 'Manageable risk if the fit case is right.' : 'Low risk at this price and fit level.'}`;

  return (
    <div className="tr2">
      <style>{`
        .tr2 { --l:#a6ff00; --muted:#8d929b; --line:rgba(255,255,255,.09); --glass:rgba(9,13,16,.5); position:relative; isolation:isolate; color:#fff; font-family:'Barlow',sans-serif; padding-bottom:40px; background:#050708; }
        .tr2 * { box-sizing:border-box; }
        .tr2-wrap { max-width:1500px; margin:0 auto; padding:22px 24px 0; display:grid; grid-template-columns:1fr 300px; gap:18px; align-items:start; }
        @media(max-width:1080px){ .tr2-wrap { grid-template-columns:1fr; } }
        .tr2-card { border:1px solid var(--line); border-radius:14px; background:var(--glass); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); }
        .tr2-hero { position:relative; overflow:hidden; display:grid; grid-template-columns:1.05fr .95fr; gap:18px; padding:22px; margin-bottom:16px; }
        .tr2-hero::before { content:""; position:absolute; inset:0; z-index:0; background:url("/assets/transfers-bg.png") center 18% / cover no-repeat; }
        .tr2-hero::after { content:""; position:absolute; inset:0; z-index:0; background:linear-gradient(90deg,rgba(6,9,11,.97) 0%,rgba(6,9,11,.90) 40%,rgba(6,9,11,.55) 68%,rgba(6,9,11,.30) 100%); }
        .tr2-hero > * { position:relative; z-index:1; }
        @media(max-width:860px){ .tr2-hero { grid-template-columns:1fr; } .tr2-hero::after { background:linear-gradient(180deg,rgba(6,9,11,.6) 0%,rgba(6,9,11,.95) 55%); } }
        .tr2-eyebrow { color:var(--l); font:700 11px/1 "Barlow",sans-serif; letter-spacing:.16em; text-transform:uppercase; }
        .tr2-h1 { margin:10px 0 12px; font:800 clamp(38px,4.4vw,58px)/.92 "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .tr2-h1 em { font-style:normal; color:var(--l); }
        .tr2-sub { margin:0 0 18px; max-width:520px; color:#c3c9cf; font:500 13.5px/1.6 "Barlow",sans-serif; }
        .tr2-search-row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
        .tr2-cta { background:var(--l); border:none; color:#0a0d05; font:800 12px "Barlow Condensed",sans-serif; letter-spacing:.08em; text-transform:uppercase; padding:11px 18px; border-radius:9px; cursor:pointer; white-space:nowrap; }
        .tr2-kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:var(--line); border:1px solid var(--line); border-radius:10px; overflow:hidden; margin-bottom:12px; }
        .tr2-kpi { background:rgba(6,9,12,.6); padding:12px 14px; }
        .tr2-kpi span { display:block; color:var(--muted); font:700 9.5px/1 "Barlow",sans-serif; letter-spacing:.08em; text-transform:uppercase; margin-bottom:6px; }
        .tr2-kpi b { font:800 24px/1 "Barlow Condensed",sans-serif; }
        .tr2-slider-box { border:1px solid var(--line); border-radius:10px; padding:14px 16px; background:rgba(6,9,12,.4); }
        .tr2-slider-lbl { display:flex; justify-content:space-between; align-items:center; color:var(--muted); font:700 10px "Barlow",sans-serif; letter-spacing:.1em; text-transform:uppercase; margin-bottom:9px; }
        .tr2-slider-lbl button { background:none; border:1px solid var(--line); color:#c9ced4; border-radius:6px; padding:3px 9px; font:700 10px "Barlow Condensed",sans-serif; cursor:pointer; }
        .tr2-slider-row { display:flex; align-items:center; gap:12px; }
        .tr2-slider-row input[type=range] { flex:1; accent-color:var(--l); height:4px; }
        .tr2-price { font:800 22px "Barlow Condensed",sans-serif; color:var(--l); }
        .tr2-slider-scale { display:flex; justify-content:space-between; color:#6f757e; font:600 10px "Barlow",sans-serif; margin-top:6px; }
        .tr2-quickset { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
        .tr2-quickset button { background:none; border:1px solid var(--line); color:#c9ced4; border-radius:7px; padding:6px 10px; font:700 10.5px "Barlow Condensed",sans-serif; letter-spacing:.03em; cursor:pointer; }
        .tr2-player { display:flex; flex-direction:column; gap:14px; padding:20px; }
        .tr2-pid { display:flex; gap:12px; align-items:center; }
        .tr2-pid-photo { width:56px; height:56px; border-radius:10px; overflow:hidden; background:radial-gradient(120% 120% at 50% 0%,#eef2f5,#b3bdc6 92%); flex:none; }
        .tr2-pid-photo img { width:100%; height:100%; object-fit:cover; object-position:top; }
        .tr2-pid h3 { margin:0; font:800 19px/1 "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .tr2-pid-meta { margin-top:5px; color:#a9afb6; font:500 11.5px "Barlow",sans-serif; }
        .tr2-chips { display:flex; gap:6px; flex-wrap:wrap; }
        .tr2-basics { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:12px 0; padding:10px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
        .tr2-basics div span { display:block; color:var(--muted); font:700 9px "Barlow",sans-serif; letter-spacing:.1em; text-transform:uppercase; margin-bottom:4px; }
        .tr2-basics div b { display:block; color:#fff; font:800 18px "Barlow Condensed",sans-serif; }
        .tr2-chip { padding:3px 9px; border:1px solid var(--line); border-radius:6px; color:#c9ced4; font:700 9.5px "Barlow Condensed",sans-serif; letter-spacing:.04em; }
        .tr2-crest { width:32px; height:32px; margin-left:auto; }
        .tr2-crest img { max-width:100%; max-height:100%; object-fit:contain; }
        .tr2-verdict { border-radius:12px; padding:16px; text-align:center; border:1px solid; }
        .tr2-verdict.lime { border-color:rgba(166,255,0,.4); background:rgba(166,255,0,.06); }
        .tr2-verdict.amber { border-color:rgba(232,177,58,.4); background:rgba(232,177,58,.06); }
        .tr2-verdict.red { border-color:rgba(239,68,68,.4); background:rgba(239,68,68,.06); }
        .tr2-verdict-title { font:800 26px/1 "Barlow Condensed",sans-serif; letter-spacing:.02em; }
        .tr2-verdict.lime .tr2-verdict-title { color:var(--l); }
        .tr2-verdict.amber .tr2-verdict-title { color:#e8b13a; }
        .tr2-verdict.red .tr2-verdict-title { color:#ef4444; }
        .tr2-risk-label { color:var(--muted); font:700 10px "Barlow",sans-serif; letter-spacing:.12em; text-transform:uppercase; margin:12px 0 8px; }
        .tr2-risk-track { position:relative; height:8px; border-radius:6px; background:linear-gradient(90deg,#a6ff00,#e8b13a,#ef4444); margin-bottom:8px; }
        .tr2-risk-dot { position:absolute; top:-4px; width:16px; height:16px; border-radius:50%; background:#fff; border:2px solid #0a0d05; transform:translateX(-50%); }
        .tr2-risk-ends { display:flex; justify-content:space-between; color:#6f757e; font:600 9.5px "Barlow",sans-serif; letter-spacing:.06em; text-transform:uppercase; }
        .tr2-risk-why { margin-top:10px; color:#b6bcc3; font:500 12px/1.6 "Barlow",sans-serif; }
        .tr2-actions { display:flex; flex-direction:column; gap:8px; }
        .tr2-actions .btnrow { display:flex; gap:8px; flex-wrap:wrap; }
        .tr2-tabs { display:flex; gap:2px; overflow-x:auto; margin-bottom:0; }
        .tr2-tabs button { flex:none; background:rgba(9,13,16,.5); border:1px solid var(--line); border-bottom:none; color:#8d929b; font:800 11.5px "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; padding:12px 18px; cursor:pointer; border-radius:10px 10px 0 0; white-space:nowrap; }
        .tr2-tabs button.on { background:var(--l); color:#0a0d05; border-color:var(--l); }
        .tr2-tabs button .g { margin-left:6px; font-size:9px; opacity:.8; }
        .tr2-panel { border-radius:0 12px 12px 12px; padding:22px; margin-bottom:16px; }
        .tr2-label { color:var(--muted); font:700 10.5px "Barlow",sans-serif; letter-spacing:.14em; text-transform:uppercase; margin-bottom:14px; display:block; }
        .tr2-role-row { display:flex; align-items:center; gap:12px; padding:9px 0; }
        .tr2-role-row span:first-child { width:170px; flex:none; color:#d8dde2; font:600 12.5px "Barlow",sans-serif; }
        .tr2-role-bar { flex:1; height:8px; border-radius:5px; background:rgba(255,255,255,.07); overflow:hidden; }
        .tr2-role-bar i { display:block; height:100%; border-radius:5px; background:var(--l); }
        .tr2-role-row b { width:44px; text-align:right; flex:none; color:var(--l); font:800 14px "Barlow Condensed",sans-serif; }
        .tr2-pitches { display:flex; gap:16px; flex-wrap:wrap; }
        .tr2-pitch { width:150px; }
        .tr2-pitch svg { width:100%; height:120px; display:block; background:rgba(255,255,255,.03); border-radius:8px; }
        .tr2-pitch-foot { display:flex; justify-content:space-between; margin-top:6px; font:700 11px "Barlow Condensed",sans-serif; color:#c9ced4; }
        .tr2-scout-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px 18px; margin-bottom:18px; }
        .tr2-scout-grid div label { display:block; color:var(--muted); font:700 9.5px "Barlow",sans-serif; letter-spacing:.1em; text-transform:uppercase; margin-bottom:6px; }
        .tr2-scout-grid div b { font:800 22px "Barlow Condensed",sans-serif; color:#fff; }
        .tr2-note { color:#8d929b; font:500 12px/1.6 "Barlow",sans-serif; }
        .tr2-waterfall-row { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px 0; border-bottom:1px solid var(--line); }
        .tr2-waterfall-row .name { font:700 14px "Barlow",sans-serif; color:#fff; }
        .tr2-waterfall-row .desc { color:#8d929b; font:500 11px "Barlow",sans-serif; margin-top:2px; }
        .tr2-waterfall-row .impact { font:800 18px "Barlow Condensed",sans-serif; flex:none; }
        .tr2-result-row { display:flex; align-items:center; justify-content:space-between; padding:14px 0 0; margin-top:6px; }
        .tr2-result-row .rl { color:var(--l); font:800 11px "Barlow",sans-serif; letter-spacing:.1em; text-transform:uppercase; }
        .tr2-result-row .rv { color:var(--l); font:800 28px "Barlow Condensed",sans-serif; }
        .tr2-stub-row { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
        .tr2-stub { border:1px solid var(--line); border-radius:7px; padding:7px 11px; color:#a9afb6; font:600 11.5px "Barlow",sans-serif; }
        .tr2-signal { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--line); }
        .tr2-signal span { color:#a9afb6; font:500 12.5px "Barlow",sans-serif; }
        .tr2-signal b { font:800 14px "Barlow Condensed",sans-serif; }
        .tr2-table { width:100%; border-collapse:collapse; }
        .tr2-table th { text-align:left; padding:8px 12px; color:var(--muted); font:700 9.5px "Barlow",sans-serif; letter-spacing:.08em; text-transform:uppercase; border-bottom:1px solid var(--line); }
        .tr2-table td { padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.05); font:600 13px "Barlow",sans-serif; color:#d8dde2; }
        .tr2-table td.rate { font:800 17px "Barlow Condensed",sans-serif; color:var(--l); }
        .tr2-rail-title { font:800 20px/1 "Barlow Condensed",sans-serif; text-transform:uppercase; }
        .tr2-rail-sub { color:var(--muted); font:600 9px "Barlow",sans-serif; letter-spacing:.1em; text-transform:uppercase; }
        .tr2-rail-row { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--line); cursor:pointer; }
        .tr2-rail-row:last-child { border-bottom:none; }
        .tr2-rail-photo { width:38px; height:38px; border-radius:50%; overflow:hidden; flex:none; background:radial-gradient(120% 120% at 50% 0%,#eef2f5,#b3bdc6 92%); }
        .tr2-rail-photo img { width:100%; height:100%; object-fit:cover; object-position:top center; display:block; }
        .tr2-rail-id { flex:1; min-width:0; }
        .tr2-rail-id strong { display:block; color:#eef1f4; font:700 12.5px "Barlow",sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .tr2-rail-id span { display:block; color:#8d929b; font:500 10.5px "Barlow",sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .tr2-rail-id .tr2-rail-route { margin-top:5px; padding:4px 8px; border-radius:6px; background:rgba(255,255,255,.06); color:#d8dde2; font:700 10.5px "Barlow",sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .tr2-rail-id .tr2-rail-route .arrow { color:var(--l); font-style:normal; }
        .tr2-rail-photo { margin-top:2px; }
        .tr2-rail-side { flex:none; text-align:right; }
        .tr2-rail-side b { display:block; color:var(--l); font:800 14px "Barlow Condensed",sans-serif; }
        .tr2-rail-side button { margin-top:4px; background:none; border:1px solid rgba(166,255,0,.4); color:var(--l); font:700 8.5px "Barlow Condensed",sans-serif; letter-spacing:.06em; text-transform:uppercase; border-radius:5px; padding:2px 8px; cursor:pointer; }
        .tr2-footer { max-width:1500px; margin:8px auto 0; padding:0 24px; }
        .tr2-footer-grid { display:grid; grid-template-columns:repeat(4,1fr) 220px; gap:1px; background:var(--line); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
        @media(max-width:980px){ .tr2-footer-grid { grid-template-columns:1fr 1fr; } }
        .tr2-footer-item { background:rgba(9,13,16,.55); padding:16px; }
        .tr2-footer-item b { display:block; color:var(--l); font:800 12px "Barlow Condensed",sans-serif; letter-spacing:.04em; text-transform:uppercase; margin-bottom:4px; }
        .tr2-footer-item span { color:#8d929b; font:500 11px "Barlow",sans-serif; }
        .tr2-footer-cta { background:rgba(9,13,16,.55); display:flex; align-items:center; justify-content:center; }
        .tr2-footer-cta button { background:var(--l); border:none; color:#0a0d05; font:800 11px "Barlow Condensed",sans-serif; letter-spacing:.08em; text-transform:uppercase; padding:10px 16px; border-radius:8px; cursor:pointer; }
        .tr2-disclaimer { max-width:1500px; margin:14px auto 0; padding:0 24px; color:#5b6168; font:500 10.5px/1.6 "Barlow",sans-serif; }
        .tr2-sf-grid { display:grid; grid-template-columns:200px 1fr 1fr; gap:24px; align-items:start; }
        @media(max-width:900px){ .tr2-sf-grid { grid-template-columns:1fr; } }
        .tr2-sf-col { min-width:0; }
        .tr2-sf-ring-col { text-align:center; }
        .tr2-ring { position:relative; width:118px; height:118px; margin:6px auto 12px; border-radius:50%; background:conic-gradient(var(--l) calc(var(--pct)), rgba(255,255,255,.08) 0); display:grid; place-items:center; }
        .tr2-ring::before { content:""; position:absolute; inset:9px; border-radius:50%; background:#0b0e10; }
        .tr2-ring span { position:relative; font:800 34px "Barlow Condensed",sans-serif; color:#fff; }
        .tr2-sf-verdict { color:var(--l); font:800 13px "Barlow Condensed",sans-serif; letter-spacing:.04em; text-transform:uppercase; margin-bottom:6px; }
      `}</style>

      <div className="tr2-wrap">
        <main style={{ minWidth: 0 }}>

          {/* ── HERO ── */}
          <div className="tr2-card tr2-hero">
            <div>
              <div className="tr2-eyebrow">Transfer Intelligence</div>
              <h1 className="tr2-h1">Deal or<br /><em>No Deal?</em></h1>
              <p className="tr2-sub">We combine independent valuation, system fit, risk and market context to tell you what others miss. Set your asking price and run the verdict.</p>

              <div className="tr2-search-row">
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
                <TeamSearch value={buyerQuery} onChange={setBuyerQuery} onSelect={t => { setSelectedTeam(t); setBuyerQuery(t.name); }} />
                <button className="tr2-cta" onClick={handleAnalyse}>Analyse →</button>
              </div>

              <div className="tr2-slider-box">
                <div className="tr2-slider-lbl">
                  <span>Set your asking price</span>
                  <button onClick={() => setAskingPrice(100)}>Reset</button>
                </div>
                <div className="tr2-slider-row">
                  <span className="tr2-price">€{askingPrice}M</span>
                  <input type="range" min="1" max="300" value={askingPrice} onChange={e => setAskingPrice(Number(e.target.value))} />
                </div>
                <div className="tr2-slider-scale"><span>€1M</span><span>€300M</span></div>
                <div className="tr2-quickset">
                  <button onClick={() => setAskingPrice(Math.round(valuation.estimatedValue))}>Value €{valuation.estimatedValue}M</button>
                  <button onClick={() => setAskingPrice(Math.round(valuation.fairRange.high))}>Fair €{valuation.fairRange.high}M</button>
                  <button onClick={() => setAskingPrice(Math.round(valuation.maxSensibleBid))}>Max €{valuation.maxSensibleBid}M</button>
                </div>
              </div>
            </div>

            <div>
              <div className="tr2-player" style={{ padding: 0 }}>
                <div className="tr2-pid">
                  <div className="tr2-pid-photo"><ApiPlayerImage playerId={selectedPlayer?.apiPlayerId} name={selectedPlayer?.name} fallbackSrc="/assets/players/neutral-player.svg" /></div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3>{selectedPlayer?.full_name || selectedPlayer?.name || 'Select a player'}</h3>
                    <div className="tr2-pid-meta">{selectedPlayer?.pos} · Age {selectedPlayer?.age} · {selectedPlayer?.club}</div>
                  </div>
                  {selectedTeam?.crestUrl && <div className="tr2-crest"><img src={selectedTeam.crestUrl} alt={selectedTeam.name} /></div>}
                </div>
                <div className="tr2-chips">
                  {selectedPlayer?.nationality && <span className="tr2-chip">{selectedPlayer.nationality}</span>}
                  {selectedPlayer?.foot && <span className="tr2-chip">{selectedPlayer.foot} Foot</span>}
                  {shirtNumber != null && <span className="tr2-chip">No. {shirtNumber}</span>}
                  {selectedPlayer?.archetype && <span className="tr2-chip">{selectedPlayer.archetype}</span>}
                </div>
                <div className="tr2-basics">
                  <div><span>Apps</span><b>{selectedPlayer?.appearances ?? '—'}</b></div>
                  <div><span>Goals</span><b>{selectedPlayer?.goals ?? '—'}</b></div>
                  <div><span>Assists</span><b>{selectedPlayer?.assists ?? '—'}</b></div>
                  <div><span>Calibre</span><b style={{ color: 'var(--l)' }}>{(selectedPlayer?.ability_rating ?? selectedPlayer?.rating) ? Math.round(selectedPlayer?.ability_rating ?? selectedPlayer?.rating) : '—'}</b></div>
                </div>
                <div className="tr2-kpis">
                  <div className="tr2-kpi"><span>{selectedTeam ? `Value to ${selectedTeam.short || selectedTeam.name}` : 'Calibre Value'}</span><b style={{ color: 'var(--l)' }}>€{selectedTeam ? fit.fitAdjustedValue : valuation.estimatedValue}M</b></div>
                  <div className="tr2-kpi"><span>Asking Price</span><b>€{askingPrice}M</b></div>
                  <div className="tr2-kpi"><span>Premium</span><b style={{ color: premiumColor }}>{dealVerdict.premium >= 0 ? '+' : ''}{dealVerdict.premium}%</b></div>
                </div>
                {selectedTeam && fit.fitAdjustedValue !== valuation.estimatedValue && (
                  <div className="tr2-note" style={{ marginBottom: 10 }}>Base (club-agnostic) value €{valuation.estimatedValue}M, adjusted to €{fit.fitAdjustedValue}M for {selectedTeam.short || selectedTeam.name}'s system fit ({systemFitScore}/100) — the verdict below is based on this adjusted figure.</div>
                )}
                {dealVerdict.premium > 300 && (
                  <div className="tr2-note" style={{ color: '#e8b13a', marginBottom: 8 }}>⚠ A premium this large usually means the resolved Calibre rating ({selectedPlayer?.ability_rating ?? selectedPlayer?.rating ?? '—'}) looks too low for this player, not that the fee is unreasonable — worth checking the player record.</div>
                )}
                {canBreakdown ? (
                  <div className="tr2-note">Max sensible bid: <b style={{ color: 'var(--l)' }}>€{fit.clubMaxSensibleBid}M</b> · Fair range €{fit.fitFairRange.low}–{fit.fitFairRange.high}M</div>
                ) : (
                  <div className="tr2-note">Max sensible bid & fair range — <span onClick={() => navigateTo('/pricing')} style={{ color: 'var(--l)', cursor: 'pointer', fontWeight: 700 }}>unlock with Pro →</span></div>
                )}
              </div>
            </div>
          </div>

          {/* ── VERDICT + SYSTEM RISK ── */}
          <div className="tr2-card" style={{ padding: 22, marginBottom: 16, display: 'grid', gridTemplateColumns: '220px 1fr', gap: 22, alignItems: 'center', borderLeft: '3px solid transparent' }}>
            <div className={`tr2-verdict ${verdictClass}`}>
              <div style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8d929b', marginBottom: 8 }}>Calibre Verdict</div>
              <div className="tr2-verdict-title">{verdictDisplay}</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 22 }}>
              <div className="tr2-risk-label">System Risk</div>
              <div className="tr2-risk-track"><div className="tr2-risk-dot" style={{ left: `${riskPct}%` }} /></div>
              <div className="tr2-risk-ends"><span>Low risk</span><span>High risk</span></div>
              <p className="tr2-risk-why">{riskWhy}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <DealReport player={selectedPlayer} team={selectedTeam} verdict={verdict} sysFit={sysFit} marketValue={valuation.estimatedValue} askingPrice={askingPrice} />
                <ShareBar text={shareText} url={shareUrl('/transfers')} />
                {canDossier && <button className="tr2-cta" style={{ background: 'transparent', border: '1px solid var(--line)', color: '#c9ced4' }} onClick={() => setShowDossier(true)}>Generate dossier →</button>}
              </div>
            </div>
          </div>

          {/* ── TABS ── */}
          <div className="tr2-tabs">
            {TABS.map(tab => {
              const gate = TAB_GATE[tab];
              const locked = gate && !can(tier, gate);
              return (
                <button key={tab} className={activeTab === tab ? 'on' : ''} onClick={() => setActiveTab(tab)}>
                  {tab}{locked && <span className="g">{gate === 'valuation.comparables' ? 'SCOUT' : 'PRO'}</span>}
                </button>
              );
            })}
          </div>

          <div className="tr2-card tr2-panel">
            {/* SYSTEM FIT — Overall Fit ring · Role Fit Breakdown · Best Fit Formations, side by side, matching the mockup. Role/formation scores are real (scoreRoleFit/scoreFormationFit) and don't need a club selected; the ring is the real team-fit score once one is picked. */}
            {activeTab === 'System Fit' && (
              <>
                <div className="tr2-sf-grid">
                  <div className="tr2-sf-col tr2-sf-ring-col">
                    <span className="tr2-label">Overall System Fit</span>
                    <div className="tr2-ring" style={{ '--pct': `${systemFitScore ?? 0}%` }}>
                      <span>{systemFitScore ?? '—'}</span>
                    </div>
                    {selectedTeam ? (
                      <>
                        <div className="tr2-sf-verdict">{systemFitScore >= 80 ? 'Elite Fit' : systemFitScore >= 65 ? 'Good Fit' : 'Stretched Fit'}</div>
                        <p className="tr2-note">{systemFitScore >= 80 ? `Matches ${selectedTeam.short}'s system closely.` : systemFitScore >= 65 ? `Can work in this system with some adjustments.` : `Would need real tactical adjustment to thrive here.`}</p>
                      </>
                    ) : (
                      <p className="tr2-note">Select a buying club above to run the real team fit.</p>
                    )}
                  </div>

                  <div className="tr2-sf-col">
                    <span className="tr2-label">Role Fit Breakdown</span>
                    {roleFits.map(r => (
                      <div className="tr2-role-row" key={r.role}>
                        <span>{r.role}</span>
                        <div className="tr2-role-bar"><i style={{ width: `${r.score}%` }} /></div>
                        <b>{r.score}/100</b>
                      </div>
                    ))}
                  </div>

                  <div className="tr2-sf-col">
                    <span className="tr2-label">Best Fit Formations</span>
                    <div className="tr2-pitches">
                      {formationFits.map(f => <MiniPitch key={f.formation} formation={f.formation} score={f.score} />)}
                    </div>
                  </div>
                </div>

                {selectedTeam && (
                  <>
                    <span className="tr2-label" style={{ marginTop: 24 }}>{selectedTeam.name} · {selectedTeam.formation} · {selectedTeam.philosophy}</span>
                    <MetricBar label="Press match" value={sysFit.pressing} />
                    <MetricBar label="Transition" value={sysFit.transition} />
                    <MetricBar label="Box threat" value={sysFit.boxThreat} />
                  </>
                )}
              </>
            )}

            {/* SCOUT REPORT — real appearance/output line + the verdict narrative */}
            {activeTab === 'Scout Report' && (() => {
              const mins = Number.isFinite(Number(selectedPlayer?.minutes)) ? Number(selectedPlayer.minutes)
                : Number.isFinite(Number(selectedPlayer?.appearances)) ? Number(selectedPlayer.appearances) * 90 : null;
              const apps = selectedPlayer?.appearances;
              const per90 = (v) => (v != null && mins) ? (Number(v) / mins * 90).toFixed(2) : null;
              return (
                <>
                  <span className="tr2-label">Scout Report — {selectedPlayer?.full_name || selectedPlayer?.name || 'this player'}</span>
                  <div className="tr2-scout-grid">
                    <div><label>Appearances</label><b>{apps ?? '—'}</b></div>
                    <div><label>Goals</label><b>{selectedPlayer?.goals ?? '—'}</b></div>
                    <div><label>Assists</label><b>{selectedPlayer?.assists ?? '—'}</b></div>
                    <div><label>Minutes</label><b>{mins ?? '—'}</b></div>
                    <div><label>Goals / 90</label><b>{per90(selectedPlayer?.goals) ?? '—'}</b></div>
                    <div><label>Assists / 90</label><b>{per90(selectedPlayer?.assists) ?? '—'}</b></div>
                    <div><label>Pass Acc %</label><b>{selectedPlayer?.pass_accuracy ?? '—'}</b></div>
                    <div><label>Calibre</label><b style={{ color: 'var(--l)' }}>{(selectedPlayer?.ability_rating ?? selectedPlayer?.rating) ? Math.round(selectedPlayer?.ability_rating ?? selectedPlayer?.rating) : '—'}</b></div>
                  </div>
                  <p className="tr2-note">{dealVerdict.why}</p>
                </>
              );
            })()}

            {/* FINANCIAL CONTEXT — full Calibre value waterfall */}
            {activeTab === 'Financial Context' && !canBreakdown && (
              <TierLock title="Full valuation breakdown" blurb="Fair-value range, max sensible bid, premium analysis and the drivers behind the verdict." tierLabel="Pro" />
            )}
            {activeTab === 'Financial Context' && canBreakdown && (
              <>
                <span className="tr2-label">Calibre Value Breakdown</span>
                <p className="tr2-note" style={{ marginBottom: 16 }}>How Calibre builds {selectedPlayer?.full_name || selectedPlayer?.name || 'this player'}'s value from the ground up — each factor's marginal effect in euros, summing to the Calibre Estimated Value.</p>
                {valuation.breakdown.filter(f => !f.stub).map(f => {
                  const isBase = f.name === 'Performance Level';
                  const pos = f.impact > 0, neg = f.impact < 0;
                  const impactColor = isBase ? 'var(--l)' : neg ? '#ef4444' : pos ? 'var(--l)' : '#6f757e';
                  const impactTxt = isBase ? `€${f.impact}M` : pos ? `+€${f.impact}M` : neg ? `−€${Math.abs(f.impact)}M` : '—';
                  return (
                    <div className="tr2-waterfall-row" key={f.name}>
                      <div><div className="name">{isBase ? 'Base · ' : ''}{f.name}</div><div className="desc">{f.note}</div></div>
                      <div className="impact" style={{ color: impactColor }}>{impactTxt}</div>
                    </div>
                  );
                })}
                <div className="tr2-result-row"><span className="rl">Calibre Estimated Value</span><span className="rv">€{valuation.estimatedValue}M</span></div>

                <div className="tr2-scout-grid" style={{ marginTop: 22 }}>
                  <div><label>Confidence</label><b>{valuation.confidence}/100</b></div>
                  <div><label>Fair range</label><b>€{valuation.fairRange.low}–{valuation.fairRange.high}M</b></div>
                  <div><label>Max sensible bid</label><b>€{valuation.maxSensibleBid}M</b></div>
                  <div><label>Scarcity</label><b>{valuation.scarcity}/100</b></div>
                </div>

                <span className="tr2-label" style={{ marginTop: 22 }}>Not yet in the model — shown for transparency</span>
                <div className="tr2-stub-row">
                  {valuation.breakdown.filter(f => f.stub).map(f => <div className="tr2-stub" key={f.name}>{f.name} — {f.note}</div>)}
                </div>
              </>
            )}

            {/* RISK ANALYSIS */}
            {activeTab === 'Risk Analysis' && (() => {
              const col = c => c === 'lime' ? 'var(--l)' : c === 'amber' ? '#e8b13a' : '#ef4444';
              const age = Number(selectedPlayer?.age);
              const mins = Number.isFinite(Number(selectedPlayer?.minutes)) ? Number(selectedPlayer.minutes)
                : Number.isFinite(Number(selectedPlayer?.appearances)) ? Number(selectedPlayer.appearances) * 90 : null;
              const ageMult = valuation.inputs?.ageMult ?? 1;
              const conf = valuation.confidence;
              const prem = dealVerdict?.premium ?? 0;
              const scar = valuation.scarcity;
              const fitS = (selectedTeam && systemFitScore != null) ? systemFitScore : null;
              const fromLeague = selectedPlayer?.league || selectedPlayer?.competition || LEAGUE_ID_TO_NAME[selectedPlayer?.league_id] || null;
              const toLeague = selectedTeam ? (selectedTeam.league || selectedTeam.competition || LEAGUE_ID_TO_NAME[selectedTeam.league_id] || null) : null;
              const crossLeague = (fromLeague && toLeague) ? String(fromLeague).toLowerCase() !== String(toLeague).toLowerCase() : null;
              const signals = [
                { label: 'Age risk', value: Number.isFinite(age) ? `×${ageMult.toFixed(2)}` : '—', cls: ageMult >= 0.95 ? 'lime' : ageMult >= 0.8 ? 'amber' : 'red' },
                { label: 'Sample size', value: mins != null ? `${mins} min` : '—', cls: (mins ?? 0) >= 1800 ? 'lime' : (mins ?? 0) >= 900 ? 'amber' : 'red' },
                { label: 'Position scarcity', value: `${scar}/100`, cls: scar >= 65 ? 'red' : scar >= 45 ? 'amber' : 'lime' },
                { label: 'Fee premium', value: `${prem >= 0 ? '+' : ''}${prem}%`, cls: prem > 30 ? 'red' : prem > 0 ? 'amber' : 'lime' },
                { label: 'System fit', value: fitS != null ? `${fitS}/100` : 'No club picked', cls: fitS == null ? 'amber' : fitS >= 75 ? 'lime' : fitS >= 60 ? 'amber' : 'red' },
                { label: 'Cross-league move', value: crossLeague == null ? '—' : crossLeague ? 'Yes' : 'No', cls: crossLeague ? 'amber' : 'lime' },
              ];
              const drivers = Array.isArray(valuation.confidenceDrivers) ? valuation.confidenceDrivers : [];
              const dCls = st => /known|strong|calibrated/i.test(st) ? 'lime' : /medium/i.test(st) ? 'amber' : 'red';
              return (
                <>
                  <p className="tr2-note" style={{ marginBottom: 16 }}>Every signal below is computed from Calibre's own inputs — rating, minutes, age curve, league and system fit. Calibre does not invent injury, contract or agent data it cannot see; those are listed separately as not modelled.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
                    <div>
                      <span className="tr2-label">Risk & Uncertainty Signals</span>
                      {signals.map(r => <div className="tr2-signal" key={r.label}><span>{r.label}</span><b style={{ color: col(r.cls) }}>{r.value}</b></div>)}
                    </div>
                    <div>
                      <span className="tr2-label">Why confidence is {conf}/100</span>
                      {drivers.length === 0 ? <p className="tr2-note">All key inputs present.</p> : drivers.map((d, i) => {
                        const label = Array.isArray(d) ? d[0] : d; const status = Array.isArray(d) ? d[1] : '';
                        return <div className="tr2-signal" key={i}><span>{label}</span><b style={{ color: col(dCls(String(status))) }}>{status}</b></div>;
                      })}
                      <span className="tr2-label" style={{ marginTop: 18 }}>Age Curve — Peak Projection</span>
                      <AgeCurveChart currentAge={Number.isFinite(age) ? age : 24} />
                      <p className="tr2-note" style={{ marginTop: 10 }}>{Number.isFinite(age) ? `At ${age}, Calibre applies an age multiplier of ×${ageMult.toFixed(2)}. Peak window is 22–27.` : 'Age unknown — generic peak projection shown (22–27).'}</p>
                    </div>
                  </div>
                  <span className="tr2-label" style={{ marginTop: 22 }}>Not modelled — Calibre has no data for these</span>
                  <div className="tr2-stub-row">{['Injury history', 'Contract term', 'Agent leverage', 'Disciplinary record'].map(x => <div className="tr2-stub" key={x}>{x} — not modelled</div>)}</div>
                </>
              );
            })()}

            {/* MARKET CONTEXT */}
            {activeTab === 'Market Context' && !canComparables && (
              <TierLock title="Comparable players" blurb="Like-rated players in the same position, valued live by the engine — the market context for this deal." tierLabel="Scout" />
            )}
            {activeTab === 'Market Context' && canComparables && (
              <>
                <span className="tr2-label">Similar players — same position group, comparable rating</span>
                <table className="tr2-table">
                  <thead><tr><th>Player</th><th>Calibre Value</th><th>Profile</th><th>Rating</th></tr></thead>
                  <tbody>
                    {comparables.map(c => (
                      <tr key={c.name}>
                        <td style={{ display: 'flex', alignItems: 'center', gap: 9 }}><ApiPlayerImage preferredSrc={c.image} apiPlayerId={c.resolvedApiId} name={c.name} allowLookup={c.resolved === true} fallbackSrc="/assets/players/neutral-player.svg" style={{ width: 28, height: 28, borderRadius: '50%' }} />{c.name}</td>
                        <td className="rate">{c.fee != null ? `€${c.fee}M` : c.estimate != null ? `€${Math.round(c.estimate)}M` : '—'}</td>
                        <td><span className="tr2-chip">{c.tag}</span></td>
                        <td className="rate" style={{ color: c.rating != null ? (c.rating >= 80 ? 'var(--l)' : c.rating >= 72 ? '#e8b13a' : '#8d929b') : '#5b6168' }}>{c.rating != null ? c.rating : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="tr2-note" style={{ marginTop: 14 }}>Comparables are drawn from the player database — same position group, comparable Calibre rating — and each is valued live by Calibre's engine, so the set changes with the player you analyse.</p>
              </>
            )}
          </div>

          {/* ── EDITORIAL SPOTLIGHT ── */}
          {spotlight && (
            <div className="tr2-card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden', borderLeft: '3px solid var(--l)' }}>
              <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--l)', fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 800 }}>Editorial Pick</span>
                <span style={{ color: '#5b6168', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase' }}>· Rotates every 3 days</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto' }}>
                <div style={{ minHeight: 110 }}><ApiPlayerImage playerId={spotlight.apiPlayerId} name={spotlight.name} fallbackSrc="/assets/players/neutral-player.svg" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} /></div>
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ font: '800 18px "Barlow Condensed",sans-serif', textTransform: 'uppercase' }}>{spotlight.name}</span>
                    <span style={{ color: '#6f757e', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase' }}>{spotlight.pos} · {spotlight.club} → {spotlight.to}</span>
                    {spotlight.rating && <span style={{ marginLeft: 'auto', color: 'var(--l)', font: '800 15px "Barlow Condensed",sans-serif' }}>CR {spotlight.rating}</span>}
                  </div>
                  <p className="tr2-note">{spotlight.context}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, padding: '14px 16px', borderLeft: '1px solid var(--line)' }}>
                  <div style={{ font: '800 18px "Barlow Condensed",sans-serif' }}>€{spotlight.fee}M</div>
                  <button className="tr2-cta" style={{ padding: '7px 11px', fontSize: 10 }} onClick={() => { setSelectedPlayer({ ...spotlight, full_name: spotlight.name, rating: spotlight.rating || 78 }); setPlayerQuery(spotlight.name); setAskingPrice(spotlight.fee || 80); setMarketValue(spotlight.marketValue || 40); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Run analysis →</button>
                </div>
              </div>
            </div>
          )}

          <p className="tr2-note">Calibre Estimated Value, fair ranges and system fit scores are computed independently from Calibre's rating engine and TheStatsAPI event data — they are not market quotes. Not financial or sporting advice.</p>
        </main>

        {/* ── RIGHT RAIL ── */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          <div className="tr2-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
              <div className="tr2-rail-title">Recent<br />Transfers</div>
              <span className="tr2-rail-sub">Summer 2026</span>
            </div>
            {recentTransfersResolved.slice(0, 4).map(t => (
              <div className="tr2-rail-row" key={t.id} onClick={() => handleAnalyseRecent(t)}>
                <div className="tr2-rail-photo"><ApiPlayerImage preferredSrc={t.image} apiPlayerId={t.resolvedApiId || t.apiPlayerId} name={t.name} allowLookup={t.resolved === true} fallbackSrc="/assets/players/neutral-player.svg" /></div>
                <div className="tr2-rail-id">
                  <strong>{t.name}</strong>
                  <span>{t.pos ? `${t.pos} · ` : ''}{t.from} → {t.to}</span>
                </div>
                <div className="tr2-rail-side">
                  <b>{t.fee ? `€${t.fee}M` : 'TBD'}</b>
                  <button type="button" onClick={e => { e.stopPropagation(); handleAnalyseRecent(t); }}>Analyse</button>
                </div>
              </div>
            ))}
          </div>

          <div className="tr2-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
              <div className="tr2-rail-title">Comparable<br />Deals</div>
              <span className="tr2-rail-sub" style={{ color: 'var(--l)' }}>{transfersLoading ? 'Loading…' : 'Live'}</span>
            </div>
            {comparables.slice(0, 5).map(c => (
              <div className="tr2-rail-row" style={{ cursor: 'default', alignItems: 'flex-start' }} key={c.name}>
                <div className="tr2-rail-photo"><ApiPlayerImage preferredSrc={c.image} apiPlayerId={c.resolvedApiId} name={c.name} allowLookup={c.resolved === true} fallbackSrc="/assets/players/neutral-player.svg" /></div>
                <div className="tr2-rail-id">
                  <strong>{c.name}</strong>
                  <span className="tr2-rail-tag">{c.tag}</span>
                  {c.from && c.to && <span className="tr2-rail-route">{c.from} <b className="arrow">→</b> {c.to}</span>}
                </div>
                <div className="tr2-rail-side">
                  <b>{c.fee != null ? `€${c.fee}M` : c.estimate != null ? `€${Math.round(c.estimate)}M` : '—'}</b>
                </div>
              </div>
            ))}
          </div>

          <button className="tr2-card" style={{ padding: 16, cursor: 'pointer', textAlign: 'left', border: 'none', color: '#fff' }} onClick={() => navigateTo('/system-fit')}>
            <div style={{ color: 'var(--l)', fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 6 }}>Also try</div>
            <div style={{ font: '800 15px "Barlow Condensed",sans-serif', textTransform: 'uppercase', marginBottom: 4 }}>System Fit →</div>
            <div style={{ color: '#8d929b', fontSize: 11 }}>Run the full tactical fit for any player × team combination</div>
          </button>
        </aside>
      </div>

      {/* ── FOOTER STRIP ── */}
      <div className="tr2-footer">
        <div className="tr2-footer-grid">
          <div className="tr2-footer-item"><b>Independent Valuation</b><span>Data-driven, not opinion.</span></div>
          <div className="tr2-footer-item"><b>System Fit Engine</b><span>Why he works, or doesn't.</span></div>
          <div className="tr2-footer-item"><b>Risk-First Approach</b><span>Protect your club.</span></div>
          <div className="tr2-footer-item"><b>Market Context</b><span>Make smarter moves.</span></div>
          <div className="tr2-footer-cta">
            <button onClick={() => navigateTo('/pricing')}>Unlock Pro Insights</button>
          </div>
        </div>
      </div>
      <div className="tr2-disclaimer">Deeper reports. Better decisions.</div>

      {showDossier && (
        <Dossier player={selectedPlayer} team={selectedTeam} valuation={valuation} fit={fit} dealVerdict={dealVerdict} verdict={verdict} sysFit={sysFit} comparables={comparables} askingPrice={askingPrice} marketValue={valuation.estimatedValue} recipient={user?.email} onClose={() => setShowDossier(false)} />
      )}
      {showCommission && (
        <CommissionForm player={selectedPlayer} club={selectedTeam} onClose={() => setShowCommission(false)} />
      )}
    </div>
  );
}

const FORMATION_DOTS = {'4-3-3': [[50, 88], [20, 68], [38, 70], [62, 70], [80, 68], [28, 46], [50, 44], [72, 46], [22, 18], [50, 14], [78, 18]], '4-2-3-1': [[50, 88], [20, 68], [38, 70], [62, 70], [80, 68], [36, 50], [64, 50], [22, 26], [50, 22], [78, 26], [50, 10]], '3-4-2-1': [[50, 88], [30, 70], [50, 72], [70, 70], [16, 50], [38, 48], [62, 48], [84, 50], [38, 20], [62, 20], [50, 10]], '4-4-2': [[50, 88], [20, 68], [38, 70], [62, 70], [80, 68], [18, 44], [38, 42], [62, 42], [82, 44], [40, 16], [60, 16]], '3-5-2': [[50, 88], [30, 70], [50, 72], [70, 70], [14, 48], [34, 44], [50, 42], [66, 44], [86, 48], [40, 16], [60, 16]]};

function MiniPitch({ formation, score }) {
  const dots = FORMATION_DOTS[formation] || FORMATION_DOTS['4-3-3'];
  const tone = score >= 75 ? '#a6ff00' : score >= 60 ? '#e8b13a' : '#ef4444';
  return (
    <div className="tr2-pitch">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="4" y="4" width="92" height="92" rx="3" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1" />
        <line x1="4" y1="50" x2="96" y2="50" stroke="rgba(255,255,255,.10)" strokeWidth="1" />
        {dots.map((d, i) => <circle key={i} cx={d[0]} cy={d[1]} r="4" fill={tone} />)}
      </svg>
      <div className="tr2-pitch-foot">
        <span>{formation}</span>
        <b style={{ color: tone }}>{score}</b>
      </div>
    </div>
  );
}

// ── Tier lock panel ─ shown in place of gated tab content ──────────────────
function TierLock({ title, blurb, tierLabel }) {
  return (
    <div style={{ padding: '52px 24px', textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, margin: '0 auto 16px', borderRadius: '50%', border: '1px solid #c8ff00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8ff00" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
      </div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{title}</div>
      <p style={{ color: '#999', fontSize: 14, lineHeight: 1.6, maxWidth: 420, margin: '10px auto 18px' }}>{blurb}</p>
      <button onClick={() => navigateTo('/pricing')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#c8ff00', color: '#0a0a0a', border: 'none', padding: '11px 22px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Unlock with {tierLabel} →</button>
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
