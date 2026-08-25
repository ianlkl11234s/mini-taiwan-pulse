/**
 * `shipTrails.ts` —— 從 `shipLoader.ts` 抽出的純函數共用件（EM-16 Phase 2）。
 *
 * 本測試的用途是**釘住搬家前的行為**：主站（Supabase RPC）與 `/embed` 回放
 * （靜態快照鏡像）走同一條解析路徑，任何一邊改動都必須讓另一邊同時通過。
 */
import { describe, it, expect } from "vitest";
import {
  parseShipTrail, filterGpsAnomalies, parseShipType, shipTypeBucket,
  shipRowsToShips, SHIP_TYPE_COLORS_DARK, SHIP_TYPE_COLORS_LIGHT, SHIP_TYPE_LEGEND,
  gfwShipTypeBucket, shipTypeBucketLabel,
  type ShipTrailRow,
} from "../shipTrails";
import type { TrailPoint } from "../../types";

describe("parseShipTrail", () => {
  it("三欄 lat,lng,ts → TrailPoint，alt 補 0", () => {
    expect(parseShipTrail("23.5,120.1,1785964202;23.6,120.2,1785964802")).toEqual([
      [23.5, 120.1, 0, 1785964202],
      [23.6, 120.2, 0, 1785964802],
    ]);
  });

  it("單點軌跡也能解析", () => {
    expect(parseShipTrail("25.0,121.5,1700000000")).toEqual([[25.0, 121.5, 0, 1700000000]]);
  });
});

describe("filterGpsAnomalies", () => {
  it("少於 2 點直接原樣回傳", () => {
    const one: TrailPoint[] = [[23, 120, 0, 100]];
    expect(filterGpsAnomalies(one)).toBe(one);
  });

  it("濾掉 >40 節的跳點，保留正常點", () => {
    // 第 2 點：1 分鐘內跨 1 個緯度（≈111km）→ 遠超 40 節 → 應被丟棄
    const path: TrailPoint[] = [
      [23.0, 120.0, 0, 0],
      [24.0, 120.0, 0, 60],
      [23.001, 120.0, 0, 3600],
    ];
    const out = filterGpsAnomalies(path);
    expect(out).toHaveLength(2);
    expect(out[0]![0]).toBe(23.0);
    expect(out[1]![0]).toBe(23.001);
  });

  it("dt = 0 時不做速度判斷（避免除以零）", () => {
    const path: TrailPoint[] = [
      [23.0, 120.0, 0, 100],
      [25.0, 122.0, 0, 100],
    ];
    expect(filterGpsAnomalies(path)).toHaveLength(2);
  });

  it("速度以「上一個保留點」為基準，不是原始前一點", () => {
    // 中間點是異常跳點；被丟棄後，第 3 點應與第 1 點比對而非與跳點比對
    const path: TrailPoint[] = [
      [23.0, 120.0, 0, 0],
      [40.0, 120.0, 0, 60],   // 跳點
      [23.01, 120.0, 0, 7200], // 相對第 1 點是合理低速
    ];
    const out = filterGpsAnomalies(path);
    expect(out.map((p) => p[0])).toEqual([23.0, 23.01]);
  });
});

describe("parseShipType", () => {
  it("中文船種 → AIS 碼", () => {
    expect(parseShipType("漁船")).toBe(30);
    expect(parseShipType("貨船")).toBe(70);
    expect(parseShipType("油輪")).toBe(80);
    expect(parseShipType("客輪")).toBe(60);
  });

  it("null / 未知字串 → 0", () => {
    expect(parseShipType(null)).toBe(0);
    expect(parseShipType("")).toBe(0);
    expect(parseShipType("太空船")).toBe(0);
  });
});

describe("shipTypeBucket", () => {
  it("依 AIS 碼區間分桶", () => {
    expect(shipTypeBucket(60)).toBe("passenger");
    expect(shipTypeBucket(70)).toBe("cargo");
    expect(shipTypeBucket(80)).toBe("tanker");
    expect(shipTypeBucket(30)).toBe("fishing");
    expect(shipTypeBucket(52)).toBe("special");
    expect(shipTypeBucket(0)).toBe("other");
    expect(shipTypeBucket(95)).toBe("other");
  });

  it("每個桶都有暗色與淺色色票，且圖例涵蓋全部 6 桶", () => {
    const buckets = SHIP_TYPE_LEGEND.map((s) => s.bucket);
    expect(new Set(buckets).size).toBe(6);
    for (const b of buckets) {
      expect(SHIP_TYPE_COLORS_DARK[b]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(SHIP_TYPE_COLORS_LIGHT[b]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("gfwShipTypeBucket", () => {
  it("GFW 類型映射到既有 Ships 六類色票", () => {
    expect(gfwShipTypeBucket("CARGO")).toBe("cargo");
    expect(gfwShipTypeBucket("carrier")).toBe("cargo");
    expect(gfwShipTypeBucket("PASSENGER")).toBe("passenger");
    expect(gfwShipTypeBucket("FISHING")).toBe("fishing");
    expect(gfwShipTypeBucket("TANKER")).toBe("tanker");
    for (const type of ["GEAR", "SEISMIC_VESSEL", "TUG", "SUPPORT"]) {
      expect(gfwShipTypeBucket(type)).toBe("special");
    }
    expect(gfwShipTypeBucket("NA")).toBe("other");
    expect(gfwShipTypeBucket(null)).toBe("other");
    expect(shipTypeBucketLabel("special")).toBe("作業/拖船 Tug");
  });
});

describe("shipRowsToShips", () => {
  const rows: ShipTrailRow[] = [
    { mmsi: "416001", ship_type: "貨船", trail: "23.5,120.1,1000;23.6,120.2,4600" },
    { mmsi: "416002", ship_type: null, trail: "24.0,121.0,2000;24.1,121.1,5600" },
  ];

  it("轉出 Ship[]，vessel_type 走 parseShipType", () => {
    const { ships } = shipRowsToShips(rows);
    expect(ships).toHaveLength(2);
    expect(ships[0]!.mmsi).toBe("416001");
    expect(ships[0]!.vessel_type).toBe(70);
    expect(ships[1]!.vessel_type).toBe(0);
  });

  it("timeRange 是所有保留點的 [最早, 最晚]", () => {
    expect(shipRowsToShips(rows).timeRange).toEqual([1000, 5600]);
  });

  it("空輸入 → timeRange [0, 0]（不是 Infinity）", () => {
    expect(shipRowsToShips([])).toEqual({ ships: [], timeRange: [0, 0], filteredPoints: 0 });
  });

  it("回報被過濾的點數（主站 log 用）", () => {
    const anomalous: ShipTrailRow[] = [
      { mmsi: "1", ship_type: "漁船", trail: "23.0,120.0,0;40.0,120.0,60;23.01,120.0,7200" },
    ];
    const { ships, filteredPoints } = shipRowsToShips(anomalous);
    expect(filteredPoints).toBe(1);
    expect(ships[0]!.path).toHaveLength(2);
  });
});
