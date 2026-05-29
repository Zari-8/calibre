import { Search, ChevronDown } from 'lucide-react';
import { navItems } from '../data/calibreData.js';
import NavLink from './NavLink.jsx';

export default function Shell({ children, currentPath }) {
  return (
    <div className="app-shell">
      <div className="bg-grid" />
      <header className="top-nav glass-panel">
        <NavLink href="/" className="brand-lockup" active={currentPath === '/'}>
          <img src="/assets/logos/calibre-mark.svg" alt="Calibre mark" />
          <span>CALIBRE</span>
        </NavLink>
        <nav className="nav-center" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} className="nav-item" active={currentPath === item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-actions">
          <label className="search-pill">
            <Search size={15} />
            <input aria-label="Search Calibre" placeholder="Search" />
          </label>
          <button className="language-pill" type="button">English <ChevronDown size={13} /></button>
          <button className="login-btn" type="button">Log in</button>
          <button className="founder-btn" type="button">Get World Cup Founder Pass</button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
