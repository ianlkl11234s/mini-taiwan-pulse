import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import {
  fetchPowerPlants,
  invalidatePowerPlants,
  fetchOsmSubstations,
  fetchOsmPowerLines,
  fetchOsmPowerTowers,
  fetchOsmWindTurbines,
  fetchOsmSolarFarms,
  fetchOsmPowerPlantsStatic,
  fetchOffshoreWindZones,
  fetchIslandPowerGrid,
  fetchFossilFuelInfra,
  fetchGeothermalWells,
  fetchRenewablePermitsTaipei,
  fetchEvCharging,
  // Phase 8 SSOT 6-layer
  fetchFacPrimary,
  fetchFacOffshore,
  fetchFacPlanned,
  fetchFacHistorical,
  fetchFacSecondary,
  fetchFacOsmSupplement,
  facilityFuelColor,
  fuelColorOf,
  radiusForCapacity,
  powerLineTierKv,
  type PowerPlantRow,
  type OsmSubstation,
  type OsmPowerLine,
  type OsmPowerTower,
  type OsmWindTurbine,
  type OsmSolarFarm,
  type OsmPowerPlantStatic,
  type OffshoreWindZone,
  type EvChargingStation,
  type FacilityPoint,
  type FacilityZone,
} from "../data/energyLoader";

/**
 * Energy 三 POI 圖層資料供應（layer 1 / 5 / 6）
 *
 * - power_plants  : 每 5 min 重抓（output_load_rate 會變動，影響 popup 顯示）
 * - substations   : 載一次，無 polling
 * - ev_charging   : 載一次，無 polling
 *
 * 樣式 (circle radius / color expression / opacity) 在 overlayRegistry 中定義；
 * 本 hook 只負責 setData。資料缺位時 source 維持空 FeatureCollection。
 */

const SRC_PLANTS = "energy-power-plants";
const SRC_SUBSTATIONS = "energy-substations";
const SRC_POWER_LINES = "energy-power-lines";
const SRC_POWER_TOWERS = "energy-power-towers";
const SRC_WIND_TURBINES = "energy-wind-turbines";
const SRC_SOLAR_FARMS = "energy-solar-farms";
const SRC_OSM_POWER_PLANTS_STATIC = "energy-osm-power-plants-static";
const SRC_OFFSHORE_WIND = "energy-offshore-wind-zones";
const SRC_ISLAND_GRID = "energy-island-grid";
const SRC_FOSSIL_FUEL = "energy-fossil-fuel";
const SRC_GEOTHERMAL = "energy-geothermal-wells";
const SRC_TAIPEI_RE = "energy-taipei-re";
const SRC_EV = "energy-ev-charging";
// Phase 8 SSOT 6-layer
const SRC_FAC_PRIMARY = "energy-fac-primary";
const SRC_FAC_OFFSHORE = "energy-fac-offshore";
const SRC_FAC_PLANNED = "energy-fac-planned";
const SRC_FAC_HISTORICAL = "energy-fac-historical";
const SRC_FAC_SECONDARY = "energy-fac-secondary";
const SRC_FAC_OSM_SUPPLEMENT = "energy-fac-osm-supplement";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const PLANT_POLL_MS = 5 * 60_000;

// 已除役廠房用退色版本，視覺上明顯區分（不直接灰色因為跟 NULL/未知混淆）
const RETIRED_COLOR = "#7c6b3a"; // 暗黃褐色（核能黃 #facc15 降飽和）

function plantsToGeoJSON(rows: PowerPlantRow[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    if (!Number.isFinite(r.lon) || !Number.isFinite(r.lat)) continue;
    const isRetired = r.status === "retired";
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        source_table: r.source_table,
        source_id: r.source_id ?? "",
        facility_id: r.facility_id ?? "", // SSOT: 給 popup lazy fetch provenance 用
        name: r.name ?? "",
        fuel_type: r.fuel_type ?? "",
        capacity_mw: r.capacity_mw,
        output_mw: r.output_mw,
        output_load_rate: r.output_load_rate,
        status: r.status ?? "",
        status_note: r.status_note ?? "",
        is_retired: isRetired,
        radius: radiusForCapacity(r.capacity_mw),
        color: isRetired ? RETIRED_COLOR : fuelColorOf(r.fuel_type),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function substationsToGeoJSON(rows: OsmSubstation[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rows
      .filter((r) => Number.isFinite(r.lon) && Number.isFinite(r.lat))
      .map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lon, r.lat] },
        properties: {
          osm_id: r.osm_id,
          name: r.name ?? "",
          operator: r.operator ?? "",
          voltage: r.voltage ?? "",
          substation_type: r.substation_type ?? "",
          // migration 235：電網層級分類
          class: r.class ?? "OTHER",
          class_label: r.class_label ?? "未分類",
          class_rank: r.class_rank ?? 9,
        },
      })),
  };
}

function powerLinesToGeoJSON(rows: OsmPowerLine[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    if (!r.geom_json) continue;
    features.push({
      type: "Feature",
      geometry: r.geom_json,
      properties: {
        osm_id: r.osm_id,
        line_type: r.line_type ?? "line",
        voltage: r.voltage ?? "",
        circuits: r.circuits ?? "",
        operator: r.operator ?? "",
        frequency: r.frequency ?? "",
        location: r.location ?? "",
        tier: powerLineTierKv(r.voltage), // 345/161/69/0
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function powerTowersToGeoJSON(rows: OsmPowerTower[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    if (!Number.isFinite(r.lon) || !Number.isFinite(r.lat)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        osm_id: r.osm_id,
        voltage: r.voltage ?? "",
        operator: r.operator ?? "",
        material: r.material ?? "",
        design: r.design ?? "",
        ref: r.ref ?? "",
        tier: powerLineTierKv(r.voltage),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function windTurbinesToGeoJSON(rows: OsmWindTurbine[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    if (!Number.isFinite(r.lon) || !Number.isFinite(r.lat)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        osm_id: r.osm_id,
        name: r.name ?? "",
        operator: r.operator ?? "",
        manufacturer: r.manufacturer ?? "",
        model: r.model ?? "",
        height_m: r.height_m,
        rotor_diameter_m: r.rotor_diameter_m,
        capacity_mw: r.capacity_mw,
        is_offshore: r.is_offshore,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function solarFarmsToGeoJSON(rows: OsmSolarFarm[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    if (!Number.isFinite(r.lon) || !Number.isFinite(r.lat)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        osm_id: r.osm_id,
        name: r.name ?? "",
        operator: r.operator ?? "",
        plant_source: r.plant_source ?? "",
        plant_method: r.plant_method ?? "",
        capacity_mw: r.capacity_mw,
        modules: r.modules,
        area_m2: r.area_m2,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function osmPowerPlantsStaticToGeoJSON(rows: OsmPowerPlantStatic[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    if (!Number.isFinite(r.lon) || !Number.isFinite(r.lat)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        osm_id: r.osm_id,
        name: r.name ?? "",
        power: r.power ?? "",
        plant_source: r.plant_source ?? "",
        plant_method: r.plant_method ?? "",
        generator_source: r.generator_source ?? "",
        operator: r.operator ?? "",
        capacity_mw: r.capacity_mw,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function offshoreWindZonesToGeoJSON(rows: OffshoreWindZone[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    if (!r.geom_json) continue;
    features.push({
      type: "Feature",
      geometry: r.geom_json,
      properties: {
        zone_code: r.zone_code ?? "",
        zone_name: r.zone_name ?? "",
        zone_type: r.zone_type ?? "",
        phase: r.phase ?? "",
        developer: r.developer ?? "",
        capacity_mw: r.capacity_mw,
        award_year: r.award_year,
        cod_year: r.cod_year,
        depth_min_m: r.depth_min_m,
        depth_max_m: r.depth_max_m,
        distance_km: r.distance_km,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function pointRowsToGeoJSON<T extends { lon: number; lat: number }>(
  rows: T[],
  pickProps: (r: T) => Record<string, unknown>,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    if (!Number.isFinite(r.lon) || !Number.isFinite(r.lat)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: pickProps(r),
    });
  }
  return { type: "FeatureCollection", features };
}

function evToGeoJSON(rows: EvChargingStation[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rows
      .filter((r) => Number.isFinite(r.lon) && Number.isFinite(r.lat))
      .map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lon, r.lat] },
        properties: {
          station_id: r.station_id,
          name: r.name ?? "",
          operator_name: r.operator_name ?? "",
          address: r.address ?? "",
          charging_points: r.charging_points,
          spaces: r.spaces,
          source: r.source ?? "",
        },
      })),
  };
}

function useSourceFeed(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  sourceId: string,
  fcRef: React.MutableRefObject<GeoJSON.FeatureCollection | null>,
) {
  const feed = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(fcRef.current ?? EMPTY_FC);
  }, [mapRef, sourceId, fcRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    const onStyleLoad = () => feed();
    map.on("style.load", onStyleLoad);
    feed();
    return () => {
      map.off("style.load", onStyleLoad);
    };
  }, [mapRef, visible, feed]);

  return feed;
}

export interface UseEnergyPoiLayerOpts {
  showPlants: boolean;
  showSubstations: boolean;
  showPowerLines: boolean;
  showPowerTowers: boolean;
  showWindTurbines: boolean;
  showSolarFarms: boolean;
  showOsmPowerPlantsStatic: boolean;
  showOffshoreWindZones: boolean;
  showIslandPowerGrid: boolean;
  showFossilFuelInfra: boolean;
  showGeothermalWells: boolean;
  showRenewablePermitsTaipei: boolean;
  showEvCharging: boolean;
  // Phase 8 SSOT 6-layer
  showFacPrimary: boolean;
  showFacOffshore: boolean;
  showFacPlanned: boolean;
  showFacHistorical: boolean;
  showFacSecondary: boolean;
  showFacOsmSupplement: boolean;
}

export function useEnergyPoiLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  {
    showPlants, showSubstations, showPowerLines, showPowerTowers,
    showWindTurbines, showSolarFarms, showOsmPowerPlantsStatic,
    showOffshoreWindZones, showIslandPowerGrid, showFossilFuelInfra,
    showGeothermalWells, showRenewablePermitsTaipei,
    showEvCharging,
    showFacPrimary, showFacOffshore, showFacPlanned, showFacHistorical,
    showFacSecondary, showFacOsmSupplement,
  }: UseEnergyPoiLayerOpts,
) {
  const plantsFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const subsFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const linesFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const towersFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const windFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const solarFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const osmPlantsFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const offshoreFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const islandFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const fossilFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const geothermalFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const taipeiReFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const evFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  // Phase 8 SSOT 6-layer
  const facPrimaryRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const facOffshoreRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const facPlannedRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const facHistoricalRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const facSecondaryRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const facOsmSupplementRef = useRef<GeoJSON.FeatureCollection | null>(null);

  const feedPlants = useSourceFeed(mapRef, showPlants, SRC_PLANTS, plantsFcRef);
  const feedSubs = useSourceFeed(mapRef, showSubstations, SRC_SUBSTATIONS, subsFcRef);
  const feedLines = useSourceFeed(mapRef, showPowerLines, SRC_POWER_LINES, linesFcRef);
  const feedTowers = useSourceFeed(mapRef, showPowerTowers, SRC_POWER_TOWERS, towersFcRef);
  const feedWind = useSourceFeed(mapRef, showWindTurbines, SRC_WIND_TURBINES, windFcRef);
  const feedSolar = useSourceFeed(mapRef, showSolarFarms, SRC_SOLAR_FARMS, solarFcRef);
  const feedOsmPlants = useSourceFeed(mapRef, showOsmPowerPlantsStatic, SRC_OSM_POWER_PLANTS_STATIC, osmPlantsFcRef);
  const feedOffshore = useSourceFeed(mapRef, showOffshoreWindZones, SRC_OFFSHORE_WIND, offshoreFcRef);
  const feedIsland = useSourceFeed(mapRef, showIslandPowerGrid, SRC_ISLAND_GRID, islandFcRef);
  const feedFossil = useSourceFeed(mapRef, showFossilFuelInfra, SRC_FOSSIL_FUEL, fossilFcRef);
  const feedGeothermal = useSourceFeed(mapRef, showGeothermalWells, SRC_GEOTHERMAL, geothermalFcRef);
  const feedTaipeiRE = useSourceFeed(mapRef, showRenewablePermitsTaipei, SRC_TAIPEI_RE, taipeiReFcRef);
  const feedEv = useSourceFeed(mapRef, showEvCharging, SRC_EV, evFcRef);
  const feedFacPrimary       = useSourceFeed(mapRef, showFacPrimary,       SRC_FAC_PRIMARY,        facPrimaryRef);
  const feedFacOffshore      = useSourceFeed(mapRef, showFacOffshore,      SRC_FAC_OFFSHORE,       facOffshoreRef);
  const feedFacPlanned       = useSourceFeed(mapRef, showFacPlanned,       SRC_FAC_PLANNED,        facPlannedRef);
  const feedFacHistorical    = useSourceFeed(mapRef, showFacHistorical,    SRC_FAC_HISTORICAL,     facHistoricalRef);
  const feedFacSecondary     = useSourceFeed(mapRef, showFacSecondary,     SRC_FAC_SECONDARY,      facSecondaryRef);
  const feedFacOsmSupplement = useSourceFeed(mapRef, showFacOsmSupplement, SRC_FAC_OSM_SUPPLEMENT, facOsmSupplementRef);

  // power_plants：visible 時拉 + 每 5 min poll
  useEffect(() => {
    if (!showPlants) return;
    let cancelled = false;

    const load = () => {
      fetchPowerPlants()
        .then((rows) => {
          if (cancelled) return;
          plantsFcRef.current = plantsToGeoJSON(rows);
          feedPlants();
        })
        .catch((err) => console.warn("[Energy/plants] load failed:", err));
    };

    load();
    const t = window.setInterval(() => {
      invalidatePowerPlants();
      load();
    }, PLANT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [showPlants, feedPlants]);

  // substations：visible 時拉一次
  useEffect(() => {
    if (!showSubstations) return;
    let cancelled = false;
    fetchOsmSubstations()
      .then((rows) => {
        if (cancelled) return;
        subsFcRef.current = substationsToGeoJSON(rows);
        feedSubs();
      })
      .catch((err) => console.warn("[Energy/substations] load failed:", err));
    return () => {
      cancelled = true;
    };
  }, [showSubstations, feedSubs]);

  // power lines：visible 時拉一次（60min cache）
  useEffect(() => {
    if (!showPowerLines) return;
    let cancelled = false;
    fetchOsmPowerLines()
      .then((rows) => {
        if (cancelled) return;
        linesFcRef.current = powerLinesToGeoJSON(rows);
        feedLines();
      })
      .catch((err) => console.warn("[Energy/powerLines] load failed:", err));
    return () => {
      cancelled = true;
    };
  }, [showPowerLines, feedLines]);

  // power towers：visible 時拉一次（60min cache，26.6k 點）
  useEffect(() => {
    if (!showPowerTowers) return;
    let cancelled = false;
    fetchOsmPowerTowers()
      .then((rows) => {
        if (cancelled) return;
        towersFcRef.current = powerTowersToGeoJSON(rows);
        feedTowers();
      })
      .catch((err) => console.warn("[Energy/powerTowers] load failed:", err));
    return () => {
      cancelled = true;
    };
  }, [showPowerTowers, feedTowers]);

  // wind turbines：visible 時拉一次（60min cache）
  useEffect(() => {
    if (!showWindTurbines) return;
    let cancelled = false;
    fetchOsmWindTurbines()
      .then((rows) => {
        if (cancelled) return;
        windFcRef.current = windTurbinesToGeoJSON(rows);
        feedWind();
      })
      .catch((err) => console.warn("[Energy/windTurbines] load failed:", err));
    return () => { cancelled = true; };
  }, [showWindTurbines, feedWind]);

  // solar farms：visible 時拉一次（60min cache）
  useEffect(() => {
    if (!showSolarFarms) return;
    let cancelled = false;
    fetchOsmSolarFarms()
      .then((rows) => {
        if (cancelled) return;
        solarFcRef.current = solarFarmsToGeoJSON(rows);
        feedSolar();
      })
      .catch((err) => console.warn("[Energy/solarFarms] load failed:", err));
    return () => { cancelled = true; };
  }, [showSolarFarms, feedSolar]);

  // OSM power plants static：visible 時拉一次（60min cache）
  useEffect(() => {
    if (!showOsmPowerPlantsStatic) return;
    let cancelled = false;
    fetchOsmPowerPlantsStatic()
      .then((rows) => {
        if (cancelled) return;
        osmPlantsFcRef.current = osmPowerPlantsStaticToGeoJSON(rows);
        feedOsmPlants();
      })
      .catch((err) => console.warn("[Energy/osmPowerPlantsStatic] load failed:", err));
    return () => { cancelled = true; };
  }, [showOsmPowerPlantsStatic, feedOsmPlants]);

  // offshore wind zones：visible 時拉一次（36 polygon）
  useEffect(() => {
    if (!showOffshoreWindZones) return;
    let cancelled = false;
    fetchOffshoreWindZones()
      .then((rows) => {
        if (cancelled) return;
        offshoreFcRef.current = offshoreWindZonesToGeoJSON(rows);
        feedOffshore();
      })
      .catch((err) => console.warn("[Energy/offshoreWind] load failed:", err));
    return () => { cancelled = true; };
  }, [showOffshoreWindZones, feedOffshore]);

  // island power grid：visible 時拉一次（14 POI）
  useEffect(() => {
    if (!showIslandPowerGrid) return;
    let cancelled = false;
    fetchIslandPowerGrid()
      .then((rows) => {
        if (cancelled) return;
        islandFcRef.current = pointRowsToGeoJSON(rows, (r) => ({
          island: r.island ?? "",
          facility_type: r.facility_type ?? "",
          name: r.name ?? "",
          operator: r.operator ?? "",
          fuel_type: r.fuel_type ?? "",
          capacity_mw: r.capacity_mw,
          online_year: r.online_year,
          voltage_kv: r.voltage_kv,
          address: r.address ?? "",
          source: r.source ?? "",
        }));
        feedIsland();
      })
      .catch((err) => console.warn("[Energy/islandGrid] load failed:", err));
    return () => { cancelled = true; };
  }, [showIslandPowerGrid, feedIsland]);

  // fossil fuel infrastructure：visible 時拉一次（9 POI）
  useEffect(() => {
    if (!showFossilFuelInfra) return;
    let cancelled = false;
    fetchFossilFuelInfra()
      .then((rows) => {
        if (cancelled) return;
        fossilFcRef.current = pointRowsToGeoJSON(rows, (r) => ({
          facility_type: r.facility_type ?? "",
          name: r.name ?? "",
          operator: r.operator ?? "",
          content: r.content ?? "",
          capacity_tonnes: r.capacity_tonnes,
          capacity_kl: r.capacity_kl,
          daily_throughput_kbpd: r.daily_throughput_kbpd,
          address: r.address ?? "",
          online_year: r.online_year,
          status: r.status ?? "",
        }));
        feedFossil();
      })
      .catch((err) => console.warn("[Energy/fossilFuel] load failed:", err));
    return () => { cancelled = true; };
  }, [showFossilFuelInfra, feedFossil]);

  // geothermal wells：visible 時拉一次（36 POI）
  useEffect(() => {
    if (!showGeothermalWells) return;
    let cancelled = false;
    fetchGeothermalWells()
      .then((rows) => {
        if (cancelled) return;
        geothermalFcRef.current = pointRowsToGeoJSON(rows, (r) => ({
          county_code: r.county_code ?? "",
          geothermal_area: r.geothermal_area ?? "",
          report_name: r.report_name ?? "",
          figure_content: r.figure_content ?? "",
          report_url: r.report_url ?? "",
          figure_url: r.figure_url ?? "",
        }));
        feedGeothermal();
      })
      .catch((err) => console.warn("[Energy/geothermal] load failed:", err));
    return () => { cancelled = true; };
  }, [showGeothermalWells, feedGeothermal]);

  // taipei renewable permits：visible 時拉一次（438 POI）
  useEffect(() => {
    if (!showRenewablePermitsTaipei) return;
    let cancelled = false;
    fetchRenewablePermitsTaipei()
      .then((rows) => {
        if (cancelled) return;
        taipeiReFcRef.current = pointRowsToGeoJSON(rows, (r) => ({
          natural_key: r.natural_key ?? "",
          category: r.category ?? "",
          installation_name: r.installation_name ?? "",
          capacity_kw: r.capacity_kw,
          district: r.district ?? "",
          address: r.address ?? "",
          installed_at: r.installed_at ?? "",
        }));
        feedTaipeiRE();
      })
      .catch((err) => console.warn("[Energy/taipeiRE] load failed:", err));
    return () => { cancelled = true; };
  }, [showRenewablePermitsTaipei, feedTaipeiRE]);

  // EV：visible 時拉一次
  useEffect(() => {
    if (!showEvCharging) return;
    let cancelled = false;
    fetchEvCharging()
      .then((rows) => {
        if (cancelled) return;
        evFcRef.current = evToGeoJSON(rows);
        feedEv();
      })
      .catch((err) => console.warn("[Energy/ev] load failed:", err));
    return () => {
      cancelled = true;
    };
  }, [showEvCharging, feedEv]);

  // ── Phase 8 SSOT 6-layer：facPrimary/Offshore/Planned/Historical/Secondary/OsmSupplement ──
  useEffect(() => {
    if (!showFacPrimary) return;
    let cancelled = false;
    fetchFacPrimary()
      .then((rows) => {
        if (cancelled) return;
        facPrimaryRef.current = facPointsToGeoJSON(rows);
        feedFacPrimary();
      })
      .catch((err) => console.warn("[Energy/facPrimary] load failed:", err));
    return () => { cancelled = true; };
  }, [showFacPrimary, feedFacPrimary]);

  useEffect(() => {
    if (!showFacOffshore) return;
    let cancelled = false;
    fetchFacOffshore()
      .then((zones) => {
        if (cancelled) return;
        facOffshoreRef.current = facZonesToGeoJSON(zones);
        feedFacOffshore();
      })
      .catch((err) => console.warn("[Energy/facOffshore] load failed:", err));
    return () => { cancelled = true; };
  }, [showFacOffshore, feedFacOffshore]);

  useEffect(() => {
    if (!showFacPlanned) return;
    let cancelled = false;
    fetchFacPlanned()
      .then((rows) => {
        if (cancelled) return;
        facPlannedRef.current = facPointsToGeoJSON(rows);
        feedFacPlanned();
      })
      .catch((err) => console.warn("[Energy/facPlanned] load failed:", err));
    return () => { cancelled = true; };
  }, [showFacPlanned, feedFacPlanned]);

  useEffect(() => {
    if (!showFacHistorical) return;
    let cancelled = false;
    fetchFacHistorical()
      .then((rows) => {
        if (cancelled) return;
        facHistoricalRef.current = facPointsToGeoJSON(rows);
        feedFacHistorical();
      })
      .catch((err) => console.warn("[Energy/facHistorical] load failed:", err));
    return () => { cancelled = true; };
  }, [showFacHistorical, feedFacHistorical]);

  useEffect(() => {
    if (!showFacSecondary) return;
    let cancelled = false;
    fetchFacSecondary()
      .then((rows) => {
        if (cancelled) return;
        facSecondaryRef.current = facPointsToGeoJSON(rows);
        feedFacSecondary();
      })
      .catch((err) => console.warn("[Energy/facSecondary] load failed:", err));
    return () => { cancelled = true; };
  }, [showFacSecondary, feedFacSecondary]);

  useEffect(() => {
    if (!showFacOsmSupplement) return;
    let cancelled = false;
    fetchFacOsmSupplement()
      .then((rows) => {
        if (cancelled) return;
        facOsmSupplementRef.current = facPointsToGeoJSON(rows);
        feedFacOsmSupplement();
      })
      .catch((err) => console.warn("[Energy/facOsmSupplement] load failed:", err));
    return () => { cancelled = true; };
  }, [showFacOsmSupplement, feedFacOsmSupplement]);
}

// ── Phase 8 SSOT 6-layer 共用 GeoJSON 轉換 ──
function facPointsToGeoJSON(rows: FacilityPoint[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    if (!Number.isFinite(r.lng) || !Number.isFinite(r.lat)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: {
        facility_id: r.facility_id,
        name: r.name_zh ?? r.name ?? r.facility_id,
        fuel_type: r.fuel_type ?? "",
        total_capacity_mw: r.total_capacity_mw ?? 0,
        status: r.status ?? "",
        county: r.county ?? "",
        owner: r.owner ?? "",
        is_offshore: !!r.is_offshore,
        source_priority: r.source_priority,
        has_realtime: !!r.has_realtime,  // L1 視覺大小差異用
        color: facilityFuelColor(r.fuel_type),
        // 兼容既有 PowerPlantPanel（source_table）
        source_table: "energy.power_facilities",
        capacity_mw: r.total_capacity_mw ?? 0,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function facZonesToGeoJSON(zones: FacilityZone[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const z of zones) {
    let geom: GeoJSON.Geometry | null = null;
    try {
      geom = JSON.parse(z.footprint_geojson) as GeoJSON.Geometry;
    } catch {
      continue;
    }
    if (!geom) continue;
    features.push({
      type: "Feature",
      geometry: geom,
      properties: {
        facility_id: z.facility_id,
        name: z.name_zh ?? z.name ?? z.facility_id,
        total_capacity_mw: z.total_capacity_mw ?? 0,
        status: z.status ?? "",
        owner: z.owner ?? "",
        fuel_type: "wind",
        color: "#06b6d4",
        source_table: "energy.power_facilities",
        capacity_mw: z.total_capacity_mw ?? 0,
      },
    });
  }
  return { type: "FeatureCollection", features };
}
