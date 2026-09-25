# 來源家族優先施工：先保證可查，再擴大分析

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
