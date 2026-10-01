import { useEffect, useMemo, useRef, useState } from "react";
import type { FillLayer, LineLayer, Map as MapboxMap } from "mapbox-gl";
import {
  BRIDGE_RESILIENCE_ACCESS_DENIED_EVENT, BRIDGE_RESILIENCE_ATTRIBUTION, BRIDGE_RESILIENCE_COLORS,
  BRIDGE_RESILIENCE_GROUND_OPACITY_FACTOR, BRIDGE_RESILIENCE_LAYER_IDS, BRIDGE_RESILIENCE_MAX_ZOOM,
  BRIDGE_RESILIENCE_MIN_ZOOM, BRIDGE_RESILIENCE_PRIVATE_ENDPOINT, BRIDGE_RESILIENCE_SELECTION_CLEAR_EVENT,
  BRIDGE_RESILIENCE_SOURCE_ID, BRIDGE_RESILIENCE_SOURCE_LAYERS, bridgeModeColorExpression,
  decayFillColorExpression, decodeDecayVillageScenario, decodeDestinationView, decodeVillageScenario, destinationFillColorExpression, destinationTopIds, destinationVillageStates,
  effectiveScenarioUid, highlightUids, scenarioKey, villageFillColorExpression,
  type BridgeMode, type BridgeResilienceData, type BridgeWeighting, type DestinationView, type VillageDestinations, type VillageMetric,
} from "../data/bridgeResilienceTypes";
import {
  bridgeResilienceDataStore, bridgeResilienceDestinationsStore, bridgeResilienceDestinationStatus, bridgeResilienceOrigin,
  useBridgeResilienceDestinations, useBridgeResilienceOrigin, useBridgeResilienceSelection,
} from "../data/bridgeResilienceStore";
import { loadBridgeResilienceData, loadVillageDestinations } from "../data/bridgeResilienceLoader";
import { paramDefault } from "../data/layerParamsSpec";
import { keepLoadingUntilMapIdle, withLoading } from "../lib/loadingRegistry";
import { PRIVATE_CORAL_PMTILES_SOURCE_TYPE, registerPrivateCoralSourceOnce } from "../map/privateCoralPmtiles";
import { bridgeResiliencePrivateAccessToken, useBridgeResiliencePrivateAccess } from "./useBridgeResiliencePrivateAccess";
import { useMapReadyTick } from "./useMapReadyTick";
import { hookFillOpacity, hookFillPaint } from "../map/lineFillSpec";

/** 圖層參數（layerParamsStore）：模式、權重、村里、色階指標（僅不分遠近）、替代路線、聯合情境。 */
export interface BridgeResilienceControls {
  mode: BridgeMode; weighting: BridgeWeighting; showVillages: boolean; metric: VillageMetric; showRoutes: boolean; joint: boolean;
}

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const IDS = BRIDGE_RESILIENCE_LAYER_IDS;
const LAYERS = BRIDGE_RESILIENCE_SOURCE_LAYERS;
const SRC = BRIDGE_RESILIENCE_SOURCE_ID;

/** 目的地視角：起點村里 feature id 與前 20 名目的地 id；view 為 null＝起點視角（或目的地資料還在載入）。 */
export interface DestinationFocus { originId: number | null; topIds: number[]; active: boolean }
const NO_FOCUS: DestinationFocus = { originId: null, topIds: [], active: false };
type Snapshot = { visible: boolean; opacity: number; controls: BridgeResilienceControls; selected: string | null; focus?: DestinationFocus };

const NO_MATCH = ["==", ["get", "bridge_uid"], ""] as const;
const NO_ID = ["==", ["id"], -1] as const;

/** 起點村里外框：以 feature id（int VILLCODE）比對；沒有起點時不命中。 */
export function originFilter(originId: number | null): unknown[] {
  return originId === null ? [...NO_ID] : ["==", ["id"], originId];
}
/** 前 20 名受影響目的地外框。 */
export function destTopFilter(topIds: readonly number[]): unknown[] {
  return topIds.length ? ["in", ["id"], ["literal", [...topIds]]] : [...NO_ID];
}
/** 目的地視角（只有不分遠近版資料）優先；否則依權重：距離遞減 7 級秒數色階，或不分遠近的 p90／占比色階。 */
export const fillColor = (metric: VillageMetric, weighting: BridgeWeighting, focus: DestinationFocus) =>
  (focus.active ? destinationFillColorExpression() : weighting === "decay" ? decayFillColorExpression() : villageFillColorExpression(metric));
const equalsFilter = (uid: string | null) => (uid ? ["==", ["get", "bridge_uid"], uid] : NO_MATCH);

/** 高亮：選中橋；聯合情境時兩座成員橋同時高亮（聯合情境沒有自己的線）。 */
export function highlightFilter(selected: string | null, joint: boolean): unknown[] {
  const uids = highlightUids(selected, joint);
  return uids.length ? ["in", ["get", "bridge_uid"], ["literal", uids]] : [...NO_MATCH];
}
/** 替代路線：只畫當前情境（聯合時是聯合鍵）＋當前模式的代表性起訖對。 */
export function routeFilter(selected: string | null, controls: BridgeResilienceControls, variant: "before" | "after"): unknown[] {
  const uid = effectiveScenarioUid(selected, controls.joint);
  if (!uid || !controls.showRoutes) return [...NO_MATCH];
  return ["all", equalsFilter(uid), ["==", ["get", "mode"], controls.mode], ["==", ["get", "variant"], variant]];
}

const lineWidth = (car: number, scooter: number, zoomBoost = 1) => ["interpolate", ["linear"], ["zoom"], 8, ["match", ["get", "mode"], "scooter", scooter * 0.5, car * 0.5], 12, ["match", ["get", "mode"], "scooter", scooter, car], 15, ["match", ["get", "mode"], "scooter", scooter * 1.8 * zoomBoost, car * 1.8 * zoomBoost]];

/** 全部 style layer（初始 visibility none）；匯出供測試做 style-spec 驗證。 */
export function buildBridgeResilienceLayers(state: Snapshot): (FillLayer | LineLayer)[] {
  const { opacity, controls, selected } = state;
  const focus = state.focus ?? NO_FOCUS;
  const o = clamp(opacity);
  const hidden = { visibility: "none" as const };
  const base = (id: string, type: "fill" | "line", layer: string) => ({ id, type, source: SRC, "source-layer": layer, layout: hidden });
  return [
    { ...base(IDS.villageFill, "fill", LAYERS.villages), paint: hookFillPaint("bridgeResilienceTwinCity", IDS.villageFill, { "fill-color": fillColor(controls.metric, controls.weighting, focus), "fill-opacity": o * 0.62 }, { "fill-color": fillColor(controls.metric, controls.weighting, focus), "fill-opacity": Number(paramDefault("bridgeResilienceTwinCity", "bridgeResilienceTwinCityOpacity") ?? 1) * 0.62 }) },
    { ...base(IDS.villageOutline, "line", LAYERS.villages), paint: { "line-color": BRIDGE_RESILIENCE_COLORS.villageOutline, "line-width": 0.5, "line-opacity": o * 0.22 } },
    // 目的地視角：前 20 名受影響目的地（細藍外框）與起點（白色粗外框）。起點視角時 filter 不命中任何 feature。
    { ...base(IDS.destTop, "line", LAYERS.villages), filter: destTopFilter(focus.topIds),
      paint: { "line-color": BRIDGE_RESILIENCE_COLORS.destTop, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1, 14, 2.5], "line-opacity": Math.max(0.7, o) } },
    { ...base(IDS.origin, "line", LAYERS.villages), filter: originFilter(focus.originId),
      layout: { ...hidden, "line-join": "round" },
      paint: { "line-color": BRIDGE_RESILIENCE_COLORS.destOrigin, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 14, 4], "line-opacity": Math.max(0.9, o) } },
    { ...base(IDS.highlight, "line", LAYERS.bridges), filter: highlightFilter(selected, controls.joint),
      layout: { ...hidden, "line-cap": "round", "line-join": "round" },
      paint: { "line-color": BRIDGE_RESILIENCE_COLORS.highlight, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 5, 12, 10, 15, 18], "line-opacity": Math.max(0.5, o) * 0.55, "line-blur": 1.5 } },
    { ...base(IDS.routeBefore, "line", LAYERS.routes), filter: routeFilter(selected, controls, "before"),
      layout: { ...hidden, "line-cap": "round", "line-join": "round" },
      paint: { "line-color": BRIDGE_RESILIENCE_COLORS.routeBefore, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.5, 15, 4], "line-opacity": Math.max(0.6, o), "line-dasharray": [1.5, 1.5] } },
    { ...base(IDS.routeAfter, "line", LAYERS.routes), filter: routeFilter(selected, controls, "after"),
      layout: { ...hidden, "line-cap": "round", "line-join": "round" },
      paint: { "line-color": BRIDGE_RESILIENCE_COLORS.routeAfter, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 15, 5], "line-opacity": Math.max(0.7, o) } },
    // 地面引道（is_removed_structure=false，未被移除）：同色淡化＋虛線。dasharray 不能資料驅動，所以獨立一層。
    { ...base(IDS.ground, "line", LAYERS.bridges), filter: ["==", ["get", "is_removed_structure"], false],
      paint: { "line-color": bridgeModeColorExpression, "line-width": lineWidth(2.4, 1.6), "line-opacity": o * BRIDGE_RESILIENCE_GROUND_OPACITY_FACTOR, "line-dasharray": [1.5, 1.5] } },
    { ...base(IDS.structure, "line", LAYERS.bridges), filter: ["==", ["get", "is_removed_structure"], true],
      layout: { ...hidden, "line-cap": "round", "line-join": "round" },
      paint: { "line-color": bridgeModeColorExpression, "line-width": lineWidth(3.2, 2), "line-opacity": o } },
    // 透明加寬命中層（四鐵則③：細線點擊命中率差），同 road-congestion-hit 作法。
    { ...base(IDS.hit, "line", LAYERS.bridges), paint: { "line-color": "#000000", "line-width": 16, "line-opacity": 0 } },
  ] as unknown as (FillLayer | LineLayer)[];
}

const ALL_LAYER_IDS: string[] = Object.values(IDS);

/** 只 setLayoutProperty／setPaintProperty／setFilter：開關、透明度、模式都不重建 source（R2 教訓）。 */
function syncLayers(map: MapboxMap, state: Snapshot) {
  const { visible, opacity, controls, selected } = state;
  const focus = state.focus ?? NO_FOCUS;
  const o = clamp(opacity);
  const villagesOn = visible && controls.showVillages && !!selected;
  const set = (id: string, vis: boolean) => { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis ? "visible" : "none"); };
  const villageIds: string[] = [IDS.villageFill, IDS.villageOutline, IDS.destTop, IDS.origin];
  for (const id of ALL_LAYER_IDS) set(id, visible && !villageIds.includes(id));
  for (const id of villageIds) set(id, villagesOn);
  const paint = (id: string, prop: string, value: unknown) => { if (map.getLayer(id)) map.setPaintProperty(id, prop as never, value as never); };
  const filter = (id: string, value: unknown[]) => { if (map.getLayer(id)) map.setFilter(id, value as never); };
  paint(IDS.villageFill, "fill-color", fillColor(controls.metric, controls.weighting, focus));
  paint(IDS.destTop, "line-opacity", Math.max(0.7, o));
  paint(IDS.origin, "line-opacity", Math.max(0.9, o));
  filter(IDS.destTop, destTopFilter(focus.topIds));
  filter(IDS.origin, originFilter(focus.originId));
  paint(IDS.villageFill, "fill-opacity", hookFillOpacity("bridgeResilienceTwinCity", IDS.villageFill, o * 0.62, Number(paramDefault("bridgeResilienceTwinCity", "bridgeResilienceTwinCityOpacity") ?? 1) * 0.62));
  paint(IDS.villageOutline, "line-opacity", o * 0.22);
  paint(IDS.structure, "line-opacity", o);
  paint(IDS.ground, "line-opacity", o * BRIDGE_RESILIENCE_GROUND_OPACITY_FACTOR);
  paint(IDS.highlight, "line-opacity", Math.max(0.5, o) * 0.55);
  filter(IDS.highlight, highlightFilter(selected, controls.joint));
  filter(IDS.routeBefore, routeFilter(selected, controls, "before"));
  filter(IDS.routeAfter, routeFilter(selected, controls, "after"));
}

function removeAll(map: MapboxMap) {
  for (const id of [...ALL_LAYER_IDS].reverse()) { try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* style replaced */ } }
  try { if (map.getSource(SRC)) map.removeSource(SRC); } catch { /* style replaced */ }
}

/**
 * 村里 feature-state：id＝int(VILLCODE)。null 一律 has=0（走中性色，不當 0）；
 * 沒有選橋、或沒開村里時清空整個 source-layer 的 state。回傳寫入筆數（測試／除錯用）。
 */
export function applyVillageState(
  map: Pick<MapboxMap, "getSource" | "setFeatureState" | "removeFeatureState">,
  data: BridgeResilienceData | null, scenario: string | null, metric: VillageMetric, enabled: boolean,
  weighting: BridgeWeighting = "uniform",
): number {
  if (!map.getSource(SRC)) return 0;
  const target = { source: SRC, sourceLayer: LAYERS.villages };
  const values = !(enabled && data && scenario) ? null
    : weighting === "decay" ? decodeDecayVillageScenario(data.decayImpacts, scenario) : decodeVillageScenario(data.impacts, scenario, metric);
  try {
    if (!values) { map.removeFeatureState(target); return 0; }
    for (const [id, value] of values) map.setFeatureState({ ...target, id }, value === null ? { has: 0, v: 0 } : { has: 1, v: value });
    return values.size;
  } catch {
    return 0; // source 尚未就緒：mountRevision／sourcedata 重跑時會再套
  }
}

/**
 * 目的地視角的村里 feature-state：has 0 中性／1 受影響（v＝所在區平均 ΔT 秒）／2 不可達／3 起點。
 * 只寫入有變動的整批（1,488 筆）；source 尚未就緒時吞掉例外，由 sourcedata 重跑。
 */
export function applyDestinationState(
  map: Pick<MapboxMap, "getSource" | "setFeatureState">, dest: VillageDestinations | null, view: DestinationView | null,
): number {
  if (!map.getSource(SRC) || !dest || !view) return 0;
  const target = { source: SRC, sourceLayer: LAYERS.villages };
  try {
    const states = destinationVillageStates(dest, view);
    for (const [id, state] of states) map.setFeatureState({ ...target, id }, { has: state.has, v: state.v });
    return states.size;
  } catch {
    return 0;
  }
}

/** 站主限定：一個私人 PMTiles source（bridges／replacement_routes／villages）＋私人 JSON（指標與村里影響）。 */
export function useBridgeResilienceLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  controls: BridgeResilienceControls,
) {
  const tick = useMapReadyTick(mapRef, visible);
  const access = useBridgeResiliencePrivateAccess();
  const selected = useBridgeResilienceSelection();
  const origin = useBridgeResilienceOrigin();
  const destinations = useBridgeResilienceDestinations();
  const [mountRevision, setMountRevision] = useState(0);
  const [data, setData] = useState<BridgeResilienceData | null>(null);
  const scenarioUid = effectiveScenarioUid(selected, controls.joint);
  const scenario = scenarioUid ? scenarioKey(scenarioUid, controls.mode) : null;
  const villagesEnabled = visible && controls.showVillages && !!selected;
  // 目的地視角：有起點、資料已載入、且情境／起點都在檔內才成立；否則維持起點視角（起點外框仍畫）。
  const view = useMemo(
    () => (villagesEnabled && origin && destinations && scenario ? decodeDestinationView(destinations, scenario, origin) : null),
    [villagesEnabled, origin, destinations, scenario],
  );
  const originId = villagesEnabled && origin && Number.isSafeInteger(Number(origin)) ? Number(origin) : null;
  const focus: DestinationFocus = originId === null ? NO_FOCUS : { originId, topIds: destinationTopIds(view), active: !!view };
  const latest = useRef<Snapshot>({ visible, opacity, controls, selected, focus });
  latest.current = { visible, opacity, controls, selected, focus };
  const stateKey = [visible ? 1 : 0, clamp(opacity), controls.mode, controls.weighting, controls.showVillages ? 1 : 0, controls.metric, controls.showRoutes ? 1 : 0, controls.joint ? 1 : 0, selected ?? "",
    focus.originId ?? "", focus.active ? 1 : 0, focus.topIds.join("|")].join(",");

  // 沒有橋、圖層關閉或村里關閉時，起點視角就沒有意義：清起點（橋的選取不受影響）。
  useEffect(() => {
    if (origin && !villagesEnabled) bridgeResilienceOrigin.clear();
  }, [origin, villagesEnabled]);

  // 目的地資料（6.4 MB）：第一次進入目的地視角才載入；失去權限或圖層關閉即清空。
  useEffect(() => {
    if (!visible || !access.allowed || !access.userId) {
      bridgeResilienceDestinationsStore.set(null); bridgeResilienceDestinationStatus.set("idle"); return;
    }
    if (!origin || bridgeResilienceDestinationsStore.get()) return;
    const userId = access.userId;
    const controller = new AbortController();
    bridgeResilienceDestinationStatus.set("loading");
    void withLoading("bridge-resilience:destinations", "橋梁韌性目的地資料載入中", (async () => {
      const token = await bridgeResiliencePrivateAccessToken(userId);
      return loadVillageDestinations(token, undefined, controller.signal);
    })()).then((loaded) => {
      if (controller.signal.aborted) return;
      bridgeResilienceDestinationsStore.set(loaded); bridgeResilienceDestinationStatus.set("idle");
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      bridgeResilienceDestinationStatus.set("error");
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403) window.dispatchEvent(new Event(BRIDGE_RESILIENCE_ACCESS_DENIED_EVENT));
      console.warn("[bridge-resilience] destinations load failed", error);
    });
    return () => { controller.abort(); if (!bridgeResilienceDestinationsStore.get()) bridgeResilienceDestinationStatus.set("idle"); };
  }, [visible, access.allowed, access.userId, origin]);

  // 私人 JSON：只有站主、圖層開著才下載；失去權限或關閉即清空（不留在記憶體給別的帳號）。
  useEffect(() => {
    if (!visible || !access.allowed || !access.userId) { setData(null); bridgeResilienceDataStore.set(null); return; }
    const userId = access.userId;
    const controller = new AbortController();
    void withLoading("bridge-resilience:data", "橋梁韌性指標載入中", (async () => {
      const token = await bridgeResiliencePrivateAccessToken(userId);
      return loadBridgeResilienceData(token, undefined, controller.signal);
    })()).then((loaded) => {
      if (controller.signal.aborted) return;
      setData(loaded); bridgeResilienceDataStore.set(loaded);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403) window.dispatchEvent(new Event(BRIDGE_RESILIENCE_ACCESS_DENIED_EVENT));
      console.warn("[bridge-resilience] private data load failed", error);
    });
    return () => { controller.abort(); setData(null); bridgeResilienceDataStore.set(null); };
  }, [visible, access.allowed, access.userId]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const denyPrivateAccess = () => {
      window.dispatchEvent(new Event(BRIDGE_RESILIENCE_ACCESS_DENIED_EVENT));
      window.dispatchEvent(new Event(BRIDGE_RESILIENCE_SELECTION_CLEAR_EVENT));
    };
    const mount = () => {
      if (!access.allowed || !access.userId || !visible) { removeAll(map); return; }
      registerPrivateCoralSourceOnce();
      if (!map.getSource(SRC)) {
        const userId = access.userId;
        map.addSource(SRC, {
          type: PRIVATE_CORAL_PMTILES_SOURCE_TYPE,
          url: new URL(`${BRIDGE_RESILIENCE_PRIVATE_ENDPOINT}/tiles`, window.location.href).href,
          getToken: async () => {
            try { return await bridgeResiliencePrivateAccessToken(userId); }
            catch (error) { denyPrivateAccess(); throw error; }
          },
          onAccessDenied: denyPrivateAccess,
          minzoom: BRIDGE_RESILIENCE_MIN_ZOOM, maxzoom: BRIDGE_RESILIENCE_MAX_ZOOM,
        } as unknown as Parameters<MapboxMap["addSource"]>[1]);
        const source = map.getSource(SRC) as unknown as { attribution?: string; on?: (type: string, listener: () => void) => void };
        if (source) {
          source.attribution = BRIDGE_RESILIENCE_ATTRIBUTION;
          source.on?.("data", () => { if (source.attribution !== BRIDGE_RESILIENCE_ATTRIBUTION) source.attribution = BRIDGE_RESILIENCE_ATTRIBUTION; });
        }
        keepLoadingUntilMapIdle(map, `${SRC}:render`, "橋梁韌性圖磚載入中", SRC);
      }
      for (const layer of buildBridgeResilienceLayers(latest.current)) if (!map.getLayer(layer.id)) map.addLayer(layer);
      syncLayers(map, latest.current);
      setMountRevision((revision) => revision + 1);
    };
    const onError = (event: { sourceId?: string; error?: Error }) => {
      if (event.sourceId === SRC) console.warn("[bridge-resilience] private source error", event.error);
    };
    mount(); map.on("style.load", mount); map.on("error", onError);
    return () => { map.off("style.load", mount); map.off("error", onError); };
  }, [access.allowed, access.userId, visible, mapRef, tick]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    syncLayers(map, latest.current);
  }, [mapRef, mountRevision, stateKey]);

  // 村里 feature-state：情境（橋＋模式＋聯合）、指標、資料任一變動就重套。
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const enabled = visible && controls.showVillages;
    // 目的地視角優先；否則（或目的地資料還沒好）維持起點視角的色階。
    const paintStates = () => { if (view && destinations) applyDestinationState(map, destinations, view); else applyVillageState(map, data, scenario, controls.metric, enabled, controls.weighting); };
    paintStates();
    const onSourceData = (event: { sourceId?: string; isSourceLoaded?: boolean }) => {
      if (event.sourceId === SRC && event.isSourceLoaded) { map.off("sourcedata", onSourceData as never); paintStates(); }
    };
    if (enabled && !map.isSourceLoaded?.(SRC)) map.on("sourcedata", onSourceData as never);
    return () => { map.off("sourcedata", onSourceData as never); };
  }, [mapRef, mountRevision, data, destinations, view, scenario, visible, controls.metric, controls.weighting, controls.showVillages]);
}
