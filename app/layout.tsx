import './globals.css';
import type { Metadata } from 'next';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'Calibre Football | The Player Rating Standard',
  description: 'Rate every footballer on earth. 20 archetypes. Endless debate.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
        <footer className="footer container-wide">
          <strong>CALIBRE</strong>
          <span>The player rating standard. Built for debate, system fit and World Cup intelligence.</span>
        </footer>
      </body>
    </html>
  );
}
