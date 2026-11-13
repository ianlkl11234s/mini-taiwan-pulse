import { describe, expect, it, vi } from "vitest";
import type { MapboxGeoJSONFeature, PointLike } from "mapbox-gl";
import { EXACT_POINT_HIT_TYPES, gisHitTarget, queryStatisticsHits } from "../statisticsClickHit";
import { GIS_LAYERS } from "../gisClickRegistry";

// 模擬低縮放的大邱：點擊點落在 중구，但 ±5px 框同時碰到 달서구 等鄰區，且 Mapbox 回傳鄰區在前。
const feature = (name: string, layer: string) => ({ properties: { area_name: name }, layer: { id: layer } }) as unknown as MapboxGeoJSONFeature;

function createMap() {
  const query = vi.fn((geometry: PointLike | [PointLike, PointLike], options: { layers: string[] }) => {
    const isBox = Array.isArray(geometry) && Array.isArray(geometry[0]);
    const out: MapboxGeoJSONFeature[] = [];
    for (const id of options.layers) {
      if (id.endsWith("-fill")) {
        out.push(...(isBox ? [feature("달서구", id), feature("수성구", id), feature("중구", id)] : [feature("중구", id)]));
      } else if (id.endsWith("-circle")) {
        if (isBox) out.push(feature("중구-circle", id));
      }
    }
    return out;
  });
  return { map: { queryRenderedFeatures: query }, query };
}

const point = { x: 846, y: 444 };

describe("queryStatisticsHits（統計 popup 取點擊點所在的區）", () => {
  it("面量圖：以點擊點所在多邊形為準，不被容錯框內的鄰區搶走", () => {
    const { map, query } = createMap();
    const hits = queryStatisticsHits(map, point, ["statsKrFireDamageSgg-fill"]);
    expect(hits[0]?.properties?.area_name).toBe("중구");
    expect(query).toHaveBeenCalledWith([846, 444], { layers: ["statsKrFireDamageSgg-fill"] });
  });

  it("比例圓：保留 ±5px 容錯框，且命中時排在面之前", () => {
    const { map, query } = createMap();
    const hits = queryStatisticsHits(map, point, ["statsKrFireDamageSgg-circle", "statsTwX-fill"]);
    expect(hits.map((f) => f.properties?.area_name)).toEqual(["중구-circle", "중구"]);
    expect(query).toHaveBeenCalledWith([[841, 439], [851, 449]], { layers: ["statsKrFireDamageSgg-circle"] });
  });

  it("沒有對應圖層時不查詢", () => {
    const { map, query } = createMap();
    expect(queryStatisticsHits(map, point, [])).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});

describe("gisHitTarget（一般點擊登記的小格網面只查點擊點）", () => {
  const bbox: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 841, y: 439 }, { x: 851, y: 449 }];

  it("南韓人口六角格：只查點擊點，拉遠時不會命中鄰格（VPB-6）", () => {
    expect(gisHitTarget("krPopulationH3", point, bbox)).toBe(point);
  });

  it("既有密度格網維持只查點擊點", () => {
    expect(gisHitTarget("factoryDensityGrid", point, bbox)).toBe(point);
    expect(gisHitTarget("jpAccommodationDensity", point, bbox)).toBe(point);
  });

  it("日本醫療圈：只查點擊點，z8 不會顯示鄰圈（VP-15）", () => {
    for (const type of ["jpMedicalAreasPrimary", "jpMedicalAreasSecondary", "jpMedicalAreasTertiary"]) {
      expect(gisHitTarget(type, point, bbox), type).toBe(point);
    }
  });

  it("同型小格網（純面）只查點擊點", () => {
    for (const type of [
      "popCount", "h3Population", "indicators", "socioeconomic", "spatialEconomy", "youbikeFullness",
      "jpPopulationMesh1km", "caPopulationGrid", "urbanFormGrid", "temperatureGrid", "transitReachGrid", "noiseCaptureGrid",
    ]) {
      expect(gisHitTarget(type, point, bbox), type).toBe(point);
    }
  });

  it("其他點位圖層保留 ±5px 容錯框", () => {
    expect(gisHitTarget("krPoliceBoxes", point, bbox)).toBe(bbox);
    // TEDS 同一筆登記混了點源工廠 circle → 保留容錯框
    expect(gisHitTarget("tedsGridEmissions", point, bbox)).toBe(bbox);
  });

  it("只查點擊點的 layerType，其點擊登記只含面（fill／extrusion）或格線 outline，沒有點圖層", () => {
    for (const type of EXACT_POINT_HIT_TYPES) {
      const entries = GIS_LAYERS.filter((entry) => entry.type === type);
      expect(entries.length, `${type} 有點擊登記`).toBeGreaterThan(0);
      for (const id of entries.flatMap((entry) => entry.layers)) {
        expect(id, `${type}: ${id}`).toMatch(/-(fill|ext|outline)$/);
      }
    }
  });
});
