import React, { useEffect } from "react";
import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";

type LatLngTuple = [number, number];

type Props = {
  parcels: Array<{ geometry: { type: string; coordinates: any } }>;
  featuresByLayer: Record<string, Array<{ geometry: any }>>;
};

function polygonToLatLngs(geom: any): LatLngTuple[][] {
  const coords = geom?.coordinates || [];
  return coords.map((ring: any[]) =>
    ring.map(([x, y]: [number, number]) => [y, x] as LatLngTuple)
  );
}

function FitBounds({ parcels, features }: { parcels: any[]; features: any }) {
  const map = useMap();
  useEffect(() => {
    const allCoords: LatLngTuple[] = [];
    const pushCoords = (geom: any) => {
      polygonToLatLngs(geom).forEach((ring) => allCoords.push(...ring));
    };
    parcels.forEach((p) => pushCoords(p.geometry));
    Object.values(features).forEach((feats: any) =>
      (feats as any[]).forEach((f) => pushCoords(f.geometry))
    );
    if (allCoords.length > 0) {
      map.fitBounds(allCoords);
    }
  }, [map, parcels, features]);
  return null;
}

export default function MapView({ parcels, featuresByLayer }: Props) {
  const colors = ["#1f77b4", "#2ca02c", "#e76f51", "#9467bd", "#ff7f0e", "#8c564b"];

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
      {parcels.map((p, i) => (
        <Polygon
          key={`parcel-${i}`}
          positions={polygonToLatLngs(p.geometry)}
          pathOptions={{ color: "#000", weight: 2, fillOpacity: 0 }}
        />
      ))}
      {Object.entries(featuresByLayer).map(([lid, feats], idx) =>
        (feats || []).map((f, i) => (
          <Polygon
            key={`${lid}-${i}`}
            positions={polygonToLatLngs(f.geometry)}
            pathOptions={{ color: colors[idx % colors.length], weight: 1, fillOpacity: 0.3 }}
          />
        ))
      )}
      <FitBounds parcels={parcels} features={featuresByLayer} />
    </MapContainer>
  );
}
