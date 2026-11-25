// 英國國家包：clicks.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { GisLayerEntry } from "../../map/gisClickRegistry";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("GB", n)。 */
export const GB_PACK_CLICK_SLOTS: Readonly<Record<number, readonly GisLayerEntry[]>> = {
  1: [
  // 英國第 1 波：海域界線（線）與綠地三層（小面）排在建成區、行政界（大面積背景）前面
  { layers: ["gb-maritime-limits-line", "gb-maritime-limits-dashed", "gb-maritime-limits-closing"], type: "gbMaritimeLimits" },
  { layers: ["gb-greenspace-park-fill"], type: "gbGreenspace" },
  // 英國第 3 波：點（測站、浴場）→ 線（防洪、北愛侵蝕風險、河川）→ 侵蝕面，都排在建成區、行政界前面
  // 英國第 4 波：倫敦車站排在樞紐前（King's Cross 等共站），點 → 線 → 收費區大面
  // 英國第 5 波：點（TPO 單株、森林遊憩）→ 線（步道）排最前；小面（TPO 範圍、開放進入地、古老林地、林地）→ 海洋保護區 → 保護區大面
  // 英國第 7 波：公共服務點（消防站、法院、醫院 → GP／藥局 → 學校 → 照護）排在 GB 點層最前
  { layers: ["gb-fire-stations-circle"], type: "gbFireStations" },
  { layers: ["gb-courts-circle"], type: "gbCourts" },
  { layers: ["gb-health-hospital-circle", "gb-health-primary-circle"], type: "gbHealthFacilities" },
  { layers: ["gb-schools-circle"], type: "gbSchools" },
  { layers: ["gb-public-facilities-circle"], type: "gbPublicFacilities" },
  { layers: ["gb-places-of-worship-circle"], type: "gbPlacesOfWorship" },
  { layers: ["gb-care-homes-circle"], type: "gbCareHomes" },
  { layers: ["gb-care-services-circle"], type: "gbCareServices" },
  // 英國第 8 波：文化與觀光點（藝文場館 → 文化設施 → 觀光體驗非景點 → 景點）
  { layers: ["gb-arts-venues-circle"], type: "gbArtsVenues" },
  { layers: ["gb-cultural-facilities-circle"], type: "gbCulturalFacilities" },
  { layers: ["gb-visitor-other-circle", "gb-visitor-attraction-circle"], type: "gbVisitorExperience" },
  // 英國 C028 公有地標售（點）
  { layers: ["gb-surplus-land-circle"], type: "gbSurplusLand" },
  // 英國第 9 波災害地質：點（地震 → 加馬站 → 山崩）先於面（氡氣方格、GeoSure 六角格）
  { layers: ["gb-earthquakes-major-circle", "gb-earthquakes-minor-circle"], type: "gbEarthquakes" },
  { layers: ["gb-gamma-dose-circle"], type: "gbRadiation" },
  { layers: ["gb-landslides-circle"], type: "gbLandslide" },
  { layers: ["gb-radon-fill"], type: "gbRadon" },
  { layers: ["gb-geosure-fill"], type: "gbGroundStability" },
  // 英國第 6 波：點（電廠 → 再生能源 → 加油站 → 變電所）→ 電網線 → 油氣田大面
  { layers: ["gb-power-plants-circle"], type: "gbPowerPlants" },
  { layers: ["gb-renewables-circle"], type: "gbRenewables" },
  { layers: ["gb-fuel-stations-circle"], type: "gbFuelStations" },
  { layers: ["gb-substations-circle"], type: "gbSubstations" },
  { layers: ["gb-power-lines-line", "gb-power-cables-line"], type: "gbPowerLines" },
  { layers: ["gb-tpo-circle"], type: "gbTreeProtection" },
  { layers: ["gb-forest-recreation-circle", "gb-forest-recreation-signage-circle"], type: "gbForestRecreation" },
  { layers: ["gb-trails-national-line", "gb-trails-forest-line"], type: "gbTrails" },
  { layers: ["gb-rail-replay-trains-circle"], type: "gbRailReplay" },
  { layers: ["gb-london-stations-circle"], type: "gbLondonStations" },
  { layers: ["gb-london-jamcams-circle"], type: "gbLondonJamCams" },
  { layers: ["gb-london-bikepoints-circle"], type: "gbLondonBikePoints" },
  { layers: ["gb-station-usage-circle"], type: "gbStationUsage" },
  { layers: ["gb-transport-hubs-circle"], type: "gbTransportHubs" },
  { layers: ["gb-london-rail-lines-line"], type: "gbLondonRailLines" },
  // 英國第 12 波：點（殯葬 → 養殖 → 製造業 → 公司）先於面（土壤母質）
  { layers: ["gb-funeral-crematorium-circle", "gb-funeral-directors-circle"], type: "gbFuneral" },
  { layers: ["gb-aquaculture-circle"], type: "gbAquaculture" },
  { layers: ["gb-manufacturing-circle"], type: "gbManufacturing" },
  { layers: ["gb-companies-circle"], type: "gbCompanies" },
  { layers: ["gb-soil-parent-material-fill", "gb-soil-parent-material-na"], type: "gbSoilParentMaterial" },
  // 英國第 11 波：點（污染 → 廢棄物許可 → 回收中心 → 回收桶 → 棕地）先於面（規劃限制區、噪音）
  { layers: ["gb-pollution-inventory-circle"], type: "gbPollutionInventory" },
  { layers: ["gb-ea-pollution-inventory-circle"], type: "gbPollutionInventoryEngland" },
  { layers: ["gb-waste-permits-circle"], type: "gbWastePermits" },
  { layers: ["gb-recycling-centre-circle", "gb-recycling-container-circle"], type: "gbRecyclingCentres" },
  { layers: ["gb-brownfield-circle"], type: "gbBrownfield" },
  { layers: ["gb-planning-constraints-fill", "gb-planning-constraints-points-circle"], type: "gbPlanningConstraints" },
  { layers: ["gb-noise-fill"], type: "gbNoise" },
  // 英國第 10 波：計數點（點）排在主要路網（線）前面
  { layers: ["gb-traffic-counts-aadf-major-circle", "gb-traffic-counts-aadf-minor-circle"], type: "gbTrafficCountsAadf" },
  { layers: ["gb-road-facilities-circle"], type: "gbRoadFacilities" },
  { layers: ["gb-bridges-tunnels-bridge-line", "gb-bridges-tunnels-tunnel-line"], type: "gbBridgesTunnels" },
  { layers: ["gb-major-roads-line"], type: "gbMajorRoads" },
  { layers: ["gb-hydro-stations-circle"], type: "gbHydroStations" },
  { layers: ["gb-bathing-waters-circle"], type: "gbBathingWaters" },
  { layers: ["gb-flood-defences-line", "gb-flood-defences-z5-6-line"], type: "gbFloodDefenceAssets" },
  { layers: ["gb-coastal-erosion-points-circle", "gb-coastal-erosion-ni-line", "gb-coastal-erosion-fill"], type: "gbCoastalErosionRisk" },
  { layers: ["gb-rivers-line"], type: "gbRivers" },
  // §3.8 V-5 綠地四層的代表點（「點」模式；高爾夫球場「面」模式 z<10 也用），點先於面
  { layers: ["gb-greenspace-park-point-circle"], type: "gbGreenspace" },
  { layers: ["gb-greenspace-sports-point-circle"], type: "gbSportsFacilities" },
  { layers: ["gb-greenspace-golf-circle"], type: "gbGolfCourses" },
  { layers: ["gb-greenspace-burial-point-circle"], type: "gbCemeteries" },
  { layers: ["gb-greenspace-sports-fill"], type: "gbSportsFacilities" },
  { layers: ["gb-greenspace-golf-fill"], type: "gbGolfCourses" },
  { layers: ["gb-greenspace-burial-fill"], type: "gbCemeteries" },
  { layers: ["gb-london-charging-zones-line", "gb-london-charging-zones-fill"], type: "gbLondonChargingZones" },
  { layers: ["gb-tpo-fill", "gb-ancient-woodland-fill", "gb-tree-protection-points-circle"], type: "gbTreeProtection" },
  { layers: ["gb-open-access-land-fill", "gb-open-access-land-z5-fill", "gb-open-access-points-circle"], type: "gbOpenAccessLand" },
  { layers: ["gb-woodland-fill", "gb-woodland-points-circle"], type: "gbWoodland" },
  { layers: ["gb-marine-protected-areas-points-circle", "gb-marine-protected-areas-line", "gb-marine-protected-areas-fill"], type: "gbMarineProtectedAreas" },
  { layers: ["gb-protected-areas-points-circle", "gb-protected-areas-line", "gb-protected-areas-fill"], type: "gbProtectedAreas" },
  { layers: ["gb-oil-gas-points-circle", "gb-oil-gas-fields-line", "gb-oil-gas-fields-fill"], type: "gbOilGasFields" },
  { layers: ["gb-built-up-areas-points-circle", "gb-built-up-areas-fill"], type: "gbBuiltUpAreas" },
  // 英國：小區（細）排在 LAD（大面積背景）前面；北愛 DZ／SDZ 只會有一個可見
  { layers: ["gb-small-areas-fill", "gb-ni-sdz-fill", "gb-small-areas-low-fill", "gb-ni-sdz-low-fill"], type: "gbSmallAreaBoundaries" },
  { layers: ["gb-admin-lad-fill"], type: "gbAdminBoundaries" },
  ],
  // <codemod:append GB_PACK_CLICK_SLOTS>
};
