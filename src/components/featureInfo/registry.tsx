// FeatureInfo popup 的 renderer registry — layerType → panel 元件 + 標題。
//
// 新增 layer 的 popup 接線只要：寫 panel 元件（放對應 domain 檔）→ 此處
// 各加一行。layerConsistency / featureInfoRegistry 測試會守備漏接。
import type { FC } from "react";
import type { FeatureInfo } from "../../types";
import {
  SubmarineCablePanel, LandingStationPanel, SchoolPanel, ConvenienceStorePanel,
  LighthousePanel, PortPanel, AirportPanel, CctvPanel, EtcGantryPanel,
  ServiceAreaPanel, ServiceAreaPolygonPanel, TaxiStandPanel,
} from "./infraPanels";
import {
  WeatherStationPanel, BikeStationPanel, BusStationPanel, RailStationPanel,
} from "./transportPanels";
import {
  WaterFacilityPanel, WaterMonitorPanel, WaterDetentionBasinPanel, WaterDamPanel,
  RiverLevelPanel, GroundwaterPanel, FloodSensorPanel, RainGaugePanel,
  WaterReservoirPolyPanel,
} from "./waterPanels";
import { TaipeiSewerPanel, TaipeiPumbPanel, TaipeiEvacuatePanel } from "./taipeiWicPanels";
import { NewsEventPanel, DisasterAlertPanel, RoadEventPanel, ActiveFaultPanel } from "./eventPanels";
import { AqiStationPanel, MicroSensorPanel } from "./airPanels";
import { WasteFacilityPanel, WasteDisposalPointPanel } from "./wastePanels";
import {
  AgriSoilPanel, AgriSoilFertilityPanel, AgriLeisureFarmZonesPanel, AgriCropSuitabilityPanel,
  AgriRuralRegenPanel, AgriPOIPanel, AgriCompanyPanel, FarmRoadsPanel, EcoNetworkZonesPanel,
} from "./agriPanels";
import { HikingTrailsPanel, ForestryGenericPanel } from "./forestryPanels";
import { FireEventPanel, FireStationPanel, FireHydrantPanel, FireIsochronePanel } from "./firePanels";
import { MedicalPOIPanel, MedicalIsochronePanel } from "./medicalPanels";

export interface PanelProps {
  props: Record<string, unknown>;
}

/**
 * layerType → panel 元件。
 * Partial：groundwaterWell / iotWraRiver / iotWraStructure 自始沒有專屬 panel
 * （popup 只顯示 header），維持原行為 — 見 featureInfoRegistry 測試的 baseline。
 */
export const PANEL_REGISTRY: Partial<Record<FeatureInfo["layerType"], FC<PanelProps>>> = {
  submarineCable: SubmarineCablePanel,
  landingStation: LandingStationPanel,
  school: SchoolPanel,
  convenienceStore: ConvenienceStorePanel,
  weatherStation: WeatherStationPanel,
  bikeStation: BikeStationPanel,
  busStation: BusStationPanel,
  lighthouse: LighthousePanel,
  railStation: RailStationPanel,
  port: PortPanel,
  airport: AirportPanel,
  cctv: CctvPanel,
  etcGantry: EtcGantryPanel,
  serviceArea: ServiceAreaPanel,
  serviceAreaPolygon: ServiceAreaPolygonPanel,
  taxiStand: TaxiStandPanel,
  activeFault: ActiveFaultPanel,
  newsEvent: NewsEventPanel,
  disasterAlert: DisasterAlertPanel,
  roadEvent: RoadEventPanel,
  aqiStation: AqiStationPanel,
  microSensor: MicroSensorPanel,
  waterFacility: WaterFacilityPanel,
  waterMonitor: WaterMonitorPanel,
  waterDam: WaterDamPanel,
  waterReservoirPoly: WaterReservoirPolyPanel,
  waterDetentionBasin: WaterDetentionBasinPanel,
  rainGauge: RainGaugePanel,
  riverLevel: RiverLevelPanel,
  groundwater: GroundwaterPanel,
  floodSensor: FloodSensorPanel,
  floodSensorIsochrone: FloodSensorPanel,
  taipeiSewer: TaipeiSewerPanel,
  taipeiEvacuate: TaipeiEvacuatePanel,
  taipeiPumb: TaipeiPumbPanel,
  wasteFacility: WasteFacilityPanel,
  wasteDisposalPoint: WasteDisposalPointPanel,
  agriRetail: AgriCompanyPanel,
  agriProduceWholesale: AgriCompanyPanel,
  agriWholesaleMarket: AgriCompanyPanel,
  farmRoads: FarmRoadsPanel,
  ecoNetworkZones: EcoNetworkZonesPanel,
  forestryPolygon: ForestryGenericPanel,
  forestryLine: ForestryGenericPanel,
  forestryPOI: ForestryGenericPanel,
  hikingTrails: HikingTrailsPanel,
  agriPOI: AgriPOIPanel,
  agriRuralRegen: AgriRuralRegenPanel,
  agriSoil: AgriSoilPanel,
  agriSoilFertility: AgriSoilFertilityPanel,
  agriLeisureFarmZones: AgriLeisureFarmZonesPanel,
  agriCropSuitability: AgriCropSuitabilityPanel,
  fireEvent: FireEventPanel,
  fireStation: FireStationPanel,
  fireHydrant: FireHydrantPanel,
  fireIsochrone: FireIsochronePanel,
  medicalPOI: MedicalPOIPanel,
  medicalIsochrone: MedicalIsochronePanel,
};

export const HEADER_LABELS: Record<FeatureInfo["layerType"], string> = {
  submarineCable: "通訊海纜",
  landingStation: "海纜登陸站",
  school: "學校",
  convenienceStore: "超商",
  weatherStation: "氣象站",
  bikeStation: "公共自行車站",
  busStation: "公車站",
  lighthouse: "燈塔",
  railStation: "車站",
  port: "港口",
  airport: "機場",
  cctv: "道路攝影機",
  etcGantry: "ETC 收費門架",
  serviceArea: "國道服務區",
  serviceAreaPolygon: "國道服務區範圍",
  taxiStand: "計程車招呼站",
  activeFault: "活動斷層",
  newsEvent: "新聞事件",
  disasterAlert: "災害示警",
  roadEvent: "即時路況",
  aqiStation: "空氣品質測站",
  microSensor: "微型感測器",
  waterFacility: "水利設施",
  waterMonitor: "水資源監測站",
  waterDam: "水庫 / 壩體",
  waterReservoirPoly: "水庫蓄水範圍",
  waterDetentionBasin: "滯洪池",
  rainGauge: "即時雨量站",
  riverLevel: "河川水位站",
  groundwater: "地下水井",
  groundwaterWell: "地下水井",
  iotWraRiver: "IoT 河川水位站",
  iotWraStructure: "IoT 水工結構",
  floodSensor: "都市淹水感測器",
  floodSensorIsochrone: "淹水 3 分步行圈",
  taipeiSewer: "北市雨水下水道水位",
  taipeiEvacuate: "北市疏散門",
  taipeiPumb: "北市抽水站",
  wasteFacility: "垃圾處理設施",
  wasteDisposalPoint: "垃圾投放點",
  agriPOI: "農業 POI",
  agriRuralRegen: "農村再生社區",
  agriSoil: "土壤分類",
  agriSoilFertility: "土壤肥力",
  agriLeisureFarmZones: "休閒農業區",
  agriCropSuitability: "作物適栽",
  agriRetail: "農產零售商",
  agriProduceWholesale: "蔬果批發商",
  agriWholesaleMarket: "農產批發市場",
  farmRoads: "農路",
  ecoNetworkZones: "國土綠網分區",
  forestryPolygon: "林業面 (polygon)",
  forestryLine: "林業線 (line)",
  forestryPOI: "林業點位 (POI)",
  hikingTrails: "步道",
  fireEvent: "火災事件",
  fireStation: "消防分隊",
  fireIsochrone: "救援等時圈",
  fireHydrant: "消防栓",
  medicalPOI: "醫療據點",
  medicalIsochrone: "醫療等時圈",
};
