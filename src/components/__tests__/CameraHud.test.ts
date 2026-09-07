import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import { createCameraHudStore, formatCameraInfo, readCameraInfo } from "../CameraHud";

function fakeMap(values = { lng: 121.50006, lat: 25.01234, zoom: 9.64, pitch: 42.6, bearing: -12.4 }) {
  const events = new Map<string, Set<() => void>>();
  const map = {
    values,
    getCenter: () => ({ lng: map.values.lng, lat: map.values.lat }),
    getZoom: () => map.values.zoom,
    getPitch: () => map.values.pitch,
    getBearing: () => map.values.bearing,
    on(name: string, listener: () => void) {
      if (!events.has(name)) events.set(name, new Set());
      events.get(name)!.add(listener);
      return map;
    },
    off(name: string, listener: () => void) {
      events.get(name)?.delete(listener);
      return map;
    },
  };
  return {
    map: map as unknown as MapboxMap,
    emit(name: string) { [...(events.get(name) ?? [])].forEach((listener) => listener()); },
    count(name: string) { return events.get(name)?.size ?? 0; },
    values: map.values,
  };
}

describe("CameraHud", () => {
  it("rounds live map values with the pre-existing display format", () => {
    const source = fakeMap();
    const camera = readCameraInfo(source.map);
    expect(camera).toEqual({ lng: 121.5001, lat: 25.0123, zoom: 9.6, pitch: 43, bearing: -12 });
    expect(formatCameraInfo(camera)).toBe("25.0123, 121.5001 z9.6 pitch 43 bearing -12");
  });

  it("notifies only its subscribers for every move, then cleans up and rebinds maps", () => {
    const first = fakeMap();
    const replacement = fakeMap({ lng: 120.2, lat: 23.1, zoom: 6, pitch: 0, bearing: 90 });
    const store = createCameraHudStore();
    const hudRender = vi.fn();
    const unsubscribe = store.subscribe(hudRender);

    store.bind(first.map);
    expect(first.count("move")).toBe(1);
    first.values.zoom = 10.04;
    first.emit("move");
    expect(store.getSnapshot().zoom).toBe(10);
    expect(hudRender).toHaveBeenCalledTimes(2); // bind + every move; no throttling

    store.bind(replacement.map);
    expect(first.count("move")).toBe(0);
    expect(first.count("remove")).toBe(0);
    expect(replacement.count("move")).toBe(1);
    expect(store.getSnapshot()).toMatchObject({ lng: 120.2, lat: 23.1, bearing: 90 });
    first.emit("move");
    expect(hudRender).toHaveBeenCalledTimes(3);

    replacement.emit("remove");
    expect(replacement.count("move")).toBe(0);
    expect(replacement.count("remove")).toBe(0);
    unsubscribe();
    store.dispose();
  });

  it("keeps camera state out of App so move updates cannot render its hosts", () => {
    const app = readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");
    expect(app).not.toContain("setCameraInfo");
    expect(app).not.toMatch(/\[cameraInfo,/);
    expect(app).toContain("cameraHud.bind(map)");
  });
});
