# Incidents（append-only）

遇到問題並解決後記錄。格式：`## YYYY-MM-DD 標題` → 現象 / 根因 / 對策。

> 只 append，不修改舊條目。長篇紀錄放到 `.claude/pitfalls/` 後這裡附 link。

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
