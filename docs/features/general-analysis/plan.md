# 通用地方分析計畫與驗收關卡

更新：2026-09-23。計畫 SSOT；後續 session 先讀本檔，不另起競爭 roadmap。

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
| S3 地區與縣市比較 | 相同指標比較兩區、兩縣市；總數/密度/人口分母明示 | A04–A07；比較前守門、數值及分母 oracle；拒絕把區域統計任意分攤到圓內 | 核心兩區／兩縣市比較通過；A05 自行人口標準化待接線 |
| S4 事件與背景 | 事件位置/時間交叉人口、設施、環境，區分觀測與推論 | A08–A10；先固定歷史 replay，再 fresh feed；過期/延遲顯示且不推因果 | 固定CWA歷史事件＋學校／縣市背景通過；事件時點人口與fresh feed待補 |
| S5 資料與計算加速 | 同一答案下載更少、計算更少；先處理 S2–S4 量到的瓶頸 | 精確分片＋bbox/index、同版快取；優化前後結果等價、傳輸量及時間對照 | schools local分片全鏈通過；首次bytes減95.08%、12IDs完全一致，其他資料與公開發布待補 |
| S6 Jev 與整題驗收 | 找相關資料、選操作、必要時升級強模型；不再反覆描述全目錄 | A11–A12；已授權候選、未知保留、召回率/誤選/成本/整題時間 A/B | 待開始 |

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
