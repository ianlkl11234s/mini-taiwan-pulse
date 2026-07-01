# Changelog — fire-rescue

最新在上。分支 `feat/fire-rescue`（從 feat/water-extensions 切出），memory 時點尚未 commit / push。

---

## 2026-05-26 — 屏東補齊 + 救援等時圈

- 屏東 39 隊用 Mapbox geocode 補齊 → `fireStations` 全台 716 點（22 縣市）
- 新增 `fireIsochrone` 圖層：救援路網 driving 5/10/15 分鐘黃金分級 PMTiles `public/fire/fire_isochrone_coverage.pmtiles`
- 走 `fireIsochroneLayerFactory.ts` factory（**非 overlayRegistry**）
- 全國聚合 + 各縣市兩套，縣市 `<select>` 下拉 setFilter 切換
- pattern 依 `feedback_coverage_layer_pmtiles_pattern` / PLAYBOOKS PB-16

## 2026-05-24 — 消防 FIRE & RESCUE 分區實作

- Sidebar 新增獨立 **FIRE & RESCUE** 區，fireEvents 從 HAZARD 移入
- 4 圖層上線：
  - `fireEvents`（既有 Supabase RPC，111~113 約 4.8 萬火災點）補 click popup + 火焰特效；僅歷史模式
  - `fireLatest`（113 最新年度火點，`useFireLatestLayer`，`fire-latest-layer/src`）任何模式可見、不需時間軸
  - `fireStations`（靜態，當時 7 縣市 csv + 15 縣市 geocoded csv，欄位順序不同）
  - `fireHydrants`（靜態 69,839 點，⚠️ 僅臺北 + 高雄，minzoom 12）
- 分隊階級視覺化：circle 半徑 + 3D 光柱高度 + 漣漪半徑都依 cat（大隊 1.8× → 其他 0.6×）
- 新增 `FireStationScene`（InstancedMesh 光柱 + caps + 同步擴張漣漪 = 向外波動）+ `fireStationCustomLayer`
- 展開面板 2 toggle：散點（Mapbox circle，`fireStationsDots` 0/1 gate opacity，0 仍可點）/ 3D 光柱波動（`fireStations3D` → custom layer `getIsVisible`）
- 座標用 `src/utils/coordinates.ts` 的 `toMercator`/`metersPerUnit`
- 類型 SSOT：`src/data/fireTypes.ts` 給圖例/popup 共用（鐵則 #2）
- 轉檔腳本：`scripts/export/export_fire_pois.py`
- headed browser 驗收通過

### 同日移除（用戶要求）

- 曾做 `FireBlazeScene` + `fireBlazeCustomLayer`（火焰柱 + GPU 火星 + 視野裁切 query fire-events/fire-latest）
- 用戶要求拿掉 → 兩檔已刪、useThreeJsLayers 接線移除、火災回歸純 2D circle
- 若未來要重做，可參考 git 歷史或音符 scene（`WasteMusicNoteScene`）

### 記錄的坑

- **circle-radius zoom + match 表達式**：`["zoom"]` 必須在 interpolate 最上層，cat 倍率放進每個 stop 的 match 輸出；`["*", match, interpolate(zoom)]` 會報 "zoom expression may only be used as input to top-level step/interpolate"
