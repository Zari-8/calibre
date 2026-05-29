import { Search, Crown } from 'lucide-react';
import { navItems } from '../data/calibreData.js';
import { WC_CONFIG } from '../data/worldCupData.js';
import NavLink, { navigateTo } from './NavLink.jsx';
import LanguageSelector from './LanguageSelector.jsx';

function useShowWorldCup() {
  const kick      = new Date(WC_CONFIG.kickoff);
  const now       = new Date();
  const daysToWC  = (kick - now) / 86400000;
  return daysToWC <= WC_CONFIG.navThreshold;
}

export default function Shell({ children, currentPath }) {
  const showWC = useShowWorldCup();

  return (
    <div className="app-shell">
      <header className="top-nav">
        <NavLink href="/" className="brand-lockup" active={currentPath === '/'}>
          <span className="brand-mark">C</span>
          <span className="brand-text"><b>CALIBRE</b><em>Football Intelligence</em></span>
        </NavLink>

        <nav className="nav-center" aria-label="Primary navigation">
          {navItems.map(item => (
            <NavLink key={item.href} href={item.href} className="nav-item" active={currentPath === item.href}>
              {item.label}
            </NavLink>
          ))}
          {showWC && (
            <NavLink href="/world-cup" className="nav-item nav-item--wc" active={currentPath === '/world-cup'}>
              🏆 World Cup
            </NavLink>
          )}
        </nav>

        <div className="nav-actions">
          <button className="icon-btn" type="button" aria-label="Search"><Search size={20} /></button>
          <LanguageSelector />
          <button className="login-btn" type="button">Log in</button>
          <button className="founder-btn" type="button" onClick={() => navigateTo('/pricing')}>
            <Crown size={14} /> Get World Cup Founder Pass
          </button>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
