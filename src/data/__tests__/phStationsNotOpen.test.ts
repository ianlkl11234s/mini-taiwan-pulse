/**
 * 菲律賓車站：未通車站不畫（2026-11-14，analytics #390＋#391 的 37 站清單）。
 * 用 Mapbox style-spec 的 featureFilter 實際評估規格裡的 filter，驗到的就是送進 Mapbox 的東西。
 */
import { describe, expect, it } from "vitest";
// @ts-expect-error — style-spec 的 CJS 入口無型別宣告（mapbox-gl 未導出），僅測試用
import { featureFilter } from "mapbox-gl/dist/style-spec/index.cjs";
import { PH_SPEC_BY_KEY, PH_STATIONS_NOT_OPEN_SRC_IDS } from "../phDataLayers";

const passes = (filter: unknown, properties: Record<string, unknown>) =>
  featureFilter(filter).filter({ zoom: 14 }, { type: 1, properties, geometry: [] }) as boolean;

describe("phStations：未通車站不畫", () => {
  const part = PH_SPEC_BY_KEY.phStations.parts[0]!;

  it("清單是 37 個不重複的 OSM src_id", () => {
    expect(PH_STATIONS_NOT_OPEN_SRC_IDS).toHaveLength(37);
    expect(new Set(PH_STATIONS_NOT_OPEN_SRC_IDS).size).toBe(37);
    for (const id of PH_STATIONS_NOT_OPEN_SRC_IDS) expect(id).toMatch(/^osm:(node|way)\/\d+$/);
  });

  it("filter 排除每一個未通車站", () => {
    expect(part.filter).toBeDefined();
    for (const src_id of PH_STATIONS_NOT_OPEN_SRC_IDS) {
      expect(passes(part.filter, { kind: "rail_station", source: "osm", src_id })).toBe(false);
    }
  });

  it("保留 PNR 官方站、營運中的 OSM 鐵路站與渡輪碼頭", () => {
    expect(passes(part.filter, { kind: "rail_station", source: "official", src_id: "pnrstation_20210201.6" })).toBe(true);
    expect(passes(part.filter, { kind: "rail_station", source: "osm", src_id: "osm:way/402882918" })).toBe(true);
    expect(passes(part.filter, { kind: "ferry_terminal", source: "osm", src_id: "osm:node/1" })).toBe(true);
  });

  it("圖例筆數扣掉 37 站", () => {
    expect(PH_SPEC_BY_KEY.phStations.count).toBe(562 - 37);
  });
});
