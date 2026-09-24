# N2：GeoJSON Point 候選（2026-09-25）

本輪從 `analysis-coverage-20260925.json` 的 118 個 `metadata_candidate_requires_readback` 候選出發，依 `src/data/layerManifest.ts` 的 `source.url` 去重，只讀已存在的 `public/` GeoJSON；沒有下載、沒有掃描超過必要檔案。JSON 以 `features` 的 geometry type 做實讀，不能把副檔名當成 geometry 證據。以下 15 個是較可行的純 Point 試點（bytes／feature 數為本地檔案當下值）。

接入前基線為 118 個 metadata 候選；首批接入 2 份 proxy 資料及 1 份燈塔來源座標後，當日台帳為 115 個。再接入海纜登陸站 11 個 node 與 47 個 center 的同源雙 descriptor（見 [專用紀錄](./n2-landing-stations-20260925.md)）後為 114 個；心理衛生機構只接 63 筆來源自帶座標（見 [專用紀錄](./n2-mental-health-20260925.md)）後為 113 個；溫泉露頭 150 筆接入後為 112 個；公部門社福據點只接 133 筆來源自帶座標後為 111 個；公有市場自上游處理檔另建 TGOS-only sidecar 後為 110 個；政府服務機關同版 TGOS-only sidecar 後最新台帳為 109 候選、82 registered datasets／73 queryable layer refs。這是本地 descriptor 與固定資產 readback，不代表遠端資料新鮮或網站已驗收。

| layer key | asset（manifest source URL） | bytes / features | geometry | source／時間／授權證據 | 既有 reader | 阻擋項 |
|---|---|---:|---|---|---|---|
| `forestFlatParks` | `public/forestry/flat_forest_parks.geojson` | 4,155 / 3 | 3 Point | 上游 `taipei-gis-analytics/docs/data-catalog/forestry/flat_forest_parks.md`；地址→county centroid、OGDL | 已接 SHA/筆數固定的 proxy adapter | 來源實際更新日與現場營運狀態 unknown；不得最近距離／環域 |
| `forestEducationCenters` | `public/forestry/forest_education_centers.geojson` | 3,460 / 8 | 8 Point | 上游 `taipei-gis-analytics/docs/data-catalog/forestry/forest_education_centers.md`；地址→county centroid、OGDL | 已接 SHA/筆數固定的 proxy adapter | 來源實際更新日與現場營運狀態 unknown；不得最近距離／環域 |
| `lighthouses` | `public/geo/lighthouse.geojson` | 7,638 / 36 | 36 Point | 上游 `taipei-gis-analytics/docs/data-catalog/transportation/light_house.md`；航港局 SHP 轉 WGS84、OGDL | 已接 SHA/筆數固定的 actual adapter | 來源／pipeline 日期 unknown；不可當作目前開放或航安狀態 |
| `landingStations` | `public/geo/landing_stations.geojson` | 60,304 / 58 | 58 Point | 上游 OSM/Overpass、ODbL；詳見專用紀錄 | 已接 11 actual node＋47 proxy center 雙 descriptor | 來源不完整；center 不可做近鄰／環域 |
| `welfareMentalHealth` | `public/welfare/mental_health_facilities_national.geojson` | 33,873 / 70 | 70 Point | 上游 165355、OGDL；70 筆中 63 upstream/7 Google-derived | 已接 63 筆固定 SHA 來源自帶座標 reader | 7 筆 Google 派生座標 HOLD；`permit_status` 不代表目前有效 |
| `religionTop100` | `public/religion/top100.geojson` | 48,306 / 100 | 100 Point | manifest entry 1012；上游 `taipei-gis-analytics/docs/data-catalog/religion/top100.md` | 同上 | 固定精選 100 筆非寺廟總數；部分節慶代表點，須確認語意；尚無 descriptor |
| `tourHotSprings` | `public/tourism/hot_springs_national.geojson` | 34,397 / 150 | 150 Point | manifest entry 2882；上游 `taipei-gis-analytics/docs/data-catalog/tourism/hot_spring.md` | 已接固定 SHA／150 筆 actual reader | 10 筆泉質空白；無上游穩定 ID，record ID 只在固定版本內有效；不是營業或水質現況 |
| `welfareGovOffices` | `public/welfare/welfare_gov_offices_national.geojson` | 73,967 / 151 | 151 Point | manifest entry 3701；上游 processed 307，展示排除 156 筆 T0103；衛福部 165355／OGDL；2024-11-12 Last-Modified | 已接 133 筆 `tgos_upstream/upstream` actual reader | 17 Google／1 offline_l2 不在 reader；來源地址級座標，非實測入口；`uid` 只在本快照內有效 |
| `welfareCenters` | `public/civic_facilities/welfare_centers_national.geojson` | 32,222 / 157 | 157 Point | manifest entry 2576；upstream `verified` | 同上 | 需確認資料版次與授權；尚無 descriptor |
| `tourFactories` | `public/tourism/tourism_factories_national.geojson` | 60,770 / 158 | 158 Point | manifest entry 2993；上游 `taipei-gis-analytics/docs/data-catalog/tourism/tourism_factory.md` | 同上 | 混有 Google geocode 座標，非 Google 底圖使用政策待審；尚無 descriptor |
| `culturalMuseums` | `public/culture/local_cultural_museums_national.geojson` | 112,536 / 252 | 252 Point | manifest entry 1191；文化部 6244／OGDL；2026-07-16 pipeline 快照；原始 266 筆來源經緯度全空 | 尚無 dataset | 252 筆全為後續 geocode（exact 184、approximate 34、interpolated 24、cached 10）；另 14 筆無座標。不得當來源實測座標作近鄰／環域；先審 derived 精度與 Google 使用條款 |
| `stationsMetro` | `public/geo/station_points.geojson` | 97,969 / 503 | 503 Point | manifest entry 9653；upstream `verified` | 同上 | 需釐清 station grain／營運時點；尚無 descriptor |
| `govServiceOffices` | `public/civic_facilities/gov_service_offices_national.geojson` | 145,656 / 702 | 702 Point | manifest entry 2536；[官方 38403](https://data.gov.tw/dataset/38403) 明列 OGDL；上游原始 707／processed 702 | 已從同版 processed 建 462 筆 TGOS-only sidecar 與 actual reader | 239 Google L1＋1 offline 未接；另 5 無座標。地址級非入口、2026-07-17 非現況；另一來源 `jurisdiction` 已排除 |
| `retailMarkets` | `public/poi/public_retail_markets_national.geojson` | 132,357 / 731 | 731 Point | manifest entry 2662；[官方 59855](https://data.gov.tw/dataset/59855) 明列 OGDL；上游 processed 731／原始 789 | 已從同版 processed 建 653 筆 TGOS-only sidecar 與 actual reader | 70 筆 Google L1＋8 筆 offline 未接，另 58 筆無座標；來源鄉鎮 48 筆空字串；不代表目前開市 |
| `culturalFacilities` | `public/culture/cultural_facilities_national.geojson` | 204,963 / 787 | 787 Point | manifest entry 1169；文化部 10046／OGDL；原始 1,170 另有 383 無座標 | 已有固定 SHA／787 筆來源座標 dataset，尚未綁 layer key | 需確認與 `culturalMuseums` 的邊界及去重；兩層名稱有 8 筆重疊，不能逕合併 |

共同結論：這些檔案都能通過本地 JSON／geometry readback，但副檔名與 Point 型別都不能證明座標是實際位置。前兩份已完成 proxy descriptor 接線，依來源文字欄位查詢與計數，距離／bbox 明確拒絕；燈塔依直接來源座標接 actual adapter，可用 bbox／nearest，但不代表設施即時狀態。表內尚未完成 layer mapping 的項目仍依各列阻擋項處理，不可宣稱 production-ready。`officialNoiseMonitoring`（415 Point + 11 null）與 `soundCameraLocations`（267 Point + 66 null）刻意排除；混合 geometry 不列入純 Point 候選。

最小驗證：`analysis-coverage-20260925.json`（118 候選）、`src/data/layerManifest.ts` 對應 entries；逐檔只讀 JSON `features[].geometry.type`、檔案 bytes 與 feature count。未宣稱遠端新鮮度、完整來源、授權已清、瀏覽器顯示或 production acceptance。
