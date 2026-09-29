/**
 * 點圖層分階（design-system-map-layers §3.1 P-1 B；2026-09-28 使用者確認「全照建議」）。
 *
 * 只收 OVERLAY_REGISTRY 驅動的點圖層（runtime 192 層）；hook 自己畫的點另在各 hook 引用 pointRadius()。
 * 分階依據：現在 z14 半徑 ≤3 → S；≥9 → L；依資料放大 → B（泡泡，半徑由各層表達式決定）；其他 → M。
 * 例外：maritimeBoundary 的基準點跟著線寬控制同步縮放（layerUxPolicy 登記例外），不分階。
 * 比較頁：docs/features/map-layer-restyle/r2-tiers.html。改階直接改這裡，不要回去改 overlayRegistry 的字面值。
 */
import type { LayerVisibility } from "../types";
import type { PointTier } from "./mapStyleScale";

/** B＝泡泡：半徑保留各層依資料的表達式（M3 正規化列為後續），只統一描邊。 */
export type PointTierOrBubble = PointTier | "B";

export const POINT_TIERS: Partial<Record<keyof LayerVisibility, PointTierOrBubble>> = {
  // ── 小 S（半徑 3） · 25 層
  accidentTaipei: "S", // 北市事故點 Taipei Dots
  bikeStations: "S", // 公共自行車 Bike Station
  busStationsCity: "S", // 市區公車站 City Bus
  busStationsIntercity: "S", // 公路客運站 Intercity
  cctv: "S", // 道路攝影機 CCTV
  civilDefenseShelter: "S", // 防空避難 Civil Defense Shelters
  convenienceStores: "S", // 超商 Convenience Store
  facOsmSupplement: "S", // 發電廠 OSM 補充 Supplement
  fireHydrants: "S", // 消防栓 Hydrant
  forestTrailSigns: "S", // 步道路標 Trail Signs
  forestTreatmentWorks: "S", // 治理工程 Treatment Works
  medAED: "S", // AED 點位 AED
  medClinic: "S", // 診所 / 其他醫療 Clinic
  medHospital: "S", // 醫院 Hospital
  medLTC: "S", // 長照機構 LTC
  medPharmacy: "S", // 藥局 Pharmacy
  osmPowerTowers: "S", // 高壓鐵塔 Power Towers
  pollutionPenaltyMobile: "S", // 移動污染 Mobile Penalty
  schools: "S", // 學校總覽 All Schools
  streetTreesNational: "S", // 行道樹全國 Street Trees TW
  streetTreesTaipei3epoch: "S", // 行道樹三時點 Street Tree 3-Epoch
  streetTreesTaipeiDiff: "S", // 行道樹變化 Street Tree Diff
  wasteStopsStatic: "S", // 全台清運點位 Stops (靜態)
  waterFacilities: "S", // 水利設施 Facility
  waterMonitorStations: "S", // 監測站 Monitor
  // ── 大 L（半徑 6.5） · 10 層
  coalTerminal: "L", // 煤炭碼頭 Coal Terminal
  erHospital: "L", // 急診壅塞 ER
  fossilFuelInfra: "L", // 石化能源設施 Fossil Fuel (legacy)
  gasStationCanonical: "L", // 加油站 SSOT 合併 Canonical
  gasStationOther: "L", // 加油站 其他 / 私營 Other
  librarySeats: "L", // 圖書館即時座位 Library Seats
  livestockMarket: "L", // 拍賣/批發市場 Markets
  livestockSlaughter: "L", // 屠宰場 Slaughterhouses
  lngTerminal: "L", // LNG 接收站 Terminal
  serviceArea: "L", // 國道服務區 Service Area
  // ── 泡泡（依資料） · 43 層
  a1AccidentRealtime: "B", // A1 即時事故 A1 Realtime
  antiCorruptionOffice: "B", // 廉政署 AAC
  coastGuardStation: "B", // 海巡 Coast Guard
  commonRegistrationAddresses: "B", // 共同登記地址 Shared Address
  correctionalFacility: "B", // 矯正機關 Correctional
  court: "B", // 法院 Courts
  eduUniversityStudents: "B", // 大專學生數 University Students
  facHistorical: "B", // 發電廠 歷史・退役 Historical
  facPlanned: "B", // 發電廠 未來規劃 Planned
  facPrimary: "B", // 發電廠 主要・運轉中 Primary
  facSecondary: "B", // 發電廠 小型分散 Secondary
  fireStations: "B", // 消防分隊 Fire Station
  internetExchangePoints: "B", // 網際網路交換中心 Internet Exchange
  investigationBureau: "B", // 調查局 MJIB
  livestockFarmCattle: "B", // 畜禽飼養場·牛 Cattle Farms
  livestockFarmChicken: "B", // 畜禽飼養場·雞 Chicken Farms
  livestockFarmDuck: "B", // 畜禽飼養場·鴨 Duck Farms
  livestockFarmGoose: "B", // 畜禽飼養場·鵝 Goose Farms
  livestockFarmOther: "B", // 畜禽飼養場·其他 Other Farms
  livestockFarmPig: "B", // 畜禽飼養場·豬 Pig Farms
  livestockFarmSheep: "B", // 畜禽飼養場·羊 Sheep/Goat Farms
  mountainRescueIncidents: "B", // 山域事故 Mountain Rescue
  newsEvents: "B", // 新聞事件 News Events
  noiseEnforcementEvents: "B", // 噪音裁處事件 Enforcement
  parkingOffstreet: "B", // 場外停車場 Off-street
  parksTaipei: "B", // 公園 Parks
  performingVenues: "B", // 表演場館 Performing Venues
  policeStation: "B", // 警察機關 Police
  pollutionFacility: "B", // 資料驅動半徑（max_sev），2026-09-29 拍板改泡泡 · 污染潛勢設施 Facility
  pollutionPenaltyCritical: "B", // 重大裁處 Critical Penalty
  pollutionPenaltyGeneral: "B", // 資料驅動半徑（severity_event），2026-09-29 拍板改泡泡 · 一般裁處 General Penalty
  powerPlants: "B", // 資料驅動半徑（radius），2026-09-29 拍板改泡泡 · 發電廠 Power Plants
  prosecutorsOffice: "B", // 檢察署 Prosecutors
  protectedTreesNational: "B", // 受保護樹木 Protected Trees
  speedCamera: "B", // 測速照相 Speed Camera
  sportsCenter: "B", // 國民運動中心 Sports Center
  sportsPark: "B", // 運動公園/開放空間 Park
  sportsPrivate: "B", // 民營場館 Private Venues
  sportsPublicOther: "B", // 其他公共場館 Other Public Venues
  sportsSchool: "B", // 學校場館 School
  waterReservoirs: "B", // 水庫 Reservoir
  welfareElderlyHomes: "B", // 資料驅動半徑（床數），2026-09-29 拍板改泡泡 · 老人住宿機構 Elderly Homes
  welfareNursingHomes: "B", // 資料驅動半徑（床數），2026-09-29 拍板改泡泡 · 護理機構 Nursing Homes
  // ── 中 M（半徑 4.5） · 114 層
  manufacturingCompanyPoints: "M", // 製造業公司登記點位（suffix manufacturing-circle 原被誤判為裝飾，2026-09-28 補入）
  accessibleParkFacilities: "M", // 無障礙設施探索 Accessibility
  agriProduceWholesale: "M", // 蔬果批發商 Produce Wholesale
  agriRetail: "M", // 農產零售商 Retail
  agriWholesaleMarket: "M", // 農產批發市場 Wholesale Market
  airports: "M", // 機場 Airport
  anfrWirelessSites: "M", // 法國 ANFR 5G 3500 無線站點概覽 France ANFR 5G 3500 Overview
  artsEvents: "M", // 藝文活動 Arts Events
  bicycleSupport: "M", // 自行車支援 Bicycle Support
  bridgeComparisonNewTaipei: "M", // 新北橋梁 OSM 比對
  canopyGiants: "M", // 樹冠巨木 Canopy Giants
  changhuaTrafficSignals: "M", // 彰化縣道路號誌
  communityCenters: "M", // 活動中心（部分縣市） Community Center
  companyPoints: "M", // 公司登記分布 Company Registry
  culturalFacilities: "M", // 文化設施 Cultural Facilities
  culturalMuseums: "M", // 地方文化館 Local Museums
  disasterShelters: "M", // 預定收容處所 Disaster Shelters
  drinkingWaterPoints: "M", // 飲水點 Drinking Water
  eduAfterschoolCare: "M", // 兒童課後照顧中心 Afterschool Care
  eduCramSchool: "M", // 短期補習班 Cram School
  eduKindergarten: "M", // 幼兒園 Kindergarten
  eduMutualCare: "M", // 互助教保服務中心 Mutual Care
  eduRemoteSchools: "M", // 偏遠地區學校 Remote Schools
  eduSchoolElementary: "M", // 國小 Elementary
  eduSchoolJunior: "M", // 國中 Junior High
  eduSchoolSenior: "M", // 高中職 Senior High
  eduSchoolSpecial: "M", // 特教 Special Education
  eduSchoolUniversity: "M", // 大專 University
  etcGantry: "M", // ETC 收費門架 Gantry
  evChargingStations: "M", // 電動車充電站 EV Charging
  factoryLocations: "M", // 生產中工廠登記 Factory Locations
  forestAlishanRail: "M", // 阿里山鐵路 Alishan Rail
  forestDamLakes: "M", // 堰塞湖 Dam Lakes
  forestEducationCenters: "M", // 自然教育中心 Natural Education Centers
  forestFlatParks: "M", // 平地森林 Flat Parks
  forestSignalPoints: "M", // 通訊點 Signal Points
  forestWildlife: "M", // 野生動物分布 Wildlife
  funeralFacilities: "M", // 殯葬設施 Facilities
  funeralOperators: "M", // 禮儀業者 Operators
  gasStationCpc: "M", // 加油站 中油 CPC
  gasStationFpcc: "M", // 加油站 台塑 FPCC
  gasStationTaisugar: "M", // 加油站 台糖 Taisugar
  geothermalWells: "M", // 地熱井 Geothermal
  govServiceOffices: "M", // 機關便民據點 Gov Service Office
  iPostBoxes: "M", // i郵箱 iPost Box
  immigrationOffice: "M", // 移民署 Immigration
  islandPowerGrid: "M", // None
  landingStations: "M", // OSM 海纜登陸站 Landing Station
  lighthouses: "M", // 燈塔 Lighthouse
  lightning: "M", // 落雷 Lightning 60min（台電）
  lightningCwa: "M", // 落雷 Lightning 60min（氣象署）
  livestockFeed: "M", // 飼料廠 Feed Factories
  lpgRetailers: "M", // LPG 加氣站 / 瓦斯行 Retailer
  lpgSubpackaging: "M", // LPG 分裝 / 儲存場 Subpackaging
  materialRecyclingPoints: "M", // 資源回收點 Recycling
  mountainHuts: "M", // 山屋・高山營地 Mountain Huts
  nuclearRadiation: "M", // 核安輻射 Radiation
  officialBridgesHsinchu: "M", // 新竹市橋梁清冊
  officialBridgesNewTaipei: "M", // 新北市轄管橋梁
  officialNoiseMonitoring: "M", // 官方噪音測站 Official Monitoring
  osmCommunicationSites: "M", // OSM 通訊塔候選點概覽 OpenStreetMap Communication Candidates
  osmPowerPlantsStatic: "M", // None
  osmSolarFarms: "M", // None
  osmWindTurbines: "M", // 風機 Wind Turbines
  parkingOnstreet: "M", // 路邊停車 On-street
  playgrounds: "M", // 遊戲場 Playgrounds
  pollutionSite: "M", // 污染場址 Site
  ports: "M", // 港口 Port
  postOffices: "M", // 郵局 Post Office
  publicLibraries: "M", // 公共圖書館 Public Library
  publicToilets: "M", // 公廁 Public Toilet
  publicWasteBaskets: "M", // 公共垃圾桶 Waste Baskets
  regulatedFacilities: "M", // 列管設施 Regulated Facilities
  religionAncestralHalls: "M", // 宗祠 Ancestral Halls
  religionChurches: "M", // 教會 Churches
  religionFoundations: "M", // 宗教基金會 Foundations
  religionOtherWorship: "M", // 其他宗教場所 Other Worship
  religionTemples: "M", // 寺廟 Temples
  religionTop100: "M", // 宗教百景 Top 100
  renewablePermitsTaipei: "M", // 北市再生能源許可 Renewable Permits
  retailMarkets: "M", // 公有市場 Public Market
  ripeAtlasProbes: "M", // RIPE Atlas 連線量測節點 Connected Probes
  riversideTreesTaipei: "M", // 河濱喬木 Riverside Trees
  soundCameraLocations: "M", // 聲音照相設備 Sound Camera
  stationsMetro: "M", // 捷運站 Metro Station
  stationsTHSR: "M", // 高鐵站 THSR Station
  stationsTRA: "M", // 台鐵站 TRA Station
  tainanBridgeInspections: "M", // 臺南橋梁定期檢測紀錄
  tainanRoadTunnels: "M", // 臺南市道路隧道
  taipeiRoadTunnels: "M", // 臺北市道路隧道
  taxiStand: "M", // 計程車招呼站 Taxi Stand
  theftTaoyuan: "M", // 桃園竊盜 Theft Taoyuan
  tourAmusementParks: "M", // 民營遊樂園 Amusement Parks
  tourAttractions: "M", // 觀光景點 Attractions
  tourCamping: "M", // 露營場 Campgrounds
  tourEvents: "M", // 觀光活動・節慶 Tourism Events
  tourFactories: "M", // 觀光工廠 Tourism Factories
  tourHeritage: "M", // 文化資產 Heritage
  tourHotSprings: "M", // 溫泉露頭 Hot Springs
  tourHotels: "M", // 旅宿 Hotels & B&Bs
  tourRestaurants: "M", // 觀光餐飲 Restaurants
  trafficAccidentYearly: "M", // A1 死亡事故 Fatal Accident
  visitorCentres: "M", // 遊客中心 Visitor Centres
  waterDetentionBasins: "M", // 滯洪池 Detention
  weatherStations: "M", // 氣象站 Weather Station
  welfareCenters: "M", // 社福中心 Welfare Center
  welfareChildServices: "M", // 兒少服務 Child Services
  welfareChildcare: "M", // 托嬰中心 Childcare
  welfareDisability: "M", // 身障福利機構 Disability
  welfareGovOffices: "M", // 公部門社福據點 Gov Offices
  welfareLtcInstitutions: "M", // 長照立案機構 LTC Institutions
  welfareMentalHealth: "M", // 心理衛生機構 Mental Health
  welfareSocialWorkOrgs: "M", // 社福團體 Social Work Orgs
  womenChildWarning: "M", // 婦幼警示點 Women/Child Warning
};

/**
 * hook／factory 自己畫的點圖層分階（R2 後半，2026-09-28 使用者「全照建議」）。
 * 不走 OVERLAY_REGISTRY，所以 withPointSpec 不會套用；各 hook 直接用 pointRadius(tier, 大小滑桿÷預設)。
 * ⚠️ 名單來自 design:audit-layers 的 hook 層級掃描，可能混入同一支 hook 裡的非點圖層；
 *    實作時以程式實際有沒有畫 circle 為準（handoff-r2-hooks.md §3）。
 */
export const HOOK_POINT_TIERS: Partial<Record<keyof LayerVisibility, PointTierOrBubble>> = {
  animalAdoption: "B", // 資料驅動半徑，2026-09-29 拍板 · 待認領養動物 Animal Adoption · src/hooks/useAnimalAdoptionLayer.ts
  animalWelfarePoints: "M", // 動物服務據點 Animal Services · src/hooks/useAnimalWelfarePointsLayer.ts
  aqiStations: "L", // 空氣品質測站 AQI Station · src/hooks/useAqiStationsLayer.ts
  bridgeRainThresholds: "L", // 一級監控橋梁參考雨量 · src/hooks/useBridgeRainLayer.ts
  bssNationalBridgePointsPreview: "S", // 全臺橋梁清冊點位（進行中；26,188 筆密集點，站主限定） · src/hooks/useBssBridgeLayers.ts
  floodAlerts: "M", // 水文防汛 Flood Alerts · src/hooks/useDisasterAlertLayer.ts
  lifelineAlerts: "M", // 民生中斷 Lifeline · src/hooks/useDisasterAlertLayer.ts
  liquefactionMonitoringSites: "L", // 土壤液化監測站（11 點重點站） · src/hooks/useSoilLiquefactionLayers.ts
  safetyAlerts: "M", // 安全環境 Safety Alerts · src/hooks/useDisasterAlertLayer.ts
  transitAlerts: "M", // 交通阻斷 Transit Alerts · src/hooks/useDisasterAlertLayer.ts
  weatherAlerts: "M", // 氣象特報 Weather Alerts · src/hooks/useDisasterAlertLayer.ts
  earthquakes: "B", // 資料驅動半徑，2026-09-29 拍板 · 地震 Earthquake · src/hooks/useEarthquakeLayer.ts
  earthquakesGlobal: "B", // 資料驅動半徑，2026-09-29 拍板 · 全球地震 USGS Earthquake · src/hooks/useEarthquakesGlobalLayer.ts
  fireEvents: "B", // 火災歷史 Fire History · src/hooks/useFireEventsLayer.ts
  fireLatest: "B", // 火災最新年度 Latest · src/hooks/useFireLatestLayer.ts
  floodSensor: "B", // 資料驅動半徑，2026-09-29 拍板 · 都市淹水感測 USWG · src/hooks/useFloodSensorLayer.ts
  gfwDarkVessels: "B", // GFW SAR 未匹配 AIS Unmatched Detections · src/hooks/useGfwDarkVesselsLayer.ts
  gfwHourlyGrid: "B", // GFW 小時船舶網格 Hourly Grid · src/hooks/useGfwHourlyGridLayer.ts
  gfwHourlyTracks: "B", // 資料驅動半徑，2026-09-29 拍板 · GFW 小時近似航跡 Hourly Tracks · src/hooks/useGfwHourlyTracksLayer.ts
  globalEvents: "S", // 全球重大事件 Global Events · src/hooks/useGlobalEventsLayer.ts
  aisstreamVessels: "L", // AISStream 船舶 AISStream Vessels · src/hooks/useGlobalMaritimeLayers.ts
  gfwVesselPresence: "L", // GFW 舊版每日船舶 Historical Presence · src/hooks/useGlobalMaritimeLayers.ts
  groundwater: "B", // 資料驅動半徑，2026-09-29 拍板 · 地下水井 Groundwater · src/hooks/useGroundwaterLayer.ts
  groundwaterWells: "M", // 水井點位 Wells · src/hooks/useGroundwaterWellsLayer.ts
  iotWraRiver: "B", // 資料驅動半徑，2026-09-29 拍板 · IoT 河川 IoT River · src/hooks/useIotWraRiverLayer.ts
  iotWraStructure: "B", // 資料驅動半徑，2026-09-29 拍板 · IoT 水工結構 IoT Structure · src/hooks/useIotWraStructureLayer.ts
  jpAirports: "M", // 機場 空港 · src/hooks/useJpAirportsLayer.ts
  jpCareCombined: "M", // 複合服務 訪問・通い・宿泊の組合せ · src/hooks/useJpMedicalLayers.ts
  jpCareDayServices: "M", // 日間服務 施設に通う · src/hooks/useJpMedicalLayers.ts
  jpCareEquipment: "M", // 福祉用具 福祉用具 · src/hooks/useJpMedicalLayers.ts
  jpCareHomeVisit: "M", // 到宅服務 自宅に訪問 · src/hooks/useJpMedicalLayers.ts
  jpCarePlanning: "M", // 照護諮詢／計畫 介護の相談・ケアプラン · src/hooks/useJpMedicalLayers.ts
  jpCareResidential: "M", // 住宿／短期入住 施設で生活・宿泊 · src/hooks/useJpMedicalLayers.ts
  jpMedicalAreasPrimary: "M", // 一次醫療圈 一次医療圏 · 2020 · src/hooks/useJpMedicalLayers.ts
  jpMedicalAreasSecondary: "M", // 二次醫療圈 二次医療圏 · 2020 · src/hooks/useJpMedicalLayers.ts
  jpMedicalAreasTertiary: "M", // 三次醫療圈 三次医療圏 · 2020 · src/hooks/useJpMedicalLayers.ts
  jpMedicalClinics: "M", // 診所 診療所 · src/hooks/useJpMedicalLayers.ts
  jpMedicalDental: "M", // 牙科 歯科 · src/hooks/useJpMedicalLayers.ts
  jpMedicalHospitals: "M", // 醫院 病院 · src/hooks/useJpMedicalLayers.ts
  jpMedicalMaternity: "M", // 助產所 助産所 · src/hooks/useJpMedicalLayers.ts
  jpMedicalPharmacies: "M", // 藥局 薬局 · src/hooks/useJpMedicalLayers.ts
  jpPoliceFacilities: "M", // 警察設施 警察施設 · src/hooks/useJpPoliceFacilitiesLayer.ts
  jpReligionGsi: "M", // 宗教設施 宗教施設（国土地理院） · src/hooks/useJpReligionLayers.ts
  jpReligionOsm: "M", // 宗教設施 宗教施設（OpenStreetMap） · src/hooks/useJpReligionLayers.ts
  jpReligionWikidata: "M", // 宗教設施 宗教施設（Wikidata） · src/hooks/useJpReligionLayers.ts
  jpSchools: "M", // 學校 学校 · src/hooks/useJpSchoolsLayer.ts
  jpStations: "M", // 車站 駅 · src/hooks/useJpStationsLayer.ts
  jpAccommodationCanonical: "M", // 旅宿去重總覽 宿泊施設の統合一覧 · src/hooks/useJpTourismLayers.ts
  jpAccommodationJta: "M", // 觀光廳登錄飯店／旅館 観光庁登録ホテル・旅館 · src/hooks/useJpTourismLayers.ts
  jpAccommodationLocal: "M", // 地方旅館業許可 地方自治体の旅館業許可 · src/hooks/useJpTourismLayers.ts
  jpAccommodationOsm: "M", // OpenStreetMap 住宿涵蓋 OpenStreetMap 宿泊施設カバレッジ · src/hooks/useJpTourismLayers.ts
  jpMarineEbsaCoastal: "M", // 沿岸生態重要海域 沿岸EBSA（2015） · src/hooks/useJpTourismLayers.ts
  jpNaturalParksNational: "M", // 國立公園 国立公園（A10 2010） · src/hooks/useJpTourismLayers.ts
  jpNaturalParksPrefectural: "M", // 都道府縣立自然公園 都道府県立自然公園（A10 2010） · src/hooks/useJpTourismLayers.ts
  jpNaturalParksQuasiNational: "M", // 國定公園 国定公園（A10 2010） · src/hooks/useJpTourismLayers.ts
  jpNatureConservationArea: "M", // 自然保育地域 自然保全地域（A11 2015） · src/hooks/useJpTourismLayers.ts
  jpNatureConservationSpecialDistrict: "M", // 自然保育特別地區 自然保全特別地区（A11 2015） · src/hooks/useJpTourismLayers.ts
  jpPrimitiveNatureEnvironmentArea: "M", // 原生自然環境地域 原生自然環境保全地域（A11 2015） · src/hooks/useJpTourismLayers.ts
  jpRamsarSites: "M", // 拉姆薩濕地名冊衍生點 ラムサール条約湿地名簿の派生点 · src/hooks/useJpTourismLayers.ts
  jpWildlifeProtectionNational: "M", // 國家指定鳥獸保護區 国指定鳥獣保護区 · src/hooks/useJpTourismLayers.ts
  jpWildlifeSpecialProtectionDesignatedArea: "M", // 鳥獸特別保護指定區域 特別保護指定区域 · src/hooks/useJpTourismLayers.ts
  jpWildlifeSpecialProtectionDistrict: "M", // 鳥獸特別保護地區 鳥獣保護区特別保護地区 · src/hooks/useJpTourismLayers.ts
  jpWorldHeritageCultural: "M", // UNESCO 文化遺產代表點 UNESCO 文化遺産代表点 · src/hooks/useJpTourismLayers.ts
  jpWorldHeritageNatural: "M", // UNESCO 自然遺產代表點 UNESCO 自然遺産代表点 · src/hooks/useJpTourismLayers.ts
  jpWorldNaturalHeritageHistorical: "M", // 世界自然遺產歷史範圍 世界自然遺産の歴史的範囲（A28 2011） · src/hooks/useJpTourismLayers.ts
  jpWaterAgriculturalPonds: "M", // 農業蓄水池（2026-03） · src/hooks/useJpWaterLayers.ts
  jpWaterDams: "M", // 水壩 ダム（2014） · src/hooks/useJpWaterLayers.ts
  jpWaterFloodHazard: "M", // 洪水浸水想定（最大規模） · src/hooks/useJpWaterLayers.ts
  jpWaterGroundwaterSites: "M", // 地下水等觀測點（24縣） · src/hooks/useJpWaterLayers.ts
  jpWaterLakes: "M", // 湖沼 湖沼（W09・2005） · src/hooks/useJpWaterLayers.ts
  jpWaterLevelStations: "M", // 橫濱水位站 横浜市 · src/hooks/useJpWaterLayers.ts
  jpWaterLocalFacilities: "M", // 高松供排水相關設施 高松市 · src/hooks/useJpWaterLayers.ts
  jpWaterNilimDams: "M", // NILIM 水壩位置（46縣） · src/hooks/useJpWaterLayers.ts
  jpWaterQualityStations: "M", // 水質測定地点 水質測定地点（2024） · src/hooks/useJpWaterLayers.ts
  jpWaterRivers: "M", // 河川流路 河川（2006–2009） · src/hooks/useJpWaterLayers.ts
  jpWaterSewerFacilities: "M", // 下水道設施（2012） · src/hooks/useJpWaterLayers.ts
  jpWaterSupplyAreas: "M", // 給水區域 給水区域（2010） · src/hooks/useJpWaterLayers.ts
  jpWaterSupplyFacilities: "M", // 上水道相關設施（2010） · src/hooks/useJpWaterLayers.ts
  marineObservationCwa: "M", // CWA 海洋觀測站 CWA Marine · src/hooks/useMarineObservationLayer.ts
  marineObservationIsohe: "M", // ISOHE 港區海氣象 ISOHE Port · src/hooks/useMarineObservationLayer.ts
  aqiMicroSensors: "B", // LASS 微型感測 Micro Sensor · src/hooks/useMicroSensorsLayer.ts
  powerPoles: "M", // 電桿 Power Poles (2.96M) · src/hooks/usePowerPolesLayer.ts
  rainGauge: "B", // 資料驅動半徑，2026-09-29 拍板 · 即時雨量 Rain Gauge · src/hooks/useRainGaugeLayer.ts
  riverLevel: "B", // 資料驅動半徑，2026-09-29 拍板 · 河川水位 River Level · src/hooks/useRiverLevelLayer.ts
  roadEvents: "M", // 即時路況 Road Events · src/hooks/useRoadEventsLayer.ts
  satellitesBeidou: "M", // 北斗 BD-3 PNT · src/hooks/useSatellitesLayer.ts
  satellitesFrance: "M", // 🇫🇷 France · CSO / PLEIADES / ELISA · src/hooks/useSatellitesLayer.ts
  satellitesGaofen: "M", // Gaofen 高分 · src/hooks/useSatellitesLayer.ts
  satellitesGermany: "M", // 🇩🇪 Germany · SAR-Lupe / SARah · src/hooks/useSatellitesLayer.ts
  satellitesIndia: "M", // 🇮🇳 India · CARTOSAT / RISAT / EOS · src/hooks/useSatellitesLayer.ts
  satellitesIsrael: "M", // 🇮🇱 Israel · Ofeq / EROS · src/hooks/useSatellitesLayer.ts
  satellitesItaly: "M", // 🇮🇹 Italy · COSMO-SkyMed · src/hooks/useSatellitesLayer.ts
  satellitesJapan: "M", // 🇯🇵 Japan · IGS / ALOS · src/hooks/useSatellitesLayer.ts
  satellitesJilin: "M", // Jilin 吉林 · src/hooks/useSatellitesLayer.ts
  satellitesKorea: "M", // 🇰🇷 Korea · KOMPSAT · src/hooks/useSatellitesLayer.ts
  satellitesRussia: "M", // 🇷🇺 Russia · PERSONA / RESURS / COSMOS · src/hooks/useSatellitesLayer.ts
  satellitesShiyan: "M", // Shiyan / Shijian 試驗 · src/hooks/useSatellitesLayer.ts
  satellitesTJS: "M", // TJS / TJSW GEO 情報 · src/hooks/useSatellitesLayer.ts
  satellitesTaiwan: "M", // 台灣 FORMOSAT / TRITON / IRIS-C · src/hooks/useSatellitesLayer.ts
  satellitesUSA: "M", // 🇺🇸 USA · KH / BlackSky / Planet · src/hooks/useSatellitesLayer.ts
  satellitesYaogan: "M", // Yaogan 遙感 · src/hooks/useSatellitesLayer.ts
  taipeiEvacuate: "M", // 北市疏散門 Evacuate Gate (TP) · src/hooks/useTaipeiEvacuateLayer.ts
  taipeiPumb: "M", // 北市抽水站 Pump Station (TP) · src/hooks/useTaipeiPumbLayer.ts
  taipeiSewer: "M", // 北市下水道水位 Sewer (TP) · src/hooks/useTaipeiSewerLayer.ts
  typhoonTracks: "M", // 颱風軌跡 Typhoon Track · src/hooks/useTyphoonTracksLayer.ts
  vesselWatch: "M", // 特殊船舶 Vessel Watch · src/hooks/useVesselWatchLayer.ts
  wasteCleaningSquads: "L", // 清潔隊 Squads · src/hooks/useWasteCleaningSquadLayer.ts
  worldTrashDebris: "M", // 垃圾與殘骸觀測 Trash & Debris Observations · src/hooks/useWorldTrashDebrisLayer.ts
  agriCropSuitability: "M", // 作物適栽 Crop Suitability · src/map/agricultureLayerFactory.ts
  agriLeisureFarmZones: "M", // 休閒農業區 Leisure Farm Zones · src/map/agricultureLayerFactory.ts
  agriPOI: "M", // 休農場 / 田媽媽 / 特色農旅 POI · src/map/agricultureLayerFactory.ts
  agriRuralRegen: "M", // 農村再生社區 Rural Regen · src/map/agricultureLayerFactory.ts
  agriSoil: "M", // 全台土壤分類 Soil Map · src/map/agricultureLayerFactory.ts
  agriSoilFertility: "M", // 土壤肥力 250m Soil Fertility · src/map/agricultureLayerFactory.ts
  agriculture: "M", // 農田範圍 FTW Fields 2025 · src/map/agricultureLayerFactory.ts
  earthquakeReplay: "B", // 資料驅動半徑，2026-09-29 拍板 · 地震回放 EQ Replay · src/map/earthquakeReplayLayerFactory.ts
  wdBattery: "M", // 電池回收 Battery · src/map/wasteMapboxLayers.ts
  wdClothes: "M", // 衣物回收箱 Clothes · src/map/wasteMapboxLayers.ts
  wdMixed: "M", // 混合投放點 Mixed · src/map/wasteMapboxLayers.ts
  wdRecyclingContainer: "M", // 街頭資收桶 Container · src/map/wasteMapboxLayers.ts
  wfMonitoring: "M", // 地下水監測井 Monitor · src/map/wasteMapboxLayers.ts
  wfOther: "M", // 其他事廢設施 Other · src/map/wasteMapboxLayers.ts
  wfRecycling: "M", // 資源回收廠 Recycling · src/map/wasteMapboxLayers.ts
  wfScrapYard: "M", // 廢車 / 廢金屬 Scrap · src/map/wasteMapboxLayers.ts
};
