import { supabase, supabaseConfigured } from './supabaseClient.js';

// ─────────────────────────────────────────────────────────────────────────
// EDITORIAL PICKS — single source of truth for the Debates "Editorial picks
// from the football timeline" strip.
//
// HOW THIS RENDERS:
//   loadBangerTweets() reads the Supabase `banger_tweets` table first. If that
//   table has published rows, THOSE win and this array is ignored. The array
//   below only shows when the table is empty.
//
//   The table is filled by publish_banger_tweets.py on the VPS (the X-API
//   cron). While that pipeline is OFF, the table is empty, so EDITORIAL_PICKS
//   below is what the site shows. This is intentional: the section is editorial,
//   not live, until you fund the X tier.
//
// ⚠️  REPLACE THE TWO PLACEHOLDER ROWS BELOW WITH YOUR REAL CURATED LIST.
//     Edit this ONE array — nothing else renders this section.
//
// TO MAKE IT THE CANONICAL DB SOURCE (so every surface/device agrees), also
// seed the table once in the Supabase SQL editor:
//
//   create table if not exists banger_tweets (
//     id uuid default gen_random_uuid() primary key,
//     handle text not null,
//     text text not null,
//     likes text default '0',
//     reposts text default '0',
//     published boolean default true,
//     created_at timestamptz default now()
//   );
//   alter table banger_tweets enable row level security;
//   create policy "public read published" on banger_tweets
//     for select using (published = true);
//
//   insert into banger_tweets (handle, text, likes, reposts) values
//     ('@CalibreFooty', 'YOUR FIRST PICK HERE', '4.8K', '1.1K'),
//     ('@CarlyTalksBall', 'YOUR SECOND PICK HERE', '3.6K', '782');
// ─────────────────────────────────────────────────────────────────────────
const EDITORIAL_PICKS = [
  { handle:'@CalibreFooty',   text:'Goals tell you who finished the move. They do not always tell you who made the game possible.', likes:'4.8K', reposts:'1.1K', placeholder:true },
  { handle:'@CarlyTalksBall', text:'The midfielder who keeps the structure alive will always lose the clip war to the player arriving in the box.', likes:'3.6K', reposts:'782', placeholder:true },
];

const FALLBACK_DEBATES = [
  { slug:'pedri-vs-jude', title:'Pedri vs Bellingham: who owns the midfield?', category:'rate-battle', votes:15100, comments:384, left:'Pedri', right:'Jude Bellingham' },
  { slug:'arsenal-control-vs-chaos', title:'Would Arsenal be better with control or chaos?', category:'hot-potato', votes:8421, comments:205 },
  { slug:'mbappe-vs-haaland', title:'Mbappé vs Haaland: who changes a game faster?', category:'rate-battle', votes:24700, comments:511, left:'Kylian Mbappé', right:'Erling Haaland' },
  { slug:'vini-vs-saka', title:'Vinícius vs Saka: who breaks the structure first?', category:'rate-battle', votes:12200, comments:176, left:'Vinícius Júnior', right:'Bukayo Saka' },
];

const FALLBACK_HOT_POTATOES = [
  { slug:'arsenal-control-vs-chaos', title:'Would Arsenal be better with control or chaos?', yes:52, context:'One profile protects the structure. The other makes the game harder to control.' },
  { slug:'ter-stegen-finished', title:'Is ter Stegen truly finished at the top level?', yes:43, context:'Reputation, injuries and the eye test are pulling in different directions.' },
  { slug:'women-equal-pay', title:'Should women players receive equal international-match pay?', yes:66, context:'A football argument with sporting, commercial and institutional layers.' },
];

function localRead(key, fallback) {
  try { return JSON.parse(window.localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}
function localWrite(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export async function loadDebateFeed() {
  if (supabaseConfigured) {
    const { data, error } = await supabase.from('debates').select('*').eq('published', true).order('votes', { ascending:false }).limit(20);
    if (!error && data?.length) return { rows:data, source:'supabase' };
  }
  return { rows: localRead('calibre:debates', FALLBACK_DEBATES), source:'editorial-snapshot' };
}

export async function loadHotPotatoes() {
  if (supabaseConfigured) {
    const { data, error } = await supabase.from('hot_potatoes').select('*').eq('published', true).order('created_at', { ascending:false }).limit(6);
    if (!error && data?.length) return { rows:data, source:'supabase' };
  }
  return { rows: localRead('calibre:hot-potatoes', FALLBACK_HOT_POTATOES), source:'editorial-snapshot' };
}

// Editorial picks / banger tweets.
//   1. Supabase `banger_tweets` (published) — populated by the VPS X-API cron.
//   2. EDITORIAL_PICKS curated array — shown ONLY when the table is empty.
// The old localStorage layer was a no-op (nothing ever wrote the key) and has
// been removed so there is exactly ONE place this content can come from when
// the pipeline is off: EDITORIAL_PICKS above.
//
// `source` lets the UI badge where the content came from, so an empty table can
// never silently masquerade as live:
//   'supabase'           → real rows (live pipeline or seeded)
//   'editorial-curated'  → your hand-authored EDITORIAL_PICKS
export async function loadBangerTweets() {
  if (supabaseConfigured) {
    const { data, error } = await supabase
      .from('banger_tweets')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending:false })
      .limit(8);
    if (!error && data?.length) return { rows:data, source:'supabase' };
  }
  return { rows: EDITORIAL_PICKS, source:'editorial-curated' };
}

export async function submitDebateNomination({ title, reason, userId, email }) {
  const payload = { title, reason, user_id:userId || null, email:email || null, created_at:new Date().toISOString() };
  if (supabaseConfigured) {
    const { error } = await supabase.from('debate_nominations').insert(payload);
    if (error) throw error;
    return { source:'supabase' };
  }
  const current = localRead('calibre:debate-nominations', []);
  localWrite('calibre:debate-nominations', [payload, ...current]);
  return { source:'browser-beta' };
}

export async function submitForumPost({ threadSlug, body, user }) {
  const payload = { thread_slug:threadSlug, body, user_id:user?.id || null, author_email:user?.email || null, created_at:new Date().toISOString() };
  if (supabaseConfigured && user?.id) {
    const { error } = await supabase.from('forum_posts').insert(payload);
    if (error) throw error;
    return payload;
  }
  const key = `calibre:forum:${threadSlug}`;
  const current = localRead(key, []);
  localWrite(key, [payload, ...current]);
  return payload;
}

export async function loadForumPosts(threadSlug) {
  if (supabaseConfigured) {
    const { data, error } = await supabase.from('forum_posts').select('*').eq('thread_slug', threadSlug).order('created_at', { ascending:false }).limit(60);
    if (!error) return data || [];
  }
  return localRead(`calibre:forum:${threadSlug}`, []);
}

export async function castGoatVote(choice, user) {
  const voteKey = user?.id ? `user:${user.id}` : 'device';
  const localKey = `calibre:goat-vote:${voteKey}`;
  if (localRead(localKey, null)) throw new Error('Your GOAT vote has already been recorded.');
  if (supabaseConfigured && user?.id) {
    const { error } = await supabase.from('goat_votes').insert({ choice, user_id:user.id });
    if (error) throw error;
  }
  localWrite(localKey, choice);
  return choice;
}
