import { navigateTo } from './NavLink.jsx';

// The tab strip that makes the nine World Cup subpages read as one connected
// product rather than nine separate pages. `active` is the current path's
// last segment (or 'overview' for the bare /world-cup landing page).
const TABS = [
  { key: 'overview',         label: 'Overview',         href: '/world-cup' },
  { key: 'teams',            label: 'Teams',             href: '/world-cup/teams' },
  { key: 'players-to-watch', label: 'Players to Watch',  href: '/world-cup/players-to-watch' },
  { key: 'matches',          label: 'Matches',           href: '/world-cup/matches' },
  { key: 'groups',           label: 'Groups',            href: '/world-cup/groups' },
  { key: 'stats',            label: 'Stats',             href: '/world-cup/stats' },
  { key: 'history',          label: 'History',           href: '/world-cup/history' },
  { key: 'predictor',        label: 'Predictor',         href: '/world-cup/predictor' },
];

export default function WorldCupNav({ active = 'overview' }) {
  return (
    <nav className="wcnav">
      <style>{`
        .wcnav { display:flex; gap:2px; overflow-x:auto; margin-bottom:18px; border-bottom:1px solid #1c1c1c; }
        .wcnav button { flex:none; background:none; border:none; border-bottom:2px solid transparent; color:#888; font:800 12px "Barlow Condensed",sans-serif; letter-spacing:.08em; text-transform:uppercase; padding:12px 16px; cursor:pointer; white-space:nowrap; transition:color .15s,border-color .15s; }
        .wcnav button:hover { color:#ccc; }
        .wcnav button.active { color:#c8ff00; border-bottom-color:#c8ff00; }
      `}</style>
      {TABS.map(t => (
        <button key={t.key} type="button" className={active === t.key ? 'active' : ''} onClick={() => navigateTo(t.href)}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
