import { describe, it, expect, vi } from "vitest";
import { applyMainMapLayers, captureLayerOverrides } from "../mainMapLayers";
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
  it("does not claim success when the existing handler rejects a switch", () => {
    const { bridge } = setup(); bridge.bulkSetVisibility = vi.fn();
    expect(() => applyMainMapLayers({ aqi: true }, new Set(["aqi"]), new Set(), bridge)).toThrow("LAYER_VISIBILITY_CONFLICT");
  });
});

it("manual camera changes retain tracked switches, and manual off cannot replay old on", () => {
  expect(captureLayerOverrides({ schools: true }, ["schools", "aqi"])).toEqual({ schools: true });
  expect(captureLayerOverrides({ schools: true }, ["aqi"])).toEqual({ schools: false });
});
