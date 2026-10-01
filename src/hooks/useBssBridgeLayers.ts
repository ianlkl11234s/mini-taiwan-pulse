import { useEffect, useRef, useState } from "react";
import type { CircleLayer, LineLayer, Map as MapboxMap } from "mapbox-gl";
import {
  BSS_BRIDGE_ACCESS_DENIED_EVENT, BSS_BRIDGE_ATTRIBUTION, BSS_BRIDGE_LINE_ROLES, BSS_BRIDGE_MAX_ZOOM, BSS_BRIDGE_MIN_ZOOM,
  BSS_BRIDGE_POINT_LAYER_ID, BSS_BRIDGE_POINT_MIN_ZOOM, BSS_BRIDGE_PRIVATE_ENDPOINT, BSS_BRIDGE_SELECTION_CLEAR_EVENT,
  BSS_BRIDGE_SOURCE_ID, BSS_BRIDGE_SOURCE_LAYER, BSS_BRIDGE_STAGE1_LINE_COLOR, bssBridgeAccessColorExpression, bssBridgeV5LineColorExpression,
  bssBridgeLineFilter, bssBridgePointFilter, type BssBridgeLayerKey,
} from "../data/bssBridgeTypes";
import { paramDefault } from "../data/layerParamsSpec";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PRIVATE_CORAL_PMTILES_SOURCE_TYPE, registerPrivateCoralSourceOnce } from "../map/privateCoralPmtiles";
import { pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";
import { bssBridgePrivateAccessToken, useBssBridgePrivateAccess } from "./useBssBridgePrivateAccess";
import { useMapReadyTick } from "./useMapReadyTick";

export type BssBridgeVisibility = Record<BssBridgeLayerKey, boolean>;
export type BssBridgeOpacity = Record<BssBridgeLayerKey, number>;
/** 三個 select 與點大小；全是 index／倍率，值變時只 setFilter／setPaintProperty，不重建 source。 */
export interface BssBridgeControls { lineClass: number; lineQuality: number; pointQuality: number; pointScale: number }

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const finiteOr = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

type Snapshot = { visibility: BssBridgeVisibility; opacity: BssBridgeOpacity; controls: BssBridgeControls; isDark: boolean };

const lineWidth = (wide: boolean) => (wide
  ? ["interpolate", ["linear"], ["zoom"], 6, 1, 11, 2.2, 15, 4]
  : ["interpolate", ["linear"], ["zoom"], 6, 0.8, 11, 2, 15, 3.4]);
const pointStroke = (opacity: number, isDark: boolean) =>
  pointStrokePaint(isDark, clamp(opacity) / Number(paramDefault("bssNationalBridgePointsPreview", "bssNationalBridgePointsPreviewOpacity") ?? 1));

/** 全部 style layer（初始 visibility none）；匯出供測試做 style-spec 驗證。 */
export function buildBssBridgeLayers(state: Snapshot): (LineLayer | CircleLayer)[] {
  const { opacity, controls, isDark } = state;
  const hidden = { visibility: "none" as const };
  const lines = BSS_BRIDGE_LINE_ROLES.map((spec) => ({
    id: spec.id, type: "line", source: BSS_BRIDGE_SOURCE_ID, "source-layer": BSS_BRIDGE_SOURCE_LAYER,
    filter: bssBridgeLineFilter(spec.role, controls.lineClass, controls.lineQuality),
    layout: { ...hidden, ...hookLineLayout("bssNationalBridgePreview", spec.id) },
    paint: hookLinePaint("bssNationalBridgePreview", spec.id, {
      "line-color": spec.role === "stage1_local_direction_candidate" ? BSS_BRIDGE_STAGE1_LINE_COLOR : bssBridgeV5LineColorExpression,
      "line-width": lineWidth(spec.wide),
      "line-opacity": clamp(opacity.bssNationalBridgePreview),
      ...(spec.dash ? { "line-dasharray": [...spec.dash] } : {}),
    }, {
      "line-color": spec.role === "stage1_local_direction_candidate" ? BSS_BRIDGE_STAGE1_LINE_COLOR : bssBridgeV5LineColorExpression,
      "line-width": lineWidth(spec.wide),
      "line-opacity": Number(paramDefault("bssNationalBridgePreview", "bssNationalBridgePreviewOpacity") ?? 1),
      ...(spec.dash ? { "line-dasharray": [...spec.dash] } : {}),
    }, isDark),
  }) as unknown as LineLayer);
  const point = {
    id: BSS_BRIDGE_POINT_LAYER_ID, type: "circle", source: BSS_BRIDGE_SOURCE_ID, "source-layer": BSS_BRIDGE_SOURCE_LAYER,
    minzoom: BSS_BRIDGE_POINT_MIN_ZOOM, filter: bssBridgePointFilter(controls.pointQuality), layout: hidden,
    paint: {
      "circle-color": bssBridgeAccessColorExpression,
      "circle-opacity": clamp(opacity.bssNationalBridgePointsPreview),
      "circle-radius": pointRadius("S", controls.pointScale),
      ...pointStroke(opacity.bssNationalBridgePointsPreview, isDark),
    },
  } as unknown as CircleLayer;
  return [...lines, point];
}

const LINE_IDS: string[] = BSS_BRIDGE_LINE_ROLES.map((spec) => spec.id);
const ALL_LAYER_IDS: string[] = [...LINE_IDS, BSS_BRIDGE_POINT_LAYER_ID];

/** 只 setLayoutProperty／setPaintProperty／setFilter：開關、透明度、篩選都不重建 source（R2 教訓）。 */
function syncLayers(map: MapboxMap, state: Snapshot) {
  const { visibility, opacity, controls, isDark } = state;
  for (const spec of BSS_BRIDGE_LINE_ROLES) {
    if (!map.getLayer(spec.id)) continue;
    map.setLayoutProperty(spec.id, "visibility", visibility.bssNationalBridgePreview ? "visible" : "none");
    map.setFilter(spec.id, bssBridgeLineFilter(spec.role, controls.lineClass, controls.lineQuality) as never);
    map.setPaintProperty(spec.id, "line-opacity", hookLineOpacity("bssNationalBridgePreview", spec.id, clamp(opacity.bssNationalBridgePreview), Number(paramDefault("bssNationalBridgePreview", "bssNationalBridgePreviewOpacity") ?? 1), isDark));
  }
  if (map.getLayer(BSS_BRIDGE_POINT_LAYER_ID)) {
    map.setLayoutProperty(BSS_BRIDGE_POINT_LAYER_ID, "visibility", visibility.bssNationalBridgePointsPreview ? "visible" : "none");
    map.setFilter(BSS_BRIDGE_POINT_LAYER_ID, bssBridgePointFilter(controls.pointQuality) as never);
    map.setPaintProperty(BSS_BRIDGE_POINT_LAYER_ID, "circle-opacity", clamp(opacity.bssNationalBridgePointsPreview));
    map.setPaintProperty(BSS_BRIDGE_POINT_LAYER_ID, "circle-radius", pointRadius("S", controls.pointScale));
    for (const [name, value] of Object.entries(pointStroke(opacity.bssNationalBridgePointsPreview, isDark))) map.setPaintProperty(BSS_BRIDGE_POINT_LAYER_ID, name as never, value as never);
  }
}

function removeAll(map: MapboxMap) {
  for (const id of [...ALL_LAYER_IDS].reverse()) { try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* style replaced */ } }
  try { if (map.getSource(BSS_BRIDGE_SOURCE_ID)) map.removeSource(BSS_BRIDGE_SOURCE_ID); } catch { /* style replaced */ }
}

/** 2 個 owner-only 圖層（線＋點）：一個私人 PMTiles source（一個 source-layer）。 */
export function useBssBridgeLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  visibility: BssBridgeVisibility,
  opacity: BssBridgeOpacity,
  controls: BssBridgeControls,
  isDarkTheme = true,
) {
  const active = visibility.bssNationalBridgePreview || visibility.bssNationalBridgePointsPreview;
  const tick = useMapReadyTick(mapRef, active);
  const access = useBssBridgePrivateAccess();
  const safeControls: BssBridgeControls = {
    lineClass: finiteOr(controls.lineClass, 0), lineQuality: finiteOr(controls.lineQuality, 0),
    pointQuality: finiteOr(controls.pointQuality, 0), pointScale: finiteOr(controls.pointScale, 1),
  };
  const latest = useRef<Snapshot>({ visibility, opacity, controls: safeControls, isDark: isDarkTheme });
  latest.current = { visibility, opacity, controls: safeControls, isDark: isDarkTheme };
  const [mountRevision, setMountRevision] = useState(0);
  // host 每次 render 都新建物件 → 攤平成字串進 deps，值沒變就不跑 effect。
  const stateKey = [
    visibility.bssNationalBridgePreview ? 1 : 0, visibility.bssNationalBridgePointsPreview ? 1 : 0,
    clamp(opacity.bssNationalBridgePreview), clamp(opacity.bssNationalBridgePointsPreview),
    safeControls.lineClass, safeControls.lineQuality, safeControls.pointQuality, safeControls.pointScale,
  ].join(",");

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const denyPrivateAccess = () => {
      window.dispatchEvent(new Event(BSS_BRIDGE_ACCESS_DENIED_EVENT));
      window.dispatchEvent(new Event(BSS_BRIDGE_SELECTION_CLEAR_EVENT));
    };
    const mount = () => {
      if (!access.allowed || !access.userId || !active) { removeAll(map); return; }
      registerPrivateCoralSourceOnce();
      if (!map.getSource(BSS_BRIDGE_SOURCE_ID)) {
        const userId = access.userId;
        map.addSource(BSS_BRIDGE_SOURCE_ID, {
          type: PRIVATE_CORAL_PMTILES_SOURCE_TYPE,
          url: new URL(BSS_BRIDGE_PRIVATE_ENDPOINT, window.location.href).href,
          getToken: async () => {
            try { return await bssBridgePrivateAccessToken(userId); }
            catch (error) { denyPrivateAccess(); throw error; }
          },
          onAccessDenied: denyPrivateAccess,
          minzoom: BSS_BRIDGE_MIN_ZOOM, maxzoom: BSS_BRIDGE_MAX_ZOOM,
        } as unknown as Parameters<MapboxMap["addSource"]>[1]);
        const source = map.getSource(BSS_BRIDGE_SOURCE_ID) as unknown as { attribution?: string; on?: (type: string, listener: () => void) => void };
        if (source) {
          source.attribution = BSS_BRIDGE_ATTRIBUTION;
          source.on?.("data", () => { if (source.attribution !== BSS_BRIDGE_ATTRIBUTION) source.attribution = BSS_BRIDGE_ATTRIBUTION; });
        }
        keepLoadingUntilMapIdle(map, `${BSS_BRIDGE_SOURCE_ID}:render`, "橋梁研究圖磚載入中", BSS_BRIDGE_SOURCE_ID);
      }
      for (const layer of buildBssBridgeLayers(latest.current)) if (!map.getLayer(layer.id)) map.addLayer(layer);
      syncLayers(map, latest.current);
      setMountRevision((revision) => revision + 1);
    };
    const onError = (event: { sourceId?: string; error?: Error }) => {
      if (event.sourceId === BSS_BRIDGE_SOURCE_ID) console.warn("[bss-bridge] private source error", event.error);
    };
    mount(); map.on("style.load", mount); map.on("error", onError);
    return () => { map.off("style.load", mount); map.off("error", onError); };
  }, [access.allowed, access.userId, active, mapRef, tick]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    syncLayers(map, latest.current);
  }, [isDarkTheme, mapRef, mountRevision, stateKey]);
}
