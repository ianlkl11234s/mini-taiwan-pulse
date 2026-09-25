# 519 個尚無可用查詢映射的圖層：逐層處置（2026-09-26）

由 runtime manifest、research registry 與已檢查的來源收據產生。JSON 保留全部 manifest layer 的完整欄位；`.unknown.csv` 只列本次 594 個 unknown/unavailable，一層一列。狀態是目前證據下的處置，不是線上來源健康或發布驗收。

全部 778 層中，530 層維持候選處置、248 層為已註冊 queryable、1 層有 descriptor 但 query disabled。每層的 local asset、remote version、query、displayed 證據分列；其中 QUERYABLE_REGISTERED 不等於 SPATIAL_READY。

778 個 manifest layer 中，248 個有查詢映射、11 個是待讀回的 GeoJSON metadata candidates、519 個尚無可用映射；三者合計 778。

## 主要狀態

| 狀態 | 層數 |
|---|---:|
| READER_PENDING | 307 |
| SOURCE_MISSING | 188 |
| RIGHTS_HOLD | 24 |

## 具體阻擋

| 阻擋 | 層數 |
|---|---:|
| DERIVED_RELEASE_SOURCE_AUDIT_AND_READER_PENDING | 188 |
| NO_DECLARED_RAW_ARTIFACT_OR_RPC_RECEIPT | 185 |
| DECLARED_DISPLAY_ASSET_NOT_VERIFIED_AS_COMPLETE_RAW_SOURCE | 114 |
| SOURCE_LICENSE_OR_USE_CLEARANCE_HOLD | 13 |
| RIGHTS_OR_USE_CLEARANCE_UNVERIFIED | 11 |
| DERIVED_ROAD_DISTANCE_RELEASE_UNVERIFIED | 4 |
| WASTE_FACILITIES_COMPLETE_RELEASE_AND_COORDINATE_RIGHTS_MISSING | 3 |
| QUERY_ACCESS_DISABLED | 1 |

`comparisonStatisticsRecipes.json` 明列 188 個比較統計圖層、indicator 與 releaseId；共同的是派生 runtime 契約，並非一份原始資料。逐 release 的分子／分母來源尚未全量稽核，也未註冊有界 research reader，逐層維持 `READER_PENDING`。同一 `upstream.datasetId` 的圖層另列 declared contract family；這只證明 manifest 宣告相同，不證明同一 raw SHA、RPC schema 或 release。

188 個 SOURCE_MISSING 中，105 個可找到 analytics processed manifest 與 catalog、56 個只有 catalog、2 個有上游 ID 卻未找到同名本機證據、25 個連上游 ID 也未宣告。這些是**導航線索**，沒有一項自動證明 raw input、授權或 release 同版。

## 宣告的共用契約（前 25 個）

| 契約 | 層數 | 證據等級 |
|---|---:|---|
| derived:comparison_statistics | 188 | manifest/recipe only |
| declared-upstream:celestrak_satellites | 16 | manifest/recipe only |
| declared-upstream:land_use_township_statistics | 14 | manifest/recipe only |
| declared-upstream:education_county_statistics | 12 | manifest/recipe only |
| declared-upstream:jp_medical_reports | 6 | manifest/recipe only |
| declared-upstream:jp_water_ksj | 6 | manifest/recipe only |
| declared-upstream:real_estate | 6 | manifest/recipe only |
| declared-upstream:jp_medical_navii | 5 | manifest/recipe only |
| declared-upstream:ncdr_alerts | 5 | manifest/recipe only |
| declared-upstream:segis_taipei_bicycle_usage_township_110 | 5 | manifest/recipe only |
| declared-upstream:crop_township_statistics | 4 | manifest/recipe only |
| declared-upstream:network_performance_grid | 4 | manifest/recipe only |
| declared-upstream:network_structures | 4 | manifest/recipe only |
| declared-upstream:osm_power | 4 | manifest/recipe only |
| declared-upstream:power_plants | 4 | manifest/recipe only |
| declared-upstream:taoyuan_airport_passengers_county_32997 | 4 | manifest/recipe only |
| declared-upstream:waste_positions_realtime | 4 | manifest/recipe only |
| declared-upstream:air_quality | 3 | manifest/recipe only |
| declared-upstream:caa_airport_activity_county_33238 | 3 | manifest/recipe only |
| declared-upstream:fishery_stats | 3 | manifest/recipe only |
| declared-upstream:gas_stations | 3 | manifest/recipe only |
| declared-upstream:jp_medical_areas | 3 | manifest/recipe only |
| declared-upstream:npa_a1_accident_county_177136 | 3 | manifest/recipe only |
| declared-upstream:waste_facilities | 3 | manifest/recipe only |
| declared-upstream:bus_realtime | 2 | manifest/recipe only |

真正已核對的 raw family 另見 JSON `verifiedRawFamilies`，且仍需逐層檢查 display 同版、權限、時間、缺值與 geometry。不得把宣告 family 或 PMTiles 視為完整可分析原表。

本機資產欄位只查工作樹與原 checkout 的檔案存在及大小；缺少本機檔不等於遠端缺檔，存在亦不證明 raw→display 同版或查詢可用。
