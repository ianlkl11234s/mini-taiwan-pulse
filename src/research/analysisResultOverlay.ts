import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import type { GeoJSONSource, Map } from "mapbox-gl";
import { schoolLevelColorExpr } from "../data/educationTypes";
import type { PresentableResult } from "./researchAnalysisSession";

const MAX_RESULTS = 4;
const COLORS = ["#00b8d9", "#ff8f00", "#d81b60", "#7e57c2"];
const sourceId = (index: number) => `research-analysis-result-${index}`;
const layerId = (index: number) => `research-analysis-result-points-${index}`;

function collection(result: PresentableResult): FeatureCollection<Point | Polygon> {
  const features: Feature<Point | Polygon>[] = result.rows.flatMap<Feature<Point | Polygon>>((row, rowIndex) => {
    const geometry = row.geometry as { type?: unknown; coordinates?: unknown } | undefined;
    if (geometry?.type === "Polygon" && result.datasetId === "tw-schools-grid-150m") {
      return [{ type: "Feature", id: `${result.resultId}:${rowIndex}`, properties: { ...Object.fromEntries(Object.entries(row).filter(([key, value]) => key !== "geometry" && (value === null || ["string", "number", "boolean"].includes(typeof value)))), resultId: result.resultId, datasetId: result.datasetId }, geometry: geometry as Polygon }];
    }
    if (geometry?.type !== "Point" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2) return [];
    const [lng, lat] = geometry.coordinates;
    if (typeof lng !== "number" || !Number.isFinite(lng) || typeof lat !== "number" || !Number.isFinite(lat)) return [];
    const properties = Object.fromEntries(Object.entries(row).filter(([key, value]) => key !== "geometry" && (value === null || ["string", "number", "boolean"].includes(typeof value))));
    return [{ type: "Feature", id: `${result.resultId}:${rowIndex}`, properties: { ...properties, resultId: result.resultId, datasetId: result.datasetId }, geometry: { type: "Point", coordinates: [lng, lat] } }];
  });
  return { type: "FeatureCollection", features };
}

/** Transient result layers are independent of the permanent layer catalogue. */
export function installAnalysisResults(map: Map, results: readonly PresentableResult[], opacity = 0.55): void {
  if (results.length > MAX_RESULTS) throw new Error("TOO_MANY_PRESENTED_RESULTS");
  results.forEach((result, index) => {
    const source = map.getSource(sourceId(index)) as GeoJSONSource | undefined;
    const data = collection(result);
    if (source) source.setData(data); else map.addSource(sourceId(index), { type: "geojson", data });
    const polygon = result.geometry.type === "Polygon";
    const existing = map.getLayer(layerId(index));
    if (existing && existing.type !== (polygon ? "fill" : "circle")) map.removeLayer(layerId(index));
    if (polygon) {
      if (!map.getLayer(layerId(index))) map.addLayer({ id: layerId(index), type: "fill", source: sourceId(index), paint: {
        "fill-color": ["step", ["get", "source_place_record_count"], "#7dd3fc", 2, "#0284c7", 4, "#075985"],
        "fill-opacity": opacity, "fill-outline-color": "#bae6fd",
      } });
    } else if (!map.getLayer(layerId(index))) map.addLayer({
      id: layerId(index), type: "circle", source: sourceId(index),
      paint: {
        "circle-color": result.presentation ? ["step", ["get", result.presentation.countField], "#bae6fd", 5, "#0284c7", 10, "#075985"] : result.datasetId === "tw-schools" ? schoolLevelColorExpr(COLORS[index]!) as never : COLORS[index]!,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 12, 6, 16, 9],
        "circle-opacity": 0.86, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1,
      },
    });
    if (!polygon) map.setPaintProperty(layerId(index), "circle-color", result.presentation ? ["step", ["get", result.presentation.countField], "#bae6fd", 5, "#0284c7", 10, "#075985"] : result.datasetId === "tw-schools" ? schoolLevelColorExpr(COLORS[index]!) as never : COLORS[index]!);
    map.setPaintProperty(layerId(index), polygon ? "fill-opacity" : "circle-opacity", opacity);
  });
  for (let index = results.length; index < MAX_RESULTS; index += 1) removeIndex(map, index);
}

export function removeAnalysisResults(map: Map): void { for (let index = 0; index < MAX_RESULTS; index += 1) removeIndex(map, index); }

function removeIndex(map: Map, index: number): void {
  if (map.getLayer(layerId(index))) map.removeLayer(layerId(index));
  if (map.getSource(sourceId(index))) map.removeSource(sourceId(index));
}

export function analysisResultSourceIds(count: number): string[] { return Array.from({ length: Math.min(MAX_RESULTS, count) }, (_, index) => sourceId(index)); }

export function analysisResultLayerIds(count: number): string[] { return Array.from({ length: Math.min(MAX_RESULTS, count) }, (_, index) => layerId(index)); }
export function setAnalysisOpacity(map: Map, count: number, opacity: number): void {
  for (const id of analysisResultLayerIds(count)) {
    const layer = map.getLayer(id);
    if (layer) map.setPaintProperty(id, layer.type === "fill" ? "fill-opacity" : "circle-opacity", opacity);
  }
}
