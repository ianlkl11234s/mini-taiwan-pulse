import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CircleLayer, FillLayer, HeatmapLayer, LineLayer, Map as MapboxMap, RasterLayer } from "mapbox-gl";
import { fetchJpWaterGeoJsonAsset, getJpWaterRuntime, jpWaterPrivatePmtilesAsset, reportJpWaterArchiveReady, reportJpWaterError, reportJpWaterLoading, subscribeJpWaterRuntime } from "../data/jpWaterLoader";
import { JP_WATER_FACILITY_CATEGORIES, JP_WATER_LOCAL_PMTILES_LAYER_KEYS, JP_WATER_RELEASED_LAYER_KEYS, type JpWaterLocalArchive } from "../data/jpWaterTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PRIVATE_CORAL_PMTILES_SOURCE_TYPE, registerPrivateCoralSourceOnce } from "../map/privateCoralPmtiles";
import { densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { applyHeatmapStyle, heatmapLayerPaint, useHeatmapStyleSignature } from "../state/layerPalette";
import { paramDefault } from "../data/layerParamsSpec";
import { hookFillOpacity, hookFillPaint, hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";
import { JP_WATER_ACCESS_DENIED_EVENT, jpWaterPrivateAccessToken, useJpWaterPrivateAccess } from "./useJpWaterPrivateAccess";
import { useMapReadyTick } from "./useMapReadyTick";

const RELEASED_KEYS = JP_WATER_RELEASED_LAYER_KEYS;
const LOCAL_KEYS = JP_WATER_LOCAL_PMTILES_LAYER_KEYS;
export type JpWaterVisibleKey = typeof RELEASED_KEYS[number] | typeof LOCAL_KEYS[number] | "jpWaterFloodHazard";
export type JpWaterVisibility = Record<JpWaterVisibleKey, boolean>;
export type JpWaterOpacity = Record<JpWaterVisibleKey, number>;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const layerId = (key: JpWaterVisibleKey) => `jp-water-${key}`;
const geoSourceId = (key: typeof RELEASED_KEYS[number]) => `jp-water-${key}-source`;
const sourceId = (archive: JpWaterLocalArchive) => `jp-water-private-${archive}-source`;
const ARCHIVE_ATTRIBUTION: Record<JpWaterLocalArchive, string> = {
  water: "国土交通省 国土数値情報（W01/W05/P21/P22）を加工して作成・本人限定私人非商業研究",
  "extra-water": "GSJ / NILIM / 農林水産省 MAFF / 国土交通省 KSJ（本人限定私人非商業研究）",
};
const FLOOD_ATTRIBUTION = '<a href="https://disaportal.gsi.go.jp/hazardmapportal/hazardmap/copyright/copyright_data.html" target="_blank" rel="noopener">国土交通省各地方整備局等 / ハザードマップポータルサイト</a> · <a href="https://disaportaldata.gsi.go.jp/hazardmap/copyright/opendata.html" target="_blank" rel="noopener">利用條件</a>';

const RELEASED_COLORS: Record<typeof RELEASED_KEYS[number], string> = { jpWaterLakes: "#0ea5e9", jpWaterLocalFacilities: "#0284c7", jpWaterQualityStations: "#7c3aed", jpWaterLevelStations: "#0369a1" };
const pointStroke = (key: JpWaterVisibleKey, opacity: number, isDark: boolean) =>
  pointStrokePaint(isDark, clamp(opacity) / Number(paramDefault(key, `${key}Opacity`) ?? 1));
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
// R5（P-4／G-2）：農業用ため池 agri 161,778 點（> 100k）z < 12 畫熱區、z ≥ 12 畫點（source maxzoom 11，z12+ overzoom）。
// 2026-10-02 校正（本州 z6 視角 heatmap 離線模擬；準則見 overlayRegistry denseHeatmapLayer 說明）
const AGRI_HEATMAP_INTENSITY = 0.3;
const LOCAL_HEATMAP: Partial<Record<typeof LOCAL_KEYS[number], { pointsFromZoom: number; intensity: number }>> = {
  jpWaterAgriculturalPonds: { pointsFromZoom: densePointsFromZoom(161_778), intensity: AGRI_HEATMAP_INTENSITY },
};
const heatmapLayerId = (key: JpWaterVisibleKey) => `jp-water-${key}-heatmap`;
/** F-2 面外框（獨立 line 子圖層，不用 fill-outline-color）：湖＝覆蓋面同色；供水區域＝背景面中性灰。 */
const OUTLINED_KEYS = ["jpWaterLakes", "jpWaterSupplyAreas"] as const;
type OutlinedKey = typeof OUTLINED_KEYS[number];
const outlineId = (key: OutlinedKey) => `jp-water-${key}-outline`;
function outlinePaint(key: OutlinedKey, opacity: number, isDark: boolean) {
  const color = key === "jpWaterLakes" ? RELEASED_COLORS.jpWaterLakes : LOCAL.jpWaterSupplyAreas.color;
  const def = Number(paramDefault(key, `${key}Opacity`) ?? 1);
  return hookLinePaint(key, outlineId(key), { "line-color": color, "line-opacity": clamp(opacity), "line-width": 1 }, { "line-color": color, "line-opacity": def, "line-width": 1 }, isDark);
}
/** 建立（來源已在）並同步外框的顯示與 paint；不可見且圖層不存在時什麼都不做。 */
function syncOutline(map: MapboxMap, key: OutlinedKey, visible: boolean, opacity: number, isDark: boolean) {
  const id = outlineId(key);
  if (!visible) { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none"); return; }
  if (!map.getLayer(id)) {
    const local = key === "jpWaterSupplyAreas" ? LOCAL[key] : null;
    map.addLayer({ id, type: "line", source: local ? sourceId(local.archive) : geoSourceId("jpWaterLakes"), ...(local ? { "source-layer": local.sourceLayer } : {}), layout: { visibility: "none", ...hookLineLayout(key, id) }, paint: outlinePaint(key, opacity, isDark) } as LineLayer);
  }
  map.setLayoutProperty(id, "visibility", "visible");
  const paint = outlinePaint(key, opacity, isDark);
  for (const prop of ["line-color", "line-width", "line-opacity"] as const) map.setPaintProperty(id, prop, paint[prop] as never);
}
const HEAT_KEYS: readonly string[] = Object.keys(LOCAL_HEATMAP);
const heatScale = (key: JpWaterVisibleKey, opacity: number) => clamp(opacity) / Number(paramDefault(key, `${key}Opacity`) ?? 1);
/** G-2 熱區：與點同 source-layer，畫在出點縮放以下，不可點擊。 */
function localHeatmapLayer(key: typeof LOCAL_KEYS[number], opacity: number, isDark: boolean): HeatmapLayer | null {
  const heat = LOCAL_HEATMAP[key]; if (!heat) return null;
  const item = LOCAL[key];
  return { id: heatmapLayerId(key), type: "heatmap", source: sourceId(item.archive), "source-layer": item.sourceLayer, maxzoom: heatmapMaxzoom(heat.pointsFromZoom), layout: { visibility: "none" }, paint: heatmapLayerPaint(key, isDark, heatScale(key, opacity), heat.intensity) } as HeatmapLayer;
}

function releasedLayer(key: typeof RELEASED_KEYS[number], opacity: number, isDark: boolean): CircleLayer | FillLayer {
  if (key === "jpWaterLakes") return { id: layerId(key), type: "fill", source: geoSourceId(key), layout: { visibility: "none" }, paint: hookFillPaint(key, layerId(key), { "fill-color": RELEASED_COLORS[key], "fill-opacity": clamp(opacity) }, { "fill-color": RELEASED_COLORS[key], "fill-opacity": Number(paramDefault(key, `${key}Opacity`) ?? 1) }) } as FillLayer;
  return { id: layerId(key), type: "circle", source: geoSourceId(key), layout: { visibility: "none" }, paint: { "circle-color": RELEASED_COLORS[key], "circle-opacity": clamp(opacity), "circle-radius": pointRadius("M"), ...pointStroke(key, opacity, isDark) } } as CircleLayer;
}
function localLayer(key: typeof LOCAL_KEYS[number], opacity: number, isDark: boolean): CircleLayer | FillLayer | LineLayer {
  const item = LOCAL[key]; const id = layerId(key); const source = sourceId(item.archive);
  if (item.kind === "line") { const width = ["interpolate", ["linear"], ["zoom"], 4, 0.25, 8, 0.65, 14, 2]; const def = Number(paramDefault(key, `${key}Opacity`) ?? 1); return { id, type: "line", source, "source-layer": item.sourceLayer, layout: { visibility: "none", ...hookLineLayout(key, id) }, paint: hookLinePaint(key, id, { "line-color": item.color, "line-opacity": clamp(opacity), "line-width": width }, { "line-color": item.color, "line-opacity": def, "line-width": width }) } as LineLayer; }
  if (item.kind === "fill") { const def = Number(paramDefault(key, `${key}Opacity`) ?? 1); return { id, type: "fill", source, "source-layer": item.sourceLayer, layout: { visibility: "none" }, paint: hookFillPaint(key, id, { "fill-color": item.color, "fill-opacity": clamp(opacity) }, { "fill-color": item.color, "fill-opacity": def }) } as FillLayer; }
  const group = key === "jpWaterSupplyFacilities" ? "supply" : key === "jpWaterSewerFacilities" ? "sewer" : null;
  const circleColor = group ? [
    "match", ["get", "facility_category"],
    ...JP_WATER_FACILITY_CATEGORIES.filter((category) => category.group === group).flatMap((category) => [category.value, category.color]),
    item.color,
  ] : item.color;
  const minzoom = LOCAL_HEATMAP[key]?.pointsFromZoom;
  return { id, type: "circle", source, "source-layer": item.sourceLayer, ...(minzoom !== undefined ? { minzoom } : {}), layout: { visibility: "none" }, paint: { "circle-color": circleColor, "circle-opacity": clamp(opacity), "circle-radius": pointRadius("M"), ...pointStroke(key, opacity, isDark) } } as CircleLayer;
}
/** Four public GeoJSON layers plus eight owner-only PMTiles layers. */
export function useJpWaterLayers(mapRef: React.RefObject<MapboxMap | null>, visibilityProp: JpWaterVisibility, opacityProp: JpWaterOpacity, isDarkTheme = true) {
  // 呼叫端每次 render 都傳新物件；直接當 effect deps 會讓下方 mount effect 每次 host
  // re-render 都重跑（圖層全關時也一樣，每次 setLayoutProperty／setPaintProperty
  // 都會 triggerRepaint → 播放中每秒數次無謂重畫）。以內容 key 穩定 identity。
  const visKey = JSON.stringify(visibilityProp);
  const opacityKey = JSON.stringify(opacityProp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visibility = useMemo(() => visibilityProp, [visKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const opacity = useMemo(() => opacityProp, [opacityKey]);
  const active = (Object.keys(visibility) as JpWaterVisibleKey[]).some((key) => visibility[key]);
  const tick = useMapReadyTick(mapRef, active);
  const heatStyle = useHeatmapStyleSignature(HEAT_KEYS);
  const runtime = useSyncExternalStore(subscribeJpWaterRuntime, getJpWaterRuntime, getJpWaterRuntime);
  const access = useJpWaterPrivateAccess();
  const geoData = useRef<Partial<Record<typeof RELEASED_KEYS[number], GeoJSON.FeatureCollection>>>({});
  const [geoRevision, setGeoRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    RELEASED_KEYS.forEach((key) => { if (visibility[key] && !geoData.current[key]) fetchJpWaterGeoJsonAsset(key).then((value) => { if (!cancelled) { geoData.current[key] = value; setGeoRevision((n) => n + 1); } }).catch(reportJpWaterError); });
    return () => { cancelled = true; };
  }, [runtime.revision, visibility.jpWaterLakes, visibility.jpWaterLocalFacilities, visibility.jpWaterQualityStations, visibility.jpWaterLevelStations]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const removeArchive = (archive: JpWaterLocalArchive) => {
      const archiveKeys = LOCAL_KEYS.filter((key) => LOCAL[key].archive === archive);
      archiveKeys.forEach((key) => { for (const id of [layerId(key), heatmapLayerId(key), `jp-water-${key}-outline`]) { try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* style replaced */ } } });
      try { if (map.getSource(sourceId(archive))) map.removeSource(sourceId(archive)); } catch { /* style replaced */ }
    };
    const denyPrivateAccess = () => {
      reportJpWaterError(new Error("日本水資源私人存取被拒絕，已清除圖層"));
      window.dispatchEvent(new Event(JP_WATER_ACCESS_DENIED_EVENT));
      window.dispatchEvent(new Event("jp-water-selection-clear"));
    };
    const mount = () => {
      const isDark = isDarkTheme;
      RELEASED_KEYS.forEach((key) => { const data = geoData.current[key]; if (!visibility[key] || !data) { if (map.getLayer(layerId(key))) map.setLayoutProperty(layerId(key), "visibility", "none"); if (key === "jpWaterLakes") syncOutline(map, key, false, opacity[key], isDark); return; } if (!map.getSource(geoSourceId(key))) map.addSource(geoSourceId(key), { type: "geojson", data }); if (!map.getLayer(layerId(key))) map.addLayer(releasedLayer(key, opacity[key], isDark)); map.setLayoutProperty(layerId(key), "visibility", "visible"); map.setPaintProperty(layerId(key), key === "jpWaterLakes" ? "fill-opacity" : "circle-opacity", key === "jpWaterLakes" ? hookFillOpacity(key, layerId(key), clamp(opacity[key]), Number(paramDefault(key, `${key}Opacity`) ?? 1)) : clamp(opacity[key])); if (key === "jpWaterLakes") syncOutline(map, key, true, opacity[key], isDark); if (key !== "jpWaterLakes") { map.setPaintProperty(layerId(key), "circle-radius", pointRadius("M")); { const stroke = pointStroke(key, opacity[key], isDark); for (const prop of ["circle-stroke-color", "circle-stroke-width", "circle-stroke-opacity"] as const) map.setPaintProperty(layerId(key), prop, stroke[prop]); } } });
      (["water", "extra-water"] as const).forEach((archive) => {
        const archiveKeys = LOCAL_KEYS.filter((key) => LOCAL[key].archive === archive);
        const archiveVisible = archiveKeys.some((key) => visibility[key]);
        if (!access.allowed || !access.userId || !archiveVisible) { removeArchive(archive); return; }
        const asset = jpWaterPrivatePmtilesAsset(archive);
        registerPrivateCoralSourceOnce(); if (!map.getSource(sourceId(archive))) {
          reportJpWaterLoading();
          map.addSource(sourceId(archive), {
            type: PRIVATE_CORAL_PMTILES_SOURCE_TYPE,
            url: new URL(asset.url, window.location.href).href,
            getToken: async () => {
              try { return await jpWaterPrivateAccessToken(access.userId!); }
              catch (error) { denyPrivateAccess(); throw error; }
            },
            onAccessDenied: denyPrivateAccess,
            minzoom: 0, maxzoom: 11,
          } as unknown as Parameters<MapboxMap["addSource"]>[1]);
          const source = map.getSource(sourceId(archive)) as unknown as { attribution?: string; on?: (type: string, listener: () => void) => void };
          if (source) {
            source.attribution = ARCHIVE_ATTRIBUTION[archive];
            source.on?.("data", () => { if (source.attribution !== ARCHIVE_ATTRIBUTION[archive]) source.attribution = ARCHIVE_ATTRIBUTION[archive]; });
          }
          keepLoadingUntilMapIdle(map, `${sourceId(archive)}:render`, "日本水資源圖磚載入中", sourceId(archive));
        }
        archiveKeys.forEach((key) => {
          // 熱區緊接在點之前建立（點畫在上面）；開關與透明度跟該層點一致。
          const heat = localHeatmapLayer(key, opacity[key], isDark);
          if (heat) {
            if (!map.getLayer(heat.id)) map.addLayer(heat, map.getLayer(layerId(key)) ? layerId(key) : undefined);
            map.setLayoutProperty(heat.id, "visibility", visibility[key] ? "visible" : "none");
            applyHeatmapStyle(map, heat.id, key, isDark, heatScale(key, opacity[key]));
          }
          if (!map.getLayer(layerId(key))) map.addLayer(localLayer(key, opacity[key], isDark)); map.setLayoutProperty(layerId(key), "visibility", visibility[key] ? "visible" : "none"); const paint = LOCAL[key].kind === "line" ? "line-opacity" : LOCAL[key].kind === "fill" ? "fill-opacity" : "circle-opacity"; const def = Number(paramDefault(key, `${key}Opacity`) ?? 1); const value = LOCAL[key].kind === "line" ? hookLineOpacity(key, layerId(key), clamp(opacity[key]), def, isDark) : LOCAL[key].kind === "fill" ? hookFillOpacity(key, layerId(key), clamp(opacity[key]), def) : clamp(opacity[key]); map.setPaintProperty(layerId(key), paint, value); if (key === "jpWaterSupplyAreas") syncOutline(map, key, visibility[key], opacity[key], isDark); if (LOCAL[key].kind === "circle") { map.setPaintProperty(layerId(key), "circle-radius", pointRadius("M")); { const stroke = pointStroke(key, opacity[key], isDark); for (const prop of ["circle-stroke-color", "circle-stroke-width", "circle-stroke-opacity"] as const) map.setPaintProperty(layerId(key), prop, stroke[prop]); } } });
      });
      const floodSource = "jp-water-flood-hazard-source"; const floodLayer = layerId("jpWaterFloodHazard");
      const floodWasVisible = map.getLayer(floodLayer) && map.getLayoutProperty(floodLayer, "visibility") === "visible";
      if (!map.getSource(floodSource)) map.addSource(floodSource, { type: "raster", tiles: ["https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png"], tileSize: 256, minzoom: 2, maxzoom: 17, attribution: FLOOD_ATTRIBUTION });
      if (!map.getLayer(floodLayer)) map.addLayer({ id: floodLayer, type: "raster", source: floodSource, layout: { visibility: "none" }, paint: { "raster-opacity": clamp(opacity.jpWaterFloodHazard), "raster-resampling": "nearest" } } as RasterLayer);
      map.setLayoutProperty(floodLayer, "visibility", visibility.jpWaterFloodHazard ? "visible" : "none"); map.setPaintProperty(floodLayer, "raster-opacity", clamp(opacity.jpWaterFloodHazard));
      if (visibility.jpWaterFloodHazard && !floodWasVisible) keepLoadingUntilMapIdle(map, `${floodSource}:render`, "官方洪水背景載入中", floodSource, 8000);
    };
    const onData = (event: { sourceId?: string; isSourceLoaded?: boolean }) => {
      if (!event.isSourceLoaded) return;
      if (event.sourceId === sourceId("water")) reportJpWaterArchiveReady("water");
      if (event.sourceId === sourceId("extra-water")) reportJpWaterArchiveReady("extra-water");
    };
    const onError = (event: { sourceId?: string; error?: Error }) => { if (event.sourceId?.startsWith("jp-water-")) reportJpWaterError(event.error ?? new Error("日本水資源地圖 source 載入失敗")); };
    mount(); map.on("style.load", mount); map.on("sourcedata", onData); map.on("error", onError);
    return () => { map.off("style.load", mount); map.off("sourcedata", onData); map.off("error", onError); };
  }, [access.allowed, access.userId, geoRevision, isDarkTheme, mapRef, opacity, runtime.revision, tick, visibility, heatStyle]);
}

export const JP_WATER_RUNTIME_LAYER_IDS = [
  ...RELEASED_KEYS.map(layerId), ...LOCAL_KEYS.map(layerId), layerId("jpWaterFloodHazard"),
] as const;
