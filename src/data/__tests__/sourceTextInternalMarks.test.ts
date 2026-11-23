import { describe, expect, it } from "vitest";
import { CATALOG_INTERNAL_MARK, cleanCatalogText } from "../dataCatalogLoader";
import { getLayerNotes, LAYER_SOURCE_INFO } from "../layerSourceInfo";
import { LAYER_NOTES_DATA } from "../layerSourceInfo.data";
import { LAYER_MANIFEST } from "../layerManifest";

/** 給使用者看的來源文字不得夾帶內部工作標記（波次、C 編號、LIC／BACKLOG 代號、TODO、待確認、markdown 粗體）。 */
const MARK = /第\s*\S{1,3}\s*波|LIC-|\bC1\d\d\b|\*\*|TODO|待確認|\b[Ww]aves?\b/;

function* literals(value: unknown): Generator<string> {
  if (typeof value === "string") yield value;
  else if (Array.isArray(value)) for (const item of value) yield* literals(item);
  else if (value && typeof value === "object") {
    // { key, vars }：key 是 i18n 鍵名，不是顯示文字
    for (const [k, v] of Object.entries(value)) if (k !== "key") yield* literals(v);
  }
}

describe("來源文字無內部標記", () => {
  it("圖層來源表、圖層備註（含規格層 popupNotes）都不含內部標記", () => {
    const keys = new Set([...Object.keys(LAYER_SOURCE_INFO), ...Object.keys(LAYER_NOTES_DATA), ...Object.keys(LAYER_MANIFEST)]);
    const hits: string[] = [];
    for (const key of keys) {
      for (const text of literals([LAYER_SOURCE_INFO[key], getLayerNotes(key)])) {
        if (MARK.test(text)) hits.push(`${key}: ${text}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("資料目錄摘要：含內部標記的括號與句子拿掉，粗體符號去除", () => {
    const raw = "愛爾蘭第 3a 波（災害 › 海岸侵蝕，C103）。OPW 愛爾蘭海岸防護策略研究（ICPSS 2010–2014）。**CC BY-NC-ND 4.0**：依 LIC-1 非商用公開上線，**原樣上圖**。";
    expect(cleanCatalogText(raw)).toBe("OPW 愛爾蘭海岸防護策略研究（ICPSS 2010–2014）。");
    expect(cleanCatalogText("Copernicus DEM GLO-90 地形（POPSRC-1 待辦）。授權 OGDL-Taiwan-1.0。")).toBe("Copernicus DEM GLO-90 地形。授權 OGDL-Taiwan-1.0。");
    expect(cleanCatalogText("第 2 波：TODO")).toBeNull();
    // 資料集代號（5 位數以上）不是內部代號，保留
    expect(CATALOG_INTERNAL_MARK.test("OA-21136")).toBe(false);
    expect(CATALOG_INTERNAL_MARK.test("POPSRC-1")).toBe(true);
  });
});
