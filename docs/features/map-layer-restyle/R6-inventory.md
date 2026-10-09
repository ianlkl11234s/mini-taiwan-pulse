# R6 盤點：Three.js／CustomLayer 圖層（2026-10-04）

> 唯讀盤點，基準 develop `cd83288`。交接：[`handoff-r6.md`](./handoff-r6.md)；規格 `map-layers.md` §3.4 G-1。
> 數量標「註解」者引自程式註解未實測。下方「細節」三節為各層檔案:行號原始紀錄。

## 總覽：依平面化工作量分四類

| 類 | 圖層 | 現況 | R6 工作性質 |
|---|---|---|---|
| **一、已有同資料平面版**（立體是疊加效果） | earthquakesGlobal 漣漪（~3.7k）、fireStations（677，已有 `fireStations3D` 開關）、lighthouses（36）、osmPowerLines bloom（~2,305 註解）、buildingsGba 夜景 bloom（≤4096）、powerPlantGlow（209）、substationEhvGlow（38）、stationPillar（5 key 共 828 根，已預設關 #393）、temperatureWave（~8k，已有 `tempExtruded`＋姊妹層 temperatureGrid）、地下水監測井（wfMonitoring） | 平面層已在，popup 多掛在平面層 | 統一成「立體效果」開關、預設關；幾乎不新做圖層 |
| **二、數值只畫在立體裡**（靜態／低頻） | powerGenerationUnit 機組出力柱（~23，timeStore）、waterReservoirs 水庫水位（~40，timeStore；平面只有蓄水範圍）、powerRegionDemand 區域用電柱（4；側欄無入口，疑孤兒）、wasteFacility 五類（焚化 30／掩埋 154／濱海 23／轉運 28／醫療 40，無平面、無圖例） | 缺平面版 | 新做 circle（大小或顏色帶數值）＋圖例 |
| **三、大量靜態點／線** | realEstate 買賣／租賃／預售（共 365,219 點，GPU 時間淡出）、historicalFlightTrails（台灣 56 萬點／898 班；日本版共用） | 無平面版；當初改 Three 就是為了效能 | 需 PMTiles 或抽樣，最貴 |
| **四、移動物件** | wasteTruck（≤500）、rail 列車（數百；軌道已有 2D）、flights（每日數百）、busLive／busIntercityLive／touristShuttleLive（≤5,000／層）、ships（1.2 萬＋拖尾）、wasteSchedule（≤2 萬）、gfwHourlyTracks（實測 82,492） | 皆無平面版；插值邏輯寫在 Scene 內 | 先把插值抽成純函式，再輸出給 Mapbox；上萬點需 LOD／節流 |

**範圍外但規格 13 層有列**：windField、oceanCurrents（裸 WebGL 粒子，不是 Three）。

## 跨層事實

- 規格說 13 層 unresolved，實際現在 15 層（多了 historicalFlightTrails、jpHistoricalFlightTrails）；inventory JSON 的 158 處多為欄位與圖例重複命中。
- 兩套載入機制：`lazyThreeLayers.ts`（11 模組，可見才下載）與 `threeLayerBundle`＋`useThreeJsLayers`（fireStation、temperatureWave、wasteSchedule、wasteFacility、stationPillar、lighthouse、flight／ship／rail／bus…）。
- 點選：移動物件多為 CPU 螢幕投影找最近點（24–25px），各自 tooltip 狀態；水庫用 raycast；一、二類多已靠平面層 popup。
- 共用 gl 限制：GlowPointsScene 只能同時 render 一個（nightBloom／plantGlow／ehvGlow 互斥）、osmPowerLinesGlow 單一 renderer；平面化可消除。
- **模式切換不需新 kind**：現成 `select`／`toggle` 即可（先例：`railTrackMode` 2D／3D、`hubDisplayModeSelect`、`fireStations3D`、`tempExtruded`）。新增 kind 才要動 6 接點；其中路徑修正：`src/state/layerParamsControls.ts`、`src/lib/memberSceneAdapter.ts`（handoff 寫錯目錄）。
- 圖例缺口（manifest legend 為 null）：busLive、busIntercityLive、wasteTruck、wasteSchedule、wasteFacility；B 組立體層的圖例另見細節 B（部分圖例掛在同資料平面層）。
- 待複核：busIntercityLive manifest 註解說無 picking，但 `useMapInteraction.ts:226` 有分支；powerRegionDemand 是否真無入口。
- `layerParamsSpec.ts` 含 `\0` 字元，搜尋要用 `rg -a`。

---

## 細節 A
### R6 盤點 A：移動物件／軌跡類（唯讀；worktree map-restyle-r6）

共通事實（先看這段）
- Flight／Ship／Rail 的 CustomLayer 工廠不在獨立檔，三個全在 `src/map/customLayer.ts`（createFlightLayer :41 id "flight-3d"；createShipLayer :170 "ship-3d"；createRailLayer :258 "rail-3d"）。由 `src/hooks/useThreeJsLayers.ts`（addFlightLayer :136、addShipLayer :160、addRailLayer :186）掛上，統一走 `threeBundle`（src/map/threeLayerBundle.ts）+ THREE_LAYERS_ANCHOR_ID 錨點（useThreeJsLayers.ts:498）。**這三個＋Bus／WasteTruck 不在 lazyThreeLayers.ts**（那份只含 GFW v4、歷史航跡、水庫、房地產等）；它們屬於 threeBundle 的「第一次開任一圖層後背景預載」（useThreeJsLayers.ts:133 installLayerChunkPrewarm）。
- 時間：`subscribeTimeRepaint`（customLayer.ts:14）= timeStore.subscribe → triggerRepaint；位置由 engine／hook 在 timeStore 訂閱內算（useBusLayer.ts:205、useRailEngine.ts:56）或 scene.update 每幀依 currentTime 插值。暫停＝0 重繪。
- 點選（Three 物件）：一律「CPU 螢幕投影最近點」（pickXxx，threshold 24~25px，用 lastMatrix 投影 instance 位置），**不是 raycast、也不是隱形 Mapbox layer**。入口集中在 `src/hooks/useMapInteraction.ts` 的 map click 分支（行號見各節）。平面化後若改 Mapbox circle，可改走 queryRenderedFeatures／gisClickRegistry。
- 全部 manifest 皆 `source.kind:"custom"`、`dataClass:"D"`、無 OVERLAY_REGISTRY entry（layerManifest.ts 註解 :773）。
- 目前**沒有任何一層有「立體/平面」mode 參數**；layerParamsSpec 唯一相近：rail 的 `railTrackMode` 2d/3d（只管軌道線，不管列車）。

---
## 1. flights ／ 航班（Flight）
1. key `flights`（layerManifest.ts:10133）；中文「航班」alt Flight；section 交通 Move／即時運具；色 #64aaff
2. Scene `src/three/FlightScene.ts`(427 行)；layer `src/map/customLayer.ts:41-165`；掛載 `useThreeJsLayers.ts:136-160`；loader `src/data/airspaceLoader.ts`（+ `flightTrails.ts` 解析，/embed 共用）；hook 內 ref flightsRef/renderModeRef/showTrailsRef。
3. 來源：Supabase RPC `get_flight_dates`（airspaceLoader.ts:33）、`get_flight_trails{target_date}`（:49），逐日整日軌跡。幾何＝移動物件（光球 orb＋BlinkingLight）＋動態光軌 LightTrail（300s 窗口、每 10s 一點約 30 點，FlightScene.ts:318）＋整條靜態 3D 軌跡 LineSegments（updateStaticTrails :102，依高度 0–13000m 上色 :135）＋glow mesh。有高度（Z）、有尾跡。
4. 走 timeStore（subscribeTimeRepaint）；每幀 `getTrailUpToTime`＋等距內插（:318），animDt 淡入淡出（:262）；非 lerp 是「沿軌跡時間內插」。靜態軌跡只在時間／資料／mode／參數變動才重建（customLayer.ts:60-125 sceneDirty）。
5. 無平面替代、無 mode 參數。有 `renderMode`（"3d"/其他，RenderMode 型別，customLayer.ts:34；是給靜態軌跡高度模式用，updateStaticTrails(flights, mode)），可能可借用，需確認語意。
6. 量級：每日約數百架（embed 快照 522KB/天，DATA_SCOPE.md:786；精確 flights 數未知，歷史樣本 898 去重航班屬另一層）。每機一組 mesh（visuals Map，LightTrail 512 pts）→ 非 instanced。
7. popup：`popup:null`；點中走 `setTooltipInfo`（flight tooltip，含高度計算，useMapInteraction.ts:276-297）。拾取 `pickFlight`（FlightScene.ts:252，螢幕投影 25px）。
8. 圖例：LegendPanel `flights`（LegendPanel.tsx:487 FlightsLegend；:876 另有 FireCatRows 航跡 Trail）。
9. params（layerParamsSpec.ts:3422-3440，全 slider、out:null=走 ref）：altExaggeration 高度倍率×3(1–5)、altOffset 高度+50m(0–200)、staticOpacity 透明度 0.1(0.02–0.5)、orbScale 光點。無顏色、無 opacity 主 slider 以外的樣式。
10. 否（在 threeBundle，不在 lazyThreeLayers.ts）；但有 render gate「首次可見先轉 loading 圈再同步建構（5–10s）」customLayer.ts:75-92。
11. 難點：(a) 首次建構同步阻塞 5–10s（每機 mesh）；(b) 高度＋高度倍率是核心語意，平面化＝丟掉 Z，需決定要不要以色階表高度；(c) 光軌是「尾巴漸隱」，Mapbox line 需 line-gradient（只支援 lineMetrics 單一 LineString）或分段 opacity，每幀 setData 成本高；(d) 動態點需每幀更新 GeoJSON source（或用 feature-state／circle layer + 自行 setData 節流）；(e) tooltip 走獨立狀態（非 featureInfo），要決定平面版是否改走 queryRenderedFeatures 後呼叫同一個 setTooltipInfo。

## 2. ships ／ 船舶（Ship，AIS 日軌跡）
1. key `ships`（layerManifest.ts:10183）；「船舶」alt Ship；色 #1ad9e5
2. Scene `src/three/ShipScene.ts`(352)；layer `customLayer.ts:170-250` id "ship-3d"；掛載 `useThreeJsLayers.ts:160-185`；hook `useShipData.ts`；loader `src/data/shipLoader.ts`＋`shipTrails.ts`（解析／GPS 異常過濾／ship_type 色票，three-free，LegendPanel 共用）。
3. 來源：RPC `get_ship_dates`（shipLoader.ts:22）、`get_ship_trails`（:38）；移動物件＋拖尾線。
4. timeStore 訂閱；每幀 `interpolatePosition(path,currentTime)`（ShipScene.ts:216）＋`getTrailUpToTime`（TRAIL_DURATION 1800s，:39,242）；`setViewBounds` 只畫視窗內船（customLayer.ts 傳 getMapBounds）。非 lerp，是沿時間軌跡插值。
5. 無平面替代、無 mode 參數。
6. 量級：maxInstances=12000（ShipScene.ts:51）、拖尾頂點上限 200,000（:40）；實測 12,305 列/天（DATA_SCOPE.md:788，4.78MiB gz）。
7. popup：`popup:"ship"` → pickShip 命中 `setFeatureInfo({layerType:"ship"})`（useMapInteraction.ts:253-270；ShipScene.pickShip :308 螢幕投影 24px，回 {ship,lat,lng,timestamp}）。
8. 圖例：LegendPanel `ships`（:486 ShipsLegend，依船種）。
9. params（layerParamsSpec.ts:3448）：shipOrbScale 光點、shipTrailOpacity 航跡 0.15(0.05–1)，皆 slider out:null。無整層 opacity、無顏色。
10. 否（threeBundle）；同樣有 loading gate（customLayer.ts:190-210）。
11. 難點：(a) 12k 移動點＋拖尾每幀重算，GeoJSON setData 每幀成本大（需節流／只更新視窗內／用 circle layer 配 setData 2~5Hz 並在幀間以 Mapbox 無法插值 → 需自己 lerp 才平滑，全域偏好「平滑＝資料 lerp」）；(b) 拖尾色隨進度漸隱（per-vertex color，:247-259）→ Mapbox line-gradient 限制；(c) 船種色票已在 shipTrails.ts 可直接用於 circle-color match 表達式（易）；(d) 視窗外剔除邏輯需搬到 GeoJSON 端；(e) 與 GFW 小時航跡、Vessel Watch 同為船舶資料，需確認模式切換 UI 一致。

## 3. rail ／ 鐵道（台鐵／高鐵／捷運）
1. key `rail`（layerManifest.ts:776）；「鐵道」alt Rail；色 #ee6c00；section 交通 Move／即時運具
2. Scene `src/three/RailScene.ts`(472)；layer `customLayer.ts:258-318` id "rail-3d"；掛載 `useThreeJsLayers.ts:186-208`；資料 `useRailData.ts`；位置 engine `useRailEngine.ts`（timeStore 訂閱）；靜態軌道 2D `src/map/railTracks.ts`（Mapbox line，SOURCE "rail-tracks"／LAYER "rail-tracks-line"）＋host `src/layers/hosts/gridHosts.tsx:67-85`（RailTracksHost）。
3. 來源：Supabase `reference.daily_schedules`（tra_daily 907 班＋thsr_daily 160 班，捷運四家 *_fixed；DATA_SCOPE.md:789）→ 時刻表推算車位。幾何＝列車移動點（instanced 光球）＋台鐵／高鐵拖尾（3 分鐘 TRAIL_DURATION=180，RailScene.ts:5-6，只 tra/thsr，`positionHistory` 累積歷史點）＋靜態軌道線。
4. 位置在 `useRailEngine.update`（timeStore.subscribe）算好，Scene 直接用 `train.position`（RailScene.ts:327-335，**無 lerp**）；拖尾靠 positionHistory 累積（:274-316）。
5. **已有部分平面版**：軌道 `railTrackMode` select 2d/3d（layerParamsSpec.ts:3461；2d = Mapbox line，customLayer.ts:303 3d 才畫 Three 軌道，opacity 0）。**列車本體沒有平面版**。
6. 量級：maxInstances=2500（RailScene.ts:18）、拖尾頂點上限 30,000（:7）；實際同時在跑列車約數百（TRA 907＋THSR 160 班皆為日表，同時在途遠少於此；精確數未知）。
7. popup：`popup:null`；pickTrain（RailScene.ts:415 螢幕投影 25px）→ `setTrainTooltipInfo`（useMapInteraction.ts:148-159，獨立 train tooltip）。
8. 圖例：LegendPanel `rail`（:489 RailLegend，吃 railSystems）。
9. params（layerParamsSpec.ts:3458，5 個）：railTrainVisible toggle 列車、railTrackMode select 2D/3D、railAltOffset slider 高度+110m(0–500)、railOrbScale slider 光點、railTrackOpacity slider 軌道透明度 0.35。
10. 否（threeBundle）。
11. 難點：(a) 列車位置每次 timeStore tick 更新（非 RAF，播放中每幀變）→ 平面點需 setData 或自行 lerp；(b) 已有 2D 軌道 → 平面化最小工作是「列車點」與「拖尾線」；拖尾是 client 端累積 positionHistory（Scene 內），要搬出到共用 util；(c) 系統色（train.color）已存在可直接用；(d) 方向：目前光球無朝向，無需 bearing（易）；(e) 要避免同時畫 3D 軌道與 2D 軌道（現已處理）。

## 4. busLive ／ 公車（市區）+ busIntercityLive ／ 公路客運 + touristShuttleLive ／ 台灣好行（共用 BusScene）
1. key `busLive`（layerManifest.ts:10205）「公車」alt Bus #4fc3f7；`busIntercityLive`（:10231）「公路客運」alt Intercity #ba68c8；`touristShuttleLive`（:10257）「台灣好行」#26a69a。
2. Scene `src/three/BusScene.ts`(351)；layer `src/map/busCustomLayer.ts`(70) createBusLayer；掛載 `useThreeJsLayers.ts:226-280`（三個 id："bus-3d"、"bus-intercity-3d"、"tourist-shuttle-3d"，各一個 BusScene，maxInstances 預設 5000）；hook `useBusLayer.ts`、`useBusIntercityLayer.ts`、touristShuttle 對應 hook；engine `src/engines/BusEngine.ts`（~700 行，docs/features/bus/README.md:22）；loader `src/data/busLoader.ts`、`touristShuttleLoader`。
3. 來源：RPC `get_bus_current{cities}`（busLoader.ts:114，30s 輪詢 useBusLayer.ts:21）、`get_bus_dates`/`get_bus_trails`（replay :158/:174）；intercity `get_bus_intercity_current/dates/trails`（:256/:287/:308）；好行 `get_tourist_shuttle_current`。另載各縣市靜態路線幾何 JSON（lazy per-city）。幾何＝純移動點（無 trail、無靜態路線，BusScene.ts:37 註解）。
4. 位置由 BusEngine 在 `timeStore.subscribe(update)`（useBusLayer.ts:184-205）以路線 progress 算；BusScene.update 對「有 route-snapped（progress>0）」直接到位，**對無路線車才 lerp**（BusScene.ts:212-236，指數平滑，SETTLE_EPS 收斂後停 repaint，busCustomLayer.ts:61-63）。
5. 無平面替代、無 mode。（另有「公車站牌」busStationsCity 等是獨立 Mapbox 圖層，非此組）。
6. 量級：maxInstances 5000／層；預設只載雙北（params 預設，layerParamsSpec.ts 註解 :3478）；八大區域可多選，全台市區公車即時車約數千～上萬（精確未知；docs/features/bus 未載數量）。
7. popup：三層皆 `popup:null`；pickBus（BusScene.ts:309 螢幕投影 25px）→ `setBusTooltipInfo`（useMapInteraction.ts:208-245，bus／intercity／shuttle 三個分支）。注意 manifest 註解說 busIntercityLive「連 picking 都沒有」(:10240)，但 useMapInteraction.ts:226 其實有 intercityScene.pickBus 分支 → **manifest 註解與程式不一致**（以程式為準，需複核）。
8. 圖例：busLive／busIntercityLive `legend:null`（無）；touristShuttleLive 有（LegendPanel.tsx:484 TouristShuttleLegend）。配色模式（busColorMode：速度／密度等）無圖例。
9. params：busLive 5 個（multiSelect 區域、select 配色、slider busAltOffset、busOrbScale、opacity busOpacity）；intercity 4（select 配色、altOffset、orbScale、opacity）；好行 4（select 配色、opacity 0.85、altOffset、orbScale）。layerParamsSpec.ts:3478-3520。
10. 否（threeBundle）。
11. 難點：(a) 最大量級點數（公車上萬）＋30s 輪詢＋progress 插值，每 tick 重 setData；(b) 配色模式（速度／密度 lerpStops 色帶，BusScene.ts:22-30,248-253）要翻成 Mapbox 表達式或預先把色寫進 feature property；(c) 「路線貼齊不 lerp、無路線 lerp」的混合平滑策略要在 GeoJSON 端重做；(d) 三層共用 BusScene、tooltip 三個分支；(e) manifest 註解與 picking 現況不符；(f) 與 busStations* 站牌圖層視覺重疊需區分。

## 5. wasteTruck ／ 垃圾車（含音符）
1. key `wasteTruck`（layerManifest.ts:8564）「垃圾車（含音符）」alt Truck；#fbbf24；section 廢棄物 Waste／即時。（相鄰 `wasteSchedule`「垃圾車（表定）」:8595 為另一層，Scene=WasteScheduleScene，不在本組盤點範圍但共用 params。）
2. Scene `src/three/WasteTruckScene.ts`(462)＋`WasteMusicNoteScene.ts`；layer `src/map/wasteTruckCustomLayer.ts`(96) createWasteTruckLayer id "waste-truck-3d"；掛載 `useThreeJsLayers.ts:282`；hook `src/hooks/useWasteLayer.ts`；loader `src/data/wasteLoader.ts`。
3. 來源：RPC `get_waste_trails{p_cities,p_since_minutes}`（wasteLoader.ts:353，live 近 60 分鐘、60s 輪詢 useWasteLayer.ts:23）、`get_waste_trails_day`（:373）、`get_waste_trails_matched_day`（:393，OSRM matched polyline）。預設城市 ["高雄市","臺南市"]（useWasteLayer.ts:42）。幾何＝移動點（光球）＋音符 billboard 裝飾（只對 collecting 車）；每車 ~30 點 GPS 軌跡（WasteTruckScene.ts:30），無畫尾巴線。
4. 每幀用 timeStore 時間在 trail 上插值（WasteTruckScene.ts:110 interpolateTrail：GPS 兩點線性、或 matched 沿 polyline progress `interpolateOnLineString`，:176-216）；live 時視覺時間落後 300s 以避免「未來空檔」（:21）；音符走實際時鐘 Date.now()（wasteTruckCustomLayer.ts:81 持續重繪，不受時間軸暫停影響）。
5. 無平面替代、無 mode。（waste 另有 `wasteMapboxLayers.ts` 但為站點／設施類，非車輛。）
6. 量級：maxInstances=500（WasteTruckScene.ts:245）；高雄＋台南實車約數百（精確未知）。
7. popup：`popup:"wasteTruck"`，pickTruck（WasteTruckScene.ts:429）→ `setFeatureInfo`（useMapInteraction.ts:178-200；座標用點擊位置）；面板 `components/featureInfo/wastePanels.tsx`。
8. 圖例：`legend:null`（無）。
9. params（layerParamsSpec.ts:3738 `[...wasteOrbSliders(), opacitySlider("wasteTruckOpacity",1)]`，wasteOrbSliders :866）共 4 slider：光點大小、音符大小、音符起始高度等＋整層透明度。
10. 否（threeBundle）。
11. 難點：(a) matched polyline 的 progress 插值需在 GeoJSON 端重做（或把 interpolateTrail 抽成 three-free util 後每 tick 輸出點）；(b) 「音符」純裝飾，平面化可直接略去或維持 3D（要拍板：主旨說「純裝飾效果要不要做平面版」）；(c) 視覺落後 300s 的 live 邏輯要保留；(d) 與 wasteSchedule 視覺統一（params 共用）要一起考慮；(e) 量級小（≤500），平滑 setData 成本低 → **最容易**的一層。

## 6. gfwHourlyTracks ／ GFW 小時近似航跡（GfwV4 Track）
1. key `gfwHourlyTracks`（layerManifest.ts:1691）「GFW 小時近似航跡」alt Hourly Tracks；section 全球海事 Global Maritime／船舶；#5eead4。（CustomLayer id 常數 "gfw-v4-tracks-custom"，lazyThreeLayers.ts:57。）
2. Scene `src/three/GfwV4TrackScene.ts`(298，另有 .test.ts)；layer `src/map/gfwV4TrackCustomLayer.ts`(89) createGfwV4TrackCustomLayer；hook `src/hooks/useGfwV4TracksLayer.ts`（含 Worker 協定 `data/gfwV4TrackFrameProtocol`、`gfwV4SpatialViewport`、`gfwV4SpatialTracksLoader`、`gfwV4ReleaseLoader`、`gfwV4TrackPicking`）；bench `src/gfw-v4-bench/`。
3. 來源：優先同域 `/global-maritime/gfw-hourly/v4/manifest.json`，schema-4 selected-day PMTiles（track_frame_pmtiles／tracks_day_pmtiles／track_detail_bucket）以 Range Worker 固定 z6 shard 載 H-1/H/H+1（useGfwV4TracksLayer.ts:14-30,308）；v2/v3 僅 fallback。staticAssets `./gfw_hourly_tracks_poc/manifest.json`。幾何＝船頭點（InstancedMesh heads）＋拖尾 LineSegments；位置是 GFW 格網近似，非精確 AIS。
4. 走 timeStore（evaluate(timeStore.getTime()) 於訂閱，useGfwV4TracksLayer.ts:148,198）；Worker 重算 typed frame（同小時同 shard 只送 render）；相鄰小時 crossfade（selectGfwV4CurrentNextSpatialFrames）；layer-local 淡出，不改全域 timeStore。**非 lerp，是 H／H+1 兩幀間插值＋alpha crossfade**。custom layer 只在 frame 或 view key（bounds/zoom/theme）改變時重建 buffer（gfwV4TrackCustomLayer.ts:57-72）。
5. 無平面替代、無 mode；hook 內還殘留 `GFW_V4_TRACK_HIT_SOURCE_ID/LAYER_ID` 的 Mapbox geojson hit source，但 `GFW_V4_TRACK_CLICK_LAYERS=[]`、hit layer 在 ensure 時被移除（useGfwV4TracksLayer.ts:19-22,157,364）→ 正式版刻意不讓 Mapbox circle 參與點選。**注意 GFW 其他三層（gfwHourlyGrid、gfwFishingEffort、gfwDarkVessels、gfwVesselPresence）本來就是 Mapbox 平面層**，與此層形成對照。
6. 量級：固定預算 maxHeads 120,000／maxTrailVertices 240,000（useGfwV4TracksLayer.ts:25；桌面 all-bucket v6 實測 82,492 heads）。**全專案最大量級**。
7. popup：`popup:"gfwHourlyTrack"`；點選走 `beginGfwV4TrackPick(map, point, 5px)`（useMapInteraction.ts:354-371）→ 在已套用的 GPU frame 找最近點（nearestGfwV4TrackPoint / registerGfwV4TrackPicker，hook :179），再 hydrate detail shard 補 popup；`setFeatureInfo({layerType:"gfwHourlyTrack"})`。
8. 圖例：LegendPanel `gfwHourlyTracks`（:497 GfwHourlyTracksLegend isDark）。
9. params（layerParamsSpec.ts:1709，8 個）：gfwHourlyTracksOpacity slider 0.75、gfwHourlyTracksWindow select 拖尾 30分／1／2／3 小時、六個船種 toggle（漁船、貨輪、客輪、運搬船、其他、未知）。
10. **是**：`gfwV4TrackLayerModule`（lazyThreeLayers.ts:57,77，標籤 "GFW 航跡 3D 工具"），在 LAZY_THREE_LAYER_LOADERS 預載清單；hook 用 mountLazy／ensure（useGfwV4TracksLayer.ts:161）。
11. 難點：(a) 12 萬點＋24 萬頂點，Mapbox circle/line 以 GeoJSON setData 不可行 → 平面版必須改走 **PMTiles 向量切片（原本就是 PMTiles，但為 frame 型）直接當 Mapbox source**＋filter by 小時，或把 Worker 的 typed frame 降採樣；(b) 拖尾要隨 H-1/H/H+1 與「拖尾窗口 30m–3h」select 變動，向量切片的時間篩選需 feature property（observed_times）＋ expression；(c) 點選目前刻意不用 Mapbox layer（避免 stale circle），平面化後點選邏輯需重議（可能退回 queryRenderedFeatures）；(d) globe 投影：Scene 已處理 projection（gfwV4TrackCustomLayer.ts:46 projection?.name）；(e) crossfade/淡出語意在 Mapbox paint opacity 需用 expression＋feature-state 或雙 layer。

## 7. historicalFlightTrails ／ 歷史航班軌跡（台灣；另含日本版 jpHistoricalFlightTrails，不在本組）
1. key `historicalFlightTrails`（layerManifest.ts:10154）「歷史航班軌跡」alt Taiwan；section 交通 Move／歷史軌跡；#4d99ff。（日本版 layerType "jpHistoricalFlightTrails"，同一 scene 以 country 區分，useMapInteraction.ts:135-141。）
2. Scene `src/three/HistoricalFlightTrailsScene.ts`(230)；layer `src/map/historicalFlightTrailsCustomLayer.ts`(56) createHistoricalFlightTrailsLayer（id `historical-flight-trails-{tw|jp}-3d`）；管理 `src/map/historicalFlightTrails.ts`（render/hide/remove/pick，WeakMap 快取）；hook `src/hooks/useHistoricalFlightTrailsLayer.ts`；型別 `src/data/historicalFlightTrailsTypes.ts`；文件 `docs/features/historical-flight-trails/`。
3. 來源：靜態 `./flight-trails/manifest.json`＋依機場／日期的 GeoJSON 資產（CDN/public 靜態）。幾何＝**線**（MultiLineString，單批 BufferGeometry+LineSegments+ShaderMaterial，依觀測高度 0–12000m 藍白漸層，取消粗線／halo／端帽，線條強度＝subpixel alpha；acceptance.md:44）。**無移動物件、無時間動態**。有高度（含 globe ECEF 球面連線）。
4. **不走 timeStore**，靜態圖層、無 repaint loop（customLayer 檔註解 :13「deliberately owns no repaint loop」）；資料／參數變動才 triggerRepaint。
5. 無平面替代、無 mode。
6. 量級：桃園 03/10 56 班／53,314 點；羽田 02/18 1,167 班／680,162 點；台灣全機場預設 2/20：16/17 機場、898 去重航班、561,190 點；日本全機場 78/78、3,708 航班（acceptance.md:17-19,56,61）。
7. popup：`popup:"historicalFlightTrails"`；pick＝scene.pick 對每個 segment 做螢幕投影點到線段距離（HistoricalFlightTrailsScene.ts:139，PICK_THRESHOLD_PX），回 feature → `setFeatureInfo({layerType:"historicalFlightTrails"})`（useMapInteraction.ts:131-146，經 `historicalFlightTrailsModule.get()?.pickHistoricalFlightTrail`）。
8. 圖例：`historicalFlightTrails`（LegendPanel.tsx:488 HistoricalFlightTrailsLegend，用 HISTORICAL_FLIGHT_COLORS）。
9. params（layerParamsSpec.ts:3441，5 個）：historicalFlightTrailsOpacity slider 0.28、historicalFlightTrailsAltitudeScale 高度倍率 3(1–10)、historicalFlightTrailsWidth 線條強度 0.75(0.25–1)、DirectionIdx select 方向（全部／離場／到場）、RouteScopeIdx select 航線範圍（全部／國內／跨境／未提供）。
10. **是**：`historicalFlightTrailsModule`（lazyThreeLayers.ts:58,78，"歷史航跡 3D 工具"）。
11. 難點：(a) 純靜態線，**最適合平面化**（GeoJSON line layer 即可）；但 56 萬～68 萬點的 GeoJSON 太大，需 PMTiles／簡化；(b) 高度藍白漸層→Mapbox `line-gradient` 不支援 MultiLineString 單 feature 依高度逐點上色，需預先切成多段 feature 並以 `altitude` property 色階，或 line-gradient＋lineMetrics（每條一 feature）；(c) 資料缺口「user-selected direct gap connection」語意（Scene.ts:58）要保留；(d) 高度倍率 slider 在平面模式無意義（需隱藏／禁用）；(e) popup 目前自行投影 pick，平面版可改 Mapbox click layers；(f) 台日兩國共用 scene，需同步處理 jp 版。

---
## 跨層彙整與建議（給規劃用）
- 移動點類（ships／flights／rail／bus×3／wasteTruck）共同需求：一個「three-free 的每 tick 位置計算」層（現在位置在 Scene.update 內算：Flight/Ship/WasteTruck 的插值在 Scene 內；Bus/Rail 在 Engine 內、Scene 只擺放）。平面化最大共用工作＝把 Flight/Ship/WasteTruck 的插值抽成純函式，再餵 Mapbox GeoJSON source（節流＋自行 lerp 以符「平滑＝資料 lerp」偏好）。
- 難度由易到難（我的判斷）：wasteTruck（≤500）＜ rail（已有 2D 軌道、列車數百）＜ historicalFlightTrails（靜態線，但體量大）＜ flights（高度＋光軌）＜ bus×3（上萬點＋配色模式）＜ ships（12k 點＋拖尾）＜ gfwHourlyTracks（12 萬點，需向量切片思路）。
- 點選：Three 物件全用螢幕投影最近點；平面版若為 Mapbox layer 可改 queryRenderedFeatures，但**需沿用各層既有的 tooltip 狀態**（flight tooltip／bus tooltip／train tooltip 與 featureInfo 不統一）。
- 圖例缺口：busLive、busIntercityLive、wasteTruck、wasteSchedule 無 legend。
- 文件不一致待複核：manifest.ts:10240 稱 busIntercityLive 無 picking，但 useMapInteraction.ts:226 有分支。

## 細節 B
### R6 盤點 B：能源／設施發光類（唯讀，worktree map-restyle-r6）

路徑縮寫：M=src/map、T=src/three、H=src/hooks、HOST=src/layers/hosts/energyHosts.tsx、MF=src/data/layerManifest.ts、PS=src/data/layerParamsSpec.ts、OR=src/map/overlayRegistry.ts、GC=src/map/gisClickRegistry.ts

## 總覽：GlowPointsScene 使用者（T/GlowPointsScene.ts，248 行）
通用「點 bloom」Scene（輸入 {lon,lat,colorHex,sizeNorm}，MAX 4096 點，Points + additive 3 段 halo，pulse 走 shader uTime）。
只有 3 個使用者（rg 確認）：M/buildingsNightBloomCustomLayer.ts:2、M/powerPlantGlowCustomLayer.ts:2、M/substationEhvGlowCustomLayer.ts:2。
types/index.ts:1427 只是註解提及。⚠️ 檔頭註解（buildingsNightBloom:13-15）：一個 gl context 只能掛一個「同時 render」的 GlowPointsScene，三層互斥靠「不同時可見」。

## 共通事實
- lazyThreeLayers.ts 延後載入（M/lazyThreeLayers.ts:53-78；背景預載清單 :81-86）：reservoir、nightBloom、powerRegionBars、substationEhvGlow、powerPlantGlow、osmPowerLinesGlow、powerGenerationBeam。mountLazyCustomLayer 以錨點（--lazy-anchor）佔位，關閉期間不下載。
- stationPillar、lighthouse **不在** lazyThreeLayers；走 M/threeLayerBundle.ts:11-12 + H/useThreeJsLayers.ts 的 loadThreeLayerBundle()（dynamic import 整包，任一 3D 圖層可見才載，anyThreeLayerVisible :55-65 含 lighthouses／stationsTHSR／TRA／Metro／airports／ports）。
- Host 掛載：layers/layerHookRegistry.tsx:125,191,211-216；HOST 檔 energyHosts.tsx、waterHosts.tsx:22-37。
- 全部 Three CustomLayer 都是 renderingMode "3d"（osmPowerLinesGlow 為 "2d"）。

---

## 1. buildingsNightBloom（夜景高樓 bloom）
1. key：**buildingsGba**（無獨立 key；hook 掛在 buildingsGba 上，layerHookRegistry.tsx:214）；中文名「建物輪廓」（MF:6070-6073）。Three layer id `buildings-night-bloom-3d`（M/buildingsNightBloomCustomLayer.ts:18）。
2. 檔案：M/buildingsNightBloomCustomLayer.ts（140 行）／T/GlowPointsScene.ts／H/useBuildingsNightBloomLayer.ts／HOST:236-246。無獨立 loader。
3. 資料：復用 buildingsGba 的 PMTiles `./urban/buildings_value_taiwan.pmtiles`（source-layer buildings，152 萬棟；MF:6083-6087）；render 時 `map.querySourceFeatures`（:78）取視野內 polygon，取質心→去重→h≥門檻→取最高前 4096 棟（:98-104）。幾何：多邊形 → 質心點。sizeNorm=(h-minH)/(300-minH)（:103）。
4. 時間：不走 timeStore；moveend／sourcedata 觸發 rebuild（:116-117）；shader pulse。
5. 平面替代：**有**。同 key 的 Mapbox fill 夜景燈光模式（overlayRegistry.ts:5098-5126，modeIdx=3 → buildingNightLightColorExpr）才是底；bloom 是疊加。Three 層只在 `buildingsGba 開 && modeIdx===3` 才可見（HOST:240-241）。5 模式：0 高度 1 來源 2 3D 3 夜景 4 估值。
6. 量級：≤4096 光點（視野內 h≥100m 預設）。
7. popup：Three 層無；點選走 buildingsGba 的 Mapbox 圖層（MF:6092 popup "buildingsGba"）。
8. 圖例：buildingsGba 有（MF:6091 legend "buildingsGba"），bloom 不另設。
9. params（PS:3113-3128）：select 顯示模式、slider 高度門檻、slider 透明度、slider Bloom 高樓門檻（showWhen modeIdx==3）。bloom 吃 opacity＋bloomMinHeight。
10. lazy：是（lazyThreeLayers.ts:72）。
11. 性質：**純裝飾**（數值意義 = 高度，但已被底下 fill 表達）。平面化難點：幾乎不需要——Mapbox 平面版＝夜景 fill（已存在）；若要「發光點」可用 circle layer（circle-blur 疊 2 層）餵 centroid，但需要 querySourceFeatures→GeoJSON source 每次 moveend 更新，4096 點可行。

## 2. osmPowerLinesGlow（高壓輸電線 bloom）
1. key：**osmPowerLines**「高壓輸電線」（MF:10915-10936）；Three layer id `osm-power-lines-three-glow`（M/osmPowerLinesGlowCustomLayer.ts:11）。另有獨立 key **powerLinesGlow**「高壓輸電線 Bloom 測試」（MF:10991）＝純 Mapbox 4-pass line-blur 版。
2. 檔案：M/osmPowerLinesGlowCustomLayer.ts（55）／T/OsmPowerLinesGlowScene.ts（296）／H/useOsmPowerLinesGlowLayer.ts／loader：data/energyLoader.ts `fetchOsmPowerLines`（:536 RPC get_osm_power_lines，owner-gated）／HOST:86-98。
3. 資料：Supabase RPC `get_osm_power_lines`（geom_json LineString + voltage → tier 345/161/69）；幾何：線（polyline）。
4. 時間：靜態，不走 timeStore（M customLayer :46 註「line layer 為靜態」）。
5. 平面替代：**有，且兩套**。(a) 同 key Mapbox core（實線）＋cable（虛線電纜）兩層，energy-power-lines source（OR:6283-6340；註解「Three.js fail 時仍可見」）；(b) powerLinesGlow 獨立 key 純 Mapbox。MF:11006 註明走純 Mapbox 是**硬限制**：App.tsx 已為 OsmPowerLinesGlowScene 掛一個 THREE.WebGLRenderer，同 gl context 再塞第二個會狀態互污。
6. 量級：≈2,305 條線（MF 註解／OR:6277 註解；未實測）。
7. popup：Mapbox core/cable 有（GC:117 energy-power-lines-core/cable → osmPowerLine）；Three glow 層無，但不影響（底下 Mapbox 層可點）。
8. 圖例：有（osmPowerLines，電壓分色）。
9. params（PS:2260-2263）：slider 寬度、slider 透明度（Three 與 Mapbox 共用兩支）。
10. lazy：是（lazyThreeLayers.ts:76）；hook 在 visible 才 fetchOsmPowerLines（:69-99）。
11. 性質：**純裝飾（bloom）**；資料表達（電壓分色）已在 Mapbox core 層。平面化難點：幾乎無——已有平面版；R6 只需決定 Three bloom 是否成為「模式」或以 powerLinesGlow 的 line-blur 取代；需注意「兩個 renderer 共用 gl」問題在 R6 若多個 Three 層同開時的 GL state 污染。

## 3. powerGenerationBeam（機組即時出力光柱）
1. key：**powerGenerationUnit**「機組即時出力」（MF:10782-10810）；Three layer id `power-generation-beam-3d`（M/powerGenerationBeamCustomLayer.ts:13）。
2. 檔案：M/powerGenerationBeamCustomLayer.ts（54）／T/PowerGenerationBeamScene.ts（236）／H/usePowerGenerationBeamLayer.ts（169）／loader：energyLoader `fetchPowerGeneration24h`、`resolvePowerGenerationAt`（RPC get_ssot_facility_output_24h，energyLoader.ts:157 附近）／HOST:208-220。
3. 資料：Supabase RPC（24h × ~23 廠，hook 註解 :51；SSOT RPC 238）；幾何：柱狀。**柱高 ∝ output_load_rate（0~1.5 clamp）**（Scene 檔頭）；色 = fuel_type（fuelColorOf）；柱底寬 ∝ sizeScale。
4. 時間：**走 timeStore**（H:162 `timeStore.subscribeThrottled(300, applyTime)`；client binary search；超出 24h 窗外柱歸 0）；另 10 min poll（:157）。
5. 平面替代：**無可見的平面版**。OR:6134-6153 只有 `energy-power-generation-hit-hit` 透明圓（opacity 0，純給點擊用）。相近的 facPrimary「發電廠 主要・運轉中」（MF:10660，209 廠，圓點大小依 capacity/has_realtime）是靜態容量，不含即時出力。
6. 量級：~23 根（MAX_BEAM_COUNT 256；hook 註解 14 台電＋6 離岸＋3 離島）。
7. popup：**有**，靠透明 hit circle（GC:114 → powerPlant）；hook 每次時間更新用 setData 同步 hit source（H:137-138）。
8. 圖例：legend "powerPlants"（燃料色，MF:10802-10805）。
9. params（PS:2175-2178）：slider 柱高、slider 透明度、slider 大小（3 slider）。
10. lazy：是（lazyThreeLayers.ts:77）。
11. 性質：**資料表達**（高=負載率，且隨時間變）。平面化難點：需要把「負載率/出力 MW」搬到 2D 視覺變數（圓半徑＝output_mw 或 capacity 環＋填滿比例；色＝燃料）；資料已經逐 ts 在 hit source 裡（有 output_mw、output_load_rate、radius、color），平面版可直接複用該 GeoJSON source 加 visible circle，成本低；難點是 23 點的重疊（核三/離岸風電群）與時間 scrub 動畫（目前 Three lerp 平滑，平面版要用 circle-radius-transition 或自行 lerp）。

## 4. powerPlantGlow（發電廠 Bloom 測試）
1. key：**powerPlantGlow**「發電廠 Bloom 測試」（MF:10812-10836，dataClass D，視覺實驗）；Three layer id `power-plant-glow-3d`（M/powerPlantGlowCustomLayer.ts:12）。
2. 檔案：M/powerPlantGlowCustomLayer.ts（64）／T/GlowPointsScene.ts／H/usePowerPlantGlowLayer.ts（87）／loader energyLoader `fetchFacPrimary`（RPC get_ssot_facilities_primary_operating，owner-gated，energyLoader.ts:269；60 min cache）／HOST:222-233。
3. 資料：與 facPrimary 同一份；幾何：點。sizeNorm=sqrt(total_capacity_mw/capMax)（:20）、色=fuelColorOf(fuel_type)。
4. 時間：不走 timeStore（靜態；pulse 走 shader uTime）。
5. 平面替代：**有（資料層面）**：facPrimary 同資料已有 Mapbox circle（useEnergyPoiLayer.ts:669-679 facPointsToGeoJSON；legacy powerPlants 另有 halo+circle，OR:6075-6128）。Bloom 只是視覺疊加。
6. 量級：209（energyLoader.ts:263 註解「L1 主要電廠（運轉中）209」）。
7. popup：Three 層本身無；facPrimary Mapbox 層有（popup "powerPlant"）。
8. 圖例：無（legend: null，MF:10829）。
9. params（PS:2941-2944）：slider 透明度、slider 大小。
10. lazy：是（:75）。
11. 性質：**純裝飾**（大小有容量意義但 facPrimary 已表達）。難點：幾乎無；與 substationEhvGlow、buildingsNightBloom 共用 GlowPointsScene，互斥靠不同時可見。可考慮 R6 把它當 facPrimary 的「發光」子模式（circle-blur 疊層）而非獨立圖層。

## 5. powerRegionBars（北中南東區域用電柱）
1. key：**powerRegionDemand**（MF:11929-11948；`section: null`、**無 layerName／中文名欄位**，不在 THEMES）；Three layer id `power-region-bars-3d`（M/powerRegionBarsCustomLayer.ts:11）。描述：「北中南東 4 區用電 3D bars」。
2. 檔案：M/powerRegionBarsCustomLayer.ts（48）／T/PowerRegionBarsScene.ts（201）／H/usePowerRegionBarsLayer.ts／loader energyLoader `fetchPowerDashboard`（RPC get_power_dashboard，:52）＋ H/usePowerDashboard.ts（App.tsx:1178 供 dashboardRef；HOST:196-207，opacity 硬寫 0.55）。
3. 資料：Supabase RPC get_power_dashboard；幾何：4 個固定質心上的柱（REGION_CENTROIDS）；柱高 ∝ consumption_mw（對 max 正規化），色 = reserve_indicator（全國單一燈號，4 柱同色）；25 km 邊長、22 km 滿載高。
4. 時間：**不走 timeStore**；5 min poll（usePowerDashboard.ts POLL_MS），只呈現最新值，不隨時間軸。
5. 平面替代：**無**。
6. 量級：4 根。
7. popup：無（MF:11945 popup null）。
8. 圖例：有（LegendPanel.tsx:626 powerRegionDemand → EnergyReserveLegend 備轉燈號 G/Y/O/R）。
9. params：無（`params: null`）。
10. lazy：是（:73）。
11. 性質：**資料表達**（柱高=用電量）。⚠️ 疑似 orphan：sidebar 無入口（section null；layerVisibility.powerRegionDemand 只被 Host/App 讀，rg 全 src 僅 types／hook registry／LegendPanel／Host 提及），可能只能經代理／程式開啟——**此點未驗證**。平面化難點：4 個質心點用 circle（半徑＝用電量）或 symbol+text 即可；但資料是「4 區聚合、無幾何」，平面版要決定畫在質心 circle 或區域面（缺行政區對應，未找到）；且屬 orphan，R6 可能直接建議不做／降級。

## 6. substationEhvGlow（超高壓變電所 EHV Bloom）
1. key：**substationEhvGlow**「變電所 EHV Bloom 測試」（MF:11015-11038，dataClass D）；Three layer id `substation-ehv-glow-3d`（M/substationEhvGlowCustomLayer.ts:15）。
2. 檔案：M/substationEhvGlowCustomLayer.ts（83）／T/GlowPointsScene.ts／H/useSubstationEhvGlowLayer.ts／loader energyLoader `fetchOsmSubstations`（RPC get_osm_substations，:498；client filter class=EHV/EHV_SWITCH）／HOST:248-258。
3. 資料：點；sizeNorm 由 voltage（100kV=0.3 … 350kV=1.0）、色 = SUBSTATION_CLASS_COLORS。
4. 時間：不走 timeStore。
5. 平面替代：**有**：osmSubstationsEhv「變電所 超高壓」（MF:10891；OR:6155-6270：halo circle blur + 菱形 SDF symbol，energy-substations-ehv source）。MF:11035 說明此 glow 「疊在 osmSubstationsEhv 上」。
6. 量級：38 座（M:18 註解；MF osmSubstationsEhv 描述 345kV 級）。
7. popup：Three 層無；osmSubstationsEhv 有（GC:115 → osmSubstation）。
8. 圖例：無（legend null）；osmSubstationsEhv 有自己的 legend。
9. params（PS:2945-2948）：slider 透明度、slider 大小。
10. lazy：是（:74）。
11. 性質：**純裝飾**。平面化難點：幾乎無，平面版已存在（halo circle-blur 即等價）；R6 可能只需「刪除／併入 osmSubstationsEhv 的 glow 模式」。

## 7. stationPillar（車站／機場／港口光柱，共用一個 Three layer）
1. key：**stationsTHSR**「高鐵站」(MF:9978)、**stationsTRA**「台鐵站」(:10003)、**stationsMetro**「捷運站」(:10031)、**airports**「機場」(:9833)、**ports**「港口」(:9810)；5 個 key 共用一個 Three layer `station-pillar-3d`（M/stationPillarCustomLayer.ts:38，內含 5 組 StationPillarScene 共用 1 renderer；組定義 H/useThreeJsLayers.ts:385-433）。
2. 檔案：M/stationPillarCustomLayer.ts（88）／T/StationPillarScene.ts（187）／H/useThreeJsLayers.ts（addStationPillarLayer）／App.tsx 載入資料 :322-327、:360-456（無獨立 hook/loader，直接在 App useEffect）。
3. 資料：靜態 `public/station_pillars.json`（thsr 12／tra 244／metro 279；欄位 id,lng,lat,height）、`./geo/airports.geojson`（質心，16 筆，高度硬編碼 AIRPORT_HEIGHTS 依起降量排序，App.tsx:405-431）、`./geo/port_polygons.geojson`（質心，277 筆，高度恆 1，:440-456）。幾何：點（質心）→ 柱。height 為正規化 0.4~1：THSR/TRA 為變動值（來源／公式**未核實**，疑為旅運量級）；**捷運 279 站全為 0.4（固定值）**；港口全 1；機場 12 筆有查表其餘 0.2。
4. 時間：不走 timeStore（靜態柱，不自 triggerRepaint；M:77）。
5. 平面替代：**有，且已是預設**。光柱預設關（PS:3542,3549,3560,3570,3581 default false，2026-09-28 使用者拍板 #393）；每個 key 本來就有 Mapbox 「顯示模式」select hubDisplayModeSelect（點位／實際範圍）：THSR/TRA 站體面＋面心＋點（MF:9989-9991, 10018-10021），捷運 station-points（無站體面，「實際範圍（光暈示意）」＝光暈，PS:3555）。機場 airport-boundaries／airport-centroids、港口 port-polygons／port-centroids。
6. 量級：THSR 12、TRA 244、捷運 279、機場 16、港口 277（共 ~828 柱）。
7. popup：柱本身**無**（光柱不可點）；點位走既有 Mapbox 層：railStation（GC:280-286、498）、airport（GC:267,269）、port（GC:266,268）。
8. 圖例：stations 三個 legend null；ports 有（legend "ports"）；airports legend null。
9. params（PS:3539-3583）：THSR/TRA/Metro：opacity slider、displayMode select、stationScale slider、光柱 toggle、光柱高度 slider；ports／airports 另有 scale、glow slider。metroPillarVisible 兩條通道（out "metroPillar3d"，PS:3557-3562）。
10. lazy：**否**（走 threeLayerBundle 整包動態載入）；station_pillars.json 在任一車站 toggle 開啟才 fetch（App.tsx:372-399）。
11. 性質：**偏裝飾**（捷運／港口固定高度；THSR／TRA／機場高度有相對量級含意但無圖例與單位）。難點：①平面等價物其實已存在（站點 Mapbox 圖層），R6 此項可能只需把「光柱」從獨立 Three 層改為站點圖層的「平面 glow 模式」或維持預設關；②若要保留高度語意需先確認 height 來源（待查 station_pillars.json 的產生腳本）；③5 個 key 共用一個 Three layer，改動要整包處理。

## 8. lighthouse（燈塔旋轉光束）
1. key：**lighthouses**「燈塔」（MF:9855-9877）；Three layer id `lighthouse-3d`（M/lighthouseCustomLayer.ts:20）。
2. 檔案：M/lighthouseCustomLayer.ts（53）／T/LighthouseScene.ts（136）／H/useThreeJsLayers.ts:208-221（addLighthouseLayer）／App.tsx:303-317 直接 fetch（無獨立 hook/loader）。
3. 資料：靜態 `./geo/lighthouse.geojson`（36 座，已核實）；幾何：點 → 旋轉半透明錐形光束（Three）。
4. 時間：不走 timeStore；光束旋轉走 `playing`（playingRef）＋ Date.now() 角度累加（Scene 檔頭 elapsedAngle），**每幀 triggerRepaint**（M:46，持續重繪）。
5. 平面替代：**有**。同 key Mapbox「雙圓 glow」`lighthouses-glow`＋`lighthouses-circle`（OR:1461-1500，參數 lighthouseScale）；Three 光束由 `beamVisible` toggle 控制（預設開）。
6. 量級：36。
7. popup：**有**（GC:112 lighthouses-circle/glow → lighthouse）；光束不可點。
8. 圖例：無（legend null）。
9. params（PS:3521-3537）：slider 大小（走 overlayParams）、toggle 光束、slider 光束距離、slider 光束透明度（後三者只吃 Three ref，out null）。
10. lazy：**否**（threeLayerBundle）。
11. 性質：**純裝飾**（光束距離/旋轉無資料意義）。難點：平面版已存在；「旋轉光束」的平面近似需要 line/fill 扇形（可用 circle 加 sector 多邊形 GeoJSON＋定時更新 bearing），動畫成本高、且持續 repaint；R6 實務上可能只需把 Beam toggle 視為「裝飾效果」保留並預設關。

## 9. reservoir（水庫 3D 水位計）
1. key：**waterReservoirs**「水庫」（MF:7930-7965，dataClass B；source 為陣列：PMTiles 蓄水範圍面＋GeoJSON 壩體點）；Three layer id `reservoir-3d`（M/reservoirCustomLayer.ts:30）。
2. 檔案：M/reservoirCustomLayer.ts（70）／T/ReservoirScene.ts（498）／H/useReservoirStatusLayer.ts／loaders data/reservoirStatusLoader.ts（RPC get_reservoir_status_day，:57）＋ data/reservoirOpsLoader.ts（RPC get_reservoir_timeseries，:65，點選後進/出流量雙柱）／waterHosts.tsx:22-37；useMapInteraction.ts:298-322（pickReservoir）。
3. 資料：Supabase RPC，當日＋前一日逐時序列，依 timeStore 時間取 t≤currentT 最近一筆；幾何：圓柱——外殼半徑 ∝ cube_root(有效容量)、高度固定 8 km；**內水柱高 = 外殼 × storage_ratio_pct**；色 = alert_level（紅/橘/青/綠，alertLevelFromPct）。點選後多畫進/出流量雙排日柱（log cms）。
4. 時間：**走 timeStore**（H:~ `subscribeDate` 跨日換資料、`subscribeThrottled(500)` redraw；hook 檔頭 :24-29）。
5. 平面替代：**部分**。同 key 已有 Mapbox 蓄水範圍面（water-reservoir-poly，PMTiles 5~13）＋壩體白色發光點（water-reservoir-dams，OR:3845-3900，半徑依 dam_height_m；111 點，主 repo public/geo/water_dams.geojson 核實）；但這兩者**不含蓄水率／警示等級**，即時水情只存在 3D。
6. 量級：水庫即時序列約 40 座（37 有即時，.claude/memory/DATA_SCOPE.md:12）；壩體點 111；面 pmtiles 筆數未查。
7. popup：**有兩條**：Three 水位計走 useMapInteraction 的 raycast `pickReservoir`（→ setFeatureInfo layerType "waterDam"，:300-318；非 gisClickRegistry）；Mapbox 壩體/面走 GC:393-394（waterDam／waterReservoirPoly）。
8. 圖例：無（legend null；LegendPanel 無 waterReservoirs 條目）。
9. params（PS:1993-1997）：slider 水位計高度（reservoirPillarHeight）、slider 透明度、slider 大小（3 slider；Host 只用 height 與 size，透明度 slider 目前吃 overlay 的 waterReservoirsOpacity）。
10. lazy：是（:65-68，ReservoirScene＋createReservoirLayer 一起載；hook 用 reservoirLayerModule.ensure）。⚠️ 掛載邏輯是自訂（attach／styleEpoch／200ms poll），沒走 mountLazyCustomLayer。
11. 性質：**資料表達**（蓄水率、警示、容量、進出流量都有數值意義，且隨時間變）。平面化難點：需新增一個即時資料驅動的平面層（圓點色＝alert_level、半徑∝容量、環／文字顯示蓄水率 %）；資料已在 statusesRef（H:redraw），可 setData 到 GeoJSON source；進/出流量雙柱（active reservoir）無自然 2D 對應（可改 popup 內小圖）；與既有壩體點、蓄水面疊放順序需處理；點選要把 raycast popup 改成 Mapbox layer 點選或保留雙路徑。

---
## 主要發現／難點彙整
1. 資料表達型只有 3 個：powerGenerationBeam（高=負載率，隨時間）、powerRegionBars（高=用電量，4 柱，疑 orphan）、reservoir（蓄水率＋警示，隨時間）。其餘 6 個多為裝飾；其中 5 個（nightBloom／powerLinesGlow／plantGlow／ehvGlow／lighthouse／stationPillar）同資料**已有平面版**。
2. 即時時間軸 3 個（beam／reservoir 走 timeStore；regionBars 只 poll 最新）；平面化要保留 timeStore 訂閱（CLAUDE.md §6）。
3. 唯一「沒有任何可見平面版」的資料型層：powerGenerationUnit（只有透明 hit circle）、powerRegionDemand、waterReservoirs 的即時水情。
4. GlowPointsScene 三層互斥的 GL state 限制、OsmPowerLinesGlow 的單 renderer 硬限制（MF:11006）是 Three 層共存的風險；平面化可消除。
5. 兩條 lazy 路徑並存：lazyThreeLayers（7 層）vs threeLayerBundle（lighthouse／stationPillar 等）；reservoir 掛載是第三種自訂邏輯。
6. 數字出處多為程式註解（2,305 線、209 廠、38 座、~23 廠）未逐一實測；已實測：lighthouse 36、airports 16、ports 277、station_pillars thsr12/tra244/metro279、water_dams 111（主 repo public/geo）。

## 細節 C
### R6 inventory-C（唯讀盤點；worktree map-restyle-r6，HEAD 6b295623）

路徑前綴皆相對 worktree 根。行號為盤點當時。

## Part 1 — 逐層

### 1. earthquakesGlobal 全球地震漣漪（earthquakes-global-ripple-3d）
- 檔案：src/map/earthquakeRippleCustomLayer.ts:1-80、src/three/QuakeRippleScene.ts（唯一使用者：earthquakeRippleCustomLayer、useEarthquakesGlobalLayer 型別）
- 掛載：src/hooks/useEarthquakesGlobalLayer.ts:314-321（mountLazyCustomLayer）；manifest key `earthquakesGlobal` src/data/layerManifest.ts:5658
- 資料：Supabase public.earthquakes_global（USGS）經 earthquakesGlobalLoader；Point；漣漪只取「新鮮事件」(FRESH_WINDOW 內) 的 lng/lat/mag/depth 色
- 時間：timeStore（subscribeDate 換日重抓；subscribeThrottled(500) 套 filter，hook:432）；currentTime 不在 deps。Scene 動畫走 performance.now()（週期 2400ms、每震央 2 圈）
- 平面替代：已有。同資料同 source 的兩個 Mapbox circle 層 LAYER_POST/LAYER_PRE（hook:140-170，popup 綁在 POST 層）。漣漪是「疊加裝飾」，主體資料已是平面
- 數量級：點層 densePointOpacity(3_679) → 約 3.7k（回溯 14 天預設）；漣漪同時存在的只有最近窗口內事件
- popup：POST 層（gisClickRegistry，ripple/pre 刻意不進 click）；legend：LegendPanel.tsx:422 EarthquakeGlobalLegend
- params kinds：select(回溯天數 earthquakesGlobalDays, out:null) + slider(opacity) — layerParamsSpec.ts:1639-1655
- lazy：是（lazyThreeLayers.ts earthquakeRippleModule，id 重複宣告 line 41）
- 資料表達 vs 裝飾：**純裝飾**（manifest 自述 ripple/pre 為裝飾層）
- 平面化難點：低。平面模式 ≈ 關掉 ripple（或換成 Mapbox circle 擴散環，但舊版正是因每幀 setPaintProperty 讓 map.loaded() 恆 false 才改 Three，見 QuakeRippleScene 檔頭）。不要走回逐幀 setPaint。

### 2. fireStations 消防分隊 3D（fire-station-3d）
- 檔案：src/map/fireStationCustomLayer.ts:1-75、src/three/FireStationScene.ts（僅此層使用）
- 掛載：src/hooks/useThreeJsLayers.ts:437-467（addFireStationLayer；getIsVisible = fireStations && paramRefs.fireStations3D）；進 threeLayerBundle.ts:16（非 lazyThreeLayers）
- 資料：./geo/fire_stations.geojson（onAdd 自行 fetch，與 overlay 共用快取）；Point；cat（大隊／分隊／分駐所／其他）決定柱高/半徑/色
- 時間：無（動畫 performance.now()；ANIMATE_WHILE_VISIBLE=true 可見時持續 triggerRepaint）
- 平面替代：**已有，同圖層 key**。overlayRegistry.ts:2001-2060 `fireStations` 的 glow+circle 兩個 Mapbox circle 層（minzoom 7、cat 分級半徑）；click 走 gisClickRegistry.ts:291
- 數量級：677 點
- popup：Mapbox circle 的 fireStation popup（3D 層自身不 pick）；legend：LegendPanel.tsx:521 FireStationLegend；
- params kinds：toggle(散點 fireStationsDots) + toggle(3D 光柱波動 fireStations3D, out:null) + slider(scale) + slider(opacity) + slider(Z) — layerParamsSpec.ts:3585-3591；manifest count 5（layerManifest.ts:1343）
- lazy：否（走 threeLayerBundle 動態 import，由 useThreeJsLayers 控管，anyThreeLayerVisible 判定 fireStations&&fireStations3D）
- 表達 vs 裝飾：**階級用柱高表達＋漣漪裝飾**；但同資料 cat 已由 circle 半徑/顏色表達
- 平面化難點：低——**已經有「3D 光柱波動」開關**（預設 true）。R6 只需要確認 3D=off 時平面點是完整表達（現況已是），可能只是把預設改為平面或改措辭。

### 3. realEstateSalePoint / RentalPoint / PresalePoint 房地產交易點（re-points-three，3 key 共用 1 個 layer）
- 檔案：src/map/realEstatePointsCustomLayer.ts:1-111、src/three/RealEstatePointsScene.ts（391 行；WasteMusicNoteScene 只出現在註解，非使用）
- manifest：layerManifest.ts:4377（Rental）/4428（Sale）/4479（Presale）；legend 皆共用 `realEstateRentalGrid`；popup:null（custom pick 另走 useMapInteraction.ts:326-329 getRealEstatePointsScene().pickPoint，CPU 逐點投影，click 全掃）
- 資料：./coverage/real_estate_points_buffer.bin（Float32，5 欄/點：tradeTs/type/isTaipei/color…）；Point
- 時間：timeStore 間接——useRealEstateTimeline RAF 寫 rePointsStore；shader uCursorTs 做 GPU fade（realtime / quarter / fadewindow 三模式）。非 deps 訂閱
- 平面替代：**目前沒有點的平面版**（舊 3 個 PMTiles circle 層已被此 CustomLayer 取代，註解 realEstatePointsCustomLayer.ts:7）；同資料的**網格**平面版有（realEstate*Grid，PMTiles fill）。S3 仍有 deploy-assets/coverage/real_estate_points.pmtiles（docs/features/real-estate/handoff.md:9）可回復
- 數量級：365,219 點（buffer ~7MB；handoff 寫 point 28MB PMTiles）
- renderingMode "2d"，gl_PointSize 圓點——**視覺本來就是平面點**，只是走 WebGL 而非 Mapbox
- params kinds：slider(realEstateOpacity，sharedGroup) + toggle(排除雙北，sharedGroup) — layerParamsSpec.ts:2670-2700；manifest count 2
- lazy：是（realEstatePointsModule，lazyThreeLayers.ts:63；hook useRealEstatePointsLayer.ts:3,52）
- 表達 vs 裝飾：**資料表達**（單價色、時間 fade）
- 平面化難點：**高**。Mapbox circle 要時間淡出得靠 data-driven opacity，365k 點每幀重算正是原本放棄 PMTiles 的原因（RealEstatePointsScene.ts:4-6）。建議平面=維持現狀（本來就平面點）或僅在 playback 停止時退回 PMTiles circle + setFilter 分季。需先決定「Mapbox 平面」是否強制。另：三 key 共用一個 layer，模式 param 必須是 sharedGroup 式（跟 realEstateOpacity 同法）。

### 4. temperatureWave 溫度波（temperature-wave-3d）
- 檔案：src/map/temperatureWaveCustomLayer.ts:1-64、src/three/TemperatureWaveScene.ts（僅此層）
- 掛載：useThreeJsLayers.ts:373-376（getExtruded = paramRefs.tempExtruded）；threeLayerBundle.ts:15；manifest layerManifest.ts:6989
- 資料：Supabase RPC get_temperature_grid_info / get_temperature_frames，CWA 0.03° 網格逐時溫度；Mesh（格點）
- 時間：getCurrentTime → timeRef（App.tsx:582,628 以 timeStore.subscribe 60Hz 更新）；每幀 triggerRepaint；兩相鄰 frame lerp 頂點高度
- 平面替代：**已有且同資料**：`temperatureGrid`（src/map/temperatureGridLayerFactory.ts，Mapbox fill、11 級 step、setFeatureState 逐格上色；layerManifest.ts:7012）。另外 Scene 自身已有 extruded=false「平面色圖」模式（TemperatureWaveScene.ts:54,211）但仍是 Three mesh
- 數量級：陸地 cell 約 8k 級（factory 註解「8k polygon」）
- popup：temperatureWave 無（popup:null）；temperatureGrid 有 popup
- legend：LegendPanel.tsx:470 TemperatureWaveLegend（temperatureGrid 另 :469）
- params kinds：toggle(3D tempExtruded) / slider(高度) / slider(離地) / slider(透明度) / toggle(網格線) — layerParamsSpec.ts:3592-3606；manifest count 5
- lazy：否（threeLayerBundle）
- 表達 vs 裝飾：資料表達（高度+色=溫度）
- 平面化難點：低-中。已有 `tempExtruded` 3D 開關＋姊妹圖層 temperatureGrid。R6 要決定：平面模式=把 Three 平面色圖換成 Mapbox fill（重用 temperatureGridLayerFactory）還是直接導向 temperatureGrid（重複圖層）。注意 inventory 把 temperatureWave 標 unresolved 的原因是「無 LAYER_HOOK_REGISTRY entry」，非 CustomLayer 原因。

### 5. wasteFacility 垃圾處理設施 wfIncinerator/Landfill/LandfillCoastal/Transfer/Medical/Monitoring（waste-facility-3d，1 layer 包 6 sub-scene）
- 檔案：src/map/wasteFacilityCustomLayer.ts:1-194；**src/three/WasteFacilityScenes.ts**（6 個 Scene class，不符 `*Scene.ts` 命名，39 檔清單漏它）
- 掛載：useThreeJsLayers.ts addWasteFacilityLayer；資料 App.tsx:654 useWasteFacilityLayer 一次抓全量 4,609 筆 → byType Map；manifest layerManifest.ts:8797(Incinerator)/8820/8843/8866/8889/8915
- 資料：Supabase RPC，facility_type 分群；Point
- 時間：無（靜態；動畫為裝飾，ANIMATE_WHILE_VISIBLE=true，任一子層可見時持續 triggerRepaint）
- 平面替代：**部分已有**：同資料 wasteMapboxLayers.ts 已有 wfRecycling／地下水監測井（wfMonitoring）／wfScrapYard／wfOther 的 Mapbox circle（量級大而刻意走原生，檔頭 :1-14）。其中 **wfMonitoring 兩套並存**（Three WasteMonitoringWellScene + Mapbox circle，manifest 8928）。其餘 5 個（焚化爐/掩埋場/濱海掩埋/轉運站/醫療）**沒有平面版**
- 數量級：焚化 30、掩埋 154、濱海 23、轉運 28、醫療 40、監測井 574（Scene 容量 800）
- popup：popup:"wasteFacility"（manifest）；Three 走 pickFacility → facilityRowToFeatureInfo（wasteFacilityCustomLayer.ts:152-194，由 map click raycast），Mapbox circle 走 wasteMapboxLayers 自己的 click
- legend：null（無圖例！四鐵則缺口）
- params kinds：每子層 slider×3（大小/透明度/高度，wasteSubSliders layerParamsSpec.ts:887；焚化爐多 slider 底圈）；manifest kinds 全 slider
- lazy：否（threeLayerBundle:13）
- 表達 vs 裝飾：**類型用形狀/顏色表達＋煙囪/閃電等裝飾**；位置才是資料
- 平面化難點：中。(a) 一個 layer 6 個 sub-key，模式 param 要六個各自一份或做 sharedGroup；(b) 平面版需新增 5 個 geojson source（資料在記憶體 byType，可用既有 syncWasteMapboxData 路線 wasteMapboxLayers.ts 擴 key）；(c) 無 legend，平面化同時要補圖例；(d) 地下水監測井（wfMonitoring） 已雙軌，需先定義互斥以免重複畫。重用 wasteMapboxLayers 的 WasteMapboxLayerKey 是最小路徑。

### 6. wasteSchedule 垃圾車（表定）＋ wasteScheduleNote 表定音符（waste-schedule-3d）
- 檔案：src/map/wasteScheduleCustomLayer.ts:1-94（同一 layer 包 2 scene）、src/three/WasteScheduleScene.ts（516 行，InstancedMesh 光球，上限 20000）、src/three/WasteMusicNoteScene.ts（357 行 GPU billboard 音符）
- WasteMusicNoteScene 使用者：wasteScheduleCustomLayer、wasteTruckCustomLayer（GPS 版，不在本組）；RealEstatePointsScene 只在註解
- 掛載：useThreeJsLayers.ts:309-323；資料 src/hooks/useWasteScheduleLayer.ts（RPC get_waste_schedule_day，依星期幾；timeStore.subscribeDate 取 dow:100-106）；manifest layerManifest.ts:8594(wasteSchedule)、8624(wasteScheduleNote)
- 資料：表定 stops 序列（arrival/departure）→ 直線插值推車輛位置；原始為點（stops）+ 路線，**輸出是會移動的點**。規模：新北 23k stops/612 routes、高雄 8.9k/360、台北 4k/187…（wasteScheduleLoader.ts 檔頭）；實際渲染上限 20000 車
- 時間：timeStore（subscribeTimeRepaint(customLayer.ts:15-19) 驅動重繪，暫停 0 repaint；getCurrentTime=timeRef）。音符動畫走 Date.now()
- 平面替代：**沒有同一資料的 Mapbox 平面層**。最近的是 wasteStopsStatic（全台清運點位靜態快照，Mapbox circle，layerManifest 8670，overlayRegistry.ts:3959）——是「站點」不是「移動車輛」。wasteRoute/wasteStop 兩 key 無 consumer（manifest 12002/12024）
- popup：manifest popup:null；用 hover/click tooltip：useMapInteraction.ts:162-173 ws.pickRoute → setWasteScheduleTooltipInfo（debug 級）
- legend：null（兩者皆無）
- params kinds：toggle×8（八區分組 busGroupToggles）+ slider×4（wasteOrbSliders 3 + opacity）；note 的 manifest params:null（音符大小/高度在 wasteOrb 內）— layerParamsSpec.ts:3739-3746
- lazy：否（threeLayerBundle:11）
- 表達 vs 裝飾：光球=資料（移動車輛位置）；**音符=純裝飾**（wasteScheduleNote 本身只是子開關）
- 平面化難點：**高**。移動點需逐幀 setData 或 feature-state，違反 CLAUDE.md 對 8k+ 動態點的效能經驗（同 temperatureGrid 註解「每幀重建會卡死」）。可行路徑：Mapbox circle + 每 N 秒 setData（降頻）或 GeoJSON 路線線層（線＝路線，點＝當前位置每秒更新）。音符平面化=關掉。注意 wasteSchedule 同 layer 內音符 scene 共 opacity。

### Part1 備註
- WasteMusicNoteScene、QuakeRippleScene、FireStationScene、TemperatureWaveScene 各只有單一消費層；WasteFacilityScenes 才是 wasteFacility 的真實 Scene 檔。

## Part 2

### 2a lazyThreeLayers.ts（138 行）
- 機制：`lazyModule(key,label,importer)` 回 {get(同步,未載入null), load(背景預載), ensure(掛 loading UI)}；`mountLazyCustomLayer` 先在原位置放「空 render 的 custom layer 錨點」(`<id>--lazy-anchor`)，模組已載→真圖層插錨點前；未載且可見→ensure 完才加；不可見不下載。`removeLazyCustomLayer` 清真層+錨點。
- 管理 11 個模組：reservoir（waterReservoirs）、realEstatePoints、gfwV4Track、historicalFlightTrails（含 jp）、buildingsNightBloom（key buildingsGba）、powerRegionBars（powerRegionDemand）、substationEhvGlow、powerPlantGlow、osmPowerLinesGlow（osmPowerLines）、powerGenerationBeam（powerGenerationUnit）、earthquakeRipple（earthquakesGlobal）。LAZY_THREE_LAYER_LOADERS 供 prewarmLayerChunks。
- 開關：由各自 hook 的 effect 依 visible 呼叫 mountLazy／removeLazy（deps 含 anyShown／visible），並重掛於 style.load。layer id 常數**刻意重複宣告**（9 個），由 __tests__/lazyThreeLayers.test.ts 對照。**不在其中**：fireStation、temperatureWave、wasteSchedule、wasteFacility（走 threeLayerBundle + useThreeJsLayers 的 anchor 'three-layers-anchor' + anyThreeLayerVisible）。
- 所以有兩套延後載入：lazyThreeLayers（每層獨立）與 threeLayerBundle（一包：flights/ships/rail/bus/waste*/lighthouse/stationPillar/temperatureWave/fireStation）。

### 2b type:'custom' 全清單（rg `type: "custom"`，排除 test、layerManifest 的 source.kind）
共 25 處 addLayer 級 custom（含 3 處在 customLayer.ts）。
主站 *CustomLayer.ts（19，皆上線）：buildingsNightBloom、bus、earthquakeRipple、fireStation、gfwV4Track、historicalFlightTrails、lighthouse、osmPowerLinesGlow、powerGenerationBeam、powerPlantGlow、powerRegionBars、realEstatePoints、reservoir、stationPillar、substationEhvGlow、temperatureWave、wasteFacility、wasteSchedule、wasteTruck。
**39 檔之外的漏網（皆在 src/）：**
1. src/map/customLayer.ts:65/188/274 — createFlightLayer／createShipLayer／createRailLayer（FlightScene／ShipScene／RailScene），上線，threeLayerBundle:8；此檔無 *CustomLayer 命名
2. src/map/climateParticleLineLayer.ts:649 — WebGL 粒子線（windField `climate-windfield`、oceanCurrents `climate-ocean-currents`），**不是 Three，是裸 WebGL**；上線；inventory 的 13 層裡有這兩個
3. src/map/historicalFlightTrails.ts（無 CustomLayer 後綴的 lazy 入口，lazyThreeLayers.ts:64 import，轉出 historicalFlightTrailsCustomLayer）
4. src/three/WasteFacilityScenes.ts（6 個 Scene，wasteFacility 的核心）；輔助：BlinkingLight.ts、LightOrb.ts、LightTrail.ts、wasteScheduleConstants.ts、shaders/
5. src/embed/threeReplayLayer.ts:52 — MapLibre 版（embed.html 嵌入站，**不載入 mapbox-gl**；vite.config.ts:1264-1275 為獨立入口），與主站 Mapbox 模式切換無關
6. 錨點（空 render，非圖層）：lazyThreeLayers.ts:110 `--lazy-anchor`、useThreeJsLayers.ts:498 `three-layers-anchor`
7. src/spike/threeMaplibreSpike.ts:188 — 實驗，**未被任何主站程式 import**（只出現在 threeReplayLayer 註解），不上線
8. src/gfw-v4-bench/*：自有 App.tsx／phase2Main.tsx，**不在 vite 入口清單**（main/lab/embed/card/design-system…）；主站只 import 其 types.ts（gfwV4TrackCustomLayer／GfwV4TrackScene 型別）。bench 內 scene.ts 是自己的 three 使用，不上線。
另：Mapbox 內建 fill-extrusion（buildingsGba、jpBuildingHeight、propertyValueGrid）不是 custom。gfwV4Track 的 host 在 src/layers/hosts/globalMaritimeHosts.tsx:5。

### 2c layer-style-inventory.json
- 結構：{meta, summary, stats, legends[551], layers{814 key}}。每個 layers[key] 有 label/theme/dataClass/legend/popup/params/**resolution**/evidence/sublayers。resolution 共 4 值（目前）：shared-renderer 320、runtime 294、static-scan 173、unresolved **27**。
- 為何 grep 'unresolved' 有 158 處：summary.byResolution/unresolvedReasons、meta.notes、stats 內大量 `resolution`/`unresolvedReason` 欄位與 legend 的 `resolution` 欄位（legends 551 筆也帶 resolution）、以及 layers 內 hooks/ironRules 字串，不是 158 層。真正層級的 unresolved = `layers[*].resolution == "unresolved"` = **27 層**，且 summary.unresolvedReasons 分三類：「Three.js／WebGL CustomLayer」**15**、「有渲染檔但無 paint 字面值」5、「無 hook／factory」7。map-layers.md §2.5 寫的「13」是 2026-09-28 舊快照（當時 30 unresolved：CustomLayer 13）；現在多了 historicalFlightTrails／jpHistoricalFlightTrails 兩層 → 15。
- 這 15 層（reason「Three.js／WebGL CustomLayer，數值在 shader／材質」）與檔案指標（evidence/hooks 欄）：
  - realEstateSalePoint／RentalPoint／PresalePoint → src/map/lazyThreeLayers.ts
  - wfIncinerator／wfLandfill／wfLandfillCoastal／wfTransfer／wfMedical → src/map/wasteFacilityCustomLayer.ts
  - powerPlantGlow、substationEhvGlow、powerRegionDemand → src/map/lazyThreeLayers.ts
  - windField、oceanCurrents → src/map/climateParticleLineLayer.ts
  - historicalFlightTrails、jpHistoricalFlightTrails → src/map/lazyThreeLayers.ts（新增的 2 層）
  （前 13 個 = spec 所稱的 13 層；後 2 個是 historicalFlight）
- 其餘 12 個 unresolved：busLive／busIntercityLive（useBusLayer.ts／useBusIntercityLayer.ts）、touristShuttleLive（useTouristShuttleLayer.ts）、wasteTruck（useWasteLayer.ts）、wasteSchedule（useWasteScheduleLayer.ts）— 這 5 個原因是「找不到 paint 字面值」，**實為 CustomLayer**；ships、temperatureWave、wasteRoute、wasteStop、wasteScheduleNote、medICUBeds、powerStatusHud — 「無 LAYER_HOOK_REGISTRY entry」。
- 對照 39 檔（19+20）+漏網，**不在 15 層（也不在 27 層）**的 Three／Custom 檔：
  - earthquakeRipple／QuakeRippleScene → 掛在 earthquakesGlobal（static-scan，有 circle 子層）
  - fireStation／FireStationScene → fireStations（runtime，有 glow+circle）
  - lighthouse／LighthouseScene → lighthouses（runtime）
  - reservoir／ReservoirScene → waterReservoirs（runtime）
  - osmPowerLinesGlow → osmPowerLines（runtime）
  - powerGenerationBeam → powerGenerationUnit（runtime，只有 hit 子層）
  - buildingsNightBloom → buildingsGba（key 無獨立列）
  - gfwV4Track／GfwV4TrackScene → gfw* keys（static-scan）
  - stationPillar／StationPillarScene → stationsTHSR／TRA／Metro／airports／ports（runtime）
  - flights／rail → static-scan（staticTrails.ts／railTracks.ts）；bus／wasteTruck／wasteSchedule／ships → unresolved 但不在「13」
  - temperatureWave → unresolved（非 CustomLayer 原因）
  - GlowPointsScene（powerPlantGlow／substationEhvGlow 共用）→ 已在 13 裡
  - 因此「13 層」只涵蓋「獨立 key、且 Three 是**唯一**渲染」的層；多數 Three 層是**疊在既有 Mapbox 層上的第二渲染**（所以 inventory 已有平面子層數值）。
- 無獨立 key 的檔：BlinkingLight／LightOrb／LightTrail／shaders（helper）。

### 2d 模式切換先例與 6 個接點
- 先例（**現成 select／toggle，不需新 kind**）：
  - hubDisplayModeSelect（layerParamsSpec.ts:828-850）：select，label「顯示」，options 來自 TRANSPORT_HUB_DISPLAY_MODES（polygon／point），`out: <name>Idx` + `encode`（索引編碼進 overlayParams 數值），支援 polygonUnavailable（disabled 選項）與 polygonLabel（捷運站把「面」改稱「光暈」）。用於 thsrDisplayMode:3540、traDisplayMode:3547、metroDisplayMode；消費端 overlayRegistry.ts hubModeLayout/hubPointLayers（1119-1322）以 `["==",["get"...Idx]...]`/layout visibility 切換
  - jpAirportsDisplayMode（:1847，點位／面，out:…Idx, encode）
  - railTrackMode（:3461，select 2D／3D，**out:null**，由 hook 讀 paramRefs）← 與 R6「立體／平面」最像
  - fireStations3D（:3587 toggle，out:null）、tempExtruded（temperatureWave toggle 3D，out:null）← 同圖層現成 3D 開關
  - 兩種寫法：out:null（hook 自讀 paramRefs，Three 層用）vs out:`xxxIdx`+encode（進 overlayParams 給 Mapbox 表達式用）
  - 若做成 select(out:null)＋paramRefs（state/layerParamRefs.ts:140,210-212 的 ref 模式）即可，**不新增 kind → 6 接點不必動**；只有「新 kind」（像 R7 palette、R8 linkedSelect）才要走 6 接點。
- 6 接點路徑（皆存在，但部分檔名與 handoff 不同）：
  1. spec 聯集型別：src/data/layerParamsSpec.ts:571 `LayerParamSpec = Slider|Toggle|Select|MultiSelect|Palette|LinkedSelect`（PaletteParamSpec :526）
  2. **src/state/layerParamsControls.ts**（不是 src/data/）：ctrl 型別 palette:91、linkedSelect:106、switch case:194/239
  3. **src/components/sidebar/LayerParamControls.tsx**（不是 src/components/）：:182 linkedSelect、:184 palette 分派
  4. manifest params.kinds：src/data/layerManifest.ts（每層 `params: {count, kinds:[…]}`，有 layerConsistency 類測試對 spec 驗證）
  5. src/research/layerControls.ts：:11 kind 聯集 "slider|toggle|select|multiSelect|palette|linkedSelect"
  6. **src/lib/memberSceneAdapter.ts**（不是 src/research/）：:15/19/46/79 分別處理 linkedSelect／palette（場景存檔）
  另 design-system 參考頁 src/design-system/sections/LayerPanelSection.tsx 有 linkedSelect 範例；handoff 另提 MCP（mini-pulse-gis-mcp）工具說明需同步（未在本 repo）。

