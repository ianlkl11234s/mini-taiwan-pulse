# V02 資料資格首片（2026-09-24）

依 assessment 要求，以下只列已有 descriptor/reader 的候選；`ready` 指程式契約與測試，不等於今日 live/browser 通過。

|候選|source／時間／license／geometry|reader／運算|狀態、HOLD 與最小下一步|
|---|---|---|---|
|學校 Point|`/education/schools.geojson`；時間 unknown；license unknown；來源 geocoded Point|generic Point，bbox/query/nearest/aggregate；有分片|可用 bounded。完整度、freshness 待 receipt；補 live source SHA/count/readback。|
|醫院 Point|`/geo/medical_hospitals.geojson`；時間 unknown；license unknown；source Point|generic Point，query/nearest/aggregate|可用 bounded。設施數不等於量能；補來源日期/完整度。|
|護理機構 Point|`/welfare/nursing_homes_national.geojson`；觀測 unknown；OGDL＋provenance；upstream_wgs84/upstream，1499/1611|verified Point，query/nearest/aggregate|有限可用；不是唯一機構數且精度未獨立驗證。補逐筆精度/來源 receipt。|
|公共圖書館 Point|`/culture/public_libraries_national.geojson`；時間 unknown；license unknown；source Point|generic Point，query/nearest/aggregate|有限可用；快照完整度 unknown。補來源版本與日期。|
|便利商店 Point|`/geo/convenience_stores.geojson`；取得/閉店未知；license unknown；source Point|generic Point，bbox/query/nearest/aggregate|探索可用；不可稱現況或步行可達。補 upstream date/status。|
|嘉義公車 Line|same-origin route asset（TDX）；時間/sourceVersion unknown；OGDL attribution；EPSG:4326 LineString，5 位量化|Line reader，query/line_intersects/aggregate；31 route shapes|最合格 Line 正例；尚無 browser/native V02 證據。補 asset receipt 與獨立走廊 oracle。|
|raw 行政界 Polygon|DEV `/__local-research-boundaries/county.geojson`；version `COUNTY_MOI_1140318`；local license待確認；raw actual MultiPolygon|verified boundary，query/line_intersects/aggregate|HOLD：owner-only local，不能當公開來源。補公開授權/發布與 runtime readback。|
|統計 Polygon|`regional-statistics://...`；明示 period/boundary；license unknown；generalized MultiPolygon，`spatialAnalysisEligible:false`|statistics snapshot，query/aggregate/compare_regions|可做行政比較；HOLD 空間相交/面積。補同版 raw analytical boundary。|
|學校 150m Grid|local research asset；observed_at null；license unknown；generalized Polygon、occupied-only|local grid query/aggregate|HOLD 空間分析；缺格不等於零。補 cell/no-data/coverage 及合法分析 geometry。|
|CWA 地震 Event|`supabase:public.earthquake_replay_events`；occurred_at；license需 receipt；source Point，兩位小數|bounded event query/nearest|有限可用歷史 replay；非完整/current feed，更新撤回 unknown。補 fresh lifecycle 正例。|
|TDX 道路 Event|`supabase:public.get_road_events_current`；effective/expire/last_updated；TDX attribution；mixed source geometry，無分析 CRS/精度|bounded RPC query/aggregate|HOLD 空間分析；51-row sentinel、密集來源拒絕。補上游 exact selector 與可驗證 WGS84 geometry。|

依據：candidate 範圍與驗收門檻見 [next-campaign-assessment-20260924.md:35-48,114-128](./next-campaign-assessment-20260924.md)；Point registry/來源見 [researchDatasets.ts:56-108,116-134,213-254](../../../src/research/researchDatasets.ts)；事件、統計、格網見 [researchDatasets.ts:137-183](../../../src/research/researchDatasets.ts)、[earthquakeDatasetAdapter.ts:29-80](../../../src/research/earthquakeDatasetAdapter.ts)、[roadEventDatasetAdapter.ts:36-57](../../../src/research/roadEventDatasetAdapter.ts)、[statisticsDatasetAdapters.ts:25-84](../../../src/research/statisticsDatasetAdapters.ts)、[gridDatasetAdapter.ts:9-17](../../../src/research/gridDatasetAdapter.ts)。

缺口：至少三條路徑已有程式正例（static Point、local Line、statistics/RPC），但尚缺本片的真實 native/browser 正例；Polygon 面面交集、buffer、raster 均不列入本片資格。不得以 renderer、tile 數、proxy geometry 或缺席推論完整度、零值、撤回或可達性。
