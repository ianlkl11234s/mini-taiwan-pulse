# 第一階段：看地圖、探索資料

2026-09-16 使用者確認：先讓 Codex 幫助使用者探索網站，之後再擴充交叉分析。使用者不必知道圖層名稱，也不必先把問題改成工具可回答的句型。

## Agent 操作指引

1. 依自然問題理解主題與位置，使用 `pulse_search_layers` 找既有圖層；初次沒找到可換詞搜尋，不把零命中解讀成沒有資料。
2. 使用 `pulse_get_layer_details` 讀取相關圖層來源、內容、更新、限制與關聯。目錄或欄位不完整就明確說明未知，仍完成能做的展示。
3. 詢問「有哪些／差別是什麼」時列出少量候選並討論；明確要求看分布時直接開啟對應圖層。無 analysis reader 不阻止開圖。
4. 操作前讀取 map context 與 study revision；保留既有無關圖層。沿用一般、世界、統計、日本圖層的實際開關與載入途徑。
5. 提議一兩個有理由的延伸方向；相同來源的不同呈現不當作獨立證據。
6. 需要時使用 host web tools 查官方背景並引用網址；區分站內資訊與外部補充，不能宣稱外部資料已載入地圖。
7. 第一階段不提供計算、原始紀錄查詢與跨圖層分析。遇到這類問題先說明目前範圍，仍可建議相關圖層協助探索；不得假裝已完成計算。

本指引的核心已放進 MCP server instructions 與 tool descriptions，Agent 連接工具時即可取得，不要求額外 Skill。此文件供開發、接手與驗收；不得假設其他 Codex 對話會自動讀取本文件。

## Context 與底層工具

對話保留使用者意圖；MCP 說明提供操作規則；manifest 派生搜尋索引與 data catalog 提供圖層資訊；browser map context 提供視角、選取位置、開啟圖層與載入狀態。紀錄按需讀取，不把全站原始資料塞進對話。

主要工具：search_layers、get_layer_details、describe_layer、get_map_context、get_study_state、set_layers、set_camera、fit_bounds、find_places、wait_scene_ready、get_query_result。find_places 目前是既有視角預設，非通用地址搜尋。

## 第一階段前端

配對區預設只保留連線與必要管理；隱藏附近學校、格網與進階分析控制。配對確認且實際連線後，自動回到最後使用的圖層面板（預設一般圖層）；Agent 開啟圖層後切至對應的一般／世界／統計／日本面板。切面板不可卸載連線。

查詢與操作使用真實 activity：搜尋、讀取說明、同步地圖、完成、錯誤。保留平滑鏡頭、跟隨開關與 reduced-motion。普通圖層的開關回覆不代表原始資料載入成功，載入仍由既有 loading registry 顯示。Codex 純思考或外部 web search 不會自動產生網站 activity；不要製造假進度。

## 驗收邊界

工具測試、UI 測試與 paired Agent E2E 分開記錄。新增 Skill 不能取代工具接線與實際資料，亦不保證任何問題都有答案。

## 2026-09-17 探索分支邊界

三個 repo 均使用 `codex/map-exploration`。完整進階版留在 `codex/research-recovered`：前端 `e38f32a3`、MCP `1c954c5`、Gateway `aa43c0e`。以分支差異逐步取回後续功能，不整段合併分析工具。

- MCP 僅註冊配對／連線、讀狀態、搜尋與說明圖層、地點預設、圖層開關、鏡頭與範圍定位、操作與查詢回執。
- 地圖入口不建立 analysis session、不掛 analysis/nearby overlays、不呈現進階分析 UI。
- Gateway 僅接受 `search_layers`、`layer_details`、`describe_layer`、`map_context`、`find_places`；拒絕分析操作與 synthetic/result presentation。保留 null 清除舊狀態的相容性。
- 第一階段可查看現有統計圖層，但不提供新的聚合、排行或交叉計算。一般、世界、統計、日本面板繼續沿用。
- 本機啟動改用獨立 `runtime/map-exploration.sqlite`，避免承接進階版 pending command、暫停或配對狀態。首次需重新配對；原 `gateway.sqlite` 不刪除。
- 進階模組若仍留在 repo，不代表開放使用；判斷基準為 MCP 註冊清單、Gateway allowlist 與地圖入口 dependency graph。

驗收順序：配對 → 問「教育相關有哪些圖層」→ 查看來源與限制 → 選擇開啟 → 確認真實載入 → 手動拖動與切換圖層 → 再次探索。進階問題需明確回覆範圍，不得以空結果冒充不支援。

### 本次驗證

- 前端 `npx tsc -b` 通過；research Vitest 93 passed / 2 skipped（既有可選資料測試）。包含真 Gateway 回應與 runtime dependency boundary。
- MCP build 與完整測試 33 passed；`node scripts/research/evaluation-mcp.mjs --smoke` 以真正 dist stdio 入口核對 14 個工具，分析工具不可呼叫。
- Gateway 全部測試 37 passed，包含 HTTP 直接呼叫分析被拒絕。
- Browser：Agent 面板只有配對與跟隨設定；搜尋「學校」得到 11 個候選，開啟 schools 後實際可見點位；未配對不出現假 Agent 動作。
- 尚未驗收：新探索資料庫下的使用者登入、重新配對及 Codex → Gateway → browser 完整往返；需另開 Codex session 取得新工具清單。
- 舊 `acceptance-map.html` 不再載入分析模組，改指向主地圖；evaluation harness 僅做探索工具邊界 smoke。
