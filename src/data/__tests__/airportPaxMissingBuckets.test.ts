import { describe, expect, it } from "vitest";
import { hasMissingHourBuckets, type AirportPaxBucket } from "../airportPaxLoader";

const mk = (offsetsH: number[]): AirportPaxBucket[] =>
  offsetsH.map((h) => ({
    hour_bucket: new Date(Date.UTC(2026, 9, 27, 0) + h * 3600_000).toISOString(),
    pax_in: 1, pax_out: 1, pax_transit: 0,
  }));

describe("hasMissingHourBuckets", () => {
  it("24 個連續小時 → 完整", () => {
    expect(hasMissingHourBuckets(mk(Array.from({ length: 24 }, (_, i) => i)))).toBe(false);
  });
  it("中間整桶缺席 → 缺資料", () => {
    expect(hasMissingHourBuckets(mk(Array.from({ length: 24 }, (_, i) => i).filter((i) => i !== 10)))).toBe(true);
  });
  it("視窗開頭缺桶 → 缺資料", () => {
    expect(hasMissingHourBuckets(mk(Array.from({ length: 20 }, (_, i) => i + 4)))).toBe(true);
  });
  it("空陣列不判缺", () => {
    expect(hasMissingHourBuckets([])).toBe(false);
  });
});
