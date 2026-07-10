# Status

**最後更新**：2026-07-10（Batch 1+2+3 即時圖層：急診 / 台灣好行 / 路況 / 停車）
**mini-taiwan-pulse head**：`feat/parking`（stack 鏈 er-hospital→road-congestion→parking；含急診/好行/路況/停車，**未 push**）
**gis-platform head**：`main`（+ migration 283/284/285/286/287/**288** **已 apply production**）
**taipei-gis-analytics head**：`feat/aquaculture-pmtiles`（+ tourist_shuttle 08 + road congestion 06 script）
**data-collectors head**：**+ parking_ref.py collector**（灌 spatial.parking_*_ref，enabled=false 月更手動）

> ⚠️ 另有 `feat/aquaculture-layers`（養殖漁業 3 圖層，commit `7946a59` 本地暫存未 push）平行未 merge。

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
