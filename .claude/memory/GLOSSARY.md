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
| Schedule layer (淡紫 #a78bfa) | 從 `spatial.waste_collection_stops` 表定 arrival/departure 跑的動畫，跟 GPS 圖層獨立 toggle 並存 |
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
