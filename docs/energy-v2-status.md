# Energy v2 — 進度追蹤

> 接續 `energy-v2-plan.md`。每 phase commit 一次、不 push、不 merge（等用戶 review）。
> Phase A+B 已 merge 進 master（PR #25）；Phase C 開 `feat/energy-v2-C` 從 master 切。

## Phase A — Monitor 整合（in progress）

### A.1 — PowerCard skeleton + MonitorPanel 接線（done）

- [x] 新檔 `src/components/intel/monitor/PowerCard.tsx`
      上：燈號 + 負載 / 備轉 / 供電 + 預測尖峰
      中：4 區 mini-bars（pct 對 local max 正規化）
      下：14 廠 sparkline grid（按 mw desc 排序，rate 配色）
- [x] 新檔 `src/components/intel/monitor/powerCardData.ts`
      純函式 `buildPowerCardModel(dashboard, day)` + `loadRateColor(rate)`
      把 view-model 從 React 元件抽離（純資料層才能在 node 環境跑單元測試）
- [x] `IndicatorPanel` 加 `powerDashboard` / `powerDay` 兩個 prop，
      `<PowerCard>` 接在 `<SituationCards>` 之後、`<LiveWall>` 之前
- [x] `MonitorPanel` 在 `open` 時自動拉：
      - `fetchPowerDashboard()` 每 5 分鐘 poll（與 `usePowerDashboard` 共用 `cachedOnce` cache）
      - `fetchPowerGeneration24h()` 每 10 分鐘 poll
      - 兩者 invalidate→refetch、unmount 取消
- [x] 新檔 `src/components/intel/monitor/__tests__/powerCardData.test.ts`（7 cases）：
      - 空 dashboard / null day → 4 region 仍 render 空槽、indicator/observedHHMM 為 fallback
      - 區域 pct normalisation 用 local max（北部 → 1.0 / 東部 → ~0.038）
      - 14 廠最新值取最後一個 sample、按 mw desc 排序、空 points 廠歸 null
      - 髒資料 rate clamp 到 [0, 1.5]
      - `loadRateColor` 4 段 + 邊界值（0.5/0.85/1.0 落到下一階）
- [x] `npx tsc -b` 0 error
- [x] `npx vitest run` 全 12 檔 / 109 cases 通過

### 沒做的（保留給 A.2 / A.3）

- KPI 數字（24h max/min/avg load_rate / fuel mix 比例）— A.2 再算
- Monitor 開啟自動 share `energyDashboardActive`（目前 MonitorPanel 自己拉、走 `cachedOnce` 共用，
  不需動 App.tsx；待 A.2 觀察是否兩處重複 fetch 浪費 RPC）
- `get_power_generation_kpi_24h()` 新 RPC — A.2 評估後再決定（多數 KPI 前端算就夠）

### A.2 — KPI strip + timeline isolation test（done）

- [x] PowerCard 新 KPI strip：24h 尖峰 / 當前合計 / fuel mix bar + 前 5 項 legend（fuel 走 `fuelColorOf`）
- [x] 6 新測試（共 13 cases）：
      - 空 day → 零值
      - peak 是「各時點全國總和」max（非單廠 max）
      - fuel mix 用最新 ts snapshot 分組、pct normalised、desc sorted
      - `fuel_type: null` 歸 'unknown'
      - **timeline isolation contract**：`buildPowerCardModel` 不收 time 參數、永遠取 array 最後一筆

### A.3 — share dashboard fetch with App.tsx（pending）

兩處跑 5min interval、`cachedOnce` 5min TTL dedup → 不浪費 RPC，
但仍可能 invalidate 互踩。實測前不修。

## Phase B — HAZARD（done，待視覺驗收）

### B.1+B.2 — types + loaders + Legend + featureInfo（合併 commit done）

合併原因：layerConsistency 測試會擋「LegendPanel 漏接」「useTransportParams 漏接」，所以
B.1 資料層必須與 B.2 UI 接線同時送進來才不會 ratchet fail。

- [x] types/index.ts：`LayerVisibility` / `ExpandableLayerKey` / `FeatureInfo.layerType` 各加兩 key
- [x] `lightningLoader.ts`：clampMinutes / lightningTypeColor / toLightningFC + cachedByKey(60s)
- [x] `nuclearLoader.ts`：classifyNuclearDose 5 階（normal/watch/warning/alarm/stale）+ cachedOnce(5min)
      NUCLEAR_DOSE_THRESHOLDS 參考 AEC 0.5 µSv/h 警戒
- [x] sidebar HAZARD section + LAYER_COLORS + IconRailSidebar（CloudLightning / Atom）
- [x] LegendPanel：LightningLegend + NuclearLegend（'is_stale + 高劑量 ≠ 核災' 警語）
- [x] hazardPanels.tsx：LightningStrikePanel + NuclearStationPanel
      （NuclearStationPanel is_stale → 灰底警告，alarm → 紅底建議交叉確認原能會）
- [x] useTransportParams：lightning 加時間窗 5~360 min + 透明度；nuclear 加大小 + 透明度
- [x] 17 新 test (data/__tests__/hazardLoaders.test.ts)

### B.3+B.4 — overlayRegistry + hooks + App.tsx wiring（done）

- [x] overlayRegistry：lightning halo (blur 電光) + core；nuclear halo + core，stale 虛邊框
- [x] `useHazardLayer.ts`：useLightningLayer(map, visible, minutes) + useNuclearLayer(map, visible)
      共用 useSourceFeed helper（style.load 重 feed）
- [x] App.tsx 接 2 hook
- [x] useMapInteraction GIS_LAYERS 兩條
- [x] tsc -b clean / 全套 126 test pass

### B 暫不做（v2 後再加）

- **Cluster + zoom-gate**：plan 預期雷雨季升級項；OverlayConfig 沒 cluster 欄要先擴 schema。
  v1 用時間窗 5~360 min slider 控制 payload，預設 60min 通常 ≤ 數百筆。
- Monitor HazardCard（過去 1h 閃電數 / 核安異常站數 KPI）— 等 B 視覺驗收後再做

## Phase C — 高壓電網兩件套（done，待視覺驗收）

> 範圍校正：substations 已在 Energy MVP 上線（migration 216 + useEnergyPoiLayer），
> Phase C 實際只新增 **lines + towers** 兩件套。substations 留既有色不動。

### C.1 — migration 228 + RPC 驗證

- [x] `../gis-platform/migrations/228_osm_power_grid_rpc.sql`：
      - `get_osm_power_lines()` RETURNS TABLE（osm_id/line_type/voltage/circuits/operator/frequency/location + geom_json）
      - `get_osm_power_towers()` RETURNS TABLE（osm_id/voltage/operator/material/design/ref + lon/lat）
      - 兩 RPC `GRANT EXECUTE TO anon, authenticated`
- [x] psql apply 0 error
- [x] 驗：lines 2,305 rows / 1.69 MB payload；towers 26,589 rows（PostgREST 走 TABLE 不撞 20k JSONB cap）

### C.2 — types + loader + paint + UI 接線（合併 commit）

合併原因：3 個 ratchet（LAYER_COLORS / LEGEND_REGISTRY / useTransportParams cases）會擋拆 commit。

- [x] `types/index.ts`：LayerVisibility 加 `osmPowerLines` / `osmPowerTowers`，FeatureInfo.layerType 加 `osmPowerLine` / `osmPowerTower`
- [x] `OverlayLayerSpec` 擴 `filter?: unknown[]`（同 source 多 layer 各自 sub-filter）+ `overlayManager` spec.filter 優先於 config.filter
- [x] `energyLoader.ts`：
      - `OsmPowerLine` / `OsmPowerTower` interface + `fetchOsmPowerLines` / `fetchOsmPowerTowers`（cachedOnce 60min）
      - 純函式 `parseVoltageKv("161000;69000") → [69, 161]`
      - 純函式 `powerLineTierKv(voltage) → 345 | 161 | 69 | 0`
      - `POWER_LINE_VOLTAGE_COLORS` cyan 系（345=#67e8f9 / 161=#22d3ee / 69=#0ea5e9 / mixed=#475569）
- [x] `useEnergyPoiLayer.ts` 加 showPowerLines / showPowerTowers + powerLinesToGeoJSON / powerTowersToGeoJSON（在 properties 寫 tier）
- [x] `overlayRegistry.ts`：
      - osmPowerLines 3 layer：glow（全吃 line blur）+ core（filter `!= cable`，line/minor_line 走 match width/opacity）+ cable（filter `== cable`，dasharray [2,2]）
      - osmPowerTowers 1 layer：circle minzoom 13，color by tier match
- [x] `layerCatalog.ts`：ENERGY section 加兩條 + LAYER_COLORS 兩色（cyan/sky）
- [x] `IconRailSidebar.tsx`：lucide `Spline`（lines）+ `TowerControl`（towers）
- [x] `useTransportParams.ts`：4 slider（lines opacity/width + towers opacity/size）+ return + deps
- [x] `useMapInteraction.ts` GIS_LAYERS 兩條（lines→osmPowerLine / towers→osmPowerTower）
- [x] `energyPanels.tsx`：`OsmPowerLinePanel` + `OsmPowerTowerPanel`（fmtVoltageKv "161000;69000" → "69 / 161 kV"）
- [x] `registry.tsx` panel + label
- [x] `LegendPanel.tsx`：`PowerGridLegend`（4 tier 色 + 3 線型 + "鐵塔需 zoom ≥ 13" + "約 60% 線未標電壓" 警語）
- [x] `App.tsx` 接 hook
- [x] 新測 `energyLoader.test.ts` 9 cases（parseVoltageKv 6 + powerLineTierKv 3 含邊界 60/150/300 kV）
- [x] `npx tsc -b` 0 error
- [x] `npx vitest run` 全 14 檔 / 155 cases pass（含 layerConsistency）

### C 暫不做（plan 也未列）

- substations operator filter toggle（plan 提的 showNonTaipower）— Energy MVP 既有 layer 未拆，要動會牽連 v1 PR #23，留 v3 評估
- towers 預期 ~26k 點全量載入 5MB+ JSON，前端 setData 一次性 OK；若實測卡頓再考慮 PMTiles（屬 E-E 範疇）

## 已知不對齊（追加 plan 對比）

- `docs/energy-v2-plan.md` §B 強調 cluster，B.3 暫用 zoom-gate 著色不做 mapbox cluster。
  雷雨季實測超過 5000 點 / 卡頓再升級。
- §B `is_stale + 高劑量 = 灰色 stroke` 用「虛邊框」實作（plan 寫 stroke，做 stroke-width 1.5 + 灰色）。
