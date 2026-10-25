# Status

**最後更新**：2026-10-24 v2.13.0（Pulse 筆記文章專區、臺北市局處統計 11 層）

前一次：2026-10-23 v2.11.3（圖例封頂、開站不閃文字）

前前次：2026-10-18 開發週期收尾：worktree 30→8、本地分支 77→20（已合併或已被取代者；備份與刪除清單在 `GIS/_worktree-backups/2026-10-18/`）、文件連結／過時狀態／LESSONS 指標整理

前一次：2026-10-15（R6 圖層平面模式段 1–3 上線；資料面盤點、倉庫覆蓋率 +18 層、collector 健康調查、v2.6.0 發布、Agent 題庫第二輪、repo 清理）

> 本檔只放這次碰到的範圍、上線狀態、卡點和下一步。完整計畫與數字看 [`PLAN-prod-connect-20261003.md`](../../docs/features/general-analysis/PLAN-prod-connect-20261003.md)，契約看 [`SPEC-prod-connect-p1-p3.md`](../../docs/features/general-analysis/SPEC-prod-connect-p1-p3.md)，操作看 [`PROD-HOME.md`](../../docs/features/general-analysis/PROD-HOME.md)，決策看 ADR-0017。

## 2026-10-24：v2.13.0 Pulse 筆記文章專區

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | #670（`/blog/` 靜態文章專區＋第一篇〈台灣軌道即時地圖〉＋PROSE 字級＋嵌入版協作手勢＋nginx `/blog/`）、#673（地圖站 rail／手機 ⋯ 入口）、#675（blog-writing skill＋文章計劃）、#678（單張封面淺色消失、外站圖片改 build 報錯）、#679（臺北市污水新舊口徑切換）→ #680 版號 → #681 develop→master；tag `v2.13.0`＋GitHub Release。同包帶上另一 session 的臺北市局處統計（#664、#671、#674）與首頁隱私連結（#668）；原 v2.12.2 未發布（#669 關閉、#677 退回 Unreleased），內容併入本版。POC 草稿 #426–#428 未發。 |

| 上線項目 | build | contract/wire | stage | deploy | HTTP | browser |
|---|---|---|---|---|---|---|
| `/blog/` 文章專區 | done：CI 綠 | done：`src/blog/__tests__/blog.test.ts`；本機 nginx 實測 301／404／CSP | done：develop `c3e91b2c` | done：master `9f58ac6a` | done：正式站 `main-0HytoUDk.js` 含 "2.13.0"；文章／列表／關於／RSS 200、`/blog/nope/` 404、`/blog/rail` 301 | done：正式站文章頁目錄高亮、台北捷運嵌入地圖有列車（30 倍速） |
| 地圖站入口 | done | N/A | done | done | done | done：rail 連結 `/blog/?theme=dark` |
| 臺北市局處統計＋污水修正 | done：CI 綠 | done：合約與切換測試 | done | done | not run | not run（BACKLOG BLOG-V） |

- 下一步：寫第二篇（BACKLOG **BLOG-1**，流程 `.claude/skills/blog-writing/SKILL.md`，清單 `docs/features/blog/article-plan.md`）；正式站補驗（**BLOG-V**）。
- 文件：`docs/features/blog/README.md`（網址契約、front matter、```map 語法、嵌入快照限制）。

---

## 2026-10-23：v2.11.3 圖例封頂、開站不閃文字

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | #657（右下 popup＋圖例封頂在工具列下方、圖例內捲；index.html 靜態說明改畫面隱藏）→ #658 版號 → #659 develop→master，tag `v2.11.3`＋GitHub Release；同包帶上文件 #647。 |

| 上線項目 | build | contract/wire | stage | deploy | HTTP | browser |
|---|---|---|---|---|---|---|
| v2.11.3 | done：三個 PR CI 綠 | N/A | done：develop `a4c5086e` | done：master `76fc1a8d` | done：正式站 `main-CtbbJAEC.js` 含 "2.11.3" | done：1280×720 開 9 層＋popup，停靠區 60–656、圖例內捲；not run：console、手機、淺色底圖 |

- 下一步（可選）：正式站手機寬與淺色底圖看一次圖例，驗收＝圖例上緣不超過工具列。
- 規格：`docs/design-system/spec.md` §5.23「高度上限」。

---

## 2026-10-15：R6 圖層平面模式（段 1–3）

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | #547（非移動物件立體效果預設關、溫度網格 10 級淺色票）、#572（機組／水庫／五類廢棄物設施平面點＋圖例）、#573（台鐵／高鐵／捷運列車與垃圾車平面版、換底圖軌道重建、對比描邊）、#578（列車平面收起高度滑桿、BACKLOG R6-4）已合併，**隨 v2.8.0 上正式站**（另一 session 發布）。 |

| 上線項目 | build | contract/wire | stage | deploy | HTTP | browser |
|---|---|---|---|---|---|---|
| R6 段 1–3 | done：tsc＋npm test 4087 passed、CI 綠 | done：golden、樣式盤點無差異 | done：develop `553b7e98` | done：master v2.8.0（`3182fcac`） | done：正式站 main-*.js 含 "2.8.0" | not run（正式站）：本機測試站使用者已看過 |

- 下一步：BACKLOG **R6-V** 正式站目視（輸電線光暈、機組平面點與 popup、水庫／設施立體開時點選）。
- 段 4（船、公車三層、垃圾車班表、漁船軌跡）＝ BACKLOG **R6-4**，使用者決定暫不碰。
- 文件：`docs/features/map-layer-restyle/R6-PROPOSAL.md`、`r6-s{1,2,3}-compare.html`。

---

## 2026-10-05～06：資料面盤點與 v2.6.0

### 範圍與上線

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | #539（GD-1、AU-3 契約測試）、#540（倉庫覆蓋率 L2 795／982）、#541（OSRM token 遮蔽、AU-1 結案改列 DS-COLOR）、#542（圖層新鮮度總表 `build-layer-freshness.mjs`）、#543（R5-1／R5-2／R8-2／AG-6／G005）、#544（BACKLOG 健檢）已合併；**v2.6.0** 已發布（#545／#546，tag 打在 master `65c90691`），正式站 main-*.js 顯示 2.6.0。 |
| **mini-pulse-gis-mcp** | MCP 已到 #63（2026-10-17）：查證關卡 #56–#59、數字口徑 #60、醫療院所去重與排名不上網 #62、地震只用正式目錄 #63；正式 MCP（.worktrees/analysis-prod/mcp）在 cbb3348。現況入口：`.gis-agent-system/roadmap/status/ai-mcp.md`。 |
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

**下一個 session 的入口（Agent／MCP 線）**：先讀 `.gis-agent-system/roadmap/status/ai-mcp.md`「Agent 分析能力迭代」段，每輪分數與失敗分類看 mini-pulse-gis-mcp `eval/agent-regression/README.md`；`docs/features/general-analysis/STATUS.md` 停在 2026-10-04，只留歷史（2026-10-18 改）。再看 BACKLOG AG-10／AG-11（AG-6 已隨 #543 完成）。

- 使用 Agent：正式站分頁開著（部署後要重新整理分頁）、Claude Code `/mcp` 重連即可；token 在 `~/.config/pulse-research/agent-token`。
- 倉庫改資料：analytics 改 manifest → MCP `warehouse/update_store.py --only <safe_id>` 在 `_warehouse-rebuild/<名稱>/store` 重建 → 核對列數 → `upload-store.mts plan` → `execute`；上傳後已連線的 MCP 要 `/mcp` 才讀到新版。
- 手動待驗：正式站重整還原、面板撤銷 token（AG-5 剩餘）。

其餘待辦：AG-2～AG-4、AG-7、AG-10、AG-11。

衛星情報線：等 develop→master 拍板後做正式站目視；SAT-Z3 擱置。

設計系統線：下一步是 R6（先請使用者決定範圍與開關位置），或 backlog R5-2（只剩瀏覽器目視；R5-1、R8-2 已隨 #543 完成）；驗收照各項 backlog。
