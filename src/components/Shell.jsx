import { Search, Crown } from 'lucide-react';
import { navItems } from '../data/calibreData.js';
import { WC_CONFIG } from '../data/worldCupData.js';
import NavLink, { navigateTo } from './NavLink.jsx';
import LanguageSelector from './LanguageSelector.jsx';

function useShowWorldCup() {
  const kick = new Date(WC_CONFIG.kickoff);
  const now  = new Date();
  return (kick - now) / 86400000 <= WC_CONFIG.navThreshold;
}

/*
  Logo mark: C-arc with gap on right, two horizontal bars in gap, gradient green.
  All inline — no external deps, no layout side effects.
*/
function LogoMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" style={{display:'block',flexShrink:0}}>
      <defs>
        <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#9dff00"/>
          <stop offset="60%"  stopColor="#66d400"/>
          <stop offset="100%" stopColor="#44aa00"/>
        </linearGradient>
      </defs>
      {/* C arc: circle minus a gap on the right (roughly 60° gap) */}
      <path
        d="M 17 3
           A 14 14 0 1 0 17 31"
        fill="none"
        stroke="url(#lg)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* Bottom split tick */}
      <line x1="17" y1="29" x2="17" y2="34" stroke="#44aa00" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Two horizontal bars in the right gap */}
      <rect x="20" y="13.5" width="10" height="2.8" rx="1.4" fill="url(#lg)"/>
      <rect x="20" y="17.7" width="10" height="2.8" rx="1.4" fill="url(#lg)"/>
    </svg>
  );
}

export default function Shell({ children, currentPath }) {
  const showWC = useShowWorldCup();

  return (
    <div className="app-shell">
      <header className="top-nav">

        {/* Brand — all on one line, no wrapping */}
        <NavLink href="/" style={{
          display:'flex', alignItems:'center', gap:9,
          marginRight:32, flexShrink:0, textDecoration:'none',
          whiteSpace:'nowrap',
        }}>
          <LogoMark />
          <div style={{display:'flex',flexDirection:'column',gap:1}}>
            <span style={{
              font:'800 13px/1 "Barlow Condensed"',
              letterSpacing:'.36em', textTransform:'uppercase',
              color:'#fff', display:'flex', alignItems:'center',
            }}>
              CALIBR<span style={{position:'relative'}}>E<span style={{
                position:'absolute', bottom:-2, left:'5%',
                width:'90%', height:'1.5px',
                background:'#7ddc00', borderRadius:1,
              }}/></span>
            </span>
            <span style={{
              font:'500 7px/1 "Barlow"',
              letterSpacing:'.28em', textTransform:'uppercase',
              color:'rgba(255,255,255,.38)',
            }}>Football Intelligence</span>
          </div>
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
