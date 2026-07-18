import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, PointLike, MapLayerMouseEvent } from "mapbox-gl";
import type { Flight, RailTrain, BusVehicle, FeatureInfo, LayerVisibility, RealEstateTooltipInfo } from "../types";
import { DISASTER_ALERT_CLICK_LAYERS } from "./useDisasterAlertLayer";
import type { FlightScene } from "../three/FlightScene";
import type { ShipScene } from "../three/ShipScene";
import type { RailScene } from "../three/RailScene";
import type { BusScene } from "../three/BusScene";
import type { ReservoirScene } from "../three/ReservoirScene";
import type { WasteScheduleScene, ScheduleDebugFrame } from "../three/WasteScheduleScene";
import { compareIdFromReservoirId } from "../data/reservoirStatusLoader";
import { sampleClimateFields } from "../data/climateFieldSampler";
import { sessionTracker } from "../lib/sessionTracker";

interface TooltipInfo {
  flight: Flight;
  x: number;
  y: number;
  altitude: number | null;
}

interface TrainTooltipInfo {
  train: RailTrain;
  x: number;
  y: number;
}

interface BusTooltipInfo {
  bus: BusVehicle;
  x: number;
  y: number;
}

export interface WasteScheduleTooltipInfo {
  frame: ScheduleDebugFrame;
  x: number;
  y: number;
}

export function useMapInteraction(
  mapRef: React.RefObject<MapboxMap | null>,
  flightSceneRef: React.RefObject<FlightScene | null>,
  flightsRef: React.RefObject<Flight[]>,
  timeRef: React.RefObject<number>,
  railSceneRef?: React.RefObject<RailScene | null>,
  busSceneRef?: React.RefObject<BusScene | null>,
  shipSceneRef?: React.RefObject<ShipScene | null>,
  layerVisibilityRef?: React.RefObject<LayerVisibility>,
  reservoirSceneRef?: React.RefObject<ReservoirScene | null>,
  wasteScheduleSceneRef?: React.RefObject<WasteScheduleScene | null>,
  touristShuttleSceneRef?: React.RefObject<BusScene | null>,
) {
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<TooltipInfo | null>(null);
  const [trainTooltipInfo, setTrainTooltipInfo] = useState<TrainTooltipInfo | null>(null);
  const [busTooltipInfo, setBusTooltipInfo] = useState<BusTooltipInfo | null>(null);
  const [wasteScheduleTooltipInfo, setWasteScheduleTooltipInfo] = useState<WasteScheduleTooltipInfo | null>(null);
  const [realEstateTooltipInfo, setRealEstateTooltipInfo] = useState<RealEstateTooltipInfo | null>(null);
  const [featureInfo, setFeatureInfo] = useState<FeatureInfo | null>(null);
  const clickBoundRef = useRef(false);

  const bindEvents = (map: MapboxMap) => {
    if (clickBoundRef.current) return;
    clickBoundRef.current = true;

    map.on("click", (e) => {
      const container = map.getContainer();
      const w = container.clientWidth;
      const h = container.clientHeight;

      const vis = layerVisibilityRef?.current;

      // 先嘗試拾取列車（僅在 rail 圖層開啟時）
      if (vis?.rail) {
        const railScene = railSceneRef?.current;
        if (railScene) {
          const train = railScene.pickTrain(e.point.x, e.point.y, w, h);
          if (train) {
            setTrainTooltipInfo({ train, x: e.point.x, y: e.point.y });
            setTooltipInfo(null);
            return;
          }
        }
      }

      // 嘗試拾取垃圾車表定（debug 點選看哪條路線 / 班次）
      if (vis?.wasteSchedule) {
        const ws = wasteScheduleSceneRef?.current;
        if (ws) {
          const frame = ws.pickRoute(e.point.x, e.point.y, w, h);
          if (frame) {
            setWasteScheduleTooltipInfo({ frame, x: e.point.x, y: e.point.y });
            setTooltipInfo(null);
            setTrainTooltipInfo(null);
            setBusTooltipInfo(null);
            return;
          }
        }
      }

      // 嘗試拾取公車（僅在 busLive 圖層開啟時）
      if (vis?.busLive) {
        const busScene = busSceneRef?.current;
        if (busScene) {
          const bus = busScene.pickBus(e.point.x, e.point.y, w, h);
          if (bus) {
            setBusTooltipInfo({ bus, x: e.point.x, y: e.point.y });
            setTooltipInfo(null);
            setTrainTooltipInfo(null);
            return;
          }
        }
      }

      // 嘗試拾取台灣好行（僅在 touristShuttleLive 圖層開啟時，共用 bus tooltip）
      if (vis?.touristShuttleLive) {
        const shuttleScene = touristShuttleSceneRef?.current;
        if (shuttleScene) {
          const bus = shuttleScene.pickBus(e.point.x, e.point.y, w, h);
          if (bus) {
            setBusTooltipInfo({ bus, x: e.point.x, y: e.point.y });
            setTooltipInfo(null);
            setTrainTooltipInfo(null);
            return;
          }
        }
      }


      // 嘗試拾取船舶（以目前船頭圓點為準）
      if (vis?.ships) {
        const shipScene = shipSceneRef?.current;
        if (shipScene) {
          const hit = shipScene.pickShip(e.point.x, e.point.y, w, h);
          if (hit) {
            setFeatureInfo({
              layerType: "ship",
              properties: {
                mmsi: hit.ship.mmsi,
                vessel_type: hit.ship.vessel_type,
                lat: hit.lat,
                lon: hit.lng,
                timestamp: hit.timestamp,
              },
              coords: [hit.lng, hit.lat],
            });
            setTooltipInfo(null);
            setTrainTooltipInfo(null);
            setBusTooltipInfo(null);
            setWasteScheduleTooltipInfo(null);
            return;
          }
        }
      }

      // 再嘗試拾取飛機（僅在 flights 圖層開啟時）
      if (vis?.flights) {
        const scene = flightSceneRef.current;
        if (scene) {
          const flightId = scene.pickFlight(e.point.x, e.point.y, w, h);
          if (flightId) {
            const flight = flightsRef.current.find((f) => f.fr24_id === flightId);
            if (flight) {
              let altitude: number | null = null;
              const t = timeRef.current;
              for (let i = flight.path.length - 1; i >= 0; i--) {
                if (flight.path[i]![3] <= t) { altitude = Math.round(flight.path[i]![2]); break; }
              }
              setTooltipInfo({ flight, x: e.point.x, y: e.point.y, altitude });
              setTrainTooltipInfo(null);
              return;
            }
          }
        }
      }

      // 嘗試拾取水庫 3D 水位計（僅在 waterReservoirs 圖層開啟時）
      if (vis?.waterReservoirs) {
        const reservoirScene = reservoirSceneRef?.current;
        if (reservoirScene) {
          const hit = reservoirScene.pickReservoir(e.point.x, e.point.y, w, h);
          if (hit) {
            const compareId = compareIdFromReservoirId(hit.reservoir_id);
            setFeatureInfo({
              layerType: "waterDam",
              properties: {
                kind: "reservoir",
                name: hit.name,
                compare_id: compareId,
                capacity_m3: (hit.effective_capacity_wan ?? 0) * 10000,
                is_reservoir: true,
              },
            });
            setTooltipInfo(null);
            setTrainTooltipInfo(null);
            setBusTooltipInfo(null);
            return;
          }
        }
      }

      // 未命中 Three.js 物件 → 清空 tooltip，查詢 GIS 圖層
      setTooltipInfo(null);
      setTrainTooltipInfo(null);
      setBusTooltipInfo(null);
      setWasteScheduleTooltipInfo(null);

      {
        // 查詢 Mapbox GIS 層
        const GIS_LAYERS: { layers: string[]; type: FeatureInfo["layerType"] }[] = [
          { layers: ["road-congestion-hit"], type: "roadCongestion" },
          { layers: ["submarine-cables-line", "submarine-cables-glow"], type: "submarineCable" },
          { layers: ["landing-stations-circle", "landing-stations-glow"], type: "landingStation" },
          { layers: ["schools-circle", "schools-glow"], type: "school" },
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
          { layers: ["hazard-nuclear-core", "hazard-nuclear-halo"], type: "nuclearStation" },
          // 全球氣候 GLOBAL CLIMATE
          { layers: ["earthquakes-global-circle"], type: "earthquakeGlobal" },
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
          { layers: ["aquaculture-integrated-fill", "aquaculture-integrated-line"], type: "aquacultureIntegrated" },
          { layers: ["street-trees-taipei-diff-circle"], type: "streetTreesTaipeiDiff" },
          { layers: ["protected-trees-national-circle"], type: "protectedTreesNational" },
          { layers: ["riverside-trees-taipei-circle"], type: "riversideTreesTaipei" },
          { layers: ["parks-taipei-circle"], type: "parksTaipei" },
          { layers: ["street-trees-taipei-3epoch-circle"], type: "streetTreesTaipei3epoch" },
          { layers: ["street-trees-national-circle"], type: "streetTreesNational" },
          { layers: ["tree-pits-taipei-fill", "tree-pits-taipei-line"], type: "treePitsTaipei" },
          { layers: ["buildings-gba-fill", "buildings-gba-extrusion"], type: "buildingsGba" },
          { layers: ["urban-form-grid-fill"], type: "urbanFormGrid" },
          { layers: ["urban-zoning-taipei-fill"], type: "urbanZoningTaipei" },
          { layers: ["urban-zoning-newtaipei-fill"], type: "urbanZoningNewTaipei" },
          { layers: ["sports-venues-school", "sports-venues-public-other", "sports-venues-private", "sports-venues-park", "sports-venues-center"], type: "sportsVenue" },
          { layers: ["culture-facilities-circle"], type: "culturalFacilities" },
          { layers: ["culture-museums-circle"], type: "culturalMuseums" },
          { layers: ["culture-events-circle"], type: "artsEvents" },
          { layers: ["culture-venues-circle"], type: "performingVenues" },
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
          { layers: ["groundwater-circle", "groundwater-glow"], type: "groundwater" },
          { layers: ["flood-sensor-dot", "flood-sensor-glow"], type: "floodSensor" },
          { layers: ["flood-sensor-isochrone-fill"], type: "floodSensorIsochrone" },
          { layers: ["taipei-sewer-dot"], type: "taipeiSewer" },
          { layers: ["taipei-evac-dot"], type: "taipeiEvacuate" },
          { layers: ["taipei-pumb-dot", "taipei-pumb-glow"], type: "taipeiPumb" },
          { layers: ["agri-pois-circle"], type: "agriPOI" },
          { layers: ["agri-wholesale-market-circle"], type: "agriWholesaleMarket" },
          { layers: ["agri-produce-wholesale-circle"], type: "agriProduceWholesale" },
          { layers: ["agri-retail-circle"], type: "agriRetail" },
          { layers: ["farm-roads-line", "farm-roads-glow"], type: "farmRoads" },
          { layers: ["hiking-trails-line", "hiking-trails-glow"], type: "hikingTrails" },
          { layers: ["eco-network-zones-fill"], type: "ecoNetworkZones" },
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
          // Base map（行政邊界 / 等高線 / OSM 路網）— 小範圍優先（村→鄉→縣），等高線最末避免擋住
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
        ];
        const bbox: [PointLike, PointLike] = [
          [e.point.x - 5, e.point.y - 5],
          [e.point.x + 5, e.point.y + 5],
        ];
        let found = false;
        for (const { layers: layerIds, type } of GIS_LAYERS) {
          const existingIds = layerIds.filter((id) => map.getLayer(id));
          if (existingIds.length === 0) continue;
          const features = map.queryRenderedFeatures(bbox, { layers: existingIds });
          if (features.length > 0) {
            const f = features[0]!;
            let coords: [number, number] | undefined;
            const g = f.geometry as GeoJSON.Geometry | undefined;
            if (g && g.type === "Point") {
              const c = (g as GeoJSON.Point).coordinates;
              if (typeof c[0] === "number" && typeof c[1] === "number") {
                coords = [c[0], c[1]];
              }
            }
            if (!coords) coords = [e.lngLat.lng, e.lngLat.lat];
            // roadCongestion 的 level 在 feature-state（非 baked properties）→ 併入
            const properties = type === "roadCongestion"
              ? { ...(f.properties ?? {}), ...(f.state ?? {}) }
              : (f.properties ?? {});
            setFeatureInfo({ layerType: type, properties, coords });
            sessionTracker.log("feature_click", { layerType: type });
            found = true;
            break;
          }
        }
        // 沒命中任何向量 feature → 風場/海流開啟時改讀氣候 UV 場（nullschool 式點擊讀值）
        if (!found) {
          if (vis?.windField || vis?.oceanCurrents) {
            const lng = e.lngLat.lng;
            const lat = e.lngLat.lat;
            void sampleClimateFields(
              { wind: !!vis?.windField, currents: !!vis?.oceanCurrents },
              lng, lat,
            ).then((sample) => {
              if (sample) {
                setFeatureInfo({
                  layerType: "climateField",
                  properties: { wind: sample.wind, currents: sample.currents },
                  coords: [lng, lat],
                });
                sessionTracker.log("feature_click", { layerType: "climateField" });
              } else {
                setFeatureInfo(null);
              }
            });
          } else {
            setFeatureInfo(null);
          }
        }
      }
    });

    map.on("dblclick", (e) => {
      if (!layerVisibilityRef?.current?.flights) return;
      const scene = flightSceneRef.current;
      if (!scene) return;
      const container = map.getContainer();
      const flightId = scene.pickFlight(
        e.point.x, e.point.y,
        container.clientWidth, container.clientHeight,
      );
      if (flightId) {
        e.preventDefault();
        // 再次雙擊同一架 → 取消跟隨
        setSelectedFlightId((prev) => (prev === flightId ? null : flightId));
        setTooltipInfo(null);
        setTrainTooltipInfo(null);
        setBusTooltipInfo(null);
      }
    });

    // 使用者主動拖曳 / 滾輪縮放 / 旋轉 → 解除跟隨
    map.on("dragstart", () => setSelectedFlightId(null));
    map.on("wheel", () => setSelectedFlightId(null));
    map.on("rotatestart", () => setSelectedFlightId(null));
    map.on("pitchstart", () => setSelectedFlightId(null));
    map.on("move", () => { setTooltipInfo(null); setTrainTooltipInfo(null); setBusTooltipInfo(null); setRealEstateTooltipInfo(null); });

    // 房地產 hover tooltip（滑鼠移上即顯示，非 click）。layer 尚未建立先綁無害（mapbox 容忍）。
    const reMove = (kind: "grid" | "point") => (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      map.getCanvas().style.cursor = "pointer";
      setRealEstateTooltipInfo({ x: e.point.x, y: e.point.y, kind, properties: f.properties ?? {} });
    };
    const reLeave = () => {
      map.getCanvas().style.cursor = "";
      setRealEstateTooltipInfo(null);
    };
    for (const id of ["re-grid-rental-fill", "re-grid-sale-fill", "re-grid-presale-fill"]) {
      map.on("mousemove", id, reMove("grid"));
      map.on("mouseleave", id, reLeave);
    }
    // 點 hover 暫時移除：point 已改 WebGL CustomLayer，不支援 queryRenderedFeatures（待補 GPU/空間索引 picking）
  };

  // ESC 鍵取消跟隨
  useEffect(() => {
    if (!selectedFlightId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedFlightId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedFlightId]);

  // 雙擊追蹤：相機鎖定飛機
  useEffect(() => {
    if (!selectedFlightId) return;
    const map = mapRef.current;
    if (!map) return;

    let animId: number;
    const tick = () => {
      const flight = flightsRef.current.find((f) => f.fr24_id === selectedFlightId);
      if (flight && flight.path.length > 0) {
        const t = timeRef.current;
        const path = flight.path;
        let lat: number, lng: number;
        if (t <= path[0]![3]) {
          lat = path[0]![0]; lng = path[0]![1];
        } else if (t >= path[path.length - 1]![3]) {
          lat = path[path.length - 1]![0]; lng = path[path.length - 1]![1];
        } else {
          lat = path[0]![0]; lng = path[0]![1];
          for (let i = 1; i < path.length; i++) {
            if (path[i]![3] >= t) {
              const a = path[i - 1]!;
              const b = path[i]!;
              const r = (t - a[3]) / (b[3] - a[3]);
              lat = a[0] + (b[0] - a[0]) * r;
              lng = a[1] + (b[1] - a[1]) * r;
              break;
            }
          }
        }
        map.setCenter([lng, lat]);
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [selectedFlightId, mapRef, flightsRef, timeRef]);

  return {
    tooltipInfo, setTooltipInfo,
    trainTooltipInfo, setTrainTooltipInfo,
    busTooltipInfo, setBusTooltipInfo,
    wasteScheduleTooltipInfo, setWasteScheduleTooltipInfo,
    realEstateTooltipInfo, setRealEstateTooltipInfo,
    featureInfo, setFeatureInfo,
    selectedFlightId, setSelectedFlightId,
    bindEvents,
  };
}
