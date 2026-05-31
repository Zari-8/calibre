export function navigateTo(href) {
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === href) return;

  // When machine translation is active, use a full navigation so that the
  // selected language is applied reliably to the next React route as well.
  const language = window.localStorage.getItem('calibre_lang') || 'en';
  if (language !== 'en') {
    window.location.assign(href);
    return;
  }

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
