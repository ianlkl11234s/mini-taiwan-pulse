import { describe, expect, it } from "vitest";
import { haversineM, slantDistanceM } from "../engines/geometryDistance";
import { soundDelayS, thunderTiming } from "../engines/thunderDelayKernel";
import { proximityPotential, rainPotential, thunderEnvelope } from "../engines/relativePotentialKernel";
import { COMMON, MODEL_VERSION, THUNDER } from "../model/soundProfiles";
import { RECV, latNorth } from "./fixtures";

describe("geometryDistance", () => {
  it("haversine 1 度緯度約 111.2 km、斜距用畢氏", () => {
    expect(haversineM(121, 25, 121, 26)).toBeCloseTo(111_195, -1);
    expect(slantDistanceM(300, 400)).toBe(500);
  });
});

describe("thunderDelayKernel", () => {
  it("T06：343 m 延遲約 1 秒", () => {
    const d = haversineM(RECV.longitude, RECV.latitude, RECV.longitude, latNorth(343));
    expect(d).toBeCloseTo(343, 0);
    const timing = thunderTiming(1000, d);
    expect(timing.delayS).toBeCloseTo(1, 2);
    expect(timing.flashTime).toBe(1000);
    expect(timing.perceivedArrivalTime).toBeCloseTo(1001, 2);
    expect(timing.propagationApproximation).toBe("2d");
  });
  it("3 km 約 8.7 秒；有通道高度時為 3d", () => {
    expect(soundDelayS(3000)).toBeCloseTo(8.75, 1);
    expect(thunderTiming(0, 3000, 4000).propagationApproximation).toBe("3d");
    expect(thunderTiming(0, 3000, 4000).distanceM).toBe(5000);
  });
  it("envelope 持續數秒、不是瞬間點", () => {
    const dur = THUNDER.envelopeDurationS.value;
    expect(dur).toBeGreaterThan(1);
    expect(thunderEnvelope(-0.1)).toBe(0);
    expect(thunderEnvelope(0)).toBe(1);
    expect(thunderEnvelope(dur / 2)).toBeGreaterThan(0);
    expect(thunderEnvelope(dur + 0.1)).toBe(0);
  });
});

describe("relativePotentialKernel", () => {
  it("雨勢潛勢單調遞增、0–1；null／負值 → null（T18 不當 0）", () => {
    const xs = [0, 1, 5, 10, 40, 200].map((r) => rainPotential(r)!);
    for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
    expect(xs[0]).toBe(0);
    expect(xs[xs.length - 1]).toBeLessThanOrEqual(1);
    expect(rainPotential(null)).toBeNull();
    expect(rainPotential(-1)).toBeNull();
  });
  it("接近度潛勢隨距離遞減、half 距離為 0.5", () => {
    expect(proximityPotential(0, 100)).toBe(1);
    expect(proximityPotential(100, 100)).toBeCloseTo(0.5);
    expect(proximityPotential(1000, 100)).toBeLessThan(proximityPotential(500, 100));
  });
  it("聲速與接收者高度是標註過的假設；有模型版本", () => {
    expect(COMMON.speedOfSoundMps.value).toBe(343);
    expect(COMMON.receiverDefaultHeightM.value).toBe(1.5);
    expect(COMMON.speedOfSoundMps.assumption.length).toBeGreaterThan(0);
    expect(MODEL_VERSION).toMatch(/^sound-atlas-/);
  });
});
