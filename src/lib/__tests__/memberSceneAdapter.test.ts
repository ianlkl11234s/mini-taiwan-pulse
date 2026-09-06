import { describe, expect, it } from "vitest";
import { resolveSceneRestore } from "../memberSceneAdapter";
import type { MemberSceneSnapshot } from "../memberSchema";

const scene: MemberSceneSnapshot = {
  version: 1,
  camera: { lng: 121.5, lat: 25.04, zoom: 10, pitch: 0, bearing: 0 },
  basemap: "removed-style",
  layers: ["cctv", "removedLayer", "aqi"],
  params: {
    cctv: { cctvOpacity: 9, removedControl: true },
    aqi: { aqiOpacity: 0.5 },
  },
  time: { mode: "realtime", cursorISO: "2026-09-06T00:00:00Z", windowDays: 1 },
};

describe("memberSceneAdapter", () => {
  it("略過已下架與未授權圖層，並將不相容參數改回安全預設", () => {
    const restored = resolveSceneRestore(scene, new Set(["cctv", "aqi"]), new Set(["aqi"]), ["dark", "standard"]);
    expect(restored.layers).toEqual(["cctv"]);
    expect(restored.params.cctv?.cctvOpacity).toBe(0.7);
    expect(restored.basemap).toBe("dark");
    expect(restored.skipped.join("\n")).toContain("removedLayer：已下架");
    expect(restored.skipped.join("\n")).toContain("aqi：目前未授權");
    expect(restored.skipped.join("\n")).toContain("cctv.cctvOpacity：參數已不相容，使用預設");
  });

  it("已移除的參數不會套用，且會留下使用者可理解的提示", () => {
    const restored = resolveSceneRestore(scene, new Set(["cctv", "aqi"]), new Set(), ["dark"]);
    expect(restored.params.cctv).not.toHaveProperty("removedControl");
    expect(restored.skipped).toContain("cctv.removedControl：參數已移除");
  });

  it("動態細項只依已驗證的大類選項還原，播放一律維持暫停", () => {
    const dynamicScene: MemberSceneSnapshot = {
      ...scene,
      layers: ["indicators"],
      params: {
        indicators: { indCategory: "struct", indMetric: "dr" },
      },
    };
    const restored = resolveSceneRestore(dynamicScene, new Set(["indicators", "pollutionPenalties"]), new Set(), ["dark"]);
    expect(restored.params.indicators).toMatchObject({ indCategory: "struct", indMetric: "sr" });
  });
});
