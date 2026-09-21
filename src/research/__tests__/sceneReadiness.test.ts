import { afterEach, describe, expect, it, vi } from "vitest";
import { awaitSceneIdle, waitForSceneRender, type IdleMap } from "../sceneReadiness";
import { loadingRegistry } from "../../lib/loadingRegistry";

class MapEvents implements IdleMap {
  listeners = new Map<string, Set<() => void>>();
  on(type: string, callback: () => void) { const set = this.listeners.get(type) ?? new Set(); set.add(callback); this.listeners.set(type, set); }
  off(type: string, callback: () => void) { this.listeners.get(type)?.delete(callback); }
  triggerRepaint() {}
  emit(type: string) { for (const callback of this.listeners.get(type) ?? []) callback(); }
}
afterEach(() => vi.useRealTimers());
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
});
