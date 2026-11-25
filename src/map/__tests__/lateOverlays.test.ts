/**
 * B1 P5b：國家包的 overlay 晚於 style.load 才併入 registry 時，補建的圖層疊放順序要等同「一開始就載入」。
 * 同一份 registry、同樣的事後圖層（hook 自己加的 layer），兩條路徑的 style 圖層順序必須一致。
 */
import { describe, expect, it } from "vitest";
import { addAllOverlays, addLateOverlays, type OverlayMap } from "../overlayManager";
import type { LayerVisibility, OverlayConfig } from "../../types";

function fakeMap(): OverlayMap & { ids(): string[] } {
  const layers: Array<{ id: string; layout?: Record<string, unknown> }> = [];
  const sources = new Map<string, unknown>();
  return {
    getSource: (id) => sources.get(id),
    addSource: (id, source) => { sources.set(id, source); },
    removeSource: (id) => { sources.delete(id); },
    getLayer: (id) => layers.find((l) => l.id === id),
    addLayer: (layer: { id: string }, before?: string) => {
      const at = before === undefined ? -1 : layers.findIndex((l) => l.id === before);
      if (at < 0) layers.push({ id: layer.id });
      else layers.splice(at, 0, { id: layer.id });
    },
    removeLayer: (id) => { const i = layers.findIndex((l) => l.id === id); if (i >= 0) layers.splice(i, 1); },
    getLayoutProperty: (id, name) => layers.find((l) => l.id === id)?.layout?.[name],
    setLayoutProperty: (id, name, value) => { const l = layers.find((x) => x.id === id); if (l) l.layout = { ...l.layout, [name]: value }; },
    setPaintProperty: () => undefined,
    getStyle: () => ({ layers: layers.map((l) => ({ id: l.id })) }),
    ids: () => layers.map((l) => l.id),
  };
}

const overlay = (id: string, suffixes = ["fill"]): OverlayConfig => ({
  id: id as keyof LayerVisibility,
  sourceUrl: "./geo/_empty.geojson",
  sourceId: `src-${id}`,
  dynamicData: true,
  layers: suffixes.map((suffix) => ({ suffix, type: "fill", paint: () => ({}) })),
} as unknown as OverlayConfig);

const vis = {} as LayerVisibility;

function startOrder(registry: OverlayConfig[]): string[] {
  const map = fakeMap();
  addAllOverlays(map, registry, true, vis);
  map.addLayer({ id: "hook-layer" });
  return map.ids();
}

function lateOrder(registry: OverlayConfig[], late: OverlayConfig[]): string[] {
  const map = fakeMap();
  addAllOverlays(map, registry.filter((c) => !late.includes(c)), true, vis);
  map.addLayer({ id: "hook-layer" });
  addLateOverlays(map, registry, late, true, vis);
  return map.ids();
}

describe("addLateOverlays：晚到的國家包 overlay 疊放順序等同一開始就載入", () => {
  const a = overlay("a", ["fill", "line"]);
  const b = overlay("b", ["fill", "line"]);
  const c = overlay("c");
  const d = overlay("d");

  it("插在中間", () => {
    expect(lateOrder([a, b, c], [b])).toEqual(startOrder([a, b, c]));
  });
  it("插在最後（仍在事後加的 hook 圖層下面）", () => {
    expect(lateOrder([a, b, c], [c])).toEqual(startOrder([a, b, c]));
  });
  it("插在最前面、連續兩筆、分兩次到", () => {
    const registry = [a, b, c, d];
    expect(lateOrder(registry, [a])).toEqual(startOrder(registry));
    expect(lateOrder(registry, [b, c])).toEqual(startOrder(registry));
    const map = fakeMap();
    addAllOverlays(map, [a, d], true, vis);
    map.addLayer({ id: "hook-layer" });
    addLateOverlays(map, registry, [c], true, vis);
    addLateOverlays(map, registry, [b], true, vis);
    expect(map.ids()).toEqual(startOrder(registry));
  });
  it("已在圖上的不重建（可重複呼叫）", () => {
    const map = fakeMap();
    addAllOverlays(map, [a, b], true, vis);
    addLateOverlays(map, [a, b], [b], true, vis);
    expect(map.ids()).toEqual(["a-fill", "a-line", "b-fill", "b-line"].map((s) => expect.stringContaining(s)));
  });
});
