import { afterEach, describe, expect, it, vi } from "vitest";
import { awaitSceneIdle, isStyleReady, waitForMapStyle, waitForLayoutFrame, waitForSceneRender, type IdleMap } from "../sceneReadiness";
import { loadingRegistry } from "../../lib/loadingRegistry";

class MapEvents implements IdleMap {
  listeners = new Map<string, Set<() => void>>();
  on(type: string, callback: () => void) { const set = this.listeners.get(type) ?? new Set(); set.add(callback); this.listeners.set(type, set); }
  off(type: string, callback: () => void) { this.listeners.get(type)?.delete(callback); }
  triggerRepaint() {}
  emit(type: string) { for (const callback of this.listeners.get(type) ?? []) callback(); }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("research readiness", () => {
  it("times out as an error and releases all listeners and loading registrations", () => {
    vi.useFakeTimers();
    const map = new MapEvents(); const report = vi.fn();
    awaitSceneIdle(map, 11, report, 100);
    expect(loadingRegistry.snapshot().some(t => t.id === "research:render:11")).toBe(true);
    vi.advanceTimersByTime(100);
    expect(report.mock.calls.map(c => c[0])).toEqual(["loading", "error"]);
    map.emit("idle");
    expect(report).toHaveBeenCalledTimes(2);
    expect(loadingRegistry.snapshot()).toEqual([]);
    expect([...map.listeners.values()].every(s => s.size === 0)).toBe(true);
  });
  it("cancelled old revision cannot report readiness after the new revision starts", () => {
    const map = new MapEvents(); const old = vi.fn(); const latest = vi.fn();
    const cancel = awaitSceneIdle(map, 1, old);
    cancel();
    awaitSceneIdle(map, 2, latest);
    map.emit("idle");
    expect(old.mock.calls.map(c => c[0])).toEqual(["loading"]);
    expect(latest.mock.calls.map(c => c[0])).toEqual(["loading", "ready"]);
    expect(loadingRegistry.snapshot()).toEqual([]);
  });
  it("resolves a camera command only after the next rendered frame", async () => {
    const map = new MapEvents();
    const wait = waitForSceneRender(map, 3, 100);
    map.emit("error");
    let settled = false;
    void wait.promise.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    map.emit("render");
    await expect(wait.promise).resolves.toBe("ready");
    expect(loadingRegistry.snapshot()).toEqual([]);
  });
  it("retries framing readback on later rendered frames after layout commits", async () => {
    const map = new MapEvents();
    const readback = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const wait = waitForSceneRender(map, 4, 100, readback);
    expect(readback).not.toHaveBeenCalled();
    map.emit("render");
    map.emit("render");
    await expect(wait.promise).resolves.toBe("ready");
    expect(readback).toHaveBeenCalledTimes(2);
    expect(loadingRegistry.snapshot()).toEqual([]);
    expect([...map.listeners.values()].every(s => s.size === 0)).toBe(true);
  });
  it("keeps a failed framing readback pending until its timeout", async () => {
    vi.useFakeTimers();
    const map = new MapEvents(); const readback = vi.fn(() => false);
    const wait = waitForSceneRender(map, 5, 100, readback);
    map.emit("render"); map.emit("render");
    await vi.advanceTimersByTimeAsync(100);
    await expect(wait.promise).resolves.toBe("error");
    expect(readback).toHaveBeenCalledTimes(2);
    expect(loadingRegistry.snapshot()).toEqual([]);
    expect([...map.listeners.values()].every(s => s.size === 0)).toBe(true);
  });
  it("does not wait forever for hidden-document layout frames", async () => {
    vi.stubGlobal("document", { visibilityState: "hidden" });
    await expect(waitForLayoutFrame()).resolves.toBe(false);
  });
});


describe("style replacement", () => {
  it("waits for the new style and removes listeners", async () => {
    const events = new MapEvents(); let loaded = false;
    const map = Object.assign(events, { isStyleLoaded: () => loaded });
    const wait = waitForMapStyle(map, () => true);
    events.emit("style.load");
    loaded = true; events.emit("render");
    await expect(wait).resolves.toBe(true);
    expect([...events.listeners.values()].every(set => set.size === 0)).toBe(true);
  });
  it("does not revive work superseded while loading", async () => {
    const events = new MapEvents(); let current = true; let loaded = false;
    const wait = waitForMapStyle(Object.assign(events, { isStyleLoaded: () => loaded }), () => current);
    current = false; loaded = true; events.emit("style.load");
    await expect(wait).resolves.toBe(false);
  });
  it("ends on timeout or map removal without reporting success", async () => {
    vi.useFakeTimers();
    for (const removed of [false, true]) {
      const events = new MapEvents();
      const wait = waitForMapStyle(Object.assign(events, { isStyleLoaded: () => false }), () => true, 100);
      if (removed) events.emit("remove"); else await vi.advanceTimersByTimeAsync(100);
      await expect(wait).resolves.toBe(false);
      expect([...events.listeners.values()].every(set => set.size === 0)).toBe(true);
    }
  });
  // Regression (2026-10-02 live eval): earthquakesGlobal ripples setPaintProperty a data-driven
  // circle-radius every frame, so Mapbox marks the source "reload" every frame and
  // isStyleLoaded()/loaded() never turn true. A parsed style must still count as ready.
  it("treats a parsed style as ready while tiles or an animated source keep loading", async () => {
    expect(isStyleReady({ isStyleLoaded: () => false, getStyle: () => ({ version: 8 }) })).toBe(true);
    expect(isStyleReady({ isStyleLoaded: () => false, getStyle: () => { throw new Error("Style is not done loading"); } })).toBe(false);
    expect(isStyleReady({ isStyleLoaded: () => false })).toBe(false);
    expect(isStyleReady({ isStyleLoaded: () => true, getStyle: () => { throw new Error("unused"); } })).toBe(true);
    const events = new MapEvents();
    const busy = Object.assign(events, { isStyleLoaded: () => false, getStyle: () => ({ version: 8 }) });
    await expect(waitForMapStyle(busy, () => true, 100)).resolves.toBe(true);
    expect([...events.listeners.values()].every(set => set.size === 0)).toBe(true);
  });
  it("resolves on style.load during a style swap even if tiles never settle", async () => {
    vi.useFakeTimers();
    const events = new MapEvents(); let parsed = false;
    const map = Object.assign(events, { isStyleLoaded: () => false, getStyle: () => { if (!parsed) throw new Error("Style is not done loading"); return { version: 8 }; } });
    const wait = waitForMapStyle(map, () => true, 5_000);
    events.emit("render");
    parsed = true; events.emit("style.load");
    await expect(wait).resolves.toBe(true);
    expect([...events.listeners.values()].every(set => set.size === 0)).toBe(true);
  });
});
