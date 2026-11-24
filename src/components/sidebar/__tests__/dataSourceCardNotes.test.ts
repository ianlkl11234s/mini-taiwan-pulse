import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DataCatalogEntry } from "../../../data/dataCatalogLoader";
import { LAYER_SOURCE_INFO } from "../../../data/layerSourceInfo";
import { LAYER_NOTES_DATA } from "../../../data/layerSourceInfo.data";
import type { LayerVisibility } from "../../../types";
import { loadAllPacks } from "../../../countries/packs";

// 全部圖層（含延後載入的國家包，B1 P5）一起驗
await loadAllPacks();

const catalog = vi.hoisted(() => ({ entries: [] as unknown[] }));
vi.mock("../../../hooks/useDataCatalog", () => ({
  useDataCatalogForLayer: () => ({ data: catalog.entries, loading: false, error: null }),
}));

const { DataSourceCard, dataSourcePalette } = await import("../DataSourcePanel");

const render = (layerKey: string) => renderToStaticMarkup(createElement(DataSourceCard, {
  p: dataSourcePalette(true), layerKey: layerKey as keyof LayerVisibility, locked: false, hideActivate: true,
}));

/** 從 popup 搬到圖層側的固定說明，要在「說明・來源」卡片看得到（2026-11-23）。 */
describe("DataSourceCard 顯示從 popup 搬來的圖層說明", () => {
  beforeEach(() => { catalog.entries = []; });

  it("目錄沒有條目：來源表區塊＋說明", () => {
    const html = render("jpEvacuationSites");
    expect(html).toContain("圖層來源");
    expect(html).toContain("PDL1.0");
    expect(html).toContain("不可相加");
  });

  it("目錄已有機關＋授權：不重複來源，說明仍顯示", () => {
    catalog.entries = [{ datasetId: "x", title: "指定緊急避難場所", providerAgency: "国土地理院", license: "PDL1.0" } as unknown as DataCatalogEntry];
    const html = render("jpEvacuationSites");
    expect(html).not.toContain("圖層來源");
    expect(html).toContain("不可相加");
  });

  it("來源表沒有這層：只有說明的區塊也會顯示（含搬來的署名列）", () => {
    expect(LAYER_SOURCE_INFO.allenCoralAtlas).toBeUndefined();
    expect(LAYER_NOTES_DATA.allenCoralAtlas).toBeDefined();
    expect(render("allenCoralAtlas")).toContain("Allen Coral Atlas");
  });
});

describe("DataSourceCard 目錄已有機關＋授權時仍保留來源表的日期與連結（review L4／L5）", () => {
  beforeEach(() => { catalog.entries = []; });

  it("L4：只有資料日期（無備註／署名／限制）也要顯示日期", () => {
    expect(LAYER_SOURCE_INFO.caAdminBoundaries?.asOf).toBe("2026-11-04");
    catalog.entries = [{ datasetId: "x", title: "Boundaries", providerAgency: "Statistics Canada", license: "OGL-Canada" } as unknown as DataCatalogEntry];
    expect(render("caAdminBoundaries")).toContain("2026-11-04");
  });

  it("L5：目錄沒有連結時，補上來源表的原始連結（不依賴機關／授權欄）", () => {
    catalog.entries = [{ datasetId: "x", title: "指定緊急避難場所", providerAgency: "国土地理院", license: "PDL1.0" } as unknown as DataCatalogEntry];
    expect(render("jpEvacuationSites")).toContain("https://hinanmap.gsi.go.jp/");
  });

  it("L5：目錄已有連結時不重複補來源表連結", () => {
    catalog.entries = [{ datasetId: "x", title: "指定緊急避難場所", providerAgency: "国土地理院", license: "PDL1.0", sourceUrl: "https://example.test/api" } as unknown as DataCatalogEntry];
    const html = render("jpEvacuationSites");
    expect(html).toContain("https://example.test/api");
    expect(html).not.toContain("https://hinanmap.gsi.go.jp/");
  });
});
