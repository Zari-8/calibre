import { useState, useEffect } from 'react';
import { Zap, Target, Star, MessageSquare, GaugeCircle, Users, Play } from 'lucide-react';
import { useBattle } from '../hooks/useBattle.js';
import { navigateTo } from './NavLink.jsx';

function useCountdown() {
  const get = () => {
    const now = new Date(), next = new Date(now); next.setUTCHours(24,0,0,0);
    const d = Math.max(0, next - now);
    return {
      h: String(Math.floor(d/3600000)).padStart(2,'0'),
      m: String(Math.floor((d%3600000)/60000)).padStart(2,'0'),
      s: String(Math.floor((d%60000)/1000)).padStart(2,'0'),
    };
  };
  const [t,setT] = useState(get);
  useEffect(() => { const id = setInterval(()=>setT(get()),1000); return ()=>clearInterval(id); },[]);
  return t;
}

const CATS = [
  { label:'Control',    Icon: Target },
  { label:'Impact',     Icon: Zap },
  { label:'Creativity', Icon: Star },
  { label:'Debate',     Icon: MessageSquare },
];

export default function BattleHero() {
  const { battle, playerA, playerB } = useBattle();
  const { h, m, s } = useCountdown();
  const [cat, setCat]   = useState('Control');
  const [rating, setRating] = useState(null);
  const [voted, setVoted]   = useState(false);
  const [votes, setVotes]   = useState(12458);

  function handleRate(n) { setRating(n); if(!voted){ setVoted(true); setVotes(v=>v+1); } }

  const pL = playerA ?? { name:'Pedri', team:'Barcelona', localImage:'/assets/players/pedri.jpg' };
  const pR = playerB ?? { name:'Jude Bellingham', team:'Real Madrid', localImage:'/assets/players/jude-bellingham.jpg' };
  const question = battle?.question ?? 'Who owns the midfield?';

  return (
    <div style={{
      background: 'linear-gradient(160deg, #0b1008 0%, #080909 55%, #0c0808 100%)',
      position: 'relative', overflow: 'hidden',
    }}>

      {/* atmospheric background */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        background: `
          radial-gradient(ellipse 55% 90% at 15% 50%, rgba(125,220,0,.055) 0%, transparent 70%),
          radial-gradient(ellipse 55% 90% at 85% 50%, rgba(125,220,0,.04) 0%, transparent 70%)
        `,
      }} />

      {/* ── TOP BAR ── */}
      <div style={{
        display:'flex', alignItems:'center', gap:12, padding:'14px 28px 0',
        position:'relative', zIndex:10,
      }}>
        {/* Live tag */}
        <div className="battle-live-tag">
          <div className="live-dot" />
          LIVE RATE BATTLE
        </div>

        {/* Category pills */}
        <div style={{ display:'flex', alignItems:'center', gap:4, marginLeft:16 }}>
          <span className="cat-label-text">who gives more:</span>
          {CATS.map(({ label, Icon }) => (
            <button key={label} type="button"
              className={`cat-pill${cat === label ? ' active' : ''}`}
              onClick={() => setCat(label)}
            >
              <Icon size={10} /> {label}
            </button>
          ))}
        </div>

        {/* voter avatars + votes — right side */}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
          <div className="avatar-voters">
            {[pL,pR,{ localImage:'/assets/players/kylian-mbappe.jpg' }].map((p,i) => (
              <img key={i} className="voter-thumb" src={p.localImage} alt="" />
            ))}
          </div>
          <div className="vote-box">
            <strong>{votes.toLocaleString()}</strong>
            <span>VOTES</span>
          </div>
        </div>
      </div>

      {/* ── BODY: fighters + centre ── */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 320px 1fr',
        position:'relative', zIndex:5, minHeight: 340,
      }}>

        {/* LEFT FIGHTER */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', padding:'0 0 16px', position:'relative', overflow:'hidden' }}>
          <div className="club-ghost" style={{ top:20, left:20 }}>FCB</div>
          <img
            src={pL.localImage}
            alt={pL.name}
            className="fighter-img"
            style={{ maxWidth:260 }}
            onError={e => e.target.style.opacity = '0'}
          />
          <div className="fighter-name">
            <strong>{pL.name.toUpperCase()}</strong>
            <span>{pL.team.toUpperCase()}</span>
          </div>
        </div>

        {/* CENTRE */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, padding:'20px 16px' }}>
          {/* RATE BATTLE title */}
          <div style={{ textAlign:'center', lineHeight:.88, marginBottom:4 }}>
            <div style={{ font:'900 54px/1 "Barlow Condensed"', textTransform:'uppercase', color:'#fff', letterSpacing:'-.01em' }}>RATE</div>
            <div style={{ font:'900 54px/1 "Barlow Condensed"', textTransform:'uppercase', color:'var(--lime)', letterSpacing:'-.01em' }}>BATTLE</div>
          </div>

          <div style={{ font:'900 28px/1 "Barlow Condensed"', color:'rgba(255,255,255,.18)', letterSpacing:'.04em' }}>VS</div>

          {/* question + rating box */}
          <div className="question-box" style={{ width:'100%', maxWidth:280 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ font:'700 13px/1.4 "Barlow Condensed"', textTransform:'uppercase', letterSpacing:'.06em', color:'#fff', textAlign:'center' }}>
              {question.split('midfield').length > 1
                ? <>{question.split('midfield')[0]}<mark>midfield</mark>{question.split('midfield')[1]}</>
                : question}
            </h2>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div className="live-dot" style={{ width:5, height:5 }} />
              <span style={{ font:'700 9px/1 "Exo 2"', letterSpacing:'.16em', textTransform:'uppercase', color:'var(--text3)' }}>
                {h}:{m}:{s} LEFT
              </span>
            </div>
            <div className="tap-hint">↓ TAP TO RATE ↓</div>
            <div className="tap-scale">
              {Array.from({length:10},(_,i) => (
                <button key={i+1} type="button"
                  className={rating === i+1 ? 'selected' : ''}
                  onClick={() => handleRate(i+1)}
                >{i+1}</button>
              ))}
            </div>
            <div className="scale-labels">
              <span className="label-left">{pL.name.split(' ')[0].toUpperCase()}</span>
              <span>EQUAL</span>
              <span className="label-right">{pR.name.split(' ').pop().toUpperCase()}</span>
            </div>
            {voted
              ? <div className="vote-confirm">✓ Rating added to community score</div>
              : <div className="vote-hint">Your rating adds to the community score</div>
            }
          </div>

          {/* How it works */}
          <button type="button" className="how-it-works-btn" onClick={() => navigateTo('/debates')}>
            HOW IT WORKS <Play size={11} />
          </button>
        </div>

        {/* RIGHT FIGHTER */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', padding:'0 0 16px', position:'relative', overflow:'hidden' }}>
          <div className="club-ghost club-ghost-right" style={{ top:20, right:20 }}>RM</div>
          <img
            src={pR.localImage}
            alt={pR.name}
            className="fighter-img"
            style={{ maxWidth:260 }}
            onError={e => e.target.style.opacity = '0'}
          />
          <div className="fighter-name fighter-name-right">
            <strong>{pR.name.toUpperCase()}</strong>
            <span>{pR.team.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* ── PROOF STRIP ── */}
      <div className="proof-strip" onClick={() => navigateTo('/debates')} style={{ cursor:'pointer' }}>
        <span><GaugeCircle size={14} />Archetypes</span>
        <span><Target size={14} />63 Leagues</span>
        <span><Users size={14} />186,000 Players</span>
        <span><Zap size={14} />System Fit</span>
        <span><Star size={14} />Talent Discovery</span>
      </div>
    </div>
  );
}
