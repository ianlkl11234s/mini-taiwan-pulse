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
