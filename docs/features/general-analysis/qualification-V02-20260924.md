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

## 第二／三片追加驗證

2026-09-24 native Codex→MCP→Gateway→browser：嘉義公車 `CYI0123_樂活1路_0` 1筆、raw嘉義市界 `10020` 1筆、bbox `[120.4,23.44,120.49,23.52]` 圖書館3筆；line_intersects=1、point within=3，與獨立Shapely一致。三者同圖5features、source/layer及command ready已回讀；見 [驗收](./acceptance-V02-V03-20260924.md)。這補足三條代表讀取路徑，並未新增來源或宣稱11候選全部live通過。

公車asset SHA `ea6ccd99b9e6a181654323f7d7a800569f1c2a86891fea245bbbed007b79f2a7`；raw界線SHA `5044636b840fba57230f15b6728030a09f3d6dc801a86c2301052514acc684d6`；圖書館SHA `80425ed85d0b5efe237d315c0109efe62d7ee556418977337db380b16e5d98a5`。raw界線維持owner-only、DEV、本地驗證；公開license與distribution仍HOLD。公車sourceVersion/freshness unknown與5位座標量化不變。

V03本地可從合格公車線產生derived buffer並做面交集，但它們同屬公車主題；第二個獨立主題actual Polygon尚未資格化。不能因此宣稱跨主題面疊圖或服務可及性完成。
# R03 第二主題來源資格（2026-09-24）

本節補充既有表格，不把固定 GeoJSON 的資格外推到同主題全部資料。

| Dataset | 固定產物與範圍 | 可用語意／限制 |
|---|---|---|
| `tw-urban-cemetery-zones` | `/funeral/cemetery_zoning.geojson`，601318 bytes、114 MultiPolygon、SHA256 `55302cbf68ab98cf5608b6c5ac626eaef4eaa0dc3f80c46814f8b86f5d1a844e` | 雙北都市計畫墓葬分區衍生快照；保留 `zoning_id/zone_label/county/area_ha`。upstream `make_valid`、轉WGS84、標籤萃取，再經 `set_precision(1e-6)`。runtime不再改座標；球面度量與来源EPSG:3826 `area_ha`分列，不當作法律或地籍判定。非都市土地與其他縣市不在涵蓋內。 |
| `tw-yushan-huts-official-coordinates` | `/forestry/mountain_huts.geojson`，119620 bytes、136筆混合來源、SHA256 `5e9f4a1017089dd02540720f1da34b191048e1638dcacf0e29f5aec77f6212e4`；固定三欄選取30筆 | `coord_source=yushan_np_shp`、`source_tier=1`、`in_yushan_official=true`。30筆名稱與座標皆與各筆內嵌官方 provenance 完全一致。106筆OSM座標排除；不暴露混入的容量、高程、OSM ID。不代表目前開放、安全、床位或全臺供給。 |

官方授權現場查核：[臺北156197](https://data.gov.tw/dataset/156197)、[新北166182](https://data.gov.tw/dataset/166182)、[玉山7449](https://data.gov.tw/dataset/7449)皆標政府資料開放授權條款第1版。新北明示以發布實施都市計畫書圖為準。臺北頁面說明更新至114年1月，玉山檔案名114年修；不能把下載或網站metadata日期當觀測日期。山屋載入原檔含OpenStreetMap資料，因此保留混合檔OGDL／ODbL聲明，不宣称全檔純官方。

Lineage程式：analytics `pipelines/urban_composite/urban_zoning/02_normalize_validate.py`、`pipelines/funeral/cemetery_zoning_urban/01_extract.py`、`pipelines/funeral/_shared/build_web_assets.py`；山屋 `pipelines/forestry/mountain_huts/{01_download,06_enrich,07_export}.py`。本地raw/processed歷史檔案缺席，未補成原始檔SHA链完整；此次資格僅針對上述可重現固定衍生bytes與其已知處理語意。2026-08-01是既有記錄的上游落地／山屋取得日，不是墓葬衍生產物發布日。

未採用：全國零售市場點位混TGOS、Google、離線地址匹配，且pulse縮減檔已刪除逐筆 `coord_method`，不能升格為來源原生精確座標。森林遊樂區尚未完成同版來源／處理資格核對，保持候選。

## 本輪批次來源資格補充（2026-09-24）

本輪以 analytics pipeline、raw provenance 與 pulse 固定 bytes 交叉核對；`SHA` 是 pulse public artifact 固定快照，非上游原始檔 SHA。郵局與文化精簡檔缺 `coord_status`，因此採固定 SHA 全量同來源座標 contract，交由 full-source reader；childcare/elderly 的 TGOS 座標不升 `actual`。

| 候選 | 固定產物／筆數／SHA | 資格 | 原因與日期邊界 |
|---|---|---|---|
| 郵局 | `/civic_facilities/post_offices_national.geojson`；1,278；`ee8b89fc042fa891a0924f5d069dbed45591ad64eef8daecb9a1d6ffa1684770` | **可接 full-source reader** | 中華郵政官方開放資料，CSV 已含 WGS84，pipeline 僅 bbox/swap sanity；來源 data.gov.tw/5950，OGDL-1。上游原始座標日期/來源更新不定期；本地快照 2026-07-17，不能把本地 quarterly 排程當官方頻率。 |
| 文化設施 | `/culture/cultural_facilities_national.geojson`；787；`0f7d0d93b9695c2beb45f5916fb0185f1aac30c9e333669ebe31bc55f506591d` | **可接 full-source reader** | 文化部 emap data.gov.tw/10046，OGDL-1；六系列 raw 均以 API latitude/longitude 讀取，合計 787 筆有座標。保留 `source_type_id` 與 `coord_status` 語意；本地快照 2026-07-16，官方更新日期仍以來源 metadata 為準。 |
| 托嬰中心 | `/welfare/childcare_centers_national.geojson`；1,578；`34511cde4fd56b742623c54df7e807c135289c72efd90db1578d18c407423786` | **HOLD／補 contract** | 165355 官方名冊，OGDL-1；`coord_source=tgos_upstream && coord_precision=upstream` 僅 1,354 筆，屬官方名冊地址經 TGOS 估位，不是 source-native actual。原始 Last-Modified 2024-11-12；catalog/pipeline 2026-08-12，freshness unknown。 |
| 老人住宿機構 | `/welfare/elderly_care_homes_national.geojson`；1,160；`0b7ce3243c8a0d735c978bff05b0a5031e8f702a31691ca2c32d9816715a120f` | **HOLD／補逐筆 provenance** | 混合 8572/165355/161606，OGDL-1；`tgos_upstream/upstream` 1,043 筆，但現有輸出無法證明每筆座標提供源，不能直接升 verified actual。catalog/pipeline 2026-08-12；165355 freshness unknown。 |
| 公廁 | `/environment/public_toilets_national.geojson`；13,281；`3f8f9e75b6f05e3697a0af90224bed792e435b1605678ce8182f6045e5d2bc5b` | **HOLD／derived contract** | 環境部 FAC_P_07、OGDL-Taiwan-1.0；45,718 raw rows 依 address 聚合成 13,281，代表列取座標，含 48 swap、11 濾除，非 raw record grain。來源標稱 monthly；本地 pipeline quarterly 只是排程。 |
| 社區活動中心 | `/civic_facilities/community_centers_national.geojson`；1,794；`673c56098634d8174d32c3d02471133219ee107c3182a44fea413f66fe97bfb2` | **HOLD** | 只涵蓋 8 縣市；TGOS/data.taipei 混合 `coord_method`，不是全國 source-native contract。 |
| 公務服務處 | `/civic_facilities/gov_service_offices_national.geojson`；702；`a66a88cd844fb98a97680dc5b95a124caa4dc84a7aed78dd986757eef9c8d28a` | **HOLD／補 contract** | Point 幾何有效但本 repo 尚缺可核對 source/license/date receipt；不能僅以 WGS84 升資格。 |
| 殯葬設施 | `/funeral/funeral_facilities.geojson`；3,707；`e92b0dd215b862c975dcb42038bdd661c7f9b28594275c2df85852026786dc94` | **HOLD／補 precision contract** | 官方名冊經本地處理，`precision` 混合且來源座標/估位界線未在本輪完成逐筆 selector；不可把有效 Point 當 actual。 |

郵局與文化 raw-source 近點 oracle（輸入非 pulse native 結果）另存 `../runtime/six-source-oracle.json`；中心 `[120.6815,24.1373]`/1350m：郵局 3 筆，最近臺中民權路郵局 334.91m、臺中臺中路郵局 487.39m、臺中法院郵局 668.81m。中心 `[121.747,24.755]`/950m：文化 3 筆，最近宜蘭設治紀念館 259.15m、宜蘭美術館 497.38m、台灣戲劇館 666.12m。
