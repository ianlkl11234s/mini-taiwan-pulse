# 圖層總表摘要

> 由 `scripts/research/build-layer-status.mjs` 產生，請勿手改；逐層明細見 [layer-status.csv](./layer-status.csv)。
> 依據 [ADR-0014](../../../../.gis-agent-system/decisions/0014-pulse-analysis-warehouse.md)：L1 可操作、L2 可分析、L3 位置精度（屬性，不是關卡）。

- 圖層總數：**794**；L1 可操作：**794/794**
- L2 倉庫可分析（spatial＋statistics＋attribute）：**377/794**（47.5%）
- 只有舊瀏覽器 reader：22；尚不可分析：395

## 各面板 L2 狀態

| 面板 | 圖層數 | spatial | statistics | attribute | browser_reader | none |
|---|---|---|---|---|---|---|
| 臺灣圖層 | 595 | 248 | 11 | 1 | 21 | 314 |
| 統計 | 114 | 1 | 105 | 0 | 0 | 8 |
| 世界 | 25 | 7 | 0 | 0 | 1 | 17 |
| 日本 | 60 | 4 | 0 | 0 | 0 | 56 |

## 尚不可分析的原因

| 原因 | 圖層數 |
|---|---|
| upstream_catalog_missing | 222 |
| dataset_not_in_warehouse | 118 |
| warehouse_SKIPPED_FORMAT | 33 |
| pulse_only | 18 |
| warehouse_SKIPPED_DISPLAY_ONLY | 10 |
| derived_layer | 9 |
| warehouse_FAILED | 7 |

- `upstream_catalog_missing`：manifest 未對應到 analytics 目錄 dataset（多為前端自建、即時或外部來源）。
- `dataset_not_in_warehouse`：有 upstream dataset，但 analytics 沒有可建表的 manifest／檔案。
- `warehouse_SKIPPED_*`／`warehouse_FAILED`：倉庫建置時略過或失敗，原因見 runtime `build-report.json`。
- `derived_layer`：由其他圖層或資料衍生（例如等時圈、覆蓋面），需另接衍生流程。

## L3 位置精度（spatial 圖層）

| precision_class | 圖層數 |
|---|---|
| unknown | 153 |
| address_geocode | 73 |
| google_geocode | 27 |
| address_geocode+unknown | 6 |
| proxy | 1 |

## 空間涵蓋（spatial 圖層）

| 涵蓋 | 圖層數 |
|---|---|
| national | 155 |
| 19 counties | 20 |
| 2 counties | 12 |
| unknown | 8 |
| 13 counties | 8 |
| 18 counties | 7 |
| 3 counties | 7 |
| 17 counties | 7 |

「N counties」代表區域性資料集：跨地比較時，未涵蓋的縣市應標「未涵蓋」而非 0（引擎的 nearby_profile 已自動處理）。
