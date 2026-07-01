# Status

**最後更新**：2026-07-01 晚（警政司法 17 layer + 警察 isochrone × overlap_count 全台 5 區跑完 → dissolve by count + 分區斷裂記 PI-1 收尾）
**Master head**：`0eb4137` 同步 origin/master（memory wrap-up 8 commits 已 push；本次 STATUS 是第 9 個）
**gis-platform head**：已 sync（migrations 262-264 3 個 RPC 已 applied）
**Open branches**：`feat/aviation-drone-airspace-layers` / `feat/energy-v2-C` / `feat/real-estate-layers` / `staging`（本地 base_map + 3 raster BM-1~4 待整合）

## 2026-06-29~07-01 本 session 完成（跨 3 天大工程）

**用戶定向**：警政司法民防體系 22 dataset 完整上前端 → 3 realtime 進 Monitor / popup → 警察轄區蝶圖（isochrone × 3 層級） → 重疊越多顏色越深 → 收尾整理 git。

### A. 警政司法民防 17 GIS layer + 3 realtime 全上線（21 code commits，已 squash 合到 master）

| 段 | 內容 | 對應 commit（示意） |
|---|---|---|
| **Phase A 資料 ready** | 3 個 Supabase RPC migration（airport_hourly_pax / a1_by_bbox / prison_population_window）+ 3 個 PMTiles（civil_defense/crime_area/court_jurisdictions）+ S3 sync 40 檔 172MiB → `deploy-assets/police_justice/` + nginx `/police_justice/` route + pull-deploy-assets 加子前綴 | migrations 262-264 |
| **Phase B 前端骨架** | LayerVisibility +17 keys / LAYER_COLORS +17 / FeatureInfo.layerType +17 / THEMES 新增 2 主題（執法治安 4 子群 / 民防避難 1 子群） / ICONS +6 lucide + reuse / PANEL_REGISTRY +17 / HEADER_LABELS +17 | — |
| **Phase B 17 layer 接線** | overlayRegistry 17 entries（paint 讀 params + rebuildOnParamChange）/ useMapInteraction GIS_LAYERS +17 / useTransportParams state+deps+case +17 / policeJusticePanels.tsx 17 panel（共用 Header + POLICE/CORRECTIONAL/COURT/PROS/SPEED_CAM 中英對照表） | — |
| **階層分級視覺** | 警察 6 階（headquarters/police_dept/precinct/substation/specialized/security/other，radius factor 1.7→0.6，色深淺）/ 法院 6 階 / 檢察署 3 階 / 矯正 5 類 / 廉政 central-local / 海巡 patrol/pier / 調查局 name 末字（處 vs 站） | — |
| **測速照相 subtype × limit_kph** | 4 subtype 分色 + 限速越低圈越大（≤30 學校 1.5× → ≥100 國道 0.7×） | — |
| **A1 realtime 30 天滾動** | rpc_a1_by_bbox loader + wallClock 60s 重算 age_hours + 3 桶漣漪（<24h 大圈鮮紅雙層 halo / <168h 中 / <720h 小） | — |
| **累計時間 chip** | crime/theft/accidentTaipei/trafficAccidentYearly 4 popup 都加紅色 chip 標「民國 104~115 / 2014~2024 / 2025 / 2019~ 累計」避免誤認即時 | — |
| **AirportPanel 擴 24h pax** | 既有 airports.geojson layer（Polygon 4 機場 iata）內部擴：拉 rpc_airport_hourly_pax(iata,24) → TimeseriesSparkline 顯示 in/out 兩折線 | — |
| **MonitorPanel 2 卡** | PrisonCard（30min 拉全國在監 KPI，⚠ collector 只 1 row）/ AirportPaxCard（4 機場 tab + 5min 拉 24h pax） | — |
| **PoliceJusticeLegend + 8 mini-legend** | overlap_count 色階 + 警察階層 / 測速限速 / A1 30 天 / 法院階層 / 檢察階層 / 矯正 / 調查局 / 廉政 / 海巡 visibility-driven mini-legend | — |
| **UX 四鐵則齊活** | 透明度 slider（17 layer + 3 iso layer）/ 圖例（`layerConsistency` 全綠）/ click popup（17 panel）/ select（原生 dropdown for options ≥ 4） | — |

### B. 警察 isochrone × overlap_count × 3 層級全台 5 區

**Pipeline 4 檔**（`taipei-gis-analytics/pipelines/police_justice/isochrone/`）：

| 檔 | 職責 |
|---|---|
| `10_police_isochrone.py` | 主 script：`pyrosm.OSM(pbf, bbox).get_network(network_type=walking/driving)` → osmnx `simplify_graph` 加速 2x → per-station `nx.ego_graph(radius=r_m)` → `shapely.concave_hull(mp, ratio=0.5)` + `buffer(0.15×r_deg)` + `simplify(0.10×r_deg)` → `polygonize(unary_union(boundaries))` + STRtree.covers 計 overlap_count → **dissolve by overlap_count**（每 count 一 MultiPolygon） |
| `15_run_by_region.sh` | 5 區（north / north2 / central / south / east）獨立 process 跑 `--all` 12 變體，`mv *.geojson` 到 `by_region/{name}/` |
| `16_merge_regions.py` | 5 區同變體 GeoJSON 合 1 個到頂層 |
| `20_merge_combined.py` | 同 tier 4 變體（walk 5/10 + drive 5/10）合成 1 個 combined GeoJSON（每 feature 帶 `tier + mode + minutes + overlap_count`） |

**前端 3 layer**（`overlayRegistry.ts`）：

- `policeIsoSubstation` / `policeIsoPrecinct` / `policeIsoCityDept`
- 每 layer 鎖 `combined.pmtiles`，paint 用 `case fill-opacity` 讀 `${id}Mode_drive` + `${id}Minutes_num` params 互斥顯示（不換 sourceUrl）
- fill-color: overlap_count `step` 色階（1 站 淺粉 #fee2e2 → 20+ 站 深紫紅 #7f1d1d）
- line-opacity: 0.08（e824165 commit：從 0.3 降下，消除 dissolve 後多重 ring 產生的同心圓錯覺）

**規模**：3 tier × 4 變體 = 12 GeoJSON → 3 combined PMTiles：
- substation: 11 MB / 334 features / 全台 1504 站
- precinct: 3.0 MB / 168 features / 全台 163 站
- police_dept: 278 KB / 72 features / 全台 32 站

### C. 收尾整理

- master 完全 sync origin/master
- 未 tracked 舊實驗 climate 檔（`useClimateParticleLayer.ts` + `climateParticleCustomLayer.ts`）已刪（被 `a8d28e7` hybrid globe drape 取代）
- 2 個 code commit + 8 個 memory commit（本 wrap-up）

## 3 天累計 code 改動概覽

- **taipei-gis-analytics**：新增 `pipelines/police_justice/isochrone/` 4 檔 + `data/processed/police_justice/isochrone/` 12 + 3 combined GeoJSON + 3 combined PMTiles + `data/raw/osm/filtered/` 2 個 osmium 過濾 PBF
- **gis-platform**：3 個 migration（262-264）已 applied
- **mini-taiwan-pulse**：Types / LayerCatalog / 17 panels / overlayRegistry / useMapInteraction / useTransportParams / LegendPanel / MonitorPanel + 2 cards / 新 hook（useA1AccidentRealtimeLayer / usePoliceIsochroneSourceSwap—已刪） / policeJusticePanels（含 3 iso panel）

## 待辦（收尾時已列 BACKLOG / TaskCreate）

- **BACKLOG PI-1**：警察 isochrone 5 區邊界斷裂 3 修法（A bbox +0.15° overlap 60-90min 重跑 / B raster heatmap 1-2 天 / C 補丁 pass）
- **TaskCreate #15**：`⚠️ data-collectors collector 補跑 prison_population_daily`（realtime 只 1 row / 2026-05-15）— 屬 data-collectors repo
- **isochrone S3 sync + production deploy**：等 PI-1 修完再上（避免上線後又要重推 S3）

## 最終驗證

- `npx tsc -b` ✅ 0 error
- `pnpm test` ✅ 159/159（包含用戶新加的 4 tests）
- browser 視覺驗證：17 layer + 3 iso layer + AirportPanel 折線 + Monitor 2 卡 全都 renderable

## 上一個 session（2026-06-27）

見 git log — cwa-imagery per-day LRU cache + timeline rangeDays SSOT + dayPrefetch helper + 4 輪 bugfix。詳前一版 STATUS 已 memory commit `20399a4`。

---

_wrap-up 8 commits_：`5aa244f 098ffc5 4a7dfa4 511be4c 67dd4e4 addecb4 0eb4137` + 本檔
