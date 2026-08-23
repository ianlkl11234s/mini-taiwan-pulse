# 海底等深線 Isobath

> **Slug**：`isobath`（與 taipei-gis-analytics handoff 一致，待上游補檔）
> **狀態**：dev
> **Owner**：（前端接線者，待補）
> **上線日期**：（待 PR 合併）
> **相關 PR**：（待補）

## 一句話說明

全球海底地形（GEBCO 2025 Grid，15 arc-second ≈450m）以「等深線 11 級 + 深度分帶 12 級」兩種形態疊在底圖上，3 種配色模式（單色藍反向強調 / Haxby 海洋學標準 / Turbo 最大反差）。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| isobath（fill sub-layer，`kind=band`） | polygon（深度分帶） | PMTiles | ✅ 前端接線完成，待上游 pmtiles 落地 |
| isobath（line sub-layer，`kind=line`） | line（等深線） | PMTiles | ✅ 前端接線完成，待上游 pmtiles 落地 |

## 關鍵檔案

- 色票 SSOT：`src/data/isobathTypes.ts`（12 band 定義 + 3 mode 色階 + mapbox 表達式 + popup/legend 共用函式）
- Overlay：`src/map/overlayRegistry.ts`（`id: "isobath"`，一筆 config 兩個 sub-layer，靠 `filter` 拆 `kind`）
- 參數控件：`src/data/layerParamsSpec.ts`（`isobath` 4 個控件：配色 select / 分帶填色 toggle / 線透明度 slider / 填色濃度 slider）
- Manifest：`src/data/layerManifest.ts`（`isobath` entry，`底圖 Base Map > 地形` 子群）
- Catalog：`src/components/sidebar/layerCatalog.ts`（`地形` 子群 `fromManifest("isobath")`）
- Legend：`src/components/LegendPanel.tsx`（`IsobathLegend`，12 級隨 modeIdx 換色）
- Popup：`src/components/featureInfo/baseMapPanels.tsx`（`IsobathLinePanel` / `IsobathBandPanel`）+ `src/map/gisClickRegistry.ts`（`isobath-line` / `isobath-fill` 兩筆）

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/gebco_isobath.md`（待上游補檔）。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關 ADR

（無）

## 相關文件

- 上游 handoff：`../../../taipei-gis-analytics/docs/handoff/gebco_isobath.md`（待補）
- 開發規則：`../development-rules.md`
