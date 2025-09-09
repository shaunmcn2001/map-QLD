import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";

type LatLngTuple = [number, number];

type Props = {
  parcels: Array<{ id: string; geometry: { type: string; coordinates: any } }>;
  featuresByLayer: Record<string, Array<{ id: string; geometry: any }>>;
};

function polygonToLatLngs(geom: any): LatLngTuple[][] {
  const coords = geom?.coordinates || [];
  return coords.map((ring: any[]) =>
    ring.map(([x, y]: [number, number]) => [y, x] as LatLngTuple)
  );
}

function FitBounds({ parcels, features, cache }: { parcels: any[]; features: any; cache: Map<string, LatLngTuple[][]> }) {
  const map = useMap();
  useEffect(() => {
    const allCoords: LatLngTuple[] = [];
    const pushCoords = (id: string, geom: any) => {
      const latlngs = cache.get(id) || polygonToLatLngs(geom);
      cache.set(id, latlngs);
      latlngs.forEach((ring) => allCoords.push(...ring));
    };
    parcels.forEach((p) => pushCoords(p.id, p.geometry));
    Object.values(features).forEach((feats: any) =>
      (feats as any[]).forEach((f) => pushCoords(f.id, f.geometry))
    );
    if (allCoords.length > 0) {
      map.fitBounds(allCoords);
    }
  }, [map, parcels, features, cache]);
  return null;
}

export default function MapView({ parcels, featuresByLayer }: Props) {
  const colors = ["#1f77b4", "#2ca02c", "#e76f51", "#9467bd", "#ff7f0e", "#8c564b"];
  const cache = useRef<Map<string, LatLngTuple[][]>>(new Map());

  return (
    <MapContainer
      className="h-[400px] w-full rounded"
      center={[-27.47, 153.02]}
      zoom={6}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {parcels.map((p) => {
        const latlngs = cache.current.get(p.id) || polygonToLatLngs(p.geometry);
        cache.current.set(p.id, latlngs);
        return (
          <Polygon
            key={`parcel-${p.id}`}
            positions={latlngs}
            pathOptions={{ color: "#000", weight: 2, fillOpacity: 0 }}
          />
        );
      })}
      {Object.entries(featuresByLayer).map(([lid, feats], idx) =>
        (feats || []).map((f) => {
          const latlngs = cache.current.get(f.id) || polygonToLatLngs(f.geometry);
          cache.current.set(f.id, latlngs);
          return (
            <Polygon
              key={`${lid}-${f.id}`}
              positions={latlngs}
              pathOptions={{ color: colors[idx % colors.length], weight: 1, fillOpacity: 0.3 }}
            />
          );
        })
      )}
      <FitBounds parcels={parcels} features={featuresByLayer} cache={cache.current} />
    </MapContainer>
  );
}
