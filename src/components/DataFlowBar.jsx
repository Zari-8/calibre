import { Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getApiStatus } from '../services/apiFootball.js';

function readStored() {
  try { return JSON.parse(window.localStorage.getItem('calibre:api-flow')) || null; }
  catch { return null; }
}

export default function DataFlowBar() {
  const [flow, setFlow] = useState(readStored);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const update = event => setFlow(event.detail);
    window.addEventListener('calibre:api-flow', update);
    return () => window.removeEventListener('calibre:api-flow', update);
  }, []);

  async function checkBridge() {
    setChecking(true);
    await getApiStatus();
    setChecking(false);
  }

  const connected = flow?.status === 'connected';
  const stamp = flow?.at ? new Date(flow.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'not checked';

  return (
    <div className={`data-flow-bar ${connected ? 'is-connected' : ''}`}>
      <div className="data-flow-bar__title"><Database size={14} /><b>CALIBRE DATA BRIDGE</b></div>
      <div className="data-flow-bar__state"><i />{connected ? 'CONNECTED' : 'SNAPSHOT MODE'}</div>
      <div className="data-flow-bar__detail">
        {connected
          ? <><ShieldCheck size={13} /><span>{flow.source}</span><em>·</em><span>{flow.endpoint}</span><em>·</em><span>{flow.records ?? 0} records</span>{flow.remaining && <><em>·</em><span>{flow.remaining} requests remaining</span></>}</>
          : <span>Add <b>API_FOOTBALL_KEY</b> in Vercel to activate live data.</span>}
      </div>
      <small>{stamp}</small>
      <button type="button" onClick={checkBridge} aria-label="Check API bridge"><RefreshCw size={13} className={checking ? 'spin' : ''} /></button>
    </div>
  );
}
