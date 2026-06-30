import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseConfigured = Boolean(url && anonKey);
export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function getCurrentSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

export async function signUpWithEmail(email, password, username) {
  if (!supabase) throw new Error('Supabase is not configured yet. Add the public Supabase URL and anon key in Vercel.');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
      data: username ? { username } : undefined, // stored on auth user metadata as a backup
    },
  });
  if (error) throw error;
  // If sign-up returned a session (email confirmation off), the user exists now,
  // so we can write the profile row immediately. When confirmation is ON, there's
  // no session yet — the profile is written on first successful login instead
  // (ensureProfile), using the username carried in user metadata above.
  if (data?.session?.user && username) {
    await writeProfile(data.session.user.id, username).catch(() => {});
  }
  return data;
}

// Write (or upsert) a profile row for a user.
export async function writeProfile(userId, username) {
  if (!supabase || !userId || !username) return;
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, username }, { onConflict: 'id' });
  if (error && error.code !== '23505') throw error;
}

// Read a user's public handle. Returns the username string or null.
export async function loadProfile(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return data?.username || null;
}

// Is a username free? Case-insensitive. true = available.
export async function isUsernameAvailable(username) {
  if (!supabase || !username) return false;
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle();
  if (error) return true; // fail open; the unique index is the real guard
  return !data;
}

// Ensure a logged-in user has a profile row. Called after login: if they signed
// up while email-confirmation was on, their profile is written here using the
// username saved in auth metadata at sign-up time.
export async function ensureProfile(user) {
  if (!supabase || !user?.id) return null;
  const existing = await loadProfile(user.id);
  if (existing) return existing;
  const metaName = user.user_metadata?.username;
  if (metaName) {
    await writeProfile(user.id, metaName).catch(() => {});
    return metaName;
  }
  return null;
}

export async function signInWithEmail(email, password) {
  if (!supabase) throw new Error('Supabase is not configured yet. Add the public Supabase URL and anon key in Vercel.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
