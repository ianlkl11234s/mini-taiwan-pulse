/**
 * 視野提示卡的「圖層看不到」段（design-system spec §5.42.1）。判斷規則與純函式在 `map/layerVisibilityHint.ts`；
 * 本 hook 只負責節奏：和「視野在他國」同一套停穩 600ms（`createViewportSettleWatcher`），
 * 開關圖層、圖層載入完成（styledata／sourcedata 停穩 600ms）後也重判一次。
 *
 * 範圍：目前開著、屬於目前國家主體（或全球 WORLD）、沒上鎖的圖層。
 * 停用（enabled=false：手機、拍攝模式、AI 對話框或 Agent 活動卡開著）時不判斷、不顯示。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { LayerVisibility } from "../types";
import { LAYER_MANIFEST } from "../data/layerManifest";
import { COVERAGE_AREAS, type CoverageArea } from "../data/layerCoverage";
import { useCountry } from "../state/countryStore";
import { isResearchMotionActive } from "../research/researchMotion";
import { createViewportSettleWatcher, VIEWPORT_HINT_SETTLE_MS } from "./useViewportCountry";
import {
  buildHintRows,
  createLayerHintDismissal,
  findHiddenLayers,
  layerHintSeeds,
  matchStyleLayers,
  visibleRange,
  type HiddenLayer,
  type HintRow,
  type HintStyleLayer,
} from "../map/layerVisibilityHint";

function evaluateHidden(map: MapboxMap, keys: readonly string[]): HiddenLayer[] {
  if (!keys.length) return [];
  let styleLayers: HintStyleLayer[] = [];
  try { styleLayers = (map.getStyle()?.layers ?? []) as HintStyleLayer[]; } catch { return []; }
  const b = map.getBounds();
  if (!b) return [];
  const sourceMinzoom = (id: string) => {
    const src = map.getSource(id) as { minzoom?: unknown } | undefined;
    return typeof src?.minzoom === "number" ? src.minzoom : undefined;
  };
  return findHiddenLayers({
    keys,
    zoom: map.getZoom(),
    bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
    rangeFor: (key) => visibleRange(matchStyleLayers(layerHintSeeds(key), styleLayers), sourceMinzoom),
  });
}

export function useLayerVisibilityHint({
  map,
  enabled,
  isPrivateView,
  layerVisibility,
  lockedKeys,
}: {
  map: MapboxMap | null;
  enabled: boolean;
  isPrivateView: () => boolean;
  layerVisibility: LayerVisibility;
  lockedKeys: ReadonlySet<keyof LayerVisibility>;
}): {
  rows: HintRow[];
  more: number;
  total: number;
  zoomIn: (row: HintRow) => void;
  goTo: (row: HintRow) => void;
  dismiss: () => void;
} {
  const country = useCountry();
  const openKeys = useMemo(() => (Object.keys(layerVisibility) as (keyof LayerVisibility)[]).filter((key) => {
    if (!layerVisibility[key] || lockedKeys.has(key)) return false;
    const owner = (LAYER_MANIFEST as Record<string, { country?: string } | undefined>)[key]?.country;
    return owner === country || owner === "WORLD";
  }), [layerVisibility, lockedKeys, country]);
  const signature = openKeys.join(",");

  const dismissal = useMemo(() => createLayerHintDismissal(), []);
  const [hidden, setHiddenState] = useState<HiddenLayer[]>([]);
  // 掛在 App：內容沒變就不 setState，避免每次 styledata 都重繪整個 App
  const hiddenSigRef = useRef("[]");
  const setHidden = useCallback((next: HiddenLayer[]) => {
    const sig = JSON.stringify(next);
    if (sig === hiddenSigRef.current) return;
    hiddenSigRef.current = sig;
    setHiddenState(next);
  }, []);
  const [dismissed, setDismissed] = useState(false);
  const keysRef = useRef(openKeys);
  keysRef.current = openKeys;
  const signatureRef = useRef(signature);
  signatureRef.current = signature;
  const isPrivateViewRef = useRef(isPrivateView);
  isPrivateViewRef.current = isPrivateView;

  const evaluate = useCallback(() => {
    if (!map) return;
    const next = isPrivateViewRef.current() ? [] : evaluateHidden(map, keysRef.current);
    setHidden(next);
    setDismissed(dismissal.update(next.map((h) => h.key), signatureRef.current));
  }, [map, dismissal, setHidden]);

  useEffect(() => {
    if (!map || !enabled) {
      setHidden([]);
      return;
    }
    const dispose = createViewportSettleWatcher({
      map,
      isAgentMotion: () => isResearchMotionActive(map),
      onSettle: evaluate,
      onSkip: () => setHidden([]),
    });
    // 圖層載入完成（style layer 加進來、PMTiles header 讀到 minzoom）後再判一次；移動中交給 settle watcher
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onData = () => {
      if (map.isMoving()) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = undefined; if (!map.isMoving()) evaluate(); }, VIEWPORT_HINT_SETTLE_MS);
    };
    map.on("styledata", onData);
    map.on("sourcedata", onData);
    if (!map.isMoving()) evaluate();
    return () => {
      dispose();
      if (timer) clearTimeout(timer);
      map.off("styledata", onData);
      map.off("sourcedata", onData);
    };
  }, [map, enabled, evaluate, setHidden]);

  // 開關圖層、切國家主體：等圖層加進地圖再判斷
  useEffect(() => {
    if (!map || !enabled) return;
    const timer = setTimeout(() => { if (!map.isMoving()) evaluate(); }, VIEWPORT_HINT_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [signature, map, enabled, evaluate]);

  const zoomIn = useCallback((row: HintRow) => {
    if (map && row.targetZoom !== null) map.easeTo({ zoom: row.targetZoom });
  }, [map]);

  const goTo = useCallback((row: HintRow) => {
    if (!map || !row.area) return;
    const area: CoverageArea = COVERAGE_AREAS[row.area];
    const [w, s, e, n] = area.bbox;
    // 一段動畫：先算整框的鏡頭，再確保不低於可見縮放（比整框更近時改用區域中心）
    const camera = map.cameraForBounds([[w, s], [e, n]], { padding: 48 });
    const fitZoom = camera?.zoom ?? 0;
    const zoom = Math.max(fitZoom, row.targetZoom ?? 0);
    const center = zoom > fitZoom && area.center ? [...area.center] as [number, number] : camera?.center ?? [(w + e) / 2, (s + n) / 2];
    map.flyTo({ center, zoom, essential: true });
  }, [map]);

  const dismiss = useCallback(() => {
    dismissal.dismiss(hidden.map((h) => h.key), signatureRef.current);
    setDismissed(true);
  }, [dismissal, hidden]);

  const view = enabled && !dismissed ? buildHintRows(hidden) : { rows: [], more: 0, total: 0 };
  return { ...view, zoomIn, goTo, dismiss };
}
