import { describe, expect, it } from "vitest";
import { wasteFlatFeatures, wasteTruckKey } from "../flatMovingController";
import type { WasteTrailRow } from "../../data/wasteLoader";

const row = (over: Partial<WasteTrailRow>): WasteTrailRow => ({
  vehicle_no: "KLC-001", city: "tainan", route_id: "R1", trail: [], ...over,
});
const placement = (r: WasteTrailRow) => ({
  row: r,
  frame: { lat: 22.6, lng: 120.3, status: "collecting" as const, alpha: 1, visible: true },
  bearing: null,
});

describe("wasteTruckKey（垃圾車平面層選取鍵）", () => {
  it("同車號但不同縣市／路線 → 鍵不同", () => {
    const a = wasteTruckKey(row({}));
    expect(wasteTruckKey(row({ city: "taoyuan" }))).not.toBe(a);
    expect(wasteTruckKey(row({ route_id: "R2" }))).not.toBe(a);
    expect(wasteTruckKey(row({ route_id: null }))).not.toBe(a);
  });
  it("wasteFlatFeatures 的 key 與 wasteTruckKey 一致", () => {
    const r = row({ city: "taoyuan" });
    const fc = wasteFlatFeatures([placement(r)]);
    expect(fc.features[0]!.properties.key).toBe(wasteTruckKey(r));
  });
});
