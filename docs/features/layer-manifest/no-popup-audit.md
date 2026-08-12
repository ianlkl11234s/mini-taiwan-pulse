# NO_POPUP_LEDGER 57 筆逐筆考證

> 唯讀分析，未改動 repo 任何檔案。
> 對象：`src/components/sidebar/__tests__/layerConsistency.test.ts:187-216` 的 `NO_POPUP_LEDGER`（57 筆）。
> 問題：機械對帳已證明「宣告 null ⇔ 真的沒接線」；本文考證的是**它應不應該有 popup**（UX/產品判斷）。
> 日期：2026-08-12

---

## 0. 結論摘要

| verdict | 筆數 |
|---|---|
| **KEEP-NULL**（合理無 popup） | **22** |
| **CANDIDATE**（值得補） | **29** |
| **EDGE**（需 owner 拍板） | **6** |
| 合計 | 57 |

29 筆 CANDIDATE 不代表 29 個工作項——**它們收斂成 9 個工作包**（見 §5），其中 4 個包是「資料早就烤好、只差 `GIS_LAYERS` 一行」。

### 本次考證推翻／補充既有分類的三點

1. **成因分類要加第 6 類「資料已烤好、只差接線」**。`iotWraRiver` / `iotWraStructure` / `groundwaterWells` 三層的 GeoJSON `properties` 已經逐欄位烤進 `name` / `measurement_name` / `si_unit` / `value` / `delta` / `observed_at`，`HEADER_LABELS` 也早有條目——唯一缺的是 `GIS_LAYERS` 一行。這不是「沒有可點物件」，是**接線半途而廢**。

2. **房地產 6 層的成因被登記錯了**。ledger 註解寫「數值直接以顏色表達」，但實際上：
   - 3 張 **Grid** 有 **hover tooltip**（`useMapInteraction.ts:600-613` 的 `mousemove`），顯示 `grid_id` / `n_tx` / `price_per_sqm_median` / `price_median` → 是成因 2（獨立 tooltip），不是「沒有可點物件」。
   - 3 個 **Point** 的 tooltip **render 分支已經寫在 `App.tsx:2965-2983`**（district / address / price_per_sqm / total_price / area_sqm / trade_ts），但 picking 被拿掉了（`useMapInteraction.ts:614` 註解：「點 hover 暫時移除：point 已改 WebGL CustomLayer，不支援 queryRenderedFeatures（待補 GPU/空間索引 picking）」）→ **死 UI**，不是設計決定。

3. **兩張 raster 有數值通道，不是已上色 PNG**。`canopyHeight`（R=G=B=公尺高度、A=nodata）與 `urbanHeat`（R=熱島強度 ΔT、G=絕對地表溫度、A=遮罩）走 Mapbox `raster-color` + `raster-color-mix` 動態上色，物理值就在像素裡。而且 repo 裡**已有可直接沿用的讀值前例**：`src/data/climateFieldSampler.ts`（nullschool 式點擊讀 UV PNG → `climateField` popup，掛在 `useMapInteraction.ts:547-565` 的 `if (!found)` fallback）。其餘 5 張 raster（dustForecast / cwaCloud / cwaRadar / aqiImagery / precipRaster）確認是上游／預烤的**已上色影像**，無數值通道 → KEEP-NULL 成立。

---

## 1. 判斷所依據的橫向對照（真值來源已逐條查證）

| 有 popup 的層 | 無 popup 的對照層 | 差異是否有正當理由 |
|---|---|---|
| `railStation`（`stationsTRA` / `stationsMetro`，`popup:"railStation"`） | **`stationsTHSR`** | ❌ 否。`station_points.geojson` 503 筆**零筆 thsr**（tra 212 / trtc 196 / krtc 39 / klrt 38 / tmrt 18），高鐵站只存在於 `station_polygons.geojson`，而該面層 4 個 layer id 不在 GIS_LAYERS → 全台唯一點不到的車站族 |
| `osmRoadDrive`（`base-osm-road-line` + `OsmRoadDrivePanel`） | **`osmExpressway`** | ❌ 否。同一份 OSM 欄位契約（name / ref / lanes / maxspeed / surface / bridge / tunnel） |
| `roadCongestion`（省道，且**刻意加了透明 hit 層**提升細線命中率） | **`freewayCongestion`**（國道） | ❌ 否。國道那層有 `section_name` / `road_name` / `direction_label` / `level` / `speed`(km/h)，資料更完整卻不可點 |
| `riverLevel`(831 站) / `rainGauge` / `groundwater` | **`iotWraRiver`**(1,634 站) / **`iotWraStructure`** / **`groundwaterWells`** | ❌ 否。properties 已烤好，`HEADER_LABELS` 已有條目，只缺 GIS_LAYERS |
| `propertyValueGrid` / `urbanFormGrid` / `temperatureGrid` / `funeralOperatorDensity`（皆大面積 fill，皆可點） | **人口社經 6 層** H3 fill | ❌ 否。H3 cell 的 `properties.value` 就是該指標值 |
| `aquaculturePonds`（逐口魚塭面） / `agriSoil` / `agriCropSuitability` | **`agriculture`**（FTW 田區面） | ❌ 否（惟 FTW 欄位較薄：area_ha / confidence_mean） |
| `wasteDisposalPoint`(wd*) / `wasteCleaningSquad` | **`wasteStopsStatic`**（73,060 點） | ❌ 否。有 stop_name / route_name / routes_count |
| `osmPowerTower`（電塔，`OsmPowerTowerPanel`） | **`powerPoles`**（電桿 296 萬） | ⚠️ 部分。欄位薄（pole_id 是台電內部碼），但族群不一致是真的 → EDGE |
| `wasteSchedule`（表定車，`pickRoute` → tooltip） | **`wasteTruck`**（GPS 實跡車） | ❌ 否。**模擬車可點、真車不可點**；`WasteTrailRow` 有 `vehicle_no` / `city` / `route_id` |
| `busLive` / `touristShuttleLive`（皆 `pickBus` → bus tooltip） | **`busIntercityLive`** | ❌ 否。唯一連 picking 都沒有的即時運具 |
| `offshoreWindZone`（OSM 36 面，有 panel） | **`windPlan`**（26 面） | ✅ **是**。windPlan 的 properties 只有 `Id` + `POLY_AREA`，真的沒東西可顯示 |
| `temperatureGrid`（2D fill，`TemperatureGridPanel`） | **`temperatureWave`**（3D 波） | ⚠️ **共用同一份 RPC**，2D 雙生層已可點 → EDGE |

---

## 2. 逐筆考證表

成因分類：**1**=沒有可點物件 · **2**=走獨立 tooltip 狀態 · **3**=HEADER_LABELS 有但 GIS_LAYERS 沒接 · **4**=有 registry entry 但 layer id 不在 GIS_LAYERS · **5**=glow 疊層由底層代接 · **6**=（新增）properties 已烤好、只差 GIS_LAYERS 一行

### 2.1 交通 · Three.js scene picking（5 筆）

| key | 成因 | 資料有無可顯示屬性 | verdict | 建議 |
|---|---|---|---|---|
| `rail` | 2 | ✅ `RailScene.pickTrain` → `setTrainTooltipInfo`（車次/車種/時刻） | **KEEP-NULL** | 互動存在且比 popup 更適合即時運具（隨車移動）。不動 |
| `flights` | 2 | ✅ `pickFlight` → `setTooltipInfo`（含當下高度計算）；另有 dblclick 跟隨 | **KEEP-NULL** | 同上 |
| `busLive` | 2 | ✅ `BusScene.pickBus` → `setBusTooltipInfo` | **KEEP-NULL** | 同上 |
| `touristShuttleLive` | 2 | ✅ 與 busLive **共用** bus tooltip 狀態 | **KEEP-NULL** | 同上 |
| `busIntercityLive` | **misfit（不屬 1-5 任一類）** | ✅ 同 busLive 的 `BusVehicle`（路線/車號/方向） | **CANDIDATE** | **S**。`useMapInteraction` 完全沒有它的分支，是全 repo 唯一「會動但完全點不到」的運具。`activeBusesIntercityRef` 已餵進 `useThreeJsLayers`，只需：① 讓 `useThreeJsLayers` 把 intercity 的 BusScene 一起 return（`touristShuttleSceneRef` 是逐行樣板）② `useMapInteraction` 加一個 `vis?.busIntercityLive` 分支複用 `setBusTooltipInfo`。**不需要新 panel、不需要新 layerType** |

### 2.2 交通 · 純線 / 站點（6 筆）

| key | 成因 | 資料有無可顯示屬性 | verdict | 建議 |
|---|---|---|---|---|
| `stationsTHSR` | **4** | ✅ `station_polygons.geojson` 44 面：`station_id` / `name` / `name_en` / `system_id` / `class` | **CANDIDATE** | **S**。`RailStationPanel` 已存在、`railStation` layerType 已存在。把 `station-polygons-thsr-poly-fill`（+ `-line`）加進 GIS_LAYERS 既有的 railStation 條目即可。⚠️ 排序要在點層 `station-points-*` **之後**（面層不可搶點層） |
| `osmExpressway` | **3** | ✅ PMTiles `osm_expressway`：`name` / `ref` / `lanes` / `maxspeed` / `surface` / `bridge` / `tunnel` / `highway` | **CANDIDATE** | **S**。與 `osmRoadDrive` 欄位契約完全相同 → GIS_LAYERS 加一行 `{ layers:["base-osm-expressway-line"], type:"osmRoadDrive" }` 直接複用 `OsmRoadDrivePanel`；或另立 `osmExpressway` type 指向同一個 panel（`HEADER_LABELS` 早有「快速道路 (OSM)」） |
| `provincialRoads` | 1（線層未接） | ✅ PMTiles `provincial_road` 25 欄：`ROADNAME` / `ROADNUM` / `RDNAMESECT` / `COUNTY` / `WIDTH` / `ROADCLASS1-2` / `MDATE` | **CANDIDATE** | **S-M**。地圖上沒有 symbol label，「這是台幾線」目前無法得知。與 highways 共用一個 panel |
| `highways` | 1（線層未接） | ✅ PMTiles `national_highway` 22 欄（同上，少 RDNAME*） | **CANDIDATE** | **S-M**（優先度較低——國道形狀辨識度高）。與 provincialRoads 同一個 panel、同一次改動 |
| `cyclingRoutes` | 1（線層未接） | ✅ GeoJSON 1,749 條：`RouteName` / `City` / `Town` / `RoadSectionStart` / `RoadSectionEnd` / `Direction` / `CyclingType` / `CyclingLength_m` / `FinishedTime` / `AuthorityName` | **CANDIDATE** | **S-M**。本群欄位最豐富的一層；起訖路段 + 長度 + 方向正是自行車道使用者要的 |
| `freewayCongestion` | 1（兩個 line layer 皆未接） | ✅ `FreewaySection`：`section_name` / `road_name` / `direction_label` + `FreewaySnapshot`：`level` / **`speed`(km/h)** | **CANDIDATE** | **M**。① `useFreewayLayer` 目前只烤 `level` / `color` 進 properties，要補 `section_name` / `road_name` / `direction_label` / `speed` ② 補一個透明 hit 層（`roadCongestion` 的 `road-congestion-hit` 是現成樣板，manifest 自己就註明了這個落差）③ 新 panel 或複用 `RoadCongestionPanel`。**時速是使用者開這層唯一想知道的數字** |

### 2.3 raster（9 筆）

| key | 成因 | 資料有無可顯示屬性 | verdict | 建議 |
|---|---|---|---|---|
| `canopyHeight` | 1（但有數值通道） | ✅ **R=G=B=公尺高度、A=nodata mask**（`overlayRegistry.ts:4640-4658`，`raster-color-mix:[6.375,0,0,0]` = 255/40） | **CANDIDATE** | **M-L**。前例 `climateFieldSampler.ts` 已證明「點地圖 → 取樣 RGB PNG → popup 物理值」可行且零後端成本。差異：canopy 是 PMTiles 切片（z6-12），要先 range-request 取對應 tile 再解 PNG 像素，比 climateField 的單張全球 PNG 麻煩。接線走 `useMapInteraction` `if (!found)` fallback 分支 |
| `urbanHeat` | 1（但有數值通道） | ✅ **R=熱島強度 ΔT（ΔT=R/5−30）、G=絕對地表溫度（°C=G/4+10）、A=遮罩**；解碼契約已成文（`src/data/urbanHeatTypes.ts` + 上游 `urban_heat_lst_encoding.json`） | **CANDIDATE** | **M-L**。與 canopyHeight 同一個工作包（同樣是 raster PMTiles 值探針）。**本群價值最高**——「這裡比周邊熱幾度」是這層存在的理由，色帶只給區間 |
| `dustForecast` | 1 | ❌ `useDustForecastLayer.ts:29` 明載「PNG **已預烤棕色色階** + alpha mask」 | **KEEP-NULL** | 上游只給已上色影像，無數值可讀 |
| `hillshade` | 1 + 3 | ❌ 單張預烤 colormap 灰階 PNG，無語意值 | **KEEP-NULL** | `HEADER_LABELS` 那條只是 BYOK chat bridge 的 layerType 白名單（`App.tsx:1869` 的 `layerType in HEADER_LABELS`），不構成接線需求。地形陰影本來就是視覺底圖 |
| `cwaCloudImagery` | 1 | ❌ CWA 真彩色衛星影像，plain `raster-opacity`，無數值通道 | **KEEP-NULL** | 上游 O-C0042-004 就是成品圖 |
| `cwaRadarImagery` | 1 | ❌ CWA 回波**合成圖**（已上色），無 dBZ 通道 | **KEEP-NULL** | 想要數值需上游改給 raw grid，屬跨 repo 資料契約議題，非前端接線 |
| `aqiImagery` | 1 | ❌ 環境部 airtw **色階圖**（內插成品） | **KEEP-NULL** | 數值需求已由 `aqiStation` / `microSensor` 兩個點層（皆有 panel）覆蓋 |
| `precipRaster` | 1 | ❌ 上游柵格影像 frames（object URL），plain `raster-opacity`，無 `raster-color` | **KEEP-NULL** | 數值需求由 `rainGauge`（有 panel）覆蓋 |
| `temperatureWave` | 1（Three.js mesh 無 raycast） | ✅ 與 `temperatureGrid` **共用同一份 RPC**（0.03° 網格逐時溫度場） | **EDGE** | 兩難：資料值得點，但**完全相同的資料已經可以透過 2D 雙生層 `temperature-grid-fill` 點到**（`TemperatureGridPanel`，走 feature-state 合併）。補 3D 波的 mesh raycast 是 M-L 成本換一個重複讀數。→ owner 決定「3D 模式開著時是否也必須能點」是不是必要體驗 |

### 2.4 房地產（6 筆）

| key | 成因 | 資料有無可顯示屬性 | verdict | 建議 |
|---|---|---|---|---|
| `realEstateRentalGrid` | **2（ledger 註解記載有誤）** | ✅ PMTiles `real_estate_grid`：`grid_id` / `city` / `type` / `period` / `n_tx` / `price_median` / `price_per_sqm_median` / `area_median` | **EDGE** | 已有 **hover tooltip**（`useMapInteraction.ts:610-613` 綁 `re-grid-*-fill` 的 mousemove）。兩難：桌機體驗完整，但 **hover 在觸控裝置不存在 → 手機使用者完全拿不到數字**。補 click→popup 是 S（layer id 已知、欄位已在 tile）。→ owner 決定行動裝置是否為目標情境。順帶：`city` / `area_median` 兩欄目前 tooltip 沒顯示 |
| `realEstateSaleGrid` | 2 | ✅ 同上 | **EDGE** | 同上（三張 Grid 是同一個決定） |
| `realEstatePresaleGrid` | 2 | ✅ 同上 | **EDGE** | 同上 |
| `realEstateRentalPoint` | **misfit：死 UI** | ⚠️ **部分**。已查證 buffer 實際格式（`RealEstatePointsScene.setBuffer`，`src/three/RealEstatePointsScene.ts:176-199`）：`real_estate_points_buffer.bin` 是 **interleaved Float32 `[lng, lat, tradeTsRel, price, packed] × N`（每點 5 個 float，純數值無字串）**。→ **有**：單價 `price`、交易日 `tradeTs`、型別＋是否台北（`packed` 位元打包）。**沒有**：`district` / `address` / `total_price` / `area_sqm` | **CANDIDATE** | tooltip 的 **render 分支已寫好**（`App.tsx:2965-2983` 的 `kind==="point"`），只是 picking 在改成 WebGL CustomLayer 時被拿掉（`useMapInteraction.ts:614` 註明「待補 GPU/空間索引 picking」）。⚠️ **但那個 render 分支要的 6 欄，現行 buffer 只剩 3 欄**（地址／行政區／總價／坪數在改二進位格式時掉了）→ 兩種收法：**(a) M** — 只補 picking，popup 顯示 buffer 內既有的「型別 · 單價 · 交易日」（repo 已有 4 個 CPU 端 pick 樣板：`ShipScene.pickShip` / `BusScene.pickBus` / `ReservoirScene.pickReservoir` / `WasteScheduleScene.pickRoute`）；**(b) L** — 要完整還原 render 分支，須改 buffer 格式或加 sidecar 索引（跨 `scripts/preprocess` 與前端）。建議先做 (a)。**逐筆實價登錄交易正是開這層的目的** |
| `realEstateSalePoint` | 同上 | ⚠️ 同上（三型別共用同一份 buffer 與同一個 layer，靠 `packed` 的 type 位元切分） | **CANDIDATE** | 同上，與上一筆同一次改動（一個 `pickPoint` 即覆蓋 3 層） |
| `realEstatePresalePoint` | 同上 | ⚠️ 同上 | **CANDIDATE** | 同上 |

### 2.5 人口社經（6 筆）

六層都由 `demographicsLayerFactory` / `h3LayerFactory` / `youbikeLayerFactory` 現算 H3 polygon 後手動 `addSource`/`addLayer`，`properties` 統一是 `{ color, value, height }`——**`value` 就是當前選定指標的原始值**。三個 factory 皆無任何 `mousemove` / `click` / `queryRenderedFeatures`。

| key | 成因 | 資料有無可顯示屬性 | verdict | 建議 |
|---|---|---|---|---|
| `popCount` | 1（實為未接線） | ✅ `properties.value` = 日間或夜間人口（`H3CellData.d` / `.n`） | **CANDIDATE** | **M**（六層共用一個工作包）。做法：GIS_LAYERS 各加一行指向共用的 `h3MetricCell` type + 一個 panel。⚠️ 難點：properties 不帶指標名稱，panel 需從對應 store 取當前 metric label——`funeralOperatorDensity` 的 feature-state 合併（`useMapInteraction.ts:533-539`）是最近的樣板 |
| `h3Population` | 1 | ✅ `value` = 日夜人口差推估移動量 | **CANDIDATE** | 同一包 |
| `indicators` | 1 | ✅ `value` = 選定指標值；上游 `DemographicH3CellData` 有 11 個指標（p/hh/m/f/sr/pph/dr/cd/ed/ai） | **CANDIDATE** | 同一包。指標多達 11 個、下拉切換 → 讀色帶猜值特別困難，**本群價值最高** |
| `socioeconomic` | 1 | ✅ `value` = 所得中位數(萬元) / 所得 IQR 比 / 薪資比 / 活力分數 / 脆弱度（`SocioeconomicH3CellData` im/iq/sr/vs/vl） | **CANDIDATE** | 同一包 |
| `spatialEconomy` | 1 | ✅ `value` = 產業家數／營業額類指標 | **CANDIDATE** | 同一包 |
| `youbikeFullness` | 1 | ✅ `properties.value`(有車率) **＋ `capacity`**（`youbikeLayerFactory.ts:74-79`，本群唯一多帶一欄的） | **CANDIDATE** | 同一包（欄位最完整，可當第一個接的樣板） |

### 2.6 水資源（10 筆，含 precipRaster 已於 §2.3 判定）

| key | 成因 | 資料有無可顯示屬性 | verdict | 建議 |
|---|---|---|---|---|
| `iotWraRiver` | **6（新增類）** | ✅ **properties 已逐欄烤好**（`useIotWraRiverLayer.ts:168-177`）：`name`(站名中文) / `measurement_name` / `si_unit` / `value` / `delta_m` / `observed_at` / `iow_station_id` | **CANDIDATE** | **S**。`HEADER_LABELS` 已有「IoT 河川水位站」、`PANEL_REGISTRY` 註解明載「自始沒有專屬 panel（popup 只顯示 header）」。缺的只有 GIS_LAYERS 一行（`iot-wra-river-circle`）+ 一個小 panel。**1,634 站，與既有 `riverLevel`(831 站) 僅重疊 266 對 → 1,265 站是全站唯一能點到它們的入口**。本次考證最高優先 |
| `iotWraStructure` | **6** | ✅ 同上（`useIotWraStructureLayer.ts:139-149`）再加 `county_name` / `station_type` / `delta_since_day_start` | **CANDIDATE** | **S**。與上一筆共用一個 panel（欄位形狀幾乎相同）。5 類水工結構（堰壩/閘門/抽水站…）不點開分不出是哪一類 |
| `groundwaterWells` | **6** | ✅ properties 已烤好（`useGroundwaterWellsLayer.ts:30-39`）：`well_name` / `agency_unit` / `county` / `township` / `water_level_m` / `delta_24h` / `observed_at` | **CANDIDATE** | **S**——**全表成本最低的一筆**。`GroundwaterPanel` 已存在、`groundwater` layerType 已存在，欄位契約完全相同 → GIS_LAYERS 加一行 `{ layers:["groundwater-wells-circle"], type:"groundwater" }`。⚠️ 現況：動態 `groundwater` 層關掉、只開 backdrop 時，畫面上 ~733 個灰點全部點不動，但資料就在 properties 裡 |
| `waterProtectionZones` | 1（面層未接） | ✅ GeoJSON 128 面：`name`(石岡壩) / `zone`(台中圈) / **`law_ref`**(公告文號) / `zone_kind` | **CANDIDATE** | **S**。`law_ref` 是別處拿不到的資訊；管制區的重點就是「這裡受什麼法規管」 |
| `waterRivers` | 1（面+線兩份切片皆未接） | ✅ `river_polygons`：`river_name` / `river_type`；`rivers`：+`river_code` | **CANDIDATE** | **S**。「這是哪條河」是這層最基本的問題；面層好點，先接面（`water-river-polygons-fill`） |
| `waterLevees` | 1（線層未接） | ✅ PMTiles `levees` 8 欄：`name` / `river` / `basin` / `county` / `levee_type` / `side` / `status` / `length_m` | **CANDIDATE** | **S-M**。欄位最豐富的水資源線層；`status`（待建）已進 paint 表達式，使用者看到虛線會想知道「待建到什麼程度」 |
| `waterBasins` | 1（線層未接） | ✅ GeoJSON 116 面：`basin_name`(興化店溪) / `basin_no` / `area_km2` | **CANDIDATE** | **S**。純輪廓線且無 symbol label → 目前無從得知身處哪個流域，而那正是這層的用途 |
| `waterCanals` | 1（線層未接） | ⚠️ PMTiles `canals` 欄位名為縮寫：`n`(name) / `o` / `t`(等級，已用於 paint) / `src` | **CANDIDATE** | **M**（成本高於同群僅因欄位是縮寫、需先向上游確認 `o`/`src` 語意再寫 panel 映射）。灌排渠道名稱 + 管理單位對農業使用者有價值 |
| `waterFloodExtreme` | 1（大面積 fill 未接） | ⚠️ 僅 `county` + `depth_class`（`depth_class` 正是色階已編碼的那個維度） | **EDGE** | 兩難：成本低（S），但唯一 payload 是圖例已標示的分級；且是覆蓋大面積的 fill，接了必須排在 GIS_LAYERS **最末端**否則會擋掉其上所有點層。對照組 `fireIsochrone` / `nonUrbanZoning` 這類大面積 fill 都有 popup（先例支持接），但那兩層的欄位比 2 欄豐富得多。→ owner 決定「精確確認這一格是哪一級」是否值得 |
| `precipRaster` | 1 | ❌ 見 §2.3 | **KEEP-NULL** | *（本列為跨節重複列示，統計只計一次；判定與理由見 §2.3）* |

### 2.7 廢棄物（4 筆）

| key | 成因 | 資料有無可顯示屬性 | verdict | 建議 |
|---|---|---|---|---|
| `wasteStopsStatic` | 1（點層未接） | ✅ GeoJSON **73,060 點**：`stop_name`(八堵路185巷95號) / `city` / `district` / `route_id` / `route_name` / `vehicle_type` / `routes_count` | **CANDIDATE** | **S**。同主題的 `wasteDisposalPoint`(wd*) 與 `wasteCleaningSquad` 都有 panel，唯獨密度最高、最貼近民生的清運點位不可點。「我家這個點屬哪條路線 / 有幾條路線經過」正是 `route_name` + `routes_count`。⚠️ 7.3 萬點需排在其他點層之後 |
| `wasteTruck` | **misfit** | ✅ `WasteTrailRow`：`vehicle_no`(車號) / `city` / `route_id`；另有 `status` 逐點狀態 | **CANDIDATE** | **M**。`wasteTruckCustomLayer.ts` 內 grep 不到任何 `pick` / `Raycaster` → **真車不可點、而同主題的表定模擬車 `wasteSchedule` 反而可點**（`WasteScheduleScene.pickRoute`），族群不一致。做法：比照 `WasteScheduleScene.pickRoute` 加 pick + 複用既有 waste tooltip 樣式 |
| `wasteSchedule` | 2 | ✅ `pickRoute` → `setWasteScheduleTooltipInfo`，tooltip 渲染於 `App.tsx:2988` | **KEEP-NULL** | 互動存在且已完整。不動 |
| `wasteScheduleNote` | 1 | ❌ 純裝飾：`WasteMusicNoteScene` 音符動畫，無承載資料 | **KEEP-NULL** | 標準的「裝飾性 Three.js 特效」。它是 `wasteSchedule` 的子項開關，語意上也不該獨立可點 |

### 2.8 農業（1 筆）

| key | 成因 | 資料有無可顯示屬性 | verdict | 建議 |
|---|---|---|---|---|
| `agriculture` | 1（大面積 fill 未接） | ✅ PMTiles `fields`：`area_ha`(田區面積) / `confidence_mean`(AI 偵測信心) / `field_id` / `source_tile` | **CANDIDATE** | **S**（優先度中低——欄位偏薄）。對照：同為逐筆面的 `aquaculturePonds`（逐口魚塭）有 panel。`area_ha` 對農業使用者有實值、`confidence_mean` 對資料判讀有價值（FTW 是模型產物，讓使用者看得到信心度是誠實揭露）。⚠️ 38.6 萬田區覆蓋全台 → **必須排在 GIS_LAYERS 最末端** |

### 2.9 能源 glow / 桿線（6 筆）

| key | 成因 | 資料有無可顯示屬性 | verdict | 建議 |
|---|---|---|---|---|
| `powerPlantGlow` | **5** | — 純視覺實驗，共用 `fetchFacPrimary` 資料 | **KEEP-NULL** | ✅ 已查證底層可點：`energy-fac-primary-circle` / `-halo` 在 GIS_LAYERS（type `powerPlant`）。且 `queryRenderedFeatures` 只查列舉的 layer，glow 疊在上面也不會擋點擊 |
| `substationEhvGlow` | **5** | — 共用 `fetchOsmSubstations` filter EHV | **KEEP-NULL** | ✅ 底層 `energy-substations-ehv-circle` / `-halo` 在 GIS_LAYERS（type `osmSubstation`） |
| `powerLinesGlow` | **5** | — 共用 `fetchOsmPowerLines` | **KEEP-NULL** | ✅ 底層 `energy-power-lines-core` / `-cable` 在 GIS_LAYERS（type `osmPowerLine`） |
| `aviationRestrictedGlow` | **5** | — 共用 `aviation_airspace.pmtiles` | **KEEP-NULL** | ✅ 已特別查證（名字在能源、資料在航空，容易誤判）：底層 `aviation-restricted-fill` / `-line` 在 GIS_LAYERS（`useMapInteraction.ts:486`，type `aviationRestricted`，且 `AviationAirspacePanel` 存在） |
| `windPlan` | 1 | ❌ **GeoJSON 26 面只有 `Id` + `POLY_AREA` 兩欄**，無場址名稱、無開發商、無容量 | **KEEP-NULL** | 全表唯一「資料裡真的沒東西可顯示」的一筆。對照組 `offshoreWindZone`(OSM 36 面) 有 panel，但那是另一份較豐富的資料源。若哪天上游補上場址名稱／裝置容量，本筆應立刻重新評估 |
| `powerPoles` | 1（刻意不接，manifest 明載） | ⚠️ PMTiles `power_poles`：`pole_id`(台電內部碼) / `pole_type`(已是圖例顏色維度) / `city` / `district` + cluster 欄位（`point_count`） | **EDGE** | 兩難：① 欄位薄——`pole_id` 使用者用不上、`pole_type` 圖例已表達、city/district 使用者已知 → 支持 KEEP-NULL；② 但**同族的 `osmPowerTower`（電塔）有 `OsmPowerTowerPanel`**，「電塔可點、電桿不可點」是真實不一致；③ 296 萬點已 cluster，點 cluster 顯示「此區 N 支電桿」倒是有意義的密度讀數。→ owner 拍板。（`queryRenderedFeatures` 只查已渲染 feature，效能不是阻力） |

### 2.10 orphan（5 筆，無 sidebar toggle）

| key | 成因 | 資料有無可顯示屬性 | verdict | 建議 |
|---|---|---|---|---|
| `powerStatusHud` | 1 | ✅ 有真實資料（`fetchPowerDashboard` 5 分鐘 poll）但**不是地圖圖層** | **KEEP-NULL** | top-left 供電燈號 KPI 卡片，地圖上沒有對應物件可點。資訊已直接顯示在卡片上 |
| `powerRegionDemand` | 1 | ✅ WebGL 3D 柱（北中南東 4 區）：`consumption_mw` / `reserve_indicator` | **KEEP-NULL** | 雖然是真的渲染在地圖上的物件，但無 sidebar toggle（ORPHAN_LEDGER 記載，KPI 性質已整合到 monitor 面板）→ 使用者無法開啟，也就無從點擊。⚠️ **若日後在 monitor 面板重新曝光，本筆應重新評估**（4 根柱、已有數值，屆時是 S） |
| `medICUBeds` | 1 | ❌ **完全沒有渲染實作**（僅 types 宣告 + 三張全量表） | **KEEP-NULL** | 沒有 hook、沒有 layer。popup:null 是定義上正確 |
| `wasteRoute` | 1 | ❌ 無任何 consumer（manifest 已註記 layerConsistency 舊註解與實況不符） | **KEEP-NULL** | 同上。真正在用的是 `wasteStopsStatic` |
| `wasteStop` | 1 | ❌ 無任何 consumer | **KEEP-NULL** | 同上。⚠️ 與 `wasteStopsStatic` 是雙生字，勿混 |

---

## 3. 統計交叉表

### 依 verdict × 主題

| 主題 | KEEP-NULL | CANDIDATE | EDGE | 小計 |
|---|---|---|---|---|
| 交通（scene picking） | 4 | 1 | 0 | 5 |
| 交通（線 / 站點） | 0 | 6 | 0 | 6 |
| raster | 5 | 2 | 1 | 8 |
| 房地產 | 0 | 3 | 3 | 6 |
| 人口社經 | 0 | 6 | 0 | 6 |
| 水資源 | 1 | 8 | 1 | 10 |
| 廢棄物 | 2 | 2 | 0 | 4 |
| 農業 | 0 | 1 | 0 | 1 |
| 能源 glow / 桿線 | 5 | 0 | 1 | 6 |
| orphan | 5 | 0 | 0 | 5 |
| **合計** | **22** | **29** | **6** | **57** |

### 依成因分類（逐列統計自 §2，合計 57）

| 成因 | 筆數 | KEEP-NULL | CANDIDATE | EDGE |
|---|---|---|---|---|
| 1 · 沒有可點物件 | 34 | 12 | 19 | 3 |
| 1+3 · 兼具（`hillshade`） | 1 | 1 | 0 | 0 |
| 2 · 走獨立 tooltip 狀態 | 8 | 5 | 0 | 3 |
| 3 · HEADER_LABELS 有但 GIS_LAYERS 沒接（`osmExpressway`） | 1 | 0 | 1 | 0 |
| 4 · 有 registry entry 但 layer id 不在 GIS_LAYERS（`stationsTHSR`） | 1 | 0 | 1 | 0 |
| 5 · glow 由底層代接 | 4 | 4 | 0 | 0 |
| **6 · properties 已烤好、只差 GIS_LAYERS 一行（本次新增）** | **3** | **0** | **3** | **0** |
| misfit · 不屬 1-6 任一類 | 5 | 0 | 5 | 0 |
| **合計** | **57** | **22** | **29** | **6** |

**成因 1 被嚴重過度使用**：34 筆掛在「沒有可點物件」下，逐筆查證後**只有 12 筆真的沒東西可點**；其餘 22 筆（19 CANDIDATE + 3 EDGE）都是「有資料、只是沒接線」。這是 ledger 註解與現況最大的落差，也是本次考證的主要產出。

**misfit 5 筆全數是 CANDIDATE**：`busIntercityLive`（會動但完全無 picking）· `wasteTruck`（真車不可點、模擬車可點）· `realEstate{Rental,Sale,Presale}Point`（tooltip render 已寫好、picking 被拿掉的死 UI）。「無法歸入既有成因」與「其實該補」高度相關——這在下次擴充 ledger 時值得當成訊號。

---

## 4. 「應不應該有 popup」與現況的落差在哪

原 ledger 的兩大類（Three.js scene picking / raster 純線純面背景層）在**成因**上是正確的，但當成**正當性**論證時有三處不成立：

1. 「純線 / 純面背景層 → 沒有承載屬性的 feature 可點」——**與資料不符**。查證的 11 個線／面層裡，10 個帶有名稱級屬性（僅 `windPlan` 例外）。這句話成立的只有 raster，不成立於 vector 線面。

2. 「raster → 沒有可點物件」——**對 7/9 成立、對 2 不成立**。`canopyHeight` / `urbanHeat` 是值編碼 raster，而且 repo 內已有讀值前例。

3. 「Three.js scene picking → 有 tooltip 不是點了沒反應」——**對 4/5 成立**。`busIntercityLive` 連 picking 都沒有，被歸入這句話的庇護是分類誤植。

---

## 5. 建議的工作包（29 筆 CANDIDATE 收斂成 9 包）

排序依「使用者價值 ÷ 成本」。

| # | 工作包 | 涵蓋 key | 成本 | 為什麼優先 |
|---|---|---|---|---|
| **1** | **水資源感測站三層接線** | `groundwaterWells` · `iotWraRiver` · `iotWraStructure` | **S** | properties 已烤好、`HEADER_LABELS` 已有條目、`GroundwaterPanel` 可直接複用一筆。3 行 GIS_LAYERS + 1 個共用 panel。`iotWraRiver` 有 1,265 站是全站唯一入口 |
| **2** | **水資源面 / 線四層接線** | `waterProtectionZones` · `waterRivers` · `waterBasins` · `waterLevees` | **S-M** | 皆有名稱級欄位（含 `law_ref` 這種別處拿不到的）；4 行 GIS_LAYERS + 1~2 個 panel |
| **3** | **道路線層共用 panel** | `osmExpressway` · `provincialRoads` · `highways` · `cyclingRoutes` | **S-M** | `osmExpressway` 可零成本複用 `OsmRoadDrivePanel`；其餘三層欄位形狀相近，一個 panel 吃掉 |
| **4** | **清運點位 + 高鐵站**（兩筆獨立小修） | `wasteStopsStatic` · `stationsTHSR` | **S** | 各 1 行 GIS_LAYERS；`stationsTHSR` 直接複用既有 `RailStationPanel`，補上全台唯一點不到的車站族 |
| **5** | **即時運具補齊 picking** | `busIntercityLive` · `wasteTruck` | **S ~ M** | 兩者都是「同族兄弟可點、它不可點」；intercity 有 `touristShuttleLive` 逐行樣板 |
| **6** | **房地產 Point picking 復活** | `realEstateRentalPoint` · `realEstateSalePoint` · `realEstatePresalePoint` | **M**（減欄版）／ **L**（完整版） | 只缺 WebGL 層的 pick，一個 `pickPoint` 覆蓋 3 層，repo 內有 4 個 pick* 樣板。⚠️ 現行 buffer 只有 `[lng, lat, tradeTs, price, packed]` 5 個 float，App.tsx 那段 render 分支要的地址／行政區／總價／坪數**不在裡面** → 先做「型別·單價·交易日」減欄版（M），完整版需改 buffer 格式或加 sidecar（L） |
| **7** | **H3 指標格共用 panel** | `popCount` · `h3Population` · `indicators` · `socioeconomic` · `spatialEconomy` · `youbikeFullness` | **M** | 一次覆蓋 6 層。難點在 panel 需取當前 metric label（`funeralOperatorDensity` 的 feature-state 合併是樣板） |
| **8** | **國道壅塞可點** | `freewayCongestion` | **M** | 需補 properties + 透明 hit 層（`road-congestion-hit` 是樣板）+ panel。速度數值價值高 |
| **9** | **raster 值探針** | `urbanHeat` · `canopyHeight`（＋日後其他值編碼 raster） | **M-L** | 沿用 `climateFieldSampler` 的 fallback 模式；額外工作是 PMTiles 切片 range-request + PNG 解碼。`urbanHeat` 單獨看價值最高 |
| （附）| **農業田區可點** | `agriculture` | **S** | 併進任一次改動即可，記得排 GIS_LAYERS 末端 |

**6 筆 EDGE 待 owner 拍板**：`realEstate{Rental,Sale,Presale}Grid`（hover 已有，是否補行動裝置的 click）· `temperatureWave`（2D 雙生層已可點，3D 是否也要）· `waterFloodExtreme`（payload 只有圖例已標的分級，是否值得一個大面積 fill 進 GIS_LAYERS）· `powerPoles`（欄位薄 vs. 與電塔的族群不一致）。

---

## 6. 給 ledger 本身的建議（非本次任務要求，供參考）

1. 新增成因分類 **6「properties 已烤好、只差 GIS_LAYERS 一行」**，並把 `iotWraRiver` / `iotWraStructure` / `groundwaterWells` 移過去——這三筆掛在「背景井位 / 點位」的註解下，會讓下一個人以為是設計決定。
2. 修正房地產 6 層的註解：Grid 是「已有 hover tooltip」、Point 是「picking 待補（WebGL 改版遺留）」，不是「數值直接以顏色表達」。
3. `busIntercityLive` 目前與 rail/flights/busLive 同行，共用「有 tooltip 不是點了沒反應」的註解——但它沒有 tooltip。建議獨立一行標註。
4. `windPlan` 值得在 ledger 上留一句「資料只有 Id + POLY_AREA」——那是唯一有資料層面正當理由的一筆，寫下來可以擋掉未來重複考證。

---

## 7. 查證所用的真值來源（供覆核）

- `src/data/layerManifest.ts` — 57 筆 entry 全數提取（無 NOT FOUND）
- `src/hooks/useMapInteraction.ts` — GIS_LAYERS 全陣列（L211-510）、Three.js pick 分支（L74-201）、climateField fallback（L547-565）、房地產 hover（L599-614）
- `src/components/featureInfo/registry.tsx` — PANEL_REGISTRY 全 key（L110+）、HEADER_LABELS（L351+）
- `src/map/overlayRegistry.ts` — 各 sourceId 的 paint / filter / sourceLayer
- PMTiles metadata `vector_layers.fields`（直接讀檔頭）：national_highway · provincial_road · osm_expressway · rivers · river_polygons · levees · canals · flood_extreme · real_estate_grid · power_poles · ftw_fields · canopy_height(PNG raster) · urban_heat(PNG raster)
- `public/geo/*.geojson` properties 實測：water_basins(116) · water_protection_zones(128) · cycling_routes(1,749) · wind_plan(26) · station_polygons(44) · station_points(503) · waste_stops_static(73,060)
- Loader 型別：h3Loader · iotWraRiverLoader · iotWraStructureLoader · groundwaterLoader · freewayLoader · wasteLoader · precipRasterLoader · urbanHeatTypes · climateFieldSampler
- Hook 烤 properties 處：useIotWraRiverLayer L168 · useIotWraStructureLayer L139 · useGroundwaterWellsLayer L30 · demographicsLayerFactory L98/L302 · h3LayerFactory L89 · youbikeLayerFactory L74
- `src/App.tsx` — tooltip render 分支（房地產 L2922-2985、wasteSchedule L2988）、chat bridge HEADER_LABELS 白名單（L1869）、useThreeJsLayers 場景 ref 解構（L749-760）
