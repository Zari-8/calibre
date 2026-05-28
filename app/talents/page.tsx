'use client';
import { useState } from 'react';
import { talents } from '@/lib/data';
import { ProLock } from '@/components/ProLock';

export default function TalentsPage() {
  const [region,setRegion]=useState('All');
  const [gender,setGender]=useState('All');
  const filtered=talents.filter(t=>(region==='All'||t.region===region)&&(gender==='All'||t.gender===gender));
  return (
    <main className="container section">
      <span className="kicker">Talent Map</span>
      <h1>Find the next argument before everyone else.</h1>
      <p className="lead">Global U23 and women’s football discovery with a launch focus on Europe, Africa, South America and Nigeria-first traction.</p>
      <div className="grid grid-2" style={{margin:'24px 0'}}>
        <select value={region} onChange={e=>setRegion(e.target.value)}><option>All</option><option>Europe</option><option>Africa</option><option>South America</option></select>
        <select value={gender} onChange={e=>setGender(e.target.value)}><option>All</option><option>Men</option><option>Women</option></select>
      </div>
      <div className="grid grid-3">
        {filtered.map(t=>(
          <div className="card" key={t.name}>
            <span className="pill">{t.region} · {t.gender}</span>
            <h2>{t.name}</h2>
            <p><strong>{t.category}</strong></p>
            <div className="stat">{t.upside}</div>
            <p className="muted">{t.note}</p>
          </div>
        ))}
      </div>
      <div style={{marginTop:16}}><ProLock title="Unlock full scouting watchlists and talent alerts" /></div>
    </main>
  );
}
