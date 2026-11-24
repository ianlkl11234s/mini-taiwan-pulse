/**
 * 兩國並排的右圖（比較模式 `countries`，G2-1；評估 `.gis-agent-system` G2-EVAL §2.1 版面（甲））。
 *
 * - **版面**：右圖是右半幅容器、不裁切；主地圖保持全寬，右側 padding＝半寬，視覺中心落在左半。
 *   中間分隔線固定 50%（`CountryCompareChrome`）。
 * - **生命週期**：開才建、關就銷毀（同拉桿模式 Q4 (a)）。App 以 `key={rightCountry}` 掛載，換右側國家＝整張重建，
 *   舊國圖層不會殘留（外國 hook 的 cleanup 大多不移除圖層）。
 * - **鏡頭**：位置、旋轉、傾斜各自操作；比例尺依緯度換算同步（`compareSync.syncScale`，可關）。地形各自依傾斜判斷。
 * - **圖層**：右國圖層由右圖自己的 `<LayerHosts role="right">` 掛（主地圖那份同一批 Host 讀成 false）；
 *   右國統計以唯讀身分掛（資料仍由主地圖那份擁有）。WORLD／SIM 只在主地圖。
 * - **overlay 型右國圖層**（G2-1b）：右圖自己跑一份 overlay 管理（只含右國的 `OVERLAY_REGISTRY` 項目）：
 *   style.load 時建 source／layer 並 hydrate，圖層開關、主題、參數變動時更新；hydrate 紀錄以地圖實例分開。
 *   dynamicData 的 source 由右圖那份 Host 的 hook 餵資料；主地圖用 `leftMapVisibility` 把它們讀成關閉。
 * - **點擊**：右圖自己綁 click，與主地圖共用 `gisClickQuery` 的命中與欄位整理；結果進同一個停靠 popup，
 *   properties 帶 `compare_side: "right"`，選取圈畫在右圖。
 * - **卸載順序**：React 刪除子樹時由上而下跑 cleanup，本元件的 cleanup 早於子層 Host；`map.remove()` 延到
 *   microtask，讓右國 hook 的 cleanup 先拿到仍存活的地圖（不必逐支補 try/catch）。
 * - Agent（MCP）：map_context 另給 `compare.right`（右圖鏡頭、範圍、摘要），指令可帶 `side: "right"` 移動右圖、在右圖畫結果（G2-3，`research/compareBridge.ts`）。
 */
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { FeatureInfo } from "../types";
import { resolvedCjkFont } from "../styles/designTokens";
import { localeStore, useLocale } from "../state/localeStore";
import { basemapLabelLanguage, bindBasemapLanguage } from "./basemapLanguage";
import { applyPureBlackTheme, ensureTerrainIfTilted, setBasemapLabelsVisible } from "./MapView";
import { alignScale, scaleMatchedZoom, syncScale, type ScaleSyncableMap } from "./compareSync";
import { attachRegionalStatistics } from "./regionalStatisticsMap";
import { compareStore, shownOnRight } from "../state/compareStore";
import { countryCameraMemory } from "../state/countryStore";
import { layerVisibilityStore } from "../state/layerVisibilityStore";
import { gisHitCandidates, gisHitProperties } from "./gisClickQuery";
import { useSelectionRing } from "../hooks/useSelectionRing";
import { recordSelectionClick, selectionRingAccent, SELECTION_RING_ACCENT_VAR } from "./selectionRing";
import { compareRightMap } from "./compareRightMap";
import { sessionTracker } from "../lib/sessionTracker";
import { loadingRegistry } from "../lib/loadingRegistry";
import { LayerHosts } from "../layers/LayerHost";
import { useOverlayParams } from "../layers/layerParamsAccess";
import { OVERLAY_REGISTRY } from "./overlayRegistry";
import { isRightSideKey } from "./compareCountrySides";
import { addAllOverlays, hydrateOverlayIfNeeded, isOverlayVisible, refreshFallbackHydratedOverlay, resetOverlayHydration, setOverlayTaskSuffix, setOverlayVisible, updateAllOverlayThemes } from "./overlayManager";
import { createJpHeightLifecycle } from "./jpHeightLifecycle";
import { onLayerAssetIndexReady } from "../data/layerAssetIndex";
import type { AppLayerHostDeps } from "../layers/layerHostDeps";
import type { CountryCamera, CountryCode } from "../constants/countries";

const LOADING_PREFIX = "compare-right:";
const MAP_LOADING_ID = `${LOADING_PREFIX}map`;

interface CountryCompareMapViewProps {
  /** 主地圖（左）；就緒後才建右圖 */
  mainMap: mapboxgl.Map;
  rightCountry: CountryCode;
  styleUrl: string;
  pureBlack: boolean;
  isDarkTheme: boolean;
  showBasemapLabels: boolean;
  featureInfo: FeatureInfo | null;
  onFeatureInfo: (info: FeatureInfo | null) => void;
  /** 主地圖那份 LayerHost deps；右圖換成自己的 mapRef */
  hostDeps: AppLayerHostDeps;
}

const cameraOfMap = (map: mapboxgl.Map): CountryCamera => {
  const c = map.getCenter();
  return { center: [c.lng, c.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
};

/** 右圖初始鏡頭：網址或上次的鏡頭 → 該國記住的鏡頭；比例尺同步開著時 zoom 換算成和主圖同比例尺 */
export function initialRightCamera(
  rightCountry: CountryCode,
  stored: CountryCamera | null,
  main: { zoom: number; lat: number },
  scaleLocked: boolean,
): CountryCamera {
  const camera = stored ?? countryCameraMemory.resolve(rightCountry);
  return scaleLocked ? { ...camera, zoom: scaleMatchedZoom(main.zoom, main.lat, camera.center[1]) } : camera;
}

export function CountryCompareMapView({ mainMap, rightCountry, styleUrl, pureBlack, isDarkTheme, showBasemapLabels, featureInfo, onFeatureInfo, hostDeps }: CountryCompareMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const { t } = useLocale();
  const isDarkRef = useRef(isDarkTheme);
  const pureBlackRef = useRef(pureBlack);
  const labelsRef = useRef(showBasemapLabels);
  const hiddenLabelsRef = useRef(new Set<string>());
  const onFeatureInfoRef = useRef(onFeatureInfo);
  const loadingLabelRef = useRef(t("compare.rightMapLoading"));
  // overlay 型右國圖層（右圖只管右國那幾筆；換右國由 key 重建，掛載時算一次即可）
  const overlayParams = useOverlayParams();
  const overlayParamsRef = useRef(overlayParams);
  overlayParamsRef.current = overlayParams;
  const [rightOverlays] = useState(() => OVERLAY_REGISTRY.filter((config) => isRightSideKey(String(config.id), rightCountry)));
  const jpHeightRef = useRef<ReturnType<typeof createJpHeightLifecycle> | null>(null);
  isDarkRef.current = isDarkTheme;
  pureBlackRef.current = pureBlack;
  labelsRef.current = showBasemapLabels;
  onFeatureInfoRef.current = onFeatureInfo;

  // 建立／銷毀（開才建、關就銷毀；換右國由 App 的 key 重建）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const snapshot = compareStore.getSnapshot();
    const camera = initialRightCamera(rightCountry, snapshot.rightCamera, { zoom: mainMap.getZoom(), lat: mainMap.getCenter().lat }, snapshot.scaleLocked);
    loadingRegistry.start(MAP_LOADING_ID, loadingLabelRef.current);
    let loading = true;
    const endLoading = () => { if (loading) { loading = false; loadingRegistry.end(MAP_LOADING_ID); } };
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
    setOverlayTaskSuffix(map, "-right");
    const jpHeight = createJpHeightLifecycle(map);
    jpHeightRef.current = jpHeight;
    map.on("style.load", () => {
      map.style?.setTransition({ duration: 0, delay: 0 });
      jpHeight.resume();
      if (pureBlackRef.current) applyPureBlackTheme(map);
      hiddenLabelsRef.current.clear();
      setBasemapLabelsVisible(map, labelsRef.current, hiddenLabelsRef.current);
      ensureTerrainIfTilted(map);
      // 右國 overlay：每次 style.load（含換底圖）重建 source／layer，這張圖的 hydrate 紀錄清掉重抓
      if (rightOverlays.length === 0) return;
      resetOverlayHydration(map);
      const vis = layerVisibilityStore.getAll();
      addAllOverlays(map, rightOverlays, isDarkRef.current, vis, overlayParamsRef.current, { deferJpHeightSources: true });
      jpHeight.refresh(rightOverlays, vis, isDarkRef.current, overlayParamsRef.current);
      for (const config of rightOverlays) {
        if (isOverlayVisible(config, vis, overlayParamsRef.current)) void hydrateOverlayIfNeeded(map, config);
      }
    });
    // 資產索引就緒：先前以部署時版本 hydrate 的改抓 CDN（同主地圖）
    const offAssetIndex = onLayerAssetIndexReady(() => {
      const vis = layerVisibilityStore.getAll();
      for (const config of rightOverlays) {
        if (!config.pmtiles && !config.dynamicData) refreshFallbackHydratedOverlay(map, config, isOverlayVisible(config, vis, overlayParamsRef.current));
      }
    });
    // 地形各自判斷（兩國各自傾斜，不鏡射主圖）
    map.on("pitch", () => ensureTerrainIfTilted(map));

    // 主地圖右側讓出半寬：視覺中心落在左半（並排不同步 padding）
    const previousRightPadding = mainMap.getPadding().right ?? 0;
    const applyPadding = () => {
      const right = Math.round(container.clientWidth);
      if (mainMap.getPadding().right !== right) mainMap.setPadding({ ...mainMap.getPadding(), right });
    };
    applyPadding();
    mainMap.on("resize", applyPadding);

    // 比例尺同步（開關每次 move 都讀）；重新打開時以主圖為準對齊一次
    const main = mainMap as unknown as ScaleSyncableMap;
    const right = map as unknown as ScaleSyncableMap;
    const offScale = syncScale(main, right, () => compareStore.getSnapshot().scaleLocked);
    let wasLocked = snapshot.scaleLocked;
    const offLock = compareStore.subscribe(() => {
      const locked = compareStore.getSnapshot().scaleLocked;
      if (locked && !wasLocked) alignScale(main, right);
      wasLocked = locked;
    });

    const detachStatistics = attachRegionalStatistics(map, () => isDarkRef.current, {
      primary: false,
      isShown: (key) => shownOnRight(key, layerVisibilityStore.getVisibility(key)),
      subscribe: (callback) => compareStore.subscribe(callback),
      loadingPrefix: LOADING_PREFIX,
    });

    // 右圖鏡頭寫回（分享網址 cmpv）＋右國記住上次的鏡頭（G1-a）
    map.on("moveend", () => {
      const cam = cameraOfMap(map);
      compareStore.setRightCamera(cam);
      countryCameraMemory.record(rightCountry, cam);
    });

    // 右半的點擊：與主地圖共用 GIS_LAYERS 命中（右圖只有右國圖層與右國統計）；沒命中＝關 popup（同主地圖空白處）
    map.on("click", (e) => {
      recordSelectionClick([e.lngLat.lng, e.lngLat.lat]);
      const hit = gisHitCandidates(map, e.point).next();
      if (hit.done) { onFeatureInfoRef.current(null); return; }
      const { type, features } = hit.value;
      const { properties, coords } = gisHitProperties(type, features[0]!, features, e.lngLat);
      onFeatureInfoRef.current({ layerType: type, properties: { ...properties, compare_side: "right" }, coords });
      sessionTracker.log("feature_click", { layerType: type, compareSide: "right" });
    });
    // 游標：每幀最多查一次
    let hoverFrame = 0;
    map.on("mousemove", (e) => {
      if (hoverFrame) return;
      const point = e.point;
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = 0;
        if (!mapRef.current) return;
        map.getCanvas().style.cursor = gisHitCandidates(map, point).next().done ? "" : "pointer";
      });
    });
    map.on("load", () => {
      mapRef.current = map;
      compareRightMap.set(map);
      if (import.meta.env.DEV || window.location.search.includes("debug")) (window as unknown as { __compareMap?: mapboxgl.Map | null }).__compareMap = map;
      endLoading();
      setReady(true);
    });
    map.on("error", endLoading);
    return () => {
      endLoading();
      offAssetIndex();
      jpHeight.dispose();
      jpHeightRef.current = null;
      cancelAnimationFrame(hoverFrame);
      offLock();
      offScale();
      detachStatistics();
      unbindLanguage();
      mainMap.off("resize", applyPadding);
      mainMap.setPadding({ ...mainMap.getPadding(), right: previousRightPadding });
      compareRightMap.set(null);
      if ((window as unknown as { __compareMap?: mapboxgl.Map | null }).__compareMap === map) (window as unknown as { __compareMap?: mapboxgl.Map | null }).__compareMap = null;
      mapRef.current = null;
      setReady(false);
      // 子層右國 Host 的 cleanup 在本 cleanup 之後才跑：延後銷毀，讓它們拿到的地圖仍存活
      queueMicrotask(() => map.remove());
    };
    // 只在掛載時建一次：styleUrl／主題另由下方 effect 套用；換右國由 key 重建
  }, [mainMap]);

  // 換底圖／Pure Black（同主地圖：純黑開＝壓色；關或換底圖＝完整重載 style）
  const appliedRef = useRef({ styleUrl, pureBlack });
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const applied = appliedRef.current;
    if (applied.styleUrl === styleUrl && applied.pureBlack === pureBlack) return;
    appliedRef.current = { styleUrl, pureBlack };
    if (applied.styleUrl === styleUrl && pureBlack) applyPureBlackTheme(map);
    else {
      jpHeightRef.current?.suspend();
      map.setStyle(styleUrl, { diff: false } as never);
    }
  }, [styleUrl, pureBlack, ready]);

  // 右國 overlay 開關：跟著圖層開關 store（同主地圖 applyOverlayVisibility，只管右國那幾筆）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || rightOverlays.length === 0) return;
    const apply = () => {
      const vis = layerVisibilityStore.getAll();
      for (const config of rightOverlays) {
        const visible = isOverlayVisible(config, vis, overlayParamsRef.current);
        if (visible) void hydrateOverlayIfNeeded(map, config);
        setOverlayVisible(map, config, visible, isDarkRef.current, overlayParamsRef.current);
      }
      jpHeightRef.current?.refresh(rightOverlays, vis, isDarkRef.current, overlayParamsRef.current);
    };
    apply();
    return layerVisibilityStore.subscribe(apply);
  }, [ready, rightOverlays]);

  // 右國 overlay 主題與參數（透明度、樣式、尺度）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || rightOverlays.length === 0) return;
    const vis = layerVisibilityStore.getAll();
    for (const config of rightOverlays) {
      // 尺度類參數會改變哪一筆 config 可見（例：住宿密度 450m／1500m）
      setOverlayVisible(map, config, isOverlayVisible(config, vis, overlayParams), isDarkTheme, overlayParams);
    }
    updateAllOverlayThemes(map, rightOverlays, isDarkTheme, overlayParams, vis);
    jpHeightRef.current?.refresh(rightOverlays, vis, isDarkTheme, overlayParams);
  }, [isDarkTheme, overlayParams, ready, rightOverlays]);

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
      // 主地圖之後渲染、z 0：蓋在主地圖右半，但在主地圖的控制角落（z 2）與所有介面（≥10）之下
      style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: "50%", zIndex: 0 }}
    >
      {ready && <RightCountryLayers mapRef={mapRef} rightCountry={rightCountry} hostDeps={hostDeps} featureInfo={featureInfo} />}
    </div>
  );
}

/** 右圖的右國 Host＋選取圈；右圖 load 之後才掛，hook 一定拿得到地圖 */
function RightCountryLayers({ mapRef, rightCountry, hostDeps, featureInfo }: {
  mapRef: React.RefObject<mapboxgl.Map | null>;
  rightCountry: CountryCode;
  hostDeps: AppLayerHostDeps;
  featureInfo: FeatureInfo | null;
}) {
  // 選取圈只畫右圖點出來的
  useSelectionRing(mapRef, featureInfo?.properties?.compare_side === "right" ? featureInfo : null);
  // LayerHosts 逐欄位比較 deps：mapRef 換成右圖、mapPrepared 恆為 true（右圖 load 後才掛）
  return <LayerHosts role="right" rightCountry={rightCountry} deps={{ ...hostDeps, mapRef, mapPrepared: true }} />;
}
