# Principles

不用再重複溝通的預設與慣例。新增原則時註明日期。

## ⚠️ P0 開發流程強制觸發（2026-07-01）

**任何涉及 layer / 資料接線的工作，強制先跑 `layer-onboarding` skill**。

觸發條件（其中一項成立就要跑）：
- 新增 / 修改 layer（不管走 `/new-layer` 產骨架與否）
- 從 taipei-gis-analytics 拿到新資料要接
- Layer 顯示異常（點少了 / popup 空 / legend 錯）
- 討論 UX 設定（radius / opacity / cluster / min-zoom）
- 跨 repo 資料契約有變

**強制附加流程**：
1. 先開 `docs/features/<slug>/` 資料夾（`cp -r docs/features/_TEMPLATE ...`）
2. 若涉資料契約 → 先開 `taipei-gis-analytics/docs/handoff/<slug>.md`
3. 若涉架構決策 → 開 ADR `taipei-gis-analytics/docs/adr/NNNN-*.md`
4. 走 GitHub Flow branch：`feat/<slug>` / `fix/<slug>` / `perf/<slug>`（見 CLAUDE.md §Git Workflow）

**Why**：層層漏項是最常見 bug 根因（PMTiles keep_attrs / LAYER_COLORS / legend / popup / cross-repo drift）。
**How to apply**：Session 開頭讀到本條 = 之後任何 layer 對話都先觸發 skill。

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
- **Commit 前必跑 `git branch --show-current`**：SessionStart auto-memory-cherry-pick hook
  會在 session 中段把 HEAD 切回 master 而不通知。任何 commit / 跨 phase 切換 / 上次互動隔了
  幾分鐘都先確認分支。reflog 連續看到 `cherry-pick: memory:` + `checkout: moving from <feat>
  to master` = hook 觸發，立刻 `git checkout <feat>`。（2026-06-19 Energy v2 事件）
- **layerConsistency-class ratchet → 拆 commit 限制**：純資料層 commit 若會讓
  layerConsistency / featureInfo registry / LegendPanel 等 ratchet 測試紅燈，
  必須與「UI 接線 commit」合成一次（例：B.1 types/loader + B.2 Legend/Panel/params
  一同送）。事前盤點：新 layer key 進 LayerVisibility → 自動觸發 5 條 ratchet（LAYER_COLORS
  / SECTIONS / LEGEND_REGISTRY 或 BASELINE / PANEL_REGISTRY 或 BASELINE / useTransportParams
  case 或 BASELINE），缺一 fail。
- **Commit message**：繁體中文 + conventional commits prefix（feat/fix/docs/refactor）
- **Inline styles**：UI 用 inline styles，所有元件支援 `isDarkTheme`
- **Shell 腳本不依賴 jq**：macOS 預設無 jq（需 Homebrew 另裝）。組 JSON 一律用
  `python3 - <<'PY' ... PY` heredoc。寫外部工具依賴前先 `command -v <tool>` 檢查。
  範例：`.claude/memory/load-session.sh`。

## React Hook 慣例

- **`useSyncExternalStore` 的 `getSnapshot` 必須回快取值**（同一 store 狀態多次呼叫
  必回相同 reference / 相同 primitive）。不可 `() => Date.now()`、
  `() => new Map(...)`、`() => arr.map(...)` 等即時計算 → 會無限 re-render。
  正確做法：store 內部維護快取，timer / event 觸發時更新快取 + 通知；或乾脆
  用 `useState + useEffect(subscribe)` 取代。（2026-06-18 useWallClock 事件）
- **動態圖層時間訂閱**：`currentTime` 禁入 `useEffect` / `useMemo` deps，必走
  `timeStore.subscribeThrottled` / `subscribeDate` / `getTime()`（CLAUDE.md §6）
- **掛鐘時間（Date.now）**：走 `wallClock.subscribeWallClock(ms)` + `useWallClock(ms)`
  hook，不要在元件用 `useState + setInterval`（會讓整棵子樹 1Hz reconcile）

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

## render body 禁止寫入被訂閱的外部 store（⚠ P0，2026-07-22 教訓）

在 component / hook **render body**（含裸 `if`）直接呼叫 store write（`timeStore.setTime()` / 其他 `*Store.set*` / `emit`），若該 store 有被 `useSyncExternalStore` 訂閱，會 render 期間同步通知訂閱者 → React 警告「Cannot update a component (X) while rendering a different component (Y)」。**一律搬進掛載 `useEffect`**（一次性 init 用 `useRef` guard 或 `useState` lazy initializer）。此警告 remount / StrictMode / HMR 時序才穩定冒出、clean load 常隱身**易漏測**，靠「render-phase 寫被訂閱 store」結構判定即可定案。2026-07-22 全專案稽核（8 store 全 write 呼叫點 + 535 個 setState）確認唯一違規是 `useTimeline` 初始 `timeStore.setTime`（PR #79 修）；`loadingRegistry`（每 layer loader 都用）全在 async / effect / GL-loop，layer 慣例乾淨。

## Supabase PostgREST 20K cap（⚠ P0，2026-04-25 教訓）

**Supabase 對外 PostgREST 有 `db-max-rows=20000` 硬 cap**，超過悄悄切掉：
- HTTP 206 Partial Content + `content-range: 0-19999/N` header
- 無錯誤訊息，前端只拿到前 20K 行（排序決定誰被留下）
- client Range header 無法覆寫

**新 RPC 預估 rows 超過 15K** → 一律套降頻 pattern：
```sql
SELECT DISTINCT ON (station_id, date_trunc('hour', observed_at))
    ...
FROM realtime.xxx
WHERE ...
ORDER BY station_id, date_trunc('hour', observed_at), observed_at DESC
```

每站每小時最新 1 筆，對時序視覺回放無感（groundwater p50 hourly 變化
4mm，river_water_level 8.5cm/day）。

**診斷 SOP**（看到「RPC 資料看起來少一半」）：
1. `psql -c "SELECT COUNT(*) FROM public.get_xxx(...)"` 查實際列數
2. `curl -D /tmp/hdr.txt -X POST .../rpc/get_xxx` 看 `content-range`
3. 若 `N=19999` → 命中 cap，RPC 側降頻

實例：migration 060 (groundwater 78K→16.5K)、060b (river 44K→8K)。

### 解法二：Grouped JSONB（事件型資料用）

**降頻不適用**的 case（schedule stops、GTFS、event log，每筆都不能丟）→ 改成
**「每組一筆 row，items 為 JSONB array」**：

```sql
SELECT
    s.city, s.route_id,
    jsonb_agg(
      jsonb_build_object('lng', s.lng, 'lat', s.lat, 'arr', s.arrival_sec, ...)
      ORDER BY s.arrival_sec
    ) AS stops
FROM seq s
GROUP BY s.city, s.route_id;
```

實例：migration 079 schedule (39K stops → 1281 routes)、063 timeline 字串編碼
（同概念 timepoints → 字串）。

### 設計新 RPC 的決策樹（⚠ 必看）

**Step 1：估 rows 數**。預期 > 5K → 必須採取 cap 對策，不要等撞牆。

**Step 2：選 pattern**：
- **能丟**（時序 latest / hourly snapshot）→ 降頻 DISTINCT ON
- **不能丟**（事件 log / schedule stops / 完整軌跡）→ grouped JSONB

**Step 3：驗證**：
- `psql -c "SELECT COUNT(*) FROM public.get_xxx(...)"`
- `curl -D /tmp/hdr.txt` 看 `content-range`
- 前端 console.log fetched 數，跟 psql 比

**Step 4：寫 GLOSSARY 註明**「避 PostgREST 20K cap」+ 哪個 pattern。下次同類
case 一查就知道用哪招。

## Catmull-Rom 平滑只用於真實連續軌跡（2026-05-10 教訓）

**規則**：4 控制點 spline 平滑只用於 **GPS / 真實連續軌跡**，不要套到「邏輯
順序但非地理連續」的點序列（schedule stops、stops 直線連接 之類）。

**原因**：spline 假設 4 點是「真的可達彼此」的連續路徑。schedule stops 順序是
時間先後（早班 8:00 → 9:00 → 10:00），但這 4 個點地理上可能 Z 字形 → spline
會 overshoot 飛出兩相鄰直線之外 → 視覺上車「往回退一點再前進」。

**對策**：
- 真實軌跡（GPS）→ Catmull-Rom 平滑曲線（看起來像沿馬路）
- 邏輯點序列（schedule, 事件 timeline）→ 直線插值，車「穿牆」但不反向 overshoot
- 想要「沿馬路」感 → OSRM /route 投影到真實 polyline，再用 progress-based 插值
  （非 spline 平滑）

實例：`WasteScheduleScene` (schedule, 直線) vs `WasteTruckScene` (GPS, Catmull-Rom)。

## 跨站可比視覺指標（2026-04-25 教訓）

監測站圓圈 **circle-radius / circle-color 不要綁原始絕對值**，尤其是
水位、海拔、標高類指標 — 各站基準差異大（井口高度、河床高度）跨站
無意義，timeline 拖動絕對值幾乎不變。

**改用 delta_since_day_start**（當前讀值 − 當日最早讀值）：
- 跨站可比（都是 cm 級變動量）
- Timeline 撥放時數值才會動 → 視覺才有故事
- 色階用 ±2cm / ±10cm / ±30cm 分層（紅下降 / 灰穩定 / 藍上升）
- `check_result=0` 之類異常站用另一色覆寫（case expression）

實例：`useGroundwaterLayer` / `useRiverLevelLayer`
（歷史夠長後可升級到 vs 30-day baseline 的 anomaly %）。

## Supabase 優化（Pre-aggregate Pattern）

RPC 響應 > 1s 或回傳 > 10k rows → **必須**套 pre-aggregate pattern：

- 普通 table + per-day refresh function + pg_cron + 薄 SELECT RPC
- 先跑 `EXPLAIN (ANALYZE, BUFFERS)` 確認是 plan 問題還是資料量
- SQL 範本：`../data-collectors/docs/sql/matview_*.sql`
- Supabase pooler 強制 2min timeout **不能繞**，只有 pg_cron 例外
- 完整 pattern + 坑點：`docs/supabase-optimization.md`

**效能守則**（2026-04-10 bus trails OOM 教訓）：

- refresh function 的 WHERE + ORDER BY **必須有對應索引**（缺索引 = 全表 sort = OOM）
  - 必須有 `(id_column, collected_at)` 複合索引
  - 必須有 `(collected_at)` 單欄索引
  - 常用條件（如 city）考慮 partial index
- today + yesterday 放**同一個 cron job 循序跑**（禁止拆成兩個獨立 job）
- 聚合用 `MAX()` 而非 `mode()`（後者需額外 sort）
- 加 `SET work_mem TO '64MB'` 減少 disk spill
- cron 排程必須錯開分鐘（見 `data-collectors/docs/sql/cron_throttle.sql`）

**⚠️ pg_cron target_day 一律用台北時區**（2026-06-17 教訓，7 dataset 全炸）：

- **禁用** `current_date` / `CURRENT_DATE` 在 `cron.schedule` 內
- **必用** `(now() AT TIME ZONE 'Asia/Taipei')::date`
- **Why**：Supabase DB session timezone = UTC → `current_date` 是 UTC 日 → 台北 00:00~08:00 那 8 小時 UTC 還停在昨天 → cron 只 refresh 台北昨天 + 前天，**從不 refresh 台北今天** → 前端在早上 8 小時窗口看不到資料
- **實證**：2026-06-17 07:50 (Taipei) ship / flight / freeway / youbike / disaster / temperature / iot-wra 七 dataset 全空 → 修法 `gis-platform/migrations/208_fix_cron_taipei_tz.sql`
- **Code review 規則**：`cron.schedule(...)` 內看到 `current_date` → 一律改為 `(now() AT TIME ZONE 'Asia/Taipei')::date`

## ⚠️ P0 「已完成」必有工具佐證（2026-07-03，幻覺教訓）

任何聲稱「已做完」（改 DB / commit / 部署 / 測試通過 / 修好）前，**用工具查真實狀態**：`git status`/`git log`/psql `SELECT`/`curl`/`gh api commits/<sha>/check-runs`。不靠記憶或敘述——曾大段描述做完 RLS 修復/migration/CI 修復，實際從未執行，收尾 ground-truth 查證才發現。修復類跑完立刻獨立驗證（exit 0 ≠ 達成目的）。不信 agent 二手報告的事實（表名/數字/狀態），自查 ground truth。

## ⚠️ P0 Supabase RLS 安全鐵則（2026-07-03，anon key 裸奔教訓）

**anon key 公開是正常設計**（進 bundle 正常），安全全靠 RLS。service_role key 絕不進 bundle（禁 `VITE_` 前綴）。

1. **新建 table 必 `ENABLE ROW LEVEL SECURITY` + read policy**。Supabase 建表 default 把 ALL 授 anon/authenticated；忘開 RLS = anon 拿公開 key 可 SELECT/INSERT/UPDATE/DELETE（本 session 踩 public 22 張 + reference 6 張 + profiles，migration 270/271/272）。
2. **要 column 級權限先 `REVOKE ALL FROM anon,authenticated` 再授最小集**——表級 UPDATE 蓋過 column-level GRANT（profiles 的 tier 一度可自升級）。
3. **Exposed schemas 只留 `public`+`graphql_public`**（+ 有前端直讀的才留，如 reference 因 airports/ports app）。**改 Exposed schemas 前必 grep 全生態所有前端 repo**（DB 共用，一度只掃單 repo 差點弄壞其他 app）。
4. **改線上 DB 前自查 ground truth**（psql SELECT），改用 `SET ROLE anon` + anon key curl 實測讀/寫（讀通/寫擋）。migration 加 `to_regclass` 守衛防不存在表 ERROR。
5. SECURITY DEFINER function 必 `SET search_path`。

## 新增 Layer 強制順序

1. `src/types/index.ts` → `LayerVisibility` 加 key
2. `src/data/xxxLoader.ts` → loader + loadingRegistry
3. `src/hooks/useXxxLayer.ts` → React hook
4. `src/map/overlayRegistry.ts` 或 `src/map/xxxCustomLayer.ts`
5. `src/components/LayerSidebar.tsx` → UI toggle + **`LAYER_COLORS` 補 key**（漏了會 tsc error）
6. `src/App.tsx` → 接線
7. `src/hooks/useLayerVisibility.ts` → 預設可見性

可用 slash command `/new-layer <name>` 自動產生骨架。

**3 張 exhaustive Record 必須同步補 key（缺一即 tsc TS2739/TS2739，2026-05-25 教訓）**：
① `LAYER_COLORS`（`sidebar/layerCatalog.ts`，`Record<keyof LayerVisibility>`）
② `IconRailSidebar.tsx` 圖示表（`Record<keyof LayerVisibility, LucideIcon>`，**不在 layerCatalog，易漏**；
   手機 `LayerSidebar` 吃 SECTIONS 文字無此 Record）
③ `FeatureInfoPanel.tsx` 的 `HEADER_LABELS`（`Record<FeatureInfo["layerType"]>`，有接 popup 才需）。
tsc -b 一張一張抓，補完再跑會冒下一張。

**機制選擇（第 4 步）**：大型 geojson 散點（>數 MB，如 fireHydrants 70k 點 / 農企業登記 60k 點）
走 **`overlayRegistry`**（宣告式，generic overlay loop 自動處理 visibility/theme/params，**MapView 完全不用改**）；
小型或需特殊渲染（PMTiles / 3D / 客製 paint）才用 `agricultureLayerFactory` 之類 factory。
同一分區（如 AGRICULTURE）**可混用兩種機制**——分區歸屬只看 `layerCatalog.ts` SECTIONS，與渲染機制無關。

**前端 artifact 瘦身在上游做**：`public/*` 是 gitignore→S3 的 deploy artifact。座標精度過高 / 冗欄位
要瘦身應改 `taipei-gis-analytics` 上游 export（保持 manifest / gis-data-onboard SOP 契約一致），
**不要在前端 repo 偷偷分叉**（下次 SOP 直拷會覆蓋）。

## 圖層 UX 四鐵則（⚠ P0，2026-05-23 加）

任何新 layer 必須**同時**通過四條，缺一不可。違反 reviewer 應退件。
**詳細 rationale + 範例見 `docs/development-rules.md#4a`，本檔僅摘要**。

1. **透明度 slider 必備** — `useTransportParams.ts` 加 opacity slider
2. **分類 ≥ 2 種 → 必寫圖例** — paint 用 `match` / `step` / `interpolate by 屬性`
   分出 2+ 顏色時，**必須**在 `src/components/LegendPanel.tsx` 加 sub-component。
   類型表抽到 `src/data/xxxTypes.ts` 給 factory paint / FeatureInfoPanel / LegendPanel
   三處共用（範例：`agriPOITypes.ts` / `agriSoilFertilityMetrics.ts`）
3. **可選取物件 → 必接 click popup** — POI / polygon / line 凡點下去能講出資訊
   就要接：`useMapInteraction.ts` 的 `GIS_LAYERS` 加項、`FeatureInfo.layerType` 加 key、
   `FeatureInfoPanel.tsx` 加 sub-panel。`GIS_LAYERS` 是 first-hit-wins → 細節小範圍排前面、
   大背景排後面。PMTiles `keep_attrs` 必須先補齊（見 PB-14）否則 panel 拿到 undefined
4. **Select control options ≥ 4 → 原生 `<select>` dropdown** —
   `LayerSidebar` / `IconRailSidebar` 內 `ctrl.options.length > 3` 自動切。
   中文標籤 4 個就溢出 240px sidebar。Layer 多參數時用 dropdown 切 "mode"
   而非並排多個 slider（範例：土壤肥力 6 metric → 一個 dropdown）

豁免條件：純單色 + opacity 由 attribute 自動調節（如 FTW confidence_mean） →
可豁免「圖例」。若 polygon 單格無實用屬性（如 FTW 田區僅 confidence） →
可豁免「click popup」。其他情況一律接，select 無豁免。

## 大面積覆蓋／等時圈圖層（⚠ P0，2026-05-26 加）

「等時圈 / 服務範圍 / 可及性分析」等**大面積高頂點覆蓋多邊形**，一律照 **PB-16** 做，重點：

1. **用 PMTiles 向量切片，不要 GeoJSON overlay** — GeoJSON 要麼大（pan 卡）要麼簡化變醜；
   PMTiles 依縮放/視窗 range request 分級載入，又清晰又順。前端走 factory（仿 `agricultureLayerFactory`），不走 overlayRegistry。
2. **「全區」與「分區」分開算，禁止把各分區 dissolve 疊起來當全區**（縣界會亂）：
   全區=所有點一起 union（無接縫），分區=區內各自 dissolve，同層用屬性 + `setFilter` 切換。
3. **分級用環差（ring-difference）** → 單一 fill layer 不重疊上色。
4. **門檻時間查官方 KPI**（消防署 10 分到場率 / NFPA 4 分），別隨意定。
5. **路網等時圈** = Mapbox Isochrone API + 原始回應磁碟快取 + 「保守估計」標註；**來源缺座標先 geocode 補**。
6. 中介 GeoJSON 進 gitignored `build/`，`public/` 只放 `.pmtiles`。

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

## Collector 重複度檢核（2026-04-26 教訓）

新加 collector 跟既有疑似重疊時：

1. **不要信編號系統**：UUID vs text station_id 互不認識，看起來不重疊不代表沒重疊
2. **用座標 ST_DWithin 100m 比對**（不是欄位 join）：
   ```sql
   SELECT COUNT(*)
   FROM old_table o JOIN new_table n
     ON ST_DWithin(o.geom::geography, n.geom::geography, 100);
   ```
3. **Sample 5-10 對最近站看名字**：dist=0 + 名字相同/相近 = 確認同源
4. **比 schema 欄位填充率**：`COUNT()` 不等於有用，要 sample 看是不是空字串
5. **歷史長度 + 取樣頻率** 決定誰當主、誰當備援

**判準**：100m 內配對率 > 90% = 重複（停一邊）；< 30% = 互補（兩邊都留）。

實例：iot_wra groundwater 95% 配對 → 完全重複（停 iot 子端點）；iot_wra river 16% → 互補。
詳見 `docs/research/iot-wra-integration-study.md` § 3 + PB-09。

## 一前端兩 Sidebar 同步改（2026-04-26 教訓）

本專案前端有 `LayerSidebar.tsx`（舊版）+ `IconRailSidebar.tsx`（實際渲染）。新增 layer 時必須**兩個都改**：

- `LAYER_COLORS`（兩檔都要）
- `LAYER_ICONS`（IconRailSidebar 才有）
- `SECTIONS` 列表（兩檔都要）

漏改 IconRailSidebar = `tsc -b` 過但前端看不到 toggle。

`FeatureInfoPanel.tsx` 的 `HEADER_LABELS` 也要補（type narrowing 要過）。

PB-01「新增 Layer 強制順序」第 5 步已點明，但這次仍漏改 → 列為 P0 提醒。

## boolean 透過 overlayParams 一律 0/1 中介（2026-04-26 教訓）

`overlayParams: Record<string, number>` 嚴格只收 number。新增 boolean 控制要：

```ts
// useTransportParams.ts
const overlayParams = useMemo<Record<string, number>>(() => ({
  ...
  myBool: myBoolState ? 1 : 0,  // 仿 metroPillar3d
}));

// App.tsx 讀時
!!(transportParams.overlayParams.myBool ?? 1)
```

**動既有型別前先看相同類型 state 怎麼處理**（pattern matching > 改型別）。
這次本能改 union type 結果下游 8 個錯，看到 `metroPillar3d: metroPillarVisible ? 1 : 0` 才知道既有 pattern。

## Zeabur 部署（2026-05-09 教訓）

從這次 OSRM map-matching pipeline 跨 project 部署踩出的 5 條：

- **PREBUILT_V2 service 一律 listen 8080**：Zeabur 對這類 service 的 K8s service port 硬性是 8080，不看 Dockerfile EXPOSE 也不看 PORT env var。
  - 服務必須 listen 8080（osrm-routed `--port 8080`、nginx `listen 8080`）
  - 診斷指令：`npx zeabur@latest service network --id <id>` 看 web (HTTP) 顯示的 port

- **跨 Zeabur project 內網不通，必走 public + auth gateway**：`<service>.zeabur.internal` 只在同 project 內可解析（K8s namespace 隔離）。
  - 跨 project 通訊一律走 public domain + Bearer token nginx gateway（仿 osrm-proxy pattern）
  - osrm-taiwan ↔ osrm-proxy（同 project 內網）→ 對外 public domain ↔ collector（跨 project 走外網）

- **Zeabur env var 變更後 service 不會自動 reload**：要 trigger redeploy 一律改檔（`README.md` 加一行）+ commit + push。
  - **Empty commit (`git commit --allow-empty`) Zeabur 不會 trigger build**（webhook 看 file diff 為空視為無變化）
  - 不要靠 `npx zeabur@latest service restart`（API 不穩定，連續 503）

- **含 `${}` 的 env value 不能用 zeabur CLI 設**：CLI 的 `-k` flag 用 Cobra `StringToStringVar` parser，對 `${VAR}` 會 mangle ([cli#201](https://github.com/zeabur/cli/issues/201))。
  - cross-service reference variable 一律走 Zeabur dashboard
  - CLI 只設 hard-coded 值（service-id、URL 字面）

- **採台灣政府 API 的 collector 選機房前先測目標 API**：高雄 kcg.gov.tw、台南、motcmpb 等防火牆對 AWS / GCP / Azure 雲端 IP 段做 ASN block（避刷）。Akamai/Linode 通、Lightsail 不通。新北寬鬆例外。
  - 換機房前 SSH 進新機 `curl -v --max-time 10 <政府 API URL>` 測通才搬
  - 不只測連通性，要測**目標 API 是否回應**

## Git 慣例

- 每個邏輯單位一個 commit
- 要 commit 前 stage 特定檔案（`git add src/x.ts`），**不要** `git add -A` 或 `.`
- Memory 系統 commit 用 `memory:` prefix，一檔一 commit。使用者 Confirm 後，先記錄原 cached path set，再以 exact-path `git add <path>` 與 `git commit --only ... -- <exact-path>` 提交；若同一 target memory file 混有平行 session hunks，path scope 無法隔離，必須停止並請使用者協調，不得整檔代 commit
- 不自動 push，push 由用戶決定

## 記憶系統原則

- `.claude/memory/` **commit 進 git**，英文檔名、繁中內容
- Session 開頭先讀 `memory/README.md` routing；只選與本次 scope 有關的 memory files，選中的檔案必須完整讀完，不使用固定檔數或整包載入
- Session 結束用 `/wrap-up` v2：先建立 scope/evidence ledger、矛盾清單、release matrix 與可 review 的 memory Draft；只有使用者明確 Confirm 後才編輯與 commit
- INCIDENTS / REFLECTIONS **只 append**，不改舊條目
- STATUS 只在核准的 closeout rewrite 成當下事實；feature commit 本身不等於 memory 已獲准更新
- Release matrix 固定以 `build / contract-wire / stage / upload / readback / pull / deploy / HTTP / browser` 分欄；狀態只用 `done / failed / blocked / unknown / not run / N/A`：`unknown` 只限證據不足、`blocked` 表示已知卡點、`not run` 表示尚未執行。不得把 upload/readback 寫成 production online，也不得以本機或測試證據替代 HTTP/browser
- closeout 只要求本次 target paths clean，必須列出保留的 unrelated staged/dirty paths；不得為了得到全樹 clean 而動平行 session，也不自動 push

## 大量點位低縮放採 overview + detail 雙 source（2026-08-19）

- 高量點位若需要全台低 zoom 可見，production contract 應拆成 count-only overview 與 feature detail；兩者使用互斥 zoom 範圍，不以低 zoom 強畫全部 raw points。
- overview 必須涵蓋全部 **resolved** records，並記錄 source denominator、resolved count、miss count；overview feature count 是 occupied cells，不可冒充原始資料筆數。
- overview 只帶渲染與稽核必要的聚合欄位，不帶公司名稱、地址、識別碼或 member list；detail 才依 publication whitelist 帶可公開欄位。
- 未選圖層時 overview 與 detail 都必須 `visibility: none`；切換層、opacity、z-order、scale 與 legend 需對兩個 source 一起驗收。
- 目前基準：公司 z4–11 overview / z12+ detail；工廠 z4–10 overview / z11+ detail。工廠 overview 只聚合 90,652 筆 resolved factories，不納入 9,972 geocode misses，也不得用公司座標補位。

## Business Registry publication whitelist（2026-08-19）

- 每個公開 artifact 都要在 contract 中列 exact public fields；上游多出欄位不代表可自動發布。
- 公司 detail 可公開 `company_name` 與核准的資本額、分類、年份、縣市、上市/商標/地址差異 flags；不公開統編、代表人、完整登記地址。
- 共同登記地址只公開地址與 `n_companies`、`capital_sum`、`capital_median` 聚合；immutable building key、公司 member list、公司名稱/統編/代表人均不得進入 public artifact。
- 工廠與列管事業的 unresolved records 要在 coverage 留痕；不得以公司登記座標替代，也不得把「未定位」或園區 aggregate 零值解讀為不存在。
- A3 membership assertions 與 A2 polygons 分離；不得合併成模糊 `is_in_park`，不得由 assertion flag 反推 science-park geometry。

## 行為原則（Claude 自律）

- **不盲信 memory**：涉及「某資料是否存在」「某機場 / 水庫是否已抓」類判斷，
  先 `Grep` / `Read` / `psql` 驗證現況，不靠記憶
- **成本估算要標示來源**：寫「實測」或「估算」，不混淆
- **改上游資料 pipeline → 下游全查**：`grep -r` 所有消費端，避免漏改
- **動手前先調查上游資料結構**：PostGIS 空間 JOIN 前先查是否有 outlier
  （2026-04-22 river_lines 2,445km outlier 教訓）
- **分階段驗證**：一次改 8+ 檔才跑 tsc + 瀏覽器實測會卡死，每 3-4 檔 smoke test
- **遇到卡點停下來問使用者選路**，列 A/B 方案，不自己選一個走下去

## Zeabur 正式上線 + Cloudflare（2026-06-02 教訓）

- **Cloudflare「Ignore cache-control + 固定 TTL」會連 404/5xx 一起快取**：靜態檔 Cache Rule 用固定 TTL 時，
  部署切換期或漏檔的暫態 404 會被釘住整個 TTL（如 1 天），事後補上 origin 也沒用。**必配 Status Code TTL：
  404 / 5xx → No cache**，且上線後若已被快取要 **Purge**（Caching → Purge Everything / by URL）。
- **Zeabur 容器 entrypoint 用「背景 pull + nginx 立即前景啟動」**：第一次部署大量 pull（數百 MB）若阻塞 nginx，
  Zeabur 健康檢查會逾時判失敗。entrypoint 改 `( pull-deploy-assets.sh ) &` 背景 + `exec nginx -g 'daemon off;'`，
  port 秒綁；persistent volume + `aws s3 sync` 重啟幾乎零下載。見 `scripts/deploy/entrypoint.sh`。
- **上線前必跑本地 git-archive docker build 忠實重現 Zeabur**：Zeabur 從 **git** build，gitignore 的大檔不在
  build context。本地用 `git archive HEAD | docker build --build-arg VITE_MAPBOX_TOKEN=<t> -t pulse-local -`
  才能重現（直接 `docker build .` 會把本地 public/ 大檔打進去、不真實）。本次靠它攔下 4 個會炸的雷。
- **`npm ci` 要求 package.json 與 package-lock 同步**：移除依賴後沒跑 `npm install` 更新 lock → Docker build
  `npm ci` 直接失敗。改 deps 後必跑 `npm install --package-lock-only` 並一起 commit。
- **`aws s3 sync --include "*.ext"` 是遞迴的**：會跨子前綴匹配（fire pmtiles sync 誤抓 agriculture/ 子前綴 pmtiles）。
  同類型分子前綴時要加 `--exclude "<子前綴>/*"`。
- **靜態大檔上線前確認「在 git 或在 S3」**：gitignore 的大檔若沒上 S3 → 線上 404（本次 water_detention_basins
  從沒上 S3）。新增/改名靜態大檔後跑 upload 腳本 + 比對 S3 清單（`aws s3 ls deploy-assets/`）。
- **撤 anon 權限前先盤 RPC security 類型**：74/81 個 public.get_* 是 SECURITY INVOKER（以 anon 身分執行、需 anon
  對底層表 SELECT），撤 table grant 會打掛 RPC。資安收斂改「收窄 PostgREST Exposed schemas」而非撤 grant。

## 部署資產三處接線（2026-06-12，林班事件）

**新增 public/ 資產子目錄時，三處必須同步接線**，漏任一處 = 容器上 404 但本機正常，極難察覺：
1. `scripts/deploy/upload-deploy-assets.sh`（上傳 S3）
2. `scripts/deploy/pull-deploy-assets.sh`（容器拉取 → /data/<dir>/ + mkdir）
3. `nginx.conf`（`location /<dir>/ { root /data; try_files $uri @dist; }`）

守門：`src/map/__tests__/deployContract.test.ts` 會掃 overlayRegistry sourceUrl
與 factory BASE 目錄，比對 nginx + pull 覆蓋，漏接直接紅。
教訓成本：FORESTRY 6/7 上線只接了 upload，容器上大檔 404 一週沒人發現。

## Map effect 禁用 isStyleLoaded() guard（2026-06-12，toggle race）

**禁止**在 visibility / params 類 effect 用 `map.isStyleLoaded()` 當 guard 丟棄更新：
任何 tile 還在載入它就回 false（production 首載 30-47s + busy 期間長期 false），
更新被靜默丟棄且不重試 → 「toggle 顯示 ON 但圖層沒畫」。

- `setLayoutProperty` / `setPaintProperty` 對已存在的 layer 任何時刻都安全，
  layer 不存在時各 update 函式自帶 `getLayer` no-op
- map `load` 前的狀態變更（mapRef 尚未設定）必須在 load handler 用 ref 重放
  （見 MapView.tsx load handler 的補發區塊）
- 線上排障：網址加 `?debug` → `window.__map`；access log 看 pmtiles 只有
  16384 header 讀取、無後續 range = 圖層沒真的在畫

## `git add -A` 危險（2026-06-13 教訓）

在 working tree 有「未追蹤的草稿 / 跨分支 WIP」時 **禁止** `git add -A` 或 `git add .`：
- 草稿（如 `docs/proposal/*.md`）會悄悄被掃進非預期 commit
- 跨分支 WIP（如 news-filter-critical 的 useTransportParams 改動誤入衛星 commit）
- 三次踩到都靠 `git rm --cached` + amend 救回

**取代做法**：commit 前 `git status` 列檔、`git add <具體檔案>` 精準上 stage。
新檔案要不要進 commit、進哪個 commit、要先想清楚。

## 視覺「順暢」可能是 bug 副產物（2026-06-13 教訓）

修 React hook 的「effect 重綁 / closure 不穩定」類 bug 時，可能不知不覺**收回**
原本因為 effect 高頻 re-fire 而產生的「假高頻更新」。修穩定性後若視覺變跳格，
**不是 bug 回歸，是真實頻率露出**。

- 修穩定性 → 評估顯式更新頻率（throttle / RAF）
- 視覺需求高頻 → 拆 light（廉價、高 Hz）/ heavy（昂貴、低 Hz）兩條訂閱
- 範例：衛星 hook 拆 point+footprint(10Hz) / track polyline(1Hz)，總 CPU 不變但流暢

## newsEvents pipeline 5 條（2026-06-13/14）

1. **LLM 不吐座標**（已從 news-roadmap 升級）：LLM 只輸出正規化地名（縣市+鄉鎮）
   過白名單，座標由 DB trigger 查 `spatial.township_boundaries` ST_PointOnSurface
   補。違反成本：幻覺座標亂跳難 debug
2. **homebrew Python 3.14 PEP 668 套件安裝**：`pip3 install --break-system-packages <pkg>`，
   不要 venv 化（已有專案慣例直接 system pip）
3. **collector 新增 LLM 評估維度 5 段路必端到端跑一次**：
   prompt → LLM annotation → item update → records.append dict → DB write，
   任一段漏接都 silent fail（636 行 vs 740 行 vs 1295 行 supabase_writer）
4. **Supabase RPC 參數一律用 integer**：smallint 從 supabase-js 傳會解析成 integer
   找不到 overload。Default 值不變即可
5. **RPC 變動先 apply 至線上實測再 commit**：薄 RPC 都是 stateless 可冪等 apply，
   實測形狀正確再 git push，比 PR review 抓得更實在

## 個人 PR 流程（2026-06-13）

- **PR 是給自己看，不是給人看**：自我 review diff 抓「漏帶欄位 / 命名不一致 / 沒處理的 edge case」
- **CI + Claude review 是補充，不替代自我驗證**：本 session 的 collector dict 漏欄、RPC smallint 兩個 bug 兩道網都沒抓到，自己端到端跑一輪才發現
- **Claude review prompt 必明確「只看 diff、無問題單行 LGTM」**：未限制時會主動展開讀檔，跑 6-10 分鐘消耗訂閱
- **首次 PR 修 workflow 檔本身會跳過 Claude review**：安全機制 "Action skipped due to workflow validation error"，不是 bug
- **不開公司級嚴格 PR 流程**：個人 side project 不需要 2 approvers / 強制 staging，那是給多人團隊的；用 PR 主要為「強迫慢一拍 + 自動跑檢查 + 開放 AI review」

## Handoff doc 必含三要素（2026-06-17）

> 設計 / 規格 / 實作交接給「另一 session」或「另一個人」時，文件必須**自帶足夠資訊**讓接手方不用回問。

**三個必含項目**：

1. **後端 RPC signature 完整列出** — 不只「需要一支 get_xxx RPC」，要寫到 `RETURNS TABLE (...)` 級別 + 實作關鍵語句（CASE WHEN、UNION、台北時區處理）
2. **前端元件 Props + 對應設計 jsx 行號** — 例「依設計 `AlertCards.jsx:36-127`、Props 為 `{ summary, expanded, onToggle, activeGroups, onPickGroup }`」。讓接手方視覺照搬不用看設計重新理解
3. **設計檔再抓 URL** — 寫在文件最上方，另一 session 可以 `WebFetch` 拉 bundle，不用回原 session 拿

**反例**：只寫「按這份設計實作 5 個元件」→ 接手方必須翻全設計檔猜 Props、猜 prop 流向，浪費 30 min。

**Why**：本 session 寫 `alerts-integration-impl.md` 時這麼做了 → 用戶可以直接複製貼到新 session 開工。若漏了 RPC signature，新 session 一定回來問「RPC 該叫什麼名字 / 該回什麼欄位」。

**How to apply**：寫 handoff doc 時 checklist：(a) 有 RPC signature? (b) 有元件 Props + 設計檔行號? (c) 有設計 URL? 三項缺一就補。

## Design System / inline style + token（2026-06-18）

> 規範文件 SSOT 在 `docs/design-system.md`，本節僅摘要不重複。

**核心決策**：**不引入 CSS 框架**（Tailwind / CSS Modules / styled-components）。
理由：60+ 元件已走 inline `style={{}}`、Mapbox paint property 吃字串、Three.js 吃 hex、
30-40% 樣式是動態（LAYER_COLORS 95 色 / opacity slider / time-based fade），框架反成負擔。

**token SSOT**：`src/styles/designTokens.ts`（單向 import `intel/intelTokens.ts`）。
新元件 / 重構元件**禁止**在 inline style 寫 hex / rgba / px scale，一律 import token：

| 屬性 | token |
|---|---|
| 面板背景 | `SURFACE.app / subtle / panel / strong / solid` |
| 文字色 | `COLORS.textStrong / textDefault / textMuted / textDim / textFaint / textGhost` |
| 邊框 | `BORDER.soft / panel / mid / strong / accent` |
| 圓角 | `RADIUS.sm:2 / md:4 / lg:6 / xl:8 / pill / full` |
| 字級 | `FONT_SIZE.xs:9 / sm:10 / base:11 / md:12 / lg:13 / xl:18 / xxl:22` |
| 字體 | `FONT_DATA`（數據 / 時間）/ `FONT_CJK`（中文） |
| 陰影 | `ELEVATION.sm / md / lg / dock` |
| 圖層代表色 | `LAYER_COLORS[layerKey]`（已被 `layerConsistency` 測試保護，不收進 designTokens） |
| 關閉鈕 | `<X size={14} />` from lucide-react |

**KEEP OUT**：
- ❌ 不引入 CSS 框架
- ❌ 不抽 `Button` / `Card` 通用元件庫（業務元件深耦合 Mapbox / timeStore，抽出 over-abstract）
- ❌ 不在新元件 inline 寫死 hex / rgba / px font size
- ❌ 不反向把 `intelTokens` 改成 re-export from `designTokens`（會 circular dep）
- ❌ **`SURFACE.*` 只給 panel 容器底**；button / select / segmented control 等**互動態背景不用 SURFACE**
  （即使數值相同 `rgba(0,0,0,0.4)`，語意不同 — 未來開 `CONTROL.*` 群組，見 DS-3）

**寫新元件 checklist**：見 `docs/design-system.md` §9（5 段 code template 可直接抄）。

**未抽 token 範圍**（DS-1~7）：Z_INDEX / transition / state colors / breakpoint / control sizing /
intelTokens 退役 / LayerSidebar 亮側。**沒有真實痛點不開**，痛點出現再進 BACKLOG。

## 跨 repo 新管線必過 5 處（2026-06-17）

> 加一支新 realtime collector（如 yt_live_video_resolver / cdc / pla）時，**data-collectors repo 內有 5 個檔案要全動**，缺一資料寫不進 Supabase 或前端讀不到。

**5 處 checklist**：

1. `collectors/<name>.py` — collector 本身（BaseCollector 子類）
2. `collectors/registry.py` — 加 `from .<name> import XCollector` + `CollectorEntry(...)` 進 `COLLECTOR_REGISTRY`
3. `config.py` — `_COLLECTOR_TOGGLES` tuple 加 `('<PREFIX>', default_enabled, default_interval)`
4. `storage/supabase_tables.py` — 加表對應（`history` / `current` / `columns` / `upsert_key` / `upsert_strategy`）
5. `storage/supabase_writer.py` — 加 `_transform_<name>` 方法 **AND** 註冊到 `TRANSFORMERS` dict（容易忘第二步！）

**對應 gis-platform**：1 個 migration 建 `realtime.<name>_history` + `realtime.<name>_current` + `public.get_<name>_xxx()` RPC + RLS + grant anon

**對應前端**：`src/data/<name>Loader.ts` 用 `withLoading()` 包 supabase.rpc

**Why**：本 session yt_live_video_resolver 第一次跑出現「Supabase 寫入 ✓ 但 DB 0 rows」— 因為漏了 `supabase_writer.py` 的 transformer 註冊（只加 supabase_tables 不夠）。collector run 不會報錯，靜默失敗。

**How to apply**：開新 collector 時把這 5 處貼成 task checklist，逐項打勾才算完。Supabase pre-ship smoke：`psql -c "SELECT count(*) FROM realtime.<name>_current"` 第一輪跑完應該 > 0，否則回頭查 transformer。

---

## 寫獨立 3D / CustomLayer hook 前先讀 pitfall（2026-06-18）

**規則**：任何**獨立 Three.js / Mapbox CustomLayer hook**（toggle ON 才 addLayer 的、非 addAllLayers 同步加的）開工前必跑：

```bash
grep -l "isStyleLoaded\|style.load\|addLayer" .claude/pitfalls/
```

**Why**：2026-04-22 水庫圖層、2026-06-18 能源 beam 兩次踩同一個 `isStyleLoaded() race + style.load 不會二次 fire` 的坑。第二次又花 4 輪 debug 才回想起來。Pitfall 檔早就有，**SessionStart 不 inline pitfalls 內容、只 inline STATUS/BACKLOG/PRINCIPLES**，要主動 grep 才看到。

**How to apply**：
- 看到「3D 圖層 / Three.js / CustomLayer / addLayer / Three.js scene」這幾個觸發詞，**立刻**讀 `.claude/pitfalls/2026-04-22-mapbox-load-once-fired.md`
- 預設 mount 用 `try map.addLayer + catch → map.once("idle", retry)` 模式
- **禁** `if (isStyleLoaded()) mount; else map.on("style.load", mount)` — 這個是經典陷阱
- mount 函式預先加 5 個 checkpoint log（mount entry / try addLayer / catch / success ✓）

**Debug 信號**：用戶說「3D 圖層 toggle ON 但畫面沒東西 + console 沒 setData log」→ 跳過視覺調整，直接看 mount log 有沒到 `mounted ✓`。沒到就是這個 race。

---

## 寫 Mapbox expression / GLSL shader / addImage 前先讀 pitfall（2026-06-20）

**規則**：寫以下任何一種前，先讀 `.claude/pitfalls/2026-06-20-mapbox-expression-glsl-shader.md`：

- Mapbox `match` / `case` / paint / layout expression
- GLSL vertex/fragment shader（特別是 fat-line 自製 quad expansion）
- mapboxgl `addImage` / symbol layer icon-image
- overlayRegistry spec 含 callback layout

**Why**：本 session Phase 8 整理花了 30+ commit 來回，多數是 **silent fail**：
- `match` 接 boolean → marker 全消失（無 error log）
- GLSL `vec4 ? :` → vertex shader fail → 線消失
- fat-line normal 算錯 → quad 變羽毛紋
- styleimagemissing race → image 永不註冊
- rebuildOnParamChange 只看 paint，layout slider 拉了沒反應

**How to apply**：
- 寫前掃 pitfall：`grep -l "expression\|shader\|addImage\|layout" .claude/pitfalls/`
- 寫新 layer 「先 work 再 polish」：先用 fragment `gl_FragColor = vec4(1,0,0,1)` 純色測 vertex，再加 bloom / falloff
- callback layout → 必須走 setLayoutProperty diff（`applyLayoutDiff` 已在 overlayManager 內，spec 直接用 callback layout 即可）

---

## 可達性分析 — Multi-bucket 歸屬不用 SQL CASE（2026-06-22）

**規則**：分 layer 的 bucket 邏輯**用 Python list-of-buckets**，不用 SQL `CASE WHEN`。

**Why**：SQL CASE 短路求值會吃掉多身分 POI（如「中油+台糖」72 站只進 cpc，永遠不進 taisugar）。本 session 加油站案例：台糖 layer 從 13 站漏到只有 13，修正後 86 站（+73 雙品牌 / 覆蓋率 50%→59%）。

**How to apply**：
- SQL 只回原始 `brand[]` / `categories[]`，不分類
- Python `buckets_of(brand, name)` 用 if-list 把每站算多 bucket
- dijkstra source 用 `defaultdict(list)` 累加
- 跑完 grep 一筆雙身分 POI 確認真的進多 bucket
- 完整範本 + 案例見 `.claude/skills/accessibility-analysis/SKILL.md §⚠️ 鐵則 #1`

## 可達性分析 — 「其他」用 whitelist 不用 NOT IN 反向定義（2026-06-22）

**規則**：「私營 / 其他 / 雜項」這類 bucket **用 whitelist regex 正向篩**，不要用 `NOT IN (大品牌)` 反向定義。

**Why**：政府 raw 資料常有「商業司 41455 公司登記但非該業態」的 false positive（加油站表混入停車場 / 公司辦公室）。反向定義會把這些雜訊全吸進「其他」bucket。本 session 加油站案例：665 站 → 292 站（去 374 false positive）。

**How to apply**：
- 先跑 `SELECT name, count(*) FROM ... WHERE 反向條件 GROUP BY name ORDER BY 2 DESC LIMIT 30` 看樣本
- 寫 `PRIVATE_NAME_RE = re.compile(r"...")` 涵蓋常見品牌 + 「加油站」/「醫院」等業態關鍵字
- 套用：`if not bs and name and PRIVATE_NAME_RE.search(name): bs.append("other")`
- 各 POI 類型推薦 regex 表 + 完整範本見 `.claude/skills/accessibility-analysis/SKILL.md §⚠️ 鐵則 #2`

## 長跑 pipeline 跑前必健康檢查（2026-06-22）

**規則**：跑外部依賴（Overpass / OSRM / 大 query）的 pipeline 前，**先 30 秒健康檢查**（curl mirror + df + ps）。

**Why**：本 session 反覆 retry osmnx batch，多次跑 40 分鐘後才發現 mirror 早就 down。健康檢查可避免「batch 開跑後才知道資源不可用」。

**How to apply**：
- `curl --max-time 5` 測 3 個 Overpass mirror 至少一個回 200
- `df -h ~` 確認 free ≥ 50 GB（pyrosm 路線）
- 若是 retry：`grep CUSTOM_FILTER / BBOX / OVERPASS_URL` 跟「上次成功 commit」對齊
- 完整 checklist 見 `.claude/skills/accessibility-analysis/references/troubleshooting.md`

## CPU=0% + 仍 alive ≠ deadlock（2026-06-22）

**規則**：長跑 process 顯示 CPU=0% 別自動以為 deadlock — 多半是 socket / IO 等候。用 `sample <PID>` 看 stack trace 判斷。

**Why**：本 session 把卡 socket 的 osmnx process 等 8 小時，以為「應該很快」實際上是 mirror 不回應 + osmnx 內部無 socket timeout。

**How to apply**：
- `ps -o etime=,pcpu=,pmem= -p $PID` 看狀態
- `sample <PID> 2` 取 2 秒 stack snapshot 看最底 frame：
  - `socket.recv` / `_overpass_request` → 網路卡
  - `to_graph` / `compose_all` → RAM 即將爆
  - dijkstra / 純 Python loop → 確實 CPU bound
- **超過 30 分鐘無 log / cache 增量 → kill**，不要被動「再等 5 分鐘」

## 微調 batch + 不要每個值一個 commit（2026-06-20）

**規則**：用戶要改顏色 / slider 預設值時，**先問是否還會再改**，集中 commit 不一個值一 commit。

**Why**：本 session 顏色換 6 次（霓虹 → 用戶色票 → 高壓位移 → 白光暈 → 改回原色），slider 預設值換 8+ 次，commit history 雜亂、context 也吃很兇。

**How to apply**：
- 用戶說「換顏色」「調預設值」→ 回 prompt 問「需要連帶調整 X / Y / Z 一起說嗎？」，等用戶一次寫完
- commit 訊息標 `tweak(scope):` 不標 `feat()` — 區分微調 vs 新功能
- 連續微調可改 `git commit --amend`（用戶同意才動）

## Isochrone Mode B 的預設就是 concave_hull(0.5) + buffer + dissolve（2026-07-01）

**規則**：任何「per-station ego_graph → polygon」isochrone pipeline，polygon 生成一律用：
1. `shapely.concave_hull(mp, ratio=0.5)` — 貼路網形狀（不要 convex 鋸齒、不要 0.3 太細碎）
2. `hull.buffer(radius_m × 0.15)` — 平滑邊緣 + 覆蓋 hull 沒包到的 edge tail
3. `hull.simplify(radius_m × 0.10)` — 控 polygon 點數
4. 對所有 station 的 polygons 用 `unary_union(boundary) → polygonize` 切 fragments
5. **`dissolve by overlap_count`**：同 count 的所有 fragments `unary_union` 成 MultiPolygon，最終每個 count 值 1 個 feature

**Why**：警察 isochrone 本 session 走完完整 convex → concave(0.3) → concave(0.5)+dissolve 三段演化：
- convex → 過度膨脹三角形鋸齒
- concave(0.3) → 26,644 micro fragments / 14MB / 視覺切碎
- concave(0.5) + buffer + dissolve → **73 features / 5.8MB / 乾淨階梯**

**How to apply**：
- 新增 Mode B 型 isochrone layer（消防 / 警察 / 醫療步行 / 加油站步行）預設走這個 pipeline
- reference：`taipei-gis-analytics/pipelines/police_justice/isochrone/10_police_isochrone.py`
- 前端 paint 用 `["step", ["get", "overlap_count"], color1, 2, color2, ...]` step expression 上色，line 層 opacity ≤ 0.08 避免同心圓錯覺

## 跑 osmnx / pyrosm 前先 find PBF 本機（2026-07-01）

**規則**：任何 isochrone / 路網分析 pipeline 啟動前，先跑：
```bash
find ~ -name "*.osm.pbf" -size +50M 2>/dev/null | head -5
```

有本機 PBF → **直接走 osmium tags-filter + pyrosm**，跳過 Overpass。

**Why**：Overpass 3 個公開 mirror 都不穩（IP ban 24-72h / kumi timeout / fr whitelist 403）。本 session 全台 bbox 觸發 IP ban 後才發現 `taipei-gis-analytics/data/raw/osm/taiwan-latest.osm.pbf` 早就存在 309MB — 直接省 24-72h 等 cooldown。

**How to apply**：
- SKILL `accessibility-analysis` §5.3 本來就寫 PBF 是救援路徑 — **但實務上應該當 primary path，不是 fallback**
- 過濾範例：`osmium tags-filter taiwan-latest.osm.pbf w/highway=motorway,trunk,primary,secondary,tertiary,unclassified,motorway_link,... -o taiwan-drive.osm.pbf`
- pyrosm 讀：`osm = pyrosm.OSM(pbf, bounding_box=bbox); nodes, edges = osm.get_network(network_type="walking")`（⚠ 是 `walking`/`driving`，不是 osmnx 的 `walk`/`drive`）

## 分區跑覆蓋 layer：raw features → 全域 dedup + 全域 dissolve（2026-07-02 改正）

**規則**：全台 vector 覆蓋 layer（isochrone / service area 類）分區跑時，**每區只出 raw per-station polygons（不做 dissolve）**，統一在頂層 concat → dedup by entity_id → 全域跑一次 `compute_overlap_count` → dissolve。**禁**「per-region dissolve → concat 到頂層」。

**Why**（改正 2026-07-01 錯誤診斷）：本 session 原本以為區界斷裂是「bbox 不重疊 → ego_graph 截斷」→ 推薦「bbox +0.15° overlap」修法。用戶 push「這次確定嗎」後做對照測試發現：5 區 bbox 實際上**已有 40km overlap**（north/north2 交界 lng 121.0-121.4 lat 24.5-24.9），問題不是 graph 截斷，而是**每區獨立 `compute_overlap_count + dissolve`**：同片地理區域被 5 個區各自 dissolve 產出「不同 overlap_count」的 features → concat 後同片區疊多層不同色 fragment → 前端 fill-color step 讀 count 出現色塊接不上。10 顆桃竹 + 10 顆嘉南 station 對照證實：OLD 8 features 每 count 2 個 vs NEW 4 features 每 count 1 個。

**How to apply**：
- `10_police_isochrone.py` 加 `--polys-only` 只出 per-station raw polygons（每 feature 帶 `entity_id + station_name`）
- `15_run_by_region.sh` 用 `--polys-only`，per-region 檔名 `*.polys.geojson`
- `16_merge_regions.py` concat 5 區 raw polys → dedup by entity_id（overlap 帶 station 兩區都跑到，只保留一次）→ 呼叫 `dissolve_polys_to_final()` 全域 compute_overlap_count + dissolve
- 前端不用改，consume 同樣 combined PMTiles schema
- **關鍵**：`compute_overlap_count` 必須在**全站集合**上一次算完，不能分區算後合併
- pipeline：`taipei-gis-analytics/pipelines/police_justice/isochrone/` 5 檔

## nearest_nodes 必加距離閾值 + fallback（2026-07-02）

**規則**：呼叫 `ox.nearest_nodes(G, X=x, Y=y)` 後**必須**檢查 nearest_node 距 station 的距離；> 500m（EPSG:3826 metres）視為「station 不在路網上」，改用理論半徑圓 `Point.buffer(radius_m/111000)` at **station 座標**（不是 node 座標）。

**Why**：本 session 用戶 push「山區榮興/泰崗完全看不到」— 診斷發現 drive PBF osmium 已過濾掉 residential/service/track（只留 primary/secondary/tertiary），中橫深山 station 附近沒 drive 節點 → `nearest_nodes` 回傳 3-5 km 外的主幹道節點 → ego_graph 從錯位置展開 → polygon 完全不在 station 附近（榮興偏移 5306m、泰崗 4317m > drive 5min radius 2739m）。既有 fallback (`len(node_ids) < 3`) 抓不到這種：nearest node 找到、ego_graph 節點也 > 3，只是產物在錯位置。

**How to apply**：
- station_polygon() 加：
  ```python
  node_x, node_y = G_proj.nodes[node]['x'], G_proj.nodes[node]['y']
  if ((node_x - x)**2 + (node_y - y)**2) ** 0.5 > 500:  # EPSG:3826 m
      r_deg = radius_m / 111000
      return Point(station["lng"], station["lat"]).buffer(r_deg, resolution=12)
  ```
- 閾值 500m：都市 station 到 nearest node 通常 <100m；山區主幹道旁 500m 內找不到節點 → 視為離線
- Fallback 圓 buffer 語意：「假設路網完整、可到理論半徑」— overestimates 但比錯位置好，也比 None 好（避免山區完全消失）
- 修法後掃全台：drive 6 變體「polygon 不含 station」raw feature 從 100+ 降到 23（<1.5%），視作邊界誤差可接受

## Realtime schema 表要驗證 collector 是否真的在跑（2026-07-01）

**規則**：apply `realtime.*` schema migration 後，smoke test 不能只驗 RPC 語法，要**驗表內 row count + max timestamp**。

**Why**：`realtime.prison_population_daily` migration 258 存在，但 `data-collectors/collectors/correctional_daily_snapshot.py` 沒在跑 → 全表只 1 row（2026-05-15，已 1 個多月沒更新）。前端 Monitor PrisonCard 開了顯示空白。

**How to apply**：
- migration apply 後跑：`psql -c "SELECT count(*), max(observed_date) FROM realtime.xxx;"`
- 0 rows / max 太舊 → 記 BACKLOG 「collector 補跑」而非上線
- Front-end panel 加「無資料時的 fallback UI」提示，不留白

## 新增 layer 前一律 grep + find 檢查現有（2026-07-01）

**規則**：規劃新 layer 前，跑：
```bash
grep -rn "layerKey" src/ | head -5
find public -name "*.geojson" | grep -i "topic"
```

**Why**：本 session 規劃 airport layer 時，plan 寫「建 4 點 airports.geojson」— 用戶提「不是有現成的？」grep 才發現 `public/geo/airports.geojson` 早就存在 Polygon + iata/icao 全欄，`LayerVisibility.airports` + `LAYER_COLORS.airports` + sidebar + `AirportPanel` + `AirportSelector` cameraPreset 全串好。差點重建。

**How to apply**：任何新 layer 骨架 plan 起手 = `grep + find + git log --all -- "*topic*"` 三連查。用戶記憶通常 > 我對 codebase 的直覺。

## 一 Mapbox gl context 只掛一個 Three.js CustomLayer 實例（2026-07-01）

**規則**：想在同一份 Mapbox map 上做多個 Three.js 特效時，**共用同一個 CustomLayer + 內部 Scene**，多個效果走 InstancedMesh / group 分。**不要 mount 兩個獨立 CustomLayer（各自 new THREE.WebGLRenderer）**。

**Why**：`feat/power-plant-glow` 新增 `PowerLinesGlowTestLayer` 想跟既有 `OsmPowerLinesGlow` 並存做視覺對照 → setData 收到 2,305 條、log 全綠、畫面卻完全沒東西。根因：兩個 `THREE.WebGLRenderer` 各包同一 gl context，各自維持 state cache；第一個 renderer 跑完 GL state 被改動，第二個以為 state 是預設 → shader program / VBO / uniform 對不上 → 什麼都不畫。

**How to apply**：
- 需要多個 Three.js 特效 → 塞進**同一個 Scene**（用 mesh 分組 / uniform 分色）
- 若真的要「A / B 對照」的並存 → **改走純 Mapbox 疊層**（`line-blur` × 多 pass）避開 Three.js
- 也不要 hot-reload 期間把舊 CustomLayer 忘記 removeLayer 就 addLayer 新 CustomLayer，同樣會踩

詳細案例：`docs/features/bloom-experiments/README.md#pitfall`。

## Bloom / halo 光暈類視覺一定要 zoom 自適應（2026-07-01）

**規則**：Three.js Points 的 `gl_PointSize` 跟 Mapbox `line-blur` 都是**螢幕像素**，跟 map zoom 完全脫鉤 → 拉遠光暈會佔滿畫面看不到底圖。設計 bloom layer 時，size / blur 一律走 zoom 縮放係數。

**Why**：`feat/power-plant-glow` 一開始沒加 zoom scaling，全台 zoom 5 開發電廠 Bloom → 每顆廠光暈占 1/4 台灣，變成一片白霧看不到分佈。

**How to apply**：
- Three.js shader：加 `uniform float uZoomScale`，每 frame 由 CustomLayer 讀 `map.getZoom()` 換算（`pow(1.5, zoom - REF)` clamp 0.15~3.5）
- Mapbox line / fill：`"line-blur": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 12, 4]`
- 保底再開一個「大小 slider」給用戶手動微調（自動 + 手動雙控最順）

Ref：`docs/features/bloom-experiments/README.md`

## copernicusmarine subset 必帶時間範圍（2026-07-02）

`copernicusmarine subset` 不帶 `--start/--end-datetime` 會抓整段 anfc 時間軸（多年 + 10 天預報）。小 bbox 時檔案小沒事，擴域後單檔可爆到 18GB。**一律帶時間範圍**（例：今日 00Z +48h）。見 INCIDENTS 2026-07-02。

## 前端 Supabase loader 欄位名要對照 DB 驗（2026-07-02）

前端 loader 的 `.select("colA,colB")` 欄位名若與 public view 不符，PostgREST 整包查詢報錯 → 若 catch 只 console.warn，layer 會**靜默不建、完全空白**（颱風軌跡 center_pressure vs center_pressure_hpa 壞很久沒發現）。**接完 Supabase layer 一定要實際 toggle 開來看有沒有東西**，別只信 tsc 過。

## 大量粒子/流場 → instanced rendering + 快取世界座標（2026-07-02）

WebGL 逐幀重建整個頂點 buffer（count × trail × 6 頂點 × 10 float）+ 逐段算 mercator（log/tan）在高粒子數會爆。改法：① instanced rendering — 四角幾何固定 static buffer，每段只上傳 8 float（fromMerc/toMerc/rgba），`drawArraysInstanced`，上傳量降 ~87%；② 快取世界座標 — 世界座標（mercator）在點建立時算一次存起來，繪製直接讀（zoom/pan 靠 u_matrix，不用重算）。用 VAO 封裝 attribute+divisor 免污染 mapbox。

## 地圖是 mercator 非 globe → 自訂 WebGL 線層全 zoom 有效（2026-07-02）

`new mapboxgl.Map` 沒指定 `projection:'globe'` = 預設 mercator 平面。自訂 WebGL CustomLayer（吃 u_matrix）在**所有 zoom 都正確**，不需要低 zoom 的 canvas globe drape 疊層。動 climate drape 前先確認投影。粒子密度改用 zoom 自適應（拉遠加密、量化避免每幀重配置陣列）取代雙層。

## 多機構同一實體 → 提供資料源選擇 + 去重（2026-07-02）

颱風被 JMA（TC26xx）+ JTWC（wpNNyy）兩機構各自追蹤，同一實體出現兩次、位置略差 → 兩條軌跡兩個圈重疊混亂。原則：① 加**資料源選擇器**（全部/JMA/JTWC，UX 鐵則 4，≤3 選項用 button row）讓用戶選單一來源；② 同一 storm×source×時刻的多點質心去重（JMA preTyphoon/typhoon 段同時間戳）。任何「多來源同實體」資料都適用。

## 靜態層讀取走 CDN 快照，別擠 RPC 併發排隊（2026-07-04，BC-8 教訓）

前端韌性層有全域併發上限（AR-01=8）保護 DB 不被單人 reload 雪崩，但副作用：**靜態資料走 RPC 會擠這條排隊** → 開多層時被排後面的層冷載暫態空窗（BC-8：~16s 才補、非 fetch 失敗、非 render race）；且多人各自打同一份靜態資料 = DB 讀取 **O(N)**，數十~數百人打爆 pooler / CPU / egress。

原則：**資料月更或更慢 + param-less（或可全量化）+ 非時序/realtime → 預匯出 JSON 快照走 S3+Cloudflare CDN，別走 RPC**（O(N)→O(1)）。實作 `staticRpc()`（讀 `/static-rpc/*.json`，404 fallback 回 RPC）+ 匯出腳本 + nginx/S3 鏡像子前綴。完整 SOP 見 PLAYBOOKS PB-27，交付 `docs/features/static-to-cdn/`。

推論：**新 layer 接資料前先分類**——靜態 → CDN 靜態檔（geojson/PMTiles 或 static-rpc 快照）；半動態共享快照 → R2 快照（AR-12/13）；真動態時序 → 保留 RPC。**只有真動態該進 DB 併發排隊。**（呼應 §資料來源管理 + 大面積覆蓋 PMTiles）

## owner-gated 安全鎖定原則（2026-07-07）

### 鎖機密資料要掃 public schema 全面，不只鎖 API 清單
Supabase 只 expose `public`（+少數）schema 給 REST。把機密表放**未 expose 的 schema**（energy/agriculture/realtime）+ RPC 供應 → schema-level 天然擋 anon 繞道（`Accept-Profile` 打不進去，實測 406）。但**散落 `public` schema 的同主題 table/view 容易漏鎖**（275 漏 4 個電廠 table/view）。鐵則：鎖某主題機密時，反查**所有**讀該資料的 table/view/function（不只前端用到的，孤兒表也要），`public` schema 的一律確認 anon grant + RLS policy 都收斂。

### anon key 是公開的，安全靠 RLS/GRANT 不靠藏 key
Supabase anon key 設計上就是前端公開憑證（bundle 可抽出）。安全**不能靠藏 anon key**，要靠後端 RLS + GRANT/REVOKE。「即使拿到 anon key 也讀不到機密」= REVOKE anon + RPC owner 守門；要拿機密必須換到登入後的 user token（authenticated JWT）+ tier 足夠。UI 鎖（不 REVOKE）= 資料對所有人公開，只能用在非機密引導註冊。註：Supabase host 是架在 Supabase 自己的 Cloudflare 後（`server: cloudflare`），**不經自站 zone** → 自站 Cloudflare rate limit 對 Supabase 無效，防額度濫用走 Supabase Spend Cap。

### SECURITY DEFINER + 含 INSERT 的 RPC 必須 VOLATILE
PostgREST 對 STABLE/IMMUTABLE function 用 READ ONLY transaction，VOLATILE 才用 READ WRITE。所以任何「函式內要寫入」（audit log、計數、狀態）的 RPC **必須標 VOLATILE**，否則 REST 呼叫觸發 `25006 read-only transaction`。此類 bug 只有「有權限進入函式的角色透過真 REST」會踩到，psql 直測與 anon（ACL 擋）都測不出。

## 靜態 GeoJSON 快照上線前必過 strict-JSON 驗證（2026-07-23 教訓）

Python `json` 與 `jq` 都接受 `Infinity` / `-Infinity` / `NaN` 非標準 literal，瀏覽器 `JSON.parse` 不接受——一個壞值讓**整檔**解析失敗、圖層 0 點（不是單 feature 壞）。
- 驗收指令：`node -e 'JSON.parse(require("fs").readFileSync(f,"utf8"))'` 或快篩 `grep -c ':Infinity\|:-Infinity\|:NaN'`
- 上游匯出腳本一律 `json.dumps(..., allow_nan=False)` + 計算處 `math.isfinite` 守門
- 除法產生的欄位（yoy、比率、成長率）是高風險點：分母 0 → inf

## 共用 worktree 有平行 session 時的 git 紀律（2026-07-24 教訓）

同一 repo 主 worktree 可能多個 session 同時動工（本次 canopy commit 因本 session checkout feature branch 而落錯 branch）：
- 開工先 `git status`：發現非預期 WIP → 當作「另一 session 進行中」處理，**只 stash 自己必要的檔**、用畢即 pop，不做超出必要的清理
- commit 前**逐檔驗 diff**（`git show <hash> -- <file>`），確認沒吞到別人的 hunks
- branch 手術（rebase / 拆 commit / 組乾淨血統）**絕不在主 worktree 做**：`git worktree add`（scratch）操作 + `git push origin <sha>:refs/heads/<branch>` 推乾淨結果，主 worktree 與對方 WIP 全程不碰（呼應 PLAYBOOKS 混合 WIP 拆分 SOP + PB-29）

## RLS policy 角色完整性（⚠ P0，2026-07-26 登入半殘站教訓）

- 新表 RLS policy 一律 `TO anon, authenticated`（或 `roles={public}`，範本：reservoir_* 系列）
- **新增身分角色上線時（如 migration 270 會員系統），必須回掃全 schema 既有 policy 的 roles**——live.* 48 條 anon-only 讓登入會員靜默拿 0 rows 三週（RLS 無 matching policy 不報錯，前端只會「載入中」）
- lint 驅動的安全清理要核對涵蓋類別：Supabase Advisor 0013 只抓「RLS 未啟用」，抓不到「已啟用但 roles 不完整」（314/315 兩輪清理都因此漏掃）
- 診斷法：`SET ROLE authenticated; SELECT count(*) FROM <表>;` 直接模擬，勝過讀 policy 定義猜行為
- 修復範式：migration 318——`ALTER POLICY … TO anon, authenticated` 純加法；清單由 `pg_policies WHERE roles::text='{anon}' AND cmd='SELECT'` 現場生成，不手抄

## 外部服務 quota / 計價數字必上網驗證（2026-07-26 YouTube 改制教訓）

訓練知識的配額數字可能已過時：YouTube Data API 舊制「search.list 100 units 從 10,000 共用池扣」已改為「search.list 獨立桶 100 calls/day 硬上限（PT 午夜重置）+ 其他端點共用 10,000 units」。約束性質從「花錢」變「硬擋」，直接影響錯誤處理設計（quotaExceeded → sticky + 冷卻到次日，不重試）。**影響架構決策的外部數字，設計前一律 WebFetch 官方文件驗證**——本次是用戶質疑「有上網驗證過嗎」才抓到。

## Collector sticky 寫入原則（2026-07-26 yt resolver 教訓）

時序「現值表」（*_current）的 collector 失敗時**禁止覆寫已知有效值**：
- 抓取/API 失敗 → 保留上次值，last_error 記原因
- 確定失效（如直播下播）→ 先補查替代，找到才換、找不到才清
- 配 TTL（如 48h 未驗證才清）防殭屍殘留
反例：舊 yt resolver 失敗即整列清空，在 0.3% 成功率下等於每天只有 5 分鐘有資料（TVBS 三年沒換的 ID 也活不過下一輪）。寫入層 transform 是無條件整列覆寫時，sticky 要做在 collector 層。

## raster 值編碼圖層的 raster-color-mix 係數（⚠ P0，2026-07-31 實測定案）

mapbox-gl 3.x 的 `raster-color-mix` 係數作用在「正規化 0–1 的 texture 取樣值」上：
**mix = 物理 decode 斜率 ×255**（canopy `6.375=255/40`、urbanHeat `51=255/5` / `63.75=255/4`），
offset 不變；`["raster-value"]` 與 `raster-color` stop 一律寫物理值。

- **禁止**依 mapbox-gl 原始碼片段推導改用未 ×255 的物理斜率——2026-07-30 實測會讓整層飽和在
  range 下限、單色無漸層（shader 換算鏈太長，片段推導必翻車）。
- **驗收鐵則**：raster / shader 類實作一律以「畫面像素取樣」定案——多點 RGB 彼此相異＝有漸層、
  nodata 區透明見底圖；不信原始碼推導、不信 code review。既有 working 圖層（canopyHeight）
  就是現成對照組，**推翻它之前先實測它**。
- nodata 一律靠 source alpha（mapbox 會把 A 乘進上色結果），不要加透明 stop、不要用哨兵值判斷
  （量化後 DN=0 是合法物理值）。

## Stacked PR merge 順序（2026-07-31 教訓）

GitHub squash merge + **刪除 base branch** 時，以該 branch 為 base 的 stacked PR 會被
**自動 CLOSED**（不會 retarget 到 master），內容不會進 master——#93 因此蒸發、靠手動重發 #94 補回。

- Stacked PR 一律**由底往上依序 merge**；每 merge 一層，立刻把上層
  `git rebase --onto origin/master <舊 base 尖>` 落到最新 master 再更新/重發 PR。
- 或 merge base PR 時**先不刪 branch**，等整條鏈 merge 完再清。
- 看到 PR 莫名 CLOSED + CONFLICTING：先查 base branch 是否已被刪，不要急著解衝突。

## Resolved key 模式：跨表時間窗 join 封裝在 DB 端（2026-07-31 地震回放）

多來源表沒有統一 FK、時間戳有系統性差異（NCDR 取整分 / CWA 初報修訂漂移）時：

- **清單 RPC 在 DB 端做完時間窗配對，回傳「配對成功的對方實際 key」**（grid_event_time /
  town_origin_time / tensor_origin_utc），契約：`has_x = true ⟺ x_key 非 NULL ⟺ 用該 key
  等值查一定撈得到列`
- 前端**一律等值查詢，禁止自己做時間窗**——每個消費者自算窗 = 每個都可能算錯一次
- 窗寬按**觀測到的漂移量級**開（town ±5s 吸秒級漂移；grid ±90s 吸取整分），不要「反正開大點」
  ——地震序列 90 秒內兩起有感不罕見，大窗會誤配鄰近事件
- 寫法：LATERAL + 索引範圍條件 + 內層 DISTINCT，成本與全表列數脫鉤（範本 gis-platform mig 324）

## 事件級回放用 scoped 時鐘，不掛全域 timeStore（2026-07-31 地震回放）

「選一起事件重播它的過程」（秒級尺度）與全域 timeline（日級尺度）是兩種時間模型，不要硬併：

- scoped 播放器自帶 RAF + external clock store（比照 timeStore 慣例、通知節流 10Hz），
  時鐘存 ref/store 不進 React state deps——回放期間 App 零 re-render
- 所有視覺寫成「當前時鐘的純函數」（feature-state 每幀重算 + 量化去抖）→ **scrub = set 時鐘**
  即完成，不需額外狀態機
- 既有先例：earthquakes ripple 自帶 RAF；本原則是其一般化（範本 `useEarthquakeReplayLayer` +
  `earthquakeReplayClock`）。§動態圖層時間訂閱鐵則仍適用於「掛全域時間軸」的圖層，兩者不衝突
- **第二個實例（2026-08-08 embed 回放）**：`src/embed/replayClock.ts` —— 嵌入頁根本沒有全域
  timeStore，一整天的回放（play/pause/speed/loop）全掛 scoped 時鐘。同一個模型在
  「秒級事件」與「一整天多圖層」兩種尺度都成立，可以當預設選項而非特例
- ⚠️ **多層共用一個 scoped 時鐘時，時間範圍要取聯集、`setRange` 只能呼叫一次**。
  第一版 `startReplay` 只取第一個回放層、且每層各自重設時鐘 → `layers=flights,ships`
  第二層不啟動且互蓋。正解：多層平行 fetch → 算聯集 → 設一次範圍 → 一起播

## NULL 與 0 語意分離（2026-08-02 共機資料教訓）

**「沒抓到」和「真的是零」在資料層必須分得開**，前端才能誠實呈現。

- 解析不出來的欄位一律留 `NULL`，**不得用 0 冒充**；只有在能明確斷定「當日確實為零」時才寫 0
  （例：通報只列共艦未提共機 → 已解析出共艦即可斷定 0 架次；整段沒解析到 → 留 NULL）
- RPC **不要無差別 `COALESCE(...,0)`** —— 既有 `get_pla_activity_latest()` 就是這樣把
  「沒抓到」顯示成「零架次」= 謊報。趨勢類 RPC 一律保留 NULL 交給前端
- 前端 sparkline 遇 NULL **斷線分段**，不可補 0（會在圖上拉出不存在的谷底）
- 回填 UPSERT 用 `COALESCE(EXCLUDED.x, 舊值)`，避免新來源的 NULL 覆蓋既有已解析值

## 守門優先用「資料自帶的 ground truth」（2026-08-02）

當「什麼是對的」很難用幾何或規則定義時，**先找資料裡有沒有現成答案**，不要急著自創指標。

- 共機航跡圖向量化連錯兩個幾何指標（填充率、內縮空心度）才發現：
  圖左上角表格就寫著當日項次數 —— 來自圖面本身、不需人工標註，直接拿來對照抽出的形狀數
- 自創指標前先問：這份資料有沒有自己聲明過答案？（表格、標題、附帶欄位、雙語對照）
- ⚠️ 但要驗證這個 ground truth 的**定義範圍**：共機表格的「項次」不全是封閉多邊形
  （空飄氣球是虛線軌跡），照單全收會把正確結果誤判為失敗

## 長尾分布用滾動百分位，不用平均（2026-08-03）

要回答「今天算不算嚴重」時，**平均值在長尾資料上會系統性說謊**。

- 共機近 120 天實測：架次**中位數 5**、逾越中線**中位數 0**（62 天完全沒越線、
  18 天零架次），但長尾拉到 32/26 → 平均 7.9 被少數大日子拉高。
  原前端卡片的「vs 30 日均 7.7」正是這個問題：平靜日被低估、忙碌日被高估
- 改用「該日往前 N 天」的百分位排名，門檻由資料自己決定，不用人工訂閾值
- **分級一定要同時顯示絕對數字與該級距門檻**（「一般 · ≥5 架次」而非只給「一般」）——
  百分位是相對的，連續平靜的 N 天會讓中等日子排到高分位
- 多維度時用「取高者 + 共振加成」（兩軸皆 ≥p90 再升一級），
  不要加權求和 —— 權重無從解釋，共振規則可以

## 疊圖的單層 alpha 要依疊加層數縮放（2026-08-03）

alpha 疊加是 `1-(1-a)^n`，不是線性的。單層 0.22 疊 20 層就已經 0.99 接近不透明。

- 共機活動區疊 120 天實測整塊糊成不透明，底圖與密度差異全部看不見
- 解法：單層 alpha 依 `pow(層數, -0.6)` 縮放（30 天≈0.028、120 天≈0.012），
  讓熱區的**典型重疊層數**落在 0.3~0.6 的可讀區間
- 線框衰減要比填色慢（`-0.35`）並收細 —— 輪廓才是形狀感的來源，但太多粗線會蓋過密度
- 通則：做任何「疊加密度」視覺前，先估「熱區大概疊幾層」再回推單層 alpha，
  不要先做完再用眼睛調

## 驗 anon 權限一律用 SET LOCAL（2026-08-03，第二次踩同一類）

`psql -c "SET ROLE anon; SELECT …"` 是 **session 級**指令，在 Supabase 的 Supavisor
transaction pool 下會**殘留在後端連線上**，被別的 client 抽到就中毒。

- 本次症狀：驗完 migration 330 的 anon 權限後，331 apply 直接 `permission denied for schema public`
- 正確寫法：`BEGIN; SET LOCAL ROLE anon; …; ROLLBACK;`（transaction 範圍，必定還原）
- 解毒：多條連線併發送 `RESET ROLE` 搶中毒的 backend，直到 `SELECT current_user` 全回 postgres
- 同類事故 2026-07-24 已寫成 `data-collectors/.claude/pitfalls/`，**仍再踩一次** ——
  文件沒有守門就防不住（見 REFLECTIONS 2026-08-03）

## 資料契約 ratchet 守不到「筆數位移」（2026-08-06）

`staticDataContract` / `classificationCoverage` 兩支 ratchet 防的是：
欄位改名、改型別、新增分類值 —— 都是**結構性**變動。

**防不了**：上游改了「判定規則」而結構不變。殯葬業者的 `is_active` 把「遷他縣市」
由 true 改判 false，欄位還是 boolean、分類值一個沒變 → 兩支測試全綠，
但 UI 上 9 處寫死的「仍營業 (4,595)」全部變成錯的，畫面照樣正常渲染。

- 這類漂移**只能靠人工同步**，所以要寫進 feature handoff 的「上游改動 → 下游要跟改」表，
  且明講「測試擋不到」，不要讓下一個人以為有守門
- 若某個數字被寫死在 3 處以上 → 考慮改成從資料檔算（build 時產生常數），
  但別為了少數幾處過度工程
- 同理適用：總筆數、覆蓋率、百分比 —— 凡是**寫死在 UI/文件裡的統計值**都會腐敗

## 狀態桶的命名要涵蓋桶內全部語意，不能拿最常見的代表全部（2026-08-06）

殯葬業者的 `is_active=false` 桶含六種 status：歇業／撤銷／解散／廢止／停業／**遷他縣市**。
原本 UI 寫「已歇業 (1,638)」—— 但「遷他縣市」那 26 筆是**遷走了**不是**收了**，
講成歇業等於把錯誤從地圖搬到文案。改成「已失效」。

- 判準：桶名要對桶內**每一個**成員都成立，不是對多數成立就好
- 這種錯不會有人回報（畫面正常、數字也對），但會讓讀圖的人得到錯結論
- 對照：`precision` 欄位同樣是「一個欄位多種語意」，前端拆成
  `FUNERAL_APPROX_PRECISIONS` 白名單而非硬編某一個值，就是同一個道理

## 「0 筆是合法結果」的表不能當心跳（⚠ P0，2026-08-07 三連斷供教訓）

落雷沒雷雨時 0 筆、共機 0 架次那天 0 個形狀、沒地震就沒地震資料 —— 這些表的
「空」是**正常業務結果**，不是故障。拿它們的 `max(time_column)` 當新鮮度監控會有兩個後果：
沒事發生時誤報成 DEAD（久了變沒人理的噪音），真的斷供時分不出來。

**正解：為 pipeline 開一張 ledger，每個處理過的單位必有一列**（不論產出幾筆），
監控指向 ledger 的 `run_at`。ledger 同時是補跑判定依據與品質儀表。
產出表則加進 `tests/test_cross_layer_sync.py` 的 `_REALTIME_TABLES_EXEMPT` 並註明「由 X 代監控」。

範例：`spatial.pla_tracks_runs`（migration 337）—— 沒有它，共機航跡斷了 5 天沒人知道，
因為 `spatial.pla_tracks` 在「0 架次」那天本來就沒有 row，分不出「沒共機」與「沒跑」。

同理，`metadata.collector_status` 的 `last_success_at` 也是這個問題的受害者
（只在有 records 寫入時更新）→ 不能拿它判斷 collector 死活。

## 批次流程改單筆執行時，要先問「批次的哪個保護消失了」（2026-08-07 共機配準教訓）

共機航跡向量化原本是「一次吃一整個資料夾、依圖片尺寸分組取**中位數**當共用配準」。
改成每日跑單張時，中位數這層保護就消失了 —— 而它不只是省事，是**正確性的保護**：

2026-05~07 實測 75 張，`solve_georef()` 有 **16% 會「成功但錯誤」**（網格線 off-by-N，
整幅圖平移最多 3 度 ≈ 台海 300 km），11% 直接失敗，只有 73% 正確。
單張跑而直接採用當張解 = 每 6 天就有 1 天畫在錯的位置，而既有的 `needs_review` 守門
**抓不到**（它只比對形狀數量，不驗位置）。

→ 解法是把批次算出的共用值**固化成常數**，當張解只拿來做一致性檢查與「上游改版」偵測。
→ 通則：把 batch 改成 stream／把多筆改成單筆時，逐一盤點「原本靠多筆樣本才成立的假設」。

## 降低輪詢頻率必須配「上游恢復」告警（2026-08-07 台電落雷）

台電落雷斷供後把 interval 從 1 分鐘放寬到 30 分鐘省請求，但那個端點是
**「1 分鐘整檔覆寫」**——每批落雷只在檔案裡存在 60 秒。一旦上游恢復，30 分鐘跑一次
會漏掉 29/30。**光降頻不加告警 = 默默放棄這個資料源。**

告警的判準也有陷阱：**不能用「這輪有資料」**，因為沒有雷雨時本來就是 0 筆
（同上一條原則），那樣每場雷雨都會誤報。改查「DB 上一筆該來源的資料距今多久」，
超過 N 天才算恢復（`RECOVERY_GAP_DAYS = 3`）。查詢只在「這輪有資料」時才跑，
斷供期間永遠不執行，平時零成本。

Telegram 訊息要直接寫「請把 X 調回 Y 並 restart」，不要只說「上游恢復了」——
收到通知的人（可能是幾個月後的自己）不該還要回頭翻文件才知道要做什麼。

## Embed 頁絕不打 Supabase／Mapbox —— 已有的不變量要補測試守住（⚠ P0，2026-08-08）

嵌入頁的整個價值前提是「被讀幾次都不產生費用」。這個前提**每加一個新圖層就可能被打破一次**，
而且打破的方式很隱蔽：一個 `import` 就夠了。

- **實測到的破口**：LegendPanel 是 base bundle 的 **static import**，圖例若向 Scene 檔取色
  （`ShipScene.ts`）就會把整個 three 拖進純靜態嵌入。修法是把色票下沉到
  `src/data/shipTrails.ts` 這種無渲染依賴的模組
- **守法是 bundle 不變量而非人工檢查**：build 後掃 `dist/assets/embed-*.js`，
  `WebGLRenderer` / `InstancedMesh` 出現次數必須是 **0**（three 只能走 dynamic import 進 runtime chunk）
- 同理，`public/static-rpc/` 缺檔會讓 loader **靜默 fallback 打 RPC**（EM-17 現在就在付 egress）——
  「有 fallback」不等於「安全」，它只是把破口變得沒有症狀

→ 通則：只要一個功能是靠「某件事不會發生」定義的，就要有一條會紅的檢查盯著它，
不能靠記得。

## 保存層 vs 成品包分離（⚠ P0，2026-08-08 nightly trails 教訓）

`s3://…/trails/` 是**保存層**：為了不被 retention 吃掉而每晚匯出的原始日檔。
它**不在 `deploy-assets/` 下、不經 nginx／Cloudflare、前端一律不直讀**。

- 前端直讀 S3 的代價是 egress **$0.114/GB**：一個 36MB 的 bus 日檔被讀 1,000 次 ≈ $4/月，
  **超過它整整一年的儲存費**。存起來很便宜，直接送出去很貴
- 要拿保存層的資料畫圖，必須先加工成「成品包」（欄位與體積都為這張圖裁切過）放進供檔路徑。
  例：`trails/` → 量化＋簡化 → `public/embed-snapshots/<layer>/<date>.json.gz`
- 兩層的最佳化方向天生相反：保存層求**完整**（欄位不刪、精度不降，因為救不回來了），
  成品包求**小**。混在一起 = 兩邊都做不好

## 每日變動塊 vs 日期無關共用資產（2026-08-08 rail bundle 設計）

切 bundle 的判準是「**明天重跑會不會變**」，不是「大不大」。

- rail 回放的軌道幾何不隨日期變 → 抽成單一共用資產 `public/embed-rail/rail_slim.<hash>.json.gz`；
  每日檔只剩時刻表 → **229KB**，而幾何本身 367KB 只需下載一次
- 對照：flights/ships 是軌跡插值型，資料**本身**就是每日變動塊，切不出共用資產
  （ships 日檔 4.78MiB 是不可壓縮的本質成本）
- 共用資產「會隨管線重跑而更新」本來是 immutable 的阻礙，但那是**固定檔名**的問題，
  不是共用資產的問題 → 改成內容雜湊檔名就解掉了（見下條）

## immutable 快取只給「檔名含日期**或內容雜湊**」的檔（2026-08-08 立、2026-08-09 擴充）

**判準**：URL 是否唯一對應一份永不改變的內容。是 → `1y immutable`；否 → 短 TTL。
拿到這個資格有兩條路，缺一不可地都要讓「內容變 ⇒ URL 變」：

| 路徑 | 例 | 誰在用 |
|---|---|---|
| 檔名含**日期**（天然凍結） | `/embed-snapshots/rail/2026-08-06.json.gz` | EM-15/16 快照 |
| 檔名含**內容雜湊**（sha256 前 10 碼） | `/embed-rail/rail_slim.4e0dc14093.json.gz` | rail 幾何 bundle |

檔名沒帶日期／雜湊就沒有資格 immutable，不管它「應該很少改」——
`/embed-rail/` 初版就是固定檔名，只敢給 `expires 1d`，代價是幾何更新後讀者最慘要
**兩天**（CDN 1d + 瀏覽器 1d）才看得到新軌道，而唯一的補救 `purge-cloudflare-cache.sh`
是 purge_everything（會連 297MB 底圖一起清）。

**雜湊化的三個必要條件**（少一個就不是真冪等，等於每次重跑都換 URL、快取全失效）：
1. hash 算在**實際寫出的 canonical bytes** 上（`sort_keys` + 固定分隔符），外部
   `gunzip -c x.json.gz | shasum -a 256` 要對得上
2. 內容裡**不可有時間戳**（`generated_at` 只放 manifest）
3. gzip 寫入用 `mtime=0`（預設埋當下時間 → 同內容也產出不同 bytes）

**指標檔（manifest）模式**：雜湊檔名讀者猜不到 → 加一層 `rail-manifest.json` 指出檔名
（同 `trails/<dataset>/manifest.json`、ship-data manifest 的形狀）。manifest 自己給
`max-age=60`（**不是 no-cache**：它在串行 critical path 上，no-cache 等於每次載入多付一個
RTT；60s 陳舊窗因為產生器 `--keep 3` 保留舊檔而無害 —— 拿到舊 manifest 只會抓到能用的舊幾何）。
前端必須對「manifest 失敗」與「bundle 失敗」**兩者都降級**：部署是整夾 `aws s3 sync`，
`rail-manifest.json` 字典序在 `rail_slim.*` 之前（`-` < `_`），manifest 先落地的窗內 bundle 會 404。

**收益**：幾何更新後**完全不需要清 CDN 快取**。舊 URL 的快取放著爛掉也無妨。

順帶一條：**`Content-Encoding` 決定不設**，改由前端讀 magic byte（`0x1f 0x8b`）判斷是否解壓。
正式站 nginx 服務的是 volume 本地檔，S3 object metadata 根本到不了瀏覽器；
設了只會製造「S3 上有、線上沒有」的矛盾狀態。

## 圖例不憑空發明分類（2026-08-08）

圖例必須忠實反映**渲染端真正的語意**，沒有語意就不要編一個。

- `FlightScene` 是 `idx % colors` **輪替配色**，顏色與機型／高度無關 → 圖例只給單條，
  不因為「多色看起來比較專業」就編出分類
- `RailLegend` 的 TRA 車種由 `TRA_TRAIN_TYPES` 推導，且**隨 `rsys=` 收斂**：
  沒選台鐵就不列台鐵車種，也拿掉「灰線為軌道」這句（那條線這時不存在）
- 反例是真語意但**條件限定**：主站「全路徑靜態軌跡」的高度漸層（暖橘低空→冷藍高空）
  是真的，但 Live 限定、embed 不畫 → 要補得另開帶顯示條件的 legend entry，
  不能直接把主站圖例整份搬過去

→ 通則：圖例是對渲染的**描述**不是對資料的**宣稱**。畫面上分不出來的東西，圖例不該分。

## 版本閘門的代價要跟修正的範圍比（2026-08-09，`rsys=` 語意修正未升版）

`rsys=` 從系統級擴到營運者級後，`rsys=trtc` 的結果從 **94 軌道/4,516 班變成 76/3,017**
（原本把整個台北都會區的軌道都算成北捷）—— 這是**行為上的 breaking change**，
但**刻意不升 `URL_STATE_VERSION`**。

判準是比較兩邊的爆炸半徑：

| | 影響範圍 |
|---|---|
| 升版 | **所有**舊嵌入碼整組作廢，包含大量與 rail 完全無關的（相機／圖層／日期） |
| 不升版 | 只有帶 `rsys=trtc` 的連結語意變窄，且 **parse 結果本身沒變**（欄位還在、值還合法、不白畫面） |

版本閘門是**全域**開關，用它來修**單欄語意**等於用核彈打蚊子。
前提是那個欄位的失敗模式必須是良性的（未知值全 drop → 顯示全部，而不是壞掉），
且要有**測試守住舊網址逐欄不變**——不是「應該沒事」，是有 test 會紅。

→ 通則：要升版之前先問「這次修正的範圍，和升版會作廢的範圍，差幾個數量級」。

## deploy 完成前探測新 URL，一律加 cache-buster（2026-08-10）

Cloudflare **預設**就會 negative-cache 404，最長 **4 小時**，且只對**特定副檔名**生效：
`.gz` 在預設可快取清單內（會中招）、`.json` 不在（所以 manifest 一路 DYNAMIC 沒事）。
在 deploy 落地前去 curl 新檔名，等於親手把 404 種進邊緣快取。

⚠️ 這與既有那條「Cache Rule 用固定 TTL 會連 404/5xx 一起快取」（2026-08-05）
**是兩個不同機制**：那條要你自己設過規則才會發生，這條**不設任何規則也會發生**。

- 探測一律 `curl -I "<url>?cb=$(date +%s)"`
- 代價不對稱是重點：本專案唯一的 purge 腳本是 `purge_everything`，
  會連 297MB 底圖一起清，**沒有 scoped purge**（→ BACKLOG G020）
- 內容雜湊 / 含日期的檔名讓「上線後」不必 purge，但**擋不住「上線前」自己種的 404**

→ 通則：只讀的探測看起來零風險，但**探測本身會改變 CDN 狀態**。對還沒存在的資源尤其如此。

## 高度跟內容走的容器裡，有兩個尺寸陷阱（2026-08-10，監看模式九版）

只要一個容器的高度是 `auto`（例如監看模式 `fit: "content"` 的 widget），
它裡面這兩種寫法就會出事，而且**兩者的失敗方向相反**：

| 寫法 | 結果 | 解法 |
|---|---|---|
| 帶 `viewBox` 的 `<svg>`（`height:100%` 或 auto） | 用「寬 × 內建長寬比」自算高度，**把格子撐爆**（實測 253px） | `position:absolute; inset:0` 退出高度計算 |
| 子元素 `height: X%` | 百分比只認父層的**確定**高度，auto 鏈上解不出來 → 當 `auto` → **塌成 0** | 父層寫確定像素高（`height: 190`，**不是** `flex:1 + minHeight:190`） |

三條配套：

- **`width: X%` 一律沒事** —— 寬度那條鏈永遠是確定的（欄寬由 grid/flex 算出）。
  所以各種水平進度條、百分位條可以照寫，只有垂直方向要小心。
- **`flex:1 + minHeight` 只在父層有確定高度時才是「吸收剩餘空間」**；父層一旦 auto，
  它就退化成純粹的 `minHeight`，寫多少就是多少。
- ⚠️ **既有的驗收迴圈抓不到「塌陷」**：逐格比 `scrollHeight` vs `clientHeight` 只覆蓋
  「內容溢出格子」，內容塌成 0 的時候兩個數字完全正常。auto 高度的區塊要**額外量**
  關鍵子元素的實際高度（例如「120 根柱子裡有幾根高度為 0」）。

→ 通則：把高度交給內容決定，等於把整條鏈的「確定性」拿掉；
凡是依賴父層高度的寫法（百分比、內建長寬比）都要重新檢查一次，不能沿用舊模式。

## `package-lock.json` 是唯一 lockfile SSOT，npm 是唯一套件管理器（AU-6 拍板 2026-08-13）

**單一 lockfile 政策已拍板（AU-6 方案 A）**：`package-lock.json` 唯一權威，
`pnpm-lock.yaml` 已刪除，`package.json` 用 `packageManager: "npm@11.4.2"` 釘死。
Dockerfile（`npm ci`）／CI（`cache: 'npm'` + `npm ci`）／README 三個硬約束點本來就全是 npm。

任何 package.json 變動：
1. `npm install --package-lock-only`（只改 lockfile、不動 node_modules，平行 session 安全）
2. `npm ci --dry-run` 驗不同步錯誤

🚫 **不得再跑 `pnpm install` / `pnpm add` / `pnpm install --lockfile-only`** —— 會把
`pnpm-lock.yaml` 生回來，雙 lockfile 漂移就復發。CI 有守門 step 偵測到該檔存在即紅。

npm ci 對 lockfile/package.json 不同步是**直接報錯拒建**，不是警告——漏更 = 下次部署必炸。
歷史脈絡（2026-08-10 兩次險斷部署）見 `INCIDENTS.md`。

## Agent 產出的 git 事實聲明，破壞性操作前必現場驗證（2026-08-10）

稽核/執行 agent 回報的「檔案在 git 追蹤中」「分支 A 包含於分支 B」這類聲明，
在 rm / git rm / branch -D 之前一律用指令現場驗證：
- 追蹤狀態：`git ls-files <path>`＋`git log --all --diff-filter=A -- <path>`（後者才能分辨「曾進過 vs 從未進過」）
- 分支包含：`git merge-base --is-ancestor A B`
本日兩次靠這個擋下錯誤（schools.geojson 從未進 git／monitor batch1 ⊄ grid-layout）。
成本是一行指令，錯刪的代價是 reflog 過期後永久丟失。

## 比值分色必先擋分母 —— Mapbox 除以 0 得 Infinity **不報錯**（⚠ P0，2026-08-13 社福長照）

`["/", a, b]` 在 b 為 0 時回 `Infinity` 而不是拋錯，`step` 拿到 Infinity 會**穩穩落進最上面那桶**。
身障機構使用率（實際安置／核定量）如果不擋，334 筆裡 88 筆分母為 0 的會全部染成
「超過 100%」→ 畫面長出「全台身障機構嚴重超收」，畫得出來、不報錯、測試也全綠。

寫法：**`case` 先擋，再 `step` 分級**，兩個分母失效情境都要蓋：

```ts
["case",
  ["<=", quotaExpr, 0], MISSING_COLOR,   // 含「key 不存在」與「值就是 0」
  ["step", ["/", actualExpr, quotaExpr], ...]]
```

推廣：**任何 `["/"]`／`["*"]` 前先問「分母/來源可能是 0 或缺值嗎」**。
同類還有 `["log10"]`（0 → −Infinity）、`["sqrt"]`（負數 → NaN）。
圖例一定要有「無資料」那一格，否則使用者無從分辨「灰＝沒資料」與「灰＝未分類」。

## 上游數值欄位可能是字串，且空值 property 會**整個消失**（2026-08-13 社福長照）

兩件常一起出現、都不會報錯的事：

1. **數值給成字串**（`"56"` 不是 `56`）→ paint 用 `["to-number", …]`，JS 用 `Number()`
2. **空值在匯出時把整個 key 拿掉**（不是留空字串／null）→ **不可假設 key 存在**：
   paint 用 `["coalesce", ["get", f], 0]`，JS 用 `"key" in props` 判斷有無資料

第 2 點的陷阱在於它讓「沒有資料」與「值是 0」長得一樣。社福長照踩到兩次：
護理之家 112 筆沒有床數欄位 vs 居家護理所 732 筆床數真的是 0 ——
前者 popup 要寫「上游未提供」，後者要寫「無床位（到宅服務）」，混在一起就是騙人。

守法：`staticDataContract.test.ts` 逐欄寫 `{field, type, minCoverage}`
（型別漂移＋覆蓋率下滑都會紅），把當下的覆蓋率當 baseline 焊住。

## 分類欄位不要只挑「主要那一欄」做視覺量值（2026-08-13 社福長照床數）

護理之家泡泡第一版用 `beds_nh`，結果 1,499 筆裡 989 筆是 0 → 三分之二的點縮成同一顆
最小點，看起來像資料壞了。真相是**床數分散在三欄**：居家護理所（732）本來就沒有床、
產後護理之家（257）的床在 `beds_postpartum`/`beds_infant`。

判準：**做泡泡/熱度前先看該欄的 0 值比例**。0 值佔比異常高時先問
「這些 0 是真的 0，還是量錯了欄位」。真的 0（居家護理所無床）要在圖例講明白，
不要讓使用者以為是缺資料。

## ≤3 選項的 select 會渲染成 button row，中文 label 壓在 4 字內（2026-08-13）

四鐵則 #4 說的是「≥4 選項要用原生 `<select>`」，但**反向也有坑**：
`options.length > 3` 才切 dropdown，**3 個以內走橫向 button row**，
~240px 側欄裡每顆只有約 55px。社福長照第一版精度篩選寫
「排除概略點」「只看概略點 (98)」→ 三顆**全部折行**，連「全部」都被拆成「全」「部」。

規則：button row 的中文 label **≤4 字**；筆數、單位這類補充資訊搬去圖例或 popup。
⚠️ 只改 `label`，`value` 與 `encode` 不要動（那會改掉篩選語意與 overlayParams 編碼）。

**這條沒有測試守門** —— 四鐵則裡 #2 有 `layerConsistency` 擋、#1/#3 有 manifest 派生，
只有 #4 純靠人眼。新層驗收**一定要真的把 sidebar 打開展開參數面板看一眼**（見 REFLECTIONS 2026-08-13）。

## 上游建議與站台鐵則衝突時，鐵則優先 ＋ 差異寫進 feature docs（2026-08-13）

上游 handoff 建議「預設開 3 層」，撞上本站 2026-08-10 的「預設全關：訪客一進站不打
任何 RPC、不載任何圖層」。兩個都對，但**站台級規則的射程比單一主題大**。

處置三步（不要靜默照做，也不要靜默不做）：
1. 照鐵則做（`DEFAULT_ON` 不動）
2. 找一個成本為零的折衷（把建議的三層排 sidebar 群內最前）
3. **把差異寫進 `docs/features/<slug>/README.md` ＋ backlog 一條待拍板項**，
   註明「改回來是一行的事」——讓 owner 能一句話翻案，而不是日後考古為什麼沒照做

2026-08-13 owner 拍板：**維持不預設開**（確認語意＝「打開網址什麼都沒點就已經開著」）。

## worktree 驗證會靜默 skip 跨 repo 測試（⚠ P0，2026-08-20 教訓）

`src/data/__tests__/upstreamRegistry.test.ts` 的
「every verified datasetId exists in catalog」會解 `../../../../taipei-gis-analytics/docs/data-catalog`，
**解不到就 `return` 靜默跳過**（測試名字就叫 `skips if sibling repo absent`）。

`.claude/worktrees/<name>/` 底下的 worktree 相對路徑指向
`mini-taiwan-pulse/.claude/taipei-gis-analytics`，**永遠解不到** → 該測試從不執行。

於是「50 檔 649 測試全過」在 worktree 裡是**假綠**：真正跑到的是 649 減掉那一項。
2026-08-20 兩批工作（vessel-zone + animal welfare）都在 worktree 驗證，
合併回主樹才發現 10 個 broken catalog ref，其中 6 個從 08-18 就紅著沒人知道。

**規則**：
1. **收尾／發 PR 前必須在主樹（或 `GIS/` 同層的 worktree）跑一次完整測試**，
   worktree 的綠燈不算數。
2. 寫「若 X 不存在就 skip」的測試時，**skip 要能被看見** ——
   至少 `console.warn`，最好讓 CI 在預期環境下 skip 時直接失敗。
3. 報告測試結果時，**skipped 數字要跟 passed 一起講**。
   本次多輪回報都只說「649 passed」，沒注意到那個 `1 skipped` 就是被跳過的守門測試。
