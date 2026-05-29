import { Search, Crown, Globe } from 'lucide-react';
import { navItems } from '../data/calibreData.js';
import { WC_CONFIG } from '../data/worldCupData.js';
import NavLink, { navigateTo } from './NavLink.jsx';
import LanguageSelector from './LanguageSelector.jsx';

function useShowWorldCup() {
  const kick     = new Date(WC_CONFIG.kickoff);
  const now      = new Date();
  const daysToWC = (kick - now) / 86400000;
  return daysToWC <= WC_CONFIG.navThreshold;
}

export default function Shell({ children, currentPath }) {
  const showWC = useShowWorldCup();

  return (
    <div className="app-shell">
      <header className="top-nav">

        {/* Brand */}
        <NavLink href="/" className="brand-lockup">
          <span className="brand-mark">C</span>
          <span className="brand-text">
            <b>CALIBRE</b>
            <em>Football Intelligence</em>
          </span>
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
            <Search size={18} />
          </button>
          <LanguageSelector />
          <button className="login-btn" type="button">LOG IN</button>
          <button className="founder-btn" type="button" onClick={() => navigateTo('/pricing')}>
            <Crown size={13} />
            GET WORLD CUP FOUNDER PASS
          </button>
        </div>

      </header>
      <main>{children}</main>
    </div>
  );
}
