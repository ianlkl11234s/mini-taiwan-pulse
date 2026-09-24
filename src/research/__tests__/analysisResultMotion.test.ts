import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map } from "mapbox-gl";
import { describeAnalysisResults, installAnalysisResults, readAnalysisResultPresentation, removeAnalysisResults, setAnalysisOpacity } from "../analysisResultOverlay";
import type { PresentableResult } from "../researchAnalysisSession";

type Layer = { id: string; type: string; source: string; paint: Record<string, unknown> };
function stubMap() {
  const sources = new globalThis.Map<string, { setData: (data: unknown) => void; data: unknown }>();
  const layers = new globalThis.Map<string, Layer>();
  const listeners = new Set<() => void>();
  const paintWrites: Array<{ id: string; property: string; value: unknown }> = [];
  const api = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, value: { data: unknown }) => sources.set(id, { data: value.data, setData(data) { this.data = data; } }),
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: Layer) => layers.set(layer.id, structuredClone(layer)),
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => sources.delete(id),
    isSourceLoaded: (id: string) => sources.has(id),
    setPaintProperty: (id: string, property: string, value: unknown) => { layers.get(id)?.paint && (layers.get(id)!.paint[property] = value); paintWrites.push({ id, property, value }); },
    on: (event: string, listener: () => void) => { if (event === "render") listeners.add(listener); },
    off: (event: string, listener: () => void) => { if (event === "render") listeners.delete(listener); },
  };
  return { map: api as unknown as Map, sources, layers, listeners, paintWrites, render: () => [...listeners].forEach(listener => listener()) };
}

const result: PresentableResult = {
  resultId: "result-1", datasetId: "fixture", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true },
  rows: [{ geometry: { type: "Point", coordinates: [121.5, 25] }, name: "測試點" }],
};

afterEach(() => vi.unstubAllGlobals());

describe("analysis result reveal lifecycle", () => {
  it("retains authorized metadata for a result even when it is not installed", () => {
    expect(describeAnalysisResults([{ ...result, displayLabel: "全國醫院" }])).toEqual([{
      resultId: "result-1", datasetId: "fixture", displayLabel: "全國醫院", geometryType: "Point", featureCount: 1,
    }]);
  });

  it("passes result-contract raw and normalized units to each rendered feature", () => {
    const { map, sources } = stubMap();
    const comparison = {
      ...result,
      rows: [{ geometry: { type: "Point", coordinates: [121.5, 25] }, status: "observed", value: 20, absoluteDifference: 10, normalizedValue: 12.5, normalization_status: "valid", area_ha: 0 }],
      units: { value: "cases", absoluteDifference: "cases", normalizedValue: "cases per 10000 persons", area_ha: "hectares (source EPSG:3826 planar area)" },
    } satisfies PresentableResult;
    installAnalysisResults(map, [comparison]);
    expect((sources.get("research-analysis-result-0")!.data as { features: Array<{ properties: Record<string, unknown> }> }).features[0]!.properties).toMatchObject({
      value: 20,
      unit: "cases",
      absoluteDifference: 10,
      differenceUnit: "cases",
      area_ha: 0,
      sourceAreaUnit: "hectares (source EPSG:3826 planar area)",
      normalizedValue: 12.5,
      normalizedUnit: "cases per 10000 persons",
    });
  });

  it("passes event measurement units from the result contract to the rendered feature", () => {
    const { map, sources } = stubMap();
    const event = {
      ...result,
      rows: [{ geometry: { type: "Point", coordinates: [121.5, 25] }, event_id: "E-1", magnitude: 4.2, depth_km: 12 }],
      units: { magnitude: "M", depth_km: "km" },
    } satisfies PresentableResult;
    installAnalysisResults(map, [event]);
    expect((sources.get("research-analysis-result-0")!.data as { features: Array<{ properties: Record<string, unknown> }> }).features[0]!.properties).toMatchObject({
      event_id: "E-1", magnitude: 4.2, magnitudeUnit: "M", depth_km: 12, depthUnit: "km",
    });
  });

  it("returns the actual rendered palette position and count thresholds for the legend", () => {
    const { map } = stubMap();
    const neighborhood = {
      ...result,
      presentation: { kind: "neighborhood" as const, countField: "source_0_count", label: "護理中心", radiusM: 500, sourceLabels: [{ field: "source_0_count", label: "護理中心" }] },
    } satisfies PresentableResult;
    const installed = installAnalysisResults(map, [result, neighborhood]);
    expect(installed[0]).toMatchObject({ color: "#00b8d9" });
    expect(installed[1]).toMatchObject({ countLegend: { label: "護理中心", radiusM: 500, entries: [
      { label: "0–4 筆", color: "#bae6fd" }, { label: "5–9 筆", color: "#0284c7" }, { label: "≥10 筆", color: "#075985" },
    ] } });
  });

  it("reassigns the palette when a hidden result changes the rendered order", () => {
    const { map } = stubMap();
    const second = { ...result, resultId: "result-2" } satisfies PresentableResult;
    expect(installAnalysisResults(map, [result, second])[1]).toMatchObject({ color: "#ff8f00" });
    expect(installAnalysisResults(map, [second])[0]).toMatchObject({ resultId: "result-2", color: "#00b8d9" });
  });

  it("presents more than four independent result layers and reads them all back", () => {
    const { map, layers } = stubMap();
    const results = Array.from({ length: 5 }, (_, index) => ({
      ...result,
      resultId: `result-${index + 1}`,
      rows: [{ geometry: { type: "Point", coordinates: [121.5 + index * 0.001, 25] } }],
    } satisfies PresentableResult));
    const installed = installAnalysisResults(map, results);
    expect(installed).toHaveLength(5);
    expect(layers.size).toBe(5);
    expect(readAnalysisResultPresentation(map, installed)).toMatchObject({ resultIds: results.map(item => item.resultId), featureCount: 5, ready: true });
  });

  it("restores retained result rows after a style reset removes transient sources and layers", () => {
    const { map } = stubMap();
    const first = installAnalysisResults(map, [result]);
    removeAnalysisResults(map);
    const restored = installAnalysisResults(map, [result]);
    expect(restored).toEqual(first);
    expect(readAnalysisResultPresentation(map, restored)).toMatchObject({ sourcesReady: true, layersReady: true, ready: true });
  });

  it("uses geometry rather than dataset id for Polygon and MultiPolygon results", () => {
    const { map, sources, layers } = stubMap();
    const polygon = {
      resultId: "generic-polygon", datasetId: "any-polygon-dataset", geometry: { type: "Polygon", role: "generalized", spatialAnalysisEligible: false },
      rows: [{ geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.6, 25], [121.6, 25.1], [121.5, 25.1], [121.5, 25]]] } }],
    } satisfies PresentableResult;
    const multiPolygon = {
      resultId: "generic-multipolygon", datasetId: "another-dataset", geometry: { type: "MultiPolygon", role: "actual", spatialAnalysisEligible: true },
      rows: [{ geometry: { type: "MultiPolygon", coordinates: [
        [[[121.7, 25], [121.71, 25], [121.71, 25.01], [121.7, 25.01], [121.7, 25]]],
        [[[121.72, 25], [121.73, 25], [121.73, 25.01], [121.72, 25.01], [121.72, 25]]],
      ] } }],
    } satisfies PresentableResult;
    installAnalysisResults(map, [polygon, multiPolygon]);
    expect(layers.get("research-analysis-result-points-0")?.type).toBe("fill");
    expect(layers.get("research-analysis-result-points-1")?.type).toBe("fill");
    expect((sources.get("research-analysis-result-1")!.data as { features: Array<{ geometry: { type: string } }> }).features[0]!.geometry.type).toBe("MultiPolygon");
  });

  it("keeps authoritative polygon opacity while making the derived analysis scope a light context fill", () => {
    const { map, layers, render } = stubMap();
    const scope = {
      resultId: "scope", datasetId: "derived:analysis-scope-area", geometry: { type: "Polygon", role: "derived", spatialAnalysisEligible: false },
      rows: [{ geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.6, 25], [121.6, 25.1], [121.5, 25.1], [121.5, 25]]] } }],
    } satisfies PresentableResult;
    const area = { ...scope, resultId: "area", datasetId: "authoritative-area", geometry: { type: "Polygon" as const, role: "actual" as const, spatialAnalysisEligible: true } } satisfies PresentableResult;
    installAnalysisResults(map, [scope, area], 0.85); render();
    expect(layers.get("research-analysis-result-points-0")!.paint["fill-opacity"]).toBeCloseTo(0.153);
    expect(layers.get("research-analysis-result-points-1")!.paint["fill-opacity"]).toBeCloseTo(0.3825);
    setAnalysisOpacity(map, installAnalysisResults(map, [scope, area], 0.85), 0.6);
    expect(layers.get("research-analysis-result-points-0")!.paint["fill-opacity"]).toBeCloseTo(0.108);
    expect(layers.get("research-analysis-result-points-1")!.paint["fill-opacity"]).toBeCloseTo(0.27);
  });

  it("reapplies center paint semantics when it reuses a prior POI layer slot", () => {
    const { map, layers } = stubMap();
    const center = { ...result, resultId: "center", datasetId: "derived:analysis-scope-center" } satisfies PresentableResult;
    installAnalysisResults(map, [result, center]);
    const installed = installAnalysisResults(map, [center]);
    expect(installed[0]).toMatchObject({ color: "#fef3c7" });
    expect(layers.get("research-analysis-result-points-0")!.paint).toMatchObject({
      "circle-color": "#fef3c7", "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 6, 12, 9, 16, 12],
      "circle-stroke-color": "#0f172a", "circle-stroke-width": 3,
    });
  });

  it("rejects a collection over its visible-result budget before changing the map", () => {
    const { map, sources } = stubMap();
    installAnalysisResults(map, [result]);
    const original = sources.get("research-analysis-result-0")!.data;
    const overBudget = Array.from({ length: 9 }, (_, index) => ({ ...result, resultId: `over-${index}` }));
    expect(() => installAnalysisResults(map, overBudget)).toThrow("TOO_MANY_PRESENTED_RESULTS");
    expect(sources.get("research-analysis-result-0")!.data).toBe(original);
  });

  it("starts a new layer transparent, reveals on render, then removes its render listener", () => {
    const { map, layers, listeners, render } = stubMap();
    installAnalysisResults(map, [result], 0.42);
    const layer = layers.get("research-analysis-result-points-0")!;
    expect(layer.paint["circle-opacity"]).toBe(0);
    expect(layer.paint["circle-stroke-opacity"]).toBe(0);
    expect(listeners.size).toBe(1);
    render();
    expect(layer.paint["circle-opacity"]).toBe(0.42);
    expect(layer.paint["circle-stroke-opacity"]).toBe(0.42);
    expect(listeners.size).toBe(0);
  });

  it("clears a pending reveal without leaving a render callback behind", () => {
    const { map, layers, sources, listeners, render } = stubMap();
    installAnalysisResults(map, [result]);
    expect(listeners.size).toBe(1);
    removeAnalysisResults(map);
    expect(listeners.size).toBe(0);
    expect(layers.size).toBe(0); expect(sources.size).toBe(0);
    render();
    expect(listeners.size).toBe(0);
  });

  it("lets the opacity slider cancel a pending reveal so an old callback cannot overwrite it", () => {
    const { map, layers, listeners, render } = stubMap();
    installAnalysisResults(map, [result], 0.2);
    setAnalysisOpacity(map, installAnalysisResults(map, [result], 0.2), 0.83);
    expect(layers.get("research-analysis-result-points-0")!.paint["circle-opacity"]).toBe(0.83);
    expect(listeners.size).toBe(0);
    render();
    expect(layers.get("research-analysis-result-points-0")!.paint["circle-opacity"]).toBe(0.83);
  });

  it("uses the requested opacity immediately when reduced motion is preferred", () => {
    vi.stubGlobal("window", { matchMedia: vi.fn(() => ({ matches: true })) });
    const { map, layers, listeners } = stubMap();
    installAnalysisResults(map, [result], 0.61);
    expect(layers.get("research-analysis-result-points-0")!.paint["circle-opacity"]).toBe(0.61);
    expect(listeners.size).toBe(0);
  });

  it("reads back installed result ids, feature count, sources and layers before claiming ready", () => {
    const { map } = stubMap();
    const installed = installAnalysisResults(map, [result]);
    const collection = { items: [{ resultId: "result-1", visible: true, groupId: "education" }], groups: [{ groupId: "education", label: "教育", visible: true }] };
    expect(readAnalysisResultPresentation(map, installed, collection)).toMatchObject({
      mode: "analysis_result",
      resultIds: ["result-1"],
      renderedResultIds: ["result-1"],
      collection,
      datasets: ["fixture"],
      featureCount: 1,
      sourcesReady: true,
      layersReady: true,
      ready: true,
    });
    removeAnalysisResults(map);
    expect(readAnalysisResultPresentation(map, [])).toMatchObject({ mode: "none", featureCount: 0, ready: true });
  });

  it("keeps a fully hidden collection in readback while correctly reporting no rendered layers", () => {
    const { map } = stubMap();
    const collection = { items: [{ resultId: "result-1", visible: false, groupId: "education" }], groups: [{ groupId: "education", label: "教育", visible: false }] };
    expect(readAnalysisResultPresentation(map, [], collection)).toMatchObject({
      mode: "none",
      collection,
      renderedResultIds: [],
      sourceIds: [],
      layerIds: [],
      ready: true,
    });
  });

  it("validates every result before changing an existing source", () => {
    const { map, sources } = stubMap();
    installAnalysisResults(map, [result]);
    const original = sources.get("research-analysis-result-0")!.data;
    const replacement = { ...result, resultId: "result-2", rows: [{ geometry: { type: "Point", coordinates: [121.6, 25.1] } }] } satisfies PresentableResult;
    const invalid = { ...result, resultId: "result-3", rows: [{ geometry: { type: "Point", coordinates: [121.7] } }] } satisfies PresentableResult;
    expect(() => installAnalysisResults(map, [replacement, invalid])).toThrow("RESULT_PRESENTATION_GEOMETRY_MISMATCH");
    expect(sources.get("research-analysis-result-0")!.data).toBe(original);
    expect(sources.has("research-analysis-result-1")).toBe(false);
  });
});
