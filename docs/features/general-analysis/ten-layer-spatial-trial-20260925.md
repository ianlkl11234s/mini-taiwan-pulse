# 596 未知層：十層來源與空間分析試跑

2026-09-25，隔離 `research-streamline/mini`。抽樣依 2026-09-25 原台帳的 `readable=unknown_or_unavailable`，不是從另列的 105 個 metadata candidate 挑選。原台帳 778 層、596 unknown/unavailable；這個計數表示研究工具缺 reader 或權限，**不表示原表不存在**。十層涵蓋 Point、Line、Polygon、PMTiles、即時 RPC、色階影像與 owner-only；此為有意分層抽樣，不是對剩餘 586 層的統計推估。

判定分成四關：①原表／同版 artifact 與授權、時間；②geometry role／缺值；③有界 query reader；④正常 Codex→MCP→Gateway→browser 呈現。下表的「試跑」只寫實際做過的關卡，不能把本地原檔讀取當成產品已可查。

| Layer（原屬 596） | 實際來源與試跑 | 現階段障礙／下一個可執行動作 |
|---|---|---|
| `agriPOI` 農業 POI | 原 checkout 與 analytics `data/processed/agriculture/agriculture_pois/agriculture_pois.geojson` 同 SHA `47416af0…5c207`、329,797 B；合併檔 839 個 Point，405 休閒農場、330 認證農旅、104 田媽媽。三份 [177247](https://data.gov.tw/dataset/177247)、[177246](https://data.gov.tw/dataset/177246)、[177245](https://data.gov.tw/dataset/177245) 官方頁各列 OGDL。此次固定 SHA/count 接通 reader；埔里 `[120.965,23.968]` bbox 16 筆後，10 km 直線環域得 10 筆，正常工具鏈 `ready` revision 57、map readback 10 features／1 source／1 layer，瀏覽器目視可見。 | **已從 596 移出**。177246 官方／上游原表為 331 筆，但合併檔只有 330 筆，差異原因尚待回查，不能稱原三表完整。2024/2025 是清冊批次，非逐筆營業觀測。全部 839 點的 GeoJSON Z 值為 0，reader 僅取經緯度；來源點不是驗證過的入口。埔里 10 筆有兩對同名同座標跨清冊紀錄，應保留兩種分類但 UI 要能合併呈現；「10 筆」不可稱「10 個不同場域」。 |
| `livestockFarmPig` 養豬場 | 原 checkout 資產與 analytics enriched GeoJSON 同 SHA `41c3244b…819e13`、4,478,767 B／13,087 Point；同一 `livestock_farms` 來源支援七個畜種 layer。上游 catalog 記 high 12,271、medium 47、low/centroid 769。`get_livestock_farms` RPC 與 layer governance 在 `gis-platform/migrations/276_governance_layer.sql` 明定 owner。 | 原表存在，但精度混合、部分座標由 Google 等方式衍生，且 owner-only；不得整檔公開接入通用附近 reader。先建 owner 專屬有界 RPC／bbox contract，分精度子集與授權用途，低精度不做近鄰距離。未呼叫正式 Supabase。 |
| `airports` 機場 | 本地 `public/geo/airports.geojson` SHA `3b68ec72…1524`、51,108 B／16 features，15 Polygon＋1 MultiPolygon；同一檔用於範圍與畫面代表點。 | 代表點屬展示，不能取代機場實際面積或航站位置。下一片驗來源版與 16 面，同版有界 polygon reader 支援 `contains/intersects`；距離到機場應先決定「邊界」或「航站」語意。 |
| `aqiImagery` AQI 色階 | `aqiImageryLoader.ts` 以 `get_aqi_imagery_frames_batch` 取過去時段的 metadata＋base64 影像，含產品、時間與 bbox；實讀了 loader/RPC 契約，未取像元。 | 這是色階圖片，不能用 RGB 猜 AQI。須找同版數值格網、encoding、NoData／單位、觀測時間與取樣契約；目前只有展示／影像時間軸，不產附近 AQI 數值。 |
| `busIntercityLive` 公路客運 | `busLoader.ts` 分 route shape、`get_bus_intercity_current`、dates、trails；目前 Three.js 動態展示，manifest 註記沒有 picking。已核對 loader/RPC 名稱，未打 live RPC。 | 需指定「此刻車輛」或「固定日期軌跡」的時間窗口、TTL、ID 與完整度，再做 bbox/時間有界 reader。路線形狀不是此刻車輛，無車回覆不能推斷無服務。 |
| `buildingsGba` 建物 | 原 checkout 展示 `buildings_value_taiwan.pmtiles` SHA `c8bb3ba7…91662`、261.4 MB；上游 `property_value` catalog 表明此為 152 萬棟的估值後續版本，原始 footprint 在 `buildings_3d_gba/buildings_3d_taiwan.geojsonl`，418 MB。 | manifest 上游註解的 `buildings_3d_taiwan.pmtiles` **不是實際展示檔**；先建立估值版 ↔ footprint 原表的同版 ID/hash receipt。GBA 衍生資料為 CC BY-NC 4.0、非商業使用限制；不得當通用公開資料。需 bbox 分片索引，不能整檔入 browser 或假設 tile 代表全量。 |
| `companyPoints` 公司登記 | 原 checkout detail PMTiles SHA `44210b69…1184`、28.3 MB；analytics manifest 記 202608 r2 654,165 發布點，原中繼 `company_points.geojsonseq` 本機 224.4 MB；overview 5,745 格但不是點母表。 | 可從 202608 中繼建立 immutable bbox/Parquet reader，核對 657,882 來源列→654,165 發布點及排除原因，嚴守公開白名單。登記地址的點不等於工廠、實際營業或入口；overview 格網不可反推個別公司，也不能以可見 tile 計數。 |
| `forestRoads` 林道 | 展示 PMTiles SHA `68bfbdb3…67cc`、1.21 MB；analytics 原表 `forest_roads.geojson` SHA `68f26143…1f16`、16.52 MB／107 LineString，另有 FGB 7.98 MB。以埔里點 10 km 的本地 AEQD 距離試算，`卓社林道` 線幾何最近約 7.67 km。 | 本地計算已證明 line family 可以回答「附近有沒有林道」，但不是網站 query。先核對 PMTiles 與原表同版／欄位，做 FGB bbox 或 immutable shard reader；線距離不是可行道路距離，也不代表開放通行。 |
| `countyBoundary` 縣市界 | 展示 PMTiles 與 analytics 同檔 SHA `577325ca…24dd`；原表 `county_boundary_20260626.geojson` SHA `5044636b…84d6`、14.72 MB／22 MultiPolygon。本地 `contains` 判定埔里點位於南投縣。既有 `tw-county-boundaries-raw` 僅 DEV opt-in、無對外 layer mapping。 | 先查正式授權／版次，才把 raw 邊界的 point-in-polygon 能力接 `countyBoundary`。它是 `COUNTY_MOI_1140318` 行政快照；邊界點需訂 `within`／`intersects` 規則；不可用低精度統計界線替代。 |
| `waterRivers` 河川 | 原 checkout 兩份展示 PMTiles；analytics 完整面 13,262 MultiPolygon／175.9 MB、線 2,015 MultiLineString／168.6 MB。完整面 `river_name` 12,210 有值、1,052 空；線主要名稱／類型欄位均空。 | 先核對 tile ↔ 完整面/線同版，按 bbox 建 immutable sidecar/shard；不能一次下載 344 MB 給 browser。面可做與基地相交，但空名稱必留缺值；線目前只宜回答幾何相交／距離，不能捏造河名。 |

## 由「點附近」走到分類分析

入口應接受 `[lng,lat]` 與明確半徑，先讀每份 descriptor 的授權、快照時間、geometry role、coverage。actual Point 做 geodesic 距離；Line 以有界投影／測地線計算線到點最短距離；Polygon 做 point-in-polygon 或與環域相交，並標出洞、多面及邊界規則；格網另以原格口徑讀值；影像只有 source 數值格網時才能取樣。每一家族回傳相同外層 receipt（dataset/version、來源、時間、排除／缺值、matched/returned/truncated、距離定義），內部仍保留各自 record grain，不能硬把 line/area 轉成 Point。

埔里實測是第一個跨 geometry proof：農業 POI 10 筆（6/4 來源類別）、縣市界命中南投縣、林道 1 條；**目前只有 POI 經過正常 MCP→Gateway→browser**。縣界與林道只在本機原檔以 `shapely`／AEQD 投影試算，仍屬待接 reader。正式 UI 應按「場所、交通線、行政背景、即時／數值」分組，可同時顯示多個結果，保留一筆跨清冊多標籤而不默默去重。10 km 是直線／幾何距離，非步行可達性。

下一批以共用 reader 擴展，而非逐題硬編答案：①縣界 22 面的 bounded polygon reader；②林道 FGB bbox line reader；③公司點大檔的 immutable spatial shards。每批先固定 source/tile 對照與 license、再加正反例／新地點變體、tsc/build、正常配對 browser readback。權限、非商業、來源不明及純配色影像保持 HOLD。S3／Supabase 的**實際存在與當前授權／版本**未在本片登入核對，不能由本地檔或 manifest 推稱已驗證遠端。

本片驗收：`agriPOI` focused tests 2/2、`npm run build`（含 `tsc -b`）通過；原 checkout 來源檔只唯讀複製到隔離 worktree ignored `public` 作驗證，SHA 相同，未納入 Git。原本的 1,974 tests 是前夜收據，本片未重跑全套。正常配對 session active、埔里 bbox 16／10 km 10、`ready` revision 57、map readback 10 features／1 source／1 layer 與目視點位。未 push、PR、merge、部署、擴大付費 provider 呼叫。
