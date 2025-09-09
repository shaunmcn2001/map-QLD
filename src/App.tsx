// src/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useToast } from "./components/Toast";
import LoadingOverlay from "./components/LoadingOverlay";
import MapView from "./components/MapView";

import {
  normalizeLotPlan,
  resolveParcels,
  getLayers,
  intersectLayers,
  exportData,
} from "./lib/gis";

type LayerMeta = { id: string; label: string };

export default function App() {
  const [lotplan, setLotplan] = useState("3/RP67254");

  const [layers, setLayers] = useState<LayerMeta[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parcels, setParcels] = useState<any[]>([]);
  const [featuresByLayer, setFeaturesByLayer] = useState<Record<string, any[]>>({});

  const toast = useToast();

  useEffect(() => {
    getLayers()
      .then((arr) => {
        setLayers(arr);
        setSelected(arr.slice(0, 2).map(l => l.id));
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
      const inter = await intersectLayers(resolved[0], selected);
      setFeaturesByLayer(inter);
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
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">map-QLD</h1>
        <p className="text-slate-600">
          Enter a Queensland Lot/Plan, pick datasets, intersect, and export KMZ.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-[2fr_3fr]">
        <div className="space-y-3">
          <label className="block text-sm font-medium">Lot/Plan</label>
          <input
            value={lotplan}
            onChange={(e) => setLotplan(e.target.value)}
            placeholder="e.g. 3/RP67254 or 3RP67254"
            className="w-full rounded-lg border bg-white p-3 shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={runIntersect}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Working…" : "Resolve & Intersect"}
            </button>
            <button
              onClick={runExport}
              disabled={!canExport}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-white shadow hover:bg-emerald-700 disabled:opacity-50"
            >
              Export KMZ
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Datasets</label>
            <div className="max-h-60 overflow-auto rounded-lg border bg-white p-3 shadow-sm">
              {layers.length === 0 ? (
                <p className="text-sm text-slate-500">No layers available. Check backend /layers and CORS.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {layers.map((l) => (
                    <label key={l.id} className="flex items-center gap-2 rounded border p-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(l.id)}
                        onChange={() => {
                          if (selected.includes(l.id))
                            setSelected(selected.filter((x) => x !== l.id));
                          else setSelected([...selected, l.id]);
                        }}
                      />
                      <span className="font-medium">{l.label}</span>
                      <span className="text-xs text-slate-500 ml-auto">{l.id}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-2 shadow-sm min-h-[420px]">
          <MapView parcels={parcels} featuresByLayer={featuresByLayer} />
        </div>
      </section>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <footer className="pt-6 text-xs text-slate-500">
        API: <code>{import.meta.env.VITE_API_BASE || "http://localhost:8000"}</code>
      </footer>

      <LoadingOverlay show={loading} label={error ? "Retrying…" : "Working…"} />
    </div>
  );
}
