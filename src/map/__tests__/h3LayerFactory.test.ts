import { beforeEach, describe, expect, it, vi } from "vitest";

const h3 = vi.hoisted(() => ({ cellToBoundary: vi.fn(() => [[25, 121], [25.1, 121.1], [25.2, 121]]) }));
vi.mock("h3-js", () => h3);

import { updateH3Layer } from "../h3LayerFactory";
import {
  updateIndicatorsLayer, updatePopCountLayer, updateSocioLayer, updateSpatialLayer,
} from "../demographicsLayerFactory";

type Source = { type: "geojson"; setData: ReturnType<typeof vi.fn> };

function mockMap() {
  const sources = new Map<string, Source>();
  const layers = new Set<string>();
  return {
    getSource: vi.fn((id: string) => sources.get(id)),
    addSource: vi.fn((id: string) => sources.set(id, { type: "geojson", setData: vi.fn() })),
    getLayer: vi.fn((id: string) => layers.has(id) ? { id } : undefined),
    addLayer: vi.fn((layer: { id: string }) => layers.add(layer.id)),
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
    source: (id: string) => sources.get(id),
    replaceStyle: () => { sources.clear(); layers.clear(); },
  };
}

const h3Cells = [{ h: "8928308280fffff", d: 12, n: 8 }];
const h3Params = { metric: "day" as const, opacity: 0.6, extruded: false, elevationScale: 1, contrast: 1 };
const demoCells = [{ h: "8928308280fffff", p: 30, hh: 12, m: 14, f: 16, sr: 88, pph: 2.5, dr: 40, cd: 12, ed: 28, ai: 220 }];
const indicatorParams = { category: "population", metric: "p", opacity: 0.6, contrast: 1, extruded: false, elevationScale: 1 };

describe("H3 grid factories", () => {
  beforeEach(() => h3.cellToBoundary.mockClear());

  it("H3 paint-only changes do not rewrite data or recompute boundaries", () => {
    const map = mockMap();
    updateH3Layer(map as never, h3Cells, h3Params, true);
    const source = map.source("h3-population-src")!;
    expect(source.setData).toHaveBeenCalledTimes(1);
    expect(h3.cellToBoundary).toHaveBeenCalledTimes(1);

    updateH3Layer(map as never, h3Cells, { ...h3Params, opacity: 0.3, extruded: true, elevationScale: 2 }, true);
    expect(source.setData).toHaveBeenCalledTimes(1);
    expect(h3.cellToBoundary).toHaveBeenCalledTimes(1);
    expect(map.setPaintProperty).toHaveBeenCalledWith("h3-population-fill", "fill-opacity", 0.3);
  });

  it("does not read any H3 cell fields during 20 paint-only updates", () => {
    let reads = 0;
    const cells = [{
      get h() { reads++; return "8928308280fffff"; },
      get d() { reads++; return 12; },
      get n() { reads++; return 8; },
    }];
    const map = mockMap();
    updateH3Layer(map as never, cells, h3Params, true);
    reads = 0;
    for (let opacity = 1; opacity <= 20; opacity++) {
      updateH3Layer(map as never, cells, { ...h3Params, opacity: opacity / 20 }, true);
    }
    expect(reads).toBe(0);
    expect(map.source("h3-population-src")!.setData).toHaveBeenCalledTimes(1);
  });

  it("H3 data/metric updates rebuild, and a style replacement refills its new source", () => {
    const map = mockMap();
    updateH3Layer(map as never, h3Cells, h3Params, true);
    const first = map.source("h3-population-src")!;
    updateH3Layer(map as never, [{ ...h3Cells[0]!, d: 24 }], h3Params, true);
    expect(first.setData).toHaveBeenCalledTimes(2);
    expect(h3.cellToBoundary).toHaveBeenCalledTimes(2);

    updateH3Layer(map as never, h3Cells, { ...h3Params, metric: "night" }, true);
    expect(first.setData).toHaveBeenCalledTimes(3);
    map.replaceStyle();
    updateH3Layer(map as never, h3Cells, { ...h3Params, metric: "night" }, true);
    const restored = map.source("h3-population-src")!;
    expect(restored).not.toBe(first);
    expect(restored.setData).toHaveBeenCalledTimes(1);
    expect(h3.cellToBoundary).toHaveBeenCalledTimes(3);
  });

  it("demographic paint-only changes skip setData, while metric/data changes and style replacement update correctly", () => {
    const map = mockMap();
    updateIndicatorsLayer(map as never, demoCells, indicatorParams, true);
    const source = map.source("h3-indicators-src")!;
    expect(source.setData).toHaveBeenCalledTimes(1);
    expect(h3.cellToBoundary).toHaveBeenCalledTimes(1);

    updateIndicatorsLayer(map as never, demoCells, { ...indicatorParams, opacity: 0.2, extruded: true }, true);
    expect(source.setData).toHaveBeenCalledTimes(1);
    expect(h3.cellToBoundary).toHaveBeenCalledTimes(1);

    updateIndicatorsLayer(map as never, demoCells, { ...indicatorParams, metric: "hh" }, true);
    expect(source.setData).toHaveBeenCalledTimes(2);
    const updatedCells = [{ ...demoCells[0]!, hh: 15 }];
    updateIndicatorsLayer(map as never, updatedCells, { ...indicatorParams, metric: "hh" }, true);
    expect(source.setData).toHaveBeenCalledTimes(3);
    expect(h3.cellToBoundary).toHaveBeenCalledTimes(3);

    map.replaceStyle();
    updateIndicatorsLayer(map as never, updatedCells, { ...indicatorParams, metric: "hh" }, true);
    expect(map.source("h3-indicators-src")!.setData).toHaveBeenCalledTimes(1);
    expect(h3.cellToBoundary).toHaveBeenCalledTimes(3);
  });

  it("all demographic grid factories use identity caching, including empty clears", () => {
    const popMap = mockMap();
    updatePopCountLayer(popMap as never, demoCells, { opacity: 0.6, contrast: 1, extruded: false, elevationScale: 1 }, true);
    updatePopCountLayer(popMap as never, demoCells, { opacity: 0.2, contrast: 1, extruded: true, elevationScale: 2 }, true);
    expect(popMap.source("h3-pop-count-src")!.setData).toHaveBeenCalledTimes(1);

    const socioMap = mockMap();
    const socioCells = [{ h: "8928308280fffff", im: 50, iq: 1, sr: 1, vs: 0.5, vl: 0.2 }];
    const socioParams = { metric: "im", opacity: 0.6, contrast: 1, extruded: false, elevationScale: 1 };
    updateSocioLayer(socioMap as never, socioCells, socioParams, true);
    updateSocioLayer(socioMap as never, socioCells, { ...socioParams, opacity: 0.2 }, true);
    expect(socioMap.source("h3-socio-src")!.setData).toHaveBeenCalledTimes(1);

    const spatialMap = mockMap();
    const spatialCells = [{ h: "8928308280fffff", hp: 50, hu: 30, hpr: 1, ad: 2, lm: 0.5 }];
    const spatialParams = { metric: "hp", opacity: 0.6, contrast: 1, extruded: false, elevationScale: 1 };
    updateSpatialLayer(spatialMap as never, spatialCells, spatialParams, true);
    updateSpatialLayer(spatialMap as never, spatialCells, { ...spatialParams, elevationScale: 2 }, true);
    expect(spatialMap.source("h3-spatial-src")!.setData).toHaveBeenCalledTimes(1);

    updateH3Layer(popMap as never, h3Cells, h3Params, true);
    const h3Source = popMap.source("h3-population-src")!;
    updateH3Layer(popMap as never, [], h3Params, true);
    updateH3Layer(popMap as never, [], { ...h3Params, opacity: 0.2 }, true);
    expect(h3Source.setData).toHaveBeenCalledTimes(2);
    expect(h3Source.setData.mock.calls[1]?.[0]).toEqual({ type: "FeatureCollection", features: [] });
  });

  it("keeps the existing demographic null-to-zero transform", () => {
    const map = mockMap();
    const nullCells = [{ ...demoCells[0]!, p: null }] as never;
    updatePopCountLayer(map as never, nullCells, { opacity: 0.6, contrast: 1, extruded: false, elevationScale: 1 }, true);
    const data = map.source("h3-pop-count-src")!.setData.mock.calls[0]?.[0] as GeoJSON.FeatureCollection;
    expect(data.features[0]?.properties?.value).toBe(0);
  });
});
