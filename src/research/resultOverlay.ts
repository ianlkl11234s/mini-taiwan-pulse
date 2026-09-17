import type { Map, GeoJSONSource, LayerSpecification } from "maplibre-gl";
import type { FeatureCollection } from "geojson";

/** One research-only host; it never registers artifacts as permanent site layers. */
export const RESULT_HOST = {
  id: "analysis:preview:result",
  label: "合成研究成果",
  colors: { point: "#176c63", line: "#b57539", polygon: "#6486a0" },
  opacity: 0.85,
} as const;
export const RESULT_LAYER_IDS = ["point", "line", "outline", "polygon"].map(k => `${RESULT_HOST.id}:${k}`);

export function resultLayers(opacity: number): LayerSpecification[] {
  const id = RESULT_HOST.id;
  return [
    { id: `${id}:polygon`, type: "fill", source: id, filter: ["==", "$type", "Polygon"], paint: { "fill-color": RESULT_HOST.colors.polygon, "fill-opacity": opacity * 0.35 } },
    { id: `${id}:outline`, type: "line", source: id, filter: ["==", "$type", "Polygon"], paint: { "line-color": RESULT_HOST.colors.polygon, "line-width": 1.5, "line-opacity": opacity } },
    { id: `${id}:line`, type: "line", source: id, filter: ["==", "$type", "LineString"], paint: { "line-color": RESULT_HOST.colors.line, "line-width": 3, "line-opacity": opacity } },
    { id: `${id}:point`, type: "circle", source: id, filter: ["==", "$type", "Point"], paint: { "circle-color": RESULT_HOST.colors.point, "circle-radius": 7, "circle-opacity": opacity, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2, "circle-stroke-opacity": opacity } },
  ];
}

export function installResult(map: Map, data: FeatureCollection, opacity: number): void {
  const source = map.getSource(RESULT_HOST.id) as GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource(RESULT_HOST.id, { type: "geojson", data, generateId: true });
  for (const layer of resultLayers(opacity)) if (!map.getLayer(layer.id)) map.addLayer(layer);
  setResultOpacity(map, opacity);
}

export function setResultOpacity(map: Map, opacity: number): void {
  const value = Math.max(0, Math.min(1, opacity));
  for (const layer of resultLayers(value)) {
    if (!map.getLayer(layer.id)) continue;
    for (const [property, paint] of Object.entries(layer.paint ?? {})) map.setPaintProperty(layer.id, property, paint);
  }
}

export function removeResult(map: Map): void {
  for (const id of RESULT_LAYER_IDS) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(RESULT_HOST.id)) map.removeSource(RESULT_HOST.id);
}
