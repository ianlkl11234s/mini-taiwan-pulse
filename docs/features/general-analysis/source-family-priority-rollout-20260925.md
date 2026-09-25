# 來源家族優先施工：先保證可查，再擴大分析

後續執行入口：[全圖層查詢完成清單](./completion-checklist-20260925.md)。依其中工作 ID 與 gate 勾選；本頁保留來源判定及逐批驗收歷史，早期 HOLD 必須依後續證據重新判定。

2026-09-25。依使用者指定順序執行，沿用 [P0–P7 施工計畫](./all-layer-spatial-coverage-execution-plan-20260925.md) 的來源、runtime、地圖與 commit gate。以下「保證」只指固定版本、已核對範圍與欄位；不表示資料來源涵蓋所有真實世界物件、即時有效或已部署。

## 優先順序與交付定義

1. **臺灣 GIS layers**：先把具合法完整原表的 Point 家族接成 source SHA/count 驗證 reader，再做 Line、Polygon、格網。先有資料查詢與來源收據，再驗證附近、相交、最近距離及地圖 readback。同一家族共用 reader；不按 layer 名逐個寫。
2. **縣市統計**：固定 release／indicator／縣市碼、單位與分母；可查 22 縣市的觀測值與缺值狀態，再做合法比較。統計本身無幾何，縣市界僅作同版 join 與呈現；不把數值偽裝成 Polygon source。
3. **全球 GIS 點位**：有全球完整性與授權證據的來源先做 bbox 分片或索引；查詢只讀必要地理範圍，檢查世界覆蓋偏差與時間限制。
4. **日本 GIS**：按 release 與授權逐家族接入，先做可公開的固定 Point，再處理 owner-only 或非商業 HOLD 資料。
5. **衍生比較統計**：基礎資料、版本、分母、缺值規則與地理 join 都通過後才啟用；188 個 recipe 不能直接算成已可查。

每片報告四種數字：新增來源家族、dataset、queryable layer mapping、spatial-ready layer mapping；另列 HOLD 原因。每片使用新地點及問法變體、獨立 oracle、focused test、`tsc -b`／build、Codex→MCP→Gateway→browser `ready`／readback；只有實際跑過的 gate 才標通過。每次僅取用本地固定資產或既有服務，不自動上傳 S3、寫 Supabase 或新增付費來源呼叫。

## 第一批來源判定

| 優先 | 家族／層 | 來源狀態 | 下一步 |
|---|---|---|---|
| 臺灣 GIS | `public_toilets`／`publicToilets` | 原表 45,718 列；11 筆無效座標排除，48 筆顛倒修正；按地址分組成 13,281 個代表 Point。Mini 與 analytics compact output SHA `3f8f9e75b6f05e3697a0af90224bed792e435b1605678ce8182f6045e5d2bc5b`；OGDL 1.0。只有 name、county、grade、type2 四個發布欄位，type2 有 2 筆空字串；批次 2026-07-17 非觀測日。 | 本批已建立固定 SHA reader，花蓮 2 公里 35 個代表點正常配對地圖 `ready`／readback 通過；見下方收據。|
| 臺灣 GIS | `community_centers` | 處理 1,812、Mini 1,794 個 Point；僅 8 縣市與部分行政區，18 筆缺座標。 | 下批先釐清 18 筆差異與覆蓋描述；不能稱全國完整。|
| 臺灣 GIS | `public_retail_markets` | 處理 731／789 Point，58 筆缺座標，Mini 顯示資產缺失。 | HOLD：補齊固定資產與同版驗證。|
| 縣市統計 | `dgbas_county_transport_supply_10935` 六層 | 12 個 2023／2024 releases ×22 縣市，本機 264／264 observed；OGDL 1.0。Mini 尚無可讀 CDN release receipt。 | `VERSION_MISMATCH`：先將同版 release 與縣市界納入可讀圖，再接六個 exact recipes；缺值不可補零。|
| 全球點 | `worldTrashDebris` | 25,000 Point 固定資產與 analytics web SHA 相同，CC-BY-4.0；無事件時間，台灣 0 筆；有 Mapillary 覆蓋偏差。 | 下批先建 bbox shard，再接 bounded reader；不能解讀成垃圾實際分布。|
| 日本點 | `jpWaterQualityStations` | 2024 固定 release 9,831 Point、PDL 1.0、processed→public SHA 鏈完整。 | 全球點後建空間分片與 reader；owner-only 資料維持 HOLD。|

舊 778 層台帳的 594 個未對應／不可用層，已按共同來源與 blocker 分類；不是 594 個獨立待開發資料庫。縣市界仍缺正式資產同版／授權驗收；林道只有有界線資料查詢，未有點到線距離的產品全鏈；公司點缺公開權利證據。這三片各維持原 HOLD，不拿來灌第一批完成數。

## 第一片實作與本機全鏈收據

- 新增 1 個原始資料家族、1 個 query dataset、1 個 queryable layer mapping、1 個 spatial-ready Point mapping：`tw-public-toilets-source-coordinates` ↔ `publicToilets`。本次未新增展示圖層；現有 manifest、圖例、popup 與預設顯示設定沿用。
- 重跑 capability audit：778 manifest layers、87 registered datasets、80 queryable layer mappings、104 個另列 metadata GeoJSON candidates、594 unknown/unavailable。公廁原是 metadata candidate，這次轉成正式映射，所以 metadata 減 1；594 個 unknown 並未因此減少。舊日期的 105／594 台帳是施工前快照，不覆寫。
- `public/environment/public_toilets_national.geojson` 為 2,761,031 bytes／13,281 個有效 Point；Mini 與 analytics output SHA 相同。reader 每次讀取先檢查固定 SHA 和完整 count，差異直接拒絕，不落到 metadata-only 推測。來源與欄位限制見 `src/research/publicToiletsDataset.ts`。
- 獨立 Python Haversine oracle：花蓮 `[121.606,23.98]` 2,000m 得 35 筆。正常配對 `pulse_query_records` 以完整包含圓的 bbox `[121.585,23.960,121.627,24.000]` 得 44 個候選，SHA receipt 同上；`pulse_spatial_query(within_distance)` 得 35，`pulse_present_result`→`pulse_wait_scene_ready` revision 10 `ready`；`pulse_get_map_context` readback 為 35 features／1 source／1 layer、`sourcesReady=true`、`layersReady=true`，IAB 地圖目視有 35 個藍色點。這是來源座標的地表直線距離，不是步行距離或目前可用公廁數。
- 另一問法／較小範圍：同中心 500m 查得 5 筆，revision 8 `ready`／map readback 5 features；focused test 2/2、`npx tsc -b`、`npm run build` 通過。初次呈現 35 筆時原分頁熱更新後回 error；重新載入**同一已配對分頁**後重新取結果，35 筆正常 ready/readback。未切換或清除既有配對。
- 本片是本機 3734→8794→MCP→browser 驗收；未證遠端 CDN/S3 或 production 同版，沒有寫 Supabase、S3、push、PR、merge 或部署。

## 第二批：臺灣 GIS 固定來源擴充（本機）

- 運動場館：同一 15,000 筆固定來源衍生 5 個 queryable layer mapping；sidecar SHA `28da39f158143c8dfd75ea8dd3755d9e91a3c56bd9fbabfa07e953a410c0dccb`。臺東 `[121.15,22.76]` 1 公里，bbox 44 筆、直線距離 29 筆，與獨立 Haversine oracle 相同；配對地圖 29 features／1 source／1 layer `ready` 與 browser readback 通過。380 筆面積 null 不補零；`open_status` 僅為來源快照。既有展示資產 `sports/all_venues.geojson` 在此 worktree 缺失，故此證據只保證分析讀取與 transient overlay。
- 社區活動中心：原本 1,794 個展示 Point 中僅 592 筆為來源原生座標，已建立單獨可做附近查詢的 reader；其餘 1,202 筆代理座標排除。臺北 `[121.55,25.05]` 1 公里，bbox 15、直線距離 9，獨立 oracle 與配對地圖 9 features `ready`／readback 均通過。原處理表另有 18 筆無座標；仍不稱全國完整。
- 聲音照相設備：固定名冊 333 筆全可查屬性，267 筆代理點、66 筆 null geometry；查詢 `spatial_precision=unlocated` 得 66。所有代理點均禁止附近運算；這不是當前設備運作狀態。
- 官方噪音測站：固定原表 426 筆全可查，415 筆來源 Point、11 筆 null；159 筆有 LAeq、267 筆 null。`fresh/historical/unavailable` 15／144／267 是來源建檔日 2026-08-27 的分類，不能當今日新鮮度。嘉義 `[120.44,23.48]` 2 公里 bbox 14、距離 13，獨立 oracle 與配對地圖 13 features `ready`／readback 均通過；LAeq 只代表實際取得樣本的能量平均，不代表完整 30 天或法規符合。
- 遊樂園：交通部觀光署固定名冊 27 筆全可按屬性查；24 筆園區來源地址座標可做附近分析，2 筆停車場代理點及 1 筆無座標排除。sidecar SHA `65e70b6312204b5b40b974e382e328f88d872d139a845e435c6e70e3b1b0c4ea`。屏東 `[120.557,22.549]` 3 公里查得 1 筆「8大森林樂園」，49.6 公尺；MCP `ready` revision 7，map readback 1 feature／1 source／1 layer。現有 manifest 文案稱 26 家，與固定名冊 27 筆不一致，顯示資產與分析來源同版尚待核對。
- 本批新增 5 個來源家族、6 個 query datasets、9 個 queryable layer mappings，其中運動場館 5、活動中心 1、聲音照相 1、噪音測站 1、遊樂園 1；可做附近運算的 mapping 為 8，聲音照相代理名冊不可。capability audit：778 manifest layers、93 registered datasets、89 queryable mappings、95 metadata candidates、594 unknown/unavailable。unknown 數量不降，是因本批把既有 metadata candidates 轉為正式 reader；這個數字不能當完成率。來源快照、授權、缺值和幾何排除逐家族寫在對應 dataset descriptor。
- 本批 focused test、`npx tsc -b` 與 `npm run build` 通過；驗收範圍為本機 3734→8794→MCP→browser，未寫 Supabase/S3，也未證遠端或 production。

## 第三批：同家族全名冊與露營場

- 活動中心新增 companion attribute reader `tw-community-centers-listed`：以固定 SHA `898e50bf7109b80675ac46203cf8c9fb94f88a76549037d373710ff856247774` 驗證 processed 1,812 筆；592 native、1,202 proxy（TGOS 1,143／L1 53／離線 6）、18 null。MCP 正常配對查詢全名冊得 1,812，`coord_method=no_coord` 得 18 且 geometry 均為 null。全名冊禁用 bbox/nearest；原生座標 592 筆沿用上一批獨立 reader。兩個 datasets 共用同一原始家族與一個 layer mapping，不能灌成兩層。
- 露營場 `tourCamping`：觀光署 nid 132066 的 2026-05-24 固定快照，1,737 個 Point。原始 CSV SHA `e523fbf474f1f51a4d9879347fb78f3bacd799d780d9ab5032ab5852a0e82158`、analytics processed SHA `ae36a20115123be2b87291e52b2178a0fc6e84f6b96e461f363ba3e002f5e735`、Mini 展示檔 SHA `e15d21b89e040cf9591c46e85bc258cad03b2eb95d13d557691007bfcdfce39e`。processed 與展示檔逐筆 name+座標 multiset 1,737／1,737 完全對齊；地址 215 筆、`setup_time` 1,533 筆為空字串。status/legal_status 保留原字串，不能解讀成今日營業或法律合規。
- 獨立 Python Haversine oracle：宜蘭 `[121.65,24.7]` 5 公里有 7 個露營場。MCP 全表查詢 1,737 後 `within_distance` 得 7；`pulse_present_result` revision 9 `ready`、`pulse_fit_bounds` revision 10 `ready`，map readback 7 features／1 source／1 layer、browser 目視 7 個點。距離是來源 Point 的地表直線距離。
- 新增來源家族 1、query dataset 2、queryable layer mapping 1、spatial-ready mapping 1；活動中心全名冊補齊資料但不新增 layer mapping。觀光工廠 158 筆中有 34 筆 Google geocode 座標，使用政策未釐清，維持 `RIGHTS_HOLD`／不得把座標當保證。縣市統計 fishery 等本地 release 缺不可變 bytes 與 production readback，維持 HOLD。
- 已註冊的縣市統計可回答一部分比較問題，和未接的比較 recipe 分開：本次正常 MCP 讀 `regional-statistics:statsBusAccessibleVehicleCount` 的固定 release `2025-114-column5-f4969fae6a17` 得 22／22 縣市、value receipt SHA `78c50210e0063da121a79ad93d24266a2d6df1288f55cfc77bae2b58fa406da0`、參照界 SHA `3feeca872210d6072c975e5e160c81926972337224b36a1573fb4b74f1a48f6c`。`compare_regions` 算出 2025 臺北 3,036 輛、臺中 1,091 輛，臺中比臺北少 1,945 輛、比值約 0.359；這是絕對車輛數，不是每人車輛數或當前運行車數。其餘 188 個衍生比較圖層仍待逐 release 來源稽核與 reader，不因本例通過而稱全部可比較。
- P0 台帳已更新為 [本日 current 逐層版本](./p0-source-family-ledger-20260925-current.md)：778 層均列一筆狀態及 local asset／remote version／query／displayed 四種分離證據；原 594 個 unknown/unavailable 保留 594 行 CSV 供追蹤，不把宣告同一 display asset 當已驗證同一 raw family。現行 audit 96 datasets、91 queryable mappings、93 metadata candidates、594 unknown/unavailable；P0 完成的是**逐層可追蹤處置**，仍只有部分來源家族完成 raw/release 核對。

## 第四批：觀光景點 V2.1 原始座標

- `tourAttractions` 的原始觀光署 V2.1 ZIP SHA `32fce35366927d53bf7c3d6f53e5c011b080f34ecc072af870d292b7846a6633`，analytics processed SHA `58cb09c2b0f75a6150be15759f76654b6374ce0e11531d60f7d238e2a2a6db94`，Mini S3 展示 GeoJSON SHA `f10f820f74155ac7583c110f08b1f0068902b1bd076e52acfe0f497c3d86371f`。6,070 個 ID 與來源數值座標逐筆對齊。展示檔依專案規則不進 Git，故另產生 2,141,851 bytes 的安全欄位 research sidecar SHA `ccdff175dfce339bf68a6ae125da470de1b3f018df62f346d474ebffeb9f4b6d`，讓固定 SHA/count reader 可攜且可查 6,070 筆；本次未上傳 S3。
- 原始清冊 6,095 列中 6,071 列非零座標；清洗檔只發布 6,070，剩餘 1 列差因未核明，不能稱原始全列保證。`annual_visitors_2024` 只有 263 筆有值、5,807 null，`yoy_pct` 只有 234 筆有值、5,836 null，空值不可補零；`open_time` 4,379 筆空字串不代表全天開放。來源每日更新是供應週期，不能把 2026-07-22 固定快照當今天狀態。
- 獨立 Python Haversine oracle：日月潭 `[120.944,23.868]` 3 公里 25 筆。正常 MCP 從 sidecar 查固定 6,070 筆（source receipt 為 `ccdff175…f4b6d`）後 `within_distance` 得 25；`pulse_present_result` revision 15、`pulse_fit_bounds` revision 16 都 `ready`，map readback 25 features／1 source／1 layer，browser 目視可見點群。新增 1 個來源家族、1 個 query dataset、1 個 queryable 且 spatial-ready layer mapping。總台帳 778／96 datasets／91 queryable mappings／93 metadata candidates／594 unknown-unavailable。

## 多家族「附近有什麼」現有流程驗收

臺北 `[121.55,25.05]` 750 公尺，三個已通過的 Point 家族依完整來源分別查詢，Python 獨立 Haversine oracle 為公廁 36 個代表點、運動場館 27 筆來源紀錄、原生座標活動中心 4 筆，共 67 筆；MCP `pulse_run_analysis_plan` 的三份 `within_distance` 分別為 36／27／4。`pulse_set_result_collection` 分三組且三組可見，revision 14 `ready`；`pulse_get_map_context` readback 為 67 features／3 sources／3 layers，browser 目視見三色點。此為現有 typed plan 的實際組合驗收，還沒有依 descriptor 自動挑選所有合法家族的 router；Point 以外的線／面仍須分別過 P1／P2 關卡。初試 1 公里 56／38／9 時曾因頁面熱更新後 result-store 失效而無法呈現，隨即重建同版輸入，在 750 公尺新範圍完成本輪驗收；不拿失敗的 1 公里呈現當已通過。

## 第五批：加油站來源更正與五層共用 reader（本機查詢與地圖已驗）

- 舊 `gas_stations` upstream ID 將 2026-06-15 的 573 筆 curated 點與 2026-06-20 的 3,053 筆 canonical 合併名冊混稱。五個 `gasStation*` 展示層實際來自後者；四個 `gasCoverage*` 是站點與路網計算的衍生距離面，分開待核 OSRM/產製收據。`waste_facilities` 的九層也保留待核：processed 66 筆政府 Point + 237 筆 OSM 對照 Point，catalog 自承與後來的 Supabase 數百筆可能不同步，部分 Google geocode 座標的公開使用權未核。
- 加油站 canonical analytics processed SHA `00ee5b007a680788c25d1c4e1abf2da2628b776aec1a4644904f49a7dff15c80`；3,053/3,053 為 Point。安全欄位 sidecar SHA `326b81ef20deef1dc3f9ced16c4e124b2db0bda97c4b86422dee8c5c5b9c3da3`、1,110,359 bytes；不發布地址、電話或 `_provenance`。3,022 個不同 `entity_id` 對應 3,053 列，查詢以固定版本列 ID 避免重複識別。來源名稱有 34 個空字串；最高 tier 授權欄位為 OGDL 2,610／ODbL 443，整份衍生集合保留混合授權與 ODbL attribution 義務。`fetched_at=2026-06-20` 不是今日營業觀測。
- 原 checkout static RPC SHA `c3f6c2319966f8ba487ba77d84a6c17f9c9f3b519cd6d076b695198b5c4a53ca` 的 canonical 3,053 列與來源名稱、品牌 membership、座標（小數六位）逐筆 multiset 對齊；**443 筆 ODbL 在舊 static RPC 被誤標 OGDL**。因此資料身分對齊、授權屬性沒有對齊；展示／正式發布驗收仍是 `DISPLAY_SOURCE_LICENSE_ATTRIBUTE_CONFLICT`，不能把五層稱為全鏈已通過。
- 本地 `tw-gas-stations-canonical` 一個 descriptor 映射五個 `gasStation*`；品牌標籤可重疊，中油／台塑／台糖／unknown membership 2,023／350／86／698，不能相加當 3,053 個互斥站。新問法的獨立 Python Haversine oracle：高雄 `[120.30,22.63]` 2 公里 18 筆，其中 17 筆含中油標籤、1 筆 unknown。focused Vitest 12/12、`npx tsc -b`、`npm run build` 通過。
- 舊 active session 的瀏覽器已斷線；在既有 3734 前端重新配對後，正常 `pulse_query_records` 以 `[120.28,22.611,120.32,22.649]` bbox 得 24 個候選，`pulse_spatial_query(within_distance, 2000m)` 得 18，與獨立 oracle 相同；`pulse_spatial_query(nearest)` 得中華三路站 460.314389m，也與 oracle 一致。`pulse_present_result`→`pulse_wait_scene_ready` revision 1 `ready`；`pulse_fit_bounds`→revision 2 `ready`，`pulse_get_map_context` readback 18 features／1 source／1 layer，瀏覽器目視 18 個點及高亮數字。這證實新查詢來源到暫態地圖結果的本機空間鏈；既有底圖 static RPC 的 443 筆授權標示衝突仍未修，五個展示層的同版授權驗收不得勾完成。隔離 Vite profile 現讀 mini worktree 的 `public/`，新 sidecar 可由既有 3734 正常提供；沒有重啟服務。當前 audit 778／97 datasets／96 queryable mappings／93 metadata candidates／589 unknown-unavailable。

## 第六批：畜牧場七層共用來源，公開查詢 HOLD

- 七個 `livestockFarm*` manifest key 宣告同一 `livestock_farms` 來源與 `主畜種` filter。現行 `useLivestockLayers` 只呼叫一次 `get_livestock_farms` RPC，sidebar 七層均在 `GATED_LAYERS`；舊靜態 GeoJSON 是本機 fallback，不能把它的存在當成目前公開查詢授權。
- 本機 `public/agriculture/livestock_farms.geojson` SHA `41c3244b7eff050697fd746282d79b5c75c688960fa38c3c644b80e241819e13`，13,087/13,087 為 Point；上游 handoff 記 enriched v3、2026-07-05 batch01+02+03，高／中／低精度 12,271／47／769。低精度可能是段或村里質心；ARIS 批次覆蓋並非全國所有場。catalog 的 OGDL 聲明不足以單獨解決 EMS／Google 補位座標的公開使用權。`get_livestock_farms` RPC 實際 release／ACL 尚未實讀，並無同版展示證據。
- 因此七層由 `SOURCE_MISSING` 改為 `RIGHTS_HOLD`：保留本地來源 lineage 與查找入口，待資料擁有者核准可公開的座標子集及其標示，核對 RPC release／ACL，才能決定是否接研究 reader；不擅自把 owner-only 圖層公開。

## 第七批：警察機關來源 Point reader（本機查詢與地圖已驗）

- `policeStation` 來源是警政署 data.gov.tw 5958／24419 加嘉義市 168315 的 trust-chain 處理檔，2026-06-26 analytics processed SHA `63dadd2cf7e764138e2cca8bdd57010464b91fb5c3d90afa8a65c8349e83e2e7`，2,065/2,065 為 WGS84 Point；OGDL-Taiwan-1.0。來源 `entity_id` 僅 1,860 個不同值，重複 205 列（含同址不同機關），故保留全部列並以版本 SHA＋列序作 `record_id`。六類 subtype 分別為派出所 1,541、分局 163、警察局 27、專業警察 298、總部 5、其他 31；擷取日不代表今日編制或服務。
- 最小安全欄位 sidecar SHA `5d2bcc9d34d5f293b70255fbbdf70d7499a701137bd384df42bb60f477b66a16`、728,233 bytes，不帶地址、電話或 `_provenance`。只映射原始站點 `policeStation`；三個 `policeIso*` 是站點＋路網衍生面，仍待獨立來源／版本／數值驗證。既有站點展示 asset 的 same-version 收據尚未核對。
- 嘉義 `[120.45,23.48]` 1,500m 新題：獨立 Python Haversine oracle 對全檔算出 10 筆，最近的專業警察單位 135.684850m；正常 MCP bbox `[120.43,23.46,120.47,23.50]` 得 18 個候選，`within_distance` 得 10，`nearest` 得同一最近點與距離。`pulse_present_result` revision 3、`pulse_fit_bounds` revision 4 均 `ready`；map readback 10 features／1 source／1 layer、瀏覽器目視 10 點及「10 筆分析結果已高亮」。focused Vitest 3/3、`npx tsc -b` 與 `npm run build` 通過。這是本機新查詢來源的空間驗收，未驗證原有底圖同版或正式發布。

## 第八批：污染場址固定 Point reader（本機查詢與地圖已驗）

- `pollution_source` 宣告涵蓋不同原表，不是一個完整來源家族：`pollutionSite` 使用環境部 EMS_S_07 場址，`pollutionFacility` 使用 EMS_S_01 列管事業，四個裁罰／噪音事件層使用 EMS_P_46。此批僅完成場址一層；設施與裁罰各自保留待查。
- 場址 staged 原表 SHA `9139e65862c7206fefcb298e94299e9ed5e28b9b6c072edf1fd83a9a628bd394`，frontend GeoJSONSeq SHA `095079a9717b647a3b4ab1c5ae95d0d8ac8750c2ac8379e957b3c7b7e3ff5682`；以 8,253 個唯一 site_id、Point、名稱、列管狀態及面積逐筆對齊。8,253 筆均有來源 WGS84 Point；快照時 365 筆列管、7,888 筆已解除公告。frontend 曾截斷 1,568 筆小數 sitearea，安全 sidecar 從 staged 原值復原，SHA `a9a948ff18112a4ccf82517fc6927a6249ed86f4ebf73d9f27f7f4ed8bfdcab2`、4,290,716 bytes。授權為 OGDL-Taiwan-1.0；不發布地址、地號。Point 不是污染範圍或當前暴露風險，處理日也不是今天的列管狀態。
- 台中 `[120.68,24.15]` 3,000m 新地點：全表獨立 Haversine oracle 得 3 筆（B12241 2,430.055m、B11338 2,685.565m、B12095 2,894.727m），其中前二者列管，末者已解除；正常 MCP bbox `[120.64,24.12,120.72,24.18]` 得 7 個候選，`within_distance` 得 3。變體加 `is_active=1` 得 bbox 3、半徑內 2。`pulse_present_result` revision 6、`pulse_fit_bounds` revision 7 均 `ready`；`pulse_get_map_context` readback 3 features／1 source／1 layer，瀏覽器目視 3 點與高亮數字。冷讀量 8,253 筆／4,290,716 bytes／1 request；本地 sidecar，無 Supabase 或 S3 寫入。
- 新增 1 個來源家族、1 個 query dataset、1 個 queryable／spatial-ready mapping。台帳現為 778 層、99 datasets、98 queryable mappings、92 metadata candidates、588 unknown/unavailable。原 checkout 的 `pollution_sites.pmtiles` 與 analytics 20260706 output SHA 都是 `dca3c37cf0a05a85b3c08d96310caa22aca01472b31a55f0a2c22a8992d7f9ba`，本機展示產物版本一致；但展示 `sitearea` 截斷 1,568 筆小數，研究 sidecar 保留 staged 原值，remote runtime release 未讀。不可把六個宣告層或今日列管狀態當完成。

## 待解權利家族：畜牧附屬設施三層

- `livestockFeed` 258、`livestockMarket` 21、`livestockSlaughter` 185 個處理 Point；analytics catalog 記錄農業部／防檢署等 OGDL 名冊與 2026-07-04 取用日，原始清冊 receipt 在本機檢查範圍內未齊。現有點位均由 Google 地址 geocode，catalog 未證明座標可公開重發布；屠宰場現行路徑另有 owner-only 限制。
- 三層改列 `RIGHTS_HOLD`，不得從 processed GeoJSON 直接推出可公開附近查詢。解鎖：原始名冊／版本／欄位核對，加上 geocode 座標公開使用權；若只允許屬性，可另做不含地址、BAN、geometry 的名冊 reader，並明示不能算距離。這是三個不同來源家族，不能合算一份 464 筆原表。
- 改列後待處理仍 680 層；其中 `READER_PENDING` 429、`SOURCE_MISSING` 201、`RIGHTS_HOLD` 42、`VERSION_MISMATCH` 8。分類改變不是三層完成。

## 第九批：EMS_S_01 列管設施有界查詢

- 來源 staged `pollution_potential_20260705.geojson` SHA `0121da253ad62da9796165967685fa5cbc022fb0f33fad24961edc4069e684a8`／143,743 Point；frontend `pollution_facilities_20260706.geojsonseq` SHA `7aa3c25b9907bf2e557116af8a60fcce3c1e7ecac20ea6898b81e7309f4985f9`／152,246 個唯一 emsno Point。143,743 個前身 ID 的座標與核心欄位逐筆對照；另有 8,503 筆只在新版 frontend，因此以新版作查詢母體，不能用前身假稱完整。環境部 EMS_S_01、OGDL 1.0；來源取得與實際觀測日未有可驗時間，2026-07-07T04:51:39Z 為 frontend manifest 產製時間。
- 安全欄位分成 324 個 SHA 固定 bbox gzip shards，總約 5.9 MB；manifest SHA `1c97e6d93c03fdddead91963f5a6a688ebd2368ec2029688d0e23b19ddf94a88`。強制 bbox，查詢不載入 49 MB 原始 GeoJSONSeq；不帶 facility_address 或 industry_name。原 checkout `pollution_facilities.pmtiles` 與 analytics 20260706 output SHA 均為 `cec5cda2a0ccff4dcdab829f4719903ffe111728278792bbcd2089282778599b`，僅證本機 display 檔身份，remote release 未讀。
- 台中 bbox `[120.67,24.13,120.69,24.15]` 全原表獨立 oracle 373 筆，正常 MCP `query_records` 373；篩 `max_sev=2` 為 3、`max_sev=3` 為 2，亦與 oracle 相同。首輪 HTTP 由 Vite 對 `.gz` 設 Content-Encoding，瀏覽器透明解壓造成壓縮 bytes SHA 檢查失敗；loader 已加固定解壓 SHA/size 雙路徑驗證，修後正常 MCP 通過，focused test 含該傳輸變體通過。`sev_*` 的 null 表示沒有該介質旗標，不是 0；列管潛勢不是確認污染。逐筆 geocode precision 未提供，讀取器 geometry 設為 proxy，只開 bbox/屬性與聚合，不提供精確最近距離。`pulse_present_result` 對 proxy 地圖結果回 error，故這一片的地圖 gate 未通過，不把查詢成功冒充空間呈現。未寫 Supabase/S3。
- 此片增加 1 dataset、1 queryable mapping；台帳目前 778／100 datasets／99 queryable mappings／92 metadata candidates／587 unknown-unavailable。`pollution_source` 的四個 EMS_P_46 裁罰 layerRefs 仍須另做分片、座標權利及正常 runtime 驗收。

## 第十批：EMS_P_46 裁罰事件本機有界查詢

- 同一 20260706 frontend GeoJSONSeq SHA `247d6a759942f37b17b12f12558b9d2fce2e9a80e73503b1cc52c1c9b251c937`，414,904 個事件 Point，對應四個 layerRefs：critical 55,281、high/normal 248,556、mobile 111,067；noise 29,661 與前三者交叉。staged 前身 SHA `16bc3f0b3d82aac54f48d026da0c3df4721bae8db71a41a615d295f2d1d78597`。事件時間 2010-01-08 至 2026-06-23；這是歷史裁處，不是當前污染或現場定位。
- builder `scripts/research/build-pollution-penalty-partitions.py` 將安全欄位分成 424 個 immutable gzip shards，manifest SHA `5d403a5d36a57d1ef6b78976d0ce5072136559641c72993eaceabce86f7cce2b`。產物僅存 `../runtime/point-partitions/pollution-penalties`，由 Vite loopback 開發路徑供已配對本機查詢；production build 不帶分片。重建：`python3 scripts/research/build-pollution-penalty-partitions.py --source /Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/environment/pollution_source/frontend/pollution_penalties_events_20260706.geojsonseq --output-dir ../runtime/point-partitions/pollution-penalties`。輸出目錄已存在時先另建新目錄並核 SHA，再依現行服務交接，勿覆蓋在用檔。
- 130,284 facility_join、167,701 address_exact、108,276 address_osm、8,643 parcel 地理編碼。`address_osm` 座標再散布權尚待核，故 descriptor 設 owner_only；局部處理不等於對外發布授權。保留來源欄位中 county、event_medium、transgress_type、日期／年／金額、severity_event、is_continuous、geocode_precision；排除違規事實全文、完整地址、文件／設施識別碼等。Point 是參考位置，只能做 bbox／屬性查詢及有界聚合，不開精確最近距離。
- 全原表獨立 oracle 與正常 Codex→MCP→Gateway→browser 查詢相符：台中 `[120.67,24.13,120.69,24.15]` 1,770 筆，其中 noise 72；台北 `[121.5,25.03,121.52,25.05]` 3,795 筆。台中掃 4,350 候選／1,683,489 bytes，台北掃 16,047／5,755,275 bytes，均在 20,000 列／8 MiB 上限內。未驗證 proxy 結果地圖，保留 presentation gate 未完成。未寫 Supabase/S3。

## 第十一批：公共圖書館與海巡據點

- 公共圖書館來源 2026-07-17：原始 5,254 列，公共圖書館子集 644；634 個 Point、10 個無座標。sidecar SHA `d096a63d3b4c6c61be29e236c6e3e4f9f5139a89189b67e541011a112f9805f8`。名冊 reader 保留 644 列供屬性查詢；TGOS 地址級 570 Point 另作有界空間子集，L1 62／offline_exact 2 不入此子集。既有 mini 634 點與 sidecar 有座標子集雙向對齊；台北 bbox `[121.5,25.03,121.55,25.06]` 正常 MCP 得 9，revision 19 scene `ready`、map readback 9 points 與瀏覽器目視通過。
- 海巡據點來源 processed SHA `8a4624f2d3d821b24052203a28af06808c174d2cee161cb4c199e8bf6fa78183`，安全 sidecar SHA `f8ec09536e9a2e3df7f2da6ee039c4ec000dc36ad1fa9a5d0270058ab044c702`，269 Point（252 巡防、17 海洋驛站）。268 個 entity_id 對應 269 列，逐列 ID 保留重複；patrol 的 confidence／n_sources 為未提供的 null。東南部 bbox `[120.2,22.4,121.0,23.0]` 正常 MCP 得 27。既有 display asset 不存在，故沒有同版地圖驗收。
- 本批後台帳 778 層、104 datasets、104 queryable mappings、91 metadata candidates、583 unknown/unavailable；674 待處理為 reader 423、來源缺證 201、權利 HOLD 42、版本 8。八個 focused test、`npx tsc -b` 已通過；build 與最終 commit 見後續收據。新增查詢映射是資料可查，不等於附近與縣市比較已全通。

## 第十二批：已定位資料的本機擴充

- `companyPoints` 沿用 [P3 固定來源收據](./p3-company-points-receipt-20260925.md) 的 654,165 筆，改由 owner-only localhost 路徑讀取，並從本 worktree 的 `public/research/company-points` 移走既有分片。adaptive 594 shard manifest SHA `f6ab0198f72617a33f923cc3228e237d2ebdf17b7934d8b40e281f061e4bfbba`；高雄先前 `DATASET_TOO_LARGE` 的 bbox 改讀 12,160 候選／4,695,526 計價 bytes，正常 MCP 5,299 筆、製造業篩選 1,029；宜蘭 519／94。全原表獨立掃描一致。不推論未測區域；超限時 fail closed。118 份 202608 授權收據與正式同版 display 仍 HOLD。
- `culturalMuseums` 文化部 raw 266 列（經緯度全空）→ processed 252 Point＋14 null，80 筆 Google geocode；owner-only sidecar SHA `5b6d23839afaba52d1eec098bdff2417a37755def4e46e81df653084535dea09`，台北 bbox 10、台南 Google 來源 1。保留 14 null；Point 是參考位置，公開座標權待核。
- `performingVenues` 2026-07-16 processed 861 筆（857 Point、4 null），386 api_mode／471 geocode；owner-only sidecar SHA `a3a9ae3495c715e797ba04c09c73868b67503d22def8b4762c0aedcc02bcf097`。台北 bbox 79、台南 api_mode 10。滾動活動窗萃取的場館清單不是全國完整母體或現時營運資訊；Google 回補權待核。
- `speedCamera` 2026-08-24 source 2,805 Point，safe sidecar SHA `749c5fce5c6a54a0327160a7882f3373c4535bb6769e557f439097c3ba57ea3c`。名冊全 2,805、附近子集 2,743，62 個 coord_suspect 保留但不入距離。台北 bbox 15、台南一般測速 subtype 8；台北結果 revision 21 `ready`、map readback 15、瀏覽器目視 15 點。現有 display 為 20260626，未證同版。三家族的台北 bbox 與台南篩選變體均有 sidecar 獨立計數和正常 MCP 回讀；owner-only 兩家族無地圖呈現聲稱。
- 本批後 778 層、109 datasets、108 queryable mappings、88 metadata candidates、582 unknown/unavailable；670 待處理（reader 419、來源缺證 201、權利 HOLD 42、版本 8）。本機查詢增加四個 layer mappings；不寫 Supabase/S3，不部署。每家族測試、TS/build 與 commit 收據按本輪結果更新。

## 第十三批：消防與社福已定位資料

- `fireStations`：analytics 20260710 processed 717 Point，7 都／15 縣市來源 CSV 分別鎖 SHA 與 343／374 列；304 官方、413 Google。owner-only 安全 sidecar SHA `43ae4221396ef536cfe964183e5fdd4f0b577078296a494d04ecdf76aa09e8c6`。台中 bbox 6、花蓮 Google 變體 4，正常 MCP 與 sidecar 獨立掃描一致。舊展示只有 716 筆（缺 `I_008`），屏東另有 38 筆座標差異。這是 bbox／屬性查詢通過，Google 公開座標權、同版展示與精確最近 HOLD。
- 五份社福固定混合座標來源分開保留：長照 3,117、老人住宿 1,160、托嬰 1,578、身障 334、社福團體 587 Point。身障混合 12061／130229／161606／165355 原表，沒有把五層誤稱同一來源。完整安全欄位 owner-only sidecar 分別由 `build-welfare-care-points-owner-only.mjs` 與 `build-welfare-geocoded-owner-only.mjs` 重建，保留 TGOS／Google／offline precision 和來源缺值；只准 bbox／屬性／aggregate，不開 nearest。長照／老人住宿另有 3,053／1,043 TGOS-only sidecar，兩者與完整來源不是兩份獨立母體。
- 新地點核對：台中 `[120.65,24.13,120.70,24.17]` 長照完整 113、托嬰 51、社福團體 24；台北 `[121.52,25.02,121.56,25.06]` 老人住宿完整 17、身障 8，皆由正常 MCP 查詢，與安全 sidecar 全檔獨立計數一致。長照／托嬰查詢 limit 50，`totalMatched` 仍為 113／51，結果有 `displayTruncated=true`，不能把前 50 筆當總數。TGOS-only 老人住宿同範圍 16，`pulse_present_result` revision 22 `ready`、map readback 16 features／1 source／1 layer，瀏覽器目視可見點。這是來源子集的地圖證據，完整混合 owner-only 名冊仍只有 bbox／屬性查詢證據。
- owner-only middleware 僅接受 loopback socket 與本機 Host，固定 allowlist 檔名與長度；本機合法請求 200／564,496 bytes，`Host: example.com` 404。`vite.config.ts` private,no-store；資產留 `../runtime/owner-only`，不進 production build。此批新增六個 queryable layer mappings；查詢目錄的數字需在所有新 adapter 接線後重跑 audit。聚焦測試 8/8、`npx tsc -b` 與 `npm run build` 通過；完整 care reader 後續接線另有 2/2 worker 測試與正常 MCP 查詢收據。未寫 Supabase/S3。

## 第十四批：113 學年度學校六層與兒少服務

- 教育部原始 XLSX SHA `bfc1b452507c0df9a5d3051a53b3687b7cbb19b96f0a5f65ffcc6c74a3970cbf`，4,315 列數值經緯度，processed GeoJSON SHA `7ab34ec23180077bcd32f4617ff31404f1a21c68706d36b2a74a3c4b079377c3`，4,315 Point。owner-only 安全 sidecar SHA `9e44e6c92cd2335bec90e9e5946139422343f3ca7505b3ac07c9d61bb1194667`，1,137,718 bytes，移除地址、電話、網站。六個 `eduSchool*` 分類 reader 分別 2,656／964／508／159／28／1,152 筆；偏遠分級與學制重疊。system_type null 9、region_type null 3,163 保留；source code 只有 4,046 個不同值，逐列 record_id 才是主鍵。EduGis 座標再散布授權未核，僅本機 owner-only bbox／屬性查詢。
- 正常 MCP 的新題和 sidecar 獨立掃描相符：台中小學 26／高中職 7、花蓮國中 7／偏遠 0、台北大專 6／臺北市特教 4。零筆只表示所問 bbox 內此名冊無偏遠分類，不推成真實世界沒有學校。
- 兒少服務 processed SHA `ac0c94e29487b56589d25bd301ff4369f931dc166a27b446591ac405fe1d7e2a`，1,425 列中 1,396 Point、29 筆結構性無地址；安全 sidecar SHA `55926bb2c37bfe6143201f19d9b303b423cc8ab3a3ec6b9f8ea6e7b3280332f9`，570,209 bytes。無地址列保留屬性查詢，不能補零座標或編造服務位置。台北 bbox 28、台南 Google 來源變體 4 與 sidecar 全檔一致。五個 raw source ID 混合，Google／offline 座標公開權未核；僅 owner-only proxy bbox／屬性，不稱最近距離或目前服務。
- 本批後 audit 778 層、124 datasets、121 queryable mappings、75 metadata candidates、582 unknown/unavailable；657 待映射（reader 412、來源缺證 201、權利 HOLD 36、版本 8）。已註冊 owner-only 但公開權仍 HOLD 的六個學校層不在待映射 36 內。地圖 ready/readback 對 proxy 結果未宣稱通過；本批 runtime 是正常 Codex→MCP→Gateway→browser 查詢證據。

## 第十五批：藝文場次、軌道、司法與 TDX 站位

- `artsEvents`：文化部 2026-07-16 `doFindTypeJ` 原始 JSON SHA `7a9c2e98244c0f8e3350be575c686a16d3a49c1cfec1236e14e4ee7bc4dce2f9`，2,836 活動展開成 7,482 個場次；6,121 Point、1,361 結構性 null geometry。安全 sidecar SHA `58519dc08d834f9b7b8a8463ddb826dd4456d6346853b105a5eb13dd5e1b5836`，2,952,774 bytes。台北 bbox 368、台南 category=4 變體 362，正常 MCP 與全 sidecar 獨立掃描相同；limit 50 有截斷標記。僅 owner-only 參考位置 bbox／屬性，滾動窗不是歷史全集或今日營業清單，精確距離與現行展示同版未過。
- `stationsTHSR`／`stationsTRA`／`stationsMetro` 共用 analytics 2026-05-29 processed SHA `2e334441261600b2b5541982705f9cdf11182f94df5a507f45572441b8a33637` 的 535 Point，分類 12／244／279；sidecar SHA `6192eb7b1f5e570a298f438f5bec09a316d39e321cde688805c587fd777b0bf8`。台南 TRA bbox 2 與 sidecar 對照，三個 reader 均由正常 MCP 實讀。正式 2026-05-27 catalog／manifest 與舊展示只有 503 筆，新檔增加 32 TRA 並改一筆內容；20260529 逐來源 receipt 與公開再散布未核，故正式同版／發布 HOLD。Point 是車站位置，不是入口、班次或步行路徑。
- 六個司法機關來源各自原表與 SHA 寫於 `justiceFacilitiesOwnerDatasets.ts`，不可合成一份原表：廉政 66、矯正 51、法院 35、移民署 25、調查局 29、檢察署 29，共 235 Point 且無 null geometry。前五類中除移民署外均為 Google 地址 geocode，移民署為原始 TgosWGS；安全 sidecar 六份只存 name／類型與參考 Point，剔除地址、電話等。台北廉政 bbox 29 與 sidecar 掃描一致；法院台北 4、調查局台北 2、檢察署高雄 1、矯正及移民署全名冊 51／25 均由正常 MCP 實讀。來源 manifest 未附完整座標再散布收據，僅 owner-only proxy bbox／屬性／aggregate，最近距離、入口、管轄、目前服務及公開發布 HOLD。
- `busStationsCity` 與 `busStationsIntercity` 為 TDX `/v2/Bus/Station/City/{City}` 和 `/v2/Bus/Station/InterCity` 不同產品。processed SHA 分別 `a585bab7d2fc98cb63e48eff461c43e5f16cf35b1fae9acd7845a5d4d7e7ac8b`／`9012db171215104773a758c0a8c3d9ddba72f2e979f2195647721510ca7d558f`，49,830／15,383 Point。City 合併 2025-11 至 2026-02-28，InterCity 為 2026-02-28；分片 manifest SHA `d936b193c72bb2456e85535aa7569893e448aef3265075f7f949e72b72ee7471`／`471b7bc5a1cdab3d1d7f99d5917dfa9e216a10b9b0d9c8855fe1e7481d46c1dc`，262／233 個 gzip shards 僅放本機 runtime。forced bbox；台北市區小 bbox 152（limit 50、正確標截斷），高雄公路客運 bbox 18；focused test 的臺北及高雄 oracle 對完整 processed source 一致。客運 18 點正常 MCP→Gateway→browser revision 25 `ready`，map readback 18 features／1 source／1 layer；未聲稱目前站位、Stop 方向站牌、車輛、ETA 或路網可達。
- Vite 新路徑僅接受 loopback socket＋本機 Host、固定 allowlist 檔名，justice 合法 200／11,163 bytes、bus manifest 200／99,258 bytes，兩者 `Host: example.com` 均 404。四個 focused test 檔 11/11、`npx tsc -b`、`npm run build` 通過；本批沒有 Supabase／S3 寫入或發布。Audit：778 層、136 datasets、133 queryable mappings、66 metadata candidates、579 unknown/unavailable；645 待映射（reader 400、來源缺證 201、權利 HOLD 36、版本 8）。這 12 個新增映射是本機可查狀態，並非 12 層的正式空間分析或公開授權全過。

## 第十六批：本機已定位來源再擴充十二個 layer mappings

- 本批按實際原表切開十二個 layer mapping，而非把 12 層視為一份原始資料：計程車招呼站 224 Point、ETC 門架 341 Point、工廠登記點 90,652 Point／9,972 geocode miss、幼兒園 6,689 Point／58 miss、課後照顧 782 Point／5 miss、互助教保 148 Point、旅宿 15,654 Point／2 invalid、觀光餐廳 3,688 Point／2 invalid、民防避難 110,291 Point、觀光工廠 158 Point、自行車站 9,408 Point、氣象站 838 Point。各原表 SHA、版本、授權與 geometry 契約見 `scripts/research/capability-audit.mjs` 的 verified family 與各 reader；本批新增或覆核一個來源家族只增其實際 layerRef。
- 計程車與 ETC 的 Mini static 檔 SHA 與 analytics processed 完全相同；台北計程車 bbox 86、嘉義 21、嘉義 2km 19，ETC 高雄 bbox 8／北向 3，均與原表 oracle 及正常 MCP 相符。僅來源固定 Point 查詢通過，不推成目前席位、收費或路網距離。
- 工廠原表 100,634 列去重並過濾在營狀態後 100,624，90,652 有參考 Point、9,972 geocode miss；owner-only 228 gzip shards 只含安全欄位，台北 bbox 420／高雄 9 與完整處理檔 oracle 相同。地址 geocode 不是廠房輪廓或營業現況。幼兒園／課後照顧／互助教保三份原表保持分開，null geometry 58／5／0 保留供屬性查詢；正常 MCP 台北幼兒園 bbox 355、台中課後照顧 5、幼兒園 unlocated 58、互助教保全名冊 148。
- 旅宿與觀光餐廳為觀光署兩份 ZIP 來源，以本機 owner-only gzip 分片保留安全欄位；正常 MCP 台北旅宿 bbox 522、桃園餐廳 39，餐廳 39 點 revision 29 `ready`、地圖 readback 39。價格與星級的 null/零值保持分開；名錄不是即時營業或訂房資訊。
- 民防避難使用 2026-08-24 的 15-source 110,291 Point 新版，不沿用舊六都 62,695 版；exact 102,577、street_block 1,843、approximate 5,871、coord_suspect 1,753。282 個 owner-only shards；台北 exact bbox `[121.50,25.04,121.54,25.08]` 6,036、台中 approximate bbox `[120.62,24.12,120.68,24.16]` 2,089，與完整原表 oracle 相同。TGOS 坐標再散布權 `RIGHTS_HOLD`，參考 Point 只能 bbox／屬性查，不能推可用、開放、容量、安全或最近避難處。
- 觀光工廠 158 筆全部為地址 geocode，34 筆 Google 公開座標權 `RIGHTS_HOLD`；owner-only sidecar SHA `d61535fc102dbcea8b6fa813fd36d25c4ba5099239dabe845669315276691196`，42,279 bytes。高雄 bbox `[120.2,22.55,120.4,22.75]` 4 筆與原表一致；僅 bbox／屬性，不開最近或可達性。
- TDX 自行車固定 9,408 Point 與 CWA 當時運作中測站 838 Point 的 Mini GeoJSON SHA 分別 `dbbd70b3912b8739c98c75d14a41bd0aa668bbca82f16d3012c20c48fff34b24`、`08088afb391e63970fe979895b8f76cc9b7c9a427dc09a90dd38939a784e8222`，均與 analytics processed byte-identical。高雄自行車 bbox `[120.25,22.6,120.4,22.7]` 878、台中氣象站 `[120.65,24.1,120.75,24.2]` 2，正常 MCP 與原檔獨立計數一致。氣象站結果 revision 30/31 `ready`、map readback 2 features、瀏覽器目視 2 點；測站來源是 2025-11-29 運作中名冊，不能解讀為即時觀測或今日在線。水資源監測站的 Mini 2,032 點與 analytics rain gauge 242 點版本／母體不符，列 `VERSION_MISMATCH HOLD`。
- 新 owner-only 路徑只接受 loopback 與本機 Host；民防 manifest 合法 200／100,874 bytes、觀光工廠 200／42,279 bytes，兩者外來 Host 404。owner-only sidecar 在 `../runtime/owner-only`，不進 production build。聚焦 Vitest 22/22、`npx tsc -b` 與 `npm run build` 通過；沒有 Supabase／S3 寫入、push、PR、merge 或部署。Audit 現為 778 layers、148 datasets、145 queryable mappings、56 metadata candidates、577 unknown/unavailable；633 待映射（reader 388、來源證據不足 201、權利 HOLD 36、版本 8）。本機查詢映射增加十二個，不等於十二層全部正式地圖／公開空間分析通過。

## 第十七批：登記、治安警示、路況、殯葬、宗教與山域固定點

- 這批再次按不同原表分開接線，並把「有經緯度」與「可作精確附近」分開。`agriWholesaleMarket` 是經濟部 data.gov.tw 45640 公司登記 F101061：raw 115 列，核准設立 53 列全數 TGOS 地理編碼；safe owner-only sidecar SHA `4f86b5385bbc6fe755dd5e277f53d40bda5fb95b21044d0a2b4ad0535990ba4e`，不帶統編、負責人、地址。台北 bbox `[121.45,25.02,121.55,25.1]` 7，原表與正常 MCP 相同。Point 是登記地址，不等於實際批發市場或交易地。
- `womenChildWarning` 是 6247/26272 兩份公開警示名冊，188 個有效列，185 個 Google geocode Point、3 個未定位。只保留 warning_type／來源層級等安全欄位；sidecar SHA `bbd5a338f632783cdb338ad8f086002fc91ca1e2bde6d5044e88f13b14fc75c4`。台北 bbox `[121.48,25.02,121.57,25.08]` 16，與 processed 原表 oracle、正常 MCP 相同。公開再散布座標權 HOLD，bbox／屬性以外的最近、安全或現時警力判讀 HOLD。`accidentTaipei`、`theftTaoyuan`、`trafficAccidentYearly` 的精確個案事故／犯罪位置和時間尚未建立安全讀取契約，保留 [ ] HOLD，須先逐欄審核可查粒度及去識別化，不拿公開檔即推安全可問。
- `cctv` 是 TDX 國道、省道與市區道路路況攝影機 6,129 個 Point；Mini static 與 analytics `cctv_20260524.geojson` SHA 均 `aaa461000f16837a03d81fb67133f6503a7f0bc04cf5c8604f5021e725c145aa`。桃園警政 `cctv_poi` 另有 4,840 點，**不是**同一原表或用途，不接到此 layerRef。台北 bbox 141、高雄較小 bbox `[120.29,22.62,120.31,22.64]` 16，與獨立 oracle 及正常 MCP 相同；高雄 16 點 scene revision 34/35 `ready`、map readback 16、瀏覽器目視通過，viewport 已復位並清除 transient 結果。只查固定站位，不判直播串流可用、拍攝範圍或車流。
- `funeralFacilities` 與 `funeralOperators` 各是獨立官方原表：設施 3,707 Point，另有 438 未定位；業者 6,233 Point，其中 1,664 筆失效登記仍保留且原始 `is_active` 為字串。safe owner-only 分片 manifest SHA `fa8f04689e549dec2b1ec412b5c42ebf4aec4664e306be36a5a5b3f6a8220f49`／`8f15496515e649b16784ba12db0cbe0bb9b835fb1510f3654acfcb77393f6d77`，移除地址、電話、統編、資本和許可細節。台北墓園型設施 bbox 15、高雄有效業者 bbox 321，完整原表 oracle 與正常 MCP 相符。Google 衍生座標 574／48 的公開權及 parcel centroid/approximate 精度 HOLD；不得稱最近、今日營業或可達性。
- 宗教五層分開保留：祖祠 173、教會 2,116、其他宗教場所 1,319、基金會 165、宗教百景精選 100。教會含 ODbL 的 1,066 筆 OSM-only；其他宗教場所全部 ODbL，保留逐筆 license 與 `© OpenStreetMap contributors` 義務。基金會原始 165 筆只有 124 原始 Point；40 個 `(0,0)` 與 1 個空座標在 sidecar 恢復為 null，不把後補 Point 當來源座標。正常 MCP 在台北／高雄 bbox 分別查得祖祠 29、教會 105、其他場所 37、基金會 49（並回報 41 missing_geometry）、百景 1；與原表或保留缺值的 sidecar oracle 相同。宗教百景是 2021 原始精選，不是宗教場所普查；所有位置只准 owner-only bbox／屬性參考。
- 山域兩層分開：山屋 136 Point（玉山官方 30、OSM-only 106，12 筆無名），並非全臺所有園區完整供給；山難 2019–2024 歷史 2,465 Point，5 個錯座標已排除。山難 sidecar 排除 case ID、精確報案／搜救／結案時間、出入口、醫療及管理備註，只保留年與有限分類／結果；兩者均 owner-only proxy。山域 bbox `[121,23.2,121.25,23.55]` 山屋 22、歷史山難 103，processed 原表 oracle 與正常 MCP 相同。不能推今日開放、目前事故、風險、最近安全屋或路線可達性。
- `welfareNursingHomes` 另接衛福部 115950＋165355 原表組成的 2026-08-12 固定護理機構 1,611 Point；processed SHA `d0f9ee7f7314d4fd0d69fbcd7a8ce257bcfd8ada643f58f656b68875de766914`，safe owner-only sidecar SHA `782e951370c44890578147d864562c0a55c125297eedd290e0f84f47267eeeec`，534,670 bytes。不回地址、電話、統編、床數、評鑑或許可效期。台北 bbox `[121.48,25.02,121.58,25.1]` 正常 MCP 105 筆，與 processed 原表獨立計數 105 相同；來源收據保留 processed SHA，sidecar 另驗 SHA。Mini 展示檔 SHA `775bc1a88a5e8675e48ed7930645a5e7df505968c0821ed080843e7e75bef3d9` 與 processed 不同，正式同版展示 HOLD；混合座標是代理點，精確最近、空床及現時營運 HOLD。
- 新 owner-only Vite 路徑採本機 socket＋Host 與固定檔名白名單；農批、婦幼、殯葬、宗教、山域、護理機構合法請求 200，外來 Host 404，sidecars 保留 `../runtime/owner-only` 而非 production `public`。本批六組聚焦 Vitest 14/14、`npm run build`（含 `tsc -b`）通過。Audit 為 778 layers、161 datasets、158 queryable mappings、43 metadata candidates、577 unknown/unavailable；620 待映射（reader 375、來源缺證 201、權利 HOLD 36、版本 8）。沒有 Supabase／S3 寫入、push、PR、merge 或部署。

## 第十八批：共同登記地址及後續固定點

- `commonRegistrationAddresses` 對應 202608 r2 公司登記存量衍生群組，而非公司原表本身。657,882 原始公司列扣除失效／異常 1,152 與無效或超出台灣範圍座標 2,565 後，654,165 成員可聚合；只發布至少五家公司共用的 11,121 個正規化地址群組，涵蓋 198,606 個公司 membership。analytics processed、Mini static 與 owner-only sidecar 三者 byte-identical SHA `bf78dc3cdd7524a038c2b73ea0c72b4511314e552397c65a763821d0e876d6c1`，2,688,498 bytes；四個公開欄位均無 null。位置是成員有效座標眾數的代理 Point，不是入口、實際營業地、違法或空殼公司判定。只能 bbox／屬性／aggregate，不開精確最近與距離。
- 台北 bbox `[121.45,25,121.6,25.15]` 查得 5,369 個群組，高雄 bbox `[120.25,22.6,120.38,22.7]` 且 `n_companies=10` 查得 35，皆與 analytics r2 全表獨立掃描及正常 Codex→MCP→Gateway→browser 相同。完整來源本機首讀 11,121 rows／2,688,498 bytes，第二題 cache hit；本機 Host 200／2,688,498 bytes，外來 Host 404。focused Vitest 3/3 通過。正式 remote release 未讀，不把本機同版提升為正式發布。
- 水資源點家族暫列 [ ] HOLD，並非視為資料不存在：Mini `waterFacilities` 609 點，但 analytics OSM 處理檔 526 點（ODbL）；Mini `waterMonitorStations` 2,032 點混合監測站／地下水井，WRA rain gauge 原表只有 242 點；Mini `waterDetentionBasins` 56 點，analytics catalog 宣告 132 列且原始 flood_minor 路徑本地缺檔；Mini `waterDams` 111 點，尚無同版原表收據。不能用異版／不同母體替換；需追查各 Mini 資產的來源、建立流程及 license，核對缺值後再接 reader。水庫 `waterReservoirs` 是 PMTiles 面＋dam 點混合圖層，另按 Polygon 契約驗收。這五項均保留在 778 層逐層佇列，不因 HOLD 當作完成。
- `canopyGiants` 使用 Meta/WRI Canopy Height Map v2 台灣本島 2026-07-24 衍生 GeoJSON，7,823 個 10m raster cell center Point，45–85m 且經鄰域支持度過濾；固定 SHA `2b050b7c7d1ccb0391dd867a9c3398f7d4bafbe2a8f863f5f4d4df03bcc01e4d`，1,256,746 bytes。CC BY 4.0，保留 Meta/WRI 署名。新 bbox `[121.28,24.84,121.33,24.87]` 獨立靜態原檔 oracle 與正常 MCP 均 1 點；高度 45m。代理點不能稱單株樹幹、最近可達巨木或今日樹況；僅 bbox／屬性查詢。
- `serviceArea` 是高速公路局原始 22 列 CSV 逐列轉成 22 個 Point；analytics processed 與 Mini static byte-identical SHA `68fc87e6859530aa0ccf8ecaf61a23a3a95307c23d3a7a0f5461b1448d241b65`，13,526 bytes，OGDL。蘇澳 bbox `[121.81,24.61,121.82,24.63]` 1 筆，仁德南下分類變體 1 筆，正常 MCP 與原始檔 oracle 相符。蘇澳結果 revision 40/41 scene ready、map readback 1 source／1 layer／1 Point，瀏覽器目視 1 點。來源點不是國道入口、道路接入或今日服務狀態。
- `parksTaipei` 檔名雖含 Taipei，實際涵蓋臺北 1,350、臺中 1,081、臺南 486 筆，共 2,917 Point；四份市府原始表仍須按來源列保留，不跨源去重。analytics processed 與 Mini static byte-identical SHA `2f015b8f1f5cccc33db3abb1dae6d8bc9918c937288dbfb0a5c2aa43e9acf38a`，1,105,732 bytes，OGDL。district 1,316 null、has_playground 1,240 null、area_sqm 521 null、address 520 null，皆不可填零。台北 bbox `[121.48,25.02,121.6,25.15]` 1,056，台中 `has_playground=null` 756，正常 MCP 與完整靜態檔 oracle 相符；台北小 bbox `[121.55,25.04,121.56,25.05]` 9 點 revision 38 scene ready、map readback 9 features／1 source／1 layer，瀏覽器目視有高亮，原視角已復原且 transient 結果已清。Point 不是公園多邊形；三市外的空查詢不代表無公園。
- 此批四個來源家族增加四個可查 layer mappings。十組聚焦 Vitest 24/24、`npm run build`（含 `tsc -b`）通過。Audit：778 layers、165 datasets、162 queryable mappings、39 metadata candidates、577 unknown/unavailable；616 待映射（reader 371、來源缺證 201、權利 HOLD 36、版本 8）。本機來源／browser 驗證不等於 remote release；未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

## 第十九批：文化資產與固定觀光活動

- `tourHeritage` 使用文資局 2026-05-24 固定 2,894 Point：古蹟 1,056、歷史建築 1,759、文化景觀 79；OGDL。analytics processed SHA `6946a719b30a606250228d97890eed323f58a0cba10238e8290c0099a5b163e4`，Mini SHA `7bc0ccae1aea7367ceab79cc95d778a9884cfb5069a0ec902e97bf9edaa2f7b7`。Mini 只移除處理檔與 geometry 重複的 longitude／latitude properties，其餘逐筆內容與點位保持一致。歷史建築 1,759 筆 `grade=""` 是來源缺值，不填 null 或 0。嘉義 bbox `[120.44,23.47,120.46,23.5]` analytics 原表與正常 MCP 都是 36；小 bbox 5 點 revision 44/45 scene ready、map readback 5／1 source／1 layer、瀏覽器目視 5 點。原始 BOCH API JSON 當年回應不在本機，遠端 release 未讀；固定代表點不是建物、基地或文化景觀範圍。
- `tourEvents` 使用觀光署 V2.1 2026-07-22 raw ZIP SHA `99791d95f089757dec509aa2a029cededc0625480567e55bb6a206aa82ec2bf6` 的 830 個 Event，2 個超出來源台灣範圍後 828 Point；analytics processed SHA `a30dab62f49891cc31caa9d1eeb01653f677c1e4b06cbcb88f8ecf5f0d028ac4`。Mini SHA `0e51aea0298b1eb60c60990f2ff326efa30e0367925e2405271ba94e7de1ea3c` 僅去掉重複 lat/lon properties。保留 start/end、分類與 `EventCancelled` 1 筆；organizer 空字串 685 筆是缺來源值。鶯歌 bbox 加 2026 年 4 月開始／類別 2 共 6 筆，來源獨立計數與正常 MCP 相符；revision 48/49 scene ready、map readback 6 features／1 source／1 layer，地圖目視高亮。多個活動共用座標，所以畫面可見圖點少於六個紀錄；不去重事件。該 7 月快照一律回 `freshness=stale`，不稱今天活動或即時取消狀態。
- 兩個來源家族增加兩個可查 layer mappings；focused Vitest 2/2、`npm run build`（含 `tsc -b`）通過。Audit 778 layers、167 datasets、164 queryable mappings、37 metadata candidates、577 unknown/unavailable；614 待映射（reader 369、來源缺證 201、權利 HOLD 36、版本 8）。測試後 transient 結果清除、台北原視角復原。沒有 Supabase/S3 寫入或任何發布。

## 第二十批：受保護樹木與臺北河濱喬木 owner-only 固定點

- `protectedTreesNational` 是八縣市名冊合併，並非完整全國清冊。上游 6,670 列扣除 126 筆無效座標後有 6,544 Point；analytics processed 與 Mini static byte-identical SHA `197651e6bc1db78ae1fc6e87d8e3ce698fb5f25bfbccbb516b2e47ff2c340549`。查詢 sidecar 2,625,530 bytes／SHA `27ee4336fac481b1bba5ff95db5e1699db11de97d40bc597a06e7643bcd88597`，去除地址與重複經緯度欄；`estimated_age_years=null` 5,236 筆照原值保留。八個原始來源 URL／授權未逐一取得 receipt，`HOLD_LICENSE`、owner-only。混合 WGS84／TWD97 的既有正規化點只供 bbox／屬性，不能稱最近一棵、現存樹位或樹冠範圍。嘉義 bbox `[120.32,23.44,120.35,23.46]` 原表 oracle 與正常 MCP 均 1，嘉義縣篩選 92。
- `riversideTreesTaipei` 是臺北河濱歷史喬木調查，raw CSV SHA `dbcdd5f4dcb4ecf4681f5c296e9eef8a76d7060a6ce7296f53f91793a66c9cb3`／10,921 列，排除四個缺失或異常座標後 10,917 Point；analytics processed 與 Mini static byte-identical SHA `5c7f87775bb978a80fa07411480919e3af38055cdc54b6b14f92b2ab7495fa94`。安全 sidecar 4,330,465 bytes／SHA `2bc603414206c8b302754ac1d958916f505f2f3752ae08c640892c86e3ea4dbe`。原始下載 URL／授權缺 receipt，`RIGHTS_HOLD`、owner-only；來源 WGS84 Point 僅可作歷史直線參考，不表示 2026 年存活、維護或可達。`notes=null` 4,538；兩筆 `survey_date="1230"` 不補日期且不作 time field。臺北河濱 bbox `[121.55,24.97,121.56,24.99]` 原表 oracle 與正常 MCP 均 86，問法變體 `species=茄苳` 均 5。
- 新增兩個來源家族／兩個 datasets／兩個 queryable layer mappings；聚焦 Vitest 2/2、`researchDatasets` 9/9、`npm run build`（含 `tsc -b`）、`git diff --check` 通過。正常配對 session `ca1e0b3aed02d4fd47870778a94c8989` 的 MCP describe/query 回傳固定 SHA 與數字；地圖在本次 Vite 熱更新後 `pulse_present_result` revision 52 回 error、`pulse_get_map_context=MAP_NOT_READY`，故本批沒有 scene ready、map readback 或瀏覽器目視完成聲明。清除結果命令 revision 53 亦回 error，維持明確 runtime 缺口。不得把 166 個 registry 映射當成 166 個地圖通過。
- Audit 778 layers、169 datasets、166 queryable mappings、35 metadata candidates、577 unknown/unavailable；612 待映射（reader 367、來源缺證 201、權利 HOLD 36、版本 8）。臺灣 GIS 主 Layers 381 層中已註冊 112、待接 269。sidecar 留在本機 `../runtime/owner-only`；兩條路徑本機 200（2,625,530／4,330,465 bytes）、外來 Host 均 404。沒有 Supabase/S3 寫入、push、PR、merge、部署或重啟排程。

## 第二十一批：林業治理工程與野生動物格網參考點

- `forestTreatmentWorks` data.gov.tw 47601，OGDL，analytics processed 與 Mini static 同版 SHA `266a981d42ec5c601b1fdf6b79097cadb96724a13eb815dc7b3680960efe8e2b`，6,213 Point。安全 owner-only sidecar 1,584,066 bytes／SHA `9b0288a63d668541fce810a42af1f157cd5ecb176fca4da5859e41097f0b48db`，不帶原始 x/y；固定 `coord_rule` 分布 tm2 6,084、tm2_swapped 115、wgs84 3、wgs84_swapped 11。工程計畫年為民國 92–113，city/country 各 77 空字串，不補行政區或時間。處理文檔為 6,275 原列排除 62 無法定位，現有本地 raw.json SHA `2c623886278f0c6acbb6b9c5fcc65a80f025730adaf06cc6d677982d99288b22` 卻有 9,999 列，故 `RAW_VERSION_MISMATCH_HOLD`；只能查此固定處理版的 bbox／屬性，不能宣稱完整原始母體或精確最近距離。嘉義 bbox 40、民國 113 年變體 5、空 city 77，與完整 processed oracle 及 focused test 相符。本機 HTTP 白名單路徑 200／1,584,066 bytes，外來 Host 404。
- `forestWildlife` data.gov.tw 38126 是第三次森林資源調查資料，Mini 固定 GeoJSON SHA `57f6cc342ab104804899af83b5c023e5b5555babd12c281479fd99b8ef01af48`，1,241 Point／281,676 bytes；來源 TM2X/TM2Y 呈格網／代表座標，176 個重複 TM2 位置，並非 1,241 隻動物。`WILDLIFE_` 的物種／數量定義和 `PERIMETER=0` 的量測意義不明；不得當物種、個體數或零範圍。OGDL 雖有目錄聲明，缺 immutable raw SHA、逐點轉換、格網邊界及觀測日 receipt，標 `SOURCE_LINEAGE_HOLD`。owner-only 只用既有固定靜態檔查 bbox／屬性，不做最近、精確附近或現況判斷。花蓮 bbox `[121.2,23.5,121.3,23.6]` oracle 4；`WILDLIFE_=385` 與重複格網問題變體由獨立完整檔與 focused test 核對。
- 兩個來源家族／兩個 datasets／兩個 queryable mappings；focused Vitest 11/11（含 registry）、`npm run build` 含 `tsc -b` 通過。本機 3734 Vite 在第二十批地圖呈現後 Node heap OOM 退出，Gateway 8794 仍在；以同一隔離 root/config 和較高 heap 恢復 3734，HTTP 200。原 IAB 分頁轉成連線錯誤頁，正常 MCP 回 `BROWSER_DISCONNECTED`，新分頁未能附著，故這兩個新 reader 只有本機原表／adapter 測試與 HTTP 收據，**沒有**新的正常 MCP、scene ready 或 map readback。恢復配對後需只補此 gate，不重跑已通過的原表測試。
- Audit 778 layers、171 datasets、168 queryable mappings、33 metadata candidates、577 unknown/unavailable；610 待映射（reader 365、來源缺證 201、權利 HOLD 36、版本 8）。臺灣 GIS 主 Layers 381 層中已註冊 114、待接 267。未寫 Supabase/S3、未 push、PR、merge、部署或重啟過夜排程。

## 第二十二批：大專學生統計點、畜牧輔助名冊與清運停靠參考點

- `eduUniversityStudents` 的 Mini 與 analytics processed 同版 SHA `1e32c1b7bec888108b40697a1b07f88da00cd45ee42d00b2761f91989e9e4b64`／159 Point，安全 owner-only sidecar SHA `a3f5d6e49294aa2ae01da43aad7dde3200c41eeb5dda05a6c228c9ed1bc57e1f`／55,512 bytes，移除地址。教育部 data.gov.tw 6231 的 114 學年度 139 校統計共 1,056,844 人；與 113 學年度學校點位連接後，159 點中 21 校學生數 null，已對點學生數 1,055,790；未對點的一校 1,054 人不能補零或加入空間查詢。學生統計是 OGDL；學校座標再散布權未核，`COORDINATE_RIGHTS_HOLD`、owner-only。嘉義 bbox `[120.42,23.45,120.5,23.51]` 與完整 processed oracle 均 1；null 篩選 21、臺北市 28。點位不代表校門或學區，年份不同，不能宣稱現在人數。
- `livestockFeed` 258 Point、`livestockMarket` 21 Point、`livestockSlaughter` 185 Point。analytics processed SHA 依序 `b56ce8e43fa840ec7056bfe0634b810cf3415751a061bc5983af33b62e2c11ca`、`ab7c4271e71aae3013750ed87109b86ceaef085f463f0667e9d36ad1e3fceb43`、`68dcbf1aff4323f8122e81cfe235aff4511f75dd7712eca9ca69eb2ff7dadb72`；安全 sidecar SHA 依序 `cc3c6ce7f53697586f944418f7fa75a5642f8ed5a99d682a4d08d28a1bb7483f`、`a02fba74aea449f691a6fc376f7544636c0a26db9e926918774dd60b7791bcee`、`16dbc25b21ea640ee4aa0dca9c43416755fdfedd227430afdc441284fe06aadd`。移除地址、BAN、電話及重複經緯度欄。三份原始名冊的版本、完整 checksum 與逐列 Google geocode 來源權利未取得；均 `RIGHTS_HOLD`、owner-only、bbox／屬性參考，不能推論最近、產能或現況。focused test 以兩地 bbox 原檔 oracle 和 APPROXIMATE／禽別變體驗證；具體測試程式在 `src/research/__tests__/livestockAuxOwnerDatasets.test.ts`。
- `wasteStopsStatic` 本地固定 GeoJSON SHA `88951e69b0f6a146c88fdee8392940fce515e36b3cbaeff6a5ce8527dc47a26f`／22,445,099 bytes／73,060 Point，空間 sidecar 分成 315 個 gzip shard，manifest SHA `6f1cff79722edfc4ec9a3d6c84bd01e727ed53972e3e4a6d13654e2e25cf2d16`。38,312 政府原生座標、30,938 TGOS、1,135 POI fallback、2,675 legacy；混合來源授權與精度未逐項核對，`RIGHTS_HOLD`、owner-only。查詢必帶 bbox，超限拒絕；只保留 city／district／vehicle_type／via／routes_count，不帶站名、地址、路線識別。嘉義 bbox `[120.44,23.44,120.54,23.54]` 完整原檔 oracle 146，來源方法變體 `tgos_batch_v2_round4` 95；不是即時垃圾車、班表、服務覆蓋或最近停靠點。
- 這批增加五個 datasets／五個 queryable layer mappings。聚焦 Vitest 14/14（含 registry）、`npx tsc -b`、`npm run build` 皆通過。本機 3734 路由大專 55,512 bytes、飼料廠 46,816 bytes、清運 manifest 118,973 bytes 均 HTTP 200；外來 Host 404。8794 Gateway 已在監聽、session metadata 是 active，但 `pulse_describe_dataset` 回 `BROWSER_DISCONNECTED`，故沒有正常 Codex→MCP→Gateway→browser 的新查詢、scene ready 或 map readback 收據；恢復原配對頁面後只補這些 gate。Audit 778 layers、176 datasets、173 queryable mappings、29 metadata candidates、576 unknown/unavailable；605 待映射（reader 363、來源缺證 201、權利 HOLD 33、版本 8）。臺灣 GIS 主 Layers 381 中已註冊 119、待接 262。沒有 Supabase/S3 寫入、push、PR、merge、部署或重啟過夜排程。

## 第二十三批：LPG 分類與廢棄物設施歷史分類查詢

- `lpgSubpackaging` 與 `lpgRetailers` 共用 analytics canonical processed SHA `a22841339ec56843b14effec9564461228c42e9c58a2df48659fa34c83a26afa`／1,292 Point／1,544,059 bytes。由來源 `facility_kinds` 明確選出分裝 107 點，及零售、加氣、經銷聯集 567 點；`facility_mixed` only 的 624 點不硬塞進任一層。兩份安全 sidecar SHA `f7a4af144803aa787a47f9df9b66cdef413f4a7e4638e86338ccb8062620f7ba`／48,231 bytes 和 `dd13ad470858c06d6d449b683ac2ac4d596c9c105434e4ed7106be50308235ee`／243,267 bytes，移除 `_provenance`、地址、電話及 source URL。來源 1,743 列合流後雖標 1,292 canonical，實際只有 1,201 個不同 `entity_id`，82 個 ID 重複、額外 91 列；查詢以 sidecar 列號作唯一鍵，不悄悄去重。catalog 說 13 源 OGDL 與 CC BY 混合，processed 每列卻標 OGDL，`RIGHTS_HOLD`；150m fuzzy dedup 後的代理點只作 owner-only bbox／屬性，無最近店或可達性。嘉義 bbox `[120.42,23.45,120.5,23.51]` 來源 oracle 分裝 2、零售聯集 40；dealer 全檔 6。
- 廢棄物處理設施保留兩個不同來源快照：政府 processed 66 Point SHA `2d642d9986a4d0fc22012262a655b9b024804f2f0e4d9dac3f85394d7ad25ef2`，安全 sidecar SHA `d15cba86ef1fc58c8a58553c24a22bf07327c96a481036c71d92a4ad83a7d3f9`／23,415 bytes；OSM 對照 237 Point SHA `66bbb1f6a6fdde0a133c93905842665a5a1b55f776f7156b5f68a24b5c1a7e06`，安全 sidecar SHA `add89d5a1f0f1cdd1791c29e527726a6173ea3f77e887177cb006208e792edc3`／79,833 bytes。每個 layer reader 只回對應 `facility_type`：政府焚化 31、掩埋 12、監測井 17；OSM 轉運 38、回收 184、廢金屬 15。政府 unknown 6 不能硬當 `wfOther`，`wfLandfillCoastal`、`wfMedical` 也無對應類別，三層維持 [ ] HOLD。台北政府焚化 bbox 6、高雄 OSM 回收 bbox 30，直接完整原檔 oracle 與 focused test 一致。
- 政府 processed 含 NLSC/Google 後補座標，且 catalog 指後續 Supabase 曾達數百筆而本快照仍 66 筆；`RIGHTS_HOLD`、`VERSION_HOLD`，不能稱完整、同步或現況。OSM 是 ODbL 對照集，不能稱全國設施總數。兩者安全副本均刪地址、電話、geocode 回應與 OSM/well ID，只保留分類、來源方法與必要欄位。所有座標均作 proxy，不開最近設施／道路可達性。
- 這批增加八個 layer mappings／八個 datasets。focused Vitest 14/14（含 registry）、`npx tsc -b` 與 `npm run build` 通過；本機 3734 的 LPG、政府廢棄物與 OSM 安全路徑 HTTP 200／精確 bytes，外來 Host 404。原 pairing 的 `pulse_describe_dataset` 仍 `BROWSER_DISCONNECTED`，故沒有新的正常 MCP 查詢、scene ready 或 map readback。Audit 778 layers、184 datasets、181 queryable mappings、29 metadata candidates、568 unknown/unavailable；597 待映射（reader 363、來源缺證 193、權利 HOLD 33、版本 8）。臺灣 GIS 主 Layers 381 中已註冊 127、待接 254。未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

## 第二十四批：TDX 充電站固定點與水站縣市品質 HOLD

- `evChargingStations` 用 analytics 2026-06-15 processed SHA `fa5ee9640717cc0cac3ed60f00b2a244c41afa2523b27d1d0ebe9fb3f826c218`／3,060 Point。manifest 的來源流是 TDX 3,099 原始列、3,088 正規化列、3,060 去重點；縣市 data.gov 與 CPC 最終貢獻為零，不能把此固定版本稱成三方混合來源。3,060 個 `station_id` 均唯一；來源 scope 分布 city 2,947、rail 44、tourism 40、freeway 23、ship 4、airport 2，連江 H400 回零且未納入。安全 owner-only sidecar SHA `151204d74b32e0e1a1dfa2c095fe1e806b86cae7eff7718d92964a9208a8f87f`／814,273 bytes，移除地址、電話、服務時段、費率、接頭、樓層、描述及重複經緯度欄。台北 bbox 169、高雄 bbox 311、airport 來源 2，均與完整原表 oracle／focused test 一致。TDX 公開座標再散布條款與精度收據缺，`TDX_RIGHTS_HOLD`，只限本機 bbox／屬性／加總，不能回答今日可用、最近充電站、出入口或行車可達性。
- 下一個水資源已定位來源的品質核對發現 HOLD：本地雨量站 `rain_gauge_stations.geojson` 242 Point SHA `5a4203f5914c1d325b5f5ccd89f2b953be279b88a40d50a397d3d3a4063eb34b`，catalog 稱 22 縣市，但檔內僅 18 個非空縣市名與 1 個空值；標 `連江縣` 的 13 點包含 `[121.260353,24.588571]`，標 `屏東縣` 的「五堵」點是 `[121.696672,25.078985]`，與其縣市語意顯著不符。地下水井 `groundwater_wells.geojson` 959 Point SHA `f15549b80767b604d90b9e5a9c0c3a42e9ff5ce6fcc4183ee6ec800e09d68db2` 也有「水底寮(1)」標 `連江縣`、座標 `[120.598709,22.376125]`、來源地址為屏東的衝突。兩者目前 **不接成縣市比較或附近保證**；先核原始 `countyidentifier` 意義、TWD97→WGS84 轉換、用已驗邊界獨立對位並保留原值／修正來源。這是資料品質 HOLD，不把錯誤縣市加到圖層查詢結果。
- 本批新增加一個 dataset／一個 queryable mapping；focused Vitest 11/11（含 registry）、`npx tsc -b` 與 `npm run build` 通過。本機 owner-only EV route HTTP 200／814,273 bytes，外來 Host 404；原 pairing 的正常 MCP 仍 `BROWSER_DISCONNECTED`，故無新 scene ready、map readback。Audit 778 layers、185 datasets、182 queryable mappings、29 metadata candidates、567 unknown/unavailable；596 待映射（reader 363、來源缺證 192、權利 HOLD 33、版本 8），臺灣 GIS 主 Layers 381 中已註冊 128、待接 253。未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

## 第二十五批：動物服務與電廠分層 HOLD

- `animalWelfarePoints` 指向 analytics `animal_service_points`。目錄／manifest 記錄 10,503 raw、8,810 located、8,525 canonical Point、1,693 unlocated，但本機 analytics、GIS 與暫存位置沒有相應 processed GeoJSON，manifest 也缺可核的檔案 SHA；因此不能建立固定版本 reader，狀態維持 `SOURCE_MISSING`。解鎖需找回 processed 全量檔和原始分組收據並重算 hash、排除與 geometry。
- `facHistorical`、`facPlanned`、`facPrimary`、`facSecondary` 不能由同一個 2026-06-15 analytics `power_plants_20260615.geojson` 猜出：該檔 SHA `4a62a96feed7f2fb153131804be58b95f28ef8aa22561168aea902ffdcef24ae` 只有 22 Point（raw 175 機組列），總容量 29,629.241 MW，位置類別 14 ROOFTOP／7 APPROXIMATE／1 GEOMETRIC_CENTER；缺規劃、歷史、主次狀態欄，也沒有逐筆 Google／TGOS／manual 座標血緣。四層保留 `READER_PENDING`／權利疑慮；需取得對應的完整分層原表和逐筆座標來源後才可接入。本批無新 query mapping。

## 第二十六批：中油地熱井歷史點

- `geothermalWells` 接 CPC data.gov.tw 86147 原始 CSV 36 列 SHA `596bdfb2070d6d9a5c1485341a15da45b5ca7be4ec7d6ade1e7299cd5e304d9b`。DMS 經緯度逐筆重算後與 analytics processed 36 Point SHA `c5f1d58c04ba14250053aab0de7f5a30cb19bc3963db6fdf1a14bf6ba23abe15` 對齊；3 筆附圖 URL 空白不帶進 sidecar。安全 owner-only sidecar 10,888 bytes／SHA `39f0330f0e0971ba81d42e9014d50a0df05c866f287d4fe37d2139dc7aca1a7e` 只留井 ID、縣市代碼、地熱區、報告名稱與資料集 ID，不帶外部 URL 或原 DMS 欄。OGDL-Taiwan-1.0 記錄完整；歷史固定位置可做 bbox、直線距離與計數，不能當現況、井筒、儲層、深度、溫壓、安全或可進入的證據。公開展示同版仍待核。
- 宜蘭清水 bbox `[121.60,24.60,121.65,24.63]` 原表 oracle 11；臺東 `[120.90,22.50,121.05,22.75]` 原表 oracle 6，`清水` 屬性變體 11。focused Vitest 11/11（含 registry）、`npx tsc -b`、`npm run build` 通過。原 3734 browser 已斷線，記錄舊 session ID 後改用目前仍開的 3734 地圖重新配對；兩端短語一致後 session active。正常 Codex→MCP→Gateway→browser 查兩地回 11／6、`analysisComplete:true`、無 geometry 排除，來源 SHA 與 sidecar 一致；宜蘭 collection `ready` revision 1，map readback 11 features／1 source／1 layer，瀏覽器 Agent 動作紀錄顯示高亮 11 筆。沒有把新配對當作以前其他批次的追溯性驗收。
- Audit：778 layers、186 datasets、183 queryable mappings、29 metadata candidates、566 unknown/unavailable；595 待映射（reader 363、來源缺證 191、權利 HOLD 33、版本 8），臺灣 GIS 主 Layers 381 中已註冊 129、待接 252。未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

## 新配對補驗：充電站與裁罰密集區邊界

- `evChargingStations` 在新配對正常查詢：`scope=AirCAA` 得 2 筆，臺北松山附近 bbox `[121.545,25.055,121.56,25.07]` 得 9 筆；`scope=airport` 得 0 是錯誤 filter 值，原始 scope 代碼須沿用 `AirCAA`。上述來源 SHA 均為 owner sidecar `151204d7…f87f`，查詢資料可讀。將 9 筆交給結果圖層時 command revision 2 `error`，原 11 筆地熱井仍顯示；原因是研究呈現契約 `isMapEligibleGeometry` 排除 `role=proxy` 的 Point。這批只有 owner-only bbox／屬性查詢通過，**地圖結果呈現 HOLD**，不得將查詢成功寫成地圖高亮成功。
- `pollutionPenaltyCritical`／`General`／`Mobile`／`noiseEnforcementEvents` 共用 `tw-pollution-penalty-events-20260706`。臺中 bbox `[120.67,24.13,120.69,24.15]` 正常 MCP 命中 1,770 歷史事件、回傳 50 且 `displayTruncated:true`，掃 4,350 列／1,683,489 bytes、下載 53,814 bytes／2 requests；臺北 `[121.525,25.04,121.535,25.05]` 回 `DATASET_TOO_LARGE`。manifest 的交叉分片共 6 個、33,919 列、未壓縮 11,832,036 bytes，超過 point partition 20,000 列／8 MiB 固定上限，故密集區查詢仍 **HOLD**。要保證該區需重建更細且 SHA 固定的空間分片，或明定更小 bbox 並重新做獨立 oracle／browser 驗收；不得放寬成無界全表或把失敗解讀為零事件。代理點也不可拿來做精確距離或地圖呈現宣稱。

## 第二十七批：臺北市 2019 年事故參考點

- `accidentTaipei` 來源為臺北市 data.gov.tw 136123 的 analytics processed 22,918 Point，SHA `0640e94d1f16d857e502946e67eae2c7c40636ab160b7f8c9f433600cd206507`；發生日期 2019-01-01 至 2019-12-31，A1 83／A2 22,835。來源標 OGDL-Taiwan-1.0，但事件精確座標具敏感性，僅建立本機 owner-only bbox／屬性 reader；安全 sidecar 移除 entity_id、事故時間與地點文字，20 個 gzip shards 的 manifest SHA `3e934509ba2ef24a07162955f580c9cf7502677fdad0a10f3af8e6cce4f94f3f`。不表示目前事故、路口風險、事故率或安全。
- 來源全檔 oracle：臺北 bbox `[121.50,25.04,121.54,25.08]` A2 4,943；另一 bbox `[121.54,25.02,121.58,25.06]` A1 16，focused test 3/3。正常 MCP 後者回完整 16、掃 16,731 列／4,689,107 bytes、下載 265,008 bytes／5 requests，來源 SHA 一致。proxy Point 的研究地圖呈現與最近距離均 HOLD；正式圖層展示同版未驗。

## 第二十八批：2026-08-18 active 列管設施

- `regulatedFacilities` 使用與既有 `pollutionFacility` **不同版本** 的 EMS_S_01 家族：analytics processed 80,732 Point SHA `2cfa4bd59e050f7784d0dfcd1f571ca5d62c5cad78dd5073029363f31d45178f`。451,434 raw → 127,795 active → 80,732 有座標（63.17%），47,063 active 座標缺值仍無 Point；catalog 的 50.01% 是 company join 覆蓋，不能誤當座標覆蓋。OGDL-Taiwan-1.0 記錄完整；安全 sidecar 325 個 gzip shards／manifest SHA `82dda3a0e592e9a7ac087b9153ceaa2a7a61b651246e53f8564b289f460bd811`，移除 emsno、設施名、地址、統編和公司欄位，只能做 owner-only bbox／屬性查詢。列管不表示污染、排放、裁罰或當前營運。
- 兩組不同 bbox／屬性變體的完整來源 oracle 與 focused test 4/4 通過，安全分片重建得到相同 manifest SHA。正常 MCP 臺中 `[120.66,24.12,120.70,24.16]` 加 `isair=1` 得 72 筆、回傳上限 50 明示截斷；獨立原檔重算也是 72，掃 5,151 列／2,012,616 bytes、下載 222,900 bytes／3 requests。proxy Point 地圖呈現、精確最近及正式圖層同版均 HOLD。
- 兩批整合後 focused Vitest 16/16（含 registry）、`npx tsc -b`、`npm run build` 通過；3734 owner manifest 路由 HTTP 200（7,507／122,856 bytes），外來 Host 404。Audit 778 layers、188 datasets、185 queryable mappings、28 metadata candidates、565 unknown/unavailable；593 待映射（reader 361、來源缺證 191、權利 HOLD 33、版本 8），臺灣 GIS 主 Layers 381 中已註冊 131、待接 250。沒有 Supabase/S3 寫入，沒有 push、PR、merge、部署或重啟排程。

## 第二十九批：臺北行道樹清冊差異

- `streetTreesTaipeiDiff` 使用 2024-11-21 Wayback 基準與 2026-07-12 現行清冊推得的 analytics processed 99,527 Point，SHA `95dd7c6e1cabfac3662cd3ada3a5880bd2e122208fd55224c1aaecd6ccf7d3ce`。persisted 88,004／disappeared 7,494／appeared 4,029；447 筆 `renumber_suspect` **保留在母體**，不是排除數。`disappeared` 只代表 TreeID 未再出現，可能是編號或清冊調整，不是砍除；Wayback 不是官方版本化歷史，約 10% Region 是公園／綠地名。OGDL 記錄完整，但衍生比較只建立 owner-only bbox／屬性 reader。安全 sidecar 移除 TreeID、樹種、路段、行政區文字和測量值，32 gzip shards／manifest SHA `4d0cb1c23c040bb7b2cae3f3601d9d64e1a2f94a7cc85d431b39d6bcac792288`。
- 兩個不同 bbox／status 的全來源 oracle 與 focused 3/3 通過；正常 MCP 臺北 `[121.502,25.027,121.510,25.040]` 加 `status=disappeared` 命中 135、回傳 50 且明示截斷，掃 7,478 列／1,462,340 bytes、下載 88,843 bytes／2 requests。全台北大 bbox 超上限會 fail closed；不能把這個 reader 當全市清冊一次下載，也無精確最近或地圖呈現驗收。

## 第三十批：衛福部 AED 固定設置名冊

- `medAED` 原始 AED CSV 15,494 列 SHA `bb25209d…f3318debe`；0 缺座標，4 筆在既有臺灣 bbox 外，處理後 15,490 Point SHA `b4de010d5620cb52110b520d9a9980532ea9be00c755f1254e4a5a16a84bb9e6`。資料記錄 OGDL-Taiwan-1.0；安全 sidecar 338 gzip shards／manifest SHA `325a6c959dcf4e5f00dab13aa87a646579acdefcb55f425e70cdd368c39f178c`，排除地址、設備擺放細節、電話與重複 lat/lng，空字串轉 null 並保留缺值語意。只保證 2026-05-24 固定名冊的 bbox／屬性查詢，不能表示設備今日可用、功能正常、現場開放或緊急可進入；PMTiles 同版未驗。
- 兩個不同縣市 bbox 與場所類別的完整原檔 oracle：臺北類別 453、高雄 666，focused 3/3 通過；正常 MCP 高雄 `[120.28,22.56,120.38,22.67]` 命中 666、回傳 50 明示截斷，掃 874 列／485,241 bytes、下載 173,940 bytes／5 requests。全國大 bbox 逾掃描額度 fail closed。
- 兩批整合後 focused Vitest 15/15（含 registry）、`npx tsc -b`、`npm run build` 通過；3734 owner manifest route 200（12,639／127,368 bytes）、外來 Host 404。Audit 778 layers、190 datasets、187 queryable mappings、28 metadata candidates、563 unknown/unavailable；591 待映射（reader 359、來源缺證 191、權利 HOLD 33、版本 8），臺灣 GIS 主 Layers 381 中已註冊 133、待接 248。兩批都是 proxy Point，研究地圖結果呈現與精確最近 HOLD；未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

## 第三十一批：裁罰密集區分片修復與醫療來源 HOLD

- `pollutionPenaltyCritical`／`General`／`Mobile`／`noiseEnforcementEvents` 共用的 EMS_P_46 原始 GeoJSONSeq SHA `247d6a759942f37b17b12f12558b9d2fce2e9a80e73503b1cc52c1c9b251c937`／414,904 列未改。分片 builder 改採最高 0.003125° 的 deterministic 分割及每 shard **實際 feature bounds**，避免位於格網邊界的 0.01° bbox 不必要地選進相鄰整格。新 owner-only v2 manifest 597 shards／226,004 bytes／SHA `ece9ed26fae429952d88c897d850381a02d4dc80eee9328cfe7b6330157e07b3`；全 shard gzip、解壓 SHA、bbox、公開欄位與 414,904 筆總數均校驗。沒有提高 8 MiB／20,000 列硬限額或公開 `address_osm` 108,276 座標的授權。
- 原先 `DATASET_TOO_LARGE` 的臺北 bbox `[121.525,25.04,121.535,25.05]` 現選 4 shards、掃 3,676 列／1,507,117 bytes；完整原表 oracle 3,051，正常 MCP 查詢也命中 3,051、回傳 50 且明示截斷、下載 278,283 bytes／5 requests。臺中對照 bbox 的 oracle 1,770，廣域 bbox 仍 fail closed `DATASET_TOO_LARGE`。Python partition tests 2/2、focused Vitest 3/3、`tsc -b` 通過；owner route manifest HTTP 200／226,004 bytes、外來 Host 404。proxy Point 仍不可當實際違規位置、最近違規、地圖高亮或公開授權證據。
- NHI 混合醫療原表另核得 31,603 Point，SHA `d94164d2de2cd78f3ab777e13d93288e1d9956493329951a09c5a710038ca50d`；`medHospital` 三種醫院 451、`medClinic` 的 clinic 與前端既定「其他醫療」合計 23,472、`medPharmacy` 7,680，三者不與 `medAED` 同源。坐標為 TGOS 29,621、Google 1,603、Google retry 379 的**地址地理編碼**，不是上游原生設施點。原 `medical.md` 仍寫 NLSC 六都／OGDL，與 NHI 全國檔漂移；NHI 原授權及下載 receipt 未在本機檔案中核實，這三層保持 `RIGHTS_HOLD`／`READER_PENDING`，沒有接成可查，也不將 clinic 的其他醫療 1,707 筆錯稱診所。解鎖須取得 NHI 授權收據、固定版 raw、按三類完整 predicate 建有界分片 reader，再核前端同版。

## 第三十二批：港口代表點查詢

- `ports` 查詢來源是 analytics 2026-05-27 港口 **Point** 277 筆，SHA `80c46fd597679cbe717e2b24ac011b44b42a3514420ff4d6508fccab2c65479c`；農業部 204、TDX 38、合流 35。漁港 239、渡輪觀光碼頭 18、國際商港 7、國內商港 7，另有 6 個對岸港口的臺灣 `county_id` 與四桶分類 null，保留不歸入任何臺灣縣市。安全 owner-only sidecar 65,191 bytes／SHA `2c64fa271b2c48b741a268ce21f4e9a96f0a79ad7882e0a34d730cac079b864c`，不帶電話、英文名、原始 properties 與重複 lng/lat。analytics catalog 記 OGDL，但 TDX 合流坐標的公開再散布 receipt 未獨立核；既有 `ports` 地圖是另一份 277 Polygon SHA `b6163441f470f392ca94b0ee29f422fe0529eeb8c473e22c1934bf5d62a10518`，非同一原表，正式 polygon／point 同版 HOLD。
- Point 全原檔 oracle：宜蘭 bbox `[121.8,24.5,121.95,24.7]` 2（南方澳漁港、蘇澳港）；高雄 bbox `[120.2,22.55,120.4,22.75]` 的渡輪分類 7。focused tests 2/2、正常 MCP 兩地回 2／7，皆掃 277 列／65,191 bytes；owner route HTTP 200、外來 Host 404。這只保證固定版 Point 的 bbox／屬性查詢，不表示港區面、碼頭入口、今日航班、可通航性或精確最近。
- 本批與裁罰修復整合 focused Vitest 14/14（含 registry）、`npx tsc -b`、`npm run build` 通過。Audit 778 layers、191 datasets、188 queryable mappings、28 metadata candidates、562 unknown/unavailable；590 待映射（reader 358、來源缺證 191、權利 HOLD 33、版本 8），臺灣 GIS 主 Layers 381 中已註冊 134、待接 247。未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

## 第三十三批：NHI 醫療三類共用原表

- `medHospital`、`medClinic`、`medPharmacy` 共用 2026-06-02 已處理 NHI 31,603 Point／SHA `d94164d2de2cd78f3ab777e13d93288e1d9956493329951a09c5a710038ca50d`。三類互斥：醫院 451、診所與其他醫療 23,472（其中 clinic 21,765、其他 1,707）、藥局 7,680。TGOS 地理編碼 29,621、Google 1,603、Google retry 379；不是設施原生精確座標。owner-only 安全欄位 248 個 gzip shards／manifest SHA `35f59c0e4d6fc125a5b31e60ed5894c481494b4a54b853b294842b15283a8576`，不帶名稱、地址、電話、機構 ID 或服務欄位。
- 來源全表獨立 bbox 與 category oracle、focused tests 3/3；正常配對 MCP 臺北 bbox `[121.5,25,121.6,25.1]`：醫院 28、診所與其他 2,895、藥局 692；只篩 `clinic` 為 2,780，不能把 2,895 全稱診所。50 筆回傳上限與完整命中數分列。舊 `tw-medical-hospitals` public reader 是不同來源契約，保留而未覆蓋。
- NHI 原授權／下載 receipt 與 Google 衍生座標再散布權未核實，僅限 localhost owner-only `RIGHTS_HOLD`。proxy Point 不做最近距離、可達性、服務／營業／特約現況或研究結果地圖呈現；正式展示資產同版也未證。

## 第三十四批：機場參考點

- analytics `airports_merged_latest.geojson` 125 Point／2026-05-19／SHA `d82e9fff2cd6f7eb6417f22a2155cd9958815961731c1be073b4232f5629d6c2`；OurAirports 108、OurAirports+TDX 17。海拔 null 56、TDX ID null 108，未補零。安全 owner-only sidecar 39,377 bytes／SHA `44e9cec00cbf0ed86272409ac5a15bc24e63745936153bf47d69a9f9a18dd40f`。既有地圖資產是 16 Polygon/MultiPolygon／SHA `3b68ec72035281856ece48f4e564a75c591e0275d3627fbbc7890485ab931524`，Point 與 Polygon 不作同版宣稱。
- 完整原表兩地 bbox/category oracle、focused tests 2/2；正常配對 MCP 高雄 `[120.3,22.55,120.38,22.61]` 加 `large_airport` 得高雄國際機場 1，臺北 `[121.5,25.02,121.6,25.08]` 同篩得松山國際機場 1。較早高雄 bbox `[120.58,22.57,120.72,22.68]` 得 0 是查錯範圍，不是無機場。此點僅作機場名冊參考，不能代表入口、跑道、航班或營運。
- OurAirports/TDX 原始下載、合併時間與展示同版 receipt 未核，限 localhost owner-only。兩批整合 focused Vitest 14/14、`npx tsc -b`、`npm run build` 通過；3734 owner 路由 200（醫療 manifest 93,553、機場 39,377 bytes），外來 Host 404。Audit 778 層／195 datasets／191 queryable mappings／587 待映射；臺灣 GIS 主 Layers 381 中已註冊 137、待接 244。這 191 是入口登記數，proxy 結果不具地圖 ready/readback。未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

## 第三十五批：短期補習班地理編碼名冊

- `eduCramSchool` 的來源為高雄市教育局代管全國系統 city=2 原始 JSON 17,772 列／SHA `dc74fd5b0ccce06461b993b3b8e4de0fcf37ec0e6ebf1b1864d13636dba43c73`，2026-08-07 處理檔 17,137 Point／SHA `adf0dddc81dc6ba30ff71c72242b4263b5a3896b7faffd40cead7ee24711af4e`；635 筆未定位，不補行政區中心。定位精度 exact 10,100／cached 2,831／TGOS 4,129／interpolated 77；所謂 exact 仍是地理編碼階段，不是場址測量精度。owner-only 安全欄位 165 gzip shards／manifest SHA `0a419219ce202574d43048eb6cb5ca7acd802e4eac0aa399fc7c4c0b46bb53fa`，不帶名稱、地址、email 或機關代碼。
- 原表兩城市及類別變體 oracle、focused tests 3/3；正常 MCP 臺北 `[121.48,25.02,121.58,25.10]` 加 `category=文理類` 得 1,349，高雄 `[120.28,22.56,120.38,22.67]` 得 1,140，兩者回 50 且截斷明示。整合 Vitest 12/12、`npx tsc -b`、`npm run build` 通過，3734 manifest HTTP 200／62,431 bytes、外來 Host 404。
- catalog 記 OGDL，但 TGOS／cache／offline／interpolated 坐標的公開再散布證據未逐筆核實，維持 localhost owner-only `RIGHTS_HOLD`。proxy Point 只保證固定快照 bbox／屬性，不宣稱最近、距離、可達性、現今立案／營運或研究結果地圖呈現；PMTiles 同版未驗。Audit 778 層／196 datasets／192 queryable mappings／586 待映射；臺灣 GIS 主 Layers 381 中已註冊 138、待接 243。未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

## 第三十六批：公司資本額 1.5 公里格網

- `companyCapitalGrid` 所屬 GCIS 202608 r2 同源格網中的 1.5km GeoJSON 有 5,745 個 occupied-only Polygon，SHA `ecf59329d4812d55bf3f8b1cc296ab94b3cfc994dcc9da5cea866f9af496d330`。657,882 來源列排除 dead/abnormal 1,152 和 invalid coordinate 2,565 後，654,165 家公司匯總到格網；`sum(n_companies)=654,165`，`sum(capital_sum)=40,627,610,824,468 TWD`。3 格 `capital_median=null` 且資本額總和為 0，null 不能改成觀測零；輸出只含有公司的格網，缺格不能推論零公司。安全 sidecar 2,242,079 bytes／SHA `70b06d90b13bf46d35fa13864b1f5fa7ecc9e829cce5c6757929b35b0369320c`，本機 owner-only。
- 原表獨立對帳、focused test 3/3；正常配對 MCP 用 `grid_id=G1500_100_245` 得臺北格公司數 384／資本總額 1,607,718,088 TWD，`G1500_18_77` 得高雄格 14／1,246,090,000 TWD，均與原檔一致。整合 focused 40/40（含 registry、manifest、sidebar）、`tsc -b`、`npm run build` 通過；owner 路由 HTTP 200／2,242,079 bytes、外來 Host 404。
- 本片初次接線時 QueryExecutor 尚未提供 Polygon bbox，第三十八批已補完整面相交後，1.5km reader 可用 bbox 查**相交格網**；這仍不代表格內每家公司位置或地圖結果呈現。150m 89,754 格／33MB、450m 26,834 格／9.9MB 仍須 bounded Polygon 分片，標 `READER_PENDING`；118 份原始來源授權／取得 receipt 未逐份核，公開再散布 `RIGHTS_HOLD`。公司點、格網與工廠點不是同一粒度。

## 第三十七批：無人機空域歷史資料稽核與標示修正

- `droneNoFlyZone` 和 `droneRestrictedZone` 共享民航局 dronegis 2026-06-30 union 快照，處理 GeoJSON SHA `f6abe82cd4a3bad5e05647a46f726e2a2d620801b31aba4e439800458b6e8813`、本機 PMTiles SHA `a6cf67ee9cbef933254debbe77b02fcf19bf9bb53be0e860ad1e70d3264d5a0e`。原 NFZ 5,095、UAV_fs_ryg 4,424，合併 5,743 features：紅 4,311、黃 108、無色 1,324（5,741 Polygon＋2 MultiPolygon）。原 manifest 錯寫無色 1,322／紅加無色 5,633，並錯指已廢棄、0 面的 `airport_safety_zones`；前端 manifest、legend、popup 與註解已改成 1,324／5,635，正確指向 `drone_restricted_zones`，明示歷史快照不判定現行規則。
- **目前兩層均未接研究 Polygon reader。** 4,757 面起迄有效日期都缺，另有 12 面明確到期；PMTiles 未保留日期欄。catalog 只寫「OGDL-style」，原始授權未核；processed manifest 無 SHA 欄（本片自行算出上述 SHA）。幾何 bbox `[12.089547,10.215898,124.699825,27.332917]`，5 個紅區有臺灣 envelope 外頂點，不能直接說全臺完整覆蓋或用來回答「現在可飛嗎」。後續若做 owner-only 歷史 contains/bbox reader，須保留完整面、缺期／到期狀態及跨域 geometry 異常，並先實作 bounded Polygon 範圍讀取；任何現行法律結論仍 HOLD。
- 本批完成的是**來源稽核與既有 UI 資料語意修正**，不是新增可查映射。Audit 778 層／197 datasets／193 queryable mappings／585 待映射；臺灣 GIS 主 Layers 381 中已註冊 139、待接 242。未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

## 第三十八批：共用 Polygon/MultiPolygon bbox 查詢

- QueryExecutor 現在以完整 EPSG:4326 Polygon/MultiPolygon 與閉合 bbox Polygon 的相交判斷過濾結果；Point 的原路徑不變。洞內小 bbox 不誤命中、多面只碰第二塊仍命中、邊界接觸依 intersects 命中；畸形或超過 200,000 頂點 fail closed，不退成質心近似。`supportsBbox` 只授權有界讀取，**不**把 generalized/proxy 面升格成精確空間分析資格。原本的 rows／source bytes／response 上限保留。
- `companyCapitalGrid` 1.5km 用新的 bbox 契約，正常配對 MCP：臺北小 bbox `[121.4457,25.0147,121.446,25.015]` 得 `G1500_100_245` 1 格（384 公司／1,607,718,088 TWD）；高雄 `[120.2404,22.738,120.2408,22.7385]` 得 `G1500_18_77` 1 格（14 公司／1,246,090,000 TWD），與原表兩格相符。第一次 MCP 回 `BBOX_NOT_SUPPORTED` 是既有 3734 browser 模組尚未重載；在既有本機瀏覽器 reload 後 descriptor 變 `supportsBbox:true`，正常查詢通過，配對保持可用。focused Vitest 23/23、`tsc -b` 通過；結果地圖呈現仍未通過，因這是 generalized grid。

## 第三十九批：臺南、桃園滯洪池參考點

- `waterDetentionBasins` 本機既有展示 GeoJSON 56 Point／SHA `6dd46deca47a13b479ad8dede339eb1c4e14c0540b08b5b3472e1d6fc250686a`，可追到臺南 data.gov.tw 108523 原始 45 列／SHA `df2521430f8a76f204361e9c5300cfa83d1f5c0efa010c4f9ef7ff41333f2aab`（TM97 經既有 pipeline 轉 WGS84）與桃園 152950 原始 11 列／SHA `7644ebf0dcec99ffcfb9621c612540874ae43237eceb4a72db5d8188a721a132`（原生 WGS84）。安全 owner-only sidecar 13,922 bytes／SHA `c2e6713f17b24cc3c792704b486508a6c34ba2c826da8fa50bcc686fd3dad01c`，只留 ID、名稱、縣市、類別、面積、來源 ID、Point。臺南 45 筆有面積，桃園 11 筆 `area_m2=null`；56 筆全都缺 township/status/設計與目前容量/深度，不補零。
- 原表兩縣市 bbox 與縣市變體 oracle、focused 2/2；正常配對 MCP 臺南 `[120.24,23.08,120.29,23.14]` 得 11、桃園 `[121.35,25.03,121.41,25.06]` 加 `county=taoyuan` 得 8，桃園面積維持 null。整合 focused Vitest 25/25、`npx tsc -b`、`npm run build` 通過；3734 owner route 200／13,922 bytes，外來 Host 404。此 Point 不是池界、入口、容量或現況防洪服務，不做最近距離或結果地圖呈現；其他縣市不在此固定來源。
- 同批初查 `waterFacilities`：Mini 展示 609 Point，內含 OSM 526＋WRA GIC 83，但 analytics catalog／manifest 只描述 OSM 526，當時先保持 `VERSION_MISMATCH_HOLD`；第四十一批已補逐筆同版核對與 owner-only reader，以下方新收據為準，公開 WRA 授權仍 HOLD。`waterMonitorStations` 展示 2,032 Point（地下水井 959、河川水位 831、雨量 242）卻宣告 rain_gauge_stations 上游；樣本一筆標連江縣的地下水井座標在 `[120.598709078,22.376124941]`，縣市與位置明顯不合，維持 `DATA_QUALITY_HOLD`。兩者不因檔案存在而接成保證可查。

### 第四十批：公司資本額細網格

- 同一 GCIS 202608 r2 來源家族補齊 `companyCapitalGrid` 的 150m 與 450m occupied-only Polygon。150m 來源 89,754 格／SHA `a0da52b2b1ac58edff22f214d6a8ebda23aa4437476eee8af6d0b4bbc2204d03`，316 個 immutable gzip 分片、manifest SHA `bb61165aedb74049a1959bd4e4f06dab5d16fa2438f4e1aeba29125665de2c09`；450m 來源 26,834 格／SHA `c79e8b49cf61ffb8292ad3c46ff26d799d7482b37529c7bfee2e15bc78536747`，304 分片、manifest SHA `0f9e97a5f9acf386a1b8111ed17af8317c7a69ffe56b1c13d742438fc8201d6c`。分片保留完整原始 Polygon 和格網 ID、公司數、資本額總和及中位數；只在 localhost owner-only 提供，bbox 必填，超過 20,000 掃描列或 8 MiB 拒絕，不能以未輸出的格網推論零。
- 正常 Codex→MCP→Gateway→既有 3734 browser 配對，在臺北 `[121.48,25.02,121.50,25.04]` 150m 152 格／450m 30 格，高雄 `[120.28,22.56,120.30,22.58]` 150m 17 格／450m 6 格，與各尺度全來源 oracle 相符；50 列頁面限制沒有改變 totalMatched。focused Vitest 14/14、`tsc -b`、build、localhost manifest 200／外來 Host 404 通過。細格是公司地址聚合的 generalized surface，不是精確營業位置；118 來源授權收據及研究地圖 ready/readback 仍 HOLD。

### 第四十一批：水利設施參考點

- 固定 Mini 展示 `public/geo/water_facilities.geojson` 為 609 Point／SHA-256 `e8174fcc90650280842c8f8b550cfd59b5ed95c63db40fb7db3a8382e034fa97`。按 ID、類型、來源與展示精度座標逐筆核對，恰為 analytics OSM 526 Point（SHA `a37739bb35a422f99169ba8fb3361508c782e9824d8128046e49b75d4527b742`）與 WRA GIC 83 Point（SHA `edb65b22c115c303a4a4597faaa55212a77f7a4e8aedb97faada98a4c68bd99a`）的聯集；舊 catalog 單列 OSM 526 並不足以描述此展示檔。安全欄位 sidecar 609 筆／145,437 bytes／SHA `f00e4e3288cac3bd55d921699083a0cabf61000a2070932602f7147d06768ca3`，只由 localhost owner-only Host guard 提供。
- `waterFacilities` 的 `tw-water-facilities-reference-owner-20260519` reader 保留 OSM ODbL 與 WRA GIC 來源差異、`name` 空字串 172、`county` 空字串 490、`operator` 空字串 458 與 null 83；不推定缺欄值。OSM way 中心與 WRA EPSG:3826 轉換點皆是參考位置，只允許有界 bbox／屬性查詢，不主張最近距離、設施入口、營運狀態或服務能力。WRA 原始 SHP 再散布權利收據未核，公開使用仍 `RIGHTS_HOLD`。
- 正常 Codex→MCP→Gateway→既有 3734 browser 配對查詢：臺北 `[121.45,25,121.62,25.12]` 命中 149；臺南 `[120.1,22.9,120.3,23.1]` 且 `facility_type=pump_station_official` 命中 1（永康大排抽水站），與固定全檔掃描相符。研究地圖 ready/readback 未通過；此 proxy Point 不可升格為合格的精確附近分析。

### 第四十二批：水利監測站固定名冊

- `waterMonitorStations` 展示 2,032 Point／SHA `4f6ab8edb69b68e17ea15be500b117581869d1af71a0196b4ee72870326a2baf`，以 ID、站型及展示精度座標逐筆核對後，恰為 WRA 雨量站 242（SHA `5a4203f5914c1d325b5f5ccd89f2b953be279b88a40d50a397d3d3a4063eb34b`）、河川水位站 831（SHA `9698f7dbb4ef3d4b4831de5f23765c6f17d9102c0f25d334a644d9cdd1ac48bb`）、地下水觀測井 959（SHA `f15549b80767b604d90b9e5a9c0c3a42e9ff5ce6fcc4183ee6ec800e09d68db2`）的聯集。原 manifest 單列 rain gauge 不足以描述全部展示點。安全 sidecar 2,032 筆／664,353 bytes／SHA `73a653674aeddeffd0f3ad697930ff65351fea861ce545f895547a4896a341b3`；排除地址，只由 localhost owner-only 路由提供。
- 用固定 county-reference-2025 邊界 SHA `3feeca872210d6072c975e5e160c81926972337224b36a1573fb4b74f1a48f6c` 檢核原縣市欄：1,647 筆吻合、360 筆不合、15 筆未知、10 筆落在參考邊界之外。保留 `reported_county` 與 `county_spatial_check`，但原縣市欄不能篩選，也不提供 aggregate；縣市比較仍 HOLD。`is_active` 只代表 2026-05-19 快照：雨量 242 true、河川 370 true／461 false、地下水 959 false，不能推論現在是否工作或有即時讀值。
- 有界 reader 只允許 bbox／站型／歷史 active／品質旗標等查詢；三份 EPSG:3826 轉換站點是參考 Point，精確最近距離與研究地圖 ready/readback 未通過。正常 Codex→MCP→Gateway→既有 3734 browser 配對：臺北 bbox `[121.45,25,121.62,25.12]` 56 站；宜蘭 `[121.7,24.92,121.8,25]` 且 river_level、is_active=true 為 5，與全檔 oracle 相符。focused 11/11、localhost 路由 200／外來 Host 404 通過。WRA immutable raw payload、下載時間及公開授權收據缺失，公開再散布、最新讀值、站況和縣市比較仍 HOLD。

### 第四十三批：壩堰來源與水庫展示邊界

- 現有 `waterReservoirs` 展示混合 111 個壩／水庫代表 Point 與 129 個 MultiPolygon 蓄水面；111 點又是資料庫 `dam_weirs_wra` 的 74 點加另一張 `water_reservoirs` 的 37 點匯出。37 點沒有本機 raw／processed／版本收據，故整份 111 點展示與分析同版仍 HOLD，不能拿另一份壩堰名冊替代。
- 可獨立確認的 WRA GIC SWRESOIR 是 2026-05-19 處理檔 98 Point／SHA `61dc48810045e75de5d1097eb1fca541f20e526949284809131dea2cbae59455`，與 111 點展示不同。安全欄位 sidecar 98 筆／25,406 bytes／SHA `2c2048f757e53df2ba2d0eacfe8e3645ad44c5806cddd7c596617c9e0e42074b` 只在 localhost owner-only；`source_dam_id=wra:0` 重複 25 列保留，以 sidecar ordinal 建唯一 `record_id`。來源中文名稱解碼損壞而排除，英文名 null 36、四項工程值各 null 25，不改為零或現在的蓄水量。座標是官方 SHP feature 參考點，無入口或精度證據，僅 bbox／屬性，不提供 nearest。
- 正常 Codex→MCP→Gateway→既有 3734 browser 配對：北部 `[121.45,24.85,121.65,25.1]` 命中 5，南部 `[120.3,22.7,120.6,23.1]` 命中 8，與 98 點原表 oracle 相同。focused 11/11、`tsc -b`、localhost 路由 200／外來 Host 404 通過。129 個 WRA 水庫蓄水面是另一份 2026-05-19 MultiPolygon 來源（SHA `8b4befa6…11a8`）；最大單一原 feature 約 8.97 MB，超過 8 MiB 有界讀取上限，本批不縮面、不截形，reader／地圖與整層完成保持 HOLD。原始下載收據與公開發布亦未驗。

### 第四十四至四十五批：歷史警政事件點

- `trafficAccidentYearly` 用警政署 114 年 A1 死亡交通事故原始 ZIP SHA `bb589b97b9473b639be262183b6f2e6b256b0f52c6c28ae1770214c62bdea99e` 與 processed 1,600 Point SHA `732c01d31864741b482cec34fca8952d41fca56a0ceb8c9f2eff4854516f0fb4` 建 owner-only 讀取；安全 sidecar 602,145 bytes／SHA `7381ad9f678d19accc9d02b7f1cb67d4b63bc47b402ab980402b12e91e1a7dc4`。`incident_id` 1,600 個唯一值，地址與人員欄位不輸出。這只是 2025 年 A1 歷史快照，不涵蓋 A2 或目前事故。正常配對 MCP 在埔里 `[120.95,23.95,121.05,24.05]` 命中 11，臺北 `[121.5,25.02,121.58,25.1]` 命中 36，與全 processed 原表 oracle 相符。
- `theftTaoyuan` 用桃園原始 CSV SHA `20ff5ed3f07afd711ef2b0586c3127b17503c36403959163626b05ac527ba657` 與 processed 1,423 Point SHA `3e60392a46a65efd06bbc4b9803713908bab44b98b3930e5ac4709d461e69572` 建 owner-only 讀取；安全 sidecar 394,123 bytes／SHA `fc30d85d930c2c4e93bbbebb0ef94dbcd8d2afdbfe268ae98341482601e9c6e3`。`case_id` 1,423 個唯一值。`district_raw` 全空，`year_raw` 同時有民國 111–113、西元與異常 970，故年月／日期僅原字串可讀，不提供時間篩選或聚合比較。桃園 `[121.25,24.95,121.35,25.05]` 加住宅竊盜條件正常 MCP 命中 138，與全來源 oracle 相符。
- 兩者均是原表經緯度但歷史敏感事件位置，以 proxy Point 僅作有界 bbox／屬性查詢；精確最近、現在治安／交通風險與研究地圖 ready/readback 均 HOLD。兩個 Mini 宣告的展示 GeoJSON 在本機都缺檔，保持 `DISPLAY_HOLD`；這不妨礙已核版本 owner-only 查詢。focused 11/11、localhost 兩端點 200／外來 Host 404 已通過。

### 第四十六批：消防栓 A/E 固定 CSV 快照

- 可驗的母體是 analytics `hydrants.csv` 69,839 個唯一 Point／SHA `ca71db6e0c927368d1480ce11dca9919a4c46f3b7e252548adfe05850fa941ea`：data.gov 128639 的 A 30,444 加五個高雄來源 E 39,395；地下式 48,601、地上式 18,407、其他 2,831。原地址空 52,173、district 全空 69,839，安全 sidecar 全部排除地址與 district，保留 ID／縣市代碼／型式／來源／geometry。110 個 immutable gzip 分片的 manifest SHA `668101cade6c8f0f86e76089855df0af43e9de9a232a4428ee87090199b65bdf`，只在 localhost owner-only 服務。
- 本機 `dist/geo/fire_hydrants.geojson` 69,839 Point 可依相同 export 規則從 CSV 逐位元重算相符；PMTiles metadata 指向該 GeoJSON，但 PMTiles 與遠端發布缺獨立 source SHA 收據。另有臺北 XML 21,852 筆，是替代來源，不能直接與 69,839 相加；資料庫 migration 去重後約 69,815 屬另一版本，尚無可核本機匯出。這個 reader 只保證 A/E CSV 版，不代表四縣市或 production 全量。
- 消防栓 Point 是固定參考座標，現況、可用水壓、救災通行、最近距離與服務覆蓋均無證據，採 proxy 與 bbox／屬性查詢。正常 Codex→MCP→Gateway→既有 3734 browser 配對：北部 `[121.54,25.02,121.57,25.05]` 2,179、高雄 `[120.28,22.61,120.32,22.65]` 5,275，與全 CSV oracle 相同；全臺過大 bbox 安全拒絕。focused 12/12、localhost manifest 200／外來 Host 404 已通過。精確附近、資料庫 69,815、替代臺北 XML、remote 同版與研究地圖 ready/readback [ ] HOLD。

### 第四十七批：文化部文化設施完整名冊

- `culturalFacilities` 原已有 787 個展示 Point 的 source-coordinate reader；本批補完整 2026-07-16 MOC 六類名冊。六份 raw JSON 與 processed 1,170 列／SHA `5b018ab1615c4fb818f8b147cbb77df51f4ae8fb42abec231f792a615781a89b` 固定核對，當中 787 Point 逐筆對上 Mini display SHA `0f7d0d93b9695c2beb45f5916fb0185f1aac30c9e333669ebe31bc55f506591d`；另外 383 筆 geometry=null 保留可屬性查詢。owner-only 安全 sidecar 365,985 bytes／SHA `3390db215e3d505ff44b6a99f5de37988c1b5f0053766d8254596381071e96f1`，`facility_id` 1,170 個唯一值。city 25 筆、address 9 筆空字串原樣保留。
- 正常 Codex→MCP→Gateway→既有 3734 browser 配對：臺北 `[121.5,25.02,121.58,25.1]` 命中 184，實體書店變體 135；高雄 `[120.25,22.58,120.35,22.68]` 命中 47；無 bbox 加 `no_coord` 查得完整 383。全部與 processed 全表 oracle 一致。focused test、`tsc -b`、build、localhost sidecar 200／外來 Host 404 通過。新 reader 對 Point 採 proxy，只保證固定來源 bbox／屬性；今日營運、精確最近、公開地圖及研究地圖 ready/readback仍 [ ] HOLD。這是既有查詢映射的補全，沒有增加已映射 layer 數。

### 第四十八批：地下水觀測井靜態站位

- `groundwaterWells` 僅接 WRA 固定 processed `groundwater_wells.geojson` 959 Point／779,348 bytes／SHA `f15549b80767b604d90b9e5a9c0c3a42e9ff5ce6fcc4183ee6ec800e09d68db2`；同 959 筆 ID／名稱／座標與前述 `waterMonitorStations` 2,032 點聯集的地下水子集核對一致，但 reader 直綁這份 959 來源。21 個 gzip 分片、manifest SHA `2cd44a610c1c284d9de2fee054c95bb26a8eeba5bac3757af0754f6f3a0b3967`，本機 owner-only。WRA 原始 API 快照未保存，不能聲稱可重演原始下載。
- `elevation_m` 959 筆全 null，`is_active` 959 筆全 false 且與來源文件「僅廢止才 false」敘述矛盾；兩者原樣可讀、不能篩選或解釋為全部已廢。`reported_county` 因固定縣界檢核曾發現錯置，只作來源欄，不可用於縣市比較。地址與鄉鎮欄排除。只提供 bbox／ID 屬性查詢；Point 是參考站位 proxy，精確最近、入口、目前站況和水位觀測均未驗。
- 正常 Codex→MCP→Gateway→既有 3734 browser 配對：嘉義 `[120.30,23.35,120.55,23.60]` 命中 32，宜蘭 `[121.55,24.55,121.85,24.85]` 命中 39，與完整 959 原表 oracle 一致；另兩個不同 bbox 得 26／53，顯示範圍改變會重新計數。focused test、`tsc -b`、build、localhost manifest 200／外來 Host 404 通過。`groundwater` 動態水位層仍 HOLD，不能用靜態井位代替即時水位；研究地圖 ready/readback 未通過。
- Audit：778 層／198 datasets／194 queryable mappings／27 metadata 候選／584 待映射；臺灣 GIS 主 Layers 381 中已註冊 140、待接 241。未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

### 第四十九批：農產品零售公司固定定位快照

- `agriRetail` 的 source 是經濟部商業發展署 data.gov.tw:45618 2026-05 原始 CSV 58,613 列／SHA `74ff3edad2badf5af0916c5cd552ee7c4a49c20cb5562e5c1b1fb4a597623f85`；核准設立 37,789，其中 TGOS 未定位 359。2026-05-25 processed GeoJSON 37,430 Point／SHA `9e1e02a0678b66b30a69496325c4afb74624c28dced16aa1990d4b79c1b5ec37`。276 個 SHA-bound gzip 分片 manifest SHA `b5c9d4cc5f480bd616f3c9788c5a9c89b90b8f444b3fcc4927e833c9dfe45a60`；統編、公司名、負責人、地址、資本與原始座標未進安全欄位 sidecar。
- 全原表 oracle 與正常 Codex→MCP→Gateway→既有 3734 配對 browser 查詢：臺北 `[121.50,25.02,121.58,25.10]` 加 `company_status=核准設立` 命中 6,082；臺中 `[120.62,24.12,120.75,24.22]` 命中 3,987，兩者回 50 並明示截斷。focused tests 12/12、`npx tsc -b`、`npm run build` 通過；localhost manifest HTTP 200／104,180 bytes、外來 Host 404。全臺大 bbox 以 `DATASET_TOO_LARGE` 拒絕。
- TGOS 衍生座標的公開再散布收據未逐筆核對，僅 localhost owner-only；Point 是地址地理編碼的 proxy，不保證商店入口、今日仍營業、精確最近、服務範圍、供貨或研究地圖 ready/readback。Audit：778 層／209 datasets／202 個查詢映射／576 待映射；臺灣 GIS 主 Layers 381 中已註冊 148、待接 233。未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

### 第五十批：同源七類畜禽場固定定位快照

- `livestockFarmCattle/Chicken/Duck/Goose/Other/Pig/Sheep` 共用 Mini 本地 enriched-v3 `public/agriculture/livestock_farms.geojson` 13,087 Point／SHA `41c3244b7eff050697fd746282d79b5c75c688960fa38c3c644b80e241819e13`。各類 574／5,176／1,305／531／273／4,584／644，總數守恆；高／中／低精度 12,271／47／769，Google 衍生座標 857。215 個 gzip 分片 manifest SHA `ce3d6fb33205cfc47da8fb8f0de30e2d48c650054b52fd96a6712d0dffab8b0a`。sidecar 僅有分類、座標來源、精度及 geometry，移除場名、證號、地號、縣市、種類明細與頭數。
- 全原表 oracle：嘉義 `[120.30,23.35,120.55,23.60]` 各類 24／331／73／34／13／146／27，總 648；屏東 `[120.40,22.40,120.75,22.75]` 各類 88／543／269／52／12／916／64，總 1,944。正常 Codex→MCP→Gateway→既有 3734 配對 browser 得嘉義雞 331、屏東豬 916、嘉義其他 13；focused tests 12/12、`npx tsc -b`、`npm run build`、localhost manifest 200／81,092 bytes、外來 Host 404 通過。廣域過量 bbox 以 `DATASET_TOO_LARGE` 拒絕。
- ARIS batch 涵蓋不完整，缺點不等於零畜禽場；Google／EMS／NLSC／twland 定位再散布權仍 HOLD。低精度 769 筆可能是地段中心；本機 owner-only reader 僅保證固定版本的 bbox／類別查詢，不聲稱精確場址、今日營運、頭數、縣市比較或附近距離。既有展示走 `get_livestock_farms` RPC，其同版 release 未讀；研究地圖 ready/readback [ ] HOLD。Audit：778 層／216 datasets／209 查詢映射／569 待映射；臺灣 GIS 主 Layers 381 中已註冊 155、待接 226。未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

### 第五十一批：蔬果批發公司固定定位快照

- `agriProduceWholesale` 經濟部商業發展署 data.gov.tw:45655 原始 CSV 35,218 列／SHA `4aba5f45721c1124b800ed94e5bd22b6996cdbd3a9ca6ada6e79fea74a2eebe2`，核准設立 23,046，TGOS 未定位 203。analytics processed 與 Mini 本地 GeoJSON 都是 22,843 Point／SHA `95891f3dfef06431bdb49b04e72503c1de865ffb5704da50179bad6564e25008`；249 個 SHA-bound gzip 分片 manifest SHA `357a881d906ea0c8f734677117e1fc007d1bb4b98cccd1039fa73948f577cb89`。安全 sidecar 排除統編、公司名、負責人、地址、資本與原始經緯度。
- 完整原表 oracle 與正常 Codex→MCP→Gateway→既有 3734 配對 browser 一致：臺北 `[121.50,25.02,121.58,25.10]` 3,446、臺中 `[120.62,24.12,120.75,24.22]` 2,296；臺北加 `company_status=解散` 為 0（發布點限核准設立）。focused tests 12/12、`npx tsc -b`、`npm run build`、localhost manifest 200／93,817 bytes、外來 Host 404 通過；全臺過大 bbox fail closed。
- OGDL catalog 不足以證明 TGOS 衍生座標的公開再散布，reader 維持 localhost owner-only。地址地理編碼 Point 是 proxy，不能回答目前營業、最近批發場所、入口、供貨或服務範圍；PMTiles 同版與研究地圖 ready/readback [ ] HOLD。Audit：778 層／217 datasets／210 查詢映射／568 待映射；臺灣 GIS 主 Layers 381 中已註冊 156、待接 225。未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

### 第五十二批：寺廟多來源固定合併快照

- `religionTemples` 取 analytics 2026-08-01 trust chain 原表 19,201 Point／SHA `ee6c5549b35bc76dbf4ac22ee0ce5dd6a4684b5269af416cf43cfc6736f2207e`，來源含內政部 XML、文資寺廟、宗教百景與 OSM。MOI 系 12,499、OSM-only 6,702；原 MOI 507 筆無有效座標，其中 503 回填，最終 2 筆仍未入 Point artifact。320 個 gzip 分片 manifest SHA `c6eece8825ee30e241762dea9db2a662860e97f5e6201e98ed1791bf210451ac`，安全 sidecar 只含來源／類別／登記／精度旗標及 geometry；名稱、地址、電話、負責人、MOI 編號和巢狀 provenance 未進側錄。
- 全原表 oracle 與正常 Codex→MCP→Gateway→既有 3734 配對 browser：臺南 `[120.30,23.30,120.50,23.50]` 加 MOI 原始來源、補辦登記命中 109；高雄 `[120.20,22.55,120.40,22.70]` 加 OSM 來源命中 99，登記別保留 null。focused tests 13/13、`npx tsc -b`、`npm run build`、localhost manifest 200／120,709 bytes、外來 Host 404 通過。臺灣 bbox `[118,21,123,27]` 命中 19,200；另 1 Point 在範圍外，並未刪改原始 geometry。
- 官方資料 OGDL；OSM 部分需 © OpenStreetMap contributors／ODbL 條件，Google 地理編碼補點的公開再散布權尚未逐筆核對，限 localhost owner-only。Point 是混合精度參考位置，不能推論全部已登記、今日開放、精確最近或可達性；PMTiles 同版和研究地圖 ready/readback [ ] HOLD。Audit：778 層／218 datasets／211 查詢映射／567 待映射；臺灣 GIS 主 Layers 381 中已註冊 157、待接 224。未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

### 第五十三批：臺北與臺中混合年代樹籍點

- `streetTreesNational` 的真實涵蓋是臺北 92,033 加臺中 118,403，合計 210,436 Point；merged GeoJSON SHA `a9b2e18ec60e2444bc263bb0bf1c9ee804b66a7a62064a38affb6a7890f6de99`。臺北 2026-07-12 raw JSON SHA `80c8c567d3e80d9e5ddeb186b8d41844160a71fea6eb58d72cd39a5daa98949e`，臺中 processed GeoJSON SHA `7743407091c35e0a110c6a478a0aaa77caf54dc6484993d2e06af4004e1d4ca3`；各上游 catalog 記 OGDL。93 個 gzip 分片 manifest SHA `b1fc01a0908d8b18169b5cd774da4d1f3824d7f7c81671f09615108f3c1b99e3`，sidecar 排除地址與重複原始經緯度。
- 原表與正常 Codex→MCP→Gateway→既有 3734 配對 browser：臺北 `[121.50,25.03,121.51,25.04]` 1,187；臺中 `[120.65,24.16,120.66,24.17]` 701，依 `location_type=公園廣場` 為 316（同框人行道 385）。focused tests 12/12、`npx tsc -b`、`npm run build`、localhost manifest 200／36,110 bytes、外來 Host 404 通過；全臺大 bbox 以 `DATASET_TOO_LARGE` 拒絕。
- 臺北是 2026-07-12 快照，臺中為 2016–2019 調查／2020 製圖，不能當同時點比較。臺中原表 `公園廣場` 共 61,321，不宜統稱路旁行道樹；`location_type` 空字串 13,121、`survey_date` 空字串 1 筆保留。兩市以外無資料是未涵蓋，不是零樹。Point 僅作固定清冊 bbox／屬性查詢；精確最近、現況、全國統計、PMTiles 同版及研究地圖 ready/readback [ ] HOLD。Audit：778 層／219 datasets／212 查詢映射／566 待映射；臺灣 GIS 主 Layers 381 中已註冊 158、待接 223。未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

### 第五十四批：宗教五層去重核對

- 教會 2,116、宗祠 173、其他宗教場所 1,319、宗教基金會 165、宗教百景精選 100，五層均已於第十七批用 `religionPointsOwnerDatasets.ts` 接成 owner-only 查詢，有正常 MCP／Host guard 收據；無須重做 reader。既有基金會 reader 將 41 個原始無座標列保留 `geometry=null`，比直接沿用後補 Point 更忠於原始資料。
- 本批曾產四份新的安全分片候選；整合測試以 `DUPLICATE_DATASET_ID` 擋下後，已把候選檔、分片及接線精確撤回，既有 registry／宗教測試 12/12 通過，未提交重複 reader。宗教百景仍是 2021 年 100 處精選、非當前完整場所名冊；屬來源時間與涵蓋 HOLD，不是沒有 owner-only reader。Audit 計數不變：778 層／219 datasets／212 查詢映射／566 待映射。下一個新家族 `medLTC` 的衛福部 88270 快照與已有的福利長照機構層不是同一原表。

### 第五十五批：長照特約單位固定快照

- `medLTC` 使用衛福部 data.gov.tw:88270 raw `abc.csv` 24,409 列／SHA `137bae990ebd897a92777aa65b7730f713ee29813bfb95b011990eee0bc9680a`；2026-08-11 processed GeoJSON 23,894 Point／SHA `950efd652c8d504ff593e48fc5119835349150cca8d58a7546447e637acd37ac`。無座標 332、臺灣範圍外 183；raw A/B/C/空白為 824/23,024/560/1，processed 為 824/22,510/559/1。不能把減少解讀成服務關閉。263 個 SHA-bound gzip 分片，manifest SHA `93cbd6a1986e8cfa2711e1fce86a3950e06d57122520fc9c2e26db4431434c42`；只留類別、代碼、服務字串及來源日期，不供姓名、機構代碼、地址、電話、床位或住民數。
- 完整原表 oracle 和正常 Codex→MCP→Gateway→既有 3734 配對 browser：臺北 `[121.50,25.02,121.58,25.10]` A 類 51（全類 1,604），臺中 `[120.62,24.12,120.75,24.22]` C 類 1（全類 1,539）；分頁顯示 50 不影響完整匹配數。focused/registry Vitest 12/12、`npx tsc -b`、`npm run build`、localhost manifest 200／99,347 bytes、外來 Host 404 通過。全臺過量 bbox 拒絕。
- OGDL catalog 及本機 owner-only 固定版；`medLTC` 特約單位與既有 `welfareLtcInstitutions` 立案機構不同原表。Point 只供 bbox／屬性查詢，無當前契約、床位、可達性、最近距離、縣市比較或研究地圖同版 ready/readback 證據；這些 [ ] HOLD。Audit 778 層／220 datasets／213 查詢映射／565 待映射；臺灣 GIS 主 Layers 381 中已註冊 159、待接 222。未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

### 第五十六批：臺北樹穴完整 Polygon 有界查詢

- `treePitsTaipei` 原始 `tree_pit_taipei.json` 56,720 個 MultiPolygon，EPSG:3826，SHA `9ed8de03c1ba61720bc3bc27903128831023f7590a9c38961a8382c7c9d80f03`；2026-07-14 processed WGS84 GeoJSON 同數，SHA `72197a37c4446a456effa722eb1e6a96e4c200e1c71343322857f7455c13000e`。樹穴 50,904／花圃 5,816，面積總和 246,062.19 m²；零面積 1、空面積 0、負面積 0。Mini 既有展示 PMTiles SHA `a8dca8ef855072af4052d1ef0ffa4d538d70115657bed760bb5d5f1472584647`，僅證明本地資產存在。
- Gate G1 [x] 來源與授權已於 2026-09-26 補證：官方 [政府資料開放平臺資料集 134908](https://data.gov.tw/dataset/134908) 與 [臺北市資料大平臺](https://data.taipei/dataset/detail?id=693705fa-4604-4207-bd50-8a9ce9fcfbc6) 指向同一臺北市政府工務局公園路燈工程管理處樹穴 JSON，授權政府資料開放授權條款第 1 版。官方下載資源 `rid=3e2b359b-8dae-46e4-a747-5912d8743d0e` 唯讀取得 27,304,373 bytes，SHA `9ed8de03c1ba61720bc3bc27903128831023f7590a9c38961a8382c7c9d80f03`，與本地 raw byte-identical；不以官方詮釋資料更新日冒充每筆觀測日。
- Gate G3 [x] `build-tree-pits-taipei-owner-only.mjs` 以面與格的真實相交分入 112 個 gzip shards，manifest SHA `84abb47a9ee0a05b1a5d76aa6540e50044502e9ab8c2666d0545b1396fa6351c`；讀取時依來源序號跨片去重，完整 Polygon/MultiPolygon 與 bbox 相交，不轉中心 Point。臺北 `[121.500,25.029,121.510,25.039]` 原表 oracle／正常 MCP 皆 1,073；較小框 `[121.506,25.029,121.507,25.030]` 15；北投框 `[121.500,25.120,121.515,25.132]` 花圃 38。另一個廣域 bbox 超過掃描預算即 fail closed；焦點測試 4/4、`npx tsc -b`、`npm run build` 通過。正常 Codex→MCP→Gateway→配對 3734 browser 在 revision 7 `ready`，readback 15 features／1 source／1 layer，鏡頭移至臺北；微小樹穴面未能在截圖中逐一清楚辨識，地圖辨識度後續改善。此為固定版 localhost owner-only 查詢，不聲稱目前樹木數、樹冠、可達性或 production 同版。Audit 778 層／222 datasets／215 查詢映射／563 待映射；臺灣 GIS 主 Layers 381 中已註冊 161、待接 220。

### 第五十七批：台電電桿大來源盤點（待做）

- `powerPoles` analytics `_manifest.json` 宣稱 22 個縣市檔、2,959,326 Point、EPSG:3826→4326、2026-06-15 年度快照，來源台電 d077010；catalog 記 OGDL-Taiwan-1.0，也明列金門／連江／澎湖端點需由 `island_power_grid` 補。已找到本地 22 個 raw CSV；僅抽查新竹市處理檔 20,596 feature，其中桿號空 5,932，不能外推全國缺值率。Mini 展示 PMTiles SHA `7e74c1a757357e7cee0a4f65e97fa170d15c8966d00c369b6ef79bc499ed282e`，僅有 heatmap/circle 展示，tippecanoe 有 cluster/drop；不是原表計數或查詢證據。
- Gate G1/G2 [x] 本機逐檔對帳收據見 [22 檔完整稽核](./power-poles-source-audit-20260926.json)：raw 315,389,236 bytes、processed 1,069,885,871 bytes，22 組各自 SHA／bytes／筆數均固定，raw／processed／manifest 合計 2,959,326。同 pipeline 的 pandas 讀法重算 raw 與 processed 空桿號皆 616,007；原稽核少算的 36 全在彰化，屬 CSV parser 定義差異，已修正收據。所有 processed 均為語法有效 WGS84 Point，但屏東最大經度 139.99、臺東最小緯度 14.35、桃園最大經度 140.36，地理正確性未過。澎湖 9,840、金門 17,482、連江 1,093 本地檔實存，與 catalog「離島端點缺口」衝突，不能擅稱官方涵蓋完整。Gate G3 [ ] 待做：PMTiles SHA 已固定但沒有綁定這 22 檔的建置收據；先查 3 筆地理離群的 raw 座標來源、核 raw 端點，再以縣市／空間分片設有界 reader，兩個新地點＋變體對原表 oracle 和正常 MCP 驗收。現有共用上限 1,024 shards／1 GiB 不可直接假設可裝下此母表；不把 cluster/drop 顯示計數當查詢。部署 404 歷史問題未驗。本批映射數不變。

### 第五十八批：活動斷層地質敏感區原面查詢

- `activeFaults` 現有 `public/geo/active_faults.geojson` 與 analytics raw `data/raw/environment/earthquake/active_faults_sensitive_zones.geojson` byte-identical，2,632,866 bytes／SHA `a05a2afaf1f17b6be9e3cb7ed605fbbe35e3ea72ee0d654bf1fea97b89543b1e`，22 個 Polygon／MultiPolygon。可追溯 GSMMA／data.gov.tw:27744；官方目錄 23 項含已變更 F0011，本固定檔為 22 項。來源觀測日未證，2026-03-06 僅本地匯入日期。OGDL-Taiwan-1.0；來源註記敏感區只作土地位置參考，公告與正式圖資為準。
- Reader 對 2.5 MiB 本地資產做 SHA、長度、22 代碼與 geometry 驗證，15 秒 timeout、3 MiB 上限；僅輸出 `fault_code` 與完整水平 MultiPolygon。原 Polygon 包成單部分 MultiPolygon、`[lng,lat,0]` 去除零第三座標；保留水平頂點、孔洞與多部分。非零第三座標、錯版、重複代碼及非法幾何 fail closed。bbox 使用實際面相交；不提供風險分級、地籍判定或現況保證。
- 獨立原面 oracle 與正常 Codex→MCP→Gateway→配對 3734 browser：大甲框 `[120.60,24.28,120.64,24.34]` 得 `F0012` 1，米崙框 `[121.61,23.99,121.63,24.03]` 得 `F1011` 1；空框 0 僅表示此固定檔未相交。大甲結果含 geometry 後 `pulse_present_result` → `pulse_wait_scene_ready` revision 3 ready；`pulse_get_map_context` 1 feature／1 source／1 layer、ready，fit bounds revision 4 ready，地圖目視有高亮。focused/registry Vitest 12/12、`npx tsc -b`、`npm run build` 通過。Audit 778 層／221 datasets／214 查詢映射／564 待映射；臺灣 GIS 主 Layers 381 中已註冊 160、待接 221。無 Supabase/S3 寫入，未 push、PR、merge、部署或重啟排程。

### 第五十九批：公司產業與設立年齡共用格網查詢

- `companyAgeStructure` 與 `companyIndustryDistribution` 共用 GCIS 202608 公司點 654,165 的固定來源 SHA `d099446600d98c26330b9193102d00fead822eb9ae6e3be1cf3eae24c605272b`。450m occupied-only 26,834 個 Polygon，原表 SHA `9f97d9d0e6747af17493109a43c1c42a64bae55c47b90e519ad8045c0c2918cd`；1500m 5,745 個 Polygon，原表 SHA `cc71991553954c95085476508c3ec64c989f47d195b2bccc25ed084bdd33b429`。兩尺度各加總 654,165；89 個兩碼行業、未知行業、設立年已知 654,149／缺 16／無效 0 分開保留。格網是地址定位點聚合、只列非空格，不是實際營業地或行政區，缺格不能補零。
- 有界 builder 保留完整 Polygon，以面與分片格真相交收錄，450m 304 個 gzip shards／manifest SHA `7fe4ed971dd4a7bcc34ce6954567a260459e5f74b5fe366fc6d2370f5276b071`，1500m 315 個 shards／manifest SHA `b67714c49531774daad010a490fc05e6368cf4ea3af5c5c8e70db06f69d8d4b6`。僅 localhost owner-only，bbox 必填、20,000 掃描列與 8 MiB 解壓預算，分片重複來源序號去重；過寬台灣框 fail closed。`age_median=null` 表示該格無有效設立年，不是零；`age_recent` 是來源對 2022–2026 近五年設立年統計，不聲稱目前還在營業。來源矩陣 118 份原始授權收據未全數複核，公開重分發 `RIGHTS_HOLD`。
- 完整原表獨立 Polygon oracle：臺北 450m 框 `[121.50,25.03,121.52,25.05]` 年齡資料 28 格；臺中 1500m 框 `[120.63,24.13,120.67,24.17]` 產業資料 16 格，MCP 同數。另以臺北小框 `[121.50,25.03,121.505,25.035]` 命中 4 年齡格、含 geometry；配對地圖 revision 10 `ready`、4 features／1 source／1 layer，截圖可見藍色格網。臺中 16 產業格 revision 9 `ready`、截圖可見藍色格網。focused/registry Vitest 13/13、`npx tsc -b`、`npm run build`、localhost manifest 200／142,012 bytes、外來 Host 404 通過。Audit 778 層／226 datasets／217 查詢映射／561 待映射；臺灣 GIS 主 Layers 381 已註冊 163、待接 218。未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

### 第六十批：TDX 自行車道路線完整線查詢

- `cyclingRoutes` 採 TDX Cycling Shape 2026-03-01 本地 raw 1,749 筆，SHA `d190b049ef2c9f46134c230d043b090edb84e64bf56cc393d2fa282edf896d19`；analytics processed 與 Mini 靜態展示 GeoJSON byte-identical，4,384,551 bytes／SHA `690190820456105ac3aa92133c4fc7e222703e365a36c726fec20c5b2060bcba`，20 市、1,749 MultiLineString。`town` 空 536／字面 NULL 1、`CyclingType` 全部字面 NULL、`AuthorityName` 1,748 字面 NULL。`FinishedTime` 約 24.4% 受民國轉換錯誤影響，整欄暫不輸出。TDX catalog 記 OGDL；raw 檔名日期不代表逐條路線完工日。
- 共用 `QueryExecutor` 新增線段對 bbox 真相交，包含跨框與邊界反例；臺北 `[121.5,25.03,121.505,25.035]` 與完整來源 oracle／正常 MCP 均 4 條。focused 4/4、`npx tsc -b`、`npm run build` 通過；配對 browser revision 11 ready/readback 4 features／1 source／1 layer，目視有藍色路線。不得從路線幾何推論今日安全、可騎乘、連通或導航距離。程式碼 commit `dbd27d01`。

### 第六十一批：國家森林遊樂區公告範圍

- `forestRecreation` 官方 data.gov.tw:9931、1151 版來源 KML／ZIP／SHP／DBF 的 SHA 見 `../runtime/owner-only/forest-recreation/manifest-receipt.json`；2026-05-19 processed 23 面 SHA `bb7e1604918d3329e554c44788f9c376985f4c4707ae37d19cb0aedb0dd49c05`。19 Polygon／4 MultiPolygon 統一回傳完整 MultiPolygon；`park=null` 21、`district_code=null` 1。安全欄位 sidecar 1,997,643 bytes／SHA `815448720c3c12d2ae41898a445f6f4c42fb86e9f1f4a9c9cc0dea8d9580cacc`，僅 localhost owner-only，OGDL catalog 不等於已公開發布。
- 惠蓀／阿里山兩地與棲蘭子園區篩選對原表，focused 2/2、tsc/build 通過；合歡山完整面正常 MCP 1 筆、revision 13 ready/readback 1、目視藍色面。較大遊樂區面在回應傳輸上可能被 `coordinatesOmitted`，那次結果不可當地圖驗收；選完整可傳的合歡山面驗證。既有圖層 display 同版與今日開放、入口、步道仍 HOLD。程式碼 commit `d6985af0`。

### 第六十二批：養殖漁業生產區公告範圍

- `aquacultureZone` 使用 2026-05-19 processed WGS84 62 面／11 縣市，來源 SHA `3096bf94ac94a98b642bd011e846ab7b886807b0bfe8c01fd8cb4aae05fcdb8e`；安全欄位 sidecar 522,406 bytes／SHA `6290797c86b1403334e6a3bcc8ae01dce7337e5706135178636cbd01eae9a42a`。Polygon/MultiPolygon 統一查完整 MultiPolygon，面與 bbox 真相交；空框不補零，處理日期不冒充法律生效或現在營運時間。官方授權目錄為 OGDL，本地 owner-only。
- 臺南與宜蘭來源點框／名稱變體、空框、錯 SHA 拒絕 focused 3/3，tsc/build 通過；雲林麥寮小框正常 MCP 1 面、revision 14 ready/readback 1 且目視高亮。來源面積合計 18,676.7 ha 不能作本次 bbox 內面積，也不是養殖產量。舊圖層 display 同版仍 HOLD。程式碼 commit `92eeae7c`。本批後 Audit 778 層／229 datasets／220 查詢映射／558 待映射；臺灣主 Layers 381 已註冊 166、待 215。三片都未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

### 第六十三批：國道服務區 OSM 原面

- `serviceAreaPolygon` 對照 analytics OSM Overpass raw SHA `9047b532d2ac1425735d278a7ed91dff573264a488be8c0f8c869882f29df863`、2026-05-24 processed GeoJSON 與 Mini display byte-identical 24,463 bytes／SHA `c9f2a462c30ecbfd99fec7f15cd55371112add6ece074a76a881db4186fd84a8`。19 個 OSM highway=services 面（18 Polygon、1 MultiPolygon）與官方 22 個 Point 不等母體，沒有面不等於沒有服務區。幾何 © OpenStreetMap contributors／ODbL 1.0；從高速公路局 data.gov.tw:8161 連結的屬性為 OGDL-Taiwan-1.0，應分別署名。固定處理日不是逐筆 OSM 編修時間或營運現況。
- Reader 只給名稱、國道、方向、來源面積、OSM ID/type 及完整 MultiPolygon；bbox 為真面相交。東山與泰安北上原表兩地／方向變體、空框、改版拒絕 focused 3/3，tsc/build 通過。東山正常 MCP 小框 1 面、revision 15 ready/readback 1、截圖可見藍色面；不能以此推入口、可達性或目前設施。程式碼 commit `a50241f5`。Audit：778 層／230 datasets／221 查詢映射／557 待映射；臺灣主 Layers 381 已註冊 167、待 214。未寫 Supabase/S3，未 push、PR、merge、部署或重啟排程。

### 第六十四批：兩個校園面圖層共用 TGOS 原面

- `eduCampusPolygon`／`eduCampusArea` 同一份 TGOS `campus_121.zip` 原始檔 2,010,108 bytes／SHA `14fdbec063543c260059f662c380be80ae6f1285c6967e5d35896b11c514eb48`；2026-08-07 processed GeoJSON 4,336 Polygon／9,847,540 bytes／SHA `950c1913b47a7da36838fc2d8c743ce766207ca312fe624f71bf55fde00305ff`。Mini PMTiles SHA `3735e97933bef4f93d163a607d902607c1c008f1481ad3f674ca4120d74e3f15` 與 analytics tile byte-identical，但只能當 display 證據。來源 catalog 記 OGDL，本片側錄限 localhost owner-only。289 個 gzip 分片 manifest SHA `3e7158e6013dd72e33a3dd6f0b51d5f0078054c46b604c4c12b8f5ed07af4232`，bbox 選片後仍用完整 Polygon 真相交；過寬超過 3,000 掃描列或 8 MiB 解壓預算拒絕。
- 12 筆 `non_school` 保留原始查詢列但舊顯示濾除，另 12 筆 `experimental` 的 `school_level_zh=null` 不補值。`source_yyyymm` 是來源月份，與 pipeline 日期分開且不啟用時間篩選；20 縣市以外未涵蓋不等於沒有學校。臺北與花蓮兩地、學制變體、non_school 及 SHA 錯版 focused/registry 13/13、tsc/build 通過；臺北大同大學正常 MCP 小框 1 面，revision 16 ready/readback 1、截圖可見藍色面。校地不代表出入口、就學區、容量或步行可達性。程式碼 commit `32d37f73`。Audit 778 層／231 datasets／223 查詢映射／555 待映射；臺灣主 Layers 381 已註冊 169、待 212。無 Supabase/S3 寫入，未 push、PR、merge、部署或重啟排程。

### 第六十五批：航空噪音法定里別代理面

- `aviationNoiseZones` 的桃園 26115 CP950 CSV SHA `28dbe5367c5fc456aa03bc033ad4fc8c83e0defdbee6ce47b597b623711d17fe`、高雄 107165 JSON SHA `fcadf3fbadcfac912ba96223a4140c085e134fd38fd66bd4bd6e3b3c7affb1ee`，與 NLSC 2026-06-26 村里界 SHA `4b5832c1fdf066945fa121c9a31c20e858d8deb4198dae2afab4db9889231d99` 明示 join。2026-08-27 processed 與 Mini display byte-identical 1,072,567 bytes／SHA `d17515936bc357ce3602473c2768ebd2e1647d39f8660c8e32133dbbb661bb51`；103 個來源級別 membership 合成 76 個村里面，桃園 31（58 membership）、高雄 45（45 membership），4 個明示別名，未匹配 0。授權 OGDL-Taiwan-1.0；桃園來源 metadata 2026-05-07、高雄 2025-09-24，不是法律生效日，76 筆 `effective_date=null` 原樣保留。
- 固定 SHA、bytes、筆數及欄位 reader 供 bbox／屬性查詢；`zone_levels` 保留完整清單，`display_zone_level` 只供畫面排序。NLSC Polygon 是 `admin_join` 行政里代理幾何，不是實測 DNL 等音線，`spatialAnalysisEligible=false`；僅允許結果面在地圖高亮，不允許拿來判定點曝露或精確距離。獨立原面 oracle：桃園山東里小框得 1，分級 `1,2`；高雄仁愛里小框得 1，分級 `2`，MCP 兩問同數。首輪高亮因代理面展示規則遭拒，修正後高雄正常 Codex→MCP→Gateway→既有配對 browser revision 18 `ready`，readback 1 feature／1 source／1 layer，截圖可見藍色里界。focused/registry 及 tsc/build 通過，未寫 Supabase/S3、未 push／PR／merge／部署／重啟排程。
- 本地稽核另發現 `waterBasins` catalog 宣稱 143 個 WRA 流域面，但 analytics 記錄的 processed `river_basins_wra.geojson` 與 raw `basin.shp/.dbf` 目前找不到；Mini 只有展示 GeoJSON，且 catalog 記 `basin_no` 非唯一、舊 Supabase 面積單位仍錯。此家族 G1/G2 `VERSION_MISMATCH`／`SOURCE_MISSING` HOLD，須找回原 SHP 與同版處理檔、核 143/116 差異及面積 km² 後才能接入，不用展示副本冒充完整原表。

### 第六十六批：國家風景區來源 34 面中的 12 面

- `tourScenicAreas` 的 analytics raw 有 12 個 `nsa_gist_*.zip` 備援 SHP；2026-05-24 processed `scenic_area_20260524.geojson` 34 面／SHA `d1fbd0b12f7e5cbea4f5c3e059f8c0638c9d1a936bb6036d89896c6fe54cc544`，其中國家風景區 12、森林遊樂區 22。Mini `national_scenic_areas_national.geojson` 200,445 bytes／SHA `9910b7329a361247989b91f50ebda63762e557411eae13dda6f1ead997384e38` 僅含該 12 筆；逐名對照處理表的 category、manager、area_km2 與完整面幾何一致。來源 OGDL-Taiwan-1.0；官方 motc ZIP 當年不可用，備援缺雲嘉南濱海國家風景區，因此 12 筆不是全臺完整母體。Mini 額外的 2024 訪客數／年增率無上游收據，本 reader 不輸出。
- 固定 SHA/count/bytes reader 把 4 Polygon 與 8 MultiPolygon 統一成 2D MultiPolygon；721 個第三座標全為零，只移除此無高程語意零值，不改水平形狀。bbox 與真面相交。獨立原面 oracle 大鵬灣／馬祖兩地各 1，名稱變體與 MCP 同數；大鵬灣查詢回傳面積 28.494 km²、manager=null。正常 Codex→MCP→Gateway→配對 browser revision 19 ready/readback 1 feature／1 source／1 layer，截圖可見藍色兩部分面。focused/registry 13/13、tsc/build 通過；面界不代表入口、開放、步行可及性或今日法律界線。Audit 778 層／233 datasets／225 查詢映射／553 待映射；臺灣主 Layers 381 已註冊 171、待 210。無 Supabase/S3 寫入、push、PR、merge、部署或排程重啟。
- `aquacultureCageNet` 第一輪審查標 G1 `VERSION_MISMATCH` HOLD：analytics raw ZIP 與 42 Polygon processed/Mini byte-identical 展示存在、catalog 記 OGDL，但 manifest 未存 raw SHA，catalog 2026-06-07 與 manifest 2026-05-19 日期衝突。先核 raw SHP/DBF 與 pipeline 的實際處理日，補固定來源版本與缺值收據，再決定 reader；不把 42 個展示面直接標可查。

### 第六十七批：臺北溫泉露頭區公告面

- `tourHotSpringZones` 的臺北市政府產業發展局 FY114／data.gov.tw:121214 ZIP SHA `420fd654b373995e309404a9719c1ba414876c8bf93a62862956e8a8ece97c74`；來源 16 條閉合 LineString 無 PRJ，pipeline 依 DBF 面積交叉核定 EPSG:3826（最大差 5.8 m²）後轉 Polygon、WGS84。2026-07-22 processed 16 面／9,427 bytes／SHA `c05b9e9115188f5e5605736606efad99d6c9cf4cb3f70a8fcdc1fd9b404076f7`；Mini 16 面／8,109 bytes／SHA `1a5208c2f2f43e0659103a492a6eff812c9a9ced3e4845583a685ad0aee3305d`，16 個編號、欄位和完整面幾何均逐一對齊。面積合計 121,678 m²，`remark=null` 13；OGDL-Taiwan-1.0。資產名含 `national` 但來源僅臺北，不能稱全臺溫泉範圍。
- Reader 僅給編號、名稱、公告面積、來源備註及完整面；bbox 真面相交，處理日不冒充公告生效日。硫磺谷、地熱谷兩個獨立內部點及馬槽同名 5 面變體、改版拒絕 focused/registry 12/12、tsc/build 通過；正常 Codex→MCP→Gateway→配對 browser 硫磺谷 1 面、23,021 m²、`remark=null`，revision 20 ready/readback 1 feature／1 source／1 layer，截圖可見藍色面。面界不代表露頭實際出水點、入口、今日開放、水質或步行可達性。Audit 778 層／234 datasets／226 查詢映射／552 待映射；臺灣主 Layers 381 已註冊 172、待 209。無 Supabase/S3 寫入、push、PR、merge、部署或排程重啟。

### 第六十八批：海上箱網固定公告面

- `aquacultureCageNet` 原始 ZIP SHA `6363a8a585bc7ed12a344b687e6918c8b354d963ba932b87b808d84163f1838b`，內含 SHP／DBF／SHX／PRJ／XML，EPSG:4326；原始 metadata 為 2020-06，來源漁業署 data.gov.tw:127504、OGDL。analytics processed 與 Mini `public/fishery/aquaculture_cage_net.geojson` byte-identical，20,001 bytes／SHA `56966411c994bf60de060e4d828d5e21226f4080d72047a939703320f21e108e`，42 Polygon；`public_no` 42 筆唯一，`township`／`location` 皆非 null。本地處理檔時間為 2026-06-07，但 `_manifest.json` 記 2026-05-19；兩者都不是來源觀測日，reader 固定 SHA 快照並標 `stale`，不宣稱目前營運或覆蓋完整。
- Reader 只回公開字號、鄉鎮、位置描述與完整原面；bbox 依真面相交。獨立原面 oracle 馬公五德 `[119.57818,23.52825,119.57821,23.52829]` 得 `澎漁權字第0087號` 1 面，西嶼二崁 `[119.52712,23.61479,119.52715,23.61483]` 得 `澎漁權字第0119號` 1 面，正常配對 MCP 兩問同數。馬公查詢含 geometry，revision 21 ready/readback 1 feature／1 source／1 layer，截圖可見海面藍色箱網面。focused/registry Vitest 11/11、tsc/build 通過。Audit 778 層／235 datasets／227 查詢映射／551 待映射；臺灣主 Layers 381 已註冊 173、待 208。僅本地 20 KB 靜態讀取，無 Supabase/S3 寫入、push、PR、merge、部署或排程重啟。
- `waterProtectionZones` HOLD：Mini 展示檔 SHA `ee083140d0f0f7f25916d077a5a9e2c484da62542489d8a6c3430f29a68855ce` 有 128 面，analytics WRA processed SHA `b02c633e7fa5ad6f58e4c0de96322f446a42fd6dc76c67715767afd8a458877a` 有 107 面，無可驗的同源版本對應，不接展示面。`cemeteryZoning` HOLD：Mini 展示 114 面已降至 6 位小數，analytics processed 114 面不同幾何；上游臺北／新北都市計畫來源可追但尚缺 raw→processed SHA 綁定收據及未降精度 owner-only 固定資產。兩者先補來源／轉換清單，重查 G1/G2，再接 reader。

### 第六十九批：新北區間測速起訖點參考線

- `speedZoneSegment` 來源新北市政府警察局 data.gov.tw:126156，raw CSV SHA `4e3741f27b79982e775c95dbbd1eaff59040ec48bc6db6b53a7882d28602c511`；processed 與本次補入的 Mini 靜態 GeoJSON byte-identical，25 LineString／10,957 bytes／SHA `287b76c66affa9857721dfdff6d89f34f540a0955ea773c232c0497d9cd27af4`。保留欄位無 null，來源 OGDL-Taiwan-1.0。高雄另外四個設備 Point 是另一母體，未混入。`fetched_at=2026-06-26` 是本機抓取日，非啟用或限速生效日。
- 每筆幾何只是來源起訖點的兩點直線，不是道路實際走線。故標 `role=proxy`、`spatialAnalysisEligible=false`：可用 bbox 找固定快照中的參考線及查來源屬性、在地圖顯示，但不可做精確線與範圍相交、沿路距離或現在執法判定。SHA/bytes/25 列/欄位/兩點 WGS84 驗證錯版即拒絕，經 loading registry 載入。獨立原表端點 oracle 臺 9 線 `pj_zone_nt_1_d0` 和三峽台 7 乙線 `pj_zone_nt_14_d0`；正常 MCP 兩個新 bbox 加 ID 變體各回 1。臺 9 線含 geometry 結果 revision 22 ready/readback 1 feature／1 source／1 layer，截圖可見藍色直線。focused/registry Vitest 12/12，tsc/build 通過。Audit 778 層／236 datasets／228 可查映射／550 待處理；臺灣 GIS 381 層已登記 174、待 207。僅讀 11 KB 本機資產，未寫 Supabase/S3、push、PR、merge、部署或重啟排程。

### 第七十批：115 學年度高中就學區縣市代理面

- `eduDistrictSenior` 原始教育部國教署 115 學年度 CSV 34 列／SHA `c8d541dc97d294717ae4d82dd29f5329e5e47fc975908f443499d6b5fdf84449`，授權 OGDL-Taiwan-1.0；analytics 2026-08-07 processed 15 面／12,238,327 bytes／SHA `c3b4df7dee7639dfe18e89134e2dd418b1a552639e0cad51b2579071c996e339`，完整 Mini reader asset 與之 byte-identical。既有網頁顯示為另份降精度檔 SHA `8df98c6b47f9cc93c677e63d05e87edc506305bc5ac77d18e3eef9a83b61d287`；不能冒稱同幾何版。15 區覆蓋 22 縣市，保留來源的跨區規則文字、學年度與面積；processed 無空欄。manifest 宣告 Polygon，但來源實際混合 Polygon/MultiPolygon，reader 統一為完整 MultiPolygon。
- 面是縣市邊界 dissolve 的**就學區代理範圍**，不是招生資格、跨區條款或個別學校學區界；`role=proxy`、`spatialAnalysisEligible=false`。bbox 只篩固定代理面，不能據此自動判斷某學生可就讀哪所學校。獨立原面內點 oracle 臺北基北區與臺中中投區，正常 MCP 兩地各回 1；基北區來源文字保留，新資料點 variant 篩選中投區回 1。單筆完整 geometry 在工具回答中因大小以 `coordinatesOmitted` 摘要，但 session 內保留完整面；revision 23 ready/readback 1 feature／1 source／1 layer，截圖可見基北區藍色代理面。focused/registry 12/12、tsc/build 通過；錯 SHA、欄位與筆數拒絕。首次本地下載 12.2 MB，後續同 session 使用已驗證快取；不增加 Supabase/S3 讀寫。Audit 778 層／237 datasets／229 可查映射／549 待處理；臺灣 GIS 381 層已登記 175、待 206。未 push、PR、merge、部署或重啟排程。

### 第七十一批：未接 GeoJSON 候選的來源門檻

- 當前逐層 ledger 尚有 12 個 metadata GeoJSON 候選，metadata 只證明圖層宣告，不能當作查詢 reader。`ripeAtlasProbes` 的 Mini 展示約 3,000 Point（SHA `651e6298…d4230f`）與 analytics manifest 13,534 processed rows 尚無原始 raw SHA／同版截取收據；RIPE Atlas 條款為 research use，座標刻意偏移約 80–400m。G1/G2 `SOURCE_VERSION_AND_RIGHTS_HOLD`，不能作實址、精確附近或完整母體。`internetExchangePoints` 同樣只有 catalog／processed manifest 與展示，沒有可核 raw bytes／rows／SHA；PCH CC BY-NC-SA 3.0 限制需另核公開與再散布。兩者維持待查，不增加查詢映射；下一步尋回 raw 取得檔與版本、建立逐層來源與權利收據，再決定 owner-only 或公開 reader。

### 第七十二批：全臺六來源登山步道完整線

- `hikingTrails` 原 manifest 把來源誤指向 `mountain_trail_signs`（步道路標點，供另一份 `trail_profiles` 使用），已更正為 analytics `hiking_trails`。六來源 2026-06-08 固定合併檔與 Mini 現有 GeoJSON byte-identical，7,339 條／20,659,963 bytes／SHA `0c0263b33f7561bc0b06432f6fdd1b5494c2b2978169a16f53616e68305aea9c`；林業署 345、OSM 6,563、雪霸 93、金門 20、臺北大縱走 11、新北觀光 307。各列保留 source 與 license：官方 OGDL，OSM ODbL 須標 © OpenStreetMap contributors。`name=null` 1,107、`region=null` 6,563、`main_sys=null` 6,562、`overlap_ratio_A=null` 345、`in_national_park=null` 6,218，均不補值。來源抓取時間不一，合併日非今日開放或安全狀態。
- 7,324 LineString 包成單段 MultiLineString、15 個原 MultiLineString 保持多段，水平頂點不簡化；另存 `source_geometry_type`。本機 owner-only 265 個 gzip 分片 manifest SHA `e1506ec71627c3eff5c5ad7a2d4c8e92af0a5d617b83e4cad97043bba0badbb4`，bbox 必填且只讀命中分片，8 MiB 解壓／20,000 列預算，過寬拒絕。builder 先完整建 temporary 再替換 runtime；不新增公開檔或 Supabase/S3 負擔。獨立原面 oracle 南澳古道 `A_forest/002` 與象山永春崗步道 `B_osm/way/25214129`，正常 MCP 兩個新 bbox 各回 1；前者較長的線在工具輸出 geometry 摘要省略，後者完整多段座標回傳。象山結果 revision 24 ready/readback 1 feature／1 source／1 layer，截圖可見藍色步道線。focused/registry 11/11、tsc/build 通過。現有 PMTiles 是否同版生成仍 HOLD，不以此承諾登山導航、入口、步行距離或現場可走。Audit 778 層／238 datasets／230 可查映射／548 待處理；臺灣 GIS 381 層已登記 176、待 205。未 push、PR、merge、部署或排程重啟。

### 第七十三批：國有林林班面來源品質 HOLD

- `forestCompartments` 林業署 MOA E30／1141 版原 SHP/DBF/SHX/PRJ 在 analytics 本機可見；processed 為 3,700 面，Parquet 75,814,373 bytes／SHA `f4417a4bb475a1428b2064aa70b7a09136e369c1f6d0d511491bb77e79d0fcf0`，GeoJSON 229,521,975 bytes／SHA `588fdd071bae965e24748b962b3aa7829eb1e945c65bcd3eb372478e7186ee3b`。Mini PMTiles 展示 SHA `9afea554664adcc208238308c939609a92a5f6dc7d7605a95fa95a605165dd3c`，僅是渲染資產，尚無同版建置收據。處理表 3,700 列無 geometry null/empty、屬性無 null，但 67 面無效；不把 3,700 全數標可做精確空間相交。G1 尚缺原 SHP 取得日／官方下載 receipt，G2/G4 需逐筆記錄 67 面修復、保留或屬性限定的策略及獨立原面比對。暫列 HOLD，先不建立全量 Polygon reader；有界本機 Parquet/FGB 可行性不等於驗收完成。未增加查詢映射。

### 第七十四批：臺灣多層共源候選復核

- 當前臺灣 GIS 主組 381 層中 205 待處理；逐層佇列的 shared source 只是導航線索。對這 205 層復核後，尚無「兩層以上、真共用同版 raw 且授權／幾何可接」的下一個 GO 家族。`manufacturingCompanyPoints` 與 `countyBoundary` 各有已核 raw 家族但各自是 singleton，現有展示／查詢版不一致，維持 `VERSION_MISMATCH`，不能因相近母表或名稱直接映射。
- 高覆蓋宣告簇的具體解鎖：`celestrak_satellites` 16 層缺可讀 raw/RPC 版本與欄位收據；`osm_power` 6 層缺原表版本、license 與各類別實際筆數；`real_estate` 6 層只有 PMTiles/BIN 展示，缺完整原表與同版、缺值、geometry 收據；`ncdr_alerts` 5 層缺原表/RPC；`network_structures` 4 層與 `power_plants` 4 層尚未證明展示檔等於完整原表。下一步逐簇找回本機／上游原始檔或有界 RPC、記 SHA/版次／授權／時間／排除，再按真來源家族接 reader。這是 P0 已查缺口，不能替代後續施工；本批映射數不變。
