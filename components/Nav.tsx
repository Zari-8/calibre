'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, ChevronDown } from 'lucide-react';

const links = [
  ['Home','/'], ['Talents','/talents'], ['Teams','/system-fit'], ['Competitions','/competitions'],
  ['Debates','/debates'], ['Rankings','/players'], ['Premium','/pricing']
];

const ticker = [
  ['LIVE',''], ['Bayern','2 - 1 Dortmund 87\''], ['Arsenal','3 - 0 Newcastle FT'],
  ['Real Madrid','1 - 1 Barcelona FT'], ['Man City vs Tottenham','Today 17:30'], ['PSG vs Monaco','Today 21:00']
];

export default function Nav() {
  const pathname = usePathname();
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
          <div className="searchbox"><Search size={14}/><span>Search players, regions...</span><kbd>⌘K</kbd></div>
          <select className="language" defaultValue="en" aria-label="Language selector">
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="pt">Português</option>
            <option value="it">Italiano</option>
          </select>
          <Link href="/pricing" className="founder-button">Get World Cup Founder Pass</Link>
          <span className="user-chip">T</span><ChevronDown size={14} className="muted-icon"/>
        </div>
      </div>
      <div className="ticker">
        <div className="container-wide ticker-inner">
          {ticker.map(([team, score], index) => (
            <span key={`${team}-${index}`} className={index === 0 ? 'ticker-live' : 'ticker-item'}>
              {index === 0 ? <><i /> {team}</> : <><b />{team} <strong>{score}</strong></>}
            </span>
          ))}
          <span className="all-scores">All Live Scores ›</span>
        </div>
      </div>
    </header>
  );
}
