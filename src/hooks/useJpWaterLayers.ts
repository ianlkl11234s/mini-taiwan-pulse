import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CircleLayer, FillLayer, LineLayer, Map as MapboxMap, RasterLayer } from "mapbox-gl";
import { fetchJpWaterGeoJsonAsset, getJpWaterRuntime, jpWaterLocalPmtilesAsset, reportJpWaterError, subscribeJpWaterRuntime } from "../data/jpWaterLoader";
import { JP_WATER_FACILITY_CATEGORIES, JP_WATER_LOCAL_PMTILES_LAYER_KEYS, JP_WATER_RELEASED_LAYER_KEYS, type JpWaterLocalArchive } from "../data/jpWaterTypes";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";

const RELEASED_KEYS = JP_WATER_RELEASED_LAYER_KEYS;
const LOCAL_KEYS = JP_WATER_LOCAL_PMTILES_LAYER_KEYS;
export type JpWaterVisibleKey = typeof RELEASED_KEYS[number] | typeof LOCAL_KEYS[number] | "jpWaterFloodHazard";
export type JpWaterVisibility = Record<JpWaterVisibleKey, boolean>;
export type JpWaterOpacity = Record<JpWaterVisibleKey, number>;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const layerId = (key: JpWaterVisibleKey) => `jp-water-${key}`;
const geoSourceId = (key: typeof RELEASED_KEYS[number]) => `jp-water-${key}-source`;
const sourceId = (archive: JpWaterLocalArchive) => `jp-water-local-${archive}-source`;
const ARCHIVE_ATTRIBUTION: Record<JpWaterLocalArchive, string> = {
  water: "国土交通省 国土数値情報（W01/W05/P21/P22）を加工して作成・本機限定",
  "extra-water": "GSJ / NILIM / 農林水産省 MAFF / 国土交通省 KSJ（本機限定）",
};
const FLOOD_ATTRIBUTION = '<a href="https://disaportal.gsi.go.jp/hazardmapportal/hazardmap/copyright/copyright_data.html" target="_blank" rel="noopener">国土交通省各地方整備局等 / ハザードマップポータルサイト</a> · <a href="https://disaportaldata.gsi.go.jp/hazardmap/copyright/opendata.html" target="_blank" rel="noopener">利用條件</a>';

const RELEASED_COLORS: Record<typeof RELEASED_KEYS[number], string> = { jpWaterLakes: "#0ea5e9", jpWaterLocalFacilities: "#0284c7", jpWaterQualityStations: "#7c3aed", jpWaterLevelStations: "#0369a1" };
const LOCAL: Record<typeof LOCAL_KEYS[number], { archive: JpWaterLocalArchive; sourceLayer: string; kind: "circle" | "line" | "fill"; color: string }> = {
  jpWaterDams: { archive: "water", sourceLayer: "dams", kind: "circle", color: "#0369a1" },
  jpWaterRivers: { archive: "water", sourceLayer: "rivers", kind: "line", color: "#0284c7" },
  jpWaterSupplyFacilities: { archive: "water", sourceLayer: "supply", kind: "circle", color: "#06b6d4" },
  jpWaterSupplyAreas: { archive: "water", sourceLayer: "supply_areas", kind: "fill", color: "#7dd3fc" },
  jpWaterSewerFacilities: { archive: "water", sourceLayer: "sewer", kind: "circle", color: "#1d4ed8" },
  jpWaterGroundwaterSites: { archive: "extra-water", sourceLayer: "groundwater", kind: "circle", color: "#8b5cf6" },
  jpWaterNilimDams: { archive: "extra-water", sourceLayer: "nilim", kind: "circle", color: "#2563eb" },
  jpWaterAgriculturalPonds: { archive: "extra-water", sourceLayer: "agri", kind: "circle", color: "#65a30d" },
};

function releasedLayer(key: typeof RELEASED_KEYS[number], opacity: number): CircleLayer | FillLayer {
  if (key === "jpWaterLakes") return { id: layerId(key), type: "fill", source: geoSourceId(key), layout: { visibility: "none" }, paint: { "fill-color": RELEASED_COLORS[key], "fill-opacity": clamp(opacity), "fill-outline-color": RELEASED_COLORS[key] } } as FillLayer;
  return { id: layerId(key), type: "circle", source: geoSourceId(key), layout: { visibility: "none" }, paint: { "circle-color": RELEASED_COLORS[key], "circle-opacity": clamp(opacity), "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 12, 7], "circle-stroke-color": "rgba(15,23,42,.55)", "circle-stroke-width": 0.5 } } as CircleLayer;
}
function localLayer(key: typeof LOCAL_KEYS[number], opacity: number): CircleLayer | FillLayer | LineLayer {
  const item = LOCAL[key]; const id = layerId(key); const source = sourceId(item.archive);
  if (item.kind === "line") return { id, type: "line", source, "source-layer": item.sourceLayer, layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: { "line-color": item.color, "line-opacity": clamp(opacity), "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.25, 8, 0.65, 14, 2] } } as LineLayer;
  if (item.kind === "fill") return { id, type: "fill", source, "source-layer": item.sourceLayer, layout: { visibility: "none" }, paint: { "fill-color": item.color, "fill-opacity": clamp(opacity), "fill-outline-color": "#38bdf8" } } as FillLayer;
  const group = key === "jpWaterSupplyFacilities" ? "supply" : key === "jpWaterSewerFacilities" ? "sewer" : null;
  const circleColor = group ? [
    "match", ["get", "facility_category"],
    ...JP_WATER_FACILITY_CATEGORIES.filter((category) => category.group === group).flatMap((category) => [category.value, category.color]),
    item.color,
  ] : item.color;
  return { id, type: "circle", source, "source-layer": item.sourceLayer, layout: { visibility: "none" }, paint: { "circle-color": circleColor, "circle-opacity": clamp(opacity), "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 1.2, 7, 2.2, 12, 5], "circle-stroke-color": "rgba(15,23,42,.55)", "circle-stroke-width": 0.35 } } as CircleLayer;
}
/** Four released GeoJSON layers plus eight DEV-only PMTiles archives. Local layers share one Mapbox source per archive. */
export function useJpWaterLayers(mapRef: React.RefObject<MapboxMap | null>, visibility: JpWaterVisibility, opacity: JpWaterOpacity) {
  const active = (Object.keys(visibility) as JpWaterVisibleKey[]).some((key) => visibility[key]);
  const tick = useMapReadyTick(mapRef, active);
  const runtime = useSyncExternalStore(subscribeJpWaterRuntime, getJpWaterRuntime, getJpWaterRuntime);
  const geoData = useRef<Partial<Record<typeof RELEASED_KEYS[number], GeoJSON.FeatureCollection>>>({});
  const [geoRevision, setGeoRevision] = useState(0);
  const [archives, setArchives] = useState<Partial<Record<JpWaterLocalArchive, { url: string; revision: number }>>>({});

  useEffect(() => {
    let cancelled = false;
    RELEASED_KEYS.forEach((key) => { if (visibility[key] && !geoData.current[key]) fetchJpWaterGeoJsonAsset(key).then((value) => { if (!cancelled) { geoData.current[key] = value; setGeoRevision((n) => n + 1); } }).catch(reportJpWaterError); });
    return () => { cancelled = true; };
  }, [runtime.revision, visibility.jpWaterLakes, visibility.jpWaterLocalFacilities, visibility.jpWaterQualityStations, visibility.jpWaterLevelStations]);

  useEffect(() => {
    let cancelled = false;
    const needed = new Set<JpWaterLocalArchive>(LOCAL_KEYS.filter((key) => visibility[key]).map((key) => LOCAL[key].archive));
    needed.forEach((archive) => { if (archives[archive]?.revision === runtime.revision) return; jpWaterLocalPmtilesAsset(archive).then((asset) => { if (!cancelled) setArchives((current) => ({ ...current, [archive]: { url: asset.url, revision: runtime.revision } })); }).catch(() => undefined); });
    return () => { cancelled = true; };
  }, [archives, runtime.revision, visibility.jpWaterAgriculturalPonds, visibility.jpWaterDams, visibility.jpWaterGroundwaterSites, visibility.jpWaterNilimDams, visibility.jpWaterRivers, visibility.jpWaterSewerFacilities, visibility.jpWaterSupplyAreas, visibility.jpWaterSupplyFacilities]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const mount = () => {
      RELEASED_KEYS.forEach((key) => { const data = geoData.current[key]; if (!visibility[key] || !data) { if (map.getLayer(layerId(key))) map.setLayoutProperty(layerId(key), "visibility", "none"); return; } if (!map.getSource(geoSourceId(key))) map.addSource(geoSourceId(key), { type: "geojson", data }); if (!map.getLayer(layerId(key))) map.addLayer(releasedLayer(key, opacity[key])); map.setLayoutProperty(layerId(key), "visibility", "visible"); map.setPaintProperty(layerId(key), key === "jpWaterLakes" ? "fill-opacity" : "circle-opacity", clamp(opacity[key])); });
      (["water", "extra-water"] as const).forEach((archive) => {
        const archiveKeys = LOCAL_KEYS.filter((key) => LOCAL[key].archive === archive); const asset = archives[archive];
        if (!asset || asset.revision !== runtime.revision) { archiveKeys.forEach((key) => { if (map.getLayer(layerId(key))) map.setLayoutProperty(layerId(key), "visibility", "none"); }); return; }
        registerPmtilesSourceTypeOnce(); if (!map.getSource(sourceId(archive))) {
          map.addSource(sourceId(archive), { type: PMTILES_SOURCE_TYPE, url: asset.url, minzoom: 0, maxzoom: 11 } as any);
          const source = map.getSource(sourceId(archive)) as unknown as { attribution?: string; on?: (type: string, listener: () => void) => void };
          if (source) {
            source.attribution = ARCHIVE_ATTRIBUTION[archive];
            source.on?.("data", () => { if (source.attribution !== ARCHIVE_ATTRIBUTION[archive]) source.attribution = ARCHIVE_ATTRIBUTION[archive]; });
          }
          keepLoadingUntilMapIdle(map, `${sourceId(archive)}:render`, "日本水資源圖磚載入中", sourceId(archive));
        }
        archiveKeys.forEach((key) => { if (!map.getLayer(layerId(key))) map.addLayer(localLayer(key, opacity[key])); map.setLayoutProperty(layerId(key), "visibility", visibility[key] ? "visible" : "none"); const paint = LOCAL[key].kind === "line" ? "line-opacity" : LOCAL[key].kind === "fill" ? "fill-opacity" : "circle-opacity"; map.setPaintProperty(layerId(key), paint, clamp(opacity[key])); });
      });
      const floodSource = "jp-water-flood-hazard-source"; const floodLayer = layerId("jpWaterFloodHazard");
      const floodWasVisible = map.getLayer(floodLayer) && map.getLayoutProperty(floodLayer, "visibility") === "visible";
      if (!map.getSource(floodSource)) map.addSource(floodSource, { type: "raster", tiles: ["https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png"], tileSize: 256, minzoom: 2, maxzoom: 17, attribution: FLOOD_ATTRIBUTION });
      if (!map.getLayer(floodLayer)) map.addLayer({ id: floodLayer, type: "raster", source: floodSource, layout: { visibility: "none" }, paint: { "raster-opacity": clamp(opacity.jpWaterFloodHazard) } } as RasterLayer);
      map.setLayoutProperty(floodLayer, "visibility", visibility.jpWaterFloodHazard ? "visible" : "none"); map.setPaintProperty(floodLayer, "raster-opacity", clamp(opacity.jpWaterFloodHazard));
      if (visibility.jpWaterFloodHazard && !floodWasVisible) keepLoadingUntilMapIdle(map, `${floodSource}:render`, "官方洪水背景載入中", floodSource, 8000);
    };
    const onError = (event: { sourceId?: string; error?: Error }) => { if (event.sourceId?.startsWith("jp-water-")) reportJpWaterError(event.error ?? new Error("日本水資源地圖 source 載入失敗")); };
    mount(); map.on("style.load", mount); map.on("error", onError); return () => { map.off("style.load", mount); map.off("error", onError); };
  }, [archives, geoRevision, mapRef, opacity, runtime.revision, tick, visibility]);
}

export const JP_WATER_RUNTIME_LAYER_IDS = [
  ...RELEASED_KEYS.map(layerId), ...LOCAL_KEYS.map(layerId), layerId("jpWaterFloodHazard"),
] as const;
