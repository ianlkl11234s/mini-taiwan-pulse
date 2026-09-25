# 通用地方分析計畫與驗收關卡

> 最新狀態（2026-09-25）：依新對話回饋執行新版六片，見[回饋修正與驗收](./acceptance-feedback-six-20260925.md)。本地工程、browser 外觀與正常配對全鏈分開記錄；未完成全鏈不得沿用舊六片的完成標籤。前版證據保留於[2026-09-24 驗收](./acceptance-six-20260924.md)。

更新：2026-09-25。計畫 SSOT；後續 session 先讀本檔，不另起競爭 roadmap。

## 全資料分析覆蓋：2026-09-25 跨夜工作

使用者已授權自行確認本地配對、測試、隔離 worktree 實作與原子 commit。目標為每個圖層可查到分析能力與缺口，所有具備合法完整來源的資料逐步接入合適運算；**全量盤點完成不等於全量可分析**。PMTiles 不是一概豁免，也不從視窗中繪出的 tile features 當完整資料。

當前程式預設 registry 重算（不含DEV注入的本地人口preview）：778 個 manifest 圖層、85 個 descriptor datasets；78 個圖層已有 queryable mapping、105 個 GeoJSON 待載入驗證候選、595 個未提供可用查詢映射（含1個明確禁止查詢的descriptor）。79 個圖層有 descriptor。圖層開關、來源檔、dataset、指標不是同一粒度。詳見 [可重跑覆蓋台帳](./analysis-coverage-20260925.md)、[本夜分片驗收](./overnight-coverage-20260925.md) 與 [十層來源試跑](./ten-layer-spatial-trial-20260925.md)。這些數字不是778份來源都通過live驗證。

| 順序 | 交付與工作 | 完成判準 |
|---|---|---|
| N0 現有功能驗收 | 全22縣市比例、嘉義五物件、深淺底圖與独立透明度 | 正常MCP鏈、ready/readback及目視分列；未測互動不得補勾 |
| N1 全量能力台帳 | 每個layer對應descriptor、來源家族、blocker與分析路徑；新快照不覆蓋歷史 | 778列無遺漏，分類互斥總和一致；多來源計數不冒充獨立來源 |
| N2 靜態Point擴充 | 先檢118候選中已有本地資產的純Point；按source去重，批次驗證，合適者接既有共用reader | 來源/授權/時間/CRS/穩定ID/完整筆數/缺值可查；proxy仍不可冒充actual；至少新地點及變體 |
| N3 custom與統計 | 從既有loader/recipe找canonical JSON或GeoJSON與參數，優先同schema家族 | 以家族共用adapter，逐dataset契約；僅顯示、未知授權、無完整來源留明確blocker |
| N4 PMTiles與線面 | 查上游同版原表/GeoParquet/GeoJSON，建立analysis sidecar對應與一個合格試點 | SHA、穩定ID、分片索引、coverage、geometry precision一致；不得由抽稀/裁切tile推全量計數 |
| N5 RPC與raster | allowlisted參數及完整性receipt；有物理值的raster做取樣/區域統計路徑，純配色影像標明限制 | 權限、時間、分頁/截斷、NoData與觀測零分開；不得將彩色像元猜成物理值 |
| N6 整合收尾 | 新地點多来源查詢→分析→地圖；完整台帳、失敗原因、下一批入口與原子commit | 本地測試、runtime、browser、publication分列；不虛報100%或發布完成 |

過夜排程：沿用既有 Pulse heartbeat，2026-09-25 每30分鐘接續一片，08:00 Asia/Taipei 停止新增工作並在本節留晨間交接、停用排程。原始分析session可能到期，不能將排程啟用當成未來已完成。

### 08:00 晨間交接（2026-09-25）

> 08:00 交接數字保留為當時快照；其後使用者另行授權的十層試跑見下節。

已停止新增分片，`mini-taiwan-pulse` heartbeat 已更新為 `PAUSED`。隔離 `research-streamline/mini` worktree 的程式與台帳分片均已原子 commit；原 checkout 未清理，沒有 push、PR、merge、部署或擴大付費 provider 呼叫。08:00 前再次確認配對 session active、前端 3734 與 Gateway 8794 正常監聽；這是本地 runtime 證據，不是日後仍連線的保證。

最新可重跑台帳：778 manifest layers、84 datasets、78 層有 descriptor、77 層有 queryable mapping、105 個 GeoJSON metadata candidates、596 層 unknown/unavailable。最後一片 i郵箱 `510dfeaa`／`befb3b06` 已以 2,345 筆固定 Point 來源通過 focused tests 3/3、`tsc -b`／build、馬祖新地點及台／臺變體、正常 MCP→Gateway→browser `ready` revision 52 與 map readback／目視。完整 1,974 tests 回歸屬較早切片收據，**未在最後一片重跑**；不得稱整個 778 層完成 runtime 驗收。

### 08:00 後：596 中十層來源試跑

本次使用者另行要求從當時 596 unknown/unavailable 中挑十層走讀來源與運算路徑。結果見 [十層來源試跑](./ten-layer-spatial-trial-20260925.md)：`agriPOI` 固定 839 Point reader 已通過埔里 10 km、正常配對呈現及 browser readback，其餘九層各有明確來源／權限／幾何／時序阻礙與下一步。重跑台帳更新為 85 datasets、79 descriptor layer mappings、78 queryable、105 metadata candidates、595 unknown/unavailable（594 缺 reader，1 query disabled）。此片沒有把未接的九層當成可用分析，也未重跑前夜完整回歸。

後續施工依 [全圖層空間分析覆蓋執行計畫](./all-layer-spatial-coverage-execution-plan-20260925.md) 的 P0–P7：先按原始來源歸併 595 層，再驗縣界 Polygon、林道 Line、公司點大量資料，將合格結果組成「點附近」多類別地圖，最後按來源家族批次擴充與分類 HOLD。此文件是本節的可執行子計畫，不更改前夜 N0–N6 的歷史驗收。

下一步先按 [晨間待決與來源 gate](./overnight-coverage-20260925.md) 處理同版來源及授權。`stationsTRA/Metro` 需對齊混合資產的 212/291 子集和來源契約；`bikeStations` 缺本地宣告資產。另一個具體入口 `jpAirports` 已核對上游／展示同版 108 Polygon，官方 C28-21 資料基準日 2021-12-31、商用可；應先核對完整欄位、缺值、座標轉換與來源條款，再開 bounded Polygon reader。PMTiles 完整幾何、未登記 RPC 與物理值 raster 仍未完成，不從顯示 tile／彩色像元推算。恢復時先查此節與最新台帳及 git/runtime 狀態，不重做既有收據。

執行方式：本夜先依N0→N1→N2推進，再挑N3–N5有現成契約的來源；缺上游artifact時記錄可執行補料工作，轉做可用家族。不得為達數量放寬授權/geometry gate、任意掃資料庫、下載全國巨型檔或增加付費provider。主agent負責整合與語意；Luna 做有界分類／簡單文件，Terra 限 owned 檔實作，最多3 worker、不遞迴。

本夜已交付全量分類、可重跑台帳、合格 Point／統計／PMTiles 屬性試點及 RPC／raster gate；**沒有讓缺來源契約的596層全部通過分析**。阻礙是原始資料/權限/粒度/缺值/幾何版本/時序，不只是加工具。技術核心收尾門檻是每種已支援家族都有代表性真來源驗收與 fail-closed，資料接入覆蓋則持續按台帳清理。

恢復入口：只讀本節、最新台帳及[六片驗收](./acceptance-feedback-six-20260925.md)，先git status與runtime port/session檢查；不重做已完成查詢、不清storage、不停止其他服務。沿用research-streamline三個隔離checkout；不push/PR/merge/deploy。每片必要測試及 `npx tsc -b` 通過才exact-path commit。遇付費、大量下載或來源權限缺口先保留阻擋證據，繼續獨立工作。

## 不變的目標

以使用者蒐集的開放資料回答：①這個點周圍的情形；②這個地區與其他地區比較；③這個縣市與其他縣市比較；④即時事件與周邊背景的交叉解讀。以分析正確性、來源可追溯與完整問題回應速度驗收。通用性來自可組合操作與資料契約，不是為每題寫專用 adapter。

任何工作必須指向上述至少一類問題及下表驗收編號。新增模型、工具、圖層數或漂亮視覺本身不算完成。未授權資料不可進候選；無資料不等於零；相關不等於因果；統計期間不能冒充即時。顯示 geometry 與分析 geometry 分開。

## 基線與執行邊界

- 原已提交：Mini `da7b08cc`、MCP `326fb10`、Gateway `cc484a3`。
- 延續 `mini-taiwan-pulse/.worktrees/research-streamline/{mini,mcp,gateway}`，保護原工作區；本計畫不包含 push、merge、deployment 。
- 既有 14-step paired-browser warm analysis 約 9.0–9.3 秒；不含模型思考、配對，不代表整題 90 秒 SLA。
- 主 agent 負責契約、語意及整合；Terra 有界實作，Luna 有界盤點。明確 file ownership，不同時改同檔。
- 每張驗收單記錄：固定輸入、資料版本、預期行為、實際結果、測試/網站證據、耗時、已知限制。工程自驗與使用者驗收分列；未檢查不標通過。

## 分階段交付

| 階段 | 交付與使用者可驗收的行為 | 工程通過條件 | 狀態 |
|---|---|---|---|
| S1a 語意底座第一片 | 同指標的 series 可比較；已知不相容或缺證據時阻擋；query 範圍不遺失 | 對正確/錯誤/未知輸入的回歸測試、跨區不可被 datasetId 一刀切、tsc | 本地工程通過；使用者待驗收 |
| S1b 共用研究範圍 | 回答前列出位置/區域、時間、比較對象、距離定義、指標與分母；資料缺口可讀 | 三類需求共用 scope 契約，經 typed MCP/Gateway/browser；不可比較原因可讀回 | nearby／comparison／walking 證據面板通過；event scope 與完整 budget 契約待補 |
| S2 周邊交叉分析 | 指定點＋半徑，至少兩種來源＋行政統計；地圖與來源表一致 | A01–A03；人工/獨立 reference 數字吻合；不是 rendered-points count | 固定周邊案例通過；完整失敗情境仍按 A03 補驗 |
| S3 地區與縣市比較 | 相同指標比較兩區、兩縣市；總數/密度/人口分母明示 | A04–A07；比較前守門、數值及分母 oracle；拒絕把區域統計任意分攤到圓內 | 核心兩區／兩縣市比較及同源男女人口占比通過；A05 跨來源服務數／人口仍受期間與口徑關卡阻擋 |
| S4 事件與背景 | 事件位置/時間交叉人口、設施、環境，區分觀測與推論 | A08–A10；先固定歷史 replay，再 fresh feed；過期/延遲顯示且不推因果 | 固定CWA歷史事件＋學校／縣市背景通過；事件時點人口與fresh feed待補 |
| S5 資料與計算加速 | 同一答案下載更少、計算更少；先處理 S2–S4 量到的瓶頸 | 精確分片＋bbox/index、同版快取；優化前後結果等價、傳輸量及時間對照 | schools local分片全鏈通過；首次bytes減95.08%、12IDs完全一致，其他資料與公開發布待補 |
| S6 Jev 與整題驗收 | 找相關資料、選操作、必要時升級強模型；不再反覆描述全目錄 | A11–A12；已授權候選、未知保留、召回率/誤選/成本/整題時間 A/B | 工具與Skill已實作、真實對話已觀察；未通過完整90秒目標，Jev A/B與泛化驗收待做 |

不等全計畫完成才交付。每階段交一張可重跑驗收單；如該階段只完成部分，明列子階段與欠項，不用測試 fixture 冒充網站實測。使用者驗收不自動授權發布；下一階段設計可繼續，但不可繞過依賴的正確性關卡。

## 共同研究範圍（目標契約；目前以 evidence panel 實作部分欄位）

- questionKind：nearby / region_comparison / event_context。
- geography：明示中心＋radiusM、行政區 codes＋boundary version，或明示 bbox；原始請求與實際執行範圍均保留。
- time：事件發生、資料觀測、發布、取得時間分列；比較期、timezone、resolution 明示。
- measures：指標定義、source grain、單位、aggregation、分母及 population scope。
- comparison：比較對象允許不同地區與 release；須有共同定義及明示 period alignment，不以「datasetId相同」替代語意檢查。
- evidence：dataset/release/source refs、precision、coverage、missing/suppressed、完整或有界子集、選擇/排除原因。
- budget：候選數、資料量、計算量、模型/工具等待期限；partial 回覆可續跑且不冒稱完成。

S1a 不將日/週 event series 當成年統計跨期比較；年度/學年與行政 snapshot 的可比性在 S1b/S3 明確建模。

## 使用者驗收題庫（預期是行為，不預先捏造答案）

| ID | 固定問題/條件 | 你要看到什麼 |
|---|---|---|
| A01 | 中心 [121.5318,25.0464]，直線 2km，學校＋圖書館 | 同一範圍多來源、分類數量、完整來源 grain、地圖高亮；資料版本可查 |
| A02 | A01 加所屬區與縣市統計 | 正確行政區；統計期間與單位明示；不把全區住宅數稱為 2km 內住宅數 |
| A03 | 明確無覆蓋或來源失敗 | unknown/unavailable 與 observed zero 不混淆；成功部分仍可讀 |
| A04 | 兩個同層級行政區、同一統計 release | 數量/差值/比例、來源與分母；不因區域不同拒絕 |
| A05 | 兩縣市服務數量及每萬人口數 | 服務及人口來源期間對齊；分母缺漏/零時不製造排名 |
| A06 | 故意混用不同單位或日/週解析度 | 明確拒絕比較並列出需要對齊的項目 |
| A07 | 邊界改版、學年與曆年、不同指標名稱但同單位 | 要求定義/對照；不能只因單位相同便說可比較 |
| A08 | 固定事件 replay＋事件時點附近設施/人口 | 可重現 affected context；背景資料年份、事件時間、估計性質分開 |
| A09 | 延遲/過期事件、撤稿或缺座標 | 顯示 stale/缺口；不能以最後快取當作最新事件 |
| A10 | 河川/道路線與行政區交叉 | 已支援才執行；未支援明確回報，不能以端點或中心點偷代替整條線 |
| A11 | 繁中同義、跨主題、不明確問題 | Jev 縮候選但保留無匹配/未知；與人工標注比較 recall、錯選 |
| A12 | 同題 cold/warm、Jev 開/關 | 同一結果與來源，逐段耗時可比較；模型錯誤、缺資料、服務失敗分開 |

首輪 A01/A02 沿用已登記教育/文化/統計資料。事件來源先盤點 current adapters/access/freshness 後選取，不假設每個顯示圖層已有 reader。fixture、歷史 replay、live feed 三種證據分開。

## 速度與準確度的量測

- 計時從 Agent 收到固定問題到來源說明及 ready/readback 完成；配對前置成本另列。
- 分段：候選檢索、Jev、強模型、MCP queue/transport、下載/parse、計算、呈現/readback；記錄 bytes、cache hit、工具呼叫次數。
- 90 秒是完整 warm workflow 目標，不以 9 秒工具鏈冒充；先至少 20 次固定樣本報 median/p95/max，cold 另列。timeout/失敗不能從分母刪除。
- 計數、join、區域匹配須與獨立 oracle 一致；連續值採按指標預先聲明的數值容差，不能只驗自己重算自己。
- 快取/分片優化須驗資料版本、code 集合、幾何與輸出等價；未知、缺值、suppressed 不得變零。
- Jev 用已標注繁中樣本校準門檻；分類信心不等於答案正確率。精確名稱已命中可直接走程式。

## 本輪交接

2026-09-22 使用者追加授權執行到 S3，並自行出題驗收；包含現有 local/Google geocoding、Valhalla 步行與淡白操作光暈。沿用既有 provider 與 consent，不新增外部服務或購買額度。語意底座見 [S1a 驗收單](./acceptance-S1a.md)，本輪實作與逐題證據見 [S1b–S3 驗收單](./acceptance-S1b-S3.md)。已做到核心區域比較；下一個切片先補 A05 人口分母的上游獨立快照與口徑契約（目前 HOLD，不能從衍生率反推），再做 reader 接線並量測完整 warm workflow，之後依量測做資料分片。S4已完成固定CWA歷史事件＋周邊學校／縣市背景第一片；人口與fresh feed仍待補。


## S1b–S3 本輪固定考題

- T01：121.5318,25.0464，直線 2km 的學校／圖書館數量，與獨立原始檔計算一致；行政區背景不稱為圓內統計。
- T02：2020 住宅總數，中山區 vs 大安區，原值/差值/相對基準可核對且地圖呈現 2 區。
- T03：114 學年國小師生比，臺北市 vs 新北市；相同維度與期間，不將比率再次加總。
- T04：官方同年度每萬人口率兩縣市比較；原生率與自行計算率分開。額外人口分母未接妥時拒絕自算，不以教師或學生人數替代人口。
- T05：錯單位、錯期間、錯邊界、duplicate、missing/suppressed/zero；確認安全拒絕或保留缺值。
- T06：公開地標本地地址定位；Google key 未設定須明確 disabled。公開座標步行距離與等時圈實測，有版本/時間/單位；失敗不可回直線替代。
- T07：真實查詢中光暈出現，完成/失敗消失；pointer-events none 與 reduced-motion 驗證。

Google/Valhalla 只傳送本輪公開測試地標；不使用使用者私人位置。網站能力、mock/fixture 與 provider live 證據分列。

### A05 來源關卡（2026-09-22 補查）

既有公開統計 manifest 未提供 standalone population release。醫院每萬人口衍生檔僅涵蓋 159/368 鄉鎮；教育縣市率雖有 22/22，分母依附學年衍生結果，均不能替代獨立人口來源。analytics 本地 population parquet 存在，不等於 R2 發布完成。文件的「現住人口」與「戶籍人口」用詞須回到原始來源 receipt 確認。

下一切片可驗收交付：① canonical 縣市人口快照，含 22 縣市 coverage/status、人口口徑、觀測日期、immutable boundary SHA 與來源；② local preview 與公開發布狀態分列；③ reader 只接已符合契約的 snapshot；④ 明確測試年度分子搭年底人口的對齊規則，不放寬成只比較年份。現有 strict period/boundary 守門保留，尚未宣告任意 per-capita 分析完成。

## 已啟動的過夜執行：2026-09-22 至 2026-09-23

使用者明確授權將原估 1–2 週範圍排入今晚依序推進，完整驗證及原子 commit；不承諾以時間取代品質。目標截止 2026-09-23 08:00 Asia/Taipei：停止新增範圍，完成在手安全檢查，產出晨間報告並停用本次 heartbeat。若晚於截止才恢復，先交接並停用，不補開全天工作。

### 順序與驗收

| Gate | 工作 | 放行條件 | 初始狀態 |
|---|---|---|---|
| N01 | 全圖層能力清單；人口／設施／統計／事件優先 | 可重跑生成；區分 discovery、reader、operation、unknown；不固定宣稱728 | 登記盤點完成：778 layers／56 datasets／53 queryable layerrefs；來源健康另驗 |
| N02 | 既有人口來源、22縣市快照本地準備與analysis接線 | 原始口徑/觀測時間/coverage/邊界核對；本地preview與發布分列；不從衍生率逆推 | 來源/22縣市local preview、materializer與browser雙北比較通過；分母alignment仍HOLD，見acceptance-N02-browser-20260923 |
| N03 | 補一項共用線面操作，接現有typed分析入口 | 穿越/holes/multipart/邊界/無效幾何正反例；獨立預期值；完整transport/browser | raw縣界重新驗收通過；公開統計generalized邊界已取消空間分析資格，見acceptance-N03-N04 |
| N04 | 固定歷史事件＋周邊設施／行政背景案例 | 明示事件時間/資料年期/觀測與推估；stale/缺座標不冒充即時 | 115064＋10km學校＋臺南市背景全鏈通過；事件時點人口/fresh feed仍partial |
| N05 | 20次warm工具鏈＋cold與瓶頸分段 | 成功與失敗均記錄；p50/p95/max、輸出一致性；避免結果store汰換破壞地圖 | 修正後固定版本20 warm通過，median4186ms／p956534ms／max7864ms；舊窗口另保留，不含模型與呈現 |
| N06 | 依量測做一項資料量/重複工作優化 | 數值/幾何/缺值語意等價；下載bytes/耗時前後對照 | schools 82 shards local DEV全鏈通過，2504719→123196 bytes；warm下載0，見acceptance-N06-20260923 |
| N07 | 整套回歸、網站驗收、skill/文件與commit | unit/typecheck/build、fresh stdio、Gateway、ready/browser readback分列；原子commit與晨間表 | 每切片執行，最後彙總 |

### 執行與恢復規則

- 工作根 `mini-taiwan-pulse/.worktrees/research-streamline/{mini,mcp,gateway}`；原checkout dirty files禁止改動。跨repo新工作先讀適用規則且隔離，不能直接commit他人的改動。
- 主agent統一plan與驗收，worker最多3個、Terra/Luna、有界ownership，不同時修改同檔。重啟先查agent/進程/最新commit與本節；不重跑已通過且程式未變的測試。
- 每關更新狀態、證據檔、測試及commit；需完整鏈的關卡未跑browser就標partial，不能用fixture替代真實來源。
- 缺來源契約可做本地準備與拒絕測試，但不繞過語意guard、不冒稱發布；同類外部錯誤最多重試2次後轉其他獨立工作。
- 只允許已授權本地修改與精確path commit；禁止push/merge/deploy、遠端DB/Storage寫入、變更API權限或購買額度。Google只用公開測試地標且逐call consent，不批次付費抓資料；不另啟付費模型API批量工作。
- 不做全國大型下載或整夜無界壓測。新增下載/產物合计以1GB為上限，超限縮樣本並記錄；單次測試10分鐘無進度先診斷，不盲目堆進程。
- 最終報告 `docs/features/general-analysis/morning-report-20260923.md`：完成/partial/blocked，固定考題，完整來源能力數，效能與限制，commit清單，下一步3項。未有實測不填時間承諾。
- 暫存收據 `../runtime/`；不可提交.env、密鑰、私人TGOS cache或Google原始candidate。Google配置由明確 PULSE_RESEARCH_ENV_FILE 載入。
- 截止後保留用戶預覽與必要服務，不停止其他專案進程；本次heartbeat自動停用。


## 2026-09-23 日間續作：三項剩餘目標

使用者於過夜交接後再次授權繼續。沿既有隔離工作樹、原子commit與驗收規則執行；過夜08:00截止只適用已結束排程，不阻止本次主動續作。不重新啟用heartbeat，不push/merge/deploy。

| Gate | 本次可驗收交付 | 完成判準 |
|---|---|---|
| D01 人口分母交叉 | 嚴格人口口徑／期間對齊規則與真實同期間案例 | 核實分子原始來源、兩方期間/邊界/單位；獨立數字oracle與browser；沒有來源則明列HOLD，不用fixture冒充實際案例 |
| D02 事件生命週期 | 歷史與目前資料分開、明示取得/更新/撤回/缺值 | 只使用來源真正提供的欄位；固定負例與bounded live讀回；ready/readback；來源不支持撤回時明示unknown |
| D03 通用來源覆蓋 | 全manifest能力/缺口可讀、首批候選由metadata走到驗證來源 | 現有generic reader優先，逐來源hash/schema/geometry/coverage守門；unsupported有具體原因與下一契約，不宣稱任意資料互相可比 |

三項由主agent整合，Luna盤點候選，Terra人口與事件有界review/實作。先建立實際來源證據才做資格提升。來源的時間、授權或geometry不足時不因使用者要求通用性而猜測。

### D01–D03 本次已驗收進度

- D01：`8f2990be` 人口 dimensions guard 完成；22縣市local preview可用。沒有足以證明同期的設施分子，真實 per-capita 仍HOLD。
- D02：`b79c6807` 有界七天/50筆事件窗；source第51筆即拒絕；live window與exact事件一致。歷史事件＋3所學校＋臺南背景全鏈、4features ready/readback通過；更新/撤回仍來源unknown。
- D03：`19972847` 共用SHA/count/selection驗證；護理1499/1611子集，2km28筆、bbox60、最近5逐值oracle一致，28features ready/readback。10個既有候選完整source SHA/count皆核對。正式registry 778layers/57datasets/53queryable layerrefs，非778都可交叉。
- 補修：`1e0a4c2e` recordSearch與aggregate能力分列；`78df1508` 窄viewport framing padding對齊。
- 完整證據與剩餘關卡見 [日間驗收](./acceptance-D01-D03-20260923.md)。原dirty checkout保留，僅本地隔離commit，排程不重新啟動。

- `87f17f05`：能力清單單次registry snapshot，去除每層重複schema validation；維持transient即時性與存取限制。


## E01–E03 接續切片（2026-09-23）

使用者再次授權繼續；沿同一隔離branch，commit而不發布。

- E01：同SEGIS 2025-12 CSV已有 M_CNT/F_CNT/P_CNT，可驗證男女占比與縣市比較。新增固定local preview profiles，保留22縣市raw boundary/來源SHA；設施人均率仍HOLD，不把同來源占比說成跨來源設施驗收。
- E02：TDX current RPC已提供生效/到期/LastUpdateTime，接有界51筆sentinel reader，以acquiredAt判生命週期；mixed source geometry只保留原資料，不授予空間分析資格。不因缺席推論撤回、不提供假的歷史asOf。
- E03：逐一查托嬰／老人福利／長照／身障／心理衛生來源，皆無本輪upstream_wgs84/upstream子集；維持來源可探索及座標精度待核，不能只為增加數量升為eligible。後續需TDX/TGOS來源精度證據或其他已驗證座標profile。

驗收順序：builder與independent22縣市oracle → unit/tsc → fresh stdio及Gateway → 人口比較ready/readback；道路current分列live讀取、生命週期計算與不適用的地圖呈現證據。

### E01–E03 驗收結果

- E01 本地通過：22縣市總/男/女來源核對、雙北占比與錯誤分母拒絕，fresh工具鏈4648ms、2features ready/readback。設施同期人均率仍HOLD。
- E02 partial：reader與四項測試、資料端unexpiredOnly已完成；最新兩個live scope皆51 sentinel拒絕，沒有真實生命週期正例，不宣稱完整道路分析。
- E03 HOLD：五項福利來源沒有本輪固定upstream WGS84子集；保留generic探索，不升格精度。正常registry更新為778layers/58datasets/53queryable layerrefs。
- 原子commit：704be1bf、805ad2e9、715b314b、9fba8a10。完整證據與後續三項見 [E01–E03驗收](./acceptance-E01-E03-20260923.md)。

## F01–F03 查明來源限制並準備下一契約（2026-09-23）

- F01：實際唯讀RPC 51筆全部source/type符合且expire_time全NULL，未到期篩選無法縮小的原因已證實。前端先核契約再報dense、transport/config錯誤測試通過（5fe3c99d）。既有RPC無更細selector，外層filter會造成假完整，禁止採用。
- F01 SQL草案：既有gateway隔離worktree新增source+exact-ID/有界last_updated selector提案，在本地PG17.7合成67筆資料通過，含第60筆後精確查詢、51 sentinel、時間界限、十個錯誤guard與ACL；交易rollback且本地PG已停止（2a8ded5）。未成migration、未remote apply、前端不依賴草案。
- F02：115950找到2025年12月護理床數，是容量不是設施數，未證明12/31當日存量；精確同期人均率HOLD，可規劃明示期間差異的月度參考比率契約。
- F03：確認TGOS座標来自官方來源CSV，沒有逐筆match level/精度碼；維持探索可讀與精度待核，不僅靠來源名稱提升exact距離資格。
- fresh MCP/browser道路scope在本輪仍正確拒絕，SQL草案的local通過不可當成live正例。詳見 [F01–F03驗收](./acceptance-F01-F03-20260923.md)。

## 2026-09-23 最新接手結論（優先於歷史檢查點）

接手先讀 [handoff-20260923.md](./handoff-20260923.md)，再按需求讀驗收報告。不重跑整包盤點。

- S1/S2/S3：共同scope與核心周邊/區域比較已有固定案例證據；同來源同日男女人口/總人口占比通過，不代表A05跨來源服務人均率完成。S4固定歷史事件與線面案例通過，live道路、撤回與事件時點背景仍partial。S5學校分片通過；S6尚未完成整題泛化與速度驗收。
- N01登記盤點778layers/58datasets/53queryable layerrefs（DEV人口另列）；N02本地人口通過而跨來源分母alignment HOLD；N03/N04固定案例通過；N05只完成工具鏈20warm而非完整問答；N06單來源分片通過；N07每片測試與browser證據存在但整體產品驗收未結案。
- 新對話「配對 pulse-research MCP」(01a0cd01-9452-76d0-ac73-5a17f881f9aa) 已成功在3734配對、完成雙北人口與護理附近查詢。這取代local-activation文件的「等待重開」狀態，勿再撤銷使用者目前配對。
- 真實對話：人口152秒/23次MCP、護理218秒/23次MCP；工具耗時加總22/34秒，不是互斥分段、不可把差額全當模型思考。兩題未用batch；漏releaseId、字串bbox與超限limit重試等需改善。護理中心與早前固定案例不同，21/28筆不能直接判回歸。

### G01 通用問答效率（下一優先片，隸屬S6/A11–A12）

使用者明確要求：不能背答案或把測試題硬編碼。可重用的是schema、資料契約與操作配方；每題數值/範圍/來源仍由實際查詢取得。禁止依題目字串輸出預存結果、固定地名專用捷徑、把oracle餵作答案、縮減完整性或略過readback來達標。

先改善：解析具型別的中心/bbox/limit；首次describe取得required parameters與版本；相同descriptor同題重用；已知相依步驟batch；錯誤分類後修正再試，禁止原封重送；pending接續而非重跑；collection+framing一次呈現。仍允許對未知資料探索、歧義澄清與有理由的官方查證。

驗收分開固定regression與未見過變體：換地名/座標、半徑、縣市、指標、同義措辭；納入無覆蓋/缺值/不相容/來源失敗。答案由獨立oracle核對，runtime不得讀oracle。使用正常Codex對話與native MCP，不能只用driver證明通過。20次完整warm記錄median/p95/max、成功/partial/失敗、重試、bytes、模型/工具等待與呈現；cold另列；90秒為目標，不預先承諾。Jev只對歧義路由做A/B，不強迫所有題加模型。

### G02 地圖可讀性與取景（與G01並列，隸屬S2–S4/N07）

使用者回報：地圖常不在想看的位置，顏色等視覺難讀。已觀察人口對話只present、沒有framing；其他取景問題與色彩成因待重現，不先斷言皆是camera bug。

- 取景：依本題實際中心/範圍/比較行政區bounds，辨別地標候選、URL中心與分析中心；不能假定相同。遵守明示保留視角/跟隨關閉/手動拖曳，避免搶回鏡頭。
- 顯示：窄/寬視窗、左右面板下結果不被遮住或縮成辨識不了的小塊；必要時改善面板與framing協調。ready後核對bounds/實際可見結果並截圖，不只featureCount。
- 配色：清楚區分中心、範圍、設施、比較區域、selected/hover；填色/邊線/透明度/標籤/圖例在深淺底圖皆可辨識，避免遮底圖或只靠顏色傳達。數值分級與單位必須真實，不用裝飾暗示排名。
- 互動：結果可點選查看名稱、數值/距離、來源、時間與限制；分析結果與原圖層的click契約分開驗。
- 驗收：附近多來源、兩區/兩縣市、事件背景三類；短/長名稱、重疊點、手機/窄窗/桌面、側欄開關、light/dark、手動移圖。來源與運算幾何不得為美化被改寫。工程截圖/readback與使用者主觀可讀性分列，未經使用者確認不標視覺完成。

2026-09-23 第一切片已完成輸入契約、人口 required releaseId 與結果級圖例／scope 樣式修正；見 [G01/G02 驗收](./acceptance-G01-G02-20260923.md)。新中心 1300m、1750m、200m 零筆及不同縣市人口占比已經 native／獨立來源核對。新版 MCP host reload 已驗證，底圖切換遺失 overlay 已修復（`1bb2e2e3`）。仍未通過 20 題整體 SLA、三類完整視覺矩陣與使用者主觀驗收；G01/G02 保持進行中。發布仍需獨立授權。

2026-09-23 獨立 Agent 問答補測：A01數值核對通過但無有效整題計時，A02於分析前遇到BROWSER_DISCONNECTED，均不納入成功SLA；詳見 [native Agent驗收](./acceptance-G01-native-agent-20260923.md)。先修responsive連線生命週期再續測，不能用oracle或資料時間戳補成問答通過。

2026-09-23 後續：Mini `d86cc66d` 修responsive持續連線並通過native切換回讀；A03新中心7/12數值一致，獨立Agent107.011秒仍有1次錯誤ID且未batch。整頁reload恢復仍失敗、safe viewport偏窄；G01/G02持續進行，詳見上述native Agent驗收。


## V01–V05 下一階段執行（2026-09-24，已實作至第三片，驗收未全結案）

使用者要求評估資料拓展、疊圖／環域／可及性、Agent引導與地圖品質。詳細理由、能力限制、驗收題型與說明書結構見 [下一階段評估](./next-campaign-assessment-20260924.md)。本節仍為計畫SSOT；評估書是範圍說明，不另建競爭roadmap。

| Gate | 範圍 | 依賴／完成關卡 | 狀態 |
|---|---|---|---|
| V01 | reload恢復、plan refs與精簡摘要、pending/partial | 正常對話全鏈、無錯誤ID／原樣重試、G01整題量測 | in_progress |
| V02 | 跨主題Point與合格Line/Polygon讀取契約 | 8–12候選qualification；至少三條代表資料路徑；不合格保留HOLD | in_progress |
| V03 | 有界line buffer、clip/intersection與measure | V02合格幾何＋精度/CRS/預算；獨立oracle＋native地圖 | in_progress；native核心及125.5m修復／173.25m變體通過，完整視覺與泛化仍open |
| V04 | 單一起點步行等時圈＋設施coverage | V02設施；既有provider資格／consent／版本；未連通與no-data分列 | proposed |
| V05 | 好讀說明書、按需skill配方與產品驗收 | 四工作流；深淺／寬窄／取景／legend/popup；工程與使用者驗收分列 | proposed |

V01/V02可並行；V05文稿與視覺從首片納入；G01/G02未完成門檻不被新編號掩蓋。Raster、全臺H3缺口、多起點OD及選址最佳化另期規劃。已授權至V03的本地實作與原子commit；未授權remote migration、發布或擴大付費呼叫。

2026-09-24 使用者授權記錄、更新文件並實作首片：V01 reload恢復與plan binding、V02候選資格表。沿既有隔離worktrees；主agent整合，Terra負責MCP、Luna負責qualification。新資料reader、V03/V04與發布尚未完成；不擴大外部呼叫。

首片實作與native證據見 [V01/V02首片驗收](./acceptance-V01-V02-slice1-20260924.md)：reload同session恢復通過，兩個新地點數字oracle一致；MCP新binding僅本地通過、host待載入；面板展開取景error與20warm仍未解。V02完成11候選qualification，尚無新增reader。

2026-09-24 第二／三片見 [驗收與接續步驟](./acceptance-V02-V03-20260924.md)：V02既有Point／Line／raw Polygon三路已在正常native鏈查詢、空間分析、同圖呈現5features，獨立oracle一致。修正面查詢預設receipt超限，完整幾何仍留browser。V03新增有界線環域、面交集與度量，使用lazy browser engine、來源與預算守門；獨立GEOS比較通過。當前Codex host實測仍拒絕新predicate，故V03 native／新地點變體／完整可讀性未過，不得標done。G01的20warm/cold及G02完整視覺矩陣仍未完成。


## R01–R04 能力審查後收斂（2026-09-24）

使用者授權補缺口、盤點完成能力／邊界／重複操作，並更新下一步。閱讀入口：[能力審查](./capability-review-20260924.md)。本節為最新狀態，取代上方歷史host待重載敘述；V01–V03未全驗收不改done。

| Gate | 本片／下一步 | 完成判準 | 狀態 |
|---|---|---|---|
| R01 | V03拒絕根因、legend來源名、配對文案、skill/Jev一致性與文件收斂 | 有界修復、獨立拓樸證據、unit/typecheck、正常native＋browser；精確commit | 本輪有界修補通過；Jev僅mock/build，全面驗收留R02 |
| R02 | G01 20題完整問答與G02三類視覺矩陣 | 換地點/措辭/半徑，cold另列、失敗與重試記錄；寬窄/深淺/面板/互動/手動鏡頭，normalized popup | 本輪20題主task控制樣本與代表UI驗收完成；真實使用者20輪SLA、主觀品質與快速切換提示仍開放 |
| R03 | V02第二獨立主題Polygon與合格設施來源 | 從11候選補source契約，oracle與native；不符資格保留HOLD | 本輪114筆墓葬用地衍生面＋30筆玉山官方座標子集通過本地oracle/native；不承諾任意資料 |
| R04 | V04單起點步行coverage＋V05四工作流說明 | graph/provider/consent、設施分母與no-data、完整地圖證據 | 尚未實作完整流程；不得擴大付費呼叫 |

整合順序：先各隔離repo原子commit與本地build → 比對原checkout的平行skill/local-stack改動 → 檢查MCP/Gateway/frontend契約相容 → 使用者另授權後才整合或發布。本輪不push/PR/merge/部署。非變更檔案不重跑整包測試。


## 2026-09-24 授權連續完成第1–3項

使用者要求一路完成再檢查：R02正常問答效率＋協作UI驗收，接著R03新主題Polygon及設施。主agent主持/原生驗收，Terra有界popup實作，Luna來源資格盤點。先完成產品修正再固定版本跑完整問題變體；期間不混HMR樣本。20題需保留自然語言問題、工具決策、完整收據、答案、時鐘；工具driver/子agent觀測/主task控制題與真實20輪使用者對話分列，不能冒充。若90秒目標未達，繼續定位，不以改口徑達標。

UI涵蓋附近多來源、區域比較、事件背景，深淺/寬窄/側欄、長label、重疊選取、popup、opacity、群組/開關/排序及手動camera。R03先source qualification，再reader/獨立oracle/native；第二主題不能以同bus的derived buffer充數。所有結果本地隔離commit，未授權發布或擴大paid provider。


### 三片本地交付結果（2026-09-24）

本輪1問答可靠性、2協作UI/取景、3第二主題Polygon/新Point已完成有界實作與驗收，等使用者檢查；詳見[驗收單](./acceptance-R02-R03-20260924.md)及[能力審查](./capability-review-20260924.md)。20題控制樣本median25.66秒、p9545.77秒；Q20原始describe失敗保留、修復另驗。110項focused tests及tsc -b通過。

保留開放：真實20轮使用者SLA（控制題不代替）、數值choropleth與離島等更廣視覺情境、快速theme/resize中斷後提示收斂、使用者主觀UI驗收、R04/V04完整步行coverage、V05四工作流手冊。新来源已保留derived與日期unknown，不以接線完成推定權威現況；市場來源仍HOLD。原checkout／配對保留，無push/PR/merge/部署或擴大付費呼叫。


## 六片續作（2026-09-24，使用者授權至第6片、本地原子commit）

沿既有隔離worktrees，主agent整合、Terra/Luna有界工作；不另建工具入口或重複registry。

| 片 | 交付 | 驗收 |
|---|---|---|
| 1 | theme/resize/中斷與恢復 | 有界style等待、舊命令取消、native/browser |
| 2 | 批次來源資格與共用reader | 6–10候選逐筆資格，合格才接；來源/時間/缺值/排除保留 |
| 3 | 數值分級設色 | paint/legend同契約，normalized/raw units分開，缺值不造0 |
| 4 | 單起點步行coverage | 真實既有路網，明確分母scope，no-data/unreachable分開 |
| 5 | 四工作流手冊/skill | 重用tool schema與契約，禁止記答案，精簡按需入口 |
| 6 | 效能與整合審查 | 分段cold/warm證據、變體回歸、結構/重複呼叫審查 |

真實20輪使用者SLA不以代理控制題替代；未取得的上游契約/路網證據如實保留HOLD。無push/PR/merge/部署/遠端migration或擴大付費呼叫。
