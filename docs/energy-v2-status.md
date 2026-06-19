# Energy v2 — 進度追蹤

> 接續 `energy-v2-plan.md`。每 phase commit 一次、不 push、不 merge（等用戶 review）。
> 分支：`feat/energy-v2-A`。

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

## 已知不對齊（追加 plan 對比）

- `docs/energy-v2-plan.md` §B 強調 cluster，B.3 暫用 zoom-gate 著色不做 mapbox cluster。
  雷雨季實測超過 5000 點 / 卡頓再升級。
- §B `is_stale + 高劑量 = 灰色 stroke` 用「虛邊框」實作（plan 寫 stroke，做 stroke-width 1.5 + 灰色）。
