# Status

**最後更新**：2026-05-24（消防分區上線：分隊/消防栓 POI + Three.js 火焰特效）
**分支**：`feat/fire-rescue`（5/24 從 `feat/water-extensions` 切出）

## ⭐ 當前狀態

### 消防 FIRE & RESCUE（5/24 本 session 主軸）

新增獨立「消防」分區，把既有 `fireEvents` 從 HAZARD 移入，再加 2 個 POI 層 + 火焰特效。

| Layer | 來源 | 圖例 | Popup | 備註 |
|---|---|---|---|---|
| `fireEvents` | Supabase RPC `get_fire_events_by_year`（111~113 約 4.8 萬）| ✅ 傷亡分級 | ✅ 起火原因/死傷/時間 | 2D circle；本 session 補 popup；**僅歷史模式**（火焰特效 5/24 加後又依用戶要求移除）|
| `fireLatest` | 同 RPC 取最新年（113）| ✅（共用） | ✅（共用 FireEventPanel）| 5/24 追加：最新年度火點，**任何模式可見**、不需時間軸；純 2D circle |
| `fireStations` | 靜態 677 點（全台 22 縣市）| ✅ 大隊/分隊/分駐所/其他 | ✅ 隊名/類型/電話/地址 | circle 半徑+3D 光柱高度+漣漪半徑**依階級分大小**；展開面板 2 toggle（散點 / 3D 光柱波動）獨立開關 |
| `fireHydrants` | 靜態 69,839 點（⚠️ 僅臺北市+高雄市）| ✅ 地上/地下式+覆蓋註 | ✅ 型式/行政區 | `public/geo/fire_hydrants.geojson` 12.8MB，minzoom 12 |

**火災 Three.js 火焰特效 — 已移除**（5/24 用戶要求）：曾做 `FireBlazeScene`+`fireBlazeCustomLayer`（火焰柱+GPU 火星粒子+視野裁切），後依用戶決定拿掉，火災回歸純 2D circle。**消防分隊的 3D 光柱/漣漪保留**（那是 `FireStationScene`，與火災無關）。

**消防分隊 3D（保留）**：`FireStationScene` InstancedMesh 光柱（高度依階級）+ caps + 同步擴張漣漪；展開面板 2 toggle（散點 / 3D 光柱波動）獨立開關。

**驗收（headed agent-browser，真實 GPU）**：tsc -b 綠 ✅；分隊紅點+光柱+漣漪 ✅；圖例（含覆蓋註）✅；歷史模式火災載入 ✅；火點 popup（士林/菸蒂/2024-12-22）✅；fireLatest 即時模式 2D 圓點 ✅。

**資料來源**：`taipei-gis-analytics/data/processed/fire/`（分隊 stations_*.csv、消防栓 hydrants.csv）。
轉檔腳本 `scripts/export/export_fire_pois.py`。⚠️ 屏東縣分隊 39 點上游缺座標被跳過（677/717）。
**待辦**：跑 `upload-deploy-assets.sh` 推 2 個 geojson 到 S3。

### 農業（5/23 前 session）

| Layer | 來源 | 圖例 | Click popup | 備註 |
|---|---|---|---|---|
| `agriculture` (FTW Fields) | 38.6 萬田區 | — | — | 既有；單色 confidence opacity |
| `agriSoil` | 5.7 萬土壤分類 | — | ✅ | 8 欄屬性（土類/土系/土型...）|
| `agriSoilFertility` | 13.5 萬肥力 250m | **✅ 6 metric 切換** | ✅ 含分級註解 | health/pH/OM/CEC/M3_P/M3_K dropdown |
| `agriLeisureFarmZones` | 109 法定休農區 | — | ✅ | 休區名/代碼 |
| `agriRuralRegen` | 1,109 農村再生 | — | ✅ | 社區名/計畫/行政區 |
| `agriCropSuitability` | 83.3 萬作物適栽 | ✅ 4 級 kind | ✅ | 132 種作物 dropdown |
| `agriPOI` | 840 三類 POI | ✅ 3 類 | ✅ | 休農場/田媽媽/特色農旅 |

部署：`public/agriculture/` ~215MB（gitignore，走 S3 deploy-assets）

### 圖層 UX 鐵則升級到 4 條（⚠ P0）

1. 透明度 slider 必備
2. 分類 ≥ 2 種 → 必寫圖例（單一資料源 `src/data/xxxTypes.ts`）
3. 可選取物件 → 必接 click popup（GIS_LAYERS first-hit-wins + PMTiles `keep_attrs` 配套）
4. Select options ≥ 4 → 原生 `<select>` dropdown

詳見 `docs/development-rules.md#4a` + `PRINCIPLES.md` 摘要 + auto-memory
`feedback_layer_ux_triad.md`。

### 廢棄物（前 sessions 進度，仍為 supabase 主軸）

| 指標 | 值 |
|---|---:|
| supabase `spatial.waste_collection_stops` | **271,460** |
| supabase `spatial.waste_collection_routes` | **8,192** |
| 城市覆蓋 | **22 城全到齊**（含金門 525、連江 79）|
| hwms_pending 整體 coverage | **89.6%** (276K / 308K) |
| 仍 miss | 32,010 (10.4%) |

前端：wasteSchedule（22 城表定）、wasteTruck（GPS）、wasteStopsStatic（5/14 加靜態 233K 點散點）。

## 5/23 完成（農業 Phase 3 Batch 1，15 commits）

```
015f942 docs: 鐵則升級三 → 四 — 新增規則 4「Sidebar select 4+ 必 dropdown」
32f5793 fix(sidebar): select dropdown 門檻 > 6 → > 3 避免 4+ 選項橫向溢出
a7f9f7a feat(agriculture): 土壤肥力 6 metric 著色切換 + 數值分級註解
68da96e docs: 鐵則 2 加重 — 分類 ≥ 2 種一律要圖例
76e2147 feat(agriculture): 農業 POI 三類圖例 + 三邊配色單一資料源
8693bed docs: 鐵則 3 擴充 — 從 POI 升級為「可選取物件」+ PMTiles keep_attrs 配套
4a2fd79 feat(agriculture): 4 個 polygon layer 全部可點擊
f5afabf feat(agriculture): 農村再生社區點擊顯示社區/計畫資訊
9a607a7 docs: 圖層 UX 三鐵則
9006c56 feat(agriculture): 農業 POI 點擊顯示資訊 panel
885579e feat(agriculture): 作物適栽 legend 進 LegendPanel
fd4417c fix(agriculture): FTW outline line-width 表達式違反 Mapbox 約束
7d3092b feat(agriculture): MapView 啟動 6 新 layer
f8a4ecc feat(agriculture): types/visibility/sidebar/params 接線 6 新 layer
9bc0e5c feat(agriculture): factory 擴充 + asset gitignore
```

### Key files 新建 / 異動

- 新建 `src/data/agriPOITypes.ts` — POI 三類單一資料源
- 新建 `src/data/agriSoilFertilityMetrics.ts` — 6 metric 著色/legend/classify 單一資料源
- 新建 `src/data/cropSuitabilityCrops.ts` — 132 種作物對照表
- 新建 `src/map/agricultureLayerFactory.ts` — 7 layer ensure/update 函式
- 改寫 `src/components/FeatureInfoPanel.tsx` — 加 5 個 agri panel
- 改寫 `src/components/LegendPanel.tsx` — 加 3 個 agri legend
- 改寫 `src/map/MapView.tsx` — ensureAllAgricultureLayers/updateAllAgricultureLayers
- types/visibility/sidebars/params 6 處同步加 7 個 layer keys

## 待 commit / push

5/24 消防分區的程式改動**尚未 commit**（user 未要求）。涉及檔案：
- 新建：`scripts/export/export_fire_pois.py`、`src/data/fireTypes.ts`、`src/three/FireBlazeScene.ts`、`src/map/fireBlazeCustomLayer.ts`
- 改：types/index.ts、overlayRegistry.ts、useTransportParams.ts、LayerSidebar.tsx、IconRailSidebar.tsx、useLayerVisibility.ts、useMapInteraction.ts、FeatureInfoPanel.tsx、LegendPanel.tsx、useThreeJsLayers.ts
- 產出（gitignore，走 S3）：`public/geo/fire_stations.geojson`、`public/geo/fire_hydrants.geojson`
- **待辦**：`scripts/deploy/upload-deploy-assets.sh` 推 2 geojson 到 S3

農業（feat/water-extensions）那批 commits 仍待 push（見下）：
```bash
git push origin feat/water-extensions   # 農業 batch
```

⚠ 也記得 `taipei-gis-analytics` 那邊 `pipelines/agriculture/` 整包仍 untracked，
本 session 動了 `06_export_frontend.py` keep_attrs（5/23 改了 4 個 layer），
由用戶統一批次 commit 比較不會破壞跨 repo 提交脈絡。

## 下一步候選

### 短期（user 早上 review 後決定）

- ⏳ **Browser 視覺驗收**：7 個 layer toggle / 132 作物 dropdown / 6 metric 著色 / 所有 click popup
- ⏳ **S3 deploy**：跑 `scripts/deploy/upload-deploy-assets.sh` 推 6 個檔到 S3（Zeabur 部署前）
- ⏳ **分支命名**：feat/water-extensions → feat/agriculture-batch-1（AG-5）

### 中期（BACKLOG 既有 P1/P2）

#### 廢棄物
- BL-17 表定動畫沿馬路（OSRM 路徑）— 2.5-3 天（其他地區 stops 直線插值會穿牆）
- BL-14 查證高雄 5/9 success 30.3% vs 5/8 49% 落差
- BL-15 ETL UNIQUE constraint 修台南 60% dup
- BL-16 useWasteLayer 加台南 default + city 切換 UI
- BL-23 Round 4 TGOS 18K normalized — 重 build 17 城 + reinsert + 重跑 inferred segments

#### 農業
- AG-1 Wave D 公司登記 3 集（等 TGOS）
- AG-3 Soil/SoilFertility 更多欄位重出評估
- AG-4 crop_suitability 跨作物 overlay 視角

#### 水資源
- BL-4 flood_hazard_zones 多情境 dropdown
- W001 警戒水位視覺化（先 seed river_stations）
- W005 水權統計（指標卡）

## 5/14 之前進度（保留摘要）

- 5/14 廢棄物 Stage 6b 外推達 89.6%（22 城 stops 215K → 271K）
- 5/13 Stage 4-6 (school/foursquare/nominatim/interpolate) 達 82.3%
- 5/12 22 城 hwms stops import + OSRM 沿馬路 inferred segments
- 5/10-11 廢棄物 schedule 動畫 + 視覺打磨（5 城 → 22 城）
- 5/8-9 OSRM map-matching pipeline + Zeabur 部署
- 4/26 iot_wra 雙表 pre-aggregate + 兩 layer
- 4/25 河川 / 地下水 delta 著色 + 降頻
- 4/22-24 水資源 Phase 1/2 + 3D 水庫互動
