import { describe, expect, it, vi } from "vitest";

const h3 = vi.hoisted(() => ({ cellToBoundary: vi.fn(() => [[25, 121], [25.1, 121.1], [25.2, 121]]) }));
vi.mock("h3-js", () => h3);

import { bindGridStyleRehydration } from "../gridHosts";
import { updateH3Layer } from "../../../map/h3LayerFactory";
import {
  updateIndicatorsLayer, updatePopCountLayer, updateSocioLayer, updateSpatialLayer,
} from "../../../map/demographicsLayerFactory";

type Source = { type: "geojson"; setData: ReturnType<typeof vi.fn> };

function styleMap() {
  const sources = new Map<string, Source>();
  const layers = new Set<string>();
  const handlers = new Map<string, Set<() => void>>();
  const map = {
    getStyle: vi.fn(() => ({})),
    getSource: vi.fn((id: string) => sources.get(id)),
    addSource: vi.fn((id: string) => sources.set(id, { type: "geojson", setData: vi.fn() })),
    getLayer: vi.fn((id: string) => layers.has(id) ? { id } : undefined),
    addLayer: vi.fn((layer: { id: string }) => layers.add(layer.id)),
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: () => void) => handlers.get(event)?.delete(handler)),
  };
  return {
    map,
    resetStyle: () => { sources.clear(); layers.clear(); },
    emitStyleLoad: () => handlers.get("style.load")?.forEach((handler) => handler()),
    source: (id: string) => sources.get(id),
  };
}

describe("grid host style reload lifecycle", () => {
  it("recreates and refills all visible People grids after style.load", () => {
    const state = styleMap();
    const population = [{ h: "8928308280fffff", d: 12, n: 8 }];
    const demographic = [{ h: "8928308280fffff", p: 30, hh: 12, m: 14, f: 16, sr: 88, pph: 2.5, dr: 40, cd: 12, ed: 28, ai: 220 }];
    const rehydrate = (map: never) => {
      updateH3Layer(map, population, { metric: "day", opacity: 0.6, extruded: false, elevationScale: 1, contrast: 1 }, true);
      updatePopCountLayer(map, demographic, { opacity: 0.6, contrast: 1, extruded: false, elevationScale: 1 }, true);
      updateIndicatorsLayer(map, demographic, { category: "population", metric: "hh", opacity: 0.6, contrast: 1, extruded: false, elevationScale: 1 }, true);
      updateSocioLayer(map, [{ h: "8928308280fffff", im: 50, iq: 1, sr: 1, vs: 0.5, vl: 0.2 }], { metric: "im", opacity: 0.6, contrast: 1, extruded: false, elevationScale: 1 }, true);
      updateSpatialLayer(map, [{ h: "8928308280fffff", hp: 50, hu: 30, hpr: 1, ad: 2, lm: 0.5 }], { metric: "hp", opacity: 0.6, contrast: 1, extruded: false, elevationScale: 1 }, true);
    };

    rehydrate(state.map as never);
    const stop = bindGridStyleRehydration(state.map as never, rehydrate as never);
    for (let cycle = 0; cycle < 20; cycle++) {
      state.resetStyle();
      state.emitStyleLoad();

      for (const id of ["h3-population-src", "h3-pop-count-src", "h3-indicators-src", "h3-socio-src", "h3-spatial-src"]) {
        const source = state.source(id);
        expect(source).toBeDefined();
        expect(source!.setData).toHaveBeenCalledTimes(1);
        expect((source!.setData.mock.calls[0]?.[0] as GeoJSON.FeatureCollection).features).toHaveLength(1);
      }
    }
    stop();
    state.resetStyle();
    state.emitStyleLoad();
    expect(state.source("h3-population-src")).toBeUndefined();
  });
});
