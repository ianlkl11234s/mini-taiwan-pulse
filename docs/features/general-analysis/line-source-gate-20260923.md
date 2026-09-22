# N03 line source gate（2026-09-23）

## 結論

**PASS（bounded session snapshot）。** 來源鏈、CRS、shape 語意、授權與輸出 precision 均已核對；TDX sourceVersion 仍 unknown，但現檔 SHA 可作 session snapshot version。這不代表 TDX 的全國 catalog 或最新資料保證，也不取代後續 `line_intersects` runtime readback。

唯一推薦 `public/bus/chiayi_bus_routes.json`。它是現有 loader 實際讀取的靜態路線資產，檔案 530,765 bytes、31 條 route shape、17,038 個座標、所有 route 至少 2 點，座標均落在台灣範圍。JSON `coords` 由既有 adapter 明確作為 route line path 使用，不要求 asset 本身必須是 GeoJSON；生成 script 明確將來源座標 round 至 5 位小數，`cumDist` round 至 6 位。剩餘未知只有上游 TDX Shape snapshot 的 sourceVersion，已由現檔 SHA 作 session snapshot identity。

## 候選盤點

以下五個 bus 檔是同一條 TDX shape 衍生流程的縣市切檔，**不是五個獨立來源，也不能合併計數**。本地驗證讀取各檔完整 JSON（合計約 5.54 MB，未下載外部資料）；`features` 是 route key 數，`coords` 是實際陣列點數。

| 候選 | bytes / SHA-256（前 12） | routes / coords | 幾何與狀態 |
|---|---:|---:|---|
| `public/bus/chiayi_bus_routes.json` | 530,765 / `ea6ccd99b9e6` | 31 / 17,038 | bounded PASS；TDX sourceVersion unknown、SHA versioned |
| `public/bus/hsinchu_bus_routes.json` | 702,211 / `64ee8dc30b84` | 61 / 21,920 | 同源 bounded candidate；SHA versioned |
| `public/bus/hualiencounty_bus_routes.json` | 996,872 / `d139853139e0` | 31 / 32,966 | 同源 bounded candidate；SHA versioned |
| `public/bus/changhuacounty_bus_routes.json` | 1,729,700 / `6d79c27e3f35` | 46 / 57,198 | 同源 bounded candidate；SHA versioned |
| `public/bus/nantoucounty_bus_routes.json` | 1,580,987 / `d867589a2caab` | 36 / 52,330 | 同源 bounded candidate；SHA versioned |

五檔皆為 object map；每筆含 `routeUid`、`routeName`、`direction`、`coords:[[lng,lat],...]`，本次掃描五檔均 `invalid=0`、`shortRoutes=0`。生成程式由 TDX WKT `LINESTRING` 轉 GeoJSON，再以 5 位小數量化後輸出 `coords`；這是可揭露精度的衍生線形，不是中心連線或示意線。JSON → adapter 的轉型是正常接線，不是 source gate blocker。

## 可追溯鏈、授權與限制

- `src/data/busLoader.ts` 的 `loadBusRoutesForCity()` 以 `BUS_CITY_CONFIG[city].jsonFile` fetch JSON，建立 route map；這是現存 runtime reader，並非只靠檔名或 regex 推測。
- `../../taipei-gis-analytics/pipelines/transportation/bus/06_fetch_bus_shapes_nationwide.py` 明列 TDX `/v2/Bus/Shape/City/{city}` 與 `/v2/Bus/Shape/InterCity`，將回傳的 `Geometry` WKT 以 `shapely.wkt.loads` 轉成 GeoJSON geometry；這證實來源是 TDX Route Shape 線形，不是中心點連線或示意線。`scripts/preprocess/preprocess-bus-routes.py` 再從同一份 `bus_shapes_all.geojson` 按縣市輸出 route JSON，adapter 讀取 `coords` 並建立 route map。
- `../../taipei-gis-analytics/data/processed/transportation/bus/_manifest.json` 對 `bus_shapes_all.geojson` 與 city/intercity shape artifacts 標示 `crs: EPSG:4326`；`docs/data-catalog/transportation/bus.md` 明列 Shape `Geometry=WKT LINESTRING`、WGS84、來源端點與 `授權: 政府資料開放授權條款 1.0 (OGDL-Taiwan-1.0)`。TDX 官方[公共運輸整合資訊流通服務平台授權條款](https://ptx.transportdata.tw/PTX/APIs/Terms)第 2 節允許重製、散布、編輯與改作，並要求第 3 節顯名聲明；本文件因此把 license 從 unknown 修正為 **OGDL-Taiwan-1.0（需 attribution）**。
- sourceVersion 仍 unknown；本次以現檔 SHA-256 作為可重現 session snapshot identity。precision 已由生成程式證實為 `coords` 5 位小數、累積距離 6 位小數；這是量化／衍生語意，後續分析需保留，不可把它寫成未處理原始精度。

## 其他 manifest 線層

- `cyclingRoutes`（`src/data/layerManifest.ts:10015-10036`）宣稱 `./geo/cycling_routes.geojson`，但該 asset 不在本 worktree；manifest 不能代替可讀證據，故 HOLD。既有 upstream note 另記 1,749 rows 的欄位缺值／FinishedTime 問題，不能用列數代替 geometry 支持。
- `waterRivers`（`src/data/layerManifest.ts:7872-7907`）目前 runtime source 是兩份 PMTiles；文件指出 `water_rivers.geojson` 欄位全空，且本地沒有該原始線檔。這是 display tile／缺欄位風險，不符合本 gate 的小型原始 LineString 要求。
- `highways`、`provincialRoads`、`forest_roads`、OSM expressway 目前是 PMTiles/display layers；未找到 ≤2 MB 且附原始線幾何與授權 receipt 的可讀 snapshot。`forest_roads.geojson` 已知約 16 MB，超過上限；不以 generalized/display geometry actualize。

## 驗證

使用 Node `fs.readFileSync` + `JSON.parse` + SHA-256 對上述五檔完整讀取；逐 route 驗證 `coords.length >= 2`、每點為有限 `[lng,lat]`，並檢查台灣 bbox `119..123 / 20..26`。另核對 TDX shape pipeline、analytics manifest、bus catalog、Mini loader 與官方授權條款；未下載外部 asset，未改 adapter、manifest 或 shared code，未 commit。
