# Mini Taiwan Pulse — 開發規則

> React 19 + TypeScript + Vite (port 3721) · Mapbox GL + Three.js · Supabase (gis-platform)
>
> 詳細版規則見 [`docs/development-rules.md`](./docs/development-rules.md)
>
> **與全域準則的優先級**：全域 `~/.claude/CLAUDE.md` 已含通用開發準則（Think Before Coding / Simplicity / Surgical / Goal-Driven）；本檔為專案具體化規則，衝突時以下方為準（特別是 Simplicity 對「新增 Layer 7 步驟 + UX 四鐵則」、Surgical 對「跨檔 register 多處」的例外）。不確定算不算違反專案鐵則時，先問用戶。

## Session 記憶迴圈

SessionStart hook 自動 inline `STATUS` / `BACKLOG` / `PRINCIPLES`；似曾相識的 bug → 搜 [`.claude/pitfalls/`](./.claude/pitfalls/)；大段落完成 → `/wrap-up` 更新 9 檔（P0→PRINCIPLES / 事件→INCIDENTS / bug 長文→pitfalls）。框架機制：[`.claude/FRAMEWORK.md`](./.claude/FRAMEWORK.md)。

## 常用指令

| 指令 | 用途 |
|---|---|
| `pnpm dev` / `npm run dev` | 啟動 dev server (port 3721) |
| `npx tsc -b` | TypeScript 驗證（commit 前必跑，禁用 `--noEmit`） |
| `pnpm test` | 跑測試（含 `layerConsistency` 擋漏接圖例） |
| `/new-layer <name>` | 新增 layer 骨架（強烈建議走，免漏 7 步 + 四鐵則） |
| `/check-rpc <name>` | 自動 EXPLAIN 判斷 RPC 效能 |

## 必守規則

### 1. TypeScript 驗證

`npx tsc -b`（project references，禁用 `--noEmit`）— commit 前必跑。

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
- **效能守則**（2026-04-10 bus trails OOM 教訓）：refresh function 必有 WHERE/ORDER BY 對應索引 + today+yesterday 同 cron 循序 + `MAX()` 取代 `mode()` + `SET work_mem TO '64MB'` + cron 錯開分鐘。完整 5 條：[`docs/supabase-optimization.md#oom`](./docs/supabase-optimization.md)

### 5. 新增 Layer 強制順序 ⚠️

**任何 layer 相關工作（新增 / 修改 / 除錯 / UX 調整）→ 一律先跑 `layer-onboarding` skill**。它會引導 7 步 SOP + UX baseline + 跨 repo 對齊。CLAUDE.md 只列強制順序，決策細節走 skill。
1. `src/types/index.ts` → `LayerVisibility` 加 key
2. `src/data/xxxLoader.ts` → loader + loadingRegistry
3. `src/hooks/useXxxLayer.ts` → React hook
4. `src/map/overlayRegistry.ts` 或 `src/map/xxxCustomLayer.ts`
5. `src/components/sidebar/layerCatalog.ts` → **`LAYER_COLORS` 補 key**（漏了會 tsc error TS2739）+ `SECTIONS` 對應分區加 key（單一真實來源，桌機 IconRailSidebar 與手機 LayerSidebar 同時生效）；UI toggle 渲染仍在兩個 sidebar 元件
6. `src/App.tsx` → 接線
7. `src/hooks/useLayerVisibility.ts` → 僅「預設開啟」才需加 `DEFAULT_ON`（預設 false 自動派生）

可用 slash command `/new-layer <name>` 自動產生骨架。

### 5a. 圖層 UX 四鐵則（⚠️ 缺一不可）

任何新 layer 都必須過：

1. **透明度 slider** — `useTransportParams.ts` 提供 opacity slider
2. **分類 ≥ 2 種 → 必寫圖例** — `LegendPanel.tsx` sub-component + `LEGEND_REGISTRY` 加行（`layerConsistency` 測試會擋）
3. **可選取物件 → 必接 click popup** — `useMapInteraction.ts` / `featureInfo/registry.tsx` 各加行；PMTiles `keep_attrs` 要在 `taipei-gis-analytics` 先補齊重出
4. **Select options ≥ 4 → 原生 `<select>` dropdown** — sidebar narrow column 橫向 button row 必爆版，`ctrl.options.length > 3` 自動切

完整實作細節（type 抽檔策略 / dropdown 寬度閾值 / PMTiles 重出 SOP）：[`docs/development-rules.md#4a-圖層-ux-標配四大鐵則`](./docs/development-rules.md#4a-圖層-ux-標配四大鐵則)。

### 6. 動態圖層時間訂閱（⚠️ 強制）
動態 / 時序圖層**禁止**把 `currentTime` 放進 React `useEffect` / `useMemo` deps；
**必須**透過 `src/state/timeStore.ts` 訂閱：

- RAF / per-frame：`timeStore.getTime()` 同步讀
- filter / lookup：`timeStore.subscribeThrottled(ms, cb)`（ms 依粒度設定）
- 跨日載入：`timeStore.subscribeDate(cb)`
- UI 顯示：`useSyncExternalStore` + `subscribeThrottled(250)`

Hook 參數表**不收** `currentTime`。理由與節流表見 [`docs/development-rules.md#8-動態圖層時間訂閱`](./docs/development-rules.md#8-動態圖層時間訂閱external-time-store)。

## Git Workflow（GitHub Flow）

單人開發，採 GitHub Flow：`master` = 生產、`feat/*` 分支 → PR → squash 進 master。

### Branch 命名

| Prefix | 用途 | 何時用 |
|---|---|---|
| `feat/<slug>` | 新功能 / 新 layer | 加東西 |
| `fix/<slug>` | Bug 修 | 修東西 |
| `perf/<slug>` | 效能 | 只改效能不改行為 |
| `docs/<slug>` | 文件 | 純文件 |
| `chore/<slug>` | 建置 / 依賴 / 雜項 | 沒有 user-facing 變更 |
| `hotfix/<slug>` | 線上緊急 | 上線後立即修 |

`<slug>` 用 kebab-case，對應 `docs/features/<slug>/` 資料夾名。

### Commit prefix（沿用 Conventional Commits）

`feat / fix / perf / docs / memory / chore / refactor / test`

**特殊 prefix**：
- `memory:` — `.claude/memory/` 或 `~/.claude/projects/*/memory/` 的變更
- 專案已用範例（近期 log）：`memory:`, `docs:`, `perf:`, `fix:`, `feat:`

### PR 流程

1. 開 feat branch：`git checkout -b feat/<slug>`
2. 開跑同時 `cp -r docs/features/_TEMPLATE docs/features/<slug>` 建功能檔案
3. 若動到跨 repo 資料契約 → **先開 upstream handoff**：`taipei-gis-analytics/docs/handoff/<slug>.md`
4. 完成 → `npx tsc -b` + `pnpm test` 全綠
5. `gh pr create` — PR 描述用下列模板
6. Squash merge 進 master
7. 更新 `docs/features/<slug>/changelog.md` 記錄 PR # + squash hash

### PR 描述模板

```
## Summary
- <一句話>

## Changes
- <每個檔案或每個小段的變更>

## Test
- [ ] npx tsc -b 通過
- [ ] pnpm test 通過
- [ ] Browser 驗收（若有 UI）

## Risk / Rollback
- <風險>
- <回滾方式>

## Related
- Feature: docs/features/<slug>/
- Upstream handoff: taipei-gis-analytics/docs/handoff/<slug>.md
- ADR: (若有)
```

### 何時開 hotfix、何時走正常 feature flow

- **hotfix**：線上炸了、用戶感知（例如 Supabase 打掛、layer 全消失） → `hotfix/<slug>` → 快速 PR + squash
- **正常**：其他一律走 `feat/fix/perf/docs`

### 跨 repo 同步順序（有資料契約變動時）

**上游先動、下游後動**：
1. taipei-gis-analytics：pipeline 改 + `docs/handoff/<slug>.md` 更新 + push
2. gis-platform：migration 補 + push
3. data-collectors：若涉 collector 改 + push
4. mini-taiwan-pulse：前端接線 + `docs/features/<slug>/handoff.md` 反向引用 + PR

反向亂序會造成「上線時前端硬依賴的欄位不存在」。

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

## 相關資源

| 類型 | 路徑 | 用途 |
|---|---|---|
| 規則 | [`docs/development-rules.md`](./docs/development-rules.md) | 詳細版 + 範例（含 §4a 四鐵則完整） |
| 規則 | [`docs/supabase-optimization.md`](./docs/supabase-optimization.md) | Pre-aggregate pattern 完整指南 + OOM 5 條 |
| 規則 | [`docs/TIMELINE_ARCHITECTURE.md`](./docs/TIMELINE_ARCHITECTURE.md) | 時間軸 / timeStore 架構 |
| 參考 | [`docs/supabase_rpc_audit.md`](./docs/supabase_rpc_audit.md) | RPC 效能盤點 |
| 參考 | [`docs/bus-layer-design.md`](./docs/bus-layer-design.md) | 公車 progress-based 全台擴展 |
| 參考 | [`docs/known-issues.md`](./docs/known-issues.md) | 歷史 bug + 診斷指令 |
| 參考 | [`docs/research/`](./docs/research/) | 決策軌跡 / 跨系統比對 / 故事 cookbook |
| 關聯 repo | `../gis-platform` | Supabase migrations |
| 關聯 repo | `../data-collectors` | 資料收集 + SQL 範本 |
| 關聯 repo | `../pulse-api` | FastAPI 備援 |
| 關聯 repo | `../mini-taipei-v3` | 鐵道資料來源 |
