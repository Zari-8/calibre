import React from 'react';
import Shell from './components/Shell.jsx';
import Home from './pages/Home.jsx';
import Debates from './pages/Debates.jsx';
import Players from './pages/Players.jsx';
import Competitions from './pages/Competitions.jsx';
import Talents from './pages/Talents.jsx';
import SystemFit from './pages/SystemFit.jsx';
import Pricing from './pages/Pricing.jsx';
import WorldCup from './pages/WorldCup.jsx';

const routes = {
  '/':             Home,
  '/debates':      Debates,
  '/players':      Players,
  '/competitions': Competitions,
  '/talents':      Talents,
  '/system-fit':   SystemFit,
  '/pricing':      Pricing,
  '/world-cup':    WorldCup,
};

function usePathname() {
  const [path, setPath] = React.useState(window.location.pathname);
  React.useEffect(() => {
    const handler = () => setPath(window.location.pathname);
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
  const pathname = usePathname();
  const Page = routes[pathname] || Home;
  return (
    <Shell currentPath={pathname}>
      <Page />
    </Shell>
  );
}
