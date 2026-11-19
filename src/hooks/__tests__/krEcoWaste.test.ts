import { describe, expect, it } from "vitest";
import { shardsInView, type PmtilesShard } from "../useViewportPmtilesShards";
import { KR_ECO_CLICK_LAYER_IDS, KR_ECO_CODES, krEcoGrade, krWasteDaysState } from "../../data/krEcoWasteTypes";
import { GIS_LAYERS } from "../../map/gisClickRegistry";

const shards: PmtilesShard[] = [
  { id: "11", file: "kr_eco_nature_11.pmtiles", bbox: [126.77, 37.43, 127.18, 37.7] },
  { id: "50", file: "kr_eco_nature_50.pmtiles", bbox: [126.16, 33.2, 126.97, 33.99] },
];

describe("一層多檔：依視窗挑分片（KRH-1 生態自然圖）", () => {
  it("縮放不到起點不掛任何分片", () => {
    expect(shardsInView(shards, 9.9, [126, 33, 128, 38], 10)).toEqual([]);
  });
  it("只掛與視窗相交的分片", () => {
    expect(shardsInView(shards, 10, [126.9, 37.5, 127.1, 37.6], 10).map((s) => s.id)).toEqual(["11"]);
    expect(shardsInView(shards, 11, [126.4, 33.3, 126.6, 33.4], 10).map((s) => s.id)).toEqual(["50"]);
  });
  it("平移到另一份世界（經度超出 ±180）仍挑得到分片（review 2026-11-18 F031）", () => {
    expect(shardsInView(shards, 10, [126.9 + 360, 37.5, 127.1 + 360, 37.6], 10).map((s) => s.id)).toEqual(["11"]);
    expect(shardsInView(shards, 11, [126.4 - 360, 33.3, 126.6 - 360, 33.4], 10).map((s) => s.id)).toEqual(["50"]);
  });
  it("視窗跨 ±180 時仍涵蓋兩側分片", () => {
    const edge: PmtilesShard[] = [{ id: "w", file: "w.pmtiles", bbox: [-179.5, 0, -178, 1] }, { id: "e", file: "e.pmtiles", bbox: [178, 0, 179.5, 1] }];
    expect(shardsInView(edge, 10, [179, 0, 181, 1], 10, 0).map((s) => s.id).sort()).toEqual(["e", "w"]);
  });
});

describe("KRH-1 規格", () => {
  it("等級只認 1／2／3／9，意外值不落進任何等級", () => {
    expect(krEcoGrade("1")?.value).toBe("1");
    expect(krEcoGrade("9")?.value).toBe("9");
    expect(krEcoGrade("4")).toBeUndefined();
    expect(krEcoGrade(null)).toBeUndefined();
  });
  it("17 個分片與錨點都在點擊登記簿", () => {
    const row = GIS_LAYERS.find((r) => r.type === "krEcologyNaturalness");
    expect(row?.layers).toEqual([...KR_ECO_CLICK_LAYER_IDS]);
    expect(KR_ECO_CLICK_LAYER_IDS).toHaveLength(KR_ECO_CODES.length + 1);
  });
  it("垃圾排出日：null／缺欄／空陣列＝來源未填，不是不收；기타另標", () => {
    expect(krWasteDaysState({ days: null }).missing).toBe(true);
    expect(krWasteDaysState({}).missing).toBe(true);
    expect(krWasteDaysState({ days: [] }).missing).toBe(true);
    expect(krWasteDaysState({ days: [], days_other: true })).toEqual({ days: [], other: true, missing: false });
    expect(krWasteDaysState({ days: ["mon", "thu"] })).toEqual({ days: ["mon", "thu"], other: false, missing: false });
  });
});
