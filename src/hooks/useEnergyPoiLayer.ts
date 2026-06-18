import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import {
  fetchPowerPlants,
  invalidatePowerPlants,
  fetchOsmSubstations,
  fetchEvCharging,
  fuelColorOf,
  radiusForCapacity,
  type PowerPlantRow,
  type OsmSubstation,
  type EvChargingStation,
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
const SRC_EV = "energy-ev-charging";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const PLANT_POLL_MS = 5 * 60_000;

function plantsToGeoJSON(rows: PowerPlantRow[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    if (!Number.isFinite(r.lon) || !Number.isFinite(r.lat)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        source_table: r.source_table,
        source_id: r.source_id ?? "",
        name: r.name ?? "",
        fuel_type: r.fuel_type ?? "",
        capacity_mw: r.capacity_mw,
        output_mw: r.output_mw,
        output_load_rate: r.output_load_rate,
        radius: radiusForCapacity(r.capacity_mw),
        color: fuelColorOf(r.fuel_type),
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
        },
      })),
  };
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
  showEvCharging: boolean;
}

export function useEnergyPoiLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  { showPlants, showSubstations, showEvCharging }: UseEnergyPoiLayerOpts,
) {
  const plantsFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const subsFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const evFcRef = useRef<GeoJSON.FeatureCollection | null>(null);

  const feedPlants = useSourceFeed(mapRef, showPlants, SRC_PLANTS, plantsFcRef);
  const feedSubs = useSourceFeed(mapRef, showSubstations, SRC_SUBSTATIONS, subsFcRef);
  const feedEv = useSourceFeed(mapRef, showEvCharging, SRC_EV, evFcRef);

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
}
