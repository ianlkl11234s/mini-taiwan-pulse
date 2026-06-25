# Backlog

優先級：**P0** = 阻塞中 / **P1** = 規劃期內 / **P2** = 穩定後再做 / **P3** = nice-to-have

## 進行中 / 待辦

### 水資源系統（BL 系列 — 盤點 DB 有資料但前端沒用的 Quick Wins）

| ID | 優先級 | 項目 | 狀態 | Blocker / 備註 |
|---|---|---|---|---|
| BL-1 | P1 | `river_levees` 堤防 4,222 筆上線 | **done** | 2026-04-24 完成；overlayRegistry amber line，status=待建用 case expression 淡化 |
| BL-2 | P2 | `water_protection_zones` 水源保護區 107 筆 | **done** | 2026-04-24 合併 BL-3 為「管制區 Protection」單一 toggle |
| BL-3 | P2 | `groundwater_zones` 地下水管制區 21 筆 | **done** | 2026-04-24 與 BL-2 合併，zone_kind 四色 match expression |
| BL-4 | P2 | `flood_hazard_zones` 淹水潛勢**多情境** 17,303 筆 | open | dropdown 情境 slider，目前前端只用 650mm 單情境 |
| BL-5 | P1 | 水庫點選顯示 3D 進/出流雙排日柱 | **done** | 2026-04-23 完成（commit dae1c78 / 06116e7 / 52a56ba / 6600433）|
| BL-6 | P3 | 水庫 3D 柱顯示「最新日期」標記 | open | 討論中：panel ribbon 或 Marker「最新」小字；暫停 |
| BL-7 | P3 | `reservoir_daily_ops` 04-23 停擺診斷 | open | collector / cron 4-23 後沒進新筆，需查 Zeabur log（2026-04-25 盤點時發現）|
| BL-8 | P3 | Git history 清舊 water_*.geojson 大檔 | open | 5 個檔留在 history（最大 79MB water_flood_extreme），每次 push GitHub 警告但不影響功能。.gitignore + S3 機制已正確。需 git filter-repo + force push（風險高 → 暫不做）|

### 水資源擴展（新 collector / 新 RPC）

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| W001 | P2 | 警戒水位視覺化 | open | 需先 seed `public.river_stations`（目前空表），再回 055 RPC 加三級警戒欄位 |
| W002 | P2 | 地下水 RPC + 前端 | **done** | 2026-04-24 完成；migration 058（latest/day/timeseries）+ useGroundwaterLayer + timeline 驅動；739 站覆蓋 |
| W003 | P3 | 枯旱預警燈號 | open | WRA dataset 36695 |
| W004 | P3 | 洩洪訊息 | open | WRA dataset 58343 |
| W005 | P3 | 水權統計 | open | data.gov.tw 36696，**非空間**表格，做指標卡/長條圖，補「用水」最大缺口 |
| W006 | P3 | 集水區敏感區（內/外 0.5km） | open | WRA 129475 / 129476 |

### 廢棄物 / OSRM map-matching（BL-9~13 — 2026-05-09 上線後新待辦）

| ID | 優先級 | 項目 | 狀態 | Blocker / 備註 |
|---|---|---|---|---|
| BL-9 | P2 | 多城市擴展 OSRM map-matching | **partial** | 2026-05-09 台南上線；env var 加台南、SQL DISTINCT ON dedup（commit `d8297f9`）、trip-gap 600→900s（commit `e937383`）、DELETE 5/8+5/9 台南 attempt 重跑驗證。**待用戶前端視覺驗證**。台南 success rate baseline ~20-45%（低於高雄 5-25pt，採樣 5min vs 2min 的硬限制；BL-11 才能根本解）。新北未驗證但 plan §15 凍結式描述其實錯誤（採樣 p50=120s 跟高雄一樣穩定）。詳見 plan §14 + §15 |
| BL-14 | P2 | 查證高雄 5/9 success 30.3% vs 5/8 49% 落差 | open | trip-gap 改 600→900 後可能誤合「短停」邊界 → trip 內出現大跳 → OSRM fail。SQL 對比 5/8 同時段 13:00-18:00 高雄 success rate 即可分辨 daily variance vs trip-gap 副作用。若是後者，考慮 per-city dict（高雄 600s / 台南 900-1500s） |
| BL-15 | P2 | ETL UNIQUE constraint + ON CONFLICT DO NOTHING | open | `spatial.waste_positions_realtime` 無 unique 約束，台南 polling 每 ~2min 重複抓 endpoint「最近 N 分鐘 GPS」→ 同 (city, vehicle_no, observed_at) 重複寫 2-4 次（全表 56,934 dup groups / 114,182 row 該刪 / 台南 60% / 新北 7% / 高雄 0.09%）。每天約 50K dup row 累積。Migration 步驟：(1) DELETE dup 保留最早 ingested_at; (2) CREATE UNIQUE INDEX (city, vehicle_no, observed_at); (3) `storage/supabase_tables.py` waste_positions 加 `upsert_key` + `upsert_strategy='do_nothing'`。Hygiene only — 不影響當下 OSRM success rate（SQL 端已用 DISTINCT ON 防禦） |
| BL-16 | P2 | 前端 useWasteLayer.ts 加台南 default + city 切換 UI | open | 目前 `useWasteLayer.ts:41` cities 預設 `["高雄市"]`，要改 `["高雄市", "臺南市"]` 才看得到台南；UI 仿 BusGroup pattern 加 city 切換 toggle。設計上已支援多城（cities 是陣列參數），純改 default + UI |
| BL-10 | P3 | PBF 月更自動化（GitHub Actions cron 每月 1 號）| open | 目前要手動 push trivial commit 觸發 Zeabur redeploy。寫 `.github/workflows/refresh-pbf.yml` 自動跑 |
| BL-11 | P3 | 評估 stop-to-stop OSRM /route 取代 HMM /match | open | 預期 success rate > 90%，但要先解 `waste_collection_stops` 沒 `stop_sequence` 欄位的問題（用 `arrival_time` 推或從 GPS 反推）。1-2 天工程 |
| BL-12 | P3 | 評估刪除 `data-collectors-ship-only-aws` Zeabur project | open | Lightsail Tokyo 機器（IP 被高雄/台南政府 API 擋）目前完全沒用。月費 $X 可省 |
| BL-13 | P2 | LegendPanel 加「沿路網」說明 | open | 區分 matched（沿馬路）vs fallback（GPS 直線）兩種視覺，給用戶看圖例 |
| BL-17 | P2 | 表定動畫沿馬路（OSRM 路徑） | open | 目前 v1 是 stops 直線插值會「穿牆」。高雄/新北 DB 已有 1399+649 LineString 可投影 stops 到 polyline；北/基/宜需打 OSRM `/route` 補。仿 GPS matched trail progress-based interpolation。預估 2-3 天 |
| BL-18 | P1 | 22 城擴展前跑 schedule sanity SQL | **done** | 2026-05-12 完成；22 城 import 後 weekday/arrival 格式都被 migration 079/080 RPC parser 涵蓋，沒新 quirks。lng 截斷 4 + 出界 5 全部由 080 sanity filter 過濾掉（migration 080 跑 18 城 routes=2,646 / stops=66K 正常） |
| BL-19 | P3 | dwell=0 + gap=0 corner case | open | 兩個都 0（total=0）時 ratio NaN，車仍卡在 p0。改用「下一段挪用」邏輯，跨 stop 借時間。罕見 case，先放著 |
| BL-21 | P3 | hwms 5 城 overlap 合進 supabase 評估 | open | `waste_collection_stops_hwms_5city_overlap.geojson` (111K stops) + `..routes_hwms_5city_overlap.geojson` (3.5K routes) 是 hwms 在 5 城範圍的部分，**目前未 import**（既有 5 城 waste 路徑保留）。hwms 路徑某些城更詳細（新北 27K→64K、臺北 4K→12K），但宜蘭反而少（12K→5K）。要研究怎麼 dedup 合併（用 stop_name + coord 雙重 key？取較詳細？）。1-2 天 |
| BL-22 | P2 | hwms flat schedule routes OSRM 沿馬路升級 | **done** | 2026-05-12 完成；A 類 287 routes 跑 OSRM /route 取 stop-to-stop 沿馬路距離（1,721 calls, 6.4min, 0 fail），寫 `spatial.waste_route_inferred_segments`（migration 084）。RPC migration 085 LEFT JOIN 該表，NULL fallback 直線×1.4。竹北019 從 4hr4min → 4hr21min（+10% 更貼真實）|
| BL-23 | P2 | Round 4 TGOS 18,005 normalized addresses | open | 從 91K 沒對到 stops 篩出地址正常可救的 18K (排除 landmark/intersection/no_number/offshore 31K)，normalize 剝重複前綴+環保局後拆 day_008+day_009 進 `upload/v2/`（commit 待 push）。**Round 4 收完後完整流程**：(1) 更新 `12_unified_callback.py` PAIRS 加新 (result, mapping) 對 → 跑 `--commit` 補座標 (2) 跑 `30_build_split_geojson.py` 重 build 17 城 geojson (3) `DELETE FROM spatial.waste_collection_stops WHERE city NOT IN ('5城')` + `05_import` reinsert (4) **重跑 `compute_waste_inferred_segments.py`** — resume-aware 自動補新增 flat routes 的 OSRM segments（新竹市/嘉義市先前 0% 現在可能新出現 A 類 routes）(5) RPC 自動接 OSRM 不用改。詳見 `_phase11_round4_README_*.md` |

### 一般待辦

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| G001 | P2 | 刪 `useTransportParams` 裡的 `reservoirBubbleOpacity/Glow/Size` 殘留 slider | done | 2026-04-22 已拆 |
| G002 | P3 | `[ReservoirLayer] render #N` 改 `DEBUG_RESERVOIR` env flag 控制 | done | 2026-04-23 render loop 修掉時順手移除 |
| G003 | P3 | `public/three-showcase.html` / `public/showcase/` 去留 | open | 2026-05-25 review 確認：獨立 Three.js demo，`src/` 未引用，從 unpkg 載 three@0.160（app 用 0.172）。用戶決定**暫留原地**（已 tracked）。未來可移 `examples/three-showcase/`（連同 `docs/three-showcase-library.md`）排除 build |
| CS-1 | P3 | Code Splitting / Dynamic Import 重型依賴 | open | 對象：`mapbox-gl` / `three` / `pmtiles` / `@deck.gl/*` / `satellite.js` / `h3-js` 全部 eager import。效益：首屏 JS bundle 變小、TTI 加快（次要瓶頸，主要瓶頸已由 perf ①+② 解決）。風險：Vite chunk 邊界 / Mapbox worker 註冊時機 / PMTiles protocol 註冊順序常踩坑，需完整回歸。工時：1-2 天。觸發時機：等到出現「首頁 JS bundle 過大」用戶抱怨，或 ①+② 完成後仍想再壓首屏。**規劃源**：`/Users/migu/.claude/plans/1-2-modular-rossum.md` |
| PT-1 | P2 | 大型 GeoJSON → PMTiles 轉換 | open | perf ② 把靜態 GeoJSON 改成 toggle 才抓，但「toggle 後 fetch 整檔」對大檔仍重。改 PMTiles + HTTP Range Request 後實際下載量可壓到 1/20~1/50。候選（按 size 排）：`provincial_road` 44MB / `medical_clinic` 26MB / `medical_ltc` 17MB / `forest_trail_signs` 17MB / `fire_hydrants` 13MB / `medical_aed` 9.4MB / `medical_pharmacy` 8.4MB / `national_highway` 7.9MB（共 ~142MB）。流程：collector 端跑 tippecanoe 切 tiles + 包 .pmtiles，前端 overlayRegistry 該 entry 加 `pmtiles: { sourceLayer, minzoom, maxzoom }`，hydrate 路徑自動 no-op（Mapbox 自動 tile-on-demand）。先試 `provincial_road` 一條，驗證流程後再批次。工時：先做 1 個 ~半天（含 tippecanoe 參數調），後續每個 ~1h |

### 結構 / 部署 Review（2026-05-25 全專案結構審查 — G004~G010）

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| G004 | P1 | Docker image 瘦身：`.dockerignore` 排除 nginx 已走 /data volume 的 dist 目錄 | open | nginx.conf 把 `/geo`(280M)/`/h3`(22M)/`/rail`(101M)+根層 aviation/ship/temperature json 指向 `/data` persistent volume（`pull-deploy-assets.sh` 從 S3 拉），**dist 內這些目錄線上永遠不被讀** = 死重量，但 `.dockerignore` 沒排 `public/` → Docker image 白扛 ~400MB。安全做法：`.dockerignore` 加 `public/geo public/h3 public/rail`。⚠️ `agriculture`(254M)/`bus`(196M) **無** /data location、是從 dist 載的，要排除需先改 nginx 走 volume + S3 deploy-assets。**未動因影響部署正確性，需用戶確認** |
| G005 | P2 | waste 圖層底圖切換 (dark/light) 後消失 | open | `MapView` styledata 重建段落（~181-187）重建了 H3/pop/youbike/agriculture，但**沒重建 waste source/layer**，又被 `wasteMapboxSetupRef` flag 擋住不重跑 → 切底圖後垃圾清運圖層消失。2026-05-25 修 waste listener 洩漏時附帶發現 |
| G006 | P3 | 手機版 sidebar 多顯示項產品取捨 | open | 2026-05-25 統一 `sidebar/layerCatalog.ts` 後，手機版補上原本只桌機有的 FACILITY(學校/超商)/NEWS/海纜/雲圖雷達（修漏的副作用）。確認手機是否要全顯示，否則用 `labelMobile`/SECTIONS 過濾隱藏 |
| G007 | P3 | 移除 `@deck.gl/*` 4 套件死依賴 | open | `deckOverlay.ts` 刪除後 `@deck.gl/core,geo-layers,layers,mapbox` 已無任何 import。沒 import 不進 bundle，只影響 node_modules 大小。2026-05-25 發現 |
| G008 | P2 | 巨型檔案按 domain 拆分 | open | `App.tsx`(1945)/`overlayRegistry.ts`(1992)/`FeatureInfoPanel.tsx`(1703)/`useTransportParams.ts`(1031)/`InfoModal.tsx`(1111)。建議順序：先拆 FeatureInfoPanel（最規律低風險，按 domain 切子檔+色票進 `data/*Types.ts`）→ App.tsx（抽 `useAllLayers`/`useAppUiState`/map lifecycle hook）→ overlayRegistry（domain 片段+circle/line/fill paint 工廠）。2026-05-25 架構 review |
| G009 | P2 | 16 處 Supabase RPC 補 `loadingRegistry`（違反規則 B）| open | 優先 `busLoader.ts:69/121/211`（公車核心動態層初次/切日無 loading UI）；其餘 `*_dates`/`*_years`/`*_counts` 13 個 metadata RPC 危害低但字面違規；`railScheduleLoader.ts:26/62` 裸 fetch 同樣無 loading。2026-05-25 效能 review（規則 A time store + 規則 C realtime schema 全合規）|
| G010 | P3 | `FireStationScene.ts:180` 每幀 `new THREE.Matrix4()` | open | `animate()` 每幀分配 Matrix4，其他 Scene 都用 `this.lastMatrix` 快取；提升為 instance field 重用。2026-05-25 效能 review |
| G011 | P2 | Monitor wall mode 暫停地圖 engine | open | PR #21 效能優化跳過項。wall mode 下地圖全被蓋住但 rail / ship / Three.js 仍跑 RAF 吃 CPU。需在 `src/engines/` + `src/three/` 加 `setActive(false)` 介面，App.tsx 偵測 `monitorOpen && wall` 呼叫暫停。風險：地圖視覺凍結需 PM 確認可接受。2026-06-18 perf review |
| G012 | P3 | Monitor alertSeries24h 改增量抓 | open | 目前 cachedOnce(5min TTL)，每次重抓 24h × 6 group。理想：累積式只抓最近 5min。需動 gis-platform RPC。2026-06-18 perf review |

### Design System 未抽 token 範圍（DS 系列，2026-06-18 加 — 設計系統 6-phase 完成後刻意延後項）

詳細 rationale 見 `docs/design-system.md` §8。原則「沒有真實痛點就不抽 token」。

| ID | 優先級 | 項目 | 狀態 | 觸發時機 |
|---|---|---|---|---|
| DS-1 | P2 | Z_INDEX scale | open | 出現「panel 被 X 蓋掉」bug 時開。目前 Mapbox / panel / modal / loading 層級散在 inline 未集中 |
| DS-2 | P3 | transition / duration / easing tokens | open | 兩個動畫應該同節奏但目前不同（如所有 panel slide-in），出現一致性訴求時開 |
| DS-3 | P2 | 互動狀態色（hover / focus-ring / disabled / pressed）+ CONTROL.* 控件背景 | open | 做 button family / form UI 時自然浮現。Phase 1 codex 抓到 control bg 不該收進 SURFACE（10 處還原），未來開 CONTROL.* 群組統一 |
| DS-4 | P3 | Breakpoint tokens | open | 出現需第 3 種 viewport（平板 / 窄寬）時開。目前用 JS `isMobile` 布林分流，動態 detection 比 CSS breakpoint 靈活 |
| DS-5 | P3 | Control sizing scale（button height / icon size / hit-area） | open | 出現「為什麼這個按鈕比那個高」抱怨時開。Phase 6 抽 CloseButton 順手定 24×24 / 28×28 兩個，沒擴大為全域 scale |
| DS-6 | P3 | intelTokens.ts 退役 → designTokens 收編 | open | 目前 designTokens 單向 import intelTokens。未來要把 COLORS / FONT_DATA / GIS_LEVELS / SEV_LEVELS 等常數搬進 designTokens，intelTokens 改為純 re-export，最後刪除。⚠️ 不可反向 re-export（會 circular dep） |
| DS-7 | P3 | LayerSidebar 雙 theme 亮側套 token | open | Phase 3 只套暗側 token，亮側流量低 + 未驗證視覺保留 inline。當行動版有實際使用回饋時再做 |

### 農業（Phase 3 Batch 1，feat/water-extensions 分支）

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| AG-1 | P3 | Wave D 公司登記點位 3 集（45640+45618+45655） | **done 2026-05-25** | TGOS geocode 完成（60,326 點 / 562 失敗）→ 前端 3 獨立 layer 接線完成（見已完成區）。後續驗收/部署拆到 AG-6 |
| AG-6 | P2 | 農企業登記 3 layer 驗收 + 部署 | **done 2026-06-02** | (a) browser 視覺驗收（先 All Off；retail/produce zoom≥8、市場 zoom≥6）(b) `upload-deploy-assets.sh` 推 3 geojson 上 S3（gitignore）(c) Supabase import `spatial.agri_business_registrations`（overwrite，走 gis-data-onboard SOP）(d) 程式 commit。⚠️ ~34MB eager 載入，若要瘦身（座標 17 位小數 + 冗欄位）**在 taipei-gis-analytics 上游做**別在前端分叉 artifact |
| AG-2 | P3 | FTW 田區 click popup | open | 目前 38 萬 polygon 只有 confidence 屬性，單格無實用資訊故未接。若要接需要 spatial JOIN 賦予地理資訊（縣市、土壤類）才有意義 |
| AG-3 | P3 | Soil/SoilFertility 完整欄位重出評估 | open | 目前 soil_map_national 已含 8 欄、soil_fertility 含 5 欄。如果要全欄位（土壤分類 18 raw / 肥力 21 raw）PMTiles 會明顯變大（fertility 14MB → 32MB 已是部分欄位的結果）。先看是否有用戶反饋需要更多細節再決定 |
| AG-4 | P3 | crop_suitability 跨作物 overlay 視角 | open | 目前 dropdown 只能看一個作物；若要看「這塊地適合幾種作物」需要 aggregate query。屬於 nice-to-have |
| AG-5 | P2 | 分支重命名 feat/water-extensions → feat/agriculture | open | 本 session 主要做的是農業，但分支名仍寫水資源。建議重新命名或新開 feat/agriculture-batch-1 |

## 已完成（近期 10 筆）

- 2026-05-25 ✅ **農企業登記 3 layer 接線**（AG-1）：retail 37,430 / produce_wholesale 22,843 / wholesale_market 53（共 60,326 點 / ~34MB）。**走 `overlayRegistry`（宣告式，MapView 不用改）非 agricultureLayerFactory** — 大型 geojson 散點比照 fireHydrants。3 獨立 toggle 進 AGRICULTURE 區；色 #e91e63/#3f51b5/#ffd600；新建 `src/data/agriCompanyTypes.ts`（色/標籤 SSOT）；UX 四鐵則：opacity+scale slider / 合併圖例 AgriCompanyLegend / click popup AgriCompanyPanel（公司名稱/統編/負責人/地址/資本額/狀態，bracket notation 讀中文欄位）。`npx tsc -b` 綠（補了 IconRailSidebar LAYER_ICONS 隱藏 Record）；dev server 3 資產 HTTP 200。⏳ 驗收/S3/Supabase import/commit 見 AG-6
- 2026-05-23 ✅ **農業 Phase 3 Batch 1 完整上線**（6 PMTiles + 1 GeoJSON POI 部署到 public/agriculture/ ~215MB / FTW 既有 + agriSoil/agriSoilFertility/agriLeisureFarmZones/agriRuralRegen/agriCropSuitability/agriPOI 共 7 layer / 132 種作物 dropdown 切換 / 6 個可選取 layer 全部接 click popup [FTW 田區除外，僅 confidence 屬性無意義] / agriPOI 三類 + agriCropSuitability 4 級配色雙圖例 / 土壤肥力 6 metric 著色切換 [health/pH/OM/CEC/M3_P/M3_K] + 健康度綜合算法 + 數值分級註解 / sidebar select dropdown 門檻 > 6 → > 3 解橫向溢出 / 圖層 UX 鐵則升級 3 → 4 條完整寫進 docs/CLAUDE.md/memory）

- 2026-05-12 ✅ **22 城 hwms stops 補座標 + INSERT 進 supabase**（v1+v2 TGOS 共 7 csv ~65K 地址 callback → 補 192K stops 座標 [TGOS 103K + pre_geocoded city-match 89K]，仍 91K 缺座標。寫 12_unified_callback.py + 30_build_split_geojson.py 拆 17 城 [104K stops + 4.7K routes] + 5 城 overlap 備份 [111K stops + 3.5K routes]。05_import_to_supabase 加 --stops-file/--routes-file 參數。INSERT 不 truncate → supabase stops 77K → 182K / routes 2K → 6.7K / 5 城 → 18 城。前端 wasteScheduleLoader+useWasteScheduleLayer 預設改 ALL_22_CITIES。Migration 080 sanity filter 對新加 17 城資料一樣有效（0 出界）。RPC 跑 dow=4 共 67K stops 健康）
- 2026-05-12 ✅ **migration 080 stop coord sanity filter**（5 城 stops 中 87 outlier + 4 lng 整數截斷 + 5 出界 → RPC 三道 filter [整數 / Taiwan bbox / route 內 outlier] 自動跳過。tooltip 5min 寫死 → import Scene TRIP_BREAK_S=1500s 對齊）
- 2026-05-11 ✅ **垃圾車表定動畫 視覺統一 + expandable**（顏色淡紫 → 琥珀同 GPS、加 WasteMusicNoteScene 音符特效、wasteScheduleNote 獨立 sub-toggle、主 toggle expandable 展開 3 slider 共用 GPS paramRefs）
- 2026-05-10 ✅ **垃圾車表定動畫 (Phase 3 prototype) 上線**（5 城 1281 routes / 77K stops / dow 驅動 / 淡紫 #a78bfa 跟 GPS 圖層獨立 toggle 並存。RPC migration 079 grouped JSONB 避 PostgREST 20K cap / 7 種 source data quirks 修法 / 視覺打磨 7 方案 try-error 收斂。OSRM 整合計畫 BL-17，22 城擴展 sanity check BL-18，corner case BL-19）
- 2026-05-09 ✅ **廢棄物 OSRM map-matching pipeline 完整上線**（osrm-taiwan + osrm-proxy 兩 service / migration 074+075 / waste_match collector / 5/4-5/9 共 6 天 backfill / 1,510 success match / attempt marker 解 retry 死循環 + drain。多城市擴展計畫進 BL-9~13）
- 2026-04-26 ✅ **iot_wra 重複度檢核 SOP**（座標 + 名字 sample，不信編號系統；發現 groundwater 95% 重複 / river 16% 互補）
- 2026-04-26 ✅ **Migration 063 iot_wra 雙表 pre-aggregate**（latest 4k snapshot + daily timeline 字串編碼，仿 freeway pattern）
- 2026-04-26 ✅ **iot_wra collector 停 groundwater 子端點**（避重複；iot 5 年歷史保留在 DB）
- 2026-04-26 ✅ **前端 iotWraRiver + iotWraStructure 兩 layer**（含細項 toggle 即時/預測 + 5 類型 + LegendPanel +2 段）
- 2026-04-26 ✅ **研究報告區 docs/research/**（iot 整合研究 + 水資源 layer 故事 cookbook 兩篇）
- 2026-04-25 ✅ **Toggle 設定 4 水層 × 2 滑桿**（rain/river/groundwater/wells 的 scale + opacity，支援 setPaintProperty 熱更）
- 2026-04-25 ✅ **河川水位改 delta 著色**（跨站可比；解「timeline 拖不動 + 中南部看似沒資料」）
- 2026-04-25 ✅ **Migration 060b 河川水位降頻**（44K → 8K rows，解 PostgREST 20K cap 導致南部 103 → 1 站）
- 2026-04-25 ✅ **Migration 060 地下水井降頻 + delta_24h**（78K → 16.5K rows）
- 2026-04-25 ✅ **地下水井拆兩 toggle**（groundwaterWells 靜態 + groundwater 動態 delta 著色）
- 2026-04-25 ✅ **底圖切換 throw 修復**（styleReady helper + 6 處 guard；H3 res9/res8 loader fallback）
- 2026-04-24 ✅ **W002 地下水井**（migration 058 + useGroundwaterLayer + GroundwaterPanel，timeline 驅動，739 站）
- 2026-04-24 ✅ **BL-2+BL-3 水資源管制區**（合併 toggle，zone_kind 四色 match expression，128 polygon）
- 2026-04-24 ✅ **BL-1 堤防**（4,222 筆 MultiLineString，amber line，status=待建 case-expression 淡化）
- 2026-04-23 ✅ **BL-5 水庫 3D 進/出流雙排日柱**（初版雙柱 → 雙排 N 日柱 → 位置/高度修正）
- 2026-04-23 ✅ **Phase 2.3 Timeline 回放**（rain/river/reservoir 三層走 timeStore）
- 2026-04-23 ✅ **雨量 Mapbox heatmap**（擴散視覺 + zoom 分工）

> 更早完成項目見 git log 與 REFLECTIONS.md

### 消防 FIRE & RESCUE（feat/fire-rescue 分支，2026-05-24 上線；5/26 加救援等時圈）
- ✅ 4 layer（火災歷史/最新年度/分隊3D/消防栓）+ 分隊階級大小 + 散點/3D toggle
- ✅ **F-3 屏東補座標 done**（2026-05-26）：39 隊 Mapbox geocode 補齊 → fire_stations 677→**716**、22 縣市全。`scripts/fetch/geocode-pingtung-fire-stations.py`（門牌近似精度，見 F-6）
- ✅ **救援等時圈 `fireIsochrone` done**（2026-05-26）：路網 5/10/15 分 PMTiles + 全國聚合 + 縣市 `<select>` filter，做法見 PB-16
- ⏳ **F-1 S3 deploy**：`upload-deploy-assets.sh` 推 fire_stations.geojson(0.2M, 已含屏東) + fire_hydrants.geojson(12.8M) + **fire/fire_isochrone_coverage.pmtiles(9.3M)**（gitignore，未上 S3 = production 看不到）
- ⏳ F-2（可選）分隊 3D 光柱接 pick → 點柱體也能跳 popup（目前靠底下 circle）
- ⏳ **F-5 等時圈 Phase B**：點選某分隊 → 高亮該隊個別等時圈（資料已備 `build/fire_isochrone/fire_isochrone_stations.geojson`，需切 PMTiles + setFilter by `station_id`）
- ⏳ F-6（可選）等時圈精修：pmtiles 9.3M 可調 tippecanoe 參數瘦身；屏東 geocode 為門牌近似，精度可回上游 TGOS 重做
- 💤 F-4（已移除，可選復活）火災火焰特效 FireBlazeScene（git 歷史 feat/fire-rescue 中段）

### 上線 / 部署（2026-06-02 mini-taiwan-pulse 正式上線後）

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| LA-1 | — | 正式上線 Zeabur（feat/fire-rescue→master，itsmigu.com + Cloudflare）| **done 2026-06-02** | 部署鏈：entrypoint 背景pull + pull改sync + agriculture接鏈 + /geo/h3/bus dist fallback + 移除/api死碼。本地 git-archive docker 攔下 4 雷。docs/launch/ 8 份 |
| LA-2 | — | 4 UI 改 + flight/ship loading + 農路/國土綠網 2 新層 + 預設視角 | **done 2026-06-02** | 全部已部署上線並驗證 |
| LA-3 | — | D1 唯讀 S3 key + Mapbox URL 限制 | **done 2026-06-02** | 用戶執行；Zeabur runtime S3 改唯讀 key |
| LA-4 | — | Cloudflare 靜態檔快取 + 404/5xx no-cache | **done 2026-06-02** | Cache Rule /geo /h3 /bus /agriculture /fire /rail + Status Code TTL |
| D3 | P1 | 收窄 Supabase PostgREST Exposed schemas（資安） | open | 移除 reference/spatial/fire/maritime/rail/safety/demographics/opendata/metadata，只留 public+graphql_public，擋 anon 直讀表（realtime 已不曝光）。**前置**：掃其他共用 gis-platform 的站（mini-taiwan-info 等）確認無 REST 直讀這些 schema。**不可撤 table grant**（74/81 RPC 是 INVOKER 會掛）。秒級可逆（加回 schema）。詳見 docs/launch/08 |
| LA-5 | P2 | deploy-assets 扁平 → 鏡像結構 + manifest 總帳 | open | 三邊同名（S3/data/nginx）+ 整夾 sync，加新大檔 0 改腳本。雙軌可逆，最後才清舊扁平物件。計畫見 docs/launch/06 |
| LA-6 | P3 | pulse-api 評估關閉省錢 | open | 前端已全走 Supabase、nginx /api 死碼已移除。確認無其他消費者後可停 pulse-api service |
| LA-7 | P2 | 上線後觀察 Supabase Dashboard + Zeabur/Mapbox 帳務 | open | 公開流量下的連線數/CPU/egress 成本；memory 有 spend cap + IO 爆表前科。設帳單警報 |

### 衛星 SPACE（SAT 系列，2026-06-13 上線後新待辦）

| ID | 優先級 | 項目 | 狀態 | Blocker / 備註 |
|---|---|---|---|---|
| SAT-1 | P2 | Satellite Intel Console panel（Phase A）| open | docs/proposal/satellite-console.md §3。右側 340px panel：§A 變軌警報區（紅 banner + 卡片 + 飛到衛星）+ §B 中國 6 群 accordion + §C 台灣 15 顆 hero 卡 + §D 即時統計（覆蓋台灣中 / 未來 6h 過台時刻）。入口取代現有 Satellite icon 行為（與 5 toggle 並存）。預估 4-6h |
| SAT-2 | P2 | §E 衛星百科卡 + §D 啟發式變軌預測（Phase B）| open | UCS catalog 完整欄位 + tle_history 30 天變軌列表 + 「下次變軌約 N±N 天，信心 X%」（必標「估算 ± 信心區間」警語，2026-06-13 拍板）。預估 3-4h |
| SAT-3 | P3 | §F 變軌前後覆蓋對比 modal（Phase C，OSINT 核心）| open | 兩張並排 mini-map：左=從 tle_history 取 prev_epoch TLE 跑 SGP4 7 天 + 右=最新 TLE 7 天。下方算「過台灣頻次 5→7 次/日 +40%」量化威脅變化。預估 3-5h，最有戲劇性 |
| SAT-4 | P3 | gis-platform migration：satellite_classified view category 對齊（Yaogan→china_yaogan etc.）| open | 目前前端 regex 拆群，view 仍只有 military/earth_obs 粗分。後端對齊後 loader 切 view 查詢即可，前端 regex 可拆掉。**並行進行不阻塞 Phase A** |
| SAT-5 | P3 | 離軌（decay）預測 | open | 用 TLE B* 拖曳係數 + 高度衰減模型，對老衛星很有戲（哪顆快燒）。Phase D 選做 |
| SAT-6 | P3 | §G 變軌串 newsEvents 故事卡 | open | 「Yaogan 12 變軌時當日新聞」交叉比對，新聞 layer by-day 接口可用。Phase D 選做 |
| SAT-7 | P3 | RAF + 線性插值補幀（10 Hz → 60 Hz 視覺）| open | 在兩次 SGP4 之間用 lerp 補幀，視覺更貼真實流動。目前 10 Hz 點移動 ≈ 0.1px/frame 已肉眼滑順，非必要 |

### 新聞事件 NEWS（NE 系列，2026-06-13/14 三輪升級後）

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| NE-1 | — | 階段 A 分類上色 + 圖例 + popup 中文 | **done 2026-06-13** | commit b50f6ba。7 類 (accident/crime/disaster/traffic/health/policy/other) |
| NE-2 | — | 階段 B 同鄉鎮聚合 paint + popup | **done 2026-06-13** | commit 295ca15 + migration 163。max event_count 51 (臺北市) |
| NE-3 | — | v2 三維度（gis_relevance/severity/is_event）+ 10min 排程 | **done 2026-06-13** | migration 164 + collector 9fc0c60。LLM 多判 3 欄、cron 改 10min |
| NE-4 | — | v2.5 Filter dropdown + critical 視覺強化 | **done 2026-06-14** | migration 165 + commit 292b884。4 級篩選、critical-halo、ripple 強化 |
| NE-5 | P2 | POI 級精度（北科大/台大醫院等具體場所）| open | 路線 A+B 混合（gazetteer + LLM 順手判 place_name），預估覆蓋 30-50% 新聞；工程量約 1.5 天；session 紀錄有完整規劃。先做 C-1 覆蓋率分析半天 → > 40% 才繼續 |
| NE-6 | P2 | timeline 整合 get_news_event_dates RPC | open | 目前 disasterAlerts 也沒接，比照 pattern 一起做。讓 timeline 顯示有新聞的日期 |
| NE-7 | P3 | PTT 地方板（Atom feed 共用 LLM 管線）| open | 研究報告已標 Phase 2。一手目擊訊號獨特，但訊噪比低、需更嚴去重 |
| NE-8 | P3 | sidebar「臺灣即時新聞」清單區塊 | open | 仿 docs/research 的 storyboard。critical 級事件 timeline 列表，不只地圖點 |
| NE-9 | P3 | 地方政府新聞稿 RSS（桃/中/南/高市府）| open | 補強官方第一手資訊（Google News 抓不到的）。需逐一驗證 RSS 是否還活著 |
| NE-10 | P3 | 觀察自由時報 RSS Zeabur IP 403 | open | 持續 1 週看是否改善；若不變則改走 Google News 間接（UDN/TVBS 模式） |
| NE-11 | P3 | newsEvents Telegram daily report 加 token 花費 | open | 每天日報加當日 LLM 成本 + critical 事件數 + filter 級分布，便於監控偏離 $5/月 上限 |

### Monitor Mode（MO 系列，2026-06-14 加 — 完整在 `docs/proposal/monitor-mode.md`）

**定位**：與 Explore Mode 並存的第二種 UX，從頂部 toggle 切入，底部拉起浮動面板：
左 News Feed / 右 Indicators+Live / 底部 Timeline Dock 三區。Phase 1 主吃既有
`news_events` 管線 + 新一支 pre-aggregate RPC。Phase 2+ 接國防/能源/地震/匯率等
通用信號表。

| ID | 優先級 | 項目 | 狀態 | 備註 / 估時 |
|---|---|---|---|---|
| MO-1 | P1 | **Monitor Mode 前端整體（Phase 1）** | **done** | 2026-06-16 上線（PR #18）：右上 Monitor button + 底部上拉 + Wall mode + TimelineDock + IntelCard column + IndicatorPanel |
| MO-2 | P1 | **Monitor 後端 pre-aggregate RPC** | **done** | 既有 `get_news_trending` + `get_source_health` 已足；新聞 hourly breakdown 在前端用 events array bucket（資料量小不需 pre-agg）|
| MO-3 | P2 | 信號接入 — 共機擾台 | **done** | 2026-06-17 上線：data-collectors `pla_activity_daily` + gis-platform migration 205 + `get_pla_activity_latest()` RPC（migration 210）+ 前端 SituationCards PlaCard。30 min cron |
| MO-4 | P2 | 信號接入 — 電網備轉容量 | open | 台電 Open Data，⭐⭐⭐。已進壓力指數 power signal，獨立 widget 待做 |
| MO-5 | P2 | 信號接入 — 地震即時 | **partial** | earthquake_events 已進壓力指數 signal；獨立 monitor widget 計入 AI-1 警訊整合的「地震卡」 |
| MO-6 | P3 | 信號接入 — 加權指數 / 匯率 | **done (TWSE)** | 2026-06-17 上線：TWSE 加權指數 ticker（collector twse_market_index + migration 204 + `get_market_index_now()` RPC）。匯率仍 open |
| MO-7 | P3 | 信號接入 — Cofacts 假訊息 | open | TimelineDock 「Phase 2 多軌」預留位有提到 |
| MO-8 | P3 | 信號接入 — Cloudflare Radar 連通性 | open | ⭐ |
| MO-9 | P3 | 信號接入 — 疾管署公衛週報 | **done** | 2026-06-17 上線：collector cdc_public_health_weekly + migration 206 + `get_public_health_weekly()` RPC（migration 210）+ 前端 DiseaseCard ×3。週四 11:00 跑 |
| MO-10 | P3 | 通用信號表 + Phase 2 schema 設計 | **done** | migration 207 `realtime.signals_hourly` + `pressure_index_now` + `compute_pressure_index('disaster')` cron 5min |
| MO-11 | P3 | 新聞直播嵌入 (iframe widget) | **done** | 2026-06-17 上線 LiveWall 4 格 + 14 家頻道下拉 + B1 yt_live_video_resolver collector + migration 209 + `get_yt_live_videos()` RPC。embed/<videoId> 路徑。9/13 家當下可播 |
| MO-12 | P3 | Realtime push 升級（Phase 3）| open | polling 30s → Supabase Realtime channel。仍待 |

### Monitor Mode Phase 2+ 衍生待辦（2026-06-17 加）

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| MO-13 | P2 | 補 3 家 YT live handle | open | 鏡新聞 @MnewsTw / 非凡 @ustvnews 目前 /live 404；中天移除。找到正確 @handle 後改 `data-collectors/collectors/yt_live_video_resolver.py` HANDLES + `LiveWall.tsx` LIVE_CHANNELS |
| MO-14 | P3 | TWSE turnover 格式漂亮化 | open | migration 210 RPC 目前回「12215293 千」，應顯示「1.22 兆」。改 `get_market_index_now()` 的 turnover CASE |
| MO-15 | P3 | LiveWall 被擋頻道 fallback | open | 部分台後台可能關 embed（TVBS / 三立 / 東森常見），iframe 仍會跳「無法播放」。candidates：(a) 拿掉、(b) 改「另開分頁觀看」占位卡片 |
| MO-16 | P3 | 加權指數 turnover 修 + 匯率接入 | open | TWSE 已上、匯率（央行）未接 |

### AI 警訊整合（AI 系列，2026-06-17 加 — 規劃完整在 `docs/proposal/alerts-integration-impl.md`）

**定位**：把 NCDR 災害示警（5 群組）+ CWA 地震整合進 IntelPanel + Monitor。設計師 v2 已交稿，5 個新元件（AlertSummaryBar / FeedTabs / AlertCard / AlertBoard / AlertsTrack）+ migration 211（3 RPC）+ alertsLoader.ts。**handoff doc 自帶 task list、設計 URL、Verification walkthrough — 另一 session 接手即用**。

| ID | 優先級 | 項目 | 狀態 | 備註 / 估時 |
|---|---|---|---|---|
| AI-1 | P1 | **警訊整合 Phase 1（NCDR + 地震）** | open | impl doc 12 顆 task：migration 211 + tokens + loader + 5 元件 + 4 檔接線 + browser walkthrough。**估 4-5 hr** |
| AI-2 | P2 | 地圖警報點 visual 重整（B2 方案）| open | alert 圓點 +60% size + 白邊 2.5px + active pulse 動畫，避免跟新聞圓點混淆。`useDisasterAlertLayer.ts` paint 微調 + earthquakes layer 對齊 |
| AI-3 | P3 | 警報統計接 pressure index signal | open | 已有 signals_hourly framework，加 alert_count + alert_severe signal |

### 規劃文件總覽（2026-06-17 更新）

| 文件 | 對應 backlog | 狀態 |
|---|---|---|
| `docs/proposal/satellite-console.md` | SAT-1~7 | Phase 0 衛星圖層已上線，Phase A-D 規劃完成待動工 |
| `docs/proposal/monitor-mode.md` | MO-1~12 | Phase 1 + Phase 2 大半已上線（PR #18） |
| `docs/proposal/monitor-mode-phase2-handoff.md` | MO-3/6/9/11 | 3 個 collector + LiveWall 全部上線 ✅ |
| `docs/proposal/alerts-integration-handoff.md` | AI-1 | 設計需求說明，設計師已交 v2 ✅ |
| `docs/proposal/alerts-integration-impl.md` | AI-1 | 完整實作交接，待另一 session 接手 |
| `docs/energy-v2-plan.md` | E-A~E-F | Energy v2 6 大塊完整規劃（2026-06-19 PR #24） |

### 能源 ENERGY v2（E 系列，2026-06-19 加 — 完整在 `docs/energy-v2-plan.md`）

> v1.0~v1.3.5 已 merged（PR #23 + #10）：4 layer 上線（電廠 / 機組即時出力 / 變電所 / 充電站）+ popup + 24h sparkline + timeline scrub + sliders + retired 標記。下波 6 大塊：

| ID | 優先級 | 項目 | 狀態 | Blocker / 備註 |
|---|---|---|---|---|
| E-A | **P1** | Monitor 整合 — HUD 燈號 + 4 區 bars + 14 廠 sparkline 都搬 monitor PowerCard | **done** | 2026-06-19 feat/energy-v2-A commits d6a2db3 + 24026c4。PowerCard 三層（燈號頂卡 / KPI strip + 4 區 mini-bars / 14 廠 grid）+ MonitorPanel 5min/10min dual poll + powerCardData 純函式抽離 + 13 unit test。timeline isolation contract test：buildPowerCardModel 不收 time 參數 |
| E-B | **P1** | HAZARD 群組：閃電 + 核安輻射 | **done** | 2026-06-19 feat/energy-v2-A commits 857871b + b7d6154。lightning + nuclear 兩 loader + Legend + featureInfo Panel + useTransportParams + overlayRegistry + useHazardLayer + App.tsx + GIS_LAYERS + 17 unit test。NuclearStationPanel is_stale 警告塊（背景灰）+ alarm 警示塊（背景紅）。**cluster 暫不接**（v1 用 5~360min slider 控 payload）→ E-G |
| E-G | P2 | 落雷 cluster + zoom-gate（雷雨季升級項） | open | E-B v1 用「時間窗 slider 預設 60min」控 payload 量；雷雨季 1h 上萬筆時走 mapbox cluster。需先擴 OverlayConfig schema 加 `cluster?: { maxZoom: number; radius: number }` 欄、然後 overlayManager 建 source 時帶過去。實測卡再升 |
| E-C | P2 | 高壓電網 — osm_power_lines 2,305 + osm_power_towers 26,589 | open | 用戶「之前盤點漏的最重要」。voltage 345/161/69 kV 分色（含 ";" 雙迴路格式）。tower 走 minzoom 13。把電網 spine 接起來後可疊 §5.2 cascade flowline |
| E-D | P2 | OSM 風光電 + offshore polygon + 離島海纜 + 化石/地熱 | open | 8 表：osm_wind_turbines 812 / osm_solar_farms 734 / osm_power_plants 513 / offshore_wind_zones 36 polygon / island_power_grid 14 + 海纜 / fossil_fuel 9 (3D cylinder 油槽) / geothermal_wells 36 (3D cone 倒置) / renewable_permits_taipei 438 |
| E-E | P3 | 加油站 3 表 + power_poles 2.96M PMTiles | open | osm_gas_stations 2,212 主用、gov 對照（不可 UNION HANDOFF §⑧#3）、osm_charging 306 補社區。power_poles 1.4GB raw 走 tippecanoe |
| E-F | P3 | KPI 統計面板 — 縣市風光生質 + 光電月趨勢 | open | analytics.solar_daily_generation 3,992 + county_wind 211 + county_biomass 188 + county_small_hydro 188 + geothermal_potential 27。non-spatial chart |

**已存在的 RPC 不要重做**（PR #10 內）：
- Monitor 用：get_power_dashboard / get_power_generation_24h / get_power_plant_output_24h
- Map layer 用：get_power_plants_with_output / get_power_generation_at / get_osm_substations / get_ev_charging_stations
- Hazard 用：get_lightning_recent / get_nuclear_radiation_status

### 加油站 / EV 30km 路網覆蓋（CV 系列，2026-06-22 加）

> A 版（motorway-tertiary 全台）已上線 commits 702e382 → 8b0faf2 → 3376314 → afbf15d。
> B 版（+ unclassified / residential 深山部落道路）兩次失敗 — 留下路線給未來。

| ID | 優先級 | 項目 | 狀態 | Blocker / 備註 |
|---|---|---|---|---|
| CV-1 | **done** | A 版上線（motorway-tertiary 全台）| done | 2026-06-21 commit afbf15d。5 layer PMTiles（CPC/FPCC/台糖/all_gas/ev）各 ~5 MB。osmnx graph_from_bbox + custom_filter 5 類 → multi-source dijkstra → tippecanoe。雲林 POC commit 8b0faf2 + 3376314 已 swap 為全台 |
| CV-2 | P2 | B 版加密 — 加 unclassified（鎮內次要街道 + 深山部落道路）| **blocked** | 兩次失敗：①Overpass 全台 bbox + unclassified 切 32 subquery 卡死 8h（kumi.systems mirror）②pyrosm 讀 309MB PBF 吃 50GB RAM + 磁碟 5GB free 觸發 swap thrash。等磁碟 ≥ 50 GB free 再試 |
| CV-3 | P3 | B 版加密 — 用 osmium 預過濾 PBF（救援路徑）| open | `brew install osmium-tool` ✅ 已裝（2026-06-22）→ `osmium tags-filter w/highway=motorway,trunk,primary,secondary,tertiary,unclassified taiwan-latest.osm.pbf -o filtered.pbf` 得 ~60-80 MB 小檔 → pyrosm 讀。仍需 ~10 GB RAM。磁碟 free 已升至 25 GB 但建議再清到 50 GB+ 再跑 |
| CV-7 | **done** | multi-bucket + whitelist 修正（雙品牌 + false positive）| done | 2026-06-22 commit 7f8f005。台糖 13→86 站（+73 雙品牌，覆蓋率 50%→59%）/ 其他 665→292 站（whitelist 過 374 false positive）/ 全加油站 3,010→2,612。鐵則寫入 SKILL §⚠️ |
| CV-8 | P3 | 第 6 個 layer「私營 最近距離」(`gasCoverageOther`)| open | `taiwan_other_nearest.pmtiles` 已備（292 站 whitelist），但前端尚未接 toggle。仿 5 既有 layer pattern，加 1 個 sourceUrl + 1 個 paint + 1 個 panel + LegendPanel +1。預估 30 min |
| CV-9 | **done** | accessibility-analysis SKILL 落地 | done | 2026-06-22 commits 02a6bd8 + 17c148b + df3f72a。`.claude/skills/accessibility-analysis/` 含 SKILL.md（10 章 + 兩大鐵則 + troubleshooting 入口）+ scripts/pipeline-template.py + references/{pitfalls,mode-comparison,mirror-fallback,troubleshooting}.md。alias `service-coverage` 商業視角 |
| CV-4 | P3 | B 版加密 — 用 osrm-taiwan service grid sample（雲端跑）| open | 既有 osrm-proxy-gis.zeabur.app + OSRM_TOKEN 雲端跑 /table → 不吃本機 RAM。但 OSRM 無原生 isochrone，要 grid sample + concave_hull（雲林 POC pattern）。5,000 站 × ~5 batch call = 1.5h on zeabur free tier |
| CV-5 | P3 | C 版超密集 — + residential（巷弄全染）| open | 視覺像救援等時圈。edges 估 80 萬-100 萬，PMTiles ~300-500 MB / 檔。極不建議用本機跑，須 CI / cloud worker。視覺 ROI 對加油站分析有限（加油站不會藏巷弄裡）|
| CV-6 | P3 | Pipeline 自動化 — 月更 PBF + 跑 dijkstra + 上 S3 | open | 仿 osrm-taiwan 月更 PBF 模式。CI 跑 + 結果 push S3 deploy-assets。可順帶解決 CV-2/3/5 的本機 RAM/磁碟限制 |

**關鍵檔案位置（給未來 session 接手用）**：
- A 版 script：`taipei-gis-analytics/scripts/road_isochrone/taiwan_nearest_distance.py`（osmnx + Overpass，A 版用 custom_filter motorway-tertiary）
- B 版 PBF script（失敗版）：`taipei-gis-analytics/scripts/road_isochrone/taiwan_pbf_pipeline.py`（pyrosm + 本機 PBF，吃爆 RAM）
- 309MB PBF：`taipei-gis-analytics/data/raw/osm/taiwan-latest.osm.pbf`（Geofabrik，2026-06-22 抓）
- 雲林 POC script：`taipei-gis-analytics/scripts/road_isochrone/yunlin_nearest_distance.py`（osmnx + Overpass，~2 min 成功）
- 線上 PMTiles：`mini-taiwan-pulse/public/coverage/taiwan_{cpc,fpcc,taisugar,all_gas,ev}_nearest.pmtiles`
- 前端接線：`overlayRegistry.ts` `gasCoverageOverlay()` helper（PMTiles + 5 級色階）+ `LegendPanel CoverageLegend`
- OSRM 環境：`taipei-gis-analytics/.env` `OSRM_TOKEN` + `OSRM_UPSTREAM`；public domain `https://osrm-proxy-gis.zeabur.app`

**A 版限制與已知 trade-off**：
- ✅ 涵蓋 motorway / trunk（橫貫公路 台 7/8/9/14/18/20/21）/ primary / secondary / tertiary
- ❌ 缺 unclassified（深山部落最後一哩，如司馬庫斯 / 那瑪夏內里 / 霧台原鄉道路）
- ❌ 缺 residential（市區巷弄）
- ❌ 缺 service / track（產業道路、林道、登山口前山徑）
- 實務影響：加油站本身就分布在主要道路上，「最近加油站」分析誤差小；但「視覺覆蓋密度」會比 fire/medical isochrone（路網全染）稀疏

### 房地產 REAL ESTATE（RE 系列，2026-06-25 加 — 點圖層 CustomLayer + 資料補抓 + city 修正）

> 點圖層改 WebGL CustomLayer + GPU fade（PR #32 已 merge master）；同步補抓缺口資料 + 修 city 分類。
> 前端時間軸 = **交易/訂約日期**（trade_ts），範圍寫死 RANGE_START 2024-07-01 ~ RANGE_END 2026-03-31（2024Q3~2026Q1）。
> 資料管線 runbook：`taipei-gis-analytics/docs/systems/real_estate_sync_runbook.md`；打包 buffer：`scripts/pack_real_estate_points_buffer.py`。

| ID | 優先級 | 項目 | 狀態 | Blocker / 備註 |
|---|---|---|---|---|
| RE-1 | — | 點圖層改 WebGL CustomLayer + GPU fade | **done** | 2026-06-24 PR #32（master `b4bb90c`）。每幀對 365k 點重設 circle-opacity → GPU uCursorTs uniform。fade 窗調俐落（週 2+3 / 月 6+10 天）。點 hover/click 暫放棄 → RE-3 |
| RE-2 | — | 補抓租賃+預售 2025-09/10 缺口 | **done** | 2026-06-25。下載官方 114S3/S4 季 zip（`DownloadSeason?season=114S3`）→ convert mirror → 離線 geocode（L1 cache 97%）→ 02b → 06 → build → S3。租賃 0→13,290/12,431、預售 0→2,164/2,993。ALL_points 365k→423,404 |
| RE-3 | P2 | 點 hover/click picking 待補 | open | CustomLayer 無 `queryRenderedFeatures`。需自建 GPU/空間索引 picking（或保留隱形 PMTiles 點層供 query）。grid hover 不受影響仍正常 |
| RE-4 | P2 | TGOS 934 筆批次離線補座標 | open | 離線 geocode 解不到的 1.6%（262 地號 + 672 地址）。批次檔已備 `taipei-gis-analytics/data/intermediate/tgos/real_estate/tgos_batch_rental_gap_2025Q3Q4.csv`（cp950, 5 欄）。用戶離線跑 TGOS → 拿 `Address_Finish*.csv` 放 `results/` → `_build_geocode_cache.py` → 重跑 02b/06/07/09/build。262 地號 TGOS 地址定位可能解不到，走 NLSC 地段地號 |
| RE-5 | P2 | 補 115S1 季回填 2026 年初 + 收登記延遲尾巴 | open | 2026-02（458）/2026-03（5）幾乎空 = 近月登記延遲，下載 115S1 季可回填。⚠️ 若要顯示 2026Q2 以後，需同步延伸前端 `realEstateTime.ts` 的 `RANGE_END`/`RE_PERIODS`/`Q_START_TS` 三處（buffer epoch 仍是 RANGE_START 不動） |
| RE-6 | P3 | 2024 上半邊界偏少補齊 | open | 2024-07~10 偏少是**資料邊界**（缺 113 年更早季檔，那些交易早就登記在我們沒下載的季）。非市況。需更早季檔才補得齊，ROI 低 |

**資料品質結論（2026-06-25 盤查，已查證）**：
- ✅ 2025-04~09 **買賣**量縮（2025-06 谷底 2,296）是**真實市況**：央行 2024-09 第七波信用管制，2025 全年買賣移轉年減 23~25%、創 1991 來最大跌幅（六都八年新低）。只買賣崩、租賃高檔 = 打房貸特徵。**非資料問題，不需處理**。
- ⚠️ city="?" 36,354(8.8%)→77(0.02%)：根因地號地址無縣市前綴，06_merge 只解地址 → 改**優先用 MOI 來源權威 `city` 欄位**（避 district 名稱歧義如信義/東/中正區）。96% 來自單一檔 sale_moi_B5_B6_extended。analytics commit `a5f98c7`（本地 master 未 push，依慣例）。
- ⚠️ "?" 點有少量段-中心疊點（地號無門牌 geocode 落地段中心，最多 196 點疊一處，但 83% 唯一座標），屬地號精度正常現象。
