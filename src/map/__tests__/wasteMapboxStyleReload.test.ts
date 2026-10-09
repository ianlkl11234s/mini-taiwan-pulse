import { describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { LayerVisibility } from "../../types";
import {
  rebuildWasteMapboxLayers,
  setupWasteMapboxLayers,
  syncWasteMapboxVisibility,
  WASTE_MAPBOX_KEYS,
} from "../wasteMapboxLayers";

/** 最小 fake map：setStyle 會清掉所有 source / layer（與 Mapbox 行為一致）。 */
function createMap() {
  const sources = new Map<string, unknown>();
  const layers = new Map<string, { visibility: string; paint: Record<string, unknown> }>();
  const map = {
    getSource: (id: string) => (sources.has(id) ? { setData: vi.fn() } : undefined),
    addSource: (id: string, s: unknown) => { sources.set(id, s); },
    removeSource: (id: string) => { sources.delete(id); },
    getLayer: (id: string) => layers.get(id),
    addLayer: (l: { id: string; layout?: { visibility?: string }; paint?: Record<string, unknown> }) => {
      layers.set(l.id, { visibility: l.layout?.visibility ?? "visible", paint: { ...(l.paint ?? {}) } });
    },
    removeLayer: (id: string) => { layers.delete(id); },
    setLayoutProperty: (id: string, k: string, v: string) => { if (k === "visibility") layers.get(id)!.visibility = v; },
    setPaintProperty: (id: string, k: string, v: unknown) => { layers.get(id)!.paint[k] = v; },
    on: vi.fn(), off: vi.fn(),
    getCanvas: () => ({ style: {} }),
    setStyle: () => { sources.clear(); layers.clear(); },
  };
  return { map: map as unknown as MapboxMap, raw: map, layers, sources };
}

const vis = { wfRecycling: true } as unknown as LayerVisibility;
const state = { facilityByType: new Map(), disposalByType: new Map(), visibility: vis, params: {} };

describe("垃圾設施 Mapbox 圖層換底圖後重建 (G005)", () => {
  for (const [from, to] of [[true, false], [false, true]] as const) {
    it(`${from ? "暗色" : "淡色"} → ${to ? "暗色" : "淡色"}：setStyle 清空後重建，且維持開啟狀態與新主題`, () => {
      const { map, raw, layers, sources } = createMap();
      const opts = (isDark: boolean) => ({ isDark, onFeatureClick: vi.fn() });
      setupWasteMapboxLayers(map, opts(from));
      syncWasteMapboxVisibility(map, vis);
      expect(layers.get("waste-wfRecycling-core")?.visibility).toBe("visible");
      const before = layers.size;
      expect(before).toBe(WASTE_MAPBOX_KEYS.length * 2);

      raw.setStyle(); // 底圖切換：自訂 layer 被清掉
      expect(layers.size).toBe(0);
      expect(sources.size).toBe(0);

      rebuildWasteMapboxLayers(map, opts(to), state);
      expect(layers.size).toBe(before);
      expect(sources.size).toBe(WASTE_MAPBOX_KEYS.length);
      expect(layers.get("waste-wfRecycling-core")?.visibility, "開啟的子圖層仍可見").toBe("visible");
      expect(layers.get("waste-wfLandfill-core")?.visibility ?? "none").toBe("none");
    });
  }

  it("重複呼叫冪等，不重複新增 layer", () => {
    const { map, layers } = createMap();
    const opts = { isDark: true, onFeatureClick: vi.fn() };
    rebuildWasteMapboxLayers(map, opts, state);
    const n = layers.size;
    rebuildWasteMapboxLayers(map, opts, state);
    expect(layers.size).toBe(n);
  });
});
