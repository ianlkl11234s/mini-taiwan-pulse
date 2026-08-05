# Status

**最後更新**：2026-08-05（可嵌入地圖 EM 系列上線；**PR #105 + #106 已 merged 並 push**）
**mini-taiwan-pulse**：`master` = `81e8993`（PR #106 merged；前 `d36d787` = PR #105）

> 🔴 **最優先**：EM-21 —— 底圖 `public/base_map/taiwan_basemap.pmtiles`（283 MB）與
> `public/embed-snapshots/` **尚未上 S3**，所以正式站的 `/embed` 目前是壞的（載不到底圖）。
> 跑 `./scripts/deploy/upload-deploy-assets.sh` 即可（三處接線已就緒）。
> 步驟見 `docs/features/embeddable-map/handoff.md` §0。

**前次**：2026-08-03 共機全鏈上線（四 repo 全 merged）—— `b1901fc` / PR #104
**gis-platform**：`main`（PR #46 merged；migration **330~333 皆已 apply production**）
**taipei-gis-analytics**：`master`（PR #33 merged）
**data-collectors**：`main`（PR #42 merged；pla collector 新版 **2026-08-02 已部署 Zeabur**）

> ✅ 上一個 session 的「最優先待辦」已解決：線上 collector 部署後資料**自行修復**、不需回填
> （730 天 0 筆舊版截斷）。⚠️ 驗證是否生效不能看 `updated_at`（只在 INSERT 寫入），
> 要看 `raw_text` 長度 —— INCIDENTS 2026-08-03 事件 A。

## 本 session 完成（2026-08-03~05）— 可嵌入地圖 EM 系列（PR #105 + #106）

**一句話**：一條網址重現畫面（相機／圖層／底圖／日期）+ `/embed` 供文章 iframe 嵌入；
嵌入版走 MapLibre + 自託管 Protomaps 底圖 → **不論被讀幾次都不產生 Mapbox 費用**。

> 📁 **完整脈絡全部在 `docs/features/embeddable-map/`**（README／backlog／changelog／handoff）。
> 下面只留「跨 session 最該先知道」的幾條，細節不雙寫。

- 💰 **最反直覺的一條**：Mapbox 計費 = `Map` 物件初始化 = **文章 PV 數，與圖磚來源無關**
  → 只換 OSM tile **省不到錢**，必須連地圖函式庫一起換成 MapLibre。
  （查不到 Mapbox 明文禁止搭第三方圖磚，走 MapLibre 是為了繞開灰色地帶，不是被禁止）
- **台灣 Protomaps 底圖 z0–15 = 283 MB**（原估 500MB 偏高），中文地名完整到「里」層級；
  落在 `public/base_map/`（已 gitignore）→ 既有 upload/pull/nginx **三處零額外接線**
- **雙引擎共用**：`overlayManager` 只用兩者共有的 8 個 map 方法。型別用**結構介面**不用
  union（union 會讓每個呼叫點 TS2349），PMTiles source 用注入點。主站行為零改動
- **白名單三層**：靜態 145 + 已 CDN 化的動態 7 + 歷史快照 1；**35 個 gated 硬排除**且
  實測「連 byte 都不會下載」
- **順手修掉 master 上會讓整站掛掉的 bug**：`nginx.conf` 的 `location /religion/` 缺閉合括號
  → `nginx -t` emerg，**一 redeploy 容器就起不來**（非本次引入，已 cherry-pick 進 master）
- **發現既有問題（非本功能引入）**：`get_gas_station_layers` 的 loader 已改用 `staticRpc`，
  但 `public/static-rpc/` 沒有該檔 → 主站一直靜默 fallback 打 RPC（EM-17）
- 兩個自己犯的錯，已修並記在 changelog：(a) 用 `timeMode !== "live"` 判斷是否寫日期，
  但 TimeMode 只有 `"replay" | "live"` 且**預設就是 replay** → 每條分享連結都被凍上今天；
  (b) 圖層數量先前用粗略 grep 估算（199/45/32/154），實際是 **189/44/35/145**

## 本 session 完成（2026-08-02/03）— 接手 handoff → 四 repo 全 merged

- **collector 部署止血**（MO-19 收尾）：data-collectors PR #41 merge → Zeabur 自動部署。
  資料自行修復，近 21 天無缺漏
- **向量化通過率 69.9% → 85.4%**（152/178）：三個改進 ——
  (a) 表格項次依類型分流（`table_items.py`，tesseract `-l eng`，表格是中英雙語）；
  (b) **氣球圖徽抑制**（只扣期望數會把「抽太少」換成「抽太多」，兩邊要一起處理）；
  (c) 已知目標數引導重試（把表格數字當**選擇器**而非調參，加品質門檻擋掉湊數字的方案）
- **後端 migration 330~333**（皆 apply production + anon 實測）：
  `spatial.pla_tracks`（348 形狀/164 天）／區間 RPC（疊加＋回放）／嚴重度分級／
  `live.pla_activity_items`（399 項次/178 天，機型）
- **pulse 圖層 `plaActivity`**（PR #104）：10 個註冊點；主題「新聞 News」→「**情勢 Situation**」
  分事件／軍事兩子群；疊加 30/60/90/120 天（舊淡新亮）＋累積回放（只改 Mapbox filter，
  不重打 RPC）＋歷史模式支援
- **Monitor 共機戰情板**（`PlaBoard.tsx`，w5 h15 比照 erCongestion）：嚴重度五級（**雙軸百分位
  ＋共振**）／120 天趨勢／空域方位／侵擾方式四段。`SituationCards` 縮成「公衛 HEALTH BOARD」
- **順手修掉既有 bug**：`useRealEstateTimeline` 缺 `active` guard →
  **整個歷史模式的 ▶ 一直只能前進一格**（火災／人口都中招，非本次引入）
- **排版沙盒 v6** 同步更新（同一 artifact URL）：加 `plaBoard` widget、
  「現況」preset 逐格對齊 repo 的 `MONITOR_LAYOUT`

## 資料本質限制（會限制後續能做什麼，先知道）

1. **通報原文完全不含機型** —— 只在航跡圖表格裡須 OCR，且**多機型項次是合併計數拆不開**
   （399 項次中單一機型僅 205）→ 機型主指標只能用「出現天數」
2. **活動區是依示意圖描繪、非精確航跡** —— 圖層說明／popup／圖例三處標註不得移除
3. **`pla_tracks` / `pla_activity_items` 都只有 2026 年** → 歷史模式僅民國 115 年有東西

## 下一步

1. **PA-1 全量向量化**（2024-08 起 588 天，~20-30 分鐘）—— 跑完歷史模式才有 113/114 年、
   機型才能往前延伸。⚠️ 2025 以前版型未驗證，可能要再調
2. PA-8 兩個解析缺口（演習日 `0600` 硬編碼／「未偵獲共機、艦」漏記 0）—— **owner 已決定先不改**
3. 戰情板後續：PA-5 時間軸標示有資料的日期、PA-6 回放速度/暫停、PA-7 疊加時 popup 取捨
4. 既有：G013 KHH VM SCP、G016 weather_change key 輪替、MC-1~5 微氣候、EQ-1

> 全部後續一律看 `docs/features/pla-activity/backlog.md`（PA-1~PA-8），BACKLOG.md 的 PT-0 不再更新。

---

**前次更新**：2026-08-02（收尾 2026-07-29~31 地震回放 session；3 repo 全 merged）
**mini-taiwan-pulse**：`master` 含地震回放 #98 merge `3498f23`（未 push；後續他 session 共機/monitor commits 疊上）
**gis-platform**：`main` = `fcfffcb`（#45 mig 324 `earthquake_replay_events` merged；RPC 已 apply production 並以 anon 實打驗證 34 列）
**taipei-gis-analytics**：`f935e95`（earthquake-replay handoff 修正**已 push**）
**data-collectors**：地震鏈 collectors 健康零錯誤（本 session 無變更）

## 前次 session（2026-07-29~31）— 地震回放 earthquakeReplay（3 repo 全 merged）

- **pulse PR #98**（merge `3498f23`）：`earthquakeReplay` 圖層——事件清單（34 起，**Tier A 完整五步 / Tier B 測站三步**分層回放）+ scoped 播放器（`earthquakeReplayClock` external store + 自帶 RAF，秒級時鐘不掛全域 timeStore；視覺全是時鐘純函數 → scrub = set 時鐘）；**專案首個行政區 choropleth**（township PMTiles 自建 promoteId source + feature-state，CWA 7 碼→TOWNCODE 8 碼轉換 368/368 逐筆驗證）；沙灘球 strike/dip/rake 自繪 SVG（對 tecdc 官方圖 4/4 方位驗證）；順手補本土 earthquakes click popup（四鐵則現存違規，ripple 圈刻意不做點擊目標）
- **gis-platform PR #45**（mig 324，先 apply prod 後 merge）：`earthquake_replay_events()` 清單 RPC——**resolved key 模式**（town ±5s / grid ±90s 時間窗封裝 DB 端，前端全等值查詢，詳 PRINCIPLES）；EXPLAIN 全 Index Only Scan 2.7ms / 34 列
- **analytics `f935e95`（已 push）**：handoff 修正——town origin_time 1 秒漂移（INCIDENTS 2026-07-31）+ 現況兩起完整四件套 + RPC 契約補記
- **上游查證**（collector 程式碼 + DB 實查）：pipeline 自動累積**已實證**（115053 台東成功零人工、發震後 10~24 分鐘進庫）；上線前事件（115051 雙溪 M5.6）因官方源只留最新快照**永久不可回補**（非深源限制、非 bug）
- 驗收：tsc 0 / 212 tests 綠（layerConsistency + registry ratchet）/ agent-browser 端到端（楠西五步動畫、scrub 定格、popup、dispose 無殘影）；編排三波 8 agents（調查 3 → 獨立模組 2 平行 → 核心 opus 1，共用檔任務串行防互踩）
- 待辦：**EQ-1**（7 項，SSOT `docs/features/earthquake-replay/backlog.md`）

---

**前次更新**：2026-07-31（溫度三部曲 PR #92/#94/#96 全 merged + LST pipeline 上線 + migration 322 + S3 上傳；prod 差一次 redeploy）
**mini-taiwan-pulse head**：`master` = `4e50116`（#96 urbanHeat 疊 #95 市值 `3a55e46`〔他 session〕疊 #94 微感測 `c302f4c` 疊 #92 溫度網格 `8fbcdd7`）
**gis-platform head**：`main` = `eca0b83`（migration 322 site_name，已 apply production + push）
**taipei-gis-analytics head**：`master` = `8b36a19`（LST pipeline + 方法論 + handoff，已 push）；**未 commit 殘留（他 session）**：部署 SOP 12 步治理 5 檔 + street_trees_4epoch `_manifest.json`
**data-collectors head**：不變（G013 KHH VM SCP 仍 open）

> ⚠️ **prod 上線最後一哩**：master + S3（`deploy-assets/environment/urban_heat_lst_taiwan.pmtiles` 30MB 已驗證存在）都就緒，**差一次 Zeabur redeploy**（pull 端 environment/ sync 早已存在）。
> 工作樹既有未提交（他 session，勿動）：AGENTS.md / CLAUDE.md / public/climate/* / docs/git-workflow.md。

## 前次 session（2026-07-29~31）— 溫度三部曲（溫度網格 2D / 微感測三模式 / 都市熱島 LST）

- **PR #92 溫度網格 2D**（`8fbcdd7`）：CWA 0.03° 溫度網格用原生 fill layer 平面呈現（可疊圖），與 3D 溫度波**共用同一組 RPC**（任一層開啟才抓一次）；11 級固定色階移植 weather_change——偵察發現該站資料源頭就是 pulse 既有 `get_temperature_*`，零 pipeline 移植；幾何一次建成 + feature-state 染色 + timeStore lerp 三道節流；四鐵則全接、無白名單豁免
- **PR #94 LASS 微感測三模式**（`c302f4c`）：點位上色 PM2.5/溫度/濕度 select（溫度色階直接 import `temperatureGridTypes`，跨層同源）+ 三套圖例（把 aqiMicroSensors 移出 BASELINE_NO_LEGEND）+ popup 站名（gis-platform migration 322 補 `site_name`，已 apply + push `eca0b83`）。#93 被 GitHub 自動關閉事故 → INCIDENTS 事件 B
- **PR #96 都市熱島 Urban Heat**（`4e50116`）：Landsat 8/9 C2L2 ST_B10、5 path/row 193 景 2019–2025 暖季 median（60m 全島、WorldCover cropland 統一郊區背景、ST_QA per-path/row P75）→ 雙通道值編碼 raster PMTiles 30MB（z6–11@512，R=ΔT/G=絕對°C/A=mask）→ 前端 raster-color 雙模式切換。**mix 係數 ×255 bug 由瀏覽器像素取樣攔下**（INCIDENTS 事件 A）；澎湖上游無資料（圖例已註）；接 #95 後 rebase 解 import 衝突再 merge
- **研究與文件**：LST 方法論教學版落地 analytics（`8b36a19`，含 §8a 坑洞成因 FAQ）+ handoff + pulse feature docs；微感測上游盤點——EPA IoT 端點已遷移 `sta.colife.org.tw` 且實測復活（10,983 點 = LASS 22 倍，→ MC-1）、LASS 死欄位盤清（hcho/model/gps_alt 不做）；魚塭遙測確認早已完整歸檔（4 個待拍板懸案留用戶）
- **編排**：12+ agents（探索 4 / 實作 4 / 瀏覽器驗收 4），三段驗收全程（tsc/tests 獨立重跑 + diff 親審 + browser 像素取樣）；LST POC quicklook 親驗通過才放行全島版
- 待辦：**MC-1~5**（微氣候系列，見 BACKLOG）/ **G016**（weather_change S3 key 輪替）/ prod redeploy（用戶按一下）

---

**前次更新**：2026-07-27（monitor 三部曲 PR #89/#90/#91 全 merged + migration 318-320 apply + yt resolver Data API 重寫部署）
**mini-taiwan-pulse head**：`master` = `015a8b0`（#91 ER 網格+直播牆 疊 #90 靜態網格 `3888014` 疊 #89 修復 `919f695`）+ 本批 memory/docs commits 未 push
**gis-platform head**：`main` + **未 commit：migration 318/319/320（皆已 apply production 在跑）+ 更早的 301**（BACKLOG G014）
**data-collectors head**：`main` = `d8b6f10`（yt resolver Data API v3 + sticky，已部署 Zeabur + YOUTUBE_API_KEY）；`a2f158a`（KHH 端點）已 push 但 **生產 VM 未 SCP**（G013）
**taipei-gis-analytics head**：不變（tourism handoff 回填仍未 commit 待用戶檢視）

> ⚠️ 平行未 merge branch：`feat/tree-layers`、`feat/aquaculture-layers`（不變）；`fix/monitor-airport-card` 已被 #89 完全取代**可刪**；`feat/monitor-grid-layout`（14 commits Monitor v2 RGL）保留待議（G015）。

## 本 session 完成（2026-07-26/27）— monitor 修復→網格改版→ER 深化→直播牆重生

- **PR #89**：monitor 版面雙缺陷修復（sparkline ResizeObserver 動態 viewBox + body row flex 守門 + 88cb2f4 軸域移植）。根因與「修法卡死未合併分支三週」考古見 INCIDENTS 事件 A
- **排版沙盒 Artifact**（https://claude.ai/code/artifact/f5d75312-41b8-4480-9458-e9e2bf98738e）：14 widget 拖拉模擬、匯出相容 RGL；換版流程定型 PB-30
- **PR #90**：MonitorPanel 改靜態 12 欄 grid（`monitorLayout.ts` SSOT、widget 抽離照 46218e5、IndicatorPanel 刪除）+ 佈局 v2-v4 + 三 widget flex 展開 + <1100px 單欄堆疊
- **PR #91**：ER 卡三部曲（59 院北中南東網格 / 全台+分區總集摘要 / 14 天趨勢 migration 319+320）+ sparkline 日界 tick + LiveWall 動態過濾（TTV embedBlocked、channel= 路徑移除、resolver 優先）+ 災防颱風論壇換 ADZTiqEGT8g
- **migration 318**：live.* 48 條 RLS policy 補 authenticated——登入會員半殘站三週修復（INCIDENTS 事件 B + pitfall）
- **yt resolver 重寫**（事件 C）：HTML 爬取 0.3% 成功率 → YouTube Data API v3 + sticky；11/13 台穩定解析、quota ~288 units/日（免費額度 3%）；Zeabur 已接管（22:24 起自主維護）
- **KHH 機場**（事件 D）：ENDPOINTS 補 KHH1/KHH5、一次性回填 1,289 筆；**持續收集卡在 VM 手動 SCP**（G013）
- 驗收模式：全程 orchestrator 分工（sonnet 偵察/機械、opus 複雜實作、主 agent 驗收），三次 agent 自驗漏網由截圖親驗抓回（REFLECTIONS）
- 待辦：G013（VM SCP）/ G014（gis-platform 收納）/ G015（RGL 分支）；OG-5 記於 owner-gated backlog

---

**前次更新**：2026-07-24（觀光 Tourism PR #82 + canopy/giants PR #83 + 收尾 #85/#86 全 merged；G012 部署已上線，prod 4 層實測 206/200）
**mini-taiwan-pulse head**：`master` = `caef2ec`（#83 canopy 高度編碼+giants 疊在 #82 tourism `204459c` 上）+ 本地未 push：`f7156ce` docs 回填 + 本批 memory commits
**gis-platform head**：`main`（+ migration 301 waste 預算表 `0f2b878` 未 push）
**taipei-gis-analytics head**：`master` + 本地 `aa115e2`（canopy pipeline，依用戶決定不推）+ 未 commit：tourism handoff 回填（§6 Infinity 坑 + §8 shipped）與 `08_pulse_export.py` isfinite 守門，待用戶檢視
**data-collectors head**：不變（parking_ref.py collector，enabled=false 月更手動）

> ⚠️ 平行未 merge branch：`feat/tree-layers`（7/7 PASS 未 push）、`feat/aquaculture-layers`（`7946a59` 未 push）。
> ✅ 部署（BACKLOG G012 已解）：tourism D 類 3 檔 + canopy rgb pmtiles 已上 S3 + Zeabur redeploy pull → prod 4 層實測 206/200 上線。

## 本 session 完成（2026-07-23/24）— 觀光 Tourism 12 圖層（新主題分組，已 merged）

- 依上游 `taipei-gis-analytics/docs/handoff/tourism-layers.md` §0.5 開工清單完成：新主題「觀光 Tourism」四子群 + 12 靜態圖層（景點/溫泉露頭點+面/國家風景區/文化資產/宗教百景/活動/工廠/遊樂園/露營/旅宿/餐飲，31,333 features）
- 亮點：tourAttractions 分類/熱度雙模式（`annual_visitors_2024` log10、**null=灰「無統計」非 0**）；tourHotels 四類原生 select + 全 zoom 常駐（原 minzoom 9 依 7/24 用戶回饋移除，低 zoom 1.2px 點雲 + glow z8→9.5 淡入）；tourEvents 三態篩選（ISO 時間戳 → `["slice",…,0,10]` 日期比較，today 用 sv-SE **不** replace 斜線，與 cultureTodayStr 不同）
- 部署：9 檔 C 類 git `public/tourism/`；3 檔 D 類（attractions/hotels/restaurants）五處 SOP 接好（docker-compose 既有技術債跳過）——**S3 上傳待拍板**（TO-2）
- 踩坑：上游快照 `"yoy_pct":Infinity`（除零）→ 瀏覽器 JSON.parse 整檔失敗、圖層 0 點（Python json 接受非標準 literal 所以上游驗不到）。已 patch 兩份快照 + 上游 `08_pulse_export.py` 加 `math.isfinite` + `allow_nan=False`；handoff §6 已回填
- 驗收：tsc 0 error / 197 tests 綠 / agent-browser 12/12 PASS（含 hotels 類別篩選 691→21、events 三態 593/108/134、attractions popup 遊客人次格式）
- 上線：PR #82 squash `204459c`（tourism 12 層 + 旅宿全 zoom 常駐修正同 PR）；另一 session 的 canopy v2 + canopyGiants 以 PR #83 `caef2ec` 疊上。tourism branch（local+remote）經 `git diff origin/master <branch>` 驗零獨有內容後已刪
- 平行 session 事故與解法（canopy commit 落錯 branch → scratch worktree 組乾淨血統 push sha 開 PR）：見 INCIDENTS 2026-07-23/24 + PRINCIPLES「共用 worktree 紀律」+ PB-29
- 待辦：TO-3~TO-5 見 `docs/features/tourism-layers/backlog.md`；analytics 端修改未 commit 待用戶檢視（G012 部署已完成上線）

---

**前次更新**：2026-07-22（建物夜景燈光 + bloom PR #78 / timeline 修正 PR #79 / changelog PR #80，三 PR 全 merged，未 push memory 除外）
**mini-taiwan-pulse head**：`master` = `e8f915e`（建物夜景燈光 mode 3 + 高樓 bloom、timeline setState-in-render 修正已上線；前批公共設施 8 圖層 PR #74 `8682d57`）
**gis-platform head**：`main`（+ migration 283/284/285/286/287/**288** **已 apply production**）
**taipei-gis-analytics head**：`master`（+ **docs/handoff/public-facilities.md 回填 + _status.md 勾 pulse 項，未 commit 待用戶檢視**）
**data-collectors head**：**+ parking_ref.py collector**（灌 spatial.parking_*_ref，enabled=false 月更手動）

> ⚠️ 平行未 merge branch：`feat/tree-layers`（7 樹木圖層 7/7 PASS 未 push）、`feat/aquaculture-layers`（養殖漁業 3 圖層 `7946a59` 未 push）。

## 本 session 完成（2026-07-22）— 建物夜景燈光 + bloom + timeline 修正

3 PR 全 squash merged 進 master（head `e8f915e`），memory 尚未 push。

### 建物夜景燈光（PR #78 `ffff9ca`，feature `docs/features/buildings-night-lights/`）
- `buildingsGba` 加第 4 個顯示模式「夜景燈光」：純 Mapbox fill，暖橘/白雙 6 段色階依 `height` 由暗轉亮 + `round(height*10)%3` pseudo-random 交錯（約 1/3 白光），深底模擬城市夜空。全量 152 萬棟、零效能風險、無資料契約變更。
- 高樓 bloom 疊層 `buildings-night-bloom-3d`（新 CustomLayer + hook）：夜景模式時 `querySourceFeatures` 取視野內 `height≥門檻`（slider 40–200m 預設 100）、去重、取最高前 4096 棟 → 復用 `GlowPointsScene`（additive 光暈、zoom 自適應）。實測信義區 ≥100m 取出 12 棟真摩天樓。
- ⚠️ 勿與發電廠/變電所 Bloom 測試同開（一 gl context 只能一個 render 中 Three Scene）。browser 驗 z12/z14 橘白光海 PASS；tsc / 197 tests 綠。

### timeline setState-in-render 修正（PR #79 `e2cb2cb`）
- `useTimeline` render body 的 `timeStore.setTime` init 搬進掛載 effect，修 React「update App while rendering App」警告。全專案稽核（8 store + 535 setState）確認孤例 → 新 PRINCIPLE + INCIDENTS 2026-07-22。

### 其他
- changelog 回填（PR #80 `e8f915e`）。
- `get_waste_schedule_day` pre-aggregate **已上線**：gis-platform migration 301（`0f2b878`，未 push）— 48s → **<1s**（7 dow 預算表 `spatial.waste_schedule_day_agg` + per-dow refresh + 薄 RPC），anon REST 驗 0.5s → 垃圾車表定圖層恢復（BL-24 done）。

## 本 session 完成（2026-07-17）— 公共設施 8 圖層批次（civic-facilities）

Fable 5 總指揮（規格核對→循序 worker 分批→gate 驗收），worker 皆 Opus、docs 走 Sonnet。上游 civic_facilities 主題 8 dataset 快照已先 commit（`bd41d02`+`e69a88c`），本 session 純前端接線。branch `feat/civic-facilities-layers`，feature 文件 `docs/features/civic-facilities-layers/`。

### 8 個新圖層（基礎建設 > 公共設施子群，全靜態 geojson、全預設關）
- postOffices 郵局 1,278（#d32f2f，popup 4 服務旗標）/ iPostBoxes 2,345（#ef6c00）/ communityCenters 1,794（#26a69a，**label 標「部分縣市」**，8 縣市）/ govServiceOffices 702（**type 3 分色+圖例**：公所/戶政/地政）/ publicLibraries 634（#5c6bc0）/ welfareCenters 157（#ec407a，popup 標「資料時點 2023-04」）/ retailMarkets 731（#66bb6a）/ publicToilets 13,281（**minzoom 11 zoom-gate 照 fireHydrants 前例 + grade 4 級分色+圖例**）
- 每層 ~14 接觸點（types×3/layerCatalog/IconRail/overlayRegistry glow+circle/params opacity+scale 雙 slider 照 medHospital 機制/popup infraPanels/upstreamRegistry/chat datasets/layerConsistency baseline）
- deployContract 補 3 個 public 子目錄契約：`civic_facilities/`、`environment/`、`poi/`（nginx.conf + pull-deploy-assets.sh）；順手修 layerCatalog 檔頭註解 14→22 主題（PR #72 漏更）
- Commits：`7e16edd`（批次1）/ `6e7f02e`（批次2）/ `cfae91e`（feature 文件）；tsc 0 錯 / 190 tests 全綠 / agent-browser 逐層 **8/8 PASS**（公廁 zoom-gate z9→0 點 z12→2,566 點實證）
- 上游回填（**未 commit，待用戶檢視**）：public-facilities.md 狀態欄+§2.5-2.8 四層欄位契約+community_centers 592→**1,794/8 縣市**修正+§6 下游採用表；_status.md 勾 pulse 接線項
- 編排再驗證 tree-layers 心得：共用檔為主 → 循序 worker（每批唯一寫檔者）+ 批間 gate（主 agent 重跑 tsc/test）零衝突
- 待辦：CF-2 圖書館與文化設施 typeId=K 去重（上游未實作）、CF-3 公廁 pulse 4 欄擴充（上游 07_export.py pulse_props_keys）、CF-4 社福資料 2023-04 舊、CF-5 i郵箱 payment_method 部分空

## 本 session 完成（2026-07-15）— 都市樹木圖層批次（7 層，autonomous 06:10 排程）

用戶睡前設定 06:10 chain loop 排程，指定 Fable 5 當總指揮（解讀規格→分派 subagent→調節共用檔衝突→驗收）。規格書：`taipei-gis-analytics/docs/topic-research/street_tree_removal/tree-layers-prompt.md`（8 層，#2 diff 已上線跳過）。branch `feat/tree-layers`，feature 文件 `docs/features/tree-layers/`。

### 7 個新圖層（都市開放空間 ×6 + 林業分區 ×1，全預設關）
- **Batch A geojson**：protectedTreesNational（6,544，樹齡 5 級+城市模式，半徑∝dbh）/ riversideTreesTaipei（10,917，樹種 top-10，30 河濱公園篩選）/ parksTaipei（2,917，category 7 類，半徑∝面積 log）
- **Batch B**：streetTreesTaipei3epoch（105,675，PMTiles z5-14，traj 7 色 4 染色模式，popup 三格軌跡 badge）/ canopyHeight（**raster PNG PMTiles** z7-12，mapbox-pmtiles 原生支援 raster，overlayManager 只改 sourceLayer optional）
- **Batch C**（tippecanoe 新轉檔）：streetTreesNational（210,436 全國台北+台中，z5-11 1MB/磚 cap 抽稀、z13+ 全量；城市篩選+4 染色模式）/ treePitsTaipei（56,720 面 z11-16 無損，樹穴綠/花圃黃）
- 新增 `src/data/urbanOpenSpaceTypes.ts` 色票 SSOT；胸徑/樹高分級照抄 streetTreeColors 跨層可比
- **接線接觸點實測 11 處**（第 11 處：`upstreamRegistry.ts` exhaustive Record，tsc 強制）
- 驗收：tsc 0 錯 / 190 tests 全綠 / agent-browser 逐層 7/7 PASS（All Off 後單層開、popup/圖例/controls/篩選全驗、台中點位實證、canopy raster 206）
- **編排心得**：PMTiles/geojson 層無 loader/hook（全走 overlayRegistry），共用檔為主 → subagent 平行寫檔必衝突，改「循序 worker（每批唯一寫檔者）+ 主 agent 批間 gate 驗收」
- 待辦：TL-1 S3 deploy-assets 上傳 7 資料檔（>2MB 不進 git）、TL-2 上游 data-catalog 補條目、上游 handoff `tree-layers.md` 已寫未 commit（在 analytics repo，避免污染其 aquaculture branch，待用戶拍板）
- 非阻擋觀察：城市篩選 opacity 歸零法理論上隱形點仍可點擊（沿用既有慣例）。canopy 256px 略軟（TL-4）→ PR #83 改 512px 高度編碼磚已解

## 本 session 完成（2026-07-10）— Batch 3 停車（hybrid v1，接 Batch 2 後）

用戶「繼續」→ 做 Batch 3 = ③ 停車。PK1 驗證 TDX 座標覆蓋率**有大坑**（即時表無座標，靜態 join 覆蓋率城市差異大）→ 用戶拍板 **hybrid v1**。branch `feat/parking`。feature 文件 `docs/features/parking/`。

### 停車 parkingOnstreet + parkingOffstreet（交通 §停車 Parking）
- **關鍵前置**：即時可用性表無座標 → 新建靜態座標 collector（data-collectors `parking_ref.py`）灌 `spatial.parking_segments_ref` / `parking_lots_ref`（migration 286）；前端走 SECURITY DEFINER join RPC（287：get_parking_segments_current / get_parking_lots_current）。
- **hybrid v1 範疇**：路邊台北 2347 POLYGON 填色（availability_rate=null → 中性色僅容量）+ 新北 553/台中 184 點（空位率）；場外 2083 點（city/tourism/freeway，空位率綠→紅 + 大小隨 total）。availability_rate guard 台北 -1。
- phase-2 缺口：台北場外(10%)/基隆場外(0%)/新北台中路邊(半覆蓋、無幾何)。需各府自家開放資料補。
- 統一「服務可得性」色軸（綠=空位多/紅=滿，比照 youbike）。**timeline 回放已補**（2026-07-11，migration 288 + 前端雙模式：Live `_current` / Replay 96 槽 `_day`）。
- 驗收 tsc 0 / test 190 / browser 主 agent 親驗（雙北+全台空位率點染色截圖 + 台北 polygon 中性 fiber 實證）。
- 待辦：phase-2 覆蓋補洞、timeline 回放、collector 月更排程（現手動）。

## 本 session 完成（2026-07-10）— Batch 2 路況省道（road_congestion，接 Batch 1 後）

用戶「繼續處理，晚點一起驗收」→ 做 Batch 2 = ② 路況（v1 省道 highway）。branch `feat/road-congestion`（stack 於 er-hospital）。feature 文件 `docs/features/road-congestion/`。

### 路況 road_congestion（即時監控 §，key `roadCongestion`，v1 highway）
- **全站首個 PMTiles feature-state 染色**：幾何走 PMTiles（不隨 RPC），前端 `setFeatureState`（promoteId=section_uid）。省道路段依即時 congestion level 綠→紅染色。
- 上游 migration 285：**288 字元編碼** pre-aggregate（每段一列，每字元一 5min 槽，'1'-'4'=level '-'=無資料）+ refresh + cron :00/:15/:30/:45 + get_road_congestion_day/_dates。payload **2.1MB raw**（vs 裸抄 freeway 43MB）；refresh 23 秒未 OOM；backfill 7 天。
- PMTiles `road_congestion_highway.pmtiles`（2.65MB，6818 段，走 S3 deploy-assets/road/，taipei-gis 06 script）。
- 前端：loader 288 解碼 + hook feature-state diff 染色 + hit 層 popup（section_id + 當前等級）+ 4 級圖例 + opacity/width slider。
- 驗收 tsc 0 / test 190 / browser 主 agent 親驗（彰化省道四色染色截圖 + promoteId round-trip 實證）。
- **⚠ 取捨（待用戶拍板）**：pre-aggregate refresh 落後當下 ~15-18 分鐘 → 前端 clamp 到「最新可得快照」（對齊 freeway snap-back，離線路段仍灰）。若要嚴格精確 slot 拿掉 clamp。
- 待辦 v2：市區 city 5 縣市（台中幾何過粗）、速度欄位 popup、精確 slot 選項。

### ⚠ cron 盤點（已排定，未來新增避開）
bus refresh `:02/:17/:32/:47` · intercity `:07/:22/:37/:52` · 好行 `:12/:27/:42/:57` · **路況 `:00/:15/:30/:45`**。cleanup：bus 03:02 / intercity 03:07 / 好行 03:12 / 路況 03:15。→ 下一個 pre-aggregate 圖層再找未占分鐘。

## 本 session 完成（2026-07-10）— Batch 1 即時資料補接（急診 + 台灣好行）

起手：用戶問「data-collectors 有哪些即時資料還沒接進應用」→ 盤點出 10 個未接 collector（供給側 `cross_layer_map.yaml` × 需求側前端 grep）。用戶確認 5 個都在持續收集（psql 實測時間戳），選定接 4 組；Fable 5 顧問排序後啟動 **Batch 1 = 急診 + 台灣好行**。完整計畫 `docs/proposal/realtime-backlog-layers-plan.md`；feature 文件 `docs/features/{er-hospital,tourist-shuttle}/`。

### 急診 er_hospital（醫療 §即時 Emergency，key `erHospital`）
- 上游 migration 283（`get_er_hospital_latest` / `get_er_hospital_24h`，apply production，免 pre-aggregate）。
- circle 層點色 5 級壅塞（wait_general 主軸，37 天 history 校準：綠≤15/黃16-31/橙32-49/紅>49，icu>0 白 ring）。
- 座標 join `medical_hospitals.geojson`（57/59 + 2 override）。popup 24h 折線 + Monitor `ERCard`（選區 select + top-6 tab + sparkline）。
- 驗收 tsc 0 / test 190 / browser 主 agent 親驗截圖（popup 林口長庚 + Monitor）。

### 台灣好行 tourist_shuttle（交通 §即時運具，key `touristShuttleLive`）
- 上游 migration 284（current + `tourist_shuttle_trails_daily` 預聚合 + cron + retention 30 天）。backfill 7 天。
- 前端抄 intercity，`BusEngine`/`BusScene` 零改動重用，progress-based 沿路線 3D orb。
- route JSON `public/bus/tourist_shuttle_routes.json`（147 entries，**100% 命中**，taipei-gis `08_build_tourist_shuttle_routes.py` 過濾 bus shapes）。
- 驗收 tsc 0 / test 190 / browser 親驗（日月潭沿路線 137 台 replay + LIVE 564 台 fresh-server 實測 poll 200）。live-poll「0 台」曾誤報 → 查明是 dev server 掛掉的 HMR stale 假象（非 bug）。

### ⚠ cron 盤點（未來 ② 路況必避開）
已占用分鐘：bus refresh `:02/:17/:32/:47` · intercity `:07/:22/:37/:52` · **好行 `:12/:27/:42/:57`**。cleanup：bus 03:02 / intercity 03:07 / 好行 03:12。→ **② 路況 refresh 排 `:00/:15/:30/:45` 等未占分鐘、cleanup 03:15+**。

### 待決 / 待辦（給用戶）
- **未 commit**：3 repo（mini-taiwan-pulse `feat/er-hospital` 兩 layer 交織 / gis-platform 283+284 / taipei-gis 08 script）待用戶授權 commit。route JSON 6.73MB 進 git or S3 待定。兩 layer 同 branch → 建議 Batch 1 走一個 PR（共用檔無法乾淨拆）。
- backlog：距離 gate v2 / sub_route 級幾何 v2 / upstreamRegistry 急診升 verified（補上游 catalog 條目）/ inform Y/N 語意證實。
- **Batch 2/3 未做**：② 路況（288 字元編碼 + PMTiles feature-state，最重工程）、③ 停車（先補靜態座標 collector）。

## 本 session 完成（2026-07-09）— 養殖漁業圖層上架（過夜自動執行 + 主 agent 驗收）

起手：用戶要整理 taipei-gis-analytics 養殖漁業資料 + 確認怎麼把「撈出來的魚塭」接成 layer。發現上游資料早已整理好（SSOT `docs/topic-research/fishery/_status.md`）；「魚塭」= `aquaculture_ponds_osm`（OSM 逐口魚塭 15,241 面，7/08 剛 ingest、當時未 commit 躺 master）。

### 決策（用戶拍板）
- 接 3 層：逐口魚塭（PMTiles）+ 養殖漁業生產區（geojson 62）+ 海上箱網（geojson 42）。放養量 G70 未接。
- 魚塭走 PMTiles 重出（15k 面 6.6MB geojson 太重 → 3.1MB pmtiles）；生產區/箱網量小維持 geojson。
- 公開，不 owner-gated（OSM ODbL + 政府開放資料）。

### 執行（主 agent orchestrate + delegate + 逐階段驗收；契約鎖死後上下游平行）
- **上游**（feat/aquaculture-pmtiles）：加 `pipelines/fishery/aquaculture_ponds_osm/03_pmtiles.py`（tippecanoe -Z5 -z14 + keep_attrs 5 欄 + `-l aquaculture_ponds_osm`），出 3.1MB pmtiles → 複製前端 public/fishery/。
- **下游**（feat/aquaculture-layers）：接線 10 檔（types / overlayRegistry / useMapInteraction / fisheryPanels(新) / registry / useTransportParams / LegendPanel / layerCatalog 新分組 / IconRailSidebar / upstreamRegistry）+ 部署契約 3 檔（nginx.conf + pull/upload-deploy-assets.sh 補 fishery 子前綴，含 fire catch-all `--exclude "fishery/*"`）。
- 新分組「養殖漁業 Aquaculture」掛農業主題；四鐵則齊（opacity slider / legend / popup / dropdown-N/A）。範本：ponds 抄 courtJurisdiction(PMTiles fill)、zone/cageNet 抄 livestockFeed(geojson 靜態)。

### 驗收（工具佐證，主 agent 親驗）
- `npx tsc -b` exit 0；`pnpm test` 190/190（deployContract fishery 契約由紅轉綠 + layerConsistency 圖例）。
- Browser（本地 dev z12 雲嘉南沿海）：ponds 2400 面（青 #26c6da）、zone 28 面（綠 #66bb6a）、cageNet 澎湖 41 面（靛 #5c6bc0）；popup 點魚塭跳面板（面積 1.08 ha）；console 0 error；pmtiles HEAD 200 / Range 206 magic `PMTiles`。**主 agent 親眼看兩張截圖確認**。

### 待決 / 未竟（給用戶）
- **部署方式待定**：3.1MB pmtiles 要 git commit 進版控、還是 gitignore + 跑 upload-deploy-assets.sh 上 S3（deploy 腳本已備 S3 fishery 路徑）。
- **未 commit、未 push**；PR 待開。上游魚塭 ingest（用戶 7/08 的工作）仍未 commit，一併留給用戶。
- backlog：popup footer「(Tier ?)」（養殖資料缺 source_org/tier）、魚塭屬性稀疏（多數 produce/name 空、非 bug）、放養量 G70 / 牡蠣養殖區未接。
- feature 文件：`docs/features/aquaculture/` + 上游 `docs/handoff/aquaculture.md`。

## 本 session 完成（2026-07-07）— 接手他人 session 續作

起手：用戶要把畜牧/污染等私有圖層「鎖起來不讓外部取得」、結合會員系統、做管理後台。從另一帳號的中斷 session（`~/.claude-work/.../c4d972ee`）讀 transcript 接續。

### A. 資料真鎖（Phase 1，前端 #60 + gis #28 migration 275）
- 34 層（畜牧 8 / 石化油氣 10 / 電網 6 / 電廠 9 + aviationGlow）從「前端假鎖」升級：22+ 支 RPC 改 SECURITY DEFINER + owner 守門、19 張表 REVOKE anon。
- **關鍵洞察**：光下架 CDN 鎖不住（anon key 公開 + staticRpc 404 fallback 打真 RPC）→ 真斷源在 DB REVOKE。
- 加油站是公開資料 → 拆出公開 `get_gas_station_layers`（不鎖）。排除：灌排渠道 / 電桿（用戶指定）。
- 前端：gated 旗標 + 單色鎖頭雙 sidebar + 非 owner 擋 toggle；石化/電網/電廠 loader 改直連 RPC；畜牧改 owner-only RPC 動態載入；deploy 腳本斷源（S3 不刪、只斷供應）。

### B. 分層治理後台（Phase 2，migration 276）
- 分層 tier（free<member<insider<owner）+ 3 治理表（gated_layers/dataset_freshness/access_audit_log）+ enforce_layer_access 守門 + 6 admin RPC + 公開 get_layer_gates。
- 站內 owner-only 後台四分頁（會員/tier、稽核、圖層鎖定、資料新鮮度）。動態 gating（DB SSOT，fail-safe 維持鎖定）。

### C. lock_type 分型（Phase 3，前端 #62 + gis #30 migration 278）
- gated_layers 加 lock_type（ui/full）。純宣告、不動 grant（防誤公開）。34 層全 full（乾淨鎖）。

### D. 安全審計 + 洩漏修補（migration 277/279）
- 上線後派獨立安全審計 agent 全掃 → ✅ 畜牧/石化/電網/PostgREST schema 繞道/git 歷史/CDN/防提權全守住。
- 🔴 掃出電廠 `public` schema 漏鎖（all_power_plants_v 等 4 個 anon 可讀）→ migration 279 REVOKE。
- 🐛 read-only tx regression（STABLE func + audit INSERT → 25006）→ migration 277 改 VOLATILE。詳 INCIDENTS 2026-07-07。
- denied 稽核落地限制：RAISE 令表 INSERT rollback → 改 RAISE LOG 寫 server log（app 表只留 granted）。

### E. 文件（PR #63）
- docs/features/owner-gated-layers/README 補 Phase 3 + 安全模型（三道防線）+ 2026-07-07 審計紀錄。

### 協作 / 工作區
- 主 agent 定契約 + delegate（DB 查核 / 前端 gating / migration / 安全審計 / lock_type）。用 worktree 隔離把混合工作區拆成各自乾淨 PR（PB-28），全程零觸碰用戶其他 WIP。

## 待辦
- **OG-1**（P2）：anon key 濫用防護 / Supabase Spend Cap（機密已鎖，殘餘僅額度濫用）— 用戶之後處理
- **OG-2~4**（P3）：freshness 後台編輯 / UI 鎖首個實際圖層驗收 / powerPlants owner 存取
- 前 session 遺留：BC-2/4a/4b、AR-11e/12~16、SC-1、GC/SAT/NE/MO 系列
- ⚠️ **工作區有用戶並行 WIP（本 session 未碰）**：淺色底圖主題化（App/DataSourceBrowser/IconRailSidebar + 全 featureInfo panels + 新 featureTheme.tsx）+ 會員規劃 docs（member-features-plan.md 等）

---

_本 session memory commits_：INCIDENTS / PRINCIPLES / PLAYBOOKS PB-28 / REFLECTIONS / GLOSSARY / BACKLOG（OG 系列）+ 本檔
