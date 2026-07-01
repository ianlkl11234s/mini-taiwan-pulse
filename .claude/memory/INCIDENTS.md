# Incidents（append-only）

遇到問題並解決後記錄。格式：`## YYYY-MM-DD 標題` → 現象 / 根因 / 對策。

> 只 append，不修改舊條目。長篇紀錄放到 `.claude/pitfalls/` 後這裡附 link。

---

## 2026-06-22 加油站 30km coverage — Overpass mirror 連環卡 8 小時 + pyrosm 爆 RAM

**現象**：開始做加油站 30km 路網可達分析（osmnx + multi_source_dijkstra）後，遇到一連串 batch 卡死：

| 時點 | 卡點 | etime | 根因 | 解 |
|---|---|---|---|---|
| 6/21 22:33 | osmnx +unclassified 跑 8h CPU=0% | 8h | Overpass kumi mirror 某 subquery 卡 read 不回 | kill |
| 6/22 早 | pyrosm 全台 driving 跑 40 min | 40min | 50 GB RAM 吃爆磁碟 5 GB free，swap thrash | kill |
| 6/22 12:00 | osm.fr mirror 403 | — | whitelist only | 跳過此 mirror |
| 6/22 13:00 | kumi 跑 23 min 0 進度 | 23min | 第一個 subquery 卡 | kill, retry overpass-api.de |
| 6/22 13:30 | overpass-api.de 406 拒連 | — | IP 被 ban（cooldown 24-72h）| 等 |
| 6/22 14:50 | overpass-api.de 200 OK | — | cooldown 解除（~15h）| **跑成功** 10 min |

**根因**（多層交疊）：
1. **osmnx subdivide 阿基里斯腱**：全台 bbox 80,000 km² 被切 32 個 subquery 序列跑，**任一卡死全 process 卡死**，無 socket timeout
2. **mirror 不穩定**：overpass-api.de 短時間多打觸發 IP ban / kumi 對全台大 subquery 卡死 / fr 永遠 whitelist 403
3. **pyrosm 沒 osmium 過濾就讀全 PBF**：driving network 含 residential 估 100-200 萬 edges，networkx Graph 物件吃 50 GB RAM
4. **磁碟 5 GB free** 不夠 swap → swap thrash → CPU 5% 假活著

**我自己也犯的兩個 bug**（→ REFLECTIONS）：
- **`OVERPASS_URL` 設 `/api/interpreter` 拼錯**：osmnx 自動拼 → 變 `/interpreter/interpreter`。應該設 base `/api`
- **`CUSTOM_FILTER` 沒對齊**：為了試 B 版加 `unclassified`，後來想 retry A 版（motorway-tertiary）忘記改回，**以為跑 A 實際跑 B 又卡**，浪費 ~1 小時

**對策**（→ SKILL accessibility-analysis）：
- 新增 `.claude/skills/accessibility-analysis/references/troubleshooting.md`：跑前 30 秒健康檢查 + 卡時 5 分鐘診斷流程 + 6 條 pipeline 寫法守則 + 本 session 卡點實錄
- 新增 `references/mirror-fallback.md`：5 條救援路徑（重試 / 切 mirror / 本機 PBF+osmium / OSRM 雲端 / pgRouting）
- PRINCIPLES 加 4 條：multi-bucket / whitelist / 跑前健康檢查 / CPU=0% 不等於 deadlock

**教訓核心**：**Overpass 公開 mirror 是不可靠依賴**，生產 pipeline 必有 fallback 路徑。沒 fallback 就會像本 session 卡 8 小時。

---

## 2026-06-22 加油站 SQL CASE 短路求值吃掉 73 個雙品牌站

**現象**：加油站 30km coverage 上線後，「台糖 最近距離」layer 在地圖上覆蓋面積比預期小很多（覆蓋率 50%）。用戶截圖回報 — 點到「台糖平和站加油站」popup 顯示 `brand=["中油","台糖"]`，但這站在「中油 layer」有出現、在「台糖 layer」沒有。

**根因**：原 SQL bucket 邏輯用 `CASE WHEN` 短路求值：
```sql
CASE WHEN '中油' = ANY(brand) THEN 'cpc'         -- 中油+台糖 在這就停了
     WHEN '台塑' = ANY(brand) THEN 'fpcc'
     WHEN '台糖' = ANY(brand) THEN 'taisugar'   -- 雙品牌站永遠到不了
END
```

DB 盤點：72 個「中油+台糖」+ 31 個「中油+台塑」+ 1 個「台塑+台糖」= **104 個雙品牌站全部漏歸**。

**對策**：拉原始 `brand[]` 到 Python，`buckets_of()` 每站算「所有匹配 bucket」list，每站可進多 bucket。dijkstra 對每 bucket 跑時雙身分站貢獻多 source。

**數字變化**：
- CPC: 1,988 (不變，含 103 雙身分主導品牌)
- FPCC: 319 → **350** (+31)
- 台糖: 13 → **86** (+73，**覆蓋率 50%→59%**)

**對策延伸**：用 whitelist regex 處理「私營」bucket（之前用 NOT IN 反向定義會吸進 374 個 41455 false positive）。**兩個對策合體**寫成 `buckets_of(brand_arr, name)` 一個函式，→ PRINCIPLES 兩條 / SKILL §⚠️ 兩大鐵則。

---

## 2026-06-19 SessionStart auto-memory-cherry-pick 把 feat 分支歷史拆掉

**現象**：Energy v2 Phase A 過程中跑了 4 次分支管理意外：
1. `git checkout -b feat/energy-v2-A` 之後做 A.1 commit，commit 訊息顯示 `[master ...]`
   ─ 不是預期的 `[feat/energy-v2-A ...]`
2. A.2 commit 成功（`998089f`）後，馬上接著做 B.1 時發現工作區乾淨、分支顯示 master
3. B.1 在 master 改一半才發現分支錯，stash + checkout 後 pop 成功
4. 最後 `git log feat/energy-v2-A` 顯示 A.2 commit **不在歷史中**（branch tip 是 A.1 → B.1+B.2，A.2 被脫鉤）

**根因**：SessionStart hook 會自動：
- `checkout master`
- `cherry-pick` 一個 memory commit（這次是 `e8e122d → a31040f`：memory: rewrite STATUS）

這個 hook 在我做事的 session 中間觸發了 ≥ 2 次（reflog 有兩段 "checkout: moving from feat/energy-v2-A to master" 的紀錄）。
hook 跑完只回 master，不會切回我原本工作的 feature 分支。

我繼續打字 → 動作落到了 master tree，commit 也落到 master。

A.2 commit 之所以從 feat branch 歷史脫鉤，是因為這次 hook 觸發時 branch HEAD 還在 A.2，
但 hook 完不久我又 git branch -D / git branch <branch> <older-sha> 把分支重 anchor 到 A.1。

**對策**：
- 用 `git branch -f feat/energy-v2-A d6a2db3` + `git reset --hard 9367cb3 && git checkout feat/energy-v2-A`
  把第一次跑錯 master 的 commit 搬回 feat 分支
- 後來用 `git stash + checkout + stash pop` 把 B.1 工作搬回 feat 分支
- A.2 用 `git cherry-pick 998089f` 補回（有 docs 衝突手解）
- 最終 feat/energy-v2-A 5 commits 完整 / 132 test pass / 沒丟 work

**教訓**（→ PRINCIPLES）：
- **任何 commit 前先 `git branch --show-current` 確認**，特別是在 session 中段、或上次 commit 後隔了幾分鐘
- **不要在 SessionStart hook 期間做 branch dance**（reset / force-branch），會把 hook 的 checkout 行為混在一起
- **覺察 hook 存在的 signal**：reflog 出現 `cherry-pick: memory: ...` + `checkout: moving from X to master` 連續對；或 `git status` 顯示乾淨但工作區看起來不對

工作沒丟、但解開歷史花了 15+ 分鐘。下次必須早 detect。

## 2026-06-18 useWallClock 無限 re-render — useSyncExternalStore 陷阱

**現象**：Monitor 效能優化（PR #21 perf/monitor-optimization）push 後切到即時新聞跳：
- `Maximum update depth exceeded` × N
- `<IntelCard>` component error
- 串連到 `useNewsTimeline.ts:84 map.getLayer is undefined`（map 還沒 mount，timeStore subscriber 已被 1Hz tick 打中）
- THREE.WebGLRenderer Context Lost

**根因**：新寫的 `src/hooks/useWallClock.ts` 用 `useSyncExternalStore`，但 `getSnapshot`
直接回 `wallClock.getWallNow()` = `Date.now()`，每次呼叫值都不同。React 比對前後
snapshot 不一致就認為 store 變了 → re-render → 再呼叫 getSnapshot → 又不同 → 無限迴圈。

被 IntelCard 用了（每張卡掛一個 useWallClock(30_000)），瞬間爆 update depth。

**對策**：
- `useWallClock` 改回 `useState + useEffect(subscribe)`，setNow 只由 wallClock timer
  callback 觸發，snapshot 永遠等於 state 不會漂移
- Hotfix commit `06105c0` 已 push

**教訓**：`useSyncExternalStore` 的 `getSnapshot` **必須**回快取值（同一 store 狀態
呼叫多次回相同 reference），不能即時計算（Date.now/Math.random/new Map）。
這條進 PRINCIPLES。

---

## 2026-06-12 Prod 首載「toggle 開但圖層沒畫」race（`ccac54b`）

**現象**：Production 首載後開 toggle → 圖層沒出來。本機重現不了。

**根因**：兩條 race：
1. `mapRef.current` 在 map `load` 事件才設定；production 首載 load 延遲達 **30~47 秒**，這期間所有 visibility/params effect 全 no-op **且永不補發**
2. load 後 busy 期間 `isStyleLoaded()` guard 同樣把更新丟掉

**對策**：
- load handler 末尾用 refs **重放 visibility + theme**
- 兩個 overlay effect **拿掉 `isStyleLoaded()` guard**（改進 PRINCIPLES）
- prod 加 `?debug` → `window.__map` 永久保留給排障用

**教訓**：
- **本機（資料秒載）永遠重現不了這種 race** → prod 級驗證要等 map load（30s+）再斷言
- Access log 看 pmtiles「只有 16384 header 讀取、無後續 range」= 圖層沒真的在畫
- 已進 PRINCIPLES：**Map effect 禁用 isStyleLoaded() guard**（L454）

**Long-form**：`~/.claude/projects/.../memory/_archive/perf-overhaul-2026-06.md`（含 8 commits 完整清單 + tippecanoe 坑 + Feature/Legend registry 化）

---

## 2026-06-10 效能體檢 8 commits — tippecanoe polygon 坑

**現象**：13k 河道 polygon 走 PMTiles 後低 zoom 變整島實心色塊。

**根因**：`tippecanoe` 預設 `--coalesce-densest-as-needed` 會把 polygon 合併成大色塊；預設也會把 <1px 小 polygon 換成占位方塊。

**對策**：
- **polygon 轉檔必加 `--no-tiny-polygon-reduction`**
- `--coalesce-densest-as-needed` **只用於 line**，polygon 禁用
- GeoJSON source 補 `tolerance: 1.2, buffer: 64`（純 line/fill）

**教訓**：**audit 推測 ≠ 實測**。原本 audit 標的慢 RPC 實測全 <31ms（matched_day 30 / disaster_alerts 22 / disposal_points 31）— 差點白改 ST_AsGeoJSON。改前必實測。

**副產物**（同批 8 commits）：
- vitest 測試基建首次進來（48 tests）
- overlayManager diff 式 paint 更新（只 set 有變的 key）
- 水利四層轉 PMTiles（35.7MB → 17.1MB）
- `loaderCache` 三種 factory（cachedOnce / cachedByKey / keyedThunkCache），16+2 fetch 套快取
- `dateNotifier` timeline 日期 debounce（leading+trailing 300ms）
- `timelineSliceLayer` factory 收斂水文四 hook（-244 行）
- `layerConsistency.test.ts` ratchet 測試（新 layer 漏接鐵則會 fail）

**Long-form**：`~/.claude/projects/.../memory/_archive/perf-overhaul-2026-06.md`

---

## 2026-04-07 Supabase 遷移後 ship / flight 全空

**現象**：前端切 `VITE_DATA_SOURCE=supabase` 後 ship + flight trails 都空陣列，
但 psql 直連查有資料。

**根因**：RPC 未 GRANT EXECUTE 給 anon role，Supabase 用 anon key 呼叫被擋
（不報錯只回空）。

**對策**：
- Migration 補 `GRANT EXECUTE ON FUNCTION public.get_xxx() TO anon, authenticated`
- PRINCIPLES：RPC 建立後一律補 GRANT

**Long-form**：[.claude/pitfalls/2026-04-07-empty-ships-flights.md](../pitfalls/2026-04-07-empty-ships-flights.md)

---

## 2026-04-09 gis-platform 整台 DB 掛掉（IO/pool 爆表）

**現象**：Goal 2 一口氣加 8 個 `*/10` pg_cron refresh job 後，Disk IO budget 93% → pool 耗盡 → 57P03 整個 DB 掛掉。

**根因**：新 cron × 舊 MV cron × Micro 規格 三合一：
- 新加 8 個 `*/10` 高頻 cron
- **早期遺忘 5 個 `refresh_mv_*_dates`**（ship / flight / youbike_h3 / freeway / disaster_alert）仍在 `*/30` 全掃大表 REFRESH MATERIALIZED VIEW CONCURRENTLY
- Micro compute 87 Mbps IO baseline 承受不住重疊

**對策**：
- **升 Small compute**（2GB / 174 Mbps）— 月費 ~$15.04（Pro plan 內含 $10 credit 後實付 ~$5.23/月）
- Unschedule 5 個廢棄 `refresh_mv_*` cron
- 新 cron 全部錯開分鐘（見 `data-collectors/docs/sql/cron_throttle.sql`）
- 禁再建 `*/10` 以下高頻 cron

**教訓**：

1. **舊 MV cron 用底線命名易漏看** — `ORDER BY jobname` 時 `refresh_mv_*`（底線）與 `refresh-*`（連字號）分開排。做 pg_cron 盤點必須人工掃全表。
2. **Pro plan Spend cap 會擋升級** — Org → Cost Control 若開啟，add-on 加購（含 compute）全被擋。要升級第一步先關 spend cap。Project 頁面不會提示。
3. **Supabase Usage 頁全 0 ≠ 沒事** — Usage 是 plan quota 層（Egress/MAU/Storage），**硬體層（CPU/IO/RAM）不在這頁**。判斷資源要看 Project Advisor + Reports → Database/API。
4. **Pre-aggregate pattern 不是免費** — 把「前端慢」轉成「背景聚合慢」，頻率密集 × 機器小 → 總 IO 反而更多。加新 pre-aggregate 必算「每日總 IO 預算」= cron 頻率 × refresh 掃描量。

**相關 commits**：
- data-collectors `0b50dc2` — `cron_throttle.sql` v1
- data-collectors `aad8026` — `diagnose_resource.sql`
- mini-taiwan-pulse `0e18dd0` — CWA SINCE_HOURS 48→24

**Long-form**：`~/.claude/projects/.../memory/_archive/supabase-compute-sizing.md`（Pro plan 計費完整細節）

---

## 2026-04-10 Bus trails matview OOM

**現象**：`matview_bus_trails` refresh 跑到 OOM，pg_cron 連環失敗。

**根因**：refresh 的 `ORDER BY` 沒對應索引 → 全表 sort 爆記憶體。
用 `mode()` 而非 `MAX()`（前者需額外 sort）。

**對策**：
- refresh function 加索引
- 聚合用 `MAX()` 代替 `mode()`
- 加 `SET work_mem TO '64MB'`
- today + yesterday 合併到同一 cron job 循序跑

**PRINCIPLES**：pre-aggregate 5 大規則升級（索引先行 / 單一 cron / MAX / work_mem / EXPLAIN）

---

## 2026-04-22 `river_lines` 有 2,445 km outlier MultiLineString

**現象**：水庫 context 的 `nearest_river`（KNN）對石門 / 翡翠 / 寶山會「全台亮」。

**根因**：`public.river_lines` 有一筆 MultiLineString 長 2,445 km，
name/type/code 全空（資料源把多條河段聚合成一個 feature）。KNN `<->` 距離運算把
這個巨型 feature 當最近點。

**對策**：
- migration 053 `get_reservoir_watershed_rivers` 改用 `ST_Intersection(river, watershed)`
  剪裁，繞過 outlier
- `nearest_river` 停畫
- Simplify 放 ST_Intersection 之後 10-20x 提速

---

## 2026-04-22 Mapbox custom layer attach `map.once('load')` 永不觸發

**現象**：水庫 3D 水位計 scene 建好、RPC 37 筆回來、rebuild 跑完，
**沒有** `[ReservoirLayer] onAdd` log，畫面沒東西。tsc 0 錯誤。

**根因**：獨立 hook 用 `map.once('load', attach)`，但 hook useEffect 觸發時
map 早已 load 過。`isStyleLoaded()` 短暫 false 時走 else 分支，`load` event
不會再觸發第二次 → attach 永不執行。

**對策**：
- 改用 polling `setInterval(tryAttach, 200)` 直到 `isStyleLoaded()`
- Lessons 升級到 PRINCIPLES「視覺層 debug」
- StationPillarScene 沒踩是因為跟著 `addAllLayers` 在 `handleMapReady` 同步呼叫，
  style 保證 ready；獨立 hook 不能抄相同 pattern

**Long-form**：[.claude/pitfalls/2026-04-22-mapbox-load-once-fired.md](../pitfalls/2026-04-22-mapbox-load-once-fired.md)

---

## 2026-04-22 視覺層 tsc 通過 ≠ 能動

**現象**：Phase 1c 3D 水位計一次改 8+ 檔，tsc 通過就宣布完成，結果 runtime 沒畫面。
用戶截圖 2 輪才找到 bug（~30 min 浪費）。

**根因**：Mapbox custom layer + Three.js scene 從 mount → attach → render 是**多層
非同步 gate**，任何一層壞掉都只表現為「什麼都沒發生」。tsc 只檢查編譯正確性，
不保證 runtime 作動。

**對策**：
- 寫視覺層代碼預設加 checkpoint log（hook mount / RPC 返回 / scene setX /
  rebuild / onAdd / render 1&60）
- PRINCIPLES「視覺層 debug」區
- 一次改 3-4 檔做 smoke test，不要 8+ 檔才驗

---

## 2026-04-22 蓄水率與水利署官網差 5x

**現象**：前端曾文 12%、霧社 12%，水利署 fhy 官網曾文 17%、霧社 73.87%。
用戶質疑「是不是 ID mapping 錯？」

**根因**：`reservoir_situation_v` 分母用 `effective_capacity_wan`（設計有效容量），
水利署官網用 `current_capacity_wan`（現行有效容量，扣淤積）。霧社淤積 81%
（14,860 → 2,869 萬 m³），分母用錯百分比會被壓到 1/5。**不是 ID 問題**。

驗證：曾文 8,250 / 50,479 = 16.34% ≈ 官網 17% ✓

**對策**：
- migration 056 重建 view + `get_reservoir_status_day` + `get_reservoir_timeseries`，
  分母改 `current_capacity_wan`
- alert_level 閾值不變
- current_capacity 40/40 都有值（比 effective_capacity 39/40 覆蓋更好）

---

## 2026-04-22 alert_level 中英文 key 不一致，顏色從未生效

**現象**：水庫 3D 水位計顏色全部青色，不管蓄水率高低。Panel 警示 chip 顏色也不對。

**根因**：`reservoir_situation_v` 的 `alert_level` 輸出**英文**
（`critical/warning/normal/high`），但前端 `ALERT_COLOR_HEX`（3D）與
`ALERT_COLORS`（Panel）都 keyed **中文**（`正常/輕度/中度/重度/嚴重`）。
所有查詢 fallback 到 default 青色，顏色分級從未生效。

**對策**：
- 前端兩處 dict 改英文 key
- 顏色分級：critical=紅 / warning=橘 / normal=青 / high=綠（滿水）
- 加 `ALERT_LABELS` 中文 display 標籤（嚴重/偏低/正常/滿水）

---

## 2026-04-23 水庫 3D Custom Layer 60 FPS 無限 render loop

**現象**：Console 每秒一條 `[ReservoirLayer] render #xxx`，連續刷屏。GPU 不停運轉。

**根因**：`reservoirCustomLayer.render()` 內呼叫 `map.triggerRepaint()` →
Mapbox 下一幀再 render → 再 triggerRepaint → 無限迴圈。

這是動畫型 3D layer（flight/bus 每幀插值）的必要寫法，但水庫是**靜態 3D**
（只有 `setStatuses` / `setActiveOps` / `heightScale` 變動才需重畫），套用同樣
pattern 純粹浪費 GPU。

**對策**：
- 移除 render 內 triggerRepaint
- 改由 hook 在 state 變動 useEffect 內主動 `map.triggerRepaint()`
  - `setStatuses` / `setActiveOps` 時呼叫
  - `heightScale` / `isDark` / `visible` 變動 useEffect
- PRINCIPLES「3D 效能」：靜態 3D layer 禁止 render 內 triggerRepaint

---

## 2026-04-23 水庫日資料 today 只有 28 座閃現

**現象**：`get_reservoir_status_day(today)` 早上時段只返回 28 座水庫
（latest 37 座、yesterday 34 座），使用者感覺「水庫出現又消失」。

**根因**：部分水庫今天還沒回報資料（collector lag），`byIdRef` 只含今天有資料的站，
其他站被完全過濾掉。

**對策**：
- `loadDay(dateKey)` 併 fetch **today + yesterday**，合併 `groupByReservoir`
- `statusesAt` 的 `t ≤ currentTime` 挑選邏輯自動選到最接近的一筆
- 任一天有報的站就看得到

---

## 2026-04-23 3D 進/出流柱 zoom in 看不見

**現象**：點水庫後浮空柱在 z8-9 可見，z9.7+ 消失。

**根因**：柱底浮空 `H_SHELL × 1.25` = 10km，柱高可達 `H_SHELL × 0.65` = 5.2km，
柱頂高達 15 km。在 zoom 10+ + pitch 37° 時柱被推出 viewport 頂部。另外柱橫向
位於 `radius × 0.9` 是殼**內部**，近景時被透明殼遮。

**對策**：
- `OPS_FLOAT_Z_FACTOR`: 1.25 → 0.1（幾乎貼地）
- `OPS_MAX_HEIGHT_FACTOR`: 0.65 → 0.45（柱頂 ≤ 0.55 × shell）
- `OPS_ROW_OFFSET_FACTOR`: 0.9 → 1.35（兩排到殼外側翼）
- PRINCIPLES「3D 效能」：柱體總高 ≤ shell × 1.5，橫向 > radius × 1.0

---

## 2026-04-23 macOS 預設無 jq，shell script 需改用 python3

**現象**：SessionStart hook 的 `load-session.sh` 原本用 `jq` 組 JSON，pipe-test
時 `jq: command not found`，exit 127。

**根因**：macOS 預設工具鏈不含 jq（需 Homebrew 另裝）。`which jq` 空值。
專案協作若要求使用者預裝 jq 是不合理的門檻。

**對策**：
- Shell script 組 JSON 一律用 `python3 - <<'PY' ... PY` heredoc（Python 預裝）
- PRINCIPLES「技術慣例」加規則：shell 腳本不依賴 jq
- 寫外部工具依賴前先 `command -v <tool>` 檢查

---

## 2026-04-25 Mapbox setStyle() 期間 `map.getStyle()` 會 throw

**現象**：切換底圖時 React 爆 `Uncaught Error: Style is not done loading`，
App 被 error boundary 接住白畫面。

**根因**：6 個 useEffect 用 `if (!map || !map.getStyle()) return;` 當 guard，
預期 `getStyle()` 未載入時回 `undefined`。但 Mapbox GL v3 `setStyle()` 進行
中 Style 物件正處於 mid-swap，內部 `_checkLoaded()` **直接 throw** 而不是
回 null。React passive effect re-run 就炸。

**對策**：
- App.tsx 加 `styleReady(map): map is MapboxMap` type predicate，內部
  try/catch 包 `map.getStyle()`，throw 視為尚未 ready
- 6 處 guard 全換成 `if (!styleReady(map)) return;`
- 用 type predicate 讓後續 `ensureH3Layers(map)` 呼叫 TS 能正確 narrow

---

## 2026-04-25 Supabase PostgREST db-max-rows=20000 硬 cap（兩次踩到）

**現象**：
- 切到「地下水井」圖層完全空白；get_groundwater_day 回 78K rows，前端只
  畫出前 ~190 站，~600 站消失
- 切到「河川水位」看似只有北部有資料；get_river_water_level_day 回 44K
  rows，ORDER BY station_id 讓北部字典序在前通吃 20K，南部 103 站只剩 1

**根因**：Supabase PostgREST 伺服器端寫死 `db-max-rows=20000`，超過的列
**悄悄切掉**（HTTP 206 Partial Content + `content-range: 0-19999/N`），
沒有錯誤訊息。client Range header 無法覆寫（gateway 強制）。

**診斷 SOP**（下次遇到「RPC 資料看起來少一半」先這三步）：
1. `psql` 直查 `SELECT COUNT(*) FROM public.get_xxx(...)` 看實際列數
2. `curl -D /tmp/hdr.txt -X POST .../rpc/get_xxx` 看 `content-range` header
3. 若 `N/M` 且 N=19999 → 命中 cap，需 RPC 側降頻

**對策**：
- Migration 060：`get_groundwater_day` 降到每站每小時（78K → 16.5K）
- Migration 060b：`get_river_water_level_day` 降到每站每小時（44K → 8K）
- 都用 `DISTINCT ON (station_id, date_trunc('hour', observed_at))`
- 降頻對視覺無感（groundwater p50 hourly change 4mm、river 8.5cm/day）

**PRINCIPLES**：+「Supabase RPC 20K cap 必查」原則；新 RPC 預估 rows 超
過 15K 先套 DISTINCT ON hourly pattern

**Long-form（無）**：診斷 SOP 已經在本條與 PRINCIPLES

---

## 2026-04-26 IconRailSidebar 漏改 toggle 不顯示

**現象**：`iotWraRiver` / `iotWraStructure` layer 寫完 + `tsc -b` 通過，但 sidebar 看不到 toggle，user 截圖回報。

**根因**：本專案前端有**兩個 sidebar 元件** — `LayerSidebar.tsx` 跟 `IconRailSidebar.tsx`。實際渲染用 IconRailSidebar，但我只改了 LayerSidebar 的 `LAYER_COLORS` + UI toggle 列表。

**對策**：
- 補上 `IconRailSidebar.tsx` 的 `LAYER_COLORS` / `LAYER_ICONS` / `SECTIONS` 列表 3 處
- PRINCIPLES：新增「一前端兩 sidebar 同步改」原則

**Long-form（無）**：規則直接寫進 PRINCIPLES。

---

## 2026-04-26 overlayParams 型別嚴格只收 number

**現象**：把 7 個 boolean state（即時/預測 toggle、5 個結構類型 toggle）塞進 `overlayParams` 後 `tsc -b` 報 8 個型別錯。

**根因**：`overlayParams = useMemo<Record<string, number>>(...)` 嚴格只收 number。改成 `number | boolean` union 後下游所有 site 都要 narrow，破壞性大。

**對策**：
- 仿既有 `metroPillar3d: metroPillarVisible ? 1 : 0` pattern
- boolean 在 overlayParams 內轉 0/1 number
- App.tsx 讀時 `!!(... ?? 1)` 還原為 boolean
- PRINCIPLES：boolean state 透過 overlayParams 一律 0/1 中介，動既有型別前先看相同類型怎麼處理

**Long-form（無）**：pattern 直接寫進 PRINCIPLES。

---

## 2026-05-08 OSRM Docker image 是 distroless，無 apt-get / wget

**現象**：第一版 osrm-taiwan Dockerfile 在 `ghcr.io/project-osrm/osrm-backend` 內 `apt-get install wget` 抓 PBF，build 立刻 exit 127 `apt-get: not found`。

**根因**：OSRM 官方 image 改用 distroless / minimal base，預設不含包管理工具。

**對策**：
- multi-stage build：`alpine:3` 跑 `apk add wget` 抓 PBF → COPY 給 OSRM stage 跑 extract/partition/customize → final stage 只帶 .osrm 檔
- PRINCIPLES：Dockerfile 抓外部資源前先確認 base image 工具鏈

---

## 2026-05-08 Zeabur PREBUILT_V2 K8s service port 預設 8080（不看 EXPOSE）

**現象**：osrm-proxy 部署後 public domain 三個 endpoint 全 502 Bad Gateway。`/health`（不需 auth）也掛，跟 nginx token 邏輯無關。osrm-routed listen 5000、nginx listen 80，但 K8s service 都 expose 8080，pod 內無人 listen 8080 → connection refused。

**根因**：Zeabur PREBUILT_V2 service 的 K8s service port 硬性是 **8080**，不看 Dockerfile 的 EXPOSE 也不看 PORT env var 來決定 targetPort。`service.zeabur.internal:8080` → forward 到 pod 8080，但容器內進程沒 listen 8080 → 連不到。

**診斷指令**：`npx zeabur@latest service network --id <id>` 看 web (HTTP) 顯示的 port 即真實預期。

**對策**：
- nginx `listen 8080`、osrm-routed `--port 8080`、Dockerfile `EXPOSE 8080` 全部對齊到 8080
- PRINCIPLES：Zeabur PREBUILT_V2 一律 listen 8080（不管原服務預設 port）

---

## 2026-05-08 Cobra CLI `-k "KEY=${VAR}"` 不可靠（CSV parser 雷）

**現象**：用 `npx zeabur@latest variable create -k "OSRM_URL=http://${OSRM_TAIWAN_HOST}:5000"` 設環境變數，CLI 不報錯但 value 被截斷或變空。

**根因**：Zeabur CLI 的 `-k` flag 用 Cobra 的 `StringToStringVar` parser（CSV 模式），對含 `${}` 的值會 mangle，即使單引號避 shell 展開也不行（[zeabur/cli#201](https://github.com/zeabur/cli/issues/201)）。

**對策**：
- **跨 service reference variable 一律走 dashboard**，不用 CLI
- CLI 只設 hard-coded 值（service-id、URL 字面）
- PRINCIPLES：含 `${}` 的 env value 不能用 zeabur CLI 設

---

## 2026-05-08 跨 Zeabur project 內網不通，必走 public + auth gateway

**現象**：osrm-taiwan 在 `data-collectors-gomn` project，垃圾車 collector 在 `data-collectors-ship-only` project（IP 通政府 API），兩 project 內網互通失敗 — `osrm-taiwan.zeabur.internal` DNS 在 collector 那邊解不到。

**根因**：Zeabur 內網（K8s ClusterIP）以 project 為 namespace 隔離，跨 project 沒 service mesh 互通。`<service>.zeabur.internal` 只在同 project 內可解析。

**對策**：
- 寫一個 `osrm-proxy` 跨層服務（nginx:alpine + Bearer token gateway）放在 OSRM 同 project
- proxy 開 public domain，collector 走外網 HTTPS + Bearer header
- 月固定成本 +1 個輕量 nginx service（< 50MB image，~50MB RAM）
- PRINCIPLES：跨 Zeabur project 通訊一律 public + auth gateway

**Long-form**：`docs/research/waste-osrm-mapmatching-plan.md` §14

---

## 2026-05-09 waste_match retry 死循環（NoMatch trip 不寫 DB → 反覆 try）

**現象**：collector 連續 9+ 輪每 5 min skip warning（上輪超過 300s），5/4-5/8 每天都正好 80 unmatched trips（觸頂 LIMIT 80）。

**根因**：`_find_unmatched_trips` SQL 用 `NOT EXISTS in waste_trails_matched_daily` 篩選，但 OSRM NoMatch / confidence < 0.35 / HTTP error 的 trip **不寫入 matched_daily**。下輪同樣 trip 又被當 unmatched → 永遠 retry。

**對策**：
- migration 075 新增 `realtime.waste_match_attempts(day, city, vehicle_no, trip_id, success, reason)`
- waste_match.py 每 trip OSRM 嘗試後寫 marker（不論成功 / 失敗）
- SQL 多加 `NOT EXISTS in waste_match_attempts`
- 月度 PBF 更新若想 force re-match 可手動 `TRUNCATE realtime.waste_match_attempts`
- 設計教訓：所有「寫成功才標記」的批次處理都該補「寫 attempt」marker，避免 transient failure 變死循環

**Long-form**：`docs/research/waste-osrm-mapmatching-plan.md` §14「補充：5/9 上午 attempt marker 機制根本修」

---

## 2026-05-09 Empty git commit 不會 trigger Zeabur redeploy

**現象**：用 `git commit --allow-empty` 想觸發 Zeabur redeploy（讓新 env var 生效），git push 成功但 Zeabur deployment list 一直停在前一個 commit，沒新 build。

**根因**：Zeabur 的 GitHub webhook 偵測 commit 變更時看 file diff（empty commit `git diff` 為空）→ 視為「無變化」不觸發 build。Zeabur restart API 同時段也回 transient 503，連續 10 次失敗。

**對策**：
- 要強制 redeploy 一律改檔（`README.md` 加一行註解）+ commit + push
- PRINCIPLES：Zeabur env var 變更後若 service 不自動 reload，用 trivial file change 觸發 redeploy
- 不要靠 `npx zeabur@latest service restart`（不穩定）

---

## 2026-05-09 AWS Lightsail Tokyo IP 被高雄/台南政府 API 擋

**現象**：把垃圾車 collector 從 Akamai/Linode（agent_test, gomn project）搬到 AWS Lightsail Tokyo（ship-only-aws project），結果高雄 GPS / 台南 GPS / motcmpb (ship_ais) 三個政府 API **全部 ConnectTimeout**。新北通。

**根因**：高雄 kcg.gov.tw、台南、motcmpb 等政府網站防火牆對 AWS / GCP / Azure 雲端 IP 段做 geo/ASN block（避免被刷）。Akamai/Linode IP 在白名單內、Lightsail 不在。新北防護寬鬆例外通過。

**對策**：
- 這次決議把 collector 留在原本 `service-6940282e03ed383c19b036f5`（IP 通的 ship-only project）
- OSRM 留在 gomn project（agent_test 機器）
- 跨 project 走 osrm-proxy public + Bearer gateway（如另一條坑紀錄）
- PRINCIPLES：採台灣政府 API 的 collector 選機房前先 curl 測試**目標 API**，不只測連通性

---

## 2026-05-10 PostgREST 20K row cap 撞第二次（schedule RPC）

**現象**：`get_waste_schedule_day` 5 城 dow=4 應回 ~39K stops，但前端
`console.log fetched 20000 rows`。新北部分區（林口 244xxx）+ 整個臺北 + 整個高雄
的 routes **全天 0 車**。用戶看到「中永和板橋三重有車、其他都沒有」。

**根因**：Supabase PostgREST 預設 `db-max-rows = 20000`，不管 supabase-js 加
`.range(0, 99999)` 都被 server 截斷。RPC `ORDER BY city, route_id` 中文 byte 序
基 < 宜 < 新 < 臺 < 高 → 前 20000 row 全是基/宜 + 新北前段，後面全切。

**對策**：RPC 改 grouped per-route，stops 為 JSONB array：
- 39,000 flat rows → 1,281 grouped rows（5 城合計），遠低於 20K cap
- 22 城擴展時 routes 數可能達 4K-8K，仍安全
- 同 GLOSSARY 已記載 migration 063 timeline 字串編碼也是「避 PostgREST 20K cap」
  的同類 pattern

**血淚版**：GLOSSARY 早寫了「timeline 字串編碼 ... 避 PostgREST 20K cap
（migration 063）」，但這次設計新 RPC 時沒先看 → 沿用 flat row 設計就撞同個坑。

**對策升級到 PRINCIPLES**：任何大集合 RPC (stops / measurements / timeline 類
row 數可能 > 5K) 一律 grouped JSONB 起手，不要等撞牆。

---

## 2026-05-10 Catmull-Rom 對非真實軌跡 overshoot（schedule 視覺）

**現象**：用戶看 schedule 動畫某些 stops 「車會往回退一點再前進」。

**根因**：Catmull-Rom 4 控制點 spline 適合「真實連續軌跡」（GPS scene 用 OK），
但 schedule stops 是「邏輯時間順序」非「地理連續路徑」（v1 沒套 OSRM）。Z 字形
stops 序列下，spline 會 overshoot 飛出 p0-p1 直線兩側 → 視覺上車「先退後進」。

**對策**：拿掉 Catmull-Rom，純直線插值。直線雖會「穿牆」但不會反向 overshoot。
真正解 = OSRM 整合（BL-17）讓 stops 連線變真實路徑。

**對策升級到 PRINCIPLES**：Catmull-Rom 只用於「真實連續軌跡」（如 GPS），
邏輯順序的 stops 用直線。

<!-- 追加新事件於此之上 -->

---

## 2026-05-23 連續 5 次「圖層 UX 規則應用太狹隘」糾正

**現象**：農業 Phase 3 Batch 1 部署過程中，用戶連續 5 次回饋指出 UX 缺漏，
每次都是「我以為規則只覆蓋 X，原來也包含 Y」的範圍判斷錯誤。

**糾正時間軸**：
1. **作物適栽 4 級配色看不懂** → 規則 2「顏色標註差異」第一次踩坑（我以為單色 polygon
   不必圖例，沒注意到 match by `kind` 已產生 4 色）
2. **農村再生社區也要能點** → 規則 3「POI 點位」用詞太窄，誤以為 polygon 豁免；
   擴充為「所有承載有意義屬性的 feature」
3. **4 個 polygon layer 全部都要能點 + PMTiles keep_attrs 補欄位** → 規則 3 延伸到
   跨 repo 配套（前 PMTiles 沒帶屬性 → 後 panel 拿到 undefined）
4. **休閒農場 POI 三類也要圖例** → 規則 2 第二次踩坑，措辭從「顏色標註類別」強化為
   「分類 ≥ 2 種」+ 三問檢核（我又以為 POI 點位只關心 click popup 可豁免圖例）
5. **Sidebar 6 metric dropdown 用 button row 橫向溢出** → 規則 4 新增。
   原 dropdown 門檻 `> 6` 太鬆，4+ 中文標籤就溢出 240px sidebar；改 `> 3`

**根因**：
- 規則寫得太抽象：「顏色標註差異」「POI 點位」這種詞讓 reviewer（我）有想像空間，
  容易自我合理化「我這個 case 不算」
- 應用時沒對著規則逐條逐字檢查，憑感覺判斷豁免
- Sidebar 寬度視覺驗收沒做，純看 tsc -b 通過就放行

**對策**（5 次後規則升級到 4 條 + 強化語氣）：
- 規則 2 改寫「分類 ≥ 2 種就要圖例」+ 三問檢核（明確的可量化判斷）
- 規則 3 擴充為「可選取物件」並列舉 POI / polygon / line / 3D
- 規則 3 加跨 repo 配套段（PMTiles keep_attrs 必須先補齊）
- 規則 4 新增「Select options ≥ 4 用 dropdown」（從 button row 橫向溢出反推門檻 = 4）

**PRINCIPLES**：新增「圖層 UX 四鐵則」章節摘要 + 指向 `docs/development-rules.md#4a`。
auto-memory `feedback_layer_ux_triad.md` 也升級為「連續四次反饋」版（跨 session 自動載入）。

**教訓**：規則寫法的具體性 = 應用準確度。
- ❌「顏色標註差異」→ 抽象，留有「差異」的解釋空間
- ✅「分類 ≥ 2 種 → 必寫圖例」→ 可量化，無爭議

下次寫規則時：**用數字 / 列舉具體 token，避免抽象形容詞**。

---

## 2026-05-23 FTW outline line-width Mapbox 表達式違反「zoom only top-level」約束

**現象**：app 啟動立刻吐錯（console，但 layer 仍顯示）：
> Error: layers.agri-ftw-fields-outline.paint.line-width: "zoom" expression may only
> be used as input to a top-level "step" or "interpolate" expression

**根因**：FTW outline 把 outlineWidth 倍率包在最外層：
```ts
["*", params.outlineWidth, ["interpolate", ["linear"], ["zoom"], 10, 0.2, 13, 0.6, 16, 1.2]]
```
Mapbox GL 規定 `["zoom"]` **只能直接放在最頂層的 `interpolate` / `step` 內**，
不能被 `["*", ...]` 包住。

**對策**：把倍率乘進 stops：
```ts
const w = params.outlineWidth;
["interpolate", ["linear"], ["zoom"], 10, 0.2 * w, 13, 0.6 * w, 16, 1.2 * w]
```

Fill-opacity 用 `["*", opacity, ["interpolate", ..., ["coalesce", ["get", "confidence_mean"], 0.5], ...]]`
不受此限制（input 是 attribute 不是 zoom），保留原樣。

**INCIDENTS**：這是 FTW 既有 bug（pre-existing），但本 session 統一 ensureAll/updateAll
之後 style.load 階段就會 call → 一上 app 立刻吐。修法簡單，但這類「runtime 表達式約束」
tsc 不會抓，需要實機驗證才能看到 console error。

---

## 2026-05-23 soil_fertility 多數 grid CEC/M3 = 0 是未測非真零

**現象**：點 soil_fertility 任一格，常看到 `CEC 0.00 / M3_P 0.00 / M3_K 0.00`，
但 pH 跟 OM 有正常數值。

**根因**：原始 parquet 中 134,998 grid 並非每格都做完整 5 項檢驗，**CEC/M3_P/M3_K
在很多 grid 是 0**（未量測），不是真實「值為零」（自然土壤 CEC=0 幾乎不可能）。

**對策**：
- 前端 `agriSoilFertilityMetrics.ts` 把 `[==, [coalesce, [get, key], 0], 0]` 統一視為灰色 #616161
  「無資料」
- popup 註明「※ 0 值表示該項未測（多數網格只測 pH / OM）」
- health 綜合算法只用 pH + OM 兩項（全 grid 都有），不會被 CEC/M3 missing 拖累

**教訓**：拿到陌生資料集**先 EDA 看 null / 0 / missing 分佈**，不要假設「有欄位 =
全格都有值」。tippecanoe 不會幫你區分 missing 跟 0，前端要自己處理。

GLOSSARY 新增「0 = 未測」條目避免下次再踩。

## 2026-05-24 消防分區 — 三個踩坑

1. **Mapbox circle-radius 依資料分大小 → `["zoom"]` 表達式報錯**：想讓分隊 circle 半徑依
   cat 分大小，寫成 `["*", ["match",cat,...], ["interpolate",["zoom"],...]]` → 噴
   「"zoom" expression may only be used as input to a top-level "step"/"interpolate"」，
   circle 整層沒渲染。**修**：`["zoom"]` 必須在 interpolate **最上層**，cat 倍率改放進
   **每個 stop 的輸出**（`7, ["match",cat,大隊,b*1.8,...]`）。（與 97c9a86 那條 zoom expr 同類，再次踩。）

2. **agent-browser sidebar toggle 用 ref 點錯層**：snapshot 的 `button [ref=eXX]` 與「列」
   對應不可靠（點 e66 以為是消防分隊，其實開到「學校」，藍點誤判半天）。**改用
   `find text "<label>" click`** 較準；測 layer 前**先 All Off**（用戶提醒）。

3. **fast-refresh 假性 hooks 錯誤**：邊改 useTransportParams/App 邊開著頁面，console 跳
   「Should have a queue / calling Hooks conditionally」「order of Hooks」。**乾淨 full reload
   後完全消失** → 是 HMR 熱更新 hook 列表變動的假警告，非真 bug。判斷法：`errors --clear`
   + full reload + 0 互動再看；還有就真、沒有就假。

4. **commit 前發現 HEAD 不一致**：FeatureInfoPanel 的火災 panel 早先被夾進一個 CCTV commit
   (96374f4)，但 fireTypes.ts 還 untracked → HEAD 一度 import 不存在的檔。補 commit 其餘 fire
   檔才一致。**教訓**：commit 前 `git status` + 確認沒有「一半改動已 commit、一半還沒」。

## 2026-05-25 農企業登記 3 layer — IconRailSidebar LAYER_ICONS 隱藏 exhaustive Record

新增 layer 跑 `npx tsc -b` 噴 `IconRailSidebar.tsx(28,7): error TS2739 ... missing the
following properties from type 'Record<keyof LayerVisibility, LucideIcon>': agriRetail,
agriProduceWholesale, agriWholesaleMarket`。

**根因**：CLAUDE.md「新增 Layer 強制順序」第 5 步只點名 `layerCatalog.ts` 的 `LAYER_COLORS`
（`Record<keyof LayerVisibility, string>`），**漏寫** `IconRailSidebar.tsx` 內另有一個
`Record<keyof LayerVisibility, LucideIcon>` 圖示表，同樣是 exhaustive Record，缺 key 即 TS2739。
grep `LAYER_ICONS` 在 layerCatalog 找不到（它在 IconRailSidebar），易被漏。

**修法**：在 IconRailSidebar import 補 lucide icon（`ShoppingCart` / `Warehouse`，`Truck` 已有）
→ 圖示表加 3 key。手機版 `LayerSidebar.tsx` **沒有** per-key 圖示 Record（吃 SECTIONS 文字），
所以只需改桌機那張。

**教訓**：新增 layer 的「exhaustive Record」共有 **3 張**要同步——`LAYER_COLORS`（layerCatalog）、
`IconRailSidebar` 圖示表、`FeatureInfoPanel` 的 `HEADER_LABELS`（`Record<FeatureInfo["layerType"]>`）。
tsc -b 會逐一抓出，別只跑一次就以為過——補完一張再跑會冒下一張。

## 2026-05-26 救援等時圈 — 大面積覆蓋 GeoJSON 兩難 + 分區疊加

1. **大面積覆蓋多邊形用 GeoJSON：不簡化卡頓、簡化變醜**：全台等時圈聯集 GeoJSON 一次 eager load，
   不簡化 10MB+ 高頂點 → pan 卡（line 描邊每幀最貴）；簡化到 0.004(~440m) 雖瘦到 1.9MB
   但邊界鋸齒、用戶嫌醜。先試「移 outline 只留 fill + `fill-antialias:false`」緩解仍不夠。
   **正解 = PMTiles 向量切片**（tippecanoe，依縮放/視窗 HTTP range request）→ 高細節 + 流暢兼得。
   教訓：這類圖層**一開始就該選 PMTiles**，別走 GeoJSON 簡化來回（已立 PB-16 + PRINCIPLES）。

2. **各縣市各自 dissolve 疊起來當「全台」會亂**：原本 coverage 只做 per-county 環差，全台視圖把
   22 縣市的圈疊在一起 → 縣界接縫雜亂。用戶要求「全台要一次全國聚合」。**修**：生成時多算一組
   「所有分隊一起 union」tag `county="全台"`，同層 setFilter 切換（idx0→全國聚合、其餘→單一縣市）。
   原則：**全區 vs 分區要分開算、禁止疊加**。

3. **PMTiles SourceType 重複註冊**：agriculture factory 已 `Style.setSourceType`，新 fireIsochrone
   factory 再註冊會衝突。**修**：factory 自帶 `registerSourceTypeOnce` + **try/catch**，且 MapView
   裡 fire ensure 排在 `ensureAllAgricultureLayers` **之後**（先註冊者成功、後者命中 already-registered 被吞）。

4. **來源缺座標整批被跳過**：屏東 39 隊上游 `needs_geocoding`（只有地址）→ export 全跳過 →
   fire_stations 缺屏東 → 等時圈也無。**修**：`geocode-pingtung-fire-stations.py` Mapbox v6
   （country=tw + proximity + bbox 驗證丟界外）補座標，冪等附加回 geojson。0 失敗、677→716。

## 2026-06-02 正式上線 Zeabur — 本地 docker 攔 4 雷 + Cloudflare 快取 404

mini-taiwan-pulse 從穩定 master 一次推進 ~110 commit 正式上線（feat/fire-rescue 併入 master，
網域 itsmigu.com + zeabur.app，前面有 Cloudflare）。本地 git-archive docker 實測 + 連線實測攔下並修掉 4 雷：

1. **package-lock 未同步**：package.json 移除 @flightradar24/fr24sdk 但 lock 沒更新 → Docker `npm ci` 失敗。
   `npm install --package-lock-only` 同步後一起 commit。
2. **fire pmtiles sync 遞迴誤抓 agriculture**：pull 改 `aws s3 sync --include "*.pmtiles"` 是遞迴，連
   deploy-assets/agriculture/ 子前綴的 pmtiles 都抓進 /data/fire/agriculture/（176MB 重複下載+落錯位置）。
   加 `--exclude "agriculture/*"`。
3. **entrypoint 阻塞式 pull**：原設計 pull 完才起 nginx，第一次部署 ~600MB pull 會讓 Zeabur 健康檢查逾時。
   改背景 pull + nginx 立即前景啟動。
4. **bus 三大檔從沒上 S3**：taipei/intercity/pingtungcounty_bus_routes.json gitignore 又不在 S3 → 線上 404。
   補 gzip 上傳到 deploy-assets/。

**Cloudflare 快取 404 事件**：上線後 `/geo/water_detention_basins.geojson` 404（該檔從沒上 S3）。補上 S3 +
容器內 pull 進 /data 後**仍 404** → cf-cache-status=HIT：**Cache Rule「Ignore cache-control + 1 day」把 404 也
快取了 1 天**。修：Status Code TTL 加 404/5xx → No cache + Purge Everything → 立即 200。→ 立 PRINCIPLES。

**bus_trails timeout 誤報**：稽核 agent 報 get_bus_trails statement_timeout=0（讀 migration 030），但 live DB
實測已是 60s（migration 033 CREATE OR REPLACE 覆蓋）+ 查詢實測 22-35ms。教訓：稽核靜態 SQL 會被舊 migration
誤導，**以 live DB（pg_proc.proconfig）/ 實測為準**。

**ships=0 非 bug**：6/3 凌晨 0 ships 是最新資料停在 6/2（當天 collector 未跑），data pipeline 時差，非程式問題。

**74/81 RPC 是 SECURITY INVOKER**：原打算「撤 anon 對 reference/spatial 表 SELECT」收斂資安，但實測 81 個
public.get_* 有 74 個 INVOKER（以 anon 身分執行、需 anon 對底層表 SELECT）→ 撤 grant 會打掛 74 RPC。
**正解 = 收窄 PostgREST Exposed schemas**（移除 reference/spatial/...，只留 public+graphql_public）→ 擋直接
REST 讀表、RPC 照常（D3，待掃其他共用 gis-platform 的站確認無其他 REST 直讀消費者再做）。

## 2026-06-13 google-genai 漏裝 + url_norm 鎖死

**現象**：news_events collector 首跑 432 則全部以「無地點」入庫。

**根因**：homebrew Python 3.14 + PEP 668 → `pip3 install google-genai` 被擋。
collector 抓到 ImportError 後跳過 LLM，所有項目以無地點入庫並寫入 url_norm。
下一輪即使 LLM 可用，這 432 個 url_norm **永遠被 unique constraint 擋住不會重處理**。

**對策**：
- 裝套件改 `pip3 install --break-system-packages google-genai`
- TRUNCATE 該批 + 重跑（這次 36/36 全填好）
- **教訓**：destructive 改動（pip install / DB schema）前要先驗證套件可裝

**PRINCIPLES**：homebrew Python 系統用 `--break-system-packages`

---

## 2026-06-13 collector dict 漏帶 LLM 新欄位

**現象**：news prompt v2 升級後本地實跑，LLM batch 0 失敗、output token 521 正常，
但 DB `gis_relevance / severity / is_event` 三欄全 NULL。

**根因**：collector 的 `records.append({...})` 是手寫 dict 列各欄位，
LLM annotation 寫進 `item` 後沒被攤到 records dict — 漏接 3 欄。
LLM 有跑、parser 也有跑，斷在「from item to record」這一步。

**對策**：
- records.append dict 補 `'gis_relevance': it.get('gis_relevance')` 等 3 欄
- 重跑 36/36 全填好
- **如果走快路徑直接 push 會在生產踩雷**，自我驗證在 collector→DB 端到端跑一輪救了

**教訓**：新欄位走 LLM → annotation → item → record → DB 五段路，任一段漏接都會 silent fail。
必須端到端跑一次驗證每段。

---

## 2026-06-13 RPC smallint 參數從 supabase-js 傳會解析失敗

**現象**：本地 psql 用 `2::smallint` 正常呼叫 RPC，但 supabase-js 直接傳 `{p_min_gis_relevance: 2}` 報錯
`function does not exist (date, integer, boolean, integer)`。

**根因**：supabase-js / PostgREST 把 JS number 傳成 PostgreSQL `integer` 型別，
RPC 簽名是 `smallint` 找不到 overload。

**對策**：
- RPC 參數型別改 `integer DEFAULT 2`（不影響 default 值）
- 同時 `DROP FUNCTION IF EXISTS (smallint, ...)` 避免兩版本並存

**PRINCIPLES**：Supabase RPC 參數一律用 integer，避免從 JS RPC 客戶端的型別陷阱

---

## 2026-06-13 pglast CI cache:pip 沒 requirements.txt 直接 error

**現象**：gis-platform 加 CI workflow 首跑，`actions/setup-python@v5` step 直接 error
「No file matched to **/requirements.txt or **/pyproject.toml」。

**根因**：`with: cache: 'pip'` 預設要 pip 依賴清單檔做 cache key，gis-platform repo
只有 SQL 沒 Python 依賴，找不到檔直接 fail（不是 warning）。

**對策**：移除 `cache: 'pip'` 一行（不影響功能，只是少一個加速）

**教訓**：每個 CI workflow 上線後一定要看 Actions 頁綠燈確認，不能假設 setup
動作會「沒問題就跳過」。

---

## 2026-06-13 CelesTrak 對瀏覽器 fetch 回 403

**現象**：衛星圖層 v1 載 CelesTrak `active.txt` → 整天 0 顆衛星，console
`[satellite] CelesTrak fetch error: 403`。

**根因**：CelesTrak 對含瀏覽器 User-Agent + CORS preflight 回 403（疑似 anti-scrape）。
本地 curl 直打 OK；deployed browser 全爆。

**對策**：改走 gis-platform Supabase 既有 `satellite_classified` view（每 2h 從
Space-Track 同步），完全不打 CelesTrak。Cache key v2→v3 強制重抓。

**PRINCIPLES**：外部公開資料來源走後端代理優先，避免瀏覽器 CORS / UA 政策變動。

---

## 2026-06-13 衛星 commit 切到錯分支

**現象**：完成衛星 perf split 改動後跑 `git commit`，發現 commit 跑去
`feat/news-filter-critical`（用戶並行的新聞 WIP 分支），不是 `feat/satellite-layer`。

**根因**：分支自動切換或 stash pop 過程切換了 HEAD 沒注意，直接 `git add -A` +
`git commit` 把：
1. 想要的 useSatellitesLayer.ts perf 改動
2. 用戶 WIP 的 useTransportParams newsFilter（不該進衛星 PR）
3. 未追蹤的 monitor-mode.md 草稿

三者一起包成一個 commit 在錯分支上。

**對策**：
- `git reset --mixed HEAD~1` 把 commit 拆掉、變動回到 index
- `git checkout HEAD -- src/hooks/useSatellitesLayer.ts` 還原該檔
- 把新內容暫存 `/tmp/sat-hook-perf.ts`
- `git checkout feat/satellite-layer`，把暫存內容覆回去再 commit
- 切回 news 分支保留 WIP

**PRINCIPLES**：commit 前 `git branch --show-current` 確認分支。`git add -A` 在
working tree 有跨分支 WIP / 未追蹤草稿時極度危險，改 `git add <具體檔>`。

---

## 2026-06-13 衛星 throttle 殭屍 closure 閃爍

**現象**：60x timeline 播放下，toggle off 某個衛星 cat，殘留衛星「閃一下又消失」。

**根因（三層疊加）**：
1. **殭屍 throttle trailing fire**：`timeStore.subscribeThrottled(1000ms)` 有
   trailing setTimeout 機制，React 重 render 完成前舊的 setTimeout 仍可能 fire
   舊 `recompute` closure，把已關掉的 cat setData 進 source
2. **recompute 入 useCallback deps**：`visibility` 是 inline object literal，
   每 render identity 都變 → recompute 每 render 都新 → effect 1 每 render 都
   重綁，放大殭屍視窗
3. **listener 洩漏**：`if (!setup()) { map.on("style.load", ...); map.on("idle", ...) }`
   內註冊的兩個 listener 沒進 cleanup，長時間累積

**對策**：
- `visibilityRef` + `trackMinutesRef`：recompute 讀 ref，useCallback deps 空陣列 → stable
- 所有 map.on() listener 全進 cleanup
- 新增 `visKey` effect（5 bit 字串穩定化 deps）：toggle 一動立即 force recompute，0 延遲

**後續副作用**：修穩定性後失去「隨 parent re-render 隱性 60Hz」的 bug 副產物，
衛星變成 1Hz 跳格。**正確修法**：拆 light(10Hz 點+足跡)/heavy(1Hz 軌跡)，
總 CPU 不增但視覺流暢。

**PRINCIPLES**：視覺「順暢」可能是 effect 重綁副產物，修穩定性後要顯式設更新頻率。

---

## 2026-06-17 Monitor 卡片全空白 — RPC 名前端後端對不上

**症狀**：Monitor Mode 上線後實測，戰情概覽顯示「26 平時」（壓力指數正常），但旁邊 vs+0 / vs+0、TWSE ticker 全 0、PLA 0 架次、3 張 CDC 卡顯示「等待 CDC 週報資料…」、CDC 截至 ISO 第 W0 週。

**直覺診斷**：以為是 collector 沒跑 / Zeabur env 沒開。

**實際根因**：跑 `SELECT count(*)` 查每張 realtime 表，**全部有資料**（pressure_index_now 1 / market_index_current 2 / pla_activity_daily 5 / public_health_weekly 25720）。問題在前端 loader 寫的 RPC 名跟後端對不上：
- `get_market_index_now` ❌ 不存在
- `get_pla_activity_latest` ❌ 不存在
- `get_public_health_weekly` ❌ 不存在
- `get_pressure_index_now` ✅ 存在（migration 207 那次有建）

前端 loader 失敗時 `console.warn` + return 空殼，UI 照樣渲染 → 用戶看到「等待中」而不是錯誤。

**怎麼修**：migration 210 補建 3 個薄 RPC（select + 簡單 transform），grant anon。實測：
- TWSE 45,809.19 收盤 +412.20 (+0.91%)
- PLA 0 架次 / 6 海軍艦 / 2026-06-15
- CDC W23：流感 1.9萬 -41% / 登革熱 10 +150% / 腸病毒 378 +27%

**Why 漏建**：寫 Monitor Phase 2 前端時直接從設計師 handoff doc 抄 RPC 名（doc 寫「沿用同樣命名規律」），假設後端會跟著做。實際只有 pressure 那支建好，其他 3 個變成「假設不存在」。

**PRINCIPLES**：handoff doc 寫前端時，**ship 前一定要 `psql -c "SELECT proname FROM pg_proc WHERE proname LIKE 'get_xxx'"` 確認 RPC 真的存在**。loader fallback 空殼會讓問題藏到使用者實測時才暴露。

---

## 2026-06-17 YT @handle + `live_stream?channel=` 整套失敗（B1 救援）

**症狀**：LiveWall 4 格全部「無法播放這部影片」。原以為頻道沒在直播 / UC ID 寫錯 / `@handle` 在 `channel=` 不認。

**第一輪修法（無效）**：把 @handle 替成 UC channel ID（從 youtube.com 頁面 HTML 撈 `browseId`）。修了 5 家 (PTS/CTS/TVBS/TTV/CTV)。結果：仍然只有 PTS / CTV 能播。

**真正根因（curl + 拆 embed page）**：
```
=== PTS === VIDEO_ID="quwqlazU-c8"   ✅
=== CTV === VIDEO_ID="TCnaIE_SAtM"   ✅
=== CTS === VIDEO_ID="live_stream"   ❌ 沒解析到
=== TVBS=== VIDEO_ID="live_stream"   ❌
=== TTV === VIDEO_ID="live_stream"   ❌
```

YouTube `embed/live_stream?channel=UCxxx` 要查頻道的「primary live event」設定。**多數新聞台沒設這個欄位**，即使有 24h 直播也找不到。是 YouTube 端的頻道後台問題，不是我們的 bug。

**B1 方案救援**（用戶選定，三 repo 串通）：
1. data-collectors 寫 `yt_live_video_resolver.py`（5 min cron）抓 14 家 `youtube.com/@handle/live` 解析當前 videoId
2. gis-platform migration 209 建 `realtime.yt_live_current` (PK=handle) + `get_yt_live_videos()` RPC
3. 前端 LiveWall 改用 `embed/<videoId>` 而非 `embed/live_stream?channel=`

**第二輪 collector bug**：第一版 regex 抓「第一個 videoId」+「第一個 isLiveContent」。@FTV_News /live page 沒 24h 直播時會 redirect 到頻道頭推薦影片（一支三立的非直播 video）→ collector 報 video_id=`3lH66WWmUUs` 是 live，實際 `isLiveContent:false`。

**第三輪正確判定**：改用 `ytInitialPlayerResponse` JSON block 取 `videoDetails.videoId + isLiveContent` + `microformat.playerMicroformatRenderer.liveBroadcastDetails.isLiveNow` + `playabilityStatus.status === 'OK'` 全部對得上才寫 video_id。結果 9/13 真的可播，4 家正確標 not live。

**Why 一開始猜錯**：頻道頁 HTML 有非常多 video meta（推薦影片 / 相關影片），regex 抓「第一個」基本是亂猜。

**PRINCIPLES**：
- YouTube `embed/live_stream?channel=` **不可靠**，必須改用 `embed/<videoId>` + cron 解析（B1 模式）
- 解析 YouTube page metadata 用 `ytInitialPlayerResponse` JSON 區塊，不要用獨立 regex 抓「第一個」
- video_id 約 1-7 天 rotate（直播重啟），cron 間隔 5 min 安全

---

## 2026-06-18 — Design tokens migration 3 個 review 教訓（PR #22）

### A) Phase 1 subagent 把 control bg 也收進 SURFACE.subtle（codex 抓回 10 處）

**症狀**：Phase 1 subagent 替換 panel 背景時，把 button / select / segmented control
的 `rgba(0,0,0,0.4)` / `0.45` / `0.5` 也一併換成 `SURFACE.subtle`，10 處 over-replacement。

**根因**：subagent prompt 給的對映表只寫「rgba 值 → token」，**沒區分**「panel 容器底」
vs「控件互動態背景」這個語義差異。值相同但語意不同，subagent 看不出來。

**Codex 抓回**：codex review uncommitted diff 時點出「這些是 button / select / segmented
control 的互動態 background，不是 panel 背景」，列出 IconRailSidebar:882/915/945、
LayerSidebar:368/439/476/514、IntelFilters:128/147/176 共 10 處。

**處理**：全數還原回原 hardcoded 值，加 `IconRailSidebar` 的 SURFACE import 變 orphan
就刪掉。design-system.md §7 KEEP OUT 加一條「SURFACE 只給 panel 容器底；button/select
等互動態背景不用 SURFACE，即使數值相同」。

**PRINCIPLES**：semantic ≠ value，token spec 必須明確界定**語意邊界**而不只是「值對映」。

### B) Phase 3 codex review 卡 23 min 不返（cancel + 手動 fallback）

**症狀**：Phase 3 改完 22 檔 / 165 處後跑 codex review。Phase 0/1/2 都 1-2 min 完成，
但 Phase 3 codex 跑進 verifying phase 後 23 min 沒回。`codex-companion status` 看 log
顯示其中一個 Python script `exit 1` 之後一直在 retry。

**根因**：codex 在大改動 + 工具失敗時會反覆嘗試，沒有 timeout 機制自動放棄。

**處理**：`codex-companion cancel <task-id>` 取消，改手動 grep + tsc 驗證：
- `grep -rn 'color: "rgba(255'` 找 leftover → 5 處（4 個橘色保留 / 1 個 IndicatorPanel chart 補修）
- `tsc -b` 過 → commit

**PRINCIPLES**：codex 不是萬靈丹。**5 min 沒回就 cancel + 手動 spot check**。
不要因為「正在跑」就無限等。判準：previous phases 同類 review 用了多久當基準。

### C) Phase 1 subagent grep pattern 沒覆蓋空格版（漏改 2 檔）

**症狀**：Phase 1 對映表寫「`rgba(10,10,20,0.88)` → `SURFACE.strong`」（無空格），
subagent 跑完回報只改 8 檔。但 audit 文件明確標 `LegendPanel:138` 與 `FeatureInfoPanel:44`
也用這個值 — 都漏了。

**根因**：subagent 嚴格按 prompt 給的字串 grep，**沒含空格**的 pattern 找不到
`rgba(10, 10, 20, 0.88)`（實際 source code 帶空格的版本）。

**處理**：手動 `grep -n "rgba(10"` 找出來補 4 個 Edit（兩個 import + 兩個 background）。

**PRINCIPLES**：跨團隊 / 跨年的程式碼有空格 / 無空格兩種寫法**並存**。grep pattern
要嘛兩種都列、要嘛用 regex `rgba\(10,\s*10,\s*20,\s*0\.88\)`。Audit 顯示「同一值出現 N 次」
不代表寫法只有一種。

### Why 一開始猜錯

PR #22 是本專案第一次大規模 design tokens migration（60+ 元件、1200+ 散落值），SOP 沒
建立過。Phase 0 codex review 已抓到 fontSize 缺位、circular dep 等多個議題，**讓我過度
信任 codex 能 catch 一切** — 沒對 subagent prompt 做更嚴的設計（semantic 區分 + grep 覆蓋空格）。
真正的教訓：**subagent prompt 是 spec、codex 是 review、兩者各自有盲區**，需要前後互補。

---

## 2026-06-18 — Energy beam 重蹈 2026-04-22 isStyleLoaded race 覆轍

**症狀**：能源 MVP v1.3 機組即時出力（usePowerGenerationBeamLayer）：
- console log 顯示 mount effect run / mapReady=true / fetch 成功 14 廠 × 143 ts
- 但畫面**完全沒柱** — scene.setData 沒被 customLayer.render 呼叫
- 因為 CustomLayer 根本沒 addLayer 進 mapbox

**根因**：跟 2026-04-22 水庫圖層**完全一樣**：
```ts
if (map.isStyleLoaded()) mount();    // ← toggle 那 frame racily 回 false
else map.on("style.load", mount);    // ← style 早就 load 完不會再 fire → 永遠不 mount
```

**修法**：try addLayer + map.once("idle", retry) — bulletproof（commit `f6c9566` v1.3.5）。

### 為什麼又踩

2026-04-22 已寫成 pitfall 檔（`.claude/pitfalls/2026-04-22-mapbox-load-once-fired.md`），
但寫 energy beam 時**沒去讀**。SessionStart inline 的是 STATUS / BACKLOG / PRINCIPLES，
**pitfalls 要主動 grep 才看到**。獨立 3D hook 是低頻場景（一年 < 5 次），不在 muscle memory 內。

### 預防

1. 那個 pitfall 檔已 append「2026-06-18 第二次踩到」段 + SOP，並加觸發詞 `3D 圖層 / Three.js / CustomLayer / addLayer / Three.js scene` 在頂
2. PRINCIPLES 補一條規則：「寫獨立 CustomLayer hook 前 → grep `.claude/pitfalls/*mapbox*` 確認過再動工」
3. 預設 mount 用 try/catch + idle 重試 pattern，**禁** `if (isStyleLoaded()) ... else style.load`

### Why 一開始花這麼久

| 階段 | 時間軸 | 卡點 |
|---|---|---|
| 用戶說「機組看不到」 | 第 1 輪 | 我先去調 BEAM_RADIUS、CylinderGeometry 形狀（visual 修） |
| 還是看不到，加 console.info log | 第 2 輪 | console 沒任何 log → 假設 HMR 沒更新，要用戶 hard reload |
| 用戶說真的沒 log | 第 3 輪 | 又加更多 log 改用 console.log；終於看到 mount effect run 但無 mounted ✓ |
| 看到 `style 還沒 load，等 style.load 觸發` | 第 4 輪 | 才想起這個 race 模式 |
| 改 try/catch + idle 重試 | 5 分鐘 | 修好 |

**省 3 輪的方法**：用戶說「3D 圖層看不到」+ 「console 沒 log」一出現，第一件事就是
讀 `.claude/pitfalls/2026-04-22-*.md`，不是去調視覺。

## 2026-07-01 警察 isochrone 全台跑 — 三連環卡（Overpass ban / pyrosm OOM / 邊界斷）

### 事件

要跑 3 層警察 × 2 mode × 2 分鐘 = 12 變體 isochrone 全台，連環撞牆：

**1. Overpass mirror IP ban 24-72h**（accessibility SKILL §4 #1 印證）
- 前一天雙北 bbox 跑得順，隔日全台 bbox 直接 `Connection refused`
- 3 個 mirror 全掛：`overpass-api.de` refused / `overpass.kumi.systems` timeout / `overpass.openstreetmap.fr` 404
- 之前全台 subquery 觸發 IP ban，等 cooldown 24-72h

**2. pyrosm 全台 walk graph 6M nodes / 12.7M edges**
- 已切 osmium 過濾（w/highway），walk PBF 從 309MB 降到 58MB — 但 pyrosm 讀進 networkx 仍是 6M nodes（含 footway/path/track/cycleway）
- 載 graph 用 2137 秒（35 min），simplify 20+ min，per-station ego_graph 1504 站 × 6M nodes 估算 3-4 hr / variant
- kill 掉，退階分區

**3. 分區 5 區跑後邊界斷裂**
- 5 區 bbox 不重疊 → 邊界 station 的 ego_graph 只在本區 graph 上跑，跨區被切
- 桃園 / 新竹交界、雲林 / 嘉義交界最明顯（見用戶回報截圖）
- 記 BACKLOG PI-1 — 3 修法（bbox +0.15° overlap / raster heatmap / 補丁 pass）

### 三段拆彈

| 撞牆 | 拆彈 |
|---|---|
| Overpass mirror ban | `find ~/Desktop -name "*.osm.pbf"` 找到 `taipei-gis-analytics/data/raw/osm/taiwan-latest.osm.pbf` 309MB **本機已有** → osmium tags-filter 過濾 walk/drive 兩份 → pyrosm 讀，完全避開 Overpass |
| pyrosm 全台 walk graph OOM | `ox.simplify_graph()` 加速 2x（815s → 388s per variant），但仍不夠 → 分 5 區跑 |
| 分區邊界斷 | 記 PI-1，不即時修（要重跑 60-90 min） |

### 教訓（→ PRINCIPLES）

- **PBF 本機優先**：跑 isochrone 前 `find` 確認本機是否已有 PBF，避免打 Overpass
- **osmium tags-filter 過濾 residential**：walk 加太多 footway/path 會導致 graph 巨大化，要更嚴格過濾
- **分區 bbox 一定要 overlap**：不重疊 = 邊界 station 被切，一開始就該加 0.15° overlap

### 4 個副 incident 一次記

**A. pyrosm network_type API 差異**：
- pyrosm 用 `"walking" / "driving"`，osmnx 用 `"walk" / "drive"` — script 混用會噴 `ValueError: 'network_type' should be one of: driving, walking, ...`
- 修：定義 `PYROSM_NET_TYPE = {"walk": "walking", "drive": "driving"}` 隔開

**B. osmnx `ox.settings.overpass_url` 用法**：
- osmnx 2.x 該欄位是「完整 endpoint URL」（含 `/interpreter`），設 `"https://overpass-api.de/api/interpreter"` 對；設 `"https://overpass-api.de/api"` 會被 osmnx 內部再加 `/interpreter` 變 `.../interpreter/interpreter` 404

**C. convex_hull vs concave_hull vs dissolve 三段演化**：
- convex_hull → 過度膨脹三角形鋸齒
- concave_hull(0.3) → 26,644 fragments GeoJSON 14MB
- concave_hull(0.5) + buffer 15% + `dissolve by overlap_count` → 73 features 5.8MB（乾淨階梯）
- 教訓：Mode B polygon isochrone 的 default 應該 = concave_hull(0.5) + buffer + dissolve

**D. line layer 造成同心圓錯覺**：
- 3 個 policeIso layer 的 line 子 layer 把 dissolve 後 MultiPolygon 內部 ring（單站 hull）邊界全畫出，視覺呈「同心圓」感
- 修：line-opacity 0.3 → 0.08、line-width 0.3 → 0.15（commit `e824165`）
- 教訓：多層 vector overlap 場合，line 邊界要幾乎不可見

## 2026-07-01 airports.geojson 差點重建（實際上已存在）

**事件**：規劃警政 layer 時，plan 寫要在 `taipei-gis-analytics/data/processed/police_justice/airports/` 建 4 點機場 geojson。用戶提「不是有現成的？」我才 `grep` 發現 `mini-taiwan-pulse/public/geo/airports.geojson` 早就存在（Polygon 機場輪廓 + iata/icao/name 全欄，還在 `LayerVisibility` + `LAYER_COLORS` + sidebar + `AirportPanel` popup + `AirportSelector` cameraPreset 全串好）。

差點重建、把 plan A1 整段刪掉。

**教訓**：新增 layer 前一律 `grep -r "layerKey"` + `find public -name "*.geojson"` 檢查是否已有。用戶記憶 > 我對 codebase 的直覺。

## 2026-07-01 prison_population_daily 只 1 row（collector 沒在跑）

**事件**：apply RPC migration 264 後 smoke test `get_prison_population_window(7)` 回 0 rows。查表 `realtime.prison_population_daily` 只 1 row（2026-05-15），`data-collectors/collectors/correctional_daily_snapshot.py` 沒在跑。

**教訓**：realtime schema 表要驗證 collector 有沒有真的跑，不能單看 migration 存在就假設有資料。BACKLOG 記 collector 待補跑。
