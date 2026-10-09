/**
 * 消防分隊類別色：paint 的 circle-color match 與圖例 FIRE_STATION_CATS 同一常數（map-layers.md LG-1）。
 */
import { describe, expect, it } from "vitest";
import { FIRE_STATION_CATS, fireStationColor, fireStationColorMatch } from "../fireTypes";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";

describe("fireStations 類別色", () => {
  it("match 表達式由 FIRE_STATION_CATS 展開，其他＝fallback", () => {
    expect(fireStationColorMatch()).toEqual([
      "match", ["get", "cat"], "大隊", "#b71c1c", "分隊", "#e53935", "分駐所", "#ff7043", "#bdbdbd",
    ]);
    for (const c of FIRE_STATION_CATS) expect(fireStationColor(c.cat)).toBe(c.color);
  });

  it("overlay 兩個子層（glow / circle）的 circle-color 都等於圖例常數展開", () => {
    const cfg = OVERLAY_REGISTRY.find((c) => c.id === "fireStations")!;
    expect(cfg.layers.map((l) => l.suffix)).toEqual(["glow", "circle"]);
    for (const layer of cfg.layers) {
      for (const dark of [true, false]) {
        const paint = typeof layer.paint === "function" ? layer.paint(dark, {}) : layer.paint;
        expect((paint as Record<string, unknown>)["circle-color"]).toEqual(fireStationColorMatch());
      }
    }
  });
});
