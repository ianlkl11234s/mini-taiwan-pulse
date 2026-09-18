import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import { loadingRegistry } from "../lib/loadingRegistry";
import { mountAllenCoralAtlas } from "./useAllenCoralAtlasLayer";
vi.mock("../map/privateCoralPmtiles", () => ({ registerPrivateCoralSourceOnce: vi.fn(), PRIVATE_CORAL_PMTILES_SOURCE_TYPE: "private-coral-pmtile-source" }));
const CORAL_SOURCE_ID = "allen-coral-atlas-benthic";
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
describe("Allen private PMTiles lifecycle", () => {
  it("keeps z14 overzoom and releases layers, source, listeners and loading on repeated toggles", () => {
    vi.stubGlobal("window", { location: { href: "http://127.0.0.1:3724/" } });
    const m = mockMap();
    for (let i = 0; i < 5; i++) {
      const state = vi.fn();
      const dispose = mountAllenCoralAtlas(m.map, 0.55, "coralAlgae", "taiwan", state, async () => "test-token");
      expect(m.sources.get(CORAL_SOURCE_ID)).toMatchObject({ minzoom: 0, maxzoom: 14, promoteId: "feature_id" });
      expect(m.layers.size).toBe(1);
      m.fire("sourcedata", { sourceId: CORAL_SOURCE_ID, isSourceLoaded: true });
      expect(state).toHaveBeenLastCalledWith("ready");
      dispose();
      expect(m.sources.size).toBe(0);
      expect(m.layers.size).toBe(0);
      expect([...m.listeners.values()].every(s => s.size === 0)).toBe(true);
      expect(loadingRegistry.snapshot().filter(t => t.id.startsWith("allen-coral-"))).toEqual([]);
    }
  });
  it("view changes release the previous source; region and classification filters remain independent", () => {
    vi.stubGlobal("window", { location: { href: "http://localhost/" } });
    const m = mockMap();
    const first = mountAllenCoralAtlas(m.map, 0.65, "coralAlgae", "taiwan", vi.fn(), async () => "token");
    expect(m.layers.get(`${CORAL_SOURCE_ID}-fill`)).toMatchObject({ filter: ["all", ["==", ["get", "class_name"], "Coral/Algae"], ["==", ["get", "region"], "taiwan"]] });
    first();
    const second = mountAllenCoralAtlas(m.map, 0.65, "geomorphic", "okinawa", vi.fn(), async () => "token");
    expect([...m.sources.keys()]).toEqual(["allen-coral-atlas-geomorphic"]);
    expect(m.layers.size).toBe(1);
    const source = m.sources.get("allen-coral-atlas-geomorphic") as { onAccessDenied: () => void };
    source.onAccessDenied();
    expect(m.sources.size).toBe(0);
    expect(m.layers.size).toBe(0);
    second();
  });
  it("keeps transient source errors retryable; unrelated errors do not affect coral", () => {
    vi.stubGlobal("window", { location: { href: "http://localhost/" } });
    const m = mockMap(); const state = vi.fn();
    const dispose = mountAllenCoralAtlas(m.map, 0.55, "coralAlgae", "taiwan", state, async () => "test-token");
    m.fire("error", { sourceId: "unrelated" });
    expect(state).toHaveBeenLastCalledWith("loading");
    m.fire("error", { sourceId: CORAL_SOURCE_ID, error: new Error("network error") });
    expect(state).toHaveBeenLastCalledWith("error");
    expect(m.layers.size).toBe(1);
    expect(m.sources.size).toBe(1);
    m.fire("sourcedata", { sourceId: CORAL_SOURCE_ID, isSourceLoaded: true });
    expect(state).toHaveBeenLastCalledWith("ready");
    expect(m.layers.size).toBe(1);
    expect(m.sources.size).toBe(1);
    dispose();
  });
  it("removes partial resources after synchronous setup failure so later source events cannot report ready", () => {
    vi.stubGlobal("window", { location: { href: "http://localhost/" } });
    const m = mockMap(); const state = vi.fn();
    m.map.addLayer = () => { throw new Error("style rebuilding"); };
    const dispose = mountAllenCoralAtlas(m.map, 0.55, "coralAlgae", "taiwan", state, async () => "test-token");
    expect(state).toHaveBeenLastCalledWith("error");
    expect(m.layers.size).toBe(0);
    expect(m.sources.size).toBe(0);
    m.fire("sourcedata", { sourceId: CORAL_SOURCE_ID, isSourceLoaded: true });
    expect(state).toHaveBeenCalledTimes(2);
    dispose();
  });
  it.each([{ status: 401 }, { status: 403 }, new Error("permission denied")])("fails closed only for explicit access denial: %j", error => {
    vi.stubGlobal("window", { location: { href: "http://localhost/" } });
    const m = mockMap(); const state = vi.fn();
    const dispose = mountAllenCoralAtlas(m.map, 0.55, "coralAlgae", "taiwan", state, async () => "test-token");
    m.fire("error", { sourceId: CORAL_SOURCE_ID, error });
    expect(state).toHaveBeenLastCalledWith("error");
    expect(m.layers.size).toBe(0);
    expect(m.sources.size).toBe(0);
    dispose();
  });
  it("disposes after MapView has already destroyed its style", () => {
    vi.stubGlobal("window", { location: { href: "http://localhost/" } });
    const m = mockMap(); const dispose = mountAllenCoralAtlas(m.map, 0.55, "coralAlgae", "taiwan", vi.fn(), async () => "test-token");
    m.map.getStyle = () => undefined as unknown as ReturnType<MapboxMap["getStyle"]>;
    m.map.getLayer = () => { throw new Error("destroyed map"); };
    expect(dispose).not.toThrow();
    expect([...m.listeners.values()].every(s => s.size === 0)).toBe(true);
  });
  it("ongoing tile progress extends the stall deadline without marking partial coverage ready", () => {
    vi.useFakeTimers(); vi.stubGlobal("window", { location: { href: "http://localhost/" } });
    const m = mockMap(); const state = vi.fn();
    const dispose = mountAllenCoralAtlas(m.map, 0.65, "benthic", "okinawa", state, async () => "token");
    vi.advanceTimersByTime(25000);
    m.fire("sourcedata", { sourceId: CORAL_SOURCE_ID, isSourceLoaded: false });
    vi.advanceTimersByTime(25000);
    expect(state).toHaveBeenLastCalledWith("loading");
    vi.advanceTimersByTime(5000);
    expect(state).toHaveBeenLastCalledWith("error");
    expect(m.sources.size).toBe(1);
    dispose();
  });
  it("times out as error and cancels pending timeout when closed during loading", () => {
    vi.useFakeTimers(); vi.stubGlobal("window", { location: { href: "http://localhost/" } });
    const m = mockMap(); const state = vi.fn();
    const dispose = mountAllenCoralAtlas(m.map, 0.55, "coralAlgae", "taiwan", state, async () => "test-token");
    vi.advanceTimersByTime(30000);
    expect(state).toHaveBeenLastCalledWith("error");
    dispose();
    const state2 = vi.fn(); const dispose2 = mountAllenCoralAtlas(m.map, 0.55, "coralAlgae", "taiwan", state2, async () => "test-token");
    dispose2(); vi.advanceTimersByTime(30000);
    expect(state2).toHaveBeenCalledTimes(1);
    expect(loadingRegistry.snapshot().filter(t => t.id.startsWith("allen-coral-"))).toEqual([]);
  });
});
