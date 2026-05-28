'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';

const links = [
  ['Home','/'], ['Talents','/talents'], ['Teams','/teams'], ['Competitions','/competitions'],
  ['Debates','/debates'], ['Rankings','/rankings'], ['Premium','/pricing']
];

type ScoreItem = {
  label: string;
  detail: string;
  status: 'LIVE' | 'FT' | 'SCHEDULED' | 'DEMO';
};

const fallbackScores: ScoreItem[] = [
  { label: 'Bayern', detail: "2 - 1 Dortmund 87'", status: 'DEMO' },
  { label: 'Arsenal', detail: '3 - 0 Newcastle FT', status: 'DEMO' },
  { label: 'Real Madrid', detail: '1 - 1 Barcelona FT', status: 'DEMO' },
  { label: 'Man City vs Tottenham', detail: 'Today 17:30', status: 'DEMO' },
  { label: 'PSG vs Monaco', detail: 'Today 21:00', status: 'DEMO' }
];

export default function Nav() {
  const pathname = usePathname();
  const [scores, setScores] = useState<ScoreItem[]>(fallbackScores);
  const [mode, setMode] = useState('demo');

  useEffect(() => {
    let active = true;

    async function loadScores() {
      try {
        const res = await fetch('/api/live-scores', { cache: 'no-store' });
        const data = await res.json();
        if (active) {
          setScores(data.scores || fallbackScores);
          setMode(data.mode || 'demo');
        }
      } catch {
        if (active) setScores(fallbackScores);
      }
    }

    loadScores();
    const interval = window.setInterval(loadScores, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <header className="site-header">
      <div className="topbar container-wide">
        <Link href="/" className="brand" aria-label="Calibre home">
          <span className="brand-icon"><span /></span>
          <span className="brand-word">CALIBR<span>E</span></span>
        </Link>

        <nav className="main-tabs" aria-label="Main navigation">
          {links.map(([label, href]) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return <Link key={href} href={href} className={active ? 'active' : ''}>{label}</Link>;
          })}
        </nav>

        <div className="nav-actions">
          <Link href="/players" className="searchbox"><Search size={14}/><span>Search players, regions...</span><kbd>⌘K</kbd></Link>
          <select className="language" defaultValue="en" aria-label="Language selector">
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="pt">Português</option>
            <option value="it">Italiano</option>
          </select>
          <Link href="/pricing" className="founder-button">Get World Cup Founder Pass</Link>
          <Link href="/account" className="user-chip">T</Link><ChevronDown size={14} className="muted-icon"/>
        </div>
      </div>
      <div className="ticker">
        <div className="container-wide ticker-inner">
          <span className="ticker-live"><i /> {mode === 'live' ? 'LIVE' : 'DEMO LIVE'}</span>
          {scores.map((item, index) => (
            <span key={`${item.label}-${index}`} className="ticker-item">
              <b />{item.label} <strong>{item.detail}</strong>
            </span>
          ))}
          <Link href="/competitions" className="all-scores">All Live Scores ›</Link>
        </div>
      </div>
    </header>
  );
}
