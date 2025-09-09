import React, { useEffect, useMemo, useState } from "react";

// API Base URL - use environment variable or fallback
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:8000";

// Types
type LayerMeta = { id: string; label: string };

// Toast Context (simplified inline version)
const ToastContext = React.createContext({ push: (msg: string, type?: string) => {} });

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: string }>>([]);
  
  const push = (message: string, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`rounded px-4 py-3 shadow text-white font-medium ${
              t.type === "error" ? "bg-red-600" :
              t.type === "success" ? "bg-green-600" :
              "bg-gray-800"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useToast() {
  return React.useContext(ToastContext);
}

// GIS Functions
function normalizeLotPlan(input: string): string[] {
  const s = (input || "").trim().toUpperCase();
  if (!s) return [];
  if (s.includes("/")) {
    const [lot, plan] = s.split("/", 2);
    return [`${lot.trim().replace(/^L/, "")}/${plan.trim().replace(/\s+/g, "")}`];
  }
  const m = s.match(/^L?(\w+?)([A-Z]{1,4}\s*\d{1,7})$/);
  if (m) return [`${m[1]}/${m[2].replace(/\s+/g, "")}`];
  return [s];
}

async function fetchWithTimeout(url: string, options: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 40000, ...rest } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...rest, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i === retries) break;
      await new Promise(resolve => setTimeout(resolve, 600 * Math.pow(2, i)));
    }
  }
  throw lastError;
}

async function getLayers(): Promise<LayerMeta[]> {
  const response = await withRetry(() => fetchWithTimeout(`${API_BASE}/layers`));
  const json = await response.json();
  const arr = (json?.layers || []) as any[];
  return arr.map((l: any) => ({
    id: l.id,
    label: l.label || l.id,
  }));
}

async function resolveParcels(normalized: string[]): Promise<any[]> {
  const parcels: any[] = [];
  for (const lp of normalized) {
    const response = await withRetry(() =>
      fetchWithTimeout(`${API_BASE}/parcel/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lotplan: lp }),
      })
    );
    const data = await response.json();
    if (data?.parcel) {
      parcels.push({
        id: lp,
        lotPlan: lp,
        geometry: data.parcel,
      });
    }
  }
  return parcels;
}

async function intersectLayers(parcel: any, layerIds: string[]): Promise<Record<string, any[]>> {
  const response = await withRetry(() =>
    fetchWithTimeout(`${API_BASE}/intersect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcel: parcel.geometry, layer_ids: layerIds }),
    })
  );
  const data = await response.json();
  const out: Record<string, any[]> = {};
  for (const layer of (data.layers || [])) {
    const features: any[] = [];
    for (const f of (layer.features || [])) {
      features.push({
        id: String(f.attrs?.OBJECTID ?? Math.random().toString(36).slice(2)),
        geometry: f.geometry,
        properties: f.attrs ?? {},
        layerId: layer.id,
        displayName: f.name ?? layer.label ?? layer.id,
      });
    }
    out[layer.id] = features;
  }
  return out;
}

async function exportData(parcel: any, features: Record<string, any[]>) {
  const layers = Object.entries(features).map(([id, feats]) => ({
    id,
    label: id,
    features: feats.map(f => ({ 
      geometry: f.geometry, 
      attrs: f.properties, 
      name: f.displayName 
    })),
    style: {},
  }));
  
  const response = await withRetry(() =>
    fetchWithTimeout(`${API_BASE}/export/kml`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcel: parcel.geometry, layers }),
    })
  );
  
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "export.kmz";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Components
function LoadingOverlay({ show, label = "Working…" }: { show: boolean; label?: string }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-gray-900/95 backdrop-blur-xl rounded-lg p-8 shadow-2xl border border-gray-700">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-8 h-8 border-4 border-gray-600 rounded-full animate-spin border-t-white"></div>
            <div className="absolute top-0 left-0 w-8 h-8 border-4 border-transparent rounded-full animate-ping border-t-gray-400"></div>
          </div>
          <span className="font-semibold text-gray-100 text-lg">{label}</span>
        </div>
      </div>
    </div>
  );
}

function MapView({ parcels, featuresByLayer }: { parcels: any[]; featuresByLayer: Record<string, any[]> }) {
  const hasData = parcels.length > 0 || Object.keys(featuresByLayer).length > 0;
  
  return (
    <div className="h-full w-full rounded-lg overflow-hidden relative group bg-gray-900">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="w-full h-full" style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}></div>
        </div>
      </div>
      
      <div className="relative z-10 h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-200">
              {hasData ? "Interactive Map" : "Enter a lot/plan to begin"}
            </h3>
            <p className="text-gray-400 max-w-xs">
              {hasData 
                ? "Your parcel and intersected layers will appear here" 
                : "Try entering something like '3/RP67254' and hit resolve"
              }
            </p>
          </div>
        </div>
      </div>
      
      {/* Subtle border on hover */}
      <div className="absolute inset-0 rounded-lg border border-transparent group-hover:border-gray-600 transition-colors duration-300"></div>
    </div>
  );
}

function App() {
  const [lotplan, setLotplan] = useState("3/RP67254");
  const [layers, setLayers] = useState<LayerMeta[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parcels, setParcels] = useState<any[]>([]);
  const [featuresByLayer, setFeaturesByLayer] = useState<Record<string, any[]>>({});

  const toast = useToast();

  // Load layers on mount
  useEffect(() => {
    getLayers()
      .then((layerList) => {
        setLayers(layerList);
        setSelected(layerList.slice(0, 2).map(l => l.id));
      })
      .catch((e) => setError(String(e)));
  }, []);

  async function runIntersect() {
    setError(null);
    setLoading(true);
    setFeaturesByLayer({});
    
    try {
      toast.push("Resolving parcel…");
      const normalized = normalizeLotPlan(lotplan);
      const resolved = await resolveParcels(normalized);
      
      if (!resolved.length || !resolved[0]?.geometry) {
        setParcels([]);
        throw new Error("Parcel not found for that lot/plan.");
      }
      
      setParcels(resolved);
      toast.push("Parcel resolved", "success");

      if (selected.length === 0) {
        toast.push("No layers selected — showing parcel only", "info");
        setLoading(false);
        return;
      }

      toast.push("Intersecting layers…");
      const intersected = await intersectLayers(resolved[0], selected);
      setFeaturesByLayer(intersected);
      toast.push("Intersect complete", "success");
    } catch (e: any) {
      setError(e?.message || String(e));
      toast.push(e?.message || String(e), "error");
    } finally {
      setLoading(false);
    }
  }

  async function runExport() {
    if (!parcels.length) return;
    try {
      toast.push("Preparing KMZ…");
      await exportData(parcels[0], featuresByLayer);
      toast.push("Download started", "success");
    } catch (e: any) {
      setError(e?.message || String(e));
      toast.push(e?.message || String(e), "error");
    }
  }

  const canExport = useMemo(() => parcels.length > 0, [parcels]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl p-6 space-y-8">
        {/* Minimal Header */}
        <header className="text-center space-y-4 py-8">
          <h1 className="text-5xl font-light text-white tracking-tight">
            map-QLD
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Queensland property insights. Enter lot/plan, explore datasets, export KMZ.
          </p>
        </header>

        {/* Main Content Grid */}
        <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
          {/* Control Panel */}
          <div className="space-y-6">
            {/* Lot/Plan Input */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">Property Identifier</label>
              <div className="relative">
                <input
                  value={lotplan}
                  onChange={(e) => setLotplan(e.target.value)}
                  placeholder="e.g. 3/RP67254 or 3RP67254"
                  className="w-full rounded border border-gray-700 bg-gray-800 p-4 text-lg text-white placeholder-gray-500 outline-none transition-all duration-200 focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={runIntersect}
                disabled={loading}
                className="flex-1 bg-white text-black px-6 py-4 rounded font-medium hover:bg-gray-200 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-black/30 rounded-full animate-spin border-t-black"></div>
                    Working…
                  </span>
                ) : (
                  "Resolve & Intersect"
                )}
              </button>
              
              <button
                onClick={runExport}
                disabled={!canExport}
                className="bg-gray-800 border border-gray-700 text-white px-6 py-4 rounded font-medium hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export KMZ
              </button>
            </div>

            {/* Dataset Selection */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-gray-300">Available Datasets</label>
                <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full">
                  {selected.length} selected
                </span>
              </div>
              
              <div className="max-h-80 overflow-auto space-y-2 pr-2">
                {layers.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No layers available. Check backend connection.
                  </p>
                ) : (
                  layers.map((layer) => (
                    <label
                      key={layer.id}
                      className="flex items-center gap-3 p-3 rounded border border-gray-800 bg-gray-800/50 hover:bg-gray-800 cursor-pointer transition-colors duration-200"
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={selected.includes(layer.id)}
                          onChange={() => {
                            if (selected.includes(layer.id))
                              setSelected(selected.filter((x) => x !== layer.id));
                            else setSelected([...selected, layer.id]);
                          }}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center ${
                          selected.includes(layer.id)
                            ? 'bg-white border-white'
                            : 'bg-transparent border-gray-600'
                        }`}>
                          {selected.includes(layer.id) && (
                            <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-200 block truncate">
                          {layer.label}
                        </span>
                        <span className="text-xs text-gray-500 block truncate">
                          {layer.id}
                        </span>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Map Container */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 min-h-[600px]">
            <MapView parcels={parcels} featuresByLayer={featuresByLayer} />
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-300">{error}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center py-8 border-t border-gray-900">
          <div className="inline-flex items-center gap-2 text-gray-500">
            <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
            <span className="text-sm">
              API: <code className="bg-gray-900 px-2 py-1 rounded text-xs">{API_BASE}</code>
            </span>
          </div>
        </footer>
      </div>

      <LoadingOverlay show={loading} label={error ? "Retrying…" : "Working…"} />
    </div>
  );
}

export default function AppWithToast() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}