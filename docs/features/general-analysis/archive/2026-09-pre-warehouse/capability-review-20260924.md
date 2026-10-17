> ⚠️ 歷史文件（已被 [PLAN-warehouse-20260926](../../PLAN-warehouse-20260926.md) 取代），只作查證，不作施工依據。

# Agent 能力與邊界審查（2026-09-24）

> 最新狀態：六片有界本地交付已完成，見[六片驗收與剩餘缺口](./acceptance-six-20260924.md)及[四工作流手冊](./analyst-guide.md)。下方較早的未完成描述保留為歷史，不覆蓋本次驗收。

本頁是目前能力的閱讀入口；計畫與驗收關卡仍以 [plan.md](./plan.md) 為 SSOT。歷史報告保留當時失敗，不代表最新狀態。僅本地隔離預覽，尚未整合原 checkout 或發布。

## 我們已經能做什麼

| 能力 | 已完成的實作與證據 | 邊界／未完成 |
|---|---|---|
| 找資料、判斷能否回答 | layer/dataset search、descriptor、能力與來源契約；有資格才讀取 | 地圖可開、catalog 登記、可讀、可分析是不同層級。歷史盤點 778 layers／58 datasets／53 queryable layerrefs 不是本輪 live 健康數，也不是全部可交叉 |
| 附近與最近 | 合格 Point 的直線距離、最近、範圍筛選；學校、圖書館、護理來源已有真實 oracle/native 案例 | 不是路網時間；資料記錄數不等於唯一營運設施；護理僅來源自帶 WGS84 的子集 |
| 區域比較與統計 | bounded aggregate、key join、metric、行政區比較、series/quality/evidence；同來源同期人口占比 native 通過 | 跨來源設施人均率仍缺精確同期分子；generalized 行政面只能按代碼比較與呈現；series 的工具存在不代表任意時間資料已驗收 |
| 點線面疊圖 | Point within/intersects、per-area aggregate、完整 Line 與面相交；公車／圖書館／owner-only raw 行政界全鏈通過 | 需 actual/合格 derived 幾何、CRS、完整性、holes/multipart 與邊界規則；第二主題已接雙北114筆墓葬用地衍生面；不代表法定原始界線 |
| 環域、面交集與度量 | V03 三個 predicate 已經 native 串接 query→buffer→intersection→measure→點位篩選→地圖；200m 案例與 GEOS 面積差約0.009% | 有界單 feature、本島 envelope、半徑1–500m、頂點/拓樸/byte限制；不是任意GIS引擎，不是工程精度或可及性。小數半徑拒絕案例見下方修補紀錄 |
| 事件＋背景 | 固定歷史地震、周邊學校與行政背景全鏈通過；有界事件時間窗 | 事件時點人口、fresh feed、撤回資訊不齊；道路來源常觸發51筆密度拒絕，SQL草案未remote apply |
| 地址與步行 | local geocode 與受控 route/isochrone adapter 已存在，provider receipt 有獨立契約 | 精度等級不可混用；外部呼叫仍需既有consent，無路網不得以直線替代。V04設施coverage完整工作流尚未完成 |
| 地圖呈現 | result collection、分組/開關/排序/透明度、bounds/framing、ready/readback；深淺底圖保持結果；連線側欄灰色 | 本輪已驗寬窄/深淺/面板互斥/重疊選取與normalized popup；數值choropleth、快速切換中斷提示與使用者主觀驗收仍開放 |
| Agent 執行可靠性 | 16步bounded plan、result refs/bindings、pending接續、同session reload恢復；有原生正例 | 20題主task控制問題median25.66秒、p9545.77秒；真實20輪使用者SLA仍未驗收，工具鏈不等於整題速度 |

## 需要整合，但不需要另造一套 agent

最短路徑仍是：辨識資料家族 → 必要的 descriptor → 一個相依分析 plan → 一次 collection+framing → wait/readback → 引用來源與限制。Jev 僅用於歧義候選，不是每題必经，也不能授權資料。

本輪優先收斂三個分散處：MCP 的實際 schema、Jev candidate tools、pulse-gis-analyst 配方。新的幾何能力沿既有 spatial_query；不新增 buffer 專用入口、不建立第二個 capability registry。後續若仍反覆漂移，再評估從註冊表派生候選，而非先做大重構。

文件採一個能力入口＋一份 plan＋逐片證據；舊驗收頁加最新狀態指標，避免看到舊「請重載MCP」便重做。原 checkout 有其他工作中的 skill/local-stack 修改；整合前必須逐檔比對，不能覆蓋。

## 可以刪掉的多餘操作

- 同題未變更的 descriptor 不重複讀；確定資料/方法時略過 Jev。
- 已知相依步驟用 plan refs，不手抄 result ID、不逐步重新規劃。
- 完整 receipt 已有 summary/units/source 時，不為流程形式再讀一次 result/measure/quality；有特定缺項才查。
- pending 只 poll requestId；partial 重用完成 bindings；超限或無效幾何禁止原樣重試。session/reload使結果真的遺失才重取必要inputs。
- 一次 collection 搭 framing，等一次 ready、讀一次 map_context；畫面仍需目視驗證。不要 present 後又無理由 fit、重呈現。
- 來源資格不足不靠縮小 display limit、改名或漂亮圖面繞過。

保留有價值的重複：變更權限後再授權、版本切換後重新確認descriptor、數值獨立oracle、地圖render readback。這些是守門，不應為追求呼叫數刪除。

## 缺口分類與下一步

執行順序與狀態見 plan 的 R01–R04。先穩定既有能力，再擴來源與可及性。

1. **可靠性及理解（R01）**：修幾何拒絕、名稱辨識、配對文案、skill/tool一致性；用真正變體與native回讀驗收。
2. **速度與視覺（R02）**：20題正常Codex完整問答warm及cold另列；同時完成三類視覺矩陣、窄safe viewport和popup。題目換地點、措辭、半徑，含空值/不相容/無覆蓋；oracle只評分，不餵runtime。
3. **來源擴充（R03）**：從11候選qualification選第二獨立主題Polygon及一項合格設施；補SHA、時間、license、精度、完整性，再接共用reader。缺來源契約就HOLD，不以新增工具取代資料工作。
4. **可及性（R04/V04）**：單起點、有版本步行等時圈＋設施coverage；分母、coverage、unreachable/no-data分開。先本地/既有provider授權範圍；不擴大付費服務、不做全臺OD或選址最佳化。

V05說明書先用本頁與按需配方提供入口；四工作流教學與完整產品驗收尚未完成。Raster、全臺格網、多起點OD、任意SQL/URL、無界批次幾何不在目前能力內。

## R01 歷史修補與驗收

- 幾何修正 `971196ad`：Turf 125.5m 輸出含零長邊，獨立 Shapely 對原封不動 Turf 輸出判定 Valid Geometry。拓樸檢查略過零長邊而不改座標；洞接觸、真正自交仍拒絕。閉合端重複點、點位 within/intersects 及預算均有回歸。
- 圖例／配對文案 `aa5f95e9`：環域名稱取來源feature名稱＋半徑，未知名稱使用有界識別 fallback；PAIRING_REJECTED 不再斷言登入token失效。文案分支為本地驗證，沒有刻意破壞有效配對製造UI錯誤。
- MCP `2edd0f4`：Jev候選補批次分析、行政比較與結果collection/bounds；候選必須存在於實際listTools的契約測試通過。未外呼Jev；目前host未以付費call驗證這份新candidate清單，不以build宣稱live provider通過。
- native：HMR後首次仍使用舊lazy module，125.5m拒絕；停止重試，網頁reload後同session恢復，因browser結果清除才重取inputs。6步plan一次complete，2811ms（工具鏈時間），125.5m修復案例＋另一feature/173.25m變體成功，兩個圖例均帶來源名。
- 數字：修復案例球面面積3,529,747.884m²，獨立EPSG:3826/GEOS3,525,309.123m²（差0.126%）；新變體2,747,864.023 vs 2,746,879.644m²（差0.036%）。不同投影/球面/離散化方法結果不完全相同，不當工程測量精度。
- 正常collection command `869375ec-96f4-4c8d-9397-72a876040e87` r3 ready；2 results/features/sources，layers/sources/resultPresentation ready。深淺底圖截圖可見兩走廊，DOM可分辨名稱，恢復Dark；safe width約232px，仍偏擠，G02不標完成。
- 超限負例：1291＋712輸入頂點的intersection回SPATIAL_INPUT_VERTEX_BUDGET_EXCEEDED；不重試、不放寬1600限制。buffer輸出8000上限不代表下一步可接8000輸入。
- 本地：Mini focused 28 tests、tsc -b、diff check通過；另connectionReliability5通過；skill quick_validate通過。MCP focused15＋build通過；完整套件69通過、4個BrowserBridge測試被sandbox bind EPERM阻擋，未宣稱全套通過。Gateway未改。
- 收據：相鄰runtime/r01-native-20260924.json、r01-oracle.json、r01-turf-output.json；runtime非可攜commit內容，數字/方法摘錄於此。原始來源SHA沿用V02資格表。

R01當時未完（最新狀態見下方R02/R03）：G01正常20題warm/cold、G02完整矩陣/normalized popup/主觀驗收、V02第二主題Polygon、V04完整coverage、V05四工作流教學。source bus兩個不同query receipt各回downloadedBytes=530765/cacheHit=false；這提示共用snapshot重用需量測，不足以推定實際網路重傳或立即加永不過期cache。列入R02。

整合限制：以上code及skill都在隔離worktree，原checkout的平行修改保留；隔離skill更新不等於所有新agent已載入。下次整合須比較根目錄skill差異並保留雙方有效規則，再依live schema使用。無push/PR/merge/部署，無擴大付費呼叫。


## 協作側欄 UI（2026-09-24 午後）

依使用者要求回查版型：d86cc66d之前，App將MainMapConnection以embedded注入IconRailSidebar，繼承288px/70vh共用面板與agent色彩變數；d86為保護responsive配對生命週期改為App-root常駐，脫離embedded樣式。此次保留常駐模型，不退回會卸載連線的舊架構。

定位改為「與 Agent 協作」：Layers相同尺寸、標題分隔、字體節奏與8px圓角，深色中性灰／淺色白底；直接使用既有LayerToggleSwitch。每筆分析圖層將色塊、名稱、筆數、幾何型別與開關合併，保留排序、透明度、群組與清除。刪除重複的獨立圖例清單；計數分級保留在對應圖層列。帳號／登出／撤銷放入連線設定，來源與篩選證據預設收合。沒有分析结果時顯示提問引導。

互動補修：capture改讀Mapbox實際camera，避免Agent fitBounds後，手動圖層開關用舊bridge快照把視角帶回臺北。正常native呈現路線＋173.25m環域2features ready；CUA關閉線結果後native回讀1feature，恢復2features。修復後前後camera完全相同：120.4560435157,23.4657710341,z11.1404066941。

CUA已檢查Dark/Light、實際青色面／橙色線圖例、Layers與Agent互斥；390×844 viewport override下panel無水平溢出（clientWidth=scrollWidth），已reset。原session 9b67be6bb3cfc574bca25164c314c942保持active，最終2features/sources/layers ready、Dark。未測登入/撤銷的破壞流程，也未宣稱完整G02矩陣或使用者主觀驗收完成。

本地tsc -b、連線恢復/可靠性7tests及diff check通過。三個source檔MainMapConnection.tsx、ResearchConnection.tsx、mainMapConnection.css；本輪未改MCP/Gateway/來源資料。


## R02/R03 本輪三片交付（2026-09-24）

1. **問答可靠性**：收斂descriptor、plan refs、pending與一次collection流程；修正discovery-only可找到卻無法describe的不一致。20題換地點、半徑、題型的控制樣本19題分析呈現完成，1題抓到缺陷後另測修復；不背答案。Q01–Q18可比欄位通過獨立oracle。
2. **協作UI與取景**：沿Layers樣式，深淺主題、窄版互斥、同座標紀錄選取、原始/標準化單位與事件popup；最大可用矩形與真實投影最多兩次取景修正。附近多來源、人口比較、事件背景均有native ready/readback及browser證據。
3. **來源擴充**：雙北114筆墓葬用地derived MultiPolygon、玉山30筆官方座標山屋/營地子集；SHA、selector、來源/時間未知與排除106筆混合來源紀錄均保留。新面measure/contains_center及新Point最近/範圍已驗；不代表即時營運狀態或步行可達。

詳見[完整驗收單](./acceptance-R02-R03-20260924.md)。本輪110項focused tests、typecheck通過；未宣稱完整repo test/build或生產驗收。

下一步依序：使用者檢查協作版型 → 數值分級設色及快速theme/resize中斷提示收斂 → 真實20輪對話cold/warm量測 → R04/V04單起點步行coverage → V05四工作流說明書。付費Jev候選live驗證、事件獨立歷史oracle、來源原始archive SHA與觀測日期仍是缺口；不因三片本地交付而關閉所有G01/G02/V02–V05。
