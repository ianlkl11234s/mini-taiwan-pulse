# Fire & Rescue（消防）

> **Slug**：`fire-rescue`
> **狀態**：dev（headed browser 驗收通過，**尚未 commit/push、未 S3 部署**）
> **Owner**：migu
> **上線時分支**：`feat/fire-rescue`（從 feat/water-extensions 切出）
> **memory 時點**：2026-05-24（實作）/ 2026-05-26（屏東補齊 + 救援等時圈）

## 一句話說明

把火災事件（歷史 + 最新年度）、消防分隊（circle + 3D 光柱波動）、消防栓 POI、以及救援黃金 5/10/15 分鐘等時圈，整合到 sidebar 新分區 **FIRE & RESCUE**（fireEvents 從 HAZARD 移入）。

## 圖層清單（5 個）

| Layer key | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| `fireEvents` | point (Supabase RPC) | 111~113 約 4.8 萬火災點 | ✅ **僅歷史模式**；補 click popup |
| `fireLatest` | point | 113 最新年度火點 | ✅ **任何模式可見**、不需時間軸；共用 FireEventPanel |
| `fireStations` | point + 3D | 靜態 **716** 點（全台 **22** 縣市；2026-05-26 屏東 39 隊 Mapbox geocode 補齊） | ✅ 分隊階級視覺化（3D 光柱+漣漪） |
| `fireHydrants` | point | 靜態 69,839 點 | ⚠️ **僅臺北市 + 高雄市**；minzoom 12 |
| `fireIsochrone` | polygon (PMTiles) | 救援 driving 5/10/15 分鐘黃金分級 | ✅ 全國聚合 + 各縣市兩套，`<select>` setFilter 切換 |

## 關鍵檔案

- Loader / RPC：既有 fireEvents RPC；`useFireLatestLayer`、`fire-latest-layer/src`
- 分隊 3D：`src/three/FireStationScene.ts`（InstancedMesh 光柱高度依 cat + caps + 同步擴張漣漪）+ `src/map/fireStationCustomLayer.ts`
- 等時圈 factory：`src/data/fireIsochroneLayerFactory.ts`（**非 overlayRegistry**）
- 等時圈資產：`public/fire/fire_isochrone_coverage.pmtiles`
- Types SSOT：`src/data/fireTypes.ts`（圖例 + popup 共用，鐵則 #2）
- 座標工具：`src/utils/coordinates.ts` 的 `toMercator` / `metersPerUnit`
- 轉檔腳本：`scripts/export/export_fire_pois.py`

## 分隊階級視覺化（解決「只靠顏色看不出來」）

circle 半徑 + 3D 光柱高度 + 漣漪半徑都依 cat：**大隊 1.8× → 其他 0.6×**。
展開面板 2 個 toggle 獨立控制：
- 散點（Mapbox circle）— `overlayParam fireStationsDots` 0/1 gate opacity，0 仍可點（popup 照常）
- 3D 光柱波動（Three.js）— `paramRef fireStations3D` → custom layer `getIsVisible`

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`../../../taipei-gis-analytics/docs/handoff/fire-rescue.md`（尚未建，待補）。
上游資料目錄：`taipei-gis-analytics/data/processed/fire/`（stations_7cities.csv + stations_15counties_geocoded.csv **欄位順序不同** + hydrants.csv）。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 相關文件

- 全站 memory：`~/.claude/projects/.../memory/fire-rescue-status.md`
- 覆蓋圖層 PMTiles pattern：`~/.claude/projects/.../memory/feedback_coverage_layer_pmtiles_pattern.md`（等時圈依照此 pattern；專案 PLAYBOOKS PB-16）
