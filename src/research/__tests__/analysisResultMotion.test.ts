import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map } from "mapbox-gl";
import { analysisResultInteractiveLayerIds, describeAnalysisResults, installAnalysisResults, nearbyRevealSchedule, numericResultLegend, readAnalysisResultPresentation, removeAnalysisResults, setAnalysisOpacity } from "../analysisResultOverlay";
import type { PresentableResult } from "../researchAnalysisSession";

type Layer = { id: string; type: string; source: string; paint: Record<string, unknown>; filter?: unknown; layout?: Record<string, unknown> };
function stubMap() {
  const sources = new globalThis.Map<string, { setData: (data: unknown) => void; data: unknown }>();
  const layers = new globalThis.Map<string, Layer>();
  const listeners = new Set<() => void>();
  const paintWrites: Array<{ id: string; property: string; value: unknown }> = [];
  const moveLayerCalls: Array<{ id: string; beforeId?: string }> = [];
  const api = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, value: { data: unknown }) => sources.set(id, { data: value.data, setData(data) { this.data = data; } }),
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: Layer) => layers.set(layer.id, structuredClone(layer)),
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => sources.delete(id),
    isSourceLoaded: (id: string) => sources.has(id),
    setPaintProperty: (id: string, property: string, value: unknown) => { layers.get(id)?.paint && (layers.get(id)!.paint[property] = value); paintWrites.push({ id, property, value }); },
    setLayoutProperty: (id: string, property: string, value: unknown) => { const layer = layers.get(id); if (layer) layer.layout = { ...layer.layout, [property]: value }; },
    setFilter: (id: string, filter: unknown) => { const layer = layers.get(id); if (layer) layer.filter = filter ?? undefined; },
    moveLayer: (id: string, beforeId?: string) => { moveLayerCalls.push({ id, beforeId }); },
    on: (event: string, listener: () => void) => { if (event === "render") listeners.add(listener); },
    off: (event: string, listener: () => void) => { if (event === "render") listeners.delete(listener); },
  };
  return { map: api as unknown as Map, sources, layers, listeners, paintWrites, moveLayerCalls, render: () => [...listeners].forEach(listener => listener()) };
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

  it("keeps opacity with its resultId when visible order changes", () => {
    const { map, layers, render } = stubMap();
    const second = { ...result, resultId: "result-2" } satisfies PresentableResult;
    const opacity = { defaultOpacity: 0.85, byResult: { "result-1": 0.25, "result-2": 0.7 } };
    installAnalysisResults(map, [result, second], opacity); render();
    expect(layers.get("research-analysis-result-points-0")!.paint["circle-opacity"]).toBe(0.25);
    expect(layers.get("research-analysis-result-points-1")!.paint["circle-opacity"]).toBe(0.7);
    installAnalysisResults(map, [second, result], opacity); render();
    expect(layers.get("research-analysis-result-points-0")!.paint["circle-opacity"]).toBe(0.7);
    expect(layers.get("research-analysis-result-points-1")!.paint["circle-opacity"]).toBe(0.25);
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

  it("colors only contract-shaped region comparisons from the normalized measurement and keeps invalid states out of the scale", () => {
    const { map, layers } = stubMap();
    const comparison = {
      resultId: "regional-comparison", datasetId: "stats:fixture", geometry: { type: "Polygon" as const, role: "actual" as const, spatialAnalysisEligible: true },
      units: { value: "cases", normalizedValue: "cases per 10000 persons" },
      rows: [
        { area_code: "A01", area_name: "甲", status: "observed", comparison_status: "valid", normalization_status: "valid", value: 20, normalizedValue: 10, geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.6, 25], [121.6, 25.1], [121.5, 25.1], [121.5, 25]]] } },
        { area_code: "A02", area_name: "乙", status: "observed", comparison_status: "valid", normalization_status: "valid", value: 0, normalizedValue: 0, geometry: { type: "Polygon", coordinates: [[[121.6, 25], [121.7, 25], [121.7, 25.1], [121.6, 25.1], [121.6, 25]]] } },
        { area_code: "A03", area_name: "丙", status: "suppressed", comparison_status: "suppressed", normalization_status: "denominator_suppressed", value: null, normalizedValue: null, geometry: { type: "Polygon", coordinates: [[[121.7, 25], [121.8, 25], [121.8, 25.1], [121.7, 25.1], [121.7, 25]]] } },
        { area_code: "A04", area_name: "丁", status: "observed", comparison_status: "valid", normalization_status: "zero_denominator", value: 3, normalizedValue: null, geometry: { type: "Polygon", coordinates: [[[121.8, 25], [121.9, 25], [121.9, 25.1], [121.8, 25.1], [121.8, 25]]] } },
      ],
    } satisfies PresentableResult;
    const legend = numericResultLegend(comparison)!;
    expect(legend).toMatchObject({ field: "normalizedValue", unit: "cases per 10000 persons", method: "equal_interval" });
    expect(legend.entries.filter(entry => entry.min !== undefined)).toHaveLength(2);
    expect(legend.entries.slice(0, 2)).toMatchObject([
      { color: "#e0f2fe", label: "0–<5 cases per 10000 persons" },
      { color: "#075985", label: "5–10 cases per 10000 persons" },
    ]);
    expect(legend.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "suppressed", color: "#64748b" }),
      expect.objectContaining({ status: "missing", color: "#cbd5e1" }),
    ]));
    const installed = installAnalysisResults(map, [comparison]);
    expect(installed[0]!.numericLegend).toEqual(legend);
    const paint = layers.get("research-analysis-result-points-0")!.paint["fill-color"] as unknown[];
    expect(paint[0]).toBe("case");
    expect(JSON.stringify(paint)).toContain('"typeof"');
    expect(paint).toContain("#64748b");
    expect(paint).toContain("#cbd5e1");
  });

  it("uses a constant valid color for a single numeric value", () => {
    const { map, layers } = stubMap();
    const comparison = {
      resultId: "single-regional-comparison", datasetId: "stats:fixture", geometry: { type: "Polygon" as const, role: "actual" as const, spatialAnalysisEligible: true },
      units: { value: "cases" },
      rows: [{ area_code: "A01", status: "observed", comparison_status: "baseline_zero", normalization_status: "not_requested", value: 0, normalizedValue: null, geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.6, 25], [121.6, 25.1], [121.5, 25.1], [121.5, 25]]] } }],
    } satisfies PresentableResult;
    expect(numericResultLegend(comparison)).toMatchObject({ method: "single_value" });
    expect(numericResultLegend(comparison)!.entries).toEqual(expect.arrayContaining([expect.objectContaining({ color: "#0369a1", min: 0, max: 0 })]));
    installAnalysisResults(map, [comparison]);
    const paint = layers.get("research-analysis-result-points-0")!.paint["fill-color"];
    expect(JSON.stringify(paint)).not.toContain('"step"');
    expect(JSON.stringify(paint)).toContain("#0369a1");
  });

  it("does not turn arbitrary polygon source values into a numeric choropleth", () => {
    const polygon = {
      resultId: "ordinary-polygon", datasetId: "any-polygon-dataset", geometry: { type: "Polygon" as const, role: "actual" as const, spatialAnalysisEligible: true },
      units: { value: "people" }, rows: [{ value: 42, geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.6, 25], [121.6, 25.1], [121.5, 25.1], [121.5, 25]]] } }],
    } satisfies PresentableResult;
    expect(numericResultLegend(polygon)).toBeUndefined();
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
    const installed = installAnalysisResults(map, [scope, area], 0.85);
    setAnalysisOpacity(map, installed, "scope", 0.6);
    expect(layers.get("research-analysis-result-points-1")!.paint["fill-opacity"]).toBeCloseTo(0.3825);
    setAnalysisOpacity(map, installed, "area", 0.6);
    expect(layers.get("research-analysis-result-points-0")!.paint["fill-opacity"]).toBeCloseTo(0.108);
    expect(layers.get("research-analysis-result-points-1")!.paint["fill-opacity"]).toBeCloseTo(0.27);
  });

  it("draws a nearby_profile scope-circle row (_role: scope) as a dashed unfilled outline, excluded from featureCount and never hit-testable", () => {
    const { map, layers } = stubMap();
    const scopeOnly = {
      resultId: "wh-1:polygon", datasetId: "warehouse:wh-1", geometry: { type: "Polygon" as const, role: "derived" as const, spatialAnalysisEligible: false },
      rows: [{ geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.6, 25], [121.6, 25.1], [121.5, 25.1], [121.5, 25]]] }, _role: "scope", label: "分析範圍", radiusM: 500 }],
    } satisfies PresentableResult;
    const installed = installAnalysisResults(map, [scopeOnly]);
    expect(installed[0]).toMatchObject({ featureCount: 0, scopeRing: { radiusM: 500 } });
    // Fill layer still exists (geometry type is Polygon) but excludes the scope row entirely.
    expect(layers.get("research-analysis-result-points-0")!.filter).toEqual(["!=", ["get", "_role"], "scope"]);
    const ring = layers.get("research-analysis-result-scope-0")!;
    expect(ring.type).toBe("line");
    expect(ring.filter).toEqual(["==", ["get", "_role"], "scope"]);
    expect(ring.paint["line-dasharray"]).toEqual([2, 2]);
    expect(ring.paint["line-color"]).not.toBe("#00b8d9"); // not the ordinary result palette
    expect(analysisResultInteractiveLayerIds(map, installed.length)).not.toContain("research-analysis-result-scope-0");
  });

  it("keeps a real polygon match's own row counted when a scope-circle row shares its result", () => {
    const { map } = stubMap();
    const mixed = {
      resultId: "wh-2:polygon", datasetId: "warehouse:wh-2", geometry: { type: "Polygon" as const, role: "derived" as const, spatialAnalysisEligible: false },
      rows: [
        { geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.6, 25], [121.6, 25.1], [121.5, 25.1], [121.5, 25]]] }, name: "公園" },
        { geometry: { type: "Polygon", coordinates: [[[121.7, 25], [121.8, 25], [121.8, 25.1], [121.7, 25.1], [121.7, 25]]] }, _role: "scope", radiusM: 500 },
      ],
    } satisfies PresentableResult;
    const installed = installAnalysisResults(map, [mixed]);
    expect(installed[0]).toMatchObject({ featureCount: 1, scopeRing: { radiusM: 500 } });
    expect(describeAnalysisResults([mixed])[0]).toMatchObject({ featureCount: 1 });
  });

  it("keeps the scope ring under the point result's layer regardless of which index it was installed at", () => {
    const { map, moveLayerCalls } = stubMap();
    // Polygon (scope) is index 0, Point (nearby matches) is index 1 -- the opposite of the
    // desired stacking order, so a naive add-order stack would put the ring on top of points.
    const scope = {
      resultId: "wh-3:polygon", datasetId: "warehouse:wh-3", geometry: { type: "Polygon" as const, role: "derived" as const, spatialAnalysisEligible: false },
      rows: [{ geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.6, 25], [121.6, 25.1], [121.5, 25.1], [121.5, 25]]] }, _role: "scope", radiusM: 500 }],
    } satisfies PresentableResult;
    const points = {
      resultId: "wh-3:point", datasetId: "warehouse:wh-3", geometry: { type: "Point" as const, role: "actual" as const, spatialAnalysisEligible: true },
      rows: [{ geometry: { type: "Point", coordinates: [121.55, 25.02] } }],
    } satisfies PresentableResult;
    installAnalysisResults(map, [scope, points]);
    expect(moveLayerCalls).toContainEqual({ id: "research-analysis-result-scope-0", beforeId: "research-analysis-result-points-1" });
  });

  it("removes the scope ring layer once its result stops carrying a scope row", () => {
    const { map, layers } = stubMap();
    const scope = {
      resultId: "wh-4:polygon", datasetId: "warehouse:wh-4", geometry: { type: "Polygon" as const, role: "derived" as const, spatialAnalysisEligible: false },
      rows: [{ geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.6, 25], [121.6, 25.1], [121.5, 25.1], [121.5, 25]]] }, _role: "scope", radiusM: 500 }],
    } satisfies PresentableResult;
    installAnalysisResults(map, [scope]);
    expect(layers.has("research-analysis-result-scope-0")).toBe(true);
    const ordinary = { ...scope, rows: [{ geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.6, 25], [121.6, 25.1], [121.5, 25.1], [121.5, 25]]] } }] } satisfies PresentableResult;
    installAnalysisResults(map, [ordinary]);
    expect(layers.has("research-analysis-result-scope-0")).toBe(false);
  });

  it("reapplies center paint semantics when it reuses a prior POI layer slot", () => {
    const { map, layers } = stubMap();
    const center = { ...result, resultId: "center", datasetId: "derived:analysis-scope-center" } satisfies PresentableResult;
    installAnalysisResults(map, [result, center]);
    const installed = installAnalysisResults(map, [center]);
    expect(installed[0]).toMatchObject({ color: "#fef3c7" });
    expect(layers.get("research-analysis-result-points-0")!.paint).toMatchObject({
      "circle-color": "#fef3c7", "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 6, 12, 9, 16, 12],
      // Base ring stays the fallback branch of the I1/I2 emphasis `case` expression.
      "circle-stroke-color": ["case", ["any", ["boolean", ["feature-state", "hover"], false], ["boolean", ["feature-state", "selected"], false]], expect.any(String), "#0f172a"],
      "circle-stroke-width": ["case", ["any", ["boolean", ["feature-state", "hover"], false], ["boolean", ["feature-state", "selected"], false]], 2, 3],
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
    setAnalysisOpacity(map, installAnalysisResults(map, [result], 0.2), "result-1", 0.83);
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

describe("nearby result: category colours, centre point, names and staged reveal", () => {
  const point = (lng: number, extra: Record<string, unknown>) => ({ geometry: { type: "Point", coordinates: [lng, 25] }, ...extra });
  const nearby = {
    resultId: "wh-9:point", datasetId: "warehouse:wh-9", displayLabel: "台北車站周邊", geometry: { type: "Point" as const, role: "actual" as const, spatialAnalysisEligible: true },
    rows: [
      point(121.5, { _role: "center", name: "台北車站" }),
      point(121.501, { _wh_dataset: "bus", _wh_category_label: "公車站", _wh_rank: 1, _wh_name: "北門" }),
      point(121.502, { _wh_dataset: "bus", _wh_category_label: "公車站", _wh_rank: 5, _wh_name: "遠站" }),
      point(121.503, { _wh_dataset: "school", _wh_category_label: "學校", _wh_rank: 2, _wh_name: "國小" }),
    ],
  } satisfies PresentableResult;

  it("colours POIs by category with a matching legend, keeps the centre out of the POI layer and counts", () => {
    const { map, layers } = stubMap();
    const installed = installAnalysisResults(map, [nearby], 0.55, "dark");
    expect(installed[0]).toMatchObject({ featureCount: 3, categoryLegend: { entries: [{ label: "公車站", color: "#2e81d5" }, { label: "學校", color: "#b38c15" }] } });
    const main = layers.get("research-analysis-result-points-0")!;
    expect(main.filter).toEqual(["!=", ["get", "_role"], "center"]);
    expect(main.paint["circle-color"]).toEqual(["match", ["get", "_wh_dataset"], "bus", "#2e81d5", "school", "#b38c15", "#6b7280"]);
    expect(layers.get("research-analysis-result-nearby-center-0")!.filter).toEqual(["==", ["get", "_role"], "center"]);
    expect(layers.get("research-analysis-result-nearby-poi-label-0")!.layout!["text-field"]).toEqual(["get", "_wh_name"]);
  });

  it("degrades to the plain single-colour point layer when the new fields are absent", () => {
    const { map, layers } = stubMap();
    const plain = { ...nearby, rows: [point(121.5, { name: "甲" }), point(121.6, { name: "乙" })] } satisfies PresentableResult;
    const installed = installAnalysisResults(map, [plain]);
    expect(installed[0]!.categoryLegend).toBeUndefined();
    expect(layers.has("research-analysis-result-nearby-center-0")).toBe(false);
    expect(layers.has("research-analysis-result-nearby-poi-label-0")).toBe(false);
    expect(layers.get("research-analysis-result-points-0")!.paint["circle-color"]).toBe("#00b8d9");
  });

  it("reveals in stages within 1.5s, clears its timer, and does not replay after a hide/show", () => {
    vi.useFakeTimers();
    try {
      const { map, layers, render } = stubMap();
      installAnalysisResults(map, [nearby]);
      expect(layers.get("research-analysis-result-nearby-center-0")!.paint["circle-opacity"]).toBe(0);
      render();
      vi.advanceTimersByTime(500);
      expect(layers.get("research-analysis-result-nearby-center-0")!.paint["circle-opacity"]).toBeGreaterThan(0);
      expect(layers.get("research-analysis-result-nearby-poi-label-0")!.paint["text-opacity"]).toBe(0);
      vi.advanceTimersByTime(1100);
      expect(layers.get("research-analysis-result-points-0")!.paint["circle-opacity"]).toBe(0.55);
      expect(layers.get("research-analysis-result-nearby-poi-label-0")!.paint["text-opacity"]).toBe(0.55);
      expect(vi.getTimerCount()).toBe(0);
      removeAnalysisResults(map);
      installAnalysisResults(map, [nearby]);
      expect(layers.get("research-analysis-result-nearby-center-0")!.paint["circle-opacity"]).toBe(0.55);
    } finally { vi.useRealTimers(); }
  });

  it("keeps the whole timeline within 1.5s for any category count", () => {
    for (const count of [0, 1, 3, 7, 12]) expect(nearbyRevealSchedule(count).totalMs).toBeLessThanOrEqual(1500);
  });
});
