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

### A.2 — Timeline isolation + 5min refresh integration test（next）

- 確認 timeline scrub 不影響 PowerCard（PowerCard 一律顯示「最新」而非 scrub 時間）
- 觀察開啟 monitor + 同時 toggle map energy layer 時 RPC 只跑一次
- 加 KPI mini-cards（fuel mix 比例 / 24h peak load）

## 已知不對齊

- `docs/energy-v2-plan.md` §A 提到 `energyDashboardActive` 要納 monitor signal；
  A.1 改採 MonitorPanel 自己 poll、靠 `cachedOnce` dedup，沒動 App.tsx — 比 plan 更輕。
  若 A.2 觀察兩處 5min interval 沒對齊造成多餘呼叫，再回頭把 monitor open 狀態暴露給 App.tsx。
