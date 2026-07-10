# Status

**最後更新**：2026-07-09（養殖漁業 3 圖層接線：逐口魚塭 PMTiles + 生產區/箱網 geojson）
**mini-taiwan-pulse head**：`feat/aquaculture-layers`（base=feat/light-theme；**未 commit、未 push**，用戶指定過夜先不 push）
**taipei-gis-analytics head**：`feat/aquaculture-pmtiles`（base=master；未 commit、未 push）
**gis-platform head**：無變動
**data-collectors head**：無變動

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
