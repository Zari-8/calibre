import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Calibre Football | Football Intelligence Platform',
  description: 'Football arguments are about to get harder to win.'
};

const links = [
  ['Players','/players'], ['System Fit','/system-fit'], ['Competitions','/competitions'],
  ['Debates','/debates'], ['Talents','/talents'], ['GOAT','/goat'], ['Pricing','/pricing']
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <div className="container nav-inner">
            <Link href="/" className="logo">
              <span className="logo-mark"><Zap size={18}/></span>
              <span>CALIBRE</span>
            </Link>
            <div className="nav-links">
              {links.map(([label,href]) => <Link href={href} key={href}>{label}</Link>)}
              <Link href="/pricing" className="cta">Get World Cup Founder Pass</Link>
            </div>
          </div>
        </nav>
        {children}
        <footer className="footer">
          <div className="container row" style={{justifyContent:'space-between'}}>
            <strong>Calibre Football</strong>
            <span>Who changes the game? Who fits the system? Who are we wrong about?</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
