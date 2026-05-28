import Link from 'next/link';

export function ProLock({ title='Unlock full Calibre Pro' }: { title?: string }) {
  return (
    <div className="card lock">
      <span className="badge-pro">PRO</span>
      <h3 style={{marginTop:12}}>{title}</h3>
      <p className="muted">Get advanced verdicts, deeper comparisons, saved watchlists and World Cup intelligence boards.</p>
      <Link href="/pricing" className="cta">Get World Cup Founder Pass</Link>
    </div>
  );
}
