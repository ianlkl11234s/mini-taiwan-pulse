> ⚠️ 歷史文件（已被 [PLAN-warehouse-20260926](../../PLAN-warehouse-20260926.md) 取代），只作查證，不作施工依據。

# 下一階段通用 GIS 分析：能力評估與交付範圍

日期：2026-09-24。這是規劃與說明文件；執行順序／狀態仍以 [plan.md](./plan.md) 為 SSOT。使用者已接續授權實作至第三片V03；不擴大 provider 呼叫、不發布。既有功能、本地驗證、正常對話驗收及公開可用是不同狀態。最新限制與操作順序見 [第二／三片驗收](./acceptance-V02-V03-20260924.md)。

## 1. 建議目標

下一個跨越應是「從有限來源的周邊問答，進到可組合、可解釋、可在地圖驗證的有界 GIS 分析」。可以開始疊圖、環域與可及性工具，但必須同時補資料存取契約、運算資格、穩定執行與結果呈現。

不以新增工具數量或圖層數驗收。首輪交付以四條完整工作流為單位：

1. 指定地點／範圍內，多種設施的數量、分類與來源限制。
2. 指定一段真實線形，分析其周邊走廊內有哪些設施；可看範圍、命中點與原線。
3. 兩個合格面資料的重疊區、覆蓋面積與範圍內設施；不把空間相交直接解釋為損害或因果。
4. 單一起點在指定步行門檻下可達的範圍與設施；保留路網版本、模型限制與未連通狀態。

行政區比較沿用既有工具，補期間／分母與結果解讀；有格網或合格小區資料前，不承諾「任意圓圈內人口」。

## 2. 現況：已有什麼、還不能說什麼

| 能力 | 現有基礎 | 尚缺的關鍵 |
|---|---|---|
| 資料探索 | 圖層目錄、dataset descriptor、能力盤點、部分 generic Point reader | 每個來源的完整存取與 geometry/時間資格，不能從 renderer 推論 |
| 周邊／最近設施 | query、直線距離、nearest、分組統計、獨立結果圖層已有案例 | 更多合格資料、精度分級、長輸出處理、同題穩定 batch |
| 空間關係 | 點落面、點面相交、逐區聚合、完整線面相交 | 面面交集／裁切的新幾何、面積／長度度量與一般 buffer |
| 分析範圍 | 中心與直線半徑的 generalized display scope | 不能把顯示圓升格為任意空間運算輸入；需另定可分析的 derived geometry 契約 |
| 區域比較 | 同指標、同口徑比較；本地同期人口占比 | 設施分子與人口分母對時、更多年份／邊界對照、normalized popup |
| 可及性 | 既有路徑距離、步行等時圈、provider receipt／consent 入口 | 可持續的路網服務、批次成本控制、需求格網、服務缺口方法 |
| 事件背景 | 固定地震 replay＋周邊背景、部分 current adapter | 道路來源密度限制、更新／撤回、事件時間匹配；proxy 點不能精確距離分析 |
| 效能與地圖 | 學校分片、bounded plan、collection＋framing、ready readback、圖例與主題 | 整頁重載配對恢復、正常對話20題SLA、面板擠壓、完整寬窄窗視覺矩陣 |

盤點數字引用 2026-09-23 的 [登記快照](./capability-audit-20260923.md)：778 layers、58 registered datasets、53 queryable layerrefs、121 個單檔 GeoJSON 候選。這是登記證據，不是今日全來源健康檢查；DEV 人口 preview 另列。723 個沒有 descriptor 的圖層不是723個必須各寫專用 adapter 的工作量。

最新真實證據見 [native 問答驗收](./acceptance-G01-native-agent-20260923.md)：板橋變體7/12數值核對通過，獨立Agent整題觀測107.011秒、12calls、1次錯誤ID、未batch；不能宣稱主task p95或90秒目標已完成。responsive持續連線已修，整頁reload恢復仍待修。動作卡light/dark追加修復提交為80091022。

## 3. 資料拓展：先做可重用的讀取類型

每個候選要回答四件事：能找到？能完整或明確有界地讀取？能做哪些運算？能以何種幾何顯示？讓能力矩陣同時列出支持原因、阻擋原因與下一步，不只給一個 ready 布林值。

| 資料族 | 下一步 | 驗收重點 |
|---|---|---|
| 靜態 Point GeoJSON／既有JSON | 先重用generic reader，選跨教育、醫療、公共服務的候選；以契約profile管理來源差異 | source SHA、總數、座標取得方式、排除數、日期與去重規則 |
| Line／Polygon 原始幾何 | 有界bbox reader或分析用sidecar；先一條線、一種區域面及另一合格面主題 | CRS、holes/multipart、量化精度、合法幾何、穩定feature ID、來源license |
| PMTiles | 保留為顯示；另供原始分析sidecar或有界後端讀取 | 不對目前viewport tiles或跨tile重複/切段feature直接當完整母體計數 |
| RPC／動態事件 | 在來源端支援bbox、時間或exact ID、分頁和一致snapshot | 外層filter不能修復上游先LIMIT的遺漏；濃密來源明確拒絕／續取 |
| 行政統計／人口 | 補明確期間、分母與boundary/code contract | 同年不必然同期；不能把整區總數直接灌進局部圈內 |
| Grid／Raster | 分後續階段：先定cell含義與no-data，再選一個區域統計案例 | 未列cell不是0；解析度、重採樣、像素面積、scale/offset及coverage |

首批建議盤點8–12個候選，從中完成至少三種不同存取／幾何路徑的代表案例；不為湊通過數放寬資格。所有候選最後都要留下可用、有限可用或HOLD的理由。圖層總數不當作完成率分母。

## 4. 進階分析工具如何分片

### 疊圖：區分「找出相交」與「產生交集」

現有within/intersects/line_intersects主要回答關係或篩選。下一片建議補有界的 clip/intersection 與 measure，讓結果保留新幾何及雙方來源；union/difference/dissolve 待交集與精度契約穩定後再補。

每個結果記錄：輸入result IDs、source/version、CRS、方法、geometry role、精度／容差、空或無效輸入、被排除項目。面積和長度不可直接把經緯度的度當公尺。僅邊界相接可能交出線或點，不能把非空交集都計為有面積覆蓋。PostGIS文件明示交集會產生共享部分的新幾何，且可用於clip：[ST_Intersection](https://postgis.net/docs/ST_Intersection.html)。

### 環域：先明確問題再決定是否造面

- 「點附近500公尺有哪些點」沿用距離predicate，沒有必要先造buffer再逐點相交。
- 「這條河／路線兩側200公尺」才需要line buffer；先支持公尺正距離、受限地域與明確cap/join規則。
- 「500／1000公尺分帶」要明確分累積圈與互斥環帶，避免累加重複計數。
- 新的分析buffer是derived，不是官方界線。現有display scope繼續不可分析；另設經驗證的derived geometry類型，不放寬所有generalized/proxy輸入。

引擎、CRS與精度必須先定。PostGIS的geometry buffer依座標系單位，geography則以公尺；其內部投影對大範圍或跨日期線有侷限，因此首輪應限制地域範圍：[ST_Buffer](https://postgis.net/docs/ST_Buffer.html)。

### 可及性：先把已有單點工具串成可用流程

先做一個起點、步行模式、單一門檻的等時圈＋合格設施篩選。完成後再加多門檻與少量多起點；多服務需求格網和全臺服務缺口排下一階段。

等時圈的正確性依賴路網、交通規則、snap、算法與版本。要分開可達、超過cutoff、找不到路網節點、no-data與未計算。網路涵蓋不能推論服務有名額、可進入或能滿足需求；只有設施點位也不能計算人口服務缺口。

既有公開Valhalla POC不能直接當成全臺批次運算後端。自管路網／既有內部服務／預計算快照的選擇另做資源與更新成本評估；本輪不啟動或擴大外部呼叫。

## 5. 執行架構與效能

保留 `dataset → bounded materialization → typed operations → resultId → collection/framing → ready/readback`。不要新增讓Agent任意傳SQL、任意URL或執行Python的捷徑。

- 小型有界資料沿既有路徑；量到主執行緒阻塞後才移至worker。
- 複雜線面overlay優先評估受控PostGIS/GEOS後端；正式選型前做一份真實複雜面與獨立oracle的bounded spike。前端、後端不要各自用不同算法算「同一答案」。
- 大範圍重複運算可預計算，結果帶版本、有效範圍與失效規則；瀏覽器只載入需顯示的幾何。分析原始幾何與展示簡化幾何分開。
- 成本預檢至少包含rows、vertices、candidate pairs、預估輸出上限、時間和provider calls。超額可縮範圍、回partial或轉背景工作，不靜默截斷。
- plan refs傳遞resultId；完整raw留在工具／變數內，模型只看摘要、binding與必要sample。pending接續、已完成步驟重用、不手填不可見ID。
- 快取key含來源／方法／參數／授權範圍；session撤銷不能從cache取回舊權限資料。

快不只看下載：量完整問答時間、首個有用結果時間、工具往返、傳輸量、計算與渲染。對話20warm沿既有G01，cold與較重GIS作業另列；不把20次工具loop視作20題問答。進階作業先量基線，再決定門檻，不把90秒承諾套到任何規模。

## 6. 地圖呈現是每片的完成條件

給運算結果一致的角色：中心、分析範圍、輸入設施、命中設施、交集／排除區、不可用區；用填色、線型、符號和標籤共同區分，不只靠顏色。維持可查看原始來源的入口。

每片都驗：深淺底圖、窄／寬窗、側欄開關、選取與hover、legend單位/分級、popup的原值/normalized值/時間/限制。未覆蓋與0使用不同符號。多比較區域有可辨識外框，不把非數值差別做成看似排名的色階。

先改善面板與camera的協調，避免為了保留左右面板把研究範圍縮成一小團；可折疊歷史動作、在呈現後收起非必要面板，但保留使用者控制。使用者明示不移圖必須遵守。島嶼不能裁掉冒充完整bounds，可用總覽＋主區放大或分幅呈現。

驗收需有真實可見結果與readback；ready只證明source/layer狀態，不代表字看得清或問題範圍適當。

## 7. 好讀說明書與Agent skill

已有pulse-gis-analyst主入口及analysis-recipes、semantic-guardrails、map-session、acceptance；已有accessibility-analysis供路網/格網語意。下一步應整理成分層入口，避免再添一份巨長、每題都讀的skill。

| 交付 | 讀者 | 內容 |
|---|---|---|
| 使用者GIS分析說明書 | 使用者 | 我可以問什麼、需提供什麼、地圖怎麼讀、不能推論什麼、失敗如何續做 |
| 簡短skill入口 | Agent | 判斷問題→讀能力→選配方→檢查資料→執行plan→呈現→解釋限制 |
| 按需配方references | Agent／開發者 | 周邊、行政比較、點面、buffer走廊、overlay、步行coverage，列必要輸入與停止條件 |
| 機器可讀operation契約 | runtime | 支持的geometry、參數、units、預算、輸出bindings與錯誤類別；能力由此派生 |
| 行為驗收題組 | QA | 未見地點／措辭、錯期間、無覆蓋、來源失敗、pending、撤銷、效能與視覺 |

每張配方只教方法，不放預算好的地名答案。至少包括「問題型態、必要資料、已宣告工具、plan相依、地圖角色、證據、失敗處理」。尚未實作的工具要明確標planned，不能讓skill宣稱已可呼叫。Skill是引導，schema與runtime守門仍是權威；A03已證明只寫『優先batch』不保證Agent實際遵循。

## 8. 建議交付順序與依賴

| Gate | 可交付行為 | 驗收與停止條件 |
|---|---|---|
| V01 穩定執行基線 | 不需反覆配對；計畫refs、pending/partial與摘要穩定 | 正常Codex全鏈；reload/expiry/revocation分開；無效重試為0；保留G01問答時間矩陣 |
| V02 資料能力擴充 | 跨主題點位＋合格線／面有界讀取 | 候選逐一source/geometry/時間資格；至少三條資料路徑有真實正例；不合格保留HOLD |
| V03 走廊與交集 | line buffer＋點篩選、面面clip/intersection＋measure | holes/multipart/邊界相接/空結果/無效幾何/預算超限；獨立oracle與新地點native地圖 |
| V04 有界步行coverage | 一起點、一步行門檻＋設施交叉 | graph/profile/來源版本及consent；未連通/缺資料反例；不以直線替代 |
| V05 產品化與引導 | 四條工作流可讀、可用、可接續 | 人用說明書＋skill配方；深淺/寬窄視覺；完整正常對話與使用者驗收 |

V01和V02可在不同ownership下並行；V03依賴合格線面與運算預算；V04復用已有provider入口、依賴V02設施資料，不必等所有overlay完成。V05文稿與視覺設計從第一片開始，不等工具寫完才補。Raster、多起點OD matrix、全臺格網缺口、選址最佳化、熱點顯著性／因果分析不列本次承諾。

## 9. 工作方式與首片

沿現有隔離mini/mcp/gateway，不動原checkout或現有他人配對。主agent決定契約、語意、後端與呈現策略；Luna盤點與來源檢核；Terra依ownership實作／review。先驗schema/operator，再transport、native Codex→MCP→Gateway→browser、獨立oracle和人工可讀性，分片原子commit。

第一片可直接定義為：修reload恢復＋plan binding/摘要，並產出下一批資料qualification表；以兩個新地點完成現有周邊工具全鏈。第二片再做一條合格線的走廊分析與一組合格面的intersection。此順序讓來源缺口與新算法問題分開定位。

本計畫不自動授權遠端migration、部署、push/PR/merge、路網服務啟動、付費API擴量或整批下載。需要資源時先提出具體規模、更新方式與費用；可先做本地樣本和可review的實作。

## 10. 實作證據入口與下一任務啟動條件

- [資料型別與存取契約](../../../../../src/research/dataContracts.ts)：目前沒有raster dataset kind／window統計契約。
- [Dataset registry](../../../../../src/research/researchDatasets.ts)：Point來源、PMTiles與proxy的資格分流；[能力說明](../../../../../src/research/layerCapabilities.ts) 區分顯示、完整讀取與可運算。
- [行政界adapter](../../../../../src/research/administrativeBoundaryAdapter.ts) 與 [bus線形adapter](../../../../../src/research/busRouteDatasetAdapter.ts)：可重用契約的出發點；raw行政面目前owner local，不能當成已公開。
- [分析操作](../../../../../src/research/analysisOperations.ts)、[分析session](../../../../../src/research/researchAnalysisSession.ts) 與 [bounded plan](../../../../../../mcp/src/research/analysisPlan.ts)：優先延伸既有typed chain，不另立平行工具系統。
- [路網provider](../../../../../src/research/networkProvider.ts)：已具受限POC入口；不是可直接擴成全臺工作負載的服務承諾。
- [Agent主入口](../../../../../.agents/skills/pulse-gis-analyst/SKILL.md) 與 [分析配方](../../../../../.agents/skills/pulse-gis-analyst/references/analysis-recipes.md)：下一輪擴寫references，不把所有進階內容塞入入口。
- [最新交接](./handoff-20260923.md) 優先於較早驗收文件；舊文的56 datasets、人口未接／手機bridge未修不是最新現況。

下一個執行任務可使用以下範圍：

> 依plan.md的V01–V05與本評估書接續。先完成V01穩定性與V02資料qualification第一片，主agent整合，Luna唯讀盤點、Terra有界實作。保護原checkout與其他配對，不擴大付費、下載或遠端寫入。每片使用新地點／措辭與獨立oracle，跑正常Codex→MCP→Gateway→browser，分別報正確性、速度、可見性、可讀性與未完成。V03/V04只在所需來源與執行預算過門檻後實作；不得用display幾何或無來源數值補通過。分片本地原子commit，不push、PR、merge或部署。

此範圍已獲使用者授權開始首片；進度以plan.md為準。尚未啟動新分析後端。
