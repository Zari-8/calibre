import { useState } from 'react';
import { LockKeyhole, Mail, ShieldCheck, X } from 'lucide-react';
import { signInWithEmail, signUpWithEmail, supabaseConfigured } from '../services/supabaseClient.js';

export default function AuthModal({ open, onClose, returnTo = '' }) {
  const [mode, setMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(''); setStatus('');
    try {
      if (!supabaseConfigured) throw new Error('Account service is not connected yet. Add the Supabase public URL and anon key in Vercel before testing sign-up.');
      if (mode === 'signup') {
        const data = await signUpWithEmail(email.trim(), password);
        if (data?.session) {
          setStatus('Account created and signed in.');
          window.setTimeout(() => { onClose(); if (returnTo) window.location.assign(returnTo); }, 700);
        } else {
          setStatus('Verification email sent. Open the link in your inbox, then return to Calibre and log in.');
        }
      } else {
        await signInWithEmail(email.trim(), password);
        setStatus('Signed in successfully.');
        window.setTimeout(() => { onClose(); if (returnTo) window.location.assign(returnTo); }, 500);
      }
    } catch (err) {
      setError(err?.message || 'Account request failed.');
    } finally { setBusy(false); }
  }

  return (
    <div className="account-access-modal" role="presentation" onMouseDown={onClose}>
      <section className="account-access-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="account-access-title" onMouseDown={event=>event.stopPropagation()}>
        <button type="button" className="account-access-modal__close" aria-label="Close account access" onClick={onClose}><X size={18}/></button>
        <span className="account-access-modal__kicker"><LockKeyhole size={14}/>Calibre account</span>
        <h2 id="account-access-title">Join the argument.</h2>
        <p>Use a verified account to post in rate-battle forums, nominate debates and keep your votes attached to your profile.</p>
        <div className="auth-mode-row">
          <button type="button" className={mode==='signup'?'is-active':''} onClick={()=>setMode('signup')}>Create account</button>
          <button type="button" className={mode==='login'?'is-active':''} onClick={()=>setMode('login')}>Log in</button>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="calibre-account-email">Email address</label>
          <div className="account-access-modal__field"><Mail size={16}/><input id="calibre-account-email" value={email} onChange={event=>setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" required /></div>
          <label htmlFor="calibre-account-password">Password</label>
          <div className="account-access-modal__field"><ShieldCheck size={16}/><input id="calibre-account-password" value={password} onChange={event=>setPassword(event.target.value)} type="password" autoComplete={mode==='signup'?'new-password':'current-password'} minLength="6" placeholder="Minimum 6 characters" required /></div>
          <button type="submit" className="button button--primary" disabled={busy}>{busy ? 'Working…' : mode==='signup' ? 'Create verified account' : 'Log in'}</button>
        </form>
        {status && <div className="auth-message auth-message--success">{status}</div>}
        {error && <div className="auth-message auth-message--error">{error}</div>}
        <small>{supabaseConfigured ? 'Email verification is active. The confirmation email is sent by Supabase Auth.' : 'Beta setup required: connect Supabase before testing email validation.'}</small>
      </section>
    </div>
  );
}
