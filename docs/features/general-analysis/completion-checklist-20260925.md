# 全圖層查詢完成清單

更新：2026-09-26。這是後續施工的執行入口；來源與驗收收據沿用 [來源家族施工紀錄](./source-family-priority-rollout-20260925.md)，逐層身份沿用 [778 層台帳](./p0-source-family-ledger-20260925-current.json)。本文件把既有 P0–P7 拆成可勾選的工作，不替換歷史證據。

## 目標、計數與打勾規則

目標：先讓資料在明確版本、範圍與欄位下可靠可查，再讓具合格幾何的來源支援附近分析，讓同口徑統計支援縣市比較。順序是臺灣 GIS → 縣市統計及其衍生比較 → 全球 GIS → 日本 GIS。

目前登記狀態：778 層，243 個已有查詢映射；另 1 層有 descriptor 但關閉查詢，故 535 個仍待處理；共 251 datasets。242 不等於 242 層全部驗收完成。目前待處理層的逐層狀態見當前佇列；188 個比較 recipe 已包含在統計待辦內，不另加總。owner-only 已可查的層仍有公開授權、精度及展示同版 HOLD；這是讀取器登記狀態，不是 778 層可分析完成率。

- `[x]`：該項明定的交付與驗收已完成，附證據。
- `[ ] 待做`：尚未完成；已登記 adapter、已分類或已做單一範例均不足以勾選整批。
- `[ ] HOLD`：仍未完成。必列已查證據、阻擋原因、解鎖動作與負責方，不從總數刪除。
- 「本機檔案不存在」「recipe 標為 STALE」「未部署」不能單獨證明無法做本機歷史資料查詢。先查其他既有 checkout、analytics 原表、pipeline、同版發布產物與允許讀取的 release；可本地重建就繼續做。授權不明則禁止公開接入。
- 已有資料更新週期不等於檔案今日新鮮；保證限於驗過的版本與契約，不保證所有真實世界物件、永久可用或即時有效。

## 執行節奏：一批完成後接下一批

每次開工：讀本清單目前游標、git status、必要的服務／配對狀態及上批收據。只補缺少的驗收。主 agent 選來源、整合與驗收；Terra/Luna 僅有界實作或盤點。

每批以真正共用的原始資料為單位，完成一個家族的全部已確認 layerRefs／filter，接著取下一個可做家族。批次大小依資料量與風險調整，不把「完成一個設施、示範題、commit 或一次 build」當本輪停止條件。卡住的家族記 HOLD 後立即處理其他獨立家族。

只有缺少必要權限／來源且所有獨立工作都已處理、使用者要求停止，或執行環境被中斷時才留下未完工作。換 context／task 時寫精確游標、未提交檔案、下一個指令與失敗原因；不重頭盤點。回覆結束不代表背景仍在執行，不暗示有自動排程。本案不重啟暫停排程。

## A．把盤點變成可施工的完整佇列

- [x] A00：778 個 layer key 全部納入同一台帳，保留 local asset／remote version／query／displayed 分離證據。收據：`81a8f838` 及 current ledger；僅代表列冊完成。
- [x] A01：以 manifest key 一層一次歸入施工主組：臺灣主 Layers 381（已註冊 147／待處理 234）、統計 312（53／259）、世界 tab 25（1／24）、日本 60（0／60），合計 778／201／577。日本隱藏研究層仍依 `jp*` 歸日本；10 個沒有 UI section 的 orphan 暫歸臺灣主 Layers。這是 UI 主施工組，不等於每層實際資料只涵蓋該地區；例如主 Layers 的太空資料可跨國，「情勢 Situation」的三層仍位於主 Layers。統計跨入口重複顯示仍只計同一 manifest key。收據：[分類與數字](./completion-queue-20260925-summary.json)、可重跑 generator `scripts/research/build-completion-queue.mjs`。
- [x] A02：577 個待處理 key 已有[逐層佇列](./completion-queue-20260925.csv)，含主組、當前狀態、施工步驟、來源簇及其證據等級、已核版次／原檔、阻擋、下一步與收據欄；未核來源明寫 `NOT_VERIFIED`／`NONE_YET`。同名上游僅是導航簇，不算已證實共用原表；加油站覆蓋衍生面分開列。順序先臺灣、統計、全球、日本；各組內按已知來源簇排列，具體 GO/HOLD 仍由 A03 查證。
- [ ] A03：逐家族核對真正共用的 raw/RPC/release 契約；從宣告 upstream ID 的高覆蓋家族優先，補原檔／SHA、授權、時間、筆數、缺值及 geometry。全部待處理層均有已核 family 或具體待解證據，才勾選。
- [ ] A04：對現有 188 個可查映射連回驗收收據，分清「只註冊」「屬性通過」「空間通過」；只補缺項。產出四組實際通過數，避免把 registry 數當完成率。

本輪首個新家族收據：加油站 canonical 五個站點層共用 3,053 筆 Point 的固定版 reader。高雄 2 公里 18 筆的獨立 oracle、MCP 查詢、scene `ready`、18 features map readback 與瀏覽器目視均通過；來源檔 SHA、授權混合及 34 筆空名稱詳見[第五批](./source-family-priority-rollout-20260925.md)。這五層的**新查詢空間鏈**已通過；舊 static RPC 展示檔把 443 筆 ODbL 誤標 OGDL，故「既有展示與來源授權完全同版」仍 [ ] 待修。四個 `gasCoverage*` 衍生距離面仍 [ ] 待核產製與路網版本，不算在五層內。

七個 `livestockFarm*` 已找到共用的 enriched v3 本地 13,087 Point 檔及固定 SHA；現行產品仍走 owner-only `get_livestock_farms` RPC，該 RPC 的實際 release 未讀，來源含低精度段／村里質心與 EMS／Google 補位座標，ARIS 批次也非完整全國母體。狀態 [ ] HOLD：先由資料擁有者核准座標使用與公開範圍、核 RPC 同版與 ACL；此前不建立公開研究 reader，不把七層記成 SOURCE_MISSING 或可公開附近查詢。

`policeStation` 已用 2026-06-26 的 2,065 筆固定 Point 快照建 reader；嘉義 `[120.45,23.48]` 1.5 公里 10 筆，bbox 18 筆，最近點 135.685 公尺，獨立 oracle、正常 MCP、scene `ready`、10 點 readback 與瀏覽器目視相符。`entity_id` 只有 1,860 個不同值，保留重複來源列。這一層的**查詢空間鏈**已通過；舊 `policeStation` 展示檔的 same-version 收據仍 [ ] 待核，三個 `policeIso*` 是衍生等時圈，仍 [ ] 待查其輸入與路網，不能併算。

飼料廠、肉品市場、屠宰場三層已有 258／21／185 筆處理點與 OGDL 名冊聲明，但三者座標均依 Google geocode；原始名冊的本機 receipt 及公開座標使用權未核。已由待 reader／SOURCE_MISSING 改列 [ ] HOLD；先核原檔與座標權利，或經核准後只接安全屬性，不把處理點當可公開附近運算。

`pollutionFacility` 已接 2026-07-06 固定 152,246 Point 快照，台中指定 bbox 查 373 筆；嚴重度 2／3 分別 3／2 筆，與全表獨立計數相符。它代表列管潛勢而非確認污染，逐筆座標精度未提供，因此只保證依參考座標的 bbox 與屬性查詢；精確最近距離和空間分析 [ ] HOLD。分片讀取在正常 MCP 通過；這是資料查詢通過，地圖呈現不硬說已通過。

`pollutionPenaltyCritical`、`pollutionPenaltyGeneral`、`pollutionPenaltyMobile`、`noiseEnforcementEvents` 共用同一份 414,904 筆 EMS_P_46 歷史事件原表，已 [x] 完成 owner-only 本機 bbox／屬性 reader。台中 bbox 1,770 筆、noise 篩選 72 筆；台北 bbox 3,795 筆，均與全原表獨立 oracle 相同。四層是四個查詢映射，不是四份母體；noise 與嚴重度群組重疊。座標含 108,276 筆 address_osm，公開再散布權仍 [ ] HOLD；這些點是地理編碼參考位置，精確最近距離、違規現場與地圖呈現均未通過。424 個分片留在本機 runtime，由 loopback 開發服務讀取，不進 production 靜態資產；重建方式及 SHA 見來源家族施工紀錄。

`publicLibraries` 已 [x] 接 644 筆官方名冊屬性 reader（含 10 筆無座標），另有 570 筆 TGOS 地址級 Point 子集可做有界直線附近查詢；L1 62、offline_exact 2 保留於名冊但不進附近。台北 bbox 查得 9 筆，revision 19 `ready`、地圖 readback 9 點及瀏覽器目視通過。`coastGuardStation` 已 [x] 接 269 筆來源 Point reader（252 巡防、17 海洋驛站），東南部 bbox 查得 27 筆；一個重複 entity_id 以逐列 record_id 保留。海巡地圖 ready/readback 及既有展示資產同版仍 [ ] 待驗。

`companyPoints` 已 [x] 接 654,165 筆 202608 來源的 owner-only 本機分片 reader；原 public 分片已移至本機 runtime。高雄原分片超限，改 adaptive 594 分片後 bbox 5,299／製造 1,029，宜蘭 519／94，皆與全原表獨立掃描及正常 MCP 相同。直線距離只是營業地址 geocode 點距離；正式展示同版、118 來源 202608 授權與地圖 ready/readback 仍 [ ] HOLD。見 [P3 收據](./p3-company-points-receipt-20260925.md)。

`culturalMuseums` 已 [x] 接 266 列 owner-only 本機名冊（252 Point、14 無座標），其中 80 筆 Google 座標只限本機；`performingVenues` 已 [x] 接 861 列（857 Point、4 無座標），其中 471 筆 geocode 需公開授權再查。兩份均為參考座標 bbox／屬性 reader，不提供精確最近距離。台北 bbox 分別 10／79，台南新 bbox 與來源篩選分別 1 Google 文化館／10 api_mode 場館，與本機原表核對；公開發布和地圖呈現 [ ] HOLD。`speedCamera` 已 [x] 接 2,805 列名冊及 2,743 筆無可疑標記的 Point 子集；62 筆可疑座標保留在名冊但排除附近。台北 bbox 15、台南 subtype 變體 8，均與 sidecar 獨立計數相同；台北 15 點 revision 21 `ready`、readback 與瀏覽器目視通過。現行展示檔 20260626 與 reader 20260824 版本不同，正式圖層同版 [ ] HOLD。

`bikeStations` [x] 固定 9,408 Point 站點快照已用完整原表 SHA 接查詢：高雄 bbox 878 筆與獨立掃描一致。`weatherStations` [x] 838 筆當時運作中的 CWA 測站：台中 bbox 2 筆，正常 MCP→scene revision 30/31 ready→map readback 2→瀏覽器目視 2 點。兩者 Mini static 與 analytics processed SHA 相同；即時可借車數、今日站點營運、即時氣象值、正式遠端 release 仍未驗。水資源 `waterMonitorStations` 的 analytics rain gauge 242 Point 與 Mini display 2,032 Point 不是同版／同母體，暫列 [ ] HOLD：先核其原始組成與版本，不能直接用 242 筆覆蓋 2,032 筆。

`fireStations` [x] 本機 717 筆完整名冊可按 bbox／屬性查詢：304 官方、413 Google 參考座標，台中 6／花蓮 Google 4 與全 sidecar 核對。舊地圖檔只有 716 且屏東 38 筆座標不同；公開座標權、正式同版展示、精確最近及救援時間 [ ] HOLD。

社福五層 `welfareLtcInstitutions`、`welfareElderlyHomes`、`welfareChildcare`、`welfareDisability`、`welfareSocialWorkOrgs` [x] 有本機查詢：完整固定名冊 3,117／1,160／1,578／334／587 個 Point，TGOS／Google／離線來源逐列保留。長照與老人住宿另有只含 TGOS 的 3,053／1,043 筆子集；台中長照完整 bbox 113、台北老人住宿完整 bbox 17，與全 sidecar 獨立計數相符。社福團體是組織地址，不等於可服務設施。混合座標完整名冊一律 owner-only、proxy，只作 bbox／屬性，不提供精確最近與服務量能；公開再散布權 [ ] HOLD。TGOS 老人住宿子集台北 bbox 16 已由正常 MCP→scene ready→map readback 16→瀏覽器目視通過；其餘家族地圖 gate 依各筆來源與展示版本另驗。

六個 `eduSchool*`／`eduRemoteSchools` [x] 有同一 113 學年度 4,315 Point 原表的分類 owner-only reader：小學 2,656、國中 964、高中職 508、大專 159、特教 28、偏遠 1,152（與前五類重疊）。台中小學 26／高中職 7、花蓮國中 7／偏遠 0、台北大專 6／特教 4，與完整 sidecar 獨立分類一致。原表座標再散布授權未核，公開與精確最近 [ ] HOLD；名冊不是今日招生或學區。

`welfareChildServices` [x] 有 1,425 列 owner-only 名冊：1,396 Point、29 筆結構性無地址可查屬性但不進 bbox。台北 bbox 28、台南 Google 來源變體 4，與 sidecar 全檔核對。Point 是 TGOS／Google／離線參考位置；公開座標權、精確距離、目前服務量能 [ ] HOLD。

`artsEvents` [x] 有 7,482 場次 owner-only 查詢；6,121 Point、1,361 無座標仍可按屬性查。這是 2026-07-16 當時未結束活動的滾動窗，不是今日或歷史全集。`stationsTHSR`／`stationsTRA`／`stationsMetro` [x] 共用 535 站的 20260529 本機來源，但正式 catalog／舊展示仍為 503 站；查詢已接、正式同版 [ ] HOLD。六個司法機關點位層 [x] 各自從不同原表接 owner-only bbox／屬性 reader，共 235 Point；5 類 Google geocode、移民署 25 點為原始 TgosWGS，公開座標授權及精確最近 [ ] HOLD。`busStationsCity`／`busStationsIntercity` [x] 分別接 49,830／15,383 筆 TDX StationPosition 的本機分片 reader；兩個端點與快照時間不同，不把兩者加總為某日全臺站牌數。高雄客運 bbox 18 筆已 scene ready／map readback 18；站位不是路邊 Stop、即時 ETA 或步行可達性。各片 SHA、範圍與限制見[第十五批](./source-family-priority-rollout-20260925.md)。

`pollutionSite` 已完成 2026-07-06 固定 8,253 Point 名冊 reader，台中 3 公里獨立 oracle／MCP 均為 3 筆，其中列管 2 筆、歷史解除 1 筆；地圖 3 點 `ready`、readback 與瀏覽器目視通過。`pollution_source` 這個宣告 ID 實際含 EMS_S_07 場址、EMS_S_01 列管事業與 EMS_P_46 裁罰事件三份原始資料，三家族已有分開的本機 reader，但後兩家族的 proxy 點不能算精確空間分析。場址本機舊 PMTiles 與 analytics 20260706 輸出 SHA 完全相同，但 1,568 筆 sitearea 顯示整數化與查詢原值不同，remote runtime release 未讀。

第十六批 [x] 已接 `taxiStand`、`etcGantry`、`factoryLocations`、`eduKindergarten`、`eduAfterschoolCare`、`eduMutualCare`、`tourHotels`、`tourRestaurants`、`civilDefenseShelter`、`tourFactories`、`bikeStations`、`weatherStations` 十二個固定資料查詢映射；逐份原表、缺值、獨立 oracle、正常 MCP 和地圖收據見[第十六批](./source-family-priority-rollout-20260925.md)。其中工廠、教育、民防、觀光工廠為代理地址點或混合精度，公開座標權／同版展示仍 [ ] HOLD；自行車與氣象站查的是固定站位，並非即時車位或即時氣象。

第十七批 [x] 新接 13 個有界查詢映射：農產品批發登記公司、婦幼安全警示、TDX 道路 CCTV、殯葬設施與業者、五種宗教名冊、山屋與歷史山難、護理機構。各家族的來源 SHA、原表對帳、新地點與問法、正常 MCP、代理座標限制及 owner-only 護欄見[第十七批](./source-family-priority-rollout-20260925.md)。其中 TDX CCTV 的高雄 16 點有 scene ready／map readback；其餘代理點只證明本機有界資料可查，地圖同版及精確附近分析仍 [ ] HOLD。第十七批後尚餘 620 層，不把 13 個映射視為整體完成。

第十八批 [x] 新接共同登記地址、樹冠高像素、國道服務區與三市公園四個有界查詢映射。共同登記地址 11,121 群組、樹冠高像素 7,823 點、服務區 22 點、公園 2,917 點均有固定 SHA 與正常 MCP 查詢；服務區蘇澳 1 點、公園台北 9 點另有 scene ready、map readback 與瀏覽器目視。這些點分別代表登記地址、raster cell、服務區位置與公園／設施參考點，不能互換成公司營業地、單株巨木、交流道入口或公園範圍。水資源版本／母體不合的候選仍 [ ] HOLD。詳見[第十八批](./source-family-priority-rollout-20260925.md)。

第十九批 [x] 新接 `tourHeritage` 與 `tourEvents` 兩個固定來源查詢映射：文化資產 2,894 個代表點、觀光活動 828 個歷史事件點。嘉義文化資產與鶯歌歷史活動各有原表 oracle、正常 MCP 與地圖 ready/readback；來源座標只代表點位，文化景觀不是點範圍，7 月活動快照不是今天仍舉辦的清單。詳細 SHA、時間與缺值見[第十九批](./source-family-priority-rollout-20260925.md)。目前 614 個待映射層仍列在逐層佇列。

第二十批 [x] 新接 `protectedTreesNational`（8 縣市 6,544 筆）與 `riversideTreesTaipei`（臺北河濱 10,917 筆）owner-only 固定來源查詢。嘉義受保護樹木 bbox 1／嘉義縣 92、臺北河濱 bbox 86／茄苳 5，獨立原表 oracle、focused test、build 與正常 MCP 相符。兩者原始來源網址與授權仍 [ ] HOLD；受保護樹木只供 bbox／屬性，不做最近。河濱喬木是 2016–2017 歷史位置，不能回答今日樹況。本次地圖呈現 `MAP_NOT_READY`，故 scene ready/readback [ ] 未通過，詳見[第二十批](./source-family-priority-rollout-20260925.md)。剩餘 612 個待映射層。

第二十一批 [x] 新接 `forestTreatmentWorks` 6,213 個工程代表點與 `forestWildlife` 1,241 個調查格網代表點，均只供本機 owner-only bbox／原始欄位查詢。嘉義工程 bbox 40／民國 113 年 5、花蓮格網 bbox 4，與固定處理檔獨立 oracle 和 focused test 相符。工程本機 raw 9,999 列和處理紀錄 6,275 列版本不一致，標 `RAW_VERSION_MISMATCH_HOLD`；野生動物來源缺不可變 raw SHA、格網邊界和物種語意收據，標 `SOURCE_LINEAGE_HOLD`。兩者都不得回答最近工程／最近動物或目前狀態。正常 MCP／地圖驗收因前端 OOM 後原配對瀏覽器斷線 [ ] 待補；詳見[第二十一批](./source-family-priority-rollout-20260925.md)。剩餘 610 個待映射層。

第二十二批 [x] 新接 `eduUniversityStudents`、`livestockFeed`、`livestockMarket`、`livestockSlaughter`、`wasteStopsStatic` 五個本機 owner-only 有界查詢映射。大專學生數 159 校點、21 校學生數 null；畜牧三種名冊 258／21／185 點；清運停靠參考點 73,060，必給 bbox、只讀命中分片。五者均保留來源版本與 proxy 座標限制，未取得座標公開再散布收據的標 `RIGHTS_HOLD`，不得當作精確最近距離或現況。原檔 oracle、focused test 14/14、`tsc -b`、build 及本機 owner route/Host guard 通過；正常 MCP 因原瀏覽器 `BROWSER_DISCONNECTED` [ ] 待補，地圖同版也 [ ] 未驗收。詳見[第二十二批](./source-family-priority-rollout-20260925.md)。剩餘 605 個待映射層。

第二十三批 [x] 新接 LPG 同源兩類：`lpgSubpackaging` 107 點、`lpgRetailers` 567 點；廢棄物處理設施 66 政府點與 237 OSM 對照點按真正 `facility_type` 分成六個 layer 專用 reader，避免類別混回。`wfLandfillCoastal`、`wfMedical`、`wfOther` 缺對應類別仍 [ ] HOLD。兩家族都只保證固定本地快照中明定的 bbox／屬性結果；LPG 1,292 列有重複 entity_id，權利標示矛盾；政府廢棄物檔 66 筆與後續 Supabase 數百筆不一致。focused test 14/14、build、owner route/Host guard 通過；正常 MCP／地圖因 `BROWSER_DISCONNECTED` [ ] 待補。詳見[第二十三批](./source-family-priority-rollout-20260925.md)。剩餘 597 個待映射層。

第二十四批 [x] 新接 `evChargingStations` 的 2026-06-15 固定 TDX 充電站 3,060 Point owner-only reader。台北、高雄兩地 bbox 與機場來源變體通過原檔 oracle；TDX 座標再散布權／精度仍 [ ] HOLD，不能回答即時可用、最近站或目前費率。雨量站與地下水井的本地資料另發現縣市欄位與經緯度顯著衝突，先列資料品質 [ ] HOLD，不把錯誤縣市帶入比較。當批正常 MCP／地圖因 `BROWSER_DISCONNECTED` [ ] 待補；詳見[第二十四批](./source-family-priority-rollout-20260925.md)。當批剩餘 596 個待映射層。

第二十五批 [ ] HOLD：`animalWelfarePoints` 的 catalog 聲稱 8,525 個 canonical 已定位點，但本機缺 processed GeoJSON 與 SHA，無法核筆數或固定 reader；`facHistorical`／`facPlanned`／`facPrimary`／`facSecondary` 共用電廠檔只有 22 Point，缺四層所需狀態欄及逐筆 geocoder 來源，不能依名稱猜分類。已轉處其他家族，詳見[第二十五批](./source-family-priority-rollout-20260925.md)。

第二十六批 [x] `geothermalWells` 接中油 86147 的 36 口固定歷史井位 owner-only 查詢；宜蘭清水 bbox 11、臺東 bbox 6 與原表獨立 oracle 相符，focused 11/11、`tsc -b`、build 通過。新配對已完成，正常 MCP 兩地回 11／6；宜蘭 11 點 `ready` revision 1，map readback 為 11 features／1 source／1 layer。它只保證這版已列井位，不代表目前井況、可進入或地熱潛力；公開展示同版尚 [ ] 待驗。詳見[第二十六批](./source-family-priority-rollout-20260925.md)。剩餘 595 個待映射層。

第二十七、二十八批 [x] 新接 `accidentTaipei` 的 2019 年 A1/A2 事故參考點 22,918 筆，及 `regulatedFacilities` 的 2026-08-18 active EMS 設施已定位 80,732 筆；兩者均為固定 SHA、owner-only、bbox 必填的安全欄位分片。事故台北 bbox 的 A1 16 筆、臺中列管設施空氣旗標 72 筆與原檔 oracle 一致；正常 MCP 查詢通過，分片路由 localhost 200／外來 Host 404。兩者皆 proxy Point，精確最近、風險及研究地圖呈現 [ ] HOLD；正式展示同版也 [ ] 待核。focused 16/16、`tsc -b`、build 通過；詳見[第二十七、二十八批](./source-family-priority-rollout-20260925.md)。目前剩餘 593 個待映射層。

第二十九、三十批 [x] 新接 `streetTreesTaipeiDiff` 的 99,527 筆 Wayback 對照清冊點，及 `medAED` 的 15,490 個官方 AED 參考點；兩者都以固定 SHA、owner-only 分片做有界 bbox／屬性查詢。正常 MCP 分別查得臺北 disappeared 135、高雄 AED 666，原檔 oracle 相符；focused 15/15、`tsc -b`、build、localhost 路由／Host guard 通過。行道樹「清冊消失」不是砍除，AED 快照不是今日可用或可進入的保證；兩者 proxy Point 的精確最近與研究地圖呈現 [ ] HOLD，正式展示同版亦 [ ] 待核。詳見[第二十九、三十批](./source-family-priority-rollout-20260925.md)。目前剩餘 591 個待映射層。

第三十一批 [x] 裁罰資料密集區分片修復：414,904 筆原檔與新版 597 個 SHA 固定 shards 全量核對；臺北同一小 bbox 從 `DATASET_TOO_LARGE` 改為完整命中 3,051、正常 MCP 回傳 50 並明示截斷，仍守 8 MiB／20,000 列限額。醫療機構 NHI 三層分類可核，但授權／catalog 漂移 [ ] HOLD，未接查詢。詳見[第三十一批](./source-family-priority-rollout-20260925.md)。

第三十二批 [x] `ports` 新接 277 個農業部／TDX 港口參考 Point 的 owner-only bbox／屬性查詢；宜蘭 2、高雄渡輪 7 與完整原表 oracle、正常 MCP 相符，六筆對岸港口的臺灣縣市代碼及四桶分類維持 null。既有地圖是另一份 277 Polygon，與這份 Point 的版次及 TDX 再散布權利 [ ] HOLD；不能把查詢點位當港區邊界。focused 14/14、`tsc -b`、build、localhost 路由／Host guard 通過；詳見[第三十二批](./source-family-priority-rollout-20260925.md)。目前剩餘 590 個待映射層。

第三十三批 [x] NHI 31,603 個地理編碼 Point 共用一份分片原表，接 `medHospital` 451、`medClinic` 診所及其他 23,472、`medPharmacy` 7,680 三個 owner-only bbox／屬性 reader。臺北固定 bbox 正常 MCP 分別命中 28／2,895／692，`clinic` 變體 2,780；全來源 oracle 與 focused test 通過。原 NHI 授權／Google 地理編碼公開再散布及目前營運狀態 [ ] HOLD；proxy 不做最近距離或研究地圖呈現。舊醫院 public reader 保持獨立，未混為同版。

第三十四批 [x] `airports` 接 125 個 OurAirports／TDX 合併參考 Point 的 owner-only bbox／屬性 reader；高雄國際機場、臺北松山機場各以不同 bbox 加 `large_airport` 查得 1，與全原表 oracle 相同。舊地圖資產是 16 個機場面，不等同 125 點；原始下載／TDX 合併時間／同版與公開權利 [ ] HOLD。兩批整合 focused 14/14、`tsc -b`、build、localhost 路由 200／外來 Host 404；詳見[第三十三至三十四批](./source-family-priority-rollout-20260925.md)。目前 195 datasets、191 個查詢映射、587 個待映射層；能查不代表地圖 ready。

第三十五批 [x] `eduCramSchool` 接 17,137 個已定位補習班參考 Point 的 owner-only bbox／類別 reader；原名冊 17,772 筆、635 未定位，精度四類原樣保留。臺北文理類 1,349、高雄 1,140 與完整原表 oracle、正常 MCP 相符；整合 focused 12/12、`tsc -b`、build、localhost 路由／Host guard 通過。座標公開再散布、精確附近、當前立案與研究地圖呈現 [ ] HOLD。詳見[第三十五批](./source-family-priority-rollout-20260925.md)。目前 586 個待映射層。

第三十六批 [x] `companyCapitalGrid` 接 1.5km 尺度 5,745 個 occupied-only 公司資本額格網的 owner-only `grid_id`／屬性 reader；臺北、高雄兩格與完整原檔 oracle、正常 MCP 相符。150m／450m 的 bounded Polygon 分片 reader、公開權利與地圖結果 [ ] HOLD；不得把一尺度完成當整層三尺度完成。

第三十七批 [x] 修正既有無人機空域快照的資料標示：`droneNoFlyZone` 紅 4,311＋無色 1,324＝5,635，不是舊 5,633；來源指向實際共用的 `drone_restricted_zones`，UI 明示 2026-06-30 歷史範圍。`droneNoFlyZone`／`droneRestrictedZone` 研究 reader 與現行飛行判定仍 [ ] HOLD：大多數有效日期缺值、授權只標 OGDL-style，另有跨臺灣 envelope 的幾何異常。詳見[第三十六至三十七批](./source-family-priority-rollout-20260925.md)。目前 585 個待映射層。

第三十八批 [x] 共用 QueryExecutor 已能用完整 Polygon/MultiPolygon 與 bbox 相交，不採質心；洞、多面、邊界及超限反例有測試。公司 1.5km 格網兩個新城市小範圍在正常配對 MCP 各查得一格，並維持 generalized geometry 空間分析不合格。150m／450m 仍需分片。

第三十九批 [x] `waterDetentionBasins` 接臺南 45＋桃園 11 個固定名冊參考 Point 的 owner-only 查詢；臺南 bbox 11、桃園 bbox＋縣市篩選 8 與既有展示全檔 oracle、正常 MCP 一致。桃園 11 筆面積 null，56 筆均缺容量與現況；其他縣市不在此來源。當時 `waterFacilities` 同版未清已由第四十一批補核；`waterMonitorStations` 的混合站與錯置縣市樣本仍 [ ] HOLD。詳見[第三十八至三十九批](./source-family-priority-rollout-20260925.md)。當時 584 個待映射層。

第四十批 [x] `companyCapitalGrid` 補齊 150m 89,754 格與 450m 26,834 格有界 Polygon reader，連同先前 1.5km 形成三個尺度。臺北與高雄兩個新 bbox 的四個正常 MCP 命中數為 152／30、17／6，皆與各尺度完整來源 oracle 相同；focused 14/14、`tsc -b`、build、localhost 路由與 Host guard 通過。這仍是 occupied-only、generalized 公司地址聚合格網；公開權利和研究地圖 ready/readback [ ] HOLD。

第四十一批 [x] `waterFacilities` 已證明 Mini 609 Point 恰為 OSM 526＋WRA GIC 83 的逐筆同版聯集，接 owner-only 有界 bbox／屬性 reader。臺北 149、臺南官方抽水站 1 與全檔 oracle、正常 MCP 相同；原始缺值與來源語意保留。WRA 再散布權利、精確附近及研究地圖 ready/readback [ ] HOLD。詳見[第四十至四十一批](./source-family-priority-rollout-20260925.md)。目前 201 datasets、195 個查詢映射、583 個待映射層。

第四十二批 [x] `waterMonitorStations` 2,032 Point 已對回三個 WRA 固定名冊並接 owner-only bbox／站型／歷史 active reader。臺北 56、宜蘭 active 河川站 5 與來源 oracle、正常 MCP 相符；固定縣界檢核有 360 筆 reported county 與落點不合，故禁止以原縣市篩選或聚合。原始 WRA payload／公開授權、目前站況、精確附近及研究地圖 ready/readback [ ] HOLD。詳見[第四十二批](./source-family-priority-rollout-20260925.md)。目前 202 datasets、196 個查詢映射、582 個待映射層。

第四十三批 [x] 只完成 `waterReservoirs` 相關 WRA GIC 壩堰 98 Point 的獨立 owner-only reader：北部 5、南部 8 與原表 oracle、正常 MCP 相符。這是部分來源接線，非整層完成；現有 111 點混合展示的 37 個水庫代表點缺版次／原表收據，129 個水庫 MultiPolygon 最大單面超過 8 MiB 限額，均 [ ] HOLD。`waterReservoirs` 雖進入查詢映射統計，不可說 111 點與 129 面都保證可查。詳見[第四十三批](./source-family-priority-rollout-20260925.md)。目前 203 datasets、197 個查詢映射、581 個待映射層。

第四十四、四十五批 [x] `trafficAccidentYearly` 1,600 個 A1 事故與 `theftTaoyuan` 1,423 個竊盜歷史 Point，各以原始與處理檔固定 SHA 建 owner-only 安全欄位 reader。正常 MCP 埔里事故 11、臺北事故 36、桃園住宅竊盜 138，與全表 oracle 一致；focused 11/11、localhost 兩端點 200／外來 Host 404 通過。竊盜 `district_raw` 全空、年度混用，已禁止年月比較；兩層展示 GeoJSON 缺檔、精確最近／公開地圖／現在風險 [ ] HOLD。詳見[第四十四至四十五批](./source-family-priority-rollout-20260925.md)。目前 205 datasets、199 個查詢映射、579 個待映射層。

第四十六批 [x] `fireHydrants` 接 69,839 筆 A/E processed CSV 固定快照的 owner-only 分片 reader，臺北 bbox 2,179、高雄 bbox 5,275 與全 CSV oracle、正常 MCP 相符；全臺過大範圍安全拒絕。臺北 XML 21,852 是替代來源，資料庫去重 69,815 是另一版本，均未混入；僅安全 ID／縣市代碼／型式／來源／geometry，地址排除。focused 12/12、localhost manifest 200／外來 Host 404 通過；現在可用性、精確最近、remote 同版和地圖 ready/readback [ ] HOLD。詳見[第四十六批](./source-family-priority-rollout-20260925.md)。目前 206 datasets、200 個查詢映射、578 個待映射層。

第四十七批 [x] `culturalFacilities` 原有 787 個展示 Point reader，本批補其完整 1,170 列來源的 owner-only reader，其中 383 無座標列保留屬性可查。正常 MCP 臺北 184、實體書店變體 135、高雄 47、全名冊無座標 383，皆對上原表；focused 11/11、`tsc -b`、build、localhost 200／外來 Host 404 通過。精確最近、今日營運和研究地圖 ready/readback [ ] HOLD。這是已映射層的資料完整性補強，映射數仍 200；目前 207 datasets、578 個待映射層。詳見[第四十七批](./source-family-priority-rollout-20260925.md)。

第四十八批 [x] `groundwaterWells` 只接 WRA 959 個固定觀測井站位 owner-only 分片 reader，嘉義 32、宜蘭 39 與完整原表 oracle、正常 MCP 相同；另外兩個 bbox 回 26／53，可重新計數。`elevation_m` 全 null、`is_active` 全 false 且與來源文件矛盾，縣市欄亦可能錯置，均不提供篩選或比較。focused 13/13、`tsc -b`、build、localhost manifest 200／外來 Host 404 通過。`groundwater` 動態讀值、精確最近和研究地圖 ready/readback [ ] HOLD。詳見[第四十八批](./source-family-priority-rollout-20260925.md)。目前 208 datasets、201 個查詢映射、577 個待映射層。

第四十九批 [x] `agriRetail` 接 2026-05 經濟部農產品零售公司固定快照 37,430 個 TGOS 地址定位 Point 的 owner-only 有界 reader；原始 58,613 列中核准 37,789、定位失敗 359。正常 MCP 臺北框 6,082、臺中框 3,987，均與完整原表 oracle 相同；focused 12/12、`tsc -b`、build、localhost manifest 200／外來 Host 404 通過。統編、公司名、負責人、地址與資本未進 sidecar；公開座標再散布、今日營業、精確最近和研究地圖 ready/readback [ ] HOLD。詳見[第四十九批](./source-family-priority-rollout-20260925.md)。目前 209 datasets、202 個查詢映射、576 個待映射層。

第五十批 [x] `livestockFarmCattle/Chicken/Duck/Goose/Other/Pig/Sheep` 七層共用同一版 13,087 Point 原檔，各自只回對應畜種；嘉義七類共 648、屏東七類共 1,944 與完整原表 oracle 相同，正常 MCP 嘉義雞 331、屏東豬 916、嘉義其他 13。focused 12/12、`tsc -b`、build、localhost manifest 200／外來 Host 404 通過。定位混含低精度段中心、Google 與其他來源，公開授權、全國完整性、現行 RPC、精確附近與研究地圖 ready/readback [ ] HOLD。詳見[第五十批](./source-family-priority-rollout-20260925.md)。目前 216 datasets、209 個查詢映射、569 個待映射層。

第五十一批 [x] `agriProduceWholesale` 接蔬果批發公司 2026-05 固定快照 22,843 個 TGOS 地址定位 Point，原始 35,218、核准設立 23,046、定位失敗 203。正常 MCP 臺北 3,446、臺中 2,296，臺北加解散狀態為 0，均與完整原表 oracle 相同；focused 12/12、`tsc -b`、build、localhost manifest 200／外來 Host 404 通過。公開座標再散布、現今營業、精確最近與研究地圖 ready/readback [ ] HOLD。詳見[第五十一批](./source-family-priority-rollout-20260925.md)。目前 217 datasets、210 查詢映射、568 待映射層。

第五十二批 [x] `religionTemples` 接 MOI／文資／百景／OSM 合併 19,201 個寺廟實體固定 Point；其中 6,702 為 OSM-only，不能稱全部已登記。正常 MCP 臺南 MOI 補辦登記 109、高雄 OSM 99，與完整原表 oracle 相同；focused 13/13、`tsc -b`、build、localhost manifest 200／外來 Host 404 通過。OSM 授權標示、Google 補點公開再散布、精確附近、現行登記及研究地圖 ready/readback [ ] HOLD。詳見[第五十二批](./source-family-priority-rollout-20260925.md)。目前 218 datasets、211 查詢映射、567 待映射層。

第五十三批 [x] `streetTreesNational` 接臺北 92,033 加臺中 118,403 株的固定樹籍 Point，共 210,436；名稱「全國」不代表涵蓋其他縣市。正常 MCP 臺北框 1,187、臺中框 701，其中臺中公園廣場 316，與完整原表 oracle 相同；focused 12/12、`tsc -b`、build、localhost manifest 200／外來 Host 404 通過。兩市時間不同、臺中公園樹不全是路旁樹；縣市同時點比較、精確最近與研究地圖 ready/readback [ ] HOLD。詳見[第五十三批](./source-family-priority-rollout-20260925.md)。目前 219 datasets、212 查詢映射、566 待映射層。

第五十四批 [x] 去重盤點：`religionChurches`、`religionAncestralHalls`、`religionFoundations`、`religionOtherWorship`、`religionTop100` 都已在第十七批具 owner-only reader 與正常 MCP 收據；本批試做的四份重複 sidecar 未接入且已撤回，既有 registry tests 12/12 通過。宗教百景的 2021 精選現況仍 [ ] HOLD，但查詢入口不是待接。映射數維持 212，下一游標是 `medLTC` 2026-08-11 固定來源；詳見[第五十四批](./source-family-priority-rollout-20260925.md)。


第五十五批 [x] `medLTC`：衛福部 2026-08-11 長照特約單位，raw 24,409 筆，扣無座標 332、臺灣範圍外 183，owner-only 查詢 23,894 Point。正常 MCP 臺北 A 類 51、臺中 C 類 1，與完整原表 oracle 一致；focused/registry 12/12、`tsc -b`、build、localhost 200／外來 Host 404 通過。這與 `welfareLtcInstitutions` 3,117 筆是不同來源；即時特約、床位、附近距離、縣市比較及地圖 ready/readback [ ] HOLD。詳見[第五十五批](./source-family-priority-rollout-20260925.md)。目前 220 datasets、213 查詢映射、565 待映射層。

第五十六批 [x] `treePitsTaipei`：56,720 個原面 MultiPolygon，官方 data.gov.tw:134908／臺北資料大平臺 OGDL 第 1 版；2026-09-26 官方 raw 與本地 SHA 完全相同。有界 Polygon reader 保留孔洞與 multipart，跨片去重，兩個臺北 bbox／類別變體與完整原表 oracle 相符；正常 MCP 查詢、配對地圖 15 features ready/readback、focused 4/4、`tsc -b`、build 通過。畫面高亮因樹穴面積很小，單一面目視辨識 [ ] 待改善；公開部署及目前現況 [ ] HOLD。詳見[第五十六批](./source-family-priority-rollout-20260925.md)。目前 222 datasets、215 查詢映射、563 待映射層。


第五十七批 [ ] 待做：`powerPoles` 上游 22 縣市、2,959,326 Point，台電 2026-06-15 快照。已逐檔核完 22 raw CSV／22 processed GeoJSON 的 SHA、bytes、筆數、空桿號與幾何；raw／processed／manifest 筆數相同，同 pipeline 的 pandas 讀法核得空桿號 616,007；原差 36 是彰化 CSV parser 定義差異，屏東、臺東、桃園各有 1 筆地理離群座標。澎湖／金門／連江本地檔共 28,415 筆，與 catalog 的端點缺口說法衝突；Mini PMTiles 仍缺同版建置收據。先解決來源與座標差異，再做有界 reader 和新地點驗收。詳見[第五十七批](./source-family-priority-rollout-20260925.md)。


第五十八批 [x] `activeFaults`：活動斷層地質敏感區本地原始檔與現有 GeoJSON byte-identical，22 個 Polygon／MultiPolygon、SHA `a05a2afaf1f17b6be9e3cb7ed605fbbe35e3ea72ee0d654bf1fea97b89543b1e`。新 reader 只供官方代碼與完整水平面幾何；大甲 F0012、米崙 F1011 的新 bbox oracle 與正常 MCP 一致，配對地圖結果 1 feature／1 source／1 layer ready/readback。focused/registry 12/12、`tsc -b`、build 通過；正式法定圖、現況與風險判定 [ ] HOLD。詳見[第五十八批](./source-family-priority-rollout-20260925.md)。目前 221 datasets、214 查詢映射、564 待映射層。

第五十九批 [x] `companyAgeStructure`／`companyIndustryDistribution` 共用 202608 company_points 654,165 筆的 grid 母表，接 450m／1500m 兩尺度 occupied-only Polygon owner-only 查詢。產業 89 類與未知類、設立年 known/missing/invalid 分別保留；臺中與臺北兩地原表 Polygon oracle、正常 MCP、地圖 ready/readback 且目視格網高亮完成。focused/registry 13/13、`tsc -b`、build、localhost 200／外來 Host 404 通過。118 份上游權利收據、即時公司現況、空白格為零、縣市比較及公開發布 [ ] HOLD。詳見[第五十九批](./source-family-priority-rollout-20260925.md)。目前 226 datasets、217 查詢映射、561 待映射層。

第六十批 [x] `cyclingRoutes` 已接 2026-03-01 TDX 固定 1,749 條 MultiLineString；Mini GeoJSON 與 analytics processed byte-identical。臺北 bbox 的真正線相交 4 條與獨立原檔 oracle 相符，跨框／邊界反例、focused 4/4、tsc/build 通過；正常配對地圖 revision 11 ready/readback 4 條、目視有線。完工日期處理錯誤欄位已隱藏，不能推論現時可騎乘或路網可達。[第六十批收據](./source-family-priority-rollout-20260925.md)。

第六十一批 [x] `forestRecreation` 已接 1151 版 23 個完整 Polygon/MultiPolygon，僅 localhost owner-only；合歡山、惠蓀、阿里山與棲蘭子園區變體對原表，focused 2/2、tsc/build 通過；合歡山面 revision 13 ready/readback 1、目視高亮。缺值不是零，公告範圍不等於入口、步道或開放現況；既有展示同版 [ ] HOLD。[第六十一批收據](./source-family-priority-rollout-20260925.md)。

第六十二批 [x] `aquacultureZone` 已接 62 個法定養殖生產區，保留完整面並以真實相交查詢；臺南與宜蘭原表變體、空框與改版拒絕 focused 3/3，tsc/build 通過。雲林麥寮結果 revision 14 ready/readback 1、目視高亮；不能當現況、產量或空框零養殖，既有展示同版 [ ] HOLD。[第六十二批收據](./source-family-priority-rollout-20260925.md)。合計 229 datasets、220 查詢映射、558 待映射；臺灣主 Layers 381 已註冊 166、待 215。

第六十三批 [x] `serviceAreaPolygon` 已接 19 個 OSM 原面，與 22 個官方服務區點分開計數。東山、泰安北上兩地原表及方向變體、空框與 SHA 改版拒絕 focused 3/3、tsc/build 通過；東山正常 MCP 1 面，revision 15 ready/readback 1 且目視高亮。幾何 ODbL 與屬性 OGDL 分開標示；OSM 邊界不是入口或目前服務。[第六十三批收據](./source-family-priority-rollout-20260925.md)。合計 230 datasets、221 查詢映射、557 待映射；臺灣主 Layers 381 已註冊 167、待 214。

第六十四批 [x] `eduCampusPolygon`／`eduCampusArea` 共用 TGOS 4,336 筆 Polygon owner-only 分片查詢，含舊展示排除的 12 筆 `non_school`；完整原表臺北、花蓮與學制變體測試、SHA 拒絕 focused/registry 13/13、tsc/build 通過。臺北大同大學面正常 MCP 1 筆，revision 16 ready/readback 1、目視高亮。`source_yyyymm` 僅來源月份欄，不當可精確時間篩選；校地不等於入口、學區或可達性。[第六十四批收據](./source-family-priority-rollout-20260925.md)。合計 231 datasets、223 查詢映射、555 待映射；臺灣主 Layers 381 已註冊 169、待 212。

第六十五批 [x] `aviationNoiseZones` 桃園／高雄 76 個法定里別代理面固定版已可查；桃園山東里及高雄仁愛里兩個地點與分級變體對原表，`effective_date=null` 不補日期。代理面只供 bbox／屬性查詢與地圖高亮，非噪音等值線或點位曝露。focused/registry、tsc/build；高雄正常配對 revision 18 ready/readback 1、目視藍色面。[第六十五批收據](./source-family-priority-rollout-20260925.md)。合計 232 datasets、224 查詢映射、554 待映射；臺灣主 Layers 381 已註冊 170、待 211。`waterBasins` 缺 raw/processed 同版與舊面積單位問題，G1/G2 HOLD。

第六十六批 [x] `tourScenicAreas` 只接觀光署來源 34 面中的 12 個國家風景區面，逐名與完整幾何對來源；雲嘉南濱海缺於備援源，展示增補的訪客數／年增率缺收據而不輸出。大鵬灣、馬祖兩地與名稱變體有獨立原面對帳，focused/registry 13/13、tsc/build；大鵬灣正常配對 revision 19 ready/readback 1、目視藍色面。[第六十六批收據](./source-family-priority-rollout-20260925.md)。合計 233 datasets、225 查詢映射、553 待映射；臺灣主 Layers 381 已註冊 171、待 210。`aquacultureCageNet` 來源日期與 raw SHA 缺口先列 G1 HOLD。

第六十七批 [x] `tourHotSpringZones` 16 個臺北市公告面已與 FY114 原 ZIP、處理檔和 Mini 展示逐筆對齊；來源閉合線經 CRS/面積檢查才轉面，13 個空備註保留，資產名雖有 national 仍僅臺北覆蓋。硫磺谷、地熱谷、馬槽同名變體及錯版拒絕 focused/registry 12/12、tsc/build；硫磺谷正常配對 revision 20 ready/readback 1、目視藍色面。[第六十七批收據](./source-family-priority-rollout-20260925.md)。合計 234 datasets、226 查詢映射、552 待映射；臺灣主 Layers 381 已註冊 172、待 209。

## B．優先完成臺灣 GIS 資料查詢

18 個 metadata 候選與 537 個尚無可用映射的層是同一施工佇列的不同來源狀態；本階段兩邊都處理，不能只接容易的候選。

- [ ] B01：完成臺灣靜態 Point 家族：原表可讀、完整列數核對、固定版本 reader、安全欄位與分頁；同一家族所有可接的圖層一次映射。原表無座標列仍可查屬性，代理座標與原生座標分開。
- [ ] B02：追查臺灣「來源證據不足」家族：先找現有原表／collector／RPC 與發布紀錄，再做可逆本地重建。每個家族產出可接資料或具體外部阻擋；不能只重複舊台帳結論。
- [ ] B03：完成縣市界資料讀取與幾何傳輸限制修復，確認同版／授權，驗收點落在哪個縣市及範圍相交；測試洞、多面、邊界和非臺灣點。現有 local preview 不算完成。
- [ ] B04：完成林道點到線距離及線相交：新地點、跨 bbox 不漏線、重複線去重口徑、完整線幾何地圖驗收。已有 line reader 與單線顯示只算部分完成。
- [ ] B05：完成公司點授權追查；允許後建有界分片與公開欄位 reader，兩個城市對全表 oracle。授權未過則 HOLD，其他家族繼續。
- [ ] B06：依已證實來源接其餘臺灣 Polygon／Line／格網；保留原幾何與 NoData、單位、精度。影像只有配色而無原值時列展示限定，仍記具體原因。
- [ ] B07：處理臺灣動態 RPC／事件資料：觀測時間、有效期限、失效及缺測契約、有界查詢；過期資料不可標現在。避免每個請求掃全表。
- [ ] B08：回查既有缺口：農業 POI 331→330、景點非零座標 6,071→6,070 的差異；遊樂園展示文案 26 與名冊 27；公廁原始列與地址合併代表點的查詢範圍。能修補就修補，無法補齊須保留排除證據。
- [ ] B09：臺灣資料查詢整體驗收：此組每層都有合格 reader 的實際查詢證據，或未勾選且有解鎖條件的 HOLD；待調查及可自主處理卻未做的家族為 0。若尚有 HOLD，標「可自主施工完成，仍受阻」，不得稱全部可用。

首批高覆蓋查找入口：加油站（宣告上游 8 層，實際另有一個未宣告同源的 `gasCoverageAll`；5 個站點層與 4 個覆蓋衍生層需分開）、廢棄物設施（9）、畜牧場（7）、學校（6）、污染來源（6）、警察設施（4）、電廠（4）。這些只是候選宣告層數，A03 必須先證明共用來源與授權，再決定是否接入；不預先打 GO/HOLD。廢棄物設施目前的 processed 主檔僅 66 筆政府 Point，OSM 對照 237 筆，catalog 自承與數百筆 Supabase 表可能不同步，且含 Google geocode 座標；不得以這兩檔直接宣稱九層完整或公開可用。

## C．縣市資料查詢與比較

- [ ] C01：逐家族核對基本統計：exact release、年份／期間、縣市碼、指標定義、單位、分母、缺值／抑制／零值與來源授權；固定版本須能實讀並取得 receipt。
- [ ] C02：先處理有本地原表的縣市運輸供給六指標（2023／2024），查明既有 release 可否讀取；若只缺本地可攜資產，在現有統計契約內準備本地驗收版本。不得把缺正式部署視為禁止本地實作，也不自行發布。
- [ ] C03：完成各基本統計家族 reader：22 縣市或來源明定的實際覆蓋、缺縣市原因可查，換年份仍能正確讀取；不能用只有 descriptor 的狀態勾完成。
- [ ] C04：逐一處理 188 個衍生比較 recipe：分子／分母的來源版次、同期間、同地理口徑、單位及零分母規則可追；依真正相同的輸入契約成批接入，188 項逐項驗收或列未解阻擋。
- [ ] C05：用至少兩組不同縣市及期間做比較驗收；包括絕對數、合法的人均／比例比較與不能比較的反例，地圖保留來源及期間。臺北／臺中無障礙公車例只算現有單項證據。

## D．全球 GIS 與日本 GIS

- [ ] D01：全球 Point 按來源建 bbox 分片／索引與完整母體／排除台帳；先處理已盤到的 `worldTrashDebris` 25,000 點，核對來源覆蓋偏差和授權。
- [ ] D02：完成全球其餘家族；測試臺灣以外兩個新地點、空結果、經緯度邊界／跨日期變更線（適用時），再按該組全表逐層對帳。
- [ ] D03：日本先處理已盤到的 `jpWaterQualityStations` 2024 固定來源 9,831 點，核對可公開權利、測項／期間與缺值，不把測站存在等同有當期觀測。
- [ ] D04：完成日本其餘合法可用家族；owner-only、非商業等逐項核權，未解者保持未勾選。以兩個新地點及問題變體驗收。

## E．讓使用者一次問周圍資料

- [x] E00：既有 typed plan 可把三個已接通 Point 家族查詢並同圖呈現。臺北 750 公尺公廁 36、運動場館 27、活動中心 4；共 67 筆／3 sources／3 layers ready/readback。見來源家族施工紀錄。此項不等於自動找齊附近來源。
- [ ] E01：實作依已驗證 descriptor 自動選候選的附近流程，按來源地理覆蓋、權限、時間及支援運算選擇；每家族只查一次，資源上限與分批延續可見。
- [ ] E02：依幾何路由點距離、線距離、面包含／相交及有原值的格網取樣；有失敗或超限時呈現未完成家族，不把缺漏當零，不聲稱已查全部。
- [ ] E03：答案與地圖按類別呈現，列出已查範圍、未查來源、版本、排除數與截斷；空間合格資料可查附近，屬性限定資料能說明但不硬算距離。
- [ ] E04：用都市、鄉村、山區、離島的新地點驗收；問法包含「附近有什麼」「最近設施」「這個範圍碰到哪些地區」。依來源覆蓋給結果及缺口，不以單一示範題完成整體。

## F．穩定性、成本與交付

- [ ] F01：版本／欄位／筆數不符時明確拒絕或回報，更新來源後能重產、重驗；快照時間、缺值、proxy 與 stale 語意不流失。
- [ ] F02：大來源有分片或索引、快取與下載量／查詢量實測，Supabase 使用有界讀取；記 cold/warm 成本，不用一次全量載入拖垮附近查詢。
- [ ] F03：重跑 778 層對帳：無漏列／重複；全部合法且資料可得的家族完成必要 gate，剩餘 HOLD 逐項附外部需求；可做而未做數量為 0 才可稱本地施工結束。
- [ ] F04：交付完成／未完成清單、每項證據、可問案例和精確 commit；另列正式環境发布待辦。部署不是本次授權的一部分，不能宣稱已上線。

## 每個來源家族的固定子清單

在 A02 的佇列為每個已核 source family 建一筆，帶入以下欄位與勾選狀態；一個家族服務多個圖層時列全部 layer keys，不重複處理同一原表。

| Gate | 可打勾的條件 |
|---|---|
| G1 來源 | 找到可讀原始／固定發布資料；來源機關、版次／SHA、授權、時間及實際取得位置可核對 |
| G2 完整性 | 原表、處理表、查詢表筆數與差異對帳；缺值、無座標、代理座標和排除逐類記錄 |
| G3 資料可查 | 合法欄位、篩選、分頁與完整母體查詢實讀通過；屬性查詢保留可公開的無座標列 |
| G4 可分析範圍 | 明列准許／禁止運算；有幾何者新地點＋問題變體及獨立 oracle；屬性限定附原因，空間 gate 標不適用 |
| G5 整合驗收 | 必要測試、tsc/build；正常 Codex→MCP→Gateway→browser 實讀，地圖合格結果 ready/readback＋目視；純屬性結果不強迫地圖 |
| G6 交付 | exact-path commit、逐層狀態與證據同步，成本／剩餘缺口入帳；隨後取下一家族 |

HOLD 記錄格式：`family / layer keys / 卡在哪個 gate / 已查路徑與結果 / 還缺什麼 / 可否本地補救 / 解鎖者與動作 / 重查觸發條件`。必須保留下一步，不以 HOLD 充當完成。

## 當前游標與每次回報

**下一項：A03 繼續下一個可證臺灣 GIS 原始家族。** 第七十八至八十一批已接通 OSM 輸電線／塔、製造業公司子集、六項縣市交通統計與 22 個完整縣市界面，詳見施工紀錄。`countyBoundary` 已通過固定來源、臺北／高雄查詢及正常地圖驗收；B03 整批仍待補洞、多面邊緣、邊界點和非臺灣點的完整回歸。`real_estate` 六層因來源混合、座標精度與展示同版未證維持 HOLD；`waterBasins`、`waterProtectionZones`、`powerPoles`、畜牧附屬點仍保留原 HOLD。當前 778 層中 243 個有可查映射、535 個待處理；臺灣 GIS 381 層中 183 個已登記、198 個待處理。

每次回報只需：本次勾選哪些 ID、四組各有多少層真正通過／待做／HOLD、新增家族及映射、驗收證據、尚未解鎖的具體需求、下一個游標。登記數／來源查詢通過數／空間通過數分開。不要求使用者每批重新說「繼續」。

保留既有授權邊界：隔離 worktrees、保護原 checkout 與配對；不擴大付費呼叫、不 push／PR／merge／部署、不重啟過夜排程。全案本地完成與正式發布分開驗收。
