# Status

**最後更新**：2026-10-04（正式站端到端量測完成）

> 本檔只放這次碰到的範圍、上線狀態、卡點和下一步。完整計畫與數字看 [`PLAN-prod-connect-20261003.md`](../../docs/features/general-analysis/PLAN-prod-connect-20261003.md)，契約看 [`SPEC-prod-connect-p1-p3.md`](../../docs/features/general-analysis/SPEC-prod-connect-p1-p3.md)，操作看 [`PROD-HOME.md`](../../docs/features/general-analysis/PROD-HOME.md)，決策看 ADR-0017。

## 範圍

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | #506（面板站主可見、nginx 轉 gateway）、#512（AG-1＋P1–P3）、#517（自繪圖層摘要＋SCENE_ERROR 修正）、#519（map_context 等資料、aqi isStyleReady）、#515（文件）已合併並部署。 |
| **gis-platform** | #136（zbpack 啟動）、#137（結果通道、長輪詢、agent token、清掉配對碼）已合併；Zeabur 服務 `research-gateway` 以 `zeabur deploy` 部署（不綁 GitHub）。 |
| **mini-pulse-gis-mcp** | #35（P1–P3＋AG-1）、#37、#38（摘要讀法）已合併。 |
| **本機** | analysis-prod 三個 worktree 已切到最新；8794 改測試身分（`PULSE_RESEARCH_TEST_IDENTITY`），3734 `.env.local` 改 `VITE_RESEARCH_TEST_IDENTITY=1`。Claude／Codex 的 pulse-research 預設連正式站。 |

## 上線狀態

| 上線項目 | build | contract/wire | stage | deploy | HTTP | browser |
|---|---|---|---|---|---|---|
| gateway（Zeabur） | done：100 tests | done：本機 e2e 13 項 | done：#137 | done：12:36Z pod 啟動 | done：新端點未登入 401、`/pairings/claim` 404 | not run：需使用者 token |
| mini 正式站 | done：CI 綠 | done | done：#512／#517／#519 | done | done：上傳路徑放行 2 MB、一般路徑 100 KB 413 | not run：需使用者 token |
| MCP（analysis-prod） | done：524 tests | done | done：#35／#37／#38 | done：已 build | N/A | done：本機 live-map 分層題庫 13/13 |

## 數字（本機無頭瀏覽器，改版前 → 後）

set_camera 4.6 → 1.7 s；set_layers 1.6 → 0.16 s；map_context 88 → 13 ms；token 接上 55 ms；重整還原 5.5 s；18 MiB 上傳 151 ms。正式站改版前（P0）：set_camera 4.7 s、map_context 0.96 s、set_layers 4.8 s；網路經 Cloudflare 新加坡，ping 150 ms。

## 正式站量測（2026-10-04，`e2e-prod-connect.mjs prod`）

| 動作 | 改版前（P0） | 改版後 |
|---|---|---|
| 接上分頁 | 手動配對 12.5 s | 0.93 s（免碼） |
| set_camera | 4.7 s | 1.8 s（6/6 ready） |
| set_layers | 4.8 s | 0.87 s |
| map_context | 0.96 s | 0.45 s（含 AG-1 摘要） |
| show_nearby 上圖 | 不可用 | p50 5.8 s |

重整還原與撤銷尚未在正式站實測（需使用者手動）。

## 監看模式改版（2026-10-03～04，另一條工作線）

- P1–P5 全部合併（mini #482–#505、#507 backlog、#508 文件）；gis-platform #135／migration 425 已用 psql 套正式庫並查證（`aggregated_at` 有回傳、權限不變）。
- 上線：mini 前端合併後**正式站部署與瀏覽器未驗**（只在本機 3750 驗過 1920／1496／1280 與淡色底圖）。
- 擱置：P6 四領域子指數（BACKLOG MON-P6，需使用者定權重與基準期＋migration）、直播牆換台（LW-1）。
- 下次入口：確認正式站已含 #505，用工具列「底圖」切淡色看監看新版；新聞四格時間應為彙整時間。

## 設計系統／圖層面板（平行工作線，2026-10-02～04）

| repo | 現況 |
|---|---|
| **mini-taiwan-pulse** | 已合併：效能 #480／#481、R5 密集點熱區 #498、提案 #504、R8 面板統一 A #509／B #511／C #513、R7 熱區與網格配色 #510、統計與世界大分類 #514、收尾修正 #516、backlog #518；收尾文件與活的元件頁見本次 wrap-up PR。 |
| **mini-pulse-gis-mcp** | #34（palette 控制項說明）、#36（linkedSelect 說明）已合併。 |
| **本機** | analysis-prod mini／mcp 已切最新並 build；pulse-research 需使用者 `/mcp` 重連才吃到新控制項說明。 |

| 上線項目 | build | contract/wire | stage | deploy | HTTP | browser |
|---|---|---|---|---|---|---|
| R5／R7／R8 前端 | done：每支 PR 全套測試＋CI 綠 | done：palette／linkedSelect 6 接點＋MCP 說明 | done：merged | unknown：本 session 未查正式站部署 | not run | done：本機 dev（各段對照頁在 `docs/features/layer-color-picker/`、`docs/features/layer-panel-unify/`） |

設計系統進度以 `docs/design-system/README.md`「目前進度」為準：R1–R5、R7、R8 完成，只剩 R6（Three.js／Mapbox 切換，待使用者決定範圍）。

## 衛星情報面板改版（2026-10-04，另一條工作線）

- 盤點 → P1 比較頁 → P2–P5 一頁比較頁（可複製答案）→ 實作：P-D 資料狀態＋P1–P5 全部合併在 #533（develop `a7864dbb`，CI 綠）。決策與代號見 `docs/features/satellite-console-restyle/README.md`。
- 上線：**develop → master 未做**（要使用者拍板），正式站部署與瀏覽器未驗；本機 3751 驗過暗色、淡色、歷史模式狀態列、對比彈窗（淡色）。未實機點過：popup「查看衛星百科」、手機寬度彈窗 sheet、低軌衛星前後軌跡疊圖。
- 擱置：歷史模式變軌清單跟時間軸（BACKLOG SAT-Z3）；gis-platform 草稿 `feat/satellite-maneuvers-anchor`（worktree `.worktrees/sat-maneuver-anchor`，本機 commit `a0bc247`，未 push、未套用）。
- 同場一般 merge：#389、#531、#532（#532 與 #531 衝突，已合入 develop 並重產 layer-golden，圖層 982）。#532 分支多了遠端 merge commit，`.worktrees/demographics-stats-20261004` 要先 pull。草稿 #425–#428 未動。
- 可清：`.worktrees/satellite-restyle`（已合併）。
- 下次入口：master 部署後在正式站切暗／淡看衛星面板，並點一次 popup「查看衛星百科」。

## 卡點與下一步

**下一個 session 的入口**：BACKLOG AG-6（其他自繪圖層摘要）。

- 使用者有空時手動驗：正式站重整一次看結果還原、面板撤銷 token 一次看 15 s 內斷線（AG-5 剩餘）。

其餘待辦：AG-2～AG-4、AG-7（回歸測試重置殘留圖層）。

衛星情報線：等 develop→master 拍板後做正式站目視；SAT-Z3 擱置。

設計系統線：下一步是 R6（先請使用者決定範圍與開關位置），或 backlog R5-1、R5-2、R8-2；驗收照各項 backlog。
