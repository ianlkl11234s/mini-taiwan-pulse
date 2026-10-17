# taiwan-statistics — 臺灣區域統計（Statistics 入口）

> **狀態**：shipped（v1.18.0 2026-09-10 起；後續統計家族已拆到各自資料夾持續擴充）
> **相關 PR**：#219（統計基礎）、#220（會員整合版）、#225、#226、#237（側欄分類）、#239（改讀 R2 CDN）、#240（immutable cache）

## 一句話說明

獨立的 Statistics 入口，以共用 recipe／store／loader／renderer 呈現縣市與鄉鎮市區面量圖，支援期別、來源、透明度、圖例、popup 與缺值（缺值不等於 0）。

## 主要檔案

- `src/data/regionalStatisticsLoader.ts`、`src/data/regionalStatisticsRecipes.ts`：資料載入與 recipe。
- `src/data/statisticsLayerRegistry.ts`、`src/data/statisticsDataSources.ts`：統計圖層登記與資料來源總覽。
- `src/data/statisticsRecipeCatalog.ts`、`src/hooks/useStatisticsRecipeDetails.ts`：recipe 目錄與詳情。
- 犯罪圖層：manifest `crimeAreaMonthly`。

## 資料夾內文件

| 文件 | 用途 |
|---|---|
| [handoff.md](./handoff.md) | 施工與交付紀錄：8 指標／14 releases 起始交付、交通統計 33 指標、PR checklist |
| [changelog.md](./changelog.md) | 2026-09-06 至 09-09 的改動：基礎 PR、交通統計、側欄分類 |
| [crime-preview.md](./crime-preview.md) | 犯罪圖層 PMTiles 重切（z5–12）與重建指令 |

## 相關資料夾

後續統計家族另有：`../social-statistics`、`../demographics-statistics`、`../environment-statistics`、`../labor-statistics`、`../agri-statistics`、`../addiction-statistics`、`../atlas-statistics`、`../statistics-comparability`。統計規則見 [統計圖層規則](../../statistics-layer-guidelines.md)。

## 驗收方式

`npx tsc -b`、statistics／layer manifest／golden 測試；正式站驗收依跨 repo closeout（analytics `docs/topic-research/regional_statistics/transport-production-closeout-20260907.md`），不能以單元測試取代。
