import { Menu, Search, X } from 'lucide-react';
import { useState } from 'react';
import { navItems } from '../data/calibreData.js';
import { WC_CONFIG } from '../data/worldCupData.js';
import NavLink, { navigateTo } from './NavLink.jsx';
import LiveTicker from './LiveTicker.jsx';

function useShowWorldCup() {
  const kick = new Date(WC_CONFIG.kickoff);
  return (kick - new Date()) / 86400000 <= WC_CONFIG.navThreshold;
}

export default function Shell({ children, currentPath }) {
  const showWC = useShowWorldCup();
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (href) => {
    setMenuOpen(false);
    navigateTo(href);
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
            <button className="site-header__icon" type="button" aria-label="Search players and debates">
              <Search size={18} />
            </button>
            <button className="site-header__login" type="button">Log in</button>
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
            <button type="button" className="mobile-nav__pass" onClick={() => go('/pricing')}>Get World Cup Founder Pass</button>
          </div>
        )}
      </header>

      <LiveTicker />
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
    </div>
  );
}
