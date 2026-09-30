// PF-14：聊天 wasteStopsStatic 改讀 columnar 精簡檔後，查詢結果必須與原 GeoJSON 一致。
// 原 GeoJSON（22 MB）仍在 repo 當轉檔輸入，這裡直接讀兩份各跑一次查詢比對。
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import {
  parseDatasetPayload,
  decodeColumnarPoints,
  countDataset,
  groupByField,
  filterEqField,
  nearestPoints,
  fetchDataset,
  clearDatasetCache,
  type ColumnarPoints,
  type GeoFeature,
} from "../geojsonQuery";
import { DATASET_WHITELIST } from "../datasets";

const CHAT_URL = DATASET_WHITELIST.wasteStopsStatic!.url;
const CHAT_PATH = `public/${CHAT_URL.replace(/^\.\//, "")}`;
const ORIGINAL_PATH = "public/geo/waste_stops_static.geojson";

const load = (path: string) => JSON.parse(readFileSync(path, "utf8")) as unknown;

describe("wasteStopsStatic 聊天精簡檔（PF-14）", () => {
  it("url 指向帶日期的精簡檔，且檔案存在、小於 5 MB", () => {
    expect(CHAT_URL).toMatch(/^\.\/geo\/waste_stops_chat_\d{8}\.json$/);
    expect(existsSync(CHAT_PATH)).toBe(true);
    expect(statSync(CHAT_PATH).size).toBeLessThan(5 * 1024 * 1024);
  });

  describe.skipIf(!existsSync(ORIGINAL_PATH))("與原 GeoJSON 查詢結果一致", () => {
    const original = parseDatasetPayload(load(ORIGINAL_PATH), ORIGINAL_PATH);
    const slim = parseDatasetPayload(load(CHAT_PATH), CHAT_PATH);

    it("count 總數相同（73,060）", () => {
      expect(countDataset(original).total).toBe(73060);
      expect(countDataset(slim).total).toBe(countDataset(original).total);
      expect(countDataset(slim).availableFields).toEqual([
        "city",
        "district",
        "vehicle_type",
        "routes_count",
      ]);
    });

    it.each(["city", "vehicle_type", "district", "routes_count"])("groupBy %s 相同", (field) => {
      expect(groupByField(slim, field)).toEqual(groupByField(original, field));
    });

    it.each([
      ["district", "板橋區"],
      ["district", ""],
      ["city", "臺北市"],
      ["vehicle_type", "kitchen"],
      ["routes_count", "3"],
    ])("filterEq %s=%s 筆數相同", (field, value) => {
      const a = filterEqField(original, field, value);
      const b = filterEqField(slim, field, value);
      expect(b.matched).toBe(a.matched);
    });

    it("座標 5 位小數：每點位移 ≤ 1e-5 度，nearest 距離差 ≤ 0.01 km", () => {
      for (let i = 0; i < original.length; i += 97) {
        const [ax, ay] = (original[i] as GeoFeature).geometry!.coordinates as number[];
        const [bx, by] = (slim[i] as GeoFeature).geometry!.coordinates as number[];
        expect(Math.abs(ax! - bx!)).toBeLessThanOrEqual(0.5e-5 + 1e-9);
        expect(Math.abs(ay! - by!)).toBeLessThanOrEqual(0.5e-5 + 1e-9);
      }
      const a = nearestPoints(original, 121.5654, 25.033, 5).points as { distanceKm: number }[];
      const b = nearestPoints(slim, 121.5654, 25.033, 5).points as { distanceKm: number }[];
      a.forEach((p, i) => expect(Math.abs(p.distanceKm - b[i]!.distanceKm)).toBeLessThanOrEqual(0.01));
    });
  });
});

describe("geojsonQuery columnar 解碼", () => {
  const sample: ColumnarPoints = {
    format: "pulse-columnar-points/v1",
    count: 2,
    lng: [121.5, 120.1],
    lat: [25.0, 22.6],
    properties: {
      city: { dict: ["臺北市", "高雄市"], codes: [0, 1] },
      district: { dict: [""], codes: [0, 0] },
      routes_count: [3, 1],
    },
  };

  it("還原成 Point feature，欄位順序與型別保留", () => {
    const fs = decodeColumnarPoints(sample);
    expect(fs).toHaveLength(2);
    expect(fs[1]).toEqual({
      type: "Feature",
      geometry: { type: "Point", coordinates: [120.1, 22.6] },
      properties: { city: "高雄市", district: "", routes_count: 1 },
    });
  });

  it("長度不符或未知格式直接 throw（不回 0 筆）", () => {
    expect(() => decodeColumnarPoints({ ...sample, lng: [1] })).toThrow(/長度/);
    expect(() => parseDatasetPayload({ foo: 1 })).toThrow(/無法辨識/);
  });

  describe("fetchDataset 走 columnar", () => {
    beforeEach(() => clearDatasetCache());
    afterEach(() => vi.unstubAllGlobals());

    it("wasteStopsStatic fetch 精簡檔並解碼", async () => {
      const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => sample }));
      vi.stubGlobal("fetch", fetchMock);
      const fs = await fetchDataset("wasteStopsStatic");
      expect(fetchMock).toHaveBeenCalledWith(CHAT_URL);
      expect(countDataset(fs).total).toBe(2);
    });
  });
});
