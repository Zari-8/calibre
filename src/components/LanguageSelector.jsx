import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe2, LoaderCircle } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹' },
  { code: 'ar', label: 'العربية',    flag: '🇸🇦' },
  { code: 'zh-CN', label: '中文',     flag: '🇨🇳' },
  { code: 'hi', label: 'हिन्दी',      flag: '🇮🇳' },
  { code: 'ru', label: 'Русский',    flag: '🇷🇺' },
  { code: 'ja', label: '日本語',      flag: '🇯🇵' },
  { code: 'ko', label: '한국어',      flag: '🇰🇷' },
  { code: 'tr', label: 'Türkçe',     flag: '🇹🇷' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'id', label: 'Indonesia',  flag: '🇮🇩' },
];

const STORAGE_KEY = 'calibre_lang';
const SCRIPT_ID = 'calibre-google-translate-script';
const TRANSLATE_ROOT_ID = 'calibre-google-translate';
const INCLUDED_LANGUAGES = LANGUAGES.map(language => language.code).join(',');

function cookieDomain() {
  const hostname = window.location.hostname;
  return hostname === 'calibrefootball.com' || hostname.endsWith('.calibrefootball.com')
    ? '; domain=.calibrefootball.com'
    : '';
}

function setTranslationCookie(code) {
  const domain = cookieDomain();
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const maxAge = 60 * 60 * 24 * 365;
  const value = code === 'en' ? '/en/en' : `/en/${code}`;
  document.cookie = `googtrans=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
  if (domain) document.cookie = `googtrans=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure}${domain}`;
}

function clearTranslationCookie() {
  const domain = cookieDomain();
  document.cookie = 'googtrans=; path=/; max-age=0; SameSite=Lax';
  if (domain) document.cookie = `googtrans=; path=/; max-age=0; SameSite=Lax${domain}`;
}

function setDocumentLanguage(code) {
  document.documentElement.lang = code;
  document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
}

function applyGoogleLanguage(code, attempt = 0) {
  if (code === 'en') return;
  const combo = document.querySelector('.goog-te-combo');
  if (!combo) {
    if (attempt < 30) window.setTimeout(() => applyGoogleLanguage(code, attempt + 1), 150);
    return;
  }
  if (combo.value !== code) {
    combo.value = code;
    combo.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function loadTranslateEngine(currentLanguage) {
  if (window.google?.translate?.TranslateElement) {
    applyGoogleLanguage(currentLanguage);
    return;
  }

  window.googleTranslateElementInit = () => {
    if (!window.google?.translate?.TranslateElement) return;
    const root = document.getElementById(TRANSLATE_ROOT_ID);
    if (root && !root.dataset.ready) {
      root.dataset.ready = 'true';
      new window.google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: INCLUDED_LANGUAGES,
        autoDisplay: false,
      }, TRANSLATE_ROOT_ID);
    }
    window.dispatchEvent(new Event('calibre:translation-engine-ready'));
    applyGoogleLanguage(currentLanguage);
  };

  if (!document.getElementById(SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    script.onerror = () => window.dispatchEvent(new Event('calibre:translation-engine-error'));
    document.body.appendChild(script);
  }
}

export default function LanguageSelector() {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) || 'en' : 'en';
  const [current, setCurrent] = useState(stored);
  const [open, setOpen] = useState(false);
  const [translating, setTranslating] = useState(stored !== 'en');
  const ref = useRef(null);

  const active = LANGUAGES.find(language => language.code === current) || LANGUAGES[0];

  useEffect(() => {
    setDocumentLanguage(current);
    if (current !== 'en') setTranslationCookie(current);
    loadTranslateEngine(current);

    const onClickOutside = event => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onReady = () => {
      applyGoogleLanguage(current);
      window.setTimeout(() => setTranslating(false), 850);
    };
    const onError = () => setTranslating(false);
    const onLanguageChange = event => {
      if (event.detail?.code) setCurrent(event.detail.code);
    };

    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('calibre:translation-engine-ready', onReady);
    window.addEventListener('calibre:translation-engine-error', onError);
    window.addEventListener('calibre:language-change', onLanguageChange);

    if (current !== 'en') window.setTimeout(() => setTranslating(false), 2500);

    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('calibre:translation-engine-ready', onReady);
      window.removeEventListener('calibre:translation-engine-error', onError);
      window.removeEventListener('calibre:language-change', onLanguageChange);
    };
  }, []);

  function select(code) {
    if (code === current) {
      setOpen(false);
      return;
    }

    setCurrent(code);
    setOpen(false);
    setTranslating(code !== 'en');
    window.localStorage.setItem(STORAGE_KEY, code);
    setDocumentLanguage(code);

    if (code === 'en') clearTranslationCookie();
    else setTranslationCookie(code);

    window.dispatchEvent(new CustomEvent('calibre:language-change', { detail: { code } }));

    // Reloading makes the translation deterministic across every React route.
    // The selected language is restored from localStorage and the googtrans cookie.
    window.setTimeout(() => window.location.reload(), 60);
  }

  return (
    <div className="lang-selector notranslate" ref={ref} translate="no">
      <div id={TRANSLATE_ROOT_ID} className="calibre-google-translate" aria-hidden="true" />
      <button
        type="button"
        className="lang-pill"
        onClick={() => setOpen(value => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choose website language"
      >
        {translating ? <LoaderCircle size={14} className="lang-spinner" /> : <Globe2 size={15} />}
        <span>{active.flag} {active.label}</span>
        <ChevronDown size={13} className={open ? 'chevron-up' : ''} />
      </button>

      {open && (
        <ul className="lang-dropdown" role="listbox">
          {LANGUAGES.map(language => (
            <li
              key={language.code}
              role="option"
              aria-selected={language.code === current}
              className={language.code === current ? 'lang-option active' : 'lang-option'}
              onClick={() => select(language.code)}
            >
              <span className="lang-flag">{language.flag}</span>
              <span className="lang-label">{language.label}</span>
              {language.code === current && <Check size={13} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
