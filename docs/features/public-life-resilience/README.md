# public-life-resilience — 公共生活與韌性資料系統

> **狀態**：shipped（handoff 記載 production published / browser verified，2026-09-23）
> **上線版本**：v1.22.0（2026-09-25，CHANGELOG「公共生活與韌性圖層」）
> **相關 PR**：#331（圖層）、#332（正式站交付穩定化）

## 一句話說明

不做單一「全部生活設施」大圖層，而是新增飲水、公共垃圾桶、回收點、避難、遊戲場、無障礙、單車補給、國家公園等分家族圖層，並與既有公廁、公園、單車等圖層交叉探索。

## 圖層（layer key，皆見 `src/data/layerManifest.ts` 對照 handoff）

`drinkingWaterPoints`、`publicWasteBaskets`、`materialRecyclingPoints`、`disasterShelters`、`playgrounds`、`accessibleParkFacilities`、`bicycleSupport`、`nationalParks`、`visitorCentres`、`publicLifeOsmCoverage`。既有基底：`publicToilets`、`civilDefenseShelter`、`parksTaipei` 等。

## 主要檔案

- `src/data/publicLifePalette.ts`：公共生活色票，manifest、overlay、legend、popup 共用。
- `src/data/layerManifest.ts`：圖層登記。

## 資料夾內文件

| 文件 | 用途 |
|---|---|
| [handoff.md](./handoff.md) | 下游視角交接：已接線圖層、UX 一致性、分階段計畫、不可發布情形、剩餘 HOLD |

## 資料契約

上游 SSOT：`taipei-gis-analytics/docs/handoff/public-life-resilience.md`。HOLD：`activeDisasterShelters`（事件狀態快照無可靠 geometry）；`tourScenicAreas` 僅 12 處，不宣告 13 處完整。

## 驗收方式

handoff 的「不可發布的情形」清單與各階段 gate；正式站驗收紀錄見 handoff（commit `c591620f`）。
