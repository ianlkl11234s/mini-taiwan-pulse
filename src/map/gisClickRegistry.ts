/**
 * GIS 點擊接線註冊表（AR-22 Phase 4b）
 * ══════════════════════════════════════════════════════════════════
 *
 * 「哪些 Mapbox layer id 點下去要開哪個 popup」的單一登記簿。
 * 原本是 `useMapInteraction` click handler 內的區域常數 —— runtime 取不到，
 * 護欄只能靠**原始碼文字解析**（`extractGisLayers` / `extractGisConstRefTypes`）。
 * 提升成模組級 export 後那兩支解析器退役，契約測試改吃 runtime 真值。
 * **內容逐字未動**（含全部中文排序註解與那兩筆常數引用），只搬家。
 *
 * ── ⚠️ first-hit-wins：順序 = 行為 ──────────────────────────────────
 *   下方迴圈由上往下 `queryRenderedFeatures`，第一個命中就 break。
 *   細節豐富的小目標排前、大面積面層刻意排末（校地面 / 等時圈 / 溫度網格…）。
 *   **重排 = 靜默改掉「點下去命中哪一層」**，沒有型別能擋 → 由黃金快照的
 *   `gisLayers` section 逐位元凍結（`src/data/__tests__/__fixtures__/layer-golden.json`）。
 *
 * ── 為什麼**不**從 manifest 派生（2026-08-12 拍板改案）─────────────
 *   Phase 3 原規劃「由 manifest 的 `popup` ＋ 新增的 `clickPriority` 欄位派生本表」。
 *   實作前重新評估，三條理由推翻：
 *
 *   1. **`layers` 陣列是實作細節，不該進 manifest** —— 它是「這個 layerType 由哪些
 *      Mapbox layer id 承載」，隨 overlay 的 sublayer 拆併而變，跟 manifest 想描述的
 *      「這層是什麼資料」不同層次。同樣的理由讓 `GATED_LAYERS` 在批 7 被評估後拒絕收編。
 *   2. **`powerPlant` 8 筆多對一，從 `popup` 產不出來** —— 六份不同 RPC ＋ 兩個
 *      Phase 8 SSOT entry 共用同一個 panel，各自有獨立 sourceId 與 layer id。
 *      manifest 的 `popup` 只記 layerType，反查會塌成一筆，接線直接少 7 條。
 *   3. **`clickPriority` 會是第二份順序 SSOT** —— 跨 key 的全域順序真正的家就是本表；
 *      再加一個數字欄位等於要求每次插層都重算 348 個優先級，而它守的東西
 *      （順序沒被意外改動）本表 ＋ fixture 已經守住了。
 *
 *   保留的是**雙向 runtime 驗證**（`src/data/__tests__/layerManifest.test.ts`）：
 *   manifest 每個 `popup` type 都要在本表（或兩支非 GIS 接線抽取器）找得到，
 *   本表每個 type 也都要有 manifest key 宣告它。宣告與接線任一邊漂移 = 紅。
 */
import type { FeatureInfo } from "../types";
import { DISASTER_ALERT_CLICK_LAYERS } from "../hooks/useDisasterAlertLayer";
import { PLA_ACTIVITY_CLICK_LAYERS } from "../hooks/usePlaActivityLayer";
import { VESSEL_WATCH_CLICK_LAYERS } from "../hooks/useVesselWatchLayer";

/** 查詢 Mapbox GIS 層（順序 load-bearing，見檔頭 first-hit-wins 段） */
export const GIS_LAYERS: { layers: string[]; type: FeatureInfo["layerType"] }[] = [
  { layers: ["road-congestion-hit"], type: "roadCongestion" },
  // 🚗 國道壅塞（W2）：同樣是「透明加寬命中層」的細線層，緊接省道排在最前段。
  //    兩層地理上不重疊（國道 vs 省道），先後順序對彼此無影響；
  //    收 `-hit` 而非 `-line`／`-glow` —— glow 帶 level!=0 filter，無資料路段點不到。
  { layers: ["freewayCongestion-hit"], type: "freewayCongestion" },
  { layers: ["submarine-cables-line", "submarine-cables-glow"], type: "submarineCable" },
  { layers: ["landing-stations-circle", "landing-stations-glow"], type: "landingStation" },
  // 🎓 教育：6 個學校點層共用 sourceId `edu-schools`（總覽 + 5 分級 + 偏遠），
  // 全部走同一個 SchoolPanel。校地面 `edu-campus-fill` 是大面積 fill → 排在陣列最末。
  {
    layers: [
      "edu-schools-glow", "edu-schools-circle",
      "edu-schools-elementary", "edu-schools-junior", "edu-schools-senior",
      "edu-schools-university", "edu-schools-special",
      "edu-schools-remote-halo", "edu-schools-remote-dot",
    ],
    type: "school",
  },
  // 🎓 幼托補習 4 個點層（W3）—— 各自獨立的 source，欄位契約也各不相同
  //    （幼兒園／互助教保中心欄位幾乎相同 → panel 共用，但 layerType 分開以便 header 標對）。
  //    ⚠️ 全部是**點層**，必須排在陣列末端的 4 個教育面層（campus / k12 / senior）之前。
  { layers: ["edu-cram-circle"], type: "eduCramSchool" },
  { layers: ["edu-kindergarten-circle"], type: "eduKindergarten" },
  { layers: ["edu-afterschool-circle"], type: "eduAfterschoolCare" },
  { layers: ["edu-mutual-care-circle"], type: "eduMutualCare" },
  // 🎓 大專學生數 bubble：半徑最大可達 22px → 排在上面 4 個小點層**之後**，
  //    否則落在 bubble 內的補習班/幼兒園小點會被整個蓋掉而點不到。
  { layers: ["edu-university-students-bubble"], type: "eduUniversityStudents" },
  { layers: ["convenience-stores-circle", "convenience-stores-glow"], type: "convenienceStore" },
  { layers: ["post-offices-circle", "post-offices-glow"], type: "postOffice" },
  { layers: ["ipost-boxes-circle", "ipost-boxes-glow"], type: "iPostBox" },
  { layers: ["community-centers-circle", "community-centers-glow"], type: "communityCenter" },
  { layers: ["gov-service-offices-circle", "gov-service-offices-glow"], type: "govServiceOffice" },
  { layers: ["public-libraries-circle", "public-libraries-glow"], type: "publicLibrary" },
  { layers: ["welfare-centers-circle", "welfare-centers-glow"], type: "welfareCenter" },
  { layers: ["retail-markets-circle", "retail-markets-glow"], type: "retailMarket" },
  { layers: ["public-toilets-circle", "public-toilets-glow"], type: "publicToilet" },
  { layers: ["weather-stations-circle", "weather-stations-glow"], type: "weatherStation" },
  { layers: ["bike-stations-circle", "bike-stations-glow"], type: "bikeStation" },
  { layers: ["bus-stations-city-circle", "bus-stations-city-glow"], type: "busStation" },
  { layers: ["bus-stations-intercity-circle", "bus-stations-intercity-glow"], type: "busStation" },
  { layers: ["lighthouses-circle", "lighthouses-glow"], type: "lighthouse" },
  { layers: ["energy-power-plants-circle", "energy-power-plants-halo"], type: "powerPlant" },
  { layers: ["energy-power-generation-hit-hit"], type: "powerPlant" },
  { layers: ["energy-substations-ehv-circle", "energy-substations-ehv-halo"], type: "osmSubstation" },
  { layers: ["energy-substations-circle"], type: "osmSubstation" },
  { layers: ["energy-power-lines-core", "energy-power-lines-cable"], type: "osmPowerLine" },
  { layers: ["energy-power-towers-circle"], type: "osmPowerTower" },
  { layers: ["energy-wind-turbines-core", "energy-wind-turbines-halo"], type: "osmWindTurbine" },
  { layers: ["energy-solar-farms-core", "energy-solar-farms-halo"], type: "osmSolarFarm" },
  { layers: ["energy-osm-power-plants-static-core"], type: "osmPowerPlantStatic" },
  { layers: ["energy-offshore-wind-zones-fill", "energy-offshore-wind-zones-line"], type: "offshoreWindZone" },
  { layers: ["energy-island-grid-core"], type: "islandPowerFacility" },
  { layers: ["energy-fossil-fuel-core"], type: "fossilFuelFacility" },
  { layers: ["energy-geothermal-wells-core", "energy-geothermal-wells-halo"], type: "geothermalWell" },
  { layers: ["energy-taipei-re-core"], type: "renewablePermitTaipei" },
  { layers: ["energy-ev-charging-circle"], type: "evCharging" },
  // Phase 8 SSOT 6-layer 共用 powerPlant panel
  { layers: ["energy-fac-primary-circle", "energy-fac-primary-halo"], type: "powerPlant" },
  { layers: ["energy-fac-offshore-fill", "energy-fac-offshore-line"], type: "powerPlant" },
  { layers: ["energy-fac-planned-circle"], type: "powerPlant" },
  { layers: ["energy-fac-historical-circle"], type: "powerPlant" },
  { layers: ["energy-fac-secondary-circle"], type: "powerPlant" },
  { layers: ["energy-fac-osm-supplement-circle"], type: "powerPlant" },
  // 化石燃料 14 layer（Phase B）— layer suffix 對齊 overlayRegistry
  { layers: ["fossil-gas-station-cpc-circle"], type: "gasStationCpc" },
  { layers: ["fossil-gas-station-fpcc-circle"], type: "gasStationFpcc" },
  { layers: ["fossil-gas-station-taisugar-circle"], type: "gasStationTaisugar" },
  { layers: ["fossil-gas-station-other-circle"], type: "gasStationOther" },
  { layers: ["fossil-gas-station-canonical-circle"], type: "gasStationCanonical" },
  { layers: ["fossil-lpg-subpackaging-circle"], type: "lpgSubpackaging" },
  { layers: ["fossil-lpg-retailers-circle"], type: "lpgRetailers" },
  { layers: ["fossil-lng-terminal-circle", "fossil-lng-terminal-halo"], type: "lngTerminal" },
  { layers: ["fossil-pipeline-gas-line"], type: "pipelineGas" },
  { layers: ["fossil-pipeline-oilgas-line"], type: "pipelineOilGas" },
  { layers: ["fossil-industrial-refinery-fill", "fossil-industrial-refinery-outline"], type: "industrialRefinery" },
  { layers: ["fossil-industrial-storage-tank-fill", "fossil-industrial-storage-tank-outline"], type: "industrialStorageTank" },
  { layers: ["fossil-industrial-power-plant-fill", "fossil-industrial-power-plant-outline"], type: "industrialPowerPlant" },
  { layers: ["fossil-coal-terminal-circle", "fossil-coal-terminal-halo"], type: "coalTerminal" },
  // 雲林 POC 覆蓋分析（PMTiles × OSM edge nearest distance）
  { layers: ["coverage-gas-all-line"], type: "gasCoverageAll" },
  { layers: ["coverage-gas-cpc-line"], type: "gasCoverageCpc" },
  { layers: ["coverage-gas-fpcc-line"], type: "gasCoverageFpcc" },
  { layers: ["coverage-gas-taisugar-line"], type: "gasCoverageTaisugar" },
  { layers: ["coverage-ev-island-line"], type: "evIsland" },
  { layers: ["hazard-lightning-core", "hazard-lightning-halo"], type: "lightningStrike" },
  { layers: ["hazard-lightning-cwa-core", "hazard-lightning-cwa-halo"], type: "lightningStrike" },
  { layers: ["hazard-nuclear-core", "hazard-nuclear-halo"], type: "nuclearStation" },
  // 本土地震（useEarthquakeLayer 的 pre/post 兩態，穩定半徑可點；
  // ripple 動畫圈半徑會瞬時放大到 60~80px+ 且持續變動，納入點擊會蓋過其他層的既有命中範圍，故不收）
  { layers: ["earthquake-post", "earthquake-pre"], type: "earthquakes" },
  // 地震回放：測站點層可點；鄉鎮面量圖是大面積 fill → 排到最後段（見下方 GIS_LAYERS 末尾）
  { layers: ["eq-replay-station-circle"], type: "earthquakeReplayStation" },
  // 全球氣候 GLOBAL CLIMATE
  { layers: ["earthquakes-global-circle"], type: "earthquakeGlobal" },
  // 🌍 世界 WORLD
  { layers: ["world-trash-debris-circle"], type: "worldTrashDebris" },
  { layers: ["typhoon-tracks-current-ring", "typhoon-tracks-current-dot", "typhoon-tracks-points"], type: "typhoonTrack" },
  { layers: ["port-polygons-fill", "port-polygons-line", "port-polygons-glow-1", "port-polygons-glow-2"], type: "port" },
  { layers: ["airport-boundaries-fill", "airport-boundaries-line", "airport-boundaries-glow-1", "airport-boundaries-glow-2"], type: "airport" },
  { layers: ["cctv-circle", "cctv-glow"], type: "cctv" },
  { layers: ["etc-gantry-circle", "etc-gantry-glow"], type: "etcGantry" },
  { layers: ["service-area-circle", "service-area-glow"], type: "serviceArea" },
  { layers: ["service-area-polygon-fill", "service-area-polygon-line"], type: "serviceAreaPolygon" },
  { layers: ["taxi-stand-circle", "taxi-stand-glow"], type: "taxiStand" },
  { layers: ["station-points-tra-pt-fill", "station-points-tra-pt-glow-1", "station-points-tra-pt-glow-2"], type: "railStation" },
  { layers: ["station-points-metro-pt-fill", "station-points-metro-pt-glow-1", "station-points-metro-pt-glow-2"], type: "railStation" },
  { layers: ["active-faults-fill", "active-faults-line", "active-faults-glow"], type: "activeFault" },
  { layers: ["fire-events-layer"], type: "fireEvent" },
  { layers: ["fire-latest-layer"], type: "fireEvent" },
  { layers: ["waste-cleaning-squads-core", "waste-cleaning-squads-glow"], type: "wasteCleaningSquad" },
  { layers: ["fire-stations-circle", "fire-stations-glow"], type: "fireStation" },
  { layers: ["fire-hydrants-circle", "fire-hydrants-glow"], type: "fireHydrant" },
  { layers: ["livestock-farms-pig", "livestock-farms-chicken", "livestock-farms-cattle", "livestock-farms-duck", "livestock-farms-goose", "livestock-farms-sheep", "livestock-farms-other"], type: "livestockFarm" },
  { layers: ["livestock-slaughter-circle"], type: "livestockSlaughter" },
  { layers: ["livestock-feed-circle"], type: "livestockFeed" },
  { layers: ["livestock-market-circle"], type: "livestockMarket" },
  { layers: ["aquaculture-ponds-fill", "aquaculture-ponds-line"], type: "aquaculturePonds" },
  { layers: ["aquaculture-zone-fill", "aquaculture-zone-line"], type: "aquacultureZone" },
  { layers: ["aquaculture-cage-net-fill", "aquaculture-cage-net-line"], type: "aquacultureCageNet" },
  { layers: ["aquaculture-water-satellite-fill", "aquaculture-water-satellite-line"], type: "aquacultureWaterSatellite" },
  { layers: ["aquaculture-water-satellite-moa-fill", "aquaculture-water-satellite-moa-line"], type: "aquacultureWaterSatelliteMoa" },
  { layers: ["aquaculture-water-satellite-union-fill", "aquaculture-water-satellite-union-line"], type: "aquacultureWaterUnion" },
  { layers: ["aquaculture-integrated-fill", "aquaculture-integrated-line"], type: "aquacultureIntegrated" },
  { layers: ["street-trees-taipei-diff-circle"], type: "streetTreesTaipeiDiff" },
  { layers: ["protected-trees-national-circle"], type: "protectedTreesNational" },
  { layers: ["riverside-trees-taipei-circle"], type: "riversideTreesTaipei" },
  { layers: ["canopy-giants-circle"], type: "canopyGiants" },
  { layers: ["parks-taipei-circle"], type: "parksTaipei" },
  { layers: ["street-trees-taipei-3epoch-circle"], type: "streetTreesTaipei3epoch" },
  { layers: ["street-trees-national-circle"], type: "streetTreesNational" },
  { layers: ["tree-pits-taipei-fill", "tree-pits-taipei-line"], type: "treePitsTaipei" },
  { layers: ["buildings-gba-fill", "buildings-gba-extrusion"], type: "buildingsGba" },
  // 網格背景層：細（總市值 150m/450m/1.5km）排前、粗（500m 都市紋理）排後 —— first-hit-wins。
  // 三個尺度的 layer id 都收（同時只有一個 visible，隱形的不會被 query 命中）；
  // 每尺度兩個 sublayer 都收（3D 模式看到的是 extrusion 側面，點它才要能開 popup，同 buildingsGba）
  { layers: [
    "property-value-grid-150-fill", "property-value-grid-150-extrusion",
    "property-value-grid-450-fill", "property-value-grid-450-extrusion",
    "property-value-grid-1500-fill", "property-value-grid-1500-extrusion",
  ], type: "propertyValueGrid" },
  { layers: ["urban-form-grid-fill"], type: "urbanFormGrid" },
  { layers: ["urban-zoning-taipei-fill"], type: "urbanZoningTaipei" },
  { layers: ["urban-zoning-newtaipei-fill"], type: "urbanZoningNewTaipei" },
  // 非都市分區覆蓋全台山區與農地（68,220 面）→ 排在兩層都計分區之後，免得擋掉都市內的點選
  { layers: ["non-urban-zoning-fill"], type: "nonUrbanZoning" },
  { layers: ["sports-venues-school", "sports-venues-public-other", "sports-venues-private", "sports-venues-park", "sports-venues-center"], type: "sportsVenue" },
  { layers: ["culture-facilities-circle"], type: "culturalFacilities" },
  { layers: ["culture-museums-circle"], type: "culturalMuseums" },
  { layers: ["culture-events-circle"], type: "artsEvents" },
  { layers: ["culture-venues-circle"], type: "performingVenues" },
  // 🛕 宗教 Religion 6 layer（小集合優先；temples 19,201 最密排最後）
  { layers: ["religion-top100-circle", "religion-top100-glow"], type: "religionTop100" },
  { layers: ["religion-foundations-circle"], type: "religionFoundations" },
  { layers: ["religion-ancestral-halls-circle"], type: "religionAncestralHalls" },
  { layers: ["religion-other-worship-circle"], type: "religionOtherWorship" },
  { layers: ["religion-churches-circle"], type: "religionChurches" },
  { layers: ["religion-temples-circle"], type: "religionTemples" },
  // ⚰️ 殯葬 Funeral 5 layer（點層優先；三個面層置末，density 覆蓋全台故排最後）
  { layers: ["funeral-facilities-circle"], type: "funeralFacilities" },
  { layers: ["funeral-operators-circle"], type: "funeralOperators" },
  // 🤝 社福長照 9 層（點層，first-hit-wins 下排在面層之前即可；9 層彼此不重疊）
  { layers: ["welfare-mental-health-circle"], type: "welfareMentalHealth" },
  { layers: ["welfare-gov-offices-circle"], type: "welfareGovOffices" },
  { layers: ["welfare-disability-circle"], type: "welfareDisability" },
  { layers: ["welfare-social-work-orgs-circle"], type: "welfareSocialWorkOrgs" },
  { layers: ["welfare-elderly-homes-circle"], type: "welfareElderlyHomes" },
  { layers: ["welfare-child-services-circle"], type: "welfareChildServices" },
  { layers: ["welfare-childcare-circle"], type: "welfareChildcare" },
  { layers: ["welfare-nursing-homes-circle"], type: "welfareNursingHomes" },
  { layers: ["welfare-ltc-institutions-circle"], type: "welfareLtcInstitutions" },
  { layers: ["cemetery-zoning-fill"], type: "cemeteryZoning" },
  { layers: ["cemetery-osm-fill"], type: "cemeteryOsm" },
  // 🧳 觀光 Tourism 12 layer（點層優先；面層 hot-spring-zones / scenic-areas 置末避免大面積擋點）
  { layers: ["tour-attractions-circle", "tour-attractions-glow"], type: "tourAttractions" },
  { layers: ["tour-hot-springs-circle", "tour-hot-springs-glow"], type: "tourHotSprings" },
  { layers: ["tour-heritage-circle", "tour-heritage-glow"], type: "tourHeritage" },
  { layers: ["tour-events-circle"], type: "tourEvents" },
  { layers: ["tour-factories-circle", "tour-factories-glow"], type: "tourFactories" },
  { layers: ["tour-amusement-parks-circle", "tour-amusement-parks-glow"], type: "tourAmusementParks" },
  { layers: ["tour-camping-circle", "tour-camping-glow"], type: "tourCamping" },
  { layers: ["tour-hotels-circle", "tour-hotels-glow"], type: "tourHotels" },
  { layers: ["tour-restaurants-circle"], type: "tourRestaurants" },
  { layers: ["tour-hot-spring-zones-fill"], type: "tourHotSpringZones" },
  { layers: ["tour-scenic-areas-fill"], type: "tourScenicAreas" },
  { layers: ["sat-current-point"], type: "satellite" },
  { layers: ["medical-hospitals-circle"], type: "medicalPOI" },
  { layers: ["medical-clinics-circle"], type: "medicalPOI" },
  { layers: ["medical-pharmacies-circle"], type: "medicalPOI" },
  { layers: ["medical-aed-circle"], type: "medicalPOI" },
  { layers: ["medical-ltc-circle"], type: "medicalPOI" },
  { layers: ["er-hospital-circle"], type: "erHospital" },
  { layers: ["library-seats-circle"], type: "librarySeats" },
  { layers: ["parking-onstreet-fill", "parking-onstreet-circle"], type: "parkingOnstreet" },
  { layers: ["parking-offstreet-circle"], type: "parkingOffstreet" },
  { layers: ["news-events-circle", "news-events-glow", "news-events-critical-halo", "news-events-count"], type: "newsEvent" },
  { layers: DISASTER_ALERT_CLICK_LAYERS, type: "disasterAlert" },
  // ⚠️ 特殊船舶（點 + 線）必須排在 plaActivity **之前**：共機活動區是覆蓋整個
  //    海峽的大面積 polygon，first-hit-wins 之下船點若排在它後面就永遠點不到。
  { layers: VESSEL_WATCH_CLICK_LAYERS, type: "vesselWatch" },
  { layers: PLA_ACTIVITY_CLICK_LAYERS, type: "plaActivity" },
  { layers: ["roadEvents-fill", "roadEvents-line", "roadEvents-point"], type: "roadEvent" },
  { layers: ["aqi-stations-circle", "aqi-stations-glow"], type: "aqiStation" },
  { layers: ["aqi-micro-circle"], type: "microSensor" },
  { layers: ["water-facilities-core", "water-facilities-glow"], type: "waterFacility" },
  { layers: ["water-monitor-stations-core", "water-monitor-stations-glow"], type: "waterMonitor" },
  { layers: ["water-detention-basins-core", "water-detention-basins-glow"], type: "waterDetentionBasin" },
  { layers: ["lakes-ponds-osm-fill", "lakes-ponds-osm-line"], type: "lakesPondsOsm" },
  { layers: ["water-reservoir-dams-core", "water-reservoir-dams-glow-1", "water-reservoir-dams-glow-2"], type: "waterDam" },
  { layers: ["water-reservoir-poly-fill", "water-reservoir-poly-outline"], type: "waterReservoirPoly" },
  { layers: ["rain-gauge-circle", "rain-gauge-glow"], type: "rainGauge" },
  { layers: ["river-level-circle", "river-level-glow"], type: "riverLevel" },
  // 💧 IoT 感測站兩層：properties 早已逐欄烤好（見 useIotWraRiverLayer / …Structure 的
  //    buildFC），W2 前只缺本表一行。iotWraRiver 1,634 站與 riverLevel 831 站僅重疊
  //    266 對 → 排在 river-level 之後，重疊處由既有的 riverLevel（有 24h 走勢圖）勝出。
  { layers: ["iot-wra-river-circle"], type: "iotWraRiver" },
  { layers: ["iot-wra-structure-circle"], type: "iotWraStructure" },
  { layers: ["groundwater-circle", "groundwater-glow"], type: "groundwater" },
  // 💧 地下水井靜態 backdrop（~733 灰點）：與動態 groundwater 層共用 GroundwaterPanel
  //    與同一組欄位。排在動態層**之後** —— 兩層同時開時由帶時間色階的動態層勝出。
  { layers: ["groundwater-wells-circle"], type: "groundwater" },
  { layers: ["flood-sensor-dot", "flood-sensor-glow"], type: "floodSensor" },
  { layers: ["flood-sensor-isochrone-fill"], type: "floodSensorIsochrone" },
  { layers: ["taipei-sewer-dot"], type: "taipeiSewer" },
  { layers: ["taipei-evac-dot"], type: "taipeiEvacuate" },
  { layers: ["taipei-pumb-dot", "taipei-pumb-glow"], type: "taipeiPumb" },
  { layers: ["agri-pois-circle"], type: "agriPOI" },
  { layers: ["business-registry-common-registration-addresses-circle"], type: "commonRegistrationAddresses" },
  { layers: ["business-registry-factory-locations-circle"], type: "factoryLocations" },
  { layers: ["business-registry-regulated-facilities-circle"], type: "regulatedFacilities" },
  { layers: ["business-registry-company-points-manufacturing-circle"], type: "manufacturingCompanyPoints" },
  { layers: ["business-registry-company-points-all-circle"], type: "companyPoints" },
  { layers: ["business-registry-company-capital-grid-fill", "business-registry-company-capital-grid-outline"], type: "companyCapitalGrid" },
  { layers: ["business-registry-industrial-park-comparison-fill", "business-registry-industrial-park-comparison-outline"], type: "industrialParkComparison" },
  { layers: ["industrial-zone-park-boundaries-fill", "industrial-zone-park-boundaries-outline"], type: "industrialParkBoundaries" },
  { layers: ["agri-wholesale-market-circle"], type: "agriWholesaleMarket" },
  { layers: ["agri-produce-wholesale-circle"], type: "agriProduceWholesale" },
  { layers: ["agri-retail-circle"], type: "agriRetail" },
  { layers: ["farm-roads-line", "farm-roads-glow"], type: "farmRoads" },
  { layers: ["hiking-trails-line", "hiking-trails-glow"], type: "hikingTrails" },
  { layers: ["eco-network-zones-fill"], type: "ecoNetworkZones" },
  // 登山安全：山屋 / 山域事故（小目標，排在林業大面積前）
  { layers: ["mountain-huts-circle"], type: "mountainHut" },
  { layers: ["mountain-rescue-incidents-circle"], type: "mountainRescueIncident" },
  // FORESTRY — points / lines 先（小目標優先）
  { layers: ["forest-education-centers-circle"], type: "forestryPOI" },
  { layers: ["forest-trail-signs-circle"], type: "forestryPOI" },
  { layers: ["forest-signal-points-circle"], type: "forestryPOI" },
  { layers: ["forest-wildlife-circle"], type: "forestryPOI" },
  { layers: ["forest-roads-line"], type: "forestryLine" },
  { layers: ["forest-alishan-rail-circle"], type: "forestryPOI" },
  { layers: ["forest-treatment-works-circle"], type: "forestryPOI" },
  { layers: ["forest-dam-lakes-circle"], type: "forestryPOI" },
  { layers: ["forest-flat-parks-circle"], type: "forestryPOI" },
  // FORESTRY polygons
  { layers: ["forest-recreation-fill"], type: "forestryPolygon" },
  // 大面積最後（compartments / reserve）
  { layers: ["forest-reserve-fill"], type: "forestryPolygon" },
  { layers: ["forest-compartments-fill"], type: "forestryPolygon" },
  { layers: ["agri-rural-regen-fill"], type: "agriRuralRegen" },
  // PMTiles polygon fill — 排序：細節豐富的小範圍優先（避免被 soil 大面積覆蓋）
  { layers: ["agri-leisure-farm-zones-fill"], type: "agriLeisureFarmZones" },
  { layers: ["agri-crop-suitability-fill"], type: "agriCropSuitability" },
  { layers: ["agri-soil-fertility-fill"], type: "agriSoilFertility" },
  { layers: ["agri-soil-fill"], type: "agriSoil" },
  // 救援等時圈覆蓋面 — 放最末端，避免大面積擋住上方點層的點選
  { layers: ["fire-isochrone-coverage-fill"], type: "fireIsochrone" },
  // 醫療等時圈覆蓋面
  { layers: ["medical-isochrone-fill"], type: "medicalIsochrone" },
  // 🌊 領海界線（基線 / 12 浬領海 / 24 浬鄰接區 ＋ 26 個基點）—— 排在下方所有線 / 面批之前：
  //    26 個基點是小目標點層，且全部落在海岸線上；海堤線（water-levees-core）同樣沿海岸
  //    分佈、村里/鄉鎮的 fill 雖然 opacity 0 仍會被 queryRenderedFeatures 命中 ——
  //    排到它們後面就點不到基點。依檔頭「小目標優先」原則置於此。
  {
    layers: [
      "base-maritime-boundary-point",
      "base-maritime-boundary-line",
      "base-maritime-boundary-line-24nm",
    ],
    type: "maritimeBoundary",
  },
  // 🗑️ 清運點位 73,060 點：全站密度最高的點層，且 click 用 ±5px bbox 命中
  //    → 排在其他點層之後，免得在市區把消防栓 / 行道樹 / POI 的點擊整片吃掉。
  { layers: ["waste-stops-static-waste-stops-fill"], type: "wasteStopsStatic" },
  // 🚄 高鐵站體面（12 面，station_points 零筆 thsr → 全台唯一點不到的車站族）。
  //    唯一的載體是面，依「面層不可搶點層」放在所有點層之後；站體範圍內的消防栓 /
  //    行道樹 / 停車場等點層因此仍優先命中。與 station-points-* 共用 railStation panel。
  { layers: ["station-polygons-thsr-poly-fill", "station-polygons-thsr-poly-line"], type: "railStation" },
  // 💧 水資源 線 / 面 5 層 —— 線層在前（±5px bbox 已夠命中細線，不必收 glow），
  //    面層依覆蓋面積由小到大排後，保護區流域級最大故置末。
  { layers: ["water-canals-core"], type: "waterCanals" },
  { layers: ["water-levees-core"], type: "waterLevees" },
  // 河川只收**面層**：同 layer key 的線層 water_rivers.geojson（2,015 筆）
  // river_name / river_code / river_type 三欄 100% 空字串（實測），接了只會開空白面板。
  { layers: ["water-river-polygons-fill"], type: "waterRivers" },
  // 流域只有輪廓線沒有 fill，不會擋住面內任何東西
  { layers: ["water-basins-line"], type: "waterBasins" },
  { layers: ["water-protection-zones-fill"], type: "waterProtectionZones" },
  // 🛣️ 內政部道路中線 + 自行車道（W2）—— 三層都排在下方 OSM 路網之前：
  //    同一條路上兩份切片會重疊，具體的「台1線／國1／某某自行車道」要贏過泛用的 OSM「道路」。
  //    三層彼此幾何不重疊（國道 / 省道 / 自行車道），內部先後對結果無影響。
  //    收 `-glow`（較寬）與 `-line` 兩層：±5px bbox 對 z6 的 0.5px 細線命中率仍偏低。
  { layers: ["national-highways-glow", "national-highways-line"], type: "highway" },
  { layers: ["provincial-roads-glow", "provincial-roads-line"], type: "provincialRoad" },
  { layers: ["cycling-routes-glow", "cycling-routes-line"], type: "cyclingRoute" },
  // Base map（行政邊界 / 等高線 / OSM 路網）— 小範圍優先（村→鄉→縣），等高線最末避免擋住
  //（海域界線同屬 base-*，但基點是小目標點層，已上移到上方線 / 面批之前）
  // 快速道路（trunk 子集，5.6 萬 edges）排在 osm_road_drive（55 萬 edges）之前：
  // 兩份切片在同一條路上會重疊，先命中的才決定標題，具體的「快速道路」要贏過泛用的「道路」。
  { layers: ["base-osm-expressway-line"], type: "osmExpressway" },
  { layers: ["base-osm-road-line"], type: "osmRoadDrive" },
  { layers: ["base-village-boundary-line", "base-village-boundary-fill"], type: "villageBoundary" },
  { layers: ["base-township-boundary-line", "base-township-boundary-fill"], type: "townshipBoundary" },
  { layers: ["base-county-boundary-line", "base-county-boundary-fill"], type: "countyBoundary" },
  { layers: ["base-contour-25k-line"], type: "contour25k" },
  { layers: ["base-contour-dtm20-line"], type: "contourDtm20" },
  // 警政司法民防 17 layer（layer id = `${sourceId}-${suffix}`，對齊 overlayRegistry）
  { layers: ["police-station-circle"], type: "policeStation" },
  { layers: ["women-child-warning-circle"], type: "womenChildWarning" },
  { layers: ["speed-camera-circle"], type: "speedCamera" },
  { layers: ["speed-zone-segment-line"], type: "speedZoneSegment" },
  { layers: ["court-circle"], type: "court" },
  { layers: ["prosecutors-office-circle"], type: "prosecutorsOffice" },
  { layers: ["correctional-facility-circle"], type: "correctionalFacility" },
  { layers: ["court-jurisdiction-fill", "court-jurisdiction-line"], type: "courtJurisdiction" },
  { layers: ["crime-area-monthly-fill", "crime-area-monthly-line"], type: "crimeAreaMonthly" },
  { layers: ["theft-taoyuan-circle"], type: "theftTaoyuan" },
  { layers: ["traffic-accident-yearly-circle"], type: "trafficAccidentYearly" },
  { layers: ["accident-taipei-circle"], type: "accidentTaipei" },
  { layers: ["a1-accident-realtime-circle", "a1-accident-realtime-halo", "a1-accident-realtime-ripple-outer"], type: "a1AccidentRealtime" },
  { layers: ["investigation-bureau-circle"], type: "investigationBureau" },
  { layers: ["anti-corruption-office-circle"], type: "antiCorruptionOffice" },
  { layers: ["immigration-office-circle"], type: "immigrationOffice" },
  { layers: ["coast-guard-station-circle"], type: "coastGuardStation" },
  { layers: ["civil-defense-shelter-circle"], type: "civilDefenseShelter" },
  // 環境污染（點層優先於大面積；三層皆 PMTiles circle）
  { layers: ["pollution-site-circle"], type: "pollutionSite" },
  {
    layers: [
      "pollution-penalty-critical-circle",
      "pollution-penalty-general-circle",
      "pollution-penalty-mobile-circle",
    ],
    type: "pollutionPenalty",
  },
  { layers: ["pollution-facility-circle"], type: "pollutionFacility" },
  { layers: ["aviation-control-fill", "aviation-control-line"], type: "aviationControl" },
  { layers: ["aviation-restricted-fill", "aviation-restricted-line"], type: "aviationRestricted" },
  { layers: ["drone-nfz-fill", "drone-nfz-line"], type: "droneNoFlyZone" },
  { layers: ["drone-restricted-fill", "drone-restricted-line"], type: "droneRestrictedZone" },
  { layers: ["slope-vector-fill"], type: "slopeVector" },
  { layers: ["aspect-vector-fill"], type: "aspectVector" },
  // 警察覆蓋分析 isochrone（fill + line 兩層）
  { layers: ["police-iso-substation-fill", "police-iso-substation-line"], type: "policeIsoSubstation" },
  { layers: ["police-iso-precinct-fill", "police-iso-precinct-line"], type: "policeIsoPrecinct" },
  { layers: ["police-iso-city-dept-fill", "police-iso-city-dept-line"], type: "policeIsoCityDept" },
  // 地震回放 鄉鎮面量圖：368 鄉鎮大面積 fill → 排在點/線層之後
  { layers: ["eq-replay-town-fill"], type: "earthquakeReplayTown" },
  // 溫度網格 2D：鋪滿全台陸地的大面積 fill → 放最末，不擋任何點/線層
  { layers: ["temperature-grid-fill"], type: "temperatureGrid" },
  // 殯葬業者密度：368 鄉鎮全台鋪滿的 fill → 同樣放最末
  { layers: ["funeral-density-fill"], type: "funeralOperatorDensity" },
  // 🎓 校地範圍：4,324 面大面積 fill，會蓋住其上的學校點 → 必須排最末
  //    面積面量圖 `edu-campus-area-fill` 是同一份切片的另一種讀法，欄位契約完全相同
  //    → 併進同一個 entry 共用 EduCampusPanel，不另開 layerType。
  { layers: ["edu-campus-fill", "edu-campus-area-fill"], type: "eduCampus" },
  // 🎓 國中小學區：里級面，比校地面更大 → 排在 edu-campus-fill 之後。
  //    國小／國中共用一個 type（欄位契約相同，panel 靠 level 自行分辨）。
  { layers: ["edu-district-k12-elementary-fill", "edu-district-k12-junior-fill"], type: "eduDistrictK12" },
  // 🎓 高中就學區：15 個面覆蓋全台，最不該搶點擊 → 整個陣列的最末
  { layers: ["edu-district-senior-fill"], type: "eduDistrictSenior" },
  // 🔷 H3 指標格 6 層（W2）：三個 factory 現算的六邊形網格，皆鋪滿有資料的行政區域。
  //    放在既有面層之後、田區之前 —— 這六層歷來零點擊接線，排最尾端對既有命中順序零影響。
  //    ⚠️ 每層都必須收 `-fill` **與** `-ext` 兩個 id：3D toggle 讓兩者互斥
  //       （非當前模式那層 visibility:none），只收 fill 的話 3D 模式整層點不到。
  { layers: ["h3-pop-count-fill", "h3-pop-count-ext"], type: "popCount" },
  { layers: ["h3-population-fill", "h3-population-ext"], type: "h3Population" },
  { layers: ["h3-indicators-fill", "h3-indicators-ext"], type: "indicators" },
  { layers: ["h3-socio-fill", "h3-socio-ext"], type: "socioeconomic" },
  { layers: ["h3-spatial-fill", "h3-spatial-ext"], type: "spatialEconomy" },
  { layers: ["h3-youbike-fill", "h3-youbike-ext"], type: "youbikeFullness" },
  // 🌾 FTW 田區（W2）：38.6 萬面覆蓋全台平原，密度遠高於上方任何面層
  //    → 放在整個陣列的**真正最末**，不搶任何點 / 線 / 面層的命中。
  //    只收 `-fill`：`-outline` 是同一批幾何的邊框，收了只是重複命中同一 feature。
  { layers: ["agri-ftw-fields-fill"], type: "agricultureField" },
];
