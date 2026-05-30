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

/* ── Calibre logo mark — SVG recreation of the actual brand ── */
function CalibreLogoMark({ size = 36 }) {
  const cx = size / 2, cy = size / 2;
  const r  = size * 0.44;   // arc radius
  const sw = size * 0.13;   // stroke width (thickness of the C arc)
  // Gap at right = 22% of circumference — leaves room for the bars
  const gapAngle = 50; // degrees total gap
  const startDeg = gapAngle / 2;  // from the right, in degrees
  // SVG arc: start from top, go clockwise, leave gap at right
  const toRad = d => (d * Math.PI) / 180;
  // Arc goes from (startDeg) to (360 - startDeg), measured from 3-o'clock
  const arcStart = toRad(-90 + startDeg);
  const arcEnd   = toRad(-90 + 360 - startDeg);
  const x1 = cx + r * Math.cos(arcStart);
  const y1 = cy + r * Math.sin(arcStart);
  const x2 = cx + r * Math.cos(arcEnd);
  const y2 = cy + r * Math.sin(arcEnd);
  const arcPath = `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`;

  // The two horizontal bars in the gap
  const barW  = size * 0.22;
  const barH  = size * 0.065;
  const barX  = cx + r * Math.cos(toRad(-90 + startDeg)) - barW * 0.1;
  const barGap= size * 0.07;

  // Gradient id unique to instance
  const gId = 'cg1';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display:'block', flexShrink:0 }}>
      <defs>
        <linearGradient id={gId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#a8ff00"/>
          <stop offset="50%"  stopColor="#6edc00"/>
          <stop offset="100%" stopColor="#4ab800"/>
        </linearGradient>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        {/* bottom gap: a thin vertical line */}
      </defs>
      {/* C arc */}
      <path
        d={arcPath}
        fill="none"
        stroke={`url(#${gId})`}
        strokeWidth={sw}
        strokeLinecap="round"
        filter="url(#glow)"
      />
      {/* Bottom center vertical split line */}
      <line
        x1={cx} y1={cy + r - sw/2}
        x2={cx} y2={cy + r + sw/2}
        stroke="#4ab800" strokeWidth={size * 0.04}
      />
      {/* Two horizontal bars in the gap (right side) */}
      <rect
        x={cx + r * 0.18} y={cy - barH - barGap/2}
        width={barW} height={barH}
        rx={barH/2} fill={`url(#${gId})`}
        filter="url(#glow)"
      />
      <rect
        x={cx + r * 0.18} y={cy + barGap/2}
        width={barW} height={barH}
        rx={barH/2} fill={`url(#${gId})`}
        filter="url(#glow)"
      />
    </svg>
  );
}

/* ── Wordmark — geometric wide-tracked all-caps with E accent ── */
function CalibreWordmark() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1,
    }}>
      <div style={{
        font: '700 15px/1 "Barlow Condensed"',
        letterSpacing: '.38em',
        textTransform: 'uppercase',
        color: '#fff',
        display: 'flex', alignItems: 'center', gap: 0,
      }}>
        {/* CALIBR */}
        <span>CALIBR</span>
        {/* E with accent bar underneath */}
        <span style={{ position: 'relative', display: 'inline-block' }}>
          E
          <span style={{
            position: 'absolute',
            bottom: -3,
            left: '10%',
            width: '80%',
            height: 2,
            background: '#7ddc00',
            borderRadius: 1,
          }}/>
        </span>
      </div>
      <div style={{
        font: '600 7px/1 "Barlow"',
        letterSpacing: '.3em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,.4)',
      }}>Football Intelligence</div>
    </div>
  );
}

export default function Shell({ children, currentPath }) {
  const showWC = useShowWorldCup();

  return (
    <div className="app-shell">
      <header className="top-nav">

        {/* Brand */}
        <NavLink href="/" style={{ display:'flex', alignItems:'center', gap:10, marginRight:36, flexShrink:0, textDecoration:'none' }}>
          <CalibreLogoMark size={38} />
          <CalibreWordmark />
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
