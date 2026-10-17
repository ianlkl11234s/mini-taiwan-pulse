# 日本與全球圖層微調（2026-09-18）

> **Slug**：`japan-global-layer-refinement`
> **狀態**：shipped（PR 0–7 於 2026-09-18 合併並做 production 驗收，隨 v1.20.0）；唯一未閉合 gate 為 GFW 排程後 freshness（見下）
> **相關 PR**：#262–#266、#277、#294、#295（見 plan.md「執行紀錄」）

## 一句話說明

微調日本與全球圖層：日本入口不自動開旅宿、loading 視覺一致、旅宿與醫療／長照／醫療圈的完整低縮放（zoom < 8 密度格網、zoom ≥ 8 完整點位）、日本與全球命名分組、GFW freshness 顯示，以及房地產總價值改為統計圖層。

## 圖層 / 檔案

- 日本旅宿：layer key `jpAccommodationCanonical`（`src/data/layerManifest.ts`）
- 日本醫療／長照／醫療圈：`src/hooks/useJpMedicalLayers.ts`、`src/data/jpMedicalTypes.ts`；資料經 `./jp-medical/current.json` 載入不可變 PMTiles
- 房地產總價值統計：`src/hooks/usePropertyValueAdminLayer.ts`（另見 [`../property-value/`](../property-value/)）
- 上游：`taipei-gis-analytics` PR #93（旅宿）、#94（醫療）

## 驗收方式

整體 production 驗收見 [production-acceptance-2026-09-18.md](./production-acceptance-2026-09-18.md)；各單元驗收見下表。未閉合 gate：GFW 排程後 freshness（2026-09-19 08:30 後判定，證據見 [`../global-maritime/gfw-freshness-audit-2026-09-18.md`](../global-maritime/gfw-freshness-audit-2026-09-18.md)；之後是否閉合（未查到））。

## 文件索引

| 文件 | 用途 |
|---|---|
| [plan.md](./plan.md) | 目標、語意原則、PR 0–7 序列與執行紀錄（PR 編號／commit） |
| [pr3-accommodation-production-acceptance.md](./pr3-accommodation-production-acceptance.md) | PR 3 日本旅宿 production 驗收 |
| [pr4-medical-acceptance.md](./pr4-medical-acceptance.md) | PR 4B 醫療、長照、醫療圈驗收 |
| [jp-medical-density-acceptance.md](./jp-medical-density-acceptance.md) | 醫療／長照縮放切換（密度格網）驗收 |
| [production-acceptance-2026-09-18.md](./production-acceptance-2026-09-18.md) | 整體 production 驗收 |
| `jp-medical-*.json` | 密度發布計畫、dry-run、本地驗收、S3 發布 receipt（證據檔） |
