import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from "geojson";
import type { GeoJSONSource, Map } from "mapbox-gl";
import { RESULT_COLLECTION_LIMITS, type PresentableResult } from "./researchAnalysisSession";
import { prefersReducedMotion } from "./researchMotion";

const MAX_RESULTS = RESULT_COLLECTION_LIMITS.maxLogicalResults;
const COLORS = ["#00b8d9", "#ff8f00", "#d81b60", "#7e57c2", "#43a047", "#5c6bc0", "#e53935", "#00897b"];
const sourceId = (index: number) => `research-analysis-result-${index}`;
const layerId = (index: number) => `research-analysis-result-points-${index}`;
const reveals = new WeakMap<Map, globalThis.Map<number, () => void>>();

export type AnalysisResultPresentation = {
  resultId: string;
  datasetId: string;
  geometryType: PresentableResult["geometry"]["type"];
  featureCount: number;
};

export type AnalysisResultReadback = {
  mode: "none" | "analysis_result";
  resultIds: string[];
  datasets: string[];
  featureCount: number;
  sourceIds: string[];
  layerIds: string[];
  sourcesReady: boolean;
  layersReady: boolean;
  ready: boolean;
};

function cancelReveal(map: Map, index: number): void {
  const listener = reveals.get(map)?.get(index);
  if (listener) map.off("render", listener);
  reveals.get(map)?.delete(index);
}

function collection(result: PresentableResult): FeatureCollection<Point | Polygon | MultiPolygon> {
  const features: Feature<Point | Polygon | MultiPolygon>[] = result.rows.flatMap<Feature<Point | Polygon | MultiPolygon>>((row, rowIndex) => {
    const geometry = row.geometry as { type?: unknown; coordinates?: unknown } | undefined;
    if (geometry?.type !== result.geometry.type) return [];
    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      return [{ type: "Feature", id: `${result.resultId}:${rowIndex}`, properties: propertiesFor(row, result), geometry: geometry as Polygon | MultiPolygon }];
    }
    if (geometry.type !== "Point" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2) return [];
    const [lng, lat] = geometry.coordinates;
    if (typeof lng !== "number" || !Number.isFinite(lng) || typeof lat !== "number" || !Number.isFinite(lat)) return [];
    return [{ type: "Feature", id: `${result.resultId}:${rowIndex}`, properties: propertiesFor(row, result), geometry: { type: "Point", coordinates: [lng, lat] } }];
  });
  return { type: "FeatureCollection", features };
}

function propertiesFor(row: Record<string, unknown>, result: PresentableResult): Record<string, string | number | boolean | null> {
  const properties = Object.fromEntries(Object.entries(row).filter(([key, value]) => key !== "geometry" && (value === null || ["string", "number", "boolean"].includes(typeof value))));
  return { ...properties, resultId: result.resultId, datasetId: result.datasetId };
}

/** Transient result layers are independent of the permanent layer catalogue. */
export function installAnalysisResults(map: Map, results: readonly PresentableResult[], opacity = 0.55): AnalysisResultPresentation[] {
  if (results.length > MAX_RESULTS) throw new Error("TOO_MANY_PRESENTED_RESULTS");
  // Validate every result before mutating Mapbox so a bad later result cannot
  // leave an earlier source partially updated.
  const prepared = results.map(result => {
    const data = collection(result);
    if (data.features.length !== result.rows.length) throw new Error("RESULT_PRESENTATION_GEOMETRY_MISMATCH");
    return { result, data };
  });
  const installed = prepared.map(({ result, data }, index) => {
    cancelReveal(map, index);
    const source = map.getSource(sourceId(index)) as GeoJSONSource | undefined;
    if (source) source.setData(data); else map.addSource(sourceId(index), { type: "geojson", data });
    const polygon = result.geometry.type === "Polygon" || result.geometry.type === "MultiPolygon";
    const existing = map.getLayer(layerId(index));
    const reveal = !existing && !prefersReducedMotion();
    const duration = prefersReducedMotion() ? 0 : 380;
    if (existing && existing.type !== (polygon ? "fill" : "circle")) map.removeLayer(layerId(index));
    if (polygon) {
      if (!map.getLayer(layerId(index))) map.addLayer({ id: layerId(index), type: "fill", source: sourceId(index), paint: {
        "fill-color": COLORS[index]!, "fill-opacity": reveal ? 0 : opacity * 0.45, "fill-opacity-transition": { duration }, "fill-outline-color": "#e2e8f0",
      } });
    } else if (!map.getLayer(layerId(index))) map.addLayer({
      id: layerId(index), type: "circle", source: sourceId(index),
      paint: {
        "circle-color": result.presentation ? ["step", ["get", result.presentation.countField], "#bae6fd", 5, "#0284c7", 10, "#075985"] : COLORS[index]!,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 12, 6, 16, 9],
        "circle-opacity": reveal ? 0 : opacity, "circle-opacity-transition": { duration }, "circle-stroke-opacity": reveal ? 0 : opacity, "circle-stroke-opacity-transition": { duration }, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1,
      },
    });
    if (!polygon) map.setPaintProperty(layerId(index), "circle-color", result.presentation ? ["step", ["get", result.presentation.countField], "#bae6fd", 5, "#0284c7", 10, "#075985"] : COLORS[index]!);
    const applyOpacity = () => {
      cancelReveal(map, index);
      if (!map.getLayer(layerId(index))) return;
      map.setPaintProperty(layerId(index), polygon ? "fill-opacity" : "circle-opacity", polygon ? opacity * 0.45 : opacity);
      if (!polygon) map.setPaintProperty(layerId(index), "circle-stroke-opacity", opacity);
    };
    if (reveal) {
      if (!reveals.has(map)) reveals.set(map, new globalThis.Map());
      reveals.get(map)!.set(index, applyOpacity);
      map.on("render", applyOpacity);
    } else applyOpacity();
    return { resultId: result.resultId, datasetId: result.datasetId, geometryType: result.geometry.type, featureCount: data.features.length };
  });
  for (let index = results.length; index < MAX_RESULTS; index += 1) removeIndex(map, index);
  return installed;
}

export function removeAnalysisResults(map: Map): void { for (let index = 0; index < MAX_RESULTS; index += 1) removeIndex(map, index); }

function removeIndex(map: Map, index: number): void {
  cancelReveal(map, index);
  if (map.getLayer(layerId(index))) map.removeLayer(layerId(index));
  if (map.getSource(sourceId(index))) map.removeSource(sourceId(index));
}

export function analysisResultSourceIds(count: number): string[] { return Array.from({ length: Math.min(MAX_RESULTS, count) }, (_, index) => sourceId(index)); }

export function analysisResultLayerIds(count: number): string[] { return Array.from({ length: Math.min(MAX_RESULTS, count) }, (_, index) => layerId(index)); }
export function readAnalysisResultPresentation(map: Map, results: readonly AnalysisResultPresentation[]): AnalysisResultReadback {
  const sourceIds = analysisResultSourceIds(results.length);
  const layerIds = analysisResultLayerIds(results.length);
  const sourcesReady = sourceIds.every(id => Boolean(map.getSource(id)) && map.isSourceLoaded(id));
  const layersReady = layerIds.every(id => Boolean(map.getLayer(id)));
  const cleared = results.length > 0 || (
    analysisResultSourceIds(MAX_RESULTS).every(id => !map.getSource(id)) &&
    analysisResultLayerIds(MAX_RESULTS).every(id => !map.getLayer(id))
  );
  return {
    mode: results.length ? "analysis_result" : "none",
    resultIds: results.map(result => result.resultId),
    datasets: results.map(result => result.datasetId),
    featureCount: results.reduce((sum, result) => sum + result.featureCount, 0),
    sourceIds,
    layerIds,
    sourcesReady,
    layersReady,
    ready: sourcesReady && layersReady && cleared,
  };
}
export function setAnalysisOpacity(map: Map, count: number, opacity: number): void {
  for (const id of analysisResultLayerIds(count)) {
    const layer = map.getLayer(id);
    if (layer) {
      cancelReveal(map, analysisResultLayerIds(count).indexOf(id));
      map.setPaintProperty(id, layer.type === "fill" ? "fill-opacity" : "circle-opacity", opacity);
      if (layer.type !== "fill") map.setPaintProperty(id, "circle-stroke-opacity", opacity);
    }
  }
}
