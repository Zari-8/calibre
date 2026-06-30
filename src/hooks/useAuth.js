import { useEffect, useState } from 'react';
import { getCurrentSession, supabase, supabaseConfigured, ensureProfile } from '../services/supabaseClient.js';

export default function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [username, setUsername] = useState(null);

  useEffect(() => {
    let active = true;
    if (!supabase) { setLoading(false); return undefined; }
    getCurrentSession().then(next => { if (active) { setSession(next); setLoading(false); } });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setLoading(false); });
    return () => { active = false; data?.subscription?.unsubscribe(); };
  }, []);

  // Resolve the public handle whenever the user changes. ensureProfile also
  // back-fills the profile row on first login if sign-up happened with email
  // confirmation on (so the row couldn't be written at sign-up time).
  useEffect(() => {
    let active = true;
    const user = session?.user;
    if (!user?.id) { setUsername(null); return undefined; }
    ensureProfile(user).then(name => { if (active) setUsername(name); });
    return () => { active = false; };
  }, [session?.user?.id]);

  const user = session?.user || null;
  // displayName is what UI should show publicly: the handle, falling back to the
  // local-part of the email only if no username exists yet (your owner account).
  const displayName = username || (user?.email ? user.email.split('@')[0] : null);

  return { session, user, username, displayName, loading, configured:supabaseConfigured };
}
