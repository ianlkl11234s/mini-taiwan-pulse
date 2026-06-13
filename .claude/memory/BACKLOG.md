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
