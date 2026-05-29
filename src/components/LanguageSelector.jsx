import { useState, useRef, useEffect } from 'react';
import { Globe2, ChevronDown, Check } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹' },
  { code: 'ar', label: 'العربية',    flag: '🇸🇦' },
  { code: 'zh', label: '中文',        flag: '🇨🇳' },
  { code: 'hi', label: 'हिन्दी',      flag: '🇮🇳' },
  { code: 'ru', label: 'Русский',    flag: '🇷🇺' },
  { code: 'ja', label: '日本語',      flag: '🇯🇵' },
  { code: 'ko', label: '한국어',      flag: '🇰🇷' },
  { code: 'tr', label: 'Türkçe',     flag: '🇹🇷' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'id', label: 'Indonesia',  flag: '🇮🇩' },
];

const STORAGE_KEY = 'calibre_lang';

export default function LanguageSelector() {
  const stored   = localStorage.getItem(STORAGE_KEY) || 'en';
  const [current, setCurrent] = useState(stored);
  const [open,    setOpen]    = useState(false);
  const ref = useRef(null);

  const active = LANGUAGES.find(l => l.code === current) || LANGUAGES[0];

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function select(code) {
    setCurrent(code);
    localStorage.setItem(STORAGE_KEY, code);
    // In future: i18n context update goes here
    setOpen(false);
  }

  return (
    <div className="lang-selector" ref={ref}>
      <button
        type="button"
        className="lang-pill"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe2 size={15} />
        <span>{active.flag} {active.label}</span>
        <ChevronDown size={13} className={open ? 'chevron-up' : ''} />
      </button>

      {open && (
        <ul className="lang-dropdown" role="listbox">
          {LANGUAGES.map(lang => (
            <li
              key={lang.code}
              role="option"
              aria-selected={lang.code === current}
              className={lang.code === current ? 'lang-option active' : 'lang-option'}
              onClick={() => select(lang.code)}
            >
              <span className="lang-flag">{lang.flag}</span>
              <span className="lang-label">{lang.label}</span>
              {lang.code === current && <Check size={13} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
