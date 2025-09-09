export type Parcel = {
  id: string;
  lotPlan: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
  centroid?: [number, number];
  area?: number;
};

export type Feature = {
  id: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: Record<string, any>;
  layerId: string;
  displayName?: string;
};

export type LayerConfig = {
  id: string;
  label: string;
  url?: string;
  description?: string;
  fields?: {
    include?: string[];
    aliases?: Record<string, string>;
  };
  nameTemplate?: string;
  style?: {
    lineWidth?: number;
    lineOpacity?: number;
    polyOpacity?: number;
    color?: string;
  };
  popup?: {
    order?: string[];
    hideNull?: boolean;
  };
};
