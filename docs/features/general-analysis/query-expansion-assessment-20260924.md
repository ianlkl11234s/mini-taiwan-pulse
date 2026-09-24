# 資料查詢擴充盤點｜2026-09-24

## 方向

下一階段以「大部分合格資料可查詢」為優先，先擴資料讀取與基本統計覆蓋，再逐類開放精確空間分析。不要把全部資料升格為 actual，也不要因不能算距離而封鎖可合法讀取的名稱、類別、期間與數值。

能力分四層：L0 可搜尋來源與限制；L1 可查欄位/條件/完整範圍內筆數；L2 可分組統計、同口徑比較；L3 可做明示精度的空間分析。L1 不自動取得 L3 資格。授權不明仍須先補契約，不能以只查屬性繞過存取限制。

## 本輪可重現盤點

讀取隔離 mini 的 manifest / registry，沒有呼叫上游、DB 或付費服務。預設設定 62 個 dataset descriptors；開既有 raw boundary/population preview flags 後 66 個。都是程式登記數，不是 live 成功數。預覽資料不代表公開能力。

778 個 manifest 圖層：53 個有 query-enabled dataset 映射；121 個是直接單一 GeoJSON 按需候選；604 個目前無可用 query 映射或 reader。後兩類不是都沒有資料；55 個有 descriptor 的圖層中，2 個未開 query。獨立研究 dataset、同源多圖層與一層多 dataset 都存在，不能用 53/778 宣稱實際資料覆蓋率。

| 無可用 query 映射的 604 層 | 數量 | 解讀 |
|---|---:|---|
| custom | 451 | 未完成查詢來源分類，不代表新格式 |
| PMTiles | 97 | 有渲染來源，缺完整 records 讀取契約 |
| Supabase | 51 | 需逐 RPC 參數、權限、上限與 freshness 契約 |
| GeoJSON | 4 | 未符合現有單檔候選規則 |
| GeoJSON＋PMTiles | 1 | 混合來源需釐清權威資料 |

451 個 custom 中，明示 staticAssets 的格式：46 PMTiles、22 JSON、12 GeoJSON、3 BIN、1 PNG、1 JSON＋PMTiles；366 個未明示可分類檔案路徑。這是 manifest metadata 分類，不從 note 猜 URL，也不是來源去重結果。custom 與直接 PMTiles 層不可直接加總為獨立資料集數。

121 個直接 GeoJSON 候選的本機有界掃描（單檔最多 5 MiB，不下載）：67 可解析、3 超過本輪掃描大小、51 本機缺檔。67 個中，55 純 Point、2 Point＋null、9 純 Polygon/MultiPolygon、1 LineString/MultiLineString。尚未逐筆驗 CRS、座標精度、source/license/date、穩定ID、統計分母或遠端健康度。缺本機檔不等於遠端失效，超過 5 MiB 不是引擎拒絕證據。

逐層資料：[CSV 清單](./query-expansion-inventory-20260924.csv)。本機原始 registry/audit 輸出在相鄰 runtime/query-expansion-audit-20260924.json、query-expansion-source-inventory.json；工具腳本沿用 capability-audit.mjs 的邏輯，臨時副本改輸出位置並追加來源 metadata，未改舊歷史報告。

## 擴充路徑與優先順序

| 批次 | 工作 | 可解鎖的問題 | 驗收 |
|---|---|---|---|
| A 來源與能力清單 | 從既有 manifest/descriptor 派生 L0–L3 狀態，去重 canonical source、列出每層 blocker；補 custom loader 的宣告式來源索引 | 有什麼可用資料、哪些能查、缺什麼 | 每層有明確狀態；未知保留未知，不另造第二份手寫 registry |
| B 共用向量查詢 | 擴既有 reader 為受控 Point/Line/Polygon records；先選 55 純 Point 候選中的 10–20 合格來源，加入缺 geometry 但可查欄位的語意 | 查名稱、類別、行政區、筆數；資格合格才最近/疊圖 | 完整 bounded result、分頁不改分母、欄位/缺值/來源/bytes/hash/取消一致；新地點與獨立數字核對 |
| C 統計與 JSON 家族 | 沿既有 recipe/adapter 批次接可比較統計與結構化 JSON；核對指標、期間、區域、分母、版本 | 各地數值、排名、同口徑比較/期間變化 | 按代碼/期間查值即可，不因缺精確面而封鎖屬性分析；比例不可直接加總 |
| D 大型向量與 PMTiles | 上游提供同版查詢 sidecar（分片 GeoJSON/GeoParquet 等擇既有合適格式）、穩定ID、bbox索引與版本映射 | 大型土地、道路、設施查詢與局部疊圖 | 不從渲染瓦片或視窗 features 推完整數量；限制下載/掃描、去重與精度損失明示 |
| E 動態 RPC | 將已宣告 RPC 接共用受控 adapter，參數與 filters 下推、正確完整性/截斷回報 | 指定日期、範圍、事件類型、更新狀態 | allowlist、權限、取消、51-row 等 sentinel、有效期間/更新時間、missing/zero/撤回分開；不開任意 SQL |
| F Raster/格網 | 另做像素點查與有界區域摘要，與向量 row reader 分開 | 這個位置的影像/格網值、區域摘要 | CRS、解析度、NoData、時間、coverage；occupied-only 缺格不當0 |

A 與 B 第一批是建議下一輪實作範圍；C 可沿既有統計家族同步推進。D/E/F 先各找代表來源驗證，不一次接所有資料，更不為每個圖層增加 MCP tool。

## 既有 HOLD 的重新分流

托嬰、老人機構、殯葬資料：座標估位或混合來源會阻擋精確距離，但在來源/授權/欄位契約補齊後，可先開名冊欄位查詢與可信行政區統計。不能把地址推導行政區當官方行政代碼。

公廁：45,718 raw rows 被聚合為 13,281 地址代表紀錄；可考慮明示 derived/address grain 的查詢，不把後者稱為廁所或廁間總數。

社區活動中心：只涵蓋 8 縣市，可提供明示 coverage 的局部查詢，不必等待全國補齊；公務服務處仍先補 source/license/date。這些是擴充建議，本輪沒有改 HOLD 或開放 reader。

## 成功指標與範圍

先完成 canonical source 去重與 eligible denominator，再設定「多數」的量化比例；分列 discoverable、queryable、basic-analysis、spatial-analysis 覆蓋率，不只報工具數或圖層數。每批記錄 source records/缺值/排除、來源時間、冷暖下載與整題延遲，抽查新地點與失敗案例；不以 sample count 代替完整計數。

本輪只做盤點與文件；未啟用來源、未掃全量大檔、未驗遠端健康、未跑完整 browser 鏈，無部署、push、PR、merge 或擴大付費呼叫。當前瓶頸是來源契約、格式讀取、索引與完整性，不是缺少更多 Agent 或工具名稱。
