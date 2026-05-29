import React from 'react';
import Shell from './components/Shell.jsx';
import Home from './pages/Home.jsx';
import Debates from './pages/Debates.jsx';
import Players from './pages/Players.jsx';
import Competitions from './pages/Competitions.jsx';
import Talents from './pages/Talents.jsx';
import SystemFit from './pages/SystemFit.jsx';

const routes = {
  '/': Home,
  '/debates': Debates,
  '/players': Players,
  '/competitions': Competitions,
  '/talents': Talents,
  '/system-fit': SystemFit,
};

function usePathname() {
  const [path, setPath] = React.useState(window.location.pathname);

  React.useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    window.addEventListener('calibre:navigate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('calibre:navigate', onPop);
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
