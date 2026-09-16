# 第一階段：看地圖、探索資料

2026-09-16 使用者確認：先讓 Codex 幫助使用者探索網站，之後再擴充交叉分析。使用者不必知道圖層名稱，也不必先把問題改成工具可回答的句型。

## Agent 操作指引

1. 依自然問題理解主題與位置，使用 `pulse_search_layers` 找既有圖層；初次沒找到可換詞搜尋，不把零命中解讀成沒有資料。
2. 使用 `pulse_get_layer_details` 讀取相關圖層來源、內容、更新、限制與關聯。目錄或欄位不完整就明確說明未知，仍完成能做的展示。
3. 詢問「有哪些／差別是什麼」時列出少量候選並討論；明確要求看分布時直接開啟對應圖層。無 analysis reader 不阻止開圖。
4. 操作前讀取 map context 與 study revision；保留既有無關圖層。沿用一般、世界、統計、日本圖層的實際開關與載入途徑。
5. 提議一兩個有理由的延伸方向；相同來源的不同呈現不當作獨立證據。
6. 需要時使用 host web tools 查官方背景並引用網址；區分站內資訊與外部補充，不能宣稱外部資料已載入地圖。
7. 只有明確需要計算時再使用 dataset reader 與分析工具。能看、能讀、能算是不同能力。

本指引的核心已放進 MCP server instructions 與 tool descriptions，Agent 連接工具時即可取得，不要求額外 Skill。此文件供開發、接手與驗收；不得假設其他 Codex 對話會自動讀取本文件。

## Context 與底層工具

對話保留使用者意圖；MCP 說明提供操作規則；manifest 派生搜尋索引與 data catalog 提供圖層資訊；browser map context 提供視角、選取位置、開啟圖層與載入狀態。紀錄按需讀取，不把全站原始資料塞進對話。

主要工具：search_layers、get_layer_details、describe_layer、get_map_context、get_study_state、set_layers、set_camera、fit_bounds、find_places、wait_scene_ready、get_query_result。find_places 目前是既有視角預設，非通用地址搜尋。

## 第一階段前端

配對區預設只保留連線與必要管理；隱藏附近學校、格網與進階分析控制。配對確認且實際連線後，自動回到最後使用的圖層面板（預設一般圖層）；Agent 開啟圖層後切至對應的一般／世界／統計／日本面板。切面板不可卸載連線。

查詢與操作使用真實 activity：搜尋、讀取說明、同步地圖、完成、錯誤。保留平滑鏡頭、跟隨開關與 reduced-motion。普通圖層的開關回覆不代表原始資料載入成功，載入仍由既有 loading registry 顯示。Codex 純思考或外部 web search 不會自動產生網站 activity；不要製造假進度。

## 驗收邊界

工具測試、UI 測試與 paired Agent E2E 分開記錄。新增 Skill 不能取代工具接線與實際資料，亦不保證任何問題都有答案。
