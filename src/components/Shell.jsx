import { LockKeyhole, Mail, Menu, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { navItems } from '../data/calibreData.js';
import { WC_CONFIG } from '../data/worldCupData.js';
import NavLink, { navigateTo } from './NavLink.jsx';
import LiveTicker from './LiveTicker.jsx';
import LanguageSelector from './LanguageSelector.jsx';
import DataFlowBar from './DataFlowBar.jsx';

function useShowWorldCup() {
  const kick = new Date(WC_CONFIG.kickoff);
  return (kick - new Date()) / 86400000 <= WC_CONFIG.navThreshold;
}

export default function Shell({ children, currentPath }) {
  const showWC = useShowWorldCup();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [returnTo, setReturnTo] = useState('');
  const [email, setEmail] = useState('');
  const [account, setAccount] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('calibre:user')) || null; }
    catch { return null; }
  });

  useEffect(() => {
    const openAuth = (event) => {
      setReturnTo(event.detail?.returnTo || '');
      setAuthOpen(true);
    };
    window.addEventListener('calibre:open-auth', openAuth);
    return () => window.removeEventListener('calibre:open-auth', openAuth);
  }, []);

  useEffect(() => {
    if (!authOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setAuthOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [authOpen]);

  const go = (href) => {
    setMenuOpen(false);
    navigateTo(href);
  };

  const openAuth = () => {
    setReturnTo('');
    setAuthOpen(true);
  };

  const completeAccountAccess = (event) => {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) return;
    const nextAccount = { email: cleanEmail, createdAt: new Date().toISOString() };
    window.localStorage.setItem('calibre:user', JSON.stringify(nextAccount));
    setAccount(nextAccount);
    setAuthOpen(false);
    if (returnTo) navigateTo(returnTo);
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <button className="site-brand" type="button" onClick={() => go('/')} aria-label="Calibre home">
            <img src="/assets/calibre-wordmark.png" alt="Calibre" className="site-brand__logo" />
          </button>

          <nav className="site-nav" aria-label="Primary navigation">
            {navItems.map(item => (
              <NavLink
                key={item.href}
                href={item.href}
                className={`site-nav__link${currentPath === item.href ? ' is-active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
            {showWC && (
              <NavLink
                href="/world-cup"
                className={`site-nav__link site-nav__link--world-cup${currentPath === '/world-cup' ? ' is-active' : ''}`}
              >
                World Cup
              </NavLink>
            )}
          </nav>

          <div className="site-header__actions">
            <LanguageSelector />
            <button className="site-header__icon" type="button" aria-label="Search players and debates">
              <Search size={18} />
            </button>
            <button className="site-header__login" type="button" onClick={openAuth}>{account ? 'Account' : 'Log in'}</button>
            <button className="site-header__cta" type="button" onClick={() => go('/pricing')}>
              Get World Cup Founder Pass
            </button>
            <button
              className="site-header__menu"
              type="button"
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              onClick={() => setMenuOpen(v => !v)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="mobile-nav">
            {navItems.map(item => (
              <button key={item.href} type="button" className="mobile-nav__link" onClick={() => go(item.href)}>
                {item.label}
              </button>
            ))}
            {showWC && <button type="button" className="mobile-nav__link" onClick={() => go('/world-cup')}>World Cup</button>}
            <button type="button" className="mobile-nav__link" onClick={openAuth}>{account ? 'Account' : 'Log in or create account'}</button>
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
          </div>
        </div>
      </footer>

      {authOpen && (
        <div className="account-access-modal" role="presentation" onMouseDown={() => setAuthOpen(false)}>
          <section className="account-access-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="account-access-title" onMouseDown={event => event.stopPropagation()}>
            <button type="button" className="account-access-modal__close" aria-label="Close account access" onClick={() => setAuthOpen(false)}><X size={18}/></button>
            <span className="account-access-modal__kicker"><LockKeyhole size={14}/>Calibre account</span>
            <h2 id="account-access-title">Join the argument.</h2>
            <p>Use your account to post in rate-battle forums, follow debates and keep your ratings attached to your profile.</p>
            <form onSubmit={completeAccountAccess}>
              <label htmlFor="calibre-account-email">Email address</label>
              <div className="account-access-modal__field"><Mail size={16}/><input id="calibre-account-email" value={email} onChange={event=>setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" required /></div>
              <button type="submit" className="button button--primary">Continue with email</button>
            </form>
            <small>Frontend account handoff is active in this prototype. Connect the production auth provider before launch.</small>
          </section>
        </div>
      )}
    </div>
  );
}
