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
