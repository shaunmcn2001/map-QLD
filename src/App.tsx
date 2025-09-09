import React, { useEffect, useRef, useState } from 'react';
import MapView from '@/components/MapView';
import { normalizeLotPlan, resolveParcels, getLayers, intersectLayers, exportKmz } from '@/lib/gis';
import { fetchWithTimeout, withRetry } from '@/lib/http';
import type { LayerConfig, Parcel, Feature } from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

type Toast = { id: string; message: string; type: 'info' | 'error' | 'success' };
const ToastContext = React.createContext({ push: (_msg: string, _type?: Toast['type']) => {} });

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  };
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`rounded px-4 py-3 shadow text-white font-medium ${t.type==='error'?'bg-red-600':t.type==='success'?'bg-green-600':'bg-gray-800'}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
function useToast(){ return React.useContext(ToastContext); }

function DiagnosticsPanel(){
  const [logs,setLogs]=useState<string[]>([]);
  const ping=async(path:string,body?:any)=>{
    const t=performance.now();
    try{
      const res=await withRetry(()=>fetchWithTimeout(`${API_BASE}${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined}));
      const json=await res.json();
      const dt=Math.round(performance.now()-t);
      setLogs(l=>[...l,`${path} ${dt}ms ${JSON.stringify(json).slice(0,80)}`]);
    }catch(e:any){
      const dt=Math.round(performance.now()-t);
      setLogs(l=>[...l,`${path} ${dt}ms ERR ${e.message}`]);
    }
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded p-4 space-y-2">
      <div className="flex items-center justify-between"><span className="font-medium text-sm">Diagnostics</span><span className="text-xs text-gray-500">{API_BASE}</span></div>
      <div className="flex gap-2 flex-wrap">
        <button className="bg-gray-700 px-2 py-1 rounded text-xs" onClick={()=>ping('/layers')}>Ping layers</button>
        <button className="bg-gray-700 px-2 py-1 rounded text-xs" onClick={()=>ping('/parcel/resolve',{lotplan:'3/RP67254'})}>Resolve</button>
        <button className="bg-gray-700 px-2 py-1 rounded text-xs" onClick={()=>ping('/intersect',{parcel:{},layer_ids:[]})}>Intersect</button>
      </div>
      <pre className="text-xs max-h-40 overflow-auto whitespace-pre-wrap">{logs.join('\n')}</pre>
    </div>
  );
}

function App(){
  const toast=useToast();
  const [input,setInput]=useState('');
  const [debounced,setDebounced]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [layers,setLayers]=useState<LayerConfig[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [parcels,setParcels]=useState<Parcel[]>([]);
  const [featuresByLayer,setFeaturesByLayer]=useState<Record<string,Feature[]>>({});
  const abortRef=useRef<AbortController|null>(null);

  useEffect(()=>{const id=setTimeout(()=>setDebounced(input),400);return()=>clearTimeout(id);},[input]);
  useEffect(()=>{getLayers().then(setLayers).catch(e=>{setError('Failed to load layers');toast.push(e.message||'Failed to load layers','error');});},[toast]);

  const runSearch=async()=>{
    if(!debounced.trim()) return;
    abortRef.current?.abort();
    const ctrl=new AbortController();
    abortRef.current=ctrl;
    setLoading(true);setError(null);
    try{
      const norm=normalizeLotPlan(debounced);
      const ps=await resolveParcels(norm,ctrl.signal);
      if(!ps.length) throw new Error('Parcel not found');
      const parcel=ps[0];
      setParcels([parcel]);
      const feats=selected.length?await intersectLayers(parcel,selected,ctrl.signal):{};
      setFeaturesByLayer(feats);
    }catch(e:any){
      if(e.name!=='AbortError'){
        const msg=e.message||'Search failed';
        setError(msg);toast.push(msg,'error');
      }
    }finally{setLoading(false);}
  };

  const runExport=async()=>{
    if(!parcels[0]) return;
    try{
      const subset = selected.reduce<Record<string, Feature[]>>((acc,id)=>{ if(featuresByLayer[id]) acc[id]=featuresByLayer[id]; return acc; },{});
      await exportKmz(parcels[0],subset);
      toast.push('Export started','success');
    }catch(e:any){toast.push(e.message||'Export failed','error');}
  };

  const canSearch=debounced===input && debounced.trim().length>0 && !loading;
  const canExport=parcels.length>0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">QLD Parcel Viewer</h1>
        {error && <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 rounded">{error}</div>}
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="space-y-4 w-full lg:w-80">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2">
              <label className="text-sm font-medium">Lot/Plan</label>
              <input value={input} onChange={e=>setInput(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700" />
              <div className="flex gap-2 mt-2">
                <button onClick={runSearch} disabled={!canSearch} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded disabled:opacity-50">{loading?'Working…':'Search'}</button>
                <button onClick={runExport} disabled={!canExport} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded disabled:opacity-50">Export KMZ</button>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">Available Datasets</span><span className="text-xs text-gray-500">{selected.length} selected</span></div>
              <div className="max-h-80 overflow-auto space-y-2 pr-2">
                {layers.map(l=>(
                  <label key={l.id} className="flex items-center gap-2 p-2 rounded bg-gray-800/50 hover:bg-gray-800 cursor-pointer">
                    <input type="checkbox" checked={selected.includes(l.id)} onChange={()=>setSelected(s=>s.includes(l.id)?s.filter(x=>x!==l.id):[...s,l.id])} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{l.label}</span>
                      <span className="block text-xs text-gray-500 truncate">{l.id}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            {import.meta.env.DEV && <DiagnosticsPanel/>}
          </div>
          <div className="flex-1 min-h-[600px]">
            <MapView parcels={parcels} featuresByLayer={featuresByLayer} />
          </div>
        </div>
        <footer className="text-center text-gray-500 text-sm border-t border-gray-900 pt-6">API: <code className="bg-gray-900 px-2 py-1 rounded">{API_BASE}</code></footer>
      </div>
      {loading && <div className="fixed inset-0 bg-black/40 flex items-center justify-center"><div className="w-8 h-8 border-4 border-gray-500 border-t-white rounded-full animate-spin"/></div>}
    </div>
  );
}

export default function AppWithToast(){
  return (
    <ToastProvider>
      <App/>
    </ToastProvider>
  );
}
