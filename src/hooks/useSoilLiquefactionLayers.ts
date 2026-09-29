import { useEffect, useRef, useState } from "react";
import type { CircleLayer, FillLayer, LineLayer, Map as MapboxMap } from "mapbox-gl";
import {
  LIQUEFACTION_SITE_COLOR, SOIL_LIQUEFACTION_ACCESS_DENIED_EVENT, SOIL_LIQUEFACTION_ATTRIBUTION,
  SOIL_LIQUEFACTION_PRIVATE_ENDPOINT, SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS, SOIL_LIQUEFACTION_SELECTION_CLEAR_EVENT,
  SOIL_LIQUEFACTION_SOURCE_LAYERS, SOIL_POTENTIAL_CLASSES, SOIL_POTENTIAL_NOT_INVESTIGATED, WEAK_SOIL_CLASS_UPPER_M, WEAK_SOIL_COLORS,
  WEAK_SOIL_LAYER_KEYS, WEAK_SOIL_LAYER_SPEC, WEAK_SOIL_MIN_ZOOM, weakSoilField,
  type SoilLiquefactionLayerKey, type WeakSoilLayerKey,
} from "../data/soilLiquefactionTypes";
import { paramDefault } from "../data/layerParamsSpec";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PRIVATE_CORAL_PMTILES_SOURCE_TYPE, registerPrivateCoralSourceOnce } from "../map/privateCoralPmtiles";
import { gradedSeamPaint, hatchImageData, hatchImageId, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { soilLiquefactionPrivateAccessToken, useSoilLiquefactionPrivateAccess } from "./useSoilLiquefactionPrivateAccess";
import { useMapReadyTick } from "./useMapReadyTick";

export type SoilLiquefactionVisibility = Record<SoilLiquefactionLayerKey, boolean>;
export type SoilLiquefactionOpacity = Record<SoilLiquefactionLayerKey, number>;

export const SOIL_LIQUEFACTION_SOURCE_ID = "soil-liquefaction-private-source";
const TRANSPARENT = "rgba(0,0,0,0)";
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

const WEAK_FILL_IDS: Record<WeakSoilLayerKey, string> = {
  weakSoilClay0To5: "soil-liquefaction-weakSoilClay0To5-fill",
  weakSoilSand0To5: "soil-liquefaction-weakSoilSand0To5-fill",
  weakSoilClay5To10: "soil-liquefaction-weakSoilClay5To10-fill",
  weakSoilSand5To10: "soil-liquefaction-weakSoilSand5To10-fill",
  weakSoilClay10To20: "soil-liquefaction-weakSoilClay10To20-fill",
  weakSoilSand10To20: "soil-liquefaction-weakSoilSand10To20-fill",
};
const WEAK_MISSING_IDS: Record<WeakSoilLayerKey, string> = {
  weakSoilClay0To5: "soil-liquefaction-weakSoilClay0To5-missing",
  weakSoilSand0To5: "soil-liquefaction-weakSoilSand0To5-missing",
  weakSoilClay5To10: "soil-liquefaction-weakSoilClay5To10-missing",
  weakSoilSand5To10: "soil-liquefaction-weakSoilSand5To10-missing",
  weakSoilClay10To20: "soil-liquefaction-weakSoilClay10To20-missing",
  weakSoilSand10To20: "soil-liquefaction-weakSoilSand10To20-missing",
};

/** Mapbox style layer id；每個 key 的第一個是主體層，其餘子層吃同一個透明度滑桿（outline 例外，照 F-2 不綁）。 */
export const SOIL_LIQUEFACTION_LAYER_IDS = {
  potentialFill: "soil-liquefaction-potential-fill",
  potentialNotInvestigated: "soil-liquefaction-potential-not-investigated",
  potentialOutline: "soil-liquefaction-potential-outline",
  // 字面值（不用樣板字串）：mapInteractionLayers 測試以原始碼比對 gisClickRegistry 的 layer id。
  weakFill: (key: WeakSoilLayerKey) => WEAK_FILL_IDS[key],
  weakMissing: (key: WeakSoilLayerKey) => WEAK_MISSING_IDS[key],
  sites: "soil-liquefaction-monitoring-sites-circle",
} as const;

// ── paint／filter builders（純函式，測試直接驗）─────────────
const POTENTIAL_VALUES = SOIL_POTENTIAL_CLASSES.map((item) => item.value);
/** 只有官方高／中／低為 true（未調查與缺值皆 false）；用於分級接縫。 */
export const POTENTIAL_HAS_CLASS = ["match", ["get", "potential_class"], POTENTIAL_VALUES, true, false];
export const potentialFillColor = () => [
  "match", ["get", "potential_class"],
  ...SOIL_POTENTIAL_CLASSES.flatMap((item) => [item.value, item.color]),
  TRANSPARENT,
];
/** 只收來源明示 `not_investigated` 的面；缺值（無 key／未知值）是「無資料」，不算未調查。 */
export const POTENTIAL_NOT_INVESTIGATED_FILTER = ["==", ["get", "potential_class"], SOIL_POTENTIAL_NOT_INVESTIGATED];
/** 主體層收未調查以外的所有面：高／中／低上色，缺值＝無資料 → 透明不填色（仍可點出 popup）。 */
export const POTENTIAL_FILL_FILTER = ["!", POTENTIAL_NOT_INVESTIGATED_FILTER];

/** 厚度 0＝透明（仍可點出 popup「無弱層」）；>0 依 WEAK_SOIL_CLASS_UPPER_M 上色；超過末級上限歸末級。 */
export function weakSoilFillColor(key: WeakSoilLayerKey): unknown[] {
  const { material, depth } = WEAK_SOIL_LAYER_SPEC[key];
  const value = ["to-number", ["get", weakSoilField(material, depth)]];
  const uppers = WEAK_SOIL_CLASS_UPPER_M[depth];
  const colors = WEAK_SOIL_COLORS[material];
  return ["case", ["<=", value, 0], TRANSPARENT,
    ...uppers.slice(0, -1).flatMap((upper, index) => [["<=", value, upper], colors[index]]),
    colors[colors.length - 1]];
}
/** 有這個欄位才進上色層；vector tile 裡 null 就是「沒有這個 key」。 */
export const weakSoilValueFilter = (key: WeakSoilLayerKey) => ["has", weakSoilField(WEAK_SOIL_LAYER_SPEC[key].material, WEAK_SOIL_LAYER_SPEC[key].depth)];
/** 缺值（null）→ 單向斜線；0 不會進這層。 */
export const weakSoilMissingFilter = (key: WeakSoilLayerKey) => ["!", weakSoilValueFilter(key)];

const siteStroke = (opacity: number, isDark: boolean) =>
  pointStrokePaint(isDark, clamp(opacity) / Number(paramDefault("liquefactionMonitoringSites", "liquefactionMonitoringSitesOpacity") ?? 1));

type Snapshot = { visibility: SoilLiquefactionVisibility; opacity: SoilLiquefactionOpacity; isDark: boolean };

/** 全部 style layer（初始 visibility none）；匯出供測試做 style-spec 驗證。 */
export function buildSoilLiquefactionLayers(state: Snapshot): (FillLayer | LineLayer | CircleLayer)[] {
  const { opacity, isDark } = state;
  const source = SOIL_LIQUEFACTION_SOURCE_ID;
  const ids = SOIL_LIQUEFACTION_LAYER_IDS;
  const potential = SOIL_LIQUEFACTION_SOURCE_LAYERS.potential;
  const weak = SOIL_LIQUEFACTION_SOURCE_LAYERS.weakSoil;
  const hidden = { visibility: "none" as const };
  return [
    { id: ids.potentialFill, type: "fill", source, "source-layer": potential, filter: POTENTIAL_FILL_FILTER, layout: hidden,
      paint: { "fill-color": potentialFillColor(), "fill-opacity": clamp(opacity.soilLiquefactionPotential) } } as FillLayer,
    { id: ids.potentialNotInvestigated, type: "fill", source, "source-layer": potential, filter: POTENTIAL_NOT_INVESTIGATED_FILTER, layout: hidden,
      paint: { "fill-pattern": hatchImageId("missing", isDark), "fill-opacity": clamp(opacity.soilLiquefactionPotential) } } as FillLayer,
    { id: ids.potentialOutline, type: "line", source, "source-layer": potential, layout: hidden,
      paint: gradedSeamPaint(isDark, POTENTIAL_HAS_CLASS) } as LineLayer,
    ...WEAK_SOIL_LAYER_KEYS.flatMap((key) => [
      { id: ids.weakFill(key), type: "fill", source, "source-layer": weak, minzoom: WEAK_SOIL_MIN_ZOOM, filter: weakSoilValueFilter(key), layout: hidden,
        paint: { "fill-color": weakSoilFillColor(key), "fill-opacity": clamp(opacity[key]) } } as FillLayer,
      { id: ids.weakMissing(key), type: "fill", source, "source-layer": weak, minzoom: WEAK_SOIL_MIN_ZOOM, filter: weakSoilMissingFilter(key), layout: hidden,
        paint: { "fill-pattern": hatchImageId("missing", isDark), "fill-opacity": clamp(opacity[key]) } } as FillLayer,
    ]),
    { id: ids.sites, type: "circle", source, "source-layer": SOIL_LIQUEFACTION_SOURCE_LAYERS.monitoringSites, layout: hidden,
      paint: { "circle-color": LIQUEFACTION_SITE_COLOR, "circle-opacity": clamp(opacity.liquefactionMonitoringSites),
        "circle-radius": pointRadius("L"), ...siteStroke(opacity.liquefactionMonitoringSites, isDark) } } as CircleLayer,
  ];
}

const ALL_LAYER_IDS = [
  SOIL_LIQUEFACTION_LAYER_IDS.potentialFill, SOIL_LIQUEFACTION_LAYER_IDS.potentialNotInvestigated, SOIL_LIQUEFACTION_LAYER_IDS.potentialOutline,
  ...WEAK_SOIL_LAYER_KEYS.flatMap((key) => [SOIL_LIQUEFACTION_LAYER_IDS.weakFill(key), SOIL_LIQUEFACTION_LAYER_IDS.weakMissing(key)]),
  SOIL_LIQUEFACTION_LAYER_IDS.sites,
];

/** 只 setLayoutProperty／setPaintProperty：透明度、暗淡、開關都不重建 source（R2 教訓）。 */
function syncLayers(map: MapboxMap, state: Snapshot) {
  const { visibility, opacity, isDark } = state;
  const ids = SOIL_LIQUEFACTION_LAYER_IDS;
  const set = (id: string, visible: boolean, paint: Record<string, unknown>) => {
    if (!map.getLayer(id)) return;
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    for (const [name, value] of Object.entries(paint)) map.setPaintProperty(id, name as never, value as never);
  };
  const hatch = hatchImageId("missing", isDark);
  set(ids.potentialFill, visibility.soilLiquefactionPotential, { "fill-opacity": clamp(opacity.soilLiquefactionPotential) });
  set(ids.potentialNotInvestigated, visibility.soilLiquefactionPotential, { "fill-pattern": hatch, "fill-opacity": clamp(opacity.soilLiquefactionPotential) });
  set(ids.potentialOutline, visibility.soilLiquefactionPotential, gradedSeamPaint(isDark, POTENTIAL_HAS_CLASS));
  for (const key of WEAK_SOIL_LAYER_KEYS) {
    set(ids.weakFill(key), visibility[key], { "fill-opacity": clamp(opacity[key]) });
    set(ids.weakMissing(key), visibility[key], { "fill-pattern": hatch, "fill-opacity": clamp(opacity[key]) });
  }
  set(ids.sites, visibility.liquefactionMonitoringSites, {
    "circle-opacity": clamp(opacity.liquefactionMonitoringSites),
    ...siteStroke(opacity.liquefactionMonitoringSites, isDark),
  });
}

function removeAll(map: MapboxMap) {
  for (const id of [...ALL_LAYER_IDS].reverse()) { try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* style replaced */ } }
  try { if (map.getSource(SOIL_LIQUEFACTION_SOURCE_ID)) map.removeSource(SOIL_LIQUEFACTION_SOURCE_ID); } catch { /* style replaced */ }
}

/** 8 個 owner-only 圖層：一個私人 PMTiles source（三個 source-layer）。 */
export function useSoilLiquefactionLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  visibility: SoilLiquefactionVisibility,
  opacity: SoilLiquefactionOpacity,
  isDarkTheme = true,
) {
  const active = SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS.some((key) => visibility[key]);
  const tick = useMapReadyTick(mapRef, active);
  const access = useSoilLiquefactionPrivateAccess();
  const latest = useRef<Snapshot>({ visibility, opacity, isDark: isDarkTheme });
  latest.current = { visibility, opacity, isDark: isDarkTheme };
  const [mountRevision, setMountRevision] = useState(0);
  // host 每次 render 都新建物件 → 攤平成字串進 deps，值沒變就不跑 effect。
  const visibilityKey = SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS.map((key) => (visibility[key] ? 1 : 0)).join("");
  const opacityKey = SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS.map((key) => clamp(opacity[key])).join(",");

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const denyPrivateAccess = () => {
      window.dispatchEvent(new Event(SOIL_LIQUEFACTION_ACCESS_DENIED_EVENT));
      window.dispatchEvent(new Event(SOIL_LIQUEFACTION_SELECTION_CLEAR_EVENT));
    };
    const mount = () => {
      if (!access.allowed || !access.userId || !active) { removeAll(map); return; }
      for (const dark of [true, false]) {
        const id = hatchImageId("missing", dark);
        if (!map.hasImage(id)) map.addImage(id, hatchImageData("missing", dark));
      }
      registerPrivateCoralSourceOnce();
      if (!map.getSource(SOIL_LIQUEFACTION_SOURCE_ID)) {
        const userId = access.userId;
        map.addSource(SOIL_LIQUEFACTION_SOURCE_ID, {
          type: PRIVATE_CORAL_PMTILES_SOURCE_TYPE,
          url: new URL(SOIL_LIQUEFACTION_PRIVATE_ENDPOINT, window.location.href).href,
          getToken: async () => {
            try { return await soilLiquefactionPrivateAccessToken(userId); }
            catch (error) { denyPrivateAccess(); throw error; }
          },
          onAccessDenied: denyPrivateAccess,
          minzoom: 5, maxzoom: 14,
        } as unknown as Parameters<MapboxMap["addSource"]>[1]);
        const source = map.getSource(SOIL_LIQUEFACTION_SOURCE_ID) as unknown as { attribution?: string; on?: (type: string, listener: () => void) => void };
        if (source) {
          source.attribution = SOIL_LIQUEFACTION_ATTRIBUTION;
          source.on?.("data", () => { if (source.attribution !== SOIL_LIQUEFACTION_ATTRIBUTION) source.attribution = SOIL_LIQUEFACTION_ATTRIBUTION; });
        }
        keepLoadingUntilMapIdle(map, `${SOIL_LIQUEFACTION_SOURCE_ID}:render`, "土壤液化圖磚載入中", SOIL_LIQUEFACTION_SOURCE_ID);
      }
      for (const layer of buildSoilLiquefactionLayers(latest.current)) if (!map.getLayer(layer.id)) map.addLayer(layer);
      syncLayers(map, latest.current);
      setMountRevision((revision) => revision + 1);
    };
    const onError = (event: { sourceId?: string; error?: Error }) => {
      if (event.sourceId === SOIL_LIQUEFACTION_SOURCE_ID) console.warn("[soil-liquefaction] private source error", event.error);
    };
    mount(); map.on("style.load", mount); map.on("error", onError);
    return () => { map.off("style.load", mount); map.off("error", onError); };
  }, [access.allowed, access.userId, active, mapRef, tick]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    syncLayers(map, latest.current);
  }, [isDarkTheme, mapRef, mountRevision, opacityKey, visibilityKey]);
}
