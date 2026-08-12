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
| `/new-layer <name>` | 新增 layer 骨架（強烈建議走，免漏 manifest/spec/邏輯檔三步 + 四鐵則） |
| `/check-rpc <name>` | 自動 EXPLAIN 判斷 RPC 效能 |

## 必守規則

### 1. TypeScript 驗證

`npx tsc -b`（project references，禁用 `--noEmit`）— commit 前必跑。

### 2. 資料來源管理
資料來源契約（動態走 `public.*` RPC / 靜態走 `public/*.geojson` / 禁前端直打 `realtime.*`）→ [`docs/development-rules.md`](./docs/development-rules.md) §1

### 3. 資料載入必須有 Loading UI ⚠️
所有非同步載入必註冊 loadingRegistry，禁靜默 `.rpc().then()` → development-rules §2

### 4. 資料庫優化（Pre-aggregate Pattern）
RPC >1s 或 >10k rows 必套 pre-aggregate → [`docs/supabase-optimization.md`](./docs/supabase-optimization.md) + `/supabase-optimize` skill + `/check-rpc`

### 5. 新增 Layer 強制順序 ⚠️
新增 Layer → `/new-layer` 產骨架 + `layer-onboarding` skill 驗收；接線順序見 development-rules §4。
**AR-22 Phase 4 起登記簿不再手寫**：一筆 `layerManifest.ts` entry ＋ 一筆 `layerParamsSpec.ts` 規格派生 6 張表，你只寫實質邏輯（loader / hook / overlay）。`layerConsistency` 測試驗 manifest 完整性（沒 entry / 欄位空殼 / 用 `null` 靜默豁免鐵則 → 紅）。

### 5a. 圖層 UX 四鐵則（⚠️ 缺一不可）
圖層 UX 四鐵則（opacity / 圖例 / popup / select）→ development-rules §4a + layer-onboarding Step 3-4

### 6. 動態圖層時間訂閱（⚠️ 強制）
動態圖層**禁止**把 `currentTime` 放進 deps，一律走 timeStore 訂閱 → development-rules §8 + [`docs/TIMELINE_ARCHITECTURE.md`](./docs/TIMELINE_ARCHITECTURE.md)

## Git Workflow（GitHub Flow）

- branch 命名 / PR 流程 / hotfix 判準 → [`docs/git-workflow.md`](./docs/git-workflow.md)
- PR 描述用 `.github/pull_request_template.md`（`gh pr create` 自動帶入）
- commit 遵循 Conventional Commits；本專案特例 `memory:` 用於 `.claude/memory` 更新

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
