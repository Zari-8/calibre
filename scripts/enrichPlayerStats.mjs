// ─────────────────────────────────────────────────────────────────────────
// Calibre · player-stat enrichment v2  (API-Football Pro → Supabase)
//
// What changed vs v1 and WHY:
//
// 1. LEAGUE-TRUE STATS (fixes the inflation: Kane 64 goals, Neves 6,590 mins).
//    v1 summed EVERY statistics entry for a season — domestic league + UCL +
//    cups — into one row, so a "league" stat was really an all-competitions
//    total. v2 isolates the player's PRIMARY DOMESTIC-LEAGUE line (the entry
//    matching the stored league_id, else the league entry with the most
//    minutes) and aggregates only the entries sharing that league id (so a
//    mid-season transfer within the same league still adds up). Cups and
//    continental competitions no longer leak into the league line.
//
// 2. SEASON LADDER (fewer false "no minutes"). v1 tried SEASON then one
//    fallback. v2 walks SEASON → FALLBACK_SEASON → FALLBACK_SEASON-1 and uses
//    the first season that actually has minutes.
//
// 3. OPTIONAL ID RE-RESOLUTION (RESOLVE_IDS=1). The big "no minutes" list is
//    mostly rows whose stored api_player_id was mis-mapped at import time (a
//    different person with the same name). When the stored id yields nothing
//    across the ladder, v2 can search API-Football by name, pick the best
//    match (name + nationality, must actually have minutes), write the
//    corrected api_player_id back, and enrich from it.
//
// 4. WRITES THE CORRECTED OUTPUT STATS. Because v1 left goals/assists/minutes
//    alone, the inflated values from the original bulk import survived. v2
//    overwrites minutes, appearances, starts, goals, assists from the league
//    line so the rating engine and leaderboards read league-true numbers.
//    Run with DRY_RUN=1 first to preview every change without writing.
//
//   npm i @supabase/supabase-js          (Node 18+ has global fetch)
//   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  API_FOOTBALL_KEY=...  \
//   SEASON=2025 FALLBACK_SEASON=2024 RESOLVE_IDS=1 DRY_RUN=1 \
//   node scripts/enrichPlayerStats.mjs
//
// Use the SERVICE ROLE key (server-side secret), NOT the anon key.
// ─────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

// ── config ────────────────────────────────────────────────────────────────
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY       = process.env.API_FOOTBALL_KEY;

const SEASON          = String(process.env.SEASON || '2025');
const FALLBACK_SEASON = String(process.env.FALLBACK_SEASON || (Number(SEASON) - 1));
const FALLBACK_SEASON2= String(process.env.FALLBACK_SEASON2 || (Number(FALLBACK_SEASON) - 1));
const SEASON_LADDER   = [...new Set([SEASON, FALLBACK_SEASON, FALLBACK_SEASON2])];

const MAX_PLAYERS     = Number(process.env.MAX_PLAYERS || 250);
const REFRESH_DAYS    = Number(process.env.REFRESH_DAYS || 7);
const DELAY_MS        = Number(process.env.DELAY_MS || 250);
const FORCE           = process.env.FORCE === '1';
const NATIONALITY     = process.env.NATIONALITY || null;
const PLAYER_NAMES    = process.env.PLAYER_NAMES || null; // comma-separated names to target, e.g. "Vitinha,Pedri,Raphinha"
const RESOLVE_IDS     = process.env.RESOLVE_IDS === '1';   // re-resolve mis-mapped ids by name
const DRY_RUN         = process.env.DRY_RUN === '1';       // preview only, no writes
const API_HOST        = 'https://v3.football.api-sports.io';

if (!SUPABASE_URL || !SUPABASE_KEY || !API_KEY) {
  console.error('Missing env: need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_FOOTBALL_KEY');
  process.exit(1);
}
if (SEASON_LADDER.some(s => !Number.isFinite(Number(s)))) {
  console.error('SEASON / FALLBACK_SEASON must be numeric API-Football starting years, e.g. 2025 and 2024.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

// strip accents/punctuation for name matching
function normName(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── API-Football ──────────────────────────────────────────────────────────
async function apiGet(path) {
  const res = await fetch(`${API_HOST}/${path}`, { headers: { 'x-apisports-key': API_KEY } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`API HTTP ${res.status}: ${JSON.stringify(json)}`);
  if (json?.errors && Object.keys(json.errors).length) throw new Error('API: ' + JSON.stringify(json.errors));
  return json;
}

async function fetchPlayerStats(apiId, season) {
  const json = await apiGet(`players?id=${apiId}&season=${season}`);
  return json?.response?.[0]?.statistics || [];
}

// Search the profile directory and return candidate {id, name, nationality}.
async function searchProfiles(name) {
  const surname = normName(name).split(' ').pop();
  if (surname.length < 3) return [];
  const json = await apiGet(`players/profiles?search=${encodeURIComponent(surname)}`);
  return (json?.response ?? []).map((row) => {
    const p = row?.player ?? row ?? {};
    return { id: p.id, name: p.name || [p.firstname, p.lastname].filter(Boolean).join(' '), nationality: p.nationality || p.birth?.country || '', age: p.age ?? null };
  }).filter((p) => p.id && p.name);
}

// ── league-true extraction ──────────────────────────────────────────────
// Pick the player's primary domestic-league line and aggregate ONLY entries
// that share that league id (so a same-league mid-season move still totals up,
// but cups / continental comps never inflate the league numbers).
function leagueLine(stats, preferredLeagueId) {
  if (!stats.length) return null;

  const withMins = stats.filter((s) => num(s?.games?.minutes) > 0);
  const pool = withMins.length ? withMins : stats;

  // primary = stored league_id if it has minutes, else the most-minutes entry
  let primary = null;
  if (preferredLeagueId) {
    primary = pool.find((s) => num(s?.league?.id) === num(preferredLeagueId)) || null;
  }
  if (!primary) {
    primary = pool.reduce((best, s) => (num(s?.games?.minutes) > num(best?.games?.minutes) ? s : best), pool[0]);
  }

  const lid = num(primary?.league?.id);
  const lines = pool.filter((s) => num(s?.league?.id) === lid);

  let minutes = 0, apps = 0, starts = 0, passes = 0, key = 0, dribS = 0, dribA = 0;
  let tackles = 0, inter = 0, duelsWon = 0, shots = 0, goals = 0, assists = 0;
  let accSum = 0, accW = 0, ratingSum = 0, ratingW = 0, pos = null, posMin = -1;

  for (const s of lines) {
    const m = num(s?.games?.minutes);
    minutes += m;
    apps    += num(s?.games?.appearences); // API spelling
    starts  += num(s?.games?.lineups);
    passes  += num(s?.passes?.total);
    key     += num(s?.passes?.key);
    dribS   += num(s?.dribbles?.success);
    dribA   += num(s?.dribbles?.attempts);
    tackles += num(s?.tackles?.total);
    inter   += num(s?.tackles?.interceptions);
    duelsWon+= num(s?.duels?.won);
    shots   += num(s?.shots?.total);
    goals   += num(s?.goals?.total);
    assists += num(s?.goals?.assists);

    const accRaw = s?.passes?.accuracy;
    if (accRaw != null && m > 0) {
      const total = num(s?.passes?.total);
      const pct = Number(accRaw) <= 100 ? Number(accRaw) : (total > 0 ? (Number(accRaw) / total) * 100 : null);
      if (pct != null) { accSum += pct * m; accW += m; }
    }
    const r = parseFloat(s?.games?.rating);
    if (Number.isFinite(r) && m > 0) { ratingSum += r * m; ratingW += m; }
    if (m > posMin) { posMin = m; pos = s?.games?.position || pos; }
  }

  return {
    league_id: lid || null,
    league_name: primary?.league?.name || null,
    team_name: primary?.team?.name || null,
    stats_minutes: minutes,
    minutes,
    appearances: apps,
    starts,
    goals,
    assists,
    passes,
    key_passes: key,
    dribbles_success: dribS,
    dribbles_attempts: dribA,
    tackles,
    interceptions: inter,
    duels_won: duelsWon,
    shots,
    pass_accuracy: accW > 0 ? Math.round((accSum / accW) * 10) / 10 : null,
    api_average_rating: ratingW > 0 ? Math.round((ratingSum / ratingW) * 100) / 100 : null,
    position: pos,
  };
}

// Walk the season ladder for one id; return the first season with minutes.
async function enrichById(apiId, preferredLeagueId) {
  let calls = 0;
  for (const season of SEASON_LADDER) {
    calls++;
    const stats = await fetchPlayerStats(apiId, season);
    const line = leagueLine(stats, preferredLeagueId);
    if (line && line.stats_minutes > 0) return { season, line, calls };
    await sleep(DELAY_MS);
  }
  return { season: null, line: null, calls };
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  let select = supabase
    .from('players')
    .select('id, name, api_player_id, league_id, nationality, age, stats_updated_at')
    .not('api_player_id', 'is', null)
    .gt('api_player_id', 0); // skip placeholder/0 ids (API rejects id=0)

  if (NATIONALITY) select = select.ilike('nationality', `%${NATIONALITY}%`);
  if (PLAYER_NAMES) {
    const orClause = PLAYER_NAMES.split(',').map(n => `name.ilike.%${n.trim()}%`).join(',');
    select = select.or(orClause);
  }

  const { data: rows, error } = await select
    .order('stats_updated_at', { ascending: true, nullsFirst: true })
    .limit(MAX_PLAYERS);

  if (error) { console.error('Supabase read failed:', error.message); process.exit(1); }

  const cutoff = Date.now() - REFRESH_DAYS * 86400000;
  let enriched = 0, remapped = 0, skipped = 0, empty = 0, failed = 0, calls = 0;

  if (DRY_RUN) console.log('DRY RUN — no rows will be written.\n');

  for (const row of rows) {
    if (!FORCE && row.stats_updated_at && new Date(row.stats_updated_at).getTime() > cutoff) {
      skipped++;
      continue;
    }

    try {
      let { season, line, calls: c } = await enrichById(row.api_player_id, row.league_id);
      calls += c;
      let usedId = row.api_player_id;
      let didRemap = false;

      // Stored id found nothing across the ladder → try to re-resolve by name.
      // Registry names are abbreviated (e.g. "C. Hughes"), so surname + first
      // initial is all we can match on — far too loose for common surnames on
      // its own. We therefore REQUIRE a nationality match and a close age, or we
      // refuse to remap. Without a stored nationality we don't remap at all.
      if ((!line || line.stats_minutes === 0) && RESOLVE_IDS) {
        if (!normName(row.nationality)) {
          console.log(`· ${row.name}: no minutes; remap skipped (no nationality on record to verify a match)`);
        } else {
          const candidates = await searchProfiles(row.name); calls++;
          const wantNat  = normName(row.nationality);
          const wantTok  = normName(row.name).split(' ');
          const wantSur  = wantTok[wantTok.length - 1];
          const wantInit = (wantTok[0] || '')[0] || '';
          const wantAge  = num(row.age);

          const ranked = candidates
            .filter((cand) => cand.id !== row.api_player_id)
            .map((cand) => {
              const cn = normName(cand.name);
              const ct = cn.split(' ');
              const surOk  = ct[ct.length - 1] === wantSur;
              const initOk = !wantInit || (ct[0] || '')[0] === wantInit;
              const natOk  = normName(cand.nationality) === wantNat;
              const ageDiff = (wantAge && cand.age) ? Math.abs(num(cand.age) - wantAge) : null;
              const ageOk  = ageDiff == null ? true : ageDiff <= 2;
              return { ...cand, surOk, initOk, natOk, ageOk, ageDiff: ageDiff == null ? 99 : ageDiff };
            })
            .filter((cand) => cand.surOk && cand.initOk && cand.natOk && cand.ageOk)
            .sort((a, b) => a.ageDiff - b.ageDiff);

          for (const cand of ranked.slice(0, 2)) {
            const res = await enrichById(cand.id, row.league_id); calls += res.calls;
            if (res.line && res.line.stats_minutes > 0) {
              season = res.season; line = res.line; usedId = cand.id; didRemap = true;
              break;
            }
            await sleep(DELAY_MS);
          }
        }
      }

      if (!season || !line || line.stats_minutes === 0) {
        if (!DRY_RUN) {
          const { error: e } = await supabase.from('players')
            .update({ stats_season: null, stats_updated_at: new Date().toISOString() })
            .eq('id', row.id);
          if (e) throw new Error(e.message);
        }
        empty++;
        console.log(`· ${row.name}: no league minutes in ${SEASON_LADDER.join('/')}${RESOLVE_IDS ? ' (id re-resolve found nothing)' : ''}`);
        await sleep(DELAY_MS);
        continue;
      }

      const update = {
        passes: line.passes,
        pass_accuracy: line.pass_accuracy,
        key_passes: line.key_passes,
        dribbles_success: line.dribbles_success,
        dribbles_attempts: line.dribbles_attempts,
        tackles: line.tackles,
        interceptions: line.interceptions,
        duels_won: line.duels_won,
        shots: line.shots,
        minutes: line.minutes,
        appearances: line.appearances,
        starts: line.starts,
        goals: line.goals,
        assists: line.assists,
        stats_minutes: line.stats_minutes,
        stats_season: season,
        stats_updated_at: new Date().toISOString(),
      };
      if (line.api_average_rating != null) update.api_average_rating = line.api_average_rating;
      if (didRemap) update.api_player_id = usedId;

      if (!DRY_RUN) {
        const { error: e } = await supabase.from('players').update(update).eq('id', row.id);
        if (e) throw new Error(e.message);
      }

      enriched++;
      if (didRemap) remapped++;
      const tag = didRemap ? ` ⟳ remapped→${usedId}` : '';
      console.log(`✓ ${row.name}${tag} · ${season} · ${line.league_name || 'league'} · ${line.stats_minutes}' · ${line.appearances}app · ${line.goals}g ${line.assists}a · ${line.pass_accuracy}%`);
    } catch (e) {
      failed++;
      console.warn(`✗ ${row.name} (${row.api_player_id}): ${e.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone${DRY_RUN ? ' (DRY RUN)' : ''}. enriched=${enriched} remapped=${remapped} skipped=${skipped} no-minutes=${empty} failed=${failed} · api calls=${calls}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
