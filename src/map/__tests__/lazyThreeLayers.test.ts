import { describe, expect, it, vi } from "vitest";
import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import * as lazy from "../lazyThreeLayers";

describe("lazyThreeLayers layer ids stay in sync with the real modules", () => {
  it("matches every duplicated id", async () => {
    const [re, gfw, bloom, bars, sub, plant, lines, beam, ripple] = await Promise.all([
      import("../realEstatePointsCustomLayer"),
      import("../gfwV4TrackCustomLayer"),
      import("../buildingsNightBloomCustomLayer"),
      import("../powerRegionBarsCustomLayer"),
      import("../substationEhvGlowCustomLayer"),
      import("../powerPlantGlowCustomLayer"),
      import("../osmPowerLinesGlowCustomLayer"),
      import("../powerGenerationBeamCustomLayer"),
      import("../earthquakeRippleCustomLayer"),
    ]);
    expect(lazy.RE_POINTS_LAYER_ID).toBe(re.RE_POINTS_LAYER_ID);
    expect(lazy.GFW_V4_TRACK_CUSTOM_LAYER_ID).toBe(gfw.GFW_V4_TRACK_CUSTOM_LAYER_ID);
    expect(lazy.BUILDINGS_NIGHT_BLOOM_LAYER_ID).toBe(bloom.BUILDINGS_NIGHT_BLOOM_LAYER_ID);
    expect(lazy.POWER_REGION_BARS_LAYER_ID).toBe(bars.POWER_REGION_BARS_LAYER_ID);
    expect(lazy.SUBSTATION_EHV_GLOW_LAYER_ID).toBe(sub.SUBSTATION_EHV_GLOW_LAYER_ID);
    expect(lazy.POWER_PLANT_GLOW_LAYER_ID).toBe(plant.POWER_PLANT_GLOW_LAYER_ID);
    expect(lazy.OSM_POWER_LINES_GLOW_LAYER_ID).toBe(lines.OSM_POWER_LINES_GLOW_LAYER_ID);
    expect(lazy.POWER_GENERATION_BEAM_LAYER_ID).toBe(beam.POWER_GENERATION_BEAM_LAYER_ID);
    expect(lazy.EARTHQUAKE_RIPPLE_LAYER_ID).toBe(ripple.EARTHQUAKE_RIPPLE_LAYER_ID);
  });
});

function fakeMap() {
  const order: string[] = [];
  const map = {
    getLayer: (id: string) => (order.includes(id) ? { id } : undefined),
    addLayer: vi.fn((layer: { id: string }, before?: string) => {
      const index = before ? order.indexOf(before) : -1;
      if (index < 0) order.push(layer.id);
      else order.splice(index, 0, layer.id);
    }),
    removeLayer: (id: string) => { order.splice(order.indexOf(id), 1); },
    triggerRepaint: vi.fn(),
  };
  return { map: map as unknown as MapboxMap, order, addLayer: map.addLayer };
}

const layer = (id: string) => ({ id, type: "custom", render: () => {} }) as unknown as CustomLayerInterface;

describe("mountLazyCustomLayer", () => {
  it("does not download while hidden, and inserts before its anchor once loaded", async () => {
    let resolve!: (m: { make: () => CustomLayerInterface }) => void;
    const importer = vi.fn(() => new Promise<{ make: () => CustomLayerInterface }>((r) => { resolve = r; }));
    const mod = lazy.lazyModule("test:a", "A", importer);
    const { map, order } = fakeMap();
    let visible = false;

    lazy.mountLazyCustomLayer(map, "a", mod, (m) => m.make(), () => visible);
    expect(importer).not.toHaveBeenCalled();
    expect(order).toEqual(["a--lazy-anchor"]);

    order.push("later-layer");
    visible = true;
    lazy.mountLazyCustomLayer(map, "a", mod, (m) => m.make(), () => visible);
    lazy.mountLazyCustomLayer(map, "a", mod, (m) => m.make(), () => visible);
    expect(importer).toHaveBeenCalledTimes(1);
    resolve({ make: () => layer("a") });
    await mod.ensure();
    await Promise.resolve();
    expect(order).toEqual(["a", "a--lazy-anchor", "later-layer"]);
  });

  it("skips the add when the layer was switched off before the import finished", async () => {
    const mod = lazy.lazyModule("test:b", "B", async () => ({ make: () => layer("b") }));
    const { map, order } = fakeMap();
    let visible = true;
    lazy.mountLazyCustomLayer(map, "b", mod, (m) => m.make(), () => visible);
    visible = false;
    await mod.ensure();
    await Promise.resolve();
    expect(order).toEqual(["b--lazy-anchor"]);

    // 已載入 → 之後的掛載同步完成
    lazy.mountLazyCustomLayer(map, "b", mod, (m) => m.make(), () => visible);
    expect(order).toEqual(["b", "b--lazy-anchor"]);
  });
});
