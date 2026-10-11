import { describe, expect, it } from "vitest";
import { latestTleEpochMs } from "../satelliteLoader";
import { parseTleEpoch } from "../satelliteSGP4";
import type { SatelliteRecord } from "../satelliteTypes";

const L1 = (epoch: string) => `1 25544U 98067A   ${epoch}  .00016717  00000-0  10270-3 0  9054`;
const rec = (epoch: string) => ({ noradId: 1, name: "X", category: "tw", tleLine1: L1(epoch), tleLine2: "" }) as unknown as SatelliteRecord;

describe("latestTleEpochMs", () => {
  it("取最新的 TLE epoch，不是瀏覽器現在時間", () => {
    const t = latestTleEpochMs([rec("24001.50000000"), rec("24010.25000000"), rec("24005.00000000")]);
    expect(t).toBe(parseTleEpoch(L1("24010.25000000")));
    expect(t).toBeLessThan(Date.now());
  });
  it("沒有有效 epoch 回 null", () => {
    expect(latestTleEpochMs([])).toBeNull();
  });
});
