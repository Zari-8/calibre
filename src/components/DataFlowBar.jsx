import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiStatus } from '../services/apiFootball.js';

function readStored() {
  try { return JSON.parse(window.localStorage.getItem('calibre:api-flow')) || null; }
  catch { return null; }
}

function isDebugMode() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('debug') === 'api' || window.localStorage.getItem('calibre:api-debug') === '1';
  } catch { return false; }
}

export default function DataFlowBar() {
  const [flow, setFlow] = useState(readStored);
  const [checking, setChecking] = useState(true);
  const debug = useMemo(isDebugMode, []);

  useEffect(() => {
    const update = event => setFlow(event.detail);
    window.addEventListener('calibre:api-flow', update);
    return () => window.removeEventListener('calibre:api-flow', update);
  }, []);

  const checkBridge = useCallback(async () => {
    setChecking(true);
    try { await getApiStatus({ force: true }); }
    finally { setChecking(false); }
  }, []);

  useEffect(() => {
    checkBridge();
    const timer = window.setInterval(checkBridge, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [checkBridge]);

  const connected = flow?.status === 'connected';
  const stamp = flow?.at ? new Date(flow.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className={`data-flow-bar data-flow-bar--public ${connected ? 'is-connected' : ''}`}>
      <div className="data-flow-bar__state"><i />{connected ? 'LIVE DATA' : (checking ? 'CHECKING LIVE DATA' : 'DATA SYNC RETRYING')}</div>
      <div className="data-flow-bar__detail">
        {connected
          ? <span>Updated {stamp || 'moments ago'}</span>
          : <span>Snapshot data remains available while the live feed reconnects.</span>}
      </div>
      {debug && (
        <div className="data-flow-bar__debug">
          <span>{flow?.source || 'no source'}</span><em>·</em>
          <span>{flow?.endpoint || 'status'}</span><em>·</em>
          <span>{flow?.records ?? 0} records</span>
          {flow?.remaining && <><em>·</em><span>{flow.remaining} requests remaining</span></>}
        </div>
      )}
      <button type="button" onClick={checkBridge} aria-label="Refresh live-data status"><RefreshCw size={13} className={checking ? 'spin' : ''} /></button>
    </div>
  );
}
