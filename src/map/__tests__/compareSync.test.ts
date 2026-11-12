import { describe, expect, it } from "vitest";
import { syncMaps, type SyncableMap } from "../compareSync";

function fakeMap(name: string) {
  const listeners = new Set<() => void>();
  let camera = { center: { lng: 121, lat: 23.5 }, zoom: 7, bearing: 0, pitch: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 } };
  const jumps: string[] = [];
  const map: SyncableMap & { move: (next: Partial<typeof camera>) => void; camera: () => typeof camera; jumps: string[] } = {
    on: (_type, listener) => listeners.add(listener),
    off: (_type, listener) => listeners.delete(listener),
    getCenter: () => camera.center,
    getZoom: () => camera.zoom,
    getBearing: () => camera.bearing,
    getPitch: () => camera.pitch,
    getPadding: () => camera.padding,
    jumpTo: (options) => { jumps.push(name); camera = { ...camera, ...(options as Partial<typeof camera>) }; listeners.forEach((l) => l()); },
    move: (next) => { camera = { ...camera, ...next }; listeners.forEach((l) => l()); },
    camera: () => camera,
    jumps,
  };
  return map;
}

describe("syncMaps", () => {
  it("雙向同步、不會無限遞迴，解除後不再同步", () => {
    const a = fakeMap("a");
    const b = fakeMap("b");
    const mirrored: string[] = [];
    const off = syncMaps(a, b, (_from, to) => mirrored.push(to === b ? "b" : "a"));
    a.move({ zoom: 9, pitch: 45 });
    expect(b.camera()).toMatchObject({ zoom: 9, pitch: 45 });
    expect(b.jumps).toEqual(["b"]);
    expect(a.jumps).toEqual([]);
    b.move({ center: { lng: 121.5, lat: 25 }, bearing: 30 });
    expect(a.camera()).toMatchObject({ center: { lng: 121.5, lat: 25 }, bearing: 30 });
    expect(mirrored).toEqual(["b", "a"]);
    off();
    a.move({ zoom: 3 });
    expect(b.camera().zoom).toBe(9);
  });
});
