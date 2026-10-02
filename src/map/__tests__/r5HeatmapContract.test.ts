import { describe, expect, it } from "vitest";
import { OVERLAY_REGISTRY } from "../overlayRegistry";
import { densePointOpacity, densePointsFromZoom, HEATMAP, heatmapPaint } from "../mapStyleScale";
import { paramDefault } from "../../data/layerParamsSpec";

describe("R5 密集點熱區（P-3／P-4／G-2）", () => {
  it("出點縮放依點數，且不讓點比原本更早出現", () => {
    expect(densePointsFromZoom(5_000, 0)).toBe(0);
    expect(densePointsFromZoom(69_839)).toBe(HEATMAP.pointsFromZoomOver10k);
    expect(densePointsFromZoom(69_839, 12)).toBe(12);
    expect(densePointsFromZoom(167_037)).toBe(HEATMAP.pointsFromZoomOver100k);
  });

  it("熱區 paint：密度 0 透明、透明度隨滑桿比例且上限 1", () => {
    const paint = heatmapPaint();
    const color = paint["heatmap-color"] as unknown[];
    expect(color[3]).toBe(0);
    expect(String(color[4])).toMatch(/,0\.00\)$/);
    expect(paint["heatmap-opacity"]).toBe(HEATMAP.opacity);
    expect(heatmapPaint(0.5)["heatmap-opacity"]).toBeCloseTo(0.4);
    expect(heatmapPaint(2)["heatmap-opacity"]).toBe(1);
  });

  it("fireHydrants：熱區 z<12、點 z≥12，熱區透明度跟著透明度滑桿", () => {
    const config = OVERLAY_REGISTRY.find((c) => c.id === "fireHydrants")!;
    const heat = config.layers.find((l) => l.type === "heatmap")!;
    expect(heat.maxzoom).toBe(12);
    for (const l of config.layers.filter((l) => l.type === "circle")) expect(l.minzoom).toBe(12);
    const def = Number(paramDefault("fireHydrants", "fireHydrantsOpacity"));
    expect(def).toBe(densePointOpacity(69_839));
    expect(heat.paint(true, { fireHydrantsOpacity: def })["heatmap-opacity"]).toBeCloseTo(HEATMAP.opacity);
    expect(heat.paint(true, { fireHydrantsOpacity: def / 2 })["heatmap-opacity"]).toBeCloseTo(HEATMAP.opacity / 2);
  });
});
