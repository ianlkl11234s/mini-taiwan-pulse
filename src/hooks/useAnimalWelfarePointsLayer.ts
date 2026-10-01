import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { fetchAnimalWelfarePoints, type AnimalWelfarePointRow } from "../data/animalWelfarePointsLoader";
import { ANIMAL_WELFARE_POINT_COLOR_EXPR, animalWelfarePointTypeFilter } from "../data/animalWelfarePointsTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { HOOK_POINT_TIERS } from "../map/pointTiers";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "animal-welfare-points";
const GLOW_ID = "animal-welfare-points-glow";
const CIRCLE_ID = "animal-welfare-points-circle";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function animalWelfarePointRadius(scale: number): number {
  const tier = HOOK_POINT_TIERS.animalWelfarePoints;
  if (!tier || tier === "B") throw new Error("animalWelfarePoints requires a fixed point tier");
  return pointRadius(tier, scale);
}

const OPACITY_DEFAULT = Number(paramDefault("animalWelfarePoints", "animalWelfarePointsOpacity"));

export function animalWelfarePointStroke(isDark: boolean, opacity: number) {
  return pointStrokePaint(isDark, opacity / OPACITY_DEFAULT);
}

function ensureLayers(map: MapboxMap, opacity: number, scale: number, isDark: boolean, pointTypeMask?: number) {
  if (!map.getSource(SOURCE_ID)) map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY });
  if (!map.getLayer(GLOW_ID)) map.addLayer({
    id: GLOW_ID, type: "circle", source: SOURCE_ID, filter: animalWelfarePointTypeFilter(pointTypeMask) as never,
    paint: { "circle-radius": animalWelfarePointRadius(scale * 1.75) as never, "circle-color": ANIMAL_WELFARE_POINT_COLOR_EXPR as never, "circle-opacity": 0, "circle-blur": 0.72 },
  });
  if (!map.getLayer(CIRCLE_ID)) map.addLayer({
    id: CIRCLE_ID, type: "circle", source: SOURCE_ID, filter: animalWelfarePointTypeFilter(pointTypeMask) as never,
    paint: {
      "circle-radius": animalWelfarePointRadius(scale) as never, "circle-color": ANIMAL_WELFARE_POINT_COLOR_EXPR as never, "circle-opacity": opacity,
      ...animalWelfarePointStroke(isDark, opacity),
    },
  });
}

function updatePaint(map: MapboxMap, opacity: number, scale: number, isDark: boolean, pointTypeMask?: number) {
  for (const id of [GLOW_ID, CIRCLE_ID]) {
    if (map.getLayer(id)) map.setFilter(id, animalWelfarePointTypeFilter(pointTypeMask) as never);
  }
  if (map.getLayer(GLOW_ID)) {
    // Static service inventory: retain the glow layer as a click target, but hide the decoration (P-6).
    map.setPaintProperty(GLOW_ID, "circle-opacity", 0);
    map.setPaintProperty(GLOW_ID, "circle-radius", animalWelfarePointRadius(scale * 1.75) as never);
  }
  if (map.getLayer(CIRCLE_ID)) {
    map.setPaintProperty(CIRCLE_ID, "circle-opacity", opacity);
    map.setPaintProperty(CIRCLE_ID, "circle-radius", animalWelfarePointRadius(scale) as never);
    const stroke = animalWelfarePointStroke(isDark, opacity);
    map.setPaintProperty(CIRCLE_ID, "circle-stroke-color", stroke["circle-stroke-color"]);
    map.setPaintProperty(CIRCLE_ID, "circle-stroke-width", stroke["circle-stroke-width"]);
    map.setPaintProperty(CIRCLE_ID, "circle-stroke-opacity", stroke["circle-stroke-opacity"]);
  }
}

function setVisible(map: MapboxMap, visible: boolean) {
  for (const id of [GLOW_ID, CIRCLE_ID]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

/**
 * Mapbox's queried GeoJSON feature properties are reliably scalar only. Preserve every canonical
 * RPC field while JSON-encoding nested values, so popup queries never depend on implementation-
 * specific object/array coercion.
 */
export function animalWelfarePointMapboxProperties(row: AnimalWelfarePointRow): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key,
    value != null && typeof value === "object" ? JSON.stringify(value) : value,
  ]));
}

function setData(map: MapboxMap, rows: AnimalWelfarePointRow[]) {
  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData({
    type: "FeatureCollection",
    features: rows.map((row) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [row.longitude, row.latitude] },
      properties: animalWelfarePointMapboxProperties(row),
    })),
  });
}

/** ~7k point POI layer: deliberately no clustering so type color and click selection remain exact. */
export function useAnimalWelfarePointsLayer(
  mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity = 0.85, scale = 1, isDark = true, pointTypeMask?: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const loaded = useRef(false);
  // 最近一次成功載入的資料：換底圖（style.load）後用它重畫，不重抓
  const rowsRef = useRef<AnimalWelfarePointRow[] | null>(null);
  // 樣式值只走 ref + 下方樣式 effect，不進抓資料 effect 的 deps
  const styleRef = useRef({ opacity, scale, isDark, pointTypeMask });
  styleRef.current = { opacity, scale, isDark, pointTypeMask };
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    const run = async () => {
      const st = styleRef.current;
      ensureLayers(map, st.opacity, st.scale, st.isDark, st.pointTypeMask);
      if (!visible) { setVisible(map, false); return; }
      if (!loaded.current) {
        const rows = await fetchAnimalWelfarePoints();
        if (cancelled) return;
        rowsRef.current = rows;
        setData(map, rows);
        loaded.current = true;
        keepLoadingUntilMapIdle(map, "animal-welfare-points-render", "動物福利服務點圖層渲染中", SOURCE_ID);
      }
      const cur = styleRef.current;
      updatePaint(map, cur.opacity, cur.scale, cur.isDark, cur.pointTypeMask);
      setVisible(map, true);
    };
    run().catch((error) => console.warn("[AnimalWelfarePoints] service points unavailable", error));

    // 換底圖（setStyle）清掉自訂 source／layer：重建後用快取資料重畫（不重抓）
    const onStyleLoad = () => {
      if (cancelled) return;
      try {
        const st = styleRef.current;
        ensureLayers(map, st.opacity, st.scale, st.isDark, st.pointTypeMask);
        updatePaint(map, st.opacity, st.scale, st.isDark, st.pointTypeMask);
        if (rowsRef.current) setData(map, rowsRef.current);
      } catch { /* style 尚未就緒 */ }
    };
    map.on("style.load", onStyleLoad);

    return () => {
      cancelled = true;
      map.off("style.load", onStyleLoad);
    };
  }, [mapRef, visible, mapTick]);

  // 透明度／大小／主題／類型篩選：只改 paint／filter
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !map.getLayer(CIRCLE_ID)) return;
    updatePaint(map, opacity, scale, isDark, pointTypeMask);
  }, [mapRef, visible, opacity, scale, isDark, pointTypeMask, mapTick]);
}
