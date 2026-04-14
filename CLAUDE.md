# Mini Taiwan Pulse — 開發規則

> React 19 + TypeScript + Vite (port 3721) · Mapbox GL + Three.js · Supabase (gis-platform)
>
> 詳細版規則見 [`docs/development-rules.md`](./docs/development-rules.md)

## 必守規則

### 1. TypeScript 驗證
```bash
npx tsc -b   # project references，禁用 --noEmit
```
Commit 前必跑。

### 2. 資料來源管理
- **動態資料**（時序 / 即時）→ Supabase RPC（`public.*`）
- **靜態資料** → `public/*.geojson`（由 S3 deploy-assets 管理，**扁平檔名契約**不要改路徑）
- 前端禁止直接打 `realtime.*` schema，一律透過 `public` RPC wrapper
- Schema 分工：`realtime`（時序）/ `reference`（參考）/ `spatial`（空間）/ `public`（對外 RPC）
- 詳見 [`docs/development-rules.md#1-資料來源管理`](./docs/development-rules.md#1-資料來源管理)

### 3. 資料載入必須有 Loading UI ⚠️
**所有** Supabase 非同步載入都必須註冊 loading task：
- 初次載入 / 切換 timeline 日期 / Toggle 圖層
- Loader 使用 `src/lib/loadingRegistry.ts`，包 `start()` / `complete()`
- 範例看 `src/data/freewayLoader.ts` + `src/hooks/useFreewayLayer.ts`
- 禁止靜默 `supabase.rpc().then()`

### 4. 資料庫優化（Pre-aggregate Pattern）
RPC 響應 > 1s 或回傳 > 10k rows → **必須**套 pre-aggregate pattern：
- 普通 table + per-day refresh function + pg_cron + 薄 SELECT RPC
- 先跑 `EXPLAIN (ANALYZE, BUFFERS)` 確認是 plan 問題還是資料量
- SQL 範本：`../data-collectors/docs/sql/matview_*.sql`
- Supabase pooler 強制 2min timeout **不能繞**，只有 pg_cron 例外
- 完整 pattern + 坑點：[`docs/supabase-optimization.md`](./docs/supabase-optimization.md)
- 可用 slash command `/check-rpc <name>` 自動 EXPLAIN 判斷
- **效能守則**（2026-04-10 bus trails OOM 教訓）：
  - refresh function 的 WHERE + ORDER BY **必須有對應索引**（缺索引 = 全表 sort = OOM）
  - today + yesterday 放**同一個 cron job 循序跑**（禁止拆成兩個獨立 job）
  - 聚合用 `MAX()` 而非 `mode()`（後者需額外 sort）
  - 加 `SET work_mem TO '64MB'` 減少 disk spill
  - cron 排程必須錯開分鐘（見 `data-collectors/docs/sql/cron_throttle.sql`）

### 5. 新增 Layer 強制順序
1. `src/types/index.ts` → `LayerVisibility` 加 key
2. `src/data/xxxLoader.ts` → loader + loadingRegistry
3. `src/hooks/useXxxLayer.ts` → React hook
4. `src/map/overlayRegistry.ts` 或 `src/map/xxxCustomLayer.ts`
5. `src/components/LayerSidebar.tsx` → UI toggle + **`LAYER_COLORS` 補 key**（漏了會 tsc error）
6. `src/App.tsx` → 接線
7. `src/hooks/useLayerVisibility.ts` → 預設可見性

可用 slash command `/new-layer <name>` 自動產生骨架。

### 6. 動態圖層時間訂閱（⚠️ 強制）
動態 / 時序圖層**禁止**把 `currentTime` 放進 React `useEffect` / `useMemo` deps；
**必須**透過 `src/state/timeStore.ts` 訂閱：

- RAF / per-frame：`timeStore.getTime()` 同步讀
- filter / lookup：`timeStore.subscribeThrottled(ms, cb)`（ms 依粒度設定）
- 跨日載入：`timeStore.subscribeDate(cb)`
- UI 顯示：`useSyncExternalStore` + `subscribeThrottled(250)`

Hook 參數表**不收** `currentTime`。理由與節流表見 [`docs/development-rules.md#8-動態圖層時間訂閱`](./docs/development-rules.md#8-動態圖層時間訂閱external-time-store)。

## 目錄規則

| 用途 | 位置 |
|---|---|
| Supabase fetcher | `src/data/*Loader.ts` |
| Layer hook | `src/hooks/use*Layer.ts` |
| Three.js scene | `src/three/*Scene.ts` |
| Custom WebGL layer | `src/map/*CustomLayer.ts` |
| 靜態 GeoJSON | `public/` (扁平) |
| 預處理腳本 | `scripts/preprocess/` |
| S3 部署腳本 | `scripts/deploy/` |
| 外部 API fetch | `scripts/fetch/` |
| DB 匯出 | `scripts/export/` |

## 環境變數

| 變數 | 用途 |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | 前端 |
| `SUPABASE_SERVICE_ROLE_KEY` | 腳本（禁止進 bundle） |
| `SUPABASE_DB_URL` | psql 直連 |
| `VITE_DATA_SOURCE=supabase` | 啟用 Supabase（否則用 Pulse API） |

## 參考文件

- [`docs/development-rules.md`](./docs/development-rules.md) — 規則詳細版 + 範例
- [`docs/supabase-optimization.md`](./docs/supabase-optimization.md) — Pre-aggregate pattern 完整指南
- [`docs/supabase_rpc_audit.md`](./docs/supabase_rpc_audit.md) — RPC 效能盤點
- [`docs/TIMELINE_ARCHITECTURE.md`](./docs/TIMELINE_ARCHITECTURE.md) — 時間軸架構
- [`docs/bus-layer-design.md`](./docs/bus-layer-design.md) — 公車 progress-based 架構 + 全台擴展指南
- [`docs/known-issues.md`](./docs/known-issues.md) — 歷史 bug + 診斷指令

## 關聯專案

| 專案 | 路徑 | 用途 |
|---|---|---|
| gis-platform | `../gis-platform` | Supabase migrations |
| data-collectors | `../data-collectors` | 資料收集 + SQL 範本 |
| pulse-api | `../pulse-api` | FastAPI 備援 |
| mini-taipei-v3 | `../mini-taipei-v3` | 鐵道資料來源 |
