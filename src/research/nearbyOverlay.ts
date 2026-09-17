import type { Map, GeoJSONSource } from "mapbox-gl";
import type { FeatureCollection, Feature, Geometry } from "geojson";

export const NEARBY_SOURCE = "research-nearby";
export const NEARBY_LAYERS = ["research-nearby-radius"];
export type NearbyMapResult = { center: { lng: number; lat: number }; radiusM: number; rows: Array<{ id: string; name: string; coordinates: [number, number]; distanceM: number }> };

export function nearbyGeometry(result: NearbyMapResult): FeatureCollection {
  const { lng, lat } = result.center;
  const rad = Math.PI / 180, angular = result.radiusM / 6371008.8;
  const ring: [number,number][] = [];
  for (let i = 0; i <= 64; i++) {
    const bearing = i / 64 * Math.PI * 2;
    const phi = Math.asin(Math.sin(lat * rad) * Math.cos(angular) + Math.cos(lat * rad) * Math.sin(angular) * Math.cos(bearing));
    const lambda = lng * rad + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat * rad), Math.cos(angular) - Math.sin(lat * rad) * Math.sin(phi));
    ring.push([lambda / rad, phi / rad]);
  }
  const features: Feature<Geometry>[] = [
    { type: "Feature", properties: { kind: "radius" }, geometry: { type: "LineString", coordinates: ring } },
  ];
  return { type: "FeatureCollection", features };
}

/** Transient analysis output, separate from the permanent source layer catalogue. */
export function installNearbyOverlay(map: Map, result: NearbyMapResult, opacity: number): void {
  // Remove point overlays left by an already open page during a hot update.
  for (const id of ["research-nearby-origin", "research-nearby-points"]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  const data = nearbyGeometry(result);
  const source = map.getSource(NEARBY_SOURCE) as GeoJSONSource | undefined;
  if (source) source.setData(data); else map.addSource(NEARBY_SOURCE, { type: "geojson", data });
  if (!map.getLayer(NEARBY_LAYERS[0]!)) map.addLayer({ id: NEARBY_LAYERS[0]!, type: "line", source: NEARBY_SOURCE, filter: ["==", "kind", "radius"], paint: { "line-color": "#f4c578", "line-width": 2, "line-dasharray": [3,2] } });
  setNearbyOpacity(map, opacity);
}
export function setNearbyOpacity(map: Map, opacity: number): void {
  const value = Math.max(0, Math.min(1, opacity));
  for (const id of NEARBY_LAYERS) if (map.getLayer(id)) {
    map.setPaintProperty(id, "line-opacity", value);
  }
}
export function removeNearbyOverlay(map: Map): void {
  for (const id of NEARBY_LAYERS) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(NEARBY_SOURCE)) map.removeSource(NEARBY_SOURCE);
}
