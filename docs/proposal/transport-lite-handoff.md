# Transport Lite — Pulse 交通精簡版 Hand-off 計畫

> 2026-07-10 擬定。本文件為交付外部工程團隊的執行計畫（hand-off doc）。
> 基底：mini-taiwan-pulse（React 19 + TS + Vite + Mapbox GL + Three.js + Supabase）。

---

## 1. 目的與背景

目標：建立一個**與 mini-taiwan-pulse 介面完全一致**的精簡版應用，只保留交通類圖層與載具動畫，移除其餘功能。

### 為什麼是「fork 減法」而不是「重建加法」

前一輪嘗試（`mini-taiwan-project-new-taipei` repo）從零重建精簡版，得到的教訓：

- **公車渲染品質事故**：重建版只搬了 BusEngine 的「原始 GPS 插值」fallback 路徑，漏掉主路徑 **progress-based route-snap**（GPS 軌跡先 snap 到路線幾何算 progress，播放時沿 LineString 插值還原座標）。GPS 點位稀疏時直線插值，導致跨區幹線（如三峽→臺北）與彎繞路段（北海岸）公車直接「飄」過去，不貼路網。
- 結論：pulse 的載具渲染管線是多輪迭代的成果，任何「簡化重寫」都有走樣風險。**正確策略是 fork 完整 code，只做移除，渲染管線一行不動。**

## 2. 已拍板決策（產品 Owner）

| 決策 | 內容 |
|---|---|
| 策略 | 以 pulse 為基底 fork 出**新 repo**，做減法 |
| 介面 | 與 pulse 完全一致（含時間軸設計），僅移除功能，不重新設計 |
| 地理範圍 | 全台（pulse 原樣）；初始視角可設北部 |
| 資料來源 | **Phase 1 沿用 Supabase 即時**（與 pulse 相同）；**Phase 2 再本地化**（之後另案） |
| 保留圖層 | 公車（市區+公路客運）、鐵道、船舶、國道壅塞、公路路網（詳 §4.2） |
| 移除功能 | Locations／即時情報 Intel／衛星情報／Monitor／問 AI／Info 說明彈窗／會員登入／歷史紀錄切換（詳 §5） |

## 3. 新 repo 建立方式（Phase 0，資料 Owner 執行）

- 建議**乾淨複製**（copy 工作樹 + 全新 initial commit），不帶 pulse git 歷史——避免歷史包袱與歷史中可能的敏感內容。
- Repo 名建議：`mini-taiwan-transport`（或接手團隊自定）。
- 複製基準：pulse `master`（不含未合併 feature 分支）。

## 4. 保留範圍

### 4.1 介面（原樣保留）

- 左側 icon rail + **Layers 面板**（`src/components/IconRailSidebar.tsx` 的 `LayersPanel`，資料來源 `src/components/sidebar/layerCatalog.ts`——THEMES→SECTIONS→LAYER_COLORS 是唯一真實來源，`LayerVisibility` 由此 derive）
- 時間軸 `TimelineControls.tsx`（調整範圍見 §6）
- **FeatureInfoPanel（點擊地圖 feature 的詳情卡）保留**——注意這與「Info 說明彈窗」是兩個東西（§5.4）。它是核心地圖互動（`useMapInteraction.ts` 驅動），保留清單內圖層的點擊詳情都靠它。
- 手機版 LayerSidebar / bottom sheet、Loading 畫面、圖例 LegendPanel、透明度等 overlayParams 控制（`useTransportParams.ts`）——原樣保留。

### 4.2 保留圖層（layerCatalog 縮減後的全集）

**交通 Move 主題，共 5 組 + 場站路網配套**：

| 組 | LayerVisibility keys | 備註 |
|---|---|---|
| 公車 | `busLive`、`busIntercityLive` | 市區公車 + 公路客運，兩個 CustomLayer 實例 |
| 鐵道 | `rail` | 時刻表驅動（TRTC/TRA/THSR/TMRT/KRTC/KLRT） |
| 船舶 | `ships` | Replay 模式（無 live poll，屬原設計） |
| 國道壅塞 | `freewayCongestion` | 動態染色 |
| 公路路網 | `highways`、`osmExpressway`、`provincialRoads` | 靜態路網 |
| 場站（建議保留，配套） | `stationsTHSR`、`stationsTRA`、`stationsMetro`、`busStationsCity`、`busStationsIntercity`、`ports` | 載具圖層的空間錨點；若 Owner 不要可再減 |

其餘全部 THEMES（底圖行政界地形／人口社經／環境／水資源／災害／全球氣候／消防／醫療／農業／運動／林業／廢棄物／能源／基建／房地產／太空／新聞／執法治安／民防）自 `layerCatalog.ts` 移除。完整 key 清單見 pulse `src/components/sidebar/layerCatalog.ts`。

> 好消息：保留清單中**沒有任何 owner-gated 圖層**（gated 集中在畜牧/石化/電力等，見 `src/lib/layerGates.ts` 的 `GATED_LAYERS`），因此移除會員系統不需要動 Supabase 後端權限。

### 4.3 載具渲染管線（一行不動，附資料依賴）

| 載具 | 管線 | 資料依賴 |
|---|---|---|
| 公車 | `BusEngine.ts` progress-based：GPS trail → snap 路線幾何 → progress 時間軸 → `interpolateOnLineString` 還原座標（幾何保證貼路網）。`resolveRouteKey` 失敗才退 GPS 插值 fallback（設計上是「最少見」路徑）。背景文件 `docs/bus-layer-design.md`、`docs/features/bus/` | 路線幾何 `public/bus/{city}_bus_routes.json` × 23 縣市 + `intercity_bus_routes.json`（大檔 gitignore，走 S3 deploy-assets）；Live RPC `get_bus_current` / `get_bus_intercity_current`；Replay RPC `get_bus_trails` / `get_bus_intercity_trails` |
| 鐵道 | `RailEngine.ts` 時刻表驅動 + `station_progress` 插值 | `public/rail/`（gitignore，S3 `rail.tar.gz`）；每日時刻表 Supabase `reference.daily_schedules` REST fetch，查無退回 bundle 預設 |
| 船舶 | `ShipScene` + `shipLoader.ts`（>40 節異常過濾、7 天 LRU） | RPC `get_ship_dates` / `get_ship_trails(date)` |
| 共用 | `src/map/customLayer.ts`（flight/ship/rail factory）+ `busCustomLayer.ts`；`useThreeJsLayers.ts` 統一掛載 | — |

## 5. 移除清單（附檔案錨點與耦合注意）

> 執行建議：**第一輪只拆 UI 入口與 App.tsx 接線（低風險），第二輪再清孤兒檔案**。`App.tsx` 2,840 行、`overlayRegistry.ts` 6,264 行是巨石檔，殘留的 dead overlay config 無害，不必求一次刪乾淨。

| # | 移除項 | 主要檔案 | App.tsx 接線 | 耦合注意 |
|---|---|---|---|---|
| 1 | Locations 面板 | `IconRailSidebar.tsx` 的 `LocationsPanel`/`LocationItem`、`src/map/cameraPresets.ts` | `selectedAirport`、`handleLocationJump`、`onLocationJump` props | `chatBridge.jumpToPlace` 呼叫 `handleLocationJump`——chat（#5）同批移除即消 |
| 2 | 即時情報 Intel | `src/components/intel/`（不含 monitor/） | L543-563、L1926-1934、L1958-1970（`intelOpen` + 四面板互斥 `railCloseEpoch`） | `newsFilter` 與 Monitor、新聞圖層共用——新聞 `newsEvents` 不在保留清單，整組移除後耦合消失 |
| 3 | 衛星情報 Console | `src/components/satelliteConsole/` + `src/state/satelliteConsoleStore.ts` + `useSatelliteManeuvers` | L547-563、L1949-1955 | 太空 THEME 16 個 layer key 一併從 layerCatalog 移除（不保留衛星圖層） |
| 4 | Monitor mode | `src/components/intel/monitor/` | L546-548、L1973-1985、右上鈕 L2076-2132 | `usePowerDashboard` 同時餵電力圖層——能源圖層整組移除後可全刪 |
| 5 | 問 AI（BYOK chat） | `src/chat/`、`src/components/chat/`、`src/state/chatStore.ts`、`src/lib/keyVault.ts` | L142-143、L380、`chatBridge` L1620-1651、L2133-2157、L2826-2834 | `chatBridge` 呼叫 `handleBulkSetVisibility`/`handleAllOff`/`handleLocationJump`/`setFeatureInfo`——刪 bridge 時清呼叫點即可，被呼叫的 handler 本身保留（Layers 面板仍用） |
| 6 | Info 說明彈窗 | `src/components/InfoModal.tsx`（1,172 行，純靜態） | `showInfo` + L2172-2189 + L2822 | 無資料依賴，安全移除。**勿誤刪 FeatureInfoPanel**（§4.1） |
| 7 | 會員登入 | `src/lib/auth.ts`、`src/lib/layerGates.ts`、`src/components/auth/`、`src/components/admin/` | L166-193、`handleGatedIntercept`/`handleLayerClick` L1515-1539、L2189/2362、L2823 | 保留圖層皆非 gated（§4.2），純前端移除即可，後端不動 |
| 8 | 歷史紀錄切換 | 見 §6 | — | — |
| 9 | Capture（沿原始需求一併移除；如要保留請 Owner 註明） | `App.tsx` 內 `captureMode` state + ESC 監聽 L1459-1467 + 鈕 L2059-2075 + vignette JSX | 同左 | 純自包含，安全移除 |
| 10 | Historical 長時序模式 | `ModeToggle.tsx`、`HistoricalTimeline.tsx`、`appMode` 機制（App.tsx L565-667） | 同左 | 服務人口/火災/房地產長時序——該些圖層已移除，整組可刪。**注意這與 #8 的 live/replay 是兩套獨立系統，勿混** |

## 6. 時間軸調整規格（唯一需要「改」而非「刪」的地方）

現況（`useTimeline.ts` + `TimelineControls.tsx`）：
- Row 1：前後日箭頭／日期選擇器／`LIVE⇄Now` 切換鈕／回看天數下拉
- Row 2（僅 replay 模式渲染）：play/pause＋倍速＋拖曳 slider
- `timeMode`：`live`（鎖 `Date.now()`）⇄ `replay`（歷史快照回放）

目標行為：**移除「跨日歷史導航」，保留其餘時間軸設計**。

規格：
1. 移除 Row 1 的前後日箭頭、日期選擇器、回看天數下拉（`onShiftDate`/`onDateChange`/`rangeDays`）。
2. 保留 `LIVE⇄Now` 切換鈕與 Row 2 完整功能（play/pause／倍速／拖曳）——即**保留 replay 迴圈但 `selectedDate` 鎖定今日**：使用者仍可拖回「今天稍早」重播，只是不能跳到其他日期。
3. `useTimeline.ts` 對應刪除 `shiftDate`／多日 `rangeDays` 邏輯；`setSelectedDate` 收斂為內部固定今日。
4. 船舶為 replay-only 設計（原樣），鎖今日後照常運作（`get_ship_trails(today)`）。

## 7. 工作分解與驗收

### Phase 0 — 準備（資料 Owner，交接前完成）
- [ ] 建新 repo（§3），乾淨複製 pulse master
- [ ] 交付交接物（§8）
- [ ] 本文件放入新 repo `docs/`

### Phase 1 — 減法（接手團隊）

| 步驟 | 內容 | 驗收 |
|---|---|---|
| 1-1 | `layerCatalog.ts` 縮減至 §4.2 保留清單（THEMES/SECTIONS/LAYER_COLORS 同步）；`useLayerVisibility` derive 自動收斂 | `npx tsc -b` exit 0（禁 `--noEmit`） |
| 1-2 | §5 移除清單 #1-#10，第一輪拆 UI 入口 + App.tsx 接線 | tsc 0；瀏覽器 console 無紅字 |
| 1-3 | §6 時間軸調整 | LIVE/回看今日皆可播放拖曳 |
| 1-4 | 測試同步：`pnpm test` 的 `layerConsistency`（圖例對齊）與 deploy contract 測試隨保留清單縮減 | `pnpm test` 全綠 |
| 1-5 | 第二輪清孤兒（被移除功能的 loader/hook/panel 檔案、featureInfo registry 中已刪圖層的條目） | tsc 0 + test 綠 |
| 1-6 | 初始視角設北部（僅 `MapView` 初始 center/zoom，一處常數） | 目視 |

**Phase 1 總驗收（品質基準 = pulse 原版）**：
- [ ] **公車貼路網目視驗收（最重要）**：Live 與 Replay 各抽查——(a) 三峽→臺北跨區幹線、(b) 北海岸（淡水—金山—基隆沿線）、(c) 任一市區路線。公車必須沿道路行駛，不得直線飄移。GPS-fallback 僅允許出現在路線幾何確實缺漏的個案。
- [ ] 鐵道列車照時刻表沿軌道行駛；船舶當日軌跡回放正常。
- [ ] 國道壅塞染色隨時間更新；路網靜態顯示正常。
- [ ] Layers 面板只出現保留圖層；被移除功能的按鈕/面板完全不出現。
- [ ] `npx tsc -b`、`pnpm test` 全綠；瀏覽器 console 無紅字。

### Phase 2 — 資料本地化（另案，先不做）

之後把 Supabase 依賴換成本地快照時：
- 動態層 RPC 均為「按日快照」設計，可序列化 JSON 本地存放；`mini-taiwan-project-new-taipei` repo 的 `scripts/export/`（RPC 快照匯出 + S3 raw 重聚合回填，聚合結果與 RPC 比對 0% 差異）可直接複用。
- S3 歸檔（`migu-gis-data-collector` bucket，`{collector}/archives/{date}.tar.gz`，永久保留）可回溯至 2026-02 底。
- 注意：本地化後 Live 模式失效，需回到日期選擇設計——與 §6 的移除方向相反，屆時再議。

## 8. 交接物清單

| 項 | 內容 | 提供方式 |
|---|---|---|
| Repo | 新 repo 完整 code | GitHub 邀請 |
| `.env` | `VITE_MAPBOX_TOKEN`、`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_DATA_SOURCE=supabase` | 私下交付（不進版控）。anon key 屬公開等級（安全靠 RLS），**不交付** service role key |
| 部署資產 | `public/bus/`（含 gitignore 的 taipei/intercity 大檔）、`public/rail/`（rail.tar.gz 解壓） | 二選一：(a) 打包 tar 直接給；(b) 給 S3 唯讀憑證 + `scripts/deploy/pull-deploy-assets.sh` |
| 文件 | 本文件、`docs/bus-layer-design.md`、`docs/features/bus/`、`docs/TIMELINE_ARCHITECTURE.md`、`docs/development-rules.md` | 隨 repo |

## 9. 風險與注意事項

1. **公車路線幾何覆蓋率**是貼合品質上限：幾何來自 TDX `bus_shapes_all.geojson` 按縣市切分（三峽/北海岸歸新北市檔）。若某路線在 TDX 缺 shape，該路線會退 GPS-fallback——此屬資料議題非 code bug，驗收時區分清楚。
2. **不要動 `src/engines/`、`src/three/`、`src/map/*CustomLayer*`**：所有「飄移」教訓都來自簡化這一層。Phase 1 不存在任何需要修改渲染管線的理由。
3. `App.tsx`／`overlayRegistry.ts` 巨石檔：只刪不改、分兩輪清理（§5 執行建議），每輪 tsc + test 守門。
4. Supabase 用量：多一個站台打同一組 public RPC，讀取為主、量級低；但若接手方要大流量公開部署，需另議快取（CDN 快照原則見 pulse `PRINCIPLES.md`）。
5. Mapbox token：建議接手方換自己的 token 與帳號，避免用量混算。
6. 時區／時間軸行為以 `docs/TIMELINE_ARCHITECTURE.md` 為準；動態圖層時間訂閱鐵則（currentTime 禁入 React deps）在 pulse `CLAUDE.md` §6。

## 10. 參考

- 前次嘗試（供 Phase 2 參考，勿作為渲染 code 來源）：`mini-taiwan-project-new-taipei` repo——資料匯出/回填腳本可複用；其公車渲染為簡化版，**不可**回抄。
- Pulse 專案規則：`CLAUDE.md`、`docs/development-rules.md`。
