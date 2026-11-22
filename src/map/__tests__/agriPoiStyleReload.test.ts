import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import { ensureAgriPOILayers, updateAgriPOILayer } from "../agricultureLayerFactory";

/** 極簡 Map：只實作 factory 會呼叫的 source／layer API；reloadStyle() 模擬換底圖清空自訂 source／layer。 */
function fakeMap() {
  const sources = new Map<string, { data: unknown; setData: ReturnType<typeof vi.fn> }>();
  const layers = new Set<string>();
  const map = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, spec: { data: unknown }) => {
      sources.set(id, { data: spec.data, setData: vi.fn((next: unknown) => { sources.get(id)!.data = next; }) });
    },
    getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
    addLayer: (spec: { id: string }) => { layers.add(spec.id); },
    setLayoutProperty: vi.fn(),
    setFilter: vi.fn(),
    setPaintProperty: vi.fn(),
  };
  return { map: map as unknown as MapboxMap, sources, reloadStyle: () => { sources.clear(); layers.clear(); } };
}

const POI_FC = { type: "FeatureCollection", features: [{ type: "Feature", properties: { poi_type: "x" }, geometry: { type: "Point", coordinates: [121, 24] } }] };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("agriPOI 換底圖後補回資料", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => POI_FC })));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("style.load 重建空 source 後，再呼叫 update 會用快取資料補回（不重抓也不停在空）", async () => {
    const { map, sources, reloadStyle } = fakeMap();
    ensureAgriPOILayers(map);
    updateAgriPOILayer(map, true);
    await flush();
    expect(sources.get("agri-pois")?.setData).toHaveBeenCalledWith(POI_FC);

    // 換底圖：Mapbox 清掉自訂 source／layer；MapView 的 style.load 會 ensure 再 update
    reloadStyle();
    ensureAgriPOILayers(map);
    updateAgriPOILayer(map, true);
    await flush();
    expect(sources.get("agri-pois")?.setData).toHaveBeenCalledWith(POI_FC);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
