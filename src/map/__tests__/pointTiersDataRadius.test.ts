import { describe, expect, it, vi } from "vitest";

// 取 withPointSpec 套用前的原始 config：半徑是否依資料，要看 overlayRegistry 的原值。
vi.mock("../pointSpec", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../pointSpec")>()),
  withPointSpec: <T,>(config: T) => config,
}));

import { OVERLAY_REGISTRY } from "../overlayRegistry";
import { DECORATION_SUFFIX_RE, isDataDriven } from "../pointSpec";
import { POINT_TIERS } from "../pointTiers";

describe("R2 分階不得吃掉資料編碼的半徑", () => {
  it("原始半徑依 feature 資料（嚴重度、容量、床數…）的主體 circle 必須是泡泡 B，不能套 S／M／L 固定階", () => {
    const bad: string[] = [];
    for (const c of OVERLAY_REGISTRY) {
      const tier = POINT_TIERS[c.id];
      if (!tier || tier === "B") continue;
      for (const l of c.layers) {
        if (l.type !== "circle" || DECORATION_SUFFIX_RE.test(l.suffix)) continue;
        if (isDataDriven(l.paint(true, {})["circle-radius"])) bad.push(`${c.id}/${l.suffix} (${tier})`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("污染設施、一般裁處、發電廠、老人住宿、護理機構保留原始資料驅動半徑", () => {
    for (const id of ["pollutionFacility", "pollutionPenaltyGeneral", "powerPlants", "welfareElderlyHomes", "welfareNursingHomes"] as const) {
      expect(POINT_TIERS[id]).toBe("B");
    }
  });
});
