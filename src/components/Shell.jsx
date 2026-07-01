import { Bell, Menu, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { navItems } from '../data/calibreData.js';
import { WC_CONFIG } from '../data/worldCupData.js';
import NavLink, { navigateTo } from './NavLink.jsx';
import LiveTicker from './LiveTicker.jsx';
import LanguageSelector from './LanguageSelector.jsx';
import DataFlowBar from './DataFlowBar.jsx';
import AuthModal from './AuthModal.jsx';
import useAuth from '../hooks/useAuth.js';
import { signOut } from '../services/supabaseClient.js';
import TermsBanner from './TermsBanner.jsx';
import {
  loadNotifications,
  unreadCount,
  markRead,
  markAllRead,
  dismissNotification,
} from '../services/notifications.js';

function useShowWorldCup() {
  const kick = new Date(WC_CONFIG.kickoff);
  return (kick - new Date()) / 86400000 <= WC_CONFIG.navThreshold;
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Shell({ children, currentPath }) {
  const showWC = useShowWorldCup();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [returnTo, setReturnTo] = useState('');
  const { user, displayName, configured } = useAuth();

  // ── Notifications state ──────────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const notifRef = useRef(null);

  const refreshNotifs = async () => {
    if (!user?.id) { setNotifs([]); setUnread(0); return; }
    const [list, count] = await Promise.all([loadNotifications(user), unreadCount(user)]);
    setNotifs(list);
    setUnread(count);
  };

  // Load on login change, then poll lightly so the badge stays current.
  useEffect(() => {
    refreshNotifs();
    const t = setInterval(refreshNotifs, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const openAuth = (event) => {
      setReturnTo(event.detail?.returnTo || window.location.pathname + window.location.search);
      setAuthOpen(true);
    };
    window.addEventListener('calibre:open-auth', openAuth);
    return () => window.removeEventListener('calibre:open-auth', openAuth);
  }, []);

  const go = (href) => { setMenuOpen(false); setNotifOpen(false); navigateTo(href); };
  const openAuth = () => { setReturnTo(window.location.pathname + window.location.search); setAuthOpen(true); };
  const logout = async () => { await signOut(); setMenuOpen(false); setNotifOpen(false); };

  const onBell = () => {
    if (!user) { openAuth(); return; }
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) refreshNotifs();
  };

  const openNotif = async (n) => {
    if (!n.read) { await markRead(n.id); }
    if (n.link) { go(n.link); } else { refreshNotifs(); }
    setNotifOpen(false);
  };

  const clearOne = async (e, id) => {
    e.stopPropagation();
    await dismissNotification(id);
    refreshNotifs();
  };

  const readAll = async () => { await markAllRead(user); refreshNotifs(); };

  return (
    <div className="app-shell">
      <style>{`
        /* Header alignment: logo hard-left, nav packed left right after it,
           actions grouped tight on the far right. Inlined so it can never
           fail to load regardless of the external stylesheet. */
        .site-header, .site-header__inner { padding-left: 0 !important; margin-left: 0 !important; max-width: none !important; }
        .site-header__inner { display: flex !important; align-items: center !important; justify-content: flex-start !important; gap: 22px; }
        .site-brand { margin-left: 0 !important; padding-left: 0 !important; }
        .site-brand__logo { max-height: 48px; width: auto; margin-left: 0 !important; }
        .site-brand { margin-right: 0 !important; flex: none; }
        .site-nav { display: flex; gap: 15px; margin-right: auto; }
        .site-header__actions { display: flex; align-items: center; gap: 10px; margin-left: auto; }

        /* Notifications bell + dropdown */
        .calibre-bell { position: relative; display: inline-flex; }
        .calibre-bell__badge {
          position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px;
          padding: 0 4px; border-radius: 999px; background: #A6FF00; color: #04120a;
          font-size: 10px; font-weight: 700; line-height: 16px; text-align: center;
          box-sizing: border-box;
        }
        .calibre-notif__backdrop { position: fixed; inset: 0; z-index: 90; }
        .calibre-notif {
          position: absolute; top: calc(100% + 12px); right: 0; z-index: 100;
          width: 340px; max-width: calc(100vw - 24px);
          background: #0b0d0e; border: 1px solid rgba(166,255,0,0.22); border-radius: 10px;
          box-shadow: 0 18px 44px rgba(0,0,0,0.55); overflow: hidden;
        }
        .calibre-notif__head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .calibre-notif__title { font-size: 12px; letter-spacing: 1.4px; text-transform: uppercase; color: #fff; }
        .calibre-notif__readall {
          background: none; border: none; color: #A6FF00; font-size: 11px; letter-spacing: 0.4px;
          cursor: pointer; padding: 0;
        }
        .calibre-notif__list { max-height: 380px; overflow-y: auto; }
        .calibre-notif__item {
          display: flex; gap: 10px; padding: 12px 14px; cursor: pointer;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .calibre-notif__item:hover { background: rgba(166,255,0,0.05); }
        .calibre-notif__dot { width: 7px; height: 7px; border-radius: 50%; margin-top: 6px; flex: none; background: transparent; }
        .calibre-notif__item.is-unread .calibre-notif__dot { background: #A6FF00; }
        .calibre-notif__body { flex: 1; min-width: 0; }
        .calibre-notif__itemtitle { font-size: 13px; color: #fff; margin: 0 0 2px; line-height: 1.35; }
        .calibre-notif__itemtext { font-size: 12px; color: rgba(255,255,255,0.6); margin: 0; line-height: 1.4; }
        .calibre-notif__meta { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px; }
        .calibre-notif__x {
          background: none; border: none; color: rgba(255,255,255,0.35); cursor: pointer;
          font-size: 14px; line-height: 1; padding: 0 0 0 6px; flex: none;
        }
        .calibre-notif__x:hover { color: #fff; }
        .calibre-notif__empty { padding: 26px 18px; text-align: center; }
        .calibre-notif__empty p { margin: 0; }
        .calibre-notif__empty-title { font-size: 13px; color: #fff; }
        .calibre-notif__empty-sub { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 6px; line-height: 1.5; }
      `}</style>
      <header className="site-header">
        <div className="site-header__inner">
          <button className="site-brand" type="button" onClick={() => go('/')} aria-label="Calibre home">
            <img src="/assets/calibre-wordmark.png" alt="Calibre" className="site-brand__logo" />
          </button>

          <nav className="site-nav" aria-label="Primary navigation">
            {navItems.map(item => (
              <NavLink key={item.href} href={item.href} className={`site-nav__link${currentPath === item.href ? ' is-active' : ''}`}>{item.label}</NavLink>
            ))}
            {showWC && <NavLink href="/world-cup" className={`site-nav__link site-nav__link--world-cup${currentPath === '/world-cup' ? ' is-active' : ''}`}>World Cup</NavLink>}
          </nav>

          <div className="site-header__actions">
            <LanguageSelector />
            <button className="site-header__icon" type="button" aria-label="Search players and debates" onClick={() => go('/players')}><Search size={18} /></button>

            <div className="calibre-bell" ref={notifRef}>
              <button
                className="site-header__icon"
                type="button"
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                onClick={onBell}
              >
                <Bell size={18} />
                {unread > 0 && <span className="calibre-bell__badge">{unread > 99 ? '99+' : unread}</span>}
              </button>

              {notifOpen && (
                <>
                  <div className="calibre-notif__backdrop" onClick={() => setNotifOpen(false)} />
                  <div className="calibre-notif" role="menu" aria-label="Notifications">
                    <div className="calibre-notif__head">
                      <span className="calibre-notif__title">Notifications</span>
                      {notifs.some(n => !n.read) && (
                        <button className="calibre-notif__readall" type="button" onClick={readAll}>Mark all read</button>
                      )}
                    </div>

                    {notifs.length === 0 ? (
                      <div className="calibre-notif__empty">
                        <p className="calibre-notif__empty-title">No notifications yet</p>
                        <p className="calibre-notif__empty-sub">Subscription reminders, watchlist alerts and replies will show up here.</p>
                      </div>
                    ) : (
                      <div className="calibre-notif__list">
                        {notifs.map(n => (
                          <div
                            key={n.id}
                            className={`calibre-notif__item${n.read ? '' : ' is-unread'}`}
                            role="menuitem"
                            tabIndex={0}
                            onClick={() => openNotif(n)}
                            onKeyDown={(e) => { if (e.key === 'Enter') openNotif(n); }}
                          >
                            <span className="calibre-notif__dot" />
                            <div className="calibre-notif__body">
                              {n.title && <p className="calibre-notif__itemtitle">{n.title}</p>}
                              {n.body && <p className="calibre-notif__itemtext">{n.body}</p>}
                              <div className="calibre-notif__meta">{timeAgo(n.created_at)}</div>
                            </div>
                            <button
                              className="calibre-notif__x"
                              type="button"
                              aria-label="Dismiss notification"
                              onClick={(e) => clearOne(e, n.id)}
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {user ? (
              <button className="site-header__login" type="button" onClick={logout} title={displayName || 'Signed in'}>Log out</button>
            ) : (
              <button className="site-header__login" type="button" onClick={openAuth}>{configured ? 'Log in' : 'Account setup'}</button>
            )}
            <button className="site-header__cta" type="button" onClick={() => go('/pricing')}>Get World Cup Founder Pass</button>
            <button className="site-header__menu" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>

        {menuOpen && (
          <div className="mobile-nav">
            {navItems.map(item => <button key={item.href} type="button" className="mobile-nav__link" onClick={() => go(item.href)}>{item.label}</button>)}
            {showWC && <button type="button" className="mobile-nav__link" onClick={() => go('/world-cup')}>World Cup</button>}
            {user ? <button type="button" className="mobile-nav__link" onClick={logout}>Log out {displayName}</button> : <button type="button" className="mobile-nav__link" onClick={openAuth}>Log in or create account</button>}
            <button type="button" className="mobile-nav__pass" onClick={() => go('/pricing')}>Get World Cup Founder Pass</button>
          </div>
        )}
      </header>

      <LiveTicker />
      <DataFlowBar />
      <main>{children}</main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <img src="/assets/calibre-wordmark.png" alt="Calibre" className="site-footer__logo" />
          <p>Football intelligence built for the arguments that matter.</p>
          <div className="site-footer__links">
            <button type="button" onClick={() => go('/players')}>Players</button>
            <button type="button" onClick={() => go('/debates')}>Debates</button>
            <button type="button" onClick={() => go('/pricing')}>Pricing</button>
            <button type="button" onClick={() => go('/terms')}>Terms of Service</button>
          </div>
        </div>
      </footer>

      <AuthModal open={authOpen} onClose={()=>setAuthOpen(false)} returnTo={returnTo} />
      <TermsBanner />
    </div>
  );
}
