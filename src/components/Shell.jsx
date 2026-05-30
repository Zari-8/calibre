import { Search, Crown } from 'lucide-react';
import { navItems } from '../data/calibreData.js';
import { WC_CONFIG } from '../data/worldCupData.js';
import NavLink, { navigateTo } from './NavLink.jsx';
import LanguageSelector from './LanguageSelector.jsx';

function useShowWorldCup() {
  const kick = new Date(WC_CONFIG.kickoff);
  return (kick - new Date()) / 86400000 <= WC_CONFIG.navThreshold;
}

export default function Shell({ children, currentPath }) {
  const showWC = useShowWorldCup();

  return (
    <div className="app-shell">
      <header className="top-nav">

        {/* Brand — actual logo PNG, cropped to just the mark+wordmark */}
        <NavLink href="/" style={{
          display: 'flex', alignItems: 'center',
          marginRight: 32, flexShrink: 0, textDecoration: 'none',
        }}>
          <img
            src="/assets/calibre-logo.png"
            alt="Calibre Football Intelligence"
            style={{ height: 32, width: 'auto', objectFit: 'contain' }}
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
          <LanguageSelector />
          <button className="login-btn" type="button">LOG IN</button>
          <button className="founder-btn" type="button" onClick={() => navigateTo('/pricing')}>
            <Crown size={12} />
            GET WORLD CUP FOUNDER PASS
          </button>
        </div>

      </header>
      <main>{children}</main>
    </div>
  );
}
