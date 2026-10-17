import { describe, expect, it } from "vitest";
import { aggregateCountySurge, rankHotspots } from "../HotspotsWidget";
import type { TrendingRow } from "../../../../data/intelLoaders";
import type { ClusterEvent } from "../../../../data/newsEventsLoader";

const row = (county: string, category: string, cnt: number, baseline_avg: number): TrendingRow => ({
  county, category, cnt, baseline_avg, surge_ratio: null,
});

describe("aggregateCountySurge", () => {
  it("sums cnt and baseline per county, then divides", () => {
    const m = aggregateCountySurge([
      row("臺北市", "traffic", 6, 2), row("臺北市", "crime", 2, 2), row("高雄市", "fire", 3, 6),
    ]);
    expect(m.get("臺北市")).toEqual({ ratio: 2, isNew: false });
    expect(m.get("高雄市")).toEqual({ ratio: 0.5, isNew: false });
  });

  it("returns null (not Infinity) when baseline is 0, and flags 新 only when there is count", () => {
    const m = aggregateCountySurge([row("花蓮縣", "quake", 4, 0), row("宜蘭縣", "x", 0, 0)]);
    expect(m.get("花蓮縣")).toEqual({ ratio: null, isNew: true });
    expect(m.get("宜蘭縣")).toEqual({ ratio: null, isNew: false });
  });

  it("treats a missing baseline as unknown and tolerates empty input", () => {
    const m = aggregateCountySurge([{ county: "南投縣", category: "x", cnt: 3, baseline_avg: null as unknown as number, surge_ratio: null }]);
    expect(m.get("南投縣")).toEqual({ ratio: null, isNew: false });
    expect(aggregateCountySurge(undefined).size).toBe(0);
  });
});

describe("rankHotspots surge", () => {
  const ev = (id: number): ClusterEvent => ({ id, category: "traffic" } as ClusterEvent);
  it("uses the aggregated surge, null when the county has no trending row", () => {
    const ranked = rankHotspots(
      [ev(1), ev(2), ev(3)],
      new Map([[1, "臺北市"], [2, "臺北市"], [3, "苗栗縣"]]),
      aggregateCountySurge([row("臺北市", "traffic", 4, 2)]),
    );
    expect(ranked[0]).toMatchObject({ county: "臺北市", n: 2, surge: 2 });
    expect(ranked[1]).toMatchObject({ county: "苗栗縣", surge: null, surgeIsNew: false });
  });
});
