# Handoff — fire-rescue（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/fire-rescue.md`（尚未建，待補）
>
> 契約細節看上游，本檔只放前端接線簡表。

## 上游摘要

- 產物：
  - Supabase RPC（fireEvents 111~113 約 4.8 萬點）
  - 靜態 CSV → 前端 export：`taipei-gis-analytics/data/processed/fire/stations_7cities.csv` + `stations_15counties_geocoded.csv`（欄位順序不同）+ `hydrants.csv`
  - PMTiles：`public/fire/fire_isochrone_coverage.pmtiles`（全國聚合 + 各縣市兩套）
- 轉檔腳本：`scripts/export/export_fire_pois.py`
- 座標：WGS84
- 資料量：4.8 萬 fireEvents / 716 fireStations / 69,839 fireHydrants（僅臺北+高雄）/ 等時圈 5-10-15 min 三環

## 前端接線位置

- Loader / Layer：
  - `fireEvents`：既有 Supabase RPC + FireEventPanel popup
  - `fireLatest`：`useFireLatestLayer` + `fire-latest-layer/src`
  - `fireStations`：3D 走 `src/three/FireStationScene.ts` + `src/map/fireStationCustomLayer.ts`（InstancedMesh 光柱 + caps + 漣漪）
  - `fireHydrants`：靜態 point
  - `fireIsochrone`：`src/data/fireIsochroneLayerFactory.ts`（非 overlayRegistry）
- SSOT：`src/data/fireTypes.ts`（圖例 + popup 共用）
- 座標：`src/utils/coordinates.ts` 的 `toMercator` / `metersPerUnit`

## 硬依賴欄位（改一定爆）

### fireStations

- `cat` — 分隊階級（大隊 1.8× / 其他 0.6×）驅動 circle 半徑 + 3D 光柱高度 + 漣漪半徑

### fireIsochrone PMTiles

- 縣市欄位 — `<select>` setFilter 用（memory 未指定欄位名）
- 分鐘等級欄位（5/10/15） — paint 分級用

### CSV schema 不對稱

- `stations_7cities.csv` 與 `stations_15counties_geocoded.csv` **欄位順序不同** — 轉檔腳本 `export_fire_pois.py` 必須容錯處理

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 加新縣市 hydrants（現僅台北+高雄） | LAYER_COLORS 檢查 domain；minzoom 12 可能要調 |
| 加新火災年度（113 → 114） | `fireEvents` RPC 範圍 + `fireLatest` 切最新年度 |
| 改分隊 `cat` enum | FireStationScene 倍率表 + `fireTypes.ts` 對齊 |
| 等時圈重出（重跑上游 pipeline） | S3 upload-deploy-assets 推 PMTiles，前端不改 |
| CSV schema 統一 | `export_fire_pois.py` 簡化 |

## 已知不對稱

- 上游 `docs/handoff/fire-rescue.md` **尚未建**（memory 只提 `data/processed/fire/` 目錄）
- `fireEvents` **僅歷史模式**、`fireLatest` **任何模式可見** — 兩者角色分工的完整理由 memory 未記
- 前端已完成 wire 但 **尚未 commit / push / S3 部署**
- 分支 `feat/fire-rescue` 從 `feat/water-extensions` 切出，與 agriculture business layers 在同分支上（見 agriculture 段）

## TBD

- 上游 handoff 何時建 SSOT
- 等時圈 PMTiles 上游產出腳本路徑（memory 未點名）
- fireIsochrone 是否已進 sidebar catalog SECTIONS（memory 未提）
