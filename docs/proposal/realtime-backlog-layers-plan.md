# 即時資料補接計畫 — 台灣好行 / 路況 / 停車 / 急診

> **HISTORICAL / SUPERSEDED（2026-08-19）**：本文件保留 2026-07-10 的探索、取捨與架構歷史，
> 不再是 current backlog 或 release truth。現在的 residual 請看各 feature 的
> [tourist-shuttle backlog](../features/tourist-shuttle/backlog.md)、
> [road-congestion backlog](../features/road-congestion/backlog.md)、
> [parking backlog](../features/parking/backlog.md) 與
> [er-hospital feature 文件](../features/er-hospital/)。實際完成／部署證據以各 feature 的
> changelog、handoff、PR/CI、S3 checksum、HTTP/browser evidence 為準。

> 建立：2026-07-10 · 歷史狀態：當時為規劃（待用戶拍板分批啟動）
> 來源：盤點 `data-collectors/config/cross_layer_map.yaml`（供給側）× 前端 `src/` grep（需求側），
> 4 組探索 agent + Fable 5 顧問審取捨。

## 0. 背景與盤點結論

`cross_layer_map.yaml` 標 `enabled=true` 只代表「應該在跑」；經 psql 直查 DB 最新時間戳，
以下 4 組**確認持續在收、但前端零消費點或部分沒接**，且資料量能足以上線：

| 組 | Collector | 現況（2026-07-10 實查） |
|---|---|---|
| ① 台灣好行 | `tourist_shuttle` | 564 台車 / 82 route / 129 sub_route / 41 業者，positions 7 天連續 |
| ② 路況 | `road_congestion` | 省道 6658 段（全有效）+ 市區 1363 段（5 縣市），5 分鐘一輪 |
| ③ 停車 | `parking` + `parking_offstreet` | 路邊 3675 段、場外 3439 場，皆新鮮 |
| ④ 急診 | `er_hospital_realtime` | 59 家醫院、15 分整點更新、時序自 2026-06-03 累積 19 萬筆 |

> 註：`parking` 曾於 2026-07-08 前被誤標下線，實為一直在跑。

## 1. MVP 分批與共用基礎設施

**執行順序（Fable 5 拍板）：④ 急診 → ① 台灣好行 → ② 路況 → ③ 停車。**

| 批次 | 內容 | 為何這個順序 |
|---|---|---|
| **Batch 1** | ④ 全量 + ① v1（可並行） | ④ 零跨 repo、免 pre-aggregate、範本全齊 → 一週可上線建立節奏；① 上游 migration 照抄 intercity，可與 ④ 前端並行 |
| **Batch 2** | ② highway-only | 最重工程獨立一批，不與別組混。**③ 的上游靜態 collector 在此期間先開跑先驗** |
| **Batch 3** | ③ 停車 | 被靜態座標 collector 阻斷、跨 repo 鏈最長，前端壓軸 |

**先一次建好的共用基建（三件）：**

1. **cron 時刻盤點表**：①（refresh today/yesterday + cleanup）與 ②（全站單日最大掃描量 ~230 萬列）
   一次規劃錯開分鐘，寫進 `docs/supabase-optimization.md`。避免撞號 + 比照 bus trails OOM 教訓
   分段循序。
2. **「reference 線幾何 → PMTiles」腳本**：② 先用（省道 6658 段），③ 路邊 3675 段直接重用。
   走 `taipei-gis-analytics` 既有 PMTiles 重出 SOP。
3. **統一「服務可得性」色帶 token**：youbike（有車率）/ 停車（空位率）/ 急診（壅塞）三層都是
   「綠=可得、紅=滿」，抽一份共用 scale，避免三套微妙不同的綠紅。

**明確砍進 v2 的項目**：① sub_route 級幾何、② 市區路況 + speed 欄位、③ H3 熱力 + timeline 回放、
④ `inform` 旗標升級為著色條件。

---

## 2. ④ 急診 er_hospital（Batch 1，最先）

**目標**：醫院以點顯示、點色代表當前急診壅塞；點擊 popup 顯示過去 24h 折線；Monitor 有急診卡含折線。

**掛法**：既有「醫療 Medical」section（`layerCatalog.ts:655`）新增 group「即時 Emergency」，
key `erHospital`（動態 GeoJSON circle 層，非 PMTiles，與 5 個靜態醫療 POI 明確區隔）。
幽靈 key `medICUBeds` 視為 dead code 保留不動（§3 Surgical）。

**座標來源**：即時表無經緯度 → 用既有 `public/geo/medical_hospitals.geojson` 以 `hosp_id === facility_id`
join，實測 **57/59 命中**；2 家未中（聯醫仁愛、大甲光田）前端 override 硬編座標（註明來源+日期）。零跨 repo。

**上游（gis-platform migration，資料量小免 pre-aggregate）**：
```
public.get_er_hospital_latest()            -- 59 rows，from er_hospital_current，供著色 + Monitor
public.get_er_hospital_24h(p_hosp_id text) -- ~96 rows，from er_hospital_status，popup 線圖
-- get_er_hospital_summary() 可選（前端也能從 latest 聚合）
```
全部 `GRANT EXECUTE TO anon`。

**下游前端（7 步 + Monitor）**：
| 檔 | 動作 |
|---|---|
| `types/index.ts` | `LayerVisibility.erHospital` + `FeatureInfo.layerType` union 加 `erHospital` |
| `src/data/erHospitalLoader.ts` | 新增（loader 包 `withLoading`；popup 與 Monitor 共用）|
| `src/data/erCongestionTypes.ts` | 新增（著色 SSOT，比照 `medicalPOITypes.ts`）|
| `src/hooks/useErHospitalLayer.ts` | 新增（GeoJSON circle 層，載 geojson join 座標 + RPC 量能）|
| `overlayRegistry.ts` 或 circle 層 hook | 依現有醫療動態層慣例 |
| `layerCatalog.ts` | `LAYER_COLORS.erHospital` + 「即時 Emergency」group toggle |
| `featureInfo/medicalPanels.tsx` | 新增 `EmergencyHospitalPanel`（含 24h `TimeseriesSparkline`）|
| `featureInfo/registry.tsx` | `PANEL_REGISTRY` + `HEADER_LABELS` 各加一行 |
| `useMapInteraction.ts` | 加 `erHospital` 點擊拾取 |
| `useTransportParams.ts` | opacity slider |
| `LegendPanel.tsx` | 4 級壅塞圖例 + `LEGEND_REGISTRY` |
| Monitor：`intel/monitor/ERCard.tsx` | 新增（複製 `AirportPaxCard`）|
| Monitor：`MonitorPanel.tsx:711` | import + grid 加 `<ERCard>`（grid 改 3 欄）|

**著色（拍板 D）**：4 級以 `wait_general_cnt` 為主軸，閾值用 37 天 history 百分位**校準一次後寫死**在
`erCongestionTypes.ts`（註記校準日期，不動態算以免顏色語意漂移）：

| 等級 | 色 | 起始條件（待 history 校準） |
|---|---|---|
| 順暢 | 綠 | `wait_general ≤ 5` 且 `wait_bed ≤ 2` |
| 略壅 | 黃 | `wait_general 6–20` |
| 壅塞 | 橙 | `wait_general 21–40` 或 `wait_bed ≥ 5` |
| 嚴重 | 紅 | `wait_general > 40` 或 `wait_icu ≥ 3` |

- `wait_icu_cnt > 0` 用**加重標記（ring/icon）**呈現，不混進主軸（強信號但太稀疏）。
- `inform`（疑似官方 Y/N 壅塞旗標，語意未證實）**只放 popup 原文展示**，累積比對一個月後再決定
  v2 是否升級為紅燈條件。

**Monitor 卡（拍板 D）**：59 家無法全塞 tab → **原生 `<select>` 選區（19 區，預設「全台」）+
全台模式顯示壅塞 top-6 tabs**。dropdown 本就是四鐵則第四條要求（≥4 選項）。

**工作量**：上游 S（2 薄 RPC）/ 下游 M。最大風險：著色語意（低危）。

---

## 3. ① 台灣好行 tourist_shuttle（Batch 1，與 ④ 並行）

**目標**：觀光公車即時位置，progress-based 沿路線 LineString 跑（車不亂走），比照公車。

**範本**：公車「公路客運 intercity」變體（全國單一源）。**`BusEngine` / `BusScene` / `busCustomLayer`
零改動重用**（`city` 型別已是 string，泛用）。

**拍板 A（幾何精準度）：v1 用 route_uid 級上線 + 兩道防護欄。**
- 觀光層用途是「脈動感 + 哪裡有車」不是導航，子線偏差可接受。
- 防護欄 1：多子線 route **選最長的子線幾何**（不要選「第一條」）。
- 防護欄 2：BusEngine 投影加**距離 gate** — GPS 點距所選 shape > ~500m 就 fallback 畫原始點/隱藏，
  避免子線錯配時車輛沿錯線瞬移抖動。**這是 v1 品質底線。**
- 上線前打一次 TDX `Tourism/Bus/Shape` 端點確認 SubRouteUID 欄位存在 + 缺值率（為 v2 鋪路，
  避免上線後才發現被卡在 v1）。

**上游（gis-platform migration，照抄 `037_bus_intercity_trails_daily.sql`）**：
```
get_tourist_shuttle_current(...)   -- 別名對齊 BusPosition mapper：sub_route_name AS route_name、
                                   --   lat AS bus_lat、lng AS bus_lng，額外回 sub_route_uid（v2 用）
tourist_shuttle_trails_daily (table) + refresh_tourist_shuttle_trails_daily(target_day)
  + pg_cron（分鐘錯開 bus/intercity，例如 :12/:27/:42/:57）+ cleanup **保留 30 天**（見風險）
get_tourist_shuttle_dates() / get_tourist_shuttle_trails(target_date)
```
trail 按 `(plate_numb, direction)` 切（有迴圈線）。全部 `GRANT ... TO anon`。

**中游（route JSON，v1 走 A 路徑）**：`taipei-gis-analytics/scripts/.../preprocess-bus-routes.py`
加 preset，用 `SELECT DISTINCT route_uid FROM tourist_shuttle_current` 白名單過濾既有
`bus_shapes_all.geojson`（幾何已證實存在），輸出 `public/bus/tourist_shuttle_routes.json`（~86 條小檔，直接進 git）。

**下游前端（照抄 intercity）**：
| 檔 | 動作 |
|---|---|
| `types/index.ts` | `touristShuttleLive` key + `TOURIST_SHUTTLE_ROUTES_JSON` const |
| `busLoader.ts` / 新 `touristShuttleLoader.ts` | 複製 intercity 4 支函式，換 RPC 名 + JSON 路徑 |
| `useTouristShuttleLayer.ts` | 複製 `useBusIntercityLayer.ts`，`new BusEngine` 重用 |
| `useThreeJsLayers.ts` | `addTouristShuttleLayer`（id `"tourist-shuttle-3d"`）+ sceneRef |
| `App.tsx` | hook 接線 + Replay loadDay + sceneRef 進 useMapInteraction + 車數顯示 |
| `layerCatalog.ts` | `LAYER_COLORS` 補 key + label + SECTIONS toggle |
| `useTransportParams.ts` | orbScale / colorMode / altOffset + opacity slider |
| `useMapInteraction.ts` | **新增** `pickBus` 分支（intercity 沒接 popup，四鐵則③要補）|
| `LegendPanel.tsx` | colorMode（route/speed/density ≥2 類）補 legend |

**Collector**：不缺，已在跑。

**工作量**：上游 M / 下游 S-M。最大風險：子線錯配（gate 緩解）。

---

## 4. ② 路況 road_congestion（Batch 2，最重工程）

**目標**：省道 + 市區即時壅塞，比照 freeway 以 LineString 逐段染色、不斷掉。

**範本**：freeway 國道壅塞層（custom hook 自管 source/layer）。幾何表 `reference.road_sections_geometry`
已灌滿（8258 段真實 LineString，join 覆蓋 highway 99.6% / city 96.6%）。

**拍板 B（工程解法）**：
- **核心招 — 288 字元等間隔編碼**（Fable 5 關鍵洞察）：路況固定 5 分鐘 = 288 槽。每段存一條
  **288 字元字串**（每字元一槽：`0-4` + `-` 表無資料，Asia/Taipei 00:00 對齊）。
  raw 從 37MB → 6658×288 ≈ 1.9MB，等級連續重複 gzip 後估 **<300KB**。同時解掉 payload + 降頻需求
  → **不需做 10 分鐘降頻**。
- **pre-aggregate per-day 表必做**：一段一列（6658 < 20K cap 安全），RPC 薄 SELECT 只回
  `section_id + timeline_288char`。⚠ migration review 盯死「一段一列」，不可「一 snapshot 一列」。
- **幾何解耦成 PMTiles（不用 GeoJSON）**：低頻 reference 資料，PMTiles 給 zoom-based simplification
  （8k 段低 zoom 不爆）+ 既有 deploy-assets/keep_attrs 契約。
  ⚠ **架構後果**：PMTiles source 不能 `setData`，染色改 `promoteId` + `setFeatureState`
  （codebase **零使用的新機制**，不能裸抄 freeway 的「每 tick 重建 FeatureCollection」）。
  timeline tick 對 6658 段查字元槽、只在 level 變化時 setFeatureState，走 `subscribeThrottled`。
  **這是 ② 前端工作量主來源。**
- **v1 只上 highway**（品質均勻、全國省道故事完整）；city 只 5 縣市 + 台中兩點直線幾何 → v2 連縣市篩選一起上。
- 等級自建 0-4 scale（-99 → 灰），**色帶跟 freeway 綠→紅對齊**（兩層同開語意不打架），圖例分開寫。

**上游**：新 migration（288 字元 refresh function + 索引 + PMTiles 跨 repo 重出）+
`taipei-gis-analytics` 補 `keep_attrs`（section_name 等）重出 PMTiles。

**下游**：抄 freeway loader/hook 但改 feature-state 染色 + hit 層 + 4 級圖例 + timeline。

**工作量**：上游 L / 下游 M。最大風險：refresh 掃 230 萬列/日的 OOM/timeout（必分段循序，比照 bus trails OOM 5 條）。

---

## 5. ③ 停車 parking + parking_offstreet（Batch 3，上游先行）

**目標**：路邊停車（沿街）+ 場外停車場（點）即時可用性視覺化。

**阻斷缺口**：兩張即時表**都沒有座標**，只有可用性數字。必須先補靜態座標
（比照 youbike `youbike_with_station` 模式：即時表 join 靜態站點參考表）。

**拍板 C（呈現法）**：v1 = **場外點層 + 路邊 LineString 染色**，H3 砍、timeline 回放砍、只吃 `_current`。
- **路邊**（本質是「線」不是點）→ 沿街 LineString 依空位率染色。3675 段直接畫不爆，H3 延 v2。
- **場外**（本質是「點」）→ 點 marker + 空位率色階（綠→紅）+ 圓大小表 `total_spaces`。
  `source_category`（城市/國道服務區/景點 ≥3 類）→ 圖例分層。
- **統一色軸**：用 `availability_rate = available/total`（**空位率**，非 occupancy），與 youbike 有車率
  同落「服務可得性高=綠、滿=紅」軸。
- **台北路邊 available 全 = -1**（僅容量無即時空位）→ **畫、但用容量深淺的中性色（藍灰）**，
  圖例明寫「僅容量，無即時空位」（不畫會讓最大城市看似沒覆蓋；硬套綠紅會被誤讀）。
  新北 + 台中才走綠紅。⚠ 計算 availability_rate 必須 guard `-1`（個別段也可能 -1）。

**上游先行（Batch 2 期間開跑先驗）**：新增靜態 collector 抓 TDX
`OnStreet/ParkingSegment`（LineString + 代表點）與 `OffStreet/CarPark`（點）寫 reference/spatial 參考表，
`segment_id` / `car_park_uid` join 即時表。半靜態（半年更新）。
⚠ **最大未驗證假設**：TDX ParkingSegment 幾何覆蓋率/品質尚未實查 — 若缺漏率高，路邊層要退回點位呈現，
**故參考表 collector 必須提早跑先驗**。

**下游**：路邊 LineString 層 + 場外 circle 層 + 統一色軸 token + 台北特例 + hit 層 + 圖例。

**工作量**：上游 L（新 collector ×2 + 參考表 + join + RPC，鏈最長）/ 下游 M-L。
最大風險：TDX 靜態幾何覆蓋率未驗證（阻斷性，先驗再設計）。

---

## 6. 風險登記（Fable 5 補漏）

| # | 組 | 風險 | 對策 |
|---|---|---|---|
| R1 | ① | 幾何覆蓋率只抽樣命中 | 上線前跑 82 route 全量 join，定義未命中 route 車輛 fallback（隱藏/畫 GPS 點）|
| R2 | ① | 低密度：564 是全日車數，同時在線可能百餘台，圖很空 | route JSON 畫淡色路線底線給「骨架」+ 預期管理 |
| R3 | ② | 288 槽當日未來槽 + 跨日邊界 | 未發生槽填 `-`，refresh 每 5 分更新今天列；跨日走 `subscribeDate` 重載 |
| R4 | ③ | TDX ParkingSegment 幾何品質未實查（最大假設）| 參考表 collector 提早跑先驗，缺漏高則退點位 |
| R5 | ③ | `available = -1` 算術污染 | availability_rate 計算 guard -1，勿讓負值進色階 |
| R6 | ②③ | 細 LineString 點擊命中率極差 | 加透明加寬 hit 層（line-width 12+，比照 `energy-power-generation-hit`），`useMapInteraction` 加 hit 層 id |
| R7 | ② | PMTiles popup 雙源合成 | 靜態屬性來自 tile keep_attrs、即時 level 來自 feature-state，panel 要合成兩處；keep_attrs 跨 repo 先補 |
| R8 | ④ | 急救責任醫院名單年年變 → geojson join 命中率會掉 | loader log 未命中數；2 家 override 註明來源+日期 |
| R9 | ① | positions 只留 7 天，回放日期選單被綁死 | **trails_daily 明確保留 30 天**（否則之後想放寬回填做不到）|
| R10 | ② | row cap | ② 一段一列（6658）安全；review 盯死不可「一 snapshot 一列」|

---

## 7. 跨 repo 同步順序（每組共通）

1. `taipei-gis-analytics`：pipeline / route JSON / PMTiles keep_attrs + `docs/handoff/<slug>.md`
2. `gis-platform`：migration（RPC + pre-aggregate table + cron）
3. `data-collectors`：③ 新靜態 collector（②①④ 不需改 collector）
4. `mini-taiwan-pulse`：前端接線 + `docs/features/<slug>/handoff.md` 反向引用 + PR

slug：`tourist-shuttle` / `road-congestion` / `parking` / `er-hospital`。
各開 `docs/features/<slug>/`（`cp -r _TEMPLATE`）。

## 8. 驗收標準（每組）

- `npx tsc -b` exit 0 + `pnpm test` 全綠（`layerConsistency` 擋漏圖例）
- Browser：All Off → 只開新 layer → 邊界 zoom + timeline 測；console 0 error
- 四鐵則：opacity slider ✅ / 分類≥2 圖例 ✅ / 可選物件 popup ✅ / select≥4 原生 dropdown ✅
- 跨 repo：handoff 雙向引用 + PR squash hash 記 changelog

## 9. 待用戶拍板

1. **分批排序**是否採 ④→①→②→③？或有商業優先序要調整（例如颱風季前先上路況）？
2. **① 台灣好行**接受 v1 route_uid 級（多子線挑最長 + 距離 gate）先上、sub_route 精準度延 v2？
3. **② 路況** v1 只上 highway（省道）、市區 5 縣市延 v2，可接受？
4. **③ 停車** v1 只做「現在」（不做 timeline 回放）+ 台北路邊中性色，可接受？
5. 是否要我**先啟動 Batch 1（急診 + 台灣好行）**，還是先只做其中一個試跑流程？
