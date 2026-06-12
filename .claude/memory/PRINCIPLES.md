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
