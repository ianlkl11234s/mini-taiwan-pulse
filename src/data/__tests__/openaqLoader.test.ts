import { describe, expect, it } from "vitest";
import { buildPhOpenaqGeoJSON, normalizePhOpenaqRows, phOpenaqFreshness, toPhOpenaqPm25Series } from "../openaqLoader";

const NOW = Date.parse("2026-11-20T09:00:00Z");
const row = (o: Record<string, unknown>) => ({ location_id: 1, lon: 121, lat: 14.6, is_monitor: false, ...o });

describe("openaqLoader", () => {
  it("0 是真值、null 是無資料", () => {
    const [zero, missing] = normalizePhOpenaqRows([
      row({ location_id: 1, pm25: 0, pm25_observed_at: "2026-11-20T08:00:00Z", observed_at: "2026-11-20T08:00:00Z" }),
      row({ location_id: 2, pm25: null, observed_at: "2026-11-20T08:00:00Z" }),
    ]);
    expect(zero!.pm25).toBe(0);
    expect(missing!.pm25).toBeNull();
    expect(phOpenaqFreshness(zero!, NOW)).toBe("fresh");
    expect(phOpenaqFreshness(missing!, NOW)).toBe("noData");
    const { fc } = buildPhOpenaqGeoJSON([zero!, missing!], NOW);
    expect(fc.features[0]!.properties!.pm25).toBe(0);
    expect("pm25" in fc.features[1]!.properties!).toBe(false);
    expect(fc.features[1]!.properties!.color).toBe("#707070");
  });

  it("超過 3 小時標過舊；近 30 天無資料或時間全空的站隱藏", () => {
    const stations = normalizePhOpenaqRows([
      row({ location_id: 1, pm25: 12, pm25_observed_at: "2026-11-20T04:00:00Z", observed_at: "2026-11-20T04:00:00Z" }),
      row({ location_id: 2, datetime_last: "2026-10-01T00:00:00Z" }),
      row({ location_id: 3, datetime_last: "2026-11-10T00:00:00Z" }),
      row({ location_id: 4, is_monitor: true }),
      row({ location_id: 5, lon: null }),
    ]);
    expect(stations).toHaveLength(4);
    const { fc, summary } = buildPhOpenaqGeoJSON(stations, NOW);
    expect(fc.features.map((f) => f.properties!.location_id)).toEqual([1, 3]);
    expect(fc.features[0]!.properties!.freshness).toBe("stale");
    expect(summary).toMatchObject({ shown: 2, hidden: 2, stale: 1, noData: 1, monitorsHidden: 1, monitorsShown: 0 });
  });

  it("走勢只取 pm25、丟掉 NULL、依時間排序", () => {
    const pts = toPhOpenaqPm25Series([
      { observed_at: "2026-11-20T02:00:00Z", parameter: "pm25", value: 5 },
      { observed_at: "2026-11-20T01:00:00Z", parameter: "pm25", value: null },
      { observed_at: "2026-11-20T00:00:00Z", parameter: "pm25", value: 0 },
      { observed_at: "2026-11-20T00:00:00Z", parameter: "pm10", value: 9 },
    ]);
    expect(pts.map((p) => p.v)).toEqual([0, 5]);
  });
});
