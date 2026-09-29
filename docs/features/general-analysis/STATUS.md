# Pulse Agent 分析：總進度（唯一的最新進度頁）

> **最後更新：2026-09-29。** 進度以本頁為準；其他計劃文件（PLAN-round3、PLAN-warehouse）保留當時的脈絡，不再追加進度。
> 每次合併重要 PR 後，更新本頁的「能做什麼」「指標」「待辦」三節。

## 從這裡開始

**想用（讓 Agent 幫你分析）**
1. 啟動本機環境：照 [PROD-HOME.md](./PROD-HOME.md)「啟動與停止」開 8794 gateway 與 3734 前端（已在跑就跳過；檢查：`lsof -iTCP:3734 -sTCP:LISTEN`）。
2. 瀏覽器開 `http://127.0.0.1:3734`，登入後在「與 Agent 協作」面板取得配對碼，貼給 Claude Code 或 Codex（它們會呼叫 `pulse_pair_session`），比對短語一致就按確認。
3. 直接用白話問，例如「台北車站 800 公尺內有什麼」「各縣市 A1 事故率排名」「把這個做成卡片」。

**想改（開發）**
1. 先讀本頁「東西在哪」，找到要改的 repo。
2. 一律開自己的 worktree，不在主 checkout 或 `analysis-prod` 裡改。
3. PR → CI 綠燈 → 一般 merge（不可 squash）→ 照 [PROD-HOME.md](./PROD-HOME.md)「更新」同步 `analysis-prod`，mcp 有改要在 Claude Code `/mcp` 重連。
4. 改了 Agent 的回答或資料口徑，跑一次回歸測試（見「指標」）比對分數。

## 現在能做什麼

| 能力 | 說明 | 上線 |
|---|---|---|
| 找資料 | `pulse_find_data`：跨資料集名稱、中文圖層標籤、欄位、統計指標與同義詞搜尋；Jev 判斷相關性 | 09-27（mcp #13、#14） |
| 周邊生活機能／多點比較 | `pulse_nearby_profile`；多點比較表 | 09-27 |
| 縣市／鄉鎮排名 | `pulse_region_rank`（統計指標 300 項） | 09-26 |
| 任意查詢 | `pulse_sql`（唯讀 DuckDB，時間一律台灣時間分組） | 09-26／09-28 |
| 等時圈 | `pulse_isochrone`（自架 Valhalla，步行／自行車／開車，可一次要 10／15／20 分） | 09-27（mcp #11） |
| 地圖呈現 10 種樣式 | 區域深淺（含時間播放）、熱力、比較、泡泡、雙指標、流向、格點（H3／方格）、立體柱、多層等時圈、時間序列 | 09-28（mcp #16–#20、mini #369–#388） |
| 互動 | 滑過提示、點選淡化、最多疊 3 個結果、圖例併入圖例面板、popup 趨勢線、播放列 | 09-28（mini #376、#388） |
| 面板小圖表 | 排名長條、比較表迷你長條、趨勢折線 | 09-28（mini #388） |
| 分析卡連結 | Agent 產草稿 → 授權閘門 → 使用者按發布 → `https://mini-taiwan-pulse.itsmigu.com/card/<slug>`（30 天、可撤銷） | 09-29（gis-platform #120、#121；mcp #21、#22；mini #394、#399） |
| 回答品質 | 第一句給答案、數字帶口徑、不露內部代號、結尾一句提議 | 09-29（mini #400、#403；mcp #23、#24） |

## 指標

| 指標 | 數值 | 出處 |
|---|---|---|
| 可分析圖層 | 605／794 | [layer-status-summary.md](./layer-status-summary.md) |
| 問題庫 | 29 題 | mcp `src/warehouse/questionBank.ts` |
| 倉庫版本 | store `20260926T200634Z`（正本在 R2 `pulse-warehouse`） | `pulse_wh_status` |
| Agent 回歸測試（20 題，sonnet） | **全過 14/20**（排除已知問題 13/19）；語氣 19、數字 15、找對資料 19；歷次 3 → 10 → 14 | mcp `eval/agent-regression/README.md` |
| 分析卡白名單 | 141 個資料集可公開 | mcp `src/warehouse/publishAllowlist.json` |

回歸測試：`cd mini-taiwan-pulse/.worktrees/analysis-prod/mcp && npm run eval:agent -- --model sonnet`（約 11 分鐘，走訂閱額度）。

## 東西在哪

| 東西 | 位置 |
|---|---|
| 前端、skill、設計文件 | repo **mini-taiwan-pulse**（本 repo）：`src/research/`、`src/card/`、`.agents/skills/pulse-gis-analyst/`、`docs/features/` |
| Agent 工具（MCP）、倉庫引擎、樣式計算、回歸測試 | repo **mini-pulse-gis-mcp**：`src/research/server.ts`、`src/warehouse/`、`eval/agent-regression/` |
| 研究 gateway、分析卡資料表 | repo **gis-platform**：`services/research-gateway/`、`migrations/414_*`、`415_*` |
| 本機正式環境 | `mini-taiwan-pulse/.worktrees/analysis-prod/{mini,mcp,gateway,runtime}`（不屬於任何 repo 的收納位置）→ [PROD-HOME.md](./PROD-HOME.md) |
| 架構決策 | [ADR-0014](../../../../.gis-agent-system/decisions/0014-pulse-analysis-warehouse.md) |

權威文件：

| 主題 | 文件 |
|---|---|
| 倉庫架構與契約 | [PLAN-warehouse-20260926.md](./PLAN-warehouse-20260926.md) |
| 第三輪（覆蓋度、問題庫、等時圈、語氣）完整紀錄 | [PLAN-round3-20260927.md](./PLAN-round3-20260927.md) |
| 視覺化、面板圖表、分析卡 | [viz-library/README.md](../viz-library/README.md)（DECISIONS、PLAN、CARD-LINK、BACKLOG） |
| 本機正式環境與上雲準備 | [PROD-HOME.md](./PROD-HOME.md) |
| 問題庫題綱 | [question-bank-backlog-20260927.md](./question-bank-backlog-20260927.md) |
| Agent 回歸測試 | mcp `eval/agent-regression/README.md` |
| UI 規範（面板、popup、token） | [ui-consistency-audit handoff](../ui-consistency-audit-20260927/handoff.md)、`docs/design-system/` |

## 待辦（統整）

| 類別 | 項目 | 詳見 |
|---|---|---|
| Agent 品質 | 同題多次跑的變異（建議每題跑 2–3 次）；A12 房價 × 淹水配方；A09 住宿業改用工商登記；題庫報告重產 | mcp eval README |
| 資料 | 新聞發布時間欄位時區查證；食品價格指數原料查證；台北事故點只到 2019；34 個臺灣 snapshot_candidate 入倉；世界／日本覆蓋度 | 本頁、PLAN-round3「下一步」 |
| 資料新鮮度 | 倉庫每月重建＋上傳 R2 的排程；Valhalla 月更後自動重啟 | PLAN-round3「下一步」 |
| 合規 | 倉庫長期存放 Google geocode 座標是否符合條款 | viz-library BACKLOG |
| 視覺化 | 呼吸脈衝（需即時標記）、合併重複 sparkline、分析卡支援更多樣式與村里、立體柱高度預設 | viz-library BACKLOG |
| 效能 | `researchDatasets.ts` `allDescriptors()` 無快取 | viz-library BACKLOG |
| 指標名稱 | 統計指標缺中文名稱欄位（分析卡圖例靠 Agent 填） | viz-library BACKLOG |
| 上雲 | gateway 上 Zeabur、MCP 遠端化、Agent 面板改 owner 權限 | [PROD-HOME.md](./PROD-HOME.md)「全雲端準備清單」 |

## 下一步建議（依優先）

0. **周邊問題「一問就畫好」**（使用者 2026-09-29 實測回饋，已調查、待拍板）：中心點＋白色虛線圈＋具名的分類點、一步到位工具 `pulse_show_nearby`、引導改寫。計劃見 [viz-library/NEARBY-MAP-PLAN.md](../viz-library/NEARBY-MAP-PLAN.md)。
1. **資料新鮮度自動化**：倉庫每月重建與 Valhalla 月更自動化，並更新過舊資料（事故點）。現在功能已齊，資料過期是最大風險。
2. **Agent 品質第二輪**：回歸測試加 `--repeat`，看出穩定分數後再修 A12、A09。
3. **上雲第一步**：研究 gateway 部署到 Zeabur，讓 Agent 分析不依賴本機開機（照 PROD-HOME 清單）。
4. 覆蓋度與其餘待辦依需要排入。
