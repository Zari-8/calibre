import { useState, useEffect } from 'react';
import { navigateTo } from './NavLink.jsx';

const STORAGE_KEY = 'calibre:terms-accepted';

export default function TermsBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const accepted = localStorage.getItem(STORAGE_KEY);
      if (!accepted) setVisible(true);
    } catch { /* localStorage unavailable */ }
  }, []);

  function accept() {
    try { localStorage.setItem(STORAGE_KEY, Date.now().toString()); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={wrap}>
      <div style={inner}>
        <div style={text}>
          <span style={bold}>By using Calibre</span> you agree to our{' '}
          <button style={link} onClick={() => { accept(); navigateTo('/terms'); }}>
            Terms of Service
          </button>
          , including our use of cookies for authentication and analytics. Calibre is an 18+ platform.
        </div>
        <div style={actions}>
          <button style={viewBtn} onClick={() => { accept(); navigateTo('/terms'); }}>
            View Terms
          </button>
          <button style={continueBtn} onClick={accept}>
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

const wrap = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 9999,
  background: '#111',
  borderTop: '1px solid #c8ff00',
  padding: '14px 24px',
};

const inner = {
  maxWidth: 1200,
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 20,
  flexWrap: 'wrap',
};

const text = {
  fontSize: 12,
  color: '#999',
  lineHeight: 1.6,
  flex: 1,
};

const bold = {
  color: '#fff',
  fontWeight: 700,
};

const link = {
  background: 'none',
  border: 'none',
  color: '#c8ff00',
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
  textDecoration: 'underline',
  fontFamily: 'inherit',
};

const actions = {
  display: 'flex',
  gap: 10,
  flexShrink: 0,
};

const viewBtn = {
  background: 'none',
  border: '1px solid #333',
  color: '#888',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 12,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding: '8px 16px',
  cursor: 'pointer',
};

const continueBtn = {
  background: '#c8ff00',
  border: 'none',
  color: '#0a0a0a',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding: '8px 20px',
  cursor: 'pointer',
};
