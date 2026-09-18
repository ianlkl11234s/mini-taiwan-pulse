# 第一階段：看地圖、探索資料

> 2026-09-18 後續本地實作與驗收請見 [探索能力計劃](exploration-capabilities-plan.md)；下文保留2026-09-17歷史快照。

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
- Gateway 僅接受 `search_layers`、`layer_details`、`describe_layer`、`map_context`、`find_places`、`layer_controls`、`geocode_address`；拒絕分析操作與 synthetic/result presentation。保留 null 清除舊狀態的相容性。
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


## 2026-09-17 設定探索與離線定位

工具新增 `pulse_get_layer_controls`、`pulse_set_layer_control`、`pulse_geocode_address`，共 17 個。搜尋的 20 是預設每頁筆數，應依 `totalMatched`、`truncated`、`nextOffset` 繼續查詢，不能把當頁当成全部資料。

圖層設定沿用 `layerParamsSpec`、`buildParamControls` 與同一個 UI onChange。Agent 先讀取控制項 ID、目前值、數值範圍／步進、可用選項、條件顯示與連動設定，再以 expectedValue 和 expectedRevision 修改一項。使用者已變更、隱藏／鎖定控制、無效選項或超出範圍均拒絕；連動修改後重新讀取設定。只涵蓋既有宣告式設定，尚未接入規格的特殊 UI 不宣稱可操控。

離線定位只查相機預設、經緯度與固定同源學校／公共圖書館 Point 資產，最多回 5 個候選並附來源與精度。一般住家地址並未有完整門牌資料庫。查不到為 no_match，來源無法讀取為 unavailable；多候選先請使用者選擇，不用城市中心取代未知門牌。定位後可移動鏡頭並開啟學校圖層，不代表已執行附近學校距離或數量分析。

目前不提供付費查詢，也不把地址送至外部 geocoder。Google Geocoding 的地圖顯示政策與本站 Mapbox 主地圖不相容，線上方案待使用者選定；官方政策：https://developers.google.com/maps/documentation/geocoding/policies 。


此次增量驗證：前端 tsc -b 通過；research/__tests__ 94 passed / 2 既有資料測試 skipped；bridgeClient 以真 Gateway handler 測試 7 passed。MCP build、33 tests 與 dist stdio 17-tool allowlist smoke 通過；Gateway 38 tests 通過。3732 前端與 8791 Gateway 已重新啟動，首頁 HTTP 200。新增設定／定位尚未做使用者帳號配對的 Codex→瀏覽器 E2E，不等同已驗證所有圖層參數。未部署、未付費查詢。


本地探索網站請使用 `npm run dev:exploration`，固定 3732 前端 → 8791 Gateway。不要使用未設定 PULSE_RESEARCH_GATEWAY_ORIGIN 的通用 dev 指令：其代理預設 8790，會造成建立配對失敗。Gateway 使用 `PULSE_RESEARCH_PILOT_EMAILS=<已授權帳號> node scripts/research/start-gateway.mjs`。


### 警察機關本地資料恢復（2026-09-17）

原 public 鏡像來源沒有 `police_justice/police_stations/police_stations_20260626.geojson`；Vite 對缺檔 URL 回首頁 HTML，不能以 HTTP 200 判定資料存在。已從正式站同路徑取回公開檔案，驗證 FeatureCollection、2,065 個 Point；SHA-256 `63dadd2cf7e764138e2cca8bdd57010464b91fb5c3d90afa8a65c8349e83e2e7`。本地 HTTP readback 一致，瀏覽器 z6.93 實際顯示點位。資料為既有 20260626 版本，沒有更新來源時間；此驗收不代表全站靜態資產均已補齊。檔案僅本地，不納入程式碼提交。


## 日期控制與取景原則（2026-09-17）

新增 `pulse_get_time_context`、`pulse_set_time`，共 19 tools。Context 讀取 Asia/Taipei 的日回放時間、live/replay、播放與速度；船舶提供已載入的最近 100 個可用日期、總數、完整起訖與截斷標記。尚未開啟船舶時為 not_loaded，Agent 可先開圖層後重讀；公車日期覆蓋目前 unknown。日期變更只使用既有 useTimeline actions，不建立另一個 clock。多年度歷史統計 UI 啟用時明確拒絕日回放指令。一般同步不重放時間指令；命令完成需讀回設定，但不代表指定日期 payload 已載入。

顯示原則：分布／區域概覽使用 pulse_fit_bounds，以實際地圖尺寸與可見側欄、動作卡、時間軸計算可見範圍，適量留白並將主體放在可見區中心。單一地點可使用明確中心與 zoom。禁止用固定1024px估計視窗；禁止宣稱任意 camera 就涵蓋完整地區。新面板完成 layout 後才計算，保留 reduced motion；手動拖曳後不搶回視角。多次查詢不應每次都移動鏡頭。工具描述與網站 helper 共同維護此規則。

日後視覺調整以「問題原句＋實際畫面＋理想畫面」作為驗收案例，區分範圍錯誤、遮擋、留白、點位大小、圖例與疊圖辨識，避免以單一固定 zoom 修所有情境。


驗證：frontend research suite 110 passed / 2 skipped（隨後 viewport regression 更新為 3/3）、tsc -b 通過；Gateway 39 passed；MCP 33 passed、build 與 19-tool stdio smoke 通過。真 Mapbox 獨立 layout harness（1280×720，左右 panel＋bottom timeline）safe rectangle `[368,46,1008,608]`，投影 bounds corners x550.65–825.35、y70–584，保留24px留白；初版未補償 padding 中心偏移時失敗，修正後通過。窄於最小可見區時回報 VIEWPORT_OCCLUDED。臨時 harness 已刪除。使用者帳號下 Codex→配對瀏覽器的新增時間操作 E2E 尚待驗收；沒有據此宣稱船舶或公車任意日期都有資料。

## 主題故事模板（2026-09-17）

使用者確認故事是探索延伸：先找主題適合的差異（區域、城鄉、系統或時間），查圖層與來源、寫好全篇，再編排場景與逐章呈現。已建立 [`pulse-map-story`](../../../.agents/skills/pulse-map-story/SKILL.md) 與故事腳本模板，並將個人 Codex skills 目錄連結至此工作樹的版本。

固定故事骨架是「總覽問題 → 對照 A → 對照 B → 可選例外／時間切片 → 整體收束」；比較軸依來源與地圖可見性決定，不固定北中南，不強迫每個題目都有差異。敘事分開觀察、背景與推測，沒有動態或歷史資料時不宣稱時段變化。

目前由 Codex 文字與既有 Pulse tools 呈現，手動下一章為預設。只有使用者要求且 host 有可中斷等待工具時，才能在當前回合自動停留並切章；這不是網站播放器，不提供網站倒數、故事面板或背景自動續播。每次故事稿與進度保存於執行 workspace 的 `artifacts/map-stories/`（若有檔案工具），不寫回 Skill，也不自動提交。
