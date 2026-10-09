# Pulse Agent 分析：總進度（唯一的最新進度頁）

> **最後更新：2026-10-04。** 進度以本頁為準；其他計劃文件（PLAN-round3、PLAN-warehouse）保留當時的脈絡，不再追加進度。
> 每次合併重要 PR 後，更新本頁的「能做什麼」「指標」「待辦」三節。

## 2026-10-04 現況（Agent × MCP）

**已上線**
- **本機 Claude Code 連正式站**（ADR-0017）：gateway 在 Zeabur `research-gateway`；正式站面板產生 token → `pbpaste | npm run token:save`（analysis-prod/mcp）→ MCP 自動接上分頁。正式站實測：接上 0.93 s、set_camera 1.8 s、set_layers 0.87 s、map_context 0.45 s、show_nearby p50 5.8 s。
- **圖層組講得出現象**（AG-1）：map_context 帶 `bounds`＋`visibleSummary`，自繪圖層（颱風、地震、YouBike、空品、雨量站）用圖層資料做摘要；分層題庫 13/13。
- **實際使用修掉的工具問題**（AG-8）：中文類別篩選、0 筆類別不再消失＋北北基改用北北基站牌、帶 Z 座標的面結果能上圖、淹水資料重建修形狀、北北基站牌只在需要時載入、去重欄位錯誤明確報錯。
- **資料正確性**：公車資料重複載入修正（analytics #138、#139）；建置不再靜默丟 CSV 列（MCP #43），6 份資料補回 99 列。
- **公車首末班**：新增四份無幾何表（停靠站序、班表、首末班、路線）與 pulse-overlay `bus-first-last` 配方；例：永和豫溪街往內湖只有 214（網溪國小一，平日起站 04:50／21:00）。
- **find_data 先多看再砍**（MCP #44）：字面比對取 3 倍、上限 20 給 Jev 再截；每次找資料約 0.4 → 1.0 s。

**R2 倉庫版本**：以 R2 `latest.json` 為準（本檔不再抄版本號，避免過時）；2026-10-06 時為 `20261006T060540Z`（減害／成癮入倉）。較早的回退點：`20261004T130110Z` → `20261004T020349Z` → `20261003T180623Z` → `20261003T173242Z` → `20261003T165705Z` → `20261003T031158Z`。上傳一律 `scripts/upload-store.mts plan` 檢查後再 `execute`。

**下一步**：見 `.claude/memory/BACKLOG.md` AG-6（其他自繪圖層摘要）、AG-10（部署後舊分頁提示重新整理）、AG-11（公車總表標題誤寫「即時」）、AG-7（回歸測試重置殘留圖層）。手動待驗：正式站重整還原、面板撤銷 token。

## 從這裡開始

**想用（讓 Agent 幫你分析）**
1. 啟動本機環境：照 [PROD-HOME.md](./PROD-HOME.md)「啟動與停止」開 8794 gateway 與 3734 前端（已在跑就跳過；檢查：`lsof -iTCP:3734 -sTCP:LISTEN`）。
2. 正式用法：開 `https://mini-taiwan-pulse.itsmigu.com` 登入，面板產生 token，`pbpaste | npm run token:save`（在 `analysis-prod/mcp`），Agent 第一次動地圖時自動接上分頁；多個分頁會請你選。本機測試改用測試身分（見 PROD-HOME），不用登入。
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
| Agent v2：四個 skill | 主指揮 `pulse-conductor`＋圖層／一般分析／深入分析三組，放在 mcp repo `plugins/pulse-analyst/skills/`（唯一一份；舊 pulse-gis-analyst、geo-reasoning、pulse-map-story 已移除）。三鐵則：每題上圖、計算前地圖先動、回答白話 | 10-03 |
| 精簡工具組 | 預設 `PULSE_TOOLSET=core` 22 個工具（`full` 保留全部）；`pulse_show_result`／`pulse_show_nearby` 一步上圖；圖層代號驗證；大結果自動簡化 | 10-03 |
| 周邊一問就畫好 | 中心點、白色虛線圈、依類別上色、最近幾個標名稱、分段浮現（NEARBY-MAP-PLAN 第 1–6 項） | 10-03 |
| 正式站連線（P1–P3） | 面板產生 token＋MCP 自動接上分頁；結果通道（大結果上傳）；快路徑（set_camera 4.6→1.7 s，本機量測）；已移除配對碼與 dev autopair | 10-03（gis-platform #137、mini #512、mcp #35） |

## 指標

| 指標 | 數值 | 出處 |
|---|---|---|
| 可分析圖層 | 605／794 | [layer-status-summary.md](./layer-status-summary.md) |
| 問題庫 | 29 題 | mcp `src/warehouse/questionBank.ts` |
| 倉庫版本 | store `20260926T200634Z`（正本在 R2 `pulse-warehouse`） | `pulse_wh_status` |
| Agent 回歸測試（舊 20 題，sonnet，接真地圖） | **18/20**（10-03；歷次 3 → 10 → 14 → 15 → 16 → 18）；剩 A10（綜合指標算法分歧）、A18（已修路由，待複驗） | mcp `eval/agent-regression/README.md` |
| 分層題庫（13 題，每題要上圖） | **12/13**；repeat 2 曾 26/26；上圖、動靜、語氣 100% | mcp `eval/agent-regression/questions-tiers.json` |
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
| 上雲 | ~~gateway 上 Zeabur、Agent 面板改 owner 權限~~（10-03 完成，ADR-0017）；MCP 遠端化（雲端引擎）仍未做 | [PROD-HOME.md](./PROD-HOME.md)、`zeabur-cloud-engine-option.md` |

## 下一步建議（依優先）

0. ~~周邊問題「一問就畫好」~~（10-03）、~~圖層組講現象~~（10-04 AG-1）、~~正式站連線~~（10-04）。
1. **資料新鮮度自動化**：倉庫每月重建與 Valhalla 月更自動化，並更新過舊資料（事故點）。現在功能已齊，資料過期是最大風險。
2. **Agent 品質第二輪**：回歸測試加 `--repeat`，看出穩定分數後再修 A12、A09。
3. ~~上雲第一步：gateway 部署到 Zeabur~~（10-03 完成）。分析引擎仍在本機，Mac 沒開就不能分析；要擺脫要走雲端引擎（`zeabur-cloud-engine-option.md`）。
4. 覆蓋度與其餘待辦依需要排入。
