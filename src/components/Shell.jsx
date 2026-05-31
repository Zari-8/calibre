import { Search, Crown } from 'lucide-react';
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

  return (
    <div className="app-shell">
      <header className="top-nav">

        {/* Brand logo — the supplied master artwork is used directly, without recreating the mark in CSS. */}
        <NavLink href="/" className="nav-brand" aria-label="Calibre home">
          <img
            src="/assets/calibre-logo.png"
            alt="Calibre"
            className="nav-brand-logo"
          />
        </NavLink>

        {/* Nav links */}
        <nav className="nav-center">
          {navItems.map(item => (
            <NavLink key={item.href} href={item.href}
              className={`nav-item${currentPath === item.href ? ' active' : ''}`}>
              {item.label}
            </NavLink>
          ))}
          {showWC && (
            <NavLink href="/world-cup"
              className={`nav-item nav-item--wc${currentPath === '/world-cup' ? ' active' : ''}`}>
              🏆 World Cup
            </NavLink>
          )}
        </nav>

        {/* Actions */}
        <div className="nav-actions">
          <button className="icon-btn" type="button" aria-label="Search">
            <Search size={17} />
          </button>
          <button className="login-btn" type="button">LOG IN</button>
          <button className="founder-btn" type="button" onClick={() => navigateTo('/pricing')}>
            <Crown size={12} />
            GET WORLD CUP FOUNDER PASS
          </button>
        </div>

      </header>

      {/* Live scores ticker — always visible below nav */}
      <LiveTicker />

      <main>{children}</main>
    </div>
  );
}
