/**
 * 比較模式的右圖（docs/features/compare-mode/DESIGN.md §3，P1）。
 *
 * - **開才建、關就銷毀**（使用者 Q4 (a)）：本元件只在比較開著時掛載；每掛一次＝一次 Mapbox map load。
 * - 疊在主地圖上，用 `clip-path: inset(0 0 0 X%)` 只露出把手右邊；被裁掉的區域不攔截指標事件（P0 實測，Chromium），
 *   所以左半的點擊、拖曳落到主地圖。容器 `z-index: 0`：主地圖右下的版權列與資料來源列（Mapbox 控制角落 z 2）仍在上面。
 * - 同底圖 styleUrl／Pure Black／地名開關／語系；鏡頭雙向同步（`compareSync.ts`），地形鏡射主圖。
 * - P1 內容：古地圖六層（同一支 hook）、統計（面量圖＋比例圓，`attachRegionalStatistics` 以右圖身分掛：只擁有 `key::R`）。
 *   其他圖層不在右圖畫（Q1 (a)：只在左側）。
 * - 右半的點擊／hover 只有右圖收得到（P0）：這裡另綁點擊，命中統計面或比例圓 → 同一個停靠 popup（properties 帶 `compare_side: "right"`），
 *   選取圈也畫在右圖（主圖的選取圈在右半會被右圖蓋住）。
 */
import { useEffect, useRef, useState } from "react";
import mapboxgl, { type PointLike } from "mapbox-gl";
import type { FeatureInfo } from "../types";
import { resolvedCjkFont } from "../styles/designTokens";
import { localeStore } from "../state/localeStore";
import { basemapLabelLanguage, bindBasemapLanguage } from "./basemapLanguage";
import { applyPureBlackTheme, setBasemapLabelsVisible, setupTerrain } from "./MapView";
import { syncMaps, cameraOf, type SyncableMap } from "./compareSync";
import { attachRegionalStatistics } from "./regionalStatisticsMap";
import { COMPARE_DEFAULT_SPLIT, compareStore, shownOnRight, useCompareSelector, useCompareState, type CompareState } from "../state/compareStore";
import { compareCircleReference, compareDotUnit, rightReadKey, startRightSelectionSync } from "../state/compareStatistics";
import { layerVisibilityStore, useLayerVisibilityAll } from "../state/layerVisibilityStore";
import { STATISTICS_RENDER_KEYS } from "../data/regionalStatisticsRecipes";
import { GIS_LAYERS } from "./gisClickRegistry";
import { useHistoricalMapLayer } from "../hooks/useHistoricalMapSinicaLayer";
import { HISTORICAL_MAP_GROUPS, type HistoricalMapGroupKey } from "../data/historicalMapSinica";
import { useKeyOverlayParams } from "../layers/layerParamsAccess";
import { useSelectionRing } from "../hooks/useSelectionRing";
import { recordSelectionClick, selectionRingAccent, SELECTION_RING_ACCENT_VAR } from "./selectionRing";
import { compareRightMap } from "./compareRightMap";
import { sessionTracker } from "../lib/sessionTracker";

const LOADING_PREFIX = "compare-right:";
/** 右圖可點的圖層＝統計那一條登記（與主地圖同一份 layer id：`<key>-fill`、`<key>-circle`；點密度的點不可點，點區域命中透明的 fill） */
const STATISTICS_CLICK_LAYERS = GIS_LAYERS.find((entry) => entry.type === "regionalStatistic")?.layers ?? [];

interface CompareMapViewProps {
  /** 主地圖（左）；就緒後才建右圖 */
  mainMap: mapboxgl.Map;
  styleUrl: string;
  pureBlack: boolean;
  isDarkTheme: boolean;
  showBasemapLabels: boolean;
  featureInfo: FeatureInfo | null;
  onFeatureInfo: (info: FeatureInfo | null) => void;
}

/** 右圖目前畫著的統計 layer id（點擊／hover 只查這些） */
function shownStatisticsLayerIds(map: mapboxgl.Map): string[] {
  const visibility = layerVisibilityStore.getAll() as unknown as Record<string, boolean>;
  const shown = new Set<string>(STATISTICS_RENDER_KEYS.filter((key) => shownOnRight(key, Boolean(visibility[key]))));
  return STATISTICS_CLICK_LAYERS.filter((id) => shown.has(id.replace(/-(fill|circle)$/, "")) && map.getLayer(id));
}

export function CompareMapView({ mainMap, styleUrl, pureBlack, isDarkTheme, showBasemapLabels, featureInfo, onFeatureInfo }: CompareMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const { split } = useCompareState();
  const isDarkRef = useRef(isDarkTheme);
  const pureBlackRef = useRef(pureBlack);
  const labelsRef = useRef(showBasemapLabels);
  const hiddenLabelsRef = useRef(new Set<string>());
  const onFeatureInfoRef = useRef(onFeatureInfo);
  isDarkRef.current = isDarkTheme;
  pureBlackRef.current = pureBlack;
  labelsRef.current = showBasemapLabels;
  onFeatureInfoRef.current = onFeatureInfo;

  // 建立／銷毀（開才建、關就銷毀；styleUrl 之後改走 setStyle）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const camera = cameraOf(mainMap as unknown as SyncableMap);
    const map = new mapboxgl.Map({
      container,
      style: styleUrl,
      center: camera.center,
      zoom: camera.zoom,
      bearing: camera.bearing,
      pitch: camera.pitch,
      antialias: true,
      localIdeographFontFamily: resolvedCjkFont(),
      // 版權由主地圖右下版權列統一顯示（同一個底圖）；右側圖層的來源由 AttributionBar 一併列出
      attributionControl: false,
      language: basemapLabelLanguage(localeStore.getSnapshot().locale),
    });
    const unbindLanguage = bindBasemapLanguage(map, localeStore);
    const mirrorTerrain = () => {
      try {
        if (mainMap.getTerrain() && !map.getTerrain()) setupTerrain(map);
      } catch { /* style 切換中：style.load 會再判斷 */ }
    };
    map.on("style.load", () => {
      map.style?.setTransition({ duration: 0, delay: 0 });
      if (pureBlackRef.current) applyPureBlackTheme(map);
      hiddenLabelsRef.current.clear();
      setBasemapLabelsVisible(map, labelsRef.current, hiddenLabelsRef.current);
      mirrorTerrain();
    });
    // 兩個方向都鏡射：在右半傾斜時，主圖的 pitch 事件會在 jumpTo 當下掛上地形，接著右圖跟上
    const offSync = syncMaps(mainMap as unknown as SyncableMap, map as unknown as SyncableMap, mirrorTerrain);
    const detachStatistics = attachRegionalStatistics(map, () => isDarkRef.current, {
      primary: false,
      isShown: (key) => shownOnRight(key, layerVisibilityStore.getVisibility(key)),
      storeKey: (key) => rightReadKey(key),
      subscribe: (callback) => compareStore.subscribe(callback),
      circleReference: compareCircleReference,
      dotUnit: compareDotUnit,
      loadingPrefix: LOADING_PREFIX,
    });
    const offRightSync = startRightSelectionSync();

    // 右半的點擊：只處理右圖畫著的統計面／比例圓（古地圖沒有可點物件）；沒命中＝關掉 popup（同主地圖空白處）
    map.on("click", (e) => {
      recordSelectionClick([e.lngLat.lng, e.lngLat.lat]);
      const layers = shownStatisticsLayerIds(map);
      const bbox: [PointLike, PointLike] = [[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]];
      const hit = layers.length ? map.queryRenderedFeatures(bbox, { layers })[0] : undefined;
      if (!hit) { onFeatureInfoRef.current(null); return; }
      onFeatureInfoRef.current({ layerType: "regionalStatistic", properties: { ...(hit.properties ?? {}), compare_side: "right" }, coords: [e.lngLat.lng, e.lngLat.lat] });
      sessionTracker.log("feature_click", { layerType: "regionalStatistic" });
    });
    map.on("mousemove", (e) => {
      const layers = shownStatisticsLayerIds(map);
      const hit = layers.length > 0 && map.queryRenderedFeatures(e.point, { layers }).length > 0;
      map.getCanvas().style.cursor = hit ? "pointer" : "";
    });
    map.on("load", () => {
      mapRef.current = map;
      compareRightMap.set(map);
      // debug handle（同主地圖 `__map`：dev 一律、production 帶 ?debug）
      if (import.meta.env.DEV || window.location.search.includes("debug")) (window as unknown as { __compareMap?: mapboxgl.Map | null }).__compareMap = map;
      setReady(true);
    });
    return () => {
      offRightSync();
      detachStatistics();
      offSync();
      unbindLanguage();
      compareRightMap.set(null);
      if ((window as unknown as { __compareMap?: mapboxgl.Map | null }).__compareMap === map) (window as unknown as { __compareMap?: mapboxgl.Map | null }).__compareMap = null;
      mapRef.current = null;
      setReady(false);
      map.remove();
    };
    // 只在掛載時建一次：styleUrl／主題另由下方 effect 套用
  }, [mainMap]);

  // 換底圖／Pure Black（同 MapView：純黑開＝壓色；關或換底圖＝完整重載 style，style.load 重建右側圖層）
  const appliedRef = useRef({ styleUrl, pureBlack });
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const applied = appliedRef.current;
    if (applied.styleUrl === styleUrl && applied.pureBlack === pureBlack) return;
    appliedRef.current = { styleUrl, pureBlack };
    if (applied.styleUrl === styleUrl && pureBlack) applyPureBlackTheme(map);
    else map.setStyle(styleUrl, { diff: false } as never);
  }, [styleUrl, pureBlack, ready]);

  // 地名開關
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    setBasemapLabelsVisible(map, showBasemapLabels, hiddenLabelsRef.current);
  }, [showBasemapLabels, ready]);

  // 選取圈主題色（同主地圖：CSS 變數）
  useEffect(() => {
    mapRef.current?.getContainer().style.setProperty(SELECTION_RING_ACCENT_VAR, selectionRingAccent(isDarkTheme));
  }, [isDarkTheme, ready]);

  return (
    <div
      ref={containerRef}
      className={`pulse-map pulse-compare-map ${isDarkTheme ? "pulse-map--dark" : "pulse-map--light"}`}
      // 主地圖之後渲染、z 0：蓋在主地圖畫布上，但在主地圖的控制角落（z 2）與所有介面（≥10）之下
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, clipPath: `inset(0 0 0 ${(split * 100).toFixed(3)}%)` }}
    >
      {ready && <CompareRightLayers mapRef={mapRef} featureInfo={featureInfo} />}
    </div>
  );
}

/** 右圖的 hook 型圖層（P1：古地圖六層）＋選取圈；右圖 load 之後才掛，hook 一定拿得到地圖 */
function CompareRightLayers({ mapRef, featureInfo }: { mapRef: React.RefObject<mapboxgl.Map | null>; featureInfo: FeatureInfo | null }) {
  // 只訂開關與側別（拖把手不重繪這些 hook）
  const enabled = useCompareSelector((state) => state.enabled);
  const sides = useCompareSelector((state) => state.sides);
  const compare: CompareState = { enabled, sides, split: COMPARE_DEFAULT_SPLIT };
  const visibility = useLayerVisibilityAll() as unknown as Record<string, boolean>;
  // 固定順序呼叫（每個 key 一次），不在迴圈裡以免違反 hooks 規則
  useRightHistorical(mapRef, "historicalMapSinica", Boolean(visibility.historicalMapSinica), compare);
  useRightHistorical(mapRef, "historicalMapPostwar", Boolean(visibility.historicalMapPostwar), compare);
  useRightHistorical(mapRef, "historicalImagery", Boolean(visibility.historicalImagery), compare);
  useRightHistorical(mapRef, "historicalBoundaries", Boolean(visibility.historicalBoundaries), compare);
  useRightHistorical(mapRef, "historicalLandUse", Boolean(visibility.historicalLandUse), compare);
  useRightHistorical(mapRef, "historicalThematic", Boolean(visibility.historicalThematic), compare);
  useSelectionRing(mapRef, featureInfo);
  return null;
}

function useRightHistorical(mapRef: React.RefObject<mapboxgl.Map | null>, key: HistoricalMapGroupKey, visible: boolean, compare: CompareState) {
  const group = HISTORICAL_MAP_GROUPS.find((g) => g.key === key)!;
  const p = useKeyOverlayParams(key) as Record<string, number | undefined>;
  // 透明度、年代兩側共用（P1 不做左右不同年代）
  useHistoricalMapLayer(mapRef, key, shownOnRight(key, visible, compare), p[`${key}Opacity`] ?? group.defaultOpacity, p[`${key}EraIdx`], LOADING_PREFIX);
}
