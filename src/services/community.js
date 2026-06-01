import { supabase, supabaseConfigured } from './supabaseClient.js';

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

const FALLBACK_BANGERS = [
  { handle:'@CalibreFooty', text:'Goals tell you who finished the move. They do not always tell you who made the game possible.', likes:'4.8K', reposts:'1.1K' },
  { handle:'@CarlyTalksBall', text:'The midfielder who keeps the structure alive will always lose the clip war to the player arriving in the box.', likes:'3.6K', reposts:'782' },
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

export async function loadBangerTweets() {
  if (supabaseConfigured) {
    const { data, error } = await supabase.from('banger_tweets').select('*').eq('published', true).order('created_at', { ascending:false }).limit(8);
    if (!error && data?.length) return { rows:data, source:'supabase' };
  }
  return { rows: localRead('calibre:banger-tweets', FALLBACK_BANGERS), source:'editorial-snapshot' };
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
