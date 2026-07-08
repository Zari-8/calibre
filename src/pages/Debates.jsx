import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Crown, Eye, Flame, LockKeyhole, MessageSquare, Send, Star, TrendingUp, Trophy, Users, X, Zap } from 'lucide-react';
import { navigateTo } from '../components/NavLink.jsx';
import ApiPlayerImage from '../components/ApiPlayerImage.jsx';
import { playerIdFor } from '../data/playerIds.js';
import ShareBar, { shareUrl } from '../components/Share.jsx';
import useAuth from '../hooks/useAuth.js';
import { castGoatVote, castBattleVote, loadDebateVoteCounts, myBattleVote, loadGoatVoteCounts, loadBangerTweets, loadDebateFeed, loadForumPosts, loadHotPotatoes, submitDebateNomination, submitForumPost } from '../services/community.js';

const BATTLE_VISUALS={
  'pedri-vs-jude':['Pedri','Jude Bellingham'], 'mbappe-vs-haaland':['Kylian Mbappé','Erling Haaland'], 'vini-vs-saka':['Vinícius Júnior','Bukayo Saka'],
};
// Seeded starting split for each rate-battle — the LEFT player's %. Live votes
// nudge the bar away from this, so it looks alive from the first visit instead
// of frozen at 50/50. Priority: a `seed_left` column on the debate row (set it
// in Supabase to control any battle) → this map → 50. These are editorial calls,
// not real counts — edit them freely.
const BATTLE_LEAN={
  'mbappe-vs-haaland':53, 'pedri-vs-jude':51, 'vini-vs-saka':55,
};
function leanFor(item){const v=Number(item&&item.seed_left);if(Number.isFinite(v)&&v>0&&v<100)return v;return BATTLE_LEAN[item&&item.slug]??50;}
function requestAuth(returnTo='/debates'){window.dispatchEvent(new CustomEvent('calibre:open-auth',{detail:{returnTo}}));}
function ForumModal({slug,title,onClose}){const{user,displayName}=useAuth();const[draft,setDraft]=useState('');const[posts,setPosts]=useState([]);const[notice,setNotice]=useState('');useEffect(()=>{loadForumPosts(slug).then(setPosts).catch(()=>setPosts([]));},[slug]);async function post(){if(!user)return requestAuth(`/debates?forum=${slug}`);const body=draft.trim();if(!body)return;try{const saved=await submitForumPost({threadSlug:slug,body,user,username:displayName});setPosts(current=>[saved,...current]);setDraft('');setNotice('Your argument has been added to the thread.');}catch(error){setNotice(error?.message||'Post could not be saved.');}}return <div className="match-forum-modal" role="presentation" onMouseDown={onClose}><section className="match-forum-modal__dialog" onMouseDown={e=>e.stopPropagation()}><button className="match-forum-modal__close" type="button" onClick={onClose}><X size={18}/></button><div className="match-forum-modal__kicker"><MessageSquare size={14}/> Debate forum</div><h3>{title}</h3><p>The thread stays attached to this exact debate.</p>{user?<><div className="match-forum-composer"><textarea rows="3" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Make the football argument…"/><button className="btn btn--lime btn--sm" type="button" onClick={post}><Send size={13}/> POST</button></div>{notice&&<small>{notice}</small>}<div className="match-forum-posts">{posts.length?posts.map((p,i)=><article key={`${p.created_at}-${i}`}><b>{p.author_name||p.author_email||'Calibre user'}</b><p>{p.body}</p><small>{p.created_at?new Date(p.created_at).toLocaleString():'now'}</small></article>):<div className="comp-empty-state">Start the discussion.</div>}</div></>:<div className="match-forum-locked"><LockKeyhole size={20}/><div><b>Verified account required</b><span>Log in or create an account before posting.</span></div><button className="btn btn--lime btn--sm" type="button" onClick={()=>requestAuth(`/debates?forum=${slug}`)}>LOG IN OR CREATE ACCOUNT</button></div>}</section></div>}
function NominateModal({onClose}){const{user}=useAuth();const[title,setTitle]=useState('');const[reason,setReason]=useState('');const[notice,setNotice]=useState('');async function submit(e){e.preventDefault();if(!user)return requestAuth('/debates');try{const result=await submitDebateNomination({title,reason,userId:user.id,email:user.email});setNotice(result.source==='supabase'?'Nomination submitted for editorial review.':'Nomination stored in beta mode. Connect Supabase to make it persistent.');setTitle('');setReason('');}catch(error){setNotice(error?.message||'Nomination failed.');}}return <div className="match-forum-modal" role="presentation" onMouseDown={onClose}><section className="match-forum-modal__dialog" onMouseDown={e=>e.stopPropagation()}><button className="match-forum-modal__close" type="button" onClick={onClose}><X size={18}/></button><div className="match-forum-modal__kicker"><Star size={14}/> Nominate a debate</div><h3>Put the next football argument on the board.</h3><form className="debate-nominate-form" onSubmit={submit}><input value={title} onChange={e=>setTitle(e.target.value)} required placeholder="Debate question"/><textarea value={reason} onChange={e=>setReason(e.target.value)} rows="4" required placeholder="Why will this argument move the conversation?"/><button className="btn btn--lime" type="submit">SUBMIT NOMINATION</button></form>{notice&&<small>{notice}</small>}</section></div>}

export default function Debates(){
  const{user,displayName}=useAuth(); const[feed,setFeed]=useState([]);const[hot,setHot]=useState([]);const[tweets,setTweets]=useState([]);const[source,setSource]=useState('loading');const[nominate,setNominate]=useState(false);const[forum,setForum]=useState(null);const[goat,setGoat]=useState(()=>{try{return localStorage.getItem('calibre:goat-vote:device')||''}catch{return''}});const[goatNotice,setGoatNotice]=useState('');const[voteCounts,setVoteCounts]=useState({});const[myVotes,setMyVotes]=useState({});const[goatCounts,setGoatCounts]=useState({Messi:0,Ronaldo:0,total:0});const[voteError,setVoteError]=useState('');
  useEffect(()=>{Promise.all([loadDebateFeed(),loadHotPotatoes(),loadBangerTweets()]).then(([d,h,t])=>{setFeed(d.rows);setHot(h.rows);setTweets(t.rows);setSource(d.source);});},[]);
  // Load live vote counts, and read this device's existing votes from local.
  useEffect(()=>{loadDebateVoteCounts().then(setVoteCounts).catch(()=>{});},[]);
  useEffect(()=>{loadGoatVoteCounts().then(setGoatCounts).catch(()=>{});},[]);
  useEffect(()=>{const mine={};for(const d of feed){if(d.category==='rate-battle'){const v=myBattleVote(d.slug);if(v)mine[d.slug]=v;}}setMyVotes(mine);},[feed]);
  async function voteBattle(slug,choice){try{await castBattleVote(slug,choice,user);setMyVotes(m=>({...m,[slug]:choice}));setVoteCounts(c=>{const cur=c[slug]||{left:0,right:0};return{...c,[slug]:{...cur,[choice]:(cur[choice]||0)+1}};});setVoteError('');}catch(error){const already=/already voted/i.test(error?.message||'');if(already){setMyVotes(m=>({...m,[slug]:myBattleVote(slug)||m[slug]}));}else{setVoteError(error?.message||'Vote could not be recorded. Please try again.');}}}
  useEffect(()=>{const params=new URLSearchParams(window.location.search);const slug=params.get('forum');const topic=params.get('topic');if(slug)setForum({slug,title:feed.find(d=>d.slug===slug)?.title||slug.replaceAll('-',' ')});else if(topic)setForum({slug:`topic-${topic.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,title:topic});},[feed]);
  const trending=useMemo(()=>[...feed].sort((a,b)=>(b.votes||0)-(a.votes||0)).slice(0,6),[feed]);
  async function voteGoat(choice){try{await castGoatVote(choice,user);setGoat(choice);setGoatCounts(c=>({...c,[choice]:(c[choice]||0)+1,total:(c.total||0)+1}));setGoatNotice('');}catch(error){setGoatNotice(error?.message||'Vote could not be recorded.');}}

  // --- Editorial leaderboard placeholder (no live source yet — edit freely) ---
  const CONTRIBUTORS=[{name:'TheTacticalOne',pts:4821},{name:'PitchVision',pts:3729},{name:'StatMerchant',pts:3102}];
  const compact=n=>n>=1000?(n/1000).toFixed(1).replace(/\.0$/,'')+'K':String(n);
  const rateBattles=feed.filter(d=>d.category==='rate-battle');
  const totalVotesAll=feed.reduce((s,d)=>s+(d.votes||0),0);
  const totalComments=feed.reduce((s,d)=>s+(d.comments||0),0);
  // Filters removed — battles now show most-active first, no category pills.
  const sortedBattles=[...rateBattles].sort((a,b)=>(b.votes||0)-(a.votes||0));
  const battleScroller = useRef(null);
  const scrollBattles = (dir) => {
    const el = battleScroller.current; if (!el) return;
    const card = el.querySelector('.battle-preview');
    const step = card ? card.offsetWidth + 14 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };
  return <div className="page debates-page"><div className="debates-page__bg" aria-hidden="true"><img src="/assets/debates-bg.png" alt=""/></div><div className="debates-page__shade" aria-hidden="true"/>
    <style>{`
      .debates-page { position: relative; isolation: isolate; background: #05080b; }

      /* FULL-BLEED background — fixed to the viewport so the pitch fills the
         whole screen and never ends in a dark shelf as you scroll. */
      .debates-page__bg { position: fixed; inset: 0; z-index: -2; overflow: hidden; pointer-events: none; }
      .debates-page__bg img { width: 100%; height: 100%; object-fit: cover; object-position: center; }

      /* Softer scrim — a gentle lime bloom up top, an even semi-dark wash for
         readability, and a vignette. No hard flip to solid, so contrast eases. */
      .debates-page__shade { position: fixed; inset: 0; z-index: -1; pointer-events: none;
        background:
          radial-gradient(ellipse 90% 42% at 50% -4%, rgba(166,255,0,0.07), transparent 60%),
          radial-gradient(ellipse 120% 90% at 50% 130%, rgba(18,42,14,0.42), transparent 62%),
          radial-gradient(ellipse 100% 100% at 50% 45%, transparent 40%, rgba(4,7,10,0.42) 100%),
          linear-gradient(180deg, rgba(5,8,11,0.28) 0%, rgba(5,8,11,0.58) 42%, rgba(5,8,11,0.68) 100%); }

      /* wider, mockup-style container */
      .dbx-wrap { position: relative; z-index: 1; width: min(1500px, calc(100% - 56px)); margin: 0 auto; padding: 30px 0 60px; }

      /* header row: title + stat strip */
      .dbx-top { display: grid; grid-template-columns: minmax(0,1.35fr) minmax(360px,0.9fr); gap: 28px; align-items: center; margin-bottom: 14px; }
      .dbx-head .section-kicker { color: #A6FF00; }
      .dbx-head h1 { margin: 8px 0 0; font: 900 clamp(40px,4.4vw,60px)/0.94 "Barlow Condensed","Space Grotesk",sans-serif; text-transform: uppercase; letter-spacing: -0.02em; color: #fff; }
      .dbx-head h1 em { display: block; color: #A6FF00; font-style: normal; }
      .dbx-head p { margin: 14px 0 0; max-width: 460px; color: rgba(237,238,240,0.82); font: 500 14px/1.5 "Inter",sans-serif; }

      .dbx-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; padding: 20px 8px; border-radius: 14px; }
      .dbx-stats > div { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; padding: 4px 6px; position: relative; }
      .dbx-stats > div + div::before { content: ""; position: absolute; left: 0; top: 14%; height: 72%; width: 1px; background: rgba(255,255,255,0.10); }
      .dbx-stats svg { color: #A6FF00; }
      .dbx-stats strong { color: #fff; font: 900 26px/1 "Space Grotesk","Inter",sans-serif; }
      .dbx-stats span { color: rgba(237,238,240,0.60); font: 700 10px/1 "Inter",sans-serif; letter-spacing: 0.10em; text-transform: uppercase; }

      /* section head — no filter pills, no sort. Just the title. */
      .dbx-section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; flex-wrap: wrap; margin: 30px 0 16px; }
      .dbx-section-head h2 { margin: 6px 0 0; font: 900 clamp(26px,2.6vw,34px)/1 "Barlow Condensed","Space Grotesk",sans-serif; text-transform: uppercase; letter-spacing: -0.01em; color: #fff; }

      /* per-card meta + flame heat pill (bottom-right) */
      .dbx-battle-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 10px 0 2px; }
      .dbx-battle-stats { display: inline-flex; align-items: center; gap: 8px; color: rgba(237,238,240,0.60); font: 600 11.5px/1 "Inter",sans-serif; }
      .dbx-battle-stats svg { opacity: 0.75; vertical-align: -2px; }
      .dbx-heat { display: inline-flex; align-items: center; gap: 5px; background: rgba(166,255,0,0.13); border: 1px solid rgba(166,255,0,0.24); color: #A6FF00; border-radius: 999px; padding: 5px 10px; font: 800 12px/1 "Space Grotesk","Inter",sans-serif; letter-spacing: 0.02em; }
      .dbx-heat svg { color: #A6FF00; }

      .dbx-empty { padding: 26px; text-align: center; color: rgba(237,238,240,0.55); font: 500 14px/1.4 "Inter",sans-serif; border: 1px dashed rgba(255,255,255,0.12); border-radius: 12px; }

      /* Compact "more battles" list — same pattern the Comparable Deals rail
         used before its own visual upgrade: a scannable list of rows, not a
         wall of big cards, so 20+ battles stay organized. */
      .dbx-more-list { display: flex; flex-direction: column; gap: 1px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.09); border-radius: 12px; overflow: hidden; }
      .dbx-battle-row { display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: rgba(10,13,16,.6); cursor: pointer; transition: background .12s; }
      .dbx-battle-row:hover { background: rgba(166,255,0,0.05); }
      .dbx-br-players { display: flex; align-items: center; gap: 8px; flex: none; width: 200px; }
      .dbx-br-players img { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; object-position: top; }
      .dbx-br-players span { font: 700 11.5px/1.2 "Inter",sans-serif; color: #eee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 68px; }
      .dbx-br-vs { color: rgba(237,238,240,0.4); font-size: 10px; flex: none; }
      .dbx-br-title { flex: 1; min-width: 0; font: 600 12.5px/1.3 "Inter",sans-serif; color: #d8dde2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .dbx-br-bar { flex: none; width: 90px; height: 5px; border-radius: 4px; background: rgba(255,255,255,0.1); overflow: hidden; }
      .dbx-br-bar span { display: block; height: 100%; background: #A6FF00; }
      .dbx-br-split { flex: none; width: 64px; text-align: right; font: 800 11px "Space Grotesk","Inter",sans-serif; color: #A6FF00; }
      .dbx-br-votes { flex: none; width: 76px; text-align: right; color: rgba(237,238,240,0.55); font: 600 11px "Inter",sans-serif; }
      @media(max-width:760px){ .dbx-br-players { width: 140px; } .dbx-br-players span { max-width: 46px; } .dbx-br-votes { display:none; } }

      /* hot-potato fire — moved to BOTTOM-RIGHT and enlarged */
      .dbx-fire { position: absolute; bottom: 12px; right: 14px; top: auto; font-size: 26px; line-height: 1; filter: drop-shadow(0 4px 12px rgba(255,120,0,0.5)); pointer-events: none; }
      .debates-page .hot-potato-card { position: relative; padding-bottom: 46px; }

      /* top contributors */
      .dbx-contrib-row { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-top: 1px solid rgba(255,255,255,0.06); }
      .dbx-contrib-row:first-of-type { border-top: none; }
      .dbx-contrib-row i { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 6px; background: rgba(166,255,0,0.10); color: #A6FF00; font: 800 12px/1 "Space Grotesk",sans-serif; font-style: normal; flex: none; }
      .dbx-contrib-row b { flex: 1; color: #fff; font: 700 13.5px/1.2 "Inter",sans-serif; }
      .dbx-contrib-row span { color: #A6FF00; font: 800 12px/1 "Space Grotesk",sans-serif; }

      /* bottom nominate bar */
      .dbx-nominate { display: flex; align-items: center; gap: 18px; padding: 20px 24px; border-radius: 14px; margin-top: 30px; }
      .dbx-nominate > svg { color: #A6FF00; flex: none; }
      .dbx-nominate div { flex: 1; }
      .dbx-nominate b { display: block; color: #fff; font: 900 17px/1.1 "Barlow Condensed","Space Grotesk",sans-serif; text-transform: uppercase; letter-spacing: 0.02em; }
      .dbx-nominate span { color: rgba(237,238,240,0.66); font: 500 13px/1.3 "Inter",sans-serif; }

      /* GLASS across every debates panel — softened so cards settle into the
         pitch instead of floating. Lower fill, lighter blur, subtle lime edge,
         and a far gentler shadow (the old 0 24px 80px was the "jarred" look). */
      .debates-page .panel,
      .debates-page .battle-preview,
      .debates-page .dbx-stats,
      .debates-page .dbx-nominate {
        background: rgba(9, 13, 16, 0.46);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 12px 34px rgba(0, 0, 0, 0.30);
      }

      /* battle card sizing — tighter, with room for the heat pill */
      .debates-page .battle-preview { position: relative; padding: 14px 14px 12px; border-radius: 14px; }

      /* the local dv-* battle internals — smaller avatars = smaller cards */
      .dv-players { display: flex; align-items: center; gap: 10px; }
      .dv-player { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; background: none; border: 1px solid transparent; border-radius: 12px; padding: 6px; cursor: pointer; min-width: 0; }
      .dv-player:hover { border-color: rgba(200,255,0,0.4); background: rgba(200,255,0,0.05); }
      .dv-player.is-voted { border-color: #a6ff00; background: rgba(200,255,0,0.08); }
      .dv-player img { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; }
      .dv-player strong { color: #fff; font-size: 12.5px; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dv-vs { color: #6b7075; font-size: 11px; font-weight: 700; flex: none; }
      .dv-bar { height: 5px; border-radius: 3px; background: rgba(255,255,255,0.10); overflow: hidden; margin: 10px 0 7px; }
      .dv-bar span { display: block; height: 100%; background: #a6ff00; transition: width .3s ease; }
      .dv-foot { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #8b9096; }
      .dv-foot strong { color: #a6ff00; font-weight: 800; }
      .dv-title { display: block; width: 100%; background: none; border: none; cursor: pointer; color: #c4c9ce; font-size: 12.5px; line-height: 1.35; text-align: left; padding: 8px 0 2px; }
      .dv-title:hover { color: #fff; }
      .dv-hp-vote { display: flex; gap: 8px; margin: 8px 0; }
      .dv-hp-vote button { flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.14); color: #fff; border-radius: 8px; padding: 8px 0; font-size: 12px; font-weight: 700; letter-spacing: .06em; cursor: pointer; }
      .dv-hp-vote button:hover { border-color: #a6ff00; color: #a6ff00; }
      .dv-goat-count { color: #8b9096; font-size: 12px; margin-bottom: 4px; }

      /* GOAT — kept as a DISTINCT hero, but compact: lime-tinted marquee, a
         two-column banner layout, and the shared small avatars. */
      .debates-page .goat-panel { position: relative; padding: 18px 20px; border-radius: 14px; border: 1px solid rgba(166,255,0,0.22); background: linear-gradient(180deg, rgba(166,255,0,0.055), rgba(9,13,16,0.5)); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 12px 34px rgba(0,0,0,0.30); }
      .goat-hero { display: grid; grid-template-columns: minmax(0,0.9fr) minmax(0,1.1fr); gap: 22px; align-items: center; }
      .goat-hero__lead .section-kicker { color: #A6FF00; }
      .goat-hero__lead h2 { margin: 6px 0 0; font: 900 clamp(24px,2.4vw,30px)/0.95 "Barlow Condensed","Space Grotesk",sans-serif; text-transform: uppercase; letter-spacing: -0.01em; color: #fff; }
      .goat-hero__lead .goat-share { margin-top: 12px; }
      .goat-hero__vote { min-width: 0; }
      @media (max-width: 760px) { .goat-hero { grid-template-columns: 1fr; } }

      @media (max-width: 1000px) {
        .dbx-top { grid-template-columns: 1fr; }
        .dbx-stats { max-width: 460px; }
      }
      /* ── Featured rate-battle SIDE-SCROLLER ──────────────────────────────
         More than three battles front-loaded, but as a single horizontal
         rail the user scrolls/swipes through — never a vertical dump. */
      .dbx-scroller { position: relative; margin: 0 -6px; }
      .dbx-scroller__track {
        display: flex; gap: 14px; overflow-x: auto; scroll-behavior: smooth;
        scroll-snap-type: x mandatory; padding: 4px 6px 12px;
        -webkit-overflow-scrolling: touch; scrollbar-width: none;
      }
      .dbx-scroller__track::-webkit-scrollbar { display: none; }
      .dbx-scroller .battle-preview {
        scroll-snap-align: start; flex: 0 0 300px; width: 300px;
      }
      .dbx-scroller__arrow {
        position: absolute; top: 50%; transform: translateY(-50%); z-index: 5;
        width: 38px; height: 38px; border-radius: 50%; cursor: pointer;
        display: grid; place-items: center; font: 700 22px/1 "Inter",sans-serif;
        color: #04120a; background: #A6FF00; border: none;
        box-shadow: 0 6px 18px rgba(0,0,0,0.42); transition: transform .12s;
      }
      .dbx-scroller__arrow:hover { transform: translateY(-50%) scale(1.08); }
      .dbx-scroller__arrow--prev { left: -8px; }
      .dbx-scroller__arrow--next { right: -8px; }
      @media (max-width: 760px) {
        .dbx-scroller .battle-preview { flex-basis: 82%; width: 82%; }
        .dbx-scroller__arrow { display: none; }
      }

    `}</style>

    <div className="dbx-wrap">
      <div className="dbx-top">
        <div className="dbx-head">
          <span className="section-kicker">DEBATES</span>
          <h1>Rate battles.<em>Real arguments.</em></h1>
          <p>Vote on today’s matchups, enter fixture forums and nominate the arguments football is about to have.</p>
        </div>
        <div className="dbx-stats panel">
          <div><Users size={18}/><strong>{totalVotesAll.toLocaleString()}</strong><span>Active voters</span></div>
          <div><Zap size={18}/><strong>{rateBattles.length}</strong><span>Live battles</span></div>
          <div><Flame size={18}/><strong>{compact(totalComments)}</strong><span>Comments today</span></div>
        </div>
      </div>

      <div className="debate-source-note"><i/> {source==='supabase'?'LIVE COMMUNITY FEED':'EDITORIAL SNAPSHOT · CONNECT SUPABASE FOR PERSISTENT COMMUNITY CONTENT'}</div>

      <div className="debate-layout"><main className="debate-main"><section>
        <div className="dbx-section-head">
          <div><span className="section-kicker"><Zap size={13}/> Live community feed</span><h2>Active rate battles</h2></div>
        </div>
        {voteError && <div style={{background:'rgba(255,80,80,0.08)',border:'1px solid rgba(255,80,80,0.3)',borderRadius:9,padding:'9px 14px',color:'#ff9b9b',fontSize:12.5,marginBottom:12}}>{voteError}</div>}
        {sortedBattles.length===0
          ? <div className="dbx-empty">No live battles yet. Nominate one to get the argument started.</div>
          : <div className="dbx-scroller"><button type="button" className="dbx-scroller__arrow dbx-scroller__arrow--prev" aria-label="Previous battles" onClick={()=>scrollBattles(-1)}>‹</button><div className="dbx-scroller__track" ref={battleScroller}>{sortedBattles.map(item=>{const pair=BATTLE_VISUALS[item.slug]||[item.left||'Pedri',item.right||'Jude Bellingham'];const base=item.votes||0;const live=voteCounts[item.slug]||{left:0,right:0};const seedL=Math.round(base*leanFor(item)/100);const l=seedL+live.left;const r=(base-seedL)+live.right;const total=l+r||1;const lpct=Math.round(l/total*100);const mine=myVotes[item.slug];const totalVotes=base+live.left+live.right;return <div className="battle-preview" key={item.slug}><div className="battle-preview__header"><span className="battle-preview__live"><i/>Live</span><span>{totalVotes.toLocaleString()} votes</span></div><div className="dv-players"><button type="button" className={`dv-player${mine==='left'?' is-voted':''}`} onClick={()=>voteBattle(item.slug,'left')} title={mine?'You voted':'Vote '+pair[0]}><ApiPlayerImage playerId={playerIdFor(pair[0])} name={pair[0]} fallbackSrc="/assets/players/neutral-player.svg"/><strong>{pair[0]}</strong></button><span className="dv-vs">vs</span><button type="button" className={`dv-player${mine==='right'?' is-voted':''}`} onClick={()=>voteBattle(item.slug,'right')} title={mine?'You voted':'Vote '+pair[1]}><ApiPlayerImage playerId={playerIdFor(pair[1])} name={pair[1]} fallbackSrc="/assets/players/neutral-player.svg"/><strong>{pair[1]}</strong></button></div><div className="dv-bar"><span style={{width:lpct+'%'}}/></div><div className="dv-foot"><span>{mine?'Your vote is in':'Split so far'}</span><strong>{lpct}% – {100-lpct}%</strong></div><button type="button" className="dv-title" onClick={()=>setForum(item)}>{item.title}</button><div className="dbx-battle-meta"><span className="dbx-battle-stats"><Eye size={13}/> {totalVotes.toLocaleString()} <MessageSquare size={13}/> {(item.comments||0).toLocaleString()}</span><span className="dbx-heat"><Flame size={14}/> {compact(totalVotes)}</span></div><div className="battle-preview__share"><ShareBar text={`${item.title} — ${pair[0]} vs ${pair[1]}. Settle it on Calibre.`} url={shareUrl('/debates')} label={false}/></div></div>})}</div><button type="button" className="dbx-scroller__arrow dbx-scroller__arrow--next" aria-label="More battles" onClick={()=>scrollBattles(1)}>›</button></div>}
      </section>

      <section className="debate-section"><div className="section-title-row"><div><span className="section-kicker"><Flame size={13}/> Hot potatoes</span><h2>Arguments that need a proper thread.</h2></div></div><div className="hot-potato-grid">{hot.map(item=>{const live=voteCounts[item.slug]||{left:0,right:0};const base=100;const y=Math.round(item.yes*base/100)+live.left;const n=(base-Math.round(item.yes*base/100))+live.right;const tot=y+n||1;const ypct=Math.round(y/tot*100);const mine=myVotes[item.slug];return <div className="panel hot-potato-card" key={item.slug}><button className="hot-potato-card__open" type="button" onClick={()=>setForum(item)}><span>HOT POTATO</span><h3>{item.title}</h3><p>{item.context}</p></button>{mine?<><div className="dv-bar"><span style={{width:ypct+'%'}}/></div><div className="dv-foot"><span>YES</span><strong>{ypct}% – {100-ypct}% NO</strong></div></>:<div className="dv-hp-vote"><button type="button" onClick={()=>voteBattle(item.slug,'left')}>YES</button><button type="button" onClick={()=>voteBattle(item.slug,'right')}>NO</button></div>}<div className="hot-potato-card__share"><ShareBar text={`${item.title} — ${ypct}% say YES on Calibre.`} url={shareUrl('/debates')} label={false}/></div><span className="dbx-fire">🔥</span></div>})}</div></section>

      <section className="debate-section"><div className="section-title-row"><div><span className="section-kicker"><MessageSquare size={13}/> Banger tweets</span><h2>Editorial picks from the football timeline.</h2></div></div><div className="banger-grid">{tweets.map((item,i)=><article className="panel banger-card" key={`${item.handle}-${i}`}><b>{item.handle}</b><p>“{item.text}”</p><small>♥ {item.likes} · ↻ {item.reposts||item.rt}</small></article>)}</div></section>

      <section className="panel goat-panel"><div className="goat-hero">{(()=>{const gt=goatCounts.total||0;const mpct=gt?Math.round(goatCounts.Messi/gt*100):50;return <><div className="goat-hero__lead"><span className="section-kicker">🐐 GOAT DEBATE</span><h2>Messi or Ronaldo?</h2><div className="dv-goat-count">{gt.toLocaleString()} votes cast</div>{goatNotice&&<p style={{margin:'8px 0 0',color:'#8b9096',fontSize:12}}>{goatNotice}</p>}<div className="goat-share"><ShareBar text={`Messi or Ronaldo? Cast your GOAT vote on Calibre.`} url={shareUrl('/debates')}/></div></div><div className="goat-hero__vote"><div className="dv-players"><button type="button" className={`dv-player${goat==='Messi'?' is-voted':''}`} onClick={()=>voteGoat('Messi')}><ApiPlayerImage playerId={playerIdFor('Lionel Messi')} name="Lionel Messi" fallbackSrc="/assets/players/neutral-player.svg"/><strong>Messi</strong></button><span className="dv-vs">VS</span><button type="button" className={`dv-player${goat==='Ronaldo'?' is-voted':''}`} onClick={()=>voteGoat('Ronaldo')}><ApiPlayerImage playerId={playerIdFor('Cristiano Ronaldo')} name="Cristiano Ronaldo" fallbackSrc="/assets/players/neutral-player.svg"/><strong>Ronaldo</strong></button></div><div className="dv-bar"><span style={{width:mpct+'%'}}/></div><div className="dv-foot"><span>{goat?'Your vote is in':'Split so far'}</span><strong>{mpct}% – {100-mpct}%</strong></div></div></>;})()}</div></section></main>

      <aside className="debate-rail">
        <div className="panel"><div className="panel-head"><div className="panel-title"><TrendingUp size={12}/> Trending this week</div></div>{trending.slice(0,5).map((item,index)=><button className="trending-debate-row" type="button" key={item.slug} onClick={()=>setForum(item)}><i>{index+1}</i><span><b>{item.title}</b><small>{(item.votes||0).toLocaleString()} votes · {item.comments||0} comments</small></span><ArrowRight size={13}/></button>)}</div>
        <div className="panel"><div className="panel-head"><div className="panel-title"><Trophy size={12}/> Top contributors</div></div>{CONTRIBUTORS.map((c,i)=><div className="dbx-contrib-row" key={c.name}><i>{i+1}</i><b>{c.name}</b><span>{c.pts.toLocaleString()} pts</span></div>)}</div>
        <div className="panel debate-account-card"><Users size={18}/><h3>{user?'Account connected':'Join the forums'}</h3><p>{user?`Posting as ${displayName}`:'A verified account is required to post and nominate debates.'}</p>{!user&&<button className="btn btn--lime btn--sm" type="button" onClick={()=>requestAuth('/debates')}>CREATE ACCOUNT</button>}</div>
      </aside></div>

      <div className="dbx-nominate panel"><MessageSquare size={22}/><div><b>Have a debate that needs to happen?</b><span>Nominate it and the community will decide.</span></div><button className="btn btn--lime" type="button" onClick={()=>setNominate(true)}>NOMINATE A DEBATE <ArrowRight size={14}/></button></div>
    </div>

    <div className="founder-strip"><Crown size={20}/><strong>Get World Cup Founder Pass</strong><span>Unlock premium debates, advanced filters and exclusive World Cup intelligence.</span><button className="btn btn--lime" type="button" onClick={()=>navigateTo('/pricing')}>EXPLORE PLANS <ArrowRight size={13}/></button></div>{nominate&&<NominateModal onClose={()=>setNominate(false)}/>} {forum&&<ForumModal slug={forum.slug} title={forum.title} onClose={()=>setForum(null)}/>}</div>;
}
