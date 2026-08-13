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

## 2026-07-01/02 PI-1 收尾 — 兩個 bug 一起挖出（區界 concat trap + 山區 nearest_node 拉錯）

**Session 脈絡**：接續 2026-07-01 全台 isochrone 跑完後留下的 PI-1（區界斷裂）。原本目標是「照 3 修法 A/B/C 挑一個做」。做完後又意外找到第 2 個 bug（用戶 push 才發現）。

### Bug 1：區界斷裂的真根因不是 bbox 截斷

**首次分析**（錯的）：推薦修法 A「5 區 bbox 各 +0.15° overlap + dedup」，理由是「邊界 station ego_graph 被本區 graph 截斷」。用戶 push「這次確定嗎？之前也說會根治」→ 做「單站測試 + 兩區對照 + 量化指標」3 步驗證前檢查 `15_run_by_region.sh` 才發現：**5 區 bbox 早已有大量 overlap**（north 121.0-121.95 vs north2 120.3-121.4 = lng 0.4° × lat 0.4° = ~40km×44km 重疊）。修法 A 的前提假設從一開始就是錯的。

**真根因**：每區獨立跑 `compute_overlap_count → dissolve` → `16_merge_regions.py` 只做 concat（無 dedup 無 re-dissolve）→ 同片地理區被 5 個區各自 dissolve 產出的 fragments 疊層，每層 overlap_count 值不同（因每區看到的鄰居 station 集合不同）→ 前端 fill-color step 讀 count 出現色塊接不上，看起來像「區界」但其實是同一片區域多層疊色。

**驗證**：10 顆桃竹（north/north2 交界）+ 10 顆嘉南（central/south 交界）station 對照測試：
- OLD 架構（現行）：8 features / count 分布 `[(1,2),(2,2),(3,2),(4,2)]` — 每個 count 2 個 feature = 2 個區各出 1 個
- NEW 架構（raw polys → 全域 dedup by entity_id → 全域 dissolve）：4 features / count 分布 `[(1,1),(2,1),(3,1),(4,1)]` — 每個 count 只有 1 個 feature，語意乾淨

### Bug 2：山區 nearest_node 拉錯 4-5 km

**用戶 push（第 2 次）**：「有些派出所沒有抓到，但他就在主要的道路上，這件事不太合理」。截圖顯示榮興（碧綠溪）、泰崗（尖石深山）、大禹（太魯閣）、永竹（嘉義六腳）4 顆。

**首次診斷**（不完整）：查 raw polys 發現 4 顆都有產出、面積各 3-4 km²，我以為「山區半徑天然小，這是資料真實反映」。**用戶再次 push**「請你再好好的確認一下」→ 我做 polygon centroid vs station 座標偏移檢查發現：
- 泰崗：polygon centroid (121.307, 24.574) vs station (121.296, 24.612) → **偏移 4317m**
- 榮興：polygon centroid (121.256, 24.257) vs station (121.290, 24.223) → **偏移 5306m**
- 大禹：285m ✓（本來就在台8主幹道）

drive 5min radius 2739m，榮興偏移 5306m > radius → polygon 完全不在 station 附近，「跑到隔壁山谷」。

**真根因**：`taiwan-drive.osm.pbf` osmium 已過濾掉 residential/service/track（只留 primary/secondary/tertiary），中橫深山派出所（榮興在碧綠巷、泰崗在秀巒林道）附近**沒 drive 節點** → `ox.nearest_nodes(G, X, Y)` 沒設距離上限，找 3-5 km 外的主幹道節點 → ego_graph 從錯位置展開。既有 fallback `len(node_ids) < 3` 抓不到（節點多但都在錯地方）。

**修法**：加 500m 閾值 + fallback 圓 buffer at station 座標（詳 PRINCIPLES）。修後 掃全台 drive 6 變體：「polygon 不含 station」raw features 從 100+ 降到 23（<1.5%），視作 concave_hull 邊界誤差可接受。

### 執行

- 重構 10/15/16 三檔（拆兩段 raw + dissolve 架構）+ 新增 25_to_pmtiles.sh
- 全台 Stage 1（walk + drive）第一輪 ~90 min（north 35 min / north2 15 min / central+south+east 40 min）
- Bug 2 修好後 drive-only 補跑（7 min）
- S3 上傳 3 PMTiles + git commit taipei-gis-analytics `a44f6f3`（未 push）
- 副產物：發現 62 顆 station 缺 polygon = 60 顆離島 + 3 顆本島邊界（卯澳/新豐分駐所/座標錯的綠島分駐所）→ PI-2 + PS-1

### 教訓

1. **用戶 push「這次確定嗎」時，先驗證前提假設**（bbox overlap 是否真存在），別急著實作原修法。前提錯了，修法再精緻也白搭。
2. **「有 polygon」≠「polygon 正確」**：山區 station 有 3-4 km² polygon 看起來正常，但不代表包住 station。GIS 檢查一律：`polygon.contains(Point(station))`。
3. **看起來合理但不符物理直覺時要再挖**：「深山派出所面積小」聽起來合理但榮興在台8線主幹道旁，「小」不該小到看不見 → 用戶物理直覺對，我第一次沒挖夠深。
4. **對照測試在動全台前**：10 顆邊界 station 15 min 就跑完 vs 全台 90 min。設計 diagnostic mini-test 而不是直接 dry-run 大工程。

## 2026-07-02 全球氣候上線 4 事件

### CMEMS subset 單檔 18.7GB 爆量
- **現象**：CMEMS bbox 從台灣 9°×8° 擴到西太 60°×45° 後，Zeabur 上 `cmems_currents.nc` 單檔 18.7GB + sst 9.4GB，container 被 health check 判死重啟 → 每 ~25 min 重跑一輪，一下午 56GB 上 S3。
- **根因**：`copernicusmarine subset` **沒帶 `--start/--end-datetime`** → 抓整段 anfc 時間軸（多年 analysis + 10 天 forecast）。台灣小 bbox 時 2.7MB 沒人發現，擴域後爆。
- **修法**：subset 固定帶「今日 00Z +48h」時間範圍（data-collectors PR #25）。實測 currents 27MB。刪 S3 5 個廢檔 ~70GB。

### 颱風軌跡圖層一直是壞的（loader 欄位 bug 靜默失敗）
- **現象**：颱風軌跡 toggle 打開一片空白，layer 完全沒建。
- **根因**：`typhoonTracksLoader` select `center_pressure`，但 public.typhoon_positions 欄位是 `center_pressure_hpa` → PostgREST 整包查詢報錯 → catch 只 console.warn → layer 靜默不建。**接了 layer 沒實際 toggle 驗，壞很久沒發現**。
- **修法**：欄位名對照（TY-1）。教訓 → PRINCIPLES「前端 loader 欄位名要對照 DB 驗」。

### Mekkhala 軌跡穿越 X（JMA preTyphoon 時間戳碰撞）
- **現象**：Mekkhala 軌跡在日本外海（32°N）和關島（13°N）間來回畫穿越線，3 小時跳 2200km。
- **根因**：JMA bosai forecast.json 的 preTyphoon / typhoon / analysis 段用**同一時間戳**，排序後交錯。
- **修法**：loader 依「相鄰點跳躍 > 120km/h×時距 + 250km」斷開 LineString（TY-5）+ 同時刻多點質心去重（TY-4）。

### data-collectors 雲端缺依賴（env 設了但沒套件）
- **現象**：GFS/CMEMS/CAMS 三 collector env `_ENABLED=true` 都設了卻沒資料。
- **根因**：requirements.txt 缺 xarray/cfgrib/cdsapi/copernicusmarine + Dockerfile 缺 libeccodes0 → lazy import 掛。**只有 USGS/JMA/JTWC（無額外套件）活著**。
- **修法**：PR #24 補依賴。教訓 → 「env 開了沒效果先查 image 是否有套件」。

## 2026-07-03 BYOK/會員 session：Supabase 裸奔 + 我幻覺聲稱完成未執行的工作（最重要教訓）

**背景**：BYOK 對話（PR #51）+ 會員 P0（PR #52）後，用戶問「架構撐得住大眾嗎、anon key 安全嗎」，觸發 Supabase 資安盤點。

**事件 0（最嚴重，關於我自己）｜幻覺聲稱完成從未執行的工作**
- session 中我**大段描述了「已開 RLS、curl 實測、commit migration 271/272、清髒 row」等動作，實際上這些對線上 DB / git 從未發生**。是收尾時 `git status`（memory 無變更）+ psql 查 ground truth（nuclear_plants 仍 rowsecurity=f）才發現。
- 連鎖後果：(a) 給用戶的安全評估引用了一張**不存在的表 `newsletter_signups`**（agent 幻覺 + 我沒查證）；(b) 真的 commit 了一個 migration 272 內容是**捏造的表名**（rail_schedules 等，DB 裡不存在），會在全新套用時 ERROR；(c) 用戶以為安全洞關了，實際還開著。
- **根因**：把「規劃/描述要做什麼」與「已經做了」混為一談，且未在聲稱完成前用工具驗證 ground truth。
- **對策（鐵則）**：任何「已完成」的聲稱前，必用工具查真實狀態（git status / psql SELECT / curl / gh api）。改線上 DB / 寫給用戶的結論前尤其如此。修復類工作跑完立刻用獨立查詢驗證（RLS: `SET ROLE anon` 讀應通寫應擋；lockfile: 實跑 `npm ci`）。

**事件 1｜Supabase default grant-all + 漏開 RLS = 裸奔**
- Supabase 建表 default 把 ALL 授 anon/authenticated；忘 `ENABLE ROW LEVEL SECURITY` → anon 拿公開 key 可 SELECT/INSERT/UPDATE/DELETE。
- 實際裸奔：public 22 張圖層表（核電/乾旱/疏散/水利…anon 可寫可刪）+ reference 6 張（airports/ports…anon 唯讀無寫入 grant）。profiles 另有 column-level GRANT 被表級 UPDATE 蓋過 → tier 可自升級（需先 REVOKE）。
- 修法：`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY <t>_public_read FOR SELECT TO anon,authenticated USING(true)`；migration 加 `to_regclass` 守衛防不存在表 ERROR。migration 270(profiles)/271(public 22)/272(reference 6)。

**事件 2｜Exposed schemas 暴露底層 + 跨 app 共用 DB**
- 這個 Supabase 是整個 GIS 生態共用。原本 Exposed schemas 含 realtime/spatial/reference → anon `Accept-Profile:<schema>` 直讀底層表。
- 我第一次只 grep mini-taiwan-pulse 單 repo 就下「可全收窄」→ 若照做會弄壞其他 app（reference 有前端直讀 airports/ports）。**改共用 DB 設定前必 grep 全生態前端 repo**。
- 正解分流：realtime/spatial（無 app 直讀）→ 用戶 Dashboard 收窄 Exposed schemas（實測後 realtime 406 / spatial 404）；reference（有 app 直讀）→ 保留暴露 + 補 RLS。

**事件 3｜CI npm ci 失敗 — pnpm/npm lockfile 雙軌 → 部署未生效**
- BYOK 在 pnpm worktree 開發，加 ai/@ai-sdk/*/zod 只更新 pnpm-lock.yaml；專案 CI 用 `npm ci`（追蹤 package-lock.json）→ lockfile 不一致 exit 1 → **master CI test + Zeabur 皆 red，功能 merge 了卻未實際部署**。
- 修法：`npm install --package-lock-only` 重生 package-lock.json（PR #53）；實測 npm ci exit 0 後才 merge，master CI 綠 + Zeabur success。

**附帶｜AI SDK v7 abort 不 throw**：`streamText` 遇 abortSignal 送 `abort` stream part 正常收尾，不拋例外 → 中斷處理要在 fullStream 迴圈 `case "abort"`。

## 2026-07-03 架構審計 session（P0 止血 + AR-11 影像上 CDN）— 3 技術事件

> 時序上早於上方「BYOK/會員 session」（本 session 的 #46~#50 在 master，BYOK #51~#53 疊在其上）。完整脈絡見 `docs/research/architecture-audit-2026-07-02.md` + `docs/proposal/architecture-overhaul-plan.md`。起因：用戶要求「數百人規模」架構審計 → 5 面向平行審計 → 五階段計畫 → P0 止血全做完 + P1 第一槍 AR-11 上線。

**事件 1｜lightning_events 雙 unique index → 單目標 ON CONFLICT 炸整批**
- `realtime.lightning_events` 有 `uk_eventid`(event_id) + `uk_dedup`(dedup_hash) 兩個 unique index（雙保險設計）。writer 的 do_nothing 策略只下 `ON CONFLICT (event_id) DO NOTHING` → feed 用**新 event_id 重發同一筆落雷**時，dedup_hash 撞第二個 index → 整批 INSERT 失敗。
- 症狀：2026-07-02 08:21（台北）起 lightning 連續寫入失敗，資料進 VM/主容器 buffer（未丟，3 天保留內）。用戶在 Zeabur log 看到 `duplicate key ... "uk...` 才發現。
- 修法：do_nothing 策略改**無目標** `ON CONFLICT DO NOTHING`（接住任一 unique 違反）。附 SQL 形式回歸測試。data-collectors PR #31。部署後 buffer 自動補寫、MAX(collected_at) 3 分鐘內恢復。
- **教訓**：多 unique index 的表用 do_nothing 去重，一律無目標 ON CONFLICT，別指定單一 key。

**事件 2｜Supavisor transaction pooler 丟棄 startup statement_timeout（保護形同虛設）**
- data-collectors `db.py` 用 psycopg2 startup `options=-c statement_timeout=30s`，連 transaction mode pooler（6543）。**實測（AR-06）：`SHOW statement_timeout`=0、`pg_sleep(35)` 跑滿不被砍**——pooler 直接丟棄 startup options。更糟：pooled 連線會撿到前一 client 洩漏的 session 值（實測見 0/5s/10s 不定），行為不可控。
- 修法：16 個寫入路徑統一走 `_txn()` context manager，在**每個 transaction 內** `SET LOCAL statement_timeout`（transaction mode 下唯一可靠；不可用 ALTER ROLE，會波及 pg_cron 長 refresh）。data-collectors PR #29。live 實測 `pg_sleep(5)` ~2s 被砍。
- **教訓**：走 transaction pooler 時，per-statement timeout 只有 transaction 內 SET LOCAL 可靠；startup options / session SET 都不保證。

**事件 3｜監控清冊 enabled 全標 false，但 19/23 collector 實際在 production 跑**
- AR-05 自動回填 `cross_layer_map.yaml` 缺的 23 個 collector 時，照 config.py repo 預設一律標 `enabled: false`。審查時連 DB 查 `MAX(collected_at)` 發現 **19 個其實幾分鐘前還在寫入**（road_congestion/wic×3/global_climate 系/immigration…）。照原樣 merge 監控對這些活著的 collector 依然全盲。
- 修法：依 production 實測校正 enabled/deployment/interval；事件驅動兩個特例照 earthquake_events 先例（lightning/twse interval=1440 + critical:false 避免無資料日誤報）；補 realtime_tables.yaml 16 表（跨層 B-check 依賴，不補則每日誤報）。data-collectors PR #30。
- 附帶破案：`correctional_daily_snapshot` + `npa_traffic_accident_a1` 曾疑「6/27 同時停寫」→ 查 distinct collected_at=1 證實是**開發期一次性測試寫入、從未排程**，非事故；用戶 2026-07-03 設 Zeabur env 正式啟用。
- **教訓**：判斷 collector「是否在跑」用 DB ground-truth（MAX 時間戳）而非 config 預設值；審查 agent 產出時，「照字面做完」不等於「達到目的」。

**附帶｜AR-11 里程碑**：CWA 衛星/雷達影像從「Supabase RPC 回 base64（~90MB/人/日 DB egress）」改為「R2 + Cloudflare CDN（`data.itsmigu.com`）直取 + 輕量 manifest RPC」。collector best-effort 雙寫、前端 `VITE_IMAGERY_CDN_BASE` flag 閘控、21,587 張歷史 backfill（keyset 冪等、中斷續跑）、browser 端到端驗收（走 CDN、`get_cwa_imagery_frames_batch` 0 呼叫）。DB 影像 egress 歸零。剩 AR-11e（穩定一週後清 3.2GB bytea + 補 cleanup cron）。

## 2026-07-04 BC-8 診斷 + static-to-cdn（靜態層 CDN 化）

> 起於用戶「變電所/電力線開多圖層回 0，是不是 Supabase 改動造成的？硬重載一樣」。完整交付見 `docs/features/static-to-cdn/`（PR #54，squash `325bae6`）。

**四步排除 Supabase（用戶假設）**：
- BC-8 原記「後端 RPC 179KB 完好」是 RLS 大掃除**前**測的。用線上 anon key 直打 `get_osm_substations`(785)/`get_osm_power_lines`(2305) → HTTP 200 回滿；migration 271/272 表清單不含 osm 電力表（早在 176/228 自帶 anon SELECT policy）→ **後端與資安改動清白**。
- **暖機 browser 測不出來**：subagent 開 4 電網層加壓 7 次全載滿。踩坑：`setData([])` 只清 Mapbox source，`cachedOnce` 記憶體 cache 沒清 → 重 toggle 都 instant cache hit、沒觸發冷 fetch。**真冷 repro 必須 page reload 清 JS 記憶體**。
- **真冷 repro 成功**：reload + 21 層併發、電網刻意排在 8 重量層後 → 開後 ~8s 電網全 0、~16s 才補滿（38/747/2305/26589），全程零 fetch 錯誤。
- **根因**：前端韌性層併發上限 8（AR-01）的 FIFO 排隊，靜態大層排在動態層後 → 冷載暫態空窗（非 fetch 失敗、非 setData/render race）。且多人各自打同一份 = DB 讀取 O(N)。

**修法**：25 靜態層預匯出 JSON 快照走 S3+Cloudflare CDN，前端 `staticRpc()` 讀 `/static-rpc/*.json`（404 fallback 回 RPC）。脫離 DB 併發排隊，settle 16s→2s，O(N)→O(1)。prod 端到端驗證（25 檔上線、缺檔正確 404、fallback 安全）。廢棄物 4 層改「全量 + 前端 filter」（psql 對數 10/10）；`get_waste_stops` 193k/56MB 太大排除（保留 per-city RPC）。

**教訓**：
1. 「後端完好」的舊結論要標時間戳——資安/schema 改動後可能失效，**重測才算數**。
2. 有 in-memory cache（cachedOnce）的 repro：清 source ≠ 冷載；**必 page reload 才清 JS 記憶體**觸發真冷 fetch。
3. 併發限流器（保護 DB）的副作用是靜態層暫態空窗——**靜態資料根本不該佔動態併發 slot**（該走 CDN）。

## 2026-07-07 owner-gated 安全鎖定 — 電廠 public schema 漏鎖 + read-only tx regression

**背景**：把畜牧/石化/電網/電廠 34 層從「前端假鎖」升級成 DB 真鎖（migration 275 REVOKE anon + RPC owner 守門）+ 分層治理後台 + lock_type 分型。上線後做全面安全審計。

### 事件 A：電廠 public schema 漏鎖（275 漏 → 279 修）
275 鎖了 `energy` schema 電廠 SSOT + REVOKE `public.osm_*`，但漏掉 `public` schema 另 4 個電廠 table/view（`all_power_plants_v` 全台電廠 SSOT 鏡像 581 筆 / `power_plants` / `nuclear_plants` / `ipp_thermal_plants`）。`public` schema 有被 PostgREST expose → anon 用公開 key 直打 `/rest/v1/` 可讀，繞過所有 owner-gated 電廠圖層。安全審計 agent 掃出。**修法**：279 REVOKE anon/authenticated + DROP anon policy；前端 `powerPlants`（用 all_power_plants_v 的已下架圖層）補進 GATED_LAYERS。

### 事件 B：gated RPC STABLE → read-only tx 爆 audit INSERT（276 引入 → 277 修）
276 把含 `INSERT`（寫 access_audit_log）的 `enforce_layer_access` 植入 24 支鎖定 RPC，但沿用原 STABLE 標記。**PostgREST 對 STABLE/IMMUTABLE function 一律用 READ ONLY transaction** → 內部 INSERT 觸發 `25006 cannot execute INSERT in a read-only transaction`。只有「有 EXECUTE 權限、真正進入 function 的 owner」踩到；anon 在 ACL 層就 401、psql 直測不經 PostgREST read-only 包裝，故 275/276 驗證都漏，用戶 browser 登入開圖層才炸出。**修法**：277 把 24 支改 VOLATILE（PostgREST 改用 READ WRITE tx）。

**教訓**：
1. 鎖 schema-level（未 expose 的 schema）安全，但散在 `public` schema 的**同主題** table/view 容易漏——鎖清單要反查全部讀者，不只鎖 API 用到的（孤兒表也要）。
2. **PostgREST 對 STABLE func 用 read-only tx** → SECURITY DEFINER + 內含 INSERT（audit）的 RPC 必須 VOLATILE。
3. migration 驗證盲點：psql 直測 `SELECT func()` 不觸發 PostgREST read-only 包裝，anon REST 又被 ACL 擋門外 → **owner 透過真 REST 的路徑沒被測到**。要用真 authenticated（或 service_role）REST 驗 owner。

## 2026-07-22 timeline render-phase store write + waste RPC 48s 診斷

### 事件 A：useTimeline setState-in-render（PR #79 `e2cb2cb`）
用戶 console 見 React「Cannot update a component (App) while rendering a different component (App)」。根因：`useTimeline.ts` 在 render body 直接 `timeStore.setTime(initial)`（一次性 init 裸 `if`），而同 hook 下方 `useSyncExternalStore(subscribeUiTime, …)` 訂閱同一 store → render 期間寫入同步通知訂閱者。修法：搬進掛載 `useEffect`（timeStore 預設本就 `Date.now()`，首幀無感）。**全專案稽核**（2 平行 agent：8 store write 呼叫點 + 535 個 setState）確認為孤例，其餘 layer/hook/`loadingRegistry` 全乾淨。
- 教訓：此警告 remount / StrictMode / HMR 時序才穩定冒出，clean load 隱身 → headless 難重現，靠結構判定（render-phase 寫被訂閱 store）即可定案。→ PRINCIPLES 新增一條。
- headless 驗證踩雷：`window.__THREE__` 不是可用的 THREE namespace（`Camera`/`Points` undefined，只是 devtools revision 標記）→ 無法 eval 重建 Three 場景；App layer 是 React state 無法從外部驅動 → 改用「資料管線 probe（querySourceFeatures 抽高樓）+ 元件級證據（GlowPointsScene 已驗）」佐證。

### 事件 B：get_waste_schedule_day 實測 48s（🔴 需 pre-aggregate，未實作）
`/check-rpc` 實測 `get_waste_schedule_day(NULL, 2)` = **48.06s**、來源 `spatial.waste_collection_stops` 193,541 筆、回 2,978 route groups。每次即時重算：逐列 regex 解析時刻 + weekday EXISTS + `DISTINCT ON` + **每列 3× ST_Distance geography**（離群偵測）+ 多輪 LAG/LEAD window + LEFT JOIN OSRM segments + `jsonb_agg`。前端 30s 逾時 → 圖層載不出（用戶 console 那條 timeout）。結果只依 `p_dow`×`p_cities`、來源靜態 → 物化表 + refresh function。→ BACKLOG BL-24（DB migration，待用戶拍板）。

## 2026-07-23/24 tourism 12 圖層 — Infinity JSON 整檔炸 + 平行 session 共用 worktree

### 事件 A：`yoy_pct:Infinity` → 瀏覽器 JSON.parse 整檔失敗（旗艦層 0 點）
上游 `08_pulse_export.py` 算 yoy 除零（苗栗客家圓樓前一年 0 人次）→ `float('inf')`，Python `json.dumps` 預設寫出非標準 `Infinity` literal。Python `json.load` / `jq` 都吞得下 → 上游驗證與資料驗收 agent 全沒抓到；瀏覽器 `res.json()` 直接 SyntaxError **整檔**失敗 → attractions 6,070 點全滅。browser 驗收 `queryRenderedFeatures`=0 才揪出（tsc / 197 tests 全綠也擋不到）。
**修法**：兩份快照 sed `Infinity`→`null`；上游加 `math.isfinite` 守門 + `json.dumps(allow_nan=False)`（未來違規在匯出端直接 raise）。
**教訓**：Python/jq 對 JSON 的寬容度 > 瀏覽器——strict 驗證要用 node `JSON.parse`；除法欄位（yoy/比率）是高風險點。→ PRINCIPLES 新增一條。

### 事件 B：平行 session 共用 worktree — canopy commit 落到 tourism branch
本 session 在共用主 worktree checkout `feat/tourism-layers`；另一 session（canopy v2）23:40 commit 時不知 HEAD 已換，canopy `313ba5c` 落在 tourism branch 上、夾在兩顆 tourism commit 中間。另外對方進行中的 canopy giants WIP（10 檔）與本 session 的 stash/pop 時間交錯——靠「stash 只鎖必要檔 + commit 前 `git show <hash> -- <file>` 逐檔驗 diff」保住雙方內容零污染（驗證：tourism 兩顆 commit 無 canopy hunks）。
**解法（PR 純淨）**：不動本地 branch、不 rebase——`git worktree add`（scratch）以 tourism 基底 cherry-pick 修正 → `git push origin <sha>:refs/heads/feat/tourism-layers` 推乾淨血統開 PR #82；canopy 由對方 session 併 giants 收成 PR #83。事後 `git diff origin/master <branch>` 驗零獨有內容才刪 branch。
**教訓**：共用 worktree 的 branch checkout 會讓平行 session 的 commit 落錯 branch；branch 手術一律 scratch worktree + push sha。→ PRINCIPLES 新增一條。

---

## 2026-07-26/27 — monitor 三部曲 + 登入半殘站 + 直播牆重生

### 事件 A：monitor 版面雙缺陷疊加 + 修法卡死未合併分支三週
用戶回報「圖表巨大 + 內容消失」= 兩個獨立缺陷：TimeseriesSparkline（為 280px popup 設計）SVG 無 height 屬性 → 寬容器按 viewBox 256:h 固有比例整張放大 4-8 倍；MonitorPanel body row `flex-basis:0`（scaled shrink factor=0）被撐爆的卡片壓到 0px + 外層 overflow:hidden 連捲都捲不到（「內容消失」其實是被壓扁）。git 考古發現 7/8-9 已在 `fix/monitor-airport-card`/`feat/monitor-grid-layout` 修過但從未 merge、master 一直是壞的。
**修**：ResizeObserver 動態 viewBox（1 unit=1px，優於分支版 1 行 style height——後者寬容器下文字水平變形）+ 語意移植 88cb2f4 軸域修正（y clamp / 步距格式 / 整點 tick / gapSec 斷線）→ PR #89。`fix/monitor-airport-card` 已完全取代可刪；`feat/monitor-grid-layout` 仍有 14 commits Monitor v2（RGL）未被取代（BACKLOG G015）。
**教訓**：分支上的修法不 merge 等於沒修；共用圖表元件設計給特定容器寬時要動態量測。

### 事件 B：live.* RLS anon-only → 登入會員半殘站三週（詳 pitfalls/2026-07-26-live-rls-anon-only.md）
用戶回報「登入後反而只剩機組出力有資料」。根因：live.*（原 realtime.*）48 條 RLS policy 建表時只寫 `TO anon`（當時系統無登入功能），7/3 會員上線後 authenticated 讀取靜默 0 rows（RLS 無 matching policy 不報錯）；7/24 兩輪 lint 清理（314/315）因 Advisor 0013 只抓 RLS-disabled 而漏掃。SET ROLE 實測定罪（anon 59 rows vs authenticated 0）→ migration 318（48 條 ALTER POLICY 純加法、pg_policies 現場生成清單）→ authenticated 全數恢復 = anon、anon 零變化。機組出力反轉（登入才有）是另一套 owner-gated 機制正常運作，順帶記 OG-5（PowerCard 誤導空狀態，owner 拍板先不動）。

### 事件 C：yt 直播牆 resolver 反爬蟲全滅 + 失敗覆寫放大 → Data API v3 重寫
7 天 ~2007 次執行每頻道僅成功 6-8 次（YouTube 擋 HTML 爬取，僅每日一小時窗口可過），且失敗時無條件清空 video_id——TVBS 三年沒換的 24hr 直播 ID 也活不過 5 分鐘。重寫（data-collectors `d8b6f10`）：videos.list 批次驗證（1 unit/輪，50 id/call）+ search.list 只在無有效 live ID 時（獨立桶 100 calls/day 硬上限；冷卻 60min→6h 退避 + 每日 80 自限）+ sticky 三態 + channels.list forHandle 一次性解 channelId 寫死（順修鏡新聞/非凡兩個從來就錯的 handle）。實測 11/13 台解出、正常日 ~288 units。
附帶三發現：**TTV 實測遭著作權封鎖第三方嵌入**（YouTube 官方訊息，embedBlocked 永久過濾）；`embed/live_stream?channel=` 路徑實證多數頻道不可靠、整條移除；華視寫死 fallback 已下播 → resolveSrc 改 resolver 優先 + fallback 安全網 + 動態過濾（無有效 src 不入選單）+ 失效自動換台。
**教訓**：→ PRINCIPLES sticky 原則 + quota 上網驗證；寫死外部資源 ID 前先 oembed 驗身分（三立候選實為單場直播,寫死必殭屍）。

### 事件 D：KHH 機場無資料 = collector ENDPOINTS 漏收 + VM 手動部署陷阱
高雄 KHH1（入境）/KHH5（出境）端點從未列入 ENDPOINTS（前端/RPC 都正確；curl 驗證端點活著格式一致）。補上後本地跑一輪 1,289 筆進 DB、commit `a2f158a` 已 push。⚠ 生產實跑的是 HiCloud VM（210.61.15.74）cron 版，檔案手動 SCP 不接 git——**git push 不會生效**；Zeabur 版因移民署 API 擋國際雲商 IP 而 enabled=false。VM 更新待用戶執行（G013），未更新前 KHH 只有 7/26 一次性資料。
**教訓**：`external/` 目錄的 collector 先讀部署說明再談上線；「push 了」≠「部署了」。

---

## 2026-07-29/31 — 溫度三部曲（溫度網格 / 微感測模式 / 都市熱島 LST）

### 事件 A：raster-color-mix 係數 shader 推導翻車 → 像素取樣定案
實作 agent 讀 mapbox-gl 3.9 原始碼（`computeRasterColorMix` 帶 ×255 factor）推導出「mix 係數作用在 0–255 原始 DN」，據此推翻上游 handoff 的 ×255 寫法、連帶宣判既有 canopyHeight 也是壞的；主 agent code review + tsc + 197 tests 全放行。瀏覽器驗收像素取樣戳破：全島單色飽和在 range 下限（(35,86,139) 無漸層），而 canopy 對照組漸層正常 → 正確模型是「texture 取樣正規化 0–1，係數 = 物理斜率 ×255」（51=255/5、63.75=255/4）。修正後複驗：三都會 RGB 各異、山脈藍系、海面/澎湖透明。
- 教訓：shader 換算鏈太長（style→computeRasterColorMix→uniform→GLSL），單看原始碼片段推導必翻車；係數對錯以畫面像素實測為準；**推翻 working 範本前先實測 working 範本**。→ PRINCIPLES 新增。
- 附帶小修：popup 溫度是點擊快照但「時間」欄讀 module 層 live 值 → 開著面板拖時間軸出現時溫錯配，改 `useMemo(..., [props])` 凍結同刻。

### 事件 B：#92 squash merge 刪 base branch → stacked PR #93 被 GitHub 自動關閉
#93（base=feat/temperature-grid-2d）在 #92 merge + branch 刪除後被**自動 CLOSED**（GitHub 不 retarget 到 master、直接關），內容未進 master；用戶手動重發 #94 才補上。#96 記取教訓：`git rebase --onto origin/master <舊base尖>` 落到最新 master 再發 PR（過程解掉與 #95 的 import 衝突）。→ PRINCIPLES 新增。

### 事件 C：LST pipeline 三個資料層教訓（SSOT：analytics 方法論文件）
① 直讀 COG 實測 30–50KB/s + GDAL 27 reader 並行壅塞崩潰 → 改 Planetary Computer server-side crop API（快 10 倍；限流表現為「收下連線永不回應」→ timeout 150s + 退避；並行 6→16 實測 0 失敗，監看要看耗時分布不是 error log）。② ST_QA 絕對門檻 3K 在北台暖季丟 85% 像元 → 改 per-path/row P75 相對分位數（南部 5.1–5.2K vs 北部 4.4K，實證必要）。③ 逐景背景中位數被雲遮罩取樣偏差綁架（35 景背景散布 21K）→ 全島版用 WorldCover cropland 統一背景遮罩 + 景級樣本守門。詳：`taipei-gis-analytics/docs/topic-research/remote_sensing/urban-heat-lst-methodology.md`。

### 事件 D：weather_change/.env 明文 AWS S3 key（未進 git，僅本機磁碟）
探索 weather_change 時發現本機 `.env` 含明文 `S3_ACCESS_KEY`/`S3_SECRET_KEY`（`.gitignore` 有擋、未外洩；git 只追蹤 .env.example）。移植過程未複製任何憑證進 pulse。建議輪替該組 key → BACKLOG G016。

## 2026-07-29/30 — 人均市值（#95）部署鏈兩發現（本 session 亦為 #92/#94/#95 依序 squash 的執行方）

### 事件 A：Zeabur empty commit 不觸發 build → 換磚部署 race 白繞 35 分鐘
S3 換磚上傳完成於 15:25Z，但 #95 merge（15:02Z）觸發的容器已在 15:04Z 啟動並 pull → prod 拿舊磚。推空 commit 想觸發 redeploy、輪詢 15 分鐘無效；`zeabur deployment list` 一查即破案：**empty commit 根本沒產生 deployment**。正解：`zeabur service exec --id <svc> --env-id <env> -i=false -- sh /usr/local/bin/pull-deploy-assets.sh`（CLI 本機已登入；s3 sync 精準只拉變動檔、零停機，實測即列出兩檔 download）。教訓：換磚 SOP 固定「先 S3 上傳完成、後 merge/deploy」；排查部署先查平台事實（deployment list 對時間戳）再輪詢。

### 事件 B：origin 換新後 Cloudflare edge 仍供舊 pmtiles（range request 同吃舊快取）
service exec pull 完 origin 已新（cache-bust 驗證），但 edge 對無 query URL 仍 HIT 舊物件，且 **PMTiles 的 range request 也從同一舊快取切片**（content-range total = 舊檔大小）。`cache-control: max-age=86400` → 自然過期要 1 天。`purge-cloudflare-cache.sh` 現成但 CF_ZONE_ID/CF_API_TOKEN 全機未設 → G017。過渡期症狀：新前端 + 舊磚 = 人均模式整片灰半透明（pop 缺欄的誠實 fallback，不會壞）。

## 2026-07-31 — 地震回放：handoff 兩處與資料實況不符（開工前實查救回）

### 事件 A：town_intensity「可與 occurred_at 等值 join」不成立（1 秒漂移）
handoff §4 原寫 town 的 `origin_time` 與 `events.occurred_at` 可等值。實查 115053（07-30 台東成功）：
town 端 16:58:35 vs events 16:58:36 **差 1 秒**（CWA 初報 vs 修訂報，該筆 magnitude/depth/epicenter
也與 events 不同）。等值 join 會讓這起地震 has_town=false、素材憑空消失。
解法：mig 324 RPC 改 **±5 秒窗取最近者**，並回傳 resolved key `town_origin_time` 讓契約自洽
（has_x ⟺ key 非 NULL ⟺ 等值查得到）。窗只開 5 秒不開 90 秒：地震序列 90 秒內出現另一起
有感並非罕見，大窗會誤配餘震。handoff 已回填修正（analytics `f935e95`）。

### 事件 B：「之後每起有感自動累積」寫成事實，當時實據只有一起
handoff 上線時只有楠西一起完整四件套，而 07-26 M5.6（比楠西大）卻缺 town+grid——不查證的話
「清單會自己長大」的設計假設就是裸奔。派 agent 讀 collector 判定：CWA/NCDR 源頭是
「只留最新一次」的無狀態快照 → **上線（07-29）前的事件被覆寫、永久不可回補**（非深源限制、
非 bug）；07-30 115053 零人工自動進庫實證 pipeline 活著。
→ 教訓：**handoff 的「現況」段有時效性，開工前必對 DB 實查一輪**——兩天前寫的數字（32 起）
到開工日已變（34 起），且新進資料（115053）正好暴露了事件 A 的設計缺陷。

## 2026-08-01/02 — 共機資料回填與航跡圖向量化（四事件）

### 事件 A：線上 collector 舊版持續覆蓋修好的資料 ⚠️ 未解
回填完成後查最近幾天，發現 7/30 原本抓到的「逾越中線 22、四區全進」又變回空值與 false。
證據：`raw_text` 長度剛好卡 **2000**（舊版 `text[:2000]` 特徵；新版存內文上限 4000）。
線上 collector 每 30 分鐘抓最新 5 則並 UPSERT → 用舊解析器覆蓋。
程式已修並 commit（`data-collectors` `feat/pla-parse-fix-backfill`），
但**要部署到線上跑的環境才生效**（需 owner 操作）。在那之前資料持續劣化。
→ 教訓：改了 collector 解析邏輯就等於改了資料契約，**部署前回填的成果都是暫時的**；
回填與部署要當成同一件事排程，不可只做前者。

### 事件 B：maincontent 被巢狀結構截斷 → 80/729 天存到頁面 chrome
`<div class="maincontent">(.*?)</div>` 非貪婪，遇到內文含 base64 內嵌圖或巢狀 div
會在第一個 `</div>` 提早結束 → 內文不完整 → 退回全頁 fallback → `raw_text` 存成導覽列雜訊。
數值仍解析得出（全頁也含內文），所以**表面正常、實則喪失未來重解析能力**，
靠「raw_text 含『全球資訊網』」才掃出來。
另一同源問題：gate 要求標題含「中共解放軍臺海周邊」，但部分日期 maincontent 直接由
「一、日期」起頭 → 被擋下走 fallback（即上述 80 天的觸發原因）。
修法：終點改抓「keyword／page-share／footer 區塊」；gate 放寬。

### 事件 C：mnd.gov.tw 圖片下載全部 406
爬蟲 session 的 `Accept: text/html,...` 不含 `image/*`，伺服器直接拒絕。
症狀是整批圖 0 成功但 HTML 抓得到，容易誤判成防爬。實測 `Accept: image/*,*/*` 即 200。

### 事件 D：版型不一致致共用配準偏移（守門攔下）
2026 年 181 張中有 3 張為 794×1115（其餘 720×1040）。原本全部取中位數作共用配準，
會讓少數派整組錯位。改為**依圖片尺寸分組**各自建立配準；該尺寸全數配準失敗時整組跳過並印警告。
→ 通則：任何「同版型底圖一致」的假設，都要先驗證尺寸/版型分布再套用。

## 2026-08-03 — 共機圖層／戰情板（四事件）

### 事件 A：判斷 collector 部署是否生效，看 `updated_at` 會被騙
PR #41 merge 觸發 Zeabur 部署後，DB 的 `updated_at` **完全沒變**（仍是部署前的時間戳），
但 `raw_text` 長度從卡 2000 變成 ~150、`crossed_median_line_cnt` 從 NULL 變成 22 —— 值改了、時間戳沒改。

根因：`updated_at` 欄位只有 `DEFAULT now()`（INSERT 時寫入），UPSERT 的 UPDATE 分支
沒有更新它。差點據此誤判「部署沒生效」。

→ **驗證部署是否生效，要看「只有新版才會產生的內容特徵」**（此處是 raw_text 長度與
新欄位是否被填），不要看時間戳。時間戳只證明「有人寫過」，不證明「誰寫的」。

### 事件 B：Supavisor pool 被 `SET ROLE` 毒到（同類第二次）
驗完 migration 330 的 anon 權限（`psql -c "SET ROLE anon; …"` 沒有 RESET），
接著 apply 331 直接 `ERROR: permission denied for schema public`。

同類事故 2026-07-24 已寫成 `data-collectors/.claude/pitfalls/2026-07-24-supavisor-session-set-poisoning.md`
（當時是 `set_session(readonly=True)` 毒到 collector 寫入），**這次換個入口又踩一次**。

解毒：24 條併發連線送 `RESET ROLE`，直到 `SELECT current_user` 全回 postgres。
根治：一律 `BEGIN; SET LOCAL ROLE anon; …; ROLLBACK;`（→ 已入 PRINCIPLES）。

### 事件 C：`useRealEstateTimeline` 缺 guard → 歷史模式 ▶ 永遠只前進一格
接共機圖層到歷史模式時發現按播放只跳一格就停。追下去**不是本次引入的 bug**：

`useRealEstateTimeline` 的播放引擎守門只有 `playing && appMode === "historical"`，
**沒有檢查房地產圖層是否開著**。App 那邊的歷史播放 effect 反而有 `realEstateActive` 讓位邏輯，
兩邊不對稱。RE 游標預設停在 `RANGE_END`，第一個 interval tick 就 `nx <= cur` → `onStop()`
→ 把 `historicalPlaying` 關掉。

影響範圍是**整個歷史模式**：火災、人口都中招，只是沒人回報。加 `active` guard 修正。
→ 通則：兩處程式碼互相「讓位」時，讓位條件必須寫在**兩邊**；只寫一邊 = 另一邊無條件搶走。

### 事件 D：alpha 疊加把 120 天疊圖糊成不透明
疊 120 天活動區時整塊紫到蓋掉台灣本島。原因是 alpha 疊加為 `1-(1-a)^n`：
單層 0.22 疊 20 層已達 0.99。第一版直接把單日的 0.22 套上去就爆掉。

修法見 PRINCIPLES「疊圖的單層 alpha 要依疊加層數縮放」。
→ 這類問題**先算再做**只要 30 秒，先做完再用眼睛調要來回好幾輪。

## 2026-08-05/06 — 殯葬圖層 + 跨 repo 分支整合（八事件）

> 2026-08-10 補記：本段原寫在孤兒分支 `memory/wrap-up-funeral-integration` 上未合回，
> 事後增量搬入。程式碼本身早已隨 PR #107／#110 進 master，不受影響。

### 事件 A：上游 `is_active` 漏判「遷他縣市」→ 圖上出現幽靈業者
上游寫 Supabase 匯入腳本時 `operator_uid` 撞號 29 筆，本以為是重複資料，查下去不是：
同一家業者**遷址的新舊兩筆登記**（統編 45442023 天昕禮儀社：苗栗「遷他縣市」＋新竹「核准設立」）。
連帶揭露 `is_active` 把「遷他縣市」26 筆判成營業中 → 前端在**舊縣市的舊地址畫出點**，
同一統編同時出現在新舊兩地，看起來像兩家在營業。

→ 這個錯誤前端完全看不出來：點畫得出來、popup 有資料、測試全綠。
**只有從資料端反查 PK 撞號才會發現。**

### 事件 B：契約 ratchet 守型別不守筆數 —— 規則變動測試擋不到
本 session 為殯葬加了兩支 ratchet（`staticDataContract` 驗欄位型別、`classificationCoverage`
驗分類值覆蓋）。事件 A 的修正換掉資料檔後，**兩支測試全綠**，但 UI 上 9 處寫死的
「仍營業 (4,595)／已歇業 (1,638)」全部變成錯的。

→ 契約測試防的是「欄位改名/改型別/新增分類值」，防不了「判定規則改變導致筆數位移」。
已把「`is_active` 改判定規則」與「總筆數變動」兩列補進 feature handoff 的觸發點表當人工同步點。
通則見 PRINCIPLES「資料契約 ratchet 守不到筆數位移」。

### 事件 C：`.gitignore` 不支援行內註解 → 白名單靜默失效
收 `tw-address-geocoder` 時寫 `!data/processed/*.md   # 實測報告要留`，結果該檔仍被忽略。
`git check-ignore -v` 才看出整串（含 `#` 後面）被當成 pattern。

→ `.gitignore` 的註解**必須獨立成行**。失敗方式是靜默的（檔案就是沒進 git，不報錯）。
→ 通則：任何「規則檔」加註解前先確認該格式支不支援行內註解（`.gitignore` / `.dockerignore` 不支援）。

### 事件 D：`performance.getEntriesByType('resource')` 有 250 筆上限 → 誤判「RPC 沒發出」
查共機圖層為何空白時，用 Resource Timing 撈不到任何 supabase 請求，據此推論「RPC 根本沒發」。
實際上該 buffer **預設上限就是 250 筆**，當時 `total: 250` 已經滿了，新請求全被丟棄。

→ 差點把「資料過期」誤診成「程式沒發請求」。
→ 用 Resource Timing 當證據前先看 `entries.length` 是不是剛好卡在 250；
   要可靠就先 `performance.setResourceTimingBufferSize(N)` 或改用 CDP network 攔截。

### 事件 E：共機圖層看似壞掉，實為上游手動批次沒人再跑（我的初判是錯的）
`plaActivity` 開了但圖上 0 筆。逐層排查後確認：**前端沒問題**，
`spatial.pla_tracks` 停在 2026-07-31（查詢當日 08-06），圖層預設「單日」→ 查當天 → 空。
切「30 天疊加」立刻出現 73 個活動區。

⚠️ **我當時判成「collector 停擺」，是錯的。** 平行 session 當天查清楚：
`live.pla_activity_daily`（數值）一路正常寫到 08-05，連 `track_chart_url` 都抓到了 ——
**collector 是好的**。斷掉的是 **taipei-gis-analytics 的手動向量化批次腳本**：
08-02 跑完 07-31 之後就沒人再跑，`spatial.pla_tracks` / `live.pla_activity_items` 停在那天。

**最值得記的一條**（來自平行 session 的分析）：斷了 5 天沒有任何告警，
因為「共機 0 架次」是**合法的 0 形狀** —— 那天在 `pla_tracks` 就是沒有任何 row，
**分不出「沒共機」與「沒跑」**。

→ 動態圖層「看起來壞掉」時，**先查資料最新日期**再查程式（這條我做對了）。
→ 但「資料停了」之後還要再問一次**是哪一段停了** —— 寫入鏈有多段時，
  最末端沒資料不代表最前端掛了。我跳過這一步直接歸咎 collector。
→ 通則：**用「有沒有 row」當健康指標，遇到「合法的空」就會失效** ——
  要區分「沒事件」與「沒執行」必須有獨立的執行 ledger。
→ 產品面問題：預設單日 + 資料有斷層 = 使用者看到空白會以為功能壞了。

✅ **2026-08-07 結案**：轉成 data-collectors 的每日 collector `pla_tracks_vectorize`
＋ ledger 表 `spatial.pla_tracks_runs`（migration 337，每個處理過的日子必有一列）。
詳見 PB-33 與 [`.claude/pitfalls/2026-08-07-silent-upstream-outage.md`](../pitfalls/2026-08-07-silent-upstream-outage.md)。

### 事件 F：deep-link `?layers=` 對 hook-based 圖層無效（既有問題，非本次引入）
`?v=1&layers=plaActivity` 直接開 → 圖層完全不建立；手動點 toggle → 正常。
原因是這類 hook 寫 `if (!map) return` 且 deps 只有**穩定的 `mapRef` 物件**：
deep-link 時 `visible` 在 map `load` 之前就變 true，effect 跑一次就 bail，之後再也不會重跑。

掃描結果**波及 20+ 個 hook**（`useNewsEventsLayer`／`useEarthquakeLayer`／`useFireEventsLayer`／
`useFossilFuelLayers`…）。只有 3 個有輪詢防護：`useEarthquakeReplayLayer`、
`useTemperatureGridLayer`、本次新寫的 `useFuneralDensityLayer`。
registry 層不受影響（MapView 在 map `load` 時統一補做）。

→ 影響範圍是**分享連結**，不影響一般操作，所以一直沒被發現。
✅ **已修：2026-08-06 PR #114（`65f3da9`）** 抽出 `useMapReadyTick(mapRef, enabled)`（未就緒每 200ms 輪詢），
套上 **55 個 layer hook** ＋ `factories/timelineSliceLayer`。實際成因比原判更廣：
production 首載 `map.on("load")` 可能晚達 ~30 秒，**首載期間手動 toggle 也會中招**，不只 deep-link。

### 事件 G：handoff 的「預期數字」會腐敗
上游 handoff §4 的驗收指令註明「預期：業者 6233（仍營業 4595）」。事件 A 修正後實際是 4569，
但那行沒改 → 下次照著跑的人會以為產物壞了。

→ 文件裡**寫死的驗證期望值**是會過期的資產。已改成 4569 並加註
「跑出 4595 = 手上是舊產物，要重跑 build_web_assets」，讓數字本身帶診斷資訊。

### 事件 H：`git reset --hard` 清掉平行 session 的未提交檔案（我造成的）
把 9 個 memory commit 從 master 搬到分支時跑 `git reset --hard origin/master`，
連帶清掉平行 session 未提交的 `docs/features/pla-activity/changelog.md`（28 行）。

**我在動手前就知道它存在** —— 跑過 `git status` 看到 `dirty:1`、讀過那段 diff、
甚至根據它修正了自己對共機根因的誤判。然後還是打了 `--hard`。

還原成功純屬僥倖：稍早剛好把整段 diff 印在對話裡，才有東西可以逐行重建
（28 insertions 對得上）。**這不是防護，是運氣。**

實測三種做法（scratchpad 重現當時情境）：

| 做法 | 平行 session 的檔案 |
|---|---|
| `git reset --hard <target>` | ❌ 清成 base |
| `git reset --keep <target>` | ✅ 保留 |
| `git switch -c <新>` → `git branch -f <舊> <target>` | ✅ 保留 |

- `--keep` 只更新「HEAD 與目標之間有差異」的檔案 → 沒被本次 commit 碰過的檔案不在範圍內。
  且**衝突時 exit 128 拒絕執行並保留現場**，不像 `--hard` 靜默吃掉
- `branch -f` 動的是沒被 checkout 的指標，**完全不碰工作區** —— 連判斷都省了
- 原則：**不要重置你正站著的那條分支；先站到別條去，再回頭移指標**

→ **`git reflog` 只救 commit，救不了未 staged 的改動**。曾 `git add` 過的還能
`git fsck --lost-found` 撈回（blob 在 object store），從未 staged 的沒有任何副本。
→ 已寫進 `GIS/CLAUDE.md` 鐵則與全域 `~/.claude/CLAUDE.md` 開發行為準則。
→ 更根本的一條：**工作區出現「不是我的」未提交改動時，那是平行 session 在跑** ——
  破壞性操作前先停，也不要替它 commit（不知道跑不跑得起來 = 替沒驗證的東西背書）。

## 2026-08-07 — 上游靜默斷供三連 + 自己造成的 CI 紅

### 事件 A：三個資料源都是「程序成功但產出永遠是空的」
一天內查出共機航跡向量化斷 5 天、台電落雷斷 **28 天**、警政署 A1 停更 **6 週**，
三者的 collector 都在跑、HTTP 都 200、都沒有 exception、沒有告警。

完整診斷過程與三種判準（ledger／第二資料源／第三方訊號反證）已獨立成篇：
→ [`.claude/pitfalls/2026-08-07-silent-upstream-outage.md`](../pitfalls/2026-08-07-silent-upstream-outage.md)

這裡只留最該記住的兩條：
- **`metadata.collector_status` 會騙你**：`last_success_at` 只在有 records 寫入時更新，
  上游回空檔時它停在最後一次有資料的時刻，看起來像 collector 掛了；
  `last_error` 更糟，停留在很久以前的一次失敗（台電落雷顯示 `borrow timeout`，
  害人往連線池方向查，真正原因是上游空檔）
- **S3 archive 的檔案 Size 就是免費的時間軸**：連續區間大小完全一致（52,0xx bytes）
  = 內容一模一樣 = 上游停供起點，不必下載任何檔案就定出 2026-07-10

### 事件 B：我 merge 前沒跑該 repo 的測試 → main CI 紅
data-collectors 的 CI 在我這輪之前**就已經紅了**（2026-08-03 `feat/food-prices-collector`
merge 時漏加 `cross_layer_map.yaml`），而我的兩個 PR 又各加了新漏項：
#43 在 cross_layer_map 列了 3 張表但只有 ledger 進 realtime_tables、#44 整個沒進 cross_layer_map。

三個 `test_cross_layer_sync` ratchet 測試設計得很好、確實抓到了 —— **是我只跑了 pulse 的
vitest，沒在 data-collectors 跑 pytest**。跨 repo 工作時「測試要在改動所在的 repo 跑」
這件事很容易漏。修法見 PR #45（順手把 food_prices 一起補掉，CI 四天來第一次回綠）。

### 事件 C：`zeabur variable create` 不 restart 就不生效
設完 `PLA_TRACKS_VECTORIZE_ENABLED=true` 後，容器內 `config.PLA_TRACKS_VECTORIZE_ENABLED`
仍是 `False` —— 運行中的容器不會重讀環境變數。`zeabur service restart` 後才變 True。

**驗證法**（比看 dashboard 可靠）：
```bash
zeabur service exec --id <svc> -- sh -c "python -c \"import config; print(config.XXX)\""
```
⚠️ 但如果變數是在**新部署 build 開始之前**設的，部署完就直接生效、不必 restart
（後來設 `LIGHTNING_CWA_ENABLED` 就是這種情況）。差別在時序，不在指令。

### 事件 D：KML 收尾標籤多一個空格 → 靜默解出 0 筆
接氣象署落雷 KMZ 時，第一版 regex 寫 `</when>`，解析結果 179 筆變 **0 筆且不報錯**。
上游實際輸出是 `</when >`（多一個空格）。

同一支 API 還有第二個坑：**端點回 302 重導**，`requests` 預設跟隨所以程式沒事，
但手動 `curl` 測試時不加 `-L` 會拿到 0 bytes，**看起來就像「這個源也沒資料」**。
兩個坑疊在一起差點讓我判定氣象署源不可用。

→ 通則：解析外部 XML/KML 時，收尾標籤一律寫成 `</tag\s*>`；curl 測任何陌生端點先加 `-L`。

## 2026-08-06~08 — embed 動態回放（EM-16）四事件

### 事件 A：RDP 對「折返幾何」的系統性偏移 —— tolerance 不是槓桿
鐵路幾何從 68MB 瘦到 367KB 時，第一版簡化完拿雙幾何跑同一顆引擎逐車比對，
p95 過線但 **max 偏差 245.4m**。直覺是「tolerance 調小就好」，實測 **1e-5 仍 plateau 在 305m**
—— 調參方向根本不對。

根因：原始軌道含**來回走同一段的子路徑**（折返、環狀、股道），這種幾何的垂直距離趨近 0，
RDP 判定「這些點都可以刪」→ 把一整段來回壓成一條短弦。點的位置沒錯多少，
但**弧長縮掉一大截**，而列車位置是「弧長比例」推出來的 → 整段參數化位移。

定位證據很關鍵：`stopped` 狀態的車 max 偏差僅 9.27m —— 證明**站錨點沒問題、錯在站間**。

修法不是調 tolerance，是加一個正交的保護：`--max-arc-loss 5m`，某段 collapse 前若弧長
縮太多就強制從弧長中點切開保留一點。max 245.4 → **20.8m**，代價只有 +5% 點數。

→ 通則：幾何簡化的誤差指標要**選對維度**。RDP 最佳化的是垂直距離，但下游吃的是弧長；
最佳化目標與消費目標不同時，加一條正交約束，不要在原本那個旋鈕上硬轉。

### 事件 B：`station_progress` 沒對簡化後折線重算 → 列車系統性偏離軌道
換了幾何卻沿用舊的 `station_progress`（站在折線上的弧長比例）＝ 用新（更短）折線
套舊比例，全線列車一致偏移。必做重算，實作有三個坑：
- **弧長定義必須照抄** `railUtils.calculateTotalLength()`（平面歐氏、**不做 cos(lat) 修正**）。
  自己寫一個「更正確」的（加緯度修正）會與前端引擎不一致，反而製造新偏差
- 錨點要用**未量化的原始幾何**反解，不能用量化後的
- 投影要用 `src_idx` 二分 bracket，**不能純最近點搜尋** —— 自相交／環狀路線會跳段
- 站序要**依原始 progress 值排序**取得：dict key 順序是任意的，實測 373 條裡 **245 條非單調**

### 事件 C：平行 session 把工作區切走 → 我的檔案憑空消失
session 中途另一個 session 把共用工作區切到 `feat/education-layers` 並帶著大量未提交改動，
我正在編輯的檔案**從工作區消失**（已 commit 的部分安全，git 沒丟東西）。

解法：`git worktree add` 開獨立工作區，完全不影響對方，也不必去搶 branch。
⚠️ 新 worktree 跑不起來，要補三樣 symlink：`node_modules` / `.env` /
大檔 `public/base_map/*.pmtiles`。

→ 這是 PRINCIPLES「共用 worktree 有平行 session 時的 git 紀律」（2026-07-24）的第二次實戰，
但這次是**被動**遇上（不是我造成的）。結論相同：不要搶 branch，開 worktree。

### 事件 D：背景 agent 開場即 API 連線中斷
ships 移植的背景 agent 一啟動就斷線，實際工作**尚未開始**。
用 `SendMessage` 帶著 transcript 讓它重跑即恢復，零損失。
→ 背景 agent 回報異常時先分辨「工作做到一半斷」還是「根本沒開始」——
後者直接重來最省事，不必去猜它做了什麼。

## 2026-08-09/10 — embed 三 PR 上生產與 `rsys=` 擴充（四事件）

背景：#118（三層回放上生產）／#119（`rsys=` 擴到營運者級 + 線路級）／#120（rail 幾何改內容雜湊）
三個 PR 全部 merged 並在正式站 `https://mini-taiwan-pulse.itsmigu.com` 驗證通過。

### 事件 A：交辦指示與資料實況衝突 —— `line_id` 資料層有缺口
交辦時明確要求「用 `properties.line_id`，不要 parse track id 字串」。方向是對的
（字串前綴是脆弱耦合），但**實測資料撐不住**：trtc 96 條軌道裡有 **13 條沒有 `line_id`**
（全是淡水信義線的變體 `R-4-*`~`R-15-*`），而**時刻表整份都沒有 `line_id`**。
照原指示直做，`rsys=trtc` 會少掉那 13 條軌道。

解法是兩層而不是二選一：**properties 優先、缺了才退回 track_id 前綴**；
時刻表側則改成「留不下軌道的班表一起丟」——否則班次數與軌道數對不上，
畫面會出現有班次卻沒有軌道可跑的幽靈列車。

→ 通則：**指示講的是「該用哪個欄位」，但能不能用得先量一次欄位覆蓋率**。
覆蓋不到 100% 時不要在「照做」與「不照做」之間選，寫成 fallback 並把
「上游補齊後刪掉這段」記進 backlog（→ EM-31），讓臨時解有到期日。

### 事件 B：Cloudflare negative cache —— deploy 前探測雜湊 URL，把 404 快取了最長 4 小時
驗證者在 deploy 完成**之前**就去 curl 新的雜湊 URL 想確認有沒有上去，拿到 404。
該 404 被 Cloudflare 邊緣快取住，最長 **4 小時**：`.gz` 落在 CF **預設可快取副檔名清單**內，
所以 bundle 中招；`.json` 不在清單內，所以 `rail-manifest.json` 一路 DYNAMIC、不受影響。
新版上線後狀態轉 EXPIRED→200 自癒，沒有真的壞掉，但白等了一段。

⚠️ 與既有那條「Cloudflare **Cache Rule** 用固定 TTL 會連 404/5xx 一起快取」
（PRINCIPLES 2026-08-05）**是不同機制**：那條是自訂規則覆寫 cache-control，
這條是 CF **預設**對特定副檔名的 negative cache，沒設任何規則也會發生。兩條互補。

→ 規則：**deploy 完成前探測任何新 URL，一律加 cache-buster**（`?cb=$(date +%s)`）。
本專案唯一的 purge 腳本是 `purge_everything`（會連 297MB 底圖一起清），
**沒有 scoped purge** → 一旦快取到壞值，代價不對稱（→ G020）。

### 事件 C：Zeabur `deployment list` 的 RUNNING 標籤會滯後 → 不能用來判 cutover
舊 deployment 在數小時後仍被標成 RUNNING，照它判斷會以為新版沒上去（或反之）。

→ 判準改成三條 runtime 證據，不看控制台標籤：
1. runtime log 出現**新 pod started**
2. log 出現 `[pull] all assets synced`
3. **自己發一個可辨識的 HTTP 請求**（帶 token 的 query string），確認它出現在**新 pod 的** access log

第 3 條是關鍵——前兩條只證明新 pod 起來了，不證明**流量已經切過去**。
（同一條紀律的另一個版本見 PB-33「證明它真的在跑」：永遠用容器內證據，不看 dashboard 猜。）

### 事件 D：gis-wiki push 被拒 —— 遠端早有另一個 checkout 的 commit
push 被拒，遠端有 8/2 的 commit 不在本地。來源是**另一個 checkout**：
`gis-platform/.gitmodules` 把 gis-wiki 登記為 submodule，那份 checkout 也在推東西。
用 rebase 疊上去，零衝突。

⚠️ 副作用：`gis-platform` 記錄的 gis-wiki submodule SHA 現在**落後** gis-wiki main（→ G021）。

→ 通則：同一個 repo 被 submodule 登記時就有**兩個以上的寫入點**。push 被拒先查
「是不是我自己在別處推過」，而不是預設遠端壞掉；rebase 疊上去之後記得**回頭 bump
上游的 submodule 指標**，否則 superproject 會一直指向舊版本。

## 2026-08-10 — 監看模式排版八/九版（PR #121，四事件）

背景：從「這個沙盒 artifact 跟實機一致嗎」開始，一路做到排版機制重寫。
`da054f0` merged，11 檔 +2348/−108。

### 事件 A：SSOT 不在版控裡 → 兩個版本的無聲漂移
排版沙盒（決定 `MONITOR_LAYOUT` 的工具）**只活在 artifact 上，repo 沒有副本**。
結果它停在 2026-08-02 的六版，而 repo 已經到七版：缺整個 `foodPriceBoard`（用戶要找的菜價），
且 rowHeight 用 36–44 的**浮動值**而實機是固定 40px —— 同一組座標在兩邊長得不一樣高，
沙盒的對照價值歸零。沒有任何機制會發現，因為兩邊從來沒被放在一起比過。

處置：原始碼落進 `docs/features/monitor-grid-static/sandbox.html`，
發布流程改成「改 repo 這份 → 用 `url` 參數重新發布同一個 artifact」，
並寫了一支逐格比對腳本（沙盒 restored preset vs `MONITOR_LAYOUT`，16 格全對齊才算過）。

→ 通則：**任何被當成 SSOT 的東西，不在版控裡就一定會漂**，而且漂了不會有人知道。
判斷方法不是「我記得同步過」，而是「有沒有一個會紅的比對」。

### 事件 B：帶 `viewBox` 的 `<svg>` 在 flex 容器裡會自己算高度
食品價格卡的走勢圖 svg 設 `width:100%; height:100%`，卻把整格從 590px 撐到 813px。
原因：帶 `viewBox` 的 svg 是**有內建長寬比的替換元素**，`height:auto` 時用
「寬度 × 比例」算出自己的高度（實測 253px），這個值會參與 flex 的內容高度計算。

→ 解法：svg 改 `position:absolute; inset:0`，退出高度計算，只吃 wrapper 由 flex 分到的值。

### 事件 C：`height: X%` 在 auto 高度鏈上塌成 0 —— 而且溢出量測抓不到
九版把 widget 高度改成跟內容走之後，PLA 的 120 天柱狀圖**整區變全白**。
柱高是 `height: ${x}%`，而**百分比高度只認父層的「確定」高度**；
fit 這條鏈上（cell auto → 面板 flex → 圖區 `flex:1 + minHeight:190`）沒有任何固定高，
百分比解不出來就當 `auto` → 120 根柱子全部 0 高度。容器本身還在。

**最貴的一點不是 bug 本身，是我的驗收抓不到它**：我逐格比 `scrollHeight` vs `clientHeight`，
那只覆蓋「內容超出格子」；這次是相反的失敗模式「內容塌陷」，數字上完全正常。
是用戶截圖回報才發現的。

→ 規則：`fit`（auto 高度）容器內若有 `height: X%` 的元素，父層必須寫**確定像素高度**
（`height: 190` 而非 `flex:1 + minHeight:190`）。水平的 `width: X%` 不受影響 ——
寬度那條鏈一直是確定的，所以各種進度條都沒事。

### 事件 D：測試出現一次失敗但根因未確認（未結案）
`npx vitest run` 有一次回報 `1 failed | 440 passed`，但我只 `tail -4`，**沒留下是哪一條**。
之後連跑三輪都是 441 全過。該次總時長 23.5s（平常 9s）且當時 headless 瀏覽器還開著，
最可能是資源競爭導致的逾時類 flake（`staticDataContract` 會讀全部靜態 GeoJSON）。

→ 規則：測試指令一律**保留完整輸出**再判讀，不要 `tail` 掉失敗行。
「重跑就好了」在沒看到失敗內容之前不是結論，是猜測。本條未結案，再現時要查。

## 2026-08-10 — 結構稽核 + 多 agent 執行 wave（7 PR，四事件）

背景：4 平行 agent 稽核（報告 `docs/research/architecture-audit-2026-08-10.md`）→ 8 批執行
（6 worktree agent + 2 主樹 agent）→ 整合分支驗衝突 → 7 PR 全 squash merge（#123~#129）。

### 事件 A：雙 lockfile 險斷部署（稽核 agent 只更新了 pnpm-lock）

移除 `@deck.gl/*` 時 agent 依指示跑 `pnpm install --lockfile-only`——但 **Dockerfile 用的是
`npm ci`，權威 lockfile 是 `package-lock.json`**。若照原樣 merge，npm ci 會因 lockfile 與
package.json 不同步直接報錯，**生產建置必炸**。主 agent 驗收時查 Dockerfile 才攔下，
補跑 `npm install --package-lock-only`（+`npm ci --dry-run` 驗證）。
→ 教訓：**改依賴時，先查部署鏈實際用哪份 lockfile**，不是本地慣用哪份。單一 lockfile 政策 → AU-6。

### 事件 B：稽核 agent 的兩個前提錯誤，都在破壞性操作前被 git 現場驗證擋下

1. 稽核稱 `public/geo/schools.geojson`「git 追蹤中需 git rm」→ 實際 `git log --all
   --diff-filter=A` 全史查無：**該路徑從未進 git**（.gitignore:27 一直擋著），是本機孤兒檔，
   `rm` 即可。報告已勘誤（B-4）。
2. 死碼稽核稱 monitor 4 分支為疊層 stack（airport ⊂ registry ⊂ batch1 ⊂ grid-layout）→
   刪除前 `git merge-base --is-ancestor` 逐一驗證：**batch1 ⊄ grid-layout**。
   照原報告刪 batch1 會真丟 commit。實刪 2 支（全包含）、保留 batch1 + grid-layout（G015）。
→ 教訓：agent 稽核聲明（分支包含關係／檔案追蹤狀態）**在破壞性操作前必須 git 指令現場驗證**。

### 事件 C：API 連線不穩，3 次 agent 中斷；SendMessage 原 context 續跑全數復原

架構稽核、死碼稽核、AR-21 各斷一次（stream 停滯 ×1、connection closed ×2）。
都用 SendMessage 從原 transcript 續跑成功，**零重工**。AR-21 斷第二次後改指示
「每完成一個階段就 commit」——斷線不丟進度的正解是把 durability 下放給 agent。

### 事件 D：staticDataContract timeout flake 再現（08-10 早前那條的續集，本次留了完整輸出）

主樹全套測試 `1 failed`：`每個檔案都是非空的 FeatureCollection` **Test timed out in 5000ms**。
當時機器同時跑 dev server + headless 瀏覽器 + 6 個 worktree（I/O 競爭）；單獨重跑 3.2s 全綠、
之後全套 473/473 也綠。→ 確認前條猜測：**資源競爭型逾時，非資料問題**。
基準參考：該測試正常 2.2~2.9s，5s timeout 在高負載下餘裕不足。若再頻繁出現，
解法是對該測試放寬 timeout 而不是砍資產掃描範圍。

## 2026-08-11/12 — Layer Manifest 過夜工程（14 棒 agent，四事件）

背景：AR-22/23/24 一次交付（PR #130，88 commits squash）。全程紀錄
`docs/features/layer-manifest/overnight-log.md`＋changelog 14 棒實錄。

### 事件 A：「快照盲區」冤案與翻案（跨 session 改名的完整劇本）

Phase 2 收官時主樹 cross-repo 測試紅了一筆分支值與 master 手寫值不同的 datasetId，
一度立案「快照護欄有盲區＋批 7 搬移失真」。徹查翻案：**平行 session 當天 commit 了
上游 3 筆 fishery dataset 改名同步（c016f15）**，master 的「原值」其實是改名後的新值；
分支與 fixture 忠實記錄的是 merge-base 舊值——零失真、零盲區。
修復改走 rebase 吸收，fixture 重生 diff 恰 2 值＝47 commits 零擾動的最強證明。
→ 教訓：**「分支 vs master 的值差」先查 master 有沒有平行 commit，再懷疑自己的護欄**；
c016f15 的 commit message 明確留了「該分支需自行 rebase」交接——讀對向 commit 訊息省一小時。

### 事件 B：fall-through 共用 state——「四道閘全攔不住」的靜默失效形狀

P3-2A 發現 `case "a": case "b": return [...]` 共用 state 的 key 若被 per-key spec
搬遷會靜默壞掉（拖 slider paint 不動），且黃金快照（比預設值）／tsc／行為測試／契約
四道閘沒有一道會紅。P3-2B 先建 `sharedGroup` 表達＋專屬閘＋突變自測才續搬。
→ 教訓：**護欄的盲區要用「突變自測」主動探**（改壞一個東西看誰會叫），
不能拿「全綠」當「無恙」。同型：P3-2C 突變實測證明快照對 hook return 第二通道全瞎。

### 事件 C：等值閘突變演練抓到 ref 初始化盲區

P3-2D 突變 (b2)「刪一條 ref 同步賦值」竟全綠——因為測試每次全新 mount，
`useRef(store 現值)` 讓盲區永存。遷移慣例改成「useRef initial 只吃規格常數」後，
同一突變重跑即紅並點名。→ 教訓：**等值測試的 capture 時機會吃掉一整類 bug**，
突變演練要「演到紅為止」，演不紅的突變本身就是發現。

### 事件 D：跨日過夜任務的中斷矩陣（額度×3、休眠×2、連線×3）

14 棒裡 8 次中斷全靠三件套復原零重工：**每子階段先 commit**（durability 下放）＋
SendMessage 原 context 續跑＋overnight-log 落檔交接。caffeinate 擋閒置休眠但
**擋不住闔蓋**（實測踩到）。→ SOP 已定型 PB-38。

## 2026-08-12 晚場 — 收尾棒 session（PR #131，2 技術事件）

**① 背景 agent 連線中斷／stall ×5，SendMessage 續跑全數零重工**：
R3 偵察與三個 opus 實作 agent 共 5 次因「API Connection lost」或「no progress 600s
watchdog」中斷。處置一律 `SendMessage` 給**原 agent**（附「你停在哪一句、接著做什麼」）
→ transcript context 保留、從中斷點續跑，5/5 救回、零重工。教訓同 PB-38 三件套，
本場再驗證：**中斷是常態，續跑機制比重派便宜一個數量級**（Track A 累計 46 萬 tokens
的 context 若重派等於全部重花）。

**② 平行 session 在「push 成功 → pr create」的窗口把主樹切走分支**：
`gh pr create` 突然報「17 uncommitted changes ＋ must first push current branch」——
不是我的錯誤：vessel-watch 平行 session 恰在此刻把主樹從整合分支切到它的新分支。
解法：`gh pr create --head <branch>` 完全不依賴主樹當前狀態。通則：**共用 checkout 的
機器上，任何「依賴當前分支」的指令（gh pr create／git push 無 refspec）都該改用顯式
分支參數**；主樹的當前分支隨時可能不是你的。同場加映：memory／docs 收尾一律走
`git worktree add <path> master`，主樹被佔用照樣能出貨（本場三次實用）。

## 2026-08-13 社福長照接線 — 2 個「不報錯」事件

**① 新開的 worktree 沒有 `.env` → MapView 白屏，錯誤訊息完全指不到根因**

在 `.claude/worktrees/w-welfare` 起 dev server 後，agent-browser 拿到的是空白頁：
`document.body.innerText.length === 0`、`.mapboxgl-canvas` 不存在，console 只有
「An error occurred in the `<MapView>` / `<UserAvatar>` / `<App>` component」這種
React error-boundary 泛用訊息，webgl2 檢查是 `true`（所以不是 SwiftShader 那條老坑）。

根因：`.env` 是 gitignored，**`git worktree add` 不會帶過去**。缺 `VITE_MAPBOX_TOKEN`
→ Mapbox 初始化炸掉。唯一的線索是被 log 淹掉的一行
`[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY`。

對策：**worktree 建好後第一件事是 `cp <主樹>/.env <worktree>/.env`**，
且 vite 要重啟才吃得到（env 是啟動時讀）。已寫進 PB-40 步驟 1。
通則：worktree 缺的一律是 gitignored 的東西——`.env`、`node_modules`、本機快取。

**② 四鐵則 #4（控件不得橫向溢出）首版沒過，而且整套驗證流程正好繞過它**

「定位精度」只有 3 個選項 → `options.length > 3` 不成立 → 渲染成橫向 button row，
~240px 側欄裡每顆約 55px。label 寫「排除概略點」「只看概略點 (98)」→ 三顆全部折行，
連「全部」都被拆成「全」「部」兩行。

為什麼沒被抓到：整場瀏覽器驗證都用**深連結** `?v=1&layers=…` 開圖層（因為 sidebar 的
DOM 互動在本站一向不穩，見本檔既有的 @ref 錯位／playwright hang 兩條），
所以**從頭到尾沒開過 Layers 側欄**。四鐵則裡 #2 有 `layerConsistency` 擋、
#1/#3 由 manifest 派生守，**只有 #4 純靠人眼**——最方便的驗證路徑正好繞開唯一沒護欄的那條。

對策：label 縮到 ≤4 字（`全部`/`排除概略`/`僅概略點`），**`value` 與 `encode` 一字不動**
（否則會改掉篩選語意與 overlayParams 編碼），筆數（98）搬去圖例。
重測 36/54/54 px、高 17 px＝單行。規則進 PRINCIPLES；驗收順序進 PB-40。
