import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CEMS_STATUSES, CWA_UV_LEVELS, NUSC_GAMMA_HIGH_USVH, RIVER_RPI_CLASSES, SEA_WATER_CLASSES, cemsFacilityStatus, riverRpiSegmentColorExpr,
  RIVER_RPI_ASSIGN_METHOD_LABELS, RIVER_RPI_DIRECTION_LABELS, RIVER_RPI_REASSIGN_METHOD, RIVER_RPI_REVIEW_FLAG_FALLBACK,
  RIVER_RPI_REVIEW_FLAG_LABELS, RIVER_RPI_TIDAL_LABELS, riverRpiReviewNotes,
} from "../environmentLayerTypes";
import { waterEffluentStatus } from "../environmentLiveLoaders";
import { LAYER_MANIFEST } from "../layerManifest";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";

type Collection = { features: Array<{ properties: Record<string, unknown>; geometry: { type: string } }> };
const read = (name: string) => JSON.parse(readFileSync(resolve("public/environment", name), "utf8")) as Collection;

describe("環境第二波靜態資產", () => {
  it("海域水質 250 站，甲乙丙全覆蓋，過期站保留", () => {
    const features = read("sea_water_quality_stations.geojson").features;
    expect(features).toHaveLength(250);
    expect(new Set(features.map((f) => f.properties.water_quality_class))).toEqual(new Set(SEA_WATER_CLASSES.map((row) => row.value)));
    expect(features.some((f) => f.properties.is_stale === true)).toBe(true);
  });

  it("PM2.5 手動站 45 站，停測站平均為 null 而非 0", () => {
    const features = read("pm25_manual_stations.geojson").features;
    expect(features).toHaveLength(45);
    expect(features.some((f) => f.properties.is_active === false)).toBe(true);
    expect(features.every((f) => f.properties.mean_12m_ugm3 !== 0)).toBe(true);
  });

  it("焚化廠 25 廠：高雄南區戴奧辛 0.592 照實保留，粉塵多為 null（未申報）", () => {
    const features = read("incinerator_emissions.geojson").features;
    expect(features).toHaveLength(25);
    expect(Math.max(...features.map((f) => Number(f.properties.dioxin_max_ng_teq_nm3)))).toBe(0.592);
    expect(features.filter((f) => f.properties.dust_mg_nm3 == null).length).toBeGreaterThanOrEqual(24);
  });

  it("戴奧辛 33 站", () => {
    expect(read("dioxin_stations.geojson").features).toHaveLength(33);
  });

  it("RPI 河段全台 301 段 LineString；等級與 RPI 測站同一組四級", () => {
    const features = read("river_rpi_segments.geojson").features;
    expect(features).toHaveLength(301);
    expect(features.every((f) => f.geometry.type === "LineString")).toBe(true);
    const classes = new Set(features.flatMap((f) => [f.properties.class_latest, f.properties.class_12m_mean]).filter((v) => v != null));
    expect([...classes].every((value) => RIVER_RPI_CLASSES.some((row) => row.value === value))).toBe(true);
    // 近 12 月無樣本＝null（灰色「無樣本」），不補 0、不補等級
    expect(features.filter((f) => f.properties.class_12m_mean == null).every((f) => f.properties.rpi_12m_mean == null)).toBe(true);
    expect(riverRpiSegmentColorExpr(1)[1]).toEqual(["get", "class_12m_mean"]);
  });

  it("RPI 河段 popup 用到的代碼值都有白話對照（不顯示內部字串）", () => {
    const features = read("river_rpi_segments.geojson").features;
    const values = (key: string) => new Set(features.map((f) => f.properties[key]).filter((v) => v != null) as string[]);
    for (const v of values("assign_method")) expect(RIVER_RPI_ASSIGN_METHOD_LABELS[v], v).toBeTruthy();
    for (const v of values("direction")) expect(RIVER_RPI_DIRECTION_LABELS[v], v).toBeTruthy();
    for (const v of values("tidal")) expect(RIVER_RPI_TIDAL_LABELS[v], v).toBeTruthy();
    const flags = new Set(features.flatMap((f) => String(f.properties.review_flags ?? "").split(";").filter(Boolean)));
    for (const flag of flags) expect(flag in RIVER_RPI_REVIEW_FLAG_LABELS, flag).toBe(true);
    expect(riverRpiReviewNotes("code_basin_conflict;direction_inferred")).toEqual(["河道代碼與流域不一致，待複核"]);
    expect(riverRpiReviewNotes("brand_new_flag")).toEqual([RIVER_RPI_REVIEW_FLAG_FALLBACK]);
    expect(riverRpiReviewNotes(null)).toEqual([]);
  });

  it("昌農橋改派牛稠溪且帶河道代碼衝突；六龜大橋改派荖濃溪", () => {
    const features = read("river_rpi_segments.geojson").features.map((f) => f.properties);
    const changnong = features.find((p) => p.from_station_name === "昌農橋");
    expect(changnong).toMatchObject({ river_raw: "高屏溪", river_assigned: "牛稠溪", assign_method: RIVER_RPI_REASSIGN_METHOD, river_code: null });
    expect(String(changnong?.review_flags)).toContain("code_basin_conflict");
    const liugui = features.find((p) => p.from_station_name === "六龜大橋");
    expect(liugui).toMatchObject({ river_raw: "高屏溪", river_assigned: "荖濃溪", assign_method: RIVER_RPI_REASSIGN_METHOD });
  });

  it("RPI 河段 source attribution 帶 OSM ODbL，名稱標明推估", () => {
    const config = OVERLAY_REGISTRY.find((c) => c.id === "riverRpiSegments");
    expect(config?.attribution).toContain("© OpenStreetMap contributors (ODbL)");
    expect(LAYER_MANIFEST.riverRpiSegments.label).toContain("推估");
    expect(LAYER_MANIFEST.riverRpiSegments.upstream?.datasets?.[0]?.datasetId).toBe("river_rpi_segments");
  });
});

describe("環境即時 4 層規則", () => {
  it("核安會輻射與台電周界輻射分開、不同色", () => {
    expect(LAYER_MANIFEST.nuscGammaRadiation.color).not.toBe(LAYER_MANIFEST.nuclearRadiation.color);
    expect(LAYER_MANIFEST.nuscGammaRadiation.label).toContain("核安會");
    expect(NUSC_GAMMA_HIGH_USVH).toBeGreaterThan(0.14);
  });

  it("放流水顏色優先序：逾時 > 超限 > 異常 > 正常", () => {
    expect(waterEffluentStatus({ is_stale: true, exceed_count: 3 })).toBe("stale");
    expect(waterEffluentStatus({ is_stale: false, exceed_count: 1, abnormal_count: 2 })).toBe("exceed");
    expect(waterEffluentStatus({ is_stale: false, exceed_count: 0, abnormal_count: 2 })).toBe("abnormal");
    expect(waterEffluentStatus({ is_stale: false, exceed_count: 0, abnormal_count: 0 })).toBe("normal");
  });

  it("CEMS 設施狀態：逾限優先，其次任一煙道運轉", () => {
    expect(cemsFacilityStatus(1, ["F"])).toBe("exceed");
    expect(cemsFacilityStatus(0, ["F", "N"])).toBe("running");
    expect(cemsFacilityStatus(0, ["E"])).toBe("startStop");
    expect(cemsFacilityStatus(0, ["G", "F"])).toBe("maintenance");
    expect(cemsFacilityStatus(0, ["P"])).toBe("halted");
    expect(cemsFacilityStatus(0, [])).toBe("unknown");
    expect(CEMS_STATUSES.map((row) => row.value)).toContain("maintenance");
  });

  it("紫外線五級對齊 RPC uv_level 字面", () => {
    expect(CWA_UV_LEVELS.map((row) => row.value)).toEqual(["低量級", "中量級", "高量級", "過量級", "危險級"]);
  });

  it("即時層一律走 dynamicData 空 source（RPC setData），不打靜態檔", () => {
    for (const id of ["nuscGammaRadiation", "waterEffluentLive", "cemsStackLive", "cwaUvDaily"]) {
      const config = OVERLAY_REGISTRY.find((c) => c.id === id);
      expect(config?.dynamicData).toBe(true);
      expect(config?.sourceUrl).toBe("./geo/_empty.geojson");
    }
  });
});
