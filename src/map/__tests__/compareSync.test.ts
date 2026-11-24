import { describe, expect, it } from "vitest";
import { alignScale, scaleMatchedZoom, syncMaps, syncScale, type SyncableMap } from "../compareSync";

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

describe("syncScale（兩國並排：只同步比例尺）", () => {
  const mercatorMetersPerPixel = (lat: number, zoom: number) => (Math.cos((lat * Math.PI) / 180) * 2 * Math.PI * 6378137) / (512 * 2 ** zoom);

  it("台灣 24°N 對英國 54°N 約差 −0.64 級，換算後每像素公尺數相同", () => {
    const zoomGb = scaleMatchedZoom(10, 24, 54);
    expect(zoomGb - 10).toBeCloseTo(-0.636, 2);
    expect(mercatorMetersPerPixel(54, zoomGb)).toBeCloseTo(mercatorMetersPerPixel(24, 10), 6);
  });

  it("縮放左圖只改右圖 zoom，不動中心；平移換緯度會重算", () => {
    const tw = fakeMap("tw");
    const gb = fakeMap("gb");
    tw.move({ center: { lng: 121.5, lat: 24 }, zoom: 10 });
    gb.move({ center: { lng: -0.12, lat: 54 }, zoom: 10 });
    const off = syncScale(tw, gb, () => true);
    tw.move({ zoom: 11 });
    expect(gb.camera().zoom).toBeCloseTo(scaleMatchedZoom(11, 24, 54), 9);
    expect(gb.camera().center).toEqual({ lng: -0.12, lat: 54 });
    // 英國往南平移到 50°N：右圖自己是動的那張 → 調左圖
    gb.move({ center: { lng: -0.12, lat: 50 } });
    expect(tw.camera().zoom).toBeCloseTo(scaleMatchedZoom(gb.camera().zoom, 50, 24), 9);
    expect(tw.camera().center).toEqual({ lng: 121.5, lat: 24 });
    off();
  });

  it("防重入：一次移動只觸發對方一次 jumpTo", () => {
    const a = fakeMap("a");
    const b = fakeMap("b");
    b.move({ center: { lng: 0, lat: 50 } });
    const off = syncScale(a, b, () => true);
    a.move({ zoom: 8 });
    expect(b.jumps).toEqual(["b"]);
    expect(a.jumps).toEqual([]);
    off();
  });

  it("關掉同步後各自縮放；重新打開用 alignScale 對齊一次", () => {
    const a = fakeMap("a");
    const b = fakeMap("b");
    b.move({ center: { lng: 0, lat: 54 }, zoom: 6 });
    let locked = false;
    const off = syncScale(a, b, () => locked);
    a.move({ zoom: 12 });
    expect(b.camera().zoom).toBe(6);
    locked = true;
    expect(alignScale(a, b)).toBe(true);
    expect(b.camera().zoom).toBeCloseTo(scaleMatchedZoom(12, 23.5, 54), 9);
    expect(alignScale(a, b)).toBe(false);
    off();
    a.move({ zoom: 5 });
    expect(b.camera().zoom).toBeCloseTo(scaleMatchedZoom(12, 23.5, 54), 9);
  });
});
