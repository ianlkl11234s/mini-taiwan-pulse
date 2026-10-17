import { describe, it, expect, vi } from "vitest";
import { applyMainMapLayers, captureLayerOverrides, planMainMapLayers } from "../mainMapLayers";
import type { MapBridge } from "../../chat/types";
function setup() {
  const visible = new Set(["schools"]);
  const write = vi.fn((keys: string[], on: boolean) => { for (const key of keys) on ? visible.add(key) : visible.delete(key); });
  const bridge = { bulkSetVisibility: write, getVisibleLayerKeys: () => [...visible] } as unknown as MapBridge;
  return { visible, write, bridge };
}
describe("main map layer adapter", () => {
  it("uses existing handlers and preserves unrelated layers", () => {
    const { visible, write, bridge } = setup();
    applyMainMapLayers({ aqi: true }, new Set(["schools", "aqi"]), new Set(), bridge);
    expect(write).toHaveBeenCalledWith(["aqi"], true);
    expect([...visible]).toEqual(["schools", "aqi"]);
    applyMainMapLayers({ aqi: false }, new Set(["schools", "aqi"]), new Set(), bridge);
    expect([...visible]).toEqual(["schools"]);
  });
  it("rejects the entire batch before writes for unknown or locked keys", () => {
    const { write, bridge } = setup();
    for (const layers of ([{ schools: false, missing: true }, { schools: false, aqi: true }] as Record<string, boolean>[])) {
      expect(() => applyMainMapLayers(layers, new Set(["schools", "aqi"]), new Set(["aqi"]), bridge)).toThrow();
    }
    expect(write).not.toHaveBeenCalled();
  });
  // Regression (2026-10-02 live): set_layers {bus:true} (real key busLive) was merged into the
  // study scene on ack, and every later set_camera/show_result re-rendered it and failed.
  it("skips an unknown key inherited from the study scene instead of failing later commands", () => {
    const { visible, bridge } = setup();
    const known = new Set(["schools", "busLive"]);
    const stored = { schools: true, bus: true };
    expect(() => applyMainMapLayers(stored, known, new Set(), bridge)).toThrow("UNKNOWN_OR_LOCKED_LAYER");
    const later = planMainMapLayers(stored, undefined, known, new Set());
    expect(later).toEqual({ usable: { schools: true }, ignored: ["bus"], rejected: [] });
    expect(() => applyMainMapLayers(later.usable, known, new Set(), bridge)).not.toThrow();
    expect([...visible]).toEqual(["schools"]);
  });
  it("reports only the current command's own unknown or locked keys as rejected", () => {
    const known = new Set(["schools", "aqi", "busLive"]);
    expect(planMainMapLayers({ schools: true, bus: true, busLive: true }, { bus: true, busLive: true }, known, new Set()))
      .toEqual({ usable: { schools: true, busLive: true }, ignored: ["bus"], rejected: ["bus"] });
    expect(planMainMapLayers({ aqi: true, schools: false }, { aqi: true }, known, new Set(["aqi"])).rejected).toEqual(["aqi"]);
    expect(planMainMapLayers({ aqi: false }, { aqi: false }, known, new Set(["aqi"])).usable).toEqual({ aqi: false });
  });
  it("does not claim success when the existing handler rejects a switch", () => {
    const { bridge } = setup(); bridge.bulkSetVisibility = vi.fn();
    expect(() => applyMainMapLayers({ aqi: true }, new Set(["aqi"]), new Set(), bridge)).toThrow("LAYER_VISIBILITY_CONFLICT");
  });
});

it("manual camera changes retain tracked switches, and manual off cannot replay old on", () => {
  expect(captureLayerOverrides({ schools: true }, ["schools", "aqi"])).toEqual({ schools: true });
  expect(captureLayerOverrides({ schools: true }, ["aqi"])).toEqual({ schools: false });
});
