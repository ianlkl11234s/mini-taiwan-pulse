// 英國國家包：params.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { GbLayerKey } from "./keys";
import type { LayerParamSpec } from "../../data/layerParamsSpec";
import { categoryMultiSelect, displayModeSelect, heatmapPalette, opacitySlider, scaleSlider } from "../../data/layerParamsSpec";
import { densePointOpacity, RASTER } from "../../map/mapStyleScale";

export const GB_PACK_PARAMS = {
  // 英國行政邊界（第 0b 波）：線透明度＝滑桿（面透明度 0 只當點擊熱區）
  gbAdminBoundaries: [opacitySlider("gbAdminBoundariesOpacity", 0.85)],
  // 英國第 1 波：海域界線（線透明度）、建成區與綠地三層（面透明度；F-1 覆蓋面階由 lineFillTiers 套）
  gbMaritimeLimits: [opacitySlider("gbMaritimeLimitsOpacity", 0.85)],
  // §3.8 V-5：點／面切換（8,716 面 < 1 萬點，不建熱區；面 z3 起已看得到，預設面）
  gbBuiltUpAreas: [displayModeSelect("gbBuiltUpAreas", "polygon"), opacitySlider("gbBuiltUpAreasOpacity", 0.7), scaleSlider("gbBuiltUpAreasScale", 1)],
  // §3.8：點／面切換（墓園與宗教場地預設點）、依 function 類別多選；高爾夫 2,980 處 <1 萬點不畫熱區（P-4），拆成獨立圖層
  gbGreenspace: [displayModeSelect("gbGreenspace", "polygon"), heatmapPalette("gbGreenspace"), opacitySlider("gbGreenspaceOpacity", densePointOpacity(80_918)), scaleSlider("gbGreenspaceScale", 1), categoryMultiSelect("gbGreenspace", [{ label: "公園／花園", value: "Public Park Or Garden" }, { label: "遊戲場", value: "Play Space" }, { label: "市民農園", value: "Allotments Or Community Growing Spaces" }])],
  gbSportsFacilities: [displayModeSelect("gbSportsFacilities", "polygon"), heatmapPalette("gbSportsFacilities"), opacitySlider("gbSportsFacilitiesOpacity", densePointOpacity(51_872)), scaleSlider("gbSportsFacilitiesScale", 1), categoryMultiSelect("gbSportsFacilities", [{ label: "運動場地", value: "Playing Field" }, { label: "其他運動設施", value: "Other Sports Facility" }, { label: "網球場", value: "Tennis Court" }, { label: "草地滾球場", value: "Bowling Green" }])],
  gbGolfCourses: [displayModeSelect("gbGolfCourses", "polygon"), opacitySlider("gbGolfCoursesOpacity", densePointOpacity(2_980)), scaleSlider("gbGolfCoursesScale", 1)],
  gbCemeteries: [displayModeSelect("gbCemeteries", "point"), heatmapPalette("gbCemeteries"), opacitySlider("gbCemeteriesOpacity", densePointOpacity(30_208)), scaleSlider("gbCemeteriesScale", 1), categoryMultiSelect("gbCemeteries", [{ label: "墓園", value: "Cemetery" }, { label: "宗教場地", value: "Religious Grounds" }])],
  // 英國第 3 波：河川／防洪設施（線透明度）、測站與浴場（點透明度＋大小）、海岸侵蝕（面透明度＋期別）
  gbRivers: [opacitySlider("gbRiversOpacity", 0.85)],
  gbHydroStations: [opacitySlider("gbHydroStationsOpacity", densePointOpacity(6_261)), scaleSlider("gbHydroStationsScale", 1)],
  gbFloodDefenceAssets: [opacitySlider("gbFloodDefenceAssetsOpacity", 0.85)],
  gbCoastalErosionRisk: [
    // §3.8 V-5：點／面切換（88,793 → ≥ 1 萬點，兩種模式低縮放都有熱區；預設面）
    displayModeSelect("gbCoastalErosionRisk", "polygon"), heatmapPalette("gbCoastalErosionRisk"),
    opacitySlider("gbCoastalErosionRiskOpacity", 0.7), scaleSlider("gbCoastalErosionRiskScale", 1),
    {
      kind: "select", category: "data", name: "gbCoastalErosionRiskPeriod", label: "期別", default: "long",
      options: [{ label: "長期（2100／2105）", value: "long" }, { label: "短期（2050／2055）", value: "short" }, { label: "兩期", value: "both" }],
      out: "gbCoastalErosionRiskPeriodIdx", encode: ["long", "short", "both"],
    },
  ],
  gbBathingWaters: [opacitySlider("gbBathingWatersOpacity", 0.85), scaleSlider("gbBathingWatersScale", 1)],
  // 英國第 4 波：交通（樞紐、站客流、倫敦軌道線／站、單車站、攝影機為點／線透明度＋點大小；收費區面透明度）
  gbTransportHubs: [opacitySlider("gbTransportHubsOpacity", densePointOpacity(3_281)), scaleSlider("gbTransportHubsScale", 1), categoryMultiSelect("gbTransportHubs", [{ label: "鐵路車站", value: "rail" }, { label: "機場", value: "airport" }, { label: "渡輪碼頭", value: "ferry" }, { label: "巴士轉運站", value: "bus_station" }, { label: "公車鐵路整合站", value: "interchange" }])],
  gbStationUsage: [opacitySlider("gbStationUsageOpacity", densePointOpacity(2_638)), scaleSlider("gbStationUsageScale", 1)],
  gbLondonRailLines: [opacitySlider("gbLondonRailLinesOpacity", 0.85), categoryMultiSelect("gbLondonRailLines", [{ label: "地鐵", value: "tube" }, { label: "Overground 地上鐵", value: "overground" }, { label: "Elizabeth line", value: "elizabeth-line" }, { label: "DLR 輕軌", value: "dlr" }, { label: "電車", value: "tram" }])],
  gbLondonStations: [opacitySlider("gbLondonStationsOpacity", 0.85), scaleSlider("gbLondonStationsScale", 1)],
  // 英國列車重播（本機預覽）：透明度作用於列車點、箭頭、路網與選取路徑；大小只影響列車
  gbRailReplay: [opacitySlider("gbRailReplayOpacity", 0.9), scaleSlider("gbRailReplayScale", 1)],
  gbLondonBikePoints: [opacitySlider("gbLondonBikePointsOpacity", 0.85), scaleSlider("gbLondonBikePointsScale", 1)],
  gbLondonJamCams: [opacitySlider("gbLondonJamCamsOpacity", 0.85), scaleSlider("gbLondonJamCamsScale", 1)],
  gbLondonChargingZones: [opacitySlider("gbLondonChargingZonesOpacity", 0.7)],
  // 英國第 10 波：主要路網（線透明度）、AADF 計數點（點透明度＋大小＋「資料方式」選單）
  gbMajorRoads: [opacitySlider("gbMajorRoadsOpacity", 0.85)],
  // 英國第 13 波 OSM（2026-11-13）：四層都依類別多選（§3.8 V-4）；公共設施、宗教場所 ≥1 萬點畫熱區（R5）
  gbBridgesTunnels: [opacitySlider("gbBridgesTunnelsOpacity", 0.85), categoryMultiSelect("gbBridgesTunnels", [{ label: "橋梁", value: "bridge" }, { label: "隧道", value: "tunnel" }])],
  gbRoadFacilities: [opacitySlider("gbRoadFacilitiesOpacity", densePointOpacity(1_757)), scaleSlider("gbRoadFacilitiesScale", 1), categoryMultiSelect("gbRoadFacilities", [{ label: "服務區", value: "services" }, { label: "休息區", value: "rest_area" }, { label: "收費站", value: "toll_booth" }, { label: "緊急停車區", value: "emergency_area" }])],
  gbPublicFacilities: [heatmapPalette("gbPublicFacilities"), opacitySlider("gbPublicFacilitiesOpacity", densePointOpacity(41_333)), scaleSlider("gbPublicFacilitiesScale", 1), categoryMultiSelect("gbPublicFacilities", [{ label: "社區活動中心", value: "community_centre" }, { label: "公共廁所", value: "toilets" }, { label: "郵局", value: "post_office" }, { label: "市場", value: "marketplace" }])],
  gbPlacesOfWorship: [heatmapPalette("gbPlacesOfWorship"), opacitySlider("gbPlacesOfWorshipOpacity", densePointOpacity(42_113)), scaleSlider("gbPlacesOfWorshipScale", 1), categoryMultiSelect("gbPlacesOfWorship", [{ label: "基督宗教", value: "christian" }, { label: "伊斯蘭教", value: "muslim" }, { label: "猶太教", value: "jewish" }, { label: "錫克教", value: "sikh" }, { label: "印度教", value: "hindu" }, { label: "佛教", value: "buddhist" }, { label: "其他宗教", value: "other" }, { label: "未標示宗教", value: "unknown" }])],
  gbTrafficCountsAadf: [
    heatmapPalette("gbTrafficCountsAadf"),
    opacitySlider("gbTrafficCountsAadfOpacity", densePointOpacity(22_334)),
    scaleSlider("gbTrafficCountsAadfScale", 1),
    {
      kind: "select", category: "data", name: "gbTrafficCountsAadfMethod", label: "資料方式", default: "all",
      options: [{ label: "全部", value: "all" }, { label: "只看當年實測", value: "counted" }, { label: "只看 DfT 估算", value: "estimated" }],
      out: "gbTrafficCountsAadfMethodIdx", encode: ["all", "counted", "estimated"],
    },
  ],
  // 英國第 5 波：自然與林業（保護區含「類別」選項；點層透明度＋大小；面／線透明度）
  gbProtectedAreas: [
    // §3.8 V-5：小而零散的保育區預設點（8,642 區 < 1 萬點，不建熱區）
    displayModeSelect("gbProtectedAreas", "point"),
    opacitySlider("gbProtectedAreasOpacity", 0.45), scaleSlider("gbProtectedAreasScale", 1),
    {
      kind: "select", category: "data", name: "gbProtectedAreasGroup", label: "類別", default: "all",
      options: [{ label: "全部", value: "all" }, { label: "景觀類", value: "landscape" }, { label: "國內法保護區", value: "domestic" }, { label: "國際指定", value: "international" }],
      out: "gbProtectedAreasGroupIdx", encode: ["all", "landscape", "domestic", "international"],
    },
  ],
  gbMarineProtectedAreas: [displayModeSelect("gbMarineProtectedAreas", "point"), opacitySlider("gbMarineProtectedAreasOpacity", 0.5), scaleSlider("gbMarineProtectedAreasScale", 1), categoryMultiSelect("gbMarineProtectedAreas", [{ label: "海洋保育區", value: "mcz" }, { label: "自然保育 MPA", value: "ncmpa" }, { label: "示範研究 MPA", value: "drmpa" }])],
  gbWoodland: [displayModeSelect("gbWoodland", "polygon"), heatmapPalette("gbWoodland"), opacitySlider("gbWoodlandOpacity", 0.7), scaleSlider("gbWoodlandScale", 1)],
  gbForestRecreation: [heatmapPalette("gbForestRecreation"), opacitySlider("gbForestRecreationOpacity", densePointOpacity(24_487)), scaleSlider("gbForestRecreationScale", 1), categoryMultiSelect("gbForestRecreation", [{ label: "座椅、野餐桌等", value: "furniture" }, { label: "建物設施", value: "built" }, { label: "遊戲設施", value: "play" }, { label: "藝術品", value: "art" }, { label: "其他", value: "misc" }, { label: "指標與步道標", value: "signage" }])],
  gbTrails: [opacitySlider("gbTrailsOpacity", 0.85)],
  gbOpenAccessLand: [displayModeSelect("gbOpenAccessLand", "polygon"), heatmapPalette("gbOpenAccessLand"), opacitySlider("gbOpenAccessLandOpacity", 0.6), scaleSlider("gbOpenAccessLandScale", 1), categoryMultiSelect("gbOpenAccessLand", [{ label: "開放鄉野", value: "open_country" }, { label: "登記共有地", value: "common_land" }, { label: "自願提供地", value: "dedicated" }])],
  gbTreeProtection: [displayModeSelect("gbTreeProtection", "polygon"), heatmapPalette("gbTreeProtection"), opacitySlider("gbTreeProtectionOpacity", 0.7), scaleSlider("gbTreeProtectionScale", 1), categoryMultiSelect("gbTreeProtection", [{ label: "樹木保護範圍", value: "tpo_zone" }, { label: "受保護樹木", value: "tpo_tree" }, { label: "古老林地", value: "ancient_woodland" }])],
  // 英國第 6 波：能源（再生能源含「審查階段」互斥檢視；點層透明度＋大小；線／面透明度）
  gbPowerPlants: [opacitySlider("gbPowerPlantsOpacity", densePointOpacity(1_364)), scaleSlider("gbPowerPlantsScale", 1), categoryMultiSelect("gbPowerPlants", [{ label: "燃氣", value: "gas" }, { label: "核能", value: "nuclear" }, { label: "燃油", value: "oil" }, { label: "生質能／廢棄物", value: "bioenergy" }, { label: "水力", value: "hydro" }, { label: "抽蓄水力", value: "pumped_hydro" }, { label: "陸域風電", value: "wind_onshore" }, { label: "離岸風電", value: "wind_offshore" }, { label: "太陽光電", value: "solar" }])],
  gbRenewables: [
    opacitySlider("gbRenewablesOpacity", densePointOpacity(14_613)),
    scaleSlider("gbRenewablesScale", 1),
    {
      kind: "select", category: "data", name: "gbRenewablesStatus", label: "審查階段", default: "built",
      options: [{ label: "運轉中＋施工中", value: "built" }, { label: "已核准待建", value: "consented" }, { label: "審查中", value: "in_planning" }, { label: "未推進", value: "not_proceeding" }, { label: "已除役", value: "decommissioned" }],
      out: "gbRenewablesStatusIdx", encode: ["built", "consented", "in_planning", "not_proceeding", "decommissioned"],
    },
  ],
  gbPowerLines: [opacitySlider("gbPowerLinesOpacity", 0.85)],
  gbSubstations: [opacitySlider("gbSubstationsOpacity", densePointOpacity(59_195)), scaleSlider("gbSubstationsScale", 1)],
  gbFuelStations: [opacitySlider("gbFuelStationsOpacity", densePointOpacity(8_535)), scaleSlider("gbFuelStationsScale", 1)],
  gbOilGasFields: [displayModeSelect("gbOilGasFields", "polygon"), opacitySlider("gbOilGasFieldsOpacity", 0.6), scaleSlider("gbOilGasFieldsScale", 1), categoryMultiSelect("gbOilGasFields", [{ label: "油田", value: "OIL" }, { label: "氣田", value: "GAS" }, { label: "凝結油田", value: "COND" }])],
  // 英國第 7 波：公共服務（點層透明度＋大小）
  gbSchools: [heatmapPalette("gbSchools"), opacitySlider("gbSchoolsOpacity", densePointOpacity(30_658)), scaleSlider("gbSchoolsScale", 1), categoryMultiSelect("gbSchools", [{ label: "幼兒學校", value: "nursery" }, { label: "小學", value: "primary" }, { label: "中學", value: "secondary" }, { label: "一貫制", value: "all_through" }, { label: "繼續教育學院", value: "further_education" }, { label: "大學", value: "higher_education" }, { label: "特殊學校", value: "special" }, { label: "學生轉介單位", value: "pru" }, { label: "其他", value: "other" }])],
  gbHealthFacilities: [heatmapPalette("gbHealthFacilities"), opacitySlider("gbHealthFacilitiesOpacity", densePointOpacity(21_297)), scaleSlider("gbHealthFacilitiesScale", 1), categoryMultiSelect("gbHealthFacilities", [{ label: "醫院", value: "hospital" }, { label: "GP 診所", value: "gp_practice" }, { label: "藥局", value: "pharmacy" }])],
  gbCareHomes: [heatmapPalette("gbCareHomes"), opacitySlider("gbCareHomesOpacity", densePointOpacity(15_758)), scaleSlider("gbCareHomesScale", 1), categoryMultiSelect("gbCareHomes", [{ label: "護理照護之家", value: "care_home_nursing" }, { label: "照護之家", value: "care_home" }])],
  gbCareServices: [heatmapPalette("gbCareServices"), opacitySlider("gbCareServicesOpacity", densePointOpacity(17_237)), scaleSlider("gbCareServicesScale", 1), categoryMultiSelect("gbCareServices", [{ label: "居家照顧", value: "home_care" }, { label: "支持性住宅", value: "supported_living" }, { label: "Shared Lives 寄養式照顧", value: "shared_lives" }, { label: "其他社區服務", value: "other_community" }])],
  gbFireStations: [opacitySlider("gbFireStationsOpacity", densePointOpacity(1_987)), scaleSlider("gbFireStationsScale", 1)],
  gbCourts: [opacitySlider("gbCourtsOpacity", densePointOpacity(450)), scaleSlider("gbCourtsScale", 1), categoryMultiSelect("gbCourts", [{ label: "刑事法院", value: "crown" }, { label: "郡法院／家事法院", value: "county_family" }, { label: "治安法院", value: "magistrates" }, { label: "審裁處", value: "tribunal" }, { label: "其他司法服務據點", value: "other" }])],
  // 英國第 8 波：文化與觀光（點層透明度＋大小）
  gbCulturalFacilities: [opacitySlider("gbCulturalFacilitiesOpacity", densePointOpacity(8_312)), scaleSlider("gbCulturalFacilitiesScale", 1), categoryMultiSelect("gbCulturalFacilities", [{ label: "博物館", value: "museum" }, { label: "美術館／畫廊", value: "gallery" }, { label: "圖書館", value: "library" }])],
  gbArtsVenues: [opacitySlider("gbArtsVenuesOpacity", densePointOpacity(3_210)), scaleSlider("gbArtsVenuesScale", 1), categoryMultiSelect("gbArtsVenues", [{ label: "劇院", value: "theatre" }, { label: "電影院", value: "cinema" }, { label: "藝術中心", value: "arts_centre" }, { label: "音樂廳", value: "concert_hall" }])],
  gbVisitorExperience: [opacitySlider("gbVisitorExperienceOpacity", densePointOpacity(7_050)), scaleSlider("gbVisitorExperienceScale", 1), categoryMultiSelect("gbVisitorExperience", [{ label: "景點", value: "attraction" }, { label: "遊客中心", value: "visitor_centre" }, { label: "主題樂園", value: "theme_park" }, { label: "動物園", value: "zoo" }, { label: "水族館", value: "aquarium" }])],
  // 英國 C003 地形 raster（只有透明度；山體陰影預設 0.5 疊在底圖上，layer-plan 建議）、C028 公有地標售（點）
  gbTerrainHillshade: [{ kind: "slider", name: "gbTerrainHillshadeOpacity", labelPrefix: "透明度", digits: 2, default: 0.5, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05 }],
  gbTerrainRelief: [{ kind: "slider", name: "gbTerrainReliefOpacity", labelPrefix: "透明度", digits: 2, default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05 }],
  gbSurplusLand: [opacitySlider("gbSurplusLandOpacity", 0.9), scaleSlider("gbSurplusLandScale", 1)],
  // 英國第 9 波災害地質：GeoSure（分級面＋災害選單，一次一種）、氡氣（1 km 網格面）、山崩／加馬／地震（點透明度＋大小）
  gbGroundStability: [
    opacitySlider("gbGroundStabilityOpacity", 0.55),
    {
      kind: "select", category: "data", name: "gbGroundStabilityHazard", label: "災害種類", default: "landslides",
      options: [
        { label: "山崩", value: "landslides" }, { label: "脹縮土", value: "shrink_swell" }, { label: "可壓縮地層", value: "compressible_ground" },
        { label: "可塌陷沉積物", value: "collapsible_deposits" }, { label: "流沙", value: "running_sand" }, { label: "可溶岩（溶蝕）", value: "soluble_rocks" },
      ],
      out: "gbGroundStabilityHazardIdx", encode: ["landslides", "shrink_swell", "compressible_ground", "collapsible_deposits", "running_sand", "soluble_rocks"],
    },
  ],
  gbLandslide: [heatmapPalette("gbLandslide"), opacitySlider("gbLandslideOpacity", densePointOpacity(18_699)), scaleSlider("gbLandslideScale", 1)],
  gbRadon: [opacitySlider("gbRadonOpacity", 0.7)],
  gbRadiation: [opacitySlider("gbRadiationOpacity", 0.9), scaleSlider("gbRadiationScale", 1)],
  gbEarthquakes: [opacitySlider("gbEarthquakesOpacity", 0.8), scaleSlider("gbEarthquakesScale", 1)],
  // 英國第 11 波環境與規劃：規劃限制（覆蓋面＋類別選單，預設保育區）、棕地（點＋許可狀態選單）、回收點、
  // 廢棄物許可（點＋主管機關選單）、污染排放（點，只有蘇格蘭）、噪音（分級面＋道路／鐵路選單）
  gbPlanningConstraints: [
    displayModeSelect("gbPlanningConstraints", "point"),
    heatmapPalette("gbPlanningConstraints"),
    opacitySlider("gbPlanningConstraintsOpacity", 0.35),
    scaleSlider("gbPlanningConstraintsScale", 1),
    {
      kind: "select", category: "data", name: "gbPlanningConstraintsView", label: "類別", default: "conservation_area",
      options: [
        { label: "保育區", value: "conservation_area" }, { label: "Article 4 指令區", value: "article_4" },
        { label: "綠帶", value: "green_belt" }, { label: "全部", value: "all" },
      ],
      out: "gbPlanningConstraintsViewIdx", encode: ["conservation_area", "article_4", "green_belt", "all"],
    },
  ],
  gbBrownfield: [
    heatmapPalette("gbBrownfield"),
    opacitySlider("gbBrownfieldOpacity", densePointOpacity(30_303)),
    scaleSlider("gbBrownfieldScale", 1),
    {
      kind: "select", category: "data", name: "gbBrownfieldStatus", label: "許可狀態", default: "all",
      options: [
        { label: "全部", value: "all" }, { label: "已有規劃許可", value: "permissioned" }, { label: "審議中", value: "pending" },
        { label: "未取得許可", value: "not_permissioned" }, { label: "已完成", value: "completed" }, { label: "其他・未載明", value: "other" },
      ],
      out: "gbBrownfieldStatusIdx", encode: ["all", "permissioned", "pending", "not_permissioned", "completed", "other"],
    },
  ],
  gbRecyclingCentres: [heatmapPalette("gbRecyclingCentres"), opacitySlider("gbRecyclingCentresOpacity", densePointOpacity(12_959)), scaleSlider("gbRecyclingCentresScale", 1), categoryMultiSelect("gbRecyclingCentres", [{ label: "回收中心", value: "centre" }, { label: "回收桶・回收點", value: "container" }])],
  gbWastePermits: [
    opacitySlider("gbWastePermitsOpacity", densePointOpacity(8_711)),
    scaleSlider("gbWastePermitsScale", 1),
    {
      kind: "select", category: "data", name: "gbWastePermitsAuthority", label: "主管機關", default: "all",
      options: [
        { label: "全部", value: "all" }, { label: "英格蘭環境署 EA", value: "Environment Agency" },
        { label: "蘇格蘭環保署 SEPA", value: "SEPA" }, { label: "北愛環境署 NIEA", value: "NIEA" },
      ],
      out: "gbWastePermitsAuthorityIdx", encode: ["all", "Environment Agency", "SEPA", "NIEA"],
    },
  ],
  gbPollutionInventory: [opacitySlider("gbPollutionInventoryOpacity", densePointOpacity(1_450)), scaleSlider("gbPollutionInventoryScale", 1)],
  gbPollutionInventoryEngland: [opacitySlider("gbPollutionInventoryEnglandOpacity", densePointOpacity(2_536)), scaleSlider("gbPollutionInventoryEnglandScale", 1)],
  // 英國第 12 波：公司登記／製造業（district 聚合點，大小滑桿）、殯葬（點）、養殖（點＋狀態選單，預設現役）、土壤母質（分級面）
  gbCompanies: [opacitySlider("gbCompaniesOpacity", densePointOpacity(2_835)), scaleSlider("gbCompaniesScale", 1)],
  gbManufacturing: [opacitySlider("gbManufacturingOpacity", densePointOpacity(2_698)), scaleSlider("gbManufacturingScale", 1)],
  gbFuneral: [opacitySlider("gbFuneralOpacity", densePointOpacity(3_347)), scaleSlider("gbFuneralScale", 1), categoryMultiSelect("gbFuneral", [{ label: "火葬場", value: "crematorium" }, { label: "葬儀社", value: "funeral_directors" }])],
  gbAquaculture: [
    opacitySlider("gbAquacultureOpacity", densePointOpacity(3_129)),
    scaleSlider("gbAquacultureScale", 1),
    {
      kind: "select", category: "data", name: "gbAquacultureStatus", label: "狀態", default: "current",
      options: [
        { label: "現役（營運中・北愛許可）", value: "current" }, { label: "暫停營運", value: "inactive" },
        { label: "已註銷", value: "deregistered" }, { label: "全部", value: "all" },
      ],
      out: "gbAquacultureStatusIdx", encode: ["current", "inactive", "deregistered", "all"],
    },
    categoryMultiSelect("gbAquaculture", [{ label: "魚類養殖", value: "finfish" }, { label: "貝類養殖", value: "shellfish" }, { label: "放養釣魚場", value: "fishery_site" }, { label: "北愛貝類許可水域", value: "shellfish_licence" }]),
  ],
  gbSoilParentMaterial: [opacitySlider("gbSoilParentMaterialOpacity", 0.55)],
  gbNoise: [
    opacitySlider("gbNoiseOpacity", 0.55),
    {
      kind: "select", category: "data", name: "gbNoiseSource", label: "噪音來源", default: "road",
      options: [{ label: "道路", value: "road" }, { label: "鐵路", value: "rail" }],
      out: "gbNoiseSourceIdx", encode: ["road", "rail"],
    },
  ],
  gbSmallAreaBoundaries: [
    opacitySlider("gbSmallAreaBoundariesOpacity", 0.85),
    {
      kind: "select", category: "data", name: "gbSmallAreaBoundariesNiLevel", label: "北愛層級", default: "dz",
      options: [{ label: "Data Zone", value: "dz" }, { label: "Super Data Zone", value: "sdz" }],
      out: "gbSmallAreaBoundariesNiLevelIdx", encode: ["dz", "sdz"],
    },
  ],
  // <codemod:append GB_PACK_PARAMS>
} satisfies Partial<Record<GbLayerKey, LayerParamSpec[]>>;
