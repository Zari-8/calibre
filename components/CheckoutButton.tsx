'use client';
import { useState } from 'react';

export function CheckoutButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function startCheckout() {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch('/api/checkout/founder-pass', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout not configured yet.');
      window.location.href = data.url;
    } catch (e: any) {
      setMsg(e.message || 'Checkout not available yet.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="cta" onClick={startCheckout} disabled={loading}>
        {loading ? 'Opening checkout...' : 'Get World Cup Founder Pass'}
      </button>
      {msg && <p className="muted" style={{marginTop:10}}>{msg}</p>}
    </div>
  );
}
