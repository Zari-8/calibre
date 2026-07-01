import { supabase, supabaseConfigured } from './supabaseClient.js';

// ─────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS — account-bound alerts (keyed to auth.users id).
//
// Mirrors the community.js / watchlist.js pattern: reads run against Supabase
// only when logged in, and every read swallows errors and returns an EMPTY
// result rather than inventing rows. The bell can therefore never show a fake
// count — an empty table reads as "no notifications yet," which is the truth.
//
// ⚠️  NOTIFICATIONS_READY GATE
//     Until the `notifications` table exists in Supabase, leave this false.
//     While false, every read short-circuits to empty WITHOUT querying, so
//     there is zero console noise (no "relation notifications does not exist").
//     Flip it to true AFTER you have run the table SQL — that single edit
//     switches the bell on. Nothing else changes.
// ─────────────────────────────────────────────────────────────────────────
const NOTIFICATIONS_READY = false;

// Recent notifications for this account, newest first.
export async function loadNotifications(user, limit = 20) {
  if (!NOTIFICATIONS_READY || !supabaseConfigured || !user?.id) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];              // table missing / RLS / offline → empty, never fake
  return data || [];
}

// Unread count for the badge. Returns 0 on any failure.
export async function unreadCount(user) {
  if (!NOTIFICATIONS_READY || !supabaseConfigured || !user?.id) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false);
  if (error) return 0;
  return count || 0;
}

// Mark a single notification read.
export async function markRead(id) {
  if (!NOTIFICATIONS_READY || !supabaseConfigured || !id) return;
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

// Mark every unread notification for this account as read.
export async function markAllRead(user) {
  if (!NOTIFICATIONS_READY || !supabaseConfigured || !user?.id) return;
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false);
}

// Remove a notification the user dismisses.
export async function dismissNotification(id) {
  if (!NOTIFICATIONS_READY || !supabaseConfigured || !id) return;
  await supabase.from('notifications').delete().eq('id', id);
}
