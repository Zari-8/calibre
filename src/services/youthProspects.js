// ============================================================
// youthProspects.js  —  read layer for the Youth Radar
// ------------------------------------------------------------
// Fetches the academy prospect directory from youth_prospects.
// Identity + age data only (no performance stats exist at youth
// level), so this powers a DISCOVERY surface, not a ranking.
// ============================================================

import { supabase } from './supabaseClient.js';

let _cache = null;
let _loading = null;

export async function loadYouthProspects() {
  if (_cache) return _cache;
  if (_loading) return _loading;

  _loading = (async () => {
    try {
      // pull in pages (Supabase caps ~1000/req); the table is a few thousand rows
      const all = [];
      let from = 0;
      const PAGE = 1000;
      for (;;) {
        const { data, error } = await supabase
          .from('youth_prospects')
          .select('api_player_id,name,age,birth_date,nationality,position,height_cm,club,youth_league,league_id,season,plays_up_years,photo,logo')
          .order('age', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      _cache = all;
      return all;
    } catch {
      _cache = [];
      return _cache;
    } finally {
      _loading = null;
    }
  })();

  return _loading;
}
