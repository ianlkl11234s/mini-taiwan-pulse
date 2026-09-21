import { afterEach, describe, expect, it, vi } from "vitest";
import type { LayerSpecification, Map as MapboxMap } from "mapbox-gl";
import { cancelResearchMotion, clearResearchFocus, moveResearchCamera, prefersReducedMotion, showResearchFocus } from "../researchMotion";

function mapStub() {
  let center = { lng: 121.5, lat: 25 }; let zoom = 10;
  const listeners = new Map<string, Set<() => void>>(); const sources = new Map<string, { data: unknown; setData: (data: unknown) => void }>(); const layers = new Map<string, LayerSpecification>();
  const api = {
    getCenter: () => center, getZoom: () => zoom,
    easeTo: vi.fn(), stop: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => { (listeners.get(event) ?? listeners.set(event, new Set()).get(event)!).add(handler); }),
    off: vi.fn((event: string, handler: () => void) => listeners.get(event)?.delete(handler)),
    getSource: vi.fn((id: string) => sources.get(id)), addSource: vi.fn((id: string, data: { data: unknown }) => { const source = { data: data.data, setData(next: unknown) { source.data = next; } }; sources.set(id, source); }),
    getLayer: vi.fn((id: string) => layers.get(id)), addLayer: vi.fn((layer: LayerSpecification) => layers.set(layer.id, layer)),
    removeLayer: vi.fn((id: string) => layers.delete(id)), removeSource: vi.fn((id: string) => sources.delete(id)),
  };
  const updateCamera = (next: [number, number], nextZoom: number) => { center = { lng: next[0], lat: next[1] }; zoom = nextZoom; };
  return { map: api as unknown as MapboxMap, api, sources, layers, updateCamera, arrive(next: [number, number], nextZoom: number) { updateCamera(next, nextZoom); for (const handler of listeners.get("moveend") ?? []) handler(); } };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("research motion", () => {
  it("uses a bounded ease and accepts only an actual moveend camera readback", async () => {
    const state = mapStub(); const pending = moveResearchCamera(state.map, { center: [121.6, 25.1], zoom: 12 });
    expect(state.api.easeTo).toHaveBeenCalledWith(expect.objectContaining({ duration: 650 }));
    state.arrive([121.6, 25.1], 12); await expect(pending).resolves.toBe(true);
  });

  it("resolves stale movement false when superseded or cancelled", async () => {
    const state = mapStub(); const first = moveResearchCamera(state.map, { center: [121.6, 25.1], zoom: 12 });
    const second = moveResearchCamera(state.map, { center: [121.7, 25.2], zoom: 13 });
    await expect(first).resolves.toBe(false);
    state.arrive([121.7, 25.2], 13); await expect(second).resolves.toBe(true);
    const third = moveResearchCamera(state.map, { center: [121.8, 25.3], zoom: 14 }); cancelResearchMotion(state.map);
    await expect(third).resolves.toBe(false); expect(state.api.stop).toHaveBeenCalled(); expect(state.api.off).toHaveBeenCalledWith("moveend", expect.any(Function));
  });

  it("uses reduced motion and fails closed on timeout or invalid camera", async () => {
    vi.stubGlobal("window", { matchMedia: vi.fn(() => ({ matches: true })) });
    const state = mapStub(); expect(prefersReducedMotion()).toBe(true);
    const pending = moveResearchCamera(state.map, { center: [121.6, 25.1], zoom: 12 });
    expect(state.api.easeTo).toHaveBeenCalledWith(expect.objectContaining({ duration: 0 }));
    state.arrive([121.6, 25.1], 12); await expect(pending).resolves.toBe(true);
    vi.useFakeTimers(); const timedOut = moveResearchCamera(state.map, { center: [121.7, 25.2], zoom: 13 }); await vi.advanceTimersByTimeAsync(1_500); await expect(timedOut).resolves.toBe(false);
    await expect(moveResearchCamera(state.map, { center: [999, 25], zoom: 12 })).resolves.toBe(false);
  });

  it("accepts the final browser camera readback when moveend is missed", async () => {
    vi.useFakeTimers();
    const state = mapStub();
    const pending = moveResearchCamera(state.map, { center: [121.6, 25.1], zoom: 12 });
    state.updateCamera([121.6, 25.1], 12);
    await vi.advanceTimersByTimeAsync(1_500);
    await expect(pending).resolves.toBe(true);
  });

  it("accepts Mapbox's small zoom normalization after camera movement", async () => {
    const state = mapStub();
    const pending = moveResearchCamera(state.map, { center: [121.565, 25.033], zoom: 14 });
    state.arrive([121.565, 25.033], 13.9972);
    await expect(pending).resolves.toBe(true);
  });

  it("draws only a supplied straight-line radius and tears down safely", () => {
    const state = mapStub(); showResearchFocus(state.map, [121.5, 25]);
    const pointOnly = state.sources.get("research-motion-focus")!.data as { features: unknown[] }; expect(pointOnly.features).toHaveLength(1);
    showResearchFocus(state.map, [121.5, 25], 1000);
    const withRadius = state.sources.get("research-motion-focus")!.data as { features: { geometry: { coordinates: unknown[][][] }; properties: { kind: string } }[] };
    expect(withRadius.features).toHaveLength(2); expect(withRadius.features[1]!.properties.kind).toBe("straight_line_haversine_radius"); expect(withRadius.features[1]!.geometry.coordinates[0]).toHaveLength(65);
    expect(() => showResearchFocus(state.map, [121.5, 25], 99)).toThrow("INVALID_RESEARCH_FOCUS_RADIUS");
    clearResearchFocus(state.map); clearResearchFocus(state.map); expect(state.sources.size).toBe(0); expect(state.layers.size).toBe(0);
    const styleGone = { getLayer: () => { throw new Error("STYLE_NOT_READY"); }, getSource: () => { throw new Error("STYLE_NOT_READY"); } } as unknown as MapboxMap;
    expect(() => clearResearchFocus(styleGone)).not.toThrow();
  });
});
