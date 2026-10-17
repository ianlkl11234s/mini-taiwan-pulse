# rail-routes — 軌道路線（靜態圖層）

> **狀態**：shipped
> **上線版本**：v2.5.0（2026-10-05）；**相關 PR**：#531

## 一句話說明

靜態「軌道路線」圖層 `railRoutes`（交通 → 路網）：台鐵、高鐵、台北／高雄／台中捷運、高雄輕軌、貓空纜車，可依系統篩選，不載入時刻表；與即時列車圖層 `rail` 完全分離。

## 主要檔案

- 產物：`public/rail/routes_static.geojson`（33 條 route feature）。
- 建置：`scripts/preprocess/build-rail-routes.py`（去重、共用走廊 `offset_slot` 平行化）。
- 登記：`src/data/layerManifest.ts` 的 `railRoutes`。
- 輸入：`public/rail/<sys>/tracks/*.geojson`、`public/rail/trtc/extensions/*.geojson`。

## 資料夾內文件

| 文件 | 用途 |
|---|---|
| [handoff.md](./handoff.md) | 資料與建置、去重規則、共用走廊平行化（`offset_slot`）、已知副作用 |

## 資料來源

軌道幾何來自專案既有 `public/rail` 軌道資料；信義線東延段線形 © OpenStreetMap contributors（ODbL），見 CHANGELOG v2.5.0。

## 驗收方式

重跑 `python3 scripts/preprocess/build-rail-routes.py`（需 shapely）確認輸出；細部驗證項目見 handoff。
