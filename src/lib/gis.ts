// Backend integration for GIS helpers (KMZ-only export)

import type { LayerConfig, Parcel, Feature } from '@/types';
import { fetchWithTimeout, withRetry } from '@/lib/http';

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function assertOk(res: Response) {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
}

function toParcel(lotPlan: string, geojson: any): Parcel {
  let cx = 0, cy = 0, n = 0;
  const ring = geojson?.coordinates?.[0] || [];
  for (const [x, y] of ring) { cx += x; cy += y; n++; }
  const centroid: [number, number] = n ? [cx / n, cy / n] : [0, 0];
  return { id: lotPlan, lotPlan, geometry: geojson, area: 0, centroid };
}

export function normalizeLotPlan(input: string): string[] {
  const s = (input || "").toUpperCase().replace(/\s+/g, "");
  if (!s) return [];
  const noL = s.replace(/^L/, "");
  if (noL.includes("/")) {
    const [lot, plan] = noL.split("/", 2);
    return [`${lot}/${plan}`];
  }
  const digits = noL.match(/^\d+/);
  if (!digits) return [noL];
  let lot = digits[0];
  let rest = noL.slice(lot.length);
  if (/^[A-Z]{1,4}\d{1,7}$/.test(rest)) return [`${lot}/${rest}`];
  if (rest.length > 0) {
    lot += rest[0];
    const plan = rest.slice(1);
    if (/^[A-Z]{1,4}\d{1,7}$/.test(plan)) return [`${lot}/${plan}`];
  }
  return [noL];
}

export async function resolveParcels(normalized: string[], signal?: AbortSignal): Promise<Parcel[]> {
  const parcels: Parcel[] = [];
  for (const lp of normalized) {
    const r = await withRetry(() =>
      fetchWithTimeout(`${API_BASE}/parcel/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lotplan: lp }),
        signal,
      })
    );
    assertOk(r);
    const data = await r.json();
    if (data?.parcel) parcels.push(toParcel(lp, data.parcel));
  }
  return parcels;
}

export async function getLayers(): Promise<LayerConfig[]> {
  const r = await withRetry(() =>
    fetchWithTimeout(`${API_BASE}/layers`, { timeoutMs: 20000 })
  );
  assertOk(r);
  const json = await r.json();
  const arr = (json?.layers || []) as any[];
  return arr.map((l: any) => ({
    id: l.id,
    label: l.label || l.id,
    url: l.url,
    description: l.description || "",
    fields: {
      include: (l.fields?.include ?? []),
      aliases: (l.fields?.aliases ?? {}),
    },
    nameTemplate: l.name_template || l.nameTemplate || l.label || l.id,
    style: {
      lineWidth: l.style?.line_width ?? 1,
      lineOpacity: l.style?.line_opacity ?? 0.9,
      polyOpacity: l.style?.poly_opacity ?? 0.3,
      color: l.style?.color ?? "#4f46e5",
    },
    popup: {
      order: l.popup?.order ?? [],
      hideNull: l.popup?.hide_null ?? true,
    },
  }));
}

export async function intersectLayers(parcel: Parcel, layerIds: string[], signal?: AbortSignal): Promise<Record<string, Feature[]>> {
  const r = await withRetry(() =>
    fetchWithTimeout(`${API_BASE}/intersect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcel: parcel.geometry, layer_ids: layerIds }),
      signal,
    })
  );
  assertOk(r);
  const data = await r.json();
  const out: Record<string, Feature[]> = {};
  for (const layer of data.layers || []) {
    const feats: Feature[] = [];
    for (const f of layer.features || []) {
      feats.push({
        id: String(f.attrs?.OBJECTID ?? crypto.randomUUID()),
        geometry: f.geometry,
        properties: f.attrs ?? {},
        layerId: layer.id,
        displayName: f.name ?? layer.label ?? layer.id,
      });
    }
    out[layer.id] = feats;
  }
  return out;
}

export async function exportKmz(parcel: Parcel, features: Record<string, Feature[]>) {
  const layers = Object.entries(features).map(([id, feats]) => ({
    id,
    label: id,
    features: feats.map(f => ({ geometry: f.geometry, attrs: f.properties, name: f.displayName })),
    style: {},
  }));
  const r = await withRetry(() =>
    fetchWithTimeout(`${API_BASE}/export/kml`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcel: parcel.geometry, layers }),
    })
  );
  assertOk(r);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "export.kmz";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
