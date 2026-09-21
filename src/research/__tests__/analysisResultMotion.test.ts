import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map } from "mapbox-gl";
import { installAnalysisResults, readAnalysisResultPresentation, removeAnalysisResults, setAnalysisOpacity } from "../analysisResultOverlay";
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
    setAnalysisOpacity(map, 1, 0.83);
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
    expect(readAnalysisResultPresentation(map, installed)).toMatchObject({
      mode: "analysis_result",
      resultIds: ["result-1"],
      datasets: ["fixture"],
      featureCount: 1,
      sourcesReady: true,
      layersReady: true,
      ready: true,
    });
    removeAnalysisResults(map);
    expect(readAnalysisResultPresentation(map, [])).toMatchObject({ mode: "none", featureCount: 0, ready: true });
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
