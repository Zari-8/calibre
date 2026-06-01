import { useEffect, useState } from 'react';
import { getCurrentSession, supabase, supabaseConfigured } from '../services/supabaseClient.js';

export default function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    let active = true;
    if (!supabase) { setLoading(false); return undefined; }
    getCurrentSession().then(next => { if (active) { setSession(next); setLoading(false); } });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setLoading(false); });
    return () => { active = false; data?.subscription?.unsubscribe(); };
  }, []);

  return { session, user:session?.user || null, loading, configured:supabaseConfigured };
}
