import { describe, expect, it, vi } from "vitest";
import type { MapboxGeoJSONFeature, PointLike } from "mapbox-gl";
import { queryStatisticsHits } from "../statisticsClickHit";

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
