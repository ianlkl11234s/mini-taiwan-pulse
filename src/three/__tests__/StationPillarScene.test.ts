import { describe, expect, it } from "vitest";
import { stationPillarMaterialOpacity } from "../StationPillarScene";

describe("StationPillarScene layer opacity", () => {
  it("keeps the original dark/light alpha at the default multiplier", () => {
    expect(stationPillarMaterialOpacity(true)).toBe(0.35);
    expect(stationPillarMaterialOpacity(false)).toBe(0.45);
  });

  it("multiplies opacity consistently and clamps invalid renderer input", () => {
    expect(stationPillarMaterialOpacity(true, 0.4)).toBeCloseTo(0.14);
    expect(stationPillarMaterialOpacity(false, 0.4)).toBeCloseTo(0.18);
    expect(stationPillarMaterialOpacity(true, -1)).toBe(0);
    expect(stationPillarMaterialOpacity(false, 2)).toBe(0.45);
  });
});
