export function navigateTo(href) {
  if (window.location.pathname === href) return;
  window.history.pushState({}, '', href);
  window.dispatchEvent(new Event('calibre:navigate'));
}

export default function NavLink({ href, children, className = '', active = false }) {
  return (
    <button
      className={`${className} ${active ? 'active' : ''}`}
      type="button"
      onClick={() => navigateTo(href)}
    >
      {children}
    </button>
  );
}
