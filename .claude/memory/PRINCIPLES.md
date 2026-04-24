# Principles

不用再重複溝通的預設與慣例。新增原則時註明日期。

## 專案預設（溝通層）

- **回應語言**：繁體中文，技術術語保留英文
- **基準時區**：UI 顯示一律台灣時間（UTC+8）；DB 與 API 內部一律 UTC unix epoch
- **台北日期字串**：`Date.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" })` 得到 `YYYY-MM-DD`

## 技術棧

- Frontend：React 19 + TypeScript + Vite
- Map：Mapbox GL JS v3
- 3D：Three.js（透過 Mapbox CustomLayerInterface）
- Data：Supabase（`gis-platform` 專案）
- Dev port：3721

## 技術慣例

- **Python / pip**：一律 `python3` / `pip3`，不是 `python` / `pip`
- **TypeScript 驗證**：`npx tsc -b`（project references），**不要**用 `tsc --noEmit`（漏檢）
- **Commit 前必跑** `npx tsc -b`
- **Commit message**：繁體中文 + conventional commits prefix（feat/fix/docs/refactor）
- **Inline styles**：UI 用 inline styles，所有元件支援 `isDarkTheme`
- **Shell 腳本不依賴 jq**：macOS 預設無 jq（需 Homebrew 另裝）。組 JSON 一律用
  `python3 - <<'PY' ... PY` heredoc。寫外部工具依賴前先 `command -v <tool>` 檢查。
  範例：`.claude/memory/load-session.sh`。

## 資料來源管理

- **動態資料**（時序 / 即時）→ Supabase RPC（`public.*`）
- **靜態資料** → `public/*.geojson`（由 S3 deploy-assets 管理，**扁平檔名契約**不要改路徑）
- **前端禁止直接打** `realtime.*` schema，一律透過 `public` RPC wrapper
- Schema 分工：
  - `realtime`（時序）
  - `reference`（參考表，如時刻表、水庫 metadata）
  - `spatial`（空間分析，H3 等）
  - `public`（對外 RPC + 靜態空間表）
- `VITE_DATA_SOURCE=supabase` 啟用 Supabase；否則用 Pulse API（FastAPI+DuckDB 備援）

## Loading UI 強制（⚠ P0）

**所有** Supabase 非同步載入都必須透過 `src/lib/loadingRegistry.ts`：

- 初次載入 / 切換 timeline 日期 / Toggle 圖層都要註冊 loading task
- Loader 包 `withLoading(id, label, promise)` 或手動 `start()` / `complete()`
- 範例：`src/data/freewayLoader.ts` + `src/hooks/useFreewayLayer.ts`
- **禁止**靜默 `supabase.rpc().then()`

## 動態圖層時間訂閱（⚠ P0）

動態 / 時序圖層**禁止**把 `currentTime` 放進 React `useEffect` / `useMemo` deps，
**必須**透過 `src/state/timeStore.ts` 訂閱：

| 場景 | API |
|---|---|
| RAF / per-frame 動畫 | `timeStore.getTime()` 同步讀 |
| Filter / lookup | `timeStore.subscribeThrottled(ms, cb)` |
| 跨日重載資料 | `timeStore.subscribeDate(cb)` |
| UI 顯示 | `useSyncExternalStore` + `subscribeThrottled(250)` |

Hook 參數表**不收** `currentTime`。理由與節流表見 `docs/development-rules.md#8`。

## Supabase 優化（Pre-aggregate Pattern）

RPC 響應 > 1s 或回傳 > 10k rows → **必須**套 pre-aggregate pattern：

- 普通 table + per-day refresh function + pg_cron + 薄 SELECT RPC
- 先跑 `EXPLAIN (ANALYZE, BUFFERS)` 確認是 plan 問題還是資料量
- SQL 範本：`../data-collectors/docs/sql/matview_*.sql`
- Supabase pooler 強制 2min timeout **不能繞**，只有 pg_cron 例外
- 完整 pattern + 坑點：`docs/supabase-optimization.md`

**效能守則**（2026-04-10 bus trails OOM 教訓）：

- refresh function 的 WHERE + ORDER BY **必須有對應索引**（缺索引 = 全表 sort = OOM）
- today + yesterday 放**同一個 cron job 循序跑**（禁止拆成兩個獨立 job）
- 聚合用 `MAX()` 而非 `mode()`（後者需額外 sort）
- 加 `SET work_mem TO '64MB'` 減少 disk spill
- cron 排程必須錯開分鐘（見 `data-collectors/docs/sql/cron_throttle.sql`）

## 新增 Layer 強制順序

1. `src/types/index.ts` → `LayerVisibility` 加 key
2. `src/data/xxxLoader.ts` → loader + loadingRegistry
3. `src/hooks/useXxxLayer.ts` → React hook
4. `src/map/overlayRegistry.ts` 或 `src/map/xxxCustomLayer.ts`
5. `src/components/LayerSidebar.tsx` → UI toggle + **`LAYER_COLORS` 補 key**（漏了會 tsc error）
6. `src/App.tsx` → 接線
7. `src/hooks/useLayerVisibility.ts` → 預設可見性

可用 slash command `/new-layer <name>` 自動產生骨架。

## 視覺層 debug（2026-04-22 教訓）

- **Mapbox custom layer 掛載用 polling，不要 `map.once('load')`**
  - load event 可能已經 fire 過 → 永不觸發
  - 改：`setInterval(tryAttach, 200)` 直到 `isStyleLoaded()`
  - 範例：`src/hooks/useReservoirStatusLayer.ts`

- **視覺層代碼 `tsc -b` 通過 ≠ 能動**
  - Three.js / Mapbox custom layer / WebGL 是多層非同步 gate
  - 預設在關鍵 checkpoint 加 `console.log`：
    - hook mount（visible / map ready）
    - RPC 返回（筆數 + 第一筆 sample）
    - scene.setX（input count）
    - scene.rebuild（mesh count + 第一個 instance 的 position/scale）
    - custom layer onAdd / render 第 1/60 次
  - 功能驗證後保留 log（頻率低不吵）

## 3D 效能（2026-04-23 教訓）

- **靜態 3D 圖層不要在 render 內 `triggerRepaint()`**
  - 那會產生無限 60 FPS render loop，浪費 GPU
  - 靜態幾何只在資料變動時需重畫
  - 改由 hook 在 `setStatuses` / `setActiveOps` / `heightScale` / `isDark` / `visible` 變動時主動觸發
  - 動畫型圖層（flight/bus/rail per-frame 位置插值）才需要 render 內 triggerRepaint

- **InstancedMesh 的 fast path**
  - 站點組不變時只更 matrix/color，不 dispose/recreate meshes
  - 避免 timeline 回放 per-tick GPU buffer 重建造成閃爍

## 時區處理（Timeline）

- Timeline 內部用**真實 UTC unix epoch**（不是台灣時間字串）
- `dayStartUnix(taiwan_date)` = `Date.UTC(...) - 8*3600`
- Supabase 回 epoch → `EXTRACT(EPOCH FROM collected_at)::bigint`
- 前端直接拿 epoch 比對 `timeStore.getTime()`，不做字串轉換

## 水庫分母 / alert key（2026-04-22 教訓）

- **蓄水率分母用 `current_capacity_wan`（現行有效容量，扣淤積），不是 `effective_capacity_wan`（設計）**
  - 霧社淤積 81%，分母用錯會從 66% 變 12%
  - view `reservoir_situation_v` 已修（migration 056）
- **`alert_level` 是英文 key**：`critical/warning/normal/high`
  - 前端 `ALERT_COLOR_HEX` / `ALERT_COLORS` 一律英文 key
  - 中文只在 display label 層用（`ALERT_LABELS: 嚴重/偏低/正常/滿水`）

## Git 慣例

- 每個邏輯單位一個 commit
- 要 commit 前 stage 特定檔案（`git add src/x.ts`），**不要** `git add -A` 或 `.`
- Memory 系統 commit 用 `memory:` prefix，atomic（一檔一 commit）
- 不自動 push，push 由用戶決定

## 記憶系統原則

- `.claude/memory/` **commit 進 git**，英文檔名、繁中內容
- Session 開頭讀 `memory/STATUS.md` → `BACKLOG.md` → `PRINCIPLES.md`
- Session 結束用 `/wrap-up` skill 自動更新
- INCIDENTS / REFLECTIONS **只 append**，不改舊條目
- STATUS 每次 rewrite（只保留當下）

- **有實質 commit 後主動更新 STATUS + BACKLOG，不等 /wrap-up**（2026-04-24 教訓）
  - **判準**：本 session 至少 commit 1 個 feature / 架構改動 → STATUS 必須同 session rewrite
  - **觸發時機**（任一即做）：
    - (a) 連續 commit 告一段落，用戶說「ok 繼續 / 下一步」前先更新
    - (b) 用戶問「記錄了嗎 / 進度如何 / 目前狀態」→ 代表該更新了
    - (c) 用戶說收工 / 結束 / 暫停，啟動 /wrap-up 前先 draft STATUS
  - **必改兩檔**：
    - `STATUS.md`：rewrite 成當下狀態（本次完成 / commits / 未 push / 待辦 / 下一步）
    - `BACKLOG.md`：把剛完成的項目標 done + 補近期 10 筆
  - **為什麼**：STATUS 被 SessionStart hook inline 到下次 session context。
    漏更新 = 下次 Claude 看到的是昨天狀態，會誤判「已完成」為「待辦」，或
    錯判 commits 數量。這條教訓來自 2026-04-24 session：做完 4 commit 後
    只更新 BACKLOG 忘了 STATUS，用戶要問一次才補。

## 行為原則（Claude 自律）

- **不盲信 memory**：涉及「某資料是否存在」「某機場 / 水庫是否已抓」類判斷，
  先 `Grep` / `Read` / `psql` 驗證現況，不靠記憶
- **成本估算要標示來源**：寫「實測」或「估算」，不混淆
- **改上游資料 pipeline → 下游全查**：`grep -r` 所有消費端，避免漏改
- **動手前先調查上游資料結構**：PostGIS 空間 JOIN 前先查是否有 outlier
  （2026-04-22 river_lines 2,445km outlier 教訓）
- **分階段驗證**：一次改 8+ 檔才跑 tsc + 瀏覽器實測會卡死，每 3-4 檔 smoke test
- **遇到卡點停下來問使用者選路**，列 A/B 方案，不自己選一個走下去
