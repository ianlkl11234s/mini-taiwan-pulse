# Glossary

## 水資源

| 術語 | 說明 |
|---|---|
| 蓄水率 (storage_ratio_pct) | `effective_storage_wan_m3 / current_capacity_wan × 100`，用現行有效容量當分母（扣淤積） |
| 設計有效容量 (effective_capacity_wan) | 水庫完工時的設計容量，萬 m³；隨時間被淤積吃掉 |
| 現行有效容量 (current_capacity_wan) | 最新施測的實際可蓄容量，WRA 官網蓄水率分母 |
| 淤積率 (silt_ratio_pct) | `1 - current_capacity / effective_capacity`；霧社 81%、曾文 27%、翡翠 3% |
| alert_level | 由 view 依蓄水率分級：`critical <15%` / `warning <30%` / `normal` / `high >90%`（滿水）|
| cms | cubic meters per second，流量單位（進/出流） |
| basin | 流域（河川集水總區） |
| watershed | 集水區（某水庫上游的水匯集範圍） |
| reservoir_id vs compare_id | reservoir_id 是 WRA 原始字串 id（40 座都是數字字串）；compare_id 是 reference 表的 int，由 `compareIdFromReservoirId` 互轉 |

## 水利署 IoT 平台（iot.wra.gov.tw）

| 術語 | 說明 |
|---|---|
| `iow_station_id` | iot.wra 給的 UUID；vs 舊版 opendata.wra 的 text station_id 互不認識（同一口井兩邊編號完全不同）|
| `physical_quantity_id` | 測項 UUID；同一站可掛多個（watergate 平均 3.83 PQ：開度% + 內水位 + 外水位 + 絕對開度）|
| station_type 7 類 | river / groundwater / cumulativeflow / watergate / damstructure / erosiondepth / dustemission |
| timeline 字串編碼 | `"epoch,val;epoch,val;..."` 每小時 1 timepoint，仿 freeway pattern；避 PostgREST 20K cap（migration 063）|
| 互補 vs 重複（collector）| 100m 內配對 > 90% = 重複 / < 30% = 互補。座標驗證，不信編號。實例：iot groundwater 95% / iot river 16% |

## WRA (經濟部水利署) Dataset

| # | 名稱 | 用途 |
|---|---|---|
| 25776 | 水庫堰壩位置圖 SHP | 權威座標 98 筆 |
| 32726 | 水庫基本資料 JSON | 壩高/容量/鄉鎮（年更新）|
| 45501 | 水庫水情 JSON | 水位/蓄水率（每小時）|
| 41568 | 水庫每日營運 JSON | 日統計（每日 09:30） |
| 129474 | 水庫集水區 SHP | 80 筆集水區 polygon |
| 32727 | 水庫淤積量 | 年度施測（目前只有北區 15 筆） |
| 13795 | 水庫蓄水範圍 SHP | 129 筆蓄水 polygon |
| 36695 | 枯旱預警燈號 | 旱情分布（Phase 3 候選）|
| 36696 | 水權統計 | **非空間**表格，業別用水量時序（data.gov.tw）|
| 58343 | 洩洪訊息 | Phase 3 候選 |
| 129475 / 129476 | 集水區敏感區內/外 | 環境管制圖層 |

## Supabase / Postgres

| 術語 | 說明 |
|---|---|
| Supabase pooler | 連線池，強制 2min statement_timeout，RPC 超過會被殺 |
| PostgREST `db-max-rows` | 對外 REST gateway 硬上限 20000 rows，超過切掉（HTTP 206 + content-range header），無錯誤訊息；2026-04-25 兩次踩到 |
| DISTINCT ON hourly 降頻 | 每站每小時最新 1 筆的 pattern（`DISTINCT ON (station_id, date_trunc('hour', observed_at))`）避 20K cap，實例 migration 060 / 060b |
| pg_cron | 排程執行 SQL 的 extension，繞過 pooler timeout 做 pre-aggregate |
| Pre-aggregate pattern | 普通 table + per-day refresh function + pg_cron + 薄 RPC |
| RPC | `public.get_xxx()` function，前端 `supabase.rpc('get_xxx')` 呼叫 |
| STABLE function | 同一交易內結果不變，可被 planner 快取；時序 RPC 一律用 STABLE |
| anon / authenticated role | Supabase 前端角色；RPC 要 `GRANT EXECUTE ON FUNCTION ... TO anon, authenticated` |
| RLS | Row-Level Security，realtime 表一律開啟 + 公開可讀 policy |

## PostGIS

| 術語 | 說明 |
|---|---|
| GIST 索引 | 空間索引，ST_Intersects / ST_Within 類查詢必裝 |
| ST_Intersection | 幾何相交切片；Simplify 放之後可提速 10-20x（2026-04-22 教訓）|
| ST_SimplifyPreserveTopology | 簡化幾何保留拓撲；tolerance 建議 0.0005（~50m）|
| MultiLineString outlier | river_lines 有 2,445 km 的奇異聚合 feature，KNN nearest 會全台亮 |
| EPSG:4326 | WGS84 經緯度，資料庫內部儲存格式 |

## Mapbox GL

| 術語 | 說明 |
|---|---|
| Custom Layer | Mapbox 自訂 WebGL layer，可跑 Three.js / 其他 render code |
| `styleReady(map)` | 本專案自訂 type predicate，setStyle mid-swap 期間 `map.getStyle()` 會 throw，用 try/catch 包起來避免炸 React effect（App.tsx 內）|
| `delta_since_day_start` | 跨站可比指標，當前讀值 − 當日最早讀值；監測站視覺著色/半徑一律用這個，不用絕對值（2026-04-25 river/groundwater 共用 pattern）|
| `map.once('load')` | ⚠ load event 可能 fire 過 → 永不觸發。改用 polling |
| `map.isStyleLoaded()` | 當下 style 是否 ready，可能 true → false → true 跳動 |
| `triggerRepaint()` | 要求 Mapbox 下一幀重畫；只在資料變動時調用，不要在 render() 內 |
| `setPaintProperty` | 動態改 layer paint；不觸發 source re-tessellate，比 setData 快 |
| `queryRenderedFeatures(bbox, {layers})` | 點擊 pick 用，只查已渲染的 features |

## Three.js

| 術語 | 說明 |
|---|---|
| InstancedMesh | 同一 geometry × N 個 instance，單次 draw call，適合水庫 40 座、飛機 3000 架 |
| instanceColor attribute | InstancedMesh 每個 instance 自訂顏色 |
| MercatorCoordinate | Mapbox 0~1 世界座標系，不隨 zoom 變動 |
| `metersPerUnit(lat)` | 緯度換算 meter → Mercator unit 的比例 |
| mercPerMeter | 從 shellHeightMercator / H_SHELL_METERS 反推的比例 |

## 專案術語

| 術語 | 說明 |
|---|---|
| timeStore | `src/state/timeStore.ts` 的 external time store，動態圖層時間訂閱都走這個 |
| loadingRegistry | `src/lib/loadingRegistry.ts` 管理所有 loading 顯示；禁止靜默 fetch |
| 扁平檔名契約 | `public/*.geojson` 檔名直接部署到 S3 根；不要加 subdir |
| BL-N | Backlog 水資源相關項目編號（BL-1 堤防、BL-2 保護區...）|
| active reservoir | 使用者點擊的那座水庫，驅動 context 疊層 + 進/出流雙柱 |
| 雙排日柱 | BL-5 視覺：active reservoir 兩翼浮空的 N 日進/出流柱陣 |
| fast path | ReservoirScene.setStatuses 內的優化路徑：站點組不變只更新水位/顏色 |

## 關聯專案

| 專案 | 路徑 | 用途 |
|---|---|---|
| gis-platform | `../gis-platform` | Supabase migrations |
| data-collectors | `../data-collectors` | 資料收集（CWA / WRA / TDX / OpenSky）|
| pulse-api | `../pulse-api` | FastAPI + DuckDB 備援 |
| mini-taipei-v3 | `../mini-taipei-v3` | 鐵道時刻表來源 |
| taipei-gis-analytics | `../taipei-gis-analytics` | H3 人口/經濟 cube 產生器 |
| plan-art | `../plan-art` | Flight Arc，記憶框架來源 |

## 時區換算

- **TW = UTC+8**
- TW 某日 00:00 = UTC 前一日 16:00
- `timeStore.getDateKey()` 回傳 Asia/Taipei 日期字串（`YYYY-MM-DD`）
- Supabase `AT TIME ZONE 'Asia/Taipei'` 用於 RPC 內部切日邊界

## 記憶系統

| 術語 | 說明 |
|---|---|
| Atomic commit | 一檔一 commit，訊息 prefix `memory:` |
| Session SOP | 開頭讀 STATUS/BACKLOG/PRINCIPLES；結束用 `/wrap-up` |
| Pitfall archive | `.claude/pitfalls/` 的 long-form 紀錄，`INCIDENTS` 放短摘要 + link |
| 9 檔分類 | README / STATUS / BACKLOG / PRINCIPLES / PLAYBOOKS / GLOSSARY / INCIDENTS / REFLECTIONS / DATA_SCOPE |

## OSRM / Map-matching（2026-05-09 加）

| 術語 | 說明 |
|---|---|
| OSRM (Open Source Routing Machine) | 開源路徑引擎，吃 OSM 路網，提供 `/route`、`/nearest`、`/match` 三種 endpoint |
| HMM Map-matching | 把雜訊 GPS 序列 snap 到真實道路的 Hidden Markov Model 演算法（Newson & Krumm 2009）。OSRM `/match` 內部用 |
| PBF (Protocolbuffer Binary Format) | OSM 二進位格式，Geofabrik 提供國家／區域分檔（taiwan-latest.osm.pbf ~200MB，月更）|
| osrm-extract / partition / customize | OSRM 預處理三步：parse PBF → 建層級分區 → 套 cost model（`car.lua`），共約 25-30 min CPU（Tokyo amd64 機器只要 6 分鐘）|
| osrm-routed | OSRM 的 HTTP server，啟動參數 `--algorithm mld --port <p> /data/<name>.osrm` |
| confidence (OSRM /match) | 0-1 區間，HMM 對 match 結果的信心。垃圾車設 < 0.35 視為 NoMatch（保守 threshold）|
| matched polyline | OSRM `/match` 回的真實道路路徑（GeoJSON LineString），跟 progress timeline 配對給前端 |
| `realtime.waste_match_attempts` | OSRM 嘗試紀錄表（migration 075）：避免 NoMatch trip 反覆 retry。`success` + `reason` 欄位 |
| stop-to-stop /route（候選方案）| 用 stop snapping 還原 stop sequence → 對相鄰 stop 對呼叫 `/route` 拿真實道路最短路徑 → 拼接。對 stationary GPS 比 HMM 強，預期 success > 90%。要 stop_sequence 欄位（目前 schema 缺）|

## Zeabur 部署（2026-05-09 加）

| 術語 | 說明 |
|---|---|
| PREBUILT_V2 | Zeabur 對 Docker / GitHub source 部署 service 的內部 type，K8s service port 預設硬性 8080（不看 EXPOSE / PORT env）|
| Internal hostname | 同 Zeabur project 內 service 互通用 `<service-name>.zeabur.internal:<port>` 或 `service-<service-id>:<port>`。**跨 project 不通** |
| Bearer token gateway | nginx:alpine + envsubst template + token check pattern，包在 underlying service 前面解跨 project 通訊（PB-12）|
| osrm-proxy | 本專案 Bearer token gateway service（[ianlkl11234s/osrm-proxy](https://github.com/ianlkl11234s/osrm-proxy)），public domain `osrm-proxy-gis.zeabur.app` |
| osrm-taiwan | 本專案 OSRM Taiwan service（[ianlkl11234s/osrm-taiwan](https://github.com/ianlkl11234s/osrm-taiwan)），internal-only |
| Service network 指令 | `npx zeabur@latest service network --id <id>` 看 K8s service 預期的 web (HTTP) port — 部署有 502 時必查 |

## 垃圾車 Schedule 動畫（2026-05-10 加）

時刻表動畫（`WasteScheduleScene`）跟 GPS 實際軌跡（`WasteTruckScene`）並存的兩套圖層用語。

| 術語 | 說明 |
|---|---|
| Schedule layer (琥珀 #fbbf24) | 從 `spatial.waste_collection_stops` 表定 arrival/departure 跑的動畫，跟 GPS 圖層風格一致（共用色 + 音符），但獨立 toggle 並存。音符獨立 sub-toggle (`wasteScheduleNote`) 可單獨關。光點/音符 slider 共用 wasteOrbScale/wasteNoteSize/wasteNoteZOffset 三 paramRefs |
| dow (day-of-week) | JS Date.getDay() 規則 0=Sun..6=Sat。useWasteScheduleLayer 用 timeStore.subscribeDate 取當日 dow，cache 8 entries |
| dwell | stop 內停留時間 = departure - arrival，新北常為 0（fallback = arrival），高雄常為幾分鐘 |
| gap | 相鄰 stops 時間 = next.arrival - current.departure。0 表示 source 沒記移動時間（瞬移）|
| trip-break | 同一 route 內早班 / 中班 / 晚班間隔時段（gap > TRIP_BREAK_S 視為班次切換，整段 invisible）|
| `TRIP_BREAK_S = 1500` | 25 分鐘以上才算班次切換。各區 stop gap 差 10x（板橋 60s vs 林口 600s），threshold 600s 對林口太緊把正常 movement 全砍 |
| `DWELL_THRESHOLD_S = 120` | dwell < 2min 視為「過站不停」整段 arrival → arrival 持續移動；≥ 2min 才真停留 |
| `FADE_DURATION_S = 180` | trip-break 兩端 / 路線首末 fade in/out 視窗，60x 倍速下 = 3 視覺秒 |
| `MIN_MOVE_S = 60` | 最低移動秒數，gap=0 從 dwell 借時間給 movement，避免瞬移 |
| `ACTIVE_ALPHA = 1.0` | 執勤中 alpha + size 都不切換，避免 60x 下高頻變化刺激眼睛 |
| 60x 倍速 | 用戶主要觀看模式：1 真實秒 = 60 模擬秒。短 gap 1min = 1 視覺秒，視覺速度設計圍繞此 |
| Grouped JSONB RPC | `get_waste_schedule_day` 返回 per-route 一筆 row，stops 為 JSONB array。避 PostgREST 20K cap（39K stops → 1281 routes）|
| stops-as-polyline (v1) | stops 直線連接當路徑（沒 OSRM 整合前的 v1 方案），會穿牆、視覺速度過快 |
| Catmull-Rom 不適用 | 對非真實連續軌跡會 overshoot 反向 → schedule 改純直線（GPS 仍用 spline）|

## 農業（2026-05-23 加）

7 個 agriculture layer + 鐵則 4 條相關術語。

| 術語 | 說明 |
|---|---|
| PMTiles | Cloud-Optimized 向量瓦片格式，走 HTTP Range Request 只載 viewport 內的 tile（不像 GeoJSON 一次全載）。mini-taiwan-pulse 用 `mapbox-pmtiles` 套件透過 `Style.setSourceType('pmtile-source', PmTilesSource)` 註冊一次性 SourceType |
| tippecanoe `-y <attr>` | 產 PMTiles 時 **只保留指定 attribute**（預設全丟），這是「前端 click popup 拿到空白」最常見原因。改 `06_export_frontend.py` 的 `keep_attrs` 必須重出 + 手動 cp 到 mini-taiwan-pulse |
| FTW Fields | Fields of The World，Sentinel-2 衛星 AI 辨識田區資料集。Taiwan 2025 版 38.6 萬田區，confidence_mean ≥ 0.5。https://fieldsofthe.world/ |
| crop_layer_id | 132 種作物適栽圖 (7294 dataset) 的 frontend filter key（0-131）。前端 dropdown 從 `src/data/cropSuitabilityCrops.ts` 取對照表 |
| kind / kind_label | 作物適栽 4 級：1_premium / 2_suitable / 3_marginal / 4_unsuitable。配色（深綠 → 中綠 → 淡黃 → 淡紅）跟 LegendPanel CROP_KIND_ITEMS 與 factory CROP_KIND_COLOR_EXPR 同源 |
| pH (H2O) | 土壤酸鹼度。< 5.5 強酸（多數作物受害）/ 5.5-7.5 中性適宜 / > 8.5 強鹼。最普適的單一肥力指標 |
| OM (有機質, %) | 土壤健康整體指標。< 1.5% 低需補堆肥 / 1.5-3% 中 / > 3% 高 / > 5% 罕見豐沃 |
| CEC (cmol(+)/kg) | 陽離子交換量 = 土壤「保肥能力」(像水桶大小)。< 5 沙質 / 5-15 中 / > 15 黏質高保肥 |
| Mehlich-3 P/K | 直接可被作物吸收的磷/鉀量。P: < 15 缺 / 30-60 充足 / > 60 過量；K: < 60 缺 / 120-200 充足 |
| 健康度（health metric） | 土壤肥力綜合著色預設，用 pH + OM 兩項分 3 級。Rule: pH 5.5-7.5 且 OM > 2.5% = 良好（深綠）；極酸/鹼或 OM < 1.5% = 需改善（紅）；其他 = 一般（黃） |
| metric dropdown | 土壤肥力 layer 的著色 selector（6 個 metric：health / pH / OM / CEC / M3_P / M3_K）。Layer 多參數時用 dropdown 切「mode」而非並排多 slider 的 pattern 範例 |
| 0 = 未測 | soil_fertility CEC/M3_P/M3_K 在許多 grid 是 0，**不是真零**而是未量測。所有 metric paint expression 把 0 統一視為灰色「無資料」(`#616161`) |
| 圖層 UX 四鐵則 | docs/development-rules.md §4a：(1) 透明度 slider (2) 分類 ≥ 2 種必寫圖例 (3) 可選取物件必接 click popup (4) Select options ≥ 4 用 `<select>` dropdown |
| 單一資料源（layer types）| 把 layer 內配色/類別表抽到 `src/data/xxxTypes.ts`（如 `agriPOITypes.ts` / `agriSoilFertilityMetrics.ts`），讓 factory paint / FeatureInfoPanel / LegendPanel 三處共用，避免改一邊忘記另兩邊 |
| GIS_LAYERS first-hit-wins | useMapInteraction.ts 內 click 查找走過陣列順序，**第一個命中即返回**。把細節小範圍排前面（休農區 109 polygon）/ 大面積背景排後面（土壤分類 5.7 萬 polygon），避免被覆蓋 |

## 部署 / 上線

| 術語 | 說明 |
|---|---|
| cf-cache-status | Cloudflare 回應 header：HIT(邊緣快取命中)/MISS(回源)/DYNAMIC(未快取)。debug 靜態檔快取必看 |
| Exposed schemas | Supabase Data API（PostgREST）對外曝光的 schema 清單。不在清單的 schema 即使 anon 有 table grant 也打不到（PGRST106）。資安收斂靠縮這份清單，非撤 grant |
| deploy-assets 鏡像結構 | 目標：S3 `deploy-assets/<群組>/` ↔ 容器 `/data/<群組>/` ↔ nginx `/<群組>/` 三邊同名，pull 整夾 sync、加新大檔 0 改腳本（搬家計畫見 docs/launch/06，目前仍扁平 + include filter 過渡）|
| entrypoint 背景 pull | 容器啟動 `( pull )&` 背景同步 S3→/data + `exec nginx` 立即前景，避免大量 pull 阻塞健康檢查 |

## 衛星（2026-06-13 上線）

| 術語 | 說明 |
|---|---|
| TLE (Two-Line Element) | 衛星軌道根數標準格式，2 行 ASCII，內含 epoch / 傾角 / 偏心率 / 平均近點角等。Space-Track 每 2-6h 更新一次 |
| SGP4 | 標準 propagator 演算法，用 TLE 算指定時刻的衛星 ECI 位置。`satellite.js` 在瀏覽器跑 |
| NORAD ID | 衛星目錄編號（5 digit，如 Yaogan 12 = 37875）。固定不變 |
| COSPAR ID | 國際指定（如 `2011-066B`）：年份+第N次發射+載荷字母 |
| Space-Track | 美軍 18 SDS 雷達網的 TLE 官方來源（authenticated API）。gis-platform collector 每 2h 從這拉 |
| CelesTrak | Space-Track 的公開鏡像。⚠️ 對瀏覽器 fetch 回 403（CORS/UA），不可直連 |
| UCS Satellite Database | Union of Concerned Scientists 維護的衛星元資料庫（國家/用途/承包商/壽命）。半年更新 → 最新衛星 country_operator=null |
| sub-satellite point | 衛星正下方的地面點（星下點） |
| swath | 感測器的成像寬度（公里）。光學偵察 ~11-60km、SAR ~20-100km |
| elevation cone | 從地面點仰角 ≥ X° 能看到衛星的圓錐範圍。LEO 500km、≥10° 半徑 ~1,500km |
| SSO Sun-Synchronous Orbit | 太陽同步軌道（傾角 ~97°，每天同地方時通過）。多數光學偵察走這 |
| GEO Geostationary | 對地靜止軌道（36,000 km，週期 24h）。TJS 訊號情報衛星 |
| LEO / MEO | Low/Medium Earth Orbit（< 2000km / 2000-36000km）|
| 變軌類型 4 種 | ALTITUDE_CHANGE（drag compensation 最常見）/ PLANE_CHANGE（改傾角，最貴）/ SHAPE_CHANGE（離心率）/ NOMINAL（無顯著變化） |

### 衛星系列（與台灣關聯性）

| 系列 | 國 | 軌道 | tier | 對台灣意義 |
|---|---|---|---|---|
| Yaogan 遙感 | CN | LEO 500-1200km，光學/SAR/ELINT | **S 級即時偵察** | 每 ~10 min 過台灣 |
| Jilin-1 吉林 | CN | LEO ~500km，次米級光學（商業）| **S 級高解析** | 已證實即時拍美軍 |
| Gaofen 高分 | CN | LEO+GEO，次米光學/SAR | **S 級國家級** | 南海/台海首要監控 |
| TJS / TJSW | CN | GEO 36,000km | A 級 SIGINT / 早期預警 | 戰略支援 |
| Beidou 北斗 (BD-) | CN | MEO/GEO/IGSO | B 級 PNT | 不偵察但精確制導武器的眼睛 |
| FORMOSAT 福衛 | TW | SSO | — | 3×5 氣象、5 光學、7×6 GNSS-RO、8A 光學(2025) |
| TRITON 獵風者 | TW | LEO | — | 海洋風場 GNSS-R（2023-10） |

## 新聞事件（newsEvents）

| 術語 | 說明 |
|---|---|
| gis_relevance | LLM 評：地理影響程度 0-3。0=與地理無關（政治發言/娛樂/個人）/1=有地點但不影響當地（座談/聲明）/2=地方事件（一般事故/治安）/3=重大地方事件（火災/氣爆/群聚） |
| severity | LLM 評：傷亡或影響規模 0-3。0=無/1=個案/2=區域<100人/3=大規模>100人或死亡 |
| is_event | LLM 判：是否為發生於物理空間的「事件」。true=火災/事故/活動；false=聲明/發言/質詢/評論 |
| newsFilter level | 前端 4 級篩選：**critical**(gr=3, ev=true, sev≥2) / **important**(gr≥2, ev=true, 預設) / **local**(gr≥1) / **all**(全部) |
| max_severity / max_gis_relevance | clustered RPC v2 對 cluster 內事件取 MAX，給前端 critical-halo 判斷用 |
| critical halo | 白色背景光暈 layer，只對 gis_relevance=3 + severity≥2 cluster 亮起 |
| CRITICAL_FRESH_WINDOW | critical 事件 ripple 持續時間延長至 60min（既有 FRESH_WINDOW 15min 對一般事件） |

## CI/CD（2026-06-13）

| 術語 | 說明 |
|---|---|
| CLAUDE_CODE_OAUTH_TOKEN | `claude setup-token` 產出的 OAuth token，repo secret，讓 GitHub Actions 走 Claude 訂閱而非 API key |
| claude-review.yml | PR 開啟/更新時自動跑 Claude review，prompt 限制「只看 diff、無問題單行 LGTM」 |
| claude-mention.yml | issue / PR comment 內 `@claude` 觸發回應 |
| Workflow validation skip | Claude Code Action 安全機制：PR 修改 workflow 檔本身會跳過 review（防 prompt 注入），merge 後生效 |

## 能源 ENERGY（2026-06-19 加 — v1.0~v1.3.5）

| 術語 | 說明 |
|---|---|
| **HANDOFF** | `../taipei-gis-analytics/docs/topic-research/energy/MINI_TAIWAN_PULSE_HANDOFF.md`，能源主題交接文件。⚠️ 有 5 處與真實 schema 不對齊（unit_name 公式 / status 欄位名 / region 欄位名 / VIEW 數量 / size 分級門檻），已在 v1 修正 |
| **all_power_plants_v** | public schema VIEW，UNION ALL 11 source = 10,665 設施。含 36 個 MultiPolygon（offshore_wind_zones）→ 取座標一律 `ST_X(ST_Centroid(geom))` |
| **unit_prefix LIKE plant_core** | 機組對電廠 JOIN 規則。unit_name 真實格式 `{廠名core}{機型?}#{編號}` 例 `大潭CC#1`，先 `SPLIT_PART(unit_name, '#', 1)` + 拿掉 `(註X)` + 拿掉末尾 `CC|GT|IGCC|新` 得 unit_prefix，再 LIKE `regexp_replace(plant_name, '發電廠$', '') || '%'` |
| **蠟燭錐 / openEnded cylinder** | 3D beam 視覺：CylinderGeometry(radiusTop=440m, radiusBottom=1.85km, openEnded=true) — 頂尖底寬光錐感、無頂底圓盤（user zoom 進柱位置不會看到黑色蓋）|
| **hit-test source** | 透明 Mapbox circle source（opacity=0），跟 3D beam 同位置同變動。Three.js CustomLayer 不能被 queryRenderedFeatures 命中，靠這層接 click → PowerPlantPanel |
| **retired flag** | 213 RPC 加 `status='retired'` + `status_note`。核電廠 7 個（4 政府 + 3 OSM）視覺退色 `#7c6b3a` + popup 紅字停機日期 |
| **isStyleLoaded race** | mapbox `map.isStyleLoaded()` 在 toggle 瞬間 racily 回 false（即使 style 早 load 完）。**禁** `if (isStyleLoaded()) ... else map.on("style.load", ...)`，改 `try addLayer + catch → map.once("idle", retry)`。詳 `.claude/pitfalls/2026-04-22-mapbox-load-once-fired.md`（2026-04-22 水庫第一次、2026-06-18 energy beam 第二次）|
| **slim RPC** | 跟 fat RPC 對比。218 `get_power_generation_at(ts)` 只回有對應機組的 14 廠 ~3KB（vs 213 回 10,665 行 ~500KB）。timeline scrub 用 slim |
| **24h preload** | 219 `get_power_generation_24h()` 一次拉 14 廠 × 144 ts ~45 KB。前端 `cachedOnce 10min TTL` + `resolvePowerGenerationAt()` client binary search → scrub 零 round-trip |
| **frustumCulled=false** | InstancedMesh 預設 `true` 但 bounding sphere 從 unit geometry 算，14 instance 散佈全台會被誤判超出視錐 → 整個 mesh 不畫。所有獨立 3D layer 都要 `mesh.frustumCulled = false` |

## 可達性分析 ACCESSIBILITY（2026-06-22 加）

| 術語 | 說明 |
|---|---|
| **可達性分析 / accessibility-analysis** | 「離我最近的 X 多遠 / 多久 / 哪邊是 X 沙漠」這類分析的統稱。`.claude/skills/accessibility-analysis/SKILL.md` 為 SSOT |
| **服務覆蓋 / service-coverage** | 商業視角同義詞（補點策略 / 擴點選址 / 競爭者疊圖），對應同一個 SKILL |
| **Mode A — 路網染色** | 每條 OSM edge 染「到最近 source 的路網距離」5 級色階。沿路網細線、回答「最近 X 幾 km」。本案：加油站 30km coverage |
| **Mode B — Polygon 沿路網外殼** | per-station ego_graph / OSRM grid sample → concave_hull → polygon。回答「服務範圍是哪一片」。例：fire isochrone 救援等時圈 |
| **Mode C — Hex / Grid 格點** | 全台 H3 z8 hex 或 1km grid，每 cell 標 nearest 距離。回答「沙漠在哪 / 跨服務疊圖」。例：medical isochrone grid_accessibility |
| **5 級色階 band** | accessibility 圖層通用：0-5km 深綠 `#16A34A` / 5-10km 草綠 `#84CC16` / 10-20km 黃 `#F2D64B` / 20-30km 橙 `#F2A516` / >30km 紅 `#F23535` |
| **multi-bucket 歸屬** | 雙身分 POI（如「中油+台糖」站）SQL CASE 短路求值會吃掉，必須 Python list-of-buckets 才能進多 layer。SKILL §⚠️ 鐵則 #1 |
| **whitelist 過濾 vs NOT IN** | 「其他/私營」bucket 用 `PRIVATE_NAME_RE` 正向 regex 篩，不用 `NOT IN (大品牌)` 反向定義（會吸 41455 false positive）。SKILL §⚠️ 鐵則 #2 |
| **PMTiles 命名契約** | `{topic}_{bucket}_{metric}.pmtiles` 檔名 / `coverage_{bucket}` sourceLayer / `band` + `dist_m` properties |
| **osmnx subdivide** | osmnx 對大 bbox 自動切 sub-bbox 序列跑（預設 `max_query_area_size=2500 km²`，全台被切 32 個）。任一卡死全 process 卡，無 socket timeout |
| **Overpass mirror 池** | overpass-api.de（預設，IP ban 24-72h） / overpass.kumi.systems（大 subquery 不穩） / overpass.openstreetmap.fr（whitelist 403）。完整救援見 SKILL `mirror-fallback.md` |

## 警察 isochrone × overlap_count（2026-07-01 加）

| 術語 | 說明 |
|---|---|
| **overlap_count / 覆蓋重疊計數** | 「此處同時被幾個 station N 分鐘 isochrone 包含」的整數指標。GIS 標準做法：`unary_union(polygons.boundary)` → `polygonize` 切不重疊 fragments → 對每 fragment `representative_point` 用 STRtree 查有多少 polygon `covers` 它。用來視覺化「警力沙漠 vs 多重保護」等服務冗餘密度 |
| **dissolve by overlap_count** | polygonize 切出的 N 萬 fragments 太細碎 → 按 overlap_count 分組 `unary_union` 合成大片連續 MultiPolygon。實測 26,622 fragments → 73 features（乾淨階梯，PMTiles 從 14MB 降到 5.8MB）。**沒 dissolve = 同心圓錯覺**（每個 station hull 邊界都是 fragment 邊界） |
| **concave_hull / α-shape** | shapely 2.1+ `shapely.concave_hull(mp, ratio=0.5)`；ratio 越小越貼路網（0.3 太細碎、1.0=convex 鋸齒）。isochrone Mode B 標配，取代 `convex_hull`；後接 buffer 15% 平滑 + simplify radius×10% 控 polygon 點數 |
| **polygonize** | `shapely.ops.polygonize(unary_union(boundaries))`：把多個 polygon 的 boundary line union 切成互不重疊的「面塊」，是 GIS 算 pairwise intersection 的標準工具 |
| **PBF / osmium tags-filter** | Overpass mirror IP ban 時的救援路徑（accessibility SKILL §5.3）。`osmium tags-filter taiwan.osm.pbf w/highway=motorway,trunk,primary,...` 從 PBF 直接過濾出 walk / drive PBF（309MB → 58MB walk / 16MB drive），繞開網路依賴 |
| **pyrosm** | 從 PBF 讀 network → networkx graph，API：`pyrosm.OSM(pbf, bounding_box).get_network(network_type="walking"/"driving")` → `to_graph(nodes, edges, graph_type="networkx")`。⚠ network_type 用 `"walking"/"driving"` 不是 osmnx 的 `"walk"/"drive"` |
| **分區 bbox 邊界斷裂** | 全台跑 osmnx 卡（mirror ban / 6M nodes OOM），退階分 5 區跑（north / north2 / central / south / east）。**真根因（2026-07-02 更正）**：不是 bbox 未 overlap（實測 5 區 bbox 有 40km overlap）→ 而是 [[per-region dissolve concat trap]] — 每區獨立跑 `compute_overlap_count` → dissolve → 5 區直接 concat，同片區域出現多個不同 count 的 features 疊層 → 前端色塊接不上。修法：raw per-station polys → 全域 dedup by entity_id → 全域單一 compute_overlap_count → dissolve。PI-1 已 close |
| **per-region dissolve concat trap** | 分區跑覆蓋 layer 的反模式：每區獨立 `compute_overlap_count + dissolve` → concat 到頂層 → **同片地理區域被 concat 進 N 份 fragments，overlap_count 值各異**（因為每區看到的鄰居 station 集合不同）→ 前端 fill-color step 讀 count 出現色塊接不上。**正確做法**：per-region 只出 raw per-station polygons（不 dissolve）→ 全域 concat → dedup by entity_id → 全域 compute_overlap_count → dissolve 1 次。核心：`compute_overlap_count` 必須全域執行，不能分區。詳 INCIDENTS 2026-07-02 |
| **nearest_node 距離閾值 / offline station fallback** | `ox.nearest_nodes(G, X, Y)` 沒設距離上限，山區 station 在被過濾過的 drive PBF（只留 primary/secondary/tertiary）附近可能沒節點 → 回傳 3-5 km 外的主幹道節點 → ego_graph 從錯位置展開 → polygon 完全不在 station 附近（榮興偏移 5306m、泰崗 4317m）。修法：檢查 nearest_node 距 station EPSG:3826 距離 > 500m → 視為「station 不在路網上」，改用理論半徑圓 `Point.buffer(radius/111000)` at **station 座標**（非 node 座標）。詳 PRINCIPLES + INCIDENTS 2026-07-02 |
| **isochrone Mode B + dissolve 三段演化** | ① convex_hull → 鋸齒過度膨脹；② concave_hull(0.3) → 26K micro fragments；③ concave_hull(0.5) + buffer + **dissolve by overlap_count** → 73 features 乾淨階梯。標準做法 = ③ |

## 全球氣候 / 颱風（2026-07-02）

- **JMA / RSMC Tokyo**：日本氣象廳，WMO 指定西北太平洋官方颱風中心，颱風編號 TC26xx，10-min sustained 風速。bosai forecast.json 只有位置無強度。
- **JTWC**：美軍聯合颱風警報中心，颱風編號 wpNNyy（wp=西太），暫用名（Nine/Ten…），1-min sustained 風速（比 JMA 高 12-15%），ATCF RSS 有風速無氣壓。
- **同實體雙編號**：Bavi = JMA TC2611 = JTWC wp0926；南海系統 = JMA TC2610 = JTWC "Ten" wp1026。同一颱風兩機構各自定位。
- **f000 實況 vs forecast**：GFS 等模式場 `observed_at`=預報有效時刻、`init_at`=cycle 時刻、`leadtime_hr`=預報時數。烤「現在實況」要取 `init_at DESC + leadtime ASC`（最新 cycle 的 f000 分析），不是 observed_at 最遠（那是 +120h 預報）。
- **instanced rendering**：WebGL 每段線一個 instance（8 float），四角幾何固定不重傳，`drawArraysInstanced`，上傳量 -87%。climateParticleLineLayer 用。
- **zoom 自適應密度**：粒子數隨 zoom 拉遠自動加密（填滿大視野）、拉近回 slider 值，量化避免每幀重配置陣列。取代舊的低 zoom canvas drape。
- **climate bake collector**：data-collectors 第 7 個 global_climate collector，讀 Supabase 最新 f000 → 烤 RGBA PNG（風/流 UV）/ raster（沙塵）→ deploy-assets/climate/。

## BYOK 對話 / 會員 / 資安（2026-07-03）
- **BYOK**（Bring Your Own Key）：使用者自帶 LLM key，瀏覽器直連三家（Anthropic/OpenAI/Gemini），key 零經手伺服器。Anthropic 需 `anthropic-dangerous-direct-browser-access: true` header 才能瀏覽器直打。
- **AI SDK v7**（Vercel `ai@7`）：tool 用 `inputSchema`、停步 `stopWhen: stepCountIs(N)`（非 maxSteps）、讀 `fullStream` 逐 part；**abort 不 throw 而是送 `abort` part**。
- **MapBridge**：契約介面，把 App.tsx 既有 handler 注入 chat tools，LLM 操作地圖但邏輯留 App.tsx。
- **capToolResult**：截斷鐵則，tool 回 LLM 前過（maxItems/maxChars），超限回統計+樣本+hint。
- **RLS**：Postgres 資料列層權限。Supabase anon key 公開是正常設計，安全靠 RLS。ENABLE RLS + 無 policy = deny-all。
- **Exposed schemas**：Supabase Dashboard→API 設定，PostgREST 對外暴露哪些 schema。前端 `Accept-Profile:<schema>` header 直讀。專案原則：只留 public+graphql_public（+reference 因 airports/ports app 直讀而保留）。
- **to_regclass 守衛**：migration 內 `IF to_regclass('schema.'||t) IS NOT NULL THEN ...` 防表不存在時 ALTER ERROR，跨環境安全。
- **ground-truth 查證**：聲稱「已完成」前用工具查真實狀態（git status / psql SELECT / curl / gh api check-runs），不靠記憶敘述。

## static-to-cdn（2026-07-04）
- **staticRpc**：`src/data/staticRpc.ts` helper，讀 `/static-rpc/<rpc>.json` CDN 快照，回傳形狀同 `supabase.rpc`（`{data,error}`，error 型別 `{message}|null`），404 / parse fail 自動 fallback 回真 RPC。把靜態層讀取從 DB 併發排隊移到 CDN。
- **static-rpc 快照**：靜態 RPC 輸出的預匯出 JSON（`public/static-rpc/*.json`，gitignore，走 S3 鏡像子前綴 `deploy-assets/static-rpc/`），一支 RPC 一檔。
- **O(N)→O(1) 讀取**：靜態資料每人各自打 DB = 負載 ∝ 人數（O(N)）；搬 CDN 邊緣快取後所有人共用一份 = O(1)。AR 系列核心目標。
- **真冷 repro**：測 in-memory cache（cachedOnce）相關 bug 時，`setData([])` 只清 Mapbox source 不清 JS 記憶體 → 必 **page reload** 才是真冷載入、才觸發冷 fetch。

## owner-gated（2026-07-07）
- **lock_type**：`gated_layers.lock_type`（`'ui'`|`'full'`）。`full`=乾淨鎖（DB REVOKE anon、資料真鎖，機密用）；`ui`=UI 鎖（不 REVOKE、資料公開，未登入顯示鎖頭引導登入、登入即開，非機密引導註冊用）。純宣告欄位，後台改它不動 DB grant（防誤公開）。
- **gated_layers**：`public.gated_layers` 治理表，圖層鎖定的 DB SSOT（layer_key/category/required_tier/enabled/lock_type）。公開 RPC `get_layer_gates()` 回前 3+lock_type 供前端動態 gating（不含地理資料）。
- **enforce_layer_access**：鎖定 RPC 的守門 helper，查 profiles.tier vs gated_layers.required_tier，granted 寫 access_audit_log、denied RAISE 42501 + server log。SECURITY DEFINER，故被它守的 RPC 必 VOLATILE。

## 衛星遙測 LST（2026-07-31 加）

- **LST**（Land Surface Temperature）：地表「皮膚」溫度，≠ 氣溫 ≠ 體感；Landsat C2 L2 ST_B10 產品，`°C = DN×0.00341802 + 149 − 273.15`（DN=0 為 nodata）
- **ΔT（熱島強度）**：像元 LST − 郊區背景中位數（WorldCover cropland 遮罩）；跨日期可比，絕對溫度不可比
- **STAC**：衛星影像統一目錄 API；Planetary Computer 免帳號可讀 bytes（earth-search 只有 metadata 免費，bytes 在 requester-pays bucket）
- **COG**：Cloud-Optimized GeoTIFF，支援 HTTP Range 窗格讀取 + 內建 overview 金字塔
- **WRS-2 path/row**：Landsat 軌道網格；台灣本島 5 景（117/043-045、118/043-044），L8+L9 合併重訪 8 天、過境當地 ~10:20
- **QA_PIXEL**：逐像元 16-bit 品質旗標；熱島應用剔 bit 0-4（fill/雲系/雲影）+ bit 7（水體，避免拉偏背景）
- **ST_QA**：逐像元溫度不確定度（存 ×0.01 K）；門檻用 per-path/row 分位數（P75），不用絕對常數（北台暖季中位數就 3.76K）
- **raster-color-mix**：mapbox raster 動態上色的通道係數 = 物理斜率 ×255（詳 PRINCIPLES）
- **圖片版時代**（共機通報）：國防部通報 ~2025-02-02 以前，網頁 `maincontent` 為空、
  內容全在兩張 JPG 附件（「臺海周邊海、空域活動」＝中英雙語通報全文、「…示意圖」＝航跡圖）；
  2025-02-03 起才是可 regex 解析的文字版
- **表格項次守門**：共機航跡圖左上角表格列出當日項次數，作為向量化的 ground truth
  （來自圖面本身、免人工標註）。⚠️ 項次 ≠ 封閉多邊形（空飄氣球是虛線軌跡）
- **edge_dev**：走廊形狀品質指標＝紅色像素到最小外接矩形邊界距離的 P90 ÷ 短邊長。
  官方走廊是空心線框，單一走廊像素應全部貼邊；達標 0.03–0.07、多形狀黏連 0.36–0.49
- **活動走廊 vs 活動區**：共機示意圖上的紅色形狀有兩類 —— 細長矩形走廊（`rect`）
  與沿 ADIZ 邊界的大型不規則多邊形（`poly`）；後者強制成矩形必然失真
- **地震四件套**：一起地震的四層回放素材——逐站 PGA（station_obs）/ 368 鄉鎮震度（town_intensity）
  / 4,377 格等震度網格（shakemap_grid）/ 震源機制解（moment_tensor）。Tier A = 有 town+grid
  （完整五步回放）、Tier B = 僅測站（三步）。官方源只留最新一次 → 我們的庫是唯一歷史
- **resolved key**：清單 RPC 在 DB 端做完跨表時間窗配對後回傳的「對方表實際自然鍵」
  （grid_event_time / town_origin_time / tensor_origin_utc），前端拿它等值查明細即可；詳 PRINCIPLES
