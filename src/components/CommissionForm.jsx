import { useState } from 'react';
import { X, Send, CheckCircle2, ShieldCheck, FileText } from 'lucide-react';
import { supabase, supabaseConfigured } from '../services/supabaseClient.js';

// Public "Request a dossier" form. Inserts a single status='requested' row into
// dossier_commissions — exactly (and only) what the table's RLS policy allows the
// anon/auth key to do. Reading, quoting, payment and delivery all run server-side
// through the service-role key, never from here.
//
// Two modes, set by `dossierType`:
//   'deal'      — Transfers page. Established player, "is this move good value?".
//   'discovery' — Talents page.  Developmental talent, "should we bet on him?".
//                 Shows a Club / Agent toggle that re-frames the brief.
//
// PREREQ for discovery: run db/dossier_commissions_discovery.sql once to add the
// dossier_type and buyer_kind columns.

const BC = "'Barlow Condensed', sans-serif";
const LIME = '#c8ff00';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const wrap = { position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' };
const card = { width: '100%', maxWidth: 560, background: '#0c0c0e', border: '1px solid #1c1c1c', borderTop: `3px solid ${LIME}`, borderRadius: 12, boxShadow: '0 30px 90px rgba(0,0,0,.6)' };
const inputStyle = { width: '100%', background: '#080808', border: '1px solid #242424', color: '#eee', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', borderRadius: 6, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontFamily: BC, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: 5 };

export default function CommissionForm({ player, club, onClose, dossierType = 'deal', defaultBuyerKind = 'club' }) {
  const isDiscovery = dossierType === 'discovery';
  const playerApiId = player?.apiPlayerId ?? player?.api_player_id ?? null;
  const position = player?.pos || player?.position || '';
  const [buyerKind, setBuyerKind] = useState(defaultBuyerKind === 'agent' ? 'agent' : 'club');
  const [playerName, setPlayerName] = useState(player?.full_name || player?.name || '');
  const [buyingClub, setBuyingClub] = useState(club?.name || club?.short || '');
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [requesterOrg, setRequesterOrg] = useState('');
  const [requesterRole, setRequesterRole] = useState('');
  const [brief, setBrief] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const isAgent = isDiscovery && buyerKind === 'agent';
  const emailOk = EMAIL_RE.test(requesterEmail.trim());
  const canSubmit = playerName.trim().length > 1 && emailOk && !submitting;

  async function submit() {
    setError('');
    if (playerName.trim().length < 2) { setError('Add the player this dossier is about.'); return; }
    if (!emailOk) { setError('Add a valid email so we can send the quote and delivery.'); return; }
    if (!supabaseConfigured || !supabase) { setError('Submissions are temporarily unavailable. Please try again shortly.'); return; }
    setSubmitting(true);
    try {
      const { error: e } = await supabase.from('dossier_commissions').insert([{
        player_name: playerName.trim(),
        player_api_id: playerApiId || null,
        buying_club: buyingClub.trim() || null,
        position: position || null,
        requester_name: requesterName.trim() || null,
        requester_email: requesterEmail.trim(),
        requester_org: requesterOrg.trim() || null,
        requester_role: requesterRole.trim() || null,
        brief: brief.trim() || null,
        status: 'requested',
        dossier_type: dossierType,
        buyer_kind: isDiscovery ? buyerKind : null,
      }]);
      if (e) { setError('Something went wrong submitting your request. Please try again.'); setSubmitting(false); return; }
      setDone(true);
    } catch {
      setError('Something went wrong submitting your request. Please try again.');
      setSubmitting(false);
    }
  }

  const explainer = !isDiscovery
    ? 'A commissioned, multi-page brief answering the 40-point Director-of-Football framework: valuation, system fit, opportunity cost, deal structure, and the qualitative read the engine can\u2019t see. Delivered as a token-gated, watermarked PDF.'
    : isAgent
      ? 'A commissioned brief positioning this talent for clubs \u2014 Calibre rating and ceiling, comparable trajectories, the tier of club he fits, and the value narrative to put in front of a sporting director. Token-gated, watermarked PDF.'
      : 'A commissioned brief on whether to bet on this talent \u2014 Calibre rating, projected ceiling and trajectory, pathway modelling, comparable outcomes, value and the risk of stalling, plus the qualitative read the engine can\u2019t see. Token-gated, watermarked PDF.';

  return (
    <div style={wrap} role="presentation" onMouseDown={onClose}>
      <div style={card} role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 20px 12px', borderBottom: '1px solid #161616' }}>
          <div>
            <div style={{ fontFamily: BC, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: LIME }}>{isDiscovery ? 'Discovery Dossier · $499 one-time' : 'Commission · $499 one-time'}</div>
            <div style={{ fontFamily: BC, fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1, marginTop: 4 }}>{isDiscovery ? 'Commission a Discovery Dossier' : 'Request a full dossier'}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}><X size={20} /></button>
        </div>

        {done ? (
          <div style={{ padding: '28px 22px 32px', textAlign: 'center' }}>
            <CheckCircle2 size={40} color={LIME} style={{ marginBottom: 12 }} />
            <div style={{ fontFamily: BC, fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Request received</div>
            <p style={{ color: '#bbb', fontSize: 14, lineHeight: 1.6, maxWidth: 400, margin: '0 auto 18px' }}>
              We&apos;ll review the brief on <b style={{ color: '#fff' }}>{playerName.trim()}</b> and email a quote and payment link to <b style={{ color: LIME }}>{requesterEmail.trim()}</b>. The dossier is delivered as a token-gated, watermarked PDF once payment clears.
            </p>
            <button onClick={onClose} style={{ background: LIME, color: '#0a0a0a', border: 'none', padding: '10px 20px', fontFamily: BC, fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 6 }}>Done</button>
          </div>
        ) : (
          <div style={{ padding: '16px 20px 22px' }}>
            {isDiscovery && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Commissioning as</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['club', 'agent'].map(k => (
                    <button key={k} type="button" onClick={() => setBuyerKind(k)} style={{ flex: 1, padding: '9px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: BC, fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', background: buyerKind === k ? LIME : 'transparent', color: buyerKind === k ? '#0a0a0a' : '#9a9a9a', border: `1px solid ${buyerKind === k ? LIME : '#242424'}` }}>{k === 'club' ? 'A club' : 'An agent'}</button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>{isAgent ? 'Framed to validate and position your player for clubs.' : 'Framed to de-risk the signing for your club.'}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, background: '#0a0a0a', border: '1px solid #161616', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
              <FileText size={16} color={LIME} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: 12, color: '#aaa', lineHeight: 1.5 }}>{explainer}</p>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>{isDiscovery ? 'Talent *' : 'Player *'}</label>
              <input style={inputStyle} value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder={isDiscovery ? 'e.g. Takudzwa Ncube' : 'e.g. Anthony Gordon'} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>{isAgent ? 'Player\u2019s club' : isDiscovery ? 'Current club' : 'Buying club'}</label>
                <input style={inputStyle} value={buyingClub} onChange={e => setBuyingClub(e.target.value)} placeholder={isAgent ? 'Where he plays now' : isDiscovery ? 'Talent\u2019s current club' : 'Club commissioning'} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Position</label>
                <input style={{ ...inputStyle, color: '#888' }} value={position} readOnly placeholder="—" />
              </div>
            </div>

            <div style={{ height: 1, background: '#161616', margin: '14px 0' }} />

            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Your name</label>
                <input style={inputStyle} value={requesterName} onChange={e => setRequesterName(e.target.value)} placeholder="Full name" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Email *</label>
                <input style={inputStyle} type="email" value={requesterEmail} onChange={e => setRequesterEmail(e.target.value)} placeholder={isAgent ? 'you@agency.com' : 'you@club.com'} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Organisation</label>
                <input style={inputStyle} value={requesterOrg} onChange={e => setRequesterOrg(e.target.value)} placeholder={isAgent ? 'Agency' : 'Club / agency'} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Role</label>
                <input style={inputStyle} value={requesterRole} onChange={e => setRequesterRole(e.target.value)} placeholder={isAgent ? 'e.g. Agent' : 'e.g. Sporting Director'} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Brief — what should the dossier answer?</label>
              <textarea style={{ ...inputStyle, minHeight: 84, resize: 'vertical' }} value={brief} onChange={e => setBrief(e.target.value)} placeholder={isAgent ? 'The clubs you\u2019re targeting, the level you believe he can reach, timeline\u2026' : isDiscovery ? 'The role you\u2019d sign him for, the level you need him to reach, budget context, timeline\u2026' : 'The specific questions, the role you\u2019re signing for, budget context, timeline\u2026'} />
            </div>

            {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#666' }}>
                <ShieldCheck size={13} /> No payment now — you&apos;ll receive a quote first.
              </div>
              <button onClick={submit} disabled={!canSubmit} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: canSubmit ? LIME : '#222', color: canSubmit ? '#0a0a0a' : '#666', border: 'none', padding: '11px 20px', fontFamily: BC, fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: canSubmit ? 'pointer' : 'not-allowed', borderRadius: 6 }}>
                {submitting ? 'Sending…' : <>Submit request <Send size={13} /></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
