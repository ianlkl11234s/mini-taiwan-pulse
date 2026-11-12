# Backlog

> **任務層正本（2026-11-08 起依主題群分段）。** 現況入口是 [`docs/PROJECTS.md`](../../docs/PROJECTS.md)（專案層：上半部只放進行中／待拍板）；本檔是任務層，每列一個可關閉的 ID；[`STATUS.md`](./STATUS.md) 只放最近一次發版 checkpoint。`.gis-agent-system` 只放 ADR 與跨 repo 計畫書。
>
> 2026-11-08 單一入口整理：依健檢結果把有 PR／版號證據的完成項移到「已關閉」並附證據、重複項併入對方 ID（原文保留）、可能已過時或只差一次驗證的列經使用者 2026-11-08 勾選處理（關閉 21 項，其餘保留），所有列加 Tier 欄。舊稽核紀錄：[`docs/archive/2026-10-05/backlog-audit.md`](../../docs/archive/2026-10-05/backlog-audit.md)。

## 規則

- **不放完成列**：完成就移到檔尾「已關閉」並寫證據（PR 編號、版號、正式站讀回或使用者確認）；State 欄不得是 `done`／`idea`／`decision`。使用者待決寫成 `blocked`，blocker 寫「owner decision」。
- **一列一個主題群**：新列加進對應主題群；找不到合適的群才新增一群，並更新下方清單。同一件事只能有一列，重複的併入既有 ID。
- **主題群**（`FB-*`＝2026-11-09 從功能 backlog 搬入的列，原 ID 寫在 Item 內）：A 正式站目視包（VIS-PACK）、B Zeabur 收尾與金鑰輪換、C 資料保留／儲存／備份、D 資安與 DB 權限、E collector 與資料健康、F 站主資料與舊 RPC／舊路徑撤除、G 開發系統／CI／告警、H1 台灣圖層、H2 多國圖層、I Agent／MCP 分析、J 前端技術債與效能、K 產品舊決策、L 內容、M 文件與 repo 衛生、N 模擬實驗。
- **Tier（每列必填一個）**：
  - `底線:<資安|授權|資料正確|期限|花費|備份>`：不做會出事，優先於北極星。
  - `北極星:<效率|兼容|視覺|好用|AI|開發系統>`：北極星＝效率高、兼容性高、視覺化好、好用的 GIS 資料＋倉儲系統，AI 分析為核心。
  - `內容:<部落格|挑戰日|研究專題>`：部落格、#30DayMapChallenge、研究專題。
  - `待討論`：還不確定要不要做。
- **〔已併入 X〕**：與 X 同一題；原文保留在 X 下方供參考，進度只記在 X。
- **Priority**：`P0` 緊急發版／事故、`P1` 本期、`P2` 已排、`P3` 有空再做；有日期或上游閘門的事不因重要就升 P0。**State** 只能是 `ready`、`in_progress`、`blocked`、`waiting_external`、`conditional`、`verifying`（併入列為 `merged`）。本檔與 PROJECTS 的一致性由 `npm run check:entry-docs` 檢查（規則見 [memory README](README.md)「入口文件自動檢查」）。
- **本檔是唯一的待辦清單**（2026-11-09 起）：feature backlog 已封存（見檔尾 Feature backlog index）；細節可連到 feature 文件，但待辦列只開在這裡。

**重新稽核方法**：for each non-closed row, check git log + merged PRs (`gh pr list -R ianlkl11234s/<repo> --state merged --search <ID or keyword>` over mini-taiwan-pulse / taipei-gis-analytics / gis-platform / gis-data-collectors / mini-pulse-gis-mcp) + current code on `origin/develop`, plus bounded read-only production SQL (LIMIT, outside 10:00–20:00) or public HTTP probes where the acceptance is runtime. Repo, branch, worktree and asset counts come from re-running `.gis-agent-system/scripts/gen_repo_hygiene.py`.

## A. 正式站目視包 VIS-PACK

正式站目視集中在這一群，由 Claude 之後用瀏覽器一次截圖（先 All Off 再逐層開）。原 ID 保留；VP-* 是 2026-11-08 從 PROJECTS 各列「正式站待驗收」收進來的新 ID。需要站主帳號或本人操作的標 blocked。

| ID | Tier | Pri | State | Item | Next action / blocker | Acceptance |
|---|---|---|---|---|---|---|
| IECOI-1 | 底線:授權 | P2 | blocked | Coillte 國有林（`ieCoillteRecreation`／林道，站主限定，mig 512）站主實際載入未驗。 | Blocked on 使用者用站主帳號登入（無頭瀏覽器無法登 Google）。First action: 測試站或發版後正式站切愛爾蘭，開兩層：遊憩點整包、林道 z10 起依畫面分批、z<10 有「放大到 z10」提示卡；登出後應鎖頭反灰且資料清除。 2026-11-08：Coillte（林道 1.7 萬條改 PMTiles）排在站主資料第 3 批（OWD-4），搬完後再一起驗。 **健檢 2026-11-08**：依 OWD-4 搬完再驗。 | 站主看得到兩層、一般會員／未登入看不到；截圖存檔。 |
| VP-1 | 北極星:視覺 | P2 | ready | 正式站目視：選舉圖層第二批（投開票所中性著色＋熱區、2026 議員選區、歷屆選舉統計，v2.22.0）。 | Claude 用瀏覽器 All Off 後逐層開、截圖圖例與 popup。 | 截圖存檔、問題轉成新列。 |
| VP-2 | 北極星:視覺 | P2 | ready | 正式站目視：衛星主控台改版 #533（暗／淡主題與手機版）。 | Claude 用瀏覽器 All Off 後逐層開、截圖圖例與 popup。 | 截圖存檔、問題轉成新列。 |
| VP-3 | 北極星:視覺 | P2 | ready | 正式站目視：日本第二輪（#831 自然公園、国立公園、鳥獣保護区、DID）與交通事故 2025（#843）。 | All Off 後逐層開、截圖圖例與 popup；交通事故看 z5 熱區與 z10 點。 | 截圖存檔、問題轉成新列。 |
| VP-4 | 北極星:視覺 | P2 | ready | 正式站目視：加拿大第 0–3 波＋統計＋即時地震（analytics `canada_opendata/waves/PLAN.md` §4 步驟 7）。 | Claude 用瀏覽器 All Off 後逐層開、截圖圖例與 popup。 | 截圖存檔、問題轉成新列。 |
| VP-5 | 北極星:視覺 | P2 | ready | 正式站目視：南韓第 6、7 波（#830、#869）與公共安全統計（#874）。 | Claude 用瀏覽器 All Off 後逐層開、截圖圖例與 popup。 | 截圖存檔、問題轉成新列。 |
| VP-6 | 北極星:視覺 | P2 | ready | 正式站目視：愛爾蘭全覽 z6 與第 2–10 波、統計（v2.27.0；IEREL-1 關閉時留下的目視）。 | Claude 用瀏覽器 All Off 後逐層開、截圖圖例與 popup。 | 截圖存檔、問題轉成新列。 |
| VP-7 | 北極星:視覺 | P2 | ready | 正式站目視：歷史底圖六層（#882，v2.27.0）與現代地名提示卡。 | All Off 後逐層開、截圖圖例與 popup；疊加層順序、select 換年代。 | 截圖存檔、問題轉成新列。 |
| VP-12 | 北極星:AI | P2 | ready | Agent 實機驗 framingCheck（#881，v2.27.0）：問一題面狀結果（例：臺北各區房價），確認回傳含 framingCheck、覆蓋率 <0.15 時會重框且最多 2 輪。 | 需 pulse-research MCP 連正式站地圖分頁。<br>**2026-11-09 封存項併入**（原檔 [agent-research-workbench](../../docs/archive/2026-11-09/features/agent-research-workbench/backlog.md)）：fresh session 驗 origin→scope→multi-result→clear／revoke | 一次實機紀錄。 |
| VP-8 | 北極星:視覺 | P3 | ready | 正式站目視：國道逐車模擬（G39，#814）。 | Claude 用瀏覽器 All Off 後逐層開、截圖圖例與 popup。 | 截圖存檔、問題轉成新列。 |
| VP-9 | 北極星:視覺 | P3 | ready | 正式站目視：雙北大眾運輸可及性（#810）。 | Claude 用瀏覽器 All Off 後逐層開、截圖圖例與 popup。 | 截圖存檔、問題轉成新列。 |
| VP-10 | 北極星:視覺 | P3 | blocked | 站主目視：公車擁擠模擬（#701）、土壤液化（#407／#408）。 | Blocked：需使用者用站主帳號登入（無頭瀏覽器無法登 Google）。 | 使用者確認或截圖。 |
| VP-11 | 北極星:好用 | P3 | blocked | 正式站驗收：會員區真實 Google 登入、多裝置。 | Blocked：需使用者本人操作。 | 使用者確認。 |
| VP-13 | 北極星:視覺 | P3 | ready | 正式站目視：靜態資產版本化讀取端（#700，R2 layers/v1 試點 immigration_offices、dui_crash_points）。 | Claude 用瀏覽器 All Off 後逐層開、截圖圖例與 popup。 | 截圖存檔、問題轉成新列。 |
| BR-3 | 北極星:視覺 | P1 | ready | Establish production truth for the Business Registry experience. | Assets are live (2026-10-05 probe: all 18 referenced `business_registry/*` assets 200/206, sizes match the 2026-09-18 publication receipt); remaining work is the All Off production browser QA (one pass covers the three feature-level items BR-C-BROWSER, BR-I-BROWSER and BR-B4-VERIFY, which stay as per-layer evidence matrices in their feature backlogs). **健檢 2026-11-08**：併入單一目視 checklist；證據：資產 10-05 HTTP 200/206。<br>**2026-11-09 封存項併入**（原檔 [business-registry-company-layers](../../docs/archive/2026-11-09/features/business-registry-company-layers/backlog.md)、[business-registry-industrial-layers](../../docs/archive/2026-11-09/features/business-registry-industrial-layers/backlog.md)、[common-registration-addresses](../../docs/archive/2026-11-09/features/common-registration-addresses/backlog.md)）：BR-C-RELEASE 公司登記層部署與 Range 404 smoke；BR-C-BROWSER All Off 逐層瀏覽器驗收；BR-I-BROWSER A1／A2／A5／A6 逐層瀏覽器驗收；BR-I-RELEASE 部署並驗 /industrial_zone/ Range；BR-B4-VERIFY 共同登記地址 All Off 單層瀏覽器驗收；BR-B4-RELEASE 部署並 production smoke | Zoom split, controls, popups, legends and dark-map readability have recorded production browser evidence. [Company backlog](../../docs/archive/2026-11-09/features/business-registry-company-layers/backlog.md) |
| MAR-2 | 北極星:視覺 | P1 | ready | Establish production-frontend truth for Japan religion and global maritime layers. | Production is at v2.8.0 (2026-10-15 release) and static assets return 200/206 (2026-10-05 probe); no production browser record exists yet. Repeat camera/toggle/legend/popup/empty-state checks on production. **健檢 2026-11-08**：版號描述過時；證據：寫 v2.8.0，現正式站 v2.31.1。<br>**2026-11-09 封存項併入**（原檔 [global-maritime](../../docs/archive/2026-11-09/features/global-maritime/backlog.md)）：v3 push／deploy／browser 驗收，不得稱 production-ready；v3 rollback gate 與 canonical cutover；GFW 小時格網正式 CDN／browser、license、retention、egress gate；gfwDarkVessels 線上有偵測時的畫面驗收；兩層 viewport、3000 筆上限、空結果與 loading timeout 正式驗證 | A production browser run records GSI/OSM/Wikidata + AIS/GFW behavior with console evidence. [Global maritime](../../docs/archive/2026-11-09/features/global-maritime/backlog.md), [Japan religion](../../docs/archive/2026-11-09/features/jp-religion-layers/backlog.md) |
| AG-5 | 北極星:AI | P1 | verifying | 正式站端到端量測。 | 自動量測 2026-10-04 已完成（bind 0.93 s、set_camera 1.8 s、set_layers 0.87 s、map_context 0.45 s、show_nearby p50 5.8 s）。剩下兩項要使用者手動做：重整還原、在面板撤銷 token。 **健檢 2026-11-08**：需使用者手動；證據：10-04。 | 使用者手動重整一次、在面板撤銷一次，確認結果還原與 15 s 內斷線。 |
| R5-2 | 北極星:視覺 | P2 | verifying | 汙染裁處類圖層（`pollutionPenalty*`）剛打開時沒套預設年份篩選（2026、只看該年），要第一次改參數才生效；點與熱區行為一致。 | **程式已合併（PR #543，v2.6.0 已發布）；尚缺瀏覽器目視。** 在正式站打開 `pollutionPenalty*`，確認不改參數就只顯示預設年份。 **健檢 2026-11-08**：證據：#543 v2.6.0。 | 瀏覽器目視：打開即只顯示預設年份；點數與改參數後一致。 |
| R6-V | 北極星:視覺 | P2 | verifying | R6 段 1–3（#547／#572／#573／#578）已隨 v2.8.0 上正式站（2026-10-15 讀正式站 main-*.js 確認 "2.8.0"），尚未瀏覽器目視。 | 在正式站逐一看：輸電線光暈（立體效果開）、機組即時出力平面點與 popup、水庫與五類廢棄物設施開「立體效果」時仍可點選；另順看列車平面時箭頭貼軌道、換底圖後軌道仍在。 **健檢 2026-11-08**：證據：v2.8.0。 | 以上各點暗／淡底圖各看一次無誤即結案；有問題開 fix PR。對照頁：`docs/features/map-layer-restyle/r6-s{1,2,3}-compare.html`。 |
| GUI-2 | 北極星:好用 | P2 | ready | v2.21.0 未驗項：手機實機觸控（長按選單、點地圖加點、尺規鈕）、真實定位成功流程（只用 mock geolocation 驗過）、實體滑鼠雙擊結束量測、站主登入後政治圖層（#802）、en／ja 窄桌機寬度量測工具列換行。 | First action：使用者手機開正式站逐項操作，或 agent-browser 站主 session 驗政治圖層。 | 每項有截圖或使用者確認；發現問題開 fix PR。 |
| MC-3 | 北極星:視覺 | P3 | ready | 國家選單與視野提示補目視（v2.16.0／v2.16.1 只驗了桌機暗色選單、切法國、切回全台、飛行中不閃提示）。 | 正式站逐項開：淡色底圖的提示卡、Monitor split、真實 Agent session 中提示被抑制、統計面板切日本後「切回台灣」、手拖到東京跳提示並按「保持」。 **健檢 2026-11-08**：證據：v2.16。 | 每項有截圖或照實標 not run；發現問題另開修正 PR。 |
| V215-V | 北極星:視覺 | P3 | verifying | **2026-11-08 使用者拍板乙：日本土砂 popup 無地名時標題改顯示現象種類（土石流／急傾斜地崩塌／地滑），已隨 fix/healthcheck-decisions-20261108 修。** 其餘目視項併入 VIS-PACK。 v2.15.0（2026-10-27）上線後未目視的項目。 | 站主登入後點發電機組（powerGenerationUnit）大圓外圈確認 popup；找一個內容較長的 popup 在手機寬度確認可捲動；日本土砂災害警戒區 popup 標題只顯示「—」（資料無名稱欄），決定改顯示區域種別或維持；向日葵紅外雲圖在晴天是否只剩淡方塊屬正常。 **健檢 2026-11-08**：含一個「土砂災害 popup 標題」決策。 | 各項留截圖或決定。 |
| VIS-3 | 北極星:視覺 | P3 | ready | 2026-11-01 正式站已驗：提示卡、英國墓園／保護區／公園綠地／開放進入地／規劃限制區／建成區點面切換，魚塭兩層、河川面、橋梁輪廓點面切換，`gbSchools`／`speedCamera`／`court`／`jpAccommodationCanonical` 篩選，`fireHydrants` 彈窗；淡色主題可辨識但偏淡。林地／樹木保護 z10–11 空白已在 #795 修。剩：(1) 那輪沒讀 console；(2) 台灣 `landslideAnnual` 點模式權重曲線與林地相同，正式站 z10.5 熱區偏淡但看得到，使用者尚未決定是否比照 `GB_THINNED_POINTS_WEIGHT_TO_Z12` 調亮。 | First action: 問使用者 landslideAnnual 要不要調；下次正式站驗收順便讀 console。 | console 無新錯誤；landslideAnnual 依決定處理。 |
| BLOG-V | 內容:部落格 | P3 | verifying | v2.13.0（2026-10-24）上線後仍未目視的項目。 | 正式站開「臺北市局處統計」任一層與污水接管普及率新舊口徑切換（#679）；手機實機確認嵌入地圖單指捲頁、雙指移動地圖；Search Console 確認 sitemap 已重讀（使用者操作）。 | 三項各留截圖或 Search Console 讀取時間；部落格本體已於 2026-10-24 正式站瀏覽器驗收。 |
| FB-001 | 底線:資安 | P2 | ready | 〔allen-coral-atlas〕用非站主真人帳號在瀏覽器驗證被拒（尚無測試帳號） | 原檔：[allen-coral-atlas](../../docs/archive/2026-11-09/features/allen-coral-atlas/backlog.md)。依據：檔內未勾；BACKLOG 無對應列（VP-11 是會員登入多裝置，非同題）；需另一個帳號，可能 blocked | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-025 | 北極星:好用 | P3 | ready | 〔chart-hover-tooltip〕PowerCard 機組出力折線與燃料堆疊條 tooltip 待站主登入後目視 | 原檔：[chart-hover-tooltip](../../docs/archive/2026-11-09/features/chart-hover-tooltip/backlog.md)。依據：RPC 仍站主限定（power_generation_unit 留 RPC）；BACKLOG 無對應目視列；站主目視，可併 VP-10 類 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-030 | 北極星:視覺 | P3 | ready | 〔coral-reef-layers〕實體手機效能與 Light 底圖切換未驗 | 原檔：[coral-reef-layers](../../docs/archive/2026-11-09/features/coral-reef-layers/backlog.md)。依據：檔內未勾；BACKLOG 無對應；檔內註明 production 未授權，可能根本未公開 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-033 | 北極星:視覺 | P3 | ready | 〔demographics-statistics〕人口統計正式站 browser 驗收 | 原檔：[demographics-statistics](../../docs/archive/2026-11-09/features/demographics-statistics/backlog.md)。依據：BACKLOG 無對應 VP 列 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-039 | 北極星:兼容 | P3 | ready | 〔embeddable-map〕EM-23 嵌入地圖行動裝置實機（低階 Android）驗收 | 原檔：[embeddable-map](../../docs/archive/2026-11-09/features/embeddable-map/backlog.md)。依據：檔內未驗；BACKLOG 無對應 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-060 | 北極星:視覺 | P3 | ready | 〔global-events〕固定錨點與 popup 瘦身正式視覺驗收（使用者執行） | 原檔：[global-events](../../docs/archive/2026-11-09/features/global-events/backlog.md)。依據：BACKLOG 無對應 VP 列 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-066 | 北極星:兼容 | P3 | ready | 〔historical-flight-trails〕實體手機效能 | 原檔：[historical-flight-trails](../../docs/archive/2026-11-09/features/historical-flight-trails/backlog.md)。依據：未驗 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-068 | 北極星:視覺 | P3 | ready | 〔isobath〕ISO-3 等深線瀏覽器驗證 4 控件與 popup | 原檔：[isobath](../../docs/archive/2026-11-09/features/isobath/backlog.md)。依據：PR #160 已上線；BACKLOG 無 VP 列 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-071 | 北極星:視覺 | P3 | ready | 〔jma-live-layers〕JMA-1 四層瀏覽器逐層驗收 | 原檔：[jma-live-layers](../../docs/archive/2026-11-09/features/jma-live-layers/backlog.md)。依據：#571 已上線；BACKLOG 無 VP 列 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-072 | 底線:資料正確 | P2 | ready | 〔jma-live-layers〕JMA-2 冬季積雪模式 11 月後確認有值 | 原檔：[jma-live-layers](../../docs/archive/2026-11-09/features/jma-live-layers/backlog.md)。依據：觸發時間已到（11 月） | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-075 | 底線:資料正確 | P2 | ready | 〔jma-live-layers〕JMA-12 警戒時數分析圖以實資料核對 | 原檔：[jma-live-layers](../../docs/archive/2026-11-09/features/jma-live-layers/backlog.md)。依據：等警戒事件 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-076 | 底線:資料正確 | P2 | ready | 〔jma-live-layers〕JMA-10 洪水キキクル有警戒時核對上色與屬性 | 原檔：[jma-live-layers](../../docs/archive/2026-11-09/features/jma-live-layers/backlog.md)。依據：等事件 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-078 | 底線:資料正確 | P2 | ready | 〔jma-live-layers〕JMA-15 紅葉、櫻花、梅雨當季實地抽驗 | 原檔：[jma-live-layers](../../docs/archive/2026-11-09/features/jma-live-layers/backlog.md)。依據：11 月紅葉季已到 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-082 | 北極星:視覺 | P3 | ready | 〔jp-core-layers〕Batch 1 七層逐層瀏覽器複驗 | 原檔：[jp-core-layers](../../docs/archive/2026-11-09/features/jp-core-layers/backlog.md)。依據：檔內寫仍開；BACKLOG 無對應 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-090 | 底線:資安 | P2 | ready | 〔jp-water〕JPW-5 八個全國層站主限定：bucket policy、Range 401/403、站主登入目視 | 原檔：[jp-water](../../docs/archive/2026-11-09/features/jp-water/backlog.md)。依據：BACKLOG 索引寫唯一 home 在此；OG-4 涵蓋 sidecar 改讀；可併入 VIS-PACK 站主目視 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-094 | 北極星:視覺 | P3 | ready | 〔landslide〕真實瀏覽器 WebGL 視覺驗收 | 原檔：[landslide](../../docs/archive/2026-11-09/features/landslide/backlog.md)。依據：BACKLOG 無對應 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-104 | 北極星:視覺 | P3 | ready | 〔monitor-split〕MS-5 窄視窗時間軸與 split dock 重疊未實測 | 原檔：[monitor-split](../../docs/archive/2026-11-09/features/monitor-split/backlog.md)。依據：未實測；可在 VIS-PACK 截 1280 寬 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-137 | 北極星:視覺 | P3 | ready | 〔urban-heat-lst〕UH-1 瀏覽器驗收兩模式色帶、nodata、overzoom、opacity | 原檔：[urban-heat-lst](../../docs/archive/2026-11-09/features/urban-heat-lst/backlog.md)。依據：BACKLOG 無對應 VP 列 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-142 | 底線:資料正確 | P2 | ready | 〔water-resources〕WR-3 驗證 overlaps_aquaculture filter、分類覆蓋與稀疏 name popup | 原檔：[water-resources](../../docs/archive/2026-11-09/features/water-resources/backlog.md)。依據：未見驗收紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| VP-14 | 北極星:視覺 | P3 | ready | 正式站目視：INTEL 全球情勢分頁（#215）（2026-11-09 封存項：只有 PR 證據、未目視）。 | Claude 用瀏覽器 All Off 後開該分頁／圖層，截圖圖例與 popup。 | 截圖存檔、問題轉成新列。 |
| VP-15 | 北極星:視覺 | P3 | ready | 正式站目視：日本醫療院所（#298）（2026-11-09 封存項：只有 PR 證據、未目視）。 | Claude 用瀏覽器 All Off 後開該分頁／圖層，截圖圖例與 popup。 | 截圖存檔、問題轉成新列。 |
| VP-16 | 北極星:視覺 | P3 | ready | 正式站目視：山域安全 MS-0-RELEASE（#99）（2026-11-09 封存項：只有 PR 證據、未目視）。 | Claude 用瀏覽器 All Off 後開該分頁／圖層，截圖圖例與 popup。 | 截圖存檔、問題轉成新列。 |
| VP-17 | 北極星:視覺 | P3 | ready | 正式站目視：轉運站顯示（#217）（2026-11-09 封存項：只有 PR 證據、未目視）。 | Claude 用瀏覽器 All Off 後開該分頁／圖層，截圖圖例與 popup。 | 截圖存檔、問題轉成新列。 |

## B. Zeabur 收尾與金鑰輪換

| ID | Tier | Pri | State | Item | Next action / blocker | Acceptance |
|---|---|---|---|---|---|---|
| ZB-1 | 底線:花費 | P1 | ready | Zeabur 搬遷收尾：停舊服務並清掉殘留依賴（Zeabur 2026-12-31 全停，以 12/1 前停完為準）。 | **2026-11-09 進度**：13 個靜態站逐一驗證新網址 200 後已刪；刪除不搬的服務（mini-tw-pulse-api、osrm、mini-tw-story 舊版、uk-trip、openAB 4 個，openAB 規格備份在 `~/.config/pulse-backups/zeabur-openab-20261109/`）與 11 個空專案也已刪。只剩 `mini-tw-pulse`（主站、gateway）與 `data-collectors-gomn`（collector、valhalla）兩個專案留作回滾，約 11-14 刪；uk-trip.itsmigu.com DNS 仍指向 Zeabur（見 ZB-7）。以下為 11-08 原文（已刪的項目不再適用）： 2026-11-08 使用者確認 collector 已搬到 pulse-host（gis-data-collectors #170／#171 11-07 合併、#175–#180 新主機調整；correctional 依 #174 移到 HiCloud VM，上游 today.xml 自 05-15 停更故 `265864d` 暫停）。剩：(1) 依序停 Zeabur 服務——11 個靜態站、主站與 gateway（目前留作回滾，定停用日）、collector 新主機穩定一週後停舊 collector、最後停專用主機續約；(2) SEC-6 換金鑰；(3) flight-arc-sharing 要不要給 itsmigu.com 網址（待使用者）；(4) 寫死的 zeabur.app 網址（2026-11-08 盤點：mini 作品連結已改 #905；plan-art 作品連結 PR flight-arc-graph #24 待合併（合併會部署 Flight Arc）；plan-art `scripts/fuse-collector-data.ts` 的 `COLLECTORS_API_BASE` 預設值待決定 collector 對外網址；OSRM 4 處——collectors `scripts/compute_waste_inferred_segments.py`、analytics `grid_accessibility.py` 預設值、`yunlin_poc.py` 2 處——待標停用或改 Valhalla；mini nginx.conf 回滾設定在停 Zeabur 時連同 Dockerfile／entrypoint.sh／deployContract 測試整批退役）；(5) `HC_PING_URL` 死人開關、備份 age 加密；(6) 1Password 重跑 `op-import.py`；(7) 主站 Worker routes 寫進 wrangler.jsonc、觀察 Worker 請求量（Free 每日 10 萬）；(8) NEWS-1 改在新主機（Linode 東京 IP）驗自由時報 RSS，CelesTrak 已擋該 IP。正本 `.gis-agent-system/projects/2026-10-zeabur-migration/README.md` §0（該檔 11-08 仍寫 collector 未搬，待同步）。Owner: 使用者（停服務、金鑰）／主 agent（清網址）. **2026-11-08 交接：約 11-14** Zeabur 26 個已暫停服務觀察滿一週，經使用者同意後刪除（變數備份在 1Password vault「Zeabur 已停服務備份」）；HiCloud VM 與 collector 的小遺留拆到 ZB-2、ZB-3。 **健檢 2026-11-08**：列內『README 仍寫 collector 未搬』『PR #24 待合併』兩句已過時；建議拆成 ZB-1a 刪服務(~11-14)/1b 寫死網址/1c 監控；證據：zeabur README 11-08 已更新 collector 已搬；flight-arc-graph #24 已 MERGED 11-08。 **2026-11-08 健檢拆分**：DNS 改 Worker custom domain 拆成 ZB-4（~11-14），停止續約拆成 ZB-5（12/1），殘留設定根治拆成 ZB-6。 **2026-11-09 晚**：剩兩個回滾專案約 **11-14** 刪，須使用者同意後才動；**12/1** 前使用者取消 Zeabur 續約見 ZB-5。<br>**2026-11-09 封存項併入**（原檔 [news](../../docs/archive/2026-11-09/features/news/backlog.md)）：NEWS-1 自由時報 RSS 是否仍被雲端 IP 403 | Zeabur 專案無運行中服務、帳單停止；repo 內無 zeabur.app 依賴。 |
| ZB-5 | 底線:花費 | P1 | ready | Zeabur 專用主機停止續約（12/1 前）。 | 12/1 起不能續費、12 月依到期日關機、12/31 全停；不處理可能多扣一期。Owner：使用者。 | Zeabur 帳單頁顯示不續約。 |
| SEC-6 | 底線:資安 | P2 | ready | 決定 data-collectors 服務的其他秘密要不要輪換（2026-10-17 資安稽核後續）。 | 2026-10-17 使用者決定先不處理（也未開額外存取紀錄）。已處理：外洩的 API key 已換、相關漏洞已修。脈絡、影響範圍、甲／乙／丙選項與代價只記在私有 repo（本 repo 公開，不寫細節）：gis-platform `docs/research/2026-10-17-security-audit.md` §回家要處理 1。Trigger: 發現異常存取或資料異動、或要做其他金鑰維護時順便做（也與 Zeabur 搬遷一起評估）。2026-10-27 起另有一組 DB 直連憑證列為必換（只曾出現在本機對話紀錄，未進任何 repo），排在 Zeabur 搬遷時一起換。**2026-11-08：觸發成立**——collector 已搬完，Zeabur 搬遷收尾要一起換（範圍見 `.gis-agent-system/projects/2026-10-zeabur-migration/README.md` §0 第 4 項／§6；coral-private S3、valhalla R2 仍沿用舊值）。時機：新主機 collector 穩定後、停 Zeabur 服務前。Owner: 使用者. First action: 讀私有稽核報告該節，選甲／乙／丙。 **2026-11-08 交接：期限 12/3 前**（Zeabur 專用主機到期日）；coral-private 的 S3 金鑰與 valhalla 的 R2 金鑰仍是舊值，一併換（HANDOFF-20261108 §5）。 **健檢 2026-11-08**：有期限；與 G016 合併；證據：HANDOFF §5。 **2026-11-08 健檢擴大**：範圍改為 22 把換、9 項刪／撤銷，期限 12/3；Claude 前置 C1–C8（拿掉寫死連線字串、移除文件裡的舊金鑰、多 env 檔換值小腳本等）。計畫書：`.gis-agent-system/projects/2026-10-zeabur-migration/SEC-6-rotation-plan.md`（已放入 healthcheck-20261108/）。G016 可同批處理。 | 使用者選定選項並執行完畢，或明確結案。 |
| ZB-6 | 北極星:開發系統 | P3 | ready | Zeabur 殘留根治剩餘項。 | **2026-11-09 已完成**：collectors #186（`PULSE_ENV`、cross_layer_map 81 筆改 `pulse_host`、刪 zeabur.json，已部署 bf30522）、主機 compose `PRODUCTION`→`PULSE_ENV`（gis-agent-system #51）、mini #954（刪 Dockerfile、entrypoint.sh、docker-compose.yml，文件改 Worker）。**剩**：(1) `nginx.conf` 仍被 8 支測試當標頭／快取／路由規格驗（CSP 與 worker.js 逐條一致），測試改驗 worker.js 後刪 nginx.conf；(2) 根目錄 `.dockerignore`、`pull-deploy-assets.sh`、`refresh-climate.sh`、`refresh-gfw-hourly.*`、`install-jp-*-assets.py` 仍有測試或 `site_manifest.py` 引用；(3) 穩定一週後拿掉 collectors `config.py` 對 `ZEABUR`／`PRODUCTION` 的過渡相容。 | `rg -i zeabur` 只剩歷史文件與 archive。 |
| ZB-V1 | 底線:備份 | P2 | verifying | 2026-11-09 清晨第一次自動跑的項目。 | Owner: 主 agent。First action（11-09 白天唯讀查）：(1) 04:45 起 mig 505–509 清理排程第一次跑（iot_wra 約 8 晚才降到 30 天）；(2) pulse-host 03:00 歸檔後 reconcile 的 🔴 由 10 降到 0（#176 誤報修正）；(3) 06:30 備份 watchdog 第一次跑，`/health` 的 `backup.last_success_date` 有值；(4) 每日 Telegram 日報出現 HiCloud VM 磁碟／滯留告警欄位（#180）；(5) 日本雷達已追上最新幀（#178）。 **健檢 2026-11-08**：明天白天查；證據：尚未到時間。 **2026-11-10 差異檢核**：BACKLOG、journal、mini commit 都沒有五項的觀察紀錄（只有第 3 項可由 ALERT-1 關閉文字間接對到 `HC_BACKUP_PING_URL` 已設）〔待確認〕：有查過就補結果，沒查就照五項重查。 | 五項各有觀察紀錄；未達的另開列或回報。 |
| ZB-2 | 底線:備份 | P3 | ready | HiCloud VM 小遺留。 | Owner: 主 agent。(1) 刪 `/root/vm_backfill_20261108.py`（一次性補傳腳本）；(2) correctional 11/07 在 VM 與 S3 內容不同，**11/17** 會觸發滯留告警，屆時把 VM 版另存 `.vm.tar.gz`。First action：(1) 現在就可做。 **健檢 2026-11-08**：11/17 有日期。 **2026-11-09**：(1) 已完成（主 agent 回報）；只剩 (2) **11/17** `.vm.tar.gz`。 | 腳本已刪；11/17 告警處理完、S3 有 `.vm.tar.gz`。 |
| ZB-3 | 北極星:開發系統 | P3 | ready | collector 與登記檔小遺留。 | Owner: 主 agent。(1) `env_jp_wbgt` 季節判斷用月份，10/22–10/31 可能誤報——改成依上游實際發布期判斷或接受並註記；(2) analytics `cross_layer_map.yaml` 81 筆 `deployment: zeabur` 是沿用舊名，改成實際部署位置或中性名稱。First action：(2) 先查有哪些程式讀 `deployment` 欄，再決定改名範圍。 | WBGT 不再於非發布期誤報；`cross_layer_map.yaml` 無 `zeabur`（或改名有登記理由）。 |
| ZB-7 | 底線:花費 | P3 | blocked | uk-trip.itsmigu.com 的 DNS 仍指向 Zeabur（服務已刪，回 525）。 | Blocked（owner decision）：刪記錄，或改指新站。 **2026-11-09**：要使用者在 Cloudflare 後台手動刪該 DNS 記錄（Owner：使用者）。 | DNS 記錄已刪或指向有效站。 |

## C. 資料保留、儲存與備份

| ID | Tier | Pri | State | Item | Next action / blocker | Acceptance |
|---|---|---|---|---|---|---|
| GP-550 | 底線:資料正確 | P2 | blocked | 套用 gis-platform #240 的 mig 550（海洋測站每小時曲線頭尾小時修正）、551（retention batch2 回補與清理補強＋索引）。 | Blocker：owner decision（套用到正式 DB）。#240 已合併（2026-11-11，main CI 綠）；套用前 6 點已逐點查過（審查結果見 gis-agent-system reports/code-review/2026-11-10/README.md）。時段避開 06:11–06:45、每小時 :07、週四 11:00；順序 550 → 550 test → 551 → 551 test 1–3，隔天 06:15 後跑 Test 4，最後 `/check-rpc` 量 550（7 天／31 天／非整點）。31 天彙總現況冷快取約 520 ms（含網路），超過 300 ms 目標但在 1 s 內 | 兩支 test.psql 通過；550 冷快取 <300 ms；回滾檔在 scripts/rollback_550／551。 |
| ST-2 | 底線:備份 | P1 | in_progress | R2 獨有資料補回 S3，並在產生流程尾端持續上傳 S3（ADR-0026：S3 是所有資料的永久正本）。 | 只在 R2 的資料：warehouse packages 約 6 GB、pulse-staging `_detect` 約 1.09 GB、`sim/v1`（[健檢報告（2026-11-08）](../../../.gis-agent-system/projects/2026-10-zeabur-migration/healthcheck-20261108/) `architecture.md` 第 6 項）。補傳進行中。 | 各前綴 S3 有對應副本；產生腳本尾端有上傳 S3 步驟。 |
| WA-3 | 底線:期限 | P2 | ready | Give the large `live` time-series tables an explicit retention policy. | 2026-09-01 audit (mig 385/387/388) + gis-platform #113 (mig 412) registered the residual tables; as of 2026-10-05 `check_retention_coverage()` returns only `news_events` and `yt_live_history` ("archive/retention decision pending; deletion blocked"). Blocker: owner decision on archive verification + retention window for those two. `freeway_sections_current` is unregistered but not currently flagged. **2026-11-08 擴充（使用者同意「全做」，此部分不再 blocked）**：保留期限超過 6 個月或永久的表約 21 張、另有 22 張小表沒有期限；intel `global_event` 在 S3 沒有備份且有防刪 trigger。First action：先用 `export_table_to_s3.py` 全部匯出到 S3，再設期限；地震、颱風等事件史要先在 R2 留事件檔再縮短保留（否則回放消失）；重 DB 工作排 20:00 後；盤點報告已消失，需要清單時重跑唯讀盤點（摘要在 `.gis-agent-system/projects/2026-10-zeabur-migration/HANDOFF-20261108.md` §3）。Owner: 主 agent（匯出、migration 草稿）／使用者（套 migration 拍板）。 **健檢 2026-11-08**：主題群 C 的主項；證據：HANDOFF §3；mig 505–510 已套。 **2026-11-09 第 2 批完成**：gis-platform #228、#229、mig 540–543，ADR-0026 小表例外（gis-agent-system #57）。剩：`public_health_weekly` 二選一；launches 收集器要先改才能回補 5 年；intel 三表每月匯出（2027-03 前，另一 worker 進行中，見 WA-13）；shakemap 改 R2 事件檔；**11-10** 確認首次清理刪除量＋大表 vacuum；analytics `05_load_to_supabase.py`／`14_import_to_supabase.py` 仍寫入已刪的 drone／pollution 表要改；gis-platform `docs/data-safety-inventory.md` L170–173 動物 400→180 要改；`flood_hazard_zones`／`storm_drainage`／fire 兩表併入 WA-14。<br>**2026-11-09 封存項併入**（原檔 [road-congestion](../../docs/archive/2026-11-09/features/road-congestion/backlog.md)）：RC-4 每日 refresh 掃描量成長後分段 | `check_retention_coverage()` returns only intentional rows (owner-decided retention or keep-forever for news_events / yt_live_history). [proposal](../../docs/features/data-lifecycle-lean/retention-2026-09-01.md) |
| WA-12 | 底線:期限 | P3 | merged | 〔已併入 WA-3〕Give `climate/frames/` a retention policy. | The "no AWS credentials" premise is outdated (use the `S3_*` keys in data-collectors/.env, 2026-10-16); `climate_bake.py` (data-collectors) writes `deploy-assets/climate/frames` with no prune logic. Original audit: 322 frames, 220.9 MB, 2026-07-06 to 08-25 incl. future forecast timestamps. Next: check S3 lifecycle config + object count with credentials. **健檢 2026-11-08**：與 WA-3 同一題，內容保留在此供參考，進度改記在 WA-3。 | Either an S3 lifecycle rule or an upstream collector retention window is in place and documented. |
| ADR-1 | 底線:備份 | P2 | ready | ADR-0026 補正。 | 補記 S3 DEEP_ARCHIVE lifecycle（`<collector>/archives/` 270 天、supabase-snapshots/realtime 180 天；取回需 12–48 小時＋費用）、R2 `pulse-staging` bucket、§5.1 owner-data 路徑（已改私有 S3＋coral-private）。在 `.gis-agent-system` 開 PR。 | ADR-0026 與實測 lifecycle 一致。 |
| DIO-3 | 底線:花費 | P3 | blocked | Decide whether `bus_positions` ingest (~30 GB/day) is worth reducing. | owner decision. This is raw ingest volume, not waste; reducing it means lowering bus collection frequency, i.e. a **product trade-off**, not a bug fix. No work before the owner call. | An explicit keep-or-reduce decision; no silent frequency change. |
| CL-5 | 底線:備份 | P3 | conditional | Delete the 2026-09-29 cleanup backup folder once nothing in it is needed. | `GIS/_worktree-backups/2026-09-29/` (6.0 GB on 2026-10-05): deleted-branch SHA lists, removed-worktree data outputs, local-only branch bundles, diverged-repo and pulse-main-dirty copies, analysis-prod previous SHAs. (A newer `2026-10-04/` backup exists alongside; not covered by this row.) **健檢 2026-11-08**：_worktree-backups 現有 9 個日期資料夾，一起決定。 | Trigger: owner confirms nothing in it is needed (trigger 待定, owner: 使用者, flagged 2026-10-16). First action: list what still references it, then move the folder to ~/.Trash. |
| WA-8 | 底線:花費 | P3 | ready | Reassess the tracked files over 5MB. | 2026-10-05: 32 files / 363.5 MB; largest is `public/world/jp_religion_osm_20260930.pmtiles` (22.4 MB) — `forest_reserve.geojson` is no longer on the list. List in `REPO_HYGIENE.md` §4.3 — re-run `scripts/gen_repo_hygiene.py` to refresh. **2026-11-08 盤點**：git 裡有 385 個資料檔、1.13GB 在 S3 沒有副本；使用者同意定門檻（例：>5MB 一律走 S3 deploy-assets → R2，其餘維持）。mini `public/` 由 CI-4 不論大小全部移出；本列只剩 `public/` 以外與其他 repo 的檔。First action：重跑唯讀盤點分 repo 列出 >5MB 檔，提門檻案給使用者確認。 **健檢 2026-11-08**：mini public/ 部分已由 CI-4 完成；本列只剩 public/ 以外與其他 repo；證據：11-08 擴充。 | Each file is either moved to S3 + gitignored, or recorded as intentionally version-controlled. |
| VW-EXP-1 | 底線:期限 | P3 | conditional | vessel_watch_positions 11 月以後的資料再匯出 S3。 | Trigger：2027-05 前（180 天保留會開始刪 2026-11 的資料）。Owner: 主 agent。First action：2027-04 用 `export_table_to_s3.py` 匯出 2026-11-01 起的資料，比對列數。 | S3 有完整月檔且列數與 DB 一致。 |
| DB-1 | 底線:資料正確 | P3 | ready | 晚上 8 點後用唯讀 psql 補查各表大小與 `cron.job` 清單。 | 健檢時避開餐期沒查；補上後更新保留期限第 2 群（WA-3）與 DIO 系列的基準。SQL 一律 LIMIT／有界聚合。 | 表大小與 cron 清單存檔並連到 WA-3。 |
| WA-11 | 底線:花費 | P2 | ready | Remove the 31 duplicated objects sitting in both `deploy-assets/` root and their category sub-prefix. | The "no AWS credentials" premise is outdated: S3 `migu-gis-data-collector` was fully enumerated 2026-10-06 with the `S3_*` keys in data-collectors/.env (the local aws profiles are iCHEF company accounts — do not use). Re-run `collect_storage` with those keys to refresh the duplicate list (~365.6 MB, e.g. `ftw_fields_2025.pmtiles` in root and `agriculture/`), then confirm each is unreferenced by deploy scripts / nginx. **健檢 2026-11-08**：CI-4 已完成（v2.31.3）整理過 S3 正本；需重查 31 個重複物件是否還在。 | Every duplicate is confirmed unreferenced by any deploy script or nginx location before deletion; `collect_storage` reports 0 duplicate groups. |
| WA-13 | 底線:備份 | P2 | in_progress | intel 三表（含 `global_event`）每月匯出 S3，2027-03 前要有排程。 | 另一個 worker 2026-11-09 進行中；細節以該 PR 為準。 | 每月自動匯出到 S3、筆數核對通過。 |
| WA-14 | 北極星:效率 | P2 | ready | 靜態表搬遷乙組（約 2.4 GB）：`stat_values`、`land_subsidence`、H3 人口、`fire.incidents`、`water_quality`、`flood_hazard_zones`、`storm_drainage`、fire 兩表。 | 依 ADR-0026「不會變的不進 Supabase」：盤點讀者 → 換載體（PMTiles／R2）→ 改前端 → 匯出 S3 → 刪表。後幾張 mini-taiwan-info 也在讀，要一起改。**動前端前先給使用者看方案。** | 各表讀者改讀新載體、S3 有完整匯出、表已刪。 |
| FB-032 | 底線:花費 | P2 | ready | 〔data-lifecycle-lean〕DL-3 GFW failed spool 重複儲存與中間產物瘦身 | 原檔：[data-lifecycle-lean](../../docs/archive/2026-11-09/features/data-lifecycle-lean/backlog.md)。依據：BACKLOG 無對應列（WA-3 是 live 表）；需先確認 GFW spool 仍存在（GFW 收集器部分停用） | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-121 | 底線:花費 | P2 | ready | 〔property-value〕PV-2 是否刪除無前端引用的 buildings_3d_taiwan.pmtiles（約 194MB，需核准） | 原檔：[property-value](../../docs/archive/2026-11-09/features/property-value/backlog.md)。依據：src 只剩 layerManifest 註解提到此檔名，無載入引用；需使用者拍板；依保留政策 S3 正本應保留，只刪 R2 副本？ | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| BKP-1 | 底線:備份 | P2 | blocked | Supabase「還原到新專案」演練。 | 11-06 決定要做、11-08 健檢「未見完成紀錄」，之前不在任何清單。**會產生費用，要使用者在 Supabase 後台操作**（Restore to new project）。Blocker：owner decision（排時間）。之後 Claude 唯讀核對表數與抽樣筆數，用完刪掉新專案。 | 演練紀錄：花多久、還原到哪個時間點、哪些東西沒還原。 |
| BKP-2 | 底線:備份 | P3 | ready | pulse-host 依文件在新機器從零重建演練。 | runbook 在 `.gis-agent-system` `projects/2026-10-zeabur-migration/host/README.md` §3，未演練。用一台臨時 Linode 照文件跑到 compose 起得來（不接正式流量），記錄缺漏後刪機。 | 照文件可重建；缺的步驟補回 runbook。 |
| BKP-3 | 底線:備份 | P2 | ready | `auth.users` 納入 S3 備份。 | 健檢：`auth.users`（會員帳號）、intel、tourism schema 不在 S3 備份範圍。First action：確認 data-collectors `backup_manifest.yaml` 與 `tasks/backup_supabase.py` 的範圍，加 `auth.users`（注意個資：只進私有 bucket）。intel／tourism 一併判斷。 | 每日備份含 `auth.users`，並有一次還原抽查。 |

## D. 資安與 DB 權限

| ID | Tier | Pri | State | Item | Next action / blocker | Acceptance |
|---|---|---|---|---|---|---|
| D3 | 底線:資安 | P1 | blocked | Reduce anonymous PostgREST surface to the intended schemas. | First confirm no other gis-platform consumer relies on direct REST access to the schemas being removed (2026-10-05 still exposed reference, spatial, metadata, opendata, fire, maritime, rail, safety, demographics, intel; merged with former AR-41 on 2026-10-16). Include mini-taiwan-info, terrain-art, weather_change and tree-report in the consumer scan. **健檢 2026-11-08**：需掃 consumer；證據：10-05 仍曝露 10 schema。 | `public`/`graphql_public` only, regression checks for shared consumers, and reversible dashboard evidence. [Launch hardening](../../docs/launch/08_POST_LAUNCH_HARDENING.md) |
| BC-4b | 底線:資安 | P1 | waiting_external | Production auth + enforcing-CSP step (the header/privacy-page prerequisites stay in the BYOK backlog as BC-4; renamed BC-4b on 2026-10-16 to keep IDs unique). | Configure production OAuth URLs in Supabase/Google; then collect browser CSP violations before changing Report-Only to enforcing (2026-10-05: production root still serves the main policy as `Content-Security-Policy-Report-Only`). 2026-10-28 補：改 enforcing 前 allowlist 要加日本官方網域 `cyberjapandata.gsi.go.jp`（地理院地形、淹水圖磚）與 `jma.go.jp`，否則日本圖層會被擋。 **健檢 2026-11-08**：搬 Cloudflare 後實作位置變（Worker/_headers）；allowlist 再加 gis.sinica.edu.tw、NRCan；證據：2026-11-08 curl：主 CSP 仍 Report-Only，server=cloudflare。<br>**2026-11-09 封存項併入**（原檔 [byok-chat](../../docs/archive/2026-11-09/features/byok-chat/backlog.md)）：BC-4 部署前置：CSP connect-src、隱私頁 BYOK、OAuth 網域切換 | Production Google login works; all key flows have no CSP violations before enforcement. [BYOK backlog](../../docs/archive/2026-11-09/features/byok-chat/backlog.md) |
| G016 | 底線:資安 | P2 | waiting_external | Revoke the obsolete `weather_change` AWS credential. | Repo-side references appear gone (2026-10-05: no `weather_change` hit in data-collectors origin/main; local `.env` not inspected). An AWS administrator must deactivate the `gis-data-collectors` key ending `E7PK`. **健檢 2026-11-08**：可併入 SEC-6 金鑰輪換一次做；證據：需 AWS 管理員。 | Old credential fails through STS and retirement is recorded without exposing secret material. |
| SEC-7 | 底線:資安 | P2 | verifying | research-gateway 限流改用真實來源 IP、先驗 token 再扣額度（gis-platform #170）。 | 前提 mini #614（nginx real_ip）已隨 v2.9.0 上線。剩（2026-11-08 改寫：gateway 已於 11-06 搬到 pulse-host，經 Cloudflare Tunnel）：查清新主機上 gateway 前面的轉發來源（Tunnel／nginx）→ 在 pulse-host compose 設 `PULSE_RESEARCH_TRUSTED_PROXY_IPS` → 合併 gis-platform #170 並部署。舊的 Zeabur 轉發網段已不適用。 **健檢 2026-11-08**：文件寫「合併 #170」已過時；只剩 pulse-host 設 PULSE_RESEARCH_TRUSTED_PROXY_IPS 並驗證；證據：gp #170 已 MERGED 2026-10-17（b743e83）。 **2026-11-09**：pulse-host 已設定（主 agent 回報）；剩兩種網路來源實測（不同 IP 各自計額、無效 token 不扣額）。 | 不同來源 IP 各自計算額度；無效 token 不扣額度。 |
| SEC-4 | 底線:資安 | P3 | ready | `get_rain_basin_accumulated` 本身太慢（查 1 天約 13.6 s、7 天約 29 s），473 的 30 天上限擋不住。 | 目前無前端呼叫者。二選一：pre-aggregate／加索引優化，或確認無人使用後收回 anon／authenticated 權限。 | 1 天查詢 < 1 s，或 anon 已不能執行。 |
| SEC-5 | 底線:資安 | P3 | ready | 公開 RPC 在上限內仍可重複拖慢 DB（例：`get_waste_trails` 上限 180 分一次約 8 s，前端只用 60 分約 1 s）。 | 二選一：上限再收緊（垃圾車 180→120 分）或在上層加限流（PostgREST／Cloudflare）。稽核報告見 473 檔頭與 PR gis-platform #174。 **2026-11-09**：pgss 11-09 15:27 重置；**~11-12～14** 取乾淨慢查詢清單 → 先優化 >1s 的，再把 statement timeout 收到 10–15s；公車／船舶軌跡維持 60s 例外（軌跡另見 TRAIL-1）。 | 單次最大範圍查詢 < 3 s，或同 IP 頻率受限。 |
| GP-296 | 底線:授權 | P3 | blocked | mig 296 的 default privileges 讓 `reference` schema 新表自動授 SELECT 給 `cloud_agent_ro`，授權限定的物件（如 EA 污染名錄）每次都要另外收權。 | Blocked on 使用者決定是否改 default privileges。First action: 唯讀列 `reference` schema 現有表的 `cloud_agent_ro` 權限與 default ACL，列出改法與影響（會不會讓既有 MCP 查詢失效）給使用者選。 | 使用者選定：維持（每次收權寫進 onboarding 清單）或改 default（新 migration 並驗 MCP 倉庫查詢不壞）。 |
| SB-1 | 底線:花費 | P3 | ready | Supabase `migu` project 不用就移除。 | 刪除前先確認沒有 repo、collector 或排程連它（只查設定名稱）。Owner：使用者拍板刪除。 | project 已刪或記錄保留理由。 |
| OG-4 | 北極星:好用 | P2 | ready | 私人 Range API（coral-private sidecar：jpWater、土壤液化、BSS、橋梁韌性、公車擁擠、allenCoralAtlas）改讀 `profiles.tier`，不再寫死 `OWNER_ID`。 | Trigger 已成立（2026-11-06 主站搬離 Zeabur，`/api` 經 Tunnel 到 pulse-host 的 sidecar）。現況：後台把這些層改成非 owner 只會解開介面、資料仍拿不到。Owner: 主 agent。First action: 搬遷方案定案後，在新 sidecar 以 Supabase JWT 查 tier，與 `public.gated_layers.required_tier` 對照。 **健檢 2026-11-08**：與 OWD-4 同一個 sidecar，排一起。 | 後台改 tier 後，對應帳號能讀到資料；未登入仍 401。 |
| JP-1 | 底線:資安 | P2 | ready | Verify the Japan religion view hardening through the real PostgREST write path. | Migration 374 readback proves SELECT-only grants, `security_invoker=true` and anon reads; perform bounded anon/authenticated REST write attempts without modifying valid rows. **健檢 2026-11-08**：一次唯讀驗證即可關；證據：mig 374。 | Reads remain 200 and INSERT/UPDATE/DELETE attempts are rejected by PostgREST; evidence records status/error without logging secrets. |
| SEC-9 | 底線:資安 | P3 | verifying | 確認 2026-10-17 資安 migration 沒有擋到正常功能。 | (1) `log_session_events` 90 天清理 cron（mig 472）首次執行在 2026-10-18 06:50 台北，查 `cron.job_run_details` 成功、刪約 9,600 筆；(2) tree-report 照片上傳（mig 470 限 5 MB、jpeg／png／webp）實際傳一張；(3) `ship_last_seen` 改 full_table 後，03:30 台北的備份有產出。 **健檢 2026-11-08**：一次唯讀查詢可關；證據：3 項待查。 | 三項都確認正常。正本：gis-platform `docs/research/2026-10-17-security-audit.md`。 |
| SEC-11 | 底線:資安 | P2 | ready | `iot_wra_daily`、`iot_wra_latest` 兩表沒開 RLS（2026-11-09 第一批權限整理時發現）。 | First action：確認讀者（前端 RPC／MCP）後，出 gis-platform migration 開 RLS 並只留需要的讀取政策；套用須使用者拍板。 | 兩表 RLS 已開、既有讀者仍可讀。 |
| SEC-12 | 底線:資安 | P3 | waiting_external | anon 對 `net.http_*` 的執行權限收不回（由 supabase_admin 授權）。 | 需 Supabase 後台或支援處理；低優先。2026-11-09 第一批（gis-platform #227）時確認。 | anon 無法執行 `net.http_*`，或 Supabase 回覆無法收回並記錄接受理由。 |
| HERMES-2 | 待討論 | P3 | blocked | Hermes 已退役（HERMES-1），`gis_monitor_hermes` 角色要不要 drop。 | Blocked（owner decision）：權限已於 mig 536 收回（回滾在 gis-platform `scripts/rollback_536...` 第 3 段）；角色本身保留或 drop 待使用者決定。collectors `operations.md` L26／L82「待確認」改「已退役」。 | 使用者決定後角色已 drop 或記錄保留理由。 |
| FB-065 | 底線:授權 | P2 | ready | 〔historical-flight-trails〕個別資料合約與公開展示授權（license unverified） | 原檔：[historical-flight-trails](../../docs/archive/2026-11-09/features/historical-flight-trails/backlog.md)。依據：license_status=unverified；BACKLOG 無對應；已公開上線，授權未確認 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-139 | 底線:資安 | P2 | ready | 〔urban-zoning〕UZ-2 新北官方站 TLS 憑證，排程不再用 --insecure | 原檔：[urban-zoning](../../docs/archive/2026-11-09/features/urban-zoning/backlog.md)。依據：未見紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-170 | 底線:授權 | P2 | ready | 〔agent-research-workbench〕Google geocoder quota／成本 ledger／circuit breaker 與條款 review（P0-D、地址 fallback 共 4 項） | 原檔：[agent-research-workbench](../../docs/archive/2026-11-09/features/agent-research-workbench/backlog.md)。依據：MCP 規則仍要求逐次 externalConsent，條款 review 未見紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-181 | 底線:資安 | P2 | ready | 〔cctv-finetune-roadmap-2026-09-29〕不模糊影像訓練完成後刪除（使用者決定） | 原檔：[cctv-finetune-roadmap-2026-09-29](../../docs/research/cctv-finetune-roadmap-2026-09-29.md)。依據：訓練未完成，原始影像仍在 ~/cctv-collector 與 ~/Backups；需在封存或訓練後執行；若決定封存，也要處理這批影像 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |

## E. collector 與資料健康

| ID | Tier | Pri | State | Item | Next action / blocker | Acceptance |
|---|---|---|---|---|---|---|
| COL-199 | 底線:資料正確 | P2 | blocked | 部署 collectors #199（review 第五輪 19 則：告警重送、日報狀態、URI 帳密遮罩、備份檢查、news_events 等）。 | Blocker：owner decision（部署）。#199 已合併（2026-11-11，含 PLA 項次誤刪修正 1cabb0b0，main CI 與 publish-image 綠）。部署：pulse-host `/opt/pulse-host` `docker compose pull` 後 `up -d` 重啟 collector；HiCloud VM 先複製 `bulk.py` 再換 `archive_cdc_public_health_weekly.py`；moa 下次 `deploy.sh` 帶上。無新依賴與環境變數。預期首日日報多出「啟用但從未有資料」的 🟡 | 主機與 VM 跑新版；隔天日報正常；告警可送達。 |
| DS-01 | 底線:資料正確 | P1 | blocked | Stop losing 29/30 lightning snapshots now that the upstream has recovered. | Taipower source is delivering again (2026-10-05: 18–38 distinct collection runs/day since 10/01, latest strike 10/05 12:57 UTC), but run cadence still matches the 30-minute throttle; blocked on owner approval to reset `LIGHTNING_EVENTS_INTERVAL=1`（2026-11-08：collector 已搬到 pulse-host，改的是新主機的 collector env，不再是 Zeabur 變數）. **健檢 2026-11-08**：只差改 env 拍板；證據：10-05 證據；collector 已在 pulse-host。 | Consecutive one-minute source snapshots are collected; no recovery is inferred from HTTP 200 alone. [Outage pitfall](../pitfalls/2026-08-07-silent-upstream-outage.md) |
| DS-02 | 底線:資料正確 | P1 | waiting_external | Restore a trustworthy A1-accident feed. | Upstream resource is frozen (2026-10-05 collector-health WA-2: provider date 115/06/22, latest event 2026-06-15; collector heartbeat succeeds but adds no rows). Escalate to the Police Agency or select/document the new official resource; meanwhile add source-date/max-event/new-row receipts and mark A1 as not current. **健檢 2026-11-08**：需另找資源或標示非即時；證據：上游停在 2026-06-15。 | Freshness advances and source contract/coverage is recorded. data-collectors `docs/investigations/2026-10-05-collector-health.md` §WA-2 |
| BL-25 | 底線:資料正確 | P1 | blocked | Repair transport feeds that appear healthy in metadata but fail in runtime data. | 2026-10-05 collector-health investigation (collectors #126): the H3 limit defect is gone (`get_h3_demographics_yearly` has no 20000 cap; but year 113 has 0 res8 cells, so no res8 coverage can be claimed). Still open: (1) YouBike `public.mv_youbike_h3_dates` stops at 2026-04-09 while `live.youbike_h3_daily` reaches 10-05 — the MV has no refresh job; (2) flight 09-26 summary still reports 52,536 records while raw trails for that day = 0 (cleanup deletes raw only); (3) waste raw trails on 10-05 New Taipei 52 / Tainan 87 / Kaohsiung 105 but matched = 0 in all three (matching worker disabled, defaults to Kaohsiung only). Fixes touch gis-platform materialization/retention or collector config — owner approval needed. **健檢 2026-11-08**：拆三小項較好推；10-05 後未重驗；證據：collectors #126 調查 10-05。 | Each affected RPC is checked with recent rows and Pulse behavior. data-collectors `docs/investigations/2026-10-05-collector-health.md` §BL-25 (+ `transport-evidence.md`) |
| G013 | 底線:資料正確 | P2 | waiting_external | Restore the corrected KHH collector on its VM runtime. | (P1→P2 2026-10-16: waiting on an external VM；與 Zeabur 搬遷無關，目標仍是 HiCloud VM，待使用者部署。) Copy the already-pushed collector (data-collectors `a2f158a` adds KHH1/KHH5) to the HiCloud VM according to its runbook. 2026-10-05: newest 20k rows of `live.border_airport_snapshot` contain TPE/TSA/RMQ only, no KHH. **健檢 2026-11-08**：VM 現由主 agent 操作中（ZB-2），不再是 external；可直接做；證據：collectors a2f158a 已 push；10-05 無 KHH 列。 | VM cron runs the corrected collector and fresh KHH rows are observed. `data-collectors/external/immigration_apis_airport_vm/README.md` |
| PR-1 | 底線:期限 | P2 | blocked | Stop the inmate card from silently shrinking to empty while upstream stays dead. | Blocked on 拍板 / migration authorization (owner). Apply the prepared RPC-window-anchor migration (`max(observed_date)` instead of `now()`); written but **not applied** — needs 拍板. File deliberately unnumbered (`prison_population_window_anchor.PENDING.sql`); take a number on the day it is applied. 2026-10-05: `live.prison_population_daily` still ends at 2026-05-15 while the collector keeps polling, so the 365-day window empties around 2027-05-15. **健檢 2026-11-08**：約 2027-05-15 卡片會變空；上游停更、collector 已停，可考慮直接退卡；證據：PENDING.sql 未套；上游 05-15 停更；collector 已暫停(265864d)。 | Card still renders its trend after the window would have passed the last data point. [SQL](../../docs/archive/2026-10-16/proposal/monitor-tweaks-2026-08-21/prison_population_window_anchor.PENDING.sql) |
| DS-04 | 底線:資料正確 | P2 | ready | Restore county-level lightning summaries. | Check whether the county polygon tables the refresh function looks for exist in production; if missing, provide them, if present, fix the refresh function's county join. Polygons per migration 201: `public.taiwan_counties_simplified`/`taiwan_counties`/`county_boundary`. Then rerun the summary path. 2026-10-05: last 10 days still only `county=NULL` rows (one per source). **健檢 2026-11-08**：mig 505–510 後要重查；證據：10-05 只有 county=NULL。 | Summary has county rows rather than only `county=NULL`. |
| DIO-6 | 底線:資料正確 | P2 | blocked | `drought_alert_current` has not been written since 2026-05-15 without alerting. | Root cause (2026-10-05): `collectors/wra_drought_alert.py:191-203` produces no records when there are zero or unchanged alerts, so `storage/supabase_writer.py:185-189` returns early and skips the heartbeat. The stale current rows (Hsinchu and Taichung, published 04-27) are never cleared. The 3x rule itself works (it should read STALE), but the DB alert `metadata.check_collector_freshness` only checks MAX(last_success_at) across all collectors, so other collectors mask it. The public page parser currently reads alerts=[] (05-26 notice). Blocker: owner decision on how to represent a legitimate empty snapshot, whether to clear the old current rows, and per-owner alerting. | The collector records a run receipt for empty runs, stale current rows follow the decided policy, **and** a stalled owner raises its own alert. data-collectors `docs/investigations/2026-10-05-collector-health.md` §DIO-6 |
| HOST-1 | 底線:資料正確 | P2 | verifying | pulse-host 記憶體上限超賣：compose `mem_limit` 加總約 4,848 MiB，主機 4 GB＋swap。 | 先實測各容器實際用量（docker stats 數日峰值），再調整 `mem_limit` 或主機規格。 **2026-11-09 觀察中**：collector-mem 記峰值，**~11-16** 檢視後決定調整。 | mem_limit 加總不超過實體記憶體＋合理 swap，或記錄接受理由。 |
| GFW-1 | 底線:資料正確 | P3 | ready | GFW 小時檔停更是刻意（授權），在圖例標示。 | S3 `deploy-assets/global-maritime/gfw-hourly/manifest.json` 停在 2026-08-25。比照 #918 舊版每日船舶的寫法，圖例三語寫明停更原因與日期。使用者 2026-11-08 決定不藏層。<br>**2026-11-09 封存項併入**（原檔 [global-maritime](../../docs/archive/2026-11-09/features/global-maritime/backlog.md)）：區域正式化 5 項（固定切片 queue、每日增量、去重預產、DB／RPC、GFW 授權審查）；全球規模 6 項（tile catalog、overview／detail、PMTiles、容量成本 gate、分階段）；每日 job 產 GFW current snapshot 並驗授權 | 圖例顯示停更日期與原因。 |
| with-conn-timeout | 北極星:效率 | P2 | ready | Bound custom SQL and long collector tasks. | Add transaction-local timeout coverage for `satellite_passes` and `waste_match`. | Long calls terminate predictably without affecting unrelated pooled requests. |
| TD-1 | 底線:資料正確 | P2 | verifying | **2026-11-08 使用者拍板乙：不回補**（原始資料在 S3 永久保存；4/02 已超過 180 天保留期，補了也會被清）。剩下唯一動作：唯讀確認 pulse-host 的 `RAIL_TIMETABLE_INTERVAL`（只看 key 與是否 1440）與 manifest `expected_interval`，確認後關。 Stop `rail_timetable` from silently dropping whole days of TRA schedules. | Code fix merged in collectors #126 (2026-10-05): `config.py:291` default interval 1440→240; `supabase_writer.py:885-906` fallback now keeps `system='tra_daily'` with `metadata.degraded`, and a degraded upsert does not overwrite a healthy same-day row. (2026-10-16 盤點：待確認 data-collectors config/Zeabur 是否仍 1440) Not yet verified: whether a Zeabur `RAIL_TIMETABLE_INTERVAL` override still pins 1440 (check the variable name only), and manifest `expected_interval` is still 1440. Backfill awaits approval: 2026-04-02 (919 trains, in DB as `system='tra'`) and 2026-06-26 (S3 `rail_timetable/archives/`); the other 4 missing days are unrecoverable. **健檢 2026-11-08**：前提過時：collector 已搬 pulse-host，改查新主機 env；回補仍待拍板；證據：collectors #126；文中提 Zeabur 變數。 | Seven consecutive days each have a `tra_daily` row and no new `system='tra'` orphan; after the two backfills, to-arrival delay is no longer NULL on those days. data-collectors `docs/investigations/2026-10-05-collector-health.md` §TD-1 |
| FP-1 | 底線:備份 | P2 | ready | **2026-11-08 使用者拍板乙：3 年歷史整理成一個檔放 S3，主機每天讀「歷史檔＋最新菜價」算 1095 天中位數**（燈號意義不變、不再靠 Mac；Supabase 照 180 天保留）。State 改 ready，約半天；完成後停掉 Mac 的 launchd `com.gis.foodprice_index`，AU-8 一併補文件。 Move the food-price **index** pipeline off the local Mac onto the same 24/7 footing as every other collector. | Blocked on history: the light thresholds use a rolling **1095-day median**, but `live.food_price_daily` holds only 71 days (2026-07-27~10-05, queried 2026-10-05); the 3.64M-row raw backfill was never loaded into Supabase. Either load the raw history first, or have the collector read local parquet (which defeats the decoupling). **健檢 2026-11-08**：新保留期 180 天 < 1095 天中位數需求 → 前提衝突，需重新決策；證據：10-05 只 71 天；mig 505 food_price_daily 180 天保留。 | Index lands daily without a human or a Mac being awake. **Interim (2026-08-21): option A** — launchd `com.gis.foodprice_index` runs `pipelines/food_prices/wholesale_prices/run_daily.sh` at 06:00 (index max trade_date 2026-10-03 on 2026-10-05). [food-price stale recovery](../../docs/archive/2026-10-16/proposal/monitor-tweaks-2026-08-21/food-price-stale-recovery.md) |
| SBE-1 | 北極星:效率 | P1 | ready | VM 上 5 支收集器換成固定形狀寫入（R5；pulse-host 已於 collectors #192／#193 部署）。 | Owner: 主 agent。VM 部署一併帶 `utils/alerting.py`（ALERT-1）；全部部署後執行 `pg_stat_statements_reset`，隔日用 pg_stat_statements 驗證不再有大量變形 SQL 文字（查詢文字曾撐到 233MB）；驗完把 R5 由建議升為必須。 **2026-11-09**：VM 部分完成（collectors #194）。剩 **11-10** 驗：VM `/var/log/moa-opendata/collect.log` 00:53 寫入成功、pgss 查詢文字未暴增（pgss 已於 11-09 15:27 重置）→ 通過就把 R5 升為必須；菜價 11-07 缺資料續觀察。 | pg_stat_statements 查詢文字大小維持小量，R5 升必須。 |
| SBE-2 | 底線:資料正確 | P2 | verifying | 2026-11-10 跑 gis-platform mig 532 的測試，確認被刪的 11 個分區索引沒長回。 | Owner: 主 agent。避開 10:00–20:00 唯讀驗；長回就查是哪個 refresh／建表流程重建。 | 測試通過，11 個索引仍不存在。 |
| FARE-1 | 待討論 | P3 | blocked | `air_tickets.fare_offers` 自 2026-09-08 停更（寫入端 Hermes 已退役），資料去留。 | Blocked（owner decision）：保留舊資料唯讀、匯出 S3 後 drop、或重啟寫入端。 | 使用者決定並執行。 |
| CHK-1110 | 底線:資料正確 | P1 | verifying | 2026-11-10 要看的四件事。 | Owner: 主 agent（避開 10:00–20:00）：(1) mig 532 測試（SBE-2）；(2) VM moa 00:53 log 寫入成功（SBE-1）；(3) pgss 查詢文字量未暴增（SBE-1）；(4) 保留期限首次清理的刪除量＋大表 vacuum（WA-3）。 | 四項各有觀察紀錄，未達的回寫對應 ID。 |
| COL-POP-1 | 底線:資料正確 | P2 | ready | 在監人口（correctional）資料日期停在 05-15。 | 主 agent 2026-11-09 判定是收集器問題（不是上游停更）；First action：查收集器解析與上游最新檔日期。 | 資料日期追上上游最新發布。 |
| COL-ANIMAL-1 | 底線:資料正確 | P3 | verifying | 動物收容成果／獸醫寵物業點位 10-23 起沒新資料。 | 2026-11-09 判定是設計低頻（30／90／180／365 天），不是故障；**~11-20** 確認 `animal_shelter_outcomes` 有新 run。 | 有新 run 紀錄。 |
| FB-029 | 底線:資料正確 | P2 | ready | 〔civic-facilities-layers〕CF-4 welfareCenters 仍是 2023-04 快照，上游更新時重跑 | 原檔：[civic-facilities-layers](../../docs/archive/2026-11-09/features/civic-facilities-layers/backlog.md)。依據：條件觸發；可交給 pulse-data 更新清單（ADR-0024）偵測 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-038 | 底線:資料正確 | P2 | ready | 〔earthquake-replay〕EQ-2 首次出現 moment_tensor A 解時驗證 A 優先 | 原檔：[earthquake-replay](../../docs/archive/2026-11-09/features/earthquake-replay/backlog.md)。依據：等事件發生 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-049 | 底線:資料正確 | P2 | ready | 〔er-hospital〕ER-2 確認 inform Y/N 旗標語意 | 原檔：[er-hospital](../../docs/archive/2026-11-09/features/er-hospital/backlog.md)。依據：未見決策紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-056 | 底線:資料正確 | P2 | ready | 〔global-climate〕TY-2 颱風 popup 強度多為「—」，需新增 JMA 強度來源 | 原檔：[global-climate](../../docs/archive/2026-11-09/features/global-climate/backlog.md)。依據：未見 collector PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-069 | 底線:資料正確 | P2 | waiting_external | 〔isr-satellite-monitor〕ISR-MON-3 ISR registry 覆核日期 SLA 與逾期告警 | 原檔：[isr-satellite-monitor](../../docs/archive/2026-11-09/features/isr-satellite-monitor/backlog.md)。依據：未見紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-108 | 北極星:好用 | P3 | ready | 〔news〕NEWS-2 接 PTT 地方板 Atom feed | 原檔：[news](../../docs/archive/2026-11-09/features/news/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-109 | 北極星:AI | P3 | ready | 〔news〕NEWS-6 新聞事件 POI 級精度 | 原檔：[news](../../docs/archive/2026-11-09/features/news/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| NEWS-3 | 北極星:好用 | P3 | waiting_external | 新聞來源接 Threads 關鍵字搜尋：增加新聞來源可信度的候選。 | 需先通過 Meta app review；使用者 2026-11-09 決定保留在新聞這一群。原文：[news](../../docs/archive/2026-11-09/features/news/backlog.md)。 | app review 通過後再排實作與驗收。 |
| FB-110 | 底線:資料正確 | P2 | ready | 〔noise-layers〕NOISE-4 上游 snapshot 更新時重建替換 | 原檔：[noise-layers](../../docs/archive/2026-11-09/features/noise-layers/backlog.md)。依據：條件觸發；可交給 pulse-data 更新清單偵測 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-113 | 底線:資料正確 | P2 | ready | 〔parking〕PK-2 補 phase-2 座標覆蓋（台北基隆場外、新北台中路邊） | 原檔：[parking](../../docs/archive/2026-11-09/features/parking/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-115 | 底線:資料正確 | P2 | ready | 〔parking〕PK-4 parking_ref 改月更排程 | 原檔：[parking](../../docs/archive/2026-11-09/features/parking/backlog.md)。依據：條件觸發 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-116 | 底線:資料正確 | P2 | ready | 〔pla-activity〕PA-1 共機航跡 588 天全量向量化（先抽驗 2025 前版型） | 原檔：[pla-activity](../../docs/archive/2026-11-09/features/pla-activity/backlog.md)。依據：BACKLOG 索引寫 PA-1 只在此；PLA-190 只補 10/01–11/08 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-117 | 底線:資料正確 | P2 | ready | 〔pla-activity〕PA-2 26 天待審形狀人工複核（不放寬門檻） | 原檔：[pla-activity](../../docs/archive/2026-11-09/features/pla-activity/backlog.md)。依據：PLA-190 另有 10 天待審，可合併成一個複核批 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-118 | 北極星:AI | P3 | ready | 〔pla-activity〕PA-3 空飄氣球獨立欄位與圖層（從 raw_text 回填） | 原檔：[pla-activity](../../docs/archive/2026-11-09/features/pla-activity/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-122 | 底線:資料正確 | P2 | ready | 〔property-value〕PV-3 實價新季度快照重跑並重檢色階 | 原檔：[property-value](../../docs/archive/2026-11-09/features/property-value/backlog.md)。依據：條件觸發（季度更新）；可交給 pulse-data 更新清單 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-143 | 底線:資料正確 | P2 | ready | 〔vessel-watch〕VW-2 人工審 46 艘規則認不出的船 | 原檔：[vessel-watch](../../docs/archive/2026-11-09/features/vessel-watch/backlog.md)。依據：未見紀錄；可與 VZ-8 待查 7 筆、VZ-10 合成一個人工審查批 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-148 | 底線:資料正確 | P2 | ready | 〔vessel-watch〕VZ-8 needs_review 落地成 registry 欄位、999999999 路由邊界 | 原檔：[vessel-watch](../../docs/archive/2026-11-09/features/vessel-watch/backlog.md)。依據：檔內兩個已知瑕疵未處理；主項已完成，只列瑕疵 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-149 | 底線:資料正確 | P2 | ready | 〔vessel-watch〕VZ-9 AIS 寫入端加 MMSI 格式閘門（A 格式＋B 測試碼黑名單） | 原檔：[vessel-watch](../../docs/archive/2026-11-09/features/vessel-watch/backlog.md)。依據：未見 migration | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-150 | 底線:資料正確 | P2 | ready | 〔vessel-watch〕VZ-10 994161168（自主無人載具）分類精修與 994161820 查證 | 原檔：[vessel-watch](../../docs/archive/2026-11-09/features/vessel-watch/backlog.md)。依據：未見紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-159 | 底線:資料正確 | P2 | waiting_external | 〔welfare-layers〕WF-2 medLTC 暫不同步，待查清上游 C 級巷弄長照站縮 87% 原因 | 原檔：[welfare-layers](../../docs/archive/2026-11-09/features/welfare-layers/backlog.md)。依據：BACKLOG 索引寫 WF-2 P1 waiting_external、細節只在此，但無獨立列；建議進正本 BACKLOG | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-183 | 北極星:兼容 | P3 | ready | 〔waste-collection〕Phase 1B.1 接台中垃圾車 GPS collector | 原檔：[waste-collection](../../docs/features/waste-collection/research/roadmap.md)。依據：handoff.md 即時 GPS 只有高雄、新北、臺南三家；需先確認台中端點仍可用 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-186 | 底線:資料正確 | P2 | ready | 〔waste-collection〕Phase 4.4／4.5 PBF 月更與 hwms 月更自動化 | 原檔：[waste-collection](../../docs/features/waste-collection/research/roadmap.md)。依據：handoff：靜態資料無自動排程（301 註明）；可交給 pulse-data 更新清單 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| NEWS-1 | 底線:資料正確 | P3 | ready | 自由時報 RSS 在新主機是否可抓（原 news feature backlog 的 NEWS-1，2026-11-09 封存時未搬成列，2026-11-10 補登）。 | 原題：確認自由時報 RSS 在 production 是否仍被 Zeabur cloud IP 403；collector 已搬 pulse-host（Linode 東京），改在 pulse-host 驗。原檔：[news](../../docs/archive/2026-11-09/features/news/backlog.md)。 | pulse-host 上抓得到（記錄 HTTP 狀態），或確認仍被擋並決定替代來源。 |

## F. 站主資料、舊 RPC／舊路徑撤除

| ID | Tier | Pri | State | Item | Next action / blocker | Acceptance |
|---|---|---|---|---|---|---|
| OWD-4 | 底線:授權 | P2 | ready | 站主資料第 3 批。 | 使用者已同意照同一套系統規則搬。Owner: 主 agent。First action：英格蘭 EA、愛爾蘭 Coillte（林道 1.7 萬條改 PMTiles）搬進 owner-data；water1944Taipei 搬進私人檔；選舉活動等 11/28 選後匯出最後一版再轉（trigger 2026-11-28）。最後更新 ADR-0026 與 analytics skill `pulse-layer-release/references/license-and-deploy.md` 的 sidecar 規則（站主限定靜態資料改走 owner-data，不再用 owner-only RPC）。 **健檢 2026-11-08**：含 11-28 選舉活動 trigger。 | 上述圖層非站主讀不到資料（401）、站主正常；ADR 與 skill 規則已更新；IECOI-1 同步驗收。 |
| WA-4 | 底線:資安 | P3 | blocked | Retire the orphan `public` RPCs. | Review done — gis-platform [#138](https://github.com/ianlkl11234s/gis-platform/pull/138) (merged 2026-10-05, `docs/audit/2026-10-05-orphan-rpc-review.md`): 87 candidates = DROP_SAFE 15 / INTERNAL 41 / KEEP_EXTERNAL 2 / UNSURE 29. **DROP_SAFE 15 awaiting owner approval** (draft `docs/audit/2026-10-05-orphan-rpc-drop-batch-1.PENDING.sql` + rollback). `pg_stat_statements` only covers ~4 days since the 10-01 reset; option: enable `track_functions='all'` for one cycle first. **健檢 2026-11-08**：可與 SR-1/SR-2 同批；證據：gp #138。 | DROP_SAFE batch applied or deferred by owner decision; UNSURE 29 decided group by group. |
| AR-11e | 北極星:效率 | P1 | ready | Retire the CWA imagery DB fallback and legacy RPCs now that R2 CORS answers (also absorbs the stale imagery-backlog item IMG-cwa-r2-cors, closed 2026-10-16). | 2026-10-05 probe: `data.itsmigu.com` returns `access-control-allow-origin: *` on GET and OPTIONS (204). Next: production browser check (cloud/radar/timeline, zero legacy RPC calls), then redo open PR #428 on latest develop and ship migration 344 as a separately approved DB release. Keep the 14-day DB copy and collector dual-write. **健檢 2026-11-08**：與 CL-3 的 #428 重複；證據：PR #428 仍 draft（2026-10-03）。 | Production browser reads manifest/CDN imagery without CORS errors, frontend makes zero legacy RPC calls, and the RPC retirement ships as an independently verified DB release. [Imagery backlog](../../docs/archive/2026-11-09/features/imagery/backlog.md) |
| AR-12/13 | 北極星:效率 | P2 | ready | Move C-class shared realtime snapshots from per-user DB reads to CDN delivery. | (P1→P2 2026-10-16: design-only, overlaps static-to-cdn STC-*.) Define snapshot writer, manifest and CDN read contract. **健檢 2026-11-08**：與 static-to-cdn、#918 static-rpc 部分重疊，需重寫範圍；證據：設計中。<br>**2026-11-09 封存項併入**（原檔 [static-to-cdn](../../docs/archive/2026-11-09/features/static-to-cdn/backlog.md)）：STC-3 waste_stops 拆 per-city snapshot；STC-4 其餘 bespoke（data catalog、年度 H3、reservoir、satellite catalog）deferred | Target consumers read immutable/current CDN snapshots with no regression. [Architecture plan](../../docs/proposal/architecture-overhaul-plan.md) |
| EM-30 | 北極星:效率 | P2 | ready | Remove rail-geometry fallback only after an observation window. | Gate passed (not_before 2026-11-01; 2026-11-08 the fallback in `src/embed/railReplayData.ts` is still present). Owner: 使用者 (approval to delete the old S3 object). First action: check fallback fetch counts, then remove code and old S3 object together with approval. **健檢 2026-11-08**：需刪舊 S3 物件拍板；證據：11-08 railReplayData.ts 仍有 fallback。 | Production has used the hashed asset through the window and no fallback fetch occurred. [Embeddable map backlog](../../docs/archive/2026-11-09/features/embeddable-map/backlog.md) |
| SR-1 | 北極星:效率 | P2 | blocked | 撤舊 static layer RPC（#918 改讀 CDN static-rpc 之後）。 | Trigger：發版後觀察 7 天，舊 static RPC 呼叫數不再增加。火災兩支因 AI chat 白名單保留。Owner: 使用者拍板／主 agent。First action：發版當天記下各 RPC 在 `pg_stat_statements` 的 calls 基準，7 天後比對；不再增加就取號套 gis-platform `migrations/retire_static_layer_rpcs.PENDING.sql`（有 `.PENDING.test.sql`）。 **健檢 2026-11-08**：~11-15 可判斷；證據：#918 隨 v2.29.0 11-08。 | migration 已套、對應前端功能正常、火災兩支仍在。 |
| SR-2 | 北極星:效率 | P3 | ready | 撤 `public.data_catalog`。 | 已無讀者（#918 血緣改讀 metadata，需 mig 513）；唯一寫入者是 analytics 一次性匯入腳本。Owner: 主 agent（草稿）／使用者（套用拍板）。First action：全 repo 搜 `data_catalog` 讀寫點確認只剩該匯入腳本，另開 gis-platform migration（含 ROLLBACK）並把匯入腳本標停用。 | 表已撤、`rg data_catalog` 只剩歷史文件；衍生分析圖層的上游清單仍正常。 |
| FB-101 | 底線:資料正確 | P2 | waiting_external | 〔livestock〕LS-2 畜牧場補到 100% 覆蓋（上游 ARIS 後續批次） | 原檔：[livestock](../../docs/archive/2026-11-09/features/livestock/backlog.md)。依據：未見紀錄；注意已改站主資料（OWD 第 1 批），「CDN＋Supabase 雙寫」流程過時 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |

## G. 開發系統、CI 與告警

2026-11-08 健檢新增的開發系統與告警項目。來源：[健檢報告（2026-11-08）](../../../.gis-agent-system/projects/2026-10-zeabur-migration/healthcheck-20261108/) `dev-system.md`（自動化清單 A1–A15）、`telegram-alerts.md`。

| ID | Tier | Pri | State | Item | Next action / blocker | Acceptance |
|---|---|---|---|---|---|---|
| ALERT-1 | 底線:資料正確 | P3 | ready | 告警分級剩餘項（主體 2026-11-09 已完成，見已關閉）。 | Claude 待做：(1) aisstream 常駐 worker 接新告警；(2) HiCloud VM 下次部署要帶 `utils/alerting.py`（VM 5 支收集器換固定形狀寫入時一起，見 SBE-1）。 | 平常日 1–3 則；aisstream 與 VM 都走同一套「太久沒新資料」判斷。 |
| DEV-4 | 北極星:開發系統 | P2 | in_progress | 開場瘦身（自動化 A15）。 | Zeabur 刪除後停用 zeabur plugin；刪 `~/.claude-migu/skills` 的 docx／pdf／pptx／xlsx 手動副本；ctx-handoff 已有 PROJECTS／BACKLOG 正本的段落改成指標。 **2026-11-10 第一輪完成**：開場注入約 52.9K→31.3K 字（模擬值）；ctx-handoff 加注入上限、MEMORY.md 重整、GIS 根 `AGENTS.md` 與 `CLAUDE.md` 拆成兩個實體檔（之後各自維護）。進行中：GIS 專案排除公司全域 CLAUDE.md、停用 document-skills plugin。待做：Zeabur plugin 等使用者刪完 Zeabur 專案後停用。 | 開場注入量下降並記錄前後數字。 |
| DEV-5 | 北極星:開發系統 | P3 | blocked | 個人全域 `~/.claude-migu/CLAUDE.md` 的「強制分流規則」「模型指派」與 GIS 根 CLAUDE.md 不一致。 | 2026-11-09 已改 GIS 根 CLAUDE.md（worker 上限 1–2、現況入口改 PROJECTS／BACKLOG）與各 repo 過時指引。剩個人全域檔是使用者自己的指示，Claude 不自行改。Blocker：owner decision（要不要刪「>3 工具強制分流」與 sonnet 指派段）。 | 各層 CLAUDE.md 不再互相矛盾。 |
| CI-6 | 北極星:開發系統 | P2 | ready | CI 輸出 skipped 測試數並設上限（ratchet，自動化 A10）。 | mini ci.yml 加小腳本與基準檔。 | skip 數超過基準時 CI 紅燈。 |
| MCP-3 | 北極星:開發系統 | P3 | ready | 文件寫明倉庫組裝固定用 `/opt/homebrew/bin/python3.14`＋duckdb 1.5.3。 | 本機 `python3` 的 duckdb 2.0 與倉庫檔格式不相容；寫進 pulse-data 組裝說明與 runbook。 | 組裝文件有版本說明。 |
| FB-098 | 北極星:開發系統 | P3 | ready | 〔layer-manifest〕LM-HOOK-1 7 個 hybrid keys 掛載契約盲區 | 原檔：[layer-manifest](../../docs/archive/2026-11-09/features/layer-manifest/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-100 | 北極星:開發系統 | P3 | ready | 〔layer-manifest〕LM-YEAR-1 PENALTY_YEAR_MAX 調高時 golden 漂移 | 原檔：[layer-manifest](../../docs/archive/2026-11-09/features/layer-manifest/backlog.md)。依據：條件觸發；與 R5-2 汙染裁處預設年份相關；2027 年資料出現時觸發 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-167 | 北極星:開發系統 | P3 | ready | 〔welfare-layers〕WF-11 upstreamRegistry 跨 repo 檢查在 worktree／CI 下 skip | 原檔：[welfare-layers](../../docs/archive/2026-11-09/features/welfare-layers/backlog.md)。依據：upstreamRegistry.test.ts 仍用相對路徑 ../../../../taipei-gis-analytics，找不到就印 skipping | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-168 | 北極星:開發系統 | P3 | ready | 〔welfare-layers〕WF-12 layerParamsSpec.ts 含 NUL byte（grep 視為 binary） | 原檔：[welfare-layers](../../docs/archive/2026-11-09/features/welfare-layers/backlog.md)。依據：實測檔內仍有 2 個 NUL byte；小但會讓搜尋工具誤判 0 命中 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| DEV-7 | 北極星:開發系統 | P2 | ready | CHANGELOG 條目寫進舊版段落的自動檢查（健檢自動化 A6；健檢記 25 次，ctx-handoff 至 11-10 記 30 次）。 | [健檢 dev-system.md](../../../.gis-agent-system/projects/2026-10-zeabur-migration/healthcheck-20261108/dev-system.md) A6：`changelogFrozen` 測試比對 origin/master，已發布版本段落不可被改；長期改成 changes/ 片段檔。CI 要先 fetch master。 | 在舊版段落加一行時 CI 紅燈。 |
| DEV-8 | 北極星:開發系統 | P3 | ready | layer-golden／樣式盤點交會與合併衝突（健檢自動化 A7；健檢記 14＋7 次）。 | 健檢 A7 原案：strict up-to-date（依賴 CI-9 required check）＋`.gitattributes merge=ours`＋`scripts/dev/resolve-generated.sh` 重產生成檔。 | 兩個各自綠的圖層 PR 交會後，不再要手動重產 golden 才能合。 |
| DEV-9 | 北極星:開發系統 | P3 | ready | Bash 指令 `cd` 進 worktree 會切換 session 工作目錄的警告 hook（健檢自動化 A8；健檢記 39 次，ctx-handoff 至 11-10 記 44 次）。 | 健檢 A8：PreToolUse Bash hook `~/.claude-migu/hooks/cwd-guard.sh`，偵測 `cd …/.worktrees/` 時提醒改用絕對路徑或 `git -C`。（入口文件自動檢查是另一件事，見 DEV-13。） | hook 實測會在 cd 進 worktree 時提示。 |
| DEV-10 | 北極星:開發系統 | P2 | ready | 收尾寫錯上線狀態：`where-is` 腳本（健檢自動化 A9；健檢記 9 次）。 | 健檢 A9：`scripts/release/where-is.sh <sha>` 回答「在 develop／master 嗎、哪個 tag、正式站 main-*.js 版號」，wrap-up skill 引用。 | wrap-up 寫上線狀態前一律跑這支。 |
| DEV-11 | 北極星:開發系統 | P3 | ready | Codex 版 skill 與 Claude 版分歧（健檢自動化 A13）。 | `.agents/skills/supabase-optimize` 改成 adapter 指回 `.claude` 版，比照 wrap-up。 | 兩邊只剩一份內容。 |
| DEV-12 | 北極星:開發系統 | P3 | ready | pulse-* skill 依附在 worktree（健檢自動化 A14）。 | `~/.claude-migu/skills` 的 pulse-* symlink 改指 `GIS/mini-pulse-gis-mcp/plugins/pulse-analyst/skills/*`（MCPD-1 部署時一併更新）。 | 刪掉任何 worktree 後 skill 仍可載入。 |
| CI-8 | 底線:資安 | P2 | blocked | Dependabot：alerts 已開，剩回讀與 `dependabot.yml`。 | 2026-11-10：7 個 repo alerts 已開；gis-platform portal 135→1（gp #239）；analytics 預期 16→0（#358 升級 requirements、#359 移除未使用的 fiona；notebook 7.6.3），實際數待 Dependabot 重算後回讀。`dependabot.yml` 自動升版 PR 要不要開：Blocker owner decision。 | 各 repo alerts 數回讀並記錄；`dependabot.yml` 去留有決定。 |
| ASSET-1 | 底線:資料正確 | P2 | ready | 被前端引用但不在 lock 的資料檔補進 lock。 | mini #999 已上 `asset-lock-audit.yml`（每日 lock 596 筆 HEAD、輪替抽 sha、反向列 lock 外被引用的檔）並手動跑過成功；lock 外被引用的 216 個列入只減不增基準 `deploy/public-assets-not-in-lock.txt`。剩：其中 R2 供應的 215 個（約 5.5 GB）用 `build-public-assets-lock.py add` 補進 lock。 | `public-assets-not-in-lock.txt` 清空。 |
| SQLL-2 | 底線:期限 | P3 | ready | ADR-0026 §6 與 mini `docs/supabase-optimization.md` §0 補寫 sql-lint L3。 | gis-platform #238 已上 L3（編號 ≥550）；兩份文件還沒提。 | 兩份文件寫明 L3 規則與豁免寫法。 |

## H1. 台灣圖層

| ID | Tier | Pri | State | Item | Next action / blocker | Acceptance |
|---|---|---|---|---|---|---|
| BR-6 | 底線:資料正確 | P2 | ready | Improve Business Registry geocoding without substituting company coordinates. | TGOS is the chosen source: p01/p02 backfill (analytics `690be1bd`) cut 202609 misses 2,600→2,421 with denominator 656,713 stable, ambiguous kept unresolved; LOCAL_ONLY. Next: decide whether to run further TGOS packs and publish a dated 202609 asset (ties to BR-C-202609) without overwriting 202608. | Misses decrease with denominator stable; unresolved reasons retained; published asset has new dated filename and checksum. [Company backlog](../../docs/archive/2026-11-09/features/business-registry-company-layers/backlog.md) |
| GBA-1 | 底線:資料正確 | P2 | ready | GBA 建物足跡涵蓋不足：Pulse `buildings_value_taiwan.pmtiles` 與 analytics 加工檔一致（聯集 17.88 km²），缺口在 GBA 上游本身、集中在 OSM 稀疏區。中永和 534 個統計區建築用地 >1000 m² 但足跡 <5%（約 11.7 萬人、2.6 km²）；永和市中心疊 NLSC 正射約一半街廓無建物框；抽樣板橋 15%、苓雅 13%，大安、台中西區、台南中西約 4–5%。影響 `buildingsGba`、建物估值、`urban_form_grid`。 | First action：評估改用或補疊 NLSC／內政部建物資料；短期先在相關圖層圖例標註涵蓋不足。 **健檢 2026-11-08**：至少先在圖例標註。<br>**2026-11-09 封存項併入**（原檔 [urban-form](../../docs/archive/2026-11-09/features/urban-form/backlog.md)）：UF-2 補澎湖金馬建物圖磚 | 選定補資料方案並上線（或圖例已標註涵蓋不足並記錄不補原因）；中永和抽樣街廓缺框率明顯下降。 |
| MC-5 | 底線:資料正確 | P3 | ready | Refresh static LST after the 2026 warm season. | Gate passed (not_before 2026-10-01); as of 2026-10-05 the latest product is still `urban_heat_lst_*_20260729` and production serves that build. Rerun the median pipeline for the full 2026 warm season, review color ranges, then publish a dated replacement. | Replaced asset has date/provenance and expected P2–P98 ranges. [Urban Heat backlog](../../docs/archive/2026-11-09/features/urban-heat-lst/backlog.md) |
| TWL-13 | 底線:授權 | P3 | blocked | G38 全國都市計畫區邊界。 | Blocked: 授權不明（國土署／國土測繪中心，需使用者發信）。Pulse 只有北市、新北使用分區與非都市土地使用分區；analytics 只有 luz_tcd_poc 試抓。 | 授權確認後開 pipeline。[G38](../../../.gis-agent-system/roadmap/candidates/G38-urban-plan-district-boundaries.md) |
| TWL-5 | 北極星:好用 | P2 | ready | 第二批：三個 worktree／三個 PR（使用者 2026-10-29 同意分組，「晚點再來處理」）。 | (1) 災害暴露：G32 涼適點（177893，約 7,100 點是超商，要能篩公有）＋熱傷害縣市日統計（157637，需瀏覽器 UA、cp950）；G30 鄉鎮「戶籍人口 ÷ 避難容量」衍生層（分母不可用 `ds_demographics_population`，容量總數與內政部的差異要說明）。(2) 科技執法：G34 各縣市科技執法點位（約 18 縣市有官方清單，臺東 178734 經緯度顛倒）。(3) 水：G31 河段申報排放負荷（EMS_S_03，依河川×申報期聚合，證據類型 Reported）＋G29 雨水下水道管線（`storm_drainage_pipes`，只有臺北、桃園、嘉義市，其他縣市標未涵蓋）。同時最多 3 個 worker，共用登記檔由主 agent 接線。 | 三個 PR 合進 develop、CI 綠、本機 dev 目視。[G29](../../../.gis-agent-system/roadmap/candidates/G29-flood-realtime-scenarios.md)／[G30](../../../.gis-agent-system/roadmap/candidates/G30-disaster-shelter-civil-defense.md)／[G31](../../../.gis-agent-system/roadmap/candidates/G31-drinking-water-source-pollution.md)／[G32](../../../.gis-agent-system/roadmap/candidates/G32-urban-heat-exposure.md)／[G34](../../../.gis-agent-system/roadmap/candidates/G34-police-traffic-enforcement.md) |
| TWL-6 | 北極星:好用 | P2 | ready | 第三批：需要新 collector 的即時層（水利署集水區即時降雨 178988–178990、消防署災情與收容開設）。 | 原阻塞「Zeabur 搬遷完成」已解除（2026-11-08 使用者確認 collector 已搬到新主機 pulse-host）。First action: 依 G29／G30 規格在 data-collectors 新增 collector，部署到 pulse-host。 | collector 上線、前端即時圖層接上。[G29](../../../.gis-agent-system/roadmap/candidates/G29-flood-realtime-scenarios.md)／[G30](../../../.gis-agent-system/roadmap/candidates/G30-disaster-shelter-civil-defense.md) |
| TWL-15 | 北極星:AI | P2 | ready | G35–G37 合併後的接續工作（2026-10-31；G35–G37＋#791 已隨 v2.19.0 上線）。 | (1) ~~發版日上傳~~ v2.19.0 已上傳 `traffic_accidents_2025.pmtiles`（正式站 200）；但正式站 `fire_hydrants_national.pmtiles` 是 #771 舊版（sha 15341b1c…，主 checkout 為 #791 新版 6ed4d0b1…），程式已是 #791 → 台水約 14 萬點畫成「其他」灰。使用者 2026-11-02 選「換新檔名、隨下次發版」：`fire_hydrants_national_v2.pmtiles`（fix/tw-hydrant-v2，與本筆同一個 PR），**下次發版日上傳**，本機主 checkout `public/geo/`：`fire_hydrants_national_v2.pmtiles`＝#791 版（6ed4d0b1…，要上傳），`fire_hydrants_national.pmtiles`＝#771 版（與 S3 相同，上傳守門會略過；之後無引用可清）；舊版備份 `GIS/_worktree-backups/fire_hydrants_national.pr771.pmtiles`。(2) pulse-data registry 補條目：G35 6 筆、G36 5 筆＋消防栓全國（含台水 44642 來源與型式對照）、G37 7 筆＋`importantWetlandZones`（#791，25659 功能分區 578 面），並同步 analytics data-catalog `used_by_pulse_layers`。(3) 村里教育程度統計層：analytics 已有資料與 `docs/handoff/village-education-recipes.draft.json`，走 R2 發布。(4) 跳過的來源：地質敏感區 27744（RAR 需另解）、暴潮線 158145（GeoTIFF 需轉向量）。濕地功能分區已做（#791）。(5) 合併後目視 2026-10-31 已完成。(6) `statsRiceHarvest`（datasetId `rice_harvested_area_township`）section.theme 隨 #777 改了，MCP datasetLabels 要重產。First action: (1) 下次發版日上傳 v2 檔；(2) 開 pulse-data PR。 **健檢 2026-11-08**：只剩 (3) 村里教育程度統計、(4) 地質敏感區／暴潮線；(1)(2)(6) 可劃掉；證據：(1) 正式站 fire_hydrants_national_v2.pmtiles 206、manifest 已用 v2；(2)(6) pulse-data #57–#60 補登、MCP #100 重產。 | (1) 正式站 `?layers=fireHydrants` 台水點顯示地上式／地下式；(2) registry 測試綠、MCP 查得到；(3) 統計入口看得到；(4) 每項做或結案。 |
| TWL-7 | 北極星:AI | P3 | ready | 縣市×降雨情境的淹水高潛勢面積比例做成統計圖層。 | 資料已在 Supabase（G29 深挖時算出），尚未發布 R2 snapshot。First action: 依 statistics-layer-guidelines 走 pulse-layer-release。 | 統計面板可選情境、資料來源總覽同步。[G29](../../../.gis-agent-system/roadmap/candidates/G29-flood-realtime-scenarios.md) |
| TWL-17 | 北極星:好用 | P2 | ready | 台灣圖層待辦池：使用者說「做更多台灣圖層」時從這裡挑（2026-11-09 用 data.gov.tw 探索器快照全量反查各 repo 現況；快照自帶的 pulse 欄已過時）。A 級 18 組（P01–P18，例：臺鐵平交道、郵筒、土石流潛勢溪流、特定水保區、山坡地範圍、TEDS 排放網格、抗蛇毒血清）、B 級 22 組（P19–P40）、統計 10 名（S01–S10），分四個建議批次。**2026-11-09 批 1（P02、P03、P04、P05、P07、P09、P10、P11）已合 develop**（mini #967、analytics #335、pulse-data #86，待發版）；剩批 4（P19–P40 B 級、統計 S01–S10）。**2026-11-10 批 2＋3（P01、P06、P08、P12–P18）共 11 層已上線**（v2.35.0；mini #982、analytics #341／#342、pulse-data #95，倉庫 20261109T183223Z）；主 agent 代決項（P06 點源工廠模式、P01／P13／P14 部分上圖、P12 粗化、各層群組位置）使用者 2026-11-10 確認 OK；P01 平交道 801 處中 440 處上圖、P13 煙火 19 處中 10 處、P14 監理所站 37 處中 34 處（其餘查無可驗證定位）；P06 未收非道路與 NH3。待辦：(b) #104 時間欄修正後有 11 表無法自動驗證時間口徑（dioxin、飲水保護區、焚化爐、噪音、PM2.5 人工站、海水水質、RPI 河段×2、RPI 測站、污水廠、水質站），要人工抽看；(c) mapchallengeDay09UrbanRural 尚未登記 registry（另一 session 的圖層）。已處理：舊 ds_water_resources_debris_flow 撤出倉庫、Day 8 四層補登記（pulse-data #87，使用者 11-09 決定）。剩小項：郵筒 pickup_times 入倉被推斷成時間型別（7 筒雙時段只留第一個，地圖正常），要改 mini-pulse-gis-mcp build_warehouse 讀成字串再重發包，待使用者決定。 | First action：請使用者用編號挑項目或批次（批 1 計畫書可當範本：`.gis-agent-system/projects/2026-11-tw-layer-pool-batch1/`）；開工前對挑到的項目再比一次 mini `origin/develop` 的 manifest 與 pulse-data registry，並重打 data.gov.tw 資料集頁。做完在 G53 表格把狀態改成 ✅＋PR。<br>**2026-11-09 封存項併入**（原檔 [social-statistics](../../docs/archive/2026-11-09/features/social-statistics/backlog.md)、[tourism-layers](../../docs/archive/2026-11-09/features/tourism-layers/backlog.md)）：28 個延伸候選另輪規劃；TO-5 每月快照重跑接半動態提醒 | 挑定的項目上線（圖層＋registry＋分析倉庫）且 G53 表格狀態已更新；池子做完或剩下的全部標 ❌ 理由後關閉本列。[G53](../../../.gis-agent-system/roadmap/candidates/G53-tw-layer-pool-atlas.md) |
| FB-002 | 北極星:視覺 | P3 | waiting_external | 〔aquaculture〕AQ-3 放養量 G70（79 點）接入 | 原檔：[aquaculture](../../docs/archive/2026-11-09/features/aquaculture/backlog.md)。依據：查不到 PR；上游未交付 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-003 | 底線:資料正確 | P2 | waiting_external | 〔aquaculture〕AQ-4 牡蠣養殖區上游正式 pipeline 化 | 原檔：[aquaculture](../../docs/archive/2026-11-09/features/aquaculture/backlog.md)。依據：查不到 PR；上游 staged | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-004 | 待討論 | P3 | ready | 〔aquaculture〕AQ-5 popup 顯示資料來源 Tier（等上游補 source_tier 欄） | 原檔：[aquaculture](../../docs/archive/2026-11-09/features/aquaculture/backlog.md)。依據：條件觸發，上游未補 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-005 | 北極星:視覺 | P3 | ready | 〔atlas-layers〕地名文字標籤：PMTiles 不畫 symbol，要另出精簡 GeoJSON | 原檔：[atlas-layers](../../docs/archive/2026-11-09/features/atlas-layers/backlog.md)。依據：未見對應 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-006 | 北極星:視覺 | P3 | ready | 〔atlas-layers〕孤島地區點大小依人口 | 原檔：[atlas-layers](../../docs/archive/2026-11-09/features/atlas-layers/backlog.md)。依據：未做（檔內寫現為固定大小）；小 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-007 | 北極星:好用 | P3 | ready | 〔atlas-layers〕微塑膠、海龜年份／類別篩選細化 | 原檔：[atlas-layers](../../docs/archive/2026-11-09/features/atlas-layers/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-011 | 北極星:AI | P3 | ready | 〔atlas-statistics〕財稅、海廢、體育參與補人均或每公里海岸版（分母待上游） | 原檔：[atlas-statistics](../../docs/archive/2026-11-09/features/atlas-statistics/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-012 | 底線:資料正確 | P2 | ready | 〔atlas-statistics〕社會脆弱度子指標方向待 NCDR 確認 | 原檔：[atlas-statistics](../../docs/archive/2026-11-09/features/atlas-statistics/backlog.md)。依據：等外部回覆 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-019 | 待討論 | P3 | ready | 〔business-registry-company-layers〕BR-C-CATEGORIES 產業類別多選（產品需要才做） | 原檔：[business-registry-company-layers](../../docs/archive/2026-11-09/features/business-registry-company-layers/backlog.md)。依據：待使用者拍板 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-020 | 北極星:AI | P3 | ready | 〔business-registry-company-layers〕BR-C-INDUSTRY-LQ 單一產業相對全台集中度（區位商數） | 原檔：[business-registry-company-layers](../../docs/archive/2026-11-09/features/business-registry-company-layers/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-021 | 待討論 | P3 | waiting_external | 〔business-registry-industrial-layers〕BR-I-A3 三個 assertion flags 分開接篩選（待產品語意） | 原檔：[business-registry-industrial-layers](../../docs/archive/2026-11-09/features/business-registry-industrial-layers/backlog.md)。依據：待使用者拍板語意 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-027 | 底線:資料正確 | P2 | waiting_external | 〔civic-facilities-layers〕CF-2 公共圖書館與文化設施（typeId=K）重疊去重 | 原檔：[civic-facilities-layers](../../docs/archive/2026-11-09/features/civic-facilities-layers/backlog.md)。依據：未見去重 PR；等上游欄位 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-028 | 北極星:好用 | P3 | waiting_external | 〔civic-facilities-layers〕CF-3 公廁補欄位以支援無障礙篩選 | 原檔：[civic-facilities-layers](../../docs/archive/2026-11-09/features/civic-facilities-layers/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-034 | 底線:授權 | P2 | ready | 〔demographics-statistics〕到 data.gov.tw 確認授權後更新來源卡措辭 | 原檔：[demographics-statistics](../../docs/archive/2026-11-09/features/demographics-statistics/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-037 | 北極星:視覺 | P3 | ready | 〔earthquake-replay〕EQ-5 接海嘯警報 badge 與 WarningArea popup | 原檔：[earthquake-replay](../../docs/archive/2026-11-09/features/earthquake-replay/backlog.md)。依據：src 無 tsunami_alerts | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-044 | 底線:資料正確 | P2 | ready | 〔environment-layers〕RPI 河段 partial_unverified 32 段是否另標 | 原檔：[environment-layers](../../docs/archive/2026-11-09/features/environment-layers/backlog.md)。依據：等上游驗證 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-045 | 底線:資料正確 | P2 | ready | 〔environment-layers〕RPI 河段 87 段 review_flags 待 analytics 人工複核回寫 | 原檔：[environment-layers](../../docs/archive/2026-11-09/features/environment-layers/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-046 | 底線:資料正確 | P2 | ready | 〔environment-statistics〕CDN readback 抽查公害陳情、自來水 0 值、裁處率 >100% | 原檔：[environment-statistics](../../docs/archive/2026-11-09/features/environment-statistics/backlog.md)。依據：未見紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-047 | 底線:資料正確 | P2 | ready | 〔environment-statistics〕羅浮／義盛水資源回收中心 geocode 同座標重疊 | 原檔：[environment-statistics](../../docs/archive/2026-11-09/features/environment-statistics/backlog.md)。依據：上游 APPROXIMATE，未見修正 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-050 | 底線:資料正確 | P2 | waiting_external | 〔funeral-layers〕FN-2 殯葬設施 438 筆無座標尾巴回填（等上游） | 原檔：[funeral-layers](../../docs/archive/2026-11-09/features/funeral-layers/backlog.md)。依據：未見上游重跑紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-051 | 北極星:兼容 | P3 | waiting_external | 〔funeral-layers〕FN-3 都計墓地分區擴到其他 20 縣市，另找非都市「墳墓用地」 | 原檔：[funeral-layers](../../docs/archive/2026-11-09/features/funeral-layers/backlog.md)。依據：目前只有雙北 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-053 | 北極星:AI | P3 | waiting_external | 〔funeral-layers〕FN-6 業者密度改每萬人 | 原檔：[funeral-layers](../../docs/archive/2026-11-09/features/funeral-layers/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-091 | 底線:資料正確 | P2 | ready | 〔landslide〕水保災害損失單位向農水署確認（推定千元） | 原檔：[landslide](../../docs/archive/2026-11-09/features/landslide/backlog.md)。依據：未見紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-092 | 底線:資料正確 | P2 | ready | 〔landslide〕崩塌地處理面積離群值釐清 | 原檔：[landslide](../../docs/archive/2026-11-09/features/landslide/backlog.md)。依據：未見紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-093 | 底線:資料正確 | P2 | ready | 〔landslide〕影響範圍 county「苗栗／苗栗縣」與 res_class 變體未正規化 | 原檔：[landslide](../../docs/archive/2026-11-09/features/landslide/backlog.md)。依據：上游未修 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-095 | 北極星:視覺 | P3 | ready | 〔landslide〕年度崩塌地低縮放需上游出概化版 | 原檔：[landslide](../../docs/archive/2026-11-09/features/landslide/backlog.md)。依據：符合 map-layers 全國視角規範 V 系列，未做；#788 只加點面切換 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-096 | 北極星:好用 | P3 | ready | 〔layer-manifest〕LM-POPUP-1 29 個無 popup 圖層分 9 包補接 | 原檔：[layer-manifest](../../docs/archive/2026-11-09/features/layer-manifest/backlog.md)。依據：no-popup-audit.md 仍在；未見對應 PR；違反四鐵則 popup，可考慮升優先 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-102 | 底線:資料正確 | P2 | waiting_external | 〔livestock〕LS-4 EMS_S_01 補 geocode miss 的豬牛場 | 原檔：[livestock](../../docs/archive/2026-11-09/features/livestock/backlog.md)。依據：未見紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-111 | 北極星:兼容 | P3 | ready | 〔noise-layers〕NOISE-5 新縣市取得官方管制 polygon 時擴充 | 原檔：[noise-layers](../../docs/archive/2026-11-09/features/noise-layers/backlog.md)。依據：條件觸發 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-114 | 底線:資料正確 | P2 | ready | 〔parking〕PK-3 car_park_type 是否需正式 codebook | 原檔：[parking](../../docs/archive/2026-11-09/features/parking/backlog.md)。依據：未見紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-123 | 底線:資料正確 | P2 | ready | 〔religion〕RL-3 補無座標尾巴（temples 2 筆等） | 原檔：[religion](../../docs/archive/2026-11-09/features/religion/backlog.md)。依據：未見 PR；小 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-126 | 北極星:兼容 | P3 | ready | 〔road-congestion〕RC-3 v2 擴充市區路況（桃中南基宜）與速度 popup | 原檔：[road-congestion](../../docs/archive/2026-11-09/features/road-congestion/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-131 | 北極星:兼容 | P3 | ready | 〔street_trees_taipei_diff〕STD-1 擴充到其他縣市（等上游 diff） | 原檔：[street_trees_taipei_diff](../../docs/archive/2026-11-09/features/street_trees_taipei_diff/backlog.md)。依據：條件觸發 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-133 | 底線:資料正確 | P2 | ready | 〔terrain-vector〕TV-2 坡度解析度精細化（現 100m 低估陡度） | 原檔：[terrain-vector](../../docs/archive/2026-11-09/features/terrain-vector/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-134 | 底線:資料正確 | P2 | ready | 〔tourism-layers〕TO-3 tourRestaurants 分色 v2（等 cuisine_class 官方對照） | 原檔：[tourism-layers](../../docs/archive/2026-11-09/features/tourism-layers/backlog.md)。依據：等上游 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-138 | 北極星:兼容 | P3 | ready | 〔urban-zoning〕UZ-1 逐城補其他縣市都計分區 | 原檔：[urban-zoning](../../docs/archive/2026-11-09/features/urban-zoning/backlog.md)。依據：記憶：全國分區無官方來源，只能逐縣市拼；TWL-13 是都計區「邊界」不同題 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-140 | 底線:資料正確 | P2 | ready | 〔urban-zoning〕UZ-5 上游移除北市 4 筆範圍框 meta-polygon | 原檔：[urban-zoning](../../docs/archive/2026-11-09/features/urban-zoning/backlog.md)。依據：前端有防禦 filter，上游未清；小 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-144 | 北極星:好用 | P3 | ready | 〔vessel-watch〕VW-5 圖例接 get_vessel_watch_classes 顯示即時艘數 | 原檔：[vessel-watch](../../docs/archive/2026-11-09/features/vessel-watch/backlog.md)。依據：vesselWatchLoader.ts 註明本層目前未用，圖例走靜態 12 類 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-145 | 底線:資料正確 | P2 | ready | 〔vessel-watch〕VW-6 只有 1 個定位點的船沒有軌跡線的誤讀 | 原檔：[vessel-watch](../../docs/archive/2026-11-09/features/vessel-watch/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-146 | 北極星:好用 | P3 | ready | 〔vessel-watch〕VZ-5 圖層 popup 顯示距離與 zone、依 zone 描邊、只看接近船 | 原檔：[vessel-watch](../../docs/archive/2026-11-09/features/vessel-watch/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-147 | 北極星:視覺 | P3 | ready | 〔vessel-watch〕VZ-6 +6／+12 浬預警環 GeoJSON（標非法律界線） | 原檔：[vessel-watch](../../docs/archive/2026-11-09/features/vessel-watch/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-162 | 北極星:好用 | P3 | ready | 〔welfare-layers〕WF-5 早療單位「純社福」篩選 | 原檔：[welfare-layers](../../docs/archive/2026-11-09/features/welfare-layers/backlog.md)。依據：目前只在 popup 提醒 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-164 | 底線:資料正確 | P2 | ready | 〔welfare-layers〕WF-7 上游 trust_chain 同址不同名去重 | 原檔：[welfare-layers](../../docs/archive/2026-11-09/features/welfare-layers/backlog.md)。依據：上游未做 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-165 | 底線:資料正確 | P2 | ready | 〔welfare-layers〕WF-8 性侵害防治中心只有 7 筆（官方連結 404） | 原檔：[welfare-layers](../../docs/archive/2026-11-09/features/welfare-layers/backlog.md)。依據：未見替代來源 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-166 | 北極星:兼容 | P3 | ready | 〔welfare-layers〕WF-10 居家托育（保母）全國來源 | 原檔：[welfare-layers](../../docs/archive/2026-11-09/features/welfare-layers/backlog.md)。依據：條件觸發；可放 TWL-17 台灣圖層池；或 merged:TWL-17 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-177 | 底線:資料正確 | P2 | ready | 〔i18n〕少數上游公車站英文名錯誤（例：財政部印刷廠→Dalijian library） | 原檔：[i18n](../../docs/features/i18n/ROADMAP.md)。依據：未見修正紀錄；小 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-184 | 底線:資料正確 | P2 | ready | 〔waste-collection〕表定動畫改沿路網（OSRM stop-to-stop，BL-17／Phase 4.2） | 原檔：[waste-collection](../../docs/features/waste-collection/research/roadmap.md)。依據：handoff.md 寫明目前直線插值會穿越建物水域，BL-17 未做 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| ARTS-CAT | 底線:資料正確 | P3 | ready | 藝文活動 category 1–19 來源代碼補官方對照。 | 查證 2026-11-09：`src/research/artsEventsOwnerDataset.ts` coverage 仍寫「category 為未對照的來源代碼」。原文：[culture-layers](../../docs/archive/2026-11-09/features/culture-layers/backlog.md)。 | 代碼對照有官方出處，倉庫與 popup 顯示中文類別。 |
| WASTE-CITY | 待討論 | P3 | blocked | 垃圾車圖層城市切換與 matched／fallback 圖例。 | Blocked on owner decision。查證 2026-11-09：未做——wasteTruck 參數只有 4 個 slider＋3D 開關，圖例依 R6 LG-1 刻意做成單列同色。原文：[waste-collection](../../docs/features/waste-collection/research/roadmap.md)。 | 決定要不要做；要做則加城市選單與圖例分類並截圖。 |

## H2. 多國圖層

| ID | Tier | Pri | State | Item | Next action / blocker | Acceptance |
|---|---|---|---|---|---|---|
| MAR-3 | 底線:資料正確 | P2 | verifying | Explain AIS points whose displayed position violates geographic intuition. | Local browser clicked MMSI `994163329` near inland Tucheng; check raw coordinates, vessel/AtoN class, timestamp and upstream semantics before changing filters or geometry. | Each sampled inland point is classified as legitimate AtoN/static report, upstream bad coordinate, or transform bug; any required filter/fix has a reproducible test and denominator impact. [Global maritime backlog](../../docs/archive/2026-11-09/features/global-maritime/backlog.md) |
| EA-1 | 底線:期限 | P2 | conditional | 英格蘭 EA Pollution Inventory 授權一年到期（2026-10-29 起算，2027-10-29 自動終止）。 | Trigger／not_before：2027-10-01（到期 2027-10-29 前）；owner：使用者決定續期或下架，Claude 執行。First action: 確認 EA 是否續期或改發新年度檔；不續就刪 `reference.world_gb_ea_pollution_inventory` 資料並下架 `gbPollutionInventoryEngland`。⚠️ 圖例數字（2,544／1,693／851／8 處郵遞區號定位）寫死在前端，重新匯入時要一起改。 **健檢 2026-11-08**：OWD-4 搬 owner-data 後下架步驟要改寫。 | 到期前已續期換資料，或已刪資料並下架。 |
| I18N-1 | 北極星:兼容 | P2 | ready | 英日文介面下，統計圖層彈窗／說明的「資料限制／口徑說明」段落改成對應語言（2026-10-24 發現：目前英日文仍顯示中文）。 | 範圍：全部統計圖層（atlas 各家族、治安、死因、臺北局處、社會、勞動、環境、成癮、崩塌、人口等）。原因：說明文字（各家族 recipe／release 的 `disclosure`）直接寫在 recipe／資料設定，彈窗（`regionalStatisticsPanel.tsx` 的 dataLimits 列）與說明・來源（`StatisticsDetails.tsx`）只經 `humanizeStatisticsText` 換內部代碼，沒接 i18n。建議做法：說明文字改用翻譯鍵（比照 `enum.statLegendNote.*`），或 recipe 帶 `disclosure_en`／`disclosure_ja` 欄位由 builder 產生；可依家族分批，先做 atlas 第二批（G10／G16／G23）。粗估 1–2 天。<br>**2026-11-09 封存項併入**（原檔 [i18n](../../docs/features/i18n/ROADMAP.md)）：P2 地圖 hook／圖層文字 350 行未翻：2026-11-09 hardcoded-zh 報告：P2「地圖 hook／圖層文字」643 行（基準 386）仍未翻（原 P2 約 350 行項） | 英日文介面開任一統計層，資料限制段落無中文外漏；`statisticsText.test.ts` 加 disclosure 的外文檢查。 |
| JPW4-1 | 北極星:好用 | P3 | blocked | 補日本身障服務的放課後等デイサービス、共同生活援助等類別（WAM NET 來源）。 | Blocked on 使用者本人先填 WAM NET 的利用表單通知（Claude 不能代填）。現況：`jpWelfareDisability` 只用国土数値情報 P14，沒有這些類別。First action: 使用者填完表單後，在 analytics 新增 WAM NET pipeline，前端併入或另開一層。 | 新類別上線並標示來源與授權。analytics `docs/handoff/jp-wave4-welfare-roads.md` §4 |
| UKOSM-1 | 北極星:好用 | P3 | blocked | OSM 五層：C014 橋隧、C018 道路設施、B 級路、C033 公共設施、C049 宗教。 | Blocked：本機 IP 疑被 Overpass 封鎖。First action: 換網路（或 Overpass 鏡像）在 analytics 重跑各 `07_export.py`，資料到手後一層一 PR 接前端。 **健檢 2026-11-08**：可改在 pulse-host 跑 Overpass。 | 五層資料產出、前端上 develop、瀏覽器截圖驗收。 |
| KRH-1 | 北極星:好用 | P3 | ready | HOLD 兩層：C101 廣域淨水場、C117 생태자연도。 | 淨水場：地址名冊用 Nominatim 補座標，點位級命中只有 1/42，需另找座標來源。生態自然圖：KOGL 3（可商用、禁改作），全國 0.8–2.7GB、江原道單檔 614MB，等 Zeabur 主機搬遷後處理。First action: 搬遷完成後在 analytics 重評體積與切圖方式。 **2026-11-10 多國跨夜**：2026-11-10 重評：C101 淨水場 OSM 只對到 2/42、其他來源要金鑰（或使用者同意用 Google）→ 維持 HOLD；C117 生態自然圖要「一層多檔」新設計，且 KOGL 3 禁改作、低縮放簡化算不算改作未定 → 延後，等使用者決定。詳 analytics south_korea PLAN §3 w9。 | 兩層各有可用座標／PMTiles，或在 analytics PLAN §3 註明放棄原因。 **2026-11-10 使用者決定「做」**：C117 生態自然圖（一層多檔）與 C086 垃圾排出資訊（無座標，只能行政區表格或彈窗）都要新設計，先出設計稿給使用者看再實作；C101 淨水場維持 HOLD。 **2026-11-10 設計稿拍板**（https://claude.ai/artifact/3HbEoZF2C5Huw4xgwCKsR5，截圖 `.gis-agent-system/projects/2026-11-multi-country-night/shots/kr-design/`）：C117 選 A＝原樣幾何、依시·도分 17 檔按視窗載入、z10 以上才顯示，拉遠用既有提示卡（需新做「一層多檔」）；拉遠簡化版等 A 上線後再談（要先判斷算不算 KOGL 3 改作）。C086 選 B＝有資料的시군구標淡色、點選 popup 依排出日分組列規則（星期格子新元件要先登記 spec）；只寫到市的 15 列（例 수원시）套用到該市所有區。未查證：C117 等級 9 意義、EcoBank 全量下載是否要登入；C086 行政區要做正式代碼對照（名稱只對上 207／222）。First action: analytics 先下載 C117 全量與 C086 代碼對照，再開 mini 實作。 |
| KRW-6 | 北極星:好用 | P3 | ready | （第 6 波 #830、第 7 波 #869 已做）南韓第 8–10 波（領海、公園、體育、文化、產業、LOCALDATA 等）；第 11 波待 data.go.kr key。 | First action: 依 analytics `south_korea_opendata/waves/PLAN.md` §3 開第 8 波（第 7 波 6 層已隨 v2.26.0 發布：學校、小學通學區、醫院藥局、消防、民防避難、派出所）。key 由使用者自行註冊。 **2026-11-10 多國跨夜**：第 8 波（mini #983、analytics #343–#346、pulse-data #96）、第 9 波（mini #987、analytics #350／#351、pulse-data #100）已合 develop，倉庫待組裝；第 0–7 波補入倉 analytics #347、pulse-data #97。剩：第 10 波 PLAN 尚未定義候選（要先盤點再請使用者挑）；第 11 波等 data.go.kr key；C086 垃圾排出無座標（要新呈現方式）。 | 每波照 PLAN §3 填 PR、驗收與 HOLD。 |
| UKFLOOD-1 | 北極星:好用 | P3 | conditional | 英國 C070 EA 洪水區（WFS 2026-11-10 恢復，415,408 面；10 月記錄 813,627，上游改版）。 | Trigger：使用者要擴充英國圖層時。使用者 2026-11-10 決定「先記錄，之後再做」。First action: 照英國波次流程排一波（大面低縮放另出小檔），開工前先重驗 WFS 筆數。 | 上線。 |
| CNW-0 | 北極星:好用 | P3 | ready | 中國圖層第 0–1 波（31 省邊界、國土基礎 8 層：GHS-POP、figshare 公交、OurAirports、OSM 路網、GEM 能源）。**全部先鎖站主限定**（使用者 2026-11-10）。 | §6 五題已拍板（2026-11-10）。First action: 照 `../taipei-gis-analytics/docs/topic-research/china_opendata/waves/PLAN.md` §3 開工（國家判定排除台灣、港澳；學術帳號等使用者逐站決定）。 | 第 0–1 波上線（owner-only）；涵蓋寫 n/31。 |
| PHW-0 | 北極星:好用 | P3 | ready | 菲律賓圖層第 0–1 波（18 region 邊界、國土基礎 9 層：PSA 人口、Geoportal GFI 機場港口車站＋OSM 補缺、HOT 主要道路、GEM 能源）。電廠 GEM 與 Climate TRACE 逐廠比對，整合成「我們的版本」。 | §6 五題已拍板（2026-11-10）。First action: 照 `../taipei-gis-analytics/docs/topic-research/philippines_opendata/waves/PLAN.md` §3 開工。 | 第 0–1 波上線；GFI 筆數與 WMS count 比對不缺。 |
| PHGEO-1 | 北極星:好用 | P3 | blocked | 菲律賓 Geoportal 表單下載：C117 土地覆蓋（2025 逐區）、C123 林業租約 9 層（WMS GFI 拿不到）。 | Blocked on 使用者本人填 geoportal.gov.ph 下載表單（姓名、email、電話；連結寄到信箱）。First action: 下載後放 analytics 主 checkout `data/raw/philippines/geoportal/`，告訴 Claude。 | 檔案到手並記 SHA／筆數。 |
| VNW-0 | 北極星:好用 | P3 | ready | 越南圖層第 0–1 波（COD-AB 34 省面、國土基礎 9 層）；另加 envisoft 5 層「只上站點位置」與安江示範小波（使用者 2026-11-10）。 | §6 五題已拍板。First action: 照 `../taipei-gis-analytics/docs/topic-research/vietnam_opendata/waves/PLAN.md` §3 開工（先把 envisoft 站點與安江示範補進 system-waves.json）。 | 第 0–1 波上線；涵蓋寫 n/34。 |
| HKMO-0 | 待討論 | P3 | ready | 香港、澳門開放資料盤點（使用者 2026-11-10 決定與中國大陸分開、另開一輪）。 | First action: 照 country-opendata-scout 開 `hongkong_opendata`／`macau_opendata`（或合一），沿用 93f1d36b concepts。 | 盤點報告＋系統盤點完成。 |
| WDISP-1 | 待討論 | P3 | ready | 全球主權爭議圖層（南海、各國重疊主張等），取代在各國圖層分別處理爭議區（使用者 2026-11-10：之後整理全球版，在全球面板上圖）。 | First action: 盤點開放幾何來源（Marine Regions EEZ 重疊區、Natural Earth disputed areas 等）與授權；台灣立場依實際管轄。偏好正本 analytics `.claude/skills/country-opendata-scout/references/owner-preferences.md` §一。 | 全球面板一層上線，圖例寫明立場與來源。 |
| JPACC-1 | 底線:資料正確 | P3 | ready | 日本交通事故 2025 本票約 3% 發生於 2024 年以前（原始檔 287,023 筆：2025 年 278,247、2024 年 8,714）；官方未寫收錄口徑。 | 文字已照實改（mini #986）。First action: 查警察庁說明確認是否為「當年計入統計」口徑，確認後可在圖例補一句來源說明。點位 z12 起才全點是設計（pipeline `-B 12`），不是 bug。 | 有官方出處或確認查不到並結案。 |
| FB-054 | 北極星:好用 | P3 | ready | 〔global-climate〕GC-2b 沙塵改烤數值通道 texture，讓 popup 可讀值 | 原檔：[global-climate](../../docs/archive/2026-11-09/features/global-climate/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-055 | 北極星:視覺 | P3 | ready | 〔global-climate〕GC-8 GFS 預報 0–120hr 六張 texture 接時間軸播放 | 原檔：[global-climate](../../docs/archive/2026-11-09/features/global-climate/backlog.md)。依據：未見實作 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-057 | 北極星:視覺 | P3 | ready | 〔global-climate〕GC-9 等壓線、噴流、SST、波浪上圖（collector 已抓、前端未接） | 原檔：[global-climate](../../docs/archive/2026-11-09/features/global-climate/backlog.md)。依據：src 無 prmsl／cmems_sst；#456 只記 backlog | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-058 | 北極星:視覺 | P3 | ready | 〔global-climate〕GC-9a 海溫＋波浪上圖（使用者 9-29 決定要做；需先查 CMEMS 授權、NaN 遮罩、深度） | 原檔：[global-climate](../../docs/archive/2026-11-09/features/global-climate/backlog.md)。依據：#456 只是 docs；src 無 cmems_sst；先過授權（底線:授權） | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-061 | 北極星:好用 | P3 | ready | 〔global-maritime〕AISStream 選取船接 get_aisstream_vessel_trail 航跡 | 原檔：[global-maritime](../../docs/archive/2026-11-09/features/global-maritime/backlog.md)。依據：src 無此 RPC 呼叫 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-062 | 待討論 | P3 | ready | 〔historical-flight-trails〕平日／週末補全部機場（需付費抓取授權） | 原檔：[historical-flight-trails](../../docs/archive/2026-11-09/features/historical-flight-trails/backlog.md)。依據：未授權執行；與 plan-art FR24 戰役相關 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-063 | 底線:資料正確 | P2 | ready | 〔historical-flight-trails〕恆春可得軌跡查證 | 原檔：[historical-flight-trails](../../docs/archive/2026-11-09/features/historical-flight-trails/backlog.md)。依據：未見紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-064 | 底線:資料正確 | P2 | ready | 〔historical-flight-trails〕來源分頁／事件日完整對帳（現全 partial） | 原檔：[historical-flight-trails](../../docs/archive/2026-11-09/features/historical-flight-trails/backlog.md)。依據：未見紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-073 | 北極星:好用 | P3 | ready | 〔jma-live-layers〕JMA-3 地震 popup 改縣別震度表 | 原檔：[jma-live-layers](../../docs/archive/2026-11-09/features/jma-live-layers/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-074 | 底線:資料正確 | P2 | ready | 〔jma-live-layers〕JMA-8 海冰色票改官方圖例（12 月） | 原檔：[jma-live-layers](../../docs/archive/2026-11-09/features/jma-live-layers/backlog.md)。依據：觸發 12 月 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-079 | 北極星:好用 | P3 | ready | 〔jp-core-layers〕人口網格 timeline slider（2020–2070） | 原檔：[jp-core-layers](../../docs/archive/2026-11-09/features/jp-core-layers/backlog.md)。依據：目前仍為 select | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-080 | 北極星:視覺 | P3 | ready | 〔jp-core-layers〕車站依運量 graduated 圓大小 | 原檔：[jp-core-layers](../../docs/archive/2026-11-09/features/jp-core-layers/backlog.md)。依據：未做 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-081 | 北極星:視覺 | P3 | ready | 〔jp-core-layers〕機場依空港種別分色＋圖例 | 原檔：[jp-core-layers](../../docs/archive/2026-11-09/features/jp-core-layers/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-083 | 待討論 | P3 | ready | 〔jp-height-layers〕建物高度全國擴展（11 完成／37,993 待處理，需使用者重新授權小批） | 原檔：[jp-height-layers](../../docs/archive/2026-11-09/features/jp-height-layers/backlog.md)。依據：等使用者授權；磁碟限制 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-084 | 待討論 | P3 | ready | 〔jp-height-layers〕樹冠高度全國擴展（overview 108、detail 5,026 待處理） | 原檔：[jp-height-layers](../../docs/archive/2026-11-09/features/jp-height-layers/backlog.md)。依據：同上 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-085 | 北極星:AI | P3 | ready | 〔jp-medical-static〕第二批：年度病床／外來申報（先驗 ID crosswalk） | 原檔：[jp-medical-static](../../docs/archive/2026-11-09/features/jp-medical-static/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-086 | 北極星:AI | P3 | ready | 〔jp-medical-static〕第三批：區域統計解析與地理鍵驗證 | 原檔：[jp-medical-static](../../docs/archive/2026-11-09/features/jp-medical-static/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-087 | 底線:授權 | P2 | blocked | 〔jp-religion-layers〕JPR-4 重新評估公開 canonical POC（精度、授權） | 原檔：[jp-religion-layers](../../docs/archive/2026-11-09/features/jp-religion-layers/backlog.md)。依據：owner decision；BACKLOG 索引列 JPR-4 但無獨立列；MAR-2 涵蓋日本宗教正式站目視 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-088 | 底線:資料正確 | P2 | blocked | 〔jp-water〕JPW-2 半田管線 CRS 確認 | 原檔：[jp-water](../../docs/archive/2026-11-09/features/jp-water/backlog.md)。依據：未見紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-089 | 底線:授權 | P2 | waiting_external | 〔jp-water〕JPW-4 全國水資源 PMTiles 公開發布（逐資產授權） | 原檔：[jp-water](../../docs/archive/2026-11-09/features/jp-water/backlog.md)。依據：目前站主限定（#458） | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-132 | 待討論 | P3 | ready | 〔telecom-world-layers〕評估 PeeringDB facilities／IXP（先確認 AUP） | 原檔：[telecom-world-layers](../../docs/archive/2026-11-09/features/telecom-world-layers/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| JP-TOUR-2 | 待討論 | P3 | blocked | 日本 A10（自然公園）／A11／A28 三層正式公開。 | Blocked on owner decision（授權）。查證 2026-11-09：manifest 有 jpNaturalParks*（A10）、jpWildlifeProtection*、jpWorldHeritage* 等層，但仍標 NON_COMMERCIAL_ONLY、本地研究 PMTiles、不進正式 catalog／S3；要不要比照 11-06 自托管 CC BY-NC 公開規則解除，需使用者決定。原文：[jp-tourism-protected-heritage](../../docs/archive/2026-11-09/features/jp-tourism-protected-heritage/backlog.md)。 | 決定後逐層解除或維持，並更新 manifest note。 |

## I. Agent／MCP 分析

| ID | Tier | Pri | State | Item | Next action / blocker | Acceptance |
|---|---|---|---|---|---|---|
| AG-12 | 北極星:AI | P2 | blocked | Agent 截圖自檢第二批（2026-11-07 規劃；第一批數字讀回 framingCheck 是 #881＋MCP #99）：Agent 能自己截地圖畫面目視判斷要不要重框或換畫法。 | Blocker: 使用者排 research-gateway 部署時間（部署順序 gateway → 前端 → MCP）。三個 PR：C gateway 白名單加 `capture_map`、截圖讀走即過期（不留在 SQLite queryHistory）；D 前端 `once('render')`＋toDataURL、等 tilesSettled、縮到約 900px JPEG（base64 ≤160KB）切成 ≤32KiB 字串陣列，背景分頁回 `CAPTURE_UNAVAILABLE`；E MCP `pulse_capture_map` 回 image content（不放 structuredContent），skill 加「有疑慮或重要成品才截圖、最多調 2 輪」。隱私：畫面上有站主限定圖層時預設回 `CAPTURE_PRIVATE_LAYERS_VISIBLE`，要 `includePrivate:true` 才截（使用者 11-07 未異議，照建議）。 **健檢 2026-11-08**：只差使用者排 gateway 部署時間；證據：規格完整。<br>**2026-11-09 封存項併入**（原檔 [agent-research-workbench](../../docs/features/agent-research-workbench/gis-analysis-roadmap.md)）：M6 完整成果 UX（line、raster、圖表、compare） | Agent 上圖後能取回截圖；私人圖層可見時預設擋下；gateway 狀態不保留截圖。 |
| AG-2 | 北極星:AI | P2 | ready | 倉庫重建後收尾：移除 mcp 牧場標題覆寫，讓 build 階段的 ST_MakeValid 生效。 | 2026-10-05 倉庫已切到 20261005T051814Z（update_store.py 增量），但 wh_catalog 牧場標題仍是「肉品拍賣/批發市場（21 家）」。先查清楚 update_store 為何沒套用 analytics #134 的 manifest title 與 build_warehouse 修正，必要時對 livestock_ranch 全量重建，之後再刪 override。 | 重建後搜「畜牧場」第一名是點位資料且標題不是「肉品拍賣」；刪掉 `datasetLabelOverrides.json` 的牧場項後測試綠；淹水面交集不需要 MakeValid 也正確。 |
| CAT-1 | 北極星:AI | P2 | ready | Restore verified upstream lineage for the 6 Global Maritime layers still declared `catalog_missing`. | In taipei-gis-analytics, define authoritative catalog entries and dataset ids for AISStream current vessels, GFW vessel presence, hourly grid, hourly tracks, fishing effort and SAR unmatched detections (none in `docs/data-registry.yaml` as of 2026-10-05); then bridge those exact ids in the Pulse manifest. | Data Source Overview reports 0 `catalog_missing` for these layers; every bridged id exists in the analytics catalog; the cross-repo `upstreamRegistry` catalog test runs without the worktree skip and stays green. [Global maritime backlog](../../docs/archive/2026-11-09/features/global-maritime/backlog.md) |
| AG-14 | 北極星:AI | P2 | ready | layer-status 涵蓋全部國家。 | 目前圖層總表以台灣為主；改成 TW／JP／GB／KR／CA／IE／FR 都列，並標入倉狀態。與 RV27-2 一起看。<br>**2026-11-09 封存項併入**（原檔 [agent-research-workbench](../../docs/archive/2026-11-09/features/agent-research-workbench/backlog.md)）：P0-A capability compiler、source-family adapter、全圖層 search／describe、coverage report（4 項） | 總表各國層數與 manifest 一致。 |
| AG-15 | 北極星:AI | P2 | ready | 外國入倉基礎：行政界＋人口分母，先做英國。 | 依多國化議題 2 的 `boundaries_admin`／`population_admin` 格式補 GB；之後再排其他國。題庫回歸測試這輪暫不跑（使用者 2026-11-08）。<br>**2026-11-09 封存項併入**（原檔 [agent-research-workbench](../../docs/archive/2026-11-09/features/agent-research-workbench/backlog.md)）：OSM 步行網路可重現 build、snap／unreachable、拓撲驗證（P0-E 與步行 pilot 共 6 項） | MCP 對英國回得出行政區排名與人均，不再回「未涵蓋」。 |
| AG-4 | 北極星:AI | P3 | blocked | A10 綜合生活品質題的判分方式。 | owner decision：綜合指標的權重與方向沒有標準答案，需決定題庫收哪些口徑，或改成只檢查方法正確（2026-09-29 PASS／2026-10-02 FAIL）。<br>**2026-11-09 封存項併入**（原檔 [general-analysis](../../docs/archive/2026-11-09/features/general-analysis/question-bank-backlog-20260927.md)）：生活品質指數（各面向標準化＋權重＋敏感度） | 題庫寫明可接受口徑，並以唯讀查詢驗證各口徑數字。 |
| MC-6 | 北極星:兼容 | P3 | ready | 跨國行政區表補英文名（`boundaries_admin.name_en` 台灣、日本目前全空）。 | Owner: mini-pulse-gis-mcp `warehouse/admin_tables.py`。First action: 台灣接內政部羅馬拼音 CSV（analytics `place_name_romanization_moi`），日本接國土數值情報或 geoBoundaries 英文名。 | 兩國 name_en 非空率 >99%，重組倉庫後台灣既有工具輸出不變。 |
| MC-7 | 北極星:AI | P3 | conditional | 拆開混有多國資料的兩張表（airspace、allen_coral_atlas 暫標 TW）。 | Trigger: 要對日本或全球做空域、珊瑚礁分析時。First action: 依 country 欄拆成 TW 與 WORLD 兩份 registry，照 Ookla 拆表做法（pulse-data #48）。 | check_registry 0 ERROR，台灣表 geom_3826 不變，nearby 回歸一致。 |
| CL-4 | 北極星:AI | P3 | ready | Close the remaining location-precision gap in warehouse results. | MCP #29 tags `_wh_location_precision` from the catalog; gridded / isochrone / region_rank results are now `derived`, but `pulse_sql` results still inherit the worst lineage class, so centroids/buffers computed in SQL from precise sources stay `actual` (engine.ts `locationPrecisionsFor`, comment "known gap"). Mark SQL-derived geometries as `derived` unless they are the source rows' own coordinates. | A centroid/derived-point query yields `derived` and is not spatial-analysis eligible in Pulse. mini-pulse-gis-mcp #29 |
| STAT-SYNC-1 | 北極星:開發系統 | P3 | blocked | analytics `sync_matrix.py` 的 `scan_pulse()` 改讀新來源：TWL-12 甲案（mini #912）後 manifest 已無舊統計區塊，掃到 0 個主題；SYNC_MATRIX 的 pulse 欄會空。 | Blocked on owner decision：兩個候選輸入都有缺口——layer-style-inventory 沒有 country 欄、layer-status.csv 少約 600 列（詳見 analytics #328）。只影響內部稽核表，不影響網站與 Agent。First action: 選來源後改 parser，重跑 sync_matrix 確認未認領主題數。 | sync_matrix 掃得到現行 18 個統計主題與圖層主題。 |
| AG-11 | 北極星:AI | P3 | ready | 公車總表（`bus`）標題寫「即時位置」，實為靜態站點與路線（2026-10-05 倉庫 20261005T051814Z 仍是「公車即時位置與站點（全台 22 縣市）」）。 | 改 analytics `docs/data-registry.yaml` transportation.bus title（或在 bus `_manifest.json` 補 title），或加 MCP datasetLabelOverrides。 **健檢 2026-11-08**：證據：10-05。 | find_data 顯示的標題不再含「即時」。 |
| MC-8 | 北極星:AI | P3 | verifying | 觀察多國 eval 兩個不穩點：N10 有一次沒畫日本 1,898 區分級圖；N08 有 2 次沒載入 pulse-conductor、沒移鏡頭。 | 下次跑 agent-regression 時各加跑 3 次記錄；連續出現再定位是 show_result 負載還是 skill 觸發。 | 各 3 次中上圖與載入 skill 都 ≥2 次，或開修正 PR。紀錄在 mini-pulse-gis-mcp `eval/agent-regression/README.md`。 |
| TWL-4 | 北極星:AI | P3 | ready | MCP 圖層標籤跟上「管制區」改名。 | #737 已把 `waterProtectionZones` 改名「自來水保護區與地下水管制（水利署）」，mini-pulse-gis-mcp 的 `datasetLabels.json` 仍是舊名「管制區」。First action: 在 MCP repo 重產標籤檔。 **健檢 2026-11-08**：需查 waterProtectionZones 對應 datasetId；#100 重產過標籤，可能已解；證據：MCP datasetLabels origin/main 找不到水利署保護區那層的新舊名。 | MCP 搜尋「自來水」「地下水」找得到這層。 |
| RV27-2 | 北極星:AI | P3 | ready | `docs/features/general-analysis/layer-status*` 自 10-12 後未重產（約差 159 層）。 | 在主 checkout 同層 worktree 設 `PULSE_WAREHOUSE_DIR` 指向最新倉庫快照後跑 `npm run research:layer-status`；worktree 的 symlink node_modules 會 ERR_MODULE_NOT_FOUND，需改 `cp -Rc` 副本。#715 手刪的 wasteRoute／wasteStop 已確認與重產一致。 **健檢 2026-11-08**：可能只重產主題欄，需確認 159 層差距是否已補；證據：layer-status.csv 11-08 被 #912 等重產（0e876e76『重產…圖層總表主題欄』）。<br>**2026-11-09 封存項併入**（原檔 [atlas-statistics](../../docs/archive/2026-11-09/features/atlas-statistics/backlog.md)、[landslide](../../docs/archive/2026-11-09/features/landslide/backlog.md)）：66 層統計加進 research layer status 表；分析倉庫：入倉後重跑 build-layer-status | 重產 PR 說明差異來源（新增圖層 vs 倉庫快照），CI 綠。 |
| AG-MAR | 北極星:AI | P2 | in_progress | 海洋每小時表 `marine_observation_hourly` 登記進 AI 倉庫（甲案）。 | pulse-data #83 由另一個 worker 進行中，本 session 不碰。 | registry 有 warehouse 區塊並經發包上線。 |
| FB-008 | 北極星:AI | P3 | ready | 〔atlas-layers〕中文同義詞（鯨魚／海豚、海廢）在 MCP discovery.ts | 原檔：[atlas-layers](../../docs/archive/2026-11-09/features/atlas-layers/backlog.md)。依據：屬 MCP repo；BACKLOG 無同義詞列；跨 repo（mini-pulse-gis-mcp） | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-009 | 底線:資料正確 | P2 | ready | 〔atlas-layers〕layer-status.csv 中 temperatureGrid 被標 dataset_not_in_warehouse | 原檔：[atlas-layers](../../docs/archive/2026-11-09/features/atlas-layers/backlog.md)。依據：現行 layer-status.csv 第 963 列仍是 dataset_not_in_warehouse；可併 RV27-2 重產時一起查 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-010 | 北極星:AI | P3 | ready | 〔atlas-statistics〕MCP 中文同義詞（結核、癌症、綜所稅…），SYNONYM_GROUPS 近上限需取捨 | 原檔：[atlas-statistics](../../docs/archive/2026-11-09/features/atlas-statistics/backlog.md)。依據：BACKLOG 無同義詞列；可與 atlas-layers 同義詞合一列 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-043 | 北極星:AI | P3 | ready | 〔environment-layers〕環境統計 adapter 登錄 researchDatasets.ts | 原檔：[environment-layers](../../docs/archive/2026-11-09/features/environment-layers/backlog.md)。依據：src/research 無環境統計 adapter；可併 AG-13 入倉規則 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-052 | 北極星:AI | P3 | ready | 〔funeral-layers〕FN-5 「最近的火化場」距離分析 | 原檔：[funeral-layers](../../docs/archive/2026-11-09/features/funeral-layers/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-105 | 北極星:AI | P3 | ready | 〔mountain-safety〕MTS-1 事故點 500m 內無通訊點的量化分析 | 原檔：[mountain-safety](../../docs/archive/2026-11-09/features/mountain-safety/backlog.md)。依據：BACKLOG 索引列 MTS-1~3 但無獨立列 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-106 | 北極星:AI | P3 | waiting_external | 〔mountain-safety〕MTS-2 山屋容量 vs 週邊事故密度 | 原檔：[mountain-safety](../../docs/archive/2026-11-09/features/mountain-safety/backlog.md)。依據：同上 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-107 | 北極星:AI | P3 | ready | 〔mountain-safety〕MTS-3 cause × 山區 Top 10 危險路段排行（需選呈現位置） | 原檔：[mountain-safety](../../docs/archive/2026-11-09/features/mountain-safety/backlog.md)。依據：同上 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-124 | 北極星:AI | P3 | ready | 〔religion〕RL-5 宗教密度 × 人口分析 | 原檔：[religion](../../docs/archive/2026-11-09/features/religion/backlog.md)。依據：未見 PR；可用 MCP cross_analysis 做 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-127 | 北極星:AI | P3 | ready | 〔statistics-comparability〕全臺教育路網、離島山區與學齡人口分母（目前北臺灣 pilot） | 原檔：[statistics-comparability](../../docs/archive/2026-11-09/features/statistics-comparability/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-128 | 底線:資料正確 | P2 | ready | 〔statistics-comparability〕取得交通曝險分母（VKT）後才談事故風險 | 原檔：[statistics-comparability](../../docs/archive/2026-11-09/features/statistics-comparability/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-129 | 北極星:AI | P3 | ready | 〔statistics-comparability〕補畜牧漁業作物土地完整母體再做 share／LQ | 原檔：[statistics-comparability](../../docs/archive/2026-11-09/features/statistics-comparability/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-136 | 北極星:AI | P3 | ready | 〔tree-layers〕TL-3 樹穴 × 行道樹「空樹穴偵測」 | 原檔：[tree-layers](../../docs/archive/2026-11-09/features/tree-layers/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-152 | 北極星:視覺 | P3 | ready | 〔viz-library〕1 呼吸脈衝 R2（先在結果契約定義「即時／進行中」標記） | 原檔：[viz-library](../../docs/archive/2026-11-09/features/viz-library/BACKLOG.md)。依據：未見實作；檔名大小寫：backlog.md 與 BACKLOG.md 在 macOS 是同一檔 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-154 | 底線:資料正確 | P2 | ready | 〔viz-library〕3 新聞 published_ts 時區查證（影響 Q19、Q28 期望值） | 原檔：[viz-library](../../docs/archive/2026-11-09/features/viz-library/BACKLOG.md)。依據：未見紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-155 | 底線:授權 | P2 | ready | 〔viz-library〕4 食品價格指數原料授權查證後才開放分析卡 | 原檔：[viz-library](../../docs/archive/2026-11-09/features/viz-library/BACKLOG.md)。依據：使用者 09-28 決定暫不公開 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-156 | 北極星:AI | P3 | ready | 〔viz-library〕7 統計指標缺中文名稱欄位（上游先動） | 原檔：[viz-library](../../docs/archive/2026-11-09/features/viz-library/BACKLOG.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-157 | 北極星:AI | P3 | ready | 〔viz-library〕8 分析卡 v1 補 compare、isochrone 與村里層級 | 原檔：[viz-library](../../docs/archive/2026-11-09/features/viz-library/BACKLOG.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-158 | 北極星:視覺 | P3 | ready | 〔viz-library〕9 立體柱預設高度偏尖，依格子大小自動調整 | 原檔：[viz-library](../../docs/archive/2026-11-09/features/viz-library/BACKLOG.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-160 | 北極星:AI | P3 | ready | 〔welfare-layers〕WF-3 托嬰中心對 0–5 歲人口人均密度面量圖 | 原檔：[welfare-layers](../../docs/archive/2026-11-09/features/welfare-layers/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-161 | 北極星:AI | P3 | blocked | 〔welfare-layers〕WF-4 長照服務覆蓋分析（先選立案或特約體系） | 原檔：[welfare-layers](../../docs/archive/2026-11-09/features/welfare-layers/backlog.md)。依據：BACKLOG 索引寫 WF-4 blocked、無獨立列；需使用者拍板 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-163 | 北極星:AI | P3 | ready | 〔welfare-layers〕WF-6 社福 9 層縣市級統計彙總 | 原檔：[welfare-layers](../../docs/archive/2026-11-09/features/welfare-layers/backlog.md)。依據：未見 PR；MCP region_rank 可部分替代 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-169 | 北極星:AI | P3 | ready | 〔agent-research-workbench〕line／raster kernel、自管 Taiwan Valhalla graph、Google／Valhalla 真實 E2E、clear／expiry／revoke 回歸 | 原檔：[agent-research-workbench](../../docs/archive/2026-11-09/features/agent-research-workbench/backlog.md)。依據：未見自管 graph 紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-171 | 北極星:AI | P3 | ready | 〔general-analysis〕擴充：加油站／LPG × 住宅、變電所 × 淹水、水庫淨水場 × 污染源 | 原檔：[general-analysis](../../docs/archive/2026-11-09/features/general-analysis/question-bank-backlog-20260927.md)。依據：未見對應題庫紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-172 | 北極星:AI | P3 | ready | 〔general-analysis〕生活品質缺口：服飾行業分類對照、超商與分區入倉、公車班次 | 原檔：[general-analysis](../../docs/archive/2026-11-09/features/general-analysis/question-bank-backlog-20260927.md)。依據：超商倉庫只有雙北（記憶 2026-11-09 用 ATM 代理） | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-173 | 北極星:AI | P3 | ready | 〔general-analysis〕運動可及性（網球／匹克球／羽球場 15 分）需場館細分類 | 原檔：[general-analysis](../../docs/archive/2026-11-09/features/general-analysis/question-bank-backlog-20260927.md)。依據：需場館細分類欄位 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-174 | 北極星:AI | P3 | ready | 〔general-analysis〕污染源 × 水源保護區 × 工商登記 | 原檔：[general-analysis](../../docs/archive/2026-11-09/features/general-analysis/question-bank-backlog-20260927.md)。依據：未見紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-175 | 北極星:AI | P3 | ready | 〔general-analysis〕地震震央周邊設施（回放資料快照入倉） | 原檔：[general-analysis](../../docs/archive/2026-11-09/features/general-analysis/question-bank-backlog-20260927.md)。依據：未見入倉紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-176 | 北極星:兼容 | P3 | ready | 〔i18n〕P4-C Agent 依配對網頁語言回答（MCP map_context 帶 locale、conductor 英日版、拿掉圖例須含漢字限制、eval 語氣依語系） | 原檔：[i18n](../../docs/features/i18n/ROADMAP.md)。依據：PROJECTS.md 列為待做，但 BACKLOG 無獨立 ID；跨 repo，MCP 先改 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-185 | 北極星:AI | P3 | ready | 〔waste-collection〕Phase 4.1 時刻表 vs GPS 誤差分析 | 原檔：[waste-collection](../../docs/features/waste-collection/research/roadmap.md)。依據：未見紀錄 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| AG-16 | 北極星:AI | P3 | conditional | AI 路線候選待辦（2026-11-09 封存項併成一列，候選、未排），6 項子能力：(1) 可保存的分析成果；(2) 研究檔案庫；(3) 線與網格（raster）結果；(4) 時序基準（baseline）；(5) raster 取樣；(6) KDE／地形／視域。 | 使用者 2026-11-09 決定保留。排入時先對照 ADR-0022 階段 C，逐項拆成獨立列。原文：[agent-research-workbench](../../docs/archive/2026-11-09/features/agent-research-workbench/backlog.md)、[agent-research-workbench](../../docs/features/agent-research-workbench/gis-analysis-roadmap.md)、[main-site-ai-gis-roadmap-2026-09-05](../../docs/proposal/main-site-ai-gis-roadmap-2026-09-05.md)。 | 排入時每項各附驗收題與 PR。 |
| AG-17 | 北極星:AI | P3 | conditional | 題庫候選題（候選題，未排）：(1) 國中小步行等時圈與學區錯位；(2) 海警船×新聞（題庫可能已有 Q28，排入前先比對）；(3) 雙變量地圖；(4) 再擴 8 個面向。 | 使用者 2026-11-09 決定先保留。原文：[general-analysis](../../docs/archive/2026-11-09/features/general-analysis/question-bank-backlog-20260927.md)。 | 排入的題目進題庫並有 SQL 驗算。 |
| AGQ-1 | 北極星:AI | P2 | ready | 外國倉庫表補 registry 口徑／已知陷阱：南韓 52、愛爾蘭 67 張表目前 missing。 | 使用者 2026-11-10：「之後會要記得補」。做法：每國先補 10 張最常被問的表（依 MCP 使用紀錄 `npm run usage-log` 或題庫挑），寫進 pulse-data registry。2026-11-10 實例：首爾醫療院所資料集搜尋分數 0.61、口徑未登記；愛爾蘭法院等 IE 表 semantics missing——列入第一批。 | 兩國各 10 張表口徑 verified。 |
| MCPD-2 | 北極星:AI | P3 | ready | `wh-N` 結果存檔跨 session 互相覆寫（MCP 重連後編號從 wh-1 重來，可能蓋掉前一輪結果；2026-11-10 再次確認）。 | 存檔名加倉庫版本與 MCP 啟動時間（或 session id），舊檔不被新 session 的 wh-1 蓋掉。 | 兩個 session 各跑 wh-1，兩份結果都讀得回來。 |
| OWNV-1 | 底線:資安 | P2 | conditional | 站主限定 18 張表放在 R2 倉庫：MCP 開放他人使用前必須先處理。 | 使用者 2026-11-10 選「維持，只要外人拿不到」。Trigger：決定讓站主以外的人使用 MCP 之前。owner：使用者決定時程、Claude 執行。First action：`wh_catalog.visibility` 欄要有真值（現在 713 列全是 `owner`，沒有鑑別力），引擎端依身分擋；站主資料包移到私有儲存。 | 非站主身分查不到這 18 張表，資料包不在公開 R2。 |
| WHDB-2 | 底線:備份 | P2 | blocked | WHDB-1 重發版的 S3 歸檔與 R2 舊版清理。 | 新版 `20261110T084641Z` 已切 latest；待使用者驗收後跑 pulse-data `archive_versions.py`（S3 留 latest＋上一版、刪 R2 舊版 `20261110T001615Z`）。Blocker：使用者驗收。 | S3 有兩版、R2 只剩 latest。 |
| DOCWH-1 | 北極星:AI | P3 | ready | analytics `.claude/skills/pulse-layer-release/references/mcp-warehouse.md:27` 組裝指令仍是舊寫法。 | 舊寫法 `--allow-change wh_catalog,wh_coverage`；現行（MCP main）組裝為 `--allow-change '<表>=<理由>'` 一表一理由，發版關卡 `npm run warehouse:gate` 的例外是 `--accept '<表>=<理由>'`，並補上傳需通過證明。在 analytics repo 改。 | skill 文件與 MCP main 一致。 |

## J. 前端技術債與效能

| ID | Tier | Pri | State | Item | Next action / blocker | Acceptance |
|---|---|---|---|---|---|---|
| AR-14/15 | 北極星:效率 | P2 | ready | Turn saved ship/bus trails into CDN-consumable products. | (P1→P2 2026-10-16: design-only.) Historical flight trails (AR-16) shipped as an immutable static product; now design equivalent processed bundles for ship/bus instead of browser reads of raw `trails/`. | Ship and bus browsers read processed CDN products with correct day selection and controlled egress. [Architecture plan](../../docs/proposal/architecture-overhaul-plan.md) |
| AR-32~36 | 北極星:效率 | P2 | ready | Improve multi-layer rendering without unrelated refactors. | AR-31 (repaint gate) shipped via perf-audit #464/#476. Remaining: renderer merge (AR-32), FlightScene (AR-33), GPU time filter (AR-34), parse worker (AR-35, pairs with AR-15), and the per-tick `new THREE.Matrix4()` in `FireStationScene.ts:180` (AR-36). Prioritize by measured bottleneck. **健檢 2026-11-08**：依量測再做。 | Profiling and targeted visual regression evidence meet the selected budget. [Architecture plan](../../docs/proposal/architecture-overhaul-plan.md) |
| AU-4 | 北極星:兼容 | P2 | ready | Make Three scenes portable to MapLibre embed. | Replace direct `MercatorCoordinate.fromLngLat` in 4 scenes (RealEstatePoints, TemperatureWave, OsmPowerLinesGlow, GfwV4Track; 2026-10-05) with `toMercator()` from `src/utils/coordinates.ts`. | Main and embed coordinate regression checks pass. [Architecture audit](../../docs/research/architecture-audit-2026-08-10.md) |
| G022 | 北極星:效率 | P2 | ready | Add ship trail LOD only if measured rendering cost warrants it. | Profile low-zoom vessel rendering; preserve port-detail quality. | Measured budget improves with a visual regression check. Renamed from legacy duplicate `G011`. |
| RV-3 | 北極星:好用 | P2 | conditional | Isochrone popup lacks area and in-range count (mini F102). | Trigger: next isochrone/agent-readback change. Owner: mini (+ MCP readback contract). First action: extend the readback contract with area and in-range count, then show both in the popup. **健檢 2026-11-08**：合併成 review 殘項一列；RV-7 待決策。 | Popup shows area (km²) and count with scope; contract test covers the new fields. |
| RV-6 | 北極星:好用 | P2 | conditional | Warehouse results that fail transiently are treated as deleted (mini F261). | Trigger: next warehouse-result reference work. Owner: mini (research). First action: on transient failure keep the reference and retry with backoff; only mark deleted on a definitive not-found. **健檢 2026-11-08**：合併成 review 殘項一列；RV-7 待決策。 | A transient 5xx/network error keeps the reference and recovers on retry; test covers both paths. |
| RV-7 | 北極星:好用 | P2 | blocked | Harm-reduction loader rolls back the whole batch when upstream removes a point (gis-platform F021). | Blocked on decision: reconcile-delete removed points, or validate only the PK set. Owner: gis-platform (+ data-collectors if it feeds the loader). First action: owner picks the policy, then adjust the loader. **健檢 2026-11-08**：合併成 review 殘項一列；RV-7 待決策。 | Upstream removal of one point no longer fails the whole load; behavior matches the chosen policy. |
| RV-8 | 北極星:好用 | P2 | conditional | Geological-survey district R2 registry file exposes `district_code` but consumers need `area_code` (gis-platform F028). | Trigger: before the next release that ships this layer. Owner: gis-platform / analytics. First action: produce a derived file with `area_code`, leaving the registered original untouched. **健檢 2026-11-08**：合併成 review 殘項一列；RV-7 待決策。 | Derived file with `area_code` is published and referenced; release checklist item checked. |
| A11Y-1 | 北極星:好用 | P2 | ready | 移除 viewport 的 `user-scalable=no`（Lighthouse 無障礙唯一未過項）。 | 先確認地圖雙指縮放不受影響。 | Lighthouse 無障礙 ≥ 0.95。 |
| OPS-1 | 北極星:好用 | P2 | ready | 無 WebGL 時顯示說明，而不是整個畫面空白。 | 加初始化失敗提示與 ErrorBoundary。 | 無 WebGL 環境看得到提示與替代連結。 |
| GUI-3 | 北極星:好用 | P2 | blocked | 地址／地名搜尋（WebGIS 第 5 類）。 | Blocker：owner decision——地理編碼服務選 Mapbox Geocoding／TGOS／國土測繪中心（用量上限與授權不同）。First action：列三者配額、授權、繁中地址命中率比較給使用者選。<br>**2026-11-09 封存項併入**（原檔 [main-site-ai-gis-roadmap-2026-09-05](../../docs/proposal/main-site-ai-gis-roadmap-2026-09-05.md)）：A1 不靠 AI 的地點周邊分析面板（選點→周邊→統計→保存） | 使用者選定服務；設計稿多版給使用者選位置與樣式後才實作（先看設計稿再實作）。 |
| G025 | 北極星:效率 | P3 | ready | Make Monitor alert-series fetching incremental. | Design a recent-window RPC/cache update rather than reloading 24h×6 groups. | Network/DB work drops with equivalent displayed history. Renamed from legacy duplicate `G012`. |
| CL-8 | 北極星:好用 | P3 | ready | Decide the low-priority reviewer findings skipped as design choices. | Re-checked 2026-10-05, all still present: A32 negative values draw zero-width bars (`src/research/charts/RankBars.tsx`, `CompareTable.tsx`); A37 LoadingStatus unmounts in capture mode and loses running loads (`App.tsx`); A39 mobile more-menu (popover 30 inside toolbar 25 stacking) trapped under the bottom sheet (40); A40 `layer-dataset-aliases.json` `osm_power` umbrella maps all 8 tables to every layer; A42 isochrone/flow outline, flow endpoints and extrusions not dimmed on selection (`analysisResultOverlay.ts`); A46 `CAMERA_MAX_ZOOM_CEILING=16` clamps explicit maxZoom 17–18 (`viewportFit.ts`). A47 largely resolved by MCP 313a9a4 (internal check + max one user-facing 「小提醒」); confirm `nearby-profile.md` "caveats 原樣帶上" wording, then drop. **健檢 2026-11-08**：與 RV-*、RV27-1 同性質，合併成 review 殘項。 | Each item fixed in its own PR or explicitly declined here. |
| DS-COLOR | 北極星:視覺 | P3 | ready | 定義逐層顏色契約：代表色、分類色、主題、色階各以誰為準。 | AU-1（2026-10-05 結案）查證：manifest→側欄已由 `layerManifest.test.ts:88` 逐 key 驗證，地圖↔圖例由 `legendAlignment.test.ts` R4 12 組守門；`docs/design-system/map-layers.md:345` 明定多類別／序列代表色不必出現在 paint。剩下的缺口是「各類顏色的權威來源」未定義，先定契約再擴大守門。 | 每層顏色類型與權威來源有文件；新增守門能抓出違反契約的定義。分析：`docs/research/contract-guards-20261005.md`（PR #539）。 |
| R6-4 | 北極星:視覺 | P3 | conditional | R6 段 4：船（`ships`）、公車三層（`busLive`／`busIntercityLive` 等）、垃圾車班表（`wasteSchedule`）、漁船軌跡加「立體效果」開關與平面版（比照段 3 列車／垃圾車：預設立體、平面點＋拉近方向箭頭、對比描邊 `MOVING_POINT`）。飛機不動。 | **使用者 2026-10-12 決定暫不碰**；段 1–3 已合 develop（#547／#572／#573）。重啟時先照 R6 流程：盤點 → 對照頁 → 分段 PR。 | 每層平面／立體切換可用、面板與 Agent 控制一致、對照頁截圖；提案與段 3 做法見 [`R6-PROPOSAL.md`](../../docs/features/map-layer-restyle/R6-PROPOSAL.md)。 |
| RV-1 | 北極星:好用 | P3 | conditional | RPI river segments show no stale marker (mini F246). | Trigger: next river_rpi_segments asset refresh. Owner: taipei-gis-analytics + mini. First action: add a `stale` property to the asset (station last-sample age) and render it in `riverRpiSegments` paint/popup. **健檢 2026-11-08**：合併成 review 殘項一列；RV-7 待決策。 | Segments with outdated samples are visually and textually distinguished; golden fixture regenerated. |
| RV-2 | 北極星:好用 | P3 | conditional | Extrusion layers cannot fade unselected features on selection (mini F100). | Trigger: next 3D/extrusion UX pass. Owner: mini. First action: split each affected extrusion into `selected` / `unselected` layers so opacity can differ. **健檢 2026-11-08**：合併成 review 殘項一列；RV-7 待決策。 | Selecting a feature fades the rest; opacity slider still applies to both. |
| RV-4 | 北極星:好用 | P3 | conditional | Design guard misses fonts declared across multiple JSX lines (mini F068). | Trigger: next `designSystemGuard` touch. Owner: mini. First action: make the font scan parse multi-line JSX attributes/style objects; do not raise the baseline to hide hits. **健檢 2026-11-08**：合併成 review 殘項一列；RV-7 待決策。 | Multi-line violations are detected; baseline only decreases. |
| RV-5 | 北極星:好用 | P3 | conditional | Hotspot multiplier only covers the top 50 (mini F243). | Trigger: next hotspot/analysis recipe change. Owner: analytics (upstream aggregation) then mini. First action: aggregate the multiplier upstream for all units instead of clipping at top 50. **健檢 2026-11-08**：合併成 review 殘項一列；RV-7 待決策。 | Multiplier is available for every ranked unit or the UI states the top-50 scope. |
| RV27-1 | 北極星:好用 | P3 | conditional | 未修 9 則：mini F014、F111、F095、F029、F128、F272；gis-platform F171；collectors F101、F195。 | Trigger: 各則原因見紀錄 README（需重產資料、跨 repo、範圍過大或待使用者決定）。Owner: 使用者決策／各 repo。First action: F171、F195、F272 三則請使用者選方向。 **健檢 2026-11-08**：同上合併。 | 每則修正 PR 或在紀錄註明不做。`.gis-agent-system/reports/code-review/2026-10-27/README.md` |
| RV27-3 | 北極星:好用 | P3 | conditional | JMA 時間軸 RPC（migration 488）在瀏覽器時鐘比伺服器快 60 秒以上時查不到資料。 | Trigger: 下次改 JMA 時間軸前端。Owner: mini。First action: 前端把 p_at 限制在伺服器回傳的 coverage_to 以內。 | 時鐘偏快的情境下仍有資料。 |
| GUI-4 | 北極星:好用 | P3 | blocked | 其餘候選元件：製圖輸出（PNG 附標題、圖例、比例尺、指北針、來源）、卷簾比對、範圍圈選（主站）、鷹眼小地圖、字級／色盲／高對比、CSV 下載（授權逐源確認）、使用者調整圖層順序。 | Blocker：owner decision——排優先序。建議先做製圖輸出與卷簾（寫文章、分析用）。 | 使用者選定項目後走「設計稿多版→拍板→實作→與 develop 並排截圖驗收」。 |
| RV-F039 | 北極星:視覺 | P3 | ready | 消防局／港口 3D 柱不跟圖例類別篩選（review F039，2026-11-06 修正輪暫緩：跨多檔）。 | First action: 讓 3D 柱的資料來源吃同一個 category filter（參考 2D 點層的 filter 寫法）。 **健檢 2026-11-08**：合併一列。 | 圖例取消某類別後 3D 柱同步消失；有測試。 |
| RV-F045 | 北極星:視覺 | P3 | ready | 發電機組光柱（beams）不跟圖例類別篩選（review F045，同上暫緩）。 | First action: 同 RV-F039，可一起做。 **健檢 2026-11-08**：合併一列。 | 同上。 |
| RV-F026 | 北極星:視覺 | P2 | ready | 愛爾蘭 `ieOffshoreRenewables`、`ieSeabedSurveyCoverage` 缺點／面切換（map-layers V-5；review 2026-11-10 F026）。使用者 2026-11-10 選在 Mac 做。 | First action: analytics 產兩個 `_points.pmtiles`（每面一個面內代表點，z4–10），`build-public-assets-lock.py add` 後上傳 S3 deploy-assets，再在 `repPointLayers.ts` 登記（family `krData` 同類路徑）。 | 兩層有「樣式（點位／面）」選單，點模式可點出同一 popup；layerConsistency／golden 綠。 |
| RV-F022 | 北極星:好用 | P3 | blocked | R2 降雨 manifest 不含空圖觀測，空幀後仍顯示上一張雨量（review 2026-11-10 F022）。 | Blocker：上游 collector 要在 manifest 為空圖觀測加帶時間戳的標記（跨 repo 契約，上游先改）；之後前端選到空幀時隱藏。 | 空幀時段地圖不顯示舊雨量；有測試。 |
| RV-F079 | 底線:資料正確 | P3 | ready | gis-platform OPEN PR #235 的 mig 546 四個 DROP 缺 IF EXISTS（review 2026-11-10 F079）；該 PR 屬他 session，本輪未碰。 | First action: 在 #235 分支補 `IF EXISTS` 或於該 PR 留言交接，套用前完成。 | #235 合併前 DROP 皆可重跑。 |
| AU-8 | 北極星:開發系統 | P2 | ready | Give the shipped food-price monitor feature a proper documentation home. | Add the four feature documents and point this index to it. | README/backlog/changelog/handoff exist and match runtime scope. |
| TD-3 | 北極星:視覺 | P2 | ready | Replace the provisional `traDelay` grid coordinates with a sandbox export. | Coordinates were hand-picked and later hand-shifted (now wide `x0,y75,w5,h5`, split `x0,y122,w12,h8`; 2026-10-05), never sandbox-exported. `monitorPacking` asserts the "three columns + bottom two columns" top level. Re-drag both wide and split layouts. | `MONITOR_LAYOUT` and `MONITOR_LAYOUT_SPLIT` regenerated from the sandbox rather than hand-edited. `docs/features/monitor-grid-static/sandbox.html` |
| TRAIL-1 | 北極星:效率 | P2 | ready | 候選：過去日期的軌跡改讀每日檔，只有今天走 RPC。 | 公車過去日期改讀 S3／R2 每日檔（`trails/bus/<date>.arrow` 已有，S3 缺 10-01）；查船舶、航班、觀光接駁有沒有同樣每日檔。先調查再出方案給使用者（使用者 2026-11-09：「可以優化也最好」）。 | 方案經使用者同意後實作；過去日期不再打 RPC。 |
| SBE-5 | 北極星:效率 | P2 | ready | `get_alert_series_24h`（告警 24h 序列）、`get_er_wait_total_14d`（急診 14 天）改預算表；衛星分類表與 `p_entity_type` 函式慢的原因待查。 | 照 R1–R5（docs/supabase-optimization.md §0）出 gis-platform migration。 | 冷快取 <300ms，pg_stat_statements 不再出現在慢查詢清單。 |
| FB-013 | 北極星:視覺 | P3 | ready | 〔bloom-experiments〕BE-1 輸電線 bloom 測試層 line-width／blur 改隨 zoom 內插 | 原檔：[bloom-experiments](../../docs/archive/2026-11-09/features/bloom-experiments/backlog.md)。依據：usePowerLinesGlowTestLayer.ts 仍為常數 blur／width；實驗層；可能併成一列「bloom 實驗」 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-014 | 北極星:視覺 | P3 | ready | 〔bloom-experiments〕BE-2 抽通用 GlowLinesScene primitive | 原檔：[bloom-experiments](../../docs/archive/2026-11-09/features/bloom-experiments/backlog.md)。依據：src 無 GlowLinesScene | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-015 | 北極星:視覺 | P3 | ready | 〔bloom-experiments〕BE-3 面 rim glow 改 Three.js additive 版 | 原檔：[bloom-experiments](../../docs/archive/2026-11-09/features/bloom-experiments/backlog.md)。依據：未見實作 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-016 | 北極星:視覺 | P3 | ready | 〔bloom-experiments〕BE-4 Bloom palette 系統（glow/palettes.ts） | 原檔：[bloom-experiments](../../docs/archive/2026-11-09/features/bloom-experiments/backlog.md)。依據：src 無 glow/palettes | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-017 | 北極星:視覺 | P3 | ready | 〔bloom-experiments〕BE-5 光暈核心／衰減半徑開 uniform 讓 slider 控制 | 原檔：[bloom-experiments](../../docs/archive/2026-11-09/features/bloom-experiments/backlog.md)。依據：未見實作 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-018 | 待討論 | P3 | ready | 〔bloom-experiments〕BE-8 bloom 版取代原生視覺上線（發電廠、輸電線） | 原檔：[bloom-experiments](../../docs/archive/2026-11-09/features/bloom-experiments/backlog.md)。依據：需使用者決定；未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-024 | 北極星:效率 | P3 | ready | 〔byok-chat〕BC-5 police_stations_20260626 日期戳 URL 改讀 manifest／latest | 原檔：[byok-chat](../../docs/archive/2026-11-09/features/byok-chat/backlog.md)。依據：src/research/policeIsochroneOwnerDataset.ts 等仍引用日期戳檔名 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-026 | 北極星:開發系統 | P3 | ready | 〔chart-hover-tooltip〕TimeseriesSparkline 內建 tooltip 收斂到共用基礎設施（約 70 行） | 原檔：[chart-hover-tooltip](../../docs/archive/2026-11-09/features/chart-hover-tooltip/backlog.md)。依據：TimeseriesSparkline.tsx 仍未用 useChartTooltip | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-035 | 北極星:效率 | P3 | ready | 〔demographics-statistics〕統計 catalog JSON 846KB 進 layerCatalog chunk，瘦身到約 248KB 或 lazy | 原檔：[demographics-statistics](../../docs/archive/2026-11-09/features/demographics-statistics/backlog.md)。依據：release_options 仍在 researchDatasets.ts；與 HOME-1／PERF-1「首屏維持現狀」決定有關，需使用者判斷 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-040 | 北極星:兼容 | P3 | ready | 〔embeddable-map〕EM-18 更多歷史快照圖層（earthquakeReplay 等） | 原檔：[embeddable-map](../../docs/archive/2026-11-09/features/embeddable-map/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-041 | 北極星:兼容 | P3 | ready | 〔embeddable-map〕EM-12 Protomaps 字型／sprite 自託管 | 原檔：[embeddable-map](../../docs/archive/2026-11-09/features/embeddable-map/backlog.md)。依據：basemapStyle.ts 仍指 protomaps.github.io | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-042 | 北極星:兼容 | P3 | ready | 〔embeddable-map〕EM-08 嵌入碼防腐：layerAliases.ts＋守門測試 | 原檔：[embeddable-map](../../docs/archive/2026-11-09/features/embeddable-map/backlog.md)。依據：src 無 layerAliases.ts；layer key 改名會讓舊文章地圖壞（部落格有嵌入地圖） | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-048 | 北極星:好用 | P3 | ready | 〔environment-statistics〕MedicalStatisticsGroupControls 拒絕訊息固定「請先調整年份」措辭不精確 | 原檔：[environment-statistics](../../docs/archive/2026-11-09/features/environment-statistics/backlog.md)。依據：未查到修正；小 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-067 | 底線:資料正確 | P2 | ready | 〔imagery〕IMG-rain-history-label 雨量 2026-06-05 前日期顯示「無資料」而非 0 | 原檔：[imagery](../../docs/archive/2026-11-09/features/imagery/backlog.md)。依據：未見對應 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-077 | 北極星:好用 | P3 | ready | 〔jma-live-layers〕JMA-14 時間軸暫停時「現在」自動跟上 | 原檔：[jma-live-layers](../../docs/archive/2026-11-09/features/jma-live-layers/backlog.md)。依據：描述的是行為缺陷，未見修正 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-119 | 北極星:好用 | P3 | ready | 〔pla-activity〕PA-7 疊加模式 popup 列出該點所有命中形狀 | 原檔：[pla-activity](../../docs/archive/2026-11-09/features/pla-activity/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-120 | 底線:資料正確 | P2 | ready | 〔pla-activity〕PA-10 單日模式遇資料斷層整片空白，需 fallback 或明示無資料 | 原檔：[pla-activity](../../docs/archive/2026-11-09/features/pla-activity/backlog.md)。依據：未見 PR；符合「缺資料不當 0」原則 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-130 | 底線:資料正確 | P2 | ready | 〔statistics-comparability〕醫療 PARTIAL、住宅 STALE、年度錯配的可見說明 | 原檔：[statistics-comparability](../../docs/archive/2026-11-09/features/statistics-comparability/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-135 | 底線:資料正確 | P2 | ready | 〔tourist-shuttle〕TS-2 GPS 點與路線距離 gate（>500m fallback） | 原檔：[tourist-shuttle](../../docs/archive/2026-11-09/features/tourist-shuttle/backlog.md)。依據：未見 PR | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-153 | 北極星:開發系統 | P3 | ready | 〔viz-library〕2 合併三份重複 sparkline 成共用 SVG 元件 | 原檔：[viz-library](../../docs/archive/2026-11-09/features/viz-library/BACKLOG.md)。依據：與 chart-hover-tooltip「TimeseriesSparkline 收斂」同一件事，建議合一列 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| TLD-1 | 北極星:好用 | P3 | ready | 時間軸標出新聞與共軍航跡「有資料的日期」。 | 查證 2026-11-09：`fetchNewsEventDates` 只在 `MonitorPanel.tsx` 取最新日期；`fetchPlaTrackDates` 除 loader 外沒有呼叫者；時間軸元件沒有可標日期的介面。原文：[news](../../docs/archive/2026-11-09/features/news/backlog.md)、[pla-activity](../../docs/archive/2026-11-09/features/pla-activity/backlog.md)。 | 時間軸上可看出哪些日期有資料；依設計規範附截圖。 |
| VIZ-1 | 北極星:視覺 | P1 | verifying | 配色第一段：統計色階暗底版＋圖例顯示合成色＋對比契約測試。 | mini #998 已合併、未發版。剩：發版後正式站目視。 | 正式站暗底圖統計圖層最高級可辨、圖例色＝畫面合成色。 |
| VIZ-2 | 北極星:視覺 | P2 | verifying | 配色第二段：暗底圖點／線／面對比修正。 | mini #1002 已合併、未發版（使用者 11-10 同意重開 F-1／K-4／P-2／K-2 與 Day 9 維持 0.55 的決定）。剩：發版後正式站目視；未涵蓋的移到 VIZ-3。 | 正式站截圖前後對照。 |
| VIZ-3 | 北極星:視覺 | P2 | ready | 配色第三階段：前兩段沒涵蓋的層。 | 剩 15 個面、2 個點、約 24 支 hook 寫死暗色、手寫圖例、淡底圖 44 個共用色層與約 73 個自繪點層；第一、二段截圖只驗過 4 層。 | 上述各類有處理或登記例外，暗／淡底圖抽樣截圖。 |
| VIZ-5 | 北極星:視覺 | P2 | in_progress | 視覺化階段 1：統計「呈現方式」共用基礎＋比例圓（Q-A 2、Q-B 1、Q-C 照表）。 | mini #1008：推導 339 層可切比例圓（縣市 213／鄉鎮 114／村里 12，已扣覆寫的台糖公告列數）、`pm=` 網址、同時一層比例圓、空心疊加、LG-5 套疊圓。剩：合併、發版後正式站目視（暗／淡底、popup、手機）。 | 第一批 9 層（戶籍人口、0–14／65+ 人口、原住民、外籍、出生、住宅竊盜、電信詐欺、作物面積，皆鄉鎮）在正式站可切比例圓；比率層沒有選項。 |
| VIZ-6 | 北極星:視覺 | P3 | ready | 視覺化：點密度呈現方式（Q-C 照表，提案階段 3）。 | 推導與測試已在 VIZ-5 寫好（人／件／戶、鄉鎮與村里、據點數不給），選項未露出。First action：決定點位隨機撒點的演算法（面內均勻、每點代表幾人）與效能上限，把 `dots` 加進 `IMPLEMENTED_PRESENTATION_MODES`。 | 人口類鄉鎮層可切點密度；圖例寫「一點＝N 人、位置隨機」。 |
| VIZ-7 | 北極星:視覺 | P3 | ready | 視覺化：溫度網格「方格／等值帶」（Q-G 方案 2：溫度先做，其他場類另查）。 | 用氣象署 O-A0038-003 格點＋d3-contour 切等值帶，時間軸換時刻重切；雨量、空品等其他連續場另外查有沒有官方格點，再決定要不要走測站內插（Q-G 方案 1）。 | 溫度網格控制區可切等值帶，圖例寫「氣象署分析格點」。 |
| VIZ-8 | 北極星:視覺 | P3 | ready | 視覺化：統計「多年份並排」視窗（Q-F 方案 1，小倍數）。 | 資料期別下加按鈕，開置中視窗（§5.27）畫 8 年 canvas 小圖、共用色階，點一張切主地圖；要先產簡化鄉鎮邊界放 R2。 | 有 5 年以上期別的統計層可開視窗，手機 2 欄捲動可用。 |
| VIZ-9 | 北極星:視覺 | P3 | ready | 視覺化：通用比較模式（Q-E 方案 2，掃動對比）。 | 使用者選方案 2（不是建議的方案 1 今昔掃動）。First action：盤點哪些圖層種類能掛第二個地圖、`regionalStatisticsStore` 改成左右兩組選擇的範圍，先出設計稿給使用者看再動工。 | 工具列「比較」可把圖層放左／右／兩側，同一統計層左右可選不同年份；分享網址記得每層在哪邊。 |
| VIZ-10 | 北極星:視覺 | P3 | blocked | 視覺化：可信度紋理（Q-D）。 | Blocker：owner decision（使用者 11-11：「先記錄到 backlog」，目前不做）。提案規則：規則 1 比率背後件數 < 30 密點、30–99 疏點（要配同期件數快照）；規則 2 鄉鎮人口 < 1 萬加紋理，推估類資料整層在圖例標「推估」；建議 1＋2 合用、預設開、只在鄉鎮與村里層。限制：快照目前沒附分子分母。 | 使用者決定要做時改 ready。 |
| VIZ-11 | 北極星:視覺 | P3 | blocked | 視覺化構想：聚焦＋脈絡、鏡頭腳本（導覽自動播放）。 | Blocker：owner decision（提案列為構想，使用者尚未表態）。 | 使用者表態後再拆列。 |
| RCM-1 | 北極星:視覺 | P3 | ready | 樹高圖層 raster-color 寫法與 PRINCIPLES 對齊，並清掉 urban-heat-lst 的過時說法（原在未合併的 PR #762，2026-11-10 搬入）。 | 2026-10-30 查證：canopy（`overlayRegistry.ts` canopy 段）把 `raster-color-mix` 輸出正規化到 0–1（係數 6.375＝255/40、range `[0,1]`），stop 不是物理值，和 `.claude/memory/PRINCIPLES.md`「stop 一律寫物理值」不一致；地表溫度圖層用物理值（係數 51＝0.2 K×255）是對的。另外 `docs/features/urban-heat-lst/changelog.md` 還留著已被推翻的早期係數說法。First action: 決定 canopy 改成物理值寫法（mix `[255/k,0,0,min]`、range `[min,max]`、stop 寫公尺）或在 PRINCIPLES 登記例外；changelog 舊說法加註「已推翻，見 handoff.md」。 | canopy 改完後像素取樣驗收顏色與舊版一致（golden 通過）；PRINCIPLES 與實作一致；changelog 不再誤導。公式：gis-map-kit 卡 05-11。 |
| MVT-1 | 北極星:效率 | P3 | conditional | gis-platform 動態出磚函式 `get_mvt_tile` 修正座標系混用（原在未合併的 PR #762，2026-11-10 搬入）。 | Trigger：任何前端或服務要開始呼叫 `get_mvt_tile` 之前；owner：Claude。2026-10-30 讀 gis-platform origin/main migrations/473（前身 006、312）發現：各分支直接拿 `ST_TileEnvelope`（3857）與 4326 的 `geom` 做 `&&` 與 `ST_AsMVTGeom`，沒有 `ST_Transform`，依 PostGIS 文件會報 mixed SRID 或回空磚；目前沒有呼叫端所以沒人發現。只讀程式碼與官方文件，未在資料庫實測。First action: 用 `ST_Transform(ST_TileEnvelope(z,x,y),4326)` 篩選、`ST_AsMVTGeom(ST_Transform(geom,3857), ST_TileEnvelope(z,x,y))` 編碼，寫成新 migration（先跑 `scripts/check_migration_numbers.py`）。 | 對一個有資料的 z/x/y 呼叫回非空 MVT、無 SRID 錯誤；EXPLAIN 仍走 GiST 索引。做法說明：gis-map-kit 卡 06-13。 |

## K. 產品舊決策（Monitor、情報等）

| ID | Tier | Pri | State | Item | Next action / blocker | Acceptance |
|---|---|---|---|---|---|---|
| PH-2 | 底線:資料正確 | P2 | blocked | Decide what replaces the dengue card now that CDC removed its source. | (P1→P2 2026-10-16: blocked on an owner decision.) Re-checked 2026-10-05: `Weekly_Age_County_Gender_061.csv` and the `aagstable-weekly-dengue` CKAN page both 404; CKAN search (dengue / 登革熱) returns only `dengue_ns1_clinics`. Owner decision among: scrape NIDSS ASP.NET form / ask CDC for the new location / retire the card and mount an A-grade candidate. **健檢 2026-11-08**：選：退卡／換來源；證據：10-05 複查 404。 | An owner decision plus either a working source or the card removed. Candidates: [public-health proposal](../../docs/archive/2026-10-16/proposal/monitor-tweaks-2026-08-21/public-health-proposal.md) |
| AG-10 | 北極星:好用 | P2 | blocked | 網站部署後已開著的分頁仍跑舊程式（淹水上圖修好後要重新整理才生效）。 | owner decision：要不要做「面板偵測新版本並提示重新整理」（目前 src 沒有任何版本偵測，2026-10-05 查）。 **健檢 2026-11-08**：發版頻率高（11-08 一天 5 版），價值上升；證據：10-05。 | 部署後舊分頁會看到「有新版本」提示。 |
| G023 | 北極星:效率 | P2 | blocked | Decide whether Wall mode may pause hidden map engines. | owner decision on UX; perf-audit #464 only stops hidden/closed layers, not visible layers behind the Wall. Then add `setActive(false)` to engines/scenes. | Approved UX behavior and CPU comparison. Renamed from legacy duplicate `G011`. |
| IN-1 | 北極星:好用 | P3 | ready | Make the Intel panel's three counts agree. | Header「共 N 則」counts news only; the「全部」tab sums news + alerts-in-all + global-in-all; `AlertSummaryBar`「N 則警報」uses `alertTally.total` without the RANGE filter — so one screen can show「共 0 則」「全部 11」「66 則警報」at once. Decide one denominator per label (or relabel) before changing code. Found during UI unification Phase H (2026-09-27). **健檢 2026-11-08**：先決定分母；證據：09-27 發現。 | All three numbers are explainable from the same filter state; a test covers the RANGE/tab combinations. `src/components/intel/IntelPanel.tsx`, `alerts/FeedTabs.tsx`, `alerts/AlertSummaryBar.tsx` |
| LW-1 | 北極星:好用 | P3 | conditional | Keep live-wall cells from sitting on YouTube's「無法播放這部影片」. | Trigger: owner review done (trigger 待定, owner: 使用者, flagged 2026-10-16); first action: decide the onError switching design. Owner wants to review first (2026-10-03). Observed: CTS `wM0g8EoUZ_E` and TVBS `m_dhMSvUCIc` refused in the embed while still live and oEmbed-embeddable (200), so the block is viewer-side (network/region/sign-in/bot check), not stale IDs. Proposed: YouTube IFrame API `onError` (101/150/152/153) → switch the cell to another currently-live resolved channel (`get_yt_live_videos`, 13 handles) and label「華視無法嵌入，已改播 ○○」; decide whether the legacy wall follows. | Owner decision; if built, a refused cell auto-switches within one load and the label names both channels. `src/components/intel/monitor/LiveWall.tsx` |
| AG-3 | 北極星:視覺 | P3 | blocked | 地震漣漪暫停時的行為：新版暫停 3 秒收起，舊版會無限循環。 | owner decision：要不要循環。 **健檢 2026-11-08**：建議 TINY，維持現狀即關。 | 決定後依需求調整 `useEarthquakesGlobalLayer`，並附單元測試。 |
| D8-1 | 北極星:好用 | P3 | ready | 分享網址記住 Day 8 方案與步速（`mapchallengeDay08Scenario`／`AccessSpeed`）。主站目前不支援任何圖層參數進網址：`src/lib/urlState.ts` 的 `UrlState.params`（`p.*`，只收數字）註明「僅 /embed 消費，主站忽略」，`src/App.tsx` 同步網址的 `buildUrl(...)`（約 L1962）也不寫 params，所以要動共用框架，不是 Day 8 單層能做。 | First action：設計主站 `p.*` 讀寫（哪些參數可分享、sharedGroup 成員只寫一次、與 `NON_SHAREABLE_PARAM_NAMES` 和 embed 契約的關係），再決定要不要做。 **健檢 2026-11-08**：與 FE-01 同一題，FE-01 併入本列。<br>**2026-11-09 封存項併入**（原檔 [main-site-ai-gis-roadmap-2026-09-05](../../docs/proposal/main-site-ai-gis-roadmap-2026-09-05.md)）：F2 命名場景與會員同步（camera／time／layers／params round-trip） | 主站分享網址帶方案／步速，開網址後兩層方案一致；urlState 測試補上主站情境。 |
| FE-01 | 北極星:好用 | P2 | merged | 〔已併入 D8-1〕Make share URLs truthful about parameter support. | owner decision (2026-10-05, skipped from PR #543): `/embed` depends on `parseParams` reading `p.*` (`src/embed/EmbedApp.tsx:102`), so the parsing cannot be removed; the main app ignoring `p.*` is documented as intentional (`docs/features/embeddable-map/README.md`). Choose: close as intended, or apply + validate + write back `p.*` in the main app (`App.tsx` syncUrlRef ~1871). **健檢 2026-11-08**：與 D8-1 同一題，內容保留在此供參考，進度改記在 D8-1。 | Shared link reproduces state or no longer claims to. |
| MON-P6 | 待討論 | P3 | conditional | Monitor four-domain sub-indices (spec §5.35 I2): 災害／民生／國防／網路與交通, then rebuild the pressure composite from them. | Trigger: owner decides to restart (none set; 2026-10-16 flagged). Owner: 使用者. First action: write the public weights and baseline-period proposal. Owner parked it 2026-10-03 as hard; P1–P5 merged (#482–#505). Needs: gis-platform pre-aggregated table + schedule + migration (owner approval), public weights and baseline period proposal, and a way to show which sources are missing so a stopped source never silently lowers an index. Start from `docs/features/monitor-restyle/README.md` 實作順序 and spec §5.35 I2. **健檢 2026-11-08**：建議封存（與北極星 AI 分析弱相關）；證據：10-03 擱置。<br>**2026-11-09 封存項併入**（原檔 [chart-hover-tooltip](../../docs/archive/2026-11-09/features/chart-hover-tooltip/backlog.md)）：pressure 指數 per_signal 回扁平 dict，前端 10 訊號權重長條恆為空；需後端改回結構化陣列 | Owner-approved weights/baseline; migration applied; each sub-index shows its inputs and missing sources; composite is the published weighted sum. |
| SAT-Z3 | 待討論 | P3 | conditional | Make the satellite console's maneuver list follow the timeline in history mode (decision Z3). | Trigger: owner un-parks (trigger 待定, owner: 使用者, flagged 2026-10-16); first action: the three approvals listed below. Owner parked it 2026-10-04 (not urgent); front-end shows an interim notice since #533. Draft migration `426_satellite_maneuvers_at_anchor.sql` (`get_satellite_maneuvers_at(p_anchor, p_hours)`) sits on gis-platform branch `feat/satellite-maneuvers-anchor` (worktree `.worktrees/sat-maneuver-anchor`, local commit `a0bc247`, not pushed, not applied; the handoff doc exists only on that branch; renumber on the day it is applied). Before applying, owner must approve: (1) one-row-per-satellite "what the panel would have shown at the anchor" semantics; (2) a read-only `EXPLAIN (ANALYZE, BUFFERS)` on production after 20:00 for 24 h and 72 h windows (reads `live.satellite_tle_history`, ~2.3 GB, tied to the 2026-09-04 Disk IO incident); (3) error `SM001` for anchors older than the 30-day retention (UI「無法推算」) and a 72 h `p_hours` cap. Then upstream PR → apply → front-end swaps `resolveManeuverListScope` to call the RPC with a debounced timeline anchor. **健檢 2026-11-08**：建議封存或明確保留；本機分支有遺失風險；證據：gp 分支未 push。 | Production query cost measured and < 1 s (else pre-aggregate); migration applied; history-mode list changes with the timeline and shows「無法推算」past 30 days. [Feature README](../../docs/features/satellite-console-restyle/README.md), gis-platform branch `feat/satellite-maneuvers-anchor`: `docs/handoff/satellite-maneuvers-at.md` |
| FB-022 | 北極星:好用 | P3 | ready | 〔byok-chat〕BC-2 會員加值：圖層狀態收藏 user_favorites、chat_logs、跨裝置歷史 | 原檔：[byok-chat](../../docs/archive/2026-11-09/features/byok-chat/backlog.md)。依據：src 無 user_favorites／chat_logs | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-023 | 待討論 | P3 | waiting_external | 〔byok-chat〕BC-3 預設模型檔位改中階 | 原檔：[byok-chat](../../docs/archive/2026-11-09/features/byok-chat/backlog.md)。依據：待使用者決定 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-031 | 北極星:視覺 | P3 | ready | 〔culture-layers〕CU-5 librarySeats 閉館段在折線用灰帶呈現 | 原檔：[culture-layers](../../docs/archive/2026-11-09/features/culture-layers/backlog.md)。依據：待使用者決定 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-036 | 北極星:好用 | P3 | ready | 〔earthquake-replay〕EQ-1 事件累積到 100+ 時加分頁或篩選 | 原檔：[earthquake-replay](../../docs/archive/2026-11-09/features/earthquake-replay/backlog.md)。依據：條件型；未查目前事件數 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-059 | 北極星:好用 | P3 | ready | 〔global-climate〕GC-10 颱風作戰室 preset | 原檔：[global-climate](../../docs/archive/2026-11-09/features/global-climate/backlog.md)。依據：未見實作 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-070 | 底線:資料正確 | P2 | ready | 〔isr-satellite-monitor〕ISR-MON-4 twmain_12nm 是否含附屬島嶼 | 原檔：[isr-satellite-monitor](../../docs/archive/2026-11-09/features/isr-satellite-monitor/backlog.md)。依據：待使用者決定 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-097 | 北極星:好用 | P3 | blocked | 〔layer-manifest〕LM-EDGE-1 6 個 no-popup 邊界案例待拍板（房地產網格、temperatureWave 等） | 原檔：[layer-manifest](../../docs/archive/2026-11-09/features/layer-manifest/backlog.md)。依據：owner decision | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-103 | 北極星:開發系統 | P3 | ready | 〔monitor-split〕MS-7 沙盒 DEFAULT_LAYOUT 未同步二版座標 | 原檔：[monitor-split](../../docs/archive/2026-11-09/features/monitor-split/backlog.md)。依據：不阻塞，但重設會拿到舊版；小 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-112 | 北極星:好用 | P3 | ready | 〔owner-gated-layers〕OG-2 資料新鮮度後台可編輯（admin_upsert_freshness 表單） | 原檔：[owner-gated-layers](../../docs/archive/2026-11-09/features/owner-gated-layers/backlog.md)。依據：src 無 admin_upsert_freshness 呼叫；注意編號與核心 BACKLOG 不衝突 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-125 | 底線:資料正確 | P2 | ready | 〔road-congestion〕RC-2 保留「最新可得快照」clamp 或改嚴格 slot | 原檔：[road-congestion](../../docs/archive/2026-11-09/features/road-congestion/backlog.md)。依據：owner decision | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-141 | 待討論 | P3 | ready | 〔urban-zoning〕UZ-3 未覆蓋縣市用 NLSC LUIMAP WMS 當暫時視覺層 | 原檔：[urban-zoning](../../docs/archive/2026-11-09/features/urban-zoning/backlog.md)。依據：owner decision；記憶寫 NLSC WMTS／WMS 無都計分區層，需重查；可能不可行 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-182 | 北極星:好用 | P3 | ready | 〔main-site-ai-gis-roadmap-2026-09-05〕F1 圖層收藏與已開啟管理 | 原檔：[main-site-ai-gis-roadmap-2026-09-05](../../docs/proposal/main-site-ai-gis-roadmap-2026-09-05.md)。依據：與 byok-chat backlog BC-2（收藏）同一件事；BC-2 不在正本 BACKLOG；併入 BC-2 新列 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| EMB-3D | 待討論 | P3 | conditional | 構想（不排時程）：嵌入版地圖支援 Three.js 立體圖層（例如列車）。 | 使用者 08-04「之後再談」，2026-11-09 決定保留成構想。原文：[embeddable-map](../../docs/archive/2026-11-09/features/embeddable-map/backlog.md)。 | 排入時再寫驗收。 |

## L. 內容（部落格、挑戰日、歷史研究）

| ID | Tier | Pri | State | Item | Next action / blocker | Acceptance |
|---|---|---|---|---|---|---|
| HIST-1 | 底線:授權 | P2 | conditional | 確認兩個中研院來源的授權能用在個人網站：THCTS（CC BY-NC-SA 3.0 TW，條文開頭寫「國內研究、教學等非商業使用者」）與臺灣百年歷史地圖 WMTS（CC BY-NC，簡報寫免申請）。2026-11-07 #882 已把 WMTS 從 6 張擴到 85 張公開圖（歷史底圖 6 層，develop 未發版），發版前確認更重要。 | **使用者 2026-11-08 決定暫不寄，不要再催**；Trigger：使用者自己說要寄、或中研院／第三方提出授權疑義時才動。原 first action（保留）：First action：寄 gis@gate.sinica.edu.tw，說明非營利個人網站、圖層用途與署名方式。 健檢 2026-11-08 曾建議提高優先度（#882 已隨 v2.27.0 公開），使用者同日決定先不寄。 | 收到回覆並記在 thcts_inventory_summary.md；若不允許，下架或改站主限定 Day 6 與古地圖。 |
| SEO-4 | 北極星:好用 | P2 | waiting_external | 社群分享預覽圖。 | 需要一張 1200×630 站圖（`public/` 目前沒有適合的），到位後補 og:image 與 `twitter:card=summary_large_image`。 | 分享連結出現預覽圖。 |
| BLOG-1 | 內容:部落格 | P2 | conditional | 持續把 Threads 開發日記改寫成 `/blog/` 長文（SEO／AEO）。 | 2026-11-08 改寫：使用者 10-24 決定 Flight Arc 不寫進 Pulse 筆記（article-plan C1 已標「不寫」），且說先觀察效應、暫停一般長文；目前只照 30 天地圖挑戰產文（使用者發完 Threads 後）。Trigger: 使用者說恢復寫一般長文。D／E／H 三篇主題 id 待定。流程照 `.claude/skills/blog-writing/SKILL.md`。 **健檢 2026-11-08**：暫停中；證據：11-08 改寫。 | 新文章在 sitemap 與 llms.txt 登記、正式站文章頁 200；進度與清單在 [`docs/features/blog/article-plan.md`](../../docs/features/blog/article-plan.md)。 |
| SEO-6 | 內容:部落格 | P2 | conditional | 讓爬蟲讀到實質內容（預渲染或靜態「關於／資料來源／主題導覽」頁）。 | Trigger: SEO-5 收錄兩週後的結果。Owner: 使用者決定投入。First action: 與 SEO-7（英日文實體頁）、AEO-3（FAQ）同一包規劃。 | 重點說明頁有實體 HTML 並被收錄。 |
| HIST-4 | 內容:挑戰日 | P2 | ready | Day 6 發版與發文收尾。 | Trigger 已成立：Day 6 隨 v2.26.0 發版（2026-11-07 正式站實測 v2.26.1）。First action：在正式站用拍攝模式重拍 6 張，補 Threads 草稿（`day06-vintage-threads-draft.md`）的網站連結，確認草稿〔待確認〕項（錦町／柳町／綠町部分比對）。 | 正式站可見 Day 6 四層與古地圖（非站主），貼文發出。 |
| HIST-2 | 內容:研究專題 | P3 | blocked | 把 THCTS 研究成果整理成「歷史底圖」主題圖層。2026-11-07 使用者決定先放原始資料（中研院 WMTS 原圖，#882 已合 develop），自己加工的研究成果不優先。 | Blocked on 使用者選題（研究成果要不要上、上哪幾題）。First action：從 `thcts/thcts_layers_inventory.csv`（129 主題／267 圖層）與 explore/ 結論挑候選（強：Q8 1953 番界、Q4 1921 鐵路與糖鐵、Q2 1904 陂塘；弱：Q3 圳道、Q9 人口不建議），每層寫來源年代、TWD67→WGS84 七參數轉換（中位誤差 49 m）、Big5／UTF-8 編碼、授權；pipeline 放 analytics、registry 進 pulse-data，地圖畫面先出設計稿。 | 使用者選定的圖層上 develop，圖例含年代、來源、CC BY-NC-SA 署名與「位置可能偏移」。 |
| SEO-5 | 內容:部落格 | P1 | verifying | 讓 Google／Bing 開始收錄正式站。 | 2026-10-17 已完成：#609 隨 v2.9.0 上線；Search Console 以「網域」資源驗證 `itsmigu.com`（Cloudflare 自動加 TXT，勿刪 `google-site-verification` 紀錄）、提交 sitemap（找到 3 個網址）、首頁已要求建立索引（Google 上次檢索為 2026-09-20 的空白首頁）。Next: 約 2026-10-31 查 `site:` 與 Search Console「網頁」報表；Bing 可從 Search Console 匯入（選做）。 **健檢 2026-11-08**：使用者看 Search Console；證據：10-31 檢查日已過。 | `site:mini-taiwan-pulse.itsmigu.com` 出現首頁與語言版本。報告 §3 |
| HIST-5 | 內容:研究專題 | P3 | merged | 〔已併入 OWD-4〕water1944Taipei 後續：細水路只抽到約一半未上圖；只有臺北盆地；pulse-data registry／warehouse 是否已登記未確認。 | First action：查 pulse-data registry 有無 water1944Taipei 與 Day 6 四層的條目，缺的補登（DISPLAY_ONLY 或可分析需標明）。 2026-11-08：water1944Taipei 搬進私人檔（真正鎖起來）排在 OWD-4。 **健檢 2026-11-08**：與 OWD-4 同一題，內容保留在此供參考，進度改記在 OWD-4。 | registry 覆蓋檢查 0 缺口；是否擴大範圍由使用者決定。 |

## M. 文件與 repo 衛生

| ID | Tier | Pri | State | Item | Next action / blocker | Acceptance |
|---|---|---|---|---|---|---|
| BK-1 | 底線:備份 | P3 | ready | `GIS/_worktree-backups/` 超過 30 天的資料夾丟垃圾桶。 | 逐資料夾確認沒有仍被引用的成果（例如 THCTS、water1944 研究在 2026-11-06 資料夾，見 HIST-3），mv 到 `~/.Trash`。與 CL-5 一起決定。 | 只留 30 天內或有引用的資料夾。 |
| Unrouted-platform-programs | 北極星:開發系統 | P2 | blocked | Keep active programs without a feature backlog discoverable. | owner decision: 2026-10-05 check found water `BL-6/8–23`, climate/terrain `MC-*` and road coverage `CV-*` have no findable canonical plan in develop — re-home or drop them. Monitor `MO-4/7/8/12/14` live in `docs/proposal/monitor-v2-plan.md`; satellite `SAT-3/7/8A` in `docs/features/satellite-console-restyle/proposal.md`. **健檢 2026-11-08**：建議直接宣告封存那批 ID；證據：10-05。 | Every listed program ID resolves to an existing canonical doc. `docs/proposal/monitor-v2-plan.md`, `docs/features/satellite-console-restyle/proposal.md` |
| CL-3 | 待討論 | P3 | conditional | Decide the fate of the parked POC draft PRs. | Still all OPEN on 2026-10-05: pulse #425 CCTV/YOLO, #426 intl media, #427 news location, #428 AR-11e legacy RPC (R2 CORS now answers, see AR-11e); collectors #116–#121; gis-platform #126–#128 (all three must renumber migrations); mcp #27. Merging to collectors deploys to production. Trigger: owner（使用者）決定有空檢視 POC 草稿時，或這些 PR 阻擋 collectors／gis-platform 的 migration 編號時（not_before：無）。First action: owner 逐個判斷 14 支 PR「完成並依 upstream-first 合併／關閉並保留分支」，先從 gis-platform #126–#128 的 migration 重編號開始。 **健檢 2026-11-08**：另有 mini #762、#829 非 draft 舊 PR 掛著；證據：mini #425 已 MERGED 10-17（文件仍列 OPEN）；#426–#428、gp #126–128、collectors #116–121、#87、MCP #27 仍 draft。 | Each PR is either finished and merged in upstream-first order or closed with its branch kept as archive. |
| G019 | 北極星:效率 | P3 | ready | Determine whether 83 unused rail tracks are data defects or deploy waste. | Compare schedules, missing service and track inventory before deleting anything. | Evidence-backed keep/delete decision. |
| G021 | 北極星:開發系統 | P3 | ready | Align gis-platform's gis-wiki submodule. | Submodule pin `ad6fa4d` is 5 commits behind gis-wiki main `6b9fbe0` (local refs, 2026-10-05); bump it in gis-platform. **健檢 2026-11-08**：證據：11-08：gp main 仍指 ad6fa4d，wiki main f221dcf。 | Superproject points to approved gis-wiki main commit. |
| CL-6 | 北極星:開發系統 | P3 | ready | Preserve the untracked GFW freshness investigation note. | Still untracked on 2026-10-05: `data-collectors/docs/investigations/2026-09-18-gfw-freshness.md` (origin/main has only `2026-09-18-gfw-safe-publish.md`; copy also in the backup folder). Commit it with the next code change to collectors, because a docs-only merge would trigger a production redeploy. **健檢 2026-11-08**：證據：collectors origin/main 仍只有 gfw-safe-publish.md。 | File is tracked in data-collectors main. |
| CL-7 | 北極星:開發系統 | P3 | ready | Resolve the analytics ADR number collision. | The collision is now committed on analytics origin/master (2026-10-05): `0005-jp-height-grid-contract.md` (835edf90, 2026-09-20) and `0005-historical-flight-trails-static-detail.md` (ed3886e0, 2026-10-04). The highest number is 0008. Renumber the later file to 0009 and fix the links that point to it. **健檢 2026-11-08**：證據：origin/master 仍兩個 0005。 | No duplicate ADR numbers in analytics `docs/adr/`. |
| G003 | 待討論 | P3 | blocked | Decide whether the independent Three showcase remains tracked. | Owner decides retain versus move to examples. | Decision and path are documented; app build is unaffected. |
| FB-099 | 北極星:開發系統 | P3 | ready | 〔layer-manifest〕LM-UPSTREAM-DOC-1 analytics _pending_source_urls.md 清掉舊 fire catalog 路徑 | 原檔：[layer-manifest](../../docs/archive/2026-11-09/features/layer-manifest/backlog.md)。依據：analytics _pending_source_urls.md 仍有 fire_hydrants.md 引用；小 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-151 | 北極星:開發系統 | P3 | ready | 〔vessel-watch〕VZ-11 RPC audit 補登 get_vessel_zone_daily、analytics maritime_boundary catalog 過時 | 原檔：[vessel-watch](../../docs/archive/2026-11-09/features/vessel-watch/backlog.md)。依據：supabase-rpc-audit-2026-04-09.md 無 get_vessel_zone_daily（catalog 那半未見「尚未建表」字樣，可能已修）；小 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-178 | 北極星:開發系統 | P3 | ready | 〔cctv-finetune-roadmap-2026-09-29〕收集結束後 bootout launchd plist（stopAfter 10-21） | 原檔：[cctv-finetune-roadmap-2026-09-29](../../docs/research/cctv-finetune-roadmap-2026-09-29.md)。依據：2026-11-09 launchctl list 仍見 com.migu.cctv-training-collect 已載入（未執行中）；小；收集程式在 ~/cctv-collector | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| DCAT-1 | 北極星:AI | P3 | ready | analytics `docs/data-catalog` 補登：圖書館座位（tpml_seat，librarySeats）、急診（erHospital）、環境即時 4 層；補完把 manifest upstream 升 verified。 | 查證 2026-11-09：librarySeats、erHospital 仍 `pulse_only`；incineratorEmissions、waterEffluentLive、cemsStackLive 等仍 `catalog_missing`（第 4 層未逐一對應）；行道樹 7 份已 verified（已關）。原文：[culture-layers](../../docs/archive/2026-11-09/features/culture-layers/backlog.md)、[environment-layers](../../docs/archive/2026-11-09/features/environment-layers/backlog.md)、[er-hospital](../../docs/archive/2026-11-09/features/er-hospital/backlog.md)。 | 各層 catalog .md 進 analytics、manifest upstream 改 verified。 |
| DOCST-2 | 北極星:開發系統 | P3 | ready | DOCST-1 剩餘：巢狀 `japan_opendata/medical/_status.md` 檔頭、接進 `gen_inventory.py`。 | analytics #357 已處理 84 份。 | 巢狀檔有檔頭；INVENTORY 列出過期清單。 |
| DISK-1 | 北極星:效率 | P2 | ready | 本機磁碟長期 98%：倉庫 runtime 兩處 package-cache 共約 16 GB 整併。 | 確認兩處 package-cache 的使用者（MCP、組裝、關卡 `--package-cache`）後合成一處或改 symlink；清理一律 mv 到 ~/.Trash。 | 只剩一處 package-cache，磁碟使用率下降並記錄前後數字。 |

## N. 模擬實驗

| ID | Tier | Pri | State | Item | Next action / blocker | Acceptance |
|---|---|---|---|---|---|---|
| TA-2 | 北極星:AI | P1 | blocked | 雙北重算：已發布的雙北結果用到 r5py 快取裡的舊輸入，也沒套國道客運上下車限制。P1＋比對已做（output/transit_access/ntpe_rerun_20261104/），P2、P3 未完。 | Blocked on 使用者說要跑（2026-11-06「先不跑」）。First action：報價（約 2–3 小時、2–3 美元）後用 `cloud/launch.sh` 上 AWS 跑 P2＋P3，從根目錄複製 fallback_cells.json；寫 ntpe_rerun.md 與是否換掉網站版本的建議。 **健檢 2026-11-08**：花費約 2–3 美元。 | 新舊對照報告完成，使用者決定換或不換 R2 `sim/v1/transit_access/`。 |
| TA-6 | 北極星:AI | P3 | merged | 〔已併入 TA-2〕雙北重算 P1 未解疑點：兩個「禁止行人」樣本格反而變慢（原因未查）；Google 夜間能到土城／泰山／林口／五股、新模型判定到不了（Google 步行 1.35–1.9 km）。 | First action：併入 TA-2 報告逐格查路網與步行上限。 **健檢 2026-11-08**：與 TA-2 同一題，內容保留在此供參考，進度改記在 TA-2。 | 原因寫進 ntpe_rerun.md，或確認為模型假設差異。 |
| TA-3 | 北極星:視覺 | P2 | blocked | 三市怎麼上網站：一市一個 slug 還是合成一個；高雄「只有 GPS 版、沒有時刻表版」怎麼標示。 | Blocked on 使用者決定（TA-1 合併後）。First action：做設計稿（多版）給使用者選。 | 拍板後 publish_sim_bundle 上 R2、mini 接線 PR 進 develop。 |
| TA-4 | 北極星:開發系統 | P3 | ready | 雲端工具未測項：Spot（約半價）中途被收回後的接續流程。 | Trigger：下次要跑長任務且想用 Spot。First action：用 smoke.job.env 開 Spot 跑一次，手動中斷後驗證接續。 | 中斷後能從斷點接續，結果與 On-Demand 一致。 |
| FB-179 | 內容:研究專題 | P3 | ready | 〔cctv-finetune-roadmap-2026-09-29〕階段 2–6：r2 標註批次（約 144 張）→ 切分 → 訓練 → 評估 → 主動學習 | 原檔：[cctv-finetune-roadmap-2026-09-29](../../docs/research/cctv-finetune-roadmap-2026-09-29.md)。依據：PROJECTS.md 列 ⏸️ 保留、待討論「本機訓練或封存」；BACKLOG 無 ID；需使用者決定 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |
| FB-180 | 底線:資料正確 | P2 | ready | 〔cctv-finetune-roadmap-2026-09-29〕白天資料取得後重檢驗證集 | 原檔：[cctv-finetune-roadmap-2026-09-29](../../docs/research/cctv-finetune-roadmap-2026-09-29.md)。依據：驗證集目前全是夜間與傍晚 | 原檔所寫的驗收條件；未寫則完成後附 PR／正式站證據。 |

> CCTV 長期目標（**保留中的長期目標，非放棄**，不排時程）：目標 2 衛星圖＋道路模型、目標 3 路口還原、緊急車輛裁切分類器，正本在 [cctv-finetune-roadmap §5、§6、§10.5](../../docs/research/cctv-finetune-roadmap-2026-09-29.md)；依賴標註累積，排入時再開列。


## 已關閉（2026-11-11 視覺化提案拍板）

- **VIZ-4**：視覺化功能設計提案 Q-A～Q-G 使用者 2026-11-11 回答：Q-A 方案 2（控制區「呈現方式」，圖例保持單純，與圖層相關的調整都放圖層展開）、Q-B 方案 1（自動推導＋逐層覆寫）、Q-C 照表、Q-D 先記錄不做、Q-E 方案 2（通用比較模式）、Q-F 方案 1（多年份並排視窗）、Q-G 方案 2（溫度先做，其他場類另查）。已拆成 VIZ-5～VIZ-11。

## 已關閉（2026-11-11 review 第五輪接手：附證據）

- **RV-1110**：Codex review 第五輪修正 PR 審查與合併。證據：mini #1005（develop `cf31e4fe`）、#1006（合 develop、golden 重產無差異、verify 綠，develop `33b80b12`），合併前 develop vs PR 截圖驗收（#1005 F002／F044／F067 通過；#1006 接受兩筆對比下降、對比不足時保留原色，使用者 2026-11-11 授權）；gis-platform #240（main `c43270e3`）；collectors #199（補修 PLA 項次誤刪後合併，main `6e82d27e`）。剩餘套用與部署在 GP-550、COL-199。
- **RV-F065**：`cloud_agent_ro` 是否繼承 `authenticated` 寫入 RPC。證據：2026-11-11 正式 DB 唯讀查詢（BEGIN READ ONLY）：`pg_has_role` USAGE／MEMBER 皆 false，該角色不屬於任何角色；依 mig 536 判準找出的 94 支寫入型函式可執行 0 支 → NA，不需新 migration。

## 已關閉（2026-11-10 差異檢核收尾：附證據）

- **MCPD-1**：部署 mini-pulse-gis-mcp #107 到 analysis-prod。證據：2026-11-10 analysis-prod/mcp 更新到 main `f6c8d61` 並 build，冒煙通過（主 agent 回報）。
- **MCPD-3**：`pythonCompat.test.ts` 受本機 DuckDB 2.0.0 影響常紅。證據：MCP #108——測試依 `$PULSE_PYTHON` 或候選清單挑 duckdb＝1.5.3 的直譯器，找不到時 CI 失敗、本機略過並寫原因；CI 裝釘版 duckdb 真的跑這支測試。
- **AGQ-2**：新踩到的口徑陷阱寫回 pulse-data registry。證據：pulse-data #103 回寫台灣三個陷阱（捷運站含貓空纜車 4 站、臺北實價點落市界外、`health_center` 只含有健保門診的衛生所），三題也列入 MCP #108 固定驗算題（TW13、TW14、TW17）。
- **WHREL-1**：倉庫發版前固定驗算題＋逐表差異門檻＋DuckDB 版本斷言。證據：MCP #108（`warehouse:gate`：DuckDB 釘版含每個 parquet 檔尾、27 題 golden、表消失／列數 ±20%／幾何有效比例；例外 `--accept 表=理由`；`duckdb_pin.py` 各腳本斷言 1.5.3）、#109（通過才寫 `release-gate-proof.json`，`upload-store execute` 無證明拒絕切 latest）、#110（清空 writer 例外、TW16 驗台灣時間 20:00）、#111（欄位消失或型別改變算失敗）。
- **WHVER-1**：各處倉庫版本一致性檢查。證據：MCP #108 `npm run warehouse:versions`（R2 latest、cache、store、MCP 部署 commit 與 dist、manifest.assembler、layer-status 日期、runbook §1），不一致 exit 1；#109 起 R2 latest 因私有 bucket 無公開網址顯示 UNVERIFIED。
- **WHDB-1**：愛爾蘭等以 DuckDB 2.0.0 寫的資料包重發。證據：pulse-data #104 以 DuckDB 1.5.3 重發 72 表（台灣 8＋愛爾蘭 64），新版 `20261110T084641Z` 上 R2 並切 latest、冒煙通過；接受的差異：`ie_river_flood_extents` 580 列空幾何改 NULL、`ie_courts.district_number` JSON→VARCHAR；MCP #110 清空 writer 例外。剩 S3 歸檔與 R2 舊版清理見 WHDB-2。
- **CI-9**：mini develop／master 設 required status check `ci-ok`。證據：2026-11-10 已設（主 agent 回報）；`enforce_admins` 仍為 false。
- **DEV-6**：開場提示本機落後 origin 與過期期限。證據：mini #1003；主 checkout 2026-11-10 已快轉到 develop（備份分支 `backup/main-checkout-pre-ff-20261110`，17 個不在 lock 的資料檔備份在 `GIS/_worktree-backups/2026-11-10/mini-main-checkout-pre-ff/`）。
- **DEV-13**：入口文件自動檢查 `npm run check:entry-docs`。證據：mini #997 合併；develop CI 綠。
- **SQLL-1**：gis-platform sql-lint L3：新表必須登記保留期限與 S3 正本。證據：gis-platform #238（套用於編號 ≥550 的 migration）。文件補寫見 SQLL-2。
- **DOCST-1**：analytics `_status.md` 統一檔頭。證據：analytics #357（84 份加 `status`／`as_of` 與盤點腳本）。剩餘見 DOCST-2。
- **CI-7**：pulse-data 補 CI；MCP CI 跑倉庫 Python 測試。證據：pulse-data #103（CI-7a：registry 檢查、baseline 只減不增、pytest、layer-coverage 近似模式）、MCP #108（CI-7b：`warehouse-python` job 跑 `pytest warehouse/tests`）。
- **UPT-1**：正式站週期性外部檢查。證據：mini #999 `site-watch.yml`（每 30 分：首頁、main-*.js、主站 PMTiles Range、R2 資產 Range），合併後手動跑過成功。
- **SYNCR-1**：sync-rotating 實際頻率不足的偵測。證據：mini #999 `rotating-freshness.yml`（每小時檢查 R2 climate manifest `generated_at` ≤12 小時），合併後手動跑過成功。只偵測、排程本身未搬家。
- **CFW-1**：Workers 用量超過 6 成告警。證據：mini #999 `workers-usage.yml`（每 2 小時，當日 >6 萬發 Telegram），合併後手動跑過成功；實測 12,307／100,000，幾乎都來自名為 `mini-taiwan-pulse-staging` 的 Worker（名稱與實際用途不符，只記錄）。不升級、不直連的決定不變。
- **LINT-1**：前端禁讀非 public schema。證據：mini #999 ESLint 規則 `pulse/no-nonpublic-schema`，現況 0 違規。
- **AG-13**：新圖層上線即入倉的守門接 CI。證據：#975（純函式與 owner-local 檢查）＋mini #999 `check:warehouse-gate`（`layer-status.csv` 的 missing 只准比 PR base 少）。

## 已關閉（2026-11-10 入口文件差異檢核）

- **CI-5**：CI 從 R2 下載測試需要的資產（健檢 D10）。證據：mini #935（`a831c33d`，CI-4 B0）新增 `assets` job 與 `npm run check:assets`（依 lock 從 R2 下載比對 sha256），隨 v2.31.2 上線；origin/develop `ci.yml` 現有 `assets` job。只核對部分檔案的缺口另開 ASSET-1。
- **MCPK-1**：MCP 搜尋排序元件失效（OpenRouter key 回 401，`pulse_find_data` 降級為 deterministic_only）。證據（主 agent 2026-11-10 驗證）：使用者申請新的 OpenRouter key（只給 Jev 用）寫入 mini `.env`（原重複兩行合成一行；analysis-prod 的 `.env` 是指向它的 symlink）；向 OpenRouter 驗證回 200；`/mcp` 重連後 `pulse_find_data` ranking 回到 `jev`、9/9 候選完成評分；模型名 `typesafe/jev-1.13` 可正常呼叫（先前降級純粹是 key 失效，不是模型改名）。pulse-host collector 用的 OpenRouter key 是另一把、未動，仍歸 SEC-6。

## 已關閉（2026-11-10 多國跨夜：附證據）

> 計畫與流水帳：`.gis-agent-system/projects/2026-11-multi-country-night/PLAN.md`。

- **KRI18N-1**：南韓 50 層＋統計的英文、日文介面只抽查，沒有逐層驗。 104 層＋統計程式檢查，補 45 個類別篩選選項英日譯名，其餘 0 缺漏（ja 未人工逐句）。證據：mini #986。
- **RV-CA-DERIVED**：加拿大失業率／勞參率／就業率統計是否該標 derived（review F036／F073 修正時發現，未確認）。 查證後不用改：pipeline 直接取 StatCan 表 98-10-0485-01 公布值，recipes `derived:false` 正確。證據：2026-11-10 多國跨夜 PLAN 第 2 項。
- **KRSTAT-1**：南韓火災、交通事故統計補每萬人比率；火災某區某年 0 件會被標成「無資料」的程式問題。 0 件寫 0（潛在 bug，正式站未發生；回歸測試覆蓋）＋每萬人火災（2021–23）／交通事故（2025）4 層。證據：analytics #338、pulse-data #91、mini #978；R2 PUBLIC_VERIFIED。分母授權（jumin.mois.go.kr）為推定（依 data.go.kr 同系列「이용허락범위 제한 없음」），使用者 2026-11-10 接受，4 層保留。
- **JPRD-2**：決定日本主要道路的收費道路要不要在地圖上另外標示。 使用者 11-09 決定維持現狀（收費只在 popup 與篩選），不新增樣式語意。
- **JPRD-1**：日本主要道路補上市町村道（2026-10-28 使用者決定先不做）。 新圖層 jpMunicipalRoads（N13 2024，2,221 萬線段，依 6 地區切檔 64–216MB、z12 起，DISPLAY_ONLY）。證據：analytics #352、mini #988；抽 3 網格 z14 總長度比 1.0000。待發版才上 R2。
- **UKLZ-1**：規劃限制區 `gbPlanningConstraints` 縮到全英（z5.5）也看得到。 實為 2026-10-31 已做（analytics 234c70d7 retile_visibility、mini #784 隨 v2.19.0）；11-10 dev 實測全英 z5.5 熱區與 z8／z10 交接正常，補 r5 測試 mini #979。
- **UKLZ-2**：森林遊憩設施 `gbForestRecreation`（2.4 萬點）與樹木保護 TPO `gbTreeProtection` 單株（26 萬點）低縮放改熱區。 同 UKLZ-1（#784 隨 v2.19.0；mini #979 補測試）。
- **RV-F068**：加拿大 PMTiles 縮放範圍的資料端問題（review F068；前端部分已在 #845 修）。 查證後不用改：24 支 ca_*.pmtiles header min/max 與前端 source 一致，minzoom ≤3 低於全覽 z3.5。
- **IEW-11**：愛爾蘭第 11、12 波與大名冊（房價 PPR、公司 CRO）。 原第 11／12 波重評皆 HOLD（理由寫在 analytics ireland PLAN）；改做 IEADD-1 6 層。證據：analytics #348／#349、mini #985、pulse-data #99（6 包已發未組裝）。
- **UKD-1**：英國第 0–12 波累積的待拍板項（配色、授權依據、大檔縮檔、主題擺放等）。 使用者 11-09 全照建議；各項決定寫進 analytics `united_kingdom_opendata/waves/PLAN.md` §3（analytics #339）。C070 洪水區端點恢復，另開 UKFLOOD-1。
- **IEADD-1**：愛爾蘭未納入項目要不要補：AED、監獄、身障照護機構、pNHA（提議中自然遺產區約 630 處）、郡議會淹水分區 A/B（5/31 郡）、GSI 地下水洪水（NC-ND）、Bord na Móna 泥炭地界（授權不明）。 使用者 11-09 選「挑可做的」：AED、監獄、pNHA、郡議會淹水分區（4/31）、GSI 地下水淹水、泥炭開採沼地上線（mini #985）；身障機構不做（無地址）、Limerick 憑證過期待重試、PPR／CRO 暫緩。
- **IEWH-1**：愛爾蘭各波圖層都沒進 MCP 分析倉庫；NC-ND（淹水、侵蝕）是否可入倉未定。 使用者 11-09 選甲（NC-ND 原樣入倉並標授權、Coillte 不入倉）；64 層入倉，R2 倉庫 latest＝20261109T171745Z。證據：MCP #105、analytics #340、pulse-data #93／#94。剩統計 5 筆隨 AG-15 合併後 `--stats-cdn` 進倉；噪音圖缺向量檔。
- **UKLZ-3**：英國高爾夫點蓋住運動場地熱區。使用者 2026-11-10 選乙「維持現狀」，不改樣式、不登記例外。
- **MC-1**：主題識別名與顯示名拆開。查證已由 mini #733（`themeKey` 改為 country:title，摺疊狀態與測試都用此鍵）隨 v2.18.0 上線；南韓、愛爾蘭的「工商登記」「廢棄物」與台灣同名主題各自獨立。2026-11-10 查證關閉。

## Feature backlog index（2026-11-09 已封存）

各功能資料夾的 `backlog.md`（含 viz-library、agent-research-workbench、general-analysis 題庫 backlog）2026-11-09 讀過後整份封存到 [`docs/archive/2026-11-09/features/`](../../docs/archive/2026-11-09/features/)，索引見 [`docs/archive/README.md`](../../docs/archive/README.md) 2026-11-09 段。仍有效的項目已搬成各主題群的 `FB-*` 列，其餘項目 2026-11-09 經使用者確認後已關閉（見「已關閉（2026-11-09 封存清單清理）」）或併入目標列。之後待辦一律寫進本檔，不再新開 feature backlog。

設計／研究型 roadmap 未封存（只把未完成項搬進本檔）：`docs/features/i18n/ROADMAP.md`、`docs/research/cctv-finetune-roadmap-2026-09-29.md`、`docs/proposal/main-site-ai-gis-roadmap-2026-09-05.md`。gis-analysis 與垃圾車兩份路線圖 2026-11-09 已封存到 `docs/archive/2026-11-09/`（原處留指標）。

## 已關閉（2026-11-09 封存清單清理：使用者確認，附證據／理由）

> 2026-11-09 feature backlog 封存時未搬成新列的清單，使用者確認：已完成、明顯過時一律關閉；已併入者記在目標列；需決定的 9 條依使用者決定處理（保留者已開成 AG-16、AG-17、EMB-3D、NEWS-3）；可查證的 13 條查完後關閉或轉列（TLD-1、DCAT-1、ARTS-CAT、WASTE-CITY、JP-TOUR-2）。原文在各封存檔。

### 已完成（115 條）

- **agri-statistics**（[原檔](../../docs/archive/2026-11-09/features/agri-statistics/backlog.md)）
  - 9 項已完成（24 層統計上線）（依據：PR #227、檔內 production 驗收證據）
- **agriculture**（[原檔](../../docs/archive/2026-11-09/features/agriculture/backlog.md)）
  - 9 項已完成（Phase 3 六層＋農企業 3 層上線）（依據：檔內 2026-07-01 用戶確認）
- **allen-coral-atlas**（[原檔](../../docs/archive/2026-11-09/features/allen-coral-atlas/backlog.md)）
  - 8 項已完成（站主限定 Range、白名單、目視）（依據：檔內勾選）
- **animal-adoption**（[原檔](../../docs/archive/2026-11-09/features/animal-adoption/backlog.md)）
  - 6 項已完成（依據：檔內勾選（mig 353–360 套用、browser 驗收））
- **aquaculture**（[原檔](../../docs/archive/2026-11-09/features/aquaculture/backlog.md)）
  - AQ-2 3.1MB aquaculture_ponds_osm.pmtiles 部署策略（git 或 S3）（依據：CI-4：deploy/public-assets.lock.json 已含 aquaculture_ponds_osm（S3／R2 正本））
  - AQ-1 初始 3 層 PR／正式站證據確認（依據：PR #64（07-12）、#77（07-20）已合，之後多次發版）
- **atlas-layers**（[原檔](../../docs/archive/2026-11-09/features/atlas-layers/backlog.md)）
  - 4 項已完成（26 層接線、PMTiles 稽核、入倉、瀏覽器驗收）（依據：檔內勾選）
- **atlas-statistics**（[原檔](../../docs/archive/2026-11-09/features/atlas-statistics/backlog.md)）
  - 66 層統計接上 Statistics（依據：檔內勾選）
- **buildings-night-lights**（[原檔](../../docs/archive/2026-11-09/features/buildings-night-lights/backlog.md)）
  - BNL-1 README 與 changelog 狀態對齊（依據：檔內：2026-10-16 盤點關閉，#78／#80（v1.10.0））
- **bus**（[原檔](../../docs/archive/2026-11-09/features/bus/backlog.md)）
  - BUS-city-enum 擴充 BusCity 與城市清單（全台擴展）（依據：src/types/index.ts BusCity 已含 22 縣市＋8 組 BusGroup）
  - 6 項已完成（progress-based 架構等）（依據：檔內 commit b3bef73、bc4b3e9）
- **business-registry-company-layers**（[原檔](../../docs/archive/2026-11-09/features/business-registry-company-layers/backlog.md)）
  - 7 項已完成（B1–B3／A4、密度層）（依據：檔內勾選）
- **business-registry-industrial-layers**（[原檔](../../docs/archive/2026-11-09/features/business-registry-industrial-layers/backlog.md)）
  - 7 項已完成（依據：檔內勾選）
- **byok-chat**（[原檔](../../docs/archive/2026-11-09/features/byok-chat/backlog.md)）
  - 5 項已完成（BC-1、P1–P2、FX）（依據：PR #51、#52）
- **chart-hover-tooltip**（[原檔](../../docs/archive/2026-11-09/features/chart-hover-tooltip/backlog.md)）
  - 31 個圖表 tooltip 已套用（依據：commit d367a42、ca60346、057b9fd、7f2b71b、a4860c5）
- **civic-facilities-layers**（[原檔](../../docs/archive/2026-11-09/features/civic-facilities-layers/backlog.md)）
  - 2 項已完成（CF-0、CF-1）（依據：PR #74）
- **common-registration-addresses**（[原檔](../../docs/archive/2026-11-09/features/common-registration-addresses/backlog.md)）
  - 3 項已完成（依據：檔內勾選）
- **coral-reef-layers**（[原檔](../../docs/archive/2026-11-09/features/coral-reef-layers/backlog.md)）
  - 4 項已完成（本地整合與驗收）（依據：檔內勾選）
- **culture-layers**（[原檔](../../docs/archive/2026-11-09/features/culture-layers/backlog.md)）
  - CU-0 首批 5 層上線確認（依據：PR #72（v1.9.0），10-16 盤點關閉）
- **data-lifecycle-lean**（[原檔](../../docs/archive/2026-11-09/features/data-lifecycle-lean/backlog.md)）
  - DL-2 新聞、YouTube、水利署線上歷史保留期限（依據：2026-11-07 保留期限拍板：news_events、yt_live_history 180 天、iot_wra 30 天，gis-platform mig 505–510 已套用）
  - DL-1 Deep Archive 還原驗證（依據：2026-09-20 cold-archive.md）
- **demographics-statistics**（[原檔](../../docs/archive/2026-11-09/features/demographics-statistics/backlog.md)）
  - 2 項已完成（R2 發布、村里層）（依據：檔內勾選）
- **embeddable-map**（[原檔](../../docs/archive/2026-11-09/features/embeddable-map/backlog.md)）
  - 3 項已完成（EM-21、EM-13、EM-17）（依據：檔內 ✅、PR #125）
  - EM-11 嵌入底圖改放 R2（依據：src/embed/basemapStyle.ts 註明正式站 VITE_EMBED_BASEMAP_URL 指向 R2；CI-4 後資料皆走 R2）
- **environment-layers**（[原檔](../../docs/archive/2026-11-09/features/environment-layers/backlog.md)）
  - 6 項已完成（9 層接線、驗收、RPI 全台版）（依據：檔內勾選）
- **environment-statistics**（[原檔](../../docs/archive/2026-11-09/features/environment-statistics/backlog.md)）
  - 9 項已完成（37 層統計接線與驗收）（依據：檔內勾選）
- **er-hospital**（[原檔](../../docs/archive/2026-11-09/features/er-hospital/backlog.md)）
  - ERCard 已完成（依據：PR #91）
- **fire-rescue**（[原檔](../../docs/archive/2026-11-09/features/fire-rescue/backlog.md)）
  - 11 項已完成（含 G36 消防栓全國化）（依據：檔內勾選、TWL-9 已關）
- **funeral-layers**（[原檔](../../docs/archive/2026-11-09/features/funeral-layers/backlog.md)）
  - FN-1、FN-0、FN-8 已完成（依據：PR #107、#110；10-16 盤點確認正式站 200）
  - FN-4 套用 gis-platform mig 335_funeral（6 表）供跨主題分析（依據：gis-platform 有 418_funeral_enable_rls.sql（對 335 建的表開 RLS），推定 335 已套用）
- **global-climate**（[原檔](../../docs/archive/2026-11-09/features/global-climate/backlog.md)）
  - 12 項已完成（GC-1–7、TY-1 等）（依據：檔內勾選；collectors PR #24／#26／#27）
- **global-events**（[原檔](../../docs/archive/2026-11-09/features/global-events/backlog.md)）
  - 14 項已完成（七天情勢、避讓、INTEL 分頁等）（依據：PR #202／#205–#208／#215／#242）
  - INTEL 全球情勢分頁 CI／正式部署（依據：PR #215 已合（09-05），之後多次發版；只有 PR 證據 → 已加入 VIS-PACK 目視清單）
- **global-maritime**（[原檔](../../docs/archive/2026-11-09/features/global-maritime/backlog.md)）
  - v3 full-fidelity 與 GFW 航跡／格網 POC 已完成 24 項（依據：檔內勾選、mig 376／377）
- **harm-reduction**（[原檔](../../docs/archive/2026-11-09/features/harm-reduction/backlog.md)）
  - 無待辦（後續在 RV-7）（依據：檔內寫明已上線、RV-7 在 BACKLOG）
- **historical-flight-trails**（[原檔](../../docs/archive/2026-11-09/features/historical-flight-trails/backlog.md)）
  - 12 項已完成（v1／v2 發布、PR #313）（依據：檔內勾選、PR #313）
- **imagery**（[原檔](../../docs/archive/2026-11-09/features/imagery/backlog.md)）
  - 4 項已完成（依據：mig 160、d85f5be）
- **isobath**（[原檔](../../docs/archive/2026-11-09/features/isobath/backlog.md)）
  - ISO-0 前端接線（依據：PR #160、#161）
- **isr-satellite-monitor**（[原檔](../../docs/archive/2026-11-09/features/isr-satellite-monitor/backlog.md)）
  - 5 項已完成（依據：PR #185–#191）
- **jp-core-layers**（[原檔](../../docs/archive/2026-11-09/features/jp-core-layers/backlog.md)）
  - 9 項已完成（Batch 1／2、PR #199／#210、人口網格上 S3）（依據：PR #199、#210）
  - 日本全資料 S3 副本（小檔依 hash 存封存位置）（依據：CI-4 後所有資料檔以 S3 為正本（public-assets.lock.json））
- **jp-height-layers**（[原檔](../../docs/archive/2026-11-09/features/jp-height-layers/backlog.md)）
  - 7 項已完成（東京 pilot 與本地驗收）（依據：檔內勾選）
- **jp-medical-static**（[原檔](../../docs/archive/2026-11-09/features/jp-medical-static/backlog.md)）
  - 2 項已完成（第一批）（依據：檔內勾選）
  - exact payload 上傳與 CDN／production readback（依據：PR #298「record production release」；只有 PR 證據 → 已加入 VIS-PACK 目視清單）
- **jp-police-facilities**（[原檔](../../docs/archive/2026-11-09/features/jp-police-facilities/backlog.md)）
  - 3 項已完成（依據：檔內勾選）
  - 正式發布：git 提交、production 資產與瀏覽器驗收（依據：mini #224「add full-density police facilities layer」已在 master）
- **jp-religion-layers**（[原檔](../../docs/archive/2026-11-09/features/jp-religion-layers/backlog.md)）
  - JPR-2 宗教三檔走獨立 S3 deploy release（依據：CI-4 後資料檔皆走 S3／R2 lock）
  - JPR-0／1／1a 已完成（依據：檔內勾選）
- **jp-tourism-protected-heritage**（[原檔](../../docs/archive/2026-11-09/features/jp-tourism-protected-heritage/backlog.md)）
  - JP-TOUR-3 鳥獸保護與 Ramsar 授權／幾何 clearance（依據：manifest 已有 jpWildlifeProtection*、jpRamsarSites；#831 上線（VP-3 待目視））
- **labor-statistics**（[原檔](../../docs/archive/2026-11-09/features/labor-statistics/backlog.md)）
  - 9 項已完成（依據：PR #384）
- **landslide**（[原檔](../../docs/archive/2026-11-09/features/landslide/backlog.md)）
  - 4 項已完成（依據：檔內勾選）
- **layer-manifest**（[原檔](../../docs/archive/2026-11-09/features/layer-manifest/backlog.md)）
  - LM-REL-1 manifest 涵蓋的 gitignored 資產實際部署與抽樣 browser（依據：CI-4：public-assets.lock.json＋check-assets 比對 R2 sha；Release-assets 已在 11-08 勾選關閉）
- **livestock**（[原檔](../../docs/archive/2026-11-09/features/livestock/backlog.md)）
  - LS-1 7 層上線確認（依據：PR #55（v1.7.0））
- **marine-observations**（[原檔](../../docs/archive/2026-11-09/features/marine-observations/backlog.md)）
  - 5 項已完成（依據：檔內勾選）
  - push／PR／merge／deploy（等授權）（依據：develop layerManifest 已有 marineObservationCwa／marineObservationIsohe；#961 已修其 7 天曲線）
- **monitor-grid-static**（[原檔](../../docs/archive/2026-11-09/features/monitor-grid-static/backlog.md)）
  - 4 項已完成（八版、九版等）（依據：PR #121）
- **monitor-split**（[原檔](../../docs/archive/2026-11-09/features/monitor-split/backlog.md)）
  - MS-1 窄版座標定稿（依據：2026-08-16 changelog 二版）
- **mountain-safety**（[原檔](../../docs/archive/2026-11-09/features/mountain-safety/backlog.md)）
  - MS-0 兩層對齊（依據：檔內勾選）
  - MS-0-RELEASE PR 與正式站證據補齊（依據：PR #99（2026-08-02）已合，之後多次發版；只有 PR 證據 → 已加入 VIS-PACK 目視清單）
- **network-structures**（[原檔](../../docs/archive/2026-11-09/features/network-structures/backlog.md)）
  - 5 項已完成（依據：PR #222）
- **news**（[原檔](../../docs/archive/2026-11-09/features/news/backlog.md)）
  - NEWS-7 補建上游 docs/handoff/news.md（依據：analytics docs/handoff/news.md 已存在）
  - collector 與分類聚合已完成（依據：mig 162–165）
- **noise-layers**（[原檔](../../docs/archive/2026-11-09/features/noise-layers/backlog.md)）
  - NOISE-3 push／PR／發布資產與前端（依據：PR #213（2026-09-03）「撿回擱置的噪音六圖層（含 S3 資產補上傳）」）
  - NOISE-0／1／2 已完成（依據：檔內勾選）
- **owner-gated-layers**（[原檔](../../docs/archive/2026-11-09/features/owner-gated-layers/backlog.md)）
  - OG-1 anon key 濫用防護（Spend Cap）（依據：BACKLOG 已關 OG-1：Spend Cap 10-17 已開）
  - OG-5（feature 版）PowerCard 匿名者看到永久 loading 假象（依據：PR #141「UNIT OUTPUT 權限狀態修復」；chart-hover backlog 記載 isAccessDenied() 已分流為 denied 並顯示「需登入後檢視」）
  - Phase 1–3 與電廠洩漏修補已完成（依據：PR #60、#62、#63；gis-platform #28／#30）
- **parking**（[原檔](../../docs/archive/2026-11-09/features/parking/backlog.md)）
  - PK-1 Batch 3 與時間軸回放上線確認（依據：10-16 盤點：develop 含 cea20cfe、a3247e08）
  - Batch 3 與回放已完成（依據：mig 288）
- **pla-activity**（[原檔](../../docs/archive/2026-11-09/features/pla-activity/backlog.md)）
  - PA-9／PA-11 已完成（依據：mig 337、PB-33）
- **property-value**（[原檔](../../docs/archive/2026-11-09/features/property-value/backlog.md)）
  - PV-1 四份 PMTiles 與 admin json 上線（依據：PR #295／#296（v1.20.0））
- **real-estate**（[原檔](../../docs/archive/2026-11-09/features/real-estate/backlog.md)）
  - RE-CustomLayer 上線確認（依據：PR #32（v1.5.0））
  - RE-2025Q4 等 2025Q4 全國鏡像後重跑（依據：src/lib/realEstateTime.ts RE_PERIODS 已含 2025Q4、2026Q1）
  - 6 圖層上線（依據：PR #31）
- **religion**（[原檔](../../docs/archive/2026-11-09/features/religion/backlog.md)）
  - RL-1 宗教 6 層上線（依據：PR #101（v1.11.0））
  - RL-2 Supabase 表補 deity_family（已作廢，表已刪）（依據：mig 510 已刪表；檔內寫作廢）
- **road-congestion**（[原檔](../../docs/archive/2026-11-09/features/road-congestion/backlog.md)）
  - RC-1 mig、PMTiles 上線（依據：gis-platform #82 mig 386）
  - v1 省道路況已完成（依據：changelog）
- **social-statistics**（[原檔](../../docs/archive/2026-11-09/features/social-statistics/backlog.md)）
  - 10 項已完成（45 層統計上線）（依據：檔內勾選）
- **static-to-cdn**（[原檔](../../docs/archive/2026-11-09/features/static-to-cdn/backlog.md)）
  - STC-1 25 個 snapshot 上線（依據：PR #54（v1.6.0））
- **statistics-comparability**（[原檔](../../docs/archive/2026-11-09/features/statistics-comparability/backlog.md)）
  - 3 項已完成（本地測試、build、browser）（依據：檔內勾選）
  - 以 receipt 重驗 preview pointer、SHA 與 loader（依據：mini #255（statistics-comparability recovery）已合併且在 master，之後多次發版）
  - release handoff（immutable 先行、current.json 後更新）（依據：同上 #255）
  - production readback、部署與實體手機證據（依據：同上 #255）
- **street_trees_taipei_diff**（[原檔](../../docs/archive/2026-11-09/features/street_trees_taipei_diff/backlog.md)）
  - STD-0 上線確認（依據：PR #65／#67（v1.8.0））
- **telecom-world-layers**（[原檔](../../docs/archive/2026-11-09/features/telecom-world-layers/backlog.md)）
  - 8 項已完成（海纜、Ookla、RIPE Atlas 等）（依據：檔內勾選）
  - Ookla 下一季前四個資產改走 S3（依據：CI-4：public-assets.lock.json 已含 ookla_*，且有帶季度檔名 ookla_fixed_global_20260930.pmtiles）
- **terrain-vector**（[原檔](../../docs/archive/2026-11-09/features/terrain-vector/backlog.md)）
  - 坡度坡向向量分級已完成（依據：changelog）
- **tourism-layers**（[原檔](../../docs/archive/2026-11-09/features/tourism-layers/backlog.md)）
  - TO-2 D 類 3 檔上傳 S3 與正式站驗證（依據：CI-4 後 public-assets.lock.json 含 public/tourism/ 12 檔、R2 sha 比對）
  - TO-1 12 層首發（依據：PR #82）
- **tourist-shuttle**（[原檔](../../docs/archive/2026-11-09/features/tourist-shuttle/backlog.md)）
  - TS-1 route JSON、mig 284 與正式站確認（依據：路線檔走 bus-gz-cache 同步家族（site_manifest.py L69／L80、pull-deploy-assets.sh L293），不在 lock 是設計如此）
  - v1 接線與驗收（依據：changelog）
- **transport-hub-display**（[原檔](../../docs/archive/2026-11-09/features/transport-hub-display/backlog.md)）
  - 2 項已完成（依據：PR #217）
  - deploy／production browser（依據：PR #217（09-05）已合，之後多次發版；只有 PR 證據 → 已加入 VIS-PACK 目視清單）
- **tree-layers**（[原檔](../../docs/archive/2026-11-09/features/tree-layers/backlog.md)）
  - TL-1 5 個大檔上傳（依據：10-16 盤點正式站 200/206）
  - TL-4、TL-0 已完成（依據：PR #83）
- **urban-form**（[原檔](../../docs/archive/2026-11-09/features/urban-form/backlog.md)）
  - UF-1、UF-3 上線（依據：PR #71（v1.9.0））
- **urban-heat-lst**（[原檔](../../docs/archive/2026-11-09/features/urban-heat-lst/backlog.md)）
  - UH-2 上傳熱島 PMTiles（依據：10-16 正式站 206）
  - UH-0／3／4 已完成（依據：changelog）
- **urban-zoning**（[原檔](../../docs/archive/2026-11-09/features/urban-zoning/backlog.md)）
  - UZ-4、UZ-0、UZ-6 已完成（依據：PR #73、#100）
- **water-resources**（[原檔](../../docs/archive/2026-11-09/features/water-resources/backlog.md)）
  - WR-1 lakesPondsOsm 上線（依據：10-16 正式站 206）
  - WR-2 11.3MB PMTiles 走 git 或 S3（依據：CI-4：lakes_ponds_osm 已在 public-assets.lock.json）
- **vessel-watch**（[原檔](../../docs/archive/2026-11-09/features/vessel-watch/backlog.md)）
  - 已完成 9 項（VW-3、VW-7、VW-8、VW-9、VZ-1–4、VZ-8、兩批 MMSI 排除）（依據：mig 361–366、PR #146、collectors 39efbcc）
- **welfare-layers**（[原檔](../../docs/archive/2026-11-09/features/welfare-layers/backlog.md)）
  - WF-1 預設開啟三層（使用者拍板不開）（依據：2026-08-13 使用者拍板維持全關）
- **agent-research-workbench**（[原檔](../../docs/archive/2026-11-09/features/agent-research-workbench/backlog.md)）
  - 約 30 項已完成（統計 adapter、空間 kernel、result collection、geocoder consent、Valhalla POC、M2 卡、Phase A／B、Codex 配對等）（依據：檔內勾選；現行 MCP 已有 pulse_isochrone、pulse_geocode_address、pulse_show_result 等工具）
- **general-analysis**（[原檔](../../docs/archive/2026-11-09/features/general-analysis/question-bank-backlog-20260927.md)）
  - ✅ 已入倉可答的題目（基礎設施周邊、淹水×房價、畜牧分佈、新聞持續性、多縣市並排等約 10 題）（依據：檔內標 ✅；10 月 Agent 改版題庫 3/20→18/20（記憶 feedback_agent_iteration_method））
- **i18n**（[原檔](../../docs/features/i18n/ROADMAP.md)）
  - P0–P5 與收尾全部完成（工具列、側欄、說明框、圖例、監測、衛星、時間軸、會員、AI 介面、站名、底圖語言）（依據：PR #576、#603–#608 等，隨 v2.9.0 上線）
- **agent-research-workbench**（[原檔](../../docs/features/agent-research-workbench/gis-analysis-roadmap.md)）
  - M3 向量與行政區交叉分析（spatial join、buffer、nearest、cluster、版本化邊界）（依據：MCP 已上線 pulse_show_nearby、pulse_region_rank、pulse_spatial_stats、pulse_cross_analysis（ADR-0022 A 10-21））
  - M7 Production 化（auth、TLS、監控、部署）（依據：research-gateway 已正式部署（SEC-7 指 gis-platform #170；VP-12 為正式站實機驗收））
- **main-site-ai-gis-roadmap-2026-09-05**（[原檔](../../docs/proposal/main-site-ai-gis-roadmap-2026-09-05.md)）
  - G0 分析語意修正（missing≠0、樣本截斷、結果契約）（依據：MCP 規則與倉庫回答格式已強制「未涵蓋不寫 0」；ADR-0022 結果契約）
  - Q1／P1 AI 結果問答與分析規劃（依據：pulse-research MCP＋pulse-conductor 分派已上線（取代 BYOK planner））
  - A2 路網可達性（版本化路網、不可達不補假結果）（依據：pulse_isochrone 上線；交通可及性模擬 v2.20.0（#801））
- **waste-collection**（[原檔](../../docs/features/waste-collection/research/roadmap.md)）
  - Phase 1 Track A：TGOS 7 天批次與 unified callback，22 縣市 stops 進 DB（依據：handoff.md：hwms 22 縣市、3,991 路線、308K unified stops 已入 waste_collection_stops）
  - Phase 3 時刻表捷運式動畫（22 縣市）（依據：wasteSchedule 圖層與 WasteScheduleScene.ts 已上線（v1 直線插值））
  - Phase 4.3 ETL UNIQUE constraint（每天少寫 5 萬重複列）（依據：handoff.md 記載 migration 458 與 collectors #148 去重）

### 明顯過時（100 條）

- **agriculture**（[原檔](../../docs/archive/2026-11-09/features/agriculture/backlog.md)）
  - 農企業 GeoJSON 座標精度與冗欄位太大，等上游出瘦身版（依據：農企業層已改站主資料（OWD／WA-1 已關），上游瘦身前提不存在）
  - 3 個農企業 GeoJSON 約 34MB 在 style.load 一次載入，超過門檻才評估 lazy load（依據：同上，農企業層已改站主資料，不再隨首屏載入 34MB）
- **atlas-layers**（[原檔](../../docs/archive/2026-11-09/features/atlas-layers/backlog.md)）
  - 疏濬工程低精度座標改空心符號（依據：目前已用 popup 標示，效益小）
- **atlas-statistics**（[原檔](../../docs/archive/2026-11-09/features/atlas-statistics/backlog.md)）
  - 電子發票行業門檻待月份多了再調（依據：條件觸發、無期限，效益小）
- **bloom-experiments**（[原檔](../../docs/archive/2026-11-09/features/bloom-experiments/backlog.md)）
  - BE-6 bloom 改重 RPC 時補 loading task（依據：條件觸發（目前輕量不需要），規則已由 lint pulse/loader-rpc-with-loading 守）
- **buildings-night-lights**（[原檔](../../docs/archive/2026-11-09/features/buildings-night-lights/backlog.md)）
  - BNL-2 同一 GL context 同時跑兩個 Three.js bloom scene（依據：觸發條件（產品要同時顯示）未出現）
- **bus**（[原檔](../../docs/archive/2026-11-09/features/bus/backlog.md)）
  - BUS-lazy-load-routes 路線 JSON 依城市 lazy load（依據：公車全台已上線多月，沒有效能問題回報；屬無觸發條件的優化）
  - BUS-max-instances 是否升到 1–2 萬（依據：同上）
  - BUS-city-filter-progress ensureProgressPaths 加城市過濾（依據：同上）
  - BUS-preprocess-script 建 build_bus_routes.py（依據：scripts 無此檔，但全台擴展已用別的路徑完成）
- **business-registry-company-layers**（[原檔](../../docs/archive/2026-11-09/features/business-registry-company-layers/backlog.md)）
  - BR-C-202609 202609 新版資料到位時換檔名不覆寫（依據：新版資料到位改由每週更新清單（ADR-0024）偵測提醒）
- **byok-chat**（[原檔](../../docs/archive/2026-11-09/features/byok-chat/backlog.md)）
  - BC-6 Anthropic 進階檔開 extended thinking（依據：條件觸發、無需求）
  - BC-7 Phase 4：站方付費額度／pin 到 Monitor／tool 目錄改 manifest（依據：AR-43、AR-44 已在 BACKLOG 關閉（被 MCP 取代／無需求））
- **chart-hover-tooltip**（[原檔](../../docs/archive/2026-11-09/features/chart-hover-tooltip/backlog.md)）
  - 靠近上緣往下翻的 tooltip 只有單元測試、沒瀏覽器驗證（依據：檔內自評架構風險低，只是記錄）
  - TimelineDock 新聞密度柱刻意不改（依據：明確不做）
- **civic-facilities-layers**（[原檔](../../docs/archive/2026-11-09/features/civic-facilities-layers/backlog.md)）
  - CF-5 iPostBoxes payment_method 空值（產品要顯示才處理）（依據：觸發條件無人提出，效益小）
- **common-registration-addresses**（[原檔](../../docs/archive/2026-11-09/features/common-registration-addresses/backlog.md)）
  - BR-B4-NEXT 202609 新檔到位換檔名（依據：同上，由每週更新清單偵測）
- **culture-layers**（[原檔](../../docs/archive/2026-11-09/features/culture-layers/backlog.md)）
  - CU-3 arts_events 每月整檔更新 SOP（依據：arts_events 已轉站主資料＋CI-4 移出 git，「替換 public/culture」流程已不適用）
  - CU-4 venue 粒度與空白變體由上游改善（依據：P3、無進展）
- **earthquake-replay**（[原檔](../../docs/archive/2026-11-09/features/earthquake-replay/backlog.md)）
  - EQ-3 沙灘球鋸齒改 SVG path（依據：純美觀，無人反映）
  - EQ-4 town_intensity autovacuum 觀察（依據：檔內寫無需動作、僅記錄）
- **education-layers**（[原檔](../../docs/archive/2026-11-09/features/education-layers/backlog.md)）
  - EDU-14 補習班取消抽稀（使用者已拍板維持）（依據：使用者 08-09 已拍板維持抽稀）
- **embeddable-map**（[原檔](../../docs/archive/2026-11-09/features/embeddable-map/backlog.md)）
  - EM-07 facade 模式（先縮圖再載入）（依據：檔內降級為純效能優化）
  - EM-22 popup 欄位標籤擴充（依據：小、無需求）
- **environment-layers**（[原檔](../../docs/archive/2026-11-09/features/environment-layers/backlog.md)）
  - commit 時正式 git add river_rpi_segments.geojson（依據：CI-4 已把 public 資料檔移出 git，題目消失）
  - Zeabur collector 啟用後再看即時 4 層（依據：收集器已搬 pulse-host，Zeabur 前提不存在；如需目視併 VIS-PACK）
  - 輻射 ≥0.2 紅框非官方分級，要對齊需上游門檻（依據：目前已標為提示性質）
  - cmux 背景 surface 無法跑 Mapbox（驗收注意事項）（依據：不是待辦，是操作注意）
- **environment-statistics**（[原檔](../../docs/archive/2026-11-09/features/environment-statistics/backlog.md)）
  - 環境 catalog 約 211KB 在首屏共享 chunk，需要時走家族 lazy details（依據：2026-11-08 使用者決定首屏維持現狀（HOME-1／PERF-1 已關））
  - 四個 GeoJSON 正式 git add（依據：CI-4 已把資料檔移出 git）
- **er-hospital**（[原檔](../../docs/archive/2026-11-09/features/er-hospital/backlog.md)）
  - ER-3 急救責任醫院名單變動時核對命中率（依據：條件觸發、非 release gate）
- **fire-rescue**（[原檔](../../docs/archive/2026-11-09/features/fire-rescue/backlog.md)）
  - FR-adr-blaze-removal 補 ADR 記錄火焰特效移除（依據：過小，backlog 內已有記錄）
  - FR-station-csv-schema 兩份消防站 CSV 欄位順序不同（依據：消防圖層已全國化（TWL-9 已關），CSV 欄位順序屬上游小問題）
- **global-climate**（[原檔](../../docs/archive/2026-11-09/features/global-climate/backlog.md)）
  - GC-7b CAMS bbox 擴域（依據：觸發條件（使用者要全球覆蓋）未出現）
  - GC-11 海流 × 船舶軌跡疊圖分析（依據：構想、無需求）
- **global-maritime**（[原檔](../../docs/archive/2026-11-09/features/global-maritime/backlog.md)）
  - 下一次 probe metadata 加入完整 wall time（依據：GFW 收集等授權停用（GFW-1））
- **imagery**（[原檔](../../docs/archive/2026-11-09/features/imagery/backlog.md)）
  - IMG-upstream-handoff 上游 imagery handoff 補前端 loader／hook 清單（依據：文件小項；#871 影像改讀 R2 manifest 後原檔名清單已過時）
- **jma-live-layers**（[原檔](../../docs/archive/2026-11-09/features/jma-live-layers/backlog.md)）
  - JMA-9 雲圖在亮色底圖可讀（依據：「需要的話」，無人提）
  - JMA-13 分析圖點擊讀值（依據：P3 機會型）
  - JMA-11 雪覆蓋多日合成（依據：P3 需要時再做）
  - JMA-16 梅雨地方界線精修（依據：P3 需要時）
  - JMA-6 積雪深點擊讀值（依據：P3，列 NO_POPUP ledger）
- **jp-core-layers**（[原檔](../../docs/archive/2026-11-09/features/jp-core-layers/backlog.md)）
  - 上游兩支 _manifest.json 已改未提交（patch 在舊 scratchpad）（依據：舊 session scratchpad 多半已消失；上游檔需另查）
  - 上游 handoff／catalog 反向引用本 feature 資料夾（依據：過小文件連結）
  - 鐵道加線寬滑桿（依據：小 UX，無人提）
  - auto-flyTo JAPAN_CAMERA 座標微調含沖繩（依據：10-28 國家主體化後改用國家全覽視角（z5））
  - Locations 面板加「日本」跳點（依據：國家選單（v2.16.0）已取代）
  - 上游 handoff 3.1 節學校切片配方（-Z4 -z14 會產 54MB）更正（依據：只在舊 codex 分支的上游文件更正，日本學校層已上線）
- **jp-medical-static**（[原檔](../../docs/archive/2026-11-09/features/jp-medical-static/backlog.md)）
  - 延期：疫情、collector、排程（依據：檔內標延期）
- **jp-water**（[原檔](../../docs/archive/2026-11-09/features/jp-water/backlog.md)）
  - JPW-1 上游提供 release.json 與 asset SHA（依據：jpWater 已改站主限定私人資料（#458），release.json 前提不適用）
  - JPW-3 橫濱水位站接觀測序列（依據：P2 條件型，無需求）
- **layer-manifest**（[原檔](../../docs/archive/2026-11-09/features/layer-manifest/backlog.md)）
  - LM-SPEC-1 拆 layerParamsSpec.ts 上半段型別與 builder（依據：G008 已關（無具體痛點不拆大檔））
- **livestock**（[原檔](../../docs/archive/2026-11-09/features/livestock/backlog.md)）
  - LS-3 低精度 769 場視覺處理再評估（依據：P3、無人提）
- **monitor-grid-static**（[原檔](../../docs/archive/2026-11-09/features/monitor-grid-static/backlog.md)）
  - MG-1 沙盒模擬流式高度（依據：觸發條件未出現）
  - MG-2 alertBoard +5px、situationOverview +11px 微幅溢出（依據：檔內寫只在影響閱讀時才追）
  - MG-3 偶發 1 failed／440 測試（依據：之後全綠；CI 已重構（#899 等））
- **monitor-split**（[原檔](../../docs/archive/2026-11-09/features/monitor-split/backlog.md)）
  - MS-9 split 在 1440 以下退化成單欄（刻意不修）（依據：檔內寫刻意不修，使用者沙盒定稿）
  - MS-11 dock 版災害四卡比照 split 拆列（依據：dock 非主要模式，純美觀）
  - MS-10 layersWidth 目前是 no-op（依據：檔內註明不是 bug）
  - MS-8 沙盒寫入 5 個 widget 實測最小高度並警告（依據：與 MG-1 同類，觸發條件未出現）
  - MS-4 mapPaddingRight 觀察後移除（依據：小清理）
  - MS-6 兩份沙盒維護成本重估（依據：檔內判斷維持現狀）
- **news**（[原檔](../../docs/archive/2026-11-09/features/news/backlog.md)）
  - NEWS-4 sidebar「臺灣即時新聞」清單（依據：#215 INTEL 分頁已提供新聞清單）
- **owner-gated-layers**（[原檔](../../docs/archive/2026-11-09/features/owner-gated-layers/backlog.md)）
  - OG-3 第一個 ui 鎖圖層出現時驗收鎖頭→登入即開（依據：條件觸發，目前無 ui 鎖圖層）
  - OG-4（feature 版）powerPlants 總圖恢復給站主（依據：觸發條件未出現；站主改走 facPrimary 與站主資料（OWD））
- **pla-activity**（[原檔](../../docs/archive/2026-11-09/features/pla-activity/backlog.md)）
  - PA-4 794×1115 版型 3 張配準失敗（依據：檔內寫樣本變多才處理）
  - PA-6 回放速度、暫停與拖曳（依據：檔內「夠用」）
  - PA-8 日期正則寫死 0600、未偵獲時共艦未記 0（使用者決定先不改）（依據：使用者 08-03 已決定不改）
- **real-estate**（[原檔](../../docs/archive/2026-11-09/features/real-estate/backlog.md)）
  - RE-ADR-CustomLayer 補 ADR：放棄點層 hover 換效能（依據：過小文件項）
- **religion**（[原檔](../../docs/archive/2026-11-09/features/religion/backlog.md)）
  - RL-4 「其他神祇」4,276 筆是否細分（依據：等使用回饋，無人提）
- **static-to-cdn**（[原檔](../../docs/archive/2026-11-09/features/static-to-cdn/backlog.md)）
  - STC-2 /static-rpc/ 建 Cloudflare cache rule（依據：主站已改 Workers＋R2（ZB-4、#918 static-rpc 改 CDN），舊 nginx 路徑前提不存在）
- **street_trees_taipei_diff**（[原檔](../../docs/archive/2026-11-09/features/street_trees_taipei_diff/backlog.md)）
  - STD-2 多個 Wayback 基準快照（依據：條件觸發、無需求）
- **telecom-world-layers**（[原檔](../../docs/archive/2026-11-09/features/telecom-world-layers/backlog.md)）
  - 更完整海纜幾何需可合法再散布來源（依據：無來源、無需求）
  - Ookla 兩套配色預設值待實際使用後確認（依據：過小）
- **terrain-vector**（[原檔](../../docs/archive/2026-11-09/features/terrain-vector/backlog.md)）
  - TV-1 是否套用 mig 289_h3_terrain（56,376 cells）（依據：ADR-0026：不會變的資料不進 Supabase，應走 PMTiles／R2；原案前提已被取代）
  - TV-3 AOI 地形統計前端入口（依據：觸發需求未出現；GUI-4 範圍圈選涵蓋類似需求）
- **tourist-shuttle**（[原檔](../../docs/archive/2026-11-09/features/tourist-shuttle/backlog.md)）
  - TS-3 sub-route 級精準幾何（依據：需先驗 TDX 是否提供，無需求）
  - TS-4 upstreamRegistry 沿用 bus_realtime id 是否合理（依據：觸發條件未出現）
- **transport-hub-display**（[原檔](../../docs/archive/2026-11-09/features/transport-hub-display/backlog.md)）
  - 取得捷運站體範圍才開 Polygon 模式（依據：條件觸發）
- **tree-layers**（[原檔](../../docs/archive/2026-11-09/features/tree-layers/backlog.md)）
  - TL-5 全國行道樹上游瘦身（去 lat/lon 冗欄）（依據：條件觸發、效益未量化）
- **urban-heat-lst**（[原檔](../../docs/archive/2026-11-09/features/urban-heat-lst/backlog.md)）
  - UH-A 維持不做 popup ΔT（除非有需求）（依據：決策紀錄、不是待辦）
- **vessel-watch**（[原檔](../../docs/archive/2026-11-09/features/vessel-watch/backlog.md)）
  - VW-1 回補 2026-02-03～02-27 S3 逐檔版面（依據：vessel_watch_positions 2026-11-07 起保留 180 天，2 月資料回補後會被清；S3 正本已永久保存（比照 TD-1 不回補））
  - VZ-7（選）進出事件表與事件列表（依據：檔內標「選」）
  - VW-4 週掃排程化（使用者刻意手動）（依據：使用者先前已決定維持手動週掃）
- **viz-library**（[原檔](../../docs/archive/2026-11-09/features/viz-library/BACKLOG.md)）
  - 5 倉庫長期存放 Google geocode 座標是否違反條款（依據：2026-10-09 授權政策：Google 座標維持不標注，同類意見判 NA）
  - 6 allDescriptors() 無快取（依據：檔內寫目前無可感延遲）
- **welfare-layers**（[原檔](../../docs/archive/2026-11-09/features/welfare-layers/backlog.md)）
  - WF-9 社福 9 張 Supabase reference 表 migration（依據：ADR-0026：不會變的資料不進 Supabase；跨主題分析改走 MCP 倉庫）
  - WF-13 BYOK DATASET_WHITELIST 未加社福 9 層（依據：BYOK 資料問答已由 pulse-research MCP 倉庫取代（AR-43 已關））
- **agent-research-workbench**（[原檔](../../docs/archive/2026-11-09/features/agent-research-workbench/backlog.md)）
  - 正式服務拓樸 5 項（同源 /api/research/v1、Gateway sidecar、MCP stdio、state store、分項驗收）（依據：research-gateway 已部署（SEC-7 提 gis-platform #170）、MCP 已日常使用；VP-12 等正式站實機驗收另列）
  - 地址作為探索起點 4 項（共用流程、新 command 同步檢查、排查順序、未註冊資料說明）（依據：pulse_geocode_address＋pulse_show_nearby 已上線，pulse-conductor skill 已固定流程）
  - 09-14 增量 4 項（新 grid 配對 mobile、第二個 library asset、network 證據、學區與實價資料）（依據：Research Library 路線已被 MCP 倉庫（ADR-0022／0023）取代）
  - Implementation backlog 11 項（holes geometry、正式 HTTPS 部署、桌面 MCP 日常、本地快取、共用 catalog、估價、私有 artifact、S3-only 等）（依據：原 workbench 規劃；正式部署已透過 research-gateway 完成，其餘被倉庫組裝（ADR-0023）取代）
- **general-analysis**（[原檔](../../docs/archive/2026-11-09/features/general-analysis/question-bank-backlog-20260927.md)）
  - Jev 路由器 pulse_route_request 寫入題型、路由正確率 ≥80%（依據：現行 MCP 工具無 pulse_route_request，改由 pulse-conductor skill 分派）
- **i18n**（[原檔](../../docs/features/i18n/ROADMAP.md)）
  - 「其他」603 行歸類後分到各階段（依據：近似指標，非具體待辦）
  - 後台 29 行不翻、新聞警報內文不翻（依據：使用者已決定不翻）
- **agent-research-workbench**（[原檔](../../docs/features/agent-research-workbench/gis-analysis-roadmap.md)）
  - M1 三類 pilot：新聞非空樣本、統計 boundary join、醫院資產證據（依據：統計已接行政界（ARW backlog 勾選），MCP 倉庫已涵蓋新聞；09-15 後文件未更新）
- **cctv-finetune-roadmap-2026-09-29**（[原檔](../../docs/research/cctv-finetune-roadmap-2026-09-29.md)）
  - 台北監視器擋國外 IP 的收集方案（VPN 或台灣雲端）（依據：使用者已回台，10-21 收集結束）
- **main-site-ai-gis-roadmap-2026-09-05**（[原檔](../../docs/proposal/main-site-ai-gis-roadmap-2026-09-05.md)）
  - M1 手機 App 封裝（依據：未見任何進展，北極星未列 App）
- **waste-collection**（[原檔](../../docs/features/waste-collection/research/roadmap.md)）
  - Phase 1B.2／1B.3 新北台南 OSRM 收尾、高雄 5/9 落差查證（BL-9、BL-14）（依據：5 月舊項；OSRM map-matching 已上線（waste_trails_matched_daily））
  - 待拍板 Q1–Q4（callback 誰寫、視覺選項、台中 GPS、TGOS 節奏）（依據：Q1、Q2、Q4 已因實作完成而失效；Q3 併入 1B.1）

### 使用者決定關閉（6 條）

- **bloom-experiments**（[原檔](../../docs/archive/2026-11-09/features/bloom-experiments/backlog.md)）
  - BE-7 真 UnrealBloomPass（風險大、投報低）（C：使用者 2026-11-09 決定關閉（風險大、效果不確定））
- **funeral-layers**（[原檔](../../docs/archive/2026-11-09/features/funeral-layers/backlog.md)）
  - FN-7 OSM 與都計墓地差集分析（F：使用者 2026-11-09 決定關閉）
- **tourism-layers**（[原檔](../../docs/archive/2026-11-09/features/tourism-layers/backlog.md)）
  - TO-4 交互分析候選（民宿聚落×吸引核等）（G：使用者 2026-11-09 決定關閉（需要時由 Agent 分析現做））
- **cctv-finetune-roadmap-2026-09-29**（[原檔](../../docs/research/cctv-finetune-roadmap-2026-09-29.md)）
  - 目標 2 衛星圖＋道路模型、目標 3 整合還原路口（I：使用者 2026-11-09 關閉勾選項；目標 2、3 保留在 cctv roadmap（保留中的長期目標，非放棄），N 群留指標）
  - 緊急車輛每類 100 個以上後做裁切分類器（I：同上（緊急車輛裁切分類器保留在 roadmap §10.5））
- **main-site-ai-gis-roadmap-2026-09-05**（[原檔](../../docs/proposal/main-site-ai-gis-roadmap-2026-09-05.md)）
  - E1 情報事件↔周邊分析↔Monitor 卡（H：使用者 2026-11-09 決定關閉（情報牆暫停））

### 查證後關閉（4 條）

- **jma-live-layers**（[原檔](../../docs/archive/2026-11-09/features/jma-live-layers/backlog.md)）
  - JMA-4 解析積雪深以真實發布幀播放（查證 2026-11-09：manifest `jmaSnowDepth` 已改讀發布幀（RPC get_weather_imagery_manifest → R2 PNG，#871）；正式站是否有實幀播放未目視）
  - JMA-7 其餘發布幀產品以真實資料驗證（同 P-101 查證）
- **tree-layers**（[原檔](../../docs/archive/2026-11-09/features/tree-layers/backlog.md)）
  - TL-2 上游補 7 個 dataset catalog（目前 catalog_missing）（查證 2026-11-09：行道樹 7 層（streetTreesNational、streetTreesTaipei3epoch、streetTreesTaipeiDiff、protectedTreesNational、riversideTreesTaipei、treePitsTaipei 等）manifest upstream 皆已 verified）
- **main-site-ai-gis-roadmap-2026-09-05**（[原檔](../../docs/proposal/main-site-ai-gis-roadmap-2026-09-05.md)）
  - S1 共用圖層搜尋（manifest 派生索引、alias）（查證 2026-11-09：側欄 LayersPanel、站內 AI catalogTools 與 MCP 經 MainMapConnection→discovery.ts 都用 `src/lib/layerSearch` 同一索引）

### 已併入（目標列已關閉）（1 條）

- **isr-satellite-monitor**（[原檔](../../docs/archive/2026-11-09/features/isr-satellite-monitor/backlog.md)）
  - ISR-MON-5 ISR collector 在 collector_status 無專屬列（已併入 DIO-4，DIO-4 已關閉）

## 已關閉（2026-11-08 單一入口整理：已完成，附證據）

- **CI-2**：清理「讀 src 原始碼再 regex 比對」的測試（2026-11-08，PR #904）。 已完成：loading（改規則 `pulse/loader-rpc-with-loading`）、mapReadyTick（改行為測試）、dayPrefetch 原始碼那條（刪）、layerConsistency 鐵則 4（規則 `pulse/sidebar-shared-param-controls`＋行為測試）、monitorResourceCards（改行為測試）；補漏 card、privacy、seo（改 ESLint 內建規則）。保留並附理由：hookLineFill、hookPoint、r5Heatmap、mobileTimelineTheme、mapContextCountry、warehouseResultRestore、LayerSidebar。待拍板：energyLoader `_l1Cached` 的 `has_realtime` RPC 沒包 withLoading（舊測試因 ±10 行誤放行），暫列 `LOADER_RPC_EXEMPT`。 驗收：#904 合併；energyLoader 空窗有決定。[docs/ci.md](../../docs/ci.md) §6。 **健檢證據（2026-11-08）**：#904
- **CI-4**：public/ 所有資料檔移出 git（2026-11-08 完成：611 檔 1.75GB → 69 檔網站素材約 24MB） B0–B4＋收尾：#935／#936／#937／#940＋res7，隨 v2.31.2、v2.31.3 上線；R2 整檔核對 529/529、正式站 43 資料夾抽查皆 206 自 R2。新增資料檔：上傳 S3＋lock add，不 commit 驗收：[計畫](../../docs/features/public-assets-r2/PLAN.md)、[逐檔清單](../../docs/features/public-assets-r2/inventory.tsv)。 **健檢證據（2026-11-08）**：#909（v2.28.0）、#935／#936／#937／#940（v2.31.2、v2.31.3）
- **CI-1**：本機與 CI 分工（2026-11-08 使用者決定：本機 `npm run verify`，全套交給 CI）。 已隨 PR #899 改 CLAUDE.md §1、development-rules §6、git-workflow 第 4 步。 驗收：[docs/ci.md](../../docs/ci.md) §5。 **健檢證據（2026-11-08）**：#899
- **CI-3**：deploy-workers 的 build-deploy 不等 S3→R2 同步（2026-11-08 使用者同意，接受新資產晚幾分鐘到的 404 空窗）。 已隨 PR #899 移除 `needs: sync-assets`；下次發版看 build-deploy 是否與 sync 同時開始。 驗收：[docs/ci.md](../../docs/ci.md) §8。 **健檢證據（2026-11-08）**：#899
- **TWL-3**：測速照相 popup 標題依類型顯示。 闖紅燈、平交道共 16 點的 popup 標題顯示成泛稱「測速照相」（#736 前就存在的舊 bug）。First action: 查 speedCamera popup 的標題欄位對應。 驗收：這 16 點標題顯示正確類型；其他點不變。 **健檢證據（2026-11-08）**：commit 89571efc（2026-11-06）fix(speed-camera) 已在 develop＝master
- **PERF-2**：啟用 brotli（現在只有 gzip）。 nginx 加 brotli 模組，或讓 Cloudflare 邊緣壓縮；先查 CF 設定。 驗收：回應帶 `Content-Encoding: br`。 **健檢證據（2026-11-08）**：2026-11-08 curl main-*.js 回 content-encoding: br（Cloudflare）
- **WA-1**：Remove the dangling `fallbackUrl` on the owner-gated agriculture layers. 8 manifest entries still declare them (2026-10-05): 7 `livestockFarms` sub-layers → `./agriculture/livestock_farms.geojson` and `slaughterhouses` → `./agriculture/slaughterhouses.geojson` (`src/data/layerManifest.ts` ~9195-9363). Those files are deliberately excluded from the CDN by `scripts/deploy/pull-deploy-assets.sh:67-74`; prod HEAD returns 404 for both, so an RPC permission failure falls back to a 404. 驗收：All entries either drop `fallbackUrl` or point at `_empty.geojson`; `probe_layers` reports 0 unexpected 404s. **健檢證據（2026-11-08）**：11-08 layerManifest.ts 無 livestock_farms/slaughterhouses.geojson（畜牧改 owner-data #911）
- **TWL-8**：G35 文化、觀光、原民與人口補強。 2026-10-31 #772 合進 develop（748c49ca，analytics #265）：`tourServiceSites` 797、`tourVisitorStats` 270（98 筆對不到點位）、`indigenousRegions` 55、`indigenousLanguageDialects` 59、`hakkaCulturalZones` 70、`tourHeritage` 擴到 7 類 3,013、`medClinic` 加設施類型篩選（衛生所 407）。村里教育程度只做到 analytics 與 recipe 草稿 → TWL-15。未發版。 驗收：已合 develop、CI 綠；合併後目視見 TWL-15。[G35](../../../.gis-agent-system/roadmap/candidates/G35-culture-tourism-indigenous-fill.md) **健檢證據（2026-11-08）**：#772（v2.19.0）
- **TWL-9**：G36 消防、民防、災害範圍與 2025 全國 A1／A2 交通事故點位。 2026-10-31 #771 合進 develop（7111951d）：`trafficAccidents2025` 321,534 點（執法治安 › 交通事故，既有 4 層同群組）、`fireHydrants` 擴到全國 211,530 點、`disasterResourceSites` 5,379、`tsunamiSirens` 376、`nuclearEpzEvacuation`、`firingNoticeAreas`（94＋93，修正一筆經度 +10° 錯誤、刪電話）。地質敏感區 27744（RAR）、暴潮線 158145（GeoTIFF）跳過 → TWL-15。未發版；發版日 S3 見 TWL-15。 驗收：已合 develop、CI 綠；FR-hydrants-expand 已關。[G36](../../../.gis-agent-system/roadmap/candidates/G36-fire-civil-defense-traffic-accidents.md) **健檢證據（2026-11-08）**：#771 v2.19.0
- **TWL-11**：主題分配確定項（2026-10-31 盤點 routeC）。 2026-10-31 #777 合進 develop：刪死主題名「治安與交通」「行政區參考」；兩個農業統計合併（只動 `statsRiceHarvest`）；4 個 Glow 視覺實驗層改走 `localResearchGroup`（只在本機 DEV 顯示、key 保留）；海洋、農業各自在主題內新增「自然保育」群組；交通 › 道路設施、水資源 › 海象觀測／水利設施、林業 › 樹冠群組歸位；en／ja 補約 80 個主題與群組名並加 `sectionTitleCoverage` 測試；刪孤兒檔 `exclusive_fishery_rights.geojson`。中英日側欄已用瀏覽器目視。未發版；MCP datasetLabels 重產見 TWL-15。 驗收：已合 develop、CI 綠。[報告](../../../.gis-agent-system/roadmap/scout/2026-10-31-tw-gap/routeC_theme_allocation.md) **健檢證據（2026-11-08）**：#777 v2.19.0
- **KRREL-1**：南韓＋圖層可見性整修（#769／#773–#775、#779–#788）整批發版到正式站。 2026-11-01 v2.19.0 上線（#790、#792 merge `3110ba9c`，tag＋Release；範圍外 #766／#770／#771／#772／#777／#791 經使用者同意一起發）。S3 deploy-assets 256 檔已上傳。 驗收：已驗：`main-*.js` 含 2.19.0；8 支大檔 206；四國全國視角截圖；提示卡、點面切換、類別篩選、消防栓彈窗實測通過；console 無新錯誤。 **健檢證據（2026-11-08）**：v2.19.0
- **OG-6**：清掉 `urlState.parseLayers` 寫死排除 allenCoralAtlas 的那行。 2026-11-06 #842 完成；`buildUrl` 的同名排除保留（buildUrl 不套 GATED_LAYERS，刪了分享網址會帶出該層）。 驗收：urlState 測試綠、行為不變。 **健檢證據（2026-11-08）**：#842
- **EA-2**：EA 座標錯誤修正。 2026-11-06 完成（analytics #299、gis-platform #203 mig 501 已套用、mini #839）：實際 8 筆（原 4 筆＋4 筆落海被舊 pipeline 靜默丟掉），錯在來源 xlsx，改放 ONSPD 郵遞區號中心並以 `coord_source` 標記；DB 2,544 筆全在英格蘭。pipeline 不再把含 EA 的 PMTiles 複製到 mini `public/world/`。 驗收：DB 2,544、圖例同步。 **健檢證據（2026-11-08）**：analytics #299 等
- **LIC-1**：自己托管的 CC BY-NC（非商用）檔案規則。 2026-11-06 使用者拍板：公開上線＋圖例／popup 標示「CC BY-NC・非商業使用」與署名（網站不營利）；外部圖磚照個案，古地圖維持站主限定。規則寫進 analytics skill `pulse-layer-release/references/license-and-deploy.md`。 驗收：規則已寫入 skill。 **健檢證據（2026-11-08）**：skill 已寫
- **N3-1**：夜間批次資料限制。 2026-11-06（#842、analytics #300）：日本 DID z5 已改清楚（填色不透明度隨縮放）。加拿大「398 格在美國」複核為 Natural Earth 1:10M 國界誤差，實際只有 16 格（約 380 人）在原始省界外、多在界河湖岸；2026-11-06 使用者決定加拿大網格不裁切（16 格約 380 人在省界外），維持現檔。南韓墓地：data.go.kr 查無有座標的全國墓地官方資料（추모공원 15114135 只收追悼公園），維持 OSM。 驗收：全部已結。
- **N3-2**：日本 C083 交通事故。 2026-11-06 上 develop（mini #843、analytics #301、pulse-data #61）：`jpTrafficAccidents2025` 警察庁 2025 本票 287,020 點（死亡 2,495），`jp_traffic_accidents_2025.pmtiles` 28.9MB 已上 S3。未做：warehouse 入倉、2019–2024 年度。 驗收：隨 v2.25.0 發布（`git tag --contains` 181c3cb6，2026-11-07 查）。 **健檢證據（2026-11-08）**：v2.25.0
- **N3-3**：加拿大即時地震 FDSN。 2026-11-06 使用者選照 NRCan 站條款（非商業、需署名）上線：`caEarthquakesLive` 瀏覽器直連 FDSN 近 30 天、每 5 分鐘更新（mini #847、pulse-data #62 `ca_earthquakes_fdsn`），圖例／popup／右下來源三處署名與非背書聲明。 驗收：隨 v2.25.0 發布（71007555）；四類分色 #864 在 develop 未發版（2026-11-07 查）。 **健檢證據（2026-11-08）**：v2.25.0；#864 已在 v2.26.0
- **GP-502**：套用 gis-platform mig 502（#202／#204）：收回 `cloud_agent_ro` 對英國 EA 污染名錄表與 `get_gb_ea_pollution_inventory()` 的讀取與執行權。 2026-11-07 已套用正式 DB：套用前唯讀查證 cloud_agent_ro 可讀表（2,544 筆）、可執行函式；套用後 `502_…test.psql` 回 `502 OK`。回滾指令在 migration 檔頭。 驗收：`cloud_agent_ro` 讀表、執行函式皆被拒；service_role 仍可讀；anon／authenticated 仍無表權限。 **健檢證據（2026-11-08）**：11-07
- **OWD-1**：發版後步驟：coral-private 改回 `:latest`（2026-11-08）。 已完成：主 agent 於 v2.29.0（含 #917）發布後把主機 `CORAL_PRIVATE_TAG` 改回 `latest` 並重啟 coral-private。 驗收：容器跑的是 GHCR `:latest`；未登入 `/api/private-research/owner-data/*` 仍 401（2026-11-08 複驗 401）。 **健檢證據（2026-11-08）**：HANDOFF ✅
- **OWD-2**：站主資料第 2 批正式站驗收（2026-11-08）。 已完成：使用者 2026-11-08 於正式站 v2.29.0 用站主帳號驗收第 1、2 批（畜牧、能源與石化）沒問題。 驗收：使用者確認。 **健檢證據（2026-11-08）**：使用者確認
- **OWD-3**：撤除畜牧 2 支、能源 12 支 owner-only RPC（2026-11-08）。 已完成：gis-platform #215（mig 514 畜牧、515 能源與石化，各附 test.psql）＋#216（515 test 字串修正），已套用正式庫；14 支函式已不存在，`gated_layers` 61 列保留、對應 32 列 `rpc_name` 清空，底層表保留，`get_gas_station_layers` 等保留 RPC 仍在。套用前後證據：五個 repo 無程式呼叫；正式站 v2.29.0 bundle 約 450 支 JS 只剩說明文字提及（manifest note、資料集語意），無 `rpc(` 呼叫；DB 無依賴、`access_audit_log` 最後呼叫 2026-11-06。回滾：gis-platform `scripts/rollback_515_owner_data_energy_drop_rpc.sql`（畜牧依 mig 275／276／317 重建）。worktree 已清。 驗收：14 支 RPC 已撤；owner-data 未登入仍 401。 **健檢證據（2026-11-08）**：gp #215 MERGED 11-08
- **CI-SYNC-1**：sync-rotating（氣候、GFW 輪替每小時同步）11-06 起失敗的修復。證據：mini #945、#946 合併，2026-11-08 補同步成功。
- **MCP-SEC-1**：mini-pulse-gis-mcp 套件漏洞修補。證據：mini-pulse-gis-mcp #101 合併，本機正式版已切 `012ab13`；剩餘 dev 依賴轉 MCP-1。

## 已關閉（2026-11-09 白天：已完成，附證據）

- **ALERT-1（主體）**：告警重整。證據：collectors #185（分級）、#187（日報誤報修正、中文 label、排除停用／事件型／非當季）、#188（太久沒新資料才發 🔴、恢復 ✅）、#189（停更檢查零 DB 讀取、資料庫連不上告警）；healthchecks.io 死人開關 3 個皆設好（主機 `HC_PING_URL`、`HC_BACKUP_PING_URL`、collector `HC_DAILY_REPORT_PING_URL`）；GitHub 排程失敗通知 mini #950、gis-platform #218，secrets 已設、測試訊息成功；gis-agent-system #48、#53；gis-platform refresh-dataflow 排程依使用者決定停用。
- **SBE-0（Supabase 效率大掃除）**：盤點報告 [db-waste-20261109](../../../.gis-agent-system/projects/2026-10-zeabur-migration/healthcheck-20261108/db-waste-20261109.md)。證據：gis-platform #220（mig 518–520）、#221（mig 526–531）、#223（mig 532 刪 11 個索引約 3.8 GB）、#222（sql-lint L1／L2）、#224（匯出腳本改交易層級唯讀）；mini #958（R1–R5 鐵則）；collectors #191（每週一 DB 體檢）、#192＋#193（收集器固定形狀 SQL，已部署 pulse-host）。實測：機場旅客 RPC 1.46 s→約 70 ms、YouBike H3 12 s→0.4–1.6 s、警訊 2.3 s→98 ms、颱風 2.6–9.4 s→0.15–0.3 s。VM 5 支未換見 SBE-1。
- **MAR-HR**：海洋固定站 popup 長範圍改讀每小時表。證據：gis-platform #225（mig 533 已套用並測試通過）、mini #961（7 天曲線，隨 v2.33.0）。登記 AI 倉庫見 AG-MAR。
- **INC-20261109**：唯讀檢查腳本的 session 唯讀設定經 6543 pooler 殘留，收集器寫入失敗。證據：13:03–13:23 共 20 分鐘，buffer 全數補寫、無資料遺失；根因修在 gis-platform #224，教訓寫入個人記憶。
- **PLA-190**：共軍航跡支援國防部 10/01 起新尺寸 1125×1625。證據：collectors #190；補算 10/01–11/08 共 29 天（19 通過、10 待審，10-14 原圖 404 無法補）。
- **HERMES-1**：Hermes（機票雷達寫入端）退役。證據：2026-11-09 使用者決定；ALERT-1 原待決項 (3) 一併結案；資料去留見 FARE-1。
- **REL-v2.33.0**：發版。證據：mini #963，tag 已打，正式站 main-*.js 為 2.33.0；內容含 Day 8 文章（#957）、10 篇補資料來源（#959）、移除 Zeabur 部署檔（#954）、海洋 7 天曲線（#961）。
- **LOCAL-1**：本機負載規則與磁碟。證據：`~/.claude-migu/CLAUDE.md` 已加本機負載規則；約 38 GB 移到 `~/.Trash/gis-cleanup-20261109/`（待使用者清空垃圾桶才實際釋放）。

## 已關閉（2026-11-09 夜間執行：已完成，附證據）

- **ZB-4**：刪 Zeabur 前把 `mini-taiwan-pulse.itsmigu.com` DNS 改成 Worker custom domain 或佔位記錄（期限約 11-14）。 正式網域改 Worker custom domain。證據：2026-11-09 00:20 使用者刪 Zeabur A 紀錄（172.105.197.215）、`wrangler triggers deploy` 綁定，mini #952 寫進 `wrangler.jsonc`；v2.32.0 部署後正式站 200、main-*.js 為 2.32.0（斷線約數分鐘：後台 Connect domain 回 No zones match，改用 wrangler）。
- **MCP-1**：mini-pulse-gis-mcp 的 vitest 3→5。 證據：mini-pulse-gis-mcp #102（9d37274），vitest 5.1、`npm audit` 0 漏洞、729 測試通過；只動 dev 依賴，正式 MCP 不需重部署。
- **MCP-2**：MCP README 部署步驟補 `npm ci`。 證據：mini-pulse-gis-mcp #102 README 部署段改 `npm ci && npm run build`。
- **DEV-1**：GitHub branch protection（required `ci-ok`、strict up-to-date）＋關 squash／rebase merge（健檢自動化 A1）。 證據：2026-11-09 七個 repo 皆 `allow_squash_merge=false`、`allow_rebase_merge=false`；mini（develop、master）與 gis-data-collectors（main）禁 force push／刪除；其餘 5 個 private repo 需 GitHub Pro，無法設；required `ci-ok` 未開（避免擋住現行流程）。
- **DEV-2**：journal `[auto]` hook 改寫到不進版控的位置（自動化 A4）。 證據：gis-agent-system #50 改寫到 gitignored `journal/_auto/`；settings 改指 `~/.claude-migu/hooks/session_end_journal.sh`，實測寫入 `_auto/2026-11.md`。
- **DEV-3**：修 2 支失效 hook（自動化 A2、A3）。 證據：2026-11-09 cbm gate 路徑改 `~/.claude-migu/hooks/cbm-code-discovery-gate`（實測 exit 0）；pre-push-check 從未生效（讀已失效的 `$CLAUDE_TOOL_INPUT`），依「本機 verify＋CI 把關」移除註冊、檔案保留；settings 備份 `settings.json.bak-20261109`。
- **G027**：Clear the remaining workspace residue left untouched on 2026-08-22. 證據：2026-11-09 清理 87 個已合併且乾淨的 worktree、333 條已合併本機分支（bundle 備份 `GIS/_worktree-backups/2026-11-08/`），實驗與有資料的 worktree 保留。

## 已關閉（2026-11-09 晚間：主 agent 第一、二批執行回報）

> ZB-2 第 1 部分、WA-3 第 2 批、SBE-1 VM 部分也完成，但原列仍有剩餘工作，進度寫在原列。

- **DIO-5**：`aisstream_archive_manifests` 監測欄位改用 `uploaded_at` 已修。證據：主 agent 2026-11-09 回報（PR 編號待補）。
- **SEC-10**：analytics 帶 iCHEF 客戶編號的 geojson 已移出 GIS 工作區。證據：主 agent 2026-11-09 回報（細節不寫入公開 repo）。
- **HIST-3**：THCTS 今昔對比與 1944 水域研究已搬進 analytics `docs/topic-research/historical_thcts/`。證據：analytics #334（MERGED）；原始檔 619 個（428 MB）在 S3 `research-source/historical_thcts/20261106/`。
- **SBE-3**：`get_iot_wra_timeseries` 改為修正後保留（非退役）。證據：主 agent 2026-11-09 回報。
- **SBE-4**：`youbike_h3_daily`、`parking_availability_daily` RLS。證據：主 agent 2026-11-09 回報完成（PR／mig 編號待補）。
- **TD-4**：台鐵誤點軌跡欄無限增長。證據：gis-platform mig 507（保留期限 180 天）。
- **COL-F010**：`weather_raster_frames` 舊 partial 蓋掉新 ok。證據：collectors #195。
- **SEC-3**：公開 RPC 收回多餘 PUBLIC EXECUTE。證據：gis-platform #227（mig 536）。
- **SEC-8**：`cloud_agent_ro` 對會刪資料的 SECURITY DEFINER 函式收回 EXECUTE。證據：gis-platform #227（mig 536）。
- **G026**：正式庫備份表與改寫備份分支。證據：gis-platform #227（mig 539）。
- **ST-1**：回收 retention／aqi 刪除後的磁碟。證據：主 agent 2026-11-09 回報已回收約 2.35 GB。
- **DIO-4**：`metadata.collector_status` 涵蓋缺口。證據：主 agent 2026-11-09 回報完成（PR 編號待補）。
- **FP-2**：菜價指數停更改為數天內偵測。證據：主 agent 2026-11-09 回報完成（PR 編號待補）。

## 已關閉（2026-11-08 使用者勾選：過時／效益小／被取代）

使用者 2026-11-08 回「照建議」關閉；原文需要時見 git 歷史（PR #947 前一版）。TWL-4 原建議關，查證 MCP origin/main `datasetLabels.json` 仍是舊名「管制區」，改為保留。

- **Release-assets**：Resolve asset/deploy gaps without duplicating per-feature implementation. 理由：內容已拆進 VIS-PACK（VP-*、BR-3、MAR-2）逐項截圖，傘狀列重複。
- **G017**：Provide safe, scoped Cloudflare cache purge for deploy recovery. 理由：檔名帶 hash＋R2，部署後不需要清快取工具；真遇到再開。
- **G004**：Remove the remaining unreachable files baked into the Docker image. 理由：主站已改 Cloudflare Worker，Dockerfile 只剩回滾用，隨 Zeabur 收尾（ZB-6）退役。
- **DIO-1**：Confirm the incident is actually closed. 理由：超過 30 天未再發生 Disk IO 事故。
- **DIO-11**：Disk IO round 3: cut reads from ~215 GB/day (round-2 re-measure) toward an estimated 140-160 GB/day. 理由：mig 505–510 刪 20 張表後舊基準失效；要複量照新基準另開。
- **WA-5**：Decide what to do with orphan assets on disk that the manifest does not reference. 理由：主站已不用 Docker /data，CI-4 已重整資產；S3 孤兒要盤另開。
- **DIO-8**：Decide whether `animal_adoption_current`'s `last_seen_at` index earns its cost. 理由：animal_adoption 單一索引，影響極小。
- **WA-10**：Produce the first trustworthy weekly slow-query ranking. 理由：weekly-audit 9 月後停跑；要恢復是重新排程稽核，不是留本列。
- **OG-1**：Bound anon-key abuse cost. 理由：Supabase Spend Cap 10-17 已開。
- **TWL-2**：決定 `public/fishery` 舊檔去留。 理由：CI-4 已把 public/ 資料檔移出 git，題目自然消失。
- **TWL-14**：2026-10-31 盤點的次優先候選。 理由：與 roadmap candidates 重複，留 roadmap。
- **BR-5**：Add science-park analysis only from authoritative geometry. 理由：無進展、無需求。
- **PERF-1**：首屏 JS 由 gzip 2.11 MB 降到 1 MB 內（2026-10-16 本機 Lighthouse 行動版效能 0.26、LCP 15.9 s，機器負載偏高）。 理由：與健檢 D11「首屏維持現狀」（HOME-1）衝突。
- **PF-3**：Optional RDP simplification of bus route geometry (~3 m). 理由：效益小（約 3 m 簡化），無人提起。
- **PF-5**：Cap Mapbox render resolution on Retina. 理由：效益不明且可能變糊，無人提起。
- **MO-6**：Add a central-bank exchange-rate signal; TWSE work is no longer part of this item. 理由：Monitor 小功能，無程式、無需求。
- **AR-42**：Serialize layer preferences as manifest keys. 理由：無程式、無需求。
- **AR-44**：Pin chat results to Monitor. 理由：無程式、無需求。
- **G018**：Feed rail turnback geometry artifacts to upstream data owner. 理由：無進展，上游無回報管道。
- **G015**：Decide whether to revive draggable Monitor layout work. 理由：10-18 使用者「2甲」已刪分支並 bundle 備份，實驗保留在備份。
- **TA-5**：S3 `migu-private-research-ap-southeast-2/cloud_run/cloud_run_smoke/`（幾 KB 測試檔）要不要刪。 理由：S3 smoke 測試檔僅幾 KB，不必追蹤。

## 已關閉（2026-11-08 單一入口整理：決定不做／維持現狀）

- **OG-5**：分享網址要不要讓站主還原站主限定圖層。 決定：11-06 決定 原列記載：2026-11-06 使用者決定維持現狀：分享網址一律不還原站主限定圖層（含站主）。`urlState.parseLayers` 現行行為與測試不變。
- **N3-4**：日本舊研究層 jpWildlifeProtection 與新層 jpWildlifeProtectionMoe 同源；舊 jpNaturalParks（2010，有公園名）與新 2015 版。 決定：使用者 11-06 決定並存（First action 寫「無」，可關） 原列記載：使用者 2026-11-06 決定兩組都並存。First action: 無；若之後要合併，先讓新層帶公園名。
- **HOME-1**：首屏 JS 再瘦身（健檢 D11：`statisticsText`、`propertyValueAdminTypes`、`simPlaybackClock` 移出首屏 modulepreload，約少 1 MB br）。決定：使用者 2026-11-08 拍板首屏維持現狀、不做，原因未記錄。健檢量測：首屏傳輸量約 2.9 MB（br），PERF-1 目標 1 MB（健檢 northstar.md E1）。PERF-1 已於 2026-11-08 使用者勾選時一併關閉。

## 已關閉（2026-10-16 盤點，非完成而是不做／被取代）

- **G008**：無具體維護痛點（layerManifest.ts 12.1k 行等大檔無新問題），原條件「除非點名痛點否則 no-action」成立；日後有痛點再開窄範圍項。
- **TD-2**：owner 2026-08-22 已明確拒絕回補 2026-03 前的 TRA delay（舊格式 64 天缺 scheduled_trains／coverage_pct／to-arrival delay）；S3 原檔仍保留，要重啟請新增 trigger 與 owner。
- **AR-43**：自述已被 pulse-research MCP／倉庫（AG-*）取代，無程式；拆自原 AR-41~44。

## 已關閉（2026-11-06）

- **GUI-1**：#808 修正已隨 v2.22.0（2026-11-04）發布；正式站因 Zeabur 不再自動部署仍是 v2.21.0，部署驗收併入搬家後的正式站驗收（GUI-2）。
- **PRIV-1**：隱私說明頁已隨 v2.12.0 上線（CHANGELOG v2.12.0 / 2026-10-23 紀錄）。

## 已關閉（2026-11-08 現況盤點）

- **MC-4**：多國化議題 3（主站遷移）已於 2026-11-06 隨 Zeabur 搬家完成（R2＋Workers＋pulse-host），收尾併入 ZB-1。
- **UKREL-1**：#766 已隨 v2.19.0 上線。
- **VIS-1／VIS-2／VIS-4／VIS-5／VIS-6**：#795（`7aaafe66`）已隨 v2.20.0 上線；VIS-1、VIS-6 為使用者決定維持現狀。
- **TWL-10**：#770 已隨 v2.19.0 上線。
- **TWL-16**：使用者決定題已全部拍板並落實。
- **IEREL-1**：v2.27.0 於 2026-11-08 發布（master `f3ffd118`、tag／Release 已建，正式網域 `main-D47-9O-X.js`＝2.27.0）；愛爾蘭全覽與南韓公共安全統計的瀏覽器目視仍待做。
- **REG-2**：pulse-data #80 合併（Day 6 四層、water1944 兩筆新條目；WMTS 五層加進 `_no_upstream.yaml`），`check_layer_coverage.py --from-checkout` 0 缺口。
- **TA-1**：analytics #323 合併（三市可及性＋cloud_run，已合入 master、未 rebase），分支與 worktree 已清。
- **TWL-12**：6 題全部拍板並完成——第 2–5 題（自然保育主題、基礎建設拆組、發光測試層站主限定、農村再生社區）mini #910 隨 v2.28.0 上線；第 1 題甲案統一統計分類 mini #912（develop，待下次發版）、MCP #100（已部署 analysis-prod/mcp `025a69f`）、analytics #328；第 6 題統計比較維持不開。稽核 parser 後續見 STAT-SYNC-1。

## 舊段落來源索引（2026-11-08 前依稽核日期分段時的段落說明）

改依主題群分段後，原段落開頭的來源與事故摘要集中保留在這裡，供追溯各列證據。

### Disk IO incident follow-ups (2026-09-04)

> Incident: Supabase Disk IO budget exhaustion, three forced restarts in 6 days (08-30, 09-02, 09-04).
> Fixed via gis-platform PR #92-#95 (mig 400-404) and data-collectors PR #82-#84. 330 → ~178 GB/day measured.
> Full record: [pitfall](../../../data-collectors/.claude/pitfalls/2026-09-04-disk-io-bloat-spiral.md)

### Repo cleanup follow-ups (2026-09-29)

> Cross-repo worktree/branch cleanup + reviewer-finding sweep (pulse #412–#459, collectors #106–#115, gis-platform #122–#125/#129, analytics #109–#119, mcp #28/#29). Backups of deleted branches, removed worktree data and local-only branch bundles: `GIS/_worktree-backups/2026-09-29/`. Cloudflare purge credentials stay under **G017**.

### Performance audit follow-ups (2026-09-30)

> Full write-up (causes, changes, measurements): [`docs/audit/perf-audit-2026-09-30.md`](../../docs/audit/perf-audit-2026-09-30.md). Audit trigger: opening 工商登記 layers spun up the fans. Shipped: #464 (render lifecycle — stuck paint transitions, All Off, repaint only on change, dense point overrides, lazy 3D/h3 chunks, deploy exclusions), analytics #124 + #467 (allzoom `--buffer=8`, bus route JSON without `cumDist`, 4 GeoJSON → PMTiles), #471 (no App re-render per timeline tick, lazy statistics recipe details, superseded assets off the deploy lists), and the follow-up PR for PF-8–PF-12 (per-key LayerHost visibility, explicit 3D repaint signal, per-family recipe details, ripple only inside the quake window, flight count reset, cancelled loads not flagged as failures, superseded GeoJSON out of the image). PF-1/2/4/6–14 closed (PF-13 ship count reset and PF-14 chat waste-stop columnar file in the PF-13/14 PR); history is in those PRs. Remaining items below.

### Map design-system follow-ups (2026-10-03)

> Found while shipping R5 dense-point heatmaps (#498); both pre-date R5 and were left unchanged. Write-up: [`docs/design-system/CHANGELOG.md`](../../docs/design-system/CHANGELOG.md) 2026-10-03.

### Code review follow-ups (2026-10-09)

> Source: Codex code review 2026-10-09 (`.gis-agent-system/reports/code-review/2026-10-09/`); Fid = finding id in that report. Items below were confirmed still valid but need product/contract decisions or cross-repo work, so they were not fixed in the review PRs. Trigger = when to pick it up; owner = repo that does the work.

### Code review follow-ups (2026-10-27)

> Source: Codex review 第二輪（`.gis-agent-system/reports/code-review/2026-10-27/`）；278 則中已修 245、NA 24，以下為未修或修了程式但資料未重產的項目。

### Site health follow-ups (2026-10-16)

> 全站健檢（效能、無障礙、安全、SEO、AEO、i18n、隱私、可靠性 8 面向，實測）：[`docs/audit/site-health-2026-10-16.md`](../../docs/audit/site-health-2026-10-16.md)。SEO-1～3、AEO-1～2（robots／sitemap／llms.txt、首頁靜態說明與結構化資料、soft-404）已在 #609 完成，隨下一版上線。下表只列需要跨週追蹤的；其餘 ID（SEC-*、AEO-3～5、OPS-2／3、PRIV-2、SEO-7／8、A11Y-2／3、PERF-3／4）見報告 §5。

### Weekly audit findings

> Appended by the `weekly-audit` skill. One `WA-*` ID per finding that needs cross-week tracking;
> transient or already-fixed findings stay in the weekly report only.
> Report: [2026-W34](../../docs/audit/weekly/2026-W34.md)

### 地圖基礎 GIS 元件（2026-11-03，#803／#804 隨 v2.21.0 上線，#808 已合 develop）

規格：spec §5.43（導航控制 N-1）、§5.44（游標座標、右鍵選單、量測）。設計稿：使用者 artifact（導航 2YijJqCfxZrWpRdebiTwe9、座標選單量測 PNjE95bytVvi2Qinms5Jxp）。

### 夜間三國圖層、站主限定統一（2026-11-06，#830–#836 隨 v2.24.0 發版）

南韓第 6 波、加拿大第 3 波、日本第二輪 16 層；pulse-data registry 全面補登（#57–#60，check_layer_coverage.py 0 缺口）；英格蘭 EA 站主限定（gis-platform mig 499 已套用、2,540 筆）；站主限定名單與呈現統一（mig 500 已套用，DB gated_layers 59 列）。

### 大眾運輸可及性 transit_access：三市與雲端運算（2026-11-06）

雙北版 #810 隨 v2.22.0 發布，2026-11-07 實測正式站已是 v2.25.1（`main-BdTubvoM.js`），雙北網站版已上線（正式站畫面驗收見 PROJECTS.md 該列）。臺中／臺南／高雄（含國道客運上下車限制）與雲端工具 `tools/cloud_run/`、skill `cloud-run` 都只在 analytics 本機分支 `feat/transit-access-cities`（worktree `.worktrees/transit-access-cities`，未 push）。各市結果與方法：analytics `docs/topic-research/transit_access/`（taichung／tainan／kaohsiung.md、methodology.md §6、_status.md）。

### 歷史圖層（2026-11-06 #30DayMapChallenge Day 6 Vintage 起頭）

已合 develop、未發版：mini #856（Day 6 四層：臺南海岸線三代、1932 臺北町界、1921 祠廟、燈塔與測候所；古地圖 historicalMapSinica 改公開並加 1944 美軍地形圖年代）、#860（站主限定 water1944Taipei）。gis-platform mig 503（古地圖解鎖）、504（gated_layers 補 water1944Taipei）已套用。資料與探索成果：`GIS/_worktree-backups/2026-11-06/`（thcts/ 盤點 CSV、授權摘要、raw 62 圖層、explore/1..10 FINDINGS.md；water1944/ 抽取腳本）。

### 愛爾蘭全波次、南韓第 7 波與統計（2026-11-07～08）

愛爾蘭第 0–10 波＋統計＋Coillte（mini #868 #870 #877 #884–#895；analytics #305–#322；pulse-data #63–#79；gis-platform #209 mig 511、#210 mig 512 已套用）；南韓第 7 波（#869）與火災／交通事故統計（#874，DB＋R2 已發布）；MCP countries.json 補 IE／KR／CA（#98，本機正式版已 build）。第 0、1 波與南韓第 7 波隨 v2.26.0 上線，#874 起未發版。正本：analytics `ireland_opendata/waves/PLAN.md` §5–6。

### 站主資料改存法、撤舊 RPC 與 Zeabur 交接（2026-11-08 HANDOFF）

來源：`.gis-agent-system/projects/2026-10-zeabur-migration/HANDOFF-20261108.md`（origin/master）。站主資料第 1 批 #911 隨 v2.28.0、第 2 批 #917 與圖層調整 #918 隨下一版發布；設計正本 `.gis-agent-system/projects/2026-10-zeabur-migration/owner-only-storage-plan.md`、ADR-0026。保留期限、git 資料檔、Zeabur 刪除、金鑰分別併入 WA-3、WA-8、ZB-1、SEC-6。

### GBA 建物足跡缺口（2026-11-08，#30DayMapChallenge Day 8 發現）

Day 8 烏托邦分析中永和時發現 GBA 建物足跡在部分市區大量缺漏。
