import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import { loadingRegistry } from "../lib/loadingRegistry";
import { mountCoralReefDistribution, CORAL_SOURCE_ID } from "./useCoralReefDistributionLayer";
vi.mock("../map/pmtilesSourceType", () => ({ registerPmtilesSourceTypeOnce: vi.fn() }));
function mockMap() {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  const sources = new Map<string, unknown>();
  const layers = new Map<string, unknown>();
  const map = {
    getStyle: () => ({}),
    setLayoutProperty: vi.fn(),
    on: (event: string, cb: (event: unknown) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(cb);
    },
    off: (event: string, cb: (event: unknown) => void) => listeners.get(event)?.delete(cb),
    addSource: (id: string, spec: unknown) => sources.set(id, spec),
    getSource: (id: string) => sources.get(id),
    removeSource: (id: string) => sources.delete(id),
    addLayer: (spec: { id: string }) => layers.set(spec.id, spec),
    getLayer: (id: string) => layers.get(id),
    removeLayer: (id: string) => layers.delete(id),
  };
  return { map: map as unknown as MapboxMap, sources, layers, listeners,
    fire: (type: string, event: unknown) => listeners.get(type)?.forEach(cb => cb(event)) };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("local coral PMTiles lifecycle", () => {
  it("keeps z12 overzoom and releases layers, source, listeners and loading on repeated toggles", () => {
    vi.stubGlobal("window", { location: { href: "http://127.0.0.1:3724/" } });
    const m = mockMap();
    for (let i = 0; i < 5; i++) {
      const state = vi.fn();
      const dispose = mountCoralReefDistribution(m.map, 0.55, state);
      expect(m.sources.get(CORAL_SOURCE_ID)).toMatchObject({ minzoom: 0, maxzoom: 12 });
      expect(m.layers.size).toBe(2);
      m.fire("sourcedata", { sourceId: CORAL_SOURCE_ID, isSourceLoaded: true });
      expect(state).toHaveBeenLastCalledWith("ready");
      dispose();
      expect(m.sources.size).toBe(0);
      expect(m.layers.size).toBe(0);
      expect([...m.listeners.values()].every(s => s.size === 0)).toBe(true);
      expect(loadingRegistry.snapshot().filter(t => t.id.startsWith("coral-"))).toEqual([]);
    }
  });
  it("source failure stays error even after source loaded; unrelated errors do not affect coral", () => {
    vi.stubGlobal("window", { location: { href: "http://localhost/" } });
    const m = mockMap(); const state = vi.fn();
    const dispose = mountCoralReefDistribution(m.map, 0.55, state);
    m.fire("error", { sourceId: "unrelated" });
    expect(state).toHaveBeenLastCalledWith("loading");
    m.fire("error", { sourceId: CORAL_SOURCE_ID });
    m.fire("sourcedata", { sourceId: CORAL_SOURCE_ID, isSourceLoaded: true });
    expect(state).toHaveBeenLastCalledWith("error");
    expect(m.map.setLayoutProperty).toHaveBeenCalledWith("coral-reef-distribution-fill", "visibility", "none");
    dispose();
  });
  it("disposes after MapView has already destroyed its style", () => {
    vi.stubGlobal("window", { location: { href: "http://localhost/" } });
    const m = mockMap(); const dispose = mountCoralReefDistribution(m.map, 0.55, vi.fn());
    m.map.getStyle = () => undefined as unknown as ReturnType<MapboxMap["getStyle"]>;
    m.map.getLayer = () => { throw new Error("destroyed map"); };
    expect(dispose).not.toThrow();
    expect([...m.listeners.values()].every(s => s.size === 0)).toBe(true);
  });
  it("times out as error and cancels pending timeout when closed during loading", () => {
    vi.useFakeTimers(); vi.stubGlobal("window", { location: { href: "http://localhost/" } });
    const m = mockMap(); const state = vi.fn();
    const dispose = mountCoralReefDistribution(m.map, 0.55, state);
    vi.advanceTimersByTime(30000);
    expect(state).toHaveBeenLastCalledWith("error");
    dispose();
    const state2 = vi.fn(); const dispose2 = mountCoralReefDistribution(m.map, 0.55, state2);
    dispose2(); vi.advanceTimersByTime(30000);
    expect(state2).toHaveBeenCalledTimes(1);
    expect(loadingRegistry.snapshot().filter(t => t.id.startsWith("coral-"))).toEqual([]);
  });
});
