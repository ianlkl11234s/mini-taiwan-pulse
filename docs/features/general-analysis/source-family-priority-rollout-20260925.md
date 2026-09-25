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
