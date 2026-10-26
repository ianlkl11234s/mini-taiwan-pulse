import { describe, expect, it } from "vitest";
import { JP_INLAND_FLOOD_DEPTH_CLASSES, JP_INLAND_FLOOD_STEPS, jpInlandFloodFillColor } from "../data/jpInlandFloodTypes";

describe("日本內水浸水想定區域 PMTiles 契約", () => {
  it("浸水深 8 級，rank 1–8 由淺到深", () => {
    expect(JP_INLAND_FLOOD_DEPTH_CLASSES.map((c) => c.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(JP_INLAND_FLOOD_STEPS).toBe(8);
  });

  it("depth_rank → 色階 match；無效 rank 透明", () => {
    const colors = ["#1", "#2", "#3", "#4", "#5", "#6", "#7", "#8"];
    const expr = jpInlandFloodFillColor(colors);
    expect(expr.slice(0, 2)).toEqual(["match", ["get", "depth_rank"]]);
    expect(expr).toContain("#8");
    expect(expr[expr.length - 1]).toBe("rgba(0,0,0,0)");
  });
});
