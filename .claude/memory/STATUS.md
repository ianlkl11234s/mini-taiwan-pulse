# Status

**最後更新**：2026-10-06（資料面盤點、倉庫覆蓋率 +18 層、collector 健康調查、v2.6.0 發布、Agent 題庫第二輪、repo 清理）

> 本檔只放這次碰到的範圍、上線狀態、卡點和下一步。完整計畫與數字看 [`PLAN-prod-connect-20261003.md`](../../docs/features/general-analysis/PLAN-prod-connect-20261003.md)，契約看 [`SPEC-prod-connect-p1-p3.md`](../../docs/features/general-analysis/SPEC-prod-connect-p1-p3.md)，操作看 [`PROD-HOME.md`](../../docs/features/general-analysis/PROD-HOME.md)，決策看 ADR-0017。

## 2026-10-05～06：資料面盤點與 v2.6.0

### 範圍與上線

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | #539（GD-1、AU-3 契約測試）、#540（倉庫覆蓋率 L2 795／982）、#541（OSRM token 遮蔽、AU-1 結案改列 DS-COLOR）、#542（圖層新鮮度總表 `build-layer-freshness.mjs`）、#543（R5-1／R5-2／R8-2／AG-6／G005）、#544（BACKLOG 健檢）已合併；**v2.6.0** 已發布（#545／#546，tag 打在 master `65c90691`），正式站 main-*.js 顯示 2.6.0。 |
| **mini-pulse-gis-mcp** | #45（入倉支援 gzip／純屬性表）、#46（題庫第二輪：58/60、提醒 10/10）、#47（評估工具重置修正：台／臺、COMMAND_PENDING、鏡頭歸位）、#48（reset-cmd 用 `--session`）已合併；analysis-prod/mcp 在 `ad85eb2`。 |
| **R2 倉庫** | latest `20261005T051814Z`（+14 資料集；前一版 `20261004T145742Z`）。 |
| **gis-data-collectors** | #126（TD-1：時刻表 240 分鐘＋degraded fallback；調查報告）、#127（GD-2：只對 `ncdr_alerts` 擋西里爾亂碼）、#128（OSRM token 改讀 env）已合併並部署。 |
| **taipei-gis-analytics** | #141（9 份 manifest 補入倉 provenance）、#142（OSRM token 改讀 env）。 |
| **gis-platform** | #138（孤兒 RPC 審查：87 支候選、DROP_SAFE 15 支草稿未執行）。 |
| **gis-agent-system** | #2（`scripts/gen_repo_hygiene.py` 盤點腳本＋`ecosystem/REPO_HYGIENE.md`）；ADR-0018 草稿（資料新鮮度自動更新，另一 session 討論中，未 commit）。 |
| **基礎設施** | osrm-proxy token 已換（舊值 401）；本機清掉 42 個 worktree、57 個已合併分支，備份在 `GIS/_worktree-backups/2026-10-06/`。 |

接地圖 Agent 評估（分層題庫 13 題 × 2）：25/26；唯一失敗是題庫台／臺（已由 MCP #47 修）。

### 卡點與下一步（皆在 BACKLOG）

- 待拍板：FE-01（建議結案）、WA-4 DROP_SAFE 15 支（先開 `track_functions` 觀察一週）、DIO-1（10-01 18:14 UTC 重啟原因，需 Supabase dashboard）、DIO-2（公車軌跡 refresh 增量化，約省 15 GB/天）、TD-1 回填；ADR-0018（資料新鮮度自動更新）三題在另一個 repo 的草稿討論中（見上表 gis-agent-system 列），尚未進 BACKLOG，定案後再開條目。
- 未驗：R5-2 汙染裁處預設年份未做瀏覽器目視。
- 清理報告跳過 26 個 worktree（13 未合併、4 有改動）待逐個判斷。

---

## 前一輪：Agent／MCP 正式站連線（2026-10-04）

### 範圍

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | #506（面板站主可見、nginx 轉 gateway）、#512（AG-1＋P1–P3）、#517（自繪圖層摘要＋SCENE_ERROR 修正）、#519（map_context 等資料、aqi isStyleReady）、#522（帶 Z 座標的面結果能上圖）、#515／#520／#521／#525（文件與記憶）已合併並部署。 |
| **gis-platform** | #136（zbpack 啟動）、#137（結果通道、長輪詢、agent token、清掉配對碼）已合併；Zeabur 服務 `research-gateway` 以 `zeabur deploy` 部署（不綁 GitHub）。 |
| **mini-pulse-gis-mcp** | #35（P1–P3＋AG-1）、#37／#38（摘要讀法）、#39（e2e 腳本）、#40／#41／#42（周邊類別、交通 fallback、嚴格欄位檢查）、#43（CSV 不再靜默丟列＋公車首末班配方）、#44（find_data 先多看再砍）已合併；analysis-prod/mcp 在 d6c1c01d。 |
| **taipei-gis-analytics** | #138、#139（公車 manifest 去重＋四份無幾何班表資料集）已合併。 |
| **R2 倉庫** | 版本以 R2 `latest.json` 為準（2026-10-06 時為 `20261006T060540Z`，減害／成癮入倉；之後會再重建）；回退鏈見 general-analysis STATUS。 |
| **本機** | analysis-prod 三個 worktree 已切到最新；8794 改測試身分（`PULSE_RESEARCH_TEST_IDENTITY`），3734 `.env.local` 改 `VITE_RESEARCH_TEST_IDENTITY=1`。Claude／Codex 的 pulse-research 預設連正式站。 |

### 上線狀態

| 上線項目 | build | contract/wire | stage | deploy | HTTP | browser |
|---|---|---|---|---|---|---|
| gateway（Zeabur） | done：100 tests | done：本機 e2e 13 項 | done：#137 | done：12:36Z pod 啟動 | done：新端點未登入 401、`/pairings/claim` 404 | not run：需使用者 token |
| mini 正式站 | done：CI 綠 | done | done：#512／#517／#519 | done | done：上傳路徑放行 2 MB、一般路徑 100 KB 413 | not run：需使用者 token |
| MCP（analysis-prod） | done：524 tests | done | done：#35／#37／#38 | done：已 build | N/A | done：本機 live-map 分層題庫 13/13 |

### 數字（本機無頭瀏覽器，改版前 → 後）

set_camera 4.6 → 1.7 s；set_layers 1.6 → 0.16 s；map_context 88 → 13 ms；token 接上 55 ms；重整還原 5.5 s；18 MiB 上傳 151 ms。正式站改版前（P0）：set_camera 4.7 s、map_context 0.96 s、set_layers 4.8 s；網路經 Cloudflare 新加坡，ping 150 ms。

### 正式站量測（2026-10-04，`e2e-prod-connect.mjs prod`）

| 動作 | 改版前（P0） | 改版後 |
|---|---|---|
| 接上分頁 | 手動配對 12.5 s | 0.93 s（免碼） |
| set_camera | 4.7 s | 1.8 s（6/6 ready） |
| set_layers | 4.8 s | 0.87 s |
| map_context | 0.96 s | 0.45 s（含 AG-1 摘要） |
| show_nearby 上圖 | 不可用 | p50 5.8 s |

重整還原與撤銷尚未在正式站實測（需使用者手動）。

### 監看模式改版（2026-10-03～04，另一條工作線）

- P1–P5 全部合併（mini #482–#505、#507 backlog、#508 文件）；gis-platform #135／migration 425 已用 psql 套正式庫並查證（`aggregated_at` 有回傳、權限不變）。
- 上線：mini 前端合併後**正式站部署與瀏覽器未驗**（只在本機 3750 驗過 1920／1496／1280 與淡色底圖）。
- 擱置：P6 四領域子指數（BACKLOG MON-P6，需使用者定權重與基準期＋migration）、直播牆換台（LW-1）。
- 下次入口：確認正式站已含 #505，用工具列「底圖」切淡色看監看新版；新聞四格時間應為彙整時間。

### 設計系統／圖層面板（平行工作線，2026-10-02～04）

| repo | 現況 |
|---|---|
| **mini-taiwan-pulse** | 已合併：效能 #480／#481、R5 密集點熱區 #498、提案 #504、R8 面板統一 A #509／B #511／C #513、R7 熱區與網格配色 #510、統計與世界大分類 #514、收尾修正 #516、backlog #518；收尾文件與活的元件頁見本次 wrap-up PR。 |
| **mini-pulse-gis-mcp** | #34（palette 控制項說明）、#36（linkedSelect 說明）已合併。 |
| **本機** | analysis-prod mini／mcp 已切最新並 build；pulse-research 需使用者 `/mcp` 重連才吃到新控制項說明。 |

| 上線項目 | build | contract/wire | stage | deploy | HTTP | browser |
|---|---|---|---|---|---|---|
| R5／R7／R8 前端 | done：每支 PR 全套測試＋CI 綠 | done：palette／linkedSelect 6 接點＋MCP 說明 | done：merged | unknown：本 session 未查正式站部署 | not run | done：本機 dev（各段對照頁在 `docs/features/layer-color-picker/`、`docs/features/layer-panel-unify/`） |

設計系統進度以 `docs/design-system/README.md`「目前進度」為準：R1–R5、R7、R8 完成，只剩 R6（Three.js／Mapbox 切換，待使用者決定範圍）。

### 衛星情報面板改版（2026-10-04，另一條工作線）

- 盤點 → P1 比較頁 → P2–P5 一頁比較頁（可複製答案）→ 實作：P-D 資料狀態＋P1–P5 全部合併在 #533（develop `a7864dbb`，CI 綠）。決策與代號見 `docs/features/satellite-console-restyle/README.md`。
- 上線：**develop → master 未做**（要使用者拍板），正式站部署與瀏覽器未驗；本機 3751 驗過暗色、淡色、歷史模式狀態列、對比彈窗（淡色）。未實機點過：popup「查看衛星百科」、手機寬度彈窗 sheet、低軌衛星前後軌跡疊圖。
- 擱置：歷史模式變軌清單跟時間軸（BACKLOG SAT-Z3）；gis-platform 草稿 `feat/satellite-maneuvers-anchor`（worktree `.worktrees/sat-maneuver-anchor`，本機 commit `a0bc247`，未 push、未套用）。
- 同場一般 merge：#389、#531、#532（#532 與 #531 衝突，已合入 develop 並重產 layer-golden，圖層 982）。#532 分支多了遠端 merge commit，`.worktrees/demographics-stats-20261004` 要先 pull。草稿 #425–#428 未動。
- 可清：`.worktrees/satellite-restyle`（已合併）。
- 下次入口：master 部署後在正式站切暗／淡看衛星面板，並點一次 popup「查看衛星百科」。

### 卡點與下一步

**下一個 session 的入口（Agent／MCP 線）**：先讀 `docs/features/general-analysis/STATUS.md`「2026-10-04 現況」，再看 BACKLOG AG-10／AG-11（AG-6 已隨 #543 完成）。

- 使用 Agent：正式站分頁開著（部署後要重新整理分頁）、Claude Code `/mcp` 重連即可；token 在 `~/.config/pulse-research/agent-token`。
- 倉庫改資料：analytics 改 manifest → MCP `warehouse/update_store.py --only <safe_id>` 在 `_warehouse-rebuild/<名稱>/store` 重建 → 核對列數 → `upload-store.mts plan` → `execute`；上傳後已連線的 MCP 要 `/mcp` 才讀到新版。
- 手動待驗：正式站重整還原、面板撤銷 token（AG-5 剩餘）。

其餘待辦：AG-2～AG-4、AG-7、AG-10、AG-11。

衛星情報線：等 develop→master 拍板後做正式站目視；SAT-Z3 擱置。

設計系統線：下一步是 R6（先請使用者決定範圍與開關位置），或 backlog R5-2（只剩瀏覽器目視；R5-1、R8-2 已隨 #543 完成）；驗收照各項 backlog。
