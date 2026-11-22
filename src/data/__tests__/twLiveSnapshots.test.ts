import { describe, expect, it } from "vitest";
import { dengueCenters, dengueSnapshotDate, navActiveFeatures, navWindows, twLiveUrl } from "../twLiveSnapshots";
import { NAV_KIND_BY_ID, NAV_KIND_IDS, NAV_KINDS, NAV_LIFETIME_DEFAULT_IDS } from "../twLiveTypes";

const pt = (props: Record<string, unknown>): GeoJSON.Feature => ({ type: "Feature", geometry: { type: "Point", coordinates: [120, 23] }, properties: props });

describe("twLiveSnapshots（B8）", () => {
  it("R2 路徑走 live/tw/ 固定檔名", () => {
    expect(twLiveUrl("dengueClusters", "latest.geojson")).toMatch(/\/live\/tw\/dengue_cluster\/latest\.geojson$/);
    expect(twLiveUrl("navNotices", "status.json")).toMatch(/\/live\/tw\/nav_notices\/status\.json$/);
    expect(twLiveUrl("tideSwellAlerts", "latest.geojson")).toMatch(/\/live\/tw\/cwa_tide_swell_alerts\/latest\.geojson$/);
  });

  it("航船布告只留有效期間內；永久（end_at 空）保留", () => {
    const now = Date.parse("2026-11-22T12:00:00+08:00");
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        pt({ id: "active", start_at: "2026-11-01T00:00:00+08:00", end_at: "2026-12-01T00:00:00+08:00" }),
        pt({ id: "future", start_at: "2026-11-23T00:00:00+08:00", end_at: null }),
        pt({ id: "expired", start_at: "2026-10-01T00:00:00+08:00", end_at: "2026-11-21T00:00:00+08:00" }),
        pt({ id: "permanent", start_at: "2017-09-07T10:00:00+08:00", end_at: null }),
        { type: "Feature", geometry: null as unknown as GeoJSON.Geometry, properties: { id: "nogeom" } },
      ],
    };
    expect(navActiveFeatures(fc, now).map((f) => f.properties?.id)).toEqual(["active", "permanent"]);
  });

  it("永久類預設不勾；類型 id 與中文類別一一對應", () => {
    expect(NAV_LIFETIME_DEFAULT_IDS).toEqual(["temporary"]);
    expect(NAV_KIND_IDS.map((id) => NAV_KIND_BY_ID[id])).toEqual([...NAV_KINDS]);
  });

  it("登革熱：缺中心座標不補點、日期轉 YYYY-MM-DD", () => {
    const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [pt({ center_lon: 120.29, center_lat: 22.67 }), pt({ center_lon: null, center_lat: null })] };
    expect(dengueCenters(fc).features).toHaveLength(1);
    expect(dengueSnapshotDate({ snapshot_date: "20261122" })).toBe("2026-11-22");
    expect(dengueSnapshotDate(null)).toBeNull();
  });

  it("windows 壞掉回空陣列", () => {
    expect(navWindows("not json")).toEqual([]);
    expect(navWindows('[{"from":"a","to":"b"}]')).toHaveLength(1);
  });
});
