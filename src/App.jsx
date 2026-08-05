import React from 'react';
import Shell from './components/Shell.jsx';
import Home from './pages/Home.jsx';
import Debates from './pages/Debates.jsx';
import Players from './pages/Players.jsx';
import Competitions from './pages/Competitions.jsx';
import Talents from './pages/Talents.jsx';
import SystemFit from './pages/SystemFit.jsx';
import Pricing from './pages/Pricing.jsx';
import WorldCupOverview from './pages/WorldCupOverview.jsx';
import WorldCupMatches from './pages/WorldCupMatches.jsx';
import WorldCupMatchroom from './pages/WorldCupMatchroom.jsx';
import WorldCupTeams from './pages/WorldCupTeams.jsx';
import WorldCupStats from './pages/WorldCupStats.jsx';
import WorldCupHistory from './pages/WorldCupHistory.jsx';
import Transfers from './pages/Transfers.jsx';
import BetLanding from './pages/BetLanding.jsx';
import Terms from './pages/Terms.jsx';

const routes = {
  '/':             Home,
  '/debates':      Debates,
  '/players':      Players,
  '/competitions': Competitions,
  '/talents':      Talents,
  '/system-fit':   SystemFit,
  '/pricing':      Pricing,
  '/world-cup':    WorldCupOverview,
  '/world-cup/matches':   WorldCupMatches,
  '/world-cup/matchroom': WorldCupMatchroom,
  '/world-cup/teams':             WorldCupTeams,
  // Groups was merged into Teams (group standings now live there) — this
  // route is kept only so old links/bookmarks to /world-cup/groups still
  // land on a real page instead of 404ing.
  '/world-cup/groups':            WorldCupTeams,
  '/world-cup/stats':             WorldCupStats,
  '/world-cup/history':           WorldCupHistory,
  '/transfers':    Transfers,
  '/bet':          BetLanding,
  '/terms':        Terms,
};

function usePathname() {
  const [path, setPath] = React.useState(window.location.pathname + window.location.search);
  React.useEffect(() => {
    const handler = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', handler);
    window.addEventListener('calibre:navigate', handler);
    return () => {
      window.removeEventListener('popstate', handler);
      window.removeEventListener('calibre:navigate', handler);
    };
  }, []);
  return path;
}

export default function App() {
  const locationPath = usePathname();
  const pathname = locationPath.split('?')[0];
  const Page = routes[pathname] || Home;
  return (
    <Shell currentPath={pathname}>
      <Page />
    </Shell>
  );
}
