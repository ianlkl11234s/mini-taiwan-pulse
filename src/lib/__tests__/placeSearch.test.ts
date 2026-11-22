import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPlaceSearchIndex, normalizePlaceQuery, searchPlaces, type PlaceIndexFile } from "../placeSearch";

const tiny = buildPlaceSearchIndex({
  version: 1,
  places: [
    ["大安里", "village", "臺中市大安區", 120.6, 24.3, 120.5, 24.2, 120.7, 24.4],
    ["大安區", "town", "臺北市", 121.54, 25.03, 121.5, 25.0, 121.6, 25.05],
    ["大安", "station", "台北捷運", 121.543, 25.033],
    ["新大安里", "village", "臺北市大安區", 121.54, 25.02, 121.53, 25.01, 121.55, 25.03],
    ["臺北", "station", "台鐵", 121.517, 25.048],
  ],
});

describe("normalizePlaceQuery", () => {
  it("台／臺互通、去空白、全形轉半形", () => {
    expect(normalizePlaceQuery(" 臺北 車站 ")).toBe("台北車站");
    expect(normalizePlaceQuery("ＡＢＣ　１")).toBe("abc1");
  });
});

describe("searchPlaces", () => {
  it("空字串不回結果", () => {
    expect(searchPlaces(tiny, "  ")).toEqual([]);
  });

  it("完全相符 > 開頭相符 > 包含；同分依 縣市>鄉鎮>車站>村里", () => {
    const hits = searchPlaces(tiny, "大安");
    expect(hits.map((h) => [h.label, h.score])).toEqual([
      ["大安區", 3],
      ["大安站", 3],
      ["大安里", 2],
      ["新大安里", 1],
    ]);
  });

  it("車站可用「車站」「站」字尾與「台」查詢，顯示補站字", () => {
    const [hit] = searchPlaces(tiny, "台北車站");
    expect(hit).toMatchObject({ label: "臺北站", kind: "station", parent: "台鐵", score: 3 });
    expect(hit?.bbox).toBeUndefined();
  });

  it("可用上層全名比對村里", () => {
    const [hit] = searchPlaces(tiny, "臺北市大安區新大安里");
    expect(hit).toMatchObject({ label: "新大安里", score: 3, bbox: [121.53, 25.01, 121.55, 25.03] });
  });

  it("最多回傳 limit 筆", () => {
    expect(searchPlaces(tiny, "安", 2)).toHaveLength(2);
  });
});

describe("真索引（RESEARCH §3 題目）", () => {
  const file = JSON.parse(readFileSync(new URL("../../data/placeSearchIndex.json", import.meta.url), "utf8")) as PlaceIndexFile;
  const index = buildPlaceSearchIndex(file);
  const first = (q: string) => searchPlaces(index, q)[0];

  it("#9 台北車站 → 台北車站一帶的車站", () => {
    const hit = first("台北車站");
    expect(hit?.kind).toBe("station");
    expect(hit?.center[0]).toBeCloseTo(121.517, 1);
    expect(hit?.center[1]).toBeCloseTo(25.047, 1);
  });

  it("#12 左營站 → 高鐵／台鐵左營站（「高雄左營站」這種縣市＋站名的寫法第一階段不支援）", () => {
    const hits = searchPlaces(index, "左營站");
    expect(hits.slice(0, 2).map((h) => [h.label, h.parent])).toEqual([["左營站", "高鐵"], ["左營站", "台鐵"]]);
  });

  it("縣市簡稱完全相符排第一：台北 → 臺北市", () => {
    expect(first("台北")).toMatchObject({ label: "臺北市", kind: "county", score: 3 });
  });

  it.each([
    ["新北市板橋區留侯里", "留侯里"],
    ["臺中市北屯區仁美里", "仁美里"],
    ["宜蘭縣礁溪鄉玉田村", "玉田村"],
  ])("%s → 村里完全相符", (q, label) => {
    expect(first(q)).toMatchObject({ label, kind: "village", score: 3 });
  });

  it("每筆行政區都有 bbox、代表點在 bbox 內", () => {
    for (const row of file.places) {
      if (row[1] === "station") continue;
      const [, , , lng, lat, w, s, e, n] = row;
      expect(w != null && lng >= w! && lng <= e! && lat >= s! && lat <= n!).toBe(true);
    }
  });
});
