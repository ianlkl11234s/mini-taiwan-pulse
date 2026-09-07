import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap, MapMouseEvent } from "mapbox-gl";
import { createMapInstanceEvents } from "../mapInstanceEvents";

function fakeMap() {
  const events = new Map<string, Set<(event?: unknown) => void>>();
  const map = {
    on(name: string, fn: (event?: unknown) => void) {
      if (!events.has(name)) events.set(name, new Set());
      events.get(name)!.add(fn);
      return map;
    },
    once(name: string, fn: (event?: unknown) => void) {
      // The production handler removes itself on its first event.
      return map.on(name, fn);
    },
    off(name: string, fn: (event?: unknown) => void) {
      events.get(name)?.delete(fn);
      return map;
    },
  };
  return {
    map: map as unknown as MapboxMap,
    emit(name: string, event?: unknown) {
      [...(events.get(name) ?? [])].forEach(fn => fn(event));
    },
    count: (name: string) => events.get(name)?.size ?? 0,
  };
}

function callbacks() {
  return { onStart: vi.fn(), onPrepared: vi.fn(), onMove: vi.fn(), onZoomEnd: vi.fn(), onClick: vi.fn() };
}

afterEach(() => vi.useRealTimers());

describe("map-instance listeners across style changes", () => {
  it("keeps one listener after 20 style rebuilds and refreshes the latest consumers", () => {
    vi.useFakeTimers();
    const map = fakeMap();
    const lifecycle = createMapInstanceEvents();
    const first = callbacks();
    lifecycle.ready(map.map, first);
    const latest = callbacks();
    for (let i = 0; i < 20; i++) lifecycle.ready(map.map, latest);
    for (const name of ["move", "zoomend", "click", "idle", "remove"]) expect(map.count(name)).toBe(1);
    expect(first.onStart).toHaveBeenCalledTimes(1);
    expect(latest.onStart).not.toHaveBeenCalled();
    expect(latest.onMove).toHaveBeenCalledTimes(20);
    latest.onMove.mockClear();
    map.emit("move");
    map.emit("click", { point: { x: 1, y: 2 } } as MapMouseEvent);
    expect(latest.onMove).toHaveBeenCalledTimes(1);
    expect(latest.onClick).toHaveBeenCalledTimes(1);
    expect(first.onClick).not.toHaveBeenCalled();
    lifecycle.dispose();
  });

  it("cancels the fallback after idle and prepares only once", () => {
    vi.useFakeTimers();
    const map = fakeMap();
    const cb = callbacks();
    const lifecycle = createMapInstanceEvents();
    lifecycle.ready(map.map, cb);
    map.emit("idle");
    vi.advanceTimersByTime(5000);
    map.emit("idle");
    expect(cb.onPrepared).toHaveBeenCalledTimes(1);
    expect(map.count("idle")).toBe(0);
    lifecycle.dispose();
  });

  it("prepares after four seconds when an animated map never idles", () => {
    vi.useFakeTimers();
    const map = fakeMap();
    const cb = callbacks();
    const lifecycle = createMapInstanceEvents();
    lifecycle.ready(map.map, cb);
    vi.advanceTimersByTime(4000);
    expect(cb.onPrepared).toHaveBeenCalledTimes(1);
    expect(map.count("idle")).toBe(0);
    lifecycle.dispose();
  });

  it("disposes on removal and supports a replacement map without stale callbacks", () => {
    vi.useFakeTimers();
    const old = fakeMap();
    const current = fakeMap();
    const before = callbacks();
    const after = callbacks();
    const lifecycle = createMapInstanceEvents();
    lifecycle.ready(old.map, before);
    old.emit("remove");
    for (const name of ["move", "zoomend", "click", "idle", "remove"]) expect(old.count(name)).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(before.onPrepared).not.toHaveBeenCalled();
    lifecycle.ready(current.map, after);
    old.emit("idle");
    expect(after.onPrepared).not.toHaveBeenCalled();
    current.emit("idle");
    expect(after.onPrepared).toHaveBeenCalledTimes(1);
    lifecycle.dispose();
    lifecycle.dispose();
    expect(current.count("move")).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
