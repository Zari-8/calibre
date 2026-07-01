import { Menu, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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

function useShowWorldCup() {
  const kick = new Date(WC_CONFIG.kickoff);
  return (kick - new Date()) / 86400000 <= WC_CONFIG.navThreshold;
}

export default function Shell({ children, currentPath }) {
  const showWC = useShowWorldCup();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [returnTo, setReturnTo] = useState('');
  const { user, displayName, configured } = useAuth();

  useEffect(() => {
    const openAuth = (event) => {
      setReturnTo(event.detail?.returnTo || window.location.pathname + window.location.search);
      setAuthOpen(true);
    };
    window.addEventListener('calibre:open-auth', openAuth);
    return () => window.removeEventListener('calibre:open-auth', openAuth);
  }, []);

  const go = (href) => { setMenuOpen(false); navigateTo(href); };
  const openAuth = () => { setReturnTo(window.location.pathname + window.location.search); setAuthOpen(true); };
  const logout = async () => { await signOut(); setMenuOpen(false); };

  return (
    <div className="app-shell">
      <style>{`
        /* Header alignment: logo hard-left, nav packed left right after it,
           actions grouped tight on the far right. Inlined so it can never
           fail to load regardless of the external stylesheet. */
        .site-header__inner { display: flex !important; align-items: center !important; justify-content: flex-start !important; gap: 28px; padding-left: 0 !important; }
        .site-brand { margin-right: 0 !important; flex: none; }
        .site-nav { display: flex; gap: 18px; margin-right: auto; }
        .site-header__actions { display: flex; align-items: center; gap: 10px; margin-left: auto; }
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
