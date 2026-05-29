export default function PageHero({ eyebrow, title, children }) {
  return (
    <section className="page-hero panel">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children && <p className="page-hero-copy">{children}</p>}
    </section>
  );
}
