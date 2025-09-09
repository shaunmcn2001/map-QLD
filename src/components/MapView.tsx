import React, { useEffect, useRef } from "react";

type LatLng = google.maps.LatLngLiteral;

type Props = {
  parcels: Array<{ geometry: { type: string; coordinates: any }, centroid?: [number, number] }>;
  featuresByLayer: Record<string, Array<{ geometry: any; properties?: any; displayName?: string }>>;
};

function polygonToPaths(geom: any): LatLng[][] {
  const out: LatLng[][] = [];
  const rings = geom?.coordinates || [];
  for (const ring of rings) {
    out.push(ring.map(([x, y]: [number, number]) => ({ lat: y, lng: x })));
  }
  return out;
}

export default function MapView({ parcels, featuresByLayer }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<google.maps.Map | null>(null);
  const overlays = useRef<Array<google.maps.Polygon | google.maps.Polyline>>([]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!mapObj.current) {
      mapObj.current = new google.maps.Map(mapRef.current, {
        center: { lat: -27.4698, lng: 153.0251 },
        zoom: 7,
        mapTypeId: "terrain",
      });
    }

    overlays.current.forEach((o) => o.setMap(null));
    overlays.current = [];

    const map = mapObj.current;

    const bounds = new google.maps.LatLngBounds();
    parcels.forEach((p) => {
      const paths = polygonToPaths(p.geometry);
      if (paths.length === 0) return;
      const poly = new google.maps.Polygon({
        paths,
        strokeColor: "#111827",
        strokeOpacity: 1,
        strokeWeight: 2,
        fillOpacity: 0,
        map,
      });
      overlays.current.push(poly);
      paths[0].forEach((pt) => bounds.extend(pt));
    });

    const layerColors = ["#1f77b4", "#2ca02c", "#e76f51", "#9467bd", "#ff7f0e", "#8c564b"];
    const layerIds = Object.keys(featuresByLayer);
    layerIds.forEach((lid, idx) => {
      const color = layerColors[idx % layerColors.length];
      const feats = featuresByLayer[lid] || [];
      feats.forEach((f) => {
        const paths = polygonToPaths(f.geometry);
        if (paths.length === 0) return;
        const poly = new google.maps.Polygon({
          paths,
          strokeColor: color,
          strokeOpacity: 0.9,
          strokeWeight: 1,
          fillColor: color,
          fillOpacity: 0.25,
          map,
        });
        overlays.current.push(poly);
      });
    });

    if (!bounds.isEmpty()) map.fitBounds(bounds);
  }, [parcels, featuresByLayer]);

  return <div ref={mapRef} className="h-[400px] w-full rounded" />;
}
