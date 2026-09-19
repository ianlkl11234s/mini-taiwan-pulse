import { describe, it, expect } from "vitest";
import type { Map, LayerSpecification } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { installResult, removeResult, RESULT_HOST, RESULT_LAYER_IDS } from "../resultOverlay";

function stubMap() {
  const sources = new globalThis.Map<string, unknown>();
  const layers = new globalThis.Map<string, LayerSpecification>();
  const api = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, data: unknown) => sources.set(id, { data, setData: () => {} }),
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: LayerSpecification) => layers.set(layer.id, layer),
    setPaintProperty: () => {},
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => { if ([...layers.values()].some(l => "source" in l && l.source === id)) throw new Error("source still used"); sources.delete(id); },
  };
  return { api: api as unknown as Map, sources, layers };
}
const data: FeatureCollection = { type: "FeatureCollection", features: [] };
describe("isolated result host lifecycle", () => {
  it("cleans result layers before source and preserves unrelated map content", () => {
    const { api, sources, layers } = stubMap();
    api.addSource("reference", { type: "geojson", data });
    installResult(api, data, 0.85);
    expect(layers.size).toBe(4);
    removeResult(api);
    expect(layers.size).toBe(0);
    expect(sources.has("reference")).toBe(true);
    expect(sources.has(RESULT_HOST.id)).toBe(false);
  });
  it("restores on style reload and does not accumulate duplicate layers", () => {
    const { api, sources, layers } = stubMap();
    installResult(api, data, 0.85);
    installResult(api, data, 0.25);
    expect(layers.size).toBe(4);
    sources.clear(); layers.clear();
    installResult(api, data, 0.25);
    expect([...layers.keys()].sort()).toEqual([...RESULT_LAYER_IDS].sort());
    removeResult(api);
    removeResult(api);
    expect(sources.size).toBe(0);
  });
});
